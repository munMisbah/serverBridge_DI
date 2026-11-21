import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useIsland } from '../../context/IslandContext';
import { setExtraHitRects } from '../../lib/hitTest';
import { peekNoteOrigin } from '../../lib/noteTransition';
import type { NoteItem } from '../../types';
import { StickyNote } from './StickyNote';

const CASCADE_STEP = 26;
/** Keep a card mounted long enough to fly back into its row. */
const CLOSE_ANIMATION_MS = 720;

/**
 * Floating sticky notes layer.
 *
 * Notes live in the same window as the island (no extra webview). While at
 * least one note is open the native window is grown to the monitor work area,
 * and the Rust hit-test keeps everything except the island + note rects
 * click-through.
 */
export const NotesLayer: React.FC = () => {
  const { notes, updateNote, settings } = useIsland();
  const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
  const openNotes = useMemo(() => notes.filter((n) => !n.minimized), [notes]);
  const [layerReady] = useState(true);
  // Cards that just got minimized/deleted, kept mounted while they fly home.
  const [closingNotes, setClosingNotes] = useState<NoteItem[]>([]);
  const previousOpen = useRef<NoteItem[]>([]);
  const closeTimers = useRef<number[]>([]);
  const nativeOpenedRef = useRef<Set<string>>(new Set());

  // In Tauri desktop mode, manage open notes as native multi-monitor OS windows.
  useEffect(() => {
    if (!isTauri) return;
    const currentIds = new Set(openNotes.map((n) => n.id));
    const darkGlass = (settings.noteStyle ?? 'classic') === 'dark-glass';

    import('@tauri-apps/api/core')
      .then(({ invoke }) => {
        // Open newly unminimized notes
        openNotes.forEach((n, idx) => {
          if (nativeOpenedRef.current.has(n.id)) return;
          nativeOpenedRef.current.add(n.id);
          const vw = window.innerWidth || 1280;
          const offset = (idx % 6) * CASCADE_STEP;
          const x = n.x >= 0 ? n.x : Math.round(vw / 2) + 90 + offset;
          const y = n.y >= 0 ? n.y : 120 + offset;
          void invoke('open_floating_note_window', {
            noteId: n.id,
            width: n.width,
            height: n.height,
            x,
            y,
            darkGlass,
          }).catch(() => {
            nativeOpenedRef.current.delete(n.id);
          });
        });

        // Close minimized/deleted notes
        Array.from(nativeOpenedRef.current).forEach((id) => {
          if (!currentIds.has(id)) {
            nativeOpenedRef.current.delete(id);
            void invoke('close_floating_note_window', {
              noteId: id,
              focusMain: false,
            }).catch(() => {});
          }
        });
      })
      .catch(() => {});
  }, [isTauri, openNotes, settings.noteStyle]);

  // Track notes leaving the open set so they can animate out instead of popping.
  useEffect(() => {
    const previous = previousOpen.current;
    previousOpen.current = openNotes;

    const openIds = new Set(openNotes.map((n) => n.id));
    const justClosed = previous.filter((n) => !openIds.has(n.id));
    if (justClosed.length === 0) return;

    setClosingNotes((prev) => {
      const known = new Set(prev.map((n) => n.id));
      const added = justClosed.filter((n) => !known.has(n.id));
      return added.length > 0 ? [...prev, ...added] : prev;
    });

    const timer = window.setTimeout(() => {
      setClosingNotes((prev) => prev.filter((n) => !justClosed.some((c) => c.id === n.id)));
    }, CLOSE_ANIMATION_MS);
    closeTimers.current.push(timer);
  }, [openNotes]);

  useEffect(
    () => () => {
      closeTimers.current.forEach((timer) => window.clearTimeout(timer));
    },
    []
  );

  // Give brand-new notes a cascade position near the island.
  useEffect(() => {
    if (!layerReady) return;
    const unplaced = openNotes.filter((n) => n.x < 0 || n.y < 0);
    if (unplaced.length === 0) return;

    const vw = window.innerWidth || 1280;
    const vh = window.innerHeight || 800;
    const baseX = Math.round(vw / 2) + 96;
    const baseY = 132;
    let index = openNotes.length - unplaced.length;

    unplaced.forEach((note) => {
      const offset = (index % 6) * CASCADE_STEP;
      updateNote(note.id, {
        x: Math.max(8, Math.min(baseX + offset, vw - note.width - 8)),
        y: Math.max(8, Math.min(baseY + offset, vh - note.height - 8)),
      });
      index += 1;
    });
  }, [layerReady, openNotes, updateNote]);

  // Keep cards inside the viewport when the window resizes.
  useEffect(() => {
    if (!layerReady) return;

    const clampAll = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      openNotes.forEach((note) => {
        const x = Math.max(4, Math.min(note.x, vw - note.width - 4));
        const y = Math.max(4, Math.min(note.y, vh - note.height - 4));
        if (x !== note.x || y !== note.y) updateNote(note.id, { x, y });
      });
    };

    window.addEventListener('resize', clampAll);
    return () => window.removeEventListener('resize', clampAll);
  }, [layerReady, openNotes, updateNote]);

  // Register note rects so the native layer only grabs clicks over them (browser/overlay mode).
  useEffect(() => {
    if (isTauri || !layerReady) {
      setExtraHitRects([]);
      return;
    }
    setExtraHitRects(
      openNotes
        .filter((n) => n.x >= 0 && n.y >= 0)
        .map((n) => ({ x: n.x, y: n.y, width: n.width, height: n.height }))
    );
  }, [isTauri, layerReady, openNotes]);

  if (isTauri) return null;

  const openIds = new Set(openNotes.map((n) => n.id));

  return (
    <div
      data-notes-layer
      className="pointer-events-none fixed inset-0 z-[60] overflow-hidden"
    >
      {layerReady &&
        openNotes.map((note) => (
          <StickyNote key={note.id} note={note} origin={peekNoteOrigin(note.id)} />
        ))}

      {closingNotes
        .filter((note) => !openIds.has(note.id))
        .map((note) => (
          <StickyNote key={`closing-${note.id}`} note={note} closing />
        ))}
    </div>
  );
};
