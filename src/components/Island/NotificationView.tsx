import React from 'react';
import { motion } from 'framer-motion';
import { X, Bell, Shield, Calendar, Copy, Link as LinkIcon } from 'lucide-react';
import { useIsland } from '../../context/IslandContext';
import { AppNotification } from '../../types';

interface NotificationViewProps {
  notification: AppNotification;
}

export const NotificationView: React.FC<NotificationViewProps> = ({ notification }) => {
  const { dismissNotification, setState, setActiveTab, settings } = useIsland();

  const isWhatsApp =
    notification.appId.toLowerCase().includes('whatsapp') ||
    notification.appName.toLowerCase().includes('whatsapp');

  const renderAppIcon = () => {
    if (isWhatsApp) {
      return (
        <div className="w-8 h-8 rounded-full bg-[#25D366] flex items-center justify-center shrink-0 shadow-md shadow-[#25D366]/30">
          {/* WhatsApp Custom SVG Icon */}
          <svg className="w-4 h-4 fill-white" viewBox="0 0 24 24">
            <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766 0-3.18-2.587-5.771-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.007c.106.005.249-.04.39.299.144.347.491 1.2.534 1.288.043.087.072.188.014.303-.058.116-.087.188-.173.289l-.26.303c-.087.087-.179.182-.077.357.101.174.45 0.744.966 1.204.664.592 1.224.776 1.397.863.174.086.275.072.376-.044.101-.116.433-.506.549-.679.116-.173.231-.144.39-.087s1.011.477 1.184.563c.173.087.289.13.332.202.043.073.043.419-.101.824z" />
          </svg>
        </div>
      );
    }
    if (notification.appId === 'system.clipboard') {
      const isLink = notification.title.toLowerCase().includes('link');
      return (
        <div className="w-8 h-8 rounded-full bg-cyan-600 flex items-center justify-center shrink-0 shadow-md shadow-cyan-600/30">
          {isLink ? <LinkIcon className="w-4 h-4 text-white" /> : <Copy className="w-4 h-4 text-white" />}
        </div>
      );
    }


    if (notification.appId.includes('security') || notification.appName.includes('Security')) {
      return (
        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
          <Shield className="w-4 h-4 text-white" />
        </div>
      );
    }

    if (notification.appId.includes('calendar') || notification.appName.includes('Calendar')) {
      return (
        <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center shrink-0">
          <Calendar className="w-4 h-4 text-white" />
        </div>
      );
    }

    return (
      <div className="w-8 h-8 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center shrink-0">
        <Bell className="w-4 h-4 text-neutral-300" />
      </div>
    );
  };

  const handleClickBody = () => {
    setActiveTab('notifications');
    setState('expanded');
  };

  return (
    <motion.div
      className="flex items-center gap-3 w-full h-full px-3 py-1 text-white select-none cursor-pointer"
      initial={{ opacity: 0, scale: 0.94, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.94, y: -4 }}
      transition={{ type: 'spring', stiffness: 450, damping: 30 }}
      onClick={handleClickBody}
      title="Click to view full notification in dashboard"
    >
      {/* App Icon */}
      {renderAppIcon()}

      {/* Content */}
      <div className="flex-1 min-w-0 pr-1">
        <div className="flex items-center justify-between gap-1 mb-0.5">
          <div className="flex items-center gap-1.5 truncate">
            <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider truncate">
              {notification.appName}
            </span>
            <span className="w-1 h-1 rounded-full bg-neutral-600 shrink-0" />
            <span className="text-xs font-bold text-white truncate">
              {notification.title}
            </span>
          </div>
          <span className="text-[10px] text-neutral-500 shrink-0 font-medium">Just now</span>
        </div>

        <p className="text-xs text-neutral-300 truncate font-normal leading-tight">
          {settings.hideNotificationContent
            ? 'New message received'
            : notification.body || 'No preview available'}
        </p>
      </div>

      {/* Dismiss Button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          dismissNotification(notification.id);
        }}
        className="w-6 h-6 rounded-full bg-neutral-800/80 hover:bg-neutral-700 flex items-center justify-center text-neutral-400 hover:text-white transition-colors shrink-0"
        title="Dismiss notification"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  );
};
