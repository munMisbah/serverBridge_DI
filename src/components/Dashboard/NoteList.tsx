import React from 'react';
import { AddCircleIcon } from '@solar-icons/react/bold/add-circle';
import { MaximizeSquareIcon } from '@solar-icons/react/bold/maximize-square';
import { MinimizeSquareIcon } from '@solar-icons/react/bold/minimize-square';
import { NotesIcon } from '@solar-icons/react/bold/notes';
import { TrashBinTrashIcon } from '@solar-icons/react/bold/trash-bin-trash';
import { useIsland } from '../../context/IslandContext';
import { rememberNoteOrigin } from '../../lib/noteTransition';
import { NOTE_THEME } from '../../utils/notes';
import { noteToText } from '../../utils/richText';

const noteTitle = (content: string) => {
  const first = noteToText(content).split('\n')[0].trim();
  return first ? first.slice(0, 40) : 'Catatan kosong';
};

const notePreview = (content: string) => {
  const lines = noteToText(content).split('\n').slice(1).join(' ').trim();
  return lines ? lines.slice(0, 60) : 'Klik untuk membuka';
};

export const NoteList: React.FC = () => {
  const { notes, createNote, toggleNote, deleteNote, openAllNotes, minimizeAllNotes } =
    useIsland();

  const openCount = notes.filter((n) => !n.minimized).length;

  // Remember where each row sits so cards can fly out of / back into it.
  const rememberRowOrigins = () => {
    notes.forEach((note) => {
      rememberNoteOrigin(note.id, document.querySelector(`[data-note-row="${note.id}"]`));
    });
  };

  return (
    <div className="flex w-[168px] shrink-0 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between pb-2 pl-0.5">
        <div className="flex items-center gap-1.5">
          <NotesIcon size={13} className="text-amber-300" />
          <span className="text-[12px] font-semibold text-white/90">Notes</span>
          <span className="rounded-full bg-white/[0.08] px-1.5 text-[9px] font-medium text-white/60">
            {notes.length}
          </span>
        </div>

        <div className="flex items-center gap-0.5">
          <button
            type="button"
            aria-label="Buka semua note"
            onClick={() => {
              rememberRowOrigins();
              openAllNotes();
            }}
            disabled={notes.length === 0 || openCount === notes.length}
            className="flex h-5 w-5 items-center justify-center rounded-md text-white/40 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-25 disabled:hover:bg-transparent"
          >
            <MaximizeSquareIcon size={12} />
          </button>
          <button
            type="button"
            aria-label="Minimize semua note"
            onClick={minimizeAllNotes}
            disabled={openCount === 0}
            className="flex h-5 w-5 items-center justify-center rounded-md text-white/40 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-25 disabled:hover:bg-transparent"
          >
            <MinimizeSquareIcon size={12} />
          </button>
          <button
            type="button"
            aria-label="Note baru"
            onClick={(e) => {
              const id = createNote();
              rememberNoteOrigin(id, e.currentTarget);
            }}
            className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-300/15 text-amber-200 transition-all hover:bg-amber-300/25 active:scale-95"
          >
            <AddCircleIcon size={13} />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20">
        {notes.length === 0 ? (
          <div className="flex h-full min-h-[90px] flex-col items-center justify-center rounded-2xl bg-white/[0.02] p-3 text-center">
            <p className="text-[11px] font-medium text-white/60">Belum ada note</p>
            <p className="mt-0.5 text-[9.5px] text-white/35">
              Klik tombol + untuk menambah sticky note
            </p>
          </div>
        ) : (
          notes.map((note) => {
            const theme = NOTE_THEME[note.color] ?? NOTE_THEME.yellow;
            return (
              <div
                key={note.id}
                role="button"
                tabIndex={0}
                data-note-row={note.id}
                onClick={(e) => {
                  rememberNoteOrigin(note.id, e.currentTarget);
                  toggleNote(note.id);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    rememberNoteOrigin(note.id, e.currentTarget);
                    toggleNote(note.id);
                  }
                }}
                aria-label={note.minimized ? 'Buka note' : 'Minimize note'}
                className="group flex w-full cursor-pointer items-start gap-1.5 rounded-xl bg-white/[0.03] px-2 py-1.5 text-left transition-all hover:bg-white/[0.07]"
              >
                <span
                  className="mt-1 h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: theme.dot }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[10.5px] font-medium text-white/85">
                    {noteTitle(note.content)}
                  </span>
                  <span className="block truncate text-[9px] text-white/40">
                    {notePreview(note.content)}
                  </span>
                </span>

                {!note.minimized && (
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                )}

                <button
                  type="button"
                  aria-label="Hapus note"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteNote(note.id);
                  }}
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-white/30 opacity-0 transition-all hover:bg-red-500/20 hover:text-red-300 group-hover:opacity-100"
                >
                  <TrashBinTrashIcon size={11} />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
