// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs::OpenOptions;
use std::io::Write;

pub fn log_to_file(msg: &str) {
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(dir) = exe_path.parent() {
            let log_file = dir.join("dynamic-island.log");
            if let Ok(mut f) = OpenOptions::new().create(true).append(true).open(log_file) {
                let _ = writeln!(f, "[{}] {}", chrono_time_str(), msg);
            }
        }
    }
}

fn chrono_time_str() -> String {
    let now = std::time::SystemTime::now();
    let since_epoch = now.duration_since(std::time::UNIX_EPOCH).unwrap_or_default();
    format!("{}.{:03}", since_epoch.as_secs(), since_epoch.subsec_millis())
}

fn main() {
    // Set panic hook to log any panic and show alert box on Windows
    std::panic::set_hook(Box::new(|info| {
        let msg = format!("CRITICAL PANIC: {:?}", info);
        log_to_file(&msg);

        #[cfg(target_os = "windows")]
        unsafe {
            use windows::core::HSTRING;
            use windows::Win32::UI::WindowsAndMessaging::{MessageBoxW, MB_ICONERROR, MB_OK};
            let title = HSTRING::from("Dynamic Island Error");
            let text = HSTRING::from(format!("{}", info));
            MessageBoxW(None, &text, &title, MB_OK | MB_ICONERROR);
        }
    }));

    log_to_file("==========================================");
    log_to_file("Dynamic Island starting up...");

    di_win_lib::run();
}
