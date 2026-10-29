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

/// Logical island bounds (CSS pixels, relative to the window client area).
/// The native loop uses this to decide whether the window should receive
/// cursor events or pass them through to the desktop.
#[derive(Clone, Default)]
pub struct HitTestState {
    pub rect: Arc<Mutex<Option<HitRect>>>,
}

#[tauri::command]
pub fn set_island_hit_rect(
    state: tauri::State<'_, HitTestState>,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) {
    if let Ok(mut rect) = state.rect.lock() {
        *rect = Some(HitRect {
            x,
            y,
            width,
            height,
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
    let rect_state = state.rect.clone();
    drop(state);

    std::thread::spawn(move || {
        let mut hovered = false;
        let mut ignored = false;
        let mut last_cursor_x = -9999.0;
        let mut last_cursor_y = -9999.0;
        let mut last_emit_time = std::time::Instant::now();
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

            let rect = match rect_state.lock() {
                Ok(guard) => *guard,
                Err(_) => break,
            };

            let Some(rect) = rect else {
                if !ignored {
                    if window.set_ignore_cursor_events(true).is_ok() {
                        ignored = true;
                        hovered = false;
                    }
                }
                continue;
            };

            let slop = if hovered { 2.0 } else { 0.0 };
            let is_hovered = local_x >= rect.x - slop
                && local_x < rect.x + rect.width + slop
                && local_y >= rect.y - slop
                && local_y < rect.y + rect.height + slop;

            if is_hovered != hovered {
                hovered = is_hovered;
                let _ = window.emit("island-hover", hovered);
            }

            let should_ignore = !is_hovered;
            if should_ignore != ignored {
                if window.set_ignore_cursor_events(should_ignore).is_ok() {
                    ignored = should_ignore;
                }
            }
        }
    });
}
