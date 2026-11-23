import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useMotionValue } from 'framer-motion';
import { CpuIcon } from '@solar-icons/react/bold/cpu';
import { DatabaseIcon } from '@solar-icons/react/bold/database';
import { SsdSquareIcon } from '@solar-icons/react/bold/ssd-square';
import { BoxIcon } from '@solar-icons/react/bold/box';
import { RefreshIcon } from '@solar-icons/react/bold/refresh';
import { GripHorizontal, Minimize2 } from 'lucide-react';
import { useIsland } from '../../context/IslandContext';
import { getIslandHitRect, setHitTestForce } from '../../lib/hitTest';
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
import type { FloatingServerWindow, ServerConfig, ServerSnapshot } from '../../types';

const MIN_WIDTH = 340;
const MIN_HEIGHT = 240;
const EDGE_PAD = 8;

interface FloatingServerCardProps {
  win: FloatingServerWindow;
  server: ServerConfig;
}

export const FloatingServerCard: React.FC<FloatingServerCardProps> = ({ win, server }) => {
  const {
    serverSecrets,
    settings,
    updateFloatingServer,
    dockServer,
    bringFloatingServerToFront,
    setActiveTab,
    setState,
  } = useIsland();

  const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
  const [snapshot, setSnapshot] = useState<ServerSnapshot | undefined>(
    () => globalSnapshotCache[server.id]
  );
  const [error, setError] = useState<string | undefined>(() => globalErrorCache[server.id]);
  const [needsTrust, setNeedsTrust] = useState(false);
  const [history, setHistory] = useState<{ cpu: number[]; ram: number[] }>(
    () => globalHistoryCache[server.id] ?? { cpu: [], ram: [] }
  );
  const [loading, setLoading] = useState(false);
  const [detailView, setDetailView] = useState<'docker' | 'processes'>('docker');
  const [size, setSize] = useState({ w: win.width, h: win.height });
  const [overDockZone, setOverDockZone] = useState(false);

  const x = useMotionValue(win.x);
  const y = useMotionValue(win.y);
  const interactingRef = useRef(false);
  const cleanupInteractionRef = useRef<(() => void) | null>(null);
  const inFlightRef = useRef(false);

  useEffect(() => {
    return () => {
      cleanupInteractionRef.current?.();
      cleanupInteractionRef.current = null;
    };
  }, []);
  const sizeRef = useRef(size);
  sizeRef.current = size;

  const secretRef = useRef(serverSecrets[server.id]);
  secretRef.current = serverSecrets[server.id];

  useEffect(() => {
    if (interactingRef.current) return;
    x.set(win.x);
    y.set(win.y);
  }, [win.x, win.y, x, y]);

  useEffect(() => {
    setSize({ w: win.width, h: win.height });
  }, [win.width, win.height]);

  const poll = useCallback(
    async (showSpinner = false) => {
      if (inFlightRef.current) return;
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
    void poll(!snapshot);
    const timer = window.setInterval(() => {
      if (!document.hidden) {
        void poll(false);
      }
    }, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poll]);

  const isCursorInDockZone = (clientX: number, clientY: number): boolean => {
    const islandRect = getIslandHitRect();
    if (islandRect) {
      const pad = 28;
      return (
        clientX >= islandRect.x - pad &&
        clientX <= islandRect.x + islandRect.width + pad &&
        clientY >= 0 &&
        clientY <= islandRect.y + islandRect.height + pad
      );
    }
    const vw = window.innerWidth || 1280;
    const center = vw / 2;
    return clientY <= 92 && Math.abs(clientX - center) <= 220;
  };

  const handleDragStart = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('button')) return;

    e.preventDefault();
    e.stopPropagation();
    bringFloatingServerToFront(server.id);
    interactingRef.current = true;
    setHitTestForce(true);

    const startX = e.clientX;
    const startY = e.clientY;
    const originX = x.get();
    const originY = y.get();

    const onMove = (ev: PointerEvent) => {
      const vw = window.innerWidth || 1280;
      const vh = window.innerHeight || 800;
      const nextX = Math.max(
        EDGE_PAD,
        Math.min(originX + (ev.clientX - startX), vw - sizeRef.current.w - EDGE_PAD)
      );
      const nextY = Math.max(
        EDGE_PAD,
        Math.min(originY + (ev.clientY - startY), vh - sizeRef.current.h - EDGE_PAD)
      );
      x.set(nextX);
      y.set(nextY);
      setOverDockZone(isCursorInDockZone(ev.clientX, ev.clientY));
    };

    const finish = (ev?: PointerEvent) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      cleanupInteractionRef.current = null;
      interactingRef.current = false;
      setHitTestForce(false);

      const shouldDock = ev ? isCursorInDockZone(ev.clientX, ev.clientY) : false;
      setOverDockZone(false);

      if (shouldDock) {
        dockServer(server.id);
        setActiveTab('servers');
        setState('expanded');
      } else {
        updateFloatingServer(server.id, {
          x: Math.round(x.get()),
          y: Math.round(y.get()),
        });
      }
    };

    const onUp = (ev: PointerEvent) => finish(ev);
    const onCancel = () => finish();

    cleanupInteractionRef.current = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      interactingRef.current = false;
      setHitTestForce(false);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
  };

  const handleResizeStart = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    bringFloatingServerToFront(server.id);
    interactingRef.current = true;
    setHitTestForce(true);

    const startX = e.clientX;
    const startY = e.clientY;
    const startW = sizeRef.current.w;
    const startH = sizeRef.current.h;

    const onMove = (ev: PointerEvent) => {
      const vw = window.innerWidth || 1280;
      const vh = window.innerHeight || 800;
      const maxW = Math.max(MIN_WIDTH, vw - x.get() - EDGE_PAD);
      const maxH = Math.max(MIN_HEIGHT, vh - y.get() - EDGE_PAD);
      const nextW = Math.max(MIN_WIDTH, Math.min(startW + (ev.clientX - startX), maxW));
      const nextH = Math.max(MIN_HEIGHT, Math.min(startH + (ev.clientY - startY), maxH));
      setSize({ w: Math.round(nextW), h: Math.round(nextH) });
    };

    const finishResize = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', finishResize);
      window.removeEventListener('pointercancel', finishResize);
      cleanupInteractionRef.current = null;
      interactingRef.current = false;
      setHitTestForce(false);
      updateFloatingServer(server.id, {
        width: sizeRef.current.w,
        height: sizeRef.current.h,
      });
    };

    cleanupInteractionRef.current = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', finishResize);
      window.removeEventListener('pointercancel', finishResize);
      interactingRef.current = false;
      setHitTestForce(false);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', finishResize);
    window.addEventListener('pointercancel', finishResize);
  };

  const opacity = (settings.backgroundOpacity ?? 85) / 100;
  const isGlass = opacity < 1;
  const glassGradient = isGlass
    ? `linear-gradient(135deg, rgba(28, 30, 38, ${Math.min(0.96, opacity * 0.96)}) 0%, rgba(14, 16, 22, ${Math.min(0.94, opacity * 0.92)}) 45%, rgba(7, 8, 12, ${Math.min(0.98, opacity * 0.99)}) 100%)`
    : '#0a0b0f';

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
      data-floating-server-card={server.id}
      style={{
        x,
        y,
        width: size.w,
        height: size.h,
        zIndex: 60 + win.z,
        background: glassGradient,
        boxShadow: overDockZone
          ? '0 0 0 1.5px rgba(56, 189, 248, 0.75), 0 18px 40px -6px rgba(0, 0, 0, 0.75)'
          : 'inset 0 1px 1px 0 rgba(255, 255, 255, 0.2), 0 18px 38px -6px rgba(0, 0, 0, 0.7)',
      }}
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: overDockZone ? 0.82 : 1, scale: overDockZone ? 0.96 : 1 }}
      transition={{ duration: settings.reducedMotionEnabled ? 0.1 : 0.16 }}
      onPointerDown={() => bringFloatingServerToFront(server.id)}
      className="pointer-events-auto fixed left-0 top-0 flex flex-col overflow-hidden rounded-[22px] border border-white/15 text-white select-none"
    >
      {/* Draggable Header */}
      <div
        onPointerDown={handleDragStart}
        className="flex shrink-0 cursor-grab items-center gap-2 border-b border-white/[0.08] px-3 py-2 active:cursor-grabbing"
      >
        <GripHorizontal size={13} className="shrink-0 text-neutral-500" />
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${
            error ? 'bg-red-500' : snapshot ? 'bg-emerald-400' : 'bg-neutral-600'
          }`}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11.5px] font-semibold text-white/95">{server.name}</p>
          <p className="truncate text-[8.5px] text-neutral-400">
            {overDockZone
              ? 'Lepas untuk masukkan kembali ke tab Servers'
              : `${
                  server.authType === 'bridge'
                    ? `Bridge · ${server.host}:${server.port}`
                    : `${server.username}@${server.host}:${server.port}`
                }${snapshot ? ` · up ${formatUptime(snapshot.uptimeSeconds)} · ${snapshot.latencyMs} ms` : ''}`}
          </p>
        </div>

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
          onClick={() => {
            dockServer(server.id);
            setActiveTab('servers');
            setState('expanded');
          }}
          title="Masukkan kembali ke tab Servers"
          className="flex items-center gap-1 rounded-md bg-white/[0.08] px-2 py-1 text-[9px] font-semibold text-white/85 transition-colors hover:bg-white/15 hover:text-white"
        >
          <Minimize2 size={10} />
          Dock
        </button>
      </div>

      {/* Body */}
      <div className="flex min-h-0 flex-1 flex-col p-3">
        {needsTrust ? (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center rounded-xl bg-amber-500/[0.06] p-3 text-center">
            <p className="text-[10.5px] font-semibold text-amber-300">Host key belum dipercaya</p>
            <p className="mt-1 text-[9px] text-amber-100/75">
              Masukkan kembali ke tab Servers untuk memverifikasi fingerprint SSH.
            </p>
            <button
              type="button"
              onClick={() => {
                dockServer(server.id);
                setActiveTab('servers');
                setState('expanded');
              }}
              className="mt-2 rounded-lg bg-amber-500 px-2.5 py-1 text-[9.5px] font-semibold text-neutral-950 hover:bg-amber-400"
            >
              Dock &amp; Verifikasi
            </button>
          </div>
        ) : error ? (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center rounded-xl bg-red-500/[0.06] p-3 text-center">
            <p className="text-[10.5px] font-semibold text-red-300">Gagal terhubung</p>
            <p className="mt-1 text-[9px] text-red-200/70">{error}</p>
            <button
              type="button"
              onClick={() => void poll(true)}
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

            <div className="mt-2 flex min-h-0 flex-1 flex-col">
              <div className="flex shrink-0 items-center gap-1.5 pb-1">
                <button
                  type="button"
                  onClick={() => setDetailView('docker')}
                  className={`flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] font-semibold ${
                    detailView === 'docker'
                      ? 'bg-sky-500/15 text-sky-300'
                      : 'text-neutral-500 hover:text-white'
                  }`}
                >
                  <BoxIcon size={11} /> Docker {running}/{snapshot.docker.length}
                </button>
                <button
                  type="button"
                  onClick={() => setDetailView('processes')}
                  className={`rounded-md px-1.5 py-1 text-[10px] font-semibold ${
                    detailView === 'processes'
                      ? 'bg-sky-500/15 text-sky-300'
                      : 'text-neutral-500 hover:text-white'
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
                    <p className="rounded-lg bg-white/[0.03] px-2 py-1.5 text-[9.5px] text-neutral-500">
                      Docker tidak tersedia atau tidak dapat diakses.
                    </p>
                  ) : snapshot.docker.length === 0 ? (
                    <p className="rounded-lg bg-white/[0.03] px-2 py-1.5 text-[9.5px] text-neutral-500">
                      Tidak ada container.
                    </p>
                  ) : (
                    snapshot.docker.map((container) => (
                      <div
                        key={container.id}
                        className="flex items-center gap-2 rounded-lg bg-white/[0.03] px-2 py-1.5"
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
                            <span className="rounded bg-sky-500/10 px-1.5 py-0.5 text-[8.5px] font-medium tabular-nums text-sky-400">
                              {container.cpuPercent.toFixed(1)}%
                            </span>
                          )}
                        <span className="shrink-0 text-[8.5px] capitalize text-neutral-500">
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

      {/* Bottom-right resize handle */}
      <div
        onPointerDown={handleResizeStart}
        title="Ubah ukuran"
        className="absolute bottom-1 right-1 h-4 w-4 cursor-nwse-resize opacity-35 hover:opacity-80"
      >
        <svg viewBox="0 0 12 12" className="h-full w-full text-white">
          <path
            d="M3 11L11 3M7 11L11 7"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </motion.div>
  );
};
