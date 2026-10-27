import React from 'react';
import { Trash2, Bell } from 'lucide-react';
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
    <div className="flex h-full flex-col space-y-2.5">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between px-1">
        <span className="text-[12px] font-semibold tracking-tight text-white">
          Notification
        </span>

        <button
          type="button"
          onClick={clearAllNotifications}
          disabled={notifications.length === 0}
          title={
            notifications.length > 0
              ? 'Clear all notifications'
              : 'No notifications to clear'
          }
          aria-label="Clear all notifications"
          className={`flex items-center justify-center rounded-lg p-1.5 transition-colors ${
            notifications.length > 0
              ? 'text-neutral-400 hover:bg-white/[0.08] hover:text-rose-400'
              : 'cursor-not-allowed text-neutral-600 opacity-40'
          }`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      {/* List */}
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {notifications.length === 0 ? (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-8 text-center">
            <Bell className="mx-auto mb-2 h-6 w-6 text-neutral-700" />
            <p className="text-[11px] font-medium text-neutral-400">
              No notifications
            </p>
            <p className="mt-1 text-[10px] text-neutral-600">
              Windows app notifications will appear here
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
                className="group flex items-start justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] p-2.5 transition-colors hover:bg-white/[0.05]"
              >
                <div className="flex min-w-0 items-start gap-2.5">
                  <div
                    className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                      isWhatsApp ? 'bg-[#25D366]' : 'border border-white/10 bg-white/[0.05]'
                    }`}
                  >
                    {isWhatsApp ? (
                      <svg className="h-3.5 w-3.5 fill-white" viewBox="0 0 24 24">
                        <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766 0-3.18-2.587-5.771-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.007c.106.005.249-.04.39.299.144.347.491 1.2.534 1.288.043.087.072.188.014.303-.058.116-.087.188-.173.289l-.26.303c-.087.087-.179.182-.077.357.101.174.45 0.744.966 1.204.664.592 1.224.776 1.397.863.174.086.275.072.376-.044.101-.116.433-.506.549-.679.116-.173.231-.144.39-.087s1.011.477 1.184.563c.173.087.289.13.332.202.043.073.043.419-.101.824z" />
                      </svg>
                    ) : (
                      <Bell className="h-3.5 w-3.5 text-neutral-400" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-neutral-500">
                        {notification.appName}
                      </span>
                      <span className="text-[9px] text-neutral-600">
                        {formatNotificationTime(notification.receivedAt)}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-[11px] font-semibold text-white">
                      {notification.title}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-neutral-400">
                      {settings.hideNotificationContent
                        ? 'Notification content hidden'
                        : notification.body}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => dismissNotification(notification.id)}
                  className="shrink-0 rounded-md p-1 text-neutral-600 opacity-0 transition-all hover:bg-rose-500/10 hover:text-rose-400 group-hover:opacity-100"
                  title="Dismiss"
                  aria-label="Dismiss notification"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
