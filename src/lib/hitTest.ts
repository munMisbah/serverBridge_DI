export interface HitRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

let islandRect: HitRect | null = null;
const namedRects: Record<string, HitRect[]> = {};
let forceInteractive = false;
let collapseSuppressed = false;
let frame = 0;
let lastPayload = '';

function collectExtraRects(): HitRect[] {
  const combined: HitRect[] = [];
  for (const list of Object.values(namedRects)) {
    for (const r of list) {
      combined.push(r);
    }
  }
  return combined;
}

function schedule() {
  if (!isTauri || frame) return;

  frame = requestAnimationFrame(() => {
    frame = 0;
    const extraRects = collectExtraRects();
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

/** Read the latest known island hit rect (useful for drag-to-dock detection). */
export function getIslandHitRect(): HitRect | null {
  return islandRect;
}

/** Extra interactive regions registered under a named layer (e.g. 'notes', 'servers'). */
export function setNamedHitRects(layer: string, rects: HitRect[]) {
  if (rects.length === 0) {
    delete namedRects[layer];
  } else {
    namedRects[layer] = rects;
  }
  schedule();
}

/** Backwards-compatible helper for the floating notes layer. */
export function setExtraHitRects(rects: HitRect[]) {
  setNamedHitRects('notes', rects);
}

/**
 * While a floating card is being dragged/resized the whole window must stay
 * interactive, otherwise the OS click-through toggle can swallow the drag.
 */
export function setHitTestForce(value: boolean) {
  forceInteractive = value;
  schedule();
}

/** Suppress hover-collapse while dragging a server out or editing the dock. */
export function setCollapseSuppressed(value: boolean) {
  collapseSuppressed = value;
}

export function isCollapseSuppressed(): boolean {
  return collapseSuppressed;
}
