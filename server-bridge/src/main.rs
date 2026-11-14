mod processes;

use axum::{
    extract::{Query, State},
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Json},
    routing::get,
    Router,
};
use serde::{Deserialize, Serialize};
use std::{
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicU32, Ordering},
        Arc,
    },
    time::Duration,
};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DockerContainerInfo {
    pub id: String,
    pub name: String,
    pub image: String,
    pub state: String,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cpu_percent: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ram_used_bytes: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BridgeStatsResponse {
    pub hostname: String,
    pub cpu_percent: f64,
    pub cpu_count: u32,
    pub ram_used_bytes: u64,
    pub ram_total_bytes: u64,
    pub disk_used_bytes: u64,
    pub disk_total_bytes: u64,
    pub uptime_seconds: u64,
    pub docker_available: bool,
    pub docker: Vec<DockerContainerInfo>,
    pub timestamp: u64,
}

#[derive(Clone)]
struct AppState {
    token: Option<String>,
    cpu_percent: Arc<AtomicU32>, // stored as (percent * 100) as u32
    paths: HostPaths,
    docker_cache: Arc<tokio::sync::Mutex<(u64, bool, Vec<DockerContainerInfo>)>>,
    disk_cache: Arc<tokio::sync::Mutex<(u64, u64, u64)>>,
    container_cpu_tracker: Arc<tokio::sync::Mutex<std::collections::HashMap<String, (std::time::Instant, u64)>>>,
    process_collector: Arc<tokio::sync::Mutex<processes::ProcessCollector>>,
}

#[derive(Clone)]
struct HostPaths {
    proc_dir: PathBuf,
    root_dir: PathBuf,
    sys_dir: PathBuf,
    docker_sock: PathBuf,
}

impl HostPaths {
    fn detect() -> Self {
        let proc_dir = if Path::new("/host/proc/stat").exists() {
            PathBuf::from("/host/proc")
        } else {
            PathBuf::from("/proc")
        };

        let root_dir = if Path::new("/host/root").exists() {
            PathBuf::from("/host/root")
        } else {
            PathBuf::from("/")
        };

        let sys_dir = if Path::new("/host/sys/fs/cgroup").exists() {
            PathBuf::from("/host/sys")
        } else {
            PathBuf::from("/sys")
        };

        let docker_sock = if Path::new("/var/run/docker.sock").exists() {
            PathBuf::from("/var/run/docker.sock")
        } else {
            PathBuf::from("/var/run/docker.sock")
        };

        Self {
            proc_dir,
            root_dir,
            sys_dir,
            docker_sock,
        }
    }
}

#[tokio::main]
async fn main() {
    let port = std::env::var("BRIDGE_PORT")
        .ok()
        .and_then(|p| p.parse::<u16>().ok())
        .unwrap_or(8765);

    let token = std::env::var("BRIDGE_TOKEN")
        .ok()
        .map(|t| t.trim().to_string())
        .filter(|t| !t.is_empty());

    let paths = HostPaths::detect();
    println!("=== Dynamic Island Server Bridge ===");
    println!("Listening on: 0.0.0.0:{}", port);
    println!("Host /proc:   {}", paths.proc_dir.display());
    println!("Host root:    {}", paths.root_dir.display());
    println!("Docker socket:{}", paths.docker_sock.display());
    if token.is_some() {
        println!("Security:     Bearer token authentication ENABLED");
    } else {
        println!("Security:     WARNING: Running in open mode (no BRIDGE_TOKEN set)");
    }

    let cpu_percent = Arc::new(AtomicU32::new(0));

    // Background rolling CPU sampler: computes true CPU delta every 1 second
    let cpu_clone = cpu_percent.clone();
    let proc_stat_path = paths.proc_dir.join("stat");
    tokio::spawn(async move {
        let mut prev_idle = 0u64;
        let mut prev_total = 0u64;

        loop {
            if let Ok(content) = tokio::fs::read_to_string(&proc_stat_path).await {
                if let Some(first_line) = content.lines().next() {
                    let parts: Vec<u64> = first_line
                        .split_whitespace()
                        .skip(1)
                        .filter_map(|p| p.parse::<u64>().ok())
                        .collect();

                    if parts.len() >= 4 {
                        let user = parts.get(0).copied().unwrap_or(0);
                        let nice = parts.get(1).copied().unwrap_or(0);
                        let system = parts.get(2).copied().unwrap_or(0);
                        let idle = parts.get(3).copied().unwrap_or(0);
                        let iowait = parts.get(4).copied().unwrap_or(0);
                        let irq = parts.get(5).copied().unwrap_or(0);
                        let softirq = parts.get(6).copied().unwrap_or(0);
                        let steal = parts.get(7).copied().unwrap_or(0);

                        let idle_time = idle + iowait;
                        let total_time = user + nice + system + idle + iowait + irq + softirq + steal;

                        if prev_total > 0 && total_time > prev_total {
                            let delta_total = total_time - prev_total;
                            let delta_idle = idle_time.saturating_sub(prev_idle);
                            let percent = if delta_total > 0 {
                                ((delta_total.saturating_sub(delta_idle)) as f64 / delta_total as f64) * 100.0
                            } else {
                                0.0
                            };
                            let clamped = (percent.clamp(0.0, 100.0) * 100.0) as u32;
                            cpu_clone.store(clamped, Ordering::Relaxed);
                        }

                        prev_idle = idle_time;
                        prev_total = total_time;
                    }
                }
            }
            tokio::time::sleep(Duration::from_millis(1000)).await;
        }
    });

    let state = AppState {
        token,
        cpu_percent,
        paths,
        docker_cache: Arc::new(tokio::sync::Mutex::new((0, false, Vec::new()))),
        disk_cache: Arc::new(tokio::sync::Mutex::new((0, 0, 0))),
        container_cpu_tracker: Arc::new(tokio::sync::Mutex::new(std::collections::HashMap::new())),
        process_collector: Arc::new(tokio::sync::Mutex::new(processes::ProcessCollector::default())),
    };

    let app = Router::new()
        .route("/health", get(health_handler))
        .route("/api/stats", get(stats_handler))
        .route("/api/processes", get(processes_handler))
        .with_state(state);

    let listener = tokio::net::TcpListener::bind(("0.0.0.0", port))
        .await
        .expect("Failed to bind TCP listener");

    axum::serve(listener, app).await.expect("Bridge server error");
}

async fn health_handler() -> impl IntoResponse {
    Json(serde_json::json!({
        "status": "ok",
        "service": "dynamic-island-server-bridge",
        "version": "0.1.0"
    }))
}

async fn stats_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<impl IntoResponse, (StatusCode, &'static str)> {
    authorize(&state, &headers)?;
    let stats = collect_host_stats(&state).await;
    Ok(Json(stats))
}

fn authorize(state: &AppState, headers: &HeaderMap) -> Result<(), (StatusCode, &'static str)> {
    if let Some(ref required_token) = state.token {
        let auth_header = headers
            .get(header::AUTHORIZATION)
            .and_then(|v| v.to_str().ok());

        let is_valid = match auth_header {
            Some(val) => {
                if let Some(token) = val.strip_prefix("Bearer ") {
                    token.trim() == required_token
                } else {
                    val.trim() == required_token
                }
            }
            None => false,
        };

        if !is_valid {
            return Err((StatusCode::UNAUTHORIZED, "Invalid or missing Bearer token"));
        }
    }
    Ok(())
}

async fn processes_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<processes::ProcessQuery>,
) -> Result<Json<processes::ProcessResponse>, (StatusCode, &'static str)> {
    authorize(&state, &headers)?;
    let collector = state.process_collector.lock_owned().await;
    let paths = state.paths;
    tokio::task::spawn_blocking(move || {
        let mut collector = collector;
        collector.response(&paths.proc_dir, &paths.root_dir, query)
    })
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Process collector failed"))?
    .map(Json)
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Failed to read host processes"))
}

async fn collect_host_stats(state: &AppState) -> BridgeStatsResponse {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);

    // 1. Hostname
    let hostname = read_hostname(&state.paths.proc_dir).await;

    // 2. CPU Count & Rolling CPU Percent
    let (cpu_count, _) = read_cpu_info(&state.paths.proc_dir).await;
    let cpu_raw = state.cpu_percent.load(Ordering::Relaxed);
    let cpu_percent = (cpu_raw as f64) / 100.0;

    // 3. RAM (Used & Total)
    let (ram_used, ram_total) = read_meminfo(&state.paths.proc_dir).await;

    // 4. Disk (Used & Total) - Cached for 5s to eliminate unnecessary syscalls at 1Hz
    let (disk_used, disk_total) = {
        let mut cache = state.disk_cache.lock().await;
        if now.saturating_sub(cache.0) > 5000 {
            let (u, t) = read_statvfs(&state.paths.root_dir);
            *cache = (now, u, t);
            (u, t)
        } else {
            (cache.1, cache.2)
        }
    };

    // 5. Uptime
    let uptime = read_uptime(&state.paths.proc_dir).await;

    // 6. Docker Containers - Cached for 5s to prevent hammering dockerd at 1Hz
    let (docker_available, docker) = {
        let mut cache = state.docker_cache.lock().await;
        if now.saturating_sub(cache.0) > 5000 {
            let (avail, list) = read_docker_containers(&state.paths, &state.container_cpu_tracker).await;
            *cache = (now, avail, list.clone());
            (avail, list)
        } else {
            (cache.1, cache.2.clone())
        }
    };
    BridgeStatsResponse {
        hostname,
        cpu_percent: (cpu_percent * 10.0).round() / 10.0,
        cpu_count: cpu_count.max(1),
        ram_used_bytes: ram_used,
        ram_total_bytes: ram_total,
        disk_used_bytes: disk_used,
        disk_total_bytes: disk_total,
        uptime_seconds: uptime,
        docker_available,
        docker,
        timestamp: now,
    }
}

async fn read_hostname(proc_dir: &Path) -> String {
    // Try host /etc/hostname first if mounted
    for path in ["/host/etc/hostname", "/etc/hostname"] {
        if let Ok(content) = tokio::fs::read_to_string(path).await {
            let trimmed = content.trim();
            if !trimmed.is_empty() {
                return trimmed.to_string();
            }
        }
    }
    // Fallback to /proc/sys/kernel/hostname
    let sys_hostname = proc_dir.join("sys/kernel/hostname");
    if let Ok(content) = tokio::fs::read_to_string(sys_hostname).await {
        let trimmed = content.trim();
        if !trimmed.is_empty() {
            return trimmed.to_string();
        }
    }
    "server".to_string()
}

async fn read_cpu_info(proc_dir: &Path) -> (u32, u32) {
    let stat_path = proc_dir.join("stat");
    let mut cores = 0u32;
    if let Ok(content) = tokio::fs::read_to_string(stat_path).await {
        for line in content.lines().skip(1) {
            if line.starts_with("cpu") && line.chars().nth(3).map_or(false, |c| c.is_ascii_digit()) {
                cores += 1;
            } else if !line.starts_with("cpu") {
                break;
            }
        }
    }
    (cores.max(1), 0)
}

async fn read_meminfo(proc_dir: &Path) -> (u64, u64) {
    let meminfo_path = proc_dir.join("meminfo");
    let mut total_kb = 0u64;
    let mut available_kb = 0u64;
    let mut free_kb = 0u64;
    let mut buffers_kb = 0u64;
    let mut cached_kb = 0u64;

    if let Ok(content) = tokio::fs::read_to_string(meminfo_path).await {
        for line in content.lines() {
            let mut parts = line.split_whitespace();
            let key = parts.next().unwrap_or("");
            let val = parts.next().and_then(|v| v.parse::<u64>().ok()).unwrap_or(0);

            match key {
                "MemTotal:" => total_kb = val,
                "MemAvailable:" => available_kb = val,
                "MemFree:" => free_kb = val,
                "Buffers:" => buffers_kb = val,
                "Cached:" => cached_kb = val,
                _ => {}
            }
        }
    }

    let total = total_kb * 1024;
    let used = if available_kb > 0 {
        total_kb.saturating_sub(available_kb) * 1024
    } else {
        total_kb.saturating_sub(free_kb + buffers_kb + cached_kb) * 1024
    };

    (used, total)
}

fn read_statvfs(root_dir: &Path) -> (u64, u64) {
    use std::ffi::CString;
    let path_str = root_dir.to_string_lossy();
    let Ok(c_path) = CString::new(path_str.as_bytes()) else {
        return (0, 0);
    };

    unsafe {
        let mut stat: libc::statvfs = std::mem::zeroed();
        if libc::statvfs(c_path.as_ptr(), &mut stat) == 0 {
            let frsize = if stat.f_frsize > 0 {
                stat.f_frsize as u64
            } else {
                stat.f_bsize as u64
            };
            let total = stat.f_blocks as u64 * frsize;
            let free = stat.f_bavail as u64 * frsize;
            let used = total.saturating_sub(free);
            (used, total)
        } else {
            (0, 0)
        }
    }
}

async fn read_uptime(proc_dir: &Path) -> u64 {
    let uptime_path = proc_dir.join("uptime");
    if let Ok(content) = tokio::fs::read_to_string(uptime_path).await {
        if let Some(first) = content.split_whitespace().next() {
            if let Ok(secs) = first.parse::<f64>() {
                return secs as u64;
            }
        }
    }
    0
}

async fn read_docker_containers(
    paths: &HostPaths,
    tracker: &tokio::sync::Mutex<std::collections::HashMap<String, (std::time::Instant, u64)>>,
) -> (bool, Vec<DockerContainerInfo>) {
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::UnixStream;

    let sock_path = &paths.docker_sock;
    if !sock_path.exists() {
        return (false, Vec::new());
    }

    let Ok(mut stream) = UnixStream::connect(sock_path).await else {
        return (false, Vec::new());
    };

    // Minimal raw HTTP GET over Docker Unix Domain Socket
    let request = "GET /containers/json?all=1 HTTP/1.0\r\nHost: docker\r\nConnection: close\r\n\r\n";
    if stream.write_all(request.as_bytes()).await.is_err() {
        return (false, Vec::new());
    }

    let mut response_bytes = Vec::new();
    if stream.read_to_end(&mut response_bytes).await.is_err() {
        return (false, Vec::new());
    }

    // Split HTTP headers and body
    let mut body_start = 0;
    for i in 0..response_bytes.len().saturating_sub(3) {
        if &response_bytes[i..i + 4] == b"\r\n\r\n" {
            body_start = i + 4;
            break;
        }
    }

    if body_start == 0 || body_start >= response_bytes.len() {
        return (false, Vec::new());
    }

    let body = &response_bytes[body_start..];

    #[derive(Deserialize)]
    struct RawDockerContainer {
        #[serde(rename = "Id")]
        id: Option<String>,
        #[serde(rename = "Names")]
        names: Option<Vec<String>>,
        #[serde(rename = "Image")]
        image: Option<String>,
        #[serde(rename = "State")]
        state: Option<String>,
        #[serde(rename = "Status")]
        status: Option<String>,
    }

    let Ok(raw_list): Result<Vec<RawDockerContainer>, _> = serde_json::from_slice(body) else {
        return (false, Vec::new());
    };

    let mut containers = Vec::new();
    for c in raw_list {
        let full_id = c.id.unwrap_or_default();
        let short_id = if full_id.len() > 12 { full_id[..12].to_string() } else { full_id.clone() };
        let raw_name = c
            .names
            .and_then(|names| names.into_iter().next())
            .unwrap_or_default();
        let name = raw_name.trim_start_matches('/').to_string();
        let state = c.state.unwrap_or_else(|| "unknown".into());

        let (cpu, ram) = if state == "running" && !full_id.is_empty() {
            read_single_container_metrics(paths, sock_path, &full_id, tracker).await
        } else {
            (None, None)
        };

        containers.push(DockerContainerInfo {
            id: short_id,
            name: if name.is_empty() { "container".into() } else { name },
            image: c.image.unwrap_or_default(),
            state,
            status: c.status.unwrap_or_default(),
            cpu_percent: cpu,
            ram_used_bytes: ram,
        });
    }

    (true, containers)
}

async fn read_single_container_metrics(
    paths: &HostPaths,
    sock_path: &Path,
    full_id: &str,
    tracker: &tokio::sync::Mutex<std::collections::HashMap<String, (std::time::Instant, u64)>>,
) -> (Option<f64>, Option<u64>) {
    // 1. Ultra-fast direct cgroup v2 probe (takes < 0.02ms, zero dockerd load!)
    let candidate_dirs = [
        paths.sys_dir.join("fs/cgroup/system.slice").join(format!("docker-{}.scope", full_id)),
        paths.sys_dir.join("fs/cgroup/docker").join(full_id),
        PathBuf::from(format!("/sys/fs/cgroup/system.slice/docker-{}.scope", full_id)),
        PathBuf::from(format!("/sys/fs/cgroup/docker/{}", full_id)),
    ];

    for cgroup_dir in candidate_dirs {
        if cgroup_dir.exists() {
            // Read RAM from memory.current
            let mem_current_path = cgroup_dir.join("memory.current");
            let mut ram_bytes = tokio::fs::read_to_string(&mem_current_path)
                .await
                .ok()
                .and_then(|s| s.trim().parse::<u64>().ok());

            // Subtract inactive_file page cache if memory.stat exists
            if let Some(total_mem) = ram_bytes {
                let mem_stat_path = cgroup_dir.join("memory.stat");
                if let Ok(stat_text) = tokio::fs::read_to_string(&mem_stat_path).await {
                    for line in stat_text.lines() {
                        if line.starts_with("inactive_file ") {
                            if let Some(val) = line.split_whitespace().nth(1).and_then(|v| v.parse::<u64>().ok()) {
                                ram_bytes = Some(total_mem.saturating_sub(val));
                                break;
                            }
                        }
                    }
                }
            }

            // Read CPU from cpu.stat (usage_usec)
            let cpu_stat_path = cgroup_dir.join("cpu.stat");
            let mut cpu_usec = None;
            if let Ok(stat_text) = tokio::fs::read_to_string(&cpu_stat_path).await {
                for line in stat_text.lines() {
                    if line.starts_with("usage_usec ") {
                        cpu_usec = line.split_whitespace().nth(1).and_then(|v| v.parse::<u64>().ok());
                        break;
                    }
                }
            }

            let mut cpu_pct = None;
            if let Some(cur_usec) = cpu_usec {
                let now = std::time::Instant::now();
                let mut map = tracker.lock().await;
                if let Some((prev_time, prev_usec)) = map.get(full_id) {
                    let elapsed = now.duration_since(*prev_time).as_micros() as f64;
                    if elapsed >= 300_000.0 {
                        let delta_usec = cur_usec.saturating_sub(*prev_usec) as f64;
                        let pct = (delta_usec / elapsed) * 100.0;
                        cpu_pct = Some((pct.clamp(0.0, 6400.0) * 10.0).round() / 10.0);
                        map.insert(full_id.to_string(), (now, cur_usec));
                    }
                } else {
                    map.insert(full_id.to_string(), (now, cur_usec));
                }
            }

            if ram_bytes.is_some() || cpu_pct.is_some() {
                return (cpu_pct, ram_bytes);
            }
        }
    }

    // 2. Fallback to Docker socket HTTP API if cgroup not directly mounted
    query_single_container_stats(sock_path, full_id).await
}

async fn query_single_container_stats(sock_path: &Path, id: &str) -> (Option<f64>, Option<u64>) {
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::UnixStream;

    let Ok(mut stream) = UnixStream::connect(sock_path).await else {
        return (None, None);
    };

    let request = format!(
        "GET /containers/{}/stats?stream=false HTTP/1.0\r\nHost: docker\r\nConnection: close\r\n\r\n",
        id
    );
    if stream.write_all(request.as_bytes()).await.is_err() {
        return (None, None);
    }

    let mut response_bytes = Vec::new();
    if stream.read_to_end(&mut response_bytes).await.is_err() {
        return (None, None);
    }

    let mut body_start = 0;
    for i in 0..response_bytes.len().saturating_sub(3) {
        if &response_bytes[i..i + 4] == b"\r\n\r\n" {
            body_start = i + 4;
            break;
        }
    }
    if body_start == 0 || body_start >= response_bytes.len() {
        return (None, None);
    }

    let body = &response_bytes[body_start..];

    #[derive(Deserialize)]
    struct RawStats {
        cpu_stats: Option<RawCpuStats>,
        precpu_stats: Option<RawCpuStats>,
        memory_stats: Option<RawMemStats>,
    }
    #[derive(Deserialize)]
    struct RawCpuStats {
        cpu_usage: Option<RawCpuUsage>,
        system_cpu_usage: Option<u64>,
        online_cpus: Option<u32>,
    }
    #[derive(Deserialize)]
    struct RawCpuUsage {
        total_usage: Option<u64>,
    }
    #[derive(Deserialize)]
    struct RawMemStats {
        usage: Option<u64>,
        stats: Option<RawMemInnerStats>,
    }
    #[derive(Deserialize)]
    struct RawMemInnerStats {
        cache: Option<u64>,
        inactive_file: Option<u64>,
    }

    let Ok(stats): Result<RawStats, _> = serde_json::from_slice(body) else {
        return (None, None);
    };

    // 1. Calculate CPU Percent
    let cpu_percent = (|| {
        let cur_cpu = stats.cpu_stats.as_ref()?;
        let pre_cpu = stats.precpu_stats.as_ref()?;
        let cur_total = cur_cpu.cpu_usage.as_ref()?.total_usage?;
        let pre_total = pre_cpu.cpu_usage.as_ref()?.total_usage?;
        let cur_sys = cur_cpu.system_cpu_usage?;
        let pre_sys = pre_cpu.system_cpu_usage?;

        let cpu_delta = cur_total.saturating_sub(pre_total);
        let sys_delta = cur_sys.saturating_sub(pre_sys);
        let cpus = cur_cpu.online_cpus.unwrap_or(1).max(1);

        if sys_delta > 0 && cpu_delta > 0 {
            let pct = (cpu_delta as f64 / sys_delta as f64) * (cpus as f64) * 100.0;
            Some((pct.clamp(0.0, 100.0 * cpus as f64) * 10.0).round() / 10.0)
        } else {
            Some(0.0)
        }
    })();

    // 2. Calculate RAM Used Bytes
    let ram_used = (|| {
        let mem = stats.memory_stats.as_ref()?;
        let usage = mem.usage?;
        let cache = mem.stats.as_ref().and_then(|s| s.inactive_file.or(s.cache)).unwrap_or(0);
        Some(usage.saturating_sub(cache))
    })();

    (cpu_percent, ram_used)
}
