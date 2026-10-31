use tauri::Manager;

#[tauri::command]
pub fn hide_settings_window(app: tauri::AppHandle) {
    if let Some(win) = app.get_webview_window("settings") {
        let _ = win.hide();
    }
}

#[tauri::command]
pub fn minimize_settings_window(app: tauri::AppHandle) {
    if let Some(win) = app.get_webview_window("settings") {
        let _ = win.minimize();
    }
}

/// Autostart command implementation for Windows using native in-process Win32 Registry API.
/// Runs asynchronously off the main thread to guarantee the UI never hangs.
#[tauri::command]
pub async fn set_autostart_enabled(enabled: bool) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        #[cfg(target_os = "windows")]
        {
            use windows::core::{w, HSTRING};
            use windows::Win32::System::Registry::{
                RegCloseKey, RegDeleteValueW, RegOpenKeyExW, RegSetValueExW, HKEY,
                HKEY_CURRENT_USER, KEY_SET_VALUE, REG_SZ,
            };

            let subkey = w!(r"Software\Microsoft\Windows\CurrentVersion\Run");
            let app_name = w!("DynamicIslandWin");

            let mut hkey = HKEY::default();
            let status = unsafe {
                RegOpenKeyExW(
                    HKEY_CURRENT_USER,
                    subkey,
                    0,
                    KEY_SET_VALUE,
                    &mut hkey,
                )
            };

            if status.is_err() {
                return Err(format!("Failed to open registry key: {:?}", status));
            }

            if enabled {
                let exe_path = std::env::current_exe()
                    .map_err(|e| format!("Failed to get current executable path: {}", e))?;
                let formatted = format!("\"{}\"", exe_path.to_string_lossy());
                let hstr = HSTRING::from(formatted);
                let u16_slice = hstr.as_wide();
                let mut bytes = Vec::with_capacity((u16_slice.len() + 1) * 2);
                for &code in u16_slice {
                    bytes.extend_from_slice(&code.to_le_bytes());
                }
                bytes.extend_from_slice(&0u16.to_le_bytes());

                let res = unsafe {
                    RegSetValueExW(
                        hkey,
                        app_name,
                        0,
                        REG_SZ,
                        Some(&bytes),
                    )
                };
                unsafe { let _ = RegCloseKey(hkey); }
                if res.is_err() {
                    return Err(format!("Failed to write registry value: {:?}", res));
                }
            } else {
                let _ = unsafe { RegDeleteValueW(hkey, app_name) };
                unsafe { let _ = RegCloseKey(hkey); }
            }
        }

        #[cfg(not(target_os = "windows"))]
        {
            let _ = enabled;
        }

        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}
