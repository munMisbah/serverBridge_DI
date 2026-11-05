# Dynamic Island for Windows 11 🏝️

Aplikasi desktop native yang menghadirkan pengalaman **Dynamic Island** terinspirasi dari iOS & macOS ke sistem operasi Windows 11. Aplikasi ini menampilkan kapsul floating interaktif di bagian tengah atas layar yang responsif, minimalis, dan memiliki animasi spring yang halus.

---
## 📦 File Executable (.exe) Siap Pakai

File binary **`.exe` mandiri (standalone)** telah berhasil dikompilasi langsung di workspace ini:
```
Dynamic-Island-Windows-x64.exe  (Ukuran: ~9.4 MB, Native 64-bit Windows GUI)
```
Anda tinggal menyalin/mengunduh file ini ke laptop/PC Windows 11 Anda, lalu double-click untuk langsung menjalankannya tanpa perlu menginstal Node, Rust, ataupun C++!


## ✨ Fitur Utama

### 1. Floating Island Window (Native Desktop)
- **Posisi Otomatis:** Berada tepat di tengah horizontal bagian atas layar (12px dari tepi atas).
- **Always On Top:** Selalu melayang di atas jendela aplikasi lain tanpa mengganggu fokus kerja.
- **Window Transparan & Borderless:** Tidak ada title bar atau border window standar yang mengganggu, sementara ikon tray tetap tersedia untuk menampilkan atau menutup aplikasi.
- **Fixed Window + Native Click-Through:** Window native memiliki ukuran tetap 504×508 px (cukup untuk state expanded + shadow), sehingga animasi island tidak memicu resize window. Area transparan di luar island dibuat tembus klik oleh hit-test loop native (`hittest.rs`), jadi desktop di sekitarnya tetap bisa diinteraksi.

### 2. Tiga State Interaktif & Animasi Halus
- **Compact State:** Kapsul minimalis berukuran tetap 176×40 px, hanya menampilkan ikon & suhu cuaca, waktu digital, dan satu titik indikator notifikasi belum dibaca.
- **Notification State:** Kapsul 360×64 px dengan app icon, judul, isi singkat, dan tombol dismiss. Otomatis kembali ke compact setelah durasi selesai.
- **Expanded Dashboard:** Panel 440×460 px dengan header ringkas, tab icon-only, dan spring animation. Bisa dibuka dengan **hover** (default) atau **click** sesuai pengaturan.

### 3. Modul & Widget Terintegrasi
- **Cuaca Terkini (Open-Meteo API):** Suhu real-time, kondisi cuaca, feels like, kelembapan, kecepatan angin, suhu min/max, pencarian lokasi (Jakarta, Surabaya, Bandung, Bali, Singapura, Tokyo, London, dll.), dan sistem cache offline jika internet terputus.
- **Kalender & Agenda Lokal:** Tampilan tanggal hari ini, daftar agenda kronologis, countdown waktu tersisa, form pembuatan agenda baru (Judul, Jam, Lokasi), tombol hapus, dan penyimpanan persisten.
- **Windows Notification Bridge:** Menggunakan WinRT `UserNotificationListener` untuk mendengarkan notifikasi Windows 10/11 dan WhatsApp Desktop secara native. Dilengkapi filter blocklist dan privacy toggle (menyembunyikan isi pesan).
- **Battery Monitor:** Indikator persentase baterai laptop (dengan status charging/plugged in) dan daftar perangkat Bluetooth yang melaporkan level baterai ke Windows — TWS, headphone, keyboard, mouse, speaker, dan lainnya. Tampil sebagai tab Battery bergaya Todo (ring progres + daftar perangkat) dan bisa dipasang pada slot dinamis kapsul.
- **Server Monitoring (SSH):** Pantau CPU, RAM, storage, dan container Docker dari server Linux tanpa agent. Mendukung autentikasi password maupun SSH key. Konfigurasi server dan `known_hosts` disimpan di backend (bukan localStorage), host key baru wajib dikonfirmasi lewat fingerprint, dan secret opsional disimpan di Windows Credential Manager yang terikat ke `host:port:username`. Polling 30 detik hanya saat tab Servers terbuka; metrik tidak disimpan ke disk.
- **Media Controls Widget:** Kontrol pemutar audio cepat (Play/Pause, track info) yang tampil di Overview saat media sedang diputar.
- **Pengaturan Lengkap:** Mode interaksi **Hover / Click** untuk expand-collapse, konfigurasi Autostart, Always on Top, durasi auto-collapse notifikasi, interval refresh cuaca, dan Reduced Motion.

---

## 🛠️ Tech Stack

| Layer | Teknologi |
|---|---|
| **Desktop Runtime** | Tauri 2 (v2.12) |
| **Frontend UI** | React 19, TypeScript |
| **Styling** | Tailwind CSS v4 |
| **Animation Engine** | Framer Motion (Spring Physics) |
| **Native Backend** | Rust 2021, `windows-rs` (Win32 & WinRT APIs), `puressh` (pure-Rust SSH) |
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
│   │   │   ├── IslandRoot.tsx     # Kapsul utama: spring morph, hover/click, hit-rect
│   │   │   ├── dimensions.ts      # Ukuran fixed tiap state island
│   │   │   ├── CompactView.tsx    # Tampilan pil minimalis (cuaca + jam)
│   │   │   ├── NotificationView.tsx # Banner notifikasi ringkas
│   │   │   └── ExpandedView.tsx   # Panel expanded dengan tab icon-only
│   │   └── Dashboard/
│   │       ├── OverviewTab.tsx    # Tab ringkasan cuaca, agenda, media
│   │       ├── WeatherTab.tsx     # Tab detail cuaca & pemilih kota
│   │       ├── CalendarTab.tsx    # Tab agenda & pembuatan jadwal
│   │       ├── NotificationsTab.tsx # Tab history notifikasi & izin Windows
│   │       ├── BatteryTab.tsx     # Tab baterai laptop & perangkat Bluetooth
│   │       ├── ServersTab.tsx     # Tab monitoring CPU/RAM/storage/Docker via SSH
│   │       └── SettingsTab.tsx    # Tab pengaturan interaksi, autostart & privasi
└── src-tauri/
    ├── Cargo.toml                 # Dependensi Rust & Windows WinRT crates
    ├── tauri.conf.json            # Konfigurasi window transparan & always-on-top
    ├── capabilities/              # Tauri 2 permission policies
    ├── icons/                     # Kumpulan icon resolusi tinggi (Windows .ico, .png)
    └── src/
        ├── main.rs                # Rust executable entry point
        ├── lib.rs                 # Tauri application builder & system tray
        ├── window.rs              # Posisi & ukuran window fixed (504×508)
        ├── hittest.rs             # Native click-through hover/hit-test loop
        ├── notifications.rs       # WinRT UserNotificationListener bridge
        ├── battery.rs             # Snapshot baterai sistem & perangkat Bluetooth
        ├── servers.rs             # Probe SSH: CPU, RAM, storage, Docker
        ├── credentials.rs         # Windows Credential Manager untuk secret SSH
        └── settings.rs            # Windows Registry autostart integration
```

---

## 🔐 Keamanan Server Monitoring

- Config server dan `known_hosts` disimpan di app data dir backend (`servers.json`); WebView tidak bisa menulisnya langsung.
- Command probe hanya menerima `serverId`; host, port, username, key path, dan known_hosts diambil dari store backend.
- Host key pertama harus dikonfirmasi lewat fingerprint (`SHA256:...`). Perubahan host key ditolak.
- Password/passphrase hanya di Windows Credential Manager atau memori sesi. Plaintext tidak pernah dikembalikan ke WebView.
- Credential diikat ke `host:port:username`; mengganti identitas server otomatis menghapus credential lama.
- CSP ketat diaktifkan; hanya font, gambar Unsplash, dan API cuaca yang diizinkan.

## 🔒 Izin & Notifikasi WhatsApp

1. Saat pertama kali dijalankan di Windows, aplikasi akan meminta izin akses **Notification Listener** agar dapat membaca notifikasi sistem dan WhatsApp Desktop.
2. WhatsApp Desktop harus aktif dan diizinkan menampilkan notifikasi Windows (dapat dikonfigurasi pada menu *Windows Settings > System > Notifications*).
3. Pengaturan privasi tersedia di dalam tab **Settings** Dynamic Island untuk menyembunyikan isi pesan notifikasi jika diinginkan.
