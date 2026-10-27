/**
 * Fixed dimensions for every island state (CSS/logical pixels).
 * Keep the expanded size in sync with `src-tauri/src/window.rs`:
 * window footprint = expanded + shadow padding (32px sides, 12px top, 36px bottom).
 */
export const ISLAND_DIMENSIONS = {
  compact: { width: 176, height: 40, borderRadius: 20 },
  notification: { width: 360, height: 64, borderRadius: 22 },
  expanded: { width: 580, height: 350, borderRadius: 32 },
} as const;

export const ISLAND_TOP = 12;
