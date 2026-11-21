use tauri::{
    window::{Effect, EffectsBuilder},
    Emitter, Manager, WebviewUrl, WebviewWindowBuilder, WindowEvent,
};

/// Size of the settings window, mirrored in the CSS breakpoints.
const SETTINGS_WIDTH: f64 = 520.0;
const SETTINGS_HEIGHT: f64 = 620.0;

/// Create the settings window on first use, then focus it.
///
/// Keeping it out of `tauri.conf.json` avoids paying for a whole second WebView2
/// renderer process (~30 MB) while the user never opens settings.
pub fn ensure_settings_window(app: &tauri::AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("settings") {
        let _ = win.unminimize();
        let _ = win.show();
        let _ = win.set_focus();
        return Ok(());
    }

    let win = WebviewWindowBuilder::new(
        app,
        "settings",
        WebviewUrl::App("index.html?settings=1".into()),
    )
    .title("Pengaturan Dynamic Island")
    .inner_size(SETTINGS_WIDTH, SETTINGS_HEIGHT)
    .resizable(false)
    .decorations(false)
    .transparent(true)
    .always_on_top(true)
    .skip_taskbar(true)
    .shadow(false)
    .center()
    .visible(false)
    .build()
    .map_err(|e| format!("Failed to create settings window: {}", e))?;

    let _ = apply_windows_backdrop(&win, "acrylic");

    let _ = win.show();
    let _ = win.set_focus();
    Ok(())
}

#[cfg(target_os = "windows")]
fn set_swca_acrylic(hwnd_raw: isize, enabled: bool, abgr_color: u32) {
    use std::ffi::c_void;
    use windows::core::s;
    use windows::Win32::Foundation::HWND;
    use windows::Win32::System::LibraryLoader::{GetModuleHandleA, GetProcAddress};

    #[repr(C)]
    struct AccentPolicy {
        accent_state: u32,
        accent_flags: u32,
        gradient_color: u32,
        animation_id: u32,
    }

    #[repr(C)]
    struct WindowCompositionAttribData {
        attrib: u32,
        pv_data: *mut c_void,
        cb_data: usize,
    }

    type SetWindowCompositionAttributeFn =
        unsafe extern "system" fn(HWND, *mut WindowCompositionAttribData) -> i32;

    unsafe {
        let Ok(user32) = GetModuleHandleA(s!("user32.dll")) else {
            return;
        };
        let Some(proc_addr) = GetProcAddress(user32, s!("SetWindowCompositionAttribute")) else {
            return;
        };
        let func: SetWindowCompositionAttributeFn = std::mem::transmute(proc_addr);

        let mut policy = AccentPolicy {
            // 4 = ACCENT_ENABLE_ACRYLICBLURBEHIND, 0 = ACCENT_DISABLED
            accent_state: if enabled { 4 } else { 0 },
            accent_flags: if enabled { 2 } else { 0 },
            gradient_color: if enabled { abgr_color } else { 0 },
            animation_id: 0,
        };

        let mut data = WindowCompositionAttribData {
            attrib: 19, // WCA_ACCENT_POLICY
            pv_data: &mut policy as *mut AccentPolicy as *mut c_void,
            cb_data: std::mem::size_of::<AccentPolicy>(),
        };

        let _ = func(HWND(hwnd_raw as *mut c_void), &mut data);
    }
}

fn apply_windows_corners(win: &tauri::WebviewWindow) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::ffi::c_void;
        use std::mem::size_of;
        use windows::Win32::Foundation::HWND;
        use windows::Win32::Graphics::Dwm::{
            DwmSetWindowAttribute, DWMWA_USE_IMMERSIVE_DARK_MODE, DWMWA_WINDOW_CORNER_PREFERENCE,
            DWMWCP_ROUND, DWM_WINDOW_CORNER_PREFERENCE,
        };

        let raw_hwnd = win
            .hwnd()
            .map_err(|e| format!("Failed to get settings HWND: {}", e))?;
        let hwnd = HWND(raw_hwnd.0 as *mut c_void);
        let dark_mode: i32 = 1;
        let corner_pref = DWMWCP_ROUND;

        unsafe {
            let _ = DwmSetWindowAttribute(
                hwnd,
                DWMWA_USE_IMMERSIVE_DARK_MODE,
                &dark_mode as *const i32 as *const c_void,
                size_of::<i32>() as u32,
            );
            let _ = DwmSetWindowAttribute(
                hwnd,
                DWMWA_WINDOW_CORNER_PREFERENCE,
                &corner_pref as *const DWM_WINDOW_CORNER_PREFERENCE as *const c_void,
                size_of::<DWM_WINDOW_CORNER_PREFERENCE>() as u32,
            );
        }
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = win;
        Ok(())
    }
}

/// Apply native Windows 11 DWM backdrop material:
/// - "acrylic": Real translucent frosted blur behind the window via SWCA (custom ~42% dark tint)
/// - "mica": Native Windows 11 MicaDark (wallpaper-tinted)
/// - "tabbed": Native Windows 11 Mica Alt (TabbedDark)
/// - "solid": No native backdrop
pub fn apply_windows_backdrop(win: &tauri::WebviewWindow, backdrop: &str) -> Result<(), String> {
    let _ = apply_windows_corners(win);

    #[cfg(target_os = "windows")]
    let raw_hwnd = win.hwnd().map(|h| h.0 as isize).ok();

    match backdrop.trim().to_ascii_lowercase().as_str() {
        "acrylic" => {
            // Clear DWM system backdrop first so SWCA translucent acrylic takes over cleanly.
            let _ = win.set_effects(None);
            #[cfg(target_os = "windows")]
            if let Some(hwnd) = raw_hwnd {
                // ABGR: Alpha 0x68 (~41%), B=0x16, G=0x12, R=0x10 -> crisp translucent dark glass
                set_swca_acrylic(hwnd, true, 0x68161210);
            }
            Ok(())
        }
        "tabbed" => {
            #[cfg(target_os = "windows")]
            if let Some(hwnd) = raw_hwnd {
                set_swca_acrylic(hwnd, false, 0);
            }
            win.set_effects(Some(EffectsBuilder::new().effect(Effect::TabbedDark).build()))
                .map_err(|e| format!("Failed to apply Tabbed backdrop: {}", e))
        }
        "solid" | "none" => {
            #[cfg(target_os = "windows")]
            if let Some(hwnd) = raw_hwnd {
                set_swca_acrylic(hwnd, false, 0);
            }
            win.set_effects(None)
                .map_err(|e| format!("Failed to clear backdrop: {}", e))
        }
        _ => {
            #[cfg(target_os = "windows")]
            if let Some(hwnd) = raw_hwnd {
                set_swca_acrylic(hwnd, false, 0);
            }
            win.set_effects(Some(EffectsBuilder::new().effect(Effect::MicaDark).build()))
                .map_err(|e| format!("Failed to apply Mica backdrop: {}", e))
        }
    }
}

#[tauri::command]
pub fn set_settings_backdrop(app: tauri::AppHandle, backdrop: String) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("settings") {
        let _ = apply_windows_backdrop(&win, &backdrop);
    }
    // Also sync backdrop to any open native floating server windows.
    for (label, win) in app.webview_windows() {
        if label.starts_with("srv-") {
            let _ = apply_windows_backdrop(&win, &backdrop);
        }
    }
    Ok(())
}

fn server_window_label(server_id: &str) -> String {
    let clean: String = server_id
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() || c == '-' || c == '_' { c } else { '_' })
        .collect();
    format!("srv-{}", clean)
}

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct FloatingServerEvent {
    server_id: String,
    floating: bool,
}

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct FloatingServerDockZoneEvent {
    server_id: String,
    active: bool,
}

fn is_window_in_dock_zone(w: &tauri::WebviewWindow) -> bool {
    let (Ok(pos), Ok(size), Ok(Some(primary))) =
        (w.outer_position(), w.outer_size(), w.primary_monitor())
    else {
        return false;
    };
    let work = primary.work_area();
    let scale = primary.scale_factor();
    let win_center_x = pos.x as f64 + (size.width as f64 / 2.0);
    let primary_center_x = work.position.x as f64 + (work.size.width as f64 / 2.0);
    let dist_from_top = (pos.y - work.position.y) as f64 / scale;
    let dist_from_center = (win_center_x - primary_center_x).abs() / scale;
    dist_from_top <= 28.0 && dist_from_center <= 220.0
}

#[tauri::command]
pub async fn open_floating_server_window(
    app: tauri::AppHandle,
    server_id: String,
    title: Option<String>,
    x: Option<f64>,
    y: Option<f64>,
    backdrop: Option<String>,
) -> Result<(), String> {
    let label = server_window_label(&server_id);
    if let Some(win) = app.get_webview_window(&label) {
        let _ = win.unminimize();
        let _ = win.show();
        let _ = win.set_focus();
        let _ = app.emit(
            "floating-server-state",
            FloatingServerEvent {
                server_id,
                floating: true,
            },
        );
        return Ok(());
    }

    let url = format!("index.html?floating-server={}", server_id);
    let win_title = title
        .filter(|s| !s.trim().is_empty())
        .map(|s| format!("{} — Server Monitor", s))
        .unwrap_or_else(|| "Server Monitor".to_string());

    let mut builder = WebviewWindowBuilder::new(&app, &label, WebviewUrl::App(url.into()))
        .title(&win_title)
        .inner_size(430.0, 320.0)
        .min_inner_size(340.0, 240.0)
        .resizable(true)
        .maximizable(false)
        .decorations(false)
        .transparent(true)
        .always_on_top(true)
        .skip_taskbar(true)
        .shadow(true)
        .visible(false);

    if let (Some(px), Some(py)) = (x, y) {
        builder = builder.position(px, py);
    } else {
        builder = builder.center();
    }

    let win = builder
        .build()
        .map_err(|e| format!("Failed to create floating server window: {}", e))?;

    let _ = win.show();
    let _ = win.set_focus();
    let chosen_backdrop = backdrop.as_deref().unwrap_or("acrylic");
    let _ = apply_windows_backdrop(&win, chosen_backdrop);

    let app_clone = app.clone();
    let sid_clone = server_id.clone();
    let label_clone = label.clone();
    let move_seq = std::sync::Arc::new(std::sync::atomic::AtomicU64::new(0));
    let dock_zone_state = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
    win.on_window_event(move |event| match event {
        WindowEvent::Destroyed => {
            if dock_zone_state.swap(false, std::sync::atomic::Ordering::SeqCst) {
                let _ = app_clone.emit(
                    "floating-server-dock-zone",
                    FloatingServerDockZoneEvent {
                        server_id: sid_clone.clone(),
                        active: false,
                    },
                );
            }
            let _ = app_clone.emit(
                "floating-server-state",
                FloatingServerEvent {
                    server_id: sid_clone.clone(),
                    floating: false,
                },
            );
        }
        WindowEvent::Moved(_) => {
            if let Some(w) = app_clone.get_webview_window(&label_clone) {
                let in_zone = is_window_in_dock_zone(&w);
                let prev = dock_zone_state.swap(in_zone, std::sync::atomic::Ordering::SeqCst);
                if prev != in_zone {
                    let _ = app_clone.emit(
                        "floating-server-dock-zone",
                        FloatingServerDockZoneEvent {
                            server_id: sid_clone.clone(),
                            active: in_zone,
                        },
                    );
                }
            }

            let seq = move_seq.fetch_add(1, std::sync::atomic::Ordering::SeqCst) + 1;
            let seq_ref = move_seq.clone();
            let dock_ref = dock_zone_state.clone();
            let app_inner = app_clone.clone();
            let sid_inner = sid_clone.clone();
            let lbl_inner = label_clone.clone();

            tauri::async_runtime::spawn(async move {
                // Wait until drag settles and left mouse button is released.
                for _ in 0..20 {
                    tokio::time::sleep(std::time::Duration::from_millis(80)).await;
                    if seq_ref.load(std::sync::atomic::Ordering::SeqCst) != seq {
                        return;
                    }
                    #[cfg(target_os = "windows")]
                    let mouse_down = unsafe {
                        use windows::Win32::UI::Input::KeyboardAndMouse::{
                            GetAsyncKeyState, VK_LBUTTON,
                        };
                        (GetAsyncKeyState(VK_LBUTTON.0 as i32) as u16 & 0x8000) != 0
                    };
                    #[cfg(not(target_os = "windows"))]
                    let mouse_down = false;

                    if !mouse_down {
                        break;
                    }
                }

                if seq_ref.load(std::sync::atomic::Ordering::SeqCst) != seq {
                    return;
                }

                let Some(w) = app_inner.get_webview_window(&lbl_inner) else {
                    return;
                };

                // If dropped at the top-center Dynamic Island dock zone, auto-dock back!
                if is_window_in_dock_zone(&w) {
                    dock_ref.store(false, std::sync::atomic::Ordering::SeqCst);
                    let _ = app_inner.emit(
                        "floating-server-dock-zone",
                        FloatingServerDockZoneEvent {
                            server_id: sid_inner.clone(),
                            active: false,
                        },
                    );
                    let _ = w.close();
                    let _ = app_inner.emit(
                        "floating-server-state",
                        FloatingServerEvent {
                            server_id: sid_inner.clone(),
                            floating: false,
                        },
                    );
                    let _ = app_inner.emit("dock-server-focus", sid_inner);
                }
            });
        }
        _ => {}
    });

    let _ = app.emit(
        "floating-server-state",
        FloatingServerEvent {
            server_id,
            floating: true,
        },
    );
    Ok(())
}

#[tauri::command]
pub async fn close_floating_server_window(
    app: tauri::AppHandle,
    server_id: String,
    focus_main: Option<bool>,
) -> Result<(), String> {
    let label = server_window_label(&server_id);
    if let Some(win) = app.get_webview_window(&label) {
        let _ = win.close();
    }
    let _ = app.emit(
        "floating-server-state",
        FloatingServerEvent {
            server_id: server_id.clone(),
            floating: false,
        },
    );
    if focus_main.unwrap_or(false) {
        let _ = app.emit("dock-server-focus", server_id);
    }
    Ok(())
}

#[tauri::command]
pub fn set_floating_server_always_on_top(
    app: tauri::AppHandle,
    server_id: String,
    enabled: bool,
) -> Result<(), String> {
    let label = server_window_label(&server_id);
    let win = app
        .get_webview_window(&label)
        .ok_or_else(|| "Floating server window not found".to_string())?;
    win.set_always_on_top(enabled)
        .map_err(|e| format!("Failed to set always on top: {}", e))
}

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
