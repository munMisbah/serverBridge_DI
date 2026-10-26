import React from 'react';
import { Monitor, EyeOff, Sparkles, RefreshCw, Power } from 'lucide-react';
import { useIsland } from '../../context/IslandContext';

export const SettingsTab: React.FC = () => {
  const { settings, updateSettings } = useIsland();

  return (
    <div className="space-y-3">
      {/* System & Window Settings */}
      <div className="p-3 bg-neutral-900 rounded-2xl border border-white/5 space-y-3">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 block">
          Window & Behavior
        </span>

        {/* Always on top */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Monitor className="w-4 h-4 text-sky-400 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-white">Always On Top</p>
              <p className="text-[11px] text-neutral-400">Keep widget above other windows</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => updateSettings({ alwaysOnTopEnabled: !settings.alwaysOnTopEnabled })}
            className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
              settings.alwaysOnTopEnabled ? 'bg-sky-500' : 'bg-neutral-700'
            }`}
          >
            <div
              className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                settings.alwaysOnTopEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Autostart */}
        <div className="flex items-center justify-between pt-2 border-t border-white/5">
          <div className="flex items-center gap-2">
            <Power className="w-4 h-4 text-emerald-400 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-white">Start With Windows</p>
              <p className="text-[11px] text-neutral-400">Launch automatically on logon</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => updateSettings({ autostartEnabled: !settings.autostartEnabled })}
            className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
              settings.autostartEnabled ? 'bg-emerald-500' : 'bg-neutral-700'
            }`}
          >
            <div
              className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                settings.autostartEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Reduced Motion */}
        <div className="flex items-center justify-between pt-2 border-t border-white/5">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-violet-400 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-white">Reduced Motion</p>
              <p className="text-[11px] text-neutral-400">Simplify physics and spring effects</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => updateSettings({ reducedMotionEnabled: !settings.reducedMotionEnabled })}
            className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
              settings.reducedMotionEnabled ? 'bg-violet-500' : 'bg-neutral-700'
            }`}
          >
            <div
              className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                settings.reducedMotionEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Notification & Privacy Settings */}
      <div className="p-3 bg-neutral-900 rounded-2xl border border-white/5 space-y-3">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 block">
          Privacy & Notifications
        </span>

        {/* Hide sensitive content */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <EyeOff className="w-4 h-4 text-amber-400 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-white">Hide Message Preview</p>
              <p className="text-[11px] text-neutral-400">Don't show message text on island</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() =>
              updateSettings({ hideNotificationContent: !settings.hideNotificationContent })
            }
            className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
              settings.hideNotificationContent ? 'bg-amber-500' : 'bg-neutral-700'
            }`}
          >
            <div
              className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                settings.hideNotificationContent ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Display Duration slider */}
        <div className="pt-2 border-t border-white/5 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-neutral-300 font-medium">Notification Auto-Collapse:</span>
            <span className="text-sky-400 font-bold">
              {settings.notificationDisplayDuration || 5}s
            </span>
          </div>
          <input
            type="range"
            min="3"
            max="15"
            step="1"
            value={settings.notificationDisplayDuration || 5}
            onChange={(e) =>
              updateSettings({ notificationDisplayDuration: Number(e.target.value) })
            }
            className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
          />
        </div>
      </div>

      {/* Weather Refresh Settings */}
      <div className="p-3 bg-neutral-900 rounded-2xl border border-white/5 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-emerald-400 shrink-0" />
            <p className="text-xs font-semibold text-white">Weather Refresh Interval</p>
          </div>
          <select
            value={settings.weatherRefreshInterval}
            onChange={(e) =>
              updateSettings({ weatherRefreshInterval: Number(e.target.value) })
            }
            className="bg-neutral-800 text-white border border-white/10 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-emerald-500"
          >
            <option value="5">Every 5 minutes</option>
            <option value="15">Every 15 minutes</option>
            <option value="30">Every 30 minutes</option>
            <option value="60">Every 1 hour</option>
          </select>
        </div>
      </div>

      {/* App info */}
      <div className="text-center pt-2 text-[10px] text-neutral-500">
        Dynamic Island for Windows • v1.0.0 • Native Desktop Utility
      </div>
    </div>
  );
};
