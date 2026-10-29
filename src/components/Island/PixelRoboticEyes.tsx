import React, { useEffect, useRef, useState, useCallback } from 'react';

export type EyeExpression = 'idle' | 'blink' | 'happy' | 'wink' | 'curious' | 'sleepy';

interface PixelRoboticEyesProps {
  size?: 'sm' | 'md';
  className?: string;
}

export const PixelRoboticEyes: React.FC<PixelRoboticEyesProps> = ({
  size = 'md',
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [expression, setExpression] = useState<EyeExpression>('idle');
  const [blinkProgress, setBlinkProgress] = useState(1); // 1 = fully open, 0 = fully closed
  const [leftEyeBlink, setLeftEyeBlink] = useState(1);
  const [rightEyeBlink, setRightEyeBlink] = useState(1);

  // Smooth gaze coordinates in pixels (-4 to +4)
  const gazeRef = useRef({ x: 0, y: 0 });
  const targetGazeRef = useRef({ x: 0, y: 0 });
  const [gaze, setGaze] = useState({ x: 0, y: 0 });
  const isAnimatingRef = useRef(false);
  const animFrameIdRef = useRef<number | null>(null);

  // Awake-only animation frame loop: runs ONLY while gaze is lerping to target,
  // and completely sleeps when stationary to eliminate CPU & React render churn.
  const startGazeAnimation = useCallback(() => {
    if (isAnimatingRef.current) return;
    isAnimatingRef.current = true;

    const step = () => {
      const current = gazeRef.current;
      const target = targetGazeRef.current;

      const dx = target.x - current.x;
      const dy = target.y - current.y;

      // Snap and stop animation loop when close to target
      if (Math.abs(dx) < 0.05 && Math.abs(dy) < 0.05) {
        gazeRef.current = { x: target.x, y: target.y };
        const roundedX = Math.round(target.x * 10) / 10;
        const roundedY = Math.round(target.y * 10) / 10;
        setGaze((prev) => (prev.x === roundedX && prev.y === roundedY ? prev : { x: roundedX, y: roundedY }));
        isAnimatingRef.current = false;
        animFrameIdRef.current = null;
        return;
      }

      const nextX = current.x + dx * 0.15;
      const nextY = current.y + dy * 0.15;
      gazeRef.current = { x: nextX, y: nextY };

      const roundedX = Math.round(nextX * 10) / 10;
      const roundedY = Math.round(nextY * 10) / 10;
      setGaze((prev) => (prev.x === roundedX && prev.y === roundedY ? prev : { x: roundedX, y: roundedY }));

      animFrameIdRef.current = requestAnimationFrame(step);
    };

    animFrameIdRef.current = requestAnimationFrame(step);
  }, []);

  useEffect(() => {
    return () => {
      if (animFrameIdRef.current !== null) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, []);

  // Global mouse tracking: eyes look at cursor anywhere on Windows desktop
  useEffect(() => {
    const updateGazeFromCoord = (coordX: number, coordY: number) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const eyeCenterX = rect.left + rect.width / 2;
      const eyeCenterY = rect.top + rect.height / 2;

      const deltaX = coordX - eyeCenterX;
      const deltaY = coordY - eyeCenterY;
      const distance = Math.hypot(deltaX, deltaY);

      if (distance < 4) {
        targetGazeRef.current = { x: 0, y: 0 };
        startGazeAnimation();
        return;
      }

      // Max gaze offset in pixels
      const maxOffset = size === 'sm' ? 3.5 : 5.0;
      const angle = Math.atan2(deltaY, deltaX);
      const intensity = Math.min(1, Math.max(0.25, distance / 240));

      targetGazeRef.current = {
        x: Math.cos(angle) * maxOffset * intensity,
        y: Math.sin(angle) * (maxOffset * 0.8) * intensity,
      };
      startGazeAnimation();
    };

    let cancelled = false;
    let unlistenFn: (() => void) | undefined;

    // 1. Native Windows global cursor tracking via Tauri event
    if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
      import('@tauri-apps/api/event')
        .then(({ listen }) => {
          if (cancelled) return;
          return listen<{ x: number; y: number }>('windows-cursor-move', (event) => {
            updateGazeFromCoord(event.payload.x, event.payload.y);
          });
        })
        .then((fn) => {
          if (cancelled) {
            fn?.();
          } else {
            unlistenFn = fn;
          }
        })
        .catch(() => {});
    }

    // 2. Web browser preview fallback
    const handlePointerMove = (e: MouseEvent) => {
      updateGazeFromCoord(e.clientX, e.clientY);
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    return () => {
      cancelled = true;
      window.removeEventListener('pointermove', handlePointerMove);
      unlistenFn?.();
    };
  }, [size, startGazeAnimation]);

  // Execute a smooth blink transition
  const triggerBlink = useCallback((isDouble = false) => {
    setExpression('blink');
    setBlinkProgress(0);
    setLeftEyeBlink(0);
    setRightEyeBlink(0);

    setTimeout(() => {
      setBlinkProgress(1);
      setLeftEyeBlink(1);
      setRightEyeBlink(1);
      setExpression('idle');

      if (isDouble) {
        setTimeout(() => {
          setBlinkProgress(0);
          setLeftEyeBlink(0);
          setRightEyeBlink(0);
          setTimeout(() => {
            setBlinkProgress(1);
            setLeftEyeBlink(1);
            setRightEyeBlink(1);
          }, 100);
        }, 140);
      }
    }, 120);
  }, []);

  // Autonomous behaviors: natural blinking & expressive mood shifts
  useEffect(() => {
    let timer: number;

    const scheduleNextEvent = () => {
      // Blink every 3.5 - 6.5 seconds
      const nextDelay = 3500 + Math.random() * 3000;
      timer = window.setTimeout(() => {
        const rand = Math.random();

        if (rand < 0.65) {
          // Standard single or double blink
          triggerBlink(rand < 0.2);
        } else if (rand < 0.8) {
          // Happy squint
          setExpression('happy');
          setTimeout(() => setExpression('idle'), 1400);
        } else if (rand < 0.92) {
          // Playful wink
          setExpression('wink');
          setLeftEyeBlink(0);
          setRightEyeBlink(1);
          setTimeout(() => {
            setLeftEyeBlink(1);
            setExpression('idle');
          }, 700);
        } else {
          // Curious glance
          setExpression('curious');
          setTimeout(() => setExpression('idle'), 1200);
        }

        scheduleNextEvent();
      }, nextDelay);
    };

    scheduleNextEvent();
    return () => clearTimeout(timer);
  }, [triggerBlink]);

  // Click on eyes to trigger happy reaction
  const handleEyeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setExpression('happy');
    setTimeout(() => setExpression('idle'), 1600);
  };

  // Dimensions
  const eyeWidth = size === 'sm' ? 12 : 14;
  const eyeHeight = size === 'sm' ? 14 : 16;
  const eyeGap = size === 'sm' ? 5 : 7;

  // Render authentic pixelated eye graphics using sharp SVG pixels
  const renderPixelEye = (isLeft: boolean, blinkScale: number) => {
    if (expression === 'happy') {
      // Curved pixel smile crescent ^
      return (
        <svg
          width={eyeWidth}
          height={eyeHeight}
          viewBox="0 0 7 8"
          className="overflow-visible"
          style={{ shapeRendering: 'crispEdges' }}
        >
          <g fill="#FFFFFF">
            <rect x="2" y="1" width="3" height="1.5" />
            <rect x="1" y="2.5" width="2" height="1.5" />
            <rect x="4" y="2.5" width="2" height="1.5" />
            <rect x="0" y="4" width="2" height="1.5" />
            <rect x="5" y="4" width="2" height="1.5" />
          </g>
        </svg>
      );
    }

    if (expression === 'curious' && isLeft) {
      // One eye dilated / arched higher
      return (
        <svg
          width={eyeWidth}
          height={eyeHeight + 2}
          viewBox="0 0 7 9"
          className="overflow-visible transition-transform duration-200"
          style={{
            shapeRendering: 'crispEdges',
            transform: `translate(${gaze.x}px, ${gaze.y}px)`,
          }}
        >
          <g fill="#FFFFFF">
            <rect x="1" y="0" width="5" height="1.5" />
            <rect x="0" y="1.5" width="7" height="6" />
            <rect x="1" y="7.5" width="5" height="1.5" />
            {/* Center Pupil Core */}
            <rect x="2" y="2.5" width="3" height="4" fill="#000000" opacity="0.4" />
          </g>
        </svg>
      );
    }

    // Normal / Gaze tracking pixel eye
    // Clamped height based on blink scale
    const currentHeight = Math.max(1.5, eyeHeight * blinkScale);
    const isSquinting = blinkScale < 0.3;

    return (
      <div
        className="relative overflow-visible transition-[height] duration-75 ease-out"
        style={{
          width: eyeWidth,
          height: currentHeight,
          transform: `translate(${gaze.x}px, ${gaze.y}px)`,
        }}
      >
        {isSquinting ? (
          // Pixel slit when blinking
          <svg
            width={eyeWidth}
            height={3}
            viewBox="0 0 7 2"
            style={{ shapeRendering: 'crispEdges' }}
          >
            <rect x="0" y="0" width="7" height="2" fill="#FFFFFF" />
          </svg>
        ) : (
          // Solid rounded pixel art eye
          <svg
            width={eyeWidth}
            height={eyeHeight}
            viewBox="0 0 7 8"
            className="overflow-visible"
            style={{ shapeRendering: 'crispEdges' }}
          >
            <defs>
              <filter id="pixelGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="0" stdDeviation="0.8" floodColor="#FFFFFF" floodOpacity="0.45" />
              </filter>
            </defs>
            <g fill="#FFFFFF" filter="url(#pixelGlow)">
              {/* Row 0: Top bevel */}
              <rect x="1.5" y="0" width="4" height="1.2" />
              {/* Rows 1-6: Main Eye Body */}
              <rect x="0" y="1.2" width="7" height="5.6" />
              {/* Row 7: Bottom bevel */}
              <rect x="1.5" y="6.8" width="4" height="1.2" />
              {/* Subtle robotic iris reflection dot in top-right */}
              <rect x="4" y="2" width="1.5" height="1.5" fill="#0c0c12" opacity="0.35" />
            </g>
          </svg>
        )}
      </div>
    );
  };

  return (
    <div
      ref={containerRef}
      onClick={handleEyeClick}
      title="Robotic Companion Eye • Follows your cursor"
      className={`group relative flex cursor-pointer items-center justify-center select-none py-1 transition-transform duration-200 hover:scale-105 active:scale-95 ${className}`}
      style={{
        gap: eyeGap,
        filter: 'drop-shadow(0 0 5px rgba(255, 255, 255, 0.4))',
      }}
    >
      {/* Left Eye */}
      <div className="flex items-center justify-center">
        {renderPixelEye(true, expression === 'wink' ? leftEyeBlink : blinkProgress)}
      </div>

      {/* Right Eye */}
      <div className="flex items-center justify-center">
        {renderPixelEye(false, expression === 'wink' ? rightEyeBlink : blinkProgress)}
      </div>
    </div>
  );
};
