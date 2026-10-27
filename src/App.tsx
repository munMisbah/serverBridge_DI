import React, { useState } from 'react';
import { IslandProvider, useIsland } from './context/IslandContext';
import { IslandRoot } from './components/Island/IslandRoot';
import { MessageSquare, Bell, Image as ImageIcon } from 'lucide-react';

const IslandControllerBar: React.FC<{
  isTauri: boolean;
  showBackdrop: boolean;
  setShowBackdrop: (v: boolean | ((prev: boolean) => boolean)) => void;
}> = ({ isTauri, showBackdrop, setShowBackdrop }) => {
  const { setState, pushNotification, setAudioPlayback } = useIsland();
  // If running in native Tauri desktop mode, hide the web simulator controls
  if (isTauri) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1.5 rounded-2xl border border-white/[0.08] bg-[#09090b]/90 px-3 py-2 text-[11px] text-white shadow-[0_18px_50px_rgba(0,0,0,0.55)] backdrop-blur-xl">
      <span className="mr-1 flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        Preview
      </span>

      <button
        type="button"
        onClick={() => setState('compact')}
        className="rounded-lg bg-white/[0.05] px-2.5 py-1 text-neutral-300 transition-colors hover:bg-white/[0.09] hover:text-white"
      >
        Compact
      </button>

      <button
        type="button"
        onClick={() => setState('expanded')}
        className="rounded-lg bg-white/[0.05] px-2.5 py-1 text-neutral-300 transition-colors hover:bg-white/[0.09] hover:text-white"
      >
        Expanded
      </button>

      <button
        type="button"
        onClick={() =>
          pushNotification({
            appId: 'com.whatsapp.desktop',
            appName: 'WhatsApp',
            title: 'Budi Santoso',
            body: 'Halo! Widget Dynamic Island di Windows 11 ini animasinya responsif banget.',
          })
        }
        className="flex items-center gap-1 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-emerald-300 transition-colors hover:bg-emerald-500/15"
      >
        <MessageSquare className="h-3 w-3" />
        <span>WhatsApp</span>
      </button>

      <button
        type="button"
        onClick={() =>
          pushNotification({
            appId: 'windows.system',
            appName: 'Windows Security',
            title: 'Scan Finished',
            body: 'No threats detected. Windows is fully protected.',
          })
        }
        className="flex items-center gap-1 rounded-lg border border-sky-500/20 bg-sky-500/10 px-2.5 py-1 text-sky-300 transition-colors hover:bg-sky-500/15"
      >
        <Bell className="h-3 w-3" />
        <span>System</span>
      </button>

      <div className="mx-0.5 h-4 w-px bg-white/[0.08]" />

      <button
        type="button"
        onClick={() => {
          setAudioPlayback({
            title: 'Starboy',
            artist: 'The Weeknd, Daft Punk',
            isPlaying: true,
            progress: 0.42,
            duration: 230,
            sourceApp: 'spotify',
          });
          setState('expanded');
        }}
        className="flex items-center gap-1 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-emerald-400 transition-colors hover:bg-emerald-500/15"
        title="Simulasikan lagu dari Spotify"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        <span>Spotify</span>
      </button>

      <button
        type="button"
        onClick={() => {
          setAudioPlayback({
            title: 'Golden Hour',
            artist: 'JVKE',
            isPlaying: true,
            progress: 0.55,
            duration: 209,
            sourceApp: 'youtube',
          });
          setState('expanded');
        }}
        className="flex items-center gap-1 rounded-lg border border-red-500/20 bg-red-500/10 px-2 py-1 text-red-400 transition-colors hover:bg-red-500/15"
        title="Simulasikan lagu dari YouTube"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
        <span>YouTube</span>
      </button>

      <button
        type="button"
        onClick={() => {
          setAudioPlayback({
            title: 'Anti-Hero',
            artist: 'Taylor Swift',
            isPlaying: true,
            progress: 0.28,
            duration: 200,
            sourceApp: 'apple',
          });
          setState('expanded');
        }}
        className="flex items-center gap-1 rounded-lg border border-rose-500/20 bg-rose-500/10 px-2 py-1 text-rose-400 transition-colors hover:bg-rose-500/15"
        title="Simulasikan lagu dari Apple Music"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
        <span>Apple Music</span>
      </button>

      <div className="mx-0.5 h-4 w-px bg-white/[0.08]" />
      <button
        type="button"
        onClick={() => setShowBackdrop((v: boolean) => !v)}
        className="flex items-center gap-1 rounded-lg bg-white/[0.05] px-2.5 py-1 text-neutral-400 transition-colors hover:bg-white/[0.09] hover:text-white"
        title="Toggle Windows 11 wallpaper simulator backdrop"
      >
        <ImageIcon className="h-3 w-3" />
        <span>{showBackdrop ? 'Hide Wallpaper' : 'Show Wallpaper'}</span>
      </button>
    </div>
  );
};

export const AppContent: React.FC = () => {
  const [isTauri] = useState(
    () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
  );
  // In browser preview, show the wallpaper by default for an authentic preview.
  const [showBackdrop, setShowBackdrop] = useState(() => !isTauri);

  return (
    <div
      className={`w-screen h-screen relative select-none overflow-hidden transition-colors ${
        showBackdrop && !isTauri
          ? 'bg-gradient-to-tr from-[#0a1128] via-[#001f54] to-[#034078]'
          : 'bg-transparent'
      }`}
    >
      {/* Windows 11 Bloom aesthetic light effect when backdrop is active */}
      {showBackdrop && !isTauri && (
        <div className="absolute inset-0 pointer-events-none opacity-40">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-gradient-to-b from-sky-400/30 to-violet-500/20 blur-3xl rounded-full" />
        </div>
      )}

      {/* The Dynamic Island itself */}
      <IslandRoot />

      {/* Simulator bar for browser testing */}
      <IslandControllerBar
        isTauri={isTauri}
        showBackdrop={showBackdrop}
        setShowBackdrop={setShowBackdrop}
      />
    </div>
  );
};

export default function App() {
  return (
    <IslandProvider>
      <AppContent />
    </IslandProvider>
  );
}
