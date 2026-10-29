import React from 'react';
import { X, Bell, Shield, Calendar, Copy, Link as LinkIcon } from 'lucide-react';
import { useIsland } from '../../context/IslandContext';
import { AppNotification } from '../../types';

interface NotificationViewProps {
  notification: AppNotification;
}

export const NotificationView: React.FC<NotificationViewProps> = ({
  notification,
}) => {
  const { dismissNotification, setState, setActiveTab, settings } = useIsland();

  const isWhatsApp =
    notification.appId.toLowerCase().includes('whatsapp') ||
    notification.appName.toLowerCase().includes('whatsapp');

  const renderAppIcon = () => {
    if (isWhatsApp) {
      return (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#25D366]">
          <svg className="h-4 w-4 fill-white" viewBox="0 0 24 24">
            <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766 0-3.18-2.587-5.771-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.007c.106.005.249-.04.39.299.144.347.491 1.2.534 1.288.043.087.072.188.014.303-.058.116-.087.188-.173.289l-.26.303c-.087.087-.179.182-.077.357.101.174.45 0.744.966 1.204.664.592 1.224.776 1.397.863.174.086.275.072.376-.044.101-.116.433-.506.549-.679.116-.173.231-.144.39-.087s1.011.477 1.184.563c.173.087.289.13.332.202.043.073.043.419-.101.824z" />
          </svg>
        </div>
      );
    }

    if (notification.appId === 'system.clipboard') {
      const isLink = notification.title.toLowerCase().includes('link');
      return (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-600">
          {isLink ? (
            <LinkIcon className="h-4 w-4 text-white" />
          ) : (
            <Copy className="h-4 w-4 text-white" />
          )}
        </div>
      );
    }

    if (
      notification.appId.includes('security') ||
      notification.appName.includes('Security')
    ) {
      return (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600">
          <Shield className="h-4 w-4 text-white" />
        </div>
      );
    }

    if (
      notification.appId.includes('calendar') ||
      notification.appName.includes('Calendar')
    ) {
      return (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-600">
          <Calendar className="h-4 w-4 text-white" />
        </div>
      );
    }

    return (
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06]">
        <Bell className="h-4 w-4 text-neutral-300" />
      </div>
    );
  };

  const handleClickBody = () => {
    setActiveTab('notifications');
    setState('expanded');
  };

  return (
    <div
      className="h-full w-full cursor-pointer flex items-center gap-3 px-3.5 text-white"
      onClick={handleClickBody}
      title="Open notification"
    >
      {renderAppIcon()}

      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] font-semibold leading-tight text-white">
          {notification.title}
        </p>
        <p className="mt-0.5 truncate text-[11px] leading-tight text-neutral-400">
          {settings.hideNotificationContent
            ? 'New message received'
            : notification.body || 'No preview available'}
        </p>
      </div>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          dismissNotification(notification.id);
        }}
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-neutral-400 transition-colors hover:bg-white/10 hover:text-white"
        title="Dismiss notification"
        aria-label="Dismiss notification"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};
