# Product Requirements Document (PRD)

## Dynamic Island for Windows

**Versi:** 1.0  
**Status:** Draft — Ready for Development Planning  
**Platform:** Windows 10/11  
**Nama proyek:** Dynamic Island for Windows  
**Tipe aplikasi:** Native desktop utility  
**UI language:** English by default, extensible for Indonesian  
**Primary stack:** Tauri 2, React, TypeScript, Rust, Motion

---

## 1. Product Overview

### 1.1 Background

Dynamic Island for Windows adalah aplikasi desktop yang menghadirkan pengalaman floating widget terinspirasi dari Dynamic Island pada iPhone dan macOS.

Aplikasi menampilkan kapsul interaktif di bagian tengah atas layar. Kapsul selalu terlihat dalam keadaan ringkas dan dapat melebar secara dinamis untuk menampilkan notifikasi, cuaca, kalender, serta informasi kontekstual lainnya.

Aplikasi harus terasa ringan, minimalis, responsif, dan menyatu secara visual dengan lingkungan desktop Windows.

### 1.2 Product Vision

Membangun pusat informasi desktop yang memungkinkan pengguna melihat informasi penting tanpa harus berpindah aplikasi atau membuka dashboard secara manual.

### 1.3 Core Principles

- **Always available:** kapsul tetap terlihat selama aplikasi aktif.
- **Context-aware:** tampilan berubah sesuai aktivitas atau notifikasi.
- **Minimal distraction:** informasi disampaikan tanpa mengganggu pekerjaan.
- **Fast interaction:** informasi penting dapat dilihat dalam satu klik.
- **Privacy-first:** pengguna memiliki kontrol atas notifikasi dan data pribadi.
- **Extensible:** fitur tambahan dapat dikembangkan melalui arsitektur modular.

---

## 2. Goals and Non-Goals

### 2.1 Product Goals

1. Menampilkan kapsul floating di tengah atas layar Windows.
2. Mendukung animasi expand dan collapse yang halus.
3. Menampilkan notifikasi Windows, termasuk notifikasi WhatsApp yang tersedia melalui sistem notifikasi Windows.
4. Menampilkan informasi cuaca terkini.
5. Menampilkan tanggal, kalender, dan agenda mendatang.
6. Menyediakan panel informasi terpadu yang dapat dibuka kapan saja.
7. Mendukung startup otomatis, konfigurasi pengguna, dan pengaturan privasi.
8. Menjaga penggunaan sumber daya tetap rendah saat idle.

### 2.2 Non-Goals for MVP

Fitur berikut tidak termasuk dalam MVP:

- Menggantikan Windows Action Center atau Notification Center.
- Membaca database internal WhatsApp.
- Mengakses atau mendekripsi pesan WhatsApp secara langsung.
- Membalas pesan WhatsApp secara mandiri tanpa dukungan aksi notifikasi atau integrasi resmi.
- Sinkronisasi dua arah kalender.
- Integrasi seluruh layanan musik dan aplikasi pihak ketiga.
- AI assistant atau chatbot bawaan.
- Dukungan macOS dan Linux.
- Sistem plugin pihak ketiga yang dapat diinstal pengguna.

---

## 3. Target Users

### Primary Users

Pengguna Windows yang menginginkan akses cepat ke notifikasi, cuaca, dan jadwal tanpa membuka aplikasi terpisah.

### Secondary Users

- Pengguna produktivitas yang sering menggunakan WhatsApp Desktop.
- Pengguna yang menyukai desktop customization.
- Pengguna yang menginginkan tampilan desktop modern dan minimalis.

### Primary Use Cases

1. Pengguna menerima notifikasi WhatsApp saat bekerja.
2. Pengguna memeriksa cuaca tanpa membuka browser.
3. Pengguna melihat agenda berikutnya dengan satu klik.
4. Pengguna memeriksa tanggal dan waktu secara cepat.
5. Pengguna membuka dashboard informasi ketika membutuhkan detail.

---

## 4. Functional Requirements

### FR-01: Floating Island Window

**Priority:** P0 — Critical

Aplikasi harus menampilkan kapsul floating dengan karakteristik berikut:

- Berada di tengah horizontal bagian atas monitor.
- Selalu berada di atas jendela aplikasi lain saat fitur always-on-top aktif.
- Tidak memiliki title bar atau border window standar.
- Memiliki background gelap semi-transparan.
- Memiliki sudut membulat dan bayangan halus.
- Mendukung ukuran compact dan expanded.
- Tidak menampilkan ikon di taskbar secara default.
- Dapat dipindahkan atau dikonfigurasi melalui pengaturan jika diperlukan.

**Acceptance Criteria**

- Kapsul tampil pada posisi tengah atas layar setelah aplikasi dijalankan.
- Kapsul tetap berada di atas jendela normal.
- Tidak ada dekorasi window standar yang terlihat.
- Background di luar area kapsul transparan.
- Posisi tetap benar setelah perubahan resolusi atau skala DPI.

### FR-02: Island Interaction and Animation

**Priority:** P0 — Critical

Aplikasi memiliki tiga state utama:

1. **Compact:** kapsul kecil dalam kondisi idle.
2. **Expanded:** panel informasi terbuka setelah pengguna mengklik kapsul.
3. **Notification:** kapsul melebar untuk menampilkan notifikasi baru.

Perilaku:

- Klik kapsul compact membuka panel expanded.
- Klik kembali atau tombol close menutup panel.
- Notifikasi baru dapat memicu state notification.
- Notifikasi tidak boleh berulang kali mengganggu pengguna ketika panel sedang digunakan.
- Animasi menggunakan spring transition yang halus.
- State dapat berubah tanpa merender ulang seluruh aplikasi.

**Acceptance Criteria**

- Transisi antar-state tidak menimbulkan layout jump yang terlihat.
- Notifikasi tidak menutup panel expanded secara paksa.
- Interaksi pengguna memiliki prioritas atas auto-collapse.
- Perubahan state dapat dikendalikan oleh event internal dan event sistem.

### FR-03: Windows Notifications

**Priority:** P0 — Critical

Aplikasi harus menyediakan mekanisme untuk menerima notifikasi dari Windows.

Informasi yang dapat ditampilkan jika tersedia:

- Nama aplikasi sumber.
- Judul notifikasi.
- Isi notifikasi.
- Waktu penerimaan.
- Ikon aplikasi jika tersedia.

Persyaratan teknis:

- Menggunakan Windows Notification Listener atau mekanisme native yang sesuai.
- Meminta izin pengguna sebelum membaca notifikasi.
- Menyediakan allowlist dan blocklist aplikasi.
- Mengirim event notifikasi ke frontend melalui bridge native.
- Menghindari penyimpanan permanen isi pesan secara default.
- Memiliki penanganan untuk notifikasi yang tidak memiliki teks atau data lengkap.

**Acceptance Criteria**

- Notifikasi dari aplikasi yang diizinkan dapat ditampilkan.
- Notifikasi aplikasi yang diblokir tidak ditampilkan.
- Kegagalan izin ditampilkan sebagai status yang dapat dipahami pengguna.
- Aplikasi tetap berjalan jika integrasi notifikasi tidak tersedia.

**WhatsApp-specific behavior**

WhatsApp Desktop menjadi salah satu target integrasi awal.

Aplikasi hanya menampilkan informasi yang tersedia melalui notifikasi Windows. Nama pengirim dan isi pesan tidak dijamin selalu tersedia karena dapat dipengaruhi pengaturan privasi Windows, konfigurasi WhatsApp, dan jenis notifikasi.

Fitur membuka WhatsApp dapat ditambahkan jika tersedia mekanisme URI atau peluncuran aplikasi yang sesuai. Fitur membalas pesan tidak dijamin oleh MVP.

### FR-04: Weather Widget

**Priority:** P0 — Critical

Aplikasi harus menampilkan:

- Temperatur saat ini.
- Kondisi cuaca.
- Temperatur terasa.
- Kelembapan.
- Temperatur minimum dan maksimum harian jika tersedia.
- Lokasi cuaca yang dipilih pengguna.

Data dapat diperoleh dari Open-Meteo atau penyedia cuaca lain yang sesuai.

Persyaratan:

- Lokasi default dapat dikonfigurasi.
- Pembaruan data dilakukan secara berkala.
- Data terakhir yang berhasil diambil dapat ditampilkan ketika jaringan tidak tersedia.
- Status loading dan error harus ditampilkan secara jelas.
- Request tidak boleh dilakukan pada setiap render komponen.

**Acceptance Criteria**

- Cuaca berhasil dimuat dari API.
- Lokasi dapat diubah pengguna.
- Error jaringan tidak membuat aplikasi crash.
- Data cache ditampilkan ketika API sementara tidak tersedia.

### FR-05: Calendar and Agenda

**Priority:** P0 — Critical

MVP harus menyediakan kalender lokal dan daftar agenda.

Fitur:

- Menampilkan tanggal dan hari saat ini.
- Menampilkan agenda terdekat.
- Menampilkan waktu dan judul agenda.
- Membuat, mengubah, dan menghapus agenda lokal.
- Mengingatkan pengguna sebelum agenda dimulai.
- Menyimpan agenda secara persisten.

Penyimpanan awal menggunakan SQLite atau penyimpanan lokal yang sesuai.

**Acceptance Criteria**

- Agenda tetap tersimpan setelah aplikasi ditutup dan dibuka kembali.
- Agenda dapat dibuat, diedit, dan dihapus.
- Pengingat mengikuti waktu lokal Windows.
- Agenda dapat ditampilkan dalam urutan kronologis.

Integrasi Google Calendar, Outlook Calendar, dan impor file ICS merupakan pengembangan lanjutan.

### FR-06: Expanded Dashboard

**Priority:** P0 — Critical

Panel expanded menjadi pusat informasi yang menggabungkan:

- Tanggal dan waktu.
- Cuaca.
- Agenda berikutnya.
- Notifikasi terbaru.
- Shortcut menuju fitur atau aplikasi terkait.

Dashboard harus memiliki hierarki visual yang jelas dan tidak terlalu padat.

### FR-07: Settings

**Priority:** P1 — High

Pengaturan minimal:

- Enable/disable autostart.
- Enable/disable always-on-top.
- Pemilihan lokasi cuaca.
- Interval pembaruan cuaca.
- Allowlist dan blocklist notifikasi.
- Menyembunyikan isi notifikasi.
- Mengatur durasi tampilan notifikasi.
- Memilih monitor target jika menggunakan lebih dari satu monitor.
- Mengaktifkan atau menonaktifkan suara jika nantinya tersedia.

### FR-08: System Integration

**Priority:** P1 — High

Aplikasi harus mendukung:

- Startup otomatis.
- Penanganan koneksi jaringan yang terputus.
- Penanganan perubahan resolusi layar.
- Penanganan DPI scaling.
- Multi-monitor.
- Penanganan aplikasi fullscreen.
- Graceful shutdown.
- Logging untuk error penting.

---

## 5. User Experience and Interface

### 5.1 Compact State

Kapsul berukuran kecil di tengah atas layar.

Elemen yang diperbolehkan:

- Indikator status.
- Jam atau informasi ringkas.
- Indikator notifikasi baru.

Tampilan compact harus tetap minimalis dan tidak menampilkan terlalu banyak informasi.

### 5.2 Notification State

Kapsul melebar saat notifikasi yang memenuhi filter diterima.

Komponen:

- Ikon aplikasi.
- Nama aplikasi.
- Judul notifikasi.
- Isi pesan jika tersedia dan diizinkan.
- Indikator waktu.

Notifikasi harus memiliki batas panjang teks dan mendukung pemotongan teks yang rapi.

### 5.3 Expanded State

Panel yang lebih besar menampilkan kartu informasi.

Urutan prioritas default:

1. Notifikasi penting atau terbaru.
2. Agenda berikutnya.
3. Cuaca.
4. Informasi tanggal dan waktu.

Urutan dapat dikonfigurasi pada pengembangan berikutnya.

### 5.4 Visual Design

- Dark theme sebagai tema awal.
- Background hitam atau abu-abu sangat gelap.
- Border tipis dengan transparansi rendah.
- Rounded corners.
- Animasi spring yang responsif.
- Ikon sederhana dan konsisten.
- Typography menggunakan Segoe UI atau font sistem yang sesuai.
- Mendukung reduced motion jika pengguna mengaktifkannya di pengaturan.

---

## 6. Technical Architecture

### 6.1 Primary Technology Stack


| Layer                       | Technology                                |
| --------------------------- | ----------------------------------------- |
| Desktop runtime             | Tauri 2                                   |
| Frontend                    | React                                     |
| Language                    | TypeScript                                |
| Animation                   | Motion for React                          |
| Native backend              | Rust                                      |
| Windows notification bridge | C# / WinRT helper                         |
| Local database              | SQLite                                    |
| Weather                     | Open-Meteo API                            |
| Calendar MVP                | Local calendar storage                    |
| Build tooling               | Vite, npm                                 |
| Testing                     | Vitest, React Testing Library, Rust tests |


### 6.2 Architecture Principles

- Frontend tidak mengakses sistem operasi secara langsung.
- Semua integrasi native melewati command atau event bridge yang tervalidasi.
- Service eksternal dipisahkan dari komponen UI.
- Data dari sumber eksternal divalidasi sebelum digunakan.
- Izin Tauri mengikuti prinsip least privilege.
- Rahasia OAuth tidak disimpan di source code.
- Penggunaan API eksternal harus memiliki timeout, error handling, dan cache bila relevan.

### 6.3 Main Modules

**Frontend modules**

- Island state manager.
- Compact view.
- Notification view.
- Expanded dashboard.
- Weather service.
- Calendar service.
- Settings view.

**Rust modules**

- Window positioning.
- Application lifecycle.
- Event forwarding.
- Local data commands.
- Settings persistence.
- Logging and error handling.

**Native Windows helper**

- Meminta akses Notification Listener.
- Mengambil notifikasi yang tersedia.
- Menormalisasi data notifikasi.
- Mengirim data melalui IPC yang aman.
- Melaporkan status izin dan error.

### 6.4 Notification Data Flow

1. Windows menerima notifikasi aplikasi.
2. Native helper membaca notifikasi yang diizinkan.
3. Data dinormalisasi menjadi format internal.
4. Bridge mengirim event ke backend Tauri.
5. Backend memvalidasi event.
6. Frontend memutuskan apakah notifikasi memenuhi filter.
7. Island berpindah ke state notification.
8. Notifikasi masuk ke antrean dan ditampilkan sesuai prioritas.

---

## 7. Data Models

### 7.1 Notification

- `id`: unique identifier.
- `appId`: source application identifier.
- `appName`: application display name.
- `title`: notification title.
- `body`: notification content.
- `receivedAt`: timestamp.
- `isSensitive`: privacy classification.
- `openTarget`: optional launch target.

### 7.2 Weather

- `locationId`: location identifier.
- `locationName`: display name.
- `temperature`: current temperature.
- `feelsLike`: apparent temperature.
- `humidity`: relative humidity.
- `weatherCode`: provider weather code.
- `updatedAt`: last successful update.

### 7.3 Calendar Event

- `id`: unique identifier.
- `title`: event title.
- `startAt`: event start timestamp.
- `endAt`: optional event end timestamp.
- `location`: optional location.
- `reminderMinutes`: reminder lead time.
- `createdAt`: creation timestamp.
- `updatedAt`: last modification timestamp.

### 7.4 User Settings

- `autostartEnabled`.
- `alwaysOnTopEnabled`.
- `targetMonitor`.
- `weatherLocation`.
- `weatherRefreshInterval`.
- `notificationAllowlist`.
- `notificationBlocklist`.
- `hideNotificationContent`.
- `notificationDisplayDuration`.
- `reducedMotionEnabled`.

---

## 8. Non-Functional Requirements

### Performance

- Animasi harus terasa responsif pada perangkat Windows yang didukung.
- Aplikasi harus idle tanpa polling agresif.
- Request jaringan tidak boleh memblokir UI.
- Penggunaan CPU saat idle harus rendah dan diukur selama pengujian.
- Penggunaan memori harus dipantau selama sesi panjang.

Target awal performa adalah sasaran pengujian, bukan jaminan sebelum profiling dilakukan.

### Reliability

- Aplikasi tidak crash saat API cuaca gagal.
- Kegagalan helper notifikasi tidak membuat dashboard ikut berhenti.
- Data kalender lokal tetap tersedia tanpa internet.
- Event duplikat ditangani secara konsisten.

### Privacy and Security

- Izin notifikasi harus jelas dan eksplisit.
- Isi notifikasi tidak disimpan permanen secara default.
- Komunikasi IPC harus dibatasi dan divalidasi.
- WebView hanya diberi capability yang diperlukan.
- Token autentikasi disimpan menggunakan mekanisme penyimpanan kredensial yang sesuai.
- Tidak ada pengiriman isi pesan ke server eksternal tanpa persetujuan pengguna.

### Compatibility

Target awal:

- Windows 11.
- Windows 10 sebagai target kompatibilitas tambahan jika API yang digunakan mendukungnya.
- Arsitektur x64.
- Multi-monitor sebagai target pengujian.
- Skala DPI 100%, 125%, dan 150%.

Versi Windows minimum final harus ditentukan setelah validasi API dan dependensi native.

---

## 9. MVP Scope and Milestones

### Milestone 1 — Visual Prototype

Deliverables:

- Kapsul compact.
- Expanded panel.
- Notification state dengan data dummy.
- Animasi Motion.
- Dark theme.

Exit criteria:

- Semua state dapat diakses.
- Animasi stabil.
- UI tidak mengalami clipping pada ukuran target.

### Milestone 2 — Desktop Window

Deliverables:

- Window transparan tanpa border.
- Always-on-top.
- Posisi tengah atas.
- Penanganan DPI dasar.
- Penanganan klik dan fokus.

Exit criteria:

- Kapsul berfungsi sebagai floating widget pada desktop Windows.
- Tidak ada dekorasi window standar.
- Panel tidak menghalangi seluruh area layar.

### Milestone 3 — Real Data

Deliverables:

- Integrasi cuaca.
- Cache data cuaca.
- Kalender lokal.
- SQLite persistence.
- Error states.

Exit criteria:

- Data tetap konsisten.
- Aplikasi dapat digunakan tanpa koneksi internet untuk kalender lokal.

### Milestone 4 — Notification Integration

Deliverables:

- Native notification helper.
- Permission flow.
- Allowlist dan blocklist.
- Notification event bridge.
- WhatsApp Desktop testing.

Exit criteria:

- Notifikasi yang tersedia dan diizinkan dapat ditampilkan.
- Penolakan izin ditangani dengan baik.
- Isi notifikasi dapat disembunyikan.

### Milestone 5 — Production MVP

Deliverables:

- Settings.
- Autostart.
- Logging.
- Installer.
- Dokumentasi penggunaan.
- Pengujian Windows.

Exit criteria:

- Instalasi dan penghapusan dapat dilakukan dengan benar.
- Pengaturan tetap tersimpan.
- Tidak ada blocker kritis pada alur utama.

---

## 10. Testing Strategy

### Unit Tests

- Island state transitions.
- Notification filtering.
- Weather response parsing.
- Calendar CRUD operations.
- Settings validation.

### Integration Tests

- Rust commands dan frontend.
- Notification bridge.
- SQLite persistence.
- Weather API error handling.
- Startup configuration.

### Manual Tests

- Notifikasi WhatsApp saat aplikasi lain aktif.
- Klik kapsul dan auto-collapse.
- Aplikasi fullscreen.
- Multi-monitor.
- Perubahan resolusi.
- Suspend dan resume Windows.
- Internet terputus.
- Izin notifikasi ditolak.
- Pengguna menonaktifkan isi pesan.

---

## 11. Risks and Dependencies

### Risk 1: Notification Listener Compatibility

Akses notifikasi bergantung pada API Windows, izin pengguna, dan kondisi notifikasi sumber.

Mitigation: buat native helper terpisah dan sediakan fallback UI ketika integrasi tidak tersedia.

### Risk 2: Window Interaction

Window transparan dapat tetap menerima input pada area yang tidak terlihat.

Mitigation: implementasikan hit-testing atau pengaturan click-through secara terukur, serta uji perilakunya pada Windows.

### Risk 3: WhatsApp Notification Variability

Isi notifikasi dapat berbeda berdasarkan versi aplikasi dan pengaturan privasi.

Mitigation: perlakukan seluruh field sebagai opsional dan jangan menjanjikan akses terhadap semua isi pesan.

### Risk 4: External API Availability

API cuaca dapat gagal atau mengalami pembatasan.

Mitigation: gunakan cache, timeout, dan error states.

### Risk 5: Native Bridge Complexity

Komunikasi Rust dan C#/WinRT meningkatkan kompleksitas packaging.

Mitigation: isolasikan helper dalam modul tersendiri dan buat protokol IPC yang terdokumentasi.

---

## 12. Future Roadmap

Setelah MVP stabil, fitur berikut dapat dipertimbangkan:

- Google Calendar OAuth integration.
- Microsoft Outlook Calendar integration.
- Import dan export kalender ICS.
- Media playback controls.
- Clipboard history shortcut.
- Battery and system monitoring.
- Custom themes.
- User-configurable widgets.
- Additional notification providers.
- Plugin system.
- Optional AI-powered summaries.

---

## 13. Definition of Done

MVP dinyatakan selesai ketika:

1. Aplikasi dapat diinstal dan dijalankan di Windows.
2. Kapsul muncul di tengah atas layar.
3. Kapsul mendukung compact, expanded, dan notification state.
4. Animasi berjalan stabil.
5. Cuaca dapat dimuat dan diperbarui.
6. Agenda lokal dapat dikelola dan tersimpan.
7. Notifikasi Windows yang didukung dapat ditampilkan setelah izin diberikan.
8. Pengaturan privasi dan filter notifikasi berfungsi.
9. Kegagalan jaringan atau notification helper tidak membuat aplikasi crash.
10. Dokumentasi instalasi, penggunaan, dan batasan fitur tersedia.

**Final product objective:** menghasilkan aplikasi Dynamic Island Windows yang ringan, modern, dan modular, dengan pengalaman interaksi yang menyerupai Dynamic Island tetapi tetap mengikuti batasan dan model izin Windows.