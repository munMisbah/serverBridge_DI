# Dynamic Island for Windows 11 🏝️

Aplikasi desktop native yang menghadirkan pengalaman **Dynamic Island** terinspirasi dari iOS & macOS ke sistem operasi Windows 11. Aplikasi ini menampilkan kapsul floating interaktif di bagian tengah atas layar yang responsif, minimalis, dan memiliki animasi spring yang halus.

---
## 📦 File Executable (.exe) Siap Pakai

File binary **`.exe` mandiri (standalone)** telah berhasil dikompilasi langsung di workspace ini:
```
Dynamic-Island-Windows-x64.exe  (Ukuran: ~9.1 MB, Native 64-bit Windows GUI)
```
Anda tinggal menyalin/mengunduh file ini ke laptop/PC Windows 11 Anda, lalu double-click untuk langsung menjalankannya tanpa perlu menginstal Node, Rust, ataupun C++!


## ✨ Fitur Utama

### 1. Floating Island Window (Native Desktop)
- **Posisi Otomatis:** Berada tepat di tengah horizontal bagian atas layar (12px dari tepi atas).
- **Always On Top:** Selalu melayang di atas jendela aplikasi lain tanpa mengganggu fokus kerja.
- **Window Transparan & Borderless:** Tidak ada title bar, border window standar, atau ikon taskbar yang mengganggu.
- **Dynamic Resize IPC:** Ukuran window desktop diubah secara otomatis oleh backend Rust mengikuti state animasi React, sehingga area desktop transparan di sekitarnya tetap dapat diklik (click-through).

### 2. Tiga State Interaktif & Animasi Halus
- **Compact State:** Kapsul kecil ringkas menampilkan waktu digital, cuaca ringkas (suhu & ikon), mini audio visualizer yang bergerak, serta indikator badge notifikasi yang belum dibaca.
- **Notification State:** Kapsul melebar secara elastis saat notifikasi Windows diterima (lengkap dengan styling hijau WhatsApp, nama pengirim, pesan singkat, dan tombol dismiss). Otomatis kembali ke compact setelah durasi selesai.
- **Expanded Dashboard:** Panel kontrol berukuran ~440x460px terbuka dengan spring animation saat kapsul diklik atau ditekan shortcut keyboard.

### 3. Modul & Widget Terintegrasi
- **Cuaca Terkini (Open-Meteo API):** Suhu real-time, kondisi cuaca, feels like, kelembapan, kecepatan angin, suhu min/max, pencarian lokasi (Jakarta, Surabaya, Bandung, Bali, Singapura, Tokyo, London, dll.), dan sistem cache offline jika internet terputus.
- **Kalender & Agenda Lokal:** Tampilan tanggal hari ini, daftar agenda kronologis, countdown waktu tersisa, form pembuatan agenda baru (Judul, Jam, Lokasi), tombol hapus, dan penyimpanan persisten.
- **Windows Notification Bridge:** Menggunakan WinRT `UserNotificationListener` untuk mendengarkan notifikasi Windows 10/11 dan WhatsApp Desktop secara native. Dilengkapi filter blocklist, privacy toggle (menyembunyikan isi pesan), dan simulator notifikasi untuk pengujian instan.
- **Media Controls Widget:** Visualizer waveform 3-bar animasi dan kontrol pemutar audio cepat (Play/Pause, Track info).
- **Pengaturan Lengkap:** Konfigurasi Autostart saat Windows booting, Always on Top, durasi auto-collapse notifikasi, interval refresh cuaca, dan Reduced Motion.

---

## 🛠️ Tech Stack

| Layer | Teknologi |
|---|---|
| **Desktop Runtime** | Tauri 2 (v2.12) |
| **Frontend UI** | React 19, TypeScript |
| **Styling** | Tailwind CSS v4 |
| **Animation Engine** | Framer Motion (Spring Physics) |
| **Native Backend** | Rust 2021, `windows-rs` (Win32 & WinRT APIs) |
| **Weather API** | Open-Meteo REST API |
| **Icons** | Lucide React |

---

## 🚀 Cara Menjalankan di Windows 11

### Prasyarat
Sebelum memulai, pastikan sistem Windows 11 Anda telah terpasang:
1. **Node.js** (versi 18 ke atas) & **npm** — [Download Node.js](https://nodejs.org/)
2. **Rust & Cargo** — Pasang melalui [rustup.rs](https://rustup.rs/)
3. **Visual Studio C++ Build Tools** (disyaratkan oleh Tauri & Rust pada Windows) — Pilih paket *"Desktop development with C++"*.

---

### Opsi 1: Menjalankan Langsung sebagai Native Desktop Widget (Rekomendasi)

Cukup double-click file:
```cmd
run-windows.bat
```
Atau jalankan melalui terminal (PowerShell / Command Prompt):
```bash
npm install
npm run tauri:dev
```
Aplikasi Dynamic Island akan langsung muncul melayang di bagian tengah atas layar Windows 11 Anda!

---

### Opsi 2: Menjalankan dalam Mode Web Preview (Cepat & Ringan)

Jika Anda ingin menguji interaksi visual dan animasi langsung di browser web (lengkap dengan simulator wallpaper Windows 11):
```cmd
run-browser-preview.bat
```
Atau via terminal:
```bash
npm run dev
```
Buka browser di `http://localhost:1420`. Di bagian bawah layar terdapat **Simulator Bar** untuk menguji trigger notifikasi WhatsApp, system alert, dan beralih state secara instan.

---

### Opsi 3: Build Installer Release (.exe / .msi)

Untuk membuat file installer mandiri yang siap diinstal dan dibagikan:
```cmd
build-windows.bat
```
Atau via terminal:
```bash
npm run tauri:build
```
File installer setup `.msi` dan `.exe` (NSIS) akan dibuat secara otomatis di direktori:
```
src-tauri\target\release\bundle\nsis\
src-tauri\target\release\bundle\msi\
```

---

## 📁 Struktur Direktori

```
DI-win/
├── PRD.md                         # Dokumen Product Requirements
├── README.md                      # Dokumentasi Panduan Penggunaan
├── package.json                   # Konfigurasi dependensi frontend & Tauri
├── vite.config.ts                 # Konfigurasi Vite & Tailwind CSS v4
├── tsconfig.json                  # Konfigurasi TypeScript
├── run-windows.bat                # Shortcut 1-klik dev desktop
├── build-windows.bat              # Shortcut 1-klik build release installer
├── run-browser-preview.bat        # Shortcut 1-klik web preview
├── src/
│   ├── main.tsx                   # Entry point React
│   ├── App.tsx                    # Root container & Simulator backdrop
│   ├── index.css                  # Tailwind CSS & global styling
│   ├── types/
│   │   └── index.ts               # Tipe data State, Notifikasi, Cuaca, Agenda
│   ├── context/
│   │   └── IslandContext.tsx      # Central State Manager & Tauri Event Bridge
│   ├── components/
│   │   ├── Island/
│   │   │   ├── IslandRoot.tsx     # Komponen kapsul utama dengan Motion springs
│   │   │   ├── CompactView.tsx    # Tampilan pil ringkas saat idle
│   │   │   ├── NotificationView.tsx # Tampilan banner notifikasi (WhatsApp style)
│   │   │   └── ExpandedView.tsx   # Panel expanded dengan navigasi tab
│   │   └── Dashboard/
│   │       ├── OverviewTab.tsx    # Tab ringkasan cuaca, agenda, media
│   │       ├── WeatherTab.tsx     # Tab detail cuaca & pemilih kota
│   │       ├── CalendarTab.tsx    # Tab agenda & pembuatan jadwal
│   │       ├── NotificationsTab.tsx # Tab history notifikasi & test triggers
│   │       └── SettingsTab.tsx    # Tab pengaturan autostart & privasi
└── src-tauri/
    ├── Cargo.toml                 # Dependensi Rust & Windows WinRT crates
    ├── tauri.conf.json            # Konfigurasi window transparan & always-on-top
    ├── capabilities/              # Tauri 2 permission policies
    ├── icons/                     # Kumpulan icon resolusi tinggi (Windows .ico, .png)
    └── src/
        ├── main.rs                # Rust executable entry point
        ├── lib.rs                 # Tauri application builder & system tray
        ├── window.rs              # Logika window positioning & dynamic resize
        ├── notifications.rs       # WinRT UserNotificationListener bridge
        └── settings.rs            # Windows Registry autostart integration
```

---

## 🔒 Izin & Notifikasi WhatsApp

1. Saat pertama kali dijalankan di Windows, aplikasi akan meminta izin akses **Notification Listener** agar dapat membaca notifikasi sistem dan WhatsApp Desktop.
2. WhatsApp Desktop harus aktif dan diizinkan menampilkan notifikasi Windows (dapat dikonfigurasi pada menu *Windows Settings > System > Notifications*).
3. Pengaturan privasi tersedia di dalam tab **Settings** Dynamic Island untuk menyembunyikan isi pesan notifikasi jika diinginkan.
