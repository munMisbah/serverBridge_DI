/**
 * Shared-element helpers for the sticky note open/close transition.
 *
 * Origins are stored in *screen* coordinates: opening the first note grows the
 * native window to the whole work area, which shifts every viewport-based
 * coordinate. The island (and therefore the note list) keeps its position on
 * screen, so screen coordinates stay valid across the resize.
 */

export interface NoteOrigin {
  /** Screen-space centre of the anchor element. */
  cx: number;
  cy: number;
  w: number;
  h: number;
}

const origins = new Map<string, NoteOrigin>();

const toScreenOrigin = (rect: DOMRect): NoteOrigin => ({
  cx: rect.left + window.screenX + rect.width / 2,
  cy: rect.top + window.screenY + rect.height / 2,
  w: rect.width,
  h: rect.height,
});

/** Remember the row/element a note should fly out of. */
export const rememberNoteOrigin = (id: string, el: Element | null | undefined) => {
  if (!el) return;
  origins.set(id, toScreenOrigin(el.getBoundingClientRect()));
};

export const peekNoteOrigin = (id: string): NoteOrigin | undefined => origins.get(id);

/** Convert a stored screen origin back into current viewport coordinates. */
export const originToViewport = (origin: NoteOrigin) => ({
  cx: origin.cx - window.screenX,
  cy: origin.cy - window.screenY,
});

/** Live anchor for closing: the note row when visible, otherwise the island. */
export const findNoteAnchor = (noteId: string): NoteOrigin | null => {
  const row = document.querySelector(`[data-note-row="${noteId}"]`);
  if (row) return toScreenOrigin(row.getBoundingClientRect());

  const island = document.querySelector('[data-island]');
  return island ? toScreenOrigin(island.getBoundingClientRect()) : null;
};
