import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
} from 'react';
import { motion, AnimatePresence, Transition } from 'framer-motion';
import { useIsland } from '../../context/IslandContext';
import { CompactView } from './CompactView';
import { NotificationView } from './NotificationView';
import { ExpandedView } from './ExpandedView';
import { ISLAND_DIMENSIONS, ISLAND_TOP } from './dimensions';

const HOVER_EXPAND_DELAY = 120;
const HOVER_COLLAPSE_DELAY = 280;

export const IslandRoot: React.FC = () => {
  const { state, setState, activeNotification, settings } = useIsland();
  const islandRef = useRef<HTMLDivElement>(null);

  const hoverExpandTimer = useRef<number | undefined>(undefined);
  const hoverCollapseTimer = useRef<number | undefined>(undefined);

  const stateRef = useRef(state);
  const triggerRef = useRef(settings.expandTrigger);

  const isTauri =
    typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

  const dimensions = ISLAND_DIMENSIONS[state];

  useLayoutEffect(() => {
    stateRef.current = state;
    triggerRef.current = settings.expandTrigger;
  }, [state, settings.expandTrigger]);

  const clearHoverTimers = useCallback(() => {
    window.clearTimeout(hoverExpandTimer.current);
    window.clearTimeout(hoverCollapseTimer.current);
  }, []);

  const scheduleExpand = useCallback(() => {
    window.clearTimeout(hoverExpandTimer.current);
    window.clearTimeout(hoverCollapseTimer.current);
    hoverExpandTimer.current = window.setTimeout(() => {
      if (stateRef.current === 'compact') {
        setState('expanded');
      }
    }, HOVER_EXPAND_DELAY);
  }, [setState]);

  const scheduleCollapse = useCallback(() => {
    window.clearTimeout(hoverExpandTimer.current);
    window.clearTimeout(hoverCollapseTimer.current);
    hoverCollapseTimer.current = window.setTimeout(() => {
      if (stateRef.current !== 'expanded') {
        return;
      }

      const active = document.activeElement;
      const isEditing =
        active instanceof HTMLElement &&
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName);

      if (!isEditing) {
        setState('compact');
      }
    }, HOVER_COLLAPSE_DELAY);
  }, [setState]);

  const handleHoverChange = useCallback(
    (hovered: boolean) => {
      if (triggerRef.current !== 'hover') {
        return;
      }

      if (hovered && stateRef.current === 'compact') {
        scheduleExpand();
      } else if (!hovered && stateRef.current === 'expanded') {
        scheduleCollapse();
      } else {
        clearHoverTimers();
      }
    },
    [clearHoverTimers, scheduleCollapse, scheduleExpand]
  );

  // In Tauri the native hit-test loop reports hover based on the fixed hit rect,
  // which stays stable while the island is animating.
  useEffect(() => {
    if (!isTauri) return;

    let cancelled = false;
    let unlisten: (() => void) | undefined;

    import('@tauri-apps/api/event')
      .then(({ listen }) =>
        listen<boolean>('island-hover', (event) => {
          handleHoverChange(event.payload);
        })
      )
      .then((fn) => {
        if (cancelled) {
          fn();
        } else {
          unlisten = fn;
        }
      })
      .catch(() => {
        // Native hover events are optional; browser preview uses pointers.
      });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [handleHoverChange, isTauri]);

  // Keep the native click-through hit rect in sync with the fixed island size.
  useEffect(() => {
    if (!isTauri) return;

    const viewportWidth = window.innerWidth || 660;
    const x = Math.max(0, (viewportWidth - dimensions.width) / 2);

    import('@tauri-apps/api/core')
      .then(({ invoke }) =>
        invoke('set_island_hit_rect', {
          x: state === 'expanded' ? 0 : x,
          y: state === 'expanded' ? 0 : ISLAND_TOP,
          width: state === 'expanded' ? (window.innerWidth || 660) : dimensions.width,
          height: state === 'expanded' ? (window.innerHeight || 420) : dimensions.height,
        })
      )
      .catch((err) => {
        console.debug('Unable to update island hit rect:', err);
      });
  }, [dimensions.height, dimensions.width, isTauri, state]);

  // Collapse when clicking outside (browser) or when the Tauri window loses focus.
  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      if (
        state === 'expanded' &&
        islandRef.current &&
        !islandRef.current.contains(e.target as Node)
      ) {
        setState('compact');
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);

    const handleWindowBlur = () => {
      if (isTauri && state === 'expanded') {
        setState('compact');
      }
    };

    window.addEventListener('blur', handleWindowBlur);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [isTauri, state, setState]);

  // Clear pending hover timers when the interaction mode changes.
  useEffect(() => {
    clearHoverTimers();
  }, [clearHoverTimers, settings.expandTrigger]);

  useEffect(() => () => clearHoverTimers(), [clearHoverTimers]);

  const handleClick = () => {
    if (state === 'compact') {
      clearHoverTimers();
      setState('expanded');
    }
  };

  const transition: Transition = settings.reducedMotionEnabled
    ? { duration: 0.18, ease: 'easeOut' }
    : {
        type: 'spring',
        stiffness: 420,
        damping: 40,
        mass: 0.85,
      };

  const opacity = (settings.backgroundOpacity ?? 80) / 100;
  const blur = settings.backgroundBlur ?? 20;

  return (
    <>
      {/* Backdrop overlay for click-outside to collapse when expanded */}
      {state === 'expanded' && (
        <div
          className="pointer-events-auto fixed inset-0 z-40 cursor-default bg-black/10 backdrop-blur-[1px] transition-opacity duration-200"
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setState('compact');
          }}
        />
      )}

      <div
        className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center"
        style={{ paddingTop: ISLAND_TOP }}
      >
        <motion.div
          ref={islandRef}
          className="pointer-events-auto relative select-none overflow-hidden text-white"
          style={{
            backgroundColor: `rgba(10, 10, 13, ${opacity})`,
            backdropFilter: blur > 0 ? `blur(${blur}px) saturate(180%)` : 'none',
            WebkitBackdropFilter: blur > 0 ? `blur(${blur}px) saturate(180%)` : 'none',
            boxShadow:
              opacity < 1
                ? '0 24px 60px -12px rgba(0, 0, 0, 0.85), 0 8px 24px -6px rgba(0, 0, 0, 0.5)'
                : '0 12px 30px -10px rgba(0, 0, 0, 0.8)',
            willChange: 'width, height, border-radius',
          }}
          animate={{
            width: dimensions.width,
            height: dimensions.height,
            borderRadius: dimensions.borderRadius,
          }}
          transition={transition}
          onClick={handleClick}
          onPointerEnter={
            isTauri ? undefined : () => handleHoverChange(true)
          }
          onPointerLeave={
            isTauri ? undefined : () => handleHoverChange(false)
          }
        >

          <AnimatePresence initial={false} mode="sync">
            <motion.div
              key={state}
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, pointerEvents: 'none' }}
              transition={{ duration: settings.reducedMotionEnabled ? 0.12 : 0.18, ease: 'easeOut' }}
            >
              {state === 'compact' && <CompactView />}
              {state === 'notification' && activeNotification && (
                <NotificationView notification={activeNotification} />
              )}
              {state === 'expanded' && <ExpandedView />}
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>
    </>
  );
};
