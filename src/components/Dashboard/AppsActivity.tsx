import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ProcessSort, ServerConfig, ServerProcesses } from '../../types';

interface Props {
  server: ServerConfig;
  password?: string;
  active: boolean;
}


export const AppsActivity: React.FC<Props> = ({ server, password, active }) => {
  const [sort, setSort] = useState<ProcessSort>('cpu');
  const [descending, setDescending] = useState(true);
  const [data, setData] = useState<ServerProcesses | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const isTauri = '__TAURI_INTERNALS__' in window;

  useEffect(() => {
    if (!active || !isTauri || server.authType !== 'bridge') return;
    let cancelled = false;
    let busy = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      if (cancelled || busy || document.hidden) return;
      busy = true;
      setLoading(true);
      try {
        const result = await invoke<ServerProcesses>('server_processes', {
          serverId: server.id, password, sort, descending,
        });
        if (!cancelled) {
          setData(result);
          setError(null);
        }
      } catch (failure) {
        if (!cancelled) setError(failure instanceof Error ? failure.message : String(failure));
      } finally {
        busy = false;
        if (!cancelled) {
          setLoading(false);
          timer = setTimeout(() => void load(), 5_000);
        }
      }
    };
    const onVisibility = () => {
      clearTimeout(timer);
      if (!document.hidden) void load();
    };
    document.addEventListener('visibilitychange', onVisibility);
    void load();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [active, isTauri, server.id, server.authType, password, sort, descending]);

  const changeSort = (column: ProcessSort) => {
    if (column === sort) setDescending((previous) => !previous);
    else {
      setSort(column);
      setDescending(column !== 'user');
    }
    // Do not label an old top-20 result with the newly selected ordering.
    setData(null);
  };

  if (server.authType !== 'bridge') return (
    <p className="rounded-lg bg-white/[0.03] p-2 text-[10px] text-neutral-400">
      Apps Activity memerlukan Bridge Agent. Tambahkan koneksi Bridge untuk server ini.
    </p>
  );
  if (!isTauri) return (
    <p className="rounded-lg bg-white/[0.03] p-2 text-[10px] text-neutral-400">
      Apps Activity live tersedia di aplikasi desktop dengan Bridge Agent, bukan data simulasi browser.
    </p>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col" aria-label="Apps Activity" aria-busy={loading}>
      <p className="shrink-0 pb-1 text-[8.5px] text-neutral-500">
        Read-only · 5s · CPU dari kapasitas host · RAM RSS
      </p>
      {error ? (
        <p role="alert" className="rounded-lg bg-red-500/10 p-2 text-[10px] text-red-300">{error}</p>
      ) : (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            <table className="w-full table-fixed text-left text-[9px] tabular-nums">
              <thead className="sticky top-0 z-10 bg-[#0b0c10] text-neutral-400">
                <tr>
                  <th scope="col" className="w-[37%] px-1 py-1 font-medium">Process / PID</th>
                  {(['user', 'cpu', 'ram'] as const).map((column) => (
                    <th key={column} scope="col" className={column === 'user' ? 'w-[23%]' : 'w-[20%]'}
                      aria-sort={sort === column ? descending ? 'descending' : 'ascending' : 'none'}>
                      <button type="button" onClick={() => changeSort(column)}
                        aria-label={`Sort by ${column.toUpperCase()}`}
                        className={`w-full py-1 text-left hover:text-white ${sort === column ? 'text-sky-300' : ''}`}>
                        {column.toUpperCase()}{sort === column ? descending ? ' ↓' : ' ↑' : ''}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data?.processes.map((process) => (
                  <tr key={process.pid} className="hover:bg-white/[0.04]">
                    <td className="px-1 py-1">
                      <span className="block truncate text-white/90" title={process.name}>{process.name}</span>
                      <span className="text-[8px] text-neutral-500">{process.pid}</span>
                    </td>
                    <td className="truncate pr-1 text-neutral-400" title={process.user}>{process.user}</td>
                    <td className="text-sky-300">{process.cpuPercent === null ? '—' : `${process.cpuPercent.toFixed(1)}%`}</td>
                    <td className="text-purple-300">{process.ramUsedBytes >= 1024 ** 3
                      ? `${(process.ramUsedBytes / 1024 ** 3).toFixed(1)} GB`
                      : `${(process.ramUsedBytes / 1024 ** 2).toFixed(1)} MB`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data && <p className="p-2 text-[10px] text-neutral-500">Memuat aktivitas…</p>}
            {data && data.processes.length === 0 && <p className="p-2 text-[10px] text-neutral-500">Tidak ada proses yang dapat dibaca.</p>}
          </div>
          {data && <p className="shrink-0 pt-1 text-[8px] text-neutral-500">
            Top {data.processes.length} / {data.total} · {new Date(data.updatedAt).toLocaleTimeString()}
            {data.skippedProcesses > 0 ? ` · ${data.skippedProcesses} tidak terbaca/berakhir` : ''}
            {data.processes.some((process) => process.cpuPercent === null) ? ' · CPU menunggu sampel berikutnya' : ''}
          </p>}
        </>
      )}
    </div>
  );
};
