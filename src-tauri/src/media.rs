use serde::{Deserialize, Serialize};
use std::time::Duration;
use tauri::{AppHandle, Emitter};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LiveMediaState {
    pub title: String,
    pub artist: String,
    pub is_playing: bool,
    pub progress: f64,
    pub duration: f64,
}

#[tauri::command]
pub fn start_media_listener(app: AppHandle) {
    #[cfg(target_os = "windows")]
    {
        let app_handle = app.clone();
        std::thread::spawn(move || {
            unsafe {
                use windows::Win32::System::Com::{CoInitializeEx, COINIT_MULTITHREADED};
                let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
            }

            use windows::Media::Control::{
                GlobalSystemMediaTransportControlsSessionManager,
                GlobalSystemMediaTransportControlsSessionPlaybackStatus,
            };

            let mut last_title = String::new();
            let mut last_is_playing = false;

            loop {
                std::thread::sleep(Duration::from_millis(1000));

                if let Ok(manager_op) = GlobalSystemMediaTransportControlsSessionManager::RequestAsync() {
                    if let Ok(manager) = manager_op.get() {
                        if let Ok(session) = manager.GetCurrentSession() {
                            let mut is_playing = false;
                            if let Ok(info) = session.GetPlaybackInfo() {
                                if let Ok(status) = info.PlaybackStatus() {
                                    is_playing = status == GlobalSystemMediaTransportControlsSessionPlaybackStatus::Playing;
                                }
                            }

                            let mut title = String::new();
                            let mut artist = String::new();

                            if let Ok(props_op) = session.TryGetMediaPropertiesAsync() {
                                if let Ok(props) = props_op.get() {
                                    if let Ok(t) = props.Title() {
                                        title = t.to_string();
                                    }
                                    if let Ok(a) = props.Artist() {
                                        artist = a.to_string();
                                    }
                                }
                            }

                            let mut progress = 0.0;
                            let mut duration = 0.0;

                            if let Ok(timeline) = session.GetTimelineProperties() {
                                if let (Ok(pos), Ok(end)) = (timeline.Position(), timeline.EndTime()) {
                                    let pos_secs = pos.Duration as f64 / 10_000_000.0;
                                    let end_secs = end.Duration as f64 / 10_000_000.0;
                                    duration = end_secs;
                                    if end_secs > 0.0 {
                                        progress = (pos_secs / end_secs).clamp(0.0, 1.0);
                                    }
                                }
                            }

                            // If metadata changed or playback status changed, emit event
                            if title != last_title || is_playing != last_is_playing || is_playing {
                                last_title = title.clone();
                                last_is_playing = is_playing;

                                if !title.is_empty() {
                                    let payload = LiveMediaState {
                                        title,
                                        artist,
                                        is_playing,
                                        progress,
                                        duration,
                                    };
                                    let _ = app_handle.emit("windows-media-change", payload);
                                }
                            }
                        } else {
                            if last_is_playing {
                                last_is_playing = false;
                                let _ = app_handle.emit(
                                    "windows-media-change",
                                    LiveMediaState {
                                        title: "".into(),
                                        artist: "".into(),
                                        is_playing: false,
                                        progress: 0.0,
                                        duration: 0.0,
                                    },
                                );
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
}

/// Control active Windows media playback: Play/Pause toggle
#[tauri::command]
pub fn media_toggle_play_pause() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use windows::Media::Control::GlobalSystemMediaTransportControlsSessionManager;
        if let Ok(manager_op) = GlobalSystemMediaTransportControlsSessionManager::RequestAsync() {
            if let Ok(manager) = manager_op.get() {
                if let Ok(session) = manager.GetCurrentSession() {
                    let _ = session.TryTogglePlayPauseAsync();
                }
            }
        }
    }
    Ok(())
}

/// Skip to next media track
#[tauri::command]
pub fn media_skip_next() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use windows::Media::Control::GlobalSystemMediaTransportControlsSessionManager;
        if let Ok(manager_op) = GlobalSystemMediaTransportControlsSessionManager::RequestAsync() {
            if let Ok(manager) = manager_op.get() {
                if let Ok(session) = manager.GetCurrentSession() {
                    let _ = session.TrySkipNextAsync();
                }
            }
        }
    }
    Ok(())
}

/// Skip to previous media track
#[tauri::command]
pub fn media_skip_prev() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use windows::Media::Control::GlobalSystemMediaTransportControlsSessionManager;
        if let Ok(manager_op) = GlobalSystemMediaTransportControlsSessionManager::RequestAsync() {
            if let Ok(manager) = manager_op.get() {
                if let Ok(session) = manager.GetCurrentSession() {
                    let _ = session.TrySkipPreviousAsync();
                }
            }
        }
    }
    Ok(())
}

/// Launch Windows Notification Settings URI
#[tauri::command]
pub fn open_notification_settings() {
    #[cfg(target_os = "windows")]
    {
        let _ = std::process::Command::new("cmd")
            .args(["/c", "start", "ms-settings:privacy-notifications"])
            .spawn();
    }
}
