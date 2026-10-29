import React from 'react';
import { MonitorIcon } from '@solar-icons/react/bold/monitor';
import { EyeClosedIcon } from '@solar-icons/react/bold/eye-closed';
import { StarsIcon } from '@solar-icons/react/bold/stars';
import { RestartIcon } from '@solar-icons/react/bold/restart';
import { PowerIcon } from '@solar-icons/react/bold/power';
import { CursorIcon } from '@solar-icons/react/bold/cursor';
import { MouseCircleIcon } from '@solar-icons/react/bold/mouse-circle';
import { TuningIcon } from '@solar-icons/react/bold/tuning';
import { LayersMinimalisticIcon } from '@solar-icons/react/bold/layers-minimalistic';
import { MapPointIcon } from '@solar-icons/react/bold/map-point';
import { INDONESIA_WEATHER_LOCATIONS } from '../../utils/locations';
import { useIsland } from '../../context/IslandContext';
import { ExpandTrigger } from '../../types';

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
}) => (
  <div className="flex items-center justify-between gap-3">
    <div className="flex min-w-0 items-center gap-2.5">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] bg-white/[0.08] text-white">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[12.5px] font-semibold text-white tracking-tight">{title}</p>
        <p className="truncate text-[10px] leading-tight text-white/50">
          {description}
        </p>
      </div>
    </div>

    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative h-6 w-11 shrink-0 rounded-full p-0.5 transition-colors duration-200 ${
        checked ? 'bg-[#34C759]' : 'bg-white/20'
      }`}
    >
      <span
        className={`block h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-200 ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  </div>
);

const EXPAND_OPTIONS: {
  id: ExpandTrigger;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}[] = [
  { id: 'hover', label: 'Hover', icon: CursorIcon },
  { id: 'click', label: 'Click', icon: MouseCircleIcon },
];

export const SettingsTab: React.FC = () => {
  const { settings, updateSettings } = useIsland();

  return (
    <div className="space-y-2.5">
      {/* Island Style Selector: Pill vs Notch */}
      <div className="rounded-2xl bg-neutral-900/90 p-3.5 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400">
            <LayersMinimalisticIcon size={14} className="text-sky-400" />
            Island Style
          </span>
          <span className="rounded-full bg-neutral-800 px-2 py-0.5 text-[9px] font-semibold text-neutral-300">
            {settings.islandStyle === 'notch' ? 'MacBook Notch' : 'iOS Dynamic Island'}
          </span>
        </div>

        <div className="mt-2.5 grid grid-cols-2 gap-2">
          {/* Pill Option */}
          <button
            type="button"
            onClick={() => updateSettings({ islandStyle: 'pill' })}
            className={`group relative flex flex-col items-center gap-2 rounded-xl p-3 text-center transition-all duration-200 ${
              (settings.islandStyle || 'pill') === 'pill'
                ? 'border border-sky-500/40 bg-sky-500/10 text-white shadow-sm'
                : 'bg-neutral-950/60 text-neutral-400 hover:bg-neutral-800/60 hover:text-white'
            }`}
          >
            {/* Visual Mini Preview: Pill */}
            <div className="relative flex h-10 w-full items-center justify-center rounded-lg bg-black/40 p-2">
              <div className="h-3.5 w-16 rounded-full bg-neutral-200 shadow-[0_0_8px_rgba(255,255,255,0.25)]" />
            </div>
            <div>
              <p className="text-[12px] font-semibold text-white">Pill</p>
              <p className="text-[9px] text-neutral-400">
                Floating Dynamic Island (iOS)
              </p>
            </div>
          </button>

          {/* Notch Option */}
          <button
            type="button"
            onClick={() => updateSettings({ islandStyle: 'notch' })}
            className={`group relative flex flex-col items-center gap-2 rounded-xl p-3 text-center transition-all duration-200 ${
              settings.islandStyle === 'notch'
                ? 'border border-sky-500/40 bg-sky-500/10 text-white shadow-sm'
                : 'bg-neutral-950/60 text-neutral-400 hover:bg-neutral-800/60 hover:text-white'
            }`}
          >
            {/* Visual Mini Preview: Notch */}
            <div className="relative flex h-10 w-full items-start justify-center rounded-lg bg-black/40 overflow-hidden">
              <div className="h-3 w-20 rounded-b-md bg-neutral-200 shadow-[0_2px_8px_rgba(255,255,255,0.25)]" />
            </div>
            <div>
              <p className="text-[12px] font-semibold text-white">Notch</p>
              <p className="text-[9px] text-neutral-400">
                Top Bezel Notch (MacBook / NotchNook)
              </p>
            </div>
          </button>
        </div>
      </div>
      <div className="rounded-2xl bg-neutral-900/90 p-3.5 shadow-sm">
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
          Interaction
        </span>

        <div className="mt-2.5 grid grid-cols-2 gap-1 rounded-xl bg-neutral-950/80 p-1">
          {EXPAND_OPTIONS.map((option) => {
            const Icon = option.icon;
            const isActive = settings.expandTrigger === option.id;

            return (
              <button
                key={option.id}
                type="button"
                onClick={() => updateSettings({ expandTrigger: option.id })}
                aria-pressed={isActive}
                className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-medium transition-colors duration-200 ${
                  isActive
                    ? 'bg-white/[0.09] text-white'
                    : 'text-neutral-500 hover:text-neutral-200'
                }`}
              >
                <Icon size={14} className="h-3.5 w-3.5" />
                <span>{option.label}</span>
              </button>
            );
          })}
        </div>

        <p className="mt-2 text-[10px] leading-relaxed text-neutral-500">
          {settings.expandTrigger === 'hover'
            ? 'Expand when pointer enters, collapse when it leaves. Press Esc or click outside to collapse.'
            : 'Click the island to expand. Click outside or press Esc to collapse.'}
        </p>
      </div>

      {/* Background Transparency & Blur (Efek Glass) */}
      <div className="space-y-3.5 rounded-2xl bg-neutral-900/90 p-3.5 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400">
            <TuningIcon size={14} className="text-sky-400" />
            Glass Background &amp; Blur
          </span>
          <div
            className="flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-[10px] font-medium bg-neutral-800"
            style={{
              backdropFilter: `blur(${settings.backgroundBlur ?? 20}px)`,
            }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.7)]" />
            <span>Glass Active</span>
          </div>
        </div>

        {/* Quick Presets */}
        <div>
          <span className="block text-[11px] font-medium text-neutral-300">Preset Kaca</span>
          <div className="mt-1.5 grid grid-cols-4 gap-1">
            {[
              { label: 'Frosted', opacity: 75, blur: 24 },
              { label: 'Acrylic', opacity: 85, blur: 20 },
              { label: 'Deep', opacity: 92, blur: 12 },
              { label: 'OLED', opacity: 100, blur: 0 },
            ].map((preset) => {
              const isSelected =
                (settings.backgroundOpacity ?? 80) === preset.opacity &&
                (settings.backgroundBlur ?? 20) === preset.blur;
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
                  className={`rounded-lg py-1 text-[10px] font-medium transition-all ${
                    isSelected
                      ? 'border border-sky-500/40 bg-sky-500/20 text-sky-300'
                      : 'bg-neutral-950/60 text-neutral-400 hover:bg-neutral-800/60 hover:text-white'
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Transparency / Opacity Slider */}
        <div className="space-y-1.5 pt-2.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-medium text-neutral-300">Background Opacity</span>
            <span className="font-semibold text-sky-400">
              {settings.backgroundOpacity ?? 80}%
            </span>
          </div>
          <input
            type="range"
            min="60"
            max="100"
            step="1"
            value={settings.backgroundOpacity ?? 80}
            onChange={(e) =>
              updateSettings({
                backgroundOpacity: Number(e.target.value),
              })
            }
            className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-white/10 accent-sky-500"
            aria-label="Background opacity"
          />
          <div className="flex justify-between text-[9px] text-neutral-500">
            <span>60% (Dark Glass)</span>
            <span>100% (Solid OLED)</span>
          </div>
        </div>

        {/* Blur Slider */}
        <div className="space-y-1.5 pt-2.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-medium text-neutral-300">Background Blur</span>
            <span className="font-semibold text-sky-400">
              {settings.backgroundBlur ?? 20}px
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="40"
            step="1"
            value={settings.backgroundBlur ?? 20}
            onChange={(e) =>
              updateSettings({
                backgroundBlur: Number(e.target.value),
              })
            }
            className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-white/10 accent-sky-500"
            aria-label="Background blur intensity"
          />
          <div className="flex justify-between text-[9px] text-neutral-500">
            <span>0px (Jernih)</span>
            <span>40px (Blur Tebal)</span>
          </div>
        </div>

        <p className="text-[10px] leading-relaxed text-neutral-500">
          Pada desktop Windows, transparansi menggunakan material dark-glass adaptif. Untuk keterbacaan teks terbaik di atas jendela lain, gunakan preset Acrylic (85%) atau OLED (100%).
        </p>
      </div>

      {/* Window & behavior */}
      <div className="space-y-3 rounded-2xl bg-neutral-900/90 p-3.5 shadow-sm">
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
          Window &amp; Behavior
        </span>

        <ToggleRow
          icon={<MonitorIcon size={16} className="text-sky-400" />}
          title="Always On Top"
          description="Keep the island above other windows"
          checked={settings.alwaysOnTopEnabled}
          onChange={() =>
            updateSettings({ alwaysOnTopEnabled: !settings.alwaysOnTopEnabled })
          }
          activeClass="bg-sky-500"
        />

        <ToggleRow
          icon={<PowerIcon size={16} className="text-emerald-400" />}
          title="Start With Windows"
          description="Launch automatically on logon"
          checked={settings.autostartEnabled}
          onChange={() =>
            updateSettings({ autostartEnabled: !settings.autostartEnabled })
          }
          activeClass="bg-emerald-500"
        />

        <ToggleRow
          icon={<StarsIcon size={16} className="text-violet-400" />}
          title="Reduced Motion"
          description="Use shorter, simpler transitions"
          checked={settings.reducedMotionEnabled}
          onChange={() =>
            updateSettings({
              reducedMotionEnabled: !settings.reducedMotionEnabled,
            })
          }
          activeClass="bg-violet-500"
        />
      </div>

      {/* Privacy & notifications */}
      <div className="space-y-3 rounded-2xl bg-neutral-900/90 p-3.5 shadow-sm">
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
          Privacy &amp; Notifications
        </span>

        <ToggleRow
          icon={<EyeClosedIcon size={16} className="text-amber-400" />}
          title="Hide Message Preview"
          description="Don't show message text on the island"
          checked={settings.hideNotificationContent}
          onChange={() =>
            updateSettings({
              hideNotificationContent: !settings.hideNotificationContent,
            })
          }
          activeClass="bg-amber-500"
        />

        <div className="space-y-1.5 pt-2.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-medium text-neutral-300">
              Notification Auto-Collapse
            </span>
            <span className="font-semibold text-sky-400">
              {settings.notificationDisplayDuration || 5}s
            </span>
          </div>
          <input
            type="range"
            min="3"
            max="15"
            step="1"
            value={settings.notificationDisplayDuration || 5}
            onChange={(e) =>
              updateSettings({
                notificationDisplayDuration: Number(e.target.value),
              })
            }
            className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-white/10 accent-sky-500"
            aria-label="Notification auto-collapse duration"
          />
        </div>
      </div>

      {/* Weather */}
      <div className="space-y-3 rounded-2xl bg-neutral-900/90 p-3.5 shadow-sm">
        {/* Weather Location */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.04]">
              <MapPointIcon size={16} className="text-sky-400" />
            </span>
            <div>
              <p className="text-[12px] font-semibold text-white">
                Lokasi Cuaca
              </p>
              <p className="text-[10px] text-neutral-500">
                Pilih kota untuk ramalan cuaca
              </p>
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
            className="rounded-lg bg-neutral-800 px-2.5 py-1 text-[11px] text-white outline-none focus:bg-neutral-700"
            aria-label="Weather location"
          >
            {INDONESIA_WEATHER_LOCATIONS.map((loc) => (
              <option key={loc.name} value={loc.name}>
                {loc.name}
              </option>
            ))}
          </select>
        </div>

        {/* Weather Refresh */}
        <div className="flex items-center justify-between gap-3 pt-2.5 border-t border-white/[0.04]">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.04]">
              <RestartIcon size={16} className="text-emerald-400" />
            </span>
            <div>
              <p className="text-[12px] font-semibold text-white">
                Weather Refresh
              </p>
              <p className="text-[10px] text-neutral-500">
                How often forecast data updates
              </p>
            </div>
          </div>

          <select
            value={settings.weatherRefreshInterval}
            onChange={(e) =>
              updateSettings({ weatherRefreshInterval: Number(e.target.value) })
            }
            className="rounded-lg bg-neutral-800 px-2 py-1 text-[11px] text-white outline-none focus:bg-neutral-700"
            aria-label="Weather refresh interval"
          >
            <option value="5">5 min</option>
            <option value="15">15 min</option>
            <option value="30">30 min</option>
            <option value="60">1 hour</option>
          </select>
        </div>
      </div>

      <div className="pt-1 text-center text-[10px] text-neutral-600">
        Dynamic Island for Windows • v1.0.0
      </div>
    </div>
  );
};
