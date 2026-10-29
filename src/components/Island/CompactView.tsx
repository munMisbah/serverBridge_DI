import React, { useEffect, useState } from 'react';
import { Cloud, CloudRain, Sun } from 'lucide-react';
import { useIsland } from '../../context/IslandContext';
import { detectMediaApp } from '../../utils/mediaTheme';
import { PixelRoboticEyes } from './PixelRoboticEyes';

export const CompactView: React.FC = () => {
  const { weather, settings, audioPlayback } = useIsland();
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
      className={`h-full w-full cursor-pointer flex items-center justify-between text-white ${
        islandStyle === 'notch' ? 'px-3.5' : 'px-3.5'
      }`}
      title={
        settings.expandTrigger === 'hover'
          ? 'Hover to expand'
          : 'Click to expand'
      }
    >
      {/* Left Wing: Media Badge & Title, or Weather */}
      {isPlaying ? (
        <div className="flex min-w-0 items-center gap-1.5 shrink-0">
          {audioPlayback?.coverUrl ? (
            <img
              src={audioPlayback.coverUrl}
              alt="Cover"
              className="h-5 w-5 shrink-0 rounded-md object-cover shadow-sm ring-1 ring-white/10"
            />
          ) : (
            <div
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md"
              style={{ backgroundColor: `${activeTheme.accentColor}25`, color: activeTheme.accentColor }}
            >
              <AppIcon className="h-3 w-3" size={12} />
            </div>
          )}
          {islandStyle === 'notch' && (
            <span className="max-w-[65px] truncate text-[11px] font-semibold text-neutral-200">
              {audioPlayback?.title || 'Playing'}
            </span>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-1.5 shrink-0">
          {renderWeatherIcon()}
          <span className="text-[12px] font-semibold tabular-nums tracking-tight text-neutral-200">
            {weather ? `${weather.temperature}°` : '--°'}
          </span>
        </div>
      )}

      {/* Center: Robotic Pixel Eyes (Cursor Tracking & Expressive Animations) */}
      <div className="flex items-center justify-center pointer-events-auto">
        <PixelRoboticEyes
          size={islandStyle === 'notch' ? 'sm' : 'md'}
        />
      </div>

      {/* Right Wing: Animated Equalizer Waveform & Digital Clock */}
      <div className="flex items-center gap-1.5 shrink-0">
        {isPlaying && (
          <div className="flex h-2.5 items-end gap-0.5 mr-0.5">
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
        )}

        <span className="text-[12px] font-semibold tabular-nums tracking-tight text-neutral-100 font-sans">
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
