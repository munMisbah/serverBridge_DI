import React, { useCallback, useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { motion, AnimatePresence } from 'framer-motion';
import { ReorderIcon } from '@solar-icons/react/bold/reorder';
import { CloseCircleIcon } from '@solar-icons/react/bold/close-circle';
import { AltArrowDownIcon } from '@solar-icons/react/bold/alt-arrow-down';
import { TextBoldIcon } from '@solar-icons/react/bold/text-bold';
import { TextItalicIcon } from '@solar-icons/react/bold/text-italic';
import { TextSquareIcon } from '@solar-icons/react/bold/text-square';
import { ListIcon } from '@solar-icons/react/bold/list';
import { ListOrderedIcon } from '@solar-icons/react/bold/list-ordered';
import { ArrowUp } from 'lucide-react';
import { useIsland } from '../../context/IslandContext';
import { NOTE_COLORS, NOTE_THEME } from '../../utils/notes';
import {
  applyNoteFormat,
  applyPlainBlock,
  isRichNote,
  noteToText,
  sanitizeNoteHtml,
  selectionHasTag,
  serializeNote,
  textToNoteHtml,
  toggleNoteHeading,
  toggleNoteList,
  type NoteFormatCommand,
} from '../../utils/richText';
import { SlashMenu } from './SlashMenu';
import {
  clearSlashQuery,
  filterSlashItems,
  readSlashTrigger,
  type SlashItem,
  type SlashTrigger,
} from '../../utils/slashMenu';

const TEXT_SAVE_DELAY = 250;

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

interface NativeFloatingNoteWindowProps {
  noteId: string;
}

export const NativeFloatingNoteWindow: React.FC<NativeFloatingNoteWindowProps> = ({ noteId }) => {
  const { notes, updateNote, deleteNote, settings } = useIsland();
  const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
  const note = notes.find((n) => n.id === noteId) ?? null;

  const [text, setText] = useState(() => note?.content ?? '');
  const [html, setHtml] = useState(() =>
    note ? (isRichNote(note.content) ? note.content : textToNoteHtml(note.content)) : ''
  );
  const [empty, setEmpty] = useState(() => (note?.content ?? '').trim() === '');
  const [slash, setSlash] = useState<{ trigger: SlashTrigger; items: SlashItem[] } | null>(null);
  const [slashIndex, setSlashIndex] = useState(0);
  const [inDockZone, setInDockZone] = useState(false);
  const [isDocking, setIsDocking] = useState(false);
  const [marks, setMarks] = useState({
    bold: false,
    italic: false,
    heading: false,
    bullet: false,
    numbered: false,
  });

  const editorRef = useRef<HTMLDivElement>(null);
  const seededRef = useRef(false);
  const saveTimer = useRef<number | undefined>(undefined);
  const lastSaved = useRef(note?.content ?? '');

  const isDarkGlass = (settings.noteStyle ?? 'classic') === 'dark-glass';

  // Ensure backdrop matches noteStyle right after window mounts or changes
  useEffect(() => {
    if (!isTauri) return;
    void invoke('set_floating_notes_style', { darkGlass: isDarkGlass }).catch(() => {});
  }, [isTauri, isDarkGlass]);

  // Listen for live dock-zone highlight & Genie suck-up trigger when dragged near the Dynamic Island
  useEffect(() => {
    if (!isTauri) return;
    let cancelled = false;
    const unlisteners: (() => void)[] = [];
    import('@tauri-apps/api/event')
      .then(async ({ listen }) => {
        const u1 = await listen<{ noteId: string; active: boolean }>(
          'floating-note-dock-zone',
          (e) => {
            if (e.payload.noteId === noteId) {
              setInDockZone(e.payload.active);
            }
          }
        );
        const u2 = await listen<string>('floating-note-docking', (e) => {
          if (e.payload === noteId) {
            setInDockZone(false);
            setIsDocking(true);
          }
        });
        if (cancelled) {
          u1();
          u2();
        } else {
          unlisteners.push(u1, u2);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      unlisteners.forEach((fn) => fn());
    };
  }, [isTauri, noteId]);

  // Seed editor DOM once when note becomes available
  useEffect(() => {
    if (seededRef.current || !note || !editorRef.current) return;
    seededRef.current = true;
    const initialHtml = isRichNote(note.content)
      ? sanitizeNoteHtml(note.content)
      : textToNoteHtml(note.content);
    editorRef.current.innerHTML = initialHtml;
    setHtml(initialHtml);
    setText(note.content);
    setEmpty(note.content.trim() === '');
    lastSaved.current = note.content;
  }, [note]);

  useEffect(() => () => window.clearTimeout(saveTimer.current), []);

  const commitHtml = useCallback(
    (nextHtml: string) => {
      const serialized = serializeNote(nextHtml);
      if (serialized === lastSaved.current) return;
      lastSaved.current = serialized;
      updateNote(noteId, { content: serialized });
    },
    [noteId, updateNote]
  );

  const scheduleSave = (nextHtml: string) => {
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => commitHtml(nextHtml), TEXT_SAVE_DELAY);
  };

  const syncMarks = () => {
    setMarks({
      bold: selectionHasTag(['B', 'STRONG']),
      italic: selectionHasTag(['I', 'EM']),
      heading: selectionHasTag(['H1', 'H2', 'H3']),
      bullet: selectionHasTag(['UL']),
      numbered: selectionHasTag(['OL']),
    });
  };

  const refreshSlash = () => {
    const trigger = readSlashTrigger();
    if (!trigger) {
      setSlash(null);
      return;
    }
    const items = filterSlashItems(trigger.query);
    if (items.length === 0) {
      setSlash(null);
      return;
    }
    setSlash({ trigger, items });
    setSlashIndex(0);
  };

  const handleEditorInput = () => {
    const el = editorRef.current;
    if (!el) return;
    const nextHtml = el.innerHTML;
    setHtml(nextHtml);
    setText(nextHtml);
    setEmpty(el.textContent?.trim() === '' && !el.querySelector('li'));
    scheduleSave(nextHtml);
    syncMarks();
    refreshSlash();
  };

  const runFormat = (command: NoteFormatCommand) => {
    const el = editorRef.current;
    if (!el) return;
    if (document.activeElement !== el) el.focus();
    if (command === 'heading') toggleNoteHeading(el);
    else if (command === 'bullet') toggleNoteList(el, 'ul');
    else if (command === 'numbered') toggleNoteList(el, 'ol');
    else applyNoteFormat(command);
    handleEditorInput();
  };

  const applySlashItem = (item: SlashItem) => {
    const el = editorRef.current;
    if (!el || !slash) return;
    clearSlashQuery(slash.trigger);
    el.focus();
    setSlash(null);
    if (item.action.kind === 'plain') {
      applyPlainBlock(el);
      handleEditorInput();
      return;
    }
    runFormat(item.action.command);
  };

  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (slash) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSlashIndex((i) => (i + 1) % slash.items.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSlashIndex((i) => (i - 1 + slash.items.length) % slash.items.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        applySlashItem(slash.items[slashIndex] ?? slash.items[0]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setSlash(null);
        return;
      }
    }

    if ((e.ctrlKey || e.metaKey) && !e.shiftKey) {
      const k = e.key.toLowerCase();
      if (k === 'b') {
        e.preventDefault();
        runFormat('bold');
      } else if (k === 'i') {
        e.preventDefault();
        runFormat('italic');
      }
    }
  };

  const handleDock = async () => {
    if (isDocking) return;
    commitHtml(html);
    setInDockZone(false);
    setIsDocking(true);
    if (isTauri) {
      if (isDarkGlass) {
        void invoke('set_floating_notes_style', { darkGlass: false }).catch(() => {});
      }
      await new Promise((r) => window.setTimeout(r, 210));
      await invoke('close_floating_note_window', { noteId, focusMain: true }).catch(() => {});
    }
  };

  const handleDelete = async () => {
    deleteNote(noteId);
    if (isTauri) {
      await invoke('close_floating_note_window', { noteId, focusMain: false }).catch(() => {});
    }
  };

  if (!note) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-[#0c0d12] text-white select-none">
        <p className="text-xs text-neutral-400">Catatan tidak ditemukan</p>
        <button
          type="button"
          onClick={() => void handleDock()}
          className="mt-2 rounded-lg bg-white/10 px-3 py-1 text-xs hover:bg-white/20"
        >
          Tutup
        </button>
      </div>
    );
  }

  const theme = NOTE_THEME[note.color] ?? NOTE_THEME.yellow;
  const plainText = isRichNote(text) ? noteToText(text) : text;
  const title = plainText.split('\n')[0].trim().slice(0, 28) || 'Catatan kosong';

  const headerTextColor = isDarkGlass ? 'rgba(255,255,255,0.75)' : theme.muted;
  const bodyTextColor = isDarkGlass ? 'rgba(255,255,255,0.92)' : theme.text;
  const mutedColor = isDarkGlass ? 'rgba(255,255,255,0.48)' : theme.muted;

  return (
    <motion.div
      initial={{ opacity: 0, scaleX: 0.58, scaleY: 0.38, y: -24 }}
      animate={
        isDocking
          ? {
              opacity: 0,
              scaleX: 0.16,
              scaleY: 0.06,
              y: -48,
              borderRadius: '28px',
            }
          : {
              opacity: inDockZone ? 0.85 : 1,
              scaleX: inDockZone ? 0.95 : 1,
              scaleY: inDockZone ? 0.95 : 1,
              y: 0,
              borderRadius: '0px',
            }
      }
      transition={
        isDocking
          ? { duration: 0.2, ease: [0.4, 0, 0.2, 1] }
          : { type: 'spring', stiffness: 420, damping: 28, mass: 0.7 }
      }
      style={
        isDarkGlass
          ? isDocking
            ? { backgroundColor: 'rgba(14, 16, 22, 0.92)' }
            : undefined
          : {
              backgroundColor: theme.bg,
              color: theme.text,
            }
      }
      className={`relative flex h-screen w-screen origin-top flex-col overflow-hidden select-none ${
        isDarkGlass ? 'bg-transparent text-white' : ''
      } ${inDockZone ? 'ring-2 ring-inset ring-sky-400/75' : ''}`}
    >
      {/* Live Dock Indicator Pill */}
      <AnimatePresence>
        {inDockZone && (
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.94 }}
            transition={{ duration: 0.14 }}
            className="pointer-events-none absolute inset-x-0 top-1.5 z-50 flex justify-center"
          >
            <div className="flex items-center gap-1 rounded-full bg-sky-500/90 px-2.5 py-0.5 text-[9.5px] font-semibold text-white shadow-lg ring-1 ring-white/25">
              <ArrowUp size={10} className="animate-bounce" />
              Lepas untuk dock
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Multi-Monitor Native Draggable Header */}
      <div
        data-tauri-drag-region
        className={`flex h-8 shrink-0 cursor-move items-center gap-1.5 px-2.5 ${
          isDarkGlass ? 'border-b border-white/[0.08] bg-black/25' : ''
        }`}
        style={isDarkGlass ? undefined : { backgroundColor: theme.border }}
      >
        {isDarkGlass ? (
          <span
            className="pointer-events-none h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: theme.dot }}
          />
        ) : (
          <ReorderIcon size={13} className="pointer-events-none" style={{ color: theme.muted }} />
        )}

        <span
          data-tauri-drag-region
          className="min-w-0 flex-1 truncate text-[10px] font-semibold uppercase tracking-wider"
          style={{ color: headerTextColor }}
        >
          {title}
        </span>

        <button
          type="button"
          title="Masukkan kembali ke Dynamic Island"
          onClick={() => void handleDock()}
          className={`flex h-5 w-5 items-center justify-center rounded-md transition-colors ${
            isDarkGlass ? 'hover:bg-white/10' : 'hover:bg-black/10'
          }`}
          style={{ color: mutedColor }}
        >
          <AltArrowDownIcon size={13} />
        </button>
        <button
          type="button"
          title="Hapus note"
          onClick={() => void handleDelete()}
          className={`flex h-5 w-5 items-center justify-center rounded-md transition-colors ${
            isDarkGlass ? 'hover:bg-red-500/20 hover:text-red-300' : 'hover:bg-black/10'
          }`}
          style={{ color: mutedColor }}
        >
          <CloseCircleIcon size={13} />
        </button>
      </div>

      {/* Rich Text Editor */}
      <div
        ref={editorRef}
        contentEditable
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
        style={{ color: bodyTextColor }}
      />

      {/* Format Toolbar */}
      <div
        className="flex shrink-0 items-center gap-0.5 px-2 pb-1"
        style={{ color: mutedColor }}
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
            className={`flex h-5 w-5 items-center justify-center rounded-md transition-colors ${
              isDarkGlass
                ? 'hover:bg-white/10 aria-pressed:bg-white/20 aria-pressed:text-white'
                : 'hover:bg-black/10 aria-pressed:bg-black/15'
            }`}
            style={{ color: mutedColor }}
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

      {/* Footer: 5 Color Dots + Updated Timestamp */}
      <div className="flex shrink-0 items-center gap-1.5 px-3 pb-2">
        {NOTE_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            title={`Warna ${color}`}
            onClick={() => updateNote(note.id, { color })}
            className="h-2.5 w-2.5 rounded-full ring-1 ring-black/15 transition-transform hover:scale-125"
            style={{
              backgroundColor: NOTE_THEME[color].dot,
              boxShadow:
                note.color === color
                  ? `0 0 0 2px ${isDarkGlass ? '#ffffff' : theme.accent}`
                  : undefined,
            }}
          />
        ))}
        <span className="ml-auto text-[9px] tabular-nums" style={{ color: mutedColor }}>
          {formatTime(note.updatedAt)}
        </span>
      </div>
    </motion.div>
  );
};
