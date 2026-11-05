import React, { useEffect, useState } from 'react';
import { SunIcon } from '@solar-icons/react/bold/sun';
import { CloudRainIcon } from '@solar-icons/react/bold/cloud-rain';
import { CloudIcon } from '@solar-icons/react/bold/cloud';
import { CheckCircleIcon } from '@solar-icons/react/bold/check-circle';
import { ClipboardListIcon } from '@solar-icons/react/bold/clipboard-list';
import { MusicNote2Icon } from '@solar-icons/react/bold/music-note-2';
import { BatteryFullIcon } from '@solar-icons/react/bold/battery-full';
import { BatteryHalfIcon } from '@solar-icons/react/bold/battery-half';
import { BatteryLowIcon } from '@solar-icons/react/bold/battery-low';
import { BatteryChargeIcon } from '@solar-icons/react/bold/battery-charge';
import { useIsland } from '../../context/IslandContext';
import { detectMediaApp } from '../../utils/mediaTheme';
import { PixelRoboticEyes } from './PixelRoboticEyes';
import { CompactSlotType } from '../../types';

export const CompactView: React.FC = () => {
  const { weather, settings, audioPlayback, todos, clipboardItems, battery } = useIsland();
  const [now, setNow] = useState(() => new Date());
  const isPlaying = audioPlayback?.isPlaying ?? false;
  const islandStyle = settings.islandStyle || 'pill';

  const activeTheme = detectMediaApp(
    audioPlayback?.sourceApp,
    audioPlayback?.title,
    audioPlayback?.artist
  );
  const AppIcon = activeTheme.renderIcon;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const renderWeatherIcon = () => {
    if (!weather) return <SunIcon size={14} className="text-amber-400" />;

    const code = weather.weatherCode;
    if (code >= 51 && code <= 82) {
      return <CloudRainIcon size={14} className="text-sky-400" />;
    }
    if (code >= 1 && code <= 3) {
      return <CloudIcon size={14} className="text-neutral-300" />;
    }
    return <SunIcon size={14} className="text-amber-400" />;
  };

  // Helper renderers for dynamic slot content
  const renderSlotContent = (slotType: CompactSlotType, isLeft: boolean) => {
    switch (slotType) {
      case 'weather':
        return (
          <div className="flex items-center gap-1.5 shrink-0">
            {renderWeatherIcon()}
            <span className="text-[12px] font-semibold tabular-nums tracking-tight text-neutral-200">
              {weather ? `${weather.temperature}°` : '29°'}
            </span>
          </div>
        );

      case 'clock':
        return (
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-[12px] font-semibold tabular-nums tracking-tight text-neutral-100 font-sans">
              {now.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
              })}
            </span>
          </div>
        );

      case 'todo': {
        const total = todos.length;
        const completed = todos.filter((t) => t.completed).length;
        const allDone = total > 0 && completed === total;
        return (
          <div className="flex items-center gap-1 shrink-0" title={`Todo: ${completed}/${total} selesai`}>
            <CheckCircleIcon size={13} className={allDone ? 'text-emerald-400' : 'text-sky-400'} />
            <span className="text-[11px] font-semibold tabular-nums tracking-tight text-neutral-200 font-sans">
              {total === 0 ? '0' : `${completed}/${total}`}
            </span>
          </div>
        );
      }

      case 'clipboard': {
        const count = clipboardItems.length;
        return (
          <div className="flex items-center gap-1 shrink-0" title={`Clipboard: ${count} item tersimpan`}>
            <ClipboardListIcon size={13} className="text-cyan-400" />
            <span className="text-[11px] font-semibold tabular-nums tracking-tight text-neutral-200 font-sans">
              {count > 0 ? `${count}` : '0'}
            </span>
          </div>
        );
      }

      case 'battery': {
        const system = battery?.system ?? null;
        if (!system) {
          return (
            <div className="flex items-center gap-1 shrink-0" title="Tidak ada baterai sistem">
              <BatteryFullIcon size={13} className="text-neutral-500" />
              <span className="text-[11px] font-semibold text-neutral-400 font-sans">--</span>
            </div>
          );
        }
        const BatteryIcon = system.charging
          ? BatteryChargeIcon
          : system.level > 60
            ? BatteryFullIcon
            : system.level > 20
              ? BatteryHalfIcon
              : BatteryLowIcon;
        const tone =
          system.charging || system.level > 35
            ? 'text-emerald-400'
            : system.level > 15
              ? 'text-amber-400'
              : 'text-red-400';
        return (
          <div
            className="flex items-center gap-1 shrink-0"
            title={`Baterai laptop: ${system.level}%${system.charging ? ' (mengisi daya)' : ''}`}
          >
            <BatteryIcon size={13} className={tone} />
            <span className="text-[11px] font-semibold tabular-nums tracking-tight text-neutral-200 font-sans">
              {system.level}%
            </span>
          </div>
        );
      }

      case 'media':
      default: {
        if (!isPlaying) {
          return (
            <div className="flex items-center gap-1 shrink-0 text-neutral-400">
              <MusicNote2Icon size={13} className="text-neutral-500" />
              <span className="text-[11px] font-medium text-neutral-400">Idle</span>
            </div>
          );
        }

        // Active song playing badge
        return (
          <div className={`flex min-w-0 items-center gap-1.5 shrink-0 ${isLeft ? '' : 'flex-row-reverse'}`}>
            {/* Equalizer 3-bar animated waveform */}
            <div className="flex h-2.5 items-end gap-0.5">
              <span
                className="h-2.5 w-0.5 animate-pulse rounded-full"
                style={{ backgroundColor: activeTheme.accentColor }}
              />
              <span
                className="h-1.5 w-0.5 animate-bounce rounded-full"
                style={{ backgroundColor: activeTheme.accentColor }}
              />
              <span
                className="h-2 w-0.5 animate-pulse rounded-full"
                style={{ backgroundColor: activeTheme.accentColor }}
              />
            </div>

            {/* Album Artwork or Brand SVG App Icon */}
            {audioPlayback?.coverUrl ? (
              <img
                src={audioPlayback.coverUrl}
                alt="Cover"
                className="h-4 w-4 shrink-0 rounded-sm object-cover shadow-sm"
              />
            ) : (
              <div
                className="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm"
                style={{ backgroundColor: `${activeTheme.accentColor}25`, color: activeTheme.accentColor }}
              >
                <AppIcon className="h-2.5 w-2.5" size={10} />
              </div>
            )}

            {/* Song Title (Truncated) */}
            <span className="max-w-[62px] truncate text-[11px] font-semibold text-neutral-100">
              {audioPlayback?.title || 'Playing'}
            </span>
          </div>
        );
      }
    }
  };

  // User slot preferences from settings
  const leftSlotSetting = settings.compactLeftSlot || 'weather';
  const rightSlotSetting = settings.compactRightSlot || 'clock';
  const mediaPlacement = settings.mediaPlacement || 'right';

  // Dynamic slot determination:
  // When music is playing:
  // - If mediaPlacement === 'right' (Default requested by user):
  //   Left slot stays as the user's chosen widget (e.g. Weather or Todo)
  //   Right slot displays the playing song info (replaces clock)!
  // - If mediaPlacement === 'left':
  //   Left slot displays playing song info
  //   Right slot stays as the user's chosen widget!
  // When music is NOT playing:
  //   Left slot displays leftSlotSetting
  //   Right slot displays rightSlotSetting
  const activeLeftSlot: CompactSlotType =
    isPlaying && mediaPlacement === 'left' ? 'media' : leftSlotSetting;
  const activeRightSlot: CompactSlotType =
    isPlaying && mediaPlacement === 'right' ? 'media' : rightSlotSetting;

  return (
    <div
      className="h-full w-full cursor-pointer flex items-center justify-between text-white px-3.5 select-none"
      title={
        settings.expandTrigger === 'hover'
          ? 'Hover to expand'
          : 'Click to expand'
      }
    >
      {/* Dynamic Left Slot */}
      <div className="flex items-center min-w-0 shrink-0">
        {renderSlotContent(activeLeftSlot, true)}
      </div>

      {/* Center: Robotic Pixel Eyes (Global Cursor Tracking) */}
      <div className="flex items-center justify-center pointer-events-auto">
        <PixelRoboticEyes
          size={islandStyle === 'notch' ? 'sm' : 'md'}
        />
      </div>

      {/* Dynamic Right Slot */}
      <div className="flex items-center min-w-0 shrink-0">
        {renderSlotContent(activeRightSlot, false)}
      </div>
    </div>
  );
};
