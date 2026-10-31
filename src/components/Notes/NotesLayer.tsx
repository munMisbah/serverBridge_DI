import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useIsland } from '../../context/IslandContext';
import { setExtraHitRects } from '../../lib/hitTest';
import { peekNoteOrigin } from '../../lib/noteTransition';
import type { NoteItem } from '../../types';
import { StickyNote } from './StickyNote';

const isTauri =
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

const CASCADE_STEP = 26;
/** Keep a card mounted long enough to fly back into its row. */
const CLOSE_ANIMATION_MS = 720;
/** The window must not shrink while a card is still flying home. */
const WINDOW_SHRINK_DELAY = 760;

/**
 * Floating sticky notes layer.
 *
 * Notes live in the same window as the island (no extra webview). While at
 * least one note is open the native window is grown to the monitor work area,
 * and the Rust hit-test keeps everything except the island + note rects
 * click-through.
 */
export const NotesLayer: React.FC = () => {
  const { notes, updateNote } = useIsland();
  const openNotes = useMemo(() => notes.filter((n) => !n.minimized), [notes]);
  const [layerReady, setLayerReady] = useState(!isTauri);
  // Cards that just got minimized/deleted, kept mounted while they fly home.
  const [closingNotes, setClosingNotes] = useState<NoteItem[]>([]);
  const wasOpen = useRef(false);
  const previousOpen = useRef<NoteItem[]>([]);
  const closeTimers = useRef<number[]>([]);

  // Grow / shrink the native window around the notes.
  useEffect(() => {
    if (!isTauri) return;

    if (openNotes.length > 0) {
      if (wasOpen.current) return;
      wasOpen.current = true;

      import('@tauri-apps/api/core')
        .then(({ invoke }) => invoke('set_notes_layer_mode', { enabled: true }))
        // Wait for the webview to adopt its new viewport before placing cards.
        .then(() => {
          requestAnimationFrame(() =>
            requestAnimationFrame(() => {
              if (wasOpen.current) setLayerReady(true);
            })
          );
        })
        .catch((err) => {
          console.debug('Unable to enable notes layer:', err);
          if (wasOpen.current) setLayerReady(true);
        });
      return;
    }

    if (!wasOpen.current) return;
    wasOpen.current = false;

    const timer = window.setTimeout(() => {
      setLayerReady(false);
      import('@tauri-apps/api/core')
        .then(({ invoke }) => invoke('set_notes_layer_mode', { enabled: false }))
        .catch((err) => console.debug('Unable to disable notes layer:', err));
    }, WINDOW_SHRINK_DELAY);
    return () => window.clearTimeout(timer);
  }, [openNotes.length]);

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

  // Register note rects so the native layer only grabs clicks over them.
  useEffect(() => {
    if (!layerReady) {
      setExtraHitRects([]);
      return;
    }
    setExtraHitRects(
      openNotes.map((n) => ({ x: n.x, y: n.y, width: n.width, height: n.height }))
    );
  }, [layerReady, openNotes]);

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
