use serde::{Deserialize, Serialize};
use tauri::{AppHandle, LogicalPosition, LogicalSize, Manager, WebviewWindow};

#[derive(Debug, Serialize, Deserialize)]
pub struct WindowDimensions {
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MonitorMetrics {
    pub width: u32,
    pub height: u32,
    pub scale_factor: f64,
}

/// Dynamic resize of the floating island window, automatically re-centering it horizontally
#[tauri::command]
pub fn resize_island_window(app: AppHandle, width: u32, height: u32) -> Result<(), String> {
    let window: WebviewWindow = app
        .get_webview_window("main")
        .ok_or_else(|| "Main window not found".to_string())?;

    // Determine current monitor
    let current_monitor = window
        .current_monitor()
        .map_err(|e| format!("Failed to get current monitor: {}", e))?;

    let (monitor_width, monitor_x) = match current_monitor {
        Some(m) => {
            let size = m.size();
            let scale = m.scale_factor();
            let pos = m.position();
            (size.width as f64 / scale, pos.x as f64 / scale)
        }
        None => (1920.0, 0.0),
    };

    let target_w = width as f64;
    let target_h = height as f64;

    // Center horizontally on the active monitor, keep 12px padding from top
    let pos_x = monitor_x + ((monitor_width - target_w) / 2.0).max(0.0);
    let pos_y = 12.0;

    // Apply new size & position
    window
        .set_size(LogicalSize::new(target_w, target_h))
        .map_err(|e| format!("Failed to set size: {}", e))?;

    window
        .set_position(LogicalPosition::new(pos_x, pos_y))
        .map_err(|e| format!("Failed to set position: {}", e))?;

    Ok(())
}

/// Set always on top property
#[tauri::command]
pub fn set_always_on_top(app: AppHandle, enabled: bool) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "Main window not found".to_string())?;

    window
        .set_always_on_top(enabled)
        .map_err(|e| format!("Failed to set always on top: {}", e))?;

    Ok(())
}

/// Center and position the island at the top on startup
pub fn setup_initial_window_position(window: &WebviewWindow) -> Result<(), String> {
    let current_monitor = window
        .current_monitor()
        .map_err(|e| format!("Failed to get monitor: {}", e))?;

    let (monitor_width, monitor_x) = match current_monitor {
        Some(m) => {
            let size = m.size();
            let scale = m.scale_factor();
            let pos = m.position();
            (size.width as f64 / scale, pos.x as f64 / scale)
        }
        None => (1920.0, 0.0),
    };

    let initial_width = 240.0;
    let initial_height = 60.0;
    let pos_x = monitor_x + (monitor_width - initial_width) / 2.0;
    let pos_y = 12.0;

    window
        .set_size(LogicalSize::new(initial_width, initial_height))
        .map_err(|e| format!("Set size failed: {}", e))?;

    window
        .set_position(LogicalPosition::new(pos_x, pos_y))
        .map_err(|e| format!("Set pos failed: {}", e))?;

    let _ = window.set_always_on_top(true);

    Ok(())
}
