import React, { useState } from 'react';
import { Trash2, Bell, Send, Shield, Calendar } from 'lucide-react';
import { useIsland } from '../../context/IslandContext';

export const NotificationsTab: React.FC = () => {
  const {
    notifications,
    clearAllNotifications,
    pushNotification,
    dismissNotification,
    settings,
  } = useIsland();

  const [filter, setFilter] = useState<'all' | 'whatsapp' | 'system'>('all');

  const filtered = notifications.filter((notif) => {
    if (filter === 'whatsapp') {
      return (
        notif.appId.toLowerCase().includes('whatsapp') ||
        notif.appName.toLowerCase().includes('whatsapp')
      );
    }
    if (filter === 'system') {
      return !notif.appId.toLowerCase().includes('whatsapp');
    }
    return true;
  });

  const triggerTestNotif = (type: 'whatsapp' | 'system' | 'reminder') => {
    if (type === 'whatsapp') {
      const messages = [
        {
          name: 'Sarah Amanda',
          text: 'Project brief buat Dynamic Island udah siap di Figma ya!',
        },
        {
          name: 'Ahmad Fauzi',
          text: 'Halo bro, ada update terkait build Tauri Windows hari ini?',
        },
        {
          name: 'WhatsApp Group: Dev Team',
          text: 'Commit terbaru sudah di-push. Silakan review PR #42.',
        },
      ];
      const selected = messages[Math.floor(Math.random() * messages.length)];
      pushNotification({
        appId: 'com.whatsapp.desktop',
        appName: 'WhatsApp',
        title: selected.name,
        body: selected.text,
      });
    } else if (type === 'system') {
      pushNotification({
        appId: 'windows.system',
        appName: 'Windows Update',
        title: 'Restart scheduled',
        body: 'Updates have been successfully installed and will apply at next reboot.',
      });
    } else {
      pushNotification({
        appId: 'com.calendar.app',
        appName: 'Calendar',
        title: 'Meeting starts in 10 minutes',
        body: 'Windows 11 Dynamic Island Architecture Discussion',
      });
    }
  };

  const formatNotifTime = (timestamp: number) => {
    const diff = Math.floor((Date.now() - timestamp) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  };

  return (
    <div className="space-y-3">
      {/* Header with Filters & Clear All */}
      <div className="flex items-center justify-between p-2.5 bg-neutral-900 rounded-2xl border border-white/5">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
              filter === 'all' ? 'bg-neutral-800 text-white font-bold' : 'text-neutral-400 hover:text-white'
            }`}
          >
            All ({notifications.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('whatsapp')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
              filter === 'whatsapp'
                ? 'bg-emerald-500/20 text-emerald-400 font-bold'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            WhatsApp
          </button>
          <button
            type="button"
            onClick={() => setFilter('system')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
              filter === 'system'
                ? 'bg-sky-500/20 text-sky-400 font-bold'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            System
          </button>
        </div>

        {notifications.length > 0 && (
          <button
            type="button"
            onClick={clearAllNotifications}
            className="flex items-center gap-1 text-[11px] text-neutral-400 hover:text-rose-400 transition-colors px-2 py-1"
          >
            <Trash2 className="w-3 h-3" />
            <span>Clear</span>
          </button>
        )}
      </div>
      {/* Windows 11 Notification Permission Helper */}
      <div className="flex items-center justify-between p-2.5 bg-neutral-900/60 rounded-xl border border-white/5 text-xs">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-sky-400 shrink-0" />
          <div>
            <p className="font-semibold text-white text-[11px]">Windows Notification Access</p>
            <p className="text-[10px] text-neutral-400">Aktifkan izin akses notifikasi Windows</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
              import('@tauri-apps/api/core').then(({ invoke }) => {
                invoke('open_notification_settings').catch(console.error);
              });
            }
          }}
          className="px-2.5 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 text-[10px] font-semibold transition-colors shrink-0"
        >
          Open Settings
        </button>
      </div>

      {/* Simulator Trigger Buttons */}
      <div className="p-2.5 bg-neutral-900/60 rounded-xl border border-white/5 space-y-1.5">
        <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-500">
          Simulate Windows Notifications:
        </span>
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => triggerTestNotif('whatsapp')}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/20 text-xs font-medium transition-colors"
          >
            <Send className="w-3 h-3" />
            <span>+ WhatsApp Message</span>
          </button>
          <button
            type="button"
            onClick={() => triggerTestNotif('system')}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 text-sky-400 border border-sky-500/20 text-xs font-medium transition-colors"
          >
            <Shield className="w-3 h-3" />
            <span>+ System Alert</span>
          </button>
          <button
            type="button"
            onClick={() => triggerTestNotif('reminder')}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-violet-500/15 hover:bg-violet-500/25 text-violet-400 border border-violet-500/20 text-xs font-medium transition-colors"
          >
            <Calendar className="w-3 h-3" />
            <span>+ Calendar Event</span>
          </button>
        </div>
      </div>

      {/* Notification List */}
      <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
        {filtered.length === 0 ? (
          <div className="text-center py-6">
            <Bell className="w-6 h-6 text-neutral-600 mx-auto mb-1.5" />
            <p className="text-xs text-neutral-400 font-medium">No notifications</p>
            <p className="text-[11px] text-neutral-500 mt-0.5">
              Notifications received from Windows apps will appear here
            </p>
          </div>
        ) : (
          filtered.map((notif) => {
            const isWA =
              notif.appId.toLowerCase().includes('whatsapp') ||
              notif.appName.toLowerCase().includes('whatsapp');
            return (
              <div
                key={notif.id}
                className="p-3 bg-neutral-900/80 rounded-xl border border-white/5 flex items-start justify-between gap-3 group hover:border-white/10 transition-colors"
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                      isWA ? 'bg-[#25D366]' : 'bg-neutral-800'
                    }`}
                  >
                    {isWA ? (
                      <svg className="w-3.5 h-3.5 fill-white" viewBox="0 0 24 24">
                        <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766 0-3.18-2.587-5.771-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.007c.106.005.249-.04.39.299.144.347.491 1.2.534 1.288.043.087.072.188.014.303-.058.116-.087.188-.173.289l-.26.303c-.087.087-.179.182-.077.357.101.174.45 0.744.966 1.204.664.592 1.224.776 1.397.863.174.086.275.072.376-.044.101-.116.433-.506.549-.679.116-.173.231-.144.39-.087s1.011.477 1.184.563c.173.087.289.13.332.202.043.073.043.419-.101.824z" />
                      </svg>
                    ) : (
                      <Bell className="w-3.5 h-3.5 text-neutral-400" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                        {notif.appName}
                      </span>
                      <span className="text-[10px] text-neutral-500">
                        • {formatNotifTime(notif.receivedAt)}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-white truncate mt-0.5">{notif.title}</p>
                    <p className="text-xs text-neutral-300 leading-snug mt-0.5 break-words">
                      {settings.hideNotificationContent
                        ? 'Notification content hidden'
                        : notif.body}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => dismissNotification(notif.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white transition-opacity shrink-0"
                  title="Dismiss"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
