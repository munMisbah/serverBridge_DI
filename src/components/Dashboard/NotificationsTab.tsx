import React from 'react';
import { Bell, X } from 'lucide-react';
import { useIsland } from '../../context/IslandContext';

export const NotificationsTab: React.FC = () => {
  const {
    notifications,
    clearAllNotifications,
    dismissNotification,
    settings,
  } = useIsland();

  const formatNotificationTime = (timestamp: number) => {
    const diff = Math.floor((Date.now() - timestamp) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  };

  return (
    <div className="flex h-full flex-col justify-between space-y-2 select-none">
      {/* iOS Header */}
      <div className="flex shrink-0 items-center justify-between px-1">
        <span className="text-[13px] font-semibold tracking-tight text-white/90">
          Notification Center
        </span>

        {notifications.length > 0 && (
          <button
            type="button"
            onClick={clearAllNotifications}
            title="Clear all notifications"
            aria-label="Clear all notifications"
            className="rounded-full bg-white/[0.08] px-2.5 py-0.5 text-[10px] font-medium text-white/70 transition-colors hover:bg-white/[0.15] hover:text-white"
          >
            Clear All
          </button>
        )}
      </div>

      {/* iOS Notifications Stack */}
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {notifications.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center rounded-[22px] border border-white/[0.08] bg-white/[0.03] p-8 text-center backdrop-blur-xl">
            <Bell className="mx-auto mb-2 h-7 w-7 text-white/20" />
            <p className="text-[12px] font-medium text-white/50">
              No Older Notifications
            </p>
            <p className="mt-0.5 text-[10px] text-white/30">
              Incoming Windows notifications will appear here
            </p>
          </div>
        ) : (
          notifications.map((notification) => {
            const isWhatsApp =
              notification.appId.toLowerCase().includes('whatsapp') ||
              notification.appName.toLowerCase().includes('whatsapp');

            return (
              <div
                key={notification.id}
                className="group relative flex items-start justify-between gap-3 rounded-[18px] border border-white/[0.08] bg-white/[0.04] p-3 shadow-lg backdrop-blur-xl transition-all hover:bg-white/[0.07]"
              >
                <div className="flex min-w-0 items-start gap-2.5">
                  <div
                    className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[10px] shadow-sm ${
                      isWhatsApp ? 'bg-[#25D366]' : 'border border-white/10 bg-white/[0.08]'
                    }`}
                  >
                    {isWhatsApp ? (
                      <svg className="h-3.5 w-3.5 fill-white" viewBox="0 0 24 24">
                        <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766 0-3.18-2.587-5.771-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.007c.106.005.249-.04.39.299.144.347.491 1.2.534 1.288.043.087.072.188.014.303-.058.116-.087.188-.173.289l-.26.303c-.087.087-.179.182-.077.357.101.174.45.744.966 1.204.664.592 1.224.776 1.397.863.174.086.275.072.376-.044.101-.116.433-.506.549-.679.116-.173.231-.144.39-.087s1.011.477 1.184.563c.173.087.289.13.332.202.043.07.039.14-.029.245-.068.105-.333.506-.333.506s-.202.245-.332.332c-.13.087-.26.043-.39-.043z" />
                      </svg>
                    ) : (
                      <Bell className="h-3.5 w-3.5 text-white/70" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-white/50">
                        {notification.appName}
                      </span>
                      <span className="text-[10px] text-white/35">•</span>
                      <span className="text-[10px] text-white/40">
                        {formatNotificationTime(notification.receivedAt)}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-[12.5px] font-semibold text-white tracking-tight">
                      {notification.title}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-white/70">
                      {settings.hideNotificationContent
                        ? 'Notification content hidden'
                        : notification.body}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => dismissNotification(notification.id)}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-white/40 opacity-0 transition-all hover:bg-white/[0.15] hover:text-white group-hover:opacity-100"
                  title="Dismiss notification"
                  aria-label="Dismiss notification"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
