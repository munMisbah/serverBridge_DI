import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
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
import { ISLAND_DIMENSIONS } from './dimensions';

interface TabItem {
  id: 'all' | 'weather' | 'calendar' | 'notifications' | 'settings';
  label: string;
  icon: typeof LayoutGrid;
  badge?: boolean;
}

export const ExpandedView: React.FC = () => {
  const { setState, activeTab, setActiveTab, notifications } = useIsland();
  const unreadCount = notifications.filter((notification) => notification.unread).length;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setState('compact');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setState]);

  const tabs: TabItem[] = [
    { id: 'all', label: 'Overview', icon: LayoutGrid },
    { id: 'weather', label: 'Weather', icon: CloudSun },
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { id: 'notifications', label: 'Notifications', icon: Bell, badge: unreadCount > 0 },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div
      className="absolute left-1/2 top-0 flex -translate-x-1/2 flex-col px-5 pt-4 pb-3.5 text-white"
      style={{
        width: ISLAND_DIMENSIONS.expanded.width,
        height: ISLAND_DIMENSIONS.expanded.height,
      }}
    >
      {/* Main Content Area */}
      <div className="min-h-0 flex-1 overflow-y-auto pr-0.5">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={activeTab}
            className="h-full"
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -3 }}
            transition={{ duration: 0.14, ease: 'easeOut' }}
          >
            {activeTab === 'all' && <OverviewTab />}
            {activeTab === 'weather' && <WeatherTab />}
            {activeTab === 'calendar' && <CalendarTab />}
            {activeTab === 'notifications' && <NotificationsTab />}
            {activeTab === 'settings' && <SettingsTab />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom Menu Navigation Bar (Borderless & Icon-only) */}
      <div className="mt-2.5 flex shrink-0 items-center justify-center pt-1">
        <nav
          aria-label="Island navigation"
          className="flex items-center gap-1.5 rounded-full bg-black/40 p-1 shadow-md backdrop-blur-md"
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                title={tab.label}
                aria-label={tab.label}
                aria-pressed={isActive}
                className={`relative flex h-8 w-8 items-center justify-center rounded-full transition-all duration-200 ${
                  isActive
                    ? 'bg-white/[0.16] text-white shadow-sm scale-105'
                    : 'text-neutral-400 hover:bg-white/[0.08] hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.badge && (
                  <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-amber-400 ring-2 ring-[#09090b]" />
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
};
