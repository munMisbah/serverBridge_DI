# Dynamic Island Server Bridge (Docker Container)

Agen bridge ultra-ringan (~15 MB) untuk memonitor metrik host Linux (CPU, RAM, Disk, Uptime, Docker containers) secara instan tanpa SSH.

---

## Fitur Utama

- **Instan (< 10 ms):** Mengkalkulasi delta CPU di latar belakang setiap 1 detik. Saat Dynamic Island meminta data, respons dikirim seketika tanpa jeda `sleep 1`.
- **Aman:** Autentikasi Bearer Token (`BRIDGE_TOKEN`), semua mount host berstatus *Read-Only* (`:ro`).
- **Docker Monitoring:** Otomatis membaca status container via Unix domain socket `/var/run/docker.sock`.
- **Hemat Sumber Daya:** Mengonsumsi RAM hanya ~8–15 MB di server.

---

## Cara Menjalankan

### 1. Menggunakan Docker Compose (Direkomendasikan)

Salin folder `server-bridge/` ke server Anda, lalu jalankan:

```bash
cd server-bridge
docker compose up -d --build
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
```
