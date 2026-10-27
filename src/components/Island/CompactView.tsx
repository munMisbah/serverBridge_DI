import React, { useEffect, useState } from 'react';
import { Cloud, CloudRain, Sun } from 'lucide-react';
import { useIsland } from '../../context/IslandContext';
import { ISLAND_DIMENSIONS } from './dimensions';
import { detectMediaApp } from '../../utils/mediaTheme';
export const CompactView: React.FC = () => {
  const { weather, notifications, settings, audioPlayback } = useIsland();
  const [now, setNow] = useState(() => new Date());
  const hasUnread = notifications.some((notification) => notification.unread);
  const isPlaying = audioPlayback?.isPlaying ?? false;
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
    if (!weather) return <Sun className="h-3.5 w-3.5 text-amber-400" />;

    const code = weather.weatherCode;
    if (code >= 51 && code <= 82) {
      return <CloudRain className="h-3.5 w-3.5 text-sky-400" />;
    }
    if (code >= 1 && code <= 3) {
      return <Cloud className="h-3.5 w-3.5 text-neutral-300" />;
    }
    return <Sun className="h-3.5 w-3.5 text-amber-400" />;
  };

  return (
    <div
      className="absolute left-1/2 top-0 flex -translate-x-1/2 cursor-pointer items-center justify-between px-4 text-white"
      style={{
        width: ISLAND_DIMENSIONS.compact.width,
        height: ISLAND_DIMENSIONS.compact.height,
      }}
      title={
        settings.expandTrigger === 'hover'
          ? 'Hover to expand'
          : 'Click to expand'
      }
    >
      {isPlaying ? (
        <div className="flex items-center gap-1.5">
          <span style={{ color: activeTheme.accentColor }}>
            <AppIcon className="h-3.5 w-3.5" size={14} />
          </span>
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
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          {renderWeatherIcon()}
          <span className="text-[12px] font-semibold tabular-nums tracking-tight text-neutral-200">
            {weather ? `${weather.temperature}°` : '--°'}
          </span>
        </div>
      )}

      <div className="flex items-center gap-1.5">
        {hasUnread && (
          <span
            className="h-1.5 w-1.5 rounded-full bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.55)]"
            aria-label="Unread notifications"
          />
        )}
        <span className="text-[12px] font-semibold tabular-nums tracking-tight text-neutral-100">
          {now.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          })}
        </span>
      </div>
    </div>
  );
};
