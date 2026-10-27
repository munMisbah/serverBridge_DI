import React, { useEffect, useState } from 'react';
import {
  Sun,
  Cloud,
  CloudRain,
  CloudLightning,
  Clock as ClockIcon,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  Shuffle,
} from 'lucide-react';
import { useIsland } from '../../context/IslandContext';
import {
  detectMediaApp,
  MEDIA_THEMES,
  SupportedMediaApp,
} from '../../utils/mediaTheme';

export const OverviewTab: React.FC = () => {
  const {
    weather,
    audioPlayback,
    setAudioPlayback,
    setActiveTab,
  } = useIsland();

  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const isTauri =
    typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

  // Active theme based on dynamic app source
  const activeTheme = detectMediaApp(
    audioPlayback?.sourceApp,
    audioPlayback?.title,
    audioPlayback?.artist
  );

  const getWeatherIcon = (code: number | undefined) => {
    if (code === undefined) {
      return <Sun className="h-5 w-5 text-amber-400" />;
    }
    if (code >= 95) {
      return <CloudLightning className="h-5 w-5 text-amber-300" />;
    }
    if (code >= 51 && code <= 82) {
      return <CloudRain className="h-5 w-5 text-sky-400" />;
    }
    if (code >= 1 && code <= 3) {
      return <Cloud className="h-5 w-5 text-neutral-300" />;
    }
    return <Sun className="h-5 w-5 text-amber-400" />;
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Toggle play/pause
  const handleTogglePlayPause = () => {
    if (isTauri) {
      import('@tauri-apps/api/core')
        .then(({ invoke }) => invoke('media_toggle_play_pause'))
        .catch(console.error);
    }
    setAudioPlayback((prev) =>
      prev
        ? { ...prev, isPlaying: !prev.isPlaying }
        : {
            title: activeTheme.sampleTrack.title,
            artist: activeTheme.sampleTrack.artist,
            isPlaying: true,
            progress: 0.1,
            duration: activeTheme.sampleTrack.duration,
            sourceApp: activeTheme.id,
          }
    );
  };

  const handleSkipNext = () => {
    if (isTauri) {
      import('@tauri-apps/api/core')
        .then(({ invoke }) => invoke('media_skip_next'))
        .catch(console.error);
    }
    // In preview/simulation, cycle through apps or skip forward
    handleCycleNextApp();
  };

  const handleSkipPrev = () => {
    if (isTauri) {
      import('@tauri-apps/api/core')
        .then(({ invoke }) => invoke('media_skip_prev'))
        .catch(console.error);
    }
    setAudioPlayback((prev) => (prev ? { ...prev, progress: 0 } : null));
  };

  // Switch between supported media apps (Spotify -> YouTube -> Apple Music -> SoundCloud -> etc.)
  const handleCycleNextApp = () => {
    const appOrder: SupportedMediaApp[] = [
      'spotify',
      'youtube',
      'apple',
      'soundcloud',
      'tidal',
      'chrome',
    ];
    const currentIndex = appOrder.indexOf(activeTheme.id);
    const nextAppId = appOrder[(currentIndex + 1) % appOrder.length];
    const nextTheme = MEDIA_THEMES[nextAppId];

    setAudioPlayback((prev) => ({
      title: nextTheme.sampleTrack.title,
      artist: nextTheme.sampleTrack.artist,
      isPlaying: prev ? prev.isPlaying : true,
      progress: prev ? prev.progress : 0.35,
      duration: nextTheme.sampleTrack.duration,
      sourceApp: nextAppId,
    }));
  };

  const durationSec = audioPlayback?.duration || activeTheme.sampleTrack.duration;
  const currentProgress = audioPlayback?.progress ?? 0.35;
  const elapsedSec = Math.floor(currentProgress * durationSec);
  const isPlaying = audioPlayback?.isPlaying ?? false;

  const AppIcon = activeTheme.renderIcon;

  return (
    <div className="flex h-full gap-3.5 select-none">
      {/* LEFT COLUMN: Jam & Weather (Kotak Persegi) */}
      <div className="flex w-[130px] shrink-0 flex-col justify-between gap-3">
        {/* Kotak Jam (Clock Square Box - Borderless) */}
        <div className="relative flex flex-1 flex-col justify-between overflow-hidden rounded-2xl bg-white/[0.04] p-3 shadow-sm transition-colors duration-200 hover:bg-white/[0.07]">
          {/* OLED subtle corner glow */}
          <div className="pointer-events-none absolute -right-6 -top-6 h-14 w-14 rounded-full bg-sky-500/10 blur-xl" />

          {/* Top: Header with Day and Clock icon */}
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
              <ClockIcon className="h-3 w-3 text-sky-400" />
              {now.toLocaleDateString([], { weekday: 'short' })}
            </span>
            <span className="h-1.5 w-1.5 rounded-full bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.7)]" />
          </div>

          {/* Center: Large Time */}
          <div className="my-auto py-1">
            <p className="text-[26px] font-bold leading-none tabular-nums tracking-tight text-white">
              {now.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
              })}
            </p>
            <p className="mt-1 text-[10px] tabular-nums text-neutral-400 font-medium">
              :{now.getSeconds().toString().padStart(2, '0')} sec
            </p>
          </div>

          {/* Bottom: Date */}
          <div className="pt-1.5 opacity-80">
            <p className="truncate text-[10px] font-medium text-neutral-400">
              {now.toLocaleDateString([], {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </p>
          </div>
        </div>

        {/* Kotak Weather (Weather Square Box - Borderless) */}
        <button
          type="button"
          onClick={() => setActiveTab('weather')}
          title="Lihat detail cuaca"
          className="group relative flex flex-1 flex-col justify-between overflow-hidden rounded-2xl bg-white/[0.04] p-3 text-left shadow-sm transition-all duration-200 hover:bg-white/[0.07]"
        >
          {/* Ambient weather glow */}
          <div className="pointer-events-none absolute -bottom-6 -left-6 h-14 w-14 rounded-full bg-amber-500/10 blur-xl" />

          {/* Top: Weather Icon & Location */}
          <div className="flex items-center justify-between">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-white/[0.06] shadow-sm transition-transform group-hover:scale-105">
              {getWeatherIcon(weather?.weatherCode)}
            </span>
            <span className="max-w-[64px] truncate text-[10px] font-medium text-neutral-400">
              {weather?.locationName?.split(',')[0] || 'Jakarta'}
            </span>
          </div>

          {/* Center: Large Temperature */}
          <div className="my-auto py-1">
            <p className="text-[26px] font-bold leading-none tabular-nums tracking-tight text-white">
              {weather ? `${weather.temperature}°` : '28°'}
            </p>
            <p className="mt-1 truncate text-[10px] font-medium text-neutral-300">
              {weather?.weatherDescription || 'Cerah Berawan'}
            </p>
          </div>

          {/* Bottom: Feels like or high/low */}
          <div className="flex items-center justify-between pt-1.5 text-[10px] text-neutral-400 opacity-80">
            <span>Feels</span>
            <span className="font-semibold text-neutral-300">
              {weather ? `${weather.feelsLike}°` : '29°'}
            </span>
          </div>
        </button>
      </div>

      {/* RIGHT COLUMN: Music / Sound Player Card (Borderless) */}
      <div
        className="relative flex flex-1 min-w-0 flex-col justify-between overflow-hidden rounded-2xl p-4 shadow-xl transition-all duration-300"
        style={{
          background: `radial-gradient(circle at 90% 10%, ${activeTheme.accentColor}22 0%, rgba(255, 255, 255, 0.03) 60%)`,
        }}
      >
        {/* Top: App Indicator Badge & Animated Equalizer Sound Wave */}
        <div className="flex items-center justify-between gap-2">
          {/* Dynamic App Badge with icon & click-to-cycle */}
          <button
            type="button"
            onClick={handleCycleNextApp}
            title={`Aplikasi aktif: ${activeTheme.name}. Klik untuk mengganti aplikasi.`}
            className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all hover:scale-105"
            style={{
              backgroundColor: activeTheme.badgeBg,
              color: activeTheme.badgeText,
              boxShadow: `0 0 12px ${activeTheme.accentColor}25`,
            }}
          >
            <AppIcon className="h-3.5 w-3.5" size={14} />
            <span>{activeTheme.name}</span>
          </button>

          {/* Dynamic Sound Equalizer indicator */}
          <div className="flex items-center gap-1.5 rounded-full bg-black/40 px-2 py-1">
            {/* Animated Equalizer bars */}
            <div className="flex h-3 items-end gap-0.5">
              <span
                className={`w-0.5 rounded-full transition-all duration-300 ${
                  isPlaying ? 'h-3 animate-pulse' : 'h-1.5'
                }`}
                style={{ backgroundColor: activeTheme.accentColor }}
              />
              <span
                className={`w-0.5 rounded-full transition-all duration-200 ${
                  isPlaying ? 'h-2 animate-bounce' : 'h-2'
                }`}
                style={{ backgroundColor: activeTheme.accentColor }}
              />
              <span
                className={`w-0.5 rounded-full transition-all duration-300 ${
                  isPlaying ? 'h-3 animate-pulse' : 'h-1'
                }`}
                style={{ backgroundColor: activeTheme.accentColor }}
              />
              <span
                className={`w-0.5 rounded-full transition-all duration-150 ${
                  isPlaying ? 'h-2.5 animate-bounce' : 'h-1.5'
                }`}
                style={{ backgroundColor: activeTheme.accentColor }}
              />
            </div>
            <span
              className="text-[9px] font-bold uppercase tracking-wider"
              style={{ color: activeTheme.accentColor }}
            >
              {isPlaying ? 'Live' : 'Paused'}
            </span>
          </div>
        </div>

        {/* Center: Track Artwork & Info */}
        <div className="my-auto flex items-center gap-3.5 py-2">
          {/* Dynamic Vinyl / Artwork Icon with theme glow */}
          <div
            className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl shadow-lg transition-transform duration-500"
            style={{
              background: `linear-gradient(135deg, ${activeTheme.accentColor}33 0%, rgba(20,20,24,0.95) 100%)`,
              boxShadow: `0 4px 18px ${activeTheme.accentColor}30`,
            }}
          >
            {/* Spinning center disk when playing */}
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full bg-black/60 shadow-inner ${
                isPlaying ? 'animate-[spin_6s_linear_infinite]' : ''
              }`}
            >
              <AppIcon className="h-4 w-4" size={16} />
            </div>
          </div>

          {/* Track details */}
          <div className="min-w-0 flex-1">
            <h4 className="truncate text-[14px] font-bold leading-snug text-white">
              {audioPlayback?.title || activeTheme.sampleTrack.title}
            </h4>
            <p className="truncate text-[11px] font-medium text-neutral-400">
              {audioPlayback?.artist || activeTheme.sampleTrack.artist}
            </p>
            <p
              className="mt-0.5 truncate text-[9px] font-semibold uppercase tracking-wider opacity-75"
              style={{ color: activeTheme.accentColor }}
            >
              {activeTheme.name} • Windows Audio
            </p>
          </div>
        </div>

        {/* Bottom Section: Progress Bar & Playback Controls */}
        <div className="space-y-2">
          {/* Progress Bar & Timestamps */}
          <div>
            <div
              className="group/seek relative h-1.5 w-full cursor-pointer overflow-hidden rounded-full bg-white/[0.08]"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                setAudioPlayback((prev) => (prev ? { ...prev, progress: pos } : null));
              }}
            >
              <div
                className="h-full rounded-full transition-all duration-150"
                style={{
                  width: `${Math.min(100, Math.max(0, currentProgress * 100))}%`,
                  backgroundColor: activeTheme.accentColor,
                  boxShadow: `0 0 10px ${activeTheme.accentColor}`,
                }}
              />
            </div>

            <div className="mt-1 flex items-center justify-between text-[10px] tabular-nums text-neutral-400">
              <span>{formatSeconds(elapsedSec)}</span>
              <span>{formatSeconds(durationSec)}</span>
            </div>
          </div>

          {/* Controls Bar */}
          <div className="flex items-center justify-between pt-0.5">
            <button
              type="button"
              onClick={handleCycleNextApp}
              title="Ganti aplikasi musik (Spotify, YouTube, Apple Music, dll)"
              className="flex h-7 w-7 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-white/[0.08] hover:text-white"
            >
              <Shuffle className="h-3.5 w-3.5" />
            </button>

            {/* Main Center Controls */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSkipPrev}
                title="Previous track"
                aria-label="Previous track"
                className="flex h-7 w-7 items-center justify-center rounded-full text-neutral-300 transition-all hover:bg-white/[0.08] hover:text-white"
              >
                <SkipBack className="h-3.5 w-3.5" />
              </button>

              {/* Dynamic Themed Play/Pause Button */}
              <button
                type="button"
                onClick={handleTogglePlayPause}
                title={isPlaying ? 'Pause' : 'Play'}
                aria-label={isPlaying ? 'Pause' : 'Play'}
                className="flex h-9 w-9 items-center justify-center rounded-full text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
                style={{
                  backgroundColor: activeTheme.accentColor,
                  boxShadow: `0 0 16px ${activeTheme.accentColor}80`,
                }}
              >
                {isPlaying ? (
                  <Pause className="h-4 w-4 fill-white" />
                ) : (
                  <Play className="ml-0.5 h-4 w-4 fill-white" />
                )}
              </button>

              <button
                type="button"
                onClick={handleSkipNext}
                title="Next track"
                aria-label="Next track"
                className="flex h-7 w-7 items-center justify-center rounded-full text-neutral-300 transition-all hover:bg-white/[0.08] hover:text-white"
              >
                <SkipForward className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="flex items-center gap-1 text-neutral-400">
              <Volume2 className="h-3.5 w-3.5" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
