use serde::{Deserialize, Serialize};
use std::time::Duration;
use tauri::{AppHandle, Emitter};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClipboardPayload {
    pub text: String,
    pub char_count: usize,
    pub timestamp: i64,
}

pub fn start_clipboard_listener(app: AppHandle) {
    #[cfg(target_os = "windows")]
    {
        std::thread::spawn(move || {
            use windows::Win32::System::DataExchange::{
                CloseClipboard, GetClipboardData, GetClipboardSequenceNumber, OpenClipboard,
            };
            use windows::Win32::System::Memory::{GlobalLock, GlobalUnlock};

            let mut last_seq = unsafe { GetClipboardSequenceNumber() };
            let mut last_text = String::new();

            loop {
                std::thread::sleep(Duration::from_millis(350));

                let seq = unsafe { GetClipboardSequenceNumber() };
                if seq != last_seq && seq != 0 {
                    last_seq = seq;

                    let mut copied_text: Option<String> = None;

                    unsafe {
                        // Retry up to 3 times in case clipboard is temporarily locked by copying app
                        for _ in 0..3 {
                            if OpenClipboard(None).is_ok() {
                                // 13 is CF_UNICODETEXT
                                if let Ok(h_mem) = GetClipboardData(13) {
                                    if !h_mem.0.is_null() {
                                        let h_global = windows::Win32::Foundation::HGLOBAL(h_mem.0);
                                        let ptr = GlobalLock(h_global) as *const u16;
                                        if !ptr.is_null() {
                                            let mut len = 0;
                                            while *ptr.add(len) != 0 {
                                                len += 1;
                                                if len > 5000 {
                                                    break;
                                                }
                                            }
                                            let slice = std::slice::from_raw_parts(ptr, len);
                                            copied_text = String::from_utf16(slice).ok();
                                            let _ = GlobalUnlock(h_global);
                                        }
                                    }
                                }
                                let _ = CloseClipboard();
                                break;
                            }
                            std::thread::sleep(Duration::from_millis(50));
                        }
                    }

                    if let Some(text) = copied_text {
                        let trimmed = text.trim();
                        if !trimmed.is_empty() && trimmed != last_text {
                            last_text = trimmed.to_string();

                            let now_ms = std::time::SystemTime::now()
                                .duration_since(std::time::UNIX_EPOCH)
                                .map(|d| d.as_millis() as i64)
                                .unwrap_or(0);

                            let payload = ClipboardPayload {
                                text: trimmed.to_string(),
                                char_count: trimmed.chars().count(),
                                timestamp: now_ms,
                            };

                            let _ = app.emit("windows-clipboard-copied", payload);
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
