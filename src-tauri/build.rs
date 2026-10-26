fn main() {
    // On native Windows or when rc compiler is present, tauri_build embeds icons.
    // In cross-compilation environments without llvm-rc/windres, try_build allows graceful compilation.
    let attrs = tauri_build::Attributes::new();
    let _ = tauri_build::try_build(attrs);
}
