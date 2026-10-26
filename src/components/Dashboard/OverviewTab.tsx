import React from 'react';
import {
  Sun,
  Cloud,
  CloudRain,
  Calendar,
  Clock,
  MapPin,
  Play,
  Pause,
  SkipForward,
  ChevronRight,
  Send,
} from 'lucide-react';
import { useIsland } from '../../context/IslandContext';

export const OverviewTab: React.FC = () => {
  const {
    weather,
    events,
    notifications,
    audioPlayback,
    setAudioPlayback,
    setActiveTab,
    pushNotification,
    settings,
  } = useIsland();

  // Find next upcoming event
  const now = Date.now();
  const upcomingEvents = events.filter((e) => e.startAt >= now - 1000 * 60 * 30);
  const nextEvent = upcomingEvents[0];

  const recentNotif = notifications[0];

  const getWeatherIcon = () => {
    if (!weather) return <Sun className="w-5 h-5 text-amber-400" />;
    const code = weather.weatherCode;
    if (code >= 51 && code <= 82) return <CloudRain className="w-5 h-5 text-sky-400" />;
    if (code >= 1 && code <= 3) return <Cloud className="w-5 h-5 text-slate-300" />;
    return <Sun className="w-5 h-5 text-amber-400" />;
  };

  const formatEventTime = (timestamp: number) => {
    const d = new Date(timestamp);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getEventTimeRemaining = (timestamp: number) => {
    const diff = timestamp - Date.now();
    if (diff < 0) return 'Ongoing';
    const minutes = Math.floor(diff / (1000 * 60));
    if (minutes < 60) return `in ${minutes}m`;
    const hours = Math.floor(minutes / 60);
    return `in ${hours}h ${minutes % 60}m`;
  };

  // Demo trigger helper
  const handleSimulateWhatsApp = () => {
    pushNotification({
      appId: 'com.whatsapp.desktop',
      appName: 'WhatsApp',
      title: 'Dewi Lestari',
      body: 'Meetingnya jadi jam 14:00 di Teams ya, jangan lupa siapin decknya!',
    });
  };

  return (
    <div className="space-y-3">
      {/* Top 2-Column Grid: Weather & Next Agenda */}
      <div className="grid grid-cols-2 gap-2.5">
        {/* Weather Mini Card */}
        <div
          onClick={() => setActiveTab('weather')}
          className="group relative p-3 bg-neutral-900/80 hover:bg-neutral-800/90 rounded-2xl border border-white/5 hover:border-white/10 transition-all cursor-pointer flex flex-col justify-between overflow-hidden shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold tracking-wider uppercase text-neutral-400">
              Weather
            </span>
            <div className="p-1 rounded-full bg-neutral-800 group-hover:bg-neutral-700 transition-colors">
              {getWeatherIcon()}
            </div>
          </div>

          <div className="mt-2">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold tracking-tight text-white">
                {weather ? `${weather.temperature}°` : '--°'}
              </span>
              <span className="text-xs text-neutral-400">
                {weather?.weatherDescription || 'Loading...'}
              </span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-neutral-400 mt-1 truncate">
              <MapPin className="w-3 h-3 text-neutral-500 shrink-0" />
              <span className="truncate">{weather?.locationName || 'Location'}</span>
            </div>
          </div>
        </div>

        {/* Next Event Mini Card */}
        <div
          onClick={() => setActiveTab('calendar')}
          className="group relative p-3 bg-neutral-900/80 hover:bg-neutral-800/90 rounded-2xl border border-white/5 hover:border-white/10 transition-all cursor-pointer flex flex-col justify-between overflow-hidden shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold tracking-wider uppercase text-neutral-400">
              Up Next
            </span>
            <div className="p-1 rounded-full bg-neutral-800 group-hover:bg-neutral-700 transition-colors">
              <Calendar className="w-4 h-4 text-violet-400" />
            </div>
          </div>

          <div className="mt-2">
            {nextEvent ? (
              <>
                <p className="text-xs font-bold text-white truncate">{nextEvent.title}</p>
                <div className="flex items-center gap-1 text-[11px] text-violet-300 mt-1">
                  <Clock className="w-3 h-3 shrink-0" />
                  <span>
                    {formatEventTime(nextEvent.startAt)} ({getEventTimeRemaining(nextEvent.startAt)})
                  </span>
                </div>
              </>
            ) : (
              <p className="text-xs text-neutral-400 italic">No events planned</p>
            )}
          </div>
        </div>
      </div>

      {/* Media Player Card */}
      {audioPlayback && (
        <div className="p-3 bg-neutral-900/80 rounded-2xl border border-white/5 flex items-center justify-between gap-3 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-neutral-800 to-neutral-950 border border-white/10 flex items-center justify-center shrink-0 shadow-inner">
            <div className="w-3 h-3 rounded-full bg-emerald-500/80 animate-ping" />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-white truncate">{audioPlayback.title}</p>
            <p className="text-[11px] text-neutral-400 truncate">{audioPlayback.artist}</p>
            {/* Progress line */}
            <div className="w-full bg-neutral-800 h-1 rounded-full mt-2 overflow-hidden">
              <div
                className="bg-emerald-400 h-full rounded-full transition-all duration-300"
                style={{ width: `${audioPlayback.progress * 100}%` }}
              />
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
                  import('@tauri-apps/api/core').then(({ invoke }) => {
                    invoke('media_toggle_play_pause').catch(console.error);
                  });
                }
                setAudioPlayback((prev) =>
                  prev ? { ...prev, isPlaying: !prev.isPlaying } : null
                );
              }}
              className="w-8 h-8 rounded-full bg-neutral-800 hover:bg-neutral-700 text-white flex items-center justify-center transition-colors"
              title={audioPlayback.isPlaying ? 'Pause' : 'Play'}
            >
              {audioPlayback.isPlaying ? (
                <Pause className="w-3.5 h-3.5 fill-white" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-white ml-0.5" />
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
                  import('@tauri-apps/api/core').then(({ invoke }) => {
                    invoke('media_skip_next').catch(console.error);
                  });
                }
              }}
              className="w-8 h-8 rounded-full bg-neutral-800/60 hover:bg-neutral-700 text-neutral-400 hover:text-white flex items-center justify-center transition-colors"
              title="Next Track"
            >
              <SkipForward className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Latest Notification Snippet & Quick Simulator */}
      <div className="p-3 bg-neutral-900/80 rounded-2xl border border-white/5 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold tracking-wider uppercase text-neutral-400">
            Recent Notification
          </span>
          <button
            type="button"
            onClick={() => setActiveTab('notifications')}
            className="flex items-center gap-0.5 text-[11px] text-neutral-400 hover:text-white transition-colors"
          >
            <span>View all</span>
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>

        {recentNotif ? (
          <div
            onClick={() => setActiveTab('notifications')}
            className="flex items-center gap-2.5 p-2 rounded-xl bg-neutral-800/50 hover:bg-neutral-800 cursor-pointer transition-colors"
          >
            <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between text-xs font-semibold text-white">
                <span className="truncate">{recentNotif.title}</span>
                <span className="text-[10px] text-neutral-500 font-normal">
                  {recentNotif.appName}
                </span>
              </div>
              <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                {settings.hideNotificationContent ? 'Notification received' : recentNotif.body}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-xs text-neutral-400 italic">No notifications yet</p>
        )}

        {/* Quick action bar */}
        <div className="pt-1 flex items-center justify-between border-t border-white/5">
          <span className="text-[10px] text-neutral-500">Test Dynamic Island trigger:</span>
          <button
            type="button"
            onClick={handleSimulateWhatsApp}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-[11px] font-medium transition-colors"
          >
            <Send className="w-3 h-3" />
            <span>Simulate WhatsApp</span>
          </button>
        </div>
      </div>
    </div>
  );
};
