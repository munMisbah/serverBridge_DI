use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use image::codecs::avif::AvifEncoder;
use image::codecs::jpeg::JpegEncoder;
use image::{DynamicImage, ExtendedColorType, ImageEncoder, ImageFormat};
use serde::Serialize;
use std::fs;
use std::io::Cursor;
use std::path::{Path, PathBuf};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConvertedImageResult {
    pub output_path: String,
    pub file_name: String,
    pub format: String,
    pub original_bytes: usize,
    pub converted_bytes: usize,
    pub width: u32,
    pub height: u32,
}

fn normalize_format(fmt: &str) -> Result<(&'static str, &'static str), String> {
    match fmt.trim().to_ascii_lowercase().as_str() {
        "webp" => Ok(("webp", "webp")),
        "jpg" | "jpeg" => Ok(("jpg", "jpg")),
        "png" => Ok(("png", "png")),
        "avif" => Ok(("avif", "avif")),
        other => Err(format!(
            "Format output tidak didukung: '{}'. Gunakan webp, jpg, png, atau avif.",
            other
        )),
    }
}

fn validate_input_extension(name: &str) -> Result<(), String> {
    let ext = Path::new(name)
        .extension()
        .and_then(|e| e.to_str())
        .map(|s| s.to_ascii_lowercase())
        .unwrap_or_default();

    match ext.as_str() {
        "jpg" | "jpeg" | "png" => Ok(()),
        _ => Err("Hanya file JPG dan PNG yang didukung sebagai input.".to_string()),
    }
}

fn encode_image(img: &DynamicImage, format: &str, quality: u8) -> Result<Vec<u8>, String> {
    let mut out = Vec::new();
    let q = quality.clamp(10, 100);

    match format {
        "jpg" => {
            // Composite transparent pixels over white so PNG -> JPG doesn't turn alpha black.
            let rgb = if img.color().has_alpha() {
                let rgba = img.to_rgba8();
                let mut flat = image::RgbImage::new(rgba.width(), rgba.height());
                for (px, dst) in rgba.pixels().zip(flat.pixels_mut()) {
                    let a = px[3] as u16;
                    let inv = 255 - a;
                    let r = ((px[0] as u16 * a + 255 * inv) / 255) as u8;
                    let g = ((px[1] as u16 * a + 255 * inv) / 255) as u8;
                    let b = ((px[2] as u16 * a + 255 * inv) / 255) as u8;
                    *dst = image::Rgb([r, g, b]);
                }
                flat
            } else {
                img.to_rgb8()
            };
            let mut encoder = JpegEncoder::new_with_quality(&mut out, q);
            encoder
                .encode(rgb.as_raw(), rgb.width(), rgb.height(), ExtendedColorType::Rgb8)
                .map_err(|e| format!("Gagal encode JPG: {}", e))?;
        }
        "png" => {
            let mut cursor = Cursor::new(&mut out);
            img.write_to(&mut cursor, ImageFormat::Png)
                .map_err(|e| format!("Gagal encode PNG: {}", e))?;
        }
        "webp" => {
            let mut cursor = Cursor::new(&mut out);
            img.write_to(&mut cursor, ImageFormat::WebP)
                .map_err(|e| format!("Gagal encode WebP: {}", e))?;
        }
        "avif" => {
            let rgba = img.to_rgba8();
            let encoder = AvifEncoder::new_with_speed_quality(&mut out, 6, q);
            encoder
                .write_image(
                    rgba.as_raw(),
                    rgba.width(),
                    rgba.height(),
                    ExtendedColorType::Rgba8,
                )
                .map_err(|e| format!("Gagal encode AVIF: {}", e))?;
        }
        _ => return Err("Format tidak didukung.".to_string()),
    }

    Ok(out)
}

fn unique_output_path(dir: &Path, stem: &str, ext: &str) -> PathBuf {
    let base = dir.join(format!("{}.{}", stem, ext));
    if !base.exists() {
        return base;
    }
    for idx in 1..10_000 {
        let candidate = dir.join(format!("{}-{}.{}", stem, idx, ext));
        if !candidate.exists() {
            return candidate;
        }
    }
    dir.join(format!("{}-converted.{}", stem, ext))
}

/// Best-practice default folder for converted images:
/// %USERPROFILE%\Pictures\DynamicIsland-Converted -> Downloads fallback -> temp fallback.
fn default_output_dir() -> Result<PathBuf, String> {
    if let Ok(profile) = std::env::var("USERPROFILE") {
        let pictures = PathBuf::from(&profile)
            .join("Pictures")
            .join("DynamicIsland-Converted");
        if fs::create_dir_all(&pictures).is_ok() {
            return Ok(pictures);
        }
        let downloads = PathBuf::from(&profile)
            .join("Downloads")
            .join("DynamicIsland-Converted");
        if fs::create_dir_all(&downloads).is_ok() {
            return Ok(downloads);
        }
    }
    let fallback = std::env::temp_dir().join("DynamicIsland-Converted");
    fs::create_dir_all(&fallback).map_err(|e| format!("Gagal membuat folder output: {}", e))?;
    Ok(fallback)
}

fn resolve_output_dir(custom_dir: Option<String>) -> Result<PathBuf, String> {
    if let Some(raw) = custom_dir {
        let trimmed = raw.trim();
        if !trimmed.is_empty() {
            let custom = PathBuf::from(trimmed);
            fs::create_dir_all(&custom)
                .map_err(|e| format!("Folder tujuan tidak dapat diakses/dibuat: {}", e))?;
            return Ok(custom);
        }
    }
    default_output_dir()
}

#[tauri::command]
pub fn get_default_converter_dir() -> Result<String, String> {
    let dir = default_output_dir()?;
    Ok(dir.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn pick_converter_output_dir(initial_dir: Option<String>) -> Result<Option<String>, String> {
    #[cfg(target_os = "windows")]
    {
        tokio::task::spawn_blocking(move || {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x0800_0000;

            let initial = initial_dir
                .as_deref()
                .map(str::trim)
                .filter(|s| !s.is_empty() && Path::new(s).is_dir())
                .map(|s| s.replace('\'', "''"))
                .unwrap_or_default();

            let script = format!(
                "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; \
                 Add-Type -AssemblyName System.Windows.Forms; \
                 $d = New-Object System.Windows.Forms.FolderBrowserDialog; \
                 $d.Description = 'Pilih folder tujuan hasil konversi gambar'; \
                 $d.ShowNewFolderButton = $true; \
                 if ('{initial}' -ne '') {{ $d.SelectedPath = '{initial}' }}; \
                 if ($d.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {{ \
                   [Console]::Write($d.SelectedPath) \
                 }}"
            );

            let output = std::process::Command::new("powershell.exe")
                .creation_flags(CREATE_NO_WINDOW)
                .args(["-NoProfile", "-NonInteractive", "-STA", "-Command", &script])
                .output()
                .map_err(|e| format!("Gagal membuka dialog pilih folder: {}", e))?;

            if !output.status.success() {
                return Err("Dialog pilih folder gagal dibuka.".to_string());
            }

            let chosen = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if chosen.is_empty() {
                Ok(None)
            } else {
                Ok(Some(chosen))
            }
        })
        .await
        .map_err(|e| format!("Task dialog folder gagal: {}", e))?
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = initial_dir;
        Err("Pemilih folder hanya didukung di Windows.".to_string())
    }
}

#[tauri::command]
pub fn open_converter_output_dir(dir: Option<String>) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let target = resolve_output_dir(dir)?;
        std::process::Command::new("explorer.exe")
            .arg(&target)
            .spawn()
            .map_err(|e| format!("Gagal membuka folder di Explorer: {}", e))?;
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = dir;
        Err("Hanya didukung di Windows.".to_string())
    }
}

#[tauri::command]
pub async fn convert_image_path(
    input_path: String,
    target_format: String,
    quality: Option<u8>,
    output_dir: Option<String>,
) -> Result<ConvertedImageResult, String> {
    tokio::task::spawn_blocking(move || {
        let src = PathBuf::from(&input_path);
        if !src.is_file() {
            return Err("File sumber tidak ditemukan.".to_string());
        }
        validate_input_extension(&input_path)?;
        let (fmt, ext) = normalize_format(&target_format)?;

        let raw = fs::read(&src).map_err(|e| format!("Gagal membaca file: {}", e))?;
        let original_bytes = raw.len();
        let img = image::load_from_memory(&raw)
            .map_err(|e| format!("File gambar tidak valid: {}", e))?;

        let width = img.width();
        let height = img.height();
        let encoded = encode_image(&img, fmt, quality.unwrap_or(82))?;
        let converted_bytes = encoded.len();

        let dir = resolve_output_dir(output_dir)?;
        let stem = src
            .file_stem()
            .and_then(|s| s.to_str())
            .filter(|s| !s.is_empty())
            .unwrap_or("image");

        let out_path = unique_output_path(&dir, stem, ext);
        fs::write(&out_path, &encoded)
            .map_err(|e| format!("Gagal menyimpan hasil konversi: {}", e))?;

        let file_name = out_path
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or("converted")
            .to_string();

        Ok(ConvertedImageResult {
            output_path: out_path.to_string_lossy().to_string(),
            file_name,
            format: fmt.to_string(),
            original_bytes,
            converted_bytes,
            width,
            height,
        })
    })
    .await
    .map_err(|e| format!("Worker konversi gagal: {}", e))?
}

#[tauri::command]
pub async fn convert_image_bytes(
    data_base64: String,
    file_name: String,
    target_format: String,
    quality: Option<u8>,
    output_dir: Option<String>,
) -> Result<ConvertedImageResult, String> {
    tokio::task::spawn_blocking(move || {
        validate_input_extension(&file_name)?;
        let (fmt, ext) = normalize_format(&target_format)?;

        let raw = BASE64
            .decode(data_base64.trim())
            .map_err(|e| format!("Gagal decode data gambar: {}", e))?;
        let original_bytes = raw.len();

        let img = image::load_from_memory(&raw)
            .map_err(|e| format!("File gambar tidak valid: {}", e))?;
        let width = img.width();
        let height = img.height();
        let encoded = encode_image(&img, fmt, quality.unwrap_or(82))?;
        let converted_bytes = encoded.len();

        let dir = resolve_output_dir(output_dir)?;
        let stem = Path::new(&file_name)
            .file_stem()
            .and_then(|s| s.to_str())
            .filter(|s| !s.is_empty())
            .unwrap_or("image");
        let out_path = unique_output_path(&dir, stem, ext);

        fs::write(&out_path, &encoded)
            .map_err(|e| format!("Gagal menyimpan hasil konversi: {}", e))?;

        let out_name = out_path
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or("converted")
            .to_string();

        Ok(ConvertedImageResult {
            output_path: out_path.to_string_lossy().to_string(),
            file_name: out_name,
            format: fmt.to_string(),
            original_bytes,
            converted_bytes,
            width,
            height,
        })
    })
    .await
    .map_err(|e| format!("Worker konversi gagal: {}", e))?
}

#[tauri::command]
pub fn reveal_file_in_explorer(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        let p = PathBuf::from(&path);
        if !p.exists() {
            return Err("File tidak ditemukan.".to_string());
        }
        std::process::Command::new("explorer.exe")
            .raw_arg(format!("/select,\"{}\"", p.display()))
            .spawn()
            .map_err(|e| format!("Gagal membuka Explorer: {}", e))?;
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = path;
        Err("Hanya didukung di Windows.".to_string())
    }
}
