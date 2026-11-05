use serde::Serialize;
use std::collections::HashMap;
use std::sync::{Arc, LazyLock, Mutex};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tauri::AppHandle;
use zeroize::Zeroize;

const REMOTE_SCRIPT: &str = r###"sh -c '
printf "##HOST\n"; hostname 2>/dev/null
printf "##UPTIME\n"; cat /proc/uptime
printf "##CORES\n"; grep -c "^cpu[0-9]" /proc/stat
printf "##CPU1\n"; head -n 1 /proc/stat
printf "##MEM\n"; cat /proc/meminfo
printf "##DISK\n"; df -P -k / | tail -n 1
printf "##DOCKER\n"
if command -v docker >/dev/null 2>&1; then
  docker ps -a --format "{{.ID}}|{{.Names}}|{{.Image}}|{{.State}}|{{.Status}}" 2>/dev/null || printf "__DOCKER_ERR__\n"
else
  printf "__NO_DOCKER__\n"
fi
printf "##CPU2\n"; sleep 1; head -n 1 /proc/stat
'"###;

#[derive(Debug, Clone)]
struct PendingHostKey {
    fingerprint: String,
    key_type: String,
    key_blob: Vec<u8>,
    host: String,
    port: u16,
}

#[derive(Debug, Clone)]
enum CapturedPrompt {
    Unknown(PendingHostKey),
    Changed,
}

static PENDING_HOST_KEYS: LazyLock<Mutex<HashMap<String, PendingHostKey>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

fn pending_host_keys() -> &'static Mutex<HashMap<String, PendingHostKey>> {
    &PENDING_HOST_KEYS
}

pub fn clear_pending(server_id: &str) {
    if let Ok(mut pending) = pending_host_keys().lock() {
        pending.remove(server_id);
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DockerContainer {
    pub id: String,
    pub name: String,
    pub image: String,
    pub state: String,
    pub status: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerSnapshot {
    pub server_id: String,
    pub hostname: String,
    pub cpu_percent: f64,
    pub cpu_count: u32,
    pub ram_used_bytes: u64,
    pub ram_total_bytes: u64,
    pub disk_used_bytes: u64,
    pub disk_total_bytes: u64,
    pub uptime_seconds: u64,
    pub docker_available: bool,
    pub docker: Vec<DockerContainer>,
    pub latency_ms: u64,
    pub updated_at: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "status", rename_all = "camelCase", rename_all_fields = "camelCase")]
pub enum ProbeOutcome {
    Ok { snapshot: ServerSnapshot },
    NeedsTrust {
        fingerprint: String,
        key_type: String,
        host: String,
        port: u16,
    },
    Error {
        message: String,
    },
}

#[tauri::command]
pub async fn server_probe(
    app: AppHandle,
    server_id: String,
    password: Option<String>,
) -> ProbeOutcome {
    match tokio::task::spawn_blocking(move || probe(app, server_id, password)).await {
        Ok(outcome) => outcome,
        Err(error) => ProbeOutcome::Error {
            message: format!("Server probe task join error: {}", error),
        },
    }
}

fn probe(app: AppHandle, server_id: String, session_password: Option<String>) -> ProbeOutcome {
    let server = match crate::server_store::get_server(&app, &server_id) {
        Ok(server) => server,
        Err(message) => return ProbeOutcome::Error { message },
    };

    let started = Instant::now();
    let known_hosts_bytes = server.known_hosts.as_bytes();
    let store = Arc::new(Mutex::new(puressh::known_hosts::KnownHosts::from_bytes(
        known_hosts_bytes,
    )));

    let captured: Arc<Mutex<Option<CapturedPrompt>>> = Arc::new(Mutex::new(None));
    let callback_capture = captured.clone();
    let host_key_callback: Arc<puressh::client::HostKeyPromptFn> = Arc::new(move |prompt| {
        let pending = PendingHostKey {
            fingerprint: prompt.fingerprint.clone(),
            key_type: prompt.key_type.to_string(),
            key_blob: prompt.key_blob.to_vec(),
            host: prompt.host.to_string(),
            port: prompt.port,
        };
        let result = match prompt.change {
            puressh::client::HostKeyChange::Unknown => CapturedPrompt::Unknown(pending),
            _ => CapturedPrompt::Changed,
        };
        if let Ok(mut slot) = callback_capture.lock() {
            *slot = Some(result);
        }
        // Never trust during the probe. The UI must confirm the fingerprint
        // first; only then is the key persisted and the probe retried.
        false
    });

    let mut policy = puressh::client::KnownHostsPolicy::strict(store.clone());
    policy.on_unknown =
        puressh::client::TofuAction::PromptDetailed(host_key_callback.clone());
    policy.on_mismatch = puressh::client::TofuAction::PromptDetailed(host_key_callback);
    policy.notice = Some(Arc::new(|_| {}));

    let config = puressh::client::Config::new(puressh::client::HostKeyPolicy::KnownHosts(policy))
        .with_timeout(Duration::from_secs(8));

    let mut client = match puressh::client::Client::connect_to_host(
        &server.host,
        server.port,
        config,
    ) {
        Ok(client) => client,
        Err(error) => {
            let prompt = captured
                .lock()
                .ok()
                .and_then(|mut slot| slot.take());
            return match prompt {
                Some(CapturedPrompt::Unknown(pending)) => {
                    if let Ok(mut pending_map) = pending_host_keys().lock() {
                        pending_map.insert(server.id.clone(), pending.clone());
                    }
                    ProbeOutcome::NeedsTrust {
                        fingerprint: pending.fingerprint,
                        key_type: pending.key_type,
                        host: pending.host,
                        port: pending.port,
                    }
                }
                Some(CapturedPrompt::Changed) => ProbeOutcome::Error {
                    message: "Host key server berubah. Koneksi ditolak.".into(),
                },
                None => ProbeOutcome::Error {
                    message: map_ssh_error(error),
                },
            };
        }
    };

    clear_pending(&server.id);

    let mut secret = if server.remember_credential {
        match crate::credentials::read_credential_for(&server.id, &server.identity()) {
            Ok(secret) => secret,
            Err(message) => return ProbeOutcome::Error { message },
        }
    } else {
        session_password.filter(|value| !value.is_empty())
    };

    let auth_result: Result<(), String> = match server.auth_type.as_str() {
        "password" => match secret.as_deref() {
            Some(password) => client
                .authenticate_password(&server.username, password)
                .map_err(map_ssh_error),
            None => Err(
                "Password tidak tersedia. Simpan credential atau masukkan password.".into(),
            ),
        },
        "key" => (|| -> Result<(), String> {
            let key_path = server
                .key_path
                .as_deref()
                .filter(|path| !path.trim().is_empty())
                .ok_or_else(|| "Path SSH key belum diisi".to_string())?;
            let pem_path = expand_key_path(key_path);
            let mut pem = std::fs::read_to_string(&pem_path)
                .map_err(|e| format!("Tidak bisa membaca SSH key {}: {}", pem_path.display(), e))?;
            let key = match puressh::key::PrivateKey::parse_openssh_pem(
                &pem,
                secret.as_deref().map(str::as_bytes),
            ) {
                Ok(key) => key,
                Err(e) => {
                    pem.zeroize();
                    return Err(format!("SSH key tidak valid: {}", e));
                }
            };
            pem.zeroize();
            let signer = key
                .into_host_key()
                .map_err(|e| format!("SSH key tidak bisa dipakai: {}", e))?;
            client
                .authenticate_publickey(&server.username, signer)
                .map_err(map_ssh_error)
        })(),
        _ => Err("Metode autentikasi tidak dikenal".into()),
    };

    if let Some(secret) = secret.as_mut() {
        secret.zeroize();
    }
    if let Err(message) = auth_result {
        return ProbeOutcome::Error { message };
    }
    let latency_ms = started.elapsed().as_millis() as u64;

    let output = match client.exec(REMOTE_SCRIPT) {
        Ok(output) => output,
        Err(error) => {
            return ProbeOutcome::Error {
                message: map_ssh_error(error),
            }
        }
    };
    let text = String::from_utf8_lossy(&output.stdout);
    if !text.contains("##CPU1") || !text.contains("##CPU2") {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return ProbeOutcome::Error {
            message: format!(
                "Server tidak mengembalikan metrik Linux{}",
                if stderr.trim().is_empty() {
                    String::new()
                } else {
                    format!(": {}", stderr.trim())
                }
            ),
        };
    }

    let cpu_1 = match parse_cpu_section(section(&text, "CPU1")) {
        Some(cpu) => cpu,
        None => {
            return ProbeOutcome::Error {
                message: "Gagal membaca statistik CPU".into(),
            }
        }
    };
    let cpu_2 = match parse_cpu_section(section(&text, "CPU2")) {
        Some(cpu) => cpu,
        None => {
            return ProbeOutcome::Error {
                message: "Gagal membaca sampel CPU kedua".into(),
            }
        }
    };
    let total_delta = cpu_2.1.saturating_sub(cpu_1.1);
    let busy_delta = cpu_2.0.saturating_sub(cpu_1.0);
    let cpu_percent = if total_delta == 0 {
        0.0
    } else {
        (busy_delta as f64 / total_delta as f64 * 100.0).clamp(0.0, 100.0)
    };

    let (ram_total_bytes, ram_used_bytes) = parse_meminfo(section(&text, "MEM").unwrap_or(""));
    let (disk_total_bytes, disk_used_bytes) =
        match parse_df(section(&text, "DISK").unwrap_or("")) {
            Some(disk) => disk,
            None => {
                return ProbeOutcome::Error {
                    message: "Gagal membaca kapasitas disk".into(),
                }
            }
        };
    let (docker_available, docker) = parse_docker(section(&text, "DOCKER").unwrap_or(""));

    let hostname = section(&text, "HOST")
        .filter(|value| !value.is_empty())
        .unwrap_or(&server.host)
        .to_string();
    let uptime_seconds = section(&text, "UPTIME")
        .and_then(|value| value.split_whitespace().next())
        .and_then(|value| value.parse::<f64>().ok())
        .unwrap_or(0.0) as u64;
    let cpu_count = section(&text, "CORES")
        .and_then(|value| value.trim().parse::<u32>().ok())
        .unwrap_or(0);

    ProbeOutcome::Ok {
        snapshot: ServerSnapshot {
            server_id: server.id,
            hostname,
            cpu_percent,
            cpu_count,
            ram_used_bytes,
            ram_total_bytes,
            disk_used_bytes,
            disk_total_bytes,
            uptime_seconds,
            docker_available,
            docker,
            latency_ms,
            updated_at: now_ms(),
        },
    }
}

#[tauri::command]
pub fn server_confirm_host_key(
    app: AppHandle,
    server_id: String,
    fingerprint: String,
) -> Result<(), String> {
    let pending = pending_host_keys()
        .lock()
        .map_err(|_| "Host key lock poisoned")?
        .get(&server_id)
        .cloned()
        .ok_or("Tidak ada host key yang menunggu konfirmasi")?;

    if pending.fingerprint != fingerprint {
        return Err("Fingerprint host key tidak cocok".into());
    }

    // The renderer can call this command, so require a native OS dialog. A
    // compromised WebView cannot silently approve a host key on its own.
    #[cfg(target_os = "windows")]
    confirm_host_key_native(&pending)?;

    let server = crate::server_store::get_server(&app, &server_id)?;
    if server.host != pending.host || server.port != pending.port {
        return Err("Konfigurasi server berubah; ulangi koneksi".into());
    }

    let mut store = puressh::known_hosts::KnownHosts::from_bytes(server.known_hosts.as_bytes());
    store.add(
        &server.host,
        server.port,
        &pending.key_type,
        &pending.key_blob,
        false,
    );
    let known_hosts = String::from_utf8_lossy(&store.to_bytes()).into_owned();
    crate::server_store::update_known_hosts(&app, &server_id, known_hosts)?;

    if let Ok(mut pending_map) = pending_host_keys().lock() {
        pending_map.remove(&server_id);
    }
    Ok(())
}

#[cfg(target_os = "windows")]
fn confirm_host_key_native(pending: &PendingHostKey) -> Result<(), String> {
    use windows::core::HSTRING;
    use windows::Win32::UI::WindowsAndMessaging::{
        MessageBoxW, IDYES, MB_DEFBUTTON2, MB_ICONWARNING, MB_SETFOREGROUND, MB_TOPMOST, MB_YESNO,
    };

    let text = HSTRING::from(format!(
        "Host key belum dipercaya.\n\n{} {}:{}\nFingerprint:\n{}\n\nPercayai host key ini?",
        pending.key_type, pending.host, pending.port, pending.fingerprint
    ));
    let caption = HSTRING::from("Dynamic Island - Konfirmasi Host Key");
    let result = unsafe {
        MessageBoxW(
            None,
            &text,
            &caption,
            MB_YESNO | MB_ICONWARNING | MB_TOPMOST | MB_SETFOREGROUND | MB_DEFBUTTON2,
        )
    };
    if result == IDYES {
        Ok(())
    } else {
        Err("Host key tidak dipercaya".into())
    }
}

fn section<'a>(text: &'a str, name: &str) -> Option<&'a str> {
    let marker = format!("##{}\n", name);
    let start = text.find(&marker)? + marker.len();
    let rest = &text[start..];
    let end = rest.find("\n##").unwrap_or(rest.len());
    Some(rest[..end].trim())
}

fn parse_cpu_section(value: Option<&str>) -> Option<(u64, u64)> {
    let mut parts = value?.split_whitespace();
    if parts.next()? != "cpu" {
        return None;
    }
    let fields: Vec<u64> = parts.take(8).filter_map(|part| part.parse().ok()).collect();
    if fields.len() < 4 {
        return None;
    }
    let idle = fields[3] + fields.get(4).copied().unwrap_or(0);
    let total: u64 = fields.iter().sum();
    Some((total.saturating_sub(idle), total))
}

fn parse_meminfo(text: &str) -> (u64, u64) {
    let mut total = 0u64;
    let mut available = None;
    let mut free = 0u64;
    let mut buffers = 0u64;
    let mut cached = 0u64;

    for line in text.lines() {
        let mut parts = line.split_whitespace();
        let Some(key) = parts.next() else { continue };
        let value = parts.next().and_then(|v| v.parse::<u64>().ok()).unwrap_or(0) * 1024;
        match key {
            "MemTotal:" => total = value,
            "MemAvailable:" => available = Some(value),
            "MemFree:" => free = value,
            "Buffers:" => buffers = value,
            "Cached:" => cached = value,
            _ => {}
        }
    }

    let available = available.unwrap_or_else(|| free + buffers + cached);
    (total, total.saturating_sub(available))
}

fn parse_df(text: &str) -> Option<(u64, u64)> {
    let parts: Vec<&str> = text.split_whitespace().collect();
    if parts.len() < 3 {
        return None;
    }
    let total = parts[1].parse::<u64>().ok()? * 1024;
    let used = parts[2].parse::<u64>().ok()? * 1024;
    Some((total, used))
}

fn parse_docker(text: &str) -> (bool, Vec<DockerContainer>) {
    if text.contains("__NO_DOCKER__") || text.contains("__DOCKER_ERR__") {
        return (false, Vec::new());
    }

    let containers = text
        .lines()
        .filter_map(|line| {
            let mut parts = line.splitn(5, '|');
            Some(DockerContainer {
                id: parts.next()?.trim().to_string(),
                name: parts.next()?.trim().to_string(),
                image: parts.next()?.trim().to_string(),
                state: parts.next()?.trim().to_string(),
                status: parts.next()?.trim().to_string(),
            })
        })
        .filter(|container| !container.id.is_empty())
        .collect();

    (true, containers)
}

fn expand_key_path(path: &str) -> std::path::PathBuf {
    let trimmed = path.trim();
    if let Some(rest) = trimmed
        .strip_prefix("~/")
        .or_else(|| trimmed.strip_prefix("~\\"))
    {
        if let Some(home) = std::env::var_os("USERPROFILE").or_else(|| std::env::var_os("HOME")) {
            return std::path::PathBuf::from(home).join(rest);
        }
    }
    std::path::PathBuf::from(trimmed)
}

fn map_ssh_error(error: puressh::Error) -> String {
    match error {
        puressh::Error::HostKeyRejected => {
            "Host key server berubah atau belum dipercaya. Koneksi ditolak.".into()
        }
        puressh::Error::AuthFailed => {
            "Autentikasi SSH gagal. Periksa username, password/passphrase, atau SSH key.".into()
        }
        puressh::Error::Io(error) => format!("Koneksi SSH gagal: {}", error),
        other => format!("SSH: {}", other),
    }
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}