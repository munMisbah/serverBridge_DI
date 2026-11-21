import React, { useCallback, useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { motion, AnimatePresence } from 'framer-motion';
import { CpuIcon } from '@solar-icons/react/bold/cpu';
import { DatabaseIcon } from '@solar-icons/react/bold/database';
import { SsdSquareIcon } from '@solar-icons/react/bold/ssd-square';
import { BoxIcon } from '@solar-icons/react/bold/box';
import { RefreshIcon } from '@solar-icons/react/bold/refresh';
import { ArrowUp, GripHorizontal, Minimize2, Pin, PinOff } from 'lucide-react';
import { useIsland } from '../../context/IslandContext';
import { AppsActivity } from '../Dashboard/AppsActivity';
import {
  formatBytes,
  formatUptime,
  globalErrorCache,
  globalHistoryCache,
  globalSnapshotCache,
  MetricCard,
  probeSingleServer,
  pushServerHistory,
  REFRESH_INTERVAL_MS,
} from './serverMetrics';
import type { ServerSnapshot } from '../../types';

interface NativeFloatingServerWindowProps {
  serverId: string;
}

export const NativeFloatingServerWindow: React.FC<NativeFloatingServerWindowProps> = ({
  serverId,
}) => {
  const { servers, serversLoading, serverSecrets, settings } = useIsland();
  const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
  const server = servers.find((s) => s.id === serverId) ?? null;

  const [snapshot, setSnapshot] = useState<ServerSnapshot | undefined>(
    () => globalSnapshotCache[serverId]
  );
  const [error, setError] = useState<string | undefined>(() => globalErrorCache[serverId]);
  const [needsTrust, setNeedsTrust] = useState(false);
  const [history, setHistory] = useState<{ cpu: number[]; ram: number[] }>(
    () => globalHistoryCache[serverId] ?? { cpu: [], ram: [] }
  );
  const [loading, setLoading] = useState(false);
  const [detailView, setDetailView] = useState<'docker' | 'processes'>('docker');
  const [alwaysOnTop, setAlwaysOnTop] = useState(true);
  const [inDockZone, setInDockZone] = useState(false);

  useEffect(() => {
    if (!isTauri) return;
    let cancelled = false;
    let unlisten: (() => void) | undefined;
    import('@tauri-apps/api/event')
      .then(({ listen }) =>
        listen<{ serverId: string; active: boolean }>('floating-server-dock-zone', (e) => {
          if (e.payload.serverId === serverId) {
            setInDockZone(e.payload.active);
          }
        })
      )
      .then((fn) => {
        if (cancelled) fn();
        else unlisten = fn;
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [isTauri, serverId]);

  const inFlightRef = useRef(false);
  const secretRef = useRef(serverSecrets[serverId]);
  secretRef.current = serverSecrets[serverId];

  const handleDock = useCallback(async () => {
    if (!isTauri) return;
    try {
      await invoke('close_floating_server_window', {
        serverId,
        focusMain: true,
      });
    } catch (err) {
      console.error('Failed to dock floating server window:', err);
    }
  }, [isTauri, serverId]);

  const handleTogglePin = async () => {
    const next = !alwaysOnTop;
    setAlwaysOnTop(next);
    if (!isTauri) return;
    try {
      await invoke('set_floating_server_always_on_top', {
        serverId,
        enabled: next,
      });
    } catch (err) {
      console.error('Failed to toggle always-on-top:', err);
    }
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        void handleDock();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleDock]);

  const poll = useCallback(
    async (showSpinner = false) => {
      if (!server || inFlightRef.current) return;
      inFlightRef.current = true;
      if (showSpinner) setLoading(true);
      try {
        const outcome = await probeSingleServer(server, secretRef.current, isTauri);
        if (outcome.status === 'ok') {
          globalSnapshotCache[server.id] = outcome.snapshot;
          delete globalErrorCache[server.id];
          pushServerHistory(server.id, outcome.snapshot);
          setSnapshot(outcome.snapshot);
          setError(undefined);
          setNeedsTrust(false);
          setHistory({ ...globalHistoryCache[server.id] });
        } else if (outcome.status === 'needsTrust') {
          setNeedsTrust(true);
          setError(undefined);
        } else if (outcome.status === 'error') {
          globalErrorCache[server.id] = outcome.message;
          setError(outcome.message);
          setNeedsTrust(false);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        globalErrorCache[server.id] = msg;
        setError(msg);
      } finally {
        inFlightRef.current = false;
        setLoading(false);
      }
    },
    [server, isTauri]
  );

  useEffect(() => {
    if (!server) return;
    void poll(!snapshot);
    const timer = window.setInterval(() => {
      if (!document.hidden) {
        void poll(false);
      }
    }, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poll, server?.id]);

  const activeBackdrop = settings.settingsBackdrop ?? 'acrylic';
  const useNativeBackdrop = isTauri && activeBackdrop !== 'solid';

  // Ensure SWCA Acrylic / DWM backdrop is applied right after the window is shown
  useEffect(() => {
    if (!isTauri) return;
    void invoke('set_settings_backdrop', { backdrop: activeBackdrop }).catch(() => {});
  }, [isTauri, activeBackdrop]);

  const running = snapshot
    ? snapshot.docker.filter((c) => c.state === 'running').length
    : 0;
  const ramPercent =
    snapshot && snapshot.ramTotalBytes > 0
      ? Math.min(100, Math.max(0, (snapshot.ramUsedBytes / snapshot.ramTotalBytes) * 100))
      : 0;
  const diskPercent =
    snapshot && snapshot.diskTotalBytes > 0
      ? Math.min(100, Math.max(0, (snapshot.diskUsedBytes / snapshot.diskTotalBytes) * 100))
      : 0;

  return (
    <motion.div
      animate={{
        scale: inDockZone ? 0.96 : 1,
        opacity: inDockZone ? 0.84 : 1,
      }}
      transition={{ type: 'spring', stiffness: 420, damping: 30 }}
      className={`relative flex h-screen w-screen flex-col overflow-hidden text-white select-none transition-shadow ${
        useNativeBackdrop ? 'bg-transparent' : 'bg-[#0c0d12]'
      } ${inDockZone ? 'ring-2 ring-inset ring-sky-400/75' : ''}`}
    >
      {/* Live Dock Indicator Pill */}
      <AnimatePresence>
        {inDockZone && (
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.94 }}
            transition={{ duration: 0.15 }}
            className="pointer-events-none absolute inset-x-0 top-2 z-50 flex justify-center"
          >
            <div className="flex items-center gap-1.5 rounded-full bg-sky-500/90 px-3 py-1 text-[10px] font-semibold text-white shadow-lg ring-1 ring-white/25 backdrop-blur-md">
              <ArrowUp size={11} className="animate-bounce" />
              Lepas untuk masukkan ke Island
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Native Multi-Monitor Draggable Header */}
      <div
        data-tauri-drag-region
        className={`flex shrink-0 cursor-move items-center gap-2 border-b px-3 py-2 ${
          useNativeBackdrop
            ? 'border-white/[0.08] bg-black/20'
            : 'border-white/[0.08] bg-neutral-900/75'
        }`}
      >
        <GripHorizontal size={13} className="pointer-events-none shrink-0 text-neutral-400" />
        <span
          className={`pointer-events-none h-1.5 w-1.5 shrink-0 rounded-full ${
            error ? 'bg-red-500' : snapshot ? 'bg-emerald-400' : 'bg-neutral-500'
          }`}
        />
        <div data-tauri-drag-region className="min-w-0 flex-1">
          <p data-tauri-drag-region className="truncate text-[11.5px] font-semibold text-white/95">
            {server ? server.name : 'Server Monitor'}
          </p>
          <p data-tauri-drag-region className="truncate text-[8.5px] text-neutral-400">
            {server
              ? `${
                  server.authType === 'bridge'
                    ? `Bridge · ${server.host}:${server.port}`
                    : `${server.username}@${server.host}:${server.port}`
                }${snapshot ? ` · up ${formatUptime(snapshot.uptimeSeconds)} · ${snapshot.latencyMs} ms` : ''}`
              : 'Memuat konfigurasi…'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => void handleTogglePin()}
          title={alwaysOnTop ? 'Lepas Always on Top' : 'Aktifkan Always on Top'}
          className={`flex h-6 w-6 items-center justify-center rounded-md transition-colors ${
            alwaysOnTop
              ? 'bg-sky-500/20 text-sky-300 hover:bg-sky-500/30'
              : 'text-white/45 hover:bg-white/10 hover:text-white'
          }`}
        >
          {alwaysOnTop ? <Pin size={11} /> : <PinOff size={11} />}
        </button>

        <button
          type="button"
          onClick={() => void poll(true)}
          title="Refresh metrik"
          className="flex h-6 w-6 items-center justify-center rounded-md text-white/45 transition-colors hover:bg-white/10 hover:text-white"
        >
          <RefreshIcon size={12} className={loading ? 'animate-spin' : undefined} />
        </button>

        <button
          type="button"
          onClick={() => void handleDock()}
          title="Masukkan kembali ke tab Servers (Esc)"
          className="flex items-center gap-1 rounded-md bg-white/[0.1] px-2 py-1 text-[9px] font-semibold text-white/90 transition-colors hover:bg-white/20 hover:text-white"
        >
          <Minimize2 size={10} />
          Dock
        </button>
      </div>

      {/* Body */}
      <div className="flex min-h-0 flex-1 flex-col p-3">
        {serversLoading && !server ? (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center text-center">
            <RefreshIcon size={18} className="mb-1 animate-spin text-white/30" />
            <p className="text-[10px] text-white/50">Memuat server…</p>
          </div>
        ) : !server ? (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center text-center">
            <p className="text-[11px] font-semibold text-white/75">Server tidak ditemukan</p>
            <button
              type="button"
              onClick={() => void handleDock()}
              className="mt-2 rounded-lg bg-white/10 px-3 py-1 text-[10px] font-medium hover:bg-white/20"
            >
              Tutup
            </button>
          </div>
        ) : needsTrust ? (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center rounded-xl bg-amber-500/[0.08] p-3 text-center">
            <p className="text-[10.5px] font-semibold text-amber-300">Host key belum dipercaya</p>
            <p className="mt-1 text-[9px] text-amber-100/75">
              Masukkan kembali ke tab Servers untuk memverifikasi fingerprint SSH.
            </p>
            <button
              type="button"
              onClick={() => void handleDock()}
              className="mt-2 rounded-lg bg-amber-500 px-2.5 py-1 text-[9.5px] font-semibold text-neutral-950 hover:bg-amber-400"
            >
              Dock &amp; Verifikasi
            </button>
          </div>
        ) : error ? (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center rounded-xl bg-red-500/[0.08] p-3 text-center">
            <p className="text-[10.5px] font-semibold text-red-300">Gagal terhubung</p>
            <p className="mt-1 text-[9px] text-red-200/75">{error}</p>
            <button
              type="button"
              onClick={() => void poll(true)}
              className="mt-2 rounded-lg bg-red-500/20 px-2.5 py-1 text-[9.5px] font-semibold text-red-200 hover:bg-red-500/30"
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
                history={history.cpu}
                accentColor="#38bdf8"
              />
              <MetricCard
                icon={DatabaseIcon}
                label="RAM"
                value={formatBytes(snapshot.ramUsedBytes)}
                detail={`of ${formatBytes(snapshot.ramTotalBytes)}`}
                percent={ramPercent}
                history={history.ram}
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

            <div className="mt-2.5 flex min-h-0 flex-1 flex-col">
              <div className="flex shrink-0 items-center gap-1.5 pb-1.5">
                <button
                  type="button"
                  onClick={() => setDetailView('docker')}
                  className={`flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold ${
                    detailView === 'docker'
                      ? 'bg-sky-500/20 text-sky-300'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <BoxIcon size={11} /> Docker {running}/{snapshot.docker.length}
                </button>
                <button
                  type="button"
                  onClick={() => setDetailView('processes')}
                  className={`rounded-md px-2 py-1 text-[10px] font-semibold ${
                    detailView === 'processes'
                      ? 'bg-sky-500/20 text-sky-300'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  Apps Activity
                </button>
              </div>

              {detailView === 'processes' ? (
                <AppsActivity
                  key={server.id}
                  server={server}
                  password={serverSecrets[server.id]}
                  active
                />
              ) : (
                <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/10">
                  {!snapshot.dockerAvailable ? (
                    <p className="rounded-lg bg-black/25 px-2.5 py-1.5 text-[9.5px] text-neutral-400">
                      Docker tidak tersedia atau tidak dapat diakses.
                    </p>
                  ) : snapshot.docker.length === 0 ? (
                    <p className="rounded-lg bg-black/25 px-2.5 py-1.5 text-[9.5px] text-neutral-400">
                      Tidak ada container.
                    </p>
                  ) : (
                    snapshot.docker.map((container) => (
                      <div
                        key={container.id}
                        className="flex items-center gap-2 rounded-lg bg-black/25 px-2.5 py-1.5 ring-1 ring-white/[0.06]"
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
                        {container.state === 'running' &&
                          container.cpuPercent !== undefined &&
                          container.cpuPercent !== null && (
                            <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-[8.5px] font-medium tabular-nums text-sky-300">
                              {container.cpuPercent.toFixed(1)}%
                            </span>
                          )}
                        <span className="shrink-0 text-[8.5px] capitalize text-neutral-400">
                          {container.state}
                        </span>
                      </div>
                    ))
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
      </div>
    </motion.div>
  );
};
