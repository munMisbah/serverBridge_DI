import { CompactSlotType, MediaSlotPlacement } from '../../types';
import React, { useEffect, useState } from 'react';
import { TuningIcon } from '@solar-icons/react/bold/tuning';
import { LayersMinimalisticIcon } from '@solar-icons/react/bold/layers-minimalistic';
import { CursorIcon } from '@solar-icons/react/bold/cursor';
import { MouseCircleIcon } from '@solar-icons/react/bold/mouse-circle';
import { MonitorIcon } from '@solar-icons/react/bold/monitor';
import { PowerIcon } from '@solar-icons/react/bold/power';
import { StarsIcon } from '@solar-icons/react/bold/stars';
import { EyeClosedIcon } from '@solar-icons/react/bold/eye-closed';
import { MapPointIcon } from '@solar-icons/react/bold/map-point';
import { RestartIcon } from '@solar-icons/react/bold/restart';
import { ShieldIcon } from '@solar-icons/react/bold/shield';
import { useIsland } from '../../context/IslandContext';
import { INDONESIA_WEATHER_LOCATIONS } from '../../utils/locations';

interface ToggleRowProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  checked: boolean;
  onChange: () => void;
  activeClass?: string;
}

const ToggleRow: React.FC<ToggleRowProps> = ({
  icon,
  title,
  description,
  checked,
  onChange,
  activeClass = 'bg-sky-500',
}) => (
  <div className="flex items-center justify-between gap-3">
    <div className="flex min-w-0 items-center gap-2.5">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.04]">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[12px] font-semibold text-white">{title}</p>
        <p className="truncate text-[10px] leading-tight text-neutral-500">
          {description}
        </p>
      </div>
    </div>

    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative h-5 w-9 shrink-0 rounded-full p-0.5 transition-colors duration-200 ${
        checked ? activeClass : 'bg-white/10'
      }`}
    >
      <span
        className={`block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
          checked ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  </div>
);

export const SettingsWindow: React.FC = () => {
  const { settings, updateSettings } = useIsland();
  const [isTrafficHovered, setIsTrafficHovered] = useState(false);

  const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

  const handleClose = () => {
    if (isTauri) {
      import('@tauri-apps/api/core').then(({ invoke }) => {
        invoke('hide_settings_window').catch(console.error);
      });
    }
  };

  const handleMinimize = () => {
    if (isTauri) {
      import('@tauri-apps/api/core').then(({ invoke }) => {
        invoke('minimize_settings_window').catch(console.error);
      });
    }
  };

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const opacityPercent = settings.backgroundOpacity ?? 85;
  const blurPx = settings.backgroundBlur ?? 20;

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#0c0d12] text-white select-none rounded-[24px] shadow-[0_16px_40px_rgba(0,0,0,0.7)]">
      {/* Native macOS-Style Draggable Titlebar */}
      <div
        data-tauri-drag-region
        className="flex h-11 shrink-0 items-center justify-between px-4 bg-neutral-900/70 cursor-move"
      >
        {/* macOS Traffic Light Buttons */}
        <div
          className="flex items-center gap-2"
          onMouseEnter={() => setIsTrafficHovered(true)}
          onMouseLeave={() => setIsTrafficHovered(false)}
        >
          {/* Close: Red */}
          <button
            type="button"
            onClick={handleClose}
            className="group relative flex h-3 w-3 items-center justify-center rounded-full bg-[#ff5f56] active:scale-95 transition-transform"
            title="Tutup (Esc)"
            aria-label="Tutup Window"
          >
            <span
              className={`text-[8px] font-bold text-[#4c0000] leading-none transition-opacity ${
                isTrafficHovered ? 'opacity-100' : 'opacity-0'
              }`}
            >
              ✕
            </span>
          </button>

          {/* Minimize: Yellow */}
          <button
            type="button"
            onClick={handleMinimize}
            className="group relative flex h-3 w-3 items-center justify-center rounded-full bg-[#ffbd2e] active:scale-95 transition-transform"
            title="Minimize"
            aria-label="Minimize Window"
          >
            <span
              className={`text-[10px] font-bold text-[#5c3c00] leading-none -mt-0.5 transition-opacity ${
                isTrafficHovered ? 'opacity-100' : 'opacity-0'
              }`}
            >
              −
            </span>
          </button>

          {/* Zoom: Green (aesthetic dot) */}
          <div className="flex h-3 w-3 items-center justify-center rounded-full bg-[#27c93f] opacity-80" />
        </div>

        {/* Window Title (Centered, draggable) */}
        <div data-tauri-drag-region className="flex items-center gap-2 pointer-events-none">
          <TuningIcon size={14} className="text-sky-400" />
          <span className="text-[12px] font-bold tracking-tight text-white">
            Pengaturan Dynamic Island
          </span>
        </div>

        {/* Empty space for symmetric balance */}
        <div className="w-14" />
      </div>

      {/* Main Solid Settings Body (No borderlines, 100% solid surfaces) */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {/* 1. Island Style (Pill vs Notch) */}
        <div className="rounded-2xl bg-neutral-900/90 p-3.5 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400">
              <LayersMinimalisticIcon size={14} className="text-sky-400" />
              Island Style
            </span>
            <span className="rounded-full bg-neutral-800 px-2 py-0.5 text-[9px] font-semibold text-neutral-300">
              {settings.islandStyle === 'notch' ? 'MacBook Notch' : 'iOS Dynamic Island'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => updateSettings({ islandStyle: 'pill' })}
              className={`flex items-center justify-center gap-2 rounded-xl py-2.5 px-3 text-xs font-medium transition-all ${
                (settings.islandStyle || 'pill') === 'pill'
                  ? 'bg-sky-500 text-white font-semibold shadow-md'
                  : 'bg-white/[0.04] text-neutral-400 hover:bg-white/[0.08] hover:text-white'
              }`}
            >
              <span>Floating Pill (iOS)</span>
            </button>

            <button
              type="button"
              onClick={() => updateSettings({ islandStyle: 'notch' })}
              className={`flex items-center justify-center gap-2 rounded-xl py-2.5 px-3 text-xs font-medium transition-all ${
                settings.islandStyle === 'notch'
                  ? 'bg-sky-500 text-white font-semibold shadow-md'
                  : 'bg-white/[0.04] text-neutral-400 hover:bg-white/[0.08] hover:text-white'
              }`}
            >
              <span>Notch (MacBook)</span>
            </button>
          </div>
        </div>
        {/* Slot Kustomisasi Kapsul (Left & Right Wings) */}
        <div className="rounded-2xl bg-neutral-900/90 p-3.5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400">
              <TuningIcon size={14} className="text-emerald-400" />
              Slot Dinamis Kapsul (Samping Mata)
            </span>
          </div>

          {/* Slot Kiri */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-white">Slot Sisi Kiri</span>
              <span className="text-[10px] text-neutral-400 capitalize">{settings.compactLeftSlot || 'weather'}</span>
            </div>
            <div className="grid grid-cols-5 gap-1">
              {[
                { id: 'weather', label: 'Cuaca', icon: '⛅' },
                { id: 'clock', label: 'Jam', icon: '⏰' },
                { id: 'todo', label: 'Todo', icon: '✅' },
                { id: 'media', label: 'Musik', icon: '🎵' },
                { id: 'clipboard', label: 'Clip', icon: '📋' },
              ].map((opt) => {
                const isActive = (settings.compactLeftSlot || 'weather') === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => updateSettings({ compactLeftSlot: opt.id as CompactSlotType })}
                    className={`flex flex-col items-center gap-0.5 rounded-xl py-1.5 px-1 text-center transition-all ${
                      isActive
                        ? 'bg-emerald-500 text-white font-semibold shadow-md'
                        : 'bg-white/[0.04] text-neutral-400 hover:bg-white/[0.08] hover:text-white'
                    }`}
                  >
                    <span className="text-xs">{opt.icon}</span>
                    <span className="text-[10px]">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Slot Kanan */}
          <div className="space-y-1.5 pt-2 border-t border-white/[0.04]">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-white">Slot Sisi Kanan</span>
              <span className="text-[10px] text-neutral-400 capitalize">{settings.compactRightSlot || 'clock'}</span>
            </div>
            <div className="grid grid-cols-5 gap-1">
              {[
                { id: 'clock', label: 'Jam', icon: '⏰' },
                { id: 'weather', label: 'Cuaca', icon: '⛅' },
                { id: 'todo', label: 'Todo', icon: '✅' },
                { id: 'media', label: 'Musik', icon: '🎵' },
                { id: 'clipboard', label: 'Clip', icon: '📋' },
              ].map((opt) => {
                const isActive = (settings.compactRightSlot || 'clock') === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => updateSettings({ compactRightSlot: opt.id as CompactSlotType })}
                    className={`flex flex-col items-center gap-0.5 rounded-xl py-1.5 px-1 text-center transition-all ${
                      isActive
                        ? 'bg-sky-500 text-white font-semibold shadow-md'
                        : 'bg-white/[0.04] text-neutral-400 hover:bg-white/[0.08] hover:text-white'
                    }`}
                  >
                    <span className="text-xs">{opt.icon}</span>
                    <span className="text-[10px]">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Posisi Musik Saat Playing */}
          <div className="space-y-1.5 pt-2 border-t border-white/[0.04]">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-white">Posisi Info Musik Saat Play</span>
              <span className="text-[10px] text-neutral-400">
                {(settings.mediaPlacement || 'right') === 'right' ? 'Di Kanan (Gantikan Jam)' : 'Di Kiri'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => updateSettings({ mediaPlacement: 'right' as MediaSlotPlacement })}
                className={`flex items-center justify-center gap-1.5 rounded-xl py-2 px-2.5 text-xs font-medium transition-all ${
                  (settings.mediaPlacement || 'right') === 'right'
                    ? 'bg-sky-500 text-white font-semibold shadow-md'
                    : 'bg-white/[0.04] text-neutral-400 hover:bg-white/[0.08] hover:text-white'
                }`}
              >
                <span>👉 Di Kanan (Gantikan Jam)</span>
              </button>

              <button
                type="button"
                onClick={() => updateSettings({ mediaPlacement: 'left' as MediaSlotPlacement })}
                className={`flex items-center justify-center gap-1.5 rounded-xl py-2 px-2.5 text-xs font-medium transition-all ${
                  settings.mediaPlacement === 'left'
                    ? 'bg-sky-500 text-white font-semibold shadow-md'
                    : 'bg-white/[0.04] text-neutral-400 hover:bg-white/[0.08] hover:text-white'
                }`}
              >
                <span>👈 Di Kiri (Gantikan Slot Kiri)</span>
              </button>
            </div>
            <p className="text-[10px] text-neutral-500 leading-tight pt-0.5">
              Saat musik Windows diputar, info lagu otomatis tampil menggantikan slot pilihan Anda.
            </p>
          </div>
        </div>


        {/* 2. Interaction Mode */}
        <div className="rounded-2xl bg-neutral-900/90 p-3.5 shadow-sm space-y-2">
          <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400">
            <CursorIcon size={14} className="text-violet-400" />
            Mode Interaksi
          </span>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => updateSettings({ expandTrigger: 'hover' })}
              className={`flex items-center justify-center gap-2 rounded-xl py-2 px-3 text-xs font-medium transition-all ${
                (settings.expandTrigger || 'hover') === 'hover'
                  ? 'bg-violet-500 text-white font-semibold shadow-md'
                  : 'bg-white/[0.04] text-neutral-400 hover:bg-white/[0.08] hover:text-white'
              }`}
            >
              <CursorIcon size={14} />
              <span>Expand on Hover</span>
            </button>

            <button
              type="button"
              onClick={() => updateSettings({ expandTrigger: 'click' })}
              className={`flex items-center justify-center gap-2 rounded-xl py-2 px-3 text-xs font-medium transition-all ${
                settings.expandTrigger === 'click'
                  ? 'bg-violet-500 text-white font-semibold shadow-md'
                  : 'bg-white/[0.04] text-neutral-400 hover:bg-white/[0.08] hover:text-white'
              }`}
            >
              <MouseCircleIcon size={14} />
              <span>Expand on Click</span>
            </button>
          </div>
        </div>

        {/* 3. Window & Behavior Toggles */}
        <div className="space-y-3 rounded-2xl bg-neutral-900/90 p-3.5 shadow-sm">
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400 block">
            Perilaku Jendela
          </span>

          <ToggleRow
            icon={<MonitorIcon size={16} className="text-sky-400" />}
            title="Always On Top"
            description="Kapsul selalu melayang di atas jendela aplikasi lain"
            checked={settings.alwaysOnTopEnabled}
            onChange={() => updateSettings({ alwaysOnTopEnabled: !settings.alwaysOnTopEnabled })}
            activeClass="bg-sky-500"
          />
          <ToggleRow
            icon={<EyeClosedIcon size={16} className="text-indigo-400" />}
            title="Intelligent Dodge (Auto-Peek)"
            description="Sembunyikan kapsul ke atas saat kursor melintasi tab browser atau jendela di belakangnya"
            checked={settings.intelligentDodgeEnabled ?? true}
            onChange={() => updateSettings({ intelligentDodgeEnabled: !(settings.intelligentDodgeEnabled ?? true) })}
            activeClass="bg-indigo-500"
          />

          <ToggleRow
            icon={<PowerIcon size={16} className="text-emerald-400" />}
            title="Start with Windows"
            description="Jalankan otomatis saat booting Windows"
            checked={settings.autostartEnabled}
            onChange={() => updateSettings({ autostartEnabled: !settings.autostartEnabled })}
            activeClass="bg-emerald-500"
          />

          <ToggleRow
            icon={<StarsIcon size={16} className="text-amber-400" />}
            title="Reduced Motion"
            description="Kurangi intensitas efek pegas/spring animasi"
            checked={settings.reducedMotionEnabled}
            onChange={() => updateSettings({ reducedMotionEnabled: !settings.reducedMotionEnabled })}
            activeClass="bg-amber-500"
          />
        </div>

        {/* 4. Transparency & Material Presets */}
        <div className="space-y-3 rounded-2xl bg-neutral-900/90 p-3.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400">
              Transparansi Kapsul
            </span>
            <span className="text-[11px] font-mono text-sky-400 font-semibold">
              {opacityPercent}% • {blurPx}px blur
            </span>
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            {[
              { label: 'Frosted', opacity: 75, blur: 24 },
              { label: 'Acrylic', opacity: 85, blur: 20 },
              { label: 'Deep', opacity: 92, blur: 12 },
              { label: 'Solid', opacity: 100, blur: 0 },
            ].map((preset) => {
              const isActive =
                Math.abs(opacityPercent - preset.opacity) <= 2 &&
                Math.abs(blurPx - preset.blur) <= 2;
              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() =>
                    updateSettings({
                      backgroundOpacity: preset.opacity,
                      backgroundBlur: preset.blur,
                    })
                  }
                  className={`rounded-xl py-1.5 text-center text-[11px] font-medium transition-all ${
                    isActive
                      ? 'bg-sky-500 text-white font-semibold shadow-md'
                      : 'bg-white/[0.04] text-neutral-400 hover:bg-white/[0.08] hover:text-white'
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>

          {/* Opacity slider */}
          <div className="space-y-1 pt-1">
            <div className="flex items-center justify-between text-[11px] text-neutral-400">
              <span>Opacity</span>
              <span className="text-white font-mono">{opacityPercent}%</span>
            </div>
            <input
              type="range"
              min="60"
              max="100"
              step="1"
              value={opacityPercent}
              onChange={(e) => updateSettings({ backgroundOpacity: Number(e.target.value) })}
              className="h-1.5 w-full appearance-none rounded-lg bg-neutral-800 accent-sky-400 cursor-pointer"
            />
          </div>
        </div>

        {/* 5. Weather Location & Interval */}
        <div className="space-y-3 rounded-2xl bg-neutral-900/90 p-3.5 shadow-sm">
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400 block">
            Cuaca & Lokasi
          </span>

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.04]">
                <MapPointIcon size={16} className="text-sky-400" />
              </span>
              <div>
                <p className="text-[12px] font-semibold text-white">Lokasi Cuaca</p>
                <p className="text-[10px] text-neutral-500">Pilih kota untuk ramalan live</p>
              </div>
            </div>

            <select
              value={settings.weatherLocation.name}
              onChange={(e) => {
                const found = INDONESIA_WEATHER_LOCATIONS.find((loc) => loc.name === e.target.value);
                if (found) {
                  updateSettings({ weatherLocation: found });
                }
              }}
              className="rounded-lg bg-neutral-800 px-2.5 py-1 text-[11px] text-white outline-none focus:bg-neutral-700 cursor-pointer"
              aria-label="Pilih lokasi cuaca"
            >
              {INDONESIA_WEATHER_LOCATIONS.map((loc) => (
                <option key={loc.name} value={loc.name}>
                  {loc.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between gap-3 pt-2.5 border-t border-white/[0.04]">
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.04]">
                <RestartIcon size={16} className="text-emerald-400" />
              </span>
              <div>
                <p className="text-[12px] font-semibold text-white">Interval Pembaruan</p>
                <p className="text-[10px] text-neutral-500">Frekuensi pengambilan data</p>
              </div>
            </div>

            <select
              value={settings.weatherRefreshInterval}
              onChange={(e) =>
                updateSettings({ weatherRefreshInterval: Number(e.target.value) })
              }
              className="rounded-lg bg-neutral-800 px-2.5 py-1 text-[11px] text-white outline-none focus:bg-neutral-700 cursor-pointer"
              aria-label="Interval pembaruan cuaca"
            >
              <option value="5">5 menit</option>
              <option value="15">15 menit</option>
              <option value="30">30 menit</option>
              <option value="60">1 jam</option>
            </select>
          </div>
        </div>

        {/* 6. Privacy & Notifications */}
        <div className="space-y-3 rounded-2xl bg-neutral-900/90 p-3.5 shadow-sm">
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400 block">
            Privasi & Notifikasi
          </span>

          <ToggleRow
            icon={<EyeClosedIcon size={16} className="text-amber-400" />}
            title="Sembunyikan Isi Pesan"
            description="Jangan tampilkan isi preview teks notifikasi di kapsul"
            checked={settings.hideNotificationContent}
            onChange={() => updateSettings({ hideNotificationContent: !settings.hideNotificationContent })}
            activeClass="bg-amber-500"
          />

          <div className="space-y-1 pt-1">
            <div className="flex items-center justify-between text-[11px] text-neutral-400">
              <span>Durasi Tampilan Notifikasi</span>
              <span className="text-sky-400 font-mono font-semibold">
                {settings.notificationDisplayDuration || 5} detik
              </span>
            </div>
            <input
              type="range"
              min="3"
              max="15"
              step="1"
              value={settings.notificationDisplayDuration || 5}
              onChange={(e) =>
                updateSettings({ notificationDisplayDuration: Number(e.target.value) })
              }
              className="h-1.5 w-full appearance-none rounded-lg bg-neutral-800 accent-sky-400 cursor-pointer"
            />
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={() => {
                if (isTauri) {
                  import('@tauri-apps/api/core').then(({ invoke }) => {
                    invoke('open_notification_settings').catch(console.error);
                  });
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-sky-400 text-[11px] font-semibold transition-colors"
            >
              <ShieldIcon size={14} />
              <span>Buka Pengaturan Notifikasi Windows</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
