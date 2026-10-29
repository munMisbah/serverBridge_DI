import React, { useState } from 'react';
import { IslandProvider, useIsland } from './context/IslandContext';
import { IslandRoot } from './components/Island/IslandRoot';
import { MessageSquare, Bell, Image as ImageIcon } from 'lucide-react';

const IslandControllerBar: React.FC<{
  isTauri: boolean;
  showBackdrop: boolean;
  setShowBackdrop: (v: boolean | ((prev: boolean) => boolean)) => void;
}> = ({ isTauri, showBackdrop, setShowBackdrop }) => {
  const { setState, pushNotification, setAudioPlayback, settings, updateSettings } = useIsland();
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
          updateSettings({
            islandStyle: settings.islandStyle === 'notch' ? 'pill' : 'notch',
          })
        }
        className="flex items-center gap-1 rounded-lg border border-purple-500/30 bg-purple-500/15 px-2.5 py-1 font-semibold text-purple-200 transition-all hover:bg-purple-500/25 active:scale-95"
        title="Ganti Style: Pill vs Notch"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-purple-400" />
        <span>{settings.islandStyle === 'notch' ? 'Style: Notch' : 'Style: Pill'}</span>
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
        showBackdrop && !isTauri ? 'bg-[#08090f]' : 'bg-transparent'
      }`}
    >
      {/* Abstract Modern Fluid Wallpaper Background */}
      {showBackdrop && !isTauri && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {/* Ambient Radial Color Nebulas */}
          <div className="absolute -top-32 -left-20 h-[650px] w-[650px] rounded-full bg-gradient-to-br from-violet-600/30 via-indigo-600/20 to-transparent blur-[120px]" />
          <div className="absolute top-1/4 -right-24 h-[600px] w-[600px] rounded-full bg-gradient-to-bl from-cyan-500/30 via-sky-600/15 to-transparent blur-[110px]" />
          <div className="absolute -bottom-36 left-1/4 h-[550px] w-[700px] rounded-full bg-gradient-to-t from-fuchsia-600/25 via-rose-500/20 to-transparent blur-[130px]" />
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 h-[450px] w-[600px] rounded-full bg-gradient-to-r from-amber-500/15 via-violet-500/20 to-emerald-500/15 blur-[100px]" />

          {/* Abstract Fluid 3D Ribbon / Flowing Curves */}
          <svg
            className="absolute inset-0 h-full w-full object-cover opacity-80"
            viewBox="0 0 1440 900"
            fill="none"
            preserveAspectRatio="xMidYMid slice"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="absGrad1" x1="10%" y1="0%" x2="90%" y2="100%">
                <stop offset="0%" stopColor="#ec4899" stopOpacity="0.75" />
                <stop offset="30%" stopColor="#8b5cf6" stopOpacity="0.7" />
                <stop offset="70%" stopColor="#3b82f6" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.4" />
              </linearGradient>
              <linearGradient id="absGrad2" x1="90%" y1="10%" x2="10%" y2="90%">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.65" />
                <stop offset="40%" stopColor="#f43f5e" stopOpacity="0.6" />
                <stop offset="75%" stopColor="#a855f7" stopOpacity="0.55" />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.3" />
              </linearGradient>
              <linearGradient id="absGrad3" x1="0%" y1="30%" x2="100%" y2="70%">
                <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.6" />
                <stop offset="45%" stopColor="#6366f1" stopOpacity="0.65" />
                <stop offset="85%" stopColor="#d946ef" stopOpacity="0.55" />
                <stop offset="100%" stopColor="#ec4899" stopOpacity="0.4" />
              </linearGradient>
              <filter id="absBlur" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="55" />
              </filter>
            </defs>

            {/* Deep flowing curves */}
            <path
              d="M-100 450 C 220 280, 480 680, 850 360 C 1180 80, 1380 480, 1600 320 L 1600 1000 L -100 1000 Z"
              fill="url(#absGrad1)"
              filter="url(#absBlur)"
              opacity="0.45"
            />
            {/* Dynamic organic abstract ribbon */}
            <path
              d="M120 180 C 380 380, 520 120, 780 300 C 1040 480, 1220 220, 1520 380 C 1320 680, 980 520, 720 720 C 460 920, 260 670, 120 760 Z"
              fill="url(#absGrad2)"
              filter="url(#absBlur)"
              opacity="0.5"
            />
            {/* Vibrant luminous crest */}
            <path
              d="M250 80 C 480 200, 680 240, 800 210 C 980 160, 1150 70, 1320 120 C 1220 380, 960 420, 720 380 C 480 340, 320 260, 250 80 Z"
              fill="url(#absGrad3)"
              filter="url(#absBlur)"
              opacity="0.55"
            />
          </svg>

          {/* Minimalist abstract dot grid texture */}
          <div
            className="absolute inset-0 opacity-[0.035]"
            style={{
              backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.9) 1px, transparent 1px)',
              backgroundSize: '28px 28px',
            }}
          />
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
