use serde::{Deserialize, Serialize};
use std::{
    cmp::Ordering,
    collections::HashMap,
    fs,
    io,
    path::Path,
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};

#[derive(Clone, Copy, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum Sort {
    #[default]
    Cpu,
    Ram,
    User,
}

#[derive(Deserialize)]
pub struct ProcessQuery {
    #[serde(default)]
    pub sort: Sort,
    #[serde(default = "default_descending")]
    pub descending: bool,
}

fn default_descending() -> bool { true }

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessInfo {
    pid: u32,
    name: String,
    user: String,
    cpu_percent: Option<f64>,
    ram_used_bytes: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessResponse {
    processes: Vec<ProcessInfo>,
    total: usize,
    skipped_processes: usize,
    updated_at: u64,
}

struct Sample {
    processes: Vec<ProcessInfo>,
    skipped: usize,
    updated_at: u64,
    collected_at: Instant,
}

#[derive(Default)]
pub struct ProcessCollector {
    sample: Option<Sample>,
    previous_total: Option<u64>,
    previous_processes: HashMap<u32, (u64, u64)>, // pid -> (start time, CPU ticks)
}

struct Stat {
    name: String,
    ticks: u64,
    start: u64,
    rss_pages: u64,
}

// The comm field may itself contain spaces and parentheses; the final ')' ends it.
fn parse_stat(content: &str) -> Option<Stat> {
    let open = content.find('(')?;
    let close = content.rfind(')')?;
    if close <= open { return None; }
    let mut fields = content.get(close + 1..)?.split_whitespace();
    // Fields after comm begin at field 3 (state).
    let utime = fields.nth(11)?.parse::<u64>().ok()?; // field 14
    let stime = fields.next()?.parse::<u64>().ok()?;
    let start = fields.nth(6)?.parse::<u64>().ok()?; // field 22
    let _vsize = fields.next()?;
    let rss = fields.next()?.parse::<i64>().ok()?;
    Some(Stat {
        name: content[open + 1..close].to_owned(),
        ticks: utime.checked_add(stime)?,
        start,
        rss_pages: rss.max(0) as u64,
    })
}

fn total_cpu(proc_dir: &Path) -> io::Result<u64> {
    let content = fs::read_to_string(proc_dir.join("stat"))?;
    let line = content.lines().next().ok_or_else(|| io::Error::new(io::ErrorKind::InvalidData, "missing CPU statistics"))?;
    let mut fields = line.split_whitespace();
    if fields.next() != Some("cpu") {
        return Err(io::Error::new(io::ErrorKind::InvalidData, "invalid CPU statistics"));
    }
    // Exclude guest and guest_nice, which are already included in user and nice.
    let mut total = 0u64;
    let mut count = 0;
    for field in fields.take(8) {
        let value = field.parse::<u64>().map_err(|_| io::Error::new(io::ErrorKind::InvalidData, "invalid CPU counter"))?;
        total = total.checked_add(value).ok_or_else(|| io::Error::new(io::ErrorKind::InvalidData, "CPU counter overflow"))?;
        count += 1;
    }
    if count < 4 { return Err(io::Error::new(io::ErrorKind::InvalidData, "incomplete CPU statistics")); }
    Ok(total)
}

fn process_cpu(previous: Option<&(u64, u64)>, start: u64, ticks: u64, total_delta: Option<u64>) -> Option<f64> {
    let &(previous_start, previous_ticks) = previous?;
    if previous_start != start { return None; }
    Some((ticks.checked_sub(previous_ticks)? as f64 / total_delta? as f64 * 100.0).clamp(0.0, 100.0))
}

fn users(root_dir: &Path) -> HashMap<u32, String> {
    let mut users = HashMap::new();
    if let Ok(passwd) = fs::read_to_string(root_dir.join("etc/passwd")) {
        for line in passwd.lines() {
            let mut fields = line.split(':');
            if let (Some(name), Some(_), Some(uid)) = (fields.next(), fields.next(), fields.next()) {
                if let Ok(uid) = uid.parse() {
                    users.entry(uid).or_insert_with(|| name.to_owned());
                }
            }
        }
    }
    users
}

fn process_uid(status: &str) -> Option<u32> {
    status.lines().find_map(|line| line.strip_prefix("Uid:")?.split_whitespace().next()?.parse().ok())
}

impl ProcessCollector {
    pub fn response(&mut self, proc_dir: &Path, root_dir: &Path, query: ProcessQuery) -> io::Result<ProcessResponse> {
        if self.sample.as_ref().map_or(true, |sample| sample.collected_at.elapsed() >= Duration::from_secs(5)) {
            self.collect(proc_dir, root_dir)?;
        }
        let sample = self.sample.as_ref().expect("sample just collected");
        let mut sorted: Vec<&ProcessInfo> = sample.processes.iter().collect();
        sorted.sort_unstable_by(|a, b| {
            let order = match query.sort {
                Sort::Cpu => match (a.cpu_percent, b.cpu_percent) {
                    (None, None) => Ordering::Equal,
                    (None, Some(_)) => return Ordering::Greater,
                    (Some(_), None) => return Ordering::Less,
                    (Some(a), Some(b)) => a.total_cmp(&b),
                },
                Sort::Ram => a.ram_used_bytes.cmp(&b.ram_used_bytes),
                Sort::User => a.user.cmp(&b.user),
            };
            (if query.descending { order.reverse() } else { order }).then_with(|| a.pid.cmp(&b.pid))
        });
        Ok(ProcessResponse {
            processes: sorted.into_iter().take(20).cloned().collect(),
            total: sample.processes.len(),
            skipped_processes: sample.skipped,
            updated_at: sample.updated_at,
        })
    }

    fn collect(&mut self, proc_dir: &Path, root_dir: &Path) -> io::Result<()> {
        let entries = fs::read_dir(proc_dir)?;
        let total = total_cpu(proc_dir)?;
        let cpu_delta = self.previous_total.and_then(|previous| total.checked_sub(previous)).filter(|delta| *delta > 0);
        let users = users(root_dir);
        // sysconf is process-local and does not access the host filesystem.
        let page_size = unsafe { libc::sysconf(libc::_SC_PAGESIZE) };
        if page_size <= 0 { return Err(io::Error::new(io::ErrorKind::Other, "cannot determine page size")); }
        let mut processes = Vec::new();
        let mut current = HashMap::new();
        let mut skipped = 0;
        for entry in entries {
            let entry = entry?;
            let filename = entry.file_name();
            let Some(pid) = filename.to_str().and_then(|name| name.parse::<u32>().ok()) else { continue };
            let path = entry.path();
            let parsed = (|| {
                let stat = parse_stat(&fs::read_to_string(path.join("stat")).ok()?)?;
                let uid = process_uid(&fs::read_to_string(path.join("status")).ok()?)?;
                Some((stat, uid))
            })();
            let Some((stat, uid)) = parsed else { skipped += 1; continue };
            let cpu_percent = process_cpu(self.previous_processes.get(&pid), stat.start, stat.ticks, cpu_delta);
            current.insert(pid, (stat.start, stat.ticks));
            processes.push(ProcessInfo {
                pid, name: stat.name,
                user: users.get(&uid).cloned().unwrap_or_else(|| uid.to_string()),
                cpu_percent,
                ram_used_bytes: stat.rss_pages.saturating_mul(page_size as u64),
            });
        }
        self.previous_total = Some(total);
        self.previous_processes = current;
        self.sample = Some(Sample {
            processes, skipped,
            updated_at: SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis() as u64,
            collected_at: Instant::now(),
        });
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_stat_with_spaces_and_parentheses() {
        let stat = parse_stat("42 (a (worker) name) S 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21").unwrap();
        assert_eq!(stat.name, "a (worker) name");
        assert_eq!(stat.ticks, 23);
        assert_eq!(stat.start, 19);
        assert_eq!(stat.rss_pages, 21);
    }

    #[test]
    fn rejects_reused_pid_and_counter_reset() {
        assert_eq!(process_cpu(Some(&(10, 100)), 11, 150, Some(200)), None);
        assert_eq!(process_cpu(Some(&(10, 100)), 10, 99, Some(200)), None);
        assert_eq!(process_cpu(Some(&(10, 100)), 10, 150, Some(200)), Some(25.0));
    }

    fn collector() -> ProcessCollector {
        let processes = (0..25).map(|pid| ProcessInfo {
            pid, name: pid.to_string(),
            user: if pid == 24 { "zzz".into() } else { "aaa".into() },
            cpu_percent: if pid == 0 { None } else { Some(pid as f64) },
            ram_used_bytes: pid as u64,
        }).collect();
        ProcessCollector {
            sample: Some(Sample { processes, skipped: 2, updated_at: 42, collected_at: Instant::now() }),
            ..Default::default()
        }
    }

    #[test]
    fn sorts_before_limiting_and_keeps_null_cpu_last() {
        let mut collector = collector();
        let get = |collector: &mut ProcessCollector, sort, descending| {
            collector.response(Path::new(""), Path::new(""), ProcessQuery { sort, descending }).unwrap()
        };
        let ram = get(&mut collector, Sort::Ram, true);
        assert_eq!(ram.total, 25);
        assert_eq!(ram.processes[0].pid, 24);
        assert_eq!(ram.processes.len(), 20);
        let user = get(&mut collector, Sort::User, true);
        assert_eq!(user.processes[0].pid, 24);
        assert_eq!(user.processes[1].pid, 0);
        for descending in [false, true] {
            let cpu = get(&mut collector, Sort::Cpu, descending);
            assert!(!cpu.processes.iter().any(|p| p.pid == 0));
        }
    }
}
