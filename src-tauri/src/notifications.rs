use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NativeNotification {
    pub id: String,
    pub app_id: String,
    pub app_name: String,
    pub title: String,
    pub body: String,
    pub received_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationPermissionStatus {
    pub allowed: bool,
    pub message: String,
}

/// Query Windows notification listener permission status
#[tauri::command]
pub async fn check_notification_permission() -> Result<NotificationPermissionStatus, String> {
    #[cfg(target_os = "windows")]
    {
        use windows::UI::Notifications::Management::{
            UserNotificationListener, UserNotificationListenerAccessStatus,
        };

        match UserNotificationListener::Current() {
            Ok(listener) => match listener.RequestAccessAsync() {
                Ok(op) => match op.get() {
                    Ok(status) => {
                        let allowed = status == UserNotificationListenerAccessStatus::Allowed;
                        Ok(NotificationPermissionStatus {
                            allowed,
                            message: if allowed {
                                "Access granted".to_string()
                            } else {
                                "Windows Notification access denied by user".to_string()
                            },
                        })
                    }
                    Err(e) => Ok(NotificationPermissionStatus {
                        allowed: false,
                        message: format!("Failed to evaluate permission: {}", e),
                    }),
                },
                Err(e) => Ok(NotificationPermissionStatus {
                    allowed: false,
                    message: format!("Failed to request access: {}", e),
                }),
            },
            Err(e) => Ok(NotificationPermissionStatus {
                allowed: false,
                message: format!("Notification listener unsupported: {}", e),
            }),
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        // Mock permission for non-windows / dev environment
        Ok(NotificationPermissionStatus {
            allowed: true,
            message: "Development mock listener active".to_string(),
        })
    }
}

/// Request notification access explicitly
#[tauri::command]
pub async fn request_notification_permission() -> Result<NotificationPermissionStatus, String> {
    check_notification_permission().await
}

/// Start background listener loop to forward notifications to frontend via Tauri event
#[tauri::command]
pub fn start_notification_listener(app: AppHandle) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let app_handle = app.clone();
        std::thread::spawn(move || {
            unsafe {
                use windows::Win32::System::Com::{CoInitializeEx, COINIT_MULTITHREADED};
                let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
            }

            use std::collections::HashSet;
            use std::time::Duration;
            use windows::UI::Notifications::NotificationKinds;
            use windows::UI::Notifications::Management::{
                UserNotificationListener, UserNotificationListenerAccessStatus,
            };

            let mut seen_ids: HashSet<u32> = HashSet::new();
            let mut logged_status = false;

            loop {
                std::thread::sleep(Duration::from_millis(1500));

                if let Ok(listener) = UserNotificationListener::Current() {
                    if let Ok(op) = listener.RequestAccessAsync() {
                        if let Ok(status) = op.get() {
                            if !logged_status {
                                logged_status = true;
                                let _ = std::fs::OpenOptions::new()
                                    .create(true)
                                    .append(true)
                                    .open("dynamic-island.log")
                                    .map(|mut f| {
                                        use std::io::Write;
                                        let _ = writeln!(f, "[NOTIF] Windows UserNotificationListener Access Status: {:?}", status);
                                    });
                            }
                            if status != UserNotificationListenerAccessStatus::Allowed {
                                continue;
                            }
                        }
                    }
                    if let Ok(notifs_op) = listener.GetNotificationsAsync(NotificationKinds::Toast) {
                        if let Ok(notifs) = notifs_op.get() {
                            let size = notifs.Size().unwrap_or(0);
                            for i in 0..size {
                                if let Ok(notif) = notifs.GetAt(i) {
                                    let id = notif.Id().unwrap_or(0);
                                    if seen_ids.contains(&id) {
                                        continue;
                                    }
                                    seen_ids.insert(id);

                                    // Extract App Name
                                    let app_name = notif
                                        .AppInfo()
                                        .and_then(|info| info.DisplayInfo())
                                        .and_then(|disp| disp.DisplayName())
                                        .map(|h| h.to_string())
                                        .unwrap_or_else(|_| "Windows App".to_string());

                                    let app_id = notif
                                        .AppInfo()
                                        .and_then(|info| info.AppUserModelId())
                                        .map(|h| h.to_string())
                                        .unwrap_or_else(|_| "unknown.app".to_string());

                                    // Extract title & body from toast visual bindings
                                    let mut title = "Notification".to_string();
                                    let mut body = "".to_string();

                                    if let Ok(visual) = notif.Notification().and_then(|n| n.Visual()) {
                                        if let Ok(bindings) = visual.Bindings() {
                                            if let Ok(b_size) = bindings.Size() {
                                                for b_idx in 0..b_size {
                                                    if let Ok(binding) = bindings.GetAt(b_idx) {
                                                        if let Ok(elements) = binding.GetTextElements() {
                                                            let count = elements.Size().unwrap_or(0);
                                                            if count > 0 {
                                                                if let Ok(el0) = elements.GetAt(0) {
                                                                    if let Ok(txt) = el0.Text() {
                                                                        title = txt.to_string();
                                                                    }
                                                                }
                                                            }
                                                            if count > 1 {
                                                                if let Ok(el1) = elements.GetAt(1) {
                                                                    if let Ok(txt) = el1.Text() {
                                                                        body = txt.to_string();
                                                                    }
                                                                }
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }

                                    let payload = NativeNotification {
                                        id: id.to_string(),
                                        app_id,
                                        app_name,
                                        title,
                                        body,
                                        received_at: chrono_timestamp(),
                                    };

                                    let _ = app_handle.emit("windows-notification", payload);
                                }
                            }
                        }
                    }
                }
            }
        });
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = app;
    }

    Ok(())
}

fn chrono_timestamp() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}
