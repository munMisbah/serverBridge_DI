import React, { useEffect, useMemo, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MusicNote2Icon } from '@solar-icons/react/bold/music-note-2';
import { CloudSun2Icon } from '@solar-icons/react/bold/cloud-sun-2';
import { CalendarDateIcon } from '@solar-icons/react/bold/calendar-date';
import { BellIcon } from '@solar-icons/react/bold/bell';
import { ClipboardListIcon } from '@solar-icons/react/bold/clipboard-list';
import { ChecklistIcon } from '@solar-icons/react/bold/checklist';
import { BatteryFullIcon } from '@solar-icons/react/bold/battery-full';
import { ServerSquareIcon } from '@solar-icons/react/bold/server-square';
import {
  Image as ImageIcon,
  SlidersHorizontal,
  Check,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { TodoTab } from '../Dashboard/TodoTab';
import { ALL_TABS, useIsland } from '../../context/IslandContext';
import { setCollapseSuppressed } from '../../lib/hitTest';
import { OverviewTab } from '../Dashboard/OverviewTab';
import { WeatherTab } from '../Dashboard/WeatherTab';
import { CalendarTab } from '../Dashboard/CalendarTab';
import { NotificationsTab } from '../Dashboard/NotificationsTab';
import { ClipboardTab } from '../Dashboard/ClipboardTab';
import { BatteryTab } from '../Dashboard/BatteryTab';
import { ServersTab } from '../Dashboard/ServersTab';
import { ConverterTab } from '../Dashboard/ConverterTab';
import { ActiveTab } from '../../types';

interface TabItem {
  id: ActiveTab;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  badge?: boolean;
}

export const ExpandedView: React.FC = () => {
  const { setState, activeTab, setActiveTab, notifications, settings, updateSettings } =
    useIsland();
  const unreadCount = notifications.filter((notification) => notification.unread).length;

  const [isNavHovered, setIsNavHovered] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedEditTab, setSelectedEditTab] = useState<ActiveTab | null>(null);
  const [draggedTab, setDraggedTab] = useState<ActiveTab | null>(null);
  const [slideDirection, setSlideDirection] = useState<1 | -1>(1);
  const lastWheelTime = useRef(0);

  useEffect(() => {
    setCollapseSuppressed(isEditMode);
    return () => setCollapseSuppressed(false);
  }, [isEditMode]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isEditMode) {
          setIsEditMode(false);
          setSelectedEditTab(null);
        } else {
          setState('compact');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setState, isEditMode]);

  const tabMetaMap: Record<ActiveTab, TabItem> = useMemo(
    () => ({
      todo: { id: 'todo', label: 'Todo', icon: ChecklistIcon },
      all: { id: 'all', label: 'Music', icon: MusicNote2Icon },
      weather: { id: 'weather', label: 'Weather', icon: CloudSun2Icon },
      calendar: { id: 'calendar', label: 'Calendar', icon: CalendarDateIcon },
      notifications: {
        id: 'notifications',
        label: 'Alerts',
        icon: BellIcon,
        badge: unreadCount > 0,
      },
      clipboard: { id: 'clipboard', label: 'Clipboard', icon: ClipboardListIcon },
      battery: { id: 'battery', label: 'Battery', icon: BatteryFullIcon },
      servers: { id: 'servers', label: 'Servers', icon: ServerSquareIcon },
      converter: { id: 'converter', label: 'Converter', icon: ImageIcon },
    }),
    [unreadCount]
  );

  // Normalize saved order against ALL_TABS so new modules always appear.
  const orderedTabIds = useMemo<ActiveTab[]>(() => {
    const saved = settings.tabOrder ?? ALL_TABS;
    const valid = saved.filter((id): id is ActiveTab => ALL_TABS.includes(id));
    const missing = ALL_TABS.filter((id) => !valid.includes(id));
    return [...valid, ...missing];
  }, [settings.tabOrder]);

  const hiddenSet = useMemo(
    () => new Set<ActiveTab>(settings.hiddenTabs ?? []),
    [settings.hiddenTabs]
  );

  const orderedTabs = useMemo(
    () => orderedTabIds.map((id) => tabMetaMap[id]),
    [orderedTabIds, tabMetaMap]
  );

  const visibleTabs = useMemo(() => {
    const list = orderedTabs.filter((t) => !hiddenSet.has(t.id));
    return list.length > 0 ? list : [orderedTabs[0]];
  }, [orderedTabs, hiddenSet]);

  const visibleTabIds = useMemo(() => visibleTabs.map((t) => t.id), [visibleTabs]);

  const toggleTabVisibility = (tabId: ActiveTab) => {
    const isHidden = hiddenSet.has(tabId);
    if (!isHidden && visibleTabs.length <= 1) {
      // Never allow hiding the very last visible tab.
      return;
    }
    const nextHidden = isHidden
      ? (settings.hiddenTabs ?? []).filter((id) => id !== tabId)
      : [...(settings.hiddenTabs ?? []), tabId];
    updateSettings({ hiddenTabs: nextHidden });
  };

  const moveTab = (tabId: ActiveTab, direction: -1 | 1) => {
    const idx = orderedTabIds.indexOf(tabId);
    const targetIdx = idx + direction;
    if (idx === -1 || targetIdx < 0 || targetIdx >= orderedTabIds.length) return;
    const next = [...orderedTabIds];
    const [moved] = next.splice(idx, 1);
    next.splice(targetIdx, 0, moved);
    updateSettings({ tabOrder: next });
  };

  const reorderTab = (fromId: ActiveTab, toId: ActiveTab) => {
    if (fromId === toId) return;
    const fromIdx = orderedTabIds.indexOf(fromId);
    const toIdx = orderedTabIds.indexOf(toId);
    if (fromIdx === -1 || toIdx === -1) return;
    const next = [...orderedTabIds];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    updateSettings({ tabOrder: next });
  };

  const handleSelectTab = (tabId: ActiveTab) => {
    const currentIdx = visibleTabIds.indexOf(activeTab);
    const targetIdx = visibleTabIds.indexOf(tabId);
    setSlideDirection(targetIdx >= currentIdx ? 1 : -1);
    setActiveTab(tabId);
  };

  // Wheel scrolling tab switcher across visible tabs in custom order
  const handleWheel = (e: React.WheelEvent) => {
    if (isEditMode) return;
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
    if (now - lastWheelTime.current < 280) return;

    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (Math.abs(delta) < 15) return;

    const currentIdx = visibleTabIds.indexOf(activeTab);

    if (delta > 0 && currentIdx < visibleTabIds.length - 1) {
      lastWheelTime.current = now;
      setSlideDirection(1);
      setActiveTab(visibleTabIds[currentIdx + 1]);
    } else if (delta < 0 && currentIdx > 0) {
      lastWheelTime.current = now;
      setSlideDirection(-1);
      setActiveTab(visibleTabIds[currentIdx - 1]);
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

  const showIconBar = isNavHovered || isEditMode;

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
            {activeTab === 'battery' && <BatteryTab />}
            {activeTab === 'servers' && <ServersTab />}
            {activeTab === 'converter' && <ConverterTab />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Modular Dock Switcher: Dots -> Hover Icons -> Direct In-Dock Edit Mode */}
      <div className="flex shrink-0 flex-col items-center justify-center pb-2 pt-0.5">
        {isEditMode && selectedEditTab && (
          <div className="mb-1 flex items-center gap-1.5 rounded-full bg-neutral-900/95 px-2 py-0.5 text-[9px] text-neutral-300 ring-1 ring-white/10">
            <span className="font-semibold text-white">
              {tabMetaMap[selectedEditTab].label}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                moveTab(selectedEditTab, -1);
              }}
              disabled={orderedTabIds.indexOf(selectedEditTab) <= 0}
              title="Geser kiri"
              className="rounded p-0.5 text-neutral-400 hover:bg-white/10 hover:text-white disabled:opacity-25"
            >
              <ChevronLeft size={11} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                moveTab(selectedEditTab, 1);
              }}
              disabled={orderedTabIds.indexOf(selectedEditTab) >= orderedTabIds.length - 1}
              title="Geser kanan"
              className="rounded p-0.5 text-neutral-400 hover:bg-white/10 hover:text-white disabled:opacity-25"
            >
              <ChevronRight size={11} />
            </button>
            <span className="h-2.5 w-px bg-white/15" />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleTabVisibility(selectedEditTab);
              }}
              disabled={!hiddenSet.has(selectedEditTab) && visibleTabs.length <= 1}
              className="flex items-center gap-1 rounded px-1 py-0.5 text-[8.5px] font-medium text-white/85 hover:bg-white/10 disabled:opacity-30"
            >
              {hiddenSet.has(selectedEditTab) ? (
                <>
                  <Eye size={10} /> Tampilkan
                </>
              ) : (
                <>
                  <EyeOff size={10} /> Sembunyikan
                </>
              )}
            </button>
          </div>
        )}

        <motion.div
          layout
          onMouseEnter={() => setIsNavHovered(true)}
          onMouseLeave={() => {
            if (!isEditMode) setIsNavHovered(false);
          }}
          id="dock-switcher"
          className={`flex items-center justify-center rounded-full bg-neutral-900/95 p-1 shadow-2xl cursor-pointer overflow-hidden ${
            isEditMode ? 'ring-1 ring-white/25' : ''
          }`}
          transition={{
            type: 'spring',
            stiffness: 420,
            damping: 22,
            mass: 0.75,
          }}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            {!showIconBar ? (
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
                {visibleTabs.map((tab) => {
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
            ) : isEditMode ? (
              /* State 3: Direct In-Dock Modularism Edit Mode */
              <motion.nav
                key="edit-dock"
                aria-label="Edit dock modules"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.15 }}
                className="flex max-w-full items-center gap-0.5 px-1 py-0.5 whitespace-nowrap"
              >
                {orderedTabs.map((tab) => {
                  const Icon = tab.icon;
                  const isHidden = hiddenSet.has(tab.id);
                  const isSelected = selectedEditTab === tab.id;

                  return (
                    <div
                      key={tab.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', tab.id);
                        e.dataTransfer.effectAllowed = 'move';
                        setDraggedTab(tab.id);
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (draggedTab && draggedTab !== tab.id) {
                          reorderTab(draggedTab, tab.id);
                        }
                      }}
                      onDragEnd={() => setDraggedTab(null)}
                      className="relative"
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (selectedEditTab === tab.id) {
                            toggleTabVisibility(tab.id);
                          } else {
                            setSelectedEditTab(tab.id);
                          }
                        }}
                        title={`${tab.label} (${isHidden ? 'Disembunyikan' : 'Aktif'} · klik untuk pilih/toggle, drag untuk urutkan)`}
                        className={`relative flex items-center justify-center rounded-full p-1 transition-all cursor-grab active:cursor-grabbing ${
                          isHidden
                            ? 'border border-dashed border-white/25 text-neutral-600 opacity-50 hover:opacity-80'
                            : isSelected
                              ? 'bg-white/20 text-white ring-1 ring-white/40'
                              : 'bg-white/10 text-white/90 hover:bg-white/20'
                        }`}
                      >
                        <Icon size={13} className="size-3.5" />
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 size-1.5 rounded-full ring-1 ring-neutral-900 ${
                            isHidden ? 'bg-neutral-600' : 'bg-emerald-400'
                          }`}
                        />
                      </button>
                    </div>
                  );
                })}

                <span className="mx-0.5 h-3.5 w-px bg-white/15" />

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsEditMode(false);
                    setSelectedEditTab(null);
                  }}
                  title="Selesai atur tab"
                  aria-label="Selesai atur tab"
                  className="flex items-center gap-0.5 rounded-full bg-white px-2 py-0.5 text-[9.5px] font-semibold text-neutral-950 transition-colors hover:bg-neutral-200"
                >
                  <Check size={10} />
                  Done
                </button>
              </motion.nav>
            ) : (
              /* State 2: Icon Tab Buttons on hover + Quick Edit trigger */
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
                {visibleTabs.map((tab, idx) => {
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

                <span className="mx-0.5 h-3.5 w-px bg-white/15" />

                <motion.button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsEditMode(true);
                    setSelectedEditTab(activeTab);
                  }}
                  whileHover={{ scale: 1.15 }}
                  whileTap={{ scale: 0.9 }}
                  title="Atur modul & urutan tab"
                  aria-label="Atur modul & urutan tab"
                  className="flex items-center justify-center rounded-full p-1 text-neutral-400 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <SlidersHorizontal size={12} />
                </motion.button>
              </motion.nav>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
};
