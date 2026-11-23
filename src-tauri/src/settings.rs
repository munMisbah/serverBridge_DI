use std::sync::OnceLock;
use tauri::{
    window::Color, Emitter, Manager, WebviewUrl, WebviewWindowBuilder, WindowEvent,
};

/// Serialize WebView2 window creation so concurrent calls (e.g. Expand All)
/// never collide inside CoreWebView2Environment and leave a window with an
/// opaque white swapchain.
fn window_create_lock() -> &'static tokio::sync::Mutex<()> {
    static LOCK: OnceLock<tokio::sync::Mutex<()>> = OnceLock::new();
    LOCK.get_or_init(|| tokio::sync::Mutex::new(()))
}

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

fn apply_windows_corners(win: &tauri::WebviewWindow) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::ffi::c_void;
        use std::mem::size_of;
        use windows::Win32::Foundation::HWND;
        use windows::Win32::Graphics::Dwm::{
            DwmExtendFrameIntoClientArea, DwmSetWindowAttribute, DWMWA_USE_IMMERSIVE_DARK_MODE,
            DWMWA_WINDOW_CORNER_PREFERENCE, DWMWCP_ROUND, DWM_WINDOW_CORNER_PREFERENCE,
        };
        use windows::Win32::UI::Controls::MARGINS;

        let raw_hwnd = win
            .hwnd()
            .map_err(|e| format!("Failed to get window HWND: {}", e))?;
        let hwnd = HWND(raw_hwnd.0 as *mut c_void);
        let dark_mode: i32 = 1;
        let corner_pref = DWMWCP_ROUND;
        let margins = MARGINS {
            cxLeftWidth: -1,
            cxRightWidth: -1,
            cyTopHeight: -1,
            cyBottomHeight: -1,
        };

        unsafe {
            let _ = DwmExtendFrameIntoClientArea(hwnd, &margins);
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

/// Apply official Windows 11 DWM System Backdrop (`DWMWA_SYSTEMBACKDROP_TYPE`) synchronously.
/// Using official `DWMSBT_TRANSIENTWINDOW` (3) instead of legacy Win10 SWCA avoids Windows 11's
/// multi-window white-out compositor bug when stacking multiple Floating Notes/Servers.
pub fn apply_windows_backdrop(win: &tauri::WebviewWindow, backdrop: &str) -> Result<(), String> {
    let _ = apply_windows_corners(win);

    #[cfg(target_os = "windows")]
    {
        use std::ffi::c_void;
        use std::mem::size_of;
        use windows::Win32::Foundation::HWND;
        use windows::Win32::Graphics::Dwm::{
            DwmSetWindowAttribute, DWMWA_SYSTEMBACKDROP_TYPE, DWMSBT_MAINWINDOW, DWMSBT_NONE,
            DWMSBT_TABBEDWINDOW, DWMSBT_TRANSIENTWINDOW, DWM_SYSTEMBACKDROP_TYPE,
        };

        let raw_hwnd = win
            .hwnd()
            .map_err(|e| format!("Failed to get window HWND: {}", e))?;
        let hwnd = HWND(raw_hwnd.0 as *mut c_void);

        let backdrop_type = match backdrop.trim().to_ascii_lowercase().as_str() {
            "acrylic" | "slate" => DWMSBT_TRANSIENTWINDOW,
            "tabbed" => DWMSBT_TABBEDWINDOW,
            "solid" | "none" => DWMSBT_NONE,
            _ => DWMSBT_MAINWINDOW, // "mica"
        };

        if backdrop_type != DWMSBT_NONE {
            let _ = win.set_background_color(Some(Color(0, 0, 0, 0)));
        }

        unsafe {
            let _ = DwmSetWindowAttribute(
                hwnd,
                DWMWA_SYSTEMBACKDROP_TYPE,
                &backdrop_type as *const DWM_SYSTEMBACKDROP_TYPE as *const c_void,
                size_of::<DWM_SYSTEMBACKDROP_TYPE>() as u32,
            );
        }
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = (win, backdrop);
        Ok(())
    }
}

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct FloatingGenieEvent {
    kind: String,
    id: String,
    direction: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
}

/// Returns the window's logical rect relative to the primary monitor's work area,
/// or `None` if the window is completely outside the primary monitor (e.g. Monitor 2).
fn window_rect_relative_to_primary(w: &tauri::WebviewWindow) -> Option<(f64, f64, f64, f64)> {
    let (Ok(pos), Ok(size), Ok(Some(primary))) =
        (w.outer_position(), w.inner_size(), w.primary_monitor())
    else {
        return None;
    };
    let work = primary.work_area();
    let p_scale = primary.scale_factor();
    let w_scale = w.scale_factor().unwrap_or(p_scale);

    let rel_x = ((pos.x - work.position.x) as f64 / p_scale).round();
    let rel_y = ((pos.y - work.position.y) as f64 / p_scale).round();
    let log_w = (size.width as f64 / w_scale).round();
    let log_h = (size.height as f64 / w_scale).round();
    let work_w = work.size.width as f64 / p_scale;
    let work_h = work.size.height as f64 / p_scale;

    if rel_x + log_w > 0.0 && rel_x < work_w && rel_y + log_h > 0.0 && rel_y < work_h {
        Some((rel_x, rel_y, log_w, log_h))
    } else {
        None
    }
}

fn emit_minimize_genie_if_primary(
    app: &tauri::AppHandle,
    win: &tauri::WebviewWindow,
    kind: &str,
    id: &str,
) -> bool {
    if let Some((x, y, width, height)) = window_rect_relative_to_primary(win) {
        let _ = app.emit_to(
            "main",
            "play-floating-genie",
            FloatingGenieEvent {
                kind: kind.to_string(),
                id: id.to_string(),
                direction: "minimize".to_string(),
                x,
                y,
                width,
                height,
            },
        );
        true
    } else {
        false
    }
}

#[tauri::command]
pub fn show_floating_window(
    app: tauri::AppHandle,
    kind: String,
    id: String,
    dark_glass: Option<bool>,
    backdrop: Option<String>,
) -> Result<(), String> {
    let label = if kind == "server" {
        server_window_label(&id)
    } else {
        note_window_label(&id)
    };
    if let Some(win) = app.get_webview_window(&label) {
        let _ = win.unminimize();
        let _ = win.show();
        let _ = win.set_focus();
        let chosen = if kind == "server" || dark_glass.unwrap_or(false) {
            backdrop.as_deref().unwrap_or("acrylic").to_string()
        } else {
            "solid".to_string()
        };
        let _ = apply_windows_backdrop(&win, &chosen);

        // Re-apply SWCA/DWM backdrop once WebView2 finishes its first visible composite frame
        // (prevents Windows 11 from dropping Acrylic on newly-shown batch windows during Expand All).
        let app_clone = app.clone();
        let label_clone = label.clone();
        let chosen_clone = chosen;
        tauri::async_runtime::spawn(async move {
            tokio::time::sleep(std::time::Duration::from_millis(160)).await;
            if let Some(w) = app_clone.get_webview_window(&label_clone) {
                if w.is_visible().unwrap_or(false) {
                    let _ = apply_windows_backdrop(&w, &chosen_clone);
                }
            }
        });
    }
    Ok(())
}

/// Apply backdrop to a single floating window once its WebView2 content has mounted.
#[tauri::command]
pub fn apply_floating_window_backdrop(
    app: tauri::AppHandle,
    kind: String,
    id: String,
    dark_glass: Option<bool>,
    backdrop: Option<String>,
) -> Result<(), String> {
    let label = if kind == "server" {
        server_window_label(&id)
    } else {
        note_window_label(&id)
    };
    if let Some(win) = app.get_webview_window(&label) {
        if win.is_visible().unwrap_or(false) {
            let chosen = if kind == "server" || dark_glass.unwrap_or(false) {
                backdrop.as_deref().unwrap_or("acrylic")
            } else {
                "solid"
            };
            let _ = apply_windows_backdrop(&win, chosen);
        }
    }
    Ok(())
}

#[tauri::command]
pub fn set_settings_backdrop(
    app: tauri::AppHandle,
    backdrop: String,
    apply_to_notes: Option<bool>,
) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("settings") {
        let _ = apply_windows_backdrop(&win, &backdrop);
    }
    // Sync backdrop to open floating server windows and (when dark-glass is active) floating note windows.
    let sync_notes = apply_to_notes.unwrap_or(false);
    for (label, win) in app.webview_windows() {
        if label.starts_with("srv-") || (sync_notes && label.starts_with("note-")) {
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

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct FloatingWindowGeometryEvent {
    id: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
}

fn emit_window_geometry(app: &tauri::AppHandle, event_name: &str, id: &str, w: &tauri::WebviewWindow) {
    let (Ok(pos), Ok(size)) = (w.outer_position(), w.inner_size()) else {
        return;
    };
    let scale = w.scale_factor().unwrap_or(1.0);
    let _ = app.emit(
        event_name,
        FloatingWindowGeometryEvent {
            id: id.to_string(),
            x: (pos.x as f64 / scale).round(),
            y: (pos.y as f64 / scale).round(),
            width: (size.width as f64 / scale).round(),
            height: (size.height as f64 / scale).round(),
        },
    );
}

#[tauri::command]
pub async fn open_floating_server_window(
    app: tauri::AppHandle,
    server_id: String,
    title: Option<String>,
    x: Option<f64>,
    y: Option<f64>,
    width: Option<f64>,
    height: Option<f64>,
    backdrop: Option<String>,
    initially_hidden: Option<bool>,
) -> Result<(), String> {
    let _guard = window_create_lock().lock().await;
    let label = server_window_label(&server_id);
    if let Some(win) = app.get_webview_window(&label) {
        if !initially_hidden.unwrap_or(false) {
            let _ = win.unminimize();
            let _ = win.show();
            let _ = win.set_focus();
        }
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
        .inner_size(width.unwrap_or(430.0).max(340.0), height.unwrap_or(320.0).max(240.0))
        .min_inner_size(340.0, 240.0)
        .resizable(true)
        .maximizable(false)
        .decorations(false)
        .transparent(true)
        .background_color(Color(0, 0, 0, 0))
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

    let _ = apply_windows_corners(&win);
    if !initially_hidden.unwrap_or(false) {
        let _ = win.show();
        let _ = win.set_focus();
        let chosen_backdrop = backdrop.as_deref().unwrap_or("acrylic");
        let _ = apply_windows_backdrop(&win, chosen_backdrop);
    }

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

                // If dropped at the top-center Dynamic Island dock zone, trigger cross-screen Genie in main overlay and hide immediately!
                if is_window_in_dock_zone(&w) {
                    dock_ref.store(false, std::sync::atomic::Ordering::SeqCst);
                    let _ = app_inner.emit(
                        "floating-server-dock-zone",
                        FloatingServerDockZoneEvent {
                            server_id: sid_inner.clone(),
                            active: false,
                        },
                    );
                    let animated = emit_minimize_genie_if_primary(&app_inner, &w, "server", &sid_inner);
                    let _ = w.hide();
                    let _ = w.close();
                    let _ = app_inner.emit(
                        "floating-server-state",
                        FloatingServerEvent {
                            server_id: sid_inner.clone(),
                            floating: false,
                        },
                    );
                    if !animated {
                        let _ = app_inner.emit("island-dock-pulse", sid_inner);
                    }
                } else {
                    emit_window_geometry(&app_inner, "floating-server-geometry", &sid_inner, &w);
                }
            });
        }
        WindowEvent::Resized(_) => {
            if let Some(w) = app_clone.get_webview_window(&label_clone) {
                emit_window_geometry(&app_clone, "floating-server-geometry", &sid_clone, &w);
            }
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
    animate_genie: Option<bool>,
) -> Result<(), String> {
    let label = server_window_label(&server_id);
    let mut animated = false;
    if let Some(win) = app.get_webview_window(&label) {
        if animate_genie.unwrap_or(true) {
            animated = emit_minimize_genie_if_primary(&app, &win, "server", &server_id);
        }
        let _ = win.hide();
        let _ = win.close();
    }
    let _ = app.emit(
        "floating-server-state",
        FloatingServerEvent {
            server_id: server_id.clone(),
            floating: false,
        },
    );
    if focus_main.unwrap_or(false) && !animated {
        let _ = app.emit("island-dock-pulse", server_id);
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

fn note_window_label(note_id: &str) -> String {
    let clean: String = note_id
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() || c == '-' || c == '_' { c } else { '_' })
        .collect();
    format!("note-{}", clean)
}

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct FloatingNoteDockZoneEvent {
    note_id: String,
    active: bool,
}

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct FloatingNoteClosedEvent {
    note_id: String,
    focus_main: bool,
}

#[tauri::command]
pub async fn open_floating_note_window(
    app: tauri::AppHandle,
    note_id: String,
    width: Option<f64>,
    height: Option<f64>,
    x: Option<f64>,
    y: Option<f64>,
    dark_glass: Option<bool>,
    backdrop: Option<String>,
    initially_hidden: Option<bool>,
) -> Result<(), String> {
    let _guard = window_create_lock().lock().await;
    let label = note_window_label(&note_id);
    if let Some(win) = app.get_webview_window(&label) {
        if !initially_hidden.unwrap_or(false) {
            let _ = win.unminimize();
            let _ = win.show();
            let _ = win.set_focus();
        }
        return Ok(());
    }

    let url = format!("index.html?floating-note={}", note_id);
    let w = width.unwrap_or(248.0).max(190.0);
    let h = height.unwrap_or(210.0).max(160.0);

    let mut builder = WebviewWindowBuilder::new(&app, &label, WebviewUrl::App(url.into()))
        .title("Sticky Note")
        .inner_size(w, h)
        .min_inner_size(190.0, 160.0)
        .resizable(true)
        .maximizable(false)
        .decorations(false)
        .transparent(true)
        .background_color(Color(0, 0, 0, 0))
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
        .map_err(|e| format!("Failed to create floating note window: {}", e))?;

    let _ = apply_windows_corners(&win);
    if !initially_hidden.unwrap_or(false) {
        let _ = win.show();
        let _ = win.set_focus();
        let chosen_backdrop = if dark_glass.unwrap_or(false) {
            backdrop.as_deref().unwrap_or("acrylic")
        } else {
            "solid"
        };
        let _ = apply_windows_backdrop(&win, chosen_backdrop);
        // Brief settle before next queued WebView2 window builds during Expand All
        tokio::time::sleep(std::time::Duration::from_millis(50)).await;
    }

    let app_clone = app.clone();
    let nid_clone = note_id.clone();
    let label_clone = label.clone();
    let move_seq = std::sync::Arc::new(std::sync::atomic::AtomicU64::new(0));
    let dock_zone_state = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));

    win.on_window_event(move |event| match event {
        WindowEvent::Destroyed => {
            if dock_zone_state.swap(false, std::sync::atomic::Ordering::SeqCst) {
                let _ = app_clone.emit(
                    "floating-note-dock-zone",
                    FloatingNoteDockZoneEvent {
                        note_id: nid_clone.clone(),
                        active: false,
                    },
                );
            }
            let _ = app_clone.emit(
                "floating-note-closed",
                FloatingNoteClosedEvent {
                    note_id: nid_clone.clone(),
                    focus_main: false,
                },
            );
        }
        WindowEvent::Moved(_) => {
            if let Some(w) = app_clone.get_webview_window(&label_clone) {
                let in_zone = is_window_in_dock_zone(&w);
                let prev = dock_zone_state.swap(in_zone, std::sync::atomic::Ordering::SeqCst);
                if prev != in_zone {
                    let _ = app_clone.emit(
                        "floating-note-dock-zone",
                        FloatingNoteDockZoneEvent {
                            note_id: nid_clone.clone(),
                            active: in_zone,
                        },
                    );
                }
            }

            let seq = move_seq.fetch_add(1, std::sync::atomic::Ordering::SeqCst) + 1;
            let seq_ref = move_seq.clone();
            let dock_ref = dock_zone_state.clone();
            let app_inner = app_clone.clone();
            let nid_inner = nid_clone.clone();
            let lbl_inner = label_clone.clone();

            tauri::async_runtime::spawn(async move {
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

                if is_window_in_dock_zone(&w) {
                    dock_ref.store(false, std::sync::atomic::Ordering::SeqCst);
                    let _ = app_inner.emit(
                        "floating-note-dock-zone",
                        FloatingNoteDockZoneEvent {
                            note_id: nid_inner.clone(),
                            active: false,
                        },
                    );
                    let animated = emit_minimize_genie_if_primary(&app_inner, &w, "note", &nid_inner);
                    let _ = w.hide();
                    let _ = w.close();
                    let _ = app_inner.emit(
                        "floating-note-closed",
                        FloatingNoteClosedEvent {
                            note_id: nid_inner.clone(),
                            focus_main: false,
                        },
                    );
                    if !animated {
                        let _ = app_inner.emit("island-dock-pulse", nid_inner);
                    }
                } else {
                    emit_window_geometry(&app_inner, "floating-note-geometry", &nid_inner, &w);
                }
            });
        }
        WindowEvent::Resized(_) => {
            if let Some(w) = app_clone.get_webview_window(&label_clone) {
                emit_window_geometry(&app_clone, "floating-note-geometry", &nid_clone, &w);
            }
        }
        _ => {}
    });

    Ok(())
}

#[tauri::command]
pub async fn close_floating_note_window(
    app: tauri::AppHandle,
    note_id: String,
    focus_main: Option<bool>,
    animate_genie: Option<bool>,
) -> Result<(), String> {
    let label = note_window_label(&note_id);
    let mut animated = false;
    if let Some(win) = app.get_webview_window(&label) {
        if animate_genie.unwrap_or(true) {
            animated = emit_minimize_genie_if_primary(&app, &win, "note", &note_id);
        }
        let _ = win.hide();
        let _ = win.close();
    }
    let _ = app.emit(
        "floating-note-closed",
        FloatingNoteClosedEvent {
            note_id: note_id.clone(),
            focus_main: focus_main.unwrap_or(false),
        },
    );
    if focus_main.unwrap_or(false) && !animated {
        let _ = app.emit("island-dock-pulse", note_id);
    }
    Ok(())
}

#[tauri::command]
pub fn set_floating_notes_style(
    app: tauri::AppHandle,
    dark_glass: bool,
    backdrop: Option<String>,
) -> Result<(), String> {
    let chosen = if dark_glass {
        backdrop.as_deref().unwrap_or("acrylic")
    } else {
        "solid"
    };
    for (label, win) in app.webview_windows() {
        if label.starts_with("note-") {
            let _ = apply_windows_backdrop(&win, chosen);
        }
    }
    Ok(())
}

/// Clear backdrop + native shadow on a single floating window right before its
/// Genie suck-up animation starts so no static Acrylic rectangle lingers behind.
#[tauri::command]
pub fn clear_floating_window_backdrop(
    app: tauri::AppHandle,
    kind: String,
    id: String,
) -> Result<(), String> {
    let label = if kind == "server" {
        server_window_label(&id)
    } else {
        note_window_label(&id)
    };
    if let Some(win) = app.get_webview_window(&label) {
        let _ = win.set_shadow(false);
        let _ = apply_windows_backdrop(&win, "solid");
    }
    Ok(())
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
