use tauri::{LogicalPosition, LogicalSize, Manager, WebviewWindow};

/// Fixed native window footprint.
///
/// Expanded island: 580 x 350
/// Horizontal shadow padding: 60 px on each side
/// Vertical: 12 px above + 58 px below (room for the drop shadow)
pub const WINDOW_WIDTH: f64 = 700.0;
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

/// Grow the main window to the monitor work area while sticky notes are open,
/// then shrink it back to the compact island footprint.
///
/// The webview is transparent, so the extra surface stays invisible; the
/// frontend hit-test keeps everything outside the island/notes click-through.
#[tauri::command]
pub fn set_notes_layer_mode(app: tauri::AppHandle, enabled: bool) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "Main window not found".to_string())?;


    if !enabled {
        return setup_initial_window_position(&window);
    }

    let monitor = window
        .current_monitor()
        .map_err(|e| format!("Failed to get monitor: {}", e))?
        .ok_or_else(|| "No monitor found".to_string())?;

    let scale = monitor.scale_factor();
    let area = monitor.work_area();
    let x = area.position.x as f64 / scale;
    let y = area.position.y as f64 / scale;
    let width = area.size.width as f64 / scale;
    let height = area.size.height as f64 / scale;

    window
        .set_size(LogicalSize::new(width, height))
        .map_err(|e| format!("Set size failed: {}", e))?;
    window
        .set_position(LogicalPosition::new(x, y))
        .map_err(|e| format!("Set pos failed: {}", e))?;

    Ok(())
}

/// Center the fixed-size island window at the top of the active monitor.
pub fn setup_initial_window_position(window: &WebviewWindow) -> Result<(), String> {
    let current_monitor = window
        .current_monitor()
        .map_err(|e| format!("Failed to get monitor: {}", e))?;

    let (monitor_width, monitor_x) = match current_monitor {
        Some(monitor) => {
            let scale = monitor.scale_factor();
            let size = monitor.size().to_logical::<f64>(scale);
            let position = monitor.position().to_logical::<f64>(scale);
            (size.width, position.x)
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
    let _ = window.set_skip_taskbar(true);
    Ok(())
}
