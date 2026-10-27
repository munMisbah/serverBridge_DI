use tauri::{LogicalPosition, LogicalSize, Manager, WebviewWindow};

/// Fixed native window footprint.
///
/// Expanded island: 580 x 350
/// Horizontal shadow padding: 40 px on each side
/// Vertical: 12 px above + 58 px below (room for the drop shadow)
pub const WINDOW_WIDTH: f64 = 660.0;
pub const WINDOW_HEIGHT: f64 = 420.0;
pub const WINDOW_TOP: f64 = 0.0;

/// Set always on top property
#[tauri::command]
pub fn set_always_on_top(app: tauri::AppHandle, enabled: bool) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "Main window not found".to_string())?;

    window
        .set_always_on_top(enabled)
        .map_err(|e| format!("Failed to set always on top: {}", e))?;

    Ok(())
}

/// Center the fixed-size island window at the top of the active monitor.
pub fn setup_initial_window_position(window: &WebviewWindow) -> Result<(), String> {
    let current_monitor = window
        .current_monitor()
        .map_err(|e| format!("Failed to get monitor: {}", e))?;

    let (monitor_width, monitor_x) = match current_monitor {
        Some(monitor) => {
            let size = monitor.size();
            let scale = monitor.scale_factor();
            let position = monitor.position();
            (size.width as f64 / scale, position.x as f64 / scale)
        }
        None => (1920.0, 0.0),
    };

    let pos_x = monitor_x + ((monitor_width - WINDOW_WIDTH) / 2.0).max(0.0);

    window
        .set_size(LogicalSize::new(WINDOW_WIDTH, WINDOW_HEIGHT))
        .map_err(|e| format!("Set size failed: {}", e))?;

    window
        .set_position(LogicalPosition::new(pos_x, WINDOW_TOP))
        .map_err(|e| format!("Set pos failed: {}", e))?;

    let _ = window.set_always_on_top(true);
    let _ = window.set_resizable(false);

    Ok(())
}
