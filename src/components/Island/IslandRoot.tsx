import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
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
  const isHoveredRef = useRef(false);
  const [isDodged, setIsDodged] = useState(false);
  const isDodgedRef = useRef(false);
  isDodgedRef.current = isDodged;
  const isTauri =
    typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

  const isPlaying = audioPlayback?.isPlaying ?? false;
  const islandStyle = settings.islandStyle || 'pill';
  const intelligentDodgeEnabled = settings.intelligentDodgeEnabled ?? true;
  const dimensions = getIslandDimensions(islandStyle, state, isPlaying, activeTab);

  // When dodged, tuck the island up into the top screen edge, leaving only a subtle ~5px peek rim
  const PEEK_RIM_VISIBLE = 5;
  const dodgedY = -dimensions.height + PEEK_RIM_VISIBLE;
  const effectiveY = isDodged && intelligentDodgeEnabled ? dodgedY : dimensions.top;

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
      isHoveredRef.current = hovered;

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

  // In Tauri, listen for intelligent dodge events emitted from the native Win32 hit-test loop
  useEffect(() => {
    if (!isTauri) return;

    let cancelled = false;
    let unlisten: (() => void) | undefined;

    import('@tauri-apps/api/event')
      .then(({ listen }) =>
        listen<boolean>('island-dodge', (event) => {
          setIsDodged(event.payload);
        })
      )
      .then((fn) => {
        if (cancelled) {
          fn();
        } else {
          unlisten = fn;
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [isTauri]);

  // Expose global preview trigger on window for simulator testing
  useEffect(() => {
    interface WindowWithDodge {
      __toggleDodgePreview?: (force?: boolean) => void;
    }
    const win = window as unknown as WindowWithDodge;
    win.__toggleDodgePreview = (force?: boolean) => {
      setIsDodged((prev: boolean) => (force !== undefined ? force : !prev));
    };
  }, []);

  // Keep the native click-through hit rect in sync with the island size.
  // Floating notes register their own rects through the hit-test bridge.
  useEffect(() => {
    if (!isTauri) return;

    const updateIslandRect = () => {
      const vw = window.innerWidth || 700;
      const width = dimensions.width;
      const isCurrentlyDodged = isDodged && intelligentDodgeEnabled;
      // When dodged, shrink the native hit-rect to just the peek rim at the screen ceiling.
      // This immediately allows click-through to background browser tabs!
      const height = isCurrentlyDodged ? PEEK_RIM_VISIBLE + 2 : dimensions.height + dimensions.top;

      setIslandHitRect({
        x: Math.max(0, (vw - width) / 2),
        y: 0,
        width,
        height,
      });
    };

    updateIslandRect();
    window.addEventListener('resize', updateIslandRect);
    return () => window.removeEventListener('resize', updateIslandRect);
  }, [dimensions.height, dimensions.width, dimensions.top, isTauri, state, activeTab, isDodged, intelligentDodgeEnabled]);

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
      // If the mouse is still hovering over the island, do not collapse.
      // A blur event while mouse is inside is caused by tooltips or internal element focus shifts.
      if (isHoveredRef.current) return;
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
        stiffness: isDodged ? 520 : 440,
        damping: isDodged ? 36 : 34,
        mass: 0.65,
      };

  const opacity = (settings.backgroundOpacity ?? 85) / 100;
  const blur = settings.backgroundBlur ?? 20;
  const isGlass = opacity < 1;

  // Authentic Frosted Glass & Acrylic Material:
  // Windows DWM cannot capture background pixels through a transparent webview.
  // We simulate real optical glass with a refractive multi-stop dark gradient,
  // specular overhead bevel highlights, ambient internal glow, and high-frequency frosted grain.
  const glassGradient = isGlass
    ? `linear-gradient(135deg, rgba(28, 30, 38, ${Math.min(0.96, opacity * 0.96)}) 0%, rgba(14, 16, 22, ${Math.min(0.94, opacity * 0.92)}) 45%, rgba(7, 8, 12, ${Math.min(0.98, opacity * 0.99)}) 100%)`
    : '#000000';

  const islandBg = isGlass ? `rgba(10, 11, 15, ${opacity})` : '#000000';

  const glassBorder = isGlass ? '1px solid rgba(255, 255, 255, 0.12)' : 'none';
  const glassBorderTop = isGlass ? '1px solid rgba(255, 255, 255, 0.24)' : 'none';

  const glassShadow = isGlass
    ? 'inset 0 1px 1px 0 rgba(255, 255, 255, 0.22), inset 0 0 18px 0 rgba(255, 255, 255, 0.04), inset 0 -1px 1px 0 rgba(0, 0, 0, 0.6), 0 16px 36px -4px rgba(0, 0, 0, 0.65), 0 4px 12px -2px rgba(0, 0, 0, 0.45)'
    : '0 8px 24px -4px rgba(0, 0, 0, 0.7), 0 2px 8px -1px rgba(0, 0, 0, 0.5)';
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
            y: effectiveY,
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
              background: glassGradient,
              border: glassBorder,
              borderTop: glassBorderTop,
              boxShadow: glassShadow,
              backdropFilter: blur > 0 ? `blur(${blur}px) saturate(180%)` : undefined,
              WebkitBackdropFilter: blur > 0 ? `blur(${blur}px) saturate(180%)` : undefined,
              willChange: 'border-radius',
            }}
            animate={{
              borderRadius: dimensions.borderRadius,
            }}
            transition={transition}
          >
            {/* Frosted Glass Micro-Grain Texture (Tactile Diffusion) */}
            {isGlass && blur > 0 && (
              <div
                className="pointer-events-none absolute inset-0 z-0 opacity-[0.045] mix-blend-overlay"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
                }}
              />
            )}

            {/* Specular Overhead Glare Line (Apple Ambient Sheen) */}
            {isGlass && (
              <div className="pointer-events-none absolute inset-x-6 top-0 z-10 h-[1px] bg-gradient-to-r from-transparent via-white/35 to-transparent" />
            )}
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
