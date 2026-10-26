import React, { useState, useEffect } from 'react';
import { IslandProvider, useIsland } from './context/IslandContext';
import { IslandRoot } from './components/Island/IslandRoot';
import { MessageSquare, Bell, Image as ImageIcon } from 'lucide-react';

const IslandControllerBar: React.FC<{
  isTauri: boolean;
  showBackdrop: boolean;
  setShowBackdrop: (v: boolean | ((prev: boolean) => boolean)) => void;
}> = ({ isTauri, showBackdrop, setShowBackdrop }) => {
  const { setState, pushNotification } = useIsland();

  // If running in native Tauri desktop mode, hide the web simulator controls
  if (isTauri) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-neutral-900/90 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10 shadow-2xl z-40 text-xs text-white">
      <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mr-1">
        Simulator Bar:
      </span>

      <button
        type="button"
        onClick={() => setState('compact')}
        className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 transition-colors"
      >
        Compact
      </button>

      <button
        type="button"
        onClick={() => setState('expanded')}
        className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 transition-colors"
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
        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/30 transition-colors"
      >
        <MessageSquare className="w-3.5 h-3.5" />
        <span>WhatsApp Test</span>
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
        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-600/30 hover:bg-sky-600/40 text-sky-300 border border-sky-500/30 transition-colors"
      >
        <Bell className="w-3.5 h-3.5" />
        <span>System Test</span>
      </button>

      <div className="w-[1px] h-4 bg-white/10 mx-1" />

      <button
        type="button"
        onClick={() => setShowBackdrop((v: boolean) => !v)}
        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors"
        title="Toggle Windows 11 wallpaper simulator backdrop"
      >
        <ImageIcon className="w-3.5 h-3.5" />
        <span>{showBackdrop ? 'Hide Wallpaper' : 'Show Wallpaper'}</span>
      </button>
    </div>
  );
};

export const AppContent: React.FC = () => {
  const [isTauri, setIsTauri] = useState(false);
  const [showBackdrop, setShowBackdrop] = useState(false);

  useEffect(() => {
    // Detect if running inside Tauri window
    const inTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
    setIsTauri(inTauri);
    // In browser preview, show wallpaper by default for authentic preview
    if (!inTauri) {
      setShowBackdrop(true);
    }
  }, []);

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
