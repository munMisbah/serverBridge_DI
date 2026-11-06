use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager};

static STORE_LOCK: Mutex<()> = Mutex::new(());
static ID_COUNTER: AtomicU64 = AtomicU64::new(0);

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StoredServer {
    pub id: String,
    pub name: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub auth_type: String,
    pub key_path: Option<String>,
    pub remember_credential: bool,
    /// Backend-only host-key trust store. Persisted to disk but never sent over
    /// IPC: `ServerView` is the struct the WebView receives.
    #[serde(default)]
    pub known_hosts: String,
    pub created_at: u64,
    pub updated_at: u64,
}

impl StoredServer {
    pub(crate) fn identity(&self) -> String {
        format!("{}:{}:{}", self.host, self.port, self.username)
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerUpsert {
    pub id: Option<String>,
    pub name: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub auth_type: String,
    pub key_path: Option<String>,
    pub remember_credential: bool,
}

/// IPC-facing view of a server: everything except the backend-only host-key
/// trust store.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerView {
    pub id: String,
    pub name: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub auth_type: String,
    pub key_path: Option<String>,
    pub remember_credential: bool,
    pub created_at: u64,
    pub updated_at: u64,
}

impl From<&StoredServer> for ServerView {
    fn from(server: &StoredServer) -> Self {
        Self {
            id: server.id.clone(),
            name: server.name.clone(),
            host: server.host.clone(),
            port: server.port,
            username: server.username.clone(),
            auth_type: server.auth_type.clone(),
            key_path: server.key_path.clone(),
            remember_credential: server.remember_credential,
            created_at: server.created_at,
            updated_at: server.updated_at,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerUpsertResult {
    pub server: ServerView,
    pub credential_cleared: bool,
}

fn store_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Tidak bisa menemukan app data dir: {}", e))?;
    fs::create_dir_all(&dir).map_err(|e| format!("Tidak bisa membuat app data dir: {}", e))?;
    Ok(dir.join("servers.json"))
}

fn load_unlocked(app: &AppHandle) -> Result<Vec<StoredServer>, String> {
    let path = store_path(app)?;
    if !path.exists() {
        return Ok(Vec::new());
    }
    let text = fs::read_to_string(&path)
        .map_err(|e| format!("Tidak bisa membaca {}: {}", path.display(), e))?;
    if text.trim().is_empty() {
        return Ok(Vec::new());
    }
    serde_json::from_str(&text)
        .map_err(|e| format!("Data server rusak ({}): {}", path.display(), e))
}

fn save_unlocked(app: &AppHandle, servers: &[StoredServer]) -> Result<(), String> {
    let path = store_path(app)?;
    let text = serde_json::to_string_pretty(servers)
        .map_err(|e| format!("Tidak bisa menyusun data server: {}", e))?;
    let temp = path.with_extension("json.tmp");
    fs::write(&temp, text).map_err(|e| format!("Tidak bisa menulis {}: {}", temp.display(), e))?;
    if fs::rename(&temp, &path).is_err() {
        // Windows rename cannot replace an existing file; the data is already
        // fully written to the temp file, so replace explicitly.
        let _ = fs::remove_file(&path);
        fs::rename(&temp, &path)
            .map_err(|e| format!("Tidak bisa menyimpan {}: {}", path.display(), e))?;
    }
    Ok(())
}

pub(crate) fn get_server(app: &AppHandle, server_id: &str) -> Result<StoredServer, String> {
    let _guard = STORE_LOCK.lock().map_err(|_| "Server store lock poisoned")?;
    let servers = load_unlocked(app)?;
    servers
        .into_iter()
        .find(|server| server.id == server_id)
        .ok_or_else(|| "Server tidak ditemukan".to_string())
}

pub(crate) fn update_known_hosts(
    app: &AppHandle,
    server_id: &str,
    known_hosts: String,
) -> Result<(), String> {
    let _guard = STORE_LOCK.lock().map_err(|_| "Server store lock poisoned")?;
    let mut servers = load_unlocked(app)?;
    let Some(server) = servers.iter_mut().find(|server| server.id == server_id) else {
        return Err("Server tidak ditemukan".into());
    };
    server.known_hosts = known_hosts;
    server.updated_at = now_ms();
    save_unlocked(app, &servers)
}

fn set_remember(
    app: &AppHandle,
    server_id: &str,
    remember: bool,
) -> Result<(), String> {
    let _guard = STORE_LOCK.lock().map_err(|_| "Server store lock poisoned")?;
    let mut servers = load_unlocked(app)?;
    let Some(server) = servers.iter_mut().find(|server| server.id == server_id) else {
        return Err("Server tidak ditemukan".into());
    };
    server.remember_credential = remember;
    server.updated_at = now_ms();
    save_unlocked(app, &servers)
}

fn clean(value: &str, field: &str, max: usize) -> Result<String, String> {
    let trimmed = value.trim();
    if trimmed.is_empty() || trimmed.len() > max {
        return Err(format!("{} tidak valid", field));
    }
    if trimmed.chars().any(|ch| ch == '\0' || ch == '\n' || ch == '\r') {
        return Err(format!("{} mengandung karakter tidak valid", field));
    }
    Ok(trimmed.to_string())
}

#[tauri::command]
pub fn servers_list(app: AppHandle) -> Result<Vec<ServerView>, String> {
    let _guard = STORE_LOCK.lock().map_err(|_| "Server store lock poisoned")?;
    let servers = load_unlocked(&app)?;
    Ok(servers.iter().map(ServerView::from).collect())
}

#[tauri::command]
pub fn server_upsert(
    app: AppHandle,
    input: ServerUpsert,
) -> Result<ServerUpsertResult, String> {
    let host = clean(&input.host, "Host", 255)?;
    let username = if input.auth_type == "bridge" && input.username.trim().is_empty() {
        "bridge".to_string()
    } else {
        clean(&input.username, "Username", 128)?
    };
    let name = if input.name.trim().is_empty() {
        host.clone()
    } else {
        clean(&input.name, "Nama", 100)?
    };
    if input.port == 0 {
        return Err("Port tidak valid".into());
    }
    if input.auth_type != "key" && input.auth_type != "password" && input.auth_type != "bridge" {
        return Err("Metode autentikasi tidak valid".into());
    }
    let key_path = input
        .key_path
        .as_deref()
        .map(str::trim)
        .filter(|path| !path.is_empty())
        .map(|path| clean(path, "Path SSH key", 1024))
        .transpose()?;
    if input.auth_type == "key" && key_path.is_none() {
        return Err("Path SSH key wajib diisi".into());
    }
    let identity = format!("{}:{}:{}", host, input.port, username);
    if identity.len() > 256 {
        return Err("Host/username terlalu panjang".into());
    }

    let (server, credential_cleared, needs_delete) = {
        let _guard = STORE_LOCK.lock().map_err(|_| "Server store lock poisoned")?;
        let mut servers = load_unlocked(&app)?;
        let existing_index = input
            .id
            .as_deref()
            .map(|id| {
                servers
                    .iter()
                    .position(|server| server.id == id)
                    .ok_or_else(|| "Server tidak ditemukan".to_string())
            })
            .transpose()?;

        let now = now_ms();
        let existing = existing_index.map(|index| servers[index].clone());
        let identity_changed = existing
            .as_ref()
            .map(|server| server.identity() != identity || server.auth_type != input.auth_type)
            .unwrap_or(false);
        let credential_cleared = existing
            .as_ref()
            .map(|server| server.remember_credential)
            .unwrap_or(false)
            && (identity_changed || !input.remember_credential);

        let remember = input.remember_credential && !identity_changed;
        let server = StoredServer {
            id: existing.as_ref().map(|server| server.id.clone()).unwrap_or_else(|| {
                format!(
                    "srv-{}-{}",
                    now,
                    ID_COUNTER.fetch_add(1, Ordering::Relaxed)
                )
            }),
            name,
            host,
            port: input.port,
            username,
            auth_type: input.auth_type,
            key_path,
            remember_credential: remember,
            known_hosts: if identity_changed {
                String::new()
            } else {
                existing
                    .as_ref()
                    .map(|server| server.known_hosts.clone())
                    .unwrap_or_default()
            },
            created_at: existing
                .as_ref()
                .map(|server| server.created_at)
                .unwrap_or(now),
            updated_at: now,
        };

        match existing_index {
            Some(index) => servers[index] = server.clone(),
            None => servers.push(server.clone()),
        }
        save_unlocked(&app, &servers)?;
        (
            server,
            credential_cleared,
            identity_changed || !input.remember_credential,
        )
    };
    if needs_delete {
        let _ = crate::credentials::delete_stored_credential(&server.id);
        crate::servers::clear_pending(&server.id);
    }

    Ok(ServerUpsertResult {
        server: ServerView::from(&server),
        credential_cleared,
    })
}

#[tauri::command]
pub fn server_delete(app: AppHandle, server_id: String) -> Result<(), String> {
    let _ = crate::credentials::delete_stored_credential(&server_id);
    crate::servers::clear_pending(&server_id);

    let _guard = STORE_LOCK.lock().map_err(|_| "Server store lock poisoned")?;
    let mut servers = load_unlocked(&app)?;
    let before = servers.len();
    servers.retain(|server| server.id != server_id);
    if servers.len() == before {
        return Err("Server tidak ditemukan".into());
    }
    save_unlocked(&app, &servers)
}

#[tauri::command]
pub fn server_credential_save(
    app: AppHandle,
    server_id: String,
    secret: String,
) -> Result<(), String> {
    let server = get_server(&app, &server_id)?;
    crate::credentials::save_stored_credential(
        &server.id,
        &server.username,
        &server.identity(),
        secret,
    )?;
    set_remember(&app, &server_id, true)
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}