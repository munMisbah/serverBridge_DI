# Dynamic Island Server Bridge (Docker Container)

Agen bridge ultra-ringan (~15 MB) untuk memonitor metrik host Linux (CPU, RAM, Disk, Uptime, Docker containers) secara instan tanpa SSH.

---

## Fitur Utama

- **Instan (< 10 ms):** Mengkalkulasi delta CPU di latar belakang setiap 1 detik. Saat Dynamic Island meminta data, respons dikirim seketika tanpa jeda `sleep 1`.
- **Autentikasi:** Bearer Token (`BRIDGE_TOKEN`); mount host menggunakan *Read-Only* (`:ro`).
- **Docker Monitoring:** Otomatis membaca status container via Unix domain socket `/var/run/docker.sock`.
- **Hemat Sumber Daya:** Mengonsumsi RAM hanya ~8–15 MB di server.

---

## Cara Menjalankan

### 1. Menggunakan Docker Compose (Direkomendasikan)

Compose menggunakan image GHCR. Setelah patch dipush dan workflow publish sukses, perbarui image di server:

```bash
cd server-bridge
docker compose pull
docker compose up -d
```

### 2. Menggunakan Docker Run Langsung

```bash
docker run -d \
  --name di-server-bridge \
  --restart unless-stopped \
  -p 8765:8765 \
  -e BRIDGE_PORT=8765 \
  -e BRIDGE_TOKEN=kunci-rahasia-anda \
  -v /proc:/host/proc:ro \
  -v /sys:/host/sys:ro \
  -v /:/host/root:ro \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  di-server-bridge
```

---

## Menguji Endpoint Bridge

```bash
# Cek status kesehatan
curl http://localhost:8765/health

# Cek data metrik server
curl -H "Authorization: Bearer my-secure-bridge-token-123" http://localhost:8765/api/stats

# Aktivitas proses host (default: CPU menurun)
curl -H "Authorization: Bearer my-secure-bridge-token-123" \
  'http://localhost:8765/api/processes?sort=ram&descending=true'
```

## Aktivitas proses

`GET /api/processes` memakai autentikasi yang sama dengan `/api/stats`. Parameter
`sort` menerima `cpu`, `ram`, atau `user`; `descending` menerima `true` atau
`false`. Default adalah CPU menurun. Respons JSON berisi `processes` (maksimum
20 setelah pengurutan), `total`, `skippedProcesses`, dan `updatedAt` (Unix
milliseconds). Setiap proses berisi `pid`, `name`, `user`, `cpuPercent`, dan
`ramUsedBytes`.

CPU adalah delta waktu CPU proses dibandingkan delta total kapasitas CPU host,
dinormalisasi ke 0–100%, bukan rata-rata sejak proses dimulai. Nilainya `null`
sampai tersedia sampel sebelumnya untuk PID dan waktu mulai yang sama; nilai
`null` selalu diurutkan terakhir. RAM adalah resident set size (RSS) dalam byte,
bukan memori virtual; halaman bersama dapat dihitung pada beberapa proses.
Sampel hanya dikumpulkan saat diminta dan digunakan ulang selama lima detik,
termasuk ketika pilihan pengurutan berubah.

Di aplikasi desktop versi terbaru, buka **Servers → pilih server Bridge → Apps
Activity**. Klik header CPU/RAM/USER untuk mengganti arah sorting. UI hanya
meminta daftar proses setiap lima detik selama panel aktif dan window terlihat;
koneksi SSH saja tidak menyediakan endpoint ini. Bridge lama akan menampilkan
pesan untuk memperbarui image, bukan daftar proses kosong.

Mount `/proc:/host/proc:ro` diperlukan untuk melihat proses host dari container;
tanpanya bridge menggunakan `/proc` miliknya sendiri. Nama pengguna diambil dari
`/host/root/etc/passwd` saat root host di-mount (atau `/etc/passwd` lokal sebagai
fallback); UID numerik ditampilkan jika tidak ditemukan. Batas izin, `hidepid`,
namespace PID, dan proses yang keluar selama pembacaan dapat menyembunyikan atau
melewati proses. `skippedProcesses` menghitung entri proses yang tidak dapat
dibaca; kegagalan membaca direktori proc atau statistik CPU mengembalikan error.

**Keamanan:** mount socket Docker dengan `:ro` tidak membuat Docker API
read-only. Akses ke socket masih dapat memberikan kendali penuh atas Docker dan
host. Hanya gunakan pada host tepercaya, lindungi akses jaringan bridge, dan
atur `BRIDGE_TOKEN`; tanpa token bridge terbuka.
