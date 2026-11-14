import React, { useCallback, useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ServerSquareIcon } from '@solar-icons/react/bold/server-square';
import { AddCircleIcon } from '@solar-icons/react/bold/add-circle';
import { RefreshIcon } from '@solar-icons/react/bold/refresh';
import { PenIcon } from '@solar-icons/react/bold/pen';
import { TrashBinTrashIcon } from '@solar-icons/react/bold/trash-bin-trash';
import { CpuIcon } from '@solar-icons/react/bold/cpu';
import { DatabaseIcon } from '@solar-icons/react/bold/database';
import { SsdSquareIcon } from '@solar-icons/react/bold/ssd-square';
import { BoxIcon } from '@solar-icons/react/bold/box';
import { CloseCircleIcon } from '@solar-icons/react/bold/close-circle';
import { useIsland } from '../../context/IslandContext';
import { AppsActivity } from './AppsActivity';
import {
  ServerAuthType,
  ServerConfig,
  ServerProbeOutcome,
  ServerSnapshot,
  TrustPrompt,
} from '../../types';

const REFRESH_INTERVAL_MS = 1_000;
const GB = 1024 ** 3;

const DEMO_SNAPSHOT: Omit<ServerSnapshot, 'serverId' | 'updatedAt'> = {
  hostname: 'web-01',
  cpuPercent: 23.4,
  cpuCount: 4,
  ramUsedBytes: 3.2 * GB,
  ramTotalBytes: 8 * GB,
  diskUsedBytes: 42 * GB,
  diskTotalBytes: 80 * GB,
  uptimeSeconds: 12 * 86400 + 3 * 3600 + 120,
  dockerAvailable: true,
  docker: [
    {
      id: '3f9a1c2b7d',
      name: 'nginx-proxy',
      image: 'nginx:1.27-alpine',
      state: 'running',
      status: 'Up 12 days',
      cpuPercent: 0.4,
      ramUsedBytes: 28 * 1024 * 1024,
    },
    {
      id: '8b21e4c9a0',
      name: 'postgres-1',
      image: 'postgres:16',
      state: 'running',
      status: 'Up 12 days (healthy)',
      cpuPercent: 1.8,
      ramUsedBytes: 210 * 1024 * 1024,
    },
    {
      id: 'c4d8f0a1b2',
      name: 'worker',
      image: 'ghcr.io/acme/worker:2.4.1',
      state: 'exited',
      status: 'Exited (0) 2 hours ago',
      cpuPercent: 0,
      ramUsedBytes: 0,
    },
  ],
  latencyMs: 42,
};

// Module-level persistent cache: keeps last-known metrics alive across tab switches
// so opening the Servers tab displays immediately without waiting for round-trips!
const globalSnapshotCache: Record<string, ServerSnapshot> = {};
const globalErrorCache: Record<string, string> = {};
const globalTrustCache: Record<string, TrustPrompt> = {};
const MAX_HISTORY_POINTS = 30;
const globalHistoryCache: Record<string, { cpu: number[]; ram: number[] }> = {};

interface MiniSparklineProps {
  data: number[];
  color?: string;
  height?: number;
}

const MiniSparkline: React.FC<MiniSparklineProps> = ({
  data,
  color = '#38bdf8',
  height = 20,
}) => {
  if (!data || data.length < 2) {
    return (
      <div style={{ height }} className="flex items-center justify-center opacity-25">
        <div className="h-px w-full border-b border-dashed border-white/20" />
      </div>
    );
  }

  const w = 100;
  const h = height;
  const padY = 2;
  const maxVal = 100;
  const minVal = 0;

  const step = w / Math.max(data.length - 1, 1);
  const coords = data.map((val, idx) => {
    const clamped = Math.max(minVal, Math.min(maxVal, val));
    const x = idx * step;
    const y = (h - padY) - ((clamped - minVal) / (maxVal - minVal)) * (h - padY * 2);
    return { x: Number(x.toFixed(1)), y: Number(y.toFixed(1)) };
  });

  const polylineStr = coords.map((pt) => `${pt.x},${pt.y}`).join(' ');
  const lastPt = coords[coords.length - 1];
  const areaPath = `M ${coords[0].x},${h} L ${coords.map((pt) => `${pt.x},${pt.y}`).join(' L ')} L ${lastPt.x},${h} Z`;
  const gradId = `spark-grad-${color.replace('#', '')}`;

  return (
    <div className="relative w-full overflow-hidden" style={{ height }}>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        className="h-full w-full overflow-visible"
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#${gradId})`} />
        <polyline
          points={polylineStr}
          fill="none"
          stroke={color}
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx={lastPt.x} cy={lastPt.y} r="1.8" fill={color} />
      </svg>
    </div>
  );
};
type IconComponent = React.ComponentType<{ size?: number; className?: string }>;
const formatBytes = (bytes: number): string => {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 10 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
};

const formatUptime = (seconds: number): string => {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

interface MetricCardProps {
  icon: IconComponent;
  label: string;
  value: string;
  detail: string;
  percent: number;
  showPercent?: boolean;
  history?: number[];
  accentColor?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({
  icon: Icon,
  label,
  value,
  detail,
  percent,
  showPercent = true,
  history,
  accentColor,
}) => {
  const color =
    accentColor ?? (percent >= 90 ? '#ef4444' : percent >= 70 ? '#f59e0b' : '#10b981');

  return (
    <div className="flex flex-col justify-between rounded-xl bg-white/[0.03] p-2 overflow-hidden">
      <div>
        <div className="flex items-center gap-1 text-[8.5px] font-semibold uppercase tracking-wide text-neutral-400">
          <Icon size={10} />
          {label}
        </div>
        <div className="mt-0.5 flex items-baseline justify-between gap-1">
          <span className="text-[13px] font-bold tabular-nums leading-none">{value}</span>
          {showPercent && (
            <span className="text-[9px] tabular-nums text-neutral-400">{Math.round(percent)}%</span>
          )}
        </div>
      </div>

      {history && history.length > 0 ? (
        <div className="my-1">
          <MiniSparkline data={history} color={color} height={18} />
        </div>
      ) : (
        <div className="my-1.5 h-1 overflow-hidden rounded-full bg-neutral-800">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              percent >= 90 ? 'bg-red-500' : percent >= 70 ? 'bg-amber-400' : 'bg-emerald-500'
            }`}
            style={{ width: `${percent}%` }}
          />
        </div>
      )}

      <p className="truncate text-[8px] text-neutral-500">{detail}</p>
    </div>
  );
};

interface ServerFormValues {
  name: string;
  host: string;
  port: number;
  username: string;
  authType: ServerAuthType;
  keyPath: string;
  secret: string;
  remember: boolean;
}

interface ServerFormProps {
  initial: ServerConfig | null;
  isTauri: boolean;
  onCancel: () => void;
  onSave: (values: ServerFormValues) => Promise<string | null>;
}

const inputClass =
  'w-full rounded-lg bg-neutral-900 px-2 py-1.5 text-[11px] text-white placeholder-neutral-600 outline-none transition-colors focus:bg-neutral-800';

const ServerForm: React.FC<ServerFormProps> = ({ initial, isTauri, onCancel, onSave }) => {
  const [values, setValues] = useState<ServerFormValues>(() => ({
    name: initial?.name ?? '',
    host: initial?.host ?? '',
    port: initial?.port ?? (initial?.authType === 'bridge' ? 8765 : 22),
    username: initial?.username ?? '',
    authType: initial?.authType ?? 'bridge',
    keyPath: initial?.keyPath ?? '',
    secret: '',
    remember: initial?.rememberCredential ?? true,
  }));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const patch = (next: Partial<ServerFormValues>) => setValues((prev) => ({ ...prev, ...next }));

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!values.host.trim()) {
      setError('Host / IP server wajib diisi');
      return;
    }
    if (values.authType !== 'bridge' && !values.username.trim()) {
      setError('Username wajib diisi untuk SSH');
      return;
    }
    if (values.authType === 'key' && !values.keyPath.trim()) {
      setError('Path SSH key wajib diisi');
      return;
    }
    if (!initial && values.authType === 'password' && !values.secret) {
      setError('Password wajib diisi untuk autentikasi password');
      return;
    }
    setSaving(true);
    setError(null);
    const failure = await onSave(values);
    if (failure) {
      setError(failure);
      setSaving(false);
    }
  };

  return (
    <div className="absolute inset-0 z-30 flex flex-col rounded-[32px] bg-[#0b0c10]/95 p-4 text-white">
      <div className="flex shrink-0 items-center justify-between pb-2">
        <p className="text-[12px] font-semibold">
          {initial ? 'Edit Server' : 'Tambah Server'}
        </p>
        <button
          type="button"
          onClick={onCancel}
          title="Tutup"
          className="flex h-6 w-6 items-center justify-center rounded-full text-white/40 transition-colors hover:bg-white/10 hover:text-white"
        >
          <CloseCircleIcon size={16} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-0.5">
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-0.5">
            <span className="text-[9px] font-medium uppercase tracking-wide text-neutral-500">Nama</span>
            <input
              value={values.name}
              onChange={(e) => patch({ name: e.target.value })}
              placeholder="web-01"
              className={inputClass}
            />
          </label>
          <label className="space-y-0.5">
            <span className="text-[9px] font-medium uppercase tracking-wide text-neutral-500">Host / IP</span>
            <input
              value={values.host}
              onChange={(e) => patch({ host: e.target.value })}
              placeholder="192.168.1.10"
              className={inputClass}
              autoFocus
            />
          </label>
        </div>

        <div className="space-y-1">
          <span className="text-[9px] font-medium uppercase tracking-wide text-neutral-500">Metode Koneksi</span>
          <div className="grid grid-cols-3 gap-1.5">
            {(
              [
                { id: 'bridge', label: 'Bridge Agent' },
                { id: 'password', label: 'SSH Password' },
                { id: 'key', label: 'SSH Key' },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  patch({
                    authType: item.id,
                    port:
                      item.id === 'bridge'
                        ? values.port === 22
                          ? 8765
                          : values.port
                        : values.port === 8765
                        ? 22
                        : values.port,
                  });
                }}
                className={`rounded-lg py-1.5 text-[10px] font-medium transition-colors ${
                  values.authType === item.id
                    ? 'bg-sky-500 text-white'
                    : 'bg-white/[0.04] text-neutral-400 hover:bg-white/[0.08] hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {values.authType === 'bridge' && (
          <div className="rounded-lg bg-sky-500/10 border border-sky-500/20 px-2.5 py-1.5 text-[9.5px] leading-relaxed text-sky-300">
            Membaca metrik instan (&lt;10ms) dari container <code className="font-mono bg-sky-500/20 px-1 rounded text-white">di-server-bridge</code> pada server Anda.
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-0.5">
            <span className="text-[9px] font-medium uppercase tracking-wide text-neutral-500">Port</span>
            <input
              type="number"
              min={1}
              max={65535}
              value={values.port}
              onChange={(e) => patch({ port: Number(e.target.value) || (values.authType === 'bridge' ? 8765 : 22) })}
              className={inputClass}
            />
          </label>
          <label className="space-y-0.5">
            <span className="text-[9px] font-medium uppercase tracking-wide text-neutral-500">
              {values.authType === 'bridge' ? 'Username (opsional)' : 'Username'}
            </span>
            <input
              value={values.username}
              onChange={(e) => patch({ username: e.target.value })}
              placeholder={values.authType === 'bridge' ? 'bridge' : 'deploy'}
              className={inputClass}
            />
          </label>
        </div>

        <div className={values.authType === 'key' ? 'grid grid-cols-[1.3fr_1fr] gap-2' : ''}>
          {values.authType === 'key' && (
            <label className="space-y-0.5">
              <span className="text-[9px] font-medium uppercase tracking-wide text-neutral-500">Path SSH key</span>
              <input
                value={values.keyPath}
                onChange={(e) => patch({ keyPath: e.target.value })}
                placeholder="~/.ssh/id_ed25519"
                className={inputClass}
              />
            </label>
          )}

          <label className="space-y-0.5">
            <span className="text-[9px] font-medium uppercase tracking-wide text-neutral-500">
              {values.authType === 'bridge'
                ? 'Bridge Token (BRIDGE_TOKEN)'
                : values.authType === 'key'
                ? 'Passphrase (opsional)'
                : 'Password'}
            </span>
            <input
              type={values.authType === 'bridge' ? 'text' : 'password'}
              value={values.secret}
              onChange={(e) => patch({ secret: e.target.value })}
              placeholder={
                values.authType === 'bridge'
                  ? 'Masukkan BRIDGE_TOKEN (kosongkan jika tanpa token)'
                  : initial
                  ? 'Kosongkan untuk mempertahankan…'
                  : ''
              }
              className={inputClass}
            />
          </label>
        </div>
        </div>

        {error && <p className="shrink-0 pt-1 text-[10px] leading-snug text-red-400">{error}</p>}

        <div className="flex shrink-0 items-center gap-2 pt-2">
          <label
            className={`mr-auto flex items-center gap-1.5 text-[9px] ${isTauri ? 'text-neutral-300' : 'text-neutral-500'}`}
            title={isTauri ? 'Disimpan terenkripsi oleh Windows Credential Manager' : 'Hanya tersedia di aplikasi Windows'}
          >
            <input
              type="checkbox"
              checked={values.remember}
              disabled={!isTauri}
              onChange={(e) => patch({ remember: e.target.checked })}
              className="h-3 w-3 accent-sky-500"
            />
            Simpan secret
          </label>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg bg-white/[0.05] px-3 py-1.5 text-[10.5px] text-neutral-300 transition-colors hover:bg-white/[0.09] hover:text-white"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-sky-500 px-3 py-1.5 text-[10.5px] font-semibold text-white transition-colors hover:bg-sky-400 disabled:opacity-50"
          >
            {saving ? 'Menyimpan…' : 'Simpan'}
          </button>
        </div>
      </form>
    </div>
  );
};

export const ServersTab: React.FC = () => {
  const {
    servers,
    serversLoading,
    upsertServer,
    deleteServer,
    serverSecrets,
    setServerSecret,
    clearServerSecret,
  } = useIsland();
  const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

  const [selectedId, setSelectedId] = useState<string | null>(servers[0]?.id ?? null);
  const [snapshots, setSnapshots] = useState<Record<string, ServerSnapshot>>(() => ({
    ...globalSnapshotCache,
  }));
  const [errors, setErrors] = useState<Record<string, string>>(() => ({
    ...globalErrorCache,
  }));
  const [trustPrompts, setTrustPrompts] = useState<Record<string, TrustPrompt>>(() => ({
    ...globalTrustCache,
  }));
  const [history, setHistory] = useState<Record<string, { cpu: number[]; ram: number[] }>>(() => ({
    ...globalHistoryCache,
  }));
  const [loading, setLoading] = useState(() => Object.keys(globalSnapshotCache).length === 0);
  const [formState, setFormState] = useState<{ mode: 'new' } | { mode: 'edit'; server: ServerConfig } | null>(
    null
  );
  const [refreshToken, setRefreshToken] = useState(0);
  const [detailView, setDetailView] = useState<'docker' | 'processes'>('docker');
  const serversRef = useRef(servers);
  serversRef.current = servers;
  const secretsRef = useRef(serverSecrets);
  secretsRef.current = serverSecrets;
  const inFlight = useRef(false);

  const probeAll = useCallback(async (isManual = false) => {
    const list = serversRef.current;
    if (!list.length || inFlight.current) return;

    if (!isTauri) {
      const now = Date.now();
      const demoCpu = 16 + Math.round(Math.sin(now / 1500) * 10 + Math.random() * 6);
      const demoRamPct = 40 + Math.round(Math.cos(now / 2500) * 4);
      setSnapshots((prev) => {
        const next = { ...prev };
        for (const server of list) {
          next[server.id] = {
            ...DEMO_SNAPSHOT,
            serverId: server.id,
            cpuPercent: Math.max(5, Math.min(95, demoCpu)),
            updatedAt: now,
          };
        }
        return next;
      });
      setHistory((prev) => {
        const next = { ...prev };
        for (const server of list) {
          const curr = next[server.id] ?? {
            cpu: [14, 16, 18, 15, 20, 22, 26, 23, 21, 25, 28, 24, 20, 18, 22, 25, 24, 21, 19, 23],
            ram: [39, 39, 40, 40, 41, 41, 42, 42, 41, 41, 40, 40, 41, 42, 41, 41, 42, 41, 40, 40],
          };
          const updated = {
            cpu: [...curr.cpu.slice(-MAX_HISTORY_POINTS + 1), demoCpu],
            ram: [...curr.ram.slice(-MAX_HISTORY_POINTS + 1), demoRamPct],
          };
          next[server.id] = updated;
          globalHistoryCache[server.id] = updated;
        }
        return next;
      });
      setErrors({});
      setTrustPrompts({});
      return;
    }

    inFlight.current = true;
    if (isManual || Object.keys(globalSnapshotCache).length === 0) {
      setLoading(true);
    }
    try {
      await Promise.all(
        list.map(async (server) => {
          const outcome = await invoke<ServerProbeOutcome>('server_probe', {
            serverId: server.id,
            password: secretsRef.current[server.id],
          });
          if (outcome.status === 'ok') {
            globalSnapshotCache[server.id] = outcome.snapshot;
            delete globalErrorCache[server.id];
            delete globalTrustCache[server.id];

            const ramPct =
              outcome.snapshot.ramTotalBytes > 0
                ? (outcome.snapshot.ramUsedBytes / outcome.snapshot.ramTotalBytes) * 100
                : 0;

            setHistory((prev) => {
              const curr = prev[server.id] ?? { cpu: [], ram: [] };
              const nextEntry = {
                cpu: [...curr.cpu.slice(-MAX_HISTORY_POINTS + 1), outcome.snapshot.cpuPercent],
                ram: [...curr.ram.slice(-MAX_HISTORY_POINTS + 1), ramPct],
              };
              globalHistoryCache[server.id] = nextEntry;
              return { ...prev, [server.id]: nextEntry };
            });

            setSnapshots((prev) => ({ ...prev, [server.id]: outcome.snapshot }));
            setErrors((prev) => {
              if (!(server.id in prev)) return prev;
              const next = { ...prev };
              delete next[server.id];
              return next;
            });
            setTrustPrompts((prev) => {
              if (!(server.id in prev)) return prev;
              const next = { ...prev };
              delete next[server.id];
              return next;
            });
          } else if (outcome.status === 'needsTrust') {
            globalTrustCache[server.id] = {
              fingerprint: outcome.fingerprint,
              keyType: outcome.keyType,
              host: outcome.host,
              port: outcome.port,
            };
            delete globalErrorCache[server.id];
            setTrustPrompts((prev) => ({
              ...prev,
              [server.id]: {
                fingerprint: outcome.fingerprint,
                keyType: outcome.keyType,
                host: outcome.host,
                port: outcome.port,
              },
            }));
            setErrors((prev) => {
              if (!(server.id in prev)) return prev;
              const next = { ...prev };
              delete next[server.id];
              return next;
            });
          } else {
            globalErrorCache[server.id] = outcome.message;
            setErrors((prev) => ({ ...prev, [server.id]: outcome.message }));
          }
        })
      );
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        ...Object.fromEntries(
          list.map((server) => [server.id, err instanceof Error ? err.message : String(err)])
        ),
      }));
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, [isTauri]);

  useEffect(() => {
    if (!servers.length) return;
    void probeAll(true);
    const timer = window.setInterval(() => {
      if (!document.hidden) {
        void probeAll(false);
      }
    }, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [probeAll, servers.length, refreshToken]);

  useEffect(() => {
    if (selectedId && servers.some((server) => server.id === selectedId)) return;
    setSelectedId(servers[0]?.id ?? null);
  }, [servers, selectedId]);

  const confirmTrust = async (serverId: string, fingerprint: string) => {
    try {
      await invoke('server_confirm_host_key', { serverId, fingerprint });
      setTrustPrompts((prev) => {
        const next = { ...prev };
        delete next[serverId];
        return next;
      });
      setRefreshToken((value) => value + 1);
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        [serverId]: err instanceof Error ? err.message : String(err),
      }));
    }
  };

  const dismissTrust = (serverId: string) => {
    setTrustPrompts((prev) => {
      const next = { ...prev };
      delete next[serverId];
      return next;
    });
    setErrors((prev) => ({ ...prev, [serverId]: 'Host key belum dipercaya.' }));
  };

  const saveServer = async (values: ServerFormValues): Promise<string | null> => {
    const existing = formState?.mode === 'edit' ? formState.server : null;
    const username = values.authType === 'bridge' && !values.username.trim() ? 'bridge' : values.username.trim();
    const host = values.host.trim();
    const keyPath = values.authType === 'key' ? values.keyPath.trim() : undefined;
    const identityChanged =
      existing !== null &&
      (existing.host !== host ||
        existing.port !== values.port ||
        existing.username !== username ||
        existing.authType !== values.authType);

    if (identityChanged && existing.rememberCredential && !values.secret) {
      return values.authType === 'bridge'
        ? 'Host atau port berubah. Masukkan token Bridge baru jika diperlukan.'
        : 'Host, port, username, atau metode auth berubah. Masukkan ulang secret untuk menyimpan credential baru.';
    }
      existing !== null &&
      (existing.host !== host ||
        existing.port !== values.port ||
        existing.username !== username ||
        existing.authType !== values.authType);

    if (identityChanged && existing.rememberCredential && !values.secret) {
      return 'Host, port, username, atau metode auth berubah. Masukkan ulang secret untuk menyimpan credential baru.';
    }

    let result;
    try {
      result = await upsertServer({
        id: existing?.id,
        name: values.name.trim() || host,
        host,
        port: values.port,
        username,
        authType: values.authType,
        keyPath,
        rememberCredential: values.remember,
      });
    } catch (err) {
      return err instanceof Error ? err.message : String(err);
    }

    const serverId = result.server.id;
    if (values.secret) {
      if (values.remember && isTauri) {
        try {
          await invoke('server_credential_save', {
            serverId,
            secret: values.secret,
          });
          clearServerSecret(serverId);
        } catch (err) {
          setFormState({ mode: 'edit', server: result.server });
          return err instanceof Error ? err.message : String(err);
        }
      } else {
        setServerSecret(serverId, values.secret);
      }
    } else if (result.credentialCleared && values.remember) {
      setFormState({ mode: 'edit', server: result.server });
      return 'Credential lama dihapus karena identitas server berubah. Masukkan secret baru.';
    }

    setFormState(null);
    setSelectedId(serverId);
    setRefreshToken((value) => value + 1);
    return null;
  };

  const handleDelete = async (server: ServerConfig) => {
    if (!window.confirm(`Hapus server "${server.name}"?`)) return;
    try {
      await deleteServer(server.id);
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        [server.id]: err instanceof Error ? err.message : String(err),
      }));
    }
  };

  const selected = servers.find((server) => server.id === selectedId) ?? null;
  const snapshot = selected ? snapshots[selected.id] : undefined;
  const error = selected ? errors[selected.id] : undefined;
  const trust = selected ? trustPrompts[selected.id] : undefined;
  const running = snapshot ? snapshot.docker.filter((container) => container.state === 'running').length : 0;

  const ramPercent =
    snapshot && snapshot.ramTotalBytes > 0
      ? Math.min(100, Math.max(0, (snapshot.ramUsedBytes / snapshot.ramTotalBytes) * 100))
      : 0;
  const diskPercent =
    snapshot && snapshot.diskTotalBytes > 0
      ? Math.min(100, Math.max(0, (snapshot.diskUsedBytes / snapshot.diskTotalBytes) * 100))
      : 0;

  return (
    <div className="relative flex h-full w-full gap-3 px-4 pt-3 pb-1 text-white select-none">
      {/* LEFT: server list */}
      <div className="flex w-[158px] shrink-0 flex-col overflow-hidden">
        <div className="flex shrink-0 items-center gap-1.5 pb-2 px-0.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-sky-400">Servers</span>
          <span className="rounded-full bg-neutral-800 px-1.5 py-0.2 text-[9px] font-medium text-neutral-300">
            {servers.length}
          </span>
          <button
            type="button"
            onClick={() => setFormState({ mode: 'new' })}
            title="Tambah server"
            aria-label="Tambah server"
            className="ml-auto flex h-5 w-5 items-center justify-center rounded-full text-sky-400 transition-colors hover:bg-sky-500/15 hover:text-sky-300"
          >
            <AddCircleIcon size={15} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20">
          {serversLoading ? (
            <div className="flex h-full min-h-[90px] flex-col items-center justify-center rounded-2xl bg-white/[0.02] p-2 text-center">
              <RefreshIcon size={16} className="mb-1 animate-spin text-white/25" />
              <p className="text-[9.5px] text-white/45">Memuat server…</p>
            </div>
          ) : servers.length === 0 ? (
            <div className="flex h-full min-h-[90px] flex-col items-center justify-center rounded-2xl bg-white/[0.02] p-2 text-center">
              <ServerSquareIcon size={20} className="mb-1 text-white/25" />
              <p className="text-[10px] font-medium text-white/60">Belum ada server</p>
              <button
                type="button"
                onClick={() => setFormState({ mode: 'new' })}
                className="mt-1.5 rounded-lg bg-sky-500/15 px-2 py-1 text-[9.5px] font-semibold text-sky-300 hover:bg-sky-500/25"
              >
                Tambah server
              </button>
            </div>
          ) : (
            servers.map((server) => {
              const serverSnapshot = snapshots[server.id];
              const serverError = errors[server.id];
              const active = server.id === selectedId;
              return (
                <button
                  key={server.id}
                  type="button"
                  onClick={() => setSelectedId(server.id)}
                  className={`flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left transition-colors ${
                    active ? 'bg-sky-500/15' : 'bg-white/[0.03] hover:bg-white/[0.06]'
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                      serverError ? 'bg-red-500' : serverSnapshot ? 'bg-emerald-400' : 'bg-neutral-600'
                    }`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[10.5px] font-semibold text-white/90">
                      {server.name}
                    </span>
                    <span className="block truncate text-[8.5px] text-neutral-500">
                      {server.authType === 'bridge' ? `bridge:${server.port}` : `${server.username}@${server.host}`}
                    </span>
                  </span>
                  {serverSnapshot && (
                    <span className="shrink-0 text-[9px] tabular-nums text-neutral-400">
                      {Math.round(serverSnapshot.cpuPercent)}%
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Separator */}
      <div className="flex w-2 shrink-0 items-center justify-center self-stretch">
        <div className="h-full w-px bg-white/10" />
      </div>

      {/* RIGHT: selected server metrics */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {selected ? (
          <>
            <div className="flex shrink-0 items-center gap-2 pb-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-semibold text-white/95">{selected.name}</p>
                <p className="truncate text-[8.5px] text-neutral-500">
                  {selected.authType === 'bridge'
                    ? `Bridge Agent · ${selected.host}:${selected.port}`
                    : `${selected.username}@${selected.host}:${selected.port}`}
                  {snapshot ? ` · up ${formatUptime(snapshot.uptimeSeconds)}` : ''}
                  {snapshot ? ` · ${snapshot.latencyMs} ms` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void probeAll(true)}
                title="Refresh semua server"
                aria-label="Refresh semua server"
                className="flex h-6 w-6 items-center justify-center rounded-md text-white/40 transition-colors hover:bg-white/10 hover:text-white"
              >
                <RefreshIcon size={12} className={loading ? 'animate-spin' : undefined} />
              </button>
              <button
                type="button"
                onClick={() => setFormState({ mode: 'edit', server: selected })}
                title="Edit server"
                aria-label="Edit server"
                className="flex h-6 w-6 items-center justify-center rounded-md text-white/40 transition-colors hover:bg-white/10 hover:text-white"
              >
                <PenIcon size={12} />
              </button>
              <button
                type="button"
                onClick={() => handleDelete(selected)}
                title="Hapus server"
                aria-label="Hapus server"
                className="flex h-6 w-6 items-center justify-center rounded-md text-white/40 transition-colors hover:bg-red-500/20 hover:text-red-300"
              >
                <TrashBinTrashIcon size={12} />
              </button>
            </div>

            {trust ? (
              <div className="flex min-h-0 flex-1 flex-col items-center justify-center rounded-2xl bg-amber-500/[0.06] p-4 text-center">
                <p className="text-[10.5px] font-semibold text-amber-300">Host key belum dipercaya</p>
                <p className="mt-1 break-all font-mono text-[9px] leading-snug text-amber-100/80">
                  {trust.fingerprint}
                </p>
                <p className="mt-1 text-[8.5px] text-neutral-400">
                  {trust.keyType} · {trust.host}:{trust.port}
                </p>
                <p className="mt-1 max-w-[330px] text-[8.5px] leading-snug text-neutral-500">
                  Cocokkan fingerprint ini dengan server, misalnya
                  {' '}
                  <span className="font-mono">ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub</span>
                  {' '}sebelum mempercayainya.
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => void confirmTrust(selected.id, trust.fingerprint)}
                    className="rounded-lg bg-amber-500 px-2.5 py-1 text-[9.5px] font-semibold text-neutral-950 hover:bg-amber-400"
                  >
                    Percayai &amp; Hubungkan
                  </button>
                  <button
                    type="button"
                    onClick={() => dismissTrust(selected.id)}
                    className="rounded-lg bg-white/[0.06] px-2.5 py-1 text-[9.5px] text-neutral-300 hover:bg-white/[0.1] hover:text-white"
                  >
                    Batal
                  </button>
                </div>
              </div>
            ) : error ? (
              <div className="flex min-h-0 flex-1 flex-col items-center justify-center rounded-2xl bg-red-500/[0.06] p-4 text-center">
                <p className="text-[10.5px] font-semibold text-red-300">Gagal terhubung</p>
                <p className="mt-1 max-w-[300px] text-[9px] leading-snug text-red-200/70">{error}</p>
                <button
                  type="button"
                  onClick={() => void probeAll()}
                  className="mt-2 rounded-lg bg-red-500/15 px-2.5 py-1 text-[9.5px] font-semibold text-red-200 hover:bg-red-500/25"
                >
                  Coba lagi
                </button>
              </div>
            ) : snapshot ? (
              <>
                <div className="grid shrink-0 grid-cols-3 gap-2">
                  <MetricCard
                    icon={CpuIcon}
                    label="CPU"
                    value={`${Math.round(snapshot.cpuPercent)}%`}
                    detail={`${snapshot.cpuCount} cores`}
                    percent={snapshot.cpuPercent}
                    showPercent={false}
                    history={selected ? history[selected.id]?.cpu : undefined}
                    accentColor="#38bdf8"
                  />
                  <MetricCard
                    icon={DatabaseIcon}
                    label="RAM"
                    value={formatBytes(snapshot.ramUsedBytes)}
                    detail={`of ${formatBytes(snapshot.ramTotalBytes)}`}
                    percent={ramPercent}
                    history={selected ? history[selected.id]?.ram : undefined}
                    accentColor="#a855f7"
                  />
                  <MetricCard
                    icon={SsdSquareIcon}
                    label="Storage"
                    value={formatBytes(snapshot.diskUsedBytes)}
                    detail={`of ${formatBytes(snapshot.diskTotalBytes)}`}
                    percent={diskPercent}
                  />
                </div>

                <div className="mt-2 flex min-h-0 flex-1 flex-col">
                  <div className="flex shrink-0 items-center gap-1.5 pb-1 px-0.5">
                    <button type="button" onClick={() => setDetailView('docker')}
                      aria-pressed={detailView === 'docker'}
                      className={`flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] font-semibold ${detailView === 'docker' ? 'bg-sky-500/15 text-sky-300' : 'text-neutral-500 hover:text-white'}`}>
                      <BoxIcon size={11} /> Docker {running}/{snapshot.docker.length}
                    </button>
                    <button type="button" onClick={() => setDetailView('processes')}
                      aria-pressed={detailView === 'processes'}
                      className={`rounded-md px-1.5 py-1 text-[10px] font-semibold ${detailView === 'processes' ? 'bg-sky-500/15 text-sky-300' : 'text-neutral-500 hover:text-white'}`}>
                      Apps Activity
                    </button>
                  </div>

                  {detailView === 'processes' ? (
                    <AppsActivity key={selected.id} server={selected}
                      password={serverSecrets[selected.id]} active={!formState} />
                  ) : (
                  <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20">
                    {!snapshot.dockerAvailable ? (
                      <p className="rounded-lg bg-white/[0.03] px-2 py-1.5 text-[9.5px] text-neutral-500">
                        Docker tidak tersedia atau tidak dapat diakses.
                      </p>
                    ) : snapshot.docker.length === 0 ? (
                      <p className="rounded-lg bg-white/[0.03] px-2 py-1.5 text-[9.5px] text-neutral-500">
                        Tidak ada container.
                      </p>
                    ) : (
                      snapshot.docker.map((container) => {
                        const hasMetrics =
                          container.state === 'running' &&
                          (container.cpuPercent !== undefined || container.ramUsedBytes !== undefined);

                        return (
                          <div
                            key={container.id}
                            className="flex items-center gap-2 rounded-lg bg-white/[0.03] px-2 py-1.5 transition-colors hover:bg-white/[0.06]"
                            title={`${container.name} (${container.image}) · ${container.status}`}
                          >
                            <span
                              className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                                container.state === 'running'
                                  ? 'bg-emerald-400'
                                  : container.state === 'paused'
                                    ? 'bg-amber-400'
                                    : 'bg-neutral-500'
                              }`}
                            />
                            <span className="min-w-0 flex-1 truncate text-[10px] font-medium text-white/90">
                              {container.name}
                            </span>

                            {hasMetrics ? (
                              <div className="flex shrink-0 items-center gap-1.5 text-[8.5px] tabular-nums">
                                {container.cpuPercent !== undefined && container.cpuPercent !== null && (
                                  <span className="rounded bg-sky-500/10 px-1.5 py-0.5 font-medium text-sky-400">
                                    {container.cpuPercent.toFixed(1)}%
                                  </span>
                                )}
                                {container.ramUsedBytes !== undefined && container.ramUsedBytes !== null && (
                                  <span className="rounded bg-purple-500/10 px-1.5 py-0.5 font-medium text-purple-300">
                                    {formatBytes(container.ramUsedBytes)}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="hidden min-w-0 max-w-[110px] truncate text-[8.5px] text-neutral-500 sm:block">
                                {container.image}
                              </span>
                            )}

                            <span className="shrink-0 text-[8.5px] capitalize text-neutral-500">
                              {container.state}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col items-center justify-center text-center">
                <RefreshIcon size={18} className="mb-1 animate-spin text-white/30" />
                <p className="text-[10px] text-white/50">Menghubungi server…</p>
              </div>
            )}
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center rounded-2xl bg-white/[0.02] text-center">
            <ServerSquareIcon size={26} className="mb-1.5 text-white/20" />
            <p className="text-[11px] font-medium text-white/60">Pilih atau tambahkan server</p>
            <p className="mt-0.5 text-[9px] text-white/35">CPU, RAM, storage, dan Docker dalam satu tampilan</p>
          </div>
        )}
      </div>

      {formState && (
        <ServerForm
          initial={formState.mode === 'edit' ? formState.server : null}
          isTauri={isTauri}
          onCancel={() => setFormState(null)}
          onSave={saveServer}
        />
      )}
    </div>
  );
};