import React from 'react';
import { useIsland } from '../../context/IslandContext';
import {
  detectMediaApp,
  MEDIA_THEMES,
  SupportedMediaApp,
} from '../../utils/mediaTheme';

export const OverviewTab: React.FC = () => {
  const { audioPlayback, setAudioPlayback } = useIsland();

  const isTauri =
    typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

  const activeTheme = detectMediaApp(
    audioPlayback?.sourceApp,
    audioPlayback?.title,
    audioPlayback?.artist
  );

  const durationSec = audioPlayback?.duration || activeTheme.sampleTrack.duration;
  const currentProgress = audioPlayback?.progress ?? 0.35;
  const elapsedSec = Math.floor(currentProgress * durationSec);
  const remainingSec = Math.max(0, durationSec - elapsedSec);
  const isPlaying = audioPlayback?.isPlaying ?? false;

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

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
      coverUrl: nextTheme.sampleTrack.coverUrl,
    }));
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setAudioPlayback((prev) => (prev ? { ...prev, progress: pos } : null));
  };

  const AppIcon = activeTheme.renderIcon;

  return (
    <div className="flex h-full w-full flex-col justify-between px-5 pt-4 pb-3 select-none text-white">
      {/* Top Header: Artwork, Title, Artist, and 6-bar Waveform (skiper2 style) */}
      <div className="flex items-center gap-3">
        {/* Album Artwork: squircle size-14 rounded-2xl */}
        <div
          onClick={handleCycleNextApp}
          title={`Active app: ${activeTheme.name}. Click to cycle app.`}
          className="group relative size-13 shrink-0 cursor-pointer overflow-hidden rounded-[16px] shadow-lg transition-transform active:scale-95"
          style={{
            background: `linear-gradient(135deg, ${activeTheme.accentColor} 0%, #15151e 100%)`,
            boxShadow: `0 4px 14px ${activeTheme.accentColor}35`,
          }}
        >
          {audioPlayback?.coverUrl ? (
            <img
              src={audioPlayback.coverUrl}
              alt={audioPlayback.title || 'Album Art'}
              className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex size-full items-center justify-center transition-transform duration-300 group-hover:scale-105">
              <AppIcon className="size-6 text-white" />
            </div>
          )}

          {/* Mini App Badge */}
          <div
            className="absolute bottom-0.5 right-0.5 flex size-3.5 items-center justify-center rounded-full shadow"
            style={{ backgroundColor: activeTheme.badgeBg }}
          >
            <AppIcon className="size-2 text-white" />
          </div>
        </div>

        {/* Track Title & Artist */}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[15px] font-semibold text-white leading-tight">
            {audioPlayback?.title || activeTheme.sampleTrack.title}
          </h1>
          <p className="truncate text-[13px] font-normal text-neutral-400 leading-tight mt-1">
            {audioPlayback?.artist || activeTheme.sampleTrack.artist}
          </p>
        </div>

        {/* Skiper2 6-bar Animated Waveform */}
        <div className="flex h-[18px] items-center gap-[3px] shrink-0 pl-1">
          <span
            className={`w-[3px] rounded-full transition-all duration-300 ${
              isPlaying ? 'h-3 animate-pulse' : 'h-1.5'
            }`}
            style={{ backgroundColor: activeTheme.accentColor || '#60a5fa' }}
          />
          <span
            className={`w-[3px] rounded-full transition-all duration-200 ${
              isPlaying ? 'h-4 animate-bounce' : 'h-3'
            }`}
            style={{ backgroundColor: activeTheme.accentColor || '#60a5fa' }}
          />
          <span
            className={`w-[3px] rounded-full transition-all duration-300 ${
              isPlaying ? 'h-3.5 animate-pulse' : 'h-2'
            }`}
            style={{ backgroundColor: activeTheme.accentColor || '#60a5fa' }}
          />
          <span
            className={`w-[3px] rounded-full transition-all duration-150 ${
              isPlaying ? 'h-2.5 animate-bounce' : 'h-1.5'
            }`}
            style={{ backgroundColor: activeTheme.accentColor || '#60a5fa' }}
          />
          <span
            className={`w-[3px] rounded-full transition-all duration-250 ${
              isPlaying ? 'h-1.5 animate-pulse' : 'h-1'
            }`}
            style={{ backgroundColor: activeTheme.accentColor || '#60a5fa' }}
          />
          <span
            className={`w-[3px] rounded-full transition-all duration-200 ${
              isPlaying ? 'h-3 animate-bounce' : 'h-2'
            }`}
            style={{ backgroundColor: activeTheme.accentColor || '#60a5fa' }}
          />
        </div>
      </div>

      {/* Middle: Scrubber and Monospace Tabular Timestamps */}
      <div className="mt-2.5 flex items-center justify-between gap-2.5 text-xs text-neutral-400">
        <span className="tabular-nums font-mono text-[11px] text-neutral-400">
          {formatSeconds(elapsedSec)}
        </span>
        <div
          className="group relative flex h-3.5 flex-1 cursor-pointer items-center select-none"
          onClick={handleSeek}
          title="Click to seek"
        >
          <div className="h-1.5 w-full rounded-full bg-neutral-800 transition-all group-hover:h-2 overflow-hidden">
            <div
              className="h-full rounded-full bg-neutral-200 transition-all duration-100"
              style={{ width: `${currentProgress * 100}%` }}
            />
          </div>
        </div>
        <span className="tabular-nums font-mono text-[11px] text-neutral-400">
          -{formatSeconds(remainingSec)}
        </span>
      </div>

      {/* Bottom: Skiper2 Playback Controls */}
      <div className="mt-1 flex items-center justify-center gap-8 text-neutral-300">
        {/* Previous Track Button */}
        <button
          type="button"
          onClick={handleSkipPrev}
          className="size-6 flex items-center justify-center transition-colors hover:text-white active:scale-90"
          title="Previous"
          aria-label="Previous"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 16 16"
            className="size-5 fill-current"
            style={{ transform: 'scaleX(-1)' }}
          >
            <path d="M7.596 7.304a.802.802 0 0 1 0 1.392l-6.363 3.692C.713 12.69 0 12.345 0 11.692V4.308c0-.653.713-.998 1.233-.696z" />
            <path d="M15.596 7.304a.802.802 0 0 1 0 1.392l-6.363 3.692C8.713 12.69 8 12.345 8 11.692V4.308c0-.653.713-.998 1.233-.696z" />
          </svg>
        </button>

        {/* Center Play/Pause Button */}
        <button
          type="button"
          onClick={handleTogglePlayPause}
          className="size-7 flex items-center justify-center transition-transform hover:scale-110 active:scale-90 text-white"
          title={isPlaying ? 'Pause' : 'Play'}
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <svg viewBox="0 0 10 13" fill="none" className="size-5 fill-current">
              <path d="M1.03906 12.7266H2.82031C3.5 12.7266 3.85938 12.3672 3.85938 11.6797V1.03906C3.85938 0.328125 3.5 0 2.82031 0H1.03906C0.359375 0 0 0.359375 0 1.03906V11.6797C0 12.3672 0.359375 12.7266 1.03906 12.7266ZM6.71875 12.7266H8.49219C9.17969 12.7266 9.53125 12.3672 9.53125 11.6797V1.03906C9.53125 0.328125 9.17969 0 8.49219 0H6.71875C6.03125 0 5.67188 0.359375 5.67188 1.03906V11.6797C5.67188 12.7266 6.03125 12.7266 6.71875 12.7266Z" />
            </svg>
          ) : (
            <svg viewBox="0 0 10 13" fill="none" className="size-5 fill-current ml-0.5">
              <path d="M9.41406 5.86719L1.91406 0.867188C1.25781 0.429688 0.40625 0.898438 0.40625 1.6875V11.6875C0.40625 12.4766 1.25781 12.9453 1.91406 12.5078L9.41406 7.50781C10.0391 7.08594 10.0391 6.28906 9.41406 5.86719Z" />
            </svg>
          )}
        </button>

        {/* Next Track Button */}
        <button
          type="button"
          onClick={handleSkipNext}
          className="size-6 flex items-center justify-center transition-colors hover:text-white active:scale-90"
          title="Next"
          aria-label="Next"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" className="size-5 fill-current">
            <path d="M7.596 7.304a.802.802 0 0 1 0 1.392l-6.363 3.692C.713 12.69 0 12.345 0 11.692V4.308c0-.653.713-.998 1.233-.696z" />
            <path d="M15.596 7.304a.802.802 0 0 1 0 1.392l-6.363 3.692C8.713 12.69 8 12.345 8 11.692V4.308c0-.653.713-.998 1.233-.696z" />
          </svg>
        </button>
      </div>
    </div>
  );
};
