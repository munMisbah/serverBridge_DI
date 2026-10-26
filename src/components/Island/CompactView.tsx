import React from 'react';
import { motion } from 'framer-motion';
import { Cloud, Sun, CloudRain, Music2, Bell } from 'lucide-react';
import { useIsland } from '../../context/IslandContext';

export const CompactView: React.FC = () => {
  const { weather, audioPlayback, notifications, setState } = useIsland();
  const unreadNotifs = notifications.filter((n) => n.unread).length;

  const [currentTime, setCurrentTime] = React.useState<string>(() => {
    const d = new Date();
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  });

  React.useEffect(() => {
    const timer = setInterval(() => {
      const d = new Date();
      setCurrentTime(d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const getWeatherIcon = () => {
    if (!weather) return <Sun className="w-3.5 h-3.5 text-amber-400" />;
    const code = weather.weatherCode;
    if (code >= 51 && code <= 82) return <CloudRain className="w-3.5 h-3.5 text-sky-400" />;
    if (code >= 1 && code <= 3) return <Cloud className="w-3.5 h-3.5 text-slate-300" />;
    return <Sun className="w-3.5 h-3.5 text-amber-400" />;
  };

  return (
    <motion.div
      className="flex items-center justify-between w-full h-full px-3 py-1 cursor-pointer select-none text-white text-xs font-medium"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      onClick={() => setState('expanded')}
      title="Click to expand Dynamic Island"
    >
      {/* Left side: Weather or Media playing indicator */}
      <div className="flex items-center gap-1.5 shrink-0 pl-0.5">
        {audioPlayback?.isPlaying ? (
          <div className="flex items-center gap-1.5 text-emerald-400">
            <Music2 className="w-3.5 h-3.5 animate-pulse text-emerald-400" />
            <span className="text-[11px] font-semibold tracking-tight text-neutral-200 max-w-[70px] truncate">
              {audioPlayback.title}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-neutral-300 hover:text-white transition-colors">
            {getWeatherIcon()}
            <span className="text-[11px] font-semibold tracking-tight">
              {weather ? `${weather.temperature}°` : '--°'}
            </span>
          </div>
        )}
      </div>

      {/* Center dynamic dot / audio visualizer */}
      <div className="flex items-center justify-center gap-0.5 mx-2">
        {audioPlayback?.isPlaying ? (
          <div className="flex items-end gap-[2px] h-3 px-1">
            <motion.span
              className="w-[2px] bg-emerald-400 rounded-full"
              animate={{ height: ['4px', '12px', '6px', '10px', '4px'] }}
              transition={{ repeat: Infinity, duration: 0.9, ease: 'easeInOut' }}
            />
            <motion.span
              className="w-[2px] bg-emerald-400 rounded-full"
              animate={{ height: ['8px', '4px', '12px', '5px', '8px'] }}
              transition={{ repeat: Infinity, duration: 0.8, ease: 'easeInOut', delay: 0.1 }}
            />
            <motion.span
              className="w-[2px] bg-emerald-400 rounded-full"
              animate={{ height: ['5px', '11px', '3px', '11px', '5px'] }}
              transition={{ repeat: Infinity, duration: 1.0, ease: 'easeInOut', delay: 0.2 }}
            />
          </div>
        ) : (
          <div className="w-1.5 h-1.5 rounded-full bg-neutral-600/70" />
        )}
      </div>

      {/* Right side: Clock & Notification badge */}
      <div className="flex items-center gap-1.5 shrink-0 pr-0.5">
        {unreadNotifs > 0 && (
          <div className="flex items-center gap-0.5 bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full border border-amber-500/30">
            <Bell className="w-2.5 h-2.5 fill-amber-400" />
            <span className="text-[10px] font-bold leading-none">{unreadNotifs}</span>
          </div>
        )}
        <span className="text-[11px] font-semibold tracking-tight text-neutral-200">
          {currentTime}
        </span>
      </div>
    </motion.div>
  );
};
