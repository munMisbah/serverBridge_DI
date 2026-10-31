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
