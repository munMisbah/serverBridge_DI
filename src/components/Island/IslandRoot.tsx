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
import { getIslandDimensions } from './dimensions';
import { setIslandHitRect } from '../../lib/hitTest';
import { NotesLayer } from '../Notes/NotesLayer';

const HOVER_EXPAND_DELAY = 30;
const HOVER_COLLAPSE_DELAY = 120;
const NOTCH_EAR_RADIUS = 14;
export const IslandRoot: React.FC = () => {
  const { state, setState, activeNotification, settings, audioPlayback, activeTab } =
    useIsland();
  const islandRef = useRef<HTMLDivElement>(null);

  const hoverExpandTimer = useRef<number | undefined>(undefined);
  const hoverCollapseTimer = useRef<number | undefined>(undefined);

  const stateRef = useRef(state);
  const triggerRef = useRef(settings.expandTrigger);

  const isTauri =
    typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

  const isPlaying = audioPlayback?.isPlaying ?? false;
  const islandStyle = settings.islandStyle || 'pill';
  const dimensions = getIslandDimensions(islandStyle, state, isPlaying, activeTab);

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

  // Keep the native click-through hit rect in sync with the island size.
  // Floating notes register their own rects through the hit-test bridge.
  useEffect(() => {
    if (!isTauri) return;

    const updateIslandRect = () => {
      const vw = window.innerWidth || 700;

      setIslandHitRect({
        x: Math.max(0, (vw - dimensions.width) / 2),
        y: dimensions.top,
        width: dimensions.width,
        height: dimensions.height,
      });
    };

    updateIslandRect();
    window.addEventListener('resize', updateIslandRect);
    return () => window.removeEventListener('resize', updateIslandRect);
  }, [dimensions.height, dimensions.width, dimensions.top, isTauri, state, activeTab]);

  // Collapse when clicking outside (browser) or when the Tauri window loses focus.
  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        state === 'expanded' &&
        islandRef.current &&
        !islandRef.current.contains(e.target as Node) &&
        !target?.closest?.('[data-notes-layer]')
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
    ? { duration: 0.15, ease: 'easeOut' }
    : {
        type: 'spring',
        stiffness: 480,
        damping: 38,
        mass: 0.7,
      };

  const opacity = (settings.backgroundOpacity ?? 80) / 100;
  const blur = settings.backgroundBlur ?? 20;
  const islandBg = opacity < 1 ? `rgba(0, 0, 0, ${opacity})` : '#000000';
  return (
    <>
      {/* Backdrop overlay for click-outside to collapse when expanded (browser preview only) */}
      {!isTauri && state === 'expanded' && (
        <div
          className="pointer-events-auto fixed inset-0 z-40 cursor-default bg-transparent"
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setState('compact');
          }}
        />
      )}

      <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center">
        <motion.div
          ref={islandRef}
          data-island
          className="pointer-events-auto relative select-none text-white"
          style={{
            willChange: 'width, height, transform',
          }}
          animate={{
            y: dimensions.top,
            width: dimensions.width,
            height: dimensions.height,
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
          {/* Notch Concave Fillet Ears (MacBook / NotchNook style) */}
          {islandStyle === 'notch' && (
            <>
              <div
                className="pointer-events-none absolute right-[100%] top-0 z-10 block"
                style={{ width: NOTCH_EAR_RADIUS, height: NOTCH_EAR_RADIUS }}
              >
                <svg
                  width={NOTCH_EAR_RADIUS}
                  height={NOTCH_EAR_RADIUS}
                  viewBox={`0 0 ${NOTCH_EAR_RADIUS} ${NOTCH_EAR_RADIUS}`}
                  fill="none"
                  className="block"
                >
                  <path
                    d={`M ${NOTCH_EAR_RADIUS} ${NOTCH_EAR_RADIUS} L ${NOTCH_EAR_RADIUS} 0 L 0 0 A ${NOTCH_EAR_RADIUS} ${NOTCH_EAR_RADIUS} 0 0 1 ${NOTCH_EAR_RADIUS} ${NOTCH_EAR_RADIUS} Z`}
                    fill={islandBg}
                  />
                </svg>
              </div>

              <div
                className="pointer-events-none absolute left-[100%] top-0 z-10 block"
                style={{ width: NOTCH_EAR_RADIUS, height: NOTCH_EAR_RADIUS }}
              >
                <svg
                  width={NOTCH_EAR_RADIUS}
                  height={NOTCH_EAR_RADIUS}
                  viewBox={`0 0 ${NOTCH_EAR_RADIUS} ${NOTCH_EAR_RADIUS}`}
                  fill="none"
                  className="block"
                >
                  <path
                    d={`M 0 ${NOTCH_EAR_RADIUS} L 0 0 L ${NOTCH_EAR_RADIUS} 0 A ${NOTCH_EAR_RADIUS} ${NOTCH_EAR_RADIUS} 0 0 0 0 ${NOTCH_EAR_RADIUS} Z`}
                    fill={islandBg}
                  />
                </svg>
              </div>
            </>
          )}

          {/* Island Body Container */}
          <motion.div
            className="relative h-full w-full overflow-hidden text-white"
            style={{
              backgroundColor: islandBg,
              backdropFilter: blur > 0 ? `blur(${blur}px) saturate(180%)` : 'none',
              WebkitBackdropFilter: blur > 0 ? `blur(${blur}px) saturate(180%)` : 'none',
              boxShadow:
                opacity < 1
                  ? '0 8px 20px -4px rgba(0, 0, 0, 0.55), 0 3px 8px -2px rgba(0, 0, 0, 0.35)'
                  : '0 6px 16px -4px rgba(0, 0, 0, 0.5), 0 2px 6px -1px rgba(0, 0, 0, 0.35)',
              willChange: 'border-radius',
            }}
            animate={{
              borderRadius: dimensions.borderRadius,
            }}
            transition={transition}
          >
            <AnimatePresence initial={false} mode="sync">
              <motion.div
                key={state}
                className="absolute inset-0"
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
        </motion.div>
      </div>

      {/* Floating sticky notes (rendered above the island, outside its clip) */}
      <NotesLayer />
    </>
  );
};
