use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Duration;
use tauri::{AppHandle, Emitter};

/// Epoch-ms deadline; clipboard changes before it are our own writes.
///
/// A time window (not a one-shot flag) mirrors the old 350 ms polling: a single
/// write fires `EmptyClipboard` + `SetClipboardData`, i.e. two notifications.
/// Swallowing only the first one produced duplicate history entries.
static SUPPRESS_UNTIL_MS: AtomicU64 = AtomicU64::new(0);

fn epoch_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClipboardPayload {
    pub id: String,
    pub item_type: String, // "text" | "image"
    pub text: Option<String>,
    pub char_count: Option<usize>,
    pub thumbnail: Option<String>,   // base64 data url for preview
    pub image_path: Option<String>,  // saved local file path for retrieval
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub timestamp: i64,
}

pub fn get_clipboard_cache_dir() -> std::path::PathBuf {
    let dir = std::env::temp_dir().join("dynamic_island_clipboard");
    let _ = std::fs::create_dir_all(&dir);
    dir
}

#[cfg(target_os = "windows")]
fn dib_to_bmp(dib_bytes: &[u8]) -> Option<Vec<u8>> {
    if dib_bytes.len() < 40 {
        return None;
    }
    let header_size = u32::from_le_bytes(dib_bytes[0..4].try_into().ok()?);
    let bit_count = u16::from_le_bytes(dib_bytes[14..16].try_into().ok()?);
    let compression = u32::from_le_bytes(dib_bytes[16..20].try_into().ok()?);
    let clr_used = u32::from_le_bytes(dib_bytes[32..36].try_into().ok()?);

    let palette_colors = if clr_used != 0 {
        clr_used
    } else if bit_count <= 8 {
        1u32 << bit_count
    } else {
        0
    };
    let mut palette_size = palette_colors * 4;
    if header_size == 40 && (compression == 3 || compression == 6) {
        palette_size += 12;
    }

    let off_bits = 14 + header_size + palette_size;
    let file_size = 14 + dib_bytes.len() as u32;

    let mut bmp = Vec::with_capacity(file_size as usize);
    bmp.extend_from_slice(b"BM");
    bmp.extend_from_slice(&file_size.to_le_bytes());
    bmp.extend_from_slice(&[0, 0, 0, 0]);
    bmp.extend_from_slice(&off_bits.to_le_bytes());
    bmp.extend_from_slice(dib_bytes);
    Some(bmp)
}

#[cfg(target_os = "windows")]
fn rgba_to_dib(img: &image::RgbaImage) -> Vec<u8> {
    let width = img.width();
    let height = img.height();
    let image_bytes_len = (width * height * 4) as usize;
    let total_len = 40 + image_bytes_len;
    let mut dib = Vec::with_capacity(total_len);

    // BITMAPINFOHEADER (40 bytes)
    dib.extend_from_slice(&40u32.to_le_bytes());
    dib.extend_from_slice(&(width as i32).to_le_bytes());
    dib.extend_from_slice(&(height as i32).to_le_bytes());
    dib.extend_from_slice(&1u16.to_le_bytes()); // planes
    dib.extend_from_slice(&32u16.to_le_bytes()); // bit count
    dib.extend_from_slice(&0u32.to_le_bytes()); // BI_RGB
    dib.extend_from_slice(&(image_bytes_len as u32).to_le_bytes());
    dib.extend_from_slice(&0i32.to_le_bytes()); // XPelsPerMeter
    dib.extend_from_slice(&0i32.to_le_bytes()); // YPelsPerMeter
    dib.extend_from_slice(&0u32.to_le_bytes()); // ClrUsed
    dib.extend_from_slice(&0u32.to_le_bytes()); // ClrImportant

    // Windows DIB scanlines are bottom-up and BGRA ordered
    for y in (0..height).rev() {
        for x in 0..width {
            let p = img.get_pixel(x, y);
            dib.push(p[2]); // B
            dib.push(p[1]); // G
            dib.push(p[0]); // R
            dib.push(p[3]); // A
        }
    }

    dib
}

/// Event-driven clipboard notifications.
///
/// A message-only window subscribes to `WM_CLIPBOARDUPDATE`; the listener thread
/// then blocks in `GetMessageW` instead of waking up every 350 ms. Idle cost drops
/// to a single blocked thread with no timer and no kernel polling.
#[cfg(target_os = "windows")]
mod clip_events {
    use windows::core::w;
    use windows::Win32::Foundation::{HINSTANCE, HWND, LPARAM, LRESULT, WPARAM};
    use windows::Win32::System::DataExchange::AddClipboardFormatListener;
    use windows::Win32::System::LibraryLoader::GetModuleHandleW;
    use windows::Win32::UI::WindowsAndMessaging::{
        CreateWindowExW, DefWindowProcW, DispatchMessageW, GetMessageW, RegisterClassW,
        TranslateMessage, HWND_MESSAGE, MSG, WINDOW_EX_STYLE, WINDOW_STYLE, WM_CLIPBOARDUPDATE,
        WNDCLASSW,
    };

    unsafe extern "system" fn wnd_proc(
        hwnd: HWND,
        msg: u32,
        wparam: WPARAM,
        lparam: LPARAM,
    ) -> LRESULT {
        unsafe { DefWindowProcW(hwnd, msg, wparam, lparam) }
    }

    /// Create the message-only window. Must be called on the thread that will
    /// pump messages, since a Win32 window is bound to its creating thread.
    pub fn create_watcher() -> Option<HWND> {
        unsafe {
            let instance = GetModuleHandleW(None).ok()?;
            let class = WNDCLASSW {
                lpfnWndProc: Some(wnd_proc),
                hInstance: HINSTANCE(instance.0),
                lpszClassName: w!("DynamicIslandClipboardWatcher"),
                ..Default::default()
            };
            let _ = RegisterClassW(&class);

            let hwnd = CreateWindowExW(
                WINDOW_EX_STYLE::default(),
                w!("DynamicIslandClipboardWatcher"),
                w!(""),
                WINDOW_STYLE::default(),
                0,
                0,
                0,
                0,
                HWND_MESSAGE,
                None,
                HINSTANCE(instance.0),
                None,
            )
            .ok()?;

            AddClipboardFormatListener(hwnd).ok()?;
            Some(hwnd)
        }
    }

    /// Block until the OS posts `WM_CLIPBOARDUPDATE`. `false` means the watcher
    /// could not be created or the message loop ended.
    pub fn wait_for_update(hwnd: HWND) -> bool {
        let mut msg = MSG::default();
        loop {
            // 0 = WM_QUIT, -1 = error; both end the loop.
            if unsafe { GetMessageW(&mut msg, HWND::default(), 0, 0) }.0 <= 0 {
                return false;
            }
            unsafe {
                let _ = TranslateMessage(&msg);
                DispatchMessageW(&msg);
            }
            if msg.hwnd == hwnd && msg.message == WM_CLIPBOARDUPDATE {
                return true;
            }
        }
    }
}

pub fn start_clipboard_listener(app: AppHandle) {
    #[cfg(target_os = "windows")]
    {
        std::thread::spawn(move || {
            use base64::Engine;
            use windows::Win32::Foundation::HGLOBAL;
            use windows::Win32::System::DataExchange::{
                CloseClipboard, GetClipboardData, GetClipboardSequenceNumber,
                IsClipboardFormatAvailable, OpenClipboard, RegisterClipboardFormatW,
            };
            use windows::Win32::System::Memory::{GlobalLock, GlobalSize, GlobalUnlock};

            let mut last_seq = unsafe { GetClipboardSequenceNumber() };
            let mut last_text = String::new();
            let mut last_image_sig: (u32, u32, usize) = (0, 0, 0);

            let format_png = unsafe { RegisterClipboardFormatW(windows::core::w!("PNG")) };

            // A Win32 window belongs to the thread that created it, so the
            // message-only watcher lives on this listener thread.
            let Some(watcher) = clip_events::create_watcher() else {
                return;
            };

            loop {
                // Blocks until the OS posts WM_CLIPBOARDUPDATE: no timer, no polling.
                if !clip_events::wait_for_update(watcher) {
                    return;
                }

                let seq = unsafe { GetClipboardSequenceNumber() };
                if seq != last_seq && seq != 0 {
                    last_seq = seq;

                    // Ignore the whole burst caused by our own write.
                    if epoch_ms() < SUPPRESS_UNTIL_MS.load(Ordering::SeqCst) {
                        continue;
                    }

                    let mut copied_text: Option<String> = None;
                    let mut copied_image_bytes: Option<Vec<u8>> = None;

                    unsafe {
                        for _ in 0..4 {
                            if OpenClipboard(None).is_ok() {
                                // 1. Try reading CF_UNICODETEXT (13)
                                if let Ok(h_mem) = GetClipboardData(13) {
                                    if !h_mem.0.is_null() {
                                        let h_global = HGLOBAL(h_mem.0);
                                        let ptr = GlobalLock(h_global) as *const u16;
                                        if !ptr.is_null() {
                                            let mut len = 0;
                                            while *ptr.add(len) != 0 {
                                                len += 1;
                                                if len > 20000 {
                                                    break;
                                                }
                                            }
                                            let slice = std::slice::from_raw_parts(ptr, len);
                                            copied_text = String::from_utf16(slice).ok();
                                            let _ = GlobalUnlock(h_global);
                                        }
                                    }
                                }

                                // 2. If no text was found, inspect for screenshot/image
                                if copied_text.is_none() {
                                    // Check PNG registered format first
                                    if format_png != 0
                                        && IsClipboardFormatAvailable(format_png).is_ok()
                                    {
                                        if let Ok(h_mem) = GetClipboardData(format_png) {
                                            if !h_mem.0.is_null() {
                                                let h_global = HGLOBAL(h_mem.0);
                                                let size = GlobalSize(h_global);
                                                let ptr = GlobalLock(h_global) as *const u8;
                                                if !ptr.is_null() && size > 8 {
                                                    let slice =
                                                        std::slice::from_raw_parts(ptr, size);
                                                    if slice.starts_with(&[
                                                        137, 80, 78, 71, 13, 10, 26, 10,
                                                    ]) {
                                                        copied_image_bytes = Some(slice.to_vec());
                                                    }
                                                    let _ = GlobalUnlock(h_global);
                                                }
                                            }
                                        }
                                    }

                                    // If no PNG format, check CF_DIB (8) or CF_DIBV5 (17)
                                    if copied_image_bytes.is_none() {
                                        let dib_fmt = if IsClipboardFormatAvailable(8).is_ok() {
                                            8
                                        } else if IsClipboardFormatAvailable(17).is_ok() {
                                            17
                                        } else {
                                            0
                                        };

                                        if dib_fmt != 0 {
                                            if let Ok(h_mem) = GetClipboardData(dib_fmt) {
                                                if !h_mem.0.is_null() {
                                                    let h_global = HGLOBAL(h_mem.0);
                                                    let size = GlobalSize(h_global);
                                                    let ptr = GlobalLock(h_global) as *const u8;
                                                    if !ptr.is_null() && size >= 40 {
                                                        let dib_slice =
                                                            std::slice::from_raw_parts(ptr, size);
                                                        if let Some(bmp) = dib_to_bmp(dib_slice) {
                                                            copied_image_bytes = Some(bmp);
                                                        }
                                                        let _ = GlobalUnlock(h_global);
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }

                                let _ = CloseClipboard();
                                break;
                            }
                            std::thread::sleep(Duration::from_millis(50));
                        }
                    }

                    let now_ms = std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .map(|d| d.as_millis() as i64)
                        .unwrap_or(0);

                    // Case A: Text copied
                    if let Some(text) = copied_text {
                        let trimmed = text.trim();
                        if !trimmed.is_empty() && trimmed != last_text {
                            last_text = trimmed.to_string();

                            let item_id = format!("clip_txt_{}", now_ms);
                            let payload = ClipboardPayload {
                                id: item_id,
                                item_type: "text".to_string(),
                                text: Some(trimmed.to_string()),
                                char_count: Some(trimmed.chars().count()),
                                thumbnail: None,
                                image_path: None,
                                width: None,
                                height: None,
                                timestamp: now_ms,
                            };

                            let _ = app.emit("windows-clipboard-copied", payload);
                        }
                    }
                    // Case B: Screenshot / Image copied
                    else if let Some(raw_bytes) = copied_image_bytes {
                        if let Ok(img) = image::load_from_memory(&raw_bytes) {
                            let width = img.width();
                            let height = img.height();
                            let sig = (width, height, raw_bytes.len());

                            if sig != last_image_sig {
                                last_image_sig = sig;

                                let item_id = format!("clip_img_{}", now_ms);
                                let cache_dir = get_clipboard_cache_dir();
                                let file_path = cache_dir.join(format!("{}.png", item_id));

                                // Save full screenshot image to cache dir
                                let saved_ok = img
                                    .save_with_format(&file_path, image::ImageFormat::Png)
                                    .is_ok();

                                // Generate lightweight thumbnail (~240px)
                                let thumb = img.thumbnail(280, 240);
                                let mut thumb_buf = std::io::Cursor::new(Vec::new());
                                let thumb_b64 = if thumb
                                    .write_to(&mut thumb_buf, image::ImageFormat::Png)
                                    .is_ok()
                                {
                                    let b64 = base64::prelude::BASE64_STANDARD
                                        .encode(thumb_buf.into_inner());
                                    Some(format!("data:image/png;base64,{}", b64))
                                } else {
                                    None
                                };

                                let payload = ClipboardPayload {
                                    id: item_id,
                                    item_type: "image".to_string(),
                                    text: None,
                                    char_count: None,
                                    thumbnail: thumb_b64,
                                    image_path: if saved_ok {
                                        Some(file_path.to_string_lossy().to_string())
                                    } else {
                                        None
                                    },
                                    width: Some(width),
                                    height: Some(height),
                                    timestamp: now_ms,
                                };

                                let _ = app.emit("windows-clipboard-copied", payload);
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

#[tauri::command]
pub fn clipboard_write_text(text: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use windows::Win32::Foundation::HANDLE;
        use windows::Win32::System::DataExchange::{
            CloseClipboard, EmptyClipboard, OpenClipboard, SetClipboardData,
        };
        use windows::Win32::System::Memory::{GlobalAlloc, GlobalLock, GlobalUnlock, GMEM_MOVEABLE};

        SUPPRESS_UNTIL_MS.store(epoch_ms() + 400, Ordering::SeqCst);

        let wide: Vec<u16> = text.encode_utf16().chain(std::iter::once(0)).collect();
        let bytes_len = wide.len() * std::mem::size_of::<u16>();

        unsafe {
            for _ in 0..5 {
                if OpenClipboard(None).is_ok() {
                    let _ = EmptyClipboard();
                    if let Ok(h_global) = GlobalAlloc(GMEM_MOVEABLE, bytes_len) {
                        let ptr = GlobalLock(h_global) as *mut u16;
                        if !ptr.is_null() {
                            std::ptr::copy_nonoverlapping(wide.as_ptr(), ptr, wide.len());
                            let _ = GlobalUnlock(h_global);
                            let _ = SetClipboardData(13, HANDLE(h_global.0)); // CF_UNICODETEXT
                        }
                    }
                    let _ = CloseClipboard();
                    return Ok(());
                }
                std::thread::sleep(Duration::from_millis(50));
            }
        }
        Err("Failed to open Windows clipboard".to_string())
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = text;
        Ok(())
    }
}

#[tauri::command]
pub fn clipboard_write_image(image_path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use windows::Win32::Foundation::HANDLE;
        use windows::Win32::System::DataExchange::{
            CloseClipboard, EmptyClipboard, OpenClipboard, RegisterClipboardFormatW,
            SetClipboardData,
        };
        use windows::Win32::System::Memory::{GlobalAlloc, GlobalLock, GlobalUnlock, GMEM_MOVEABLE};

        SUPPRESS_UNTIL_MS.store(epoch_ms() + 400, Ordering::SeqCst);

        let path = std::path::Path::new(&image_path);
        if !path.exists() {
            return Err("Image file does not exist".to_string());
        }

        let raw_png = std::fs::read(path).map_err(|e| e.to_string())?;
        let img = image::open(path).map_err(|e| e.to_string())?.to_rgba8();
        let dib_data = rgba_to_dib(&img);

        let format_png = unsafe { RegisterClipboardFormatW(windows::core::w!("PNG")) };

        unsafe {
            for _ in 0..5 {
                if OpenClipboard(None).is_ok() {
                    let _ = EmptyClipboard();

                    // Set CF_DIB (8)
                    if let Ok(h_dib) = GlobalAlloc(GMEM_MOVEABLE, dib_data.len()) {
                        let ptr = GlobalLock(h_dib) as *mut u8;
                        if !ptr.is_null() {
                            std::ptr::copy_nonoverlapping(
                                dib_data.as_ptr(),
                                ptr,
                                dib_data.len(),
                            );
                            let _ = GlobalUnlock(h_dib);
                            let _ = SetClipboardData(8, HANDLE(h_dib.0));
                        }
                    }

                    // Also set PNG format if registered
                    if format_png != 0 {
                        if let Ok(h_png) = GlobalAlloc(GMEM_MOVEABLE, raw_png.len()) {
                            let ptr = GlobalLock(h_png) as *mut u8;
                            if !ptr.is_null() {
                                std::ptr::copy_nonoverlapping(
                                    raw_png.as_ptr(),
                                    ptr,
                                    raw_png.len(),
                                );
                                let _ = GlobalUnlock(h_png);
                                let _ = SetClipboardData(format_png, HANDLE(h_png.0));
                            }
                        }
                    }

                    let _ = CloseClipboard();
                    return Ok(());
                }
                std::thread::sleep(Duration::from_millis(50));
            }
        }
        Err("Failed to open Windows clipboard to write image".to_string())
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = image_path;
        Ok(())
    }
}

#[tauri::command]
pub fn clipboard_delete_image_file(image_path: String) -> Result<(), String> {
    let path = std::path::Path::new(&image_path);
    if path.exists() {
        let _ = std::fs::remove_file(path);
    }
    Ok(())
}

#[tauri::command]
pub fn clipboard_clear_image_cache() -> Result<(), String> {
    let dir = get_clipboard_cache_dir();
    if dir.exists() {
        let _ = std::fs::remove_dir_all(&dir);
        let _ = std::fs::create_dir_all(&dir);
    }
    Ok(())
}
