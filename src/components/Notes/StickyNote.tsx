import React, { useEffect, useRef, useState } from 'react';
import { animate, motion, useMotionValue, useTransform } from 'framer-motion';
import { ReorderIcon } from '@solar-icons/react/bold/reorder';
import { CloseCircleIcon } from '@solar-icons/react/bold/close-circle';
import { AltArrowDownIcon } from '@solar-icons/react/bold/alt-arrow-down';
import { TextBoldIcon } from '@solar-icons/react/bold/text-bold';
import { TextItalicIcon } from '@solar-icons/react/bold/text-italic';
import { TextSquareIcon } from '@solar-icons/react/bold/text-square';
import { ListIcon } from '@solar-icons/react/bold/list';
import { ListOrderedIcon } from '@solar-icons/react/bold/list-ordered';
import { useIsland } from '../../context/IslandContext';
import { setHitTestForce } from '../../lib/hitTest';
import { findNoteAnchor, originToViewport, type NoteOrigin } from '../../lib/noteTransition';
import {
  applyNoteFormat,
  isRichNote,
  noteToText,
  sanitizeNoteHtml,
  selectionHasTag,
  serializeNote,
  applyPlainBlock,
  textToNoteHtml,
  toggleNoteHeading,
  toggleNoteList,
  type NoteFormatCommand,
} from '../../utils/richText';
import {
  NOTE_COLORS,
  NOTE_MIN_HEIGHT,
  NOTE_MIN_WIDTH,
  NOTE_THEME,
} from '../../utils/notes';
import { SlashMenu } from './SlashMenu';
import {
  clearSlashQuery,
  filterSlashItems,
  readSlashTrigger,
  type SlashItem,
  type SlashTrigger,
} from '../../utils/slashMenu';
import type { NoteItem } from '../../types';

const EDGE_PAD = 6;
const TEXT_SAVE_DELAY = 350;

/** Spring used while the card flies out of the note list (macOS-ish lift). */
const LIFT_SPRING = { type: 'spring', stiffness: 430, damping: 30, mass: 0.65 } as const;
/** Fly-back curve: fast at the start, soft landing into the row. */
const FLY_BACK_EASE: [number, number, number, number] = [0.32, 0, 0.2, 1];
const FLY_BACK_DURATION = 0.34;
const INTRO_GUARD_MS = 620;

type FormatButton = {
  command: NoteFormatCommand;
  label: string;
  Icon: React.ComponentType<{ size?: number }>;
};

const NOTE_FORMAT_BUTTONS: FormatButton[] = [
  { command: 'heading', label: 'Heading', Icon: TextSquareIcon },
  { command: 'bold', label: 'Bold (Ctrl+B)', Icon: TextBoldIcon },
  { command: 'italic', label: 'Italic (Ctrl+I)', Icon: TextItalicIcon },
  { command: 'bullet', label: 'Daftar bullet', Icon: ListIcon },
  { command: 'numbered', label: 'Daftar nomor', Icon: ListOrderedIcon },
];

const formatTime = (ts: number) =>
  new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

type StickyNoteProps = {
  note: NoteItem;
  /** Where the card flies out from, in screen coordinates. */
  origin?: NoteOrigin;
  /** True while the card animates back into its row / the island. */
  closing?: boolean;
};

export const StickyNote: React.FC<StickyNoteProps> = ({ note, origin, closing = false }) => {
  const { updateNote, deleteNote, toggleNote, bringNoteToFront, settings } = useIsland();
  const theme = NOTE_THEME[note.color] ?? NOTE_THEME.yellow;
  const reduced = settings.reducedMotionEnabled;

  const [text, setText] = useState(note.content);
  const [html, setHtml] = useState(() =>
    isRichNote(note.content) ? note.content : textToNoteHtml(note.content)
  );
  const [empty, setEmpty] = useState(() => note.content.trim() === '');
  const [slash, setSlash] = useState<{ trigger: SlashTrigger; items: SlashItem[] } | null>(null);
  const [slashIndex, setSlashIndex] = useState(0);
  const editorRef = useRef<HTMLDivElement>(null);
  const [marks, setMarks] = useState<{ bold: boolean; italic: boolean; heading: boolean; bullet: boolean; numbered: boolean }>({
    bold: false,
    italic: false,
    heading: false,
    bullet: false,
    numbered: false,
  });
  const [size, setSize] = useState({ w: note.width, h: note.height });
  const sizeRef = useRef(size);
  const saveTimer = useRef<number | undefined>(undefined);
  const lastSaved = useRef(note.content);
  const interacting = useRef(false);
  // While true the entrance/exit animation owns x/y, so the stored position
  // must not be applied on top of it.
  const animating = useRef(!closing && Boolean(origin));
  const introDone = useRef(closing);
  const closeStarted = useRef(false);
  const releaseTimer = useRef<number | undefined>(undefined);
  const cardRef = useRef<HTMLDivElement>(null);
  // Genie warps need a screenshot, so the real card stays hidden while the
  // canvas owns the pixels.
  const [revealed] = useState(true);

  const [initial] = useState(() => {
    if (closing) return { x: note.x, y: note.y, scale: 1, opacity: 1, blur: 0 };
    if (!origin) {
      return {
        x: note.x,
        y: note.y,
        scale: reduced ? 1 : 0.88,
        opacity: 0,
        blur: reduced ? 0 : 5,
      };
    }
    const anchor = originToViewport(origin);
    const { w, h } = sizeRef.current;
    return {
      x: anchor.cx - w / 2,
      y: anchor.cy - h / 2,
      scale: Math.min(1, Math.max(origin.w / w, 0.12)),
      opacity: 0.1,
      blur: 2,
    };
  });

  // Transform is driven by motion values so dragging never re-renders React.
  const x = useMotionValue(initial.x);
  const y = useMotionValue(initial.y);
  const scale = useMotionValue(initial.scale);
  const opacity = useMotionValue(initial.opacity);
  const blur = useMotionValue(initial.blur);
  const filter = useTransform(blur, (value) =>
    value > 0.05 ? `blur(${value.toFixed(2)}px)` : 'none'
  );

  const tilt = note.z % 2 === 0 ? 0.6 : -0.6;

  useEffect(() => {
    if (interacting.current || animating.current) return;
    x.set(note.x);
    y.set(note.y);
  }, [note.x, note.y, x, y]);

  useEffect(() => {
    sizeRef.current = { w: note.width, h: note.height };
    setSize({ w: note.width, h: note.height });
  }, [note.width, note.height]);

  // Seed the editor once; afterwards the DOM is the source of truth so the
  // caret never jumps while typing.
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    el.innerHTML = isRichNote(note.content) ? sanitizeNoteHtml(note.content) : textToNoteHtml(note.content);
  }, []);

  useEffect(
    () => () => {
      window.clearTimeout(saveTimer.current);
      window.clearTimeout(releaseTimer.current);
    },
    []
  );

  // Entrance: lift off from the list row and spring into place.
  useEffect(() => {
    if (introDone.current) return;
    // Fresh notes are placed by the layer right after mount (-1,-1 sentinel).
    if (note.x < 0 || note.y < 0) return;
    introDone.current = true;
    x.set(note.x);
    y.set(note.y);

    window.clearTimeout(releaseTimer.current);
    releaseTimer.current = window.setTimeout(() => {
      animating.current = false;
    }, INTRO_GUARD_MS);

    if (origin && !reduced) {
      animate(x, note.x, LIFT_SPRING);
      animate(y, note.y, LIFT_SPRING);
      animate(scale, 1, LIFT_SPRING);
      animate(opacity, 1, { duration: 0.22, ease: 'easeOut' });
      animate(blur, 0, { duration: 0.24, ease: 'easeOut' });
      return;
    }

    if (reduced) {
      animate(scale, 1, { duration: 0.12 });
      animate(opacity, 1, { duration: 0.12 });
      animate(blur, 0, { duration: 0.01 });
      return;
    }

    animate(scale, 1, { type: 'spring', stiffness: 400, damping: 26, mass: 0.6 });
    animate(opacity, 1, { duration: 0.16, ease: 'easeOut' });
    animate(blur, 0, { duration: 0.24, ease: 'easeOut' });
  }, [note.x, note.y, origin, x, y, scale, opacity, blur]);

  // Exit: shrink back into the note row (or the island when the list is closed).
  useEffect(() => {
    if (!closing || closeStarted.current) return;
    closeStarted.current = true;
    animating.current = true;
    window.clearTimeout(releaseTimer.current);

    x.stop();
    y.stop();

    if (reduced) {
      animate(opacity, 0, { duration: 0.12 });
      return;
    }


    const { w, h } = sizeRef.current;
    const anchor = findNoteAnchor(note.id);
    const target = anchor
      ? {
          x: originToViewport(anchor).cx - w / 2,
          y: originToViewport(anchor).cy - h / 2,
          scale: Math.min(1, Math.max(anchor.w / w, 0.08)),
        }
      : { x: window.innerWidth / 2 - w / 2, y: -h, scale: 0.08 };

    animate(x, target.x, { duration: FLY_BACK_DURATION, ease: FLY_BACK_EASE });
    animate(y, target.y, { duration: FLY_BACK_DURATION, ease: FLY_BACK_EASE });
    animate(scale, target.scale, { duration: FLY_BACK_DURATION, ease: FLY_BACK_EASE });
    animate(opacity, 0, { duration: 0.24, ease: 'easeIn' });
    animate(blur, 4, { duration: 0.26, ease: 'easeIn' });
  }, [closing, note.id, x, y, scale, opacity, blur]);

  const commitHtml = (value: string) => {
    window.clearTimeout(saveTimer.current);
    const stored = serializeNote(value);
    if (lastSaved.current === stored) return;
    lastSaved.current = stored;
    setText(stored);
    updateNote(note.id, { content: stored });
  };

  const refreshSlash = () => {
    if (closing) return;
    const trigger = readSlashTrigger();
    if (!trigger) {
      setSlash(null);
      return;
    }
    setSlash({ trigger, items: filterSlashItems(trigger.query) });
    setSlashIndex(0);
  };

  const handleEditorInput = (e: React.FormEvent<HTMLDivElement>) => {
    slashBusy.current = false;
    const value = e.currentTarget.innerHTML;
    setHtml(value);
    setEmpty((e.currentTarget.textContent ?? '').trim() === '');
    refreshSlash();
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => commitHtml(value), TEXT_SAVE_DELAY);
  };

  const syncMarks = () => {
    if (closing) return;
    setMarks({
      bold: selectionHasTag(['B', 'STRONG']),
      italic: selectionHasTag(['I', 'EM']),
      heading: selectionHasTag(['H1', 'H2', 'H3']),
      bullet: selectionHasTag(['UL']),
      numbered: selectionHasTag(['OL']),
    });
  };

  const runFormat = (command: NoteFormatCommand) => {
    if (closing) return;
    const editor = editorRef.current;
    if (!editor) return;
    // Focus only when the caret is outside the editor: calling focus() on an
    // already focused editor resets the caret we just placed inside a block.
    if (document.activeElement !== editor) editor.focus();
    if (command === 'heading') {
      // A heading cannot live inside a bullet, so pull the item out first.
      const selection = window.getSelection();
      const caretNode = selection && selection.rangeCount > 0 ? selection.getRangeAt(0).startContainer : null;
      const item = caretNode instanceof Element
        ? caretNode.closest('li')
        : caretNode?.parentElement?.closest('li');
      if (item) {
        const block = document.createElement('div');
        while (item.firstChild) block.appendChild(item.firstChild);
        const list = item.parentElement;
        list?.parentElement?.insertBefore(block, list.nextSibling);
        item.remove();
        if (list && list.children.length === 0) list.remove();
        const range = document.createRange();
        range.selectNodeContents(block);
        range.collapse(false);
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
      toggleNoteHeading(editor);
    }
    else if (command === 'bullet') toggleNoteList(editor, 'ul');
    else if (command === 'numbered') toggleNoteList(editor, 'ol');
    else applyNoteFormat(command);

    const value = editorRef.current?.innerHTML ?? '';
    setHtml(value);
    commitHtml(value);
    syncMarks();
  };

  const slashBusy = useRef(false);

  const applySlashItem = (item: SlashItem) => {
    if (!slash || slashBusy.current) return;
    slashBusy.current = true;
    clearSlashQuery(slash.trigger);
    editorRef.current?.focus();
    setSlash(null);
    if (item.action.kind === 'plain') {
      const editor = editorRef.current;
      if (editor) applyPlainBlock(editor);
      const value = editorRef.current?.innerHTML ?? '';
      setHtml(value);
      commitHtml(value);
      syncMarks();
      return;
    }
    runFormat(item.action.command);
  };

  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (slash) {
      const { items } = slash;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSlashIndex((i) => (items.length === 0 ? 0 : (i + 1) % items.length));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSlashIndex((i) => (items.length === 0 ? 0 : (i - 1 + items.length) % items.length));
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        const item = items[slashIndex];
        if (item) {
          e.preventDefault();
          applySlashItem(item);
          return;
        }
        // Nothing matched: dismiss the menu and drop the query so the user is
        // not left with a stray "/text" in the note.
        e.preventDefault();
        clearSlashQuery(slash.trigger);
        setSlash(null);
        const editor = editorRef.current;
        if (editor) {
          // Removing the only text in a list item leaves an empty bullet.
          editor.querySelectorAll('li').forEach((item) => {
            if ((item.textContent ?? '').trim() === '') item.remove();
          });
          editor.querySelectorAll('ul,ol').forEach((list) => {
            if (list.children.length === 0) list.remove();
          });
          if (!editor.firstChild) editor.appendChild(document.createElement('div'));
        }
        const value = editor?.innerHTML ?? '';
        setHtml(value);
        commitHtml(value);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setSlash(null);
        return;
      }
    }

    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
      const key = e.key.toLowerCase();
      const command =
        key === 'b' ? 'bold' : key === 'i' ? 'italic' : null;
      if (command) {
        e.preventDefault();
        runFormat(command);
        return;
      }
    }
    if (e.key === 'Escape') e.currentTarget.blur();
  };

  const startDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const handle = e.currentTarget;
    handle.setPointerCapture(e.pointerId);

    x.stop();
    y.stop();
    animating.current = false;

    interacting.current = true;
    setHitTestForce(true);
    bringNoteToFront(note.id);

    const startX = e.clientX;
    const startY = e.clientY;
    const originX = x.get();
    const originY = y.get();

    const move = (ev: PointerEvent) => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      x.set(
        Math.min(Math.max(EDGE_PAD, originX + ev.clientX - startX), vw - sizeRef.current.w - EDGE_PAD)
      );
      y.set(
        Math.min(Math.max(EDGE_PAD, originY + ev.clientY - startY), vh - sizeRef.current.h - EDGE_PAD)
      );
    };

    const finish = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
      window.removeEventListener('blur', finish);
      handle.removeEventListener('lostpointercapture', finish);
      interacting.current = false;
      setHitTestForce(false);
      updateNote(note.id, { x: x.get(), y: y.get() });
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
    window.addEventListener('blur', finish);
    handle.addEventListener('lostpointercapture', finish);
  };

  const startResize = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const handle = e.currentTarget;
    handle.setPointerCapture(e.pointerId);

    interacting.current = true;
    setHitTestForce(true);
    bringNoteToFront(note.id);

    const startX = e.clientX;
    const startY = e.clientY;
    const originW = sizeRef.current.w;
    const originH = sizeRef.current.h;

    const move = (ev: PointerEvent) => {
      const maxW = window.innerWidth - x.get() - EDGE_PAD;
      const maxH = window.innerHeight - y.get() - EDGE_PAD;
      const next = {
        w: Math.min(
          Math.max(NOTE_MIN_WIDTH, originW + ev.clientX - startX),
          Math.max(NOTE_MIN_WIDTH, maxW)
        ),
        h: Math.min(
          Math.max(NOTE_MIN_HEIGHT, originH + ev.clientY - startY),
          Math.max(NOTE_MIN_HEIGHT, maxH)
        ),
      };
      sizeRef.current = next;
      setSize(next);
    };

    const finish = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
      window.removeEventListener('blur', finish);
      handle.removeEventListener('lostpointercapture', finish);
      interacting.current = false;
      setHitTestForce(false);
      updateNote(note.id, { width: sizeRef.current.w, height: sizeRef.current.h });
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
    window.addEventListener('blur', finish);
    handle.addEventListener('lostpointercapture', finish);
  };

  const plainText = isRichNote(text) ? noteToText(text) : text;
  const title = plainText.split('\n')[0].trim().slice(0, 28) || 'Catatan kosong';

  return (
    <motion.div
      ref={cardRef}
      data-note-card={note.id}
      style={{
        x,
        y,
        scale,
        opacity,
        filter,
        width: size.w,
        height: size.h,
        zIndex: note.z,
        rotate: tilt,
        backgroundColor: theme.bg,
        borderColor: theme.border,
        color: theme.text,
      }}
      className={`absolute left-0 top-0 flex origin-center flex-col overflow-hidden rounded-2xl border shadow-[0_18px_44px_rgba(0,0,0,0.5)] ${
        closing || !revealed ? 'pointer-events-none' : 'pointer-events-auto'
      }`}
      onPointerDown={() => {
        if (!closing) bringNoteToFront(note.id);
      }}
    >
      <div
        onPointerDown={closing ? undefined : startDrag}
        className="flex h-8 shrink-0 cursor-grab touch-none items-center gap-1.5 px-2.5 active:cursor-grabbing"
        style={{ backgroundColor: theme.border }}
      >
        <ReorderIcon size={13} style={{ color: theme.muted }} />
        <span
          className="min-w-0 flex-1 truncate text-[10px] font-semibold uppercase tracking-wider"
          style={{ color: theme.muted }}
        >
          {title}
        </span>
        <button
          type="button"
          title="Sembunyikan note"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => toggleNote(note.id)}
          className="flex h-5 w-5 items-center justify-center rounded-md transition-colors hover:bg-black/10"
          style={{ color: theme.muted }}
        >
          <AltArrowDownIcon size={13} />
        </button>
        <button
          type="button"
          title="Hapus note"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => deleteNote(note.id)}
          className="flex h-5 w-5 items-center justify-center rounded-md transition-colors hover:bg-black/10"
          style={{ color: theme.muted }}
        >
          <CloseCircleIcon size={13} />
        </button>
      </div>

      <div
        ref={editorRef}
        contentEditable={!closing}
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label="Isi catatan"
        data-placeholder="Tulis catatan..."
        data-empty={empty}
        onInput={handleEditorInput}
        onBlur={() => {
          setSlash(null);
          commitHtml(html);
        }}
        onKeyDown={handleEditorKeyDown}
        onKeyUp={syncMarks}
        onMouseUp={syncMarks}
        onFocus={syncMarks}
        className="note-editor min-h-0 flex-1 overflow-y-auto px-3 py-2 text-[12px] leading-relaxed outline-none"
        style={{ color: theme.text }}
      />

      <div
        className="flex shrink-0 items-center gap-0.5 px-2 pb-1"
        style={{ color: theme.muted }}
        onPointerDown={(e) => e.preventDefault()}
      >
        {NOTE_FORMAT_BUTTONS.map((item) => (
          <button
            key={item.command}
            type="button"
            title={item.label}
            aria-pressed={marks[item.command]}
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => runFormat(item.command)}
            className="flex h-5 w-5 items-center justify-center rounded-md transition-colors hover:bg-black/10 aria-pressed:bg-black/15"
            style={{ color: theme.muted }}
          >
            <item.Icon size={12} />
          </button>
        ))}
      </div>

      {slash && (
        <SlashMenu
          items={slash.items}
          activeIndex={slashIndex}
          anchor={{ x: slash.trigger.rect.left, y: slash.trigger.rect.bottom }}
          maxHeight={Math.min(180, Math.max(80, window.innerHeight - slash.trigger.rect.bottom - 24))}
          onSelect={applySlashItem}
          onHover={setSlashIndex}
        />
      )}

      <div className="flex shrink-0 items-center gap-1.5 px-3 pb-2">
        {NOTE_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            title={`Warna ${color}`}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => updateNote(note.id, { color })}
            className="h-2.5 w-2.5 rounded-full ring-1 ring-black/10 transition-transform hover:scale-125"
            style={{
              backgroundColor: NOTE_THEME[color].dot,
              boxShadow: note.color === color ? `0 0 0 2px ${theme.accent}` : undefined,
            }}
          />
        ))}
        <span className="ml-auto text-[9px] tabular-nums" style={{ color: theme.muted }}>
          {formatTime(note.updatedAt)}
        </span>
      </div>

      <div
        onPointerDown={closing ? undefined : startResize}
        title="Ubah ukuran"
        className="absolute bottom-0 right-0 h-4 w-4 cursor-nwse-resize touch-none"
      >
        <svg viewBox="0 0 16 16" className="h-full w-full" aria-hidden="true">
          <path
            d="M14 6 L6 14 M14 10 L10 14"
            stroke={theme.muted}
            strokeWidth="1.4"
            strokeLinecap="round"
            fill="none"
            opacity="0.7"
          />
        </svg>
      </div>
    </motion.div>
  );
};
