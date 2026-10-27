pub mod clipboard;
pub mod hittest;
pub mod media;
pub mod notifications;
pub mod settings;
pub mod window;
use std::fs::OpenOptions;
use std::io::Write;
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Manager,
};

fn log_step(msg: &str) {
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(dir) = exe_path.parent() {
            let log_file = dir.join("dynamic-island.log");
            if let Ok(mut f) = OpenOptions::new().create(true).append(true).open(log_file) {
                let _ = writeln!(f, "[STEP] {}", msg);
            }
        }
    }
}

// Keep tray icon alive in Tauri state
struct TrayKeeper(#[allow(dead_code)] Option<tauri::tray::TrayIcon>);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    log_step("Initializing Tauri Builder...");

    let app_result = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            log_step("Setup hook entered.");

            // 1. Setup initial window position and visibility
            if let Some(main_window) = app.get_webview_window("main") {
                log_step("Found main window, configuring position...");

                // Set window icon from embedded PNG bytes
                let icon_bytes = include_bytes!("../icons/128x128.png");
                if let Ok(icon) = tauri::image::Image::from_bytes(icon_bytes) {
                    let _ = main_window.set_icon(icon);
                    log_step("Window icon set from embedded bytes.");
                }

                if let Err(e) = window::setup_initial_window_position(&main_window) {
                    log_step(&format!("Warning: Initial positioning had error: {}", e));
                } else {
                    log_step("Initial window position configured.");
                }

                let _ = main_window.show();
                log_step("Called main_window.show().");
            } else {
                log_step("ERROR: Main window 'main' not found in app setup!");
            }

            // 2. Setup System Tray Menu (graceful fallback)
            let mut tray_holder: Option<tauri::tray::TrayIcon> = None;
            let icon_bytes = include_bytes!("../icons/128x128.png");
            if let Ok(icon) = tauri::image::Image::from_bytes(icon_bytes) {
                if let (Ok(quit_i), Ok(show_i)) = (
                    MenuItem::with_id(app, "quit", "Quit Dynamic Island", true, None::<&str>),
                    MenuItem::with_id(app, "show", "Show Island", true, None::<&str>),
                ) {
                    if let Ok(menu) = Menu::with_items(app, &[&show_i, &quit_i]) {
                        match TrayIconBuilder::new()
                            .icon(icon)
                            .menu(&menu)
                            .show_menu_on_left_click(true)
                            .on_menu_event(|app, event| match event.id.as_ref() {
                                "quit" => {
                                    app.exit(0);
                                }
                                "show" => {
                                    if let Some(win) = app.get_webview_window("main") {
                                        let _ = win.show();
                                        let _ = win.set_focus();
                                    }
                                }
                                _ => {}
                            })
                            .build(app)
                        {
                            Ok(tray) => {
                                log_step("System tray icon registered successfully.");
                                tray_holder = Some(tray);
                            }
                            Err(e) => {
                                log_step(&format!("Warning: Could not create tray icon: {}", e));
                            }
                        }
                    }
                }
            }

            // Keep tray icon alive in app state
            app.manage(TrayKeeper(tray_holder));

            // 3. Fixed-size window + native click-through hit testing
            app.manage(hittest::HitTestState::default());
            hittest::start_hit_test_loop(app.handle().clone());
            log_step("Native hit-test loop started.");

            // 4. Start Windows Notification Listener gracefully
            log_step("Starting notification listener...");
            let _ = notifications::start_notification_listener(app.handle().clone());
            log_step("Notification listener call completed.");
            // 5. Start Windows Live Media Listener
            log_step("Starting live media listener...");
            media::start_media_listener(app.handle().clone());
            log_step("Live media listener call completed.");
            // 6. Start Windows Live Clipboard Listener
            log_step("Starting live clipboard listener...");
            clipboard::start_clipboard_listener(app.handle().clone());
            log_step("Live clipboard listener call completed.");

            log_step("Setup hook completed successfully.");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            window::set_always_on_top,
            hittest::set_island_hit_rect,
            notifications::check_notification_permission,
            notifications::request_notification_permission,
            notifications::start_notification_listener,
            settings::set_autostart_enabled,
            media::media_toggle_play_pause,
            media::media_skip_next,
            media::media_skip_prev,
            media::open_notification_settings,
        ])
        .run(tauri::generate_context!());

    if let Err(e) = app_result {
        log_step(&format!("FATAL: Tauri run returned error: {}", e));
    }
}
