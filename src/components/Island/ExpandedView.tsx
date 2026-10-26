import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  LayoutGrid,
  CloudSun,
  Calendar,
  Bell,
  Settings,
} from 'lucide-react';
import { useIsland } from '../../context/IslandContext';
import { OverviewTab } from '../Dashboard/OverviewTab';
import { WeatherTab } from '../Dashboard/WeatherTab';
import { CalendarTab } from '../Dashboard/CalendarTab';
import { NotificationsTab } from '../Dashboard/NotificationsTab';
import { SettingsTab } from '../Dashboard/SettingsTab';

export const ExpandedView: React.FC = () => {
  const { setState, activeTab, setActiveTab, notifications } = useIsland();
  const unreadCount = notifications.filter((n) => n.unread).length;

  // Listen to Escape key to close expanded panel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setState('compact');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setState]);

  interface TabItem {
    id: 'all' | 'weather' | 'calendar' | 'notifications' | 'settings';
    label: string;
    icon: typeof LayoutGrid;
    badge?: number;
  }

  const tabs: TabItem[] = [
    { id: 'all', label: 'All', icon: LayoutGrid },
    { id: 'weather', label: 'Weather', icon: CloudSun },
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { id: 'notifications', label: 'Alerts', icon: Bell, badge: unreadCount },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <motion.div
      className="flex flex-col w-full h-full p-4 text-white select-none"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
    >
      {/* Top Header Bar */}
      <div className="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2">
          {/* iOS Dynamic Island inspired Camera & Sensor Cutout illusion */}
          <div className="w-2.5 h-2.5 rounded-full bg-neutral-900 border border-neutral-700/60 shadow-inner" />
          <span className="text-xs font-bold tracking-tight text-white uppercase">
            Dynamic Island
          </span>
        </div>

        {/* Tab switcher buttons */}
        <div className="flex items-center gap-1 bg-neutral-900/90 p-1 rounded-xl border border-white/5">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-neutral-800 text-white shadow-sm font-semibold'
                    : 'text-neutral-400 hover:text-white hover:bg-neutral-800/40'
                }`}
                title={tab.label}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline text-[11px]">{tab.label}</span>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="w-4 h-4 rounded-full bg-amber-500 text-[10px] font-bold text-black flex items-center justify-center leading-none">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Close Button */}
        <button
          type="button"
          onClick={() => setState('compact')}
          className="w-7 h-7 rounded-full bg-neutral-800/80 hover:bg-neutral-700 flex items-center justify-center text-neutral-400 hover:text-white transition-colors"
          title="Collapse Island (Esc)"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto pt-3">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
          >
            {activeTab === 'all' && <OverviewTab />}
            {activeTab === 'weather' && <WeatherTab />}
            {activeTab === 'calendar' && <CalendarTab />}
            {activeTab === 'notifications' && <NotificationsTab />}
            {activeTab === 'settings' && <SettingsTab />}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
};
