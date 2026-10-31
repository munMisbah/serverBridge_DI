export interface HitRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

let islandRect: HitRect | null = null;
let extraRects: HitRect[] = [];
let forceInteractive = false;
let frame = 0;
let lastPayload = '';

function schedule() {
  if (!isTauri || frame) return;

  frame = requestAnimationFrame(() => {
    frame = 0;
    const payload = JSON.stringify([islandRect, extraRects, forceInteractive]);
    // Avoid IPC churn when nothing actually moved.
    if (payload === lastPayload) return;
    lastPayload = payload;

    import('@tauri-apps/api/core')
      .then(({ invoke }) =>
        invoke('set_hit_test_config', {
          island: islandRect,
          interactive: extraRects,
          force: forceInteractive,
        })
      )
      .catch((err) => {
        console.debug('Unable to update hit test config:', err);
      });
  });
}

/** Interactive + hover rect for the island itself. */
export function setIslandHitRect(rect: HitRect | null) {
  islandRect = rect;
  schedule();
}

/** Extra interactive regions (floating notes). */
export function setExtraHitRects(rects: HitRect[]) {
  extraRects = rects;
  schedule();
}

/**
 * While a note is being dragged/resized the whole window must stay
 * interactive, otherwise the OS click-through toggle can swallow the drag.
 */
export function setHitTestForce(value: boolean) {
  forceInteractive = value;
  schedule();
}
