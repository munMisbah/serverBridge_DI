import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence, Transition } from 'framer-motion';
import { useIsland } from '../../context/IslandContext';
import { CompactView } from './CompactView';
import { NotificationView } from './NotificationView';
import { ExpandedView } from './ExpandedView';

export const IslandRoot: React.FC = () => {
  const { state, setState, activeNotification, audioPlayback, notifications, settings } =
    useIsland();
  const islandRef = useRef<HTMLDivElement>(null);

  // Click outside listener when expanded
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        state === 'expanded' &&
        islandRef.current &&
        !islandRef.current.contains(e.target as Node)
      ) {
        setState('compact');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [state, setState]);

  // Determine dynamic dimensions based on state
  const hasAudio = !!audioPlayback?.isPlaying;
  const hasUnread = notifications.some((n) => n.unread);

  let targetWidth = 190;
  if (hasAudio && hasUnread) {
    targetWidth = 230;
  } else if (hasAudio || hasUnread) {
    targetWidth = 210;
  }

  const dimensions = {
    compact: {
      width: targetWidth,
      height: 38,
      borderRadius: 9999,
    },
    notification: {
      width: 380,
      height: 64,
      borderRadius: 28,
    },
    expanded: {
      width: 440,
      height: 460,
      borderRadius: 32,
    },
  }[state];

  // Notify Tauri backend to resize window if running in Tauri
  useEffect(() => {
    if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
      import('@tauri-apps/api/core').then(({ invoke }) => {
        invoke('resize_island_window', {
          width: dimensions.width + 30,
          height: dimensions.height + 30,
        }).catch((err) => {
          console.debug('Tauri resize invoke not active yet:', err);
        });
      });
    }
  }, [dimensions.width, dimensions.height]);

  const springTransition: Transition = settings.reducedMotionEnabled
    ? { duration: 0.15, ease: 'easeInOut' }
    : {
        type: 'spring',
        stiffness: 460,
        damping: 32,
        mass: 0.85,
      };

  return (
    <div className="fixed top-3 left-0 right-0 flex justify-center pointer-events-none z-50">
      <motion.div
        ref={islandRef}
        layout
        className="pointer-events-auto relative overflow-hidden bg-black text-white border border-white/[0.14] shadow-[0_20px_50px_rgba(0,0,0,0.85),0_0_0_1px_rgba(255,255,255,0.06)]"
        animate={{
          width: dimensions.width,
          height: dimensions.height,
          borderRadius: dimensions.borderRadius,
        }}
        transition={springTransition}
        whileHover={state === 'compact' ? { scale: 1.03 } : {}}
      >
        {/* Subtle OLED Rim Highlight / Reflection */}
        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />

        {/* View Switcher based on State */}
        <AnimatePresence mode="wait">
          {state === 'compact' && (
            <motion.div
              key="compact"
              className="w-full h-full flex items-center justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <CompactView />
            </motion.div>
          )}

          {state === 'notification' && activeNotification && (
            <motion.div
              key="notification"
              className="w-full h-full flex items-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <NotificationView notification={activeNotification} />
            </motion.div>
          )}

          {state === 'expanded' && (
            <motion.div
              key="expanded"
              className="w-full h-full flex flex-col"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              <ExpandedView />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};
