/// Autostart command implementation for Windows
#[tauri::command]
pub fn set_autostart_enabled(enabled: bool) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        let exe_path = std::env::current_exe()
            .map_err(|e| format!("Failed to get current executable path: {}", e))?
            .to_string_lossy()
            .to_string();

        let app_name = "DynamicIslandWin";

        if enabled {
            // Add to HKCU\Software\Microsoft\Windows\CurrentVersion\Run
            let status = Command::new("reg")
                .args([
                    "add",
                    r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run",
                    "/v",
                    app_name,
                    "/t",
                    "REG_SZ",
                    "/d",
                    &format!("\"{}\"", exe_path),
                    "/f",
                ])
                .status()
                .map_err(|e| format!("Failed to execute reg command: {}", e))?;

            if !status.success() {
                return Err("Failed to register autostart in registry".to_string());
            }
        } else {
            // Remove from HKCU\Software\Microsoft\Windows\CurrentVersion\Run
            let _ = Command::new("reg")
                .args([
                    "delete",
                    r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run",
                    "/v",
                    app_name,
                    "/f",
                ])
                .status();
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = enabled;
    }

    Ok(())
}
