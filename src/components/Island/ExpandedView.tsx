import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MusicNote2Icon } from '@solar-icons/react/bold/music-note-2';
import { CloudSun2Icon } from '@solar-icons/react/bold/cloud-sun-2';
import { CalendarDateIcon } from '@solar-icons/react/bold/calendar-date';
import { BellIcon } from '@solar-icons/react/bold/bell';
import { ClipboardListIcon } from '@solar-icons/react/bold/clipboard-list';
import { ChecklistIcon } from '@solar-icons/react/bold/checklist';
import { TodoTab } from '../Dashboard/TodoTab';
import { useIsland } from '../../context/IslandContext';
import { OverviewTab } from '../Dashboard/OverviewTab';
import { WeatherTab } from '../Dashboard/WeatherTab';
import { CalendarTab } from '../Dashboard/CalendarTab';
import { NotificationsTab } from '../Dashboard/NotificationsTab';
import { ClipboardTab } from '../Dashboard/ClipboardTab';
import { ActiveTab } from '../../types';
interface TabItem {
  id: ActiveTab;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  badge?: boolean;
}

const TAB_ORDER: ActiveTab[] = [
  'todo',
  'all',
  'weather',
  'calendar',
  'notifications',
  'clipboard',
];

export const ExpandedView: React.FC = () => {
  const { setState, activeTab, setActiveTab, notifications, settings } = useIsland();
  const unreadCount = notifications.filter((notification) => notification.unread).length;

  const [isNavHovered, setIsNavHovered] = useState(false);
  const [slideDirection, setSlideDirection] = useState<1 | -1>(1);
  const lastWheelTime = useRef(0);

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
    { id: 'todo', label: 'Todo', icon: ChecklistIcon },
    { id: 'all', label: 'Music', icon: MusicNote2Icon },
    { id: 'weather', label: 'Weather', icon: CloudSun2Icon },
    { id: 'calendar', label: 'Calendar', icon: CalendarDateIcon },
    { id: 'notifications', label: 'Alerts', icon: BellIcon, badge: unreadCount > 0 },
    { id: 'clipboard', label: 'Clipboard', icon: ClipboardListIcon },
  ];

  const handleSelectTab = (tabId: (typeof TAB_ORDER)[number]) => {
    const currentIdx = TAB_ORDER.indexOf(activeTab);
    const targetIdx = TAB_ORDER.indexOf(tabId);
    setSlideDirection(targetIdx >= currentIdx ? 1 : -1);
    setActiveTab(tabId);
  };

  // Wheel scrolling tab switcher (Trial mode: scroll down = slide right, scroll up = slide left)
  const handleWheel = (e: React.WheelEvent) => {
    // If inside an inner scrollable container (e.g. settings list or events list), let it scroll naturally
    const target = e.target as HTMLElement | null;
    const scrollableParent = target?.closest('.overflow-y-auto');
    if (scrollableParent) {
      const { scrollTop, scrollHeight, clientHeight } = scrollableParent;
      const canScrollDown = scrollTop + clientHeight < scrollHeight - 2;
      const canScrollUp = scrollTop > 2;
      if (e.deltaY > 0 && canScrollDown) return;
      if (e.deltaY < 0 && canScrollUp) return;
    }

    const scrollableParentX = target?.closest('.overflow-x-auto') as HTMLElement | null;
    if (scrollableParentX) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollableParentX;
      const canScrollRight = scrollLeft + clientWidth < scrollWidth - 2;
      const canScrollLeft = scrollLeft > 2;
      const wheelVal = e.deltaY || e.deltaX;
      if (wheelVal > 0 && canScrollRight) return;
      if (wheelVal < 0 && canScrollLeft) return;
    }

    const now = Date.now();
    if (now - lastWheelTime.current < 280) return; // throttle 280ms

    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (Math.abs(delta) < 15) return;

    const currentIdx = TAB_ORDER.indexOf(activeTab);

    // scroll down / right = slide right (next tab)
    if (delta > 0 && currentIdx < TAB_ORDER.length - 1) {
      lastWheelTime.current = now;
      setSlideDirection(1);
      setActiveTab(TAB_ORDER[currentIdx + 1]);
    }
    // scroll up / left = slide left (previous tab)
    else if (delta < 0 && currentIdx > 0) {
      lastWheelTime.current = now;
      setSlideDirection(-1);
      setActiveTab(TAB_ORDER[currentIdx - 1]);
    }
  };

  const slideVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 24 : -24,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (dir: number) => ({
      x: dir > 0 ? -24 : 24,
      opacity: 0,
    }),
  };

  return (
    <div
      onWheel={handleWheel}
      className="relative flex h-full w-full flex-col select-none text-white"
    >
      {/* Content Area with smooth sliding transition */}
      <div className="min-h-0 flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait" initial={false} custom={slideDirection}>
          <motion.div
            key={activeTab}
            custom={slideDirection}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              duration: settings.reducedMotionEnabled ? 0.12 : 0.18,
              ease: [0.25, 1, 0.5, 1],
            }}
            className="h-full w-full"
          >
            {activeTab === 'todo' && <TodoTab />}
            {activeTab === 'all' && <OverviewTab />}
            {activeTab === 'weather' && <WeatherTab />}
            {activeTab === 'calendar' && <CalendarTab />}
            {activeTab === 'notifications' && (
              <div className="h-full w-full overflow-y-auto px-4 py-3">
                <NotificationsTab />
              </div>
            )}
            {activeTab === 'clipboard' && (
              <div className="h-full w-full overflow-hidden px-3.5 py-2">
                <ClipboardTab />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* 2-State Navigation Switcher: State 1 = Pagination Dotted UI; State 2 on hover = Full Icon Tab */}
      <div className="flex shrink-0 items-center justify-center pb-2 pt-0.5">
        <motion.div
          layout
          onMouseEnter={() => setIsNavHovered(true)}
          onMouseLeave={() => setIsNavHovered(false)}
          id="dock-switcher"
          className="flex items-center justify-center rounded-full bg-neutral-900/95 p-1 shadow-2xl cursor-pointer overflow-hidden"
          transition={{
            type: 'spring',
            stiffness: 420,
            damping: 22,
            mass: 0.75,
          }}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            {!isNavHovered ? (
              /* State 1: Dotted Pagination UI */
              <motion.div
                key="dots"
                initial={{ opacity: 0, scale: 0.8, filter: 'blur(3px)' }}
                animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0, scale: 0.8, filter: 'blur(3px)' }}
                transition={{
                  type: 'spring',
                  stiffness: 460,
                  damping: 24,
                }}
                className="flex items-center gap-1.5 px-2 py-0.5"
              >
                {tabs.map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectTab(tab.id);
                      }}
                      title={tab.label}
                      className="relative p-0.5 cursor-pointer"
                    >
                      <motion.span
                        layout
                        transition={{
                          type: 'spring',
                          stiffness: 500,
                          damping: 26,
                        }}
                        className={`block rounded-full ${
                          isActive
                            ? 'h-1.5 w-3.5 bg-white shadow-[0_0_8px_rgba(255,255,255,0.75)]'
                            : 'h-1.5 w-1.5 bg-white/35 hover:bg-white/70'
                        }`}
                      />
                      {tab.badge && (
                        <span className="absolute -top-0.5 -right-0.5 size-1 rounded-full bg-red-500" />
                      )}
                    </button>
                  );
                })}
              </motion.div>
            ) : (
              /* State 2: Icon Tab Buttons on hover */
              <motion.nav
                key="icons"
                aria-label="Island navigation"
                initial={{ opacity: 0, scale: 0.85, filter: 'blur(3px)' }}
                animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0, scale: 0.85, filter: 'blur(3px)' }}
                transition={{
                  type: 'spring',
                  stiffness: 460,
                  damping: 22,
                }}
                className="flex items-center gap-1 px-1.5 py-0.5 whitespace-nowrap"
              >
                {tabs.map((tab, idx) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;

                  return (
                    <motion.button
                      key={tab.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectTab(tab.id);
                      }}
                      initial={{ opacity: 0, y: 3, scale: 0.8 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{
                        type: 'spring',
                        stiffness: 480,
                        damping: 20,
                        delay: idx * 0.02,
                      }}
                      whileHover={{ scale: 1.22 }}
                      whileTap={{ scale: 0.88 }}
                      title={tab.label}
                      aria-label={tab.label}
                      aria-pressed={isActive}
                      className={`relative flex items-center justify-center rounded-full p-1 transition-colors duration-150 ${
                        isActive
                          ? 'bg-white/20 text-white shadow-sm'
                          : 'text-neutral-400 hover:text-white hover:bg-white/[0.08]'
                      }`}
                    >
                      <Icon size={13} className="size-3.5" />
                      {tab.badge && (
                        <span className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-red-500 ring-1 ring-black" />
                      )}
                    </motion.button>
                  );
                })}
              </motion.nav>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
};
