use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemBattery {
    pub level: u8,
    pub charging: bool,
    pub plugged_in: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BluetoothBatteryDevice {
    pub id: String,
    pub name: String,
    pub kind: String,
    pub level: u8,
    pub connected: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatterySnapshot {
    pub system: Option<SystemBattery>,
    pub bluetooth: Vec<BluetoothBatteryDevice>,
    pub updated_at: u64,
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// Battery snapshot for the host laptop and paired Bluetooth accessories.
///
/// Windows reports accessory charge through the Bluetooth device property
/// `{104EA319-6EE2-4701-BD47-8DDBF425BBE5} 2` (the value shown in
/// Settings > Bluetooth & devices). This enumerates present PnP nodes and reads
/// that property; accessories that never publish it cannot be surfaced.
#[tauri::command]
pub async fn get_battery_snapshot() -> Result<BatterySnapshot, String> {
    tokio::task::spawn_blocking(read_snapshot)
        .await
        .map_err(|e| format!("Battery task join error: {}", e))
}

fn read_snapshot() -> BatterySnapshot {
    #[cfg(target_os = "windows")]
    {
        let system = read_system_battery();
        let bluetooth = read_bluetooth_batteries();
        return BatterySnapshot {
            system,
            bluetooth,
            updated_at: now_ms(),
        };
    }

    #[cfg(not(target_os = "windows"))]
    {
        BatterySnapshot {
            system: None,
            bluetooth: Vec::new(),
            updated_at: now_ms(),
        }
    }
}

#[cfg(target_os = "windows")]
fn read_system_battery() -> Option<SystemBattery> {
    use windows::Win32::System::Power::{GetSystemPowerStatus, SYSTEM_POWER_STATUS};

    let mut status = SYSTEM_POWER_STATUS::default();
    unsafe { GetSystemPowerStatus(&mut status) }.ok()?;

    // 255 = unknown, 128 = the machine has no system battery.
    if status.BatteryLifePercent == 255 || status.BatteryFlag == 128 {
        return None;
    }

    Some(SystemBattery {
        level: status.BatteryLifePercent.min(100),
        charging: status.BatteryFlag & 8 != 0,
        plugged_in: status.ACLineStatus == 1,
    })
}

#[cfg(target_os = "windows")]
fn read_bluetooth_batteries() -> Vec<BluetoothBatteryDevice> {
    use windows::core::PCWSTR;
    use windows::Win32::Devices::DeviceAndDriverInstallation::{
        SetupDiDestroyDeviceInfoList, SetupDiEnumDeviceInfo, SetupDiGetClassDevsW,
        DIGCF_ALLCLASSES, DIGCF_PRESENT, HDEVINFO, SP_DEVINFO_DATA,
    };
    use windows::Win32::Devices::Properties::{
        DEVPROPKEY, DEVPKEY_Device_ContainerId, DEVPKEY_Device_DeviceDesc,
        DEVPKEY_Device_FriendlyName,
    };
    use windows::Win32::Foundation::HWND;

    // DEVPKEY_Bluetooth_Battery is not exported by windows-rs 0.58.
    const DEVPKEY_BLUETOOTH_BATTERY: DEVPROPKEY = DEVPROPKEY {
        fmtid: windows::core::GUID::from_u128(0x104ea319_6ee2_4701_bd47_8ddbf425bbe5),
        pid: 2,
    };

    let set: HDEVINFO =
        match unsafe { SetupDiGetClassDevsW(None, PCWSTR::null(), HWND::default(), DIGCF_PRESENT | DIGCF_ALLCLASSES) } {
            Ok(set) => set,
            Err(_) => return Vec::new(),
        };

    let mut devices: Vec<BluetoothBatteryDevice> = Vec::new();
    let mut seen: Vec<String> = Vec::new();
    let mut index = 0u32;

    loop {
        let mut info = SP_DEVINFO_DATA {
            cbSize: std::mem::size_of::<SP_DEVINFO_DATA>() as u32,
            ..Default::default()
        };

        if unsafe { SetupDiEnumDeviceInfo(set, index, &mut info) }.is_err() {
            break;
        }
        index += 1;

        let instance_id = unsafe { device_instance_id(set, &info) };
        let Some(instance_id) = instance_id else {
            continue;
        };

        let Some(level) = (unsafe { device_battery_level(set, &info, &DEVPKEY_BLUETOOTH_BATTERY) })
        else {
            continue;
        };

        let friendly_name = unsafe { device_string_property(set, &info, &DEVPKEY_Device_FriendlyName) }
            .or_else(|| unsafe { device_string_property(set, &info, &DEVPKEY_Device_DeviceDesc) });
        let Some(name) = friendly_name else {
            continue;
        };

        let is_bluetooth_node = instance_id.starts_with("BTHENUM\\")
            || instance_id.starts_with("BTHLE\\")
            || instance_id.starts_with("BTHHFENUM\\");
        let kind = classify_device(&name);
        if !is_bluetooth_node && kind == "bluetooth" && !name.to_lowercase().contains("bluetooth") {
            continue;
        }

        let container_id = unsafe { device_string_property(set, &info, &DEVPKEY_Device_ContainerId) };
        let id = container_id.unwrap_or_else(|| instance_id.clone());
        if seen.iter().any(|existing| existing == &id) {
            continue;
        }
        seen.push(id.clone());

        devices.push(BluetoothBatteryDevice {
            id,
            name,
            kind: kind.to_string(),
            level,
            connected: true,
        });
    }

    unsafe {
        let _ = SetupDiDestroyDeviceInfoList(set);
    }

    devices.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    devices
}

#[cfg(target_os = "windows")]
unsafe fn device_instance_id(
    set: windows::Win32::Devices::DeviceAndDriverInstallation::HDEVINFO,
    info: &windows::Win32::Devices::DeviceAndDriverInstallation::SP_DEVINFO_DATA,
) -> Option<String> {
    use windows::Win32::Devices::DeviceAndDriverInstallation::SetupDiGetDeviceInstanceIdW;

    let mut required = 0u32;
    let _ = SetupDiGetDeviceInstanceIdW(set, info, None, Some(&mut required));
    if required == 0 {
        return None;
    }

    let mut buffer = vec![0u16; required as usize];
    let mut written = 0u32;
    SetupDiGetDeviceInstanceIdW(set, info, Some(&mut buffer), Some(&mut written)).ok()?;

    let len = buffer.iter().position(|unit| *unit == 0).unwrap_or(buffer.len());
    let instance_id = String::from_utf16_lossy(&buffer[..len]);
    (!instance_id.is_empty()).then_some(instance_id)
}

#[cfg(target_os = "windows")]
unsafe fn device_property(
    set: windows::Win32::Devices::DeviceAndDriverInstallation::HDEVINFO,
    info: &windows::Win32::Devices::DeviceAndDriverInstallation::SP_DEVINFO_DATA,
    key: &windows::Win32::Devices::Properties::DEVPROPKEY,
) -> Option<(windows::Win32::Devices::Properties::DEVPROPTYPE, Vec<u8>)> {
    use windows::Win32::Devices::DeviceAndDriverInstallation::SetupDiGetDevicePropertyW;
    use windows::Win32::Devices::Properties::DEVPROPTYPE;

    let mut property_type = DEVPROPTYPE(0);
    let mut required = 0u32;
    let _ = SetupDiGetDevicePropertyW(
        set,
        info,
        key,
        &mut property_type,
        None,
        Some(&mut required),
        0,
    );
    // The probe returns ERROR_INSUFFICIENT_BUFFER without a usable type; only
    // RequiredSize is reliable until the buffer is supplied.
    if required == 0 {
        return None;
    }

    let mut buffer = vec![0u8; required as usize];
    let mut written_type = DEVPROPTYPE(0);
    let mut written = 0u32;
    SetupDiGetDevicePropertyW(
        set,
        info,
        key,
        &mut written_type,
        Some(&mut buffer),
        Some(&mut written),
        0,
    )
    .ok()?;

    Some((written_type, buffer))
}

#[cfg(target_os = "windows")]
unsafe fn device_string_property(
    set: windows::Win32::Devices::DeviceAndDriverInstallation::HDEVINFO,
    info: &windows::Win32::Devices::DeviceAndDriverInstallation::SP_DEVINFO_DATA,
    key: &windows::Win32::Devices::Properties::DEVPROPKEY,
) -> Option<String> {
    use windows::Win32::Devices::Properties::DEVPROP_TYPE_STRING;

    let (property_type, buffer) = device_property(set, info, key)?;
    if property_type != DEVPROP_TYPE_STRING {
        // ContainerId (GUID) is folded into a stable hex string.
        if buffer.len() == 16 {
            return Some(buffer.iter().map(|byte| format!("{:02x}", byte)).collect());
        }
        return None;
    }

    let units: Vec<u16> = buffer
        .chunks_exact(2)
        .map(|chunk| u16::from_le_bytes([chunk[0], chunk[1]]))
        .take_while(|unit| *unit != 0)
        .collect();
    let value = String::from_utf16_lossy(&units).trim().to_string();
    (!value.is_empty()).then_some(value)
}

#[cfg(target_os = "windows")]
unsafe fn device_battery_level(
    set: windows::Win32::Devices::DeviceAndDriverInstallation::HDEVINFO,
    info: &windows::Win32::Devices::DeviceAndDriverInstallation::SP_DEVINFO_DATA,
    key: &windows::Win32::Devices::Properties::DEVPROPKEY,
) -> Option<u8> {
    use windows::Win32::Devices::Properties::{
        DEVPROP_TYPE_BYTE, DEVPROP_TYPE_INT16, DEVPROP_TYPE_INT32, DEVPROP_TYPE_STRING,
        DEVPROP_TYPE_UINT16, DEVPROP_TYPE_UINT32,
    };

    let (property_type, buffer) = device_property(set, info, key)?;

    let raw: u32 = match property_type {
        DEVPROP_TYPE_BYTE => buffer.first().copied()? as u32,
        DEVPROP_TYPE_UINT16 => u16::from_le_bytes([*buffer.first()?, *buffer.get(1)?]) as u32,
        DEVPROP_TYPE_UINT32 => u32::from_le_bytes([
            *buffer.first()?,
            *buffer.get(1)?,
            *buffer.get(2)?,
            *buffer.get(3)?,
        ]),
        DEVPROP_TYPE_INT16 => i16::from_le_bytes([*buffer.first()?, *buffer.get(1)?]) as u32,
        DEVPROP_TYPE_INT32 => i32::from_le_bytes([
            *buffer.first()?,
            *buffer.get(1)?,
            *buffer.get(2)?,
            *buffer.get(3)?,
        ]) as u32,
        DEVPROP_TYPE_STRING => {
            let units: Vec<u16> = buffer
                .chunks_exact(2)
                .map(|chunk| u16::from_le_bytes([chunk[0], chunk[1]]))
                .take_while(|unit| *unit != 0)
                .collect();
            String::from_utf16_lossy(&units).trim().parse::<u32>().ok()?
        }
        _ => return None,
    };

    (raw <= 100).then_some(raw as u8)
}

#[cfg(target_os = "windows")]
fn classify_device(name: &str) -> &'static str {
    let name = name.to_lowercase();
    let has = |needles: &[&str]| needles.iter().any(|needle| name.contains(needle));

    if has(&["airpods", "buds", "earbud", "tws", "freebuds", "soundcore"]) {
        "earbuds"
    } else if has(&[
        "headphone",
        "headset",
        "wh-",
        "wf-",
        "jabra",
        "beats",
        "bose",
        "sony",
        "audio-technica",
    ]) {
        "headphones"
    } else if has(&["keyboard", "keychron", "mx keys", "magic keyboard"]) {
        "keyboard"
    } else if has(&["mouse", "mx master", "m720", "m590", "razer", "logitech"]) {
        "mouse"
    } else if has(&["speaker", "soundbar", "jbl", "boom", "homepod"]) {
        "speaker"
    } else if has(&["watch", "band", "fitbit", "garmin"]) {
        "watch"
    } else if has(&["phone", "iphone", "galaxy", "pixel", "redmi", "xiaomi", "oneplus"]) {
        "phone"
    } else if has(&["controller", "gamepad", "xbox", "dualsense", "dualshock", "8bitdo"]) {
        "controller"
    } else {
        "bluetooth"
    }
}