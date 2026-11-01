use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};

#[derive(Debug, Clone, Copy, serde::Serialize, serde::Deserialize)]
pub struct HitRect {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

#[derive(Debug, Clone, Copy, serde::Serialize, serde::Deserialize)]
pub struct CursorPositionPayload {
    pub x: f64,
    pub y: f64,
}

/// One snapshot of the frontend layout:
/// - `island` drives both hover detection and interactivity
/// - `interactive` holds floating note rects (click-through is disabled there)
/// - `force` keeps the whole window interactive while dragging/resizing a note
#[derive(Debug, Clone, Default)]
pub struct HitTestConfig {
    pub island: Option<HitRect>,
    pub interactive: Vec<HitRect>,
    pub force: bool,
}

/// Logical island bounds (CSS pixels, relative to the window client area).
/// The native loop uses this to decide whether the window should receive
/// cursor events or pass them through to the desktop.
#[derive(Clone, Default)]
pub struct HitTestState {
    pub config: Arc<Mutex<Option<HitTestConfig>>>,
}

fn contains(rect: &HitRect, x: f64, y: f64, slop: f64) -> bool {
    x >= rect.x - slop
        && x < rect.x + rect.width + slop
        && y >= rect.y - slop
        && y < rect.y + rect.height + slop
}

#[cfg(target_os = "windows")]
fn is_background_app_window_at(screen_x: i32, screen_y: i32, my_hwnd: isize) -> bool {
    use windows::Win32::Foundation::{POINT, RECT};
    use windows::Win32::UI::WindowsAndMessaging::{
        GetAncestor, GetDesktopWindow, GetForegroundWindow, GetShellWindow, GetWindowLongW,
        GetWindowRect, GetWindowTextLengthW, IsWindowVisible, WindowFromPoint, GA_ROOT, GWL_EXSTYLE,
        WS_EX_TOOLWINDOW, WS_EX_TRANSPARENT,
    };

    unsafe {
        let pt = POINT { x: screen_x, y: screen_y };
        let hit = WindowFromPoint(pt);
        if hit.0.is_null() {
            return false;
        }
        let root = GetAncestor(hit, GA_ROOT);
        let target = if !root.0.is_null() { root } else { hit };

        if target.0.is_null() || (target.0 as isize) == my_hwnd {
            // The direct window under cursor is our own transparent webview or none;
            // check if the current active foreground window sits under the cursor
            let fg = GetForegroundWindow();
            if !fg.0.is_null() && (fg.0 as isize) != my_hwnd {
                let mut r = RECT::default();
                if GetWindowRect(fg, &mut r).is_ok() {
                    if screen_x >= r.left && screen_x < r.right && screen_y >= r.top && screen_y < r.bottom {
                        let shell = GetShellWindow();
                        let desktop = GetDesktopWindow();
                        if fg != shell && fg != desktop {
                            return true;
                        }
                    }
                }
            }
            return false;
        }

        let shell = GetShellWindow();
        let desktop = GetDesktopWindow();
        if target == shell || target == desktop {
            return false;
        }

        if !IsWindowVisible(target).as_bool() {
            return false;
        }

        let ex_style = GetWindowLongW(target, GWL_EXSTYLE) as u32;
        if (ex_style & WS_EX_TOOLWINDOW.0 != 0) || (ex_style & WS_EX_TRANSPARENT.0 != 0) {
            return false;
        }

        // Ignore unnamed or tiny windows
        let title_len = GetWindowTextLengthW(target);
        if title_len == 0 {
            return false;
        }

        let mut r = RECT::default();
        if GetWindowRect(target, &mut r).is_ok() {
            let w = r.right - r.left;
            let h = r.bottom - r.top;
            if w > 200 && h > 150 {
                return true;
            }
        }

        false
    }
}

#[cfg(not(target_os = "windows"))]
fn is_background_app_window_at(_screen_x: i32, _screen_y: i32, _my_hwnd: isize) -> bool {
    false
}

#[tauri::command]
pub fn set_hit_test_config(
    state: tauri::State<'_, HitTestState>,
    island: Option<HitRect>,
    interactive: Vec<HitRect>,
    force: bool,
) {
    if let Ok(mut config) = state.config.lock() {
        *config = Some(HitTestConfig {
            island,
            interactive,
            force,
        });
    }
}

/// Polls the OS cursor at 50 Hz. The window is fixed at its maximum footprint,
/// so instead of resizing it per state we toggle click-through on the transparent
/// area. This keeps island animations entirely inside an unchanged webview.
pub fn start_hit_test_loop(app: AppHandle) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };

    let Some(state) = app.try_state::<HitTestState>() else {
        return;
    };
    let config_state = state.config.clone();
    drop(state);

    std::thread::spawn(move || {
        let mut hovered = false;
        let mut dodged = false;
        let mut ignored = false;
        let mut last_cursor_x = -9999.0;
        let mut last_cursor_y = -9999.0;
        let mut last_emit_time = std::time::Instant::now();
        let my_hwnd = window.hwnd().map(|h| h.0 as isize).unwrap_or(0);
        loop {
            std::thread::sleep(Duration::from_millis(16));

            let Ok(cursor) = window.cursor_position() else {
                continue;
            };
            let Ok(origin) = window.inner_position() else {
                continue;
            };
            let scale = window.scale_factor().unwrap_or(1.0);

            let local_x = (cursor.x - origin.x as f64) / scale;
            let local_y = (cursor.y - origin.y as f64) / scale;

            // Global Windows cursor tracking for robotic eyes:
            // Throttled to 50ms (~20Hz) and significant delta to prevent IPC flooding & RAM churn
            let now = std::time::Instant::now();
            if now.duration_since(last_emit_time) >= Duration::from_millis(50) {
                let dx = (cursor.x - last_cursor_x).abs();
                let dy = (cursor.y - last_cursor_y).abs();
                if dx >= 3.0 || dy >= 3.0 {
                    last_cursor_x = cursor.x;
                    last_cursor_y = cursor.y;
                    last_emit_time = now;
                    let _ = window.emit(
                        "windows-cursor-move",
                        CursorPositionPayload {
                            x: local_x,
                            y: local_y,
                        },
                    );
                }
            }

            let config = match config_state.lock() {
                Ok(guard) => guard.clone(),
                Err(_) => break,
            };

            let Some(config) = config else {
                if !ignored {
                    if window.set_ignore_cursor_events(true).is_ok() {
                        ignored = true;
                        hovered = false;
                    }
                }
                continue;
            };

            // Hover only follows the island (not floating notes), so hovering a
            // note never expands the island by accident.
            let slop = if hovered { 4.0 } else { 0.0 };
            let is_hovered = config
                .island
                .map(|rect| contains(&rect, local_x, local_y, slop))
                .unwrap_or(false);

            // Intelligent Dodge detection:
            // When the mouse is over the island area, check if there is an active application
            // window (e.g. Chrome, Edge browser with top tabs) directly behind the island.
            // If so, emit `island-dodge` = true unless the cursor is pushed right up to the very
            // top edge (local_y <= 5.0) where the user touches the peek rim to intentionally reveal it.
            let is_touching_peek_edge = local_y <= 5.0;
            let should_dodge = if is_hovered {
                if is_touching_peek_edge {
                    false
                } else {
                    is_background_app_window_at(cursor.x as i32, cursor.y as i32, my_hwnd)
                }
            } else {
                false
            };

            if should_dodge != dodged {
                dodged = should_dodge;
                let _ = window.emit("island-dodge", dodged);
            }

            if is_hovered != hovered {
                hovered = is_hovered;
                let _ = window.emit("island-hover", hovered);
            }
            // Whenever the island is hovered, it is guaranteed interactive so
            // click-through toggles never fight hover detection at borders.
            let is_interactive = config.force
                || is_hovered
                || config
                    .interactive
                    .iter()
                    .any(|rect| contains(rect, local_x, local_y, 4.0));
            let should_ignore = !is_interactive;
            if should_ignore != ignored {
                if window.set_ignore_cursor_events(should_ignore).is_ok() {
                    ignored = should_ignore;
                }
            }
        }
    });
}
