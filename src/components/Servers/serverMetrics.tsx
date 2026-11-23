import React from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ServerConfig, ServerProbeOutcome, ServerSnapshot, TrustPrompt } from '../../types';

export const REFRESH_INTERVAL_MS = 1_000;
export const GB = 1024 ** 3;
export const MAX_HISTORY_POINTS = 30;

export const DEMO_SNAPSHOT: Omit<ServerSnapshot, 'serverId' | 'updatedAt'> = {
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

// Module-level shared caches so ServersTab and FloatingServerCard stay in sync
export const globalSnapshotCache: Record<string, ServerSnapshot> = {};
export const globalErrorCache: Record<string, string> = {};
export const globalTrustCache: Record<string, TrustPrompt> = {};
export const globalHistoryCache: Record<string, { cpu: number[]; ram: number[] }> = {};

export const formatBytes = (bytes: number): string => {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 10 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
};

export const formatUptime = (seconds: number): string => {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

export const pushServerHistory = (serverId: string, snap: ServerSnapshot) => {
  const prevHist = globalHistoryCache[serverId] ?? { cpu: [], ram: [] };
  const ramPct =
    snap.ramTotalBytes > 0
      ? Math.min(100, Math.max(0, (snap.ramUsedBytes / snap.ramTotalBytes) * 100))
      : 0;
  globalHistoryCache[serverId] = {
    cpu: [...prevHist.cpu, snap.cpuPercent].slice(-MAX_HISTORY_POINTS),
    ram: [...prevHist.ram, ramPct].slice(-MAX_HISTORY_POINTS),
  };
};

export const probeSingleServer = async (
  server: ServerConfig,
  secret: string | undefined,
  isTauri: boolean
): Promise<ServerProbeOutcome> => {
  if (!isTauri) {
    const jitter = (Math.random() - 0.5) * 6;
    const snap: ServerSnapshot = {
      ...DEMO_SNAPSHOT,
      serverId: server.id,
      hostname: server.name,
      cpuPercent: Math.max(1, Math.min(99, DEMO_SNAPSHOT.cpuPercent + jitter)),
      updatedAt: Date.now(),
    };
    return { status: 'ok', snapshot: snap };
  }

  return invoke<ServerProbeOutcome>('server_probe', {
    serverId: server.id,
    password: secret || null,
  });
};

interface MiniSparklineProps {
  data: number[];
  color?: string;
  height?: number;
}

export const MiniSparkline: React.FC<MiniSparklineProps> = ({
  data,
  color = '#38bdf8',
  height = 20,
}) => {
  const uniqueId = React.useId().replace(/:/g, '');
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
    const y = h - padY - ((clamped - minVal) / (maxVal - minVal)) * (h - padY * 2);
    return { x: Number(x.toFixed(1)), y: Number(y.toFixed(1)) };
  });

  const polylineStr = coords.map((pt) => `${pt.x},${pt.y}`).join(' ');
  const lastPt = coords[coords.length - 1];
  const areaPath = `M ${coords[0].x},${h} L ${coords
    .map((pt) => `${pt.x},${pt.y}`)
    .join(' L ')} L ${lastPt.x},${h} Z`;
  const gradId = `spark-grad-${uniqueId}`;

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

export type IconComponent = React.ComponentType<{ size?: number; className?: string }>;

export interface MetricCardProps {
  icon: IconComponent;
  label: string;
  value: string;
  detail: string;
  percent: number;
  showPercent?: boolean;
  history?: number[];
  accentColor?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
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
            <span className="text-[9px] tabular-nums text-neutral-400">
              {Math.round(percent)}%
            </span>
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
