import React, { useState, useRef } from 'react';
import { CheckCircleIcon } from '@solar-icons/react/bold/check-circle';
import { CheckIcon } from '@solar-icons/react/bold/check';
import { TrashBinTrashIcon } from '@solar-icons/react/bold/trash-bin-trash';
import { useIsland } from '../../context/IslandContext';
import { NoteList } from './NoteList';

export const TodoTab: React.FC = () => {
  const { todos, addTodo, toggleTodo, deleteTodo } = useIsland();
  const [newTitle, setNewTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const totalCount = todos.length;
  const completedCount = todos.filter((t) => t.completed).length;
  const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Circular progress math (radius: 41, circumference: 2 * pi * 41 = 257.61)
  const radius = 41;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;
  const handleAddTask = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    addTodo(title);
    setNewTitle('');
    inputRef.current?.focus();
  };

  return (
    <div className="flex h-full w-full gap-3 px-4 pt-3 pb-1 text-white select-none">
      {/* LEFT COLUMN: Circular Progress Indicator */}
      <div className="flex w-[140px] shrink-0 flex-col items-center justify-between py-1 px-1 text-center">
        <div className="w-full">
          <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
            TODO
          </p>
        </div>

        {/* Bold Circular Progress with Green Check Logo in the Center */}
        <div className="relative my-auto flex items-center justify-center">
          <svg className="h-[112px] w-[112px] -rotate-90 transform" viewBox="0 0 100 100">
            {/* Background Track Circle */}
            <circle
              cx="50"
              cy="50"
              r={radius}
              className="text-neutral-800"
              strokeWidth="8.5"
              stroke="currentColor"
              fill="transparent"
            />
            {/* Active Progress Circle */}
            <circle
              cx="50"
              cy="50"
              r={radius}
              className="text-emerald-500 transition-all duration-500 ease-out"
              strokeWidth="8.5"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              stroke="currentColor"
              fill="transparent"
            />
          </svg>

          {/* Center: Green Check Logo */}
          <div className="absolute inset-0 flex items-center justify-center">
            <CheckCircleIcon size={50} className="text-emerald-400 drop-shadow-sm" />
          </div>
        </div>

        {/* Bottom Info: Percentage & Completed Ratio */}
        <div className="w-full">
          <p className="text-[11.5px] font-medium text-neutral-400 leading-tight">
            {totalCount === 0 ? 'No tasks yet' : `${completedCount} of ${totalCount} Done`}
          </p>
        </div>
      </div>

      {/* RIGHT COLUMN: Todo List & Add Task */}
      <div className="flex min-w-0 flex-1 flex-col justify-between overflow-hidden">
        {/* Header Row: Tasks count */}
        <div className="flex shrink-0 items-center gap-1.5 pb-1.5 px-0.5">
          <span className="text-[12px] font-semibold text-white/90">Tasks</span>
          <span className="rounded-full bg-neutral-800 px-1.5 py-0.2 text-[9px] font-medium text-neutral-300">
            {totalCount}
          </span>
        </div>

        {/* Inline Add Field: ketik lalu tekan Enter untuk menambah task */}
        <form onSubmit={handleAddTask} className="mb-1.5 shrink-0">
          <input
            ref={inputRef}
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Tambah task baru, lalu tekan Enter…"
            className="w-full rounded-xl bg-neutral-900 px-2.5 py-1.5 text-[11px] text-white placeholder-neutral-500 outline-none transition-colors focus:bg-neutral-800"
          />
        </form>
        {/* Scrollable Todo Items List */}
        <div className="min-h-0 flex-1 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20">
          {todos.length === 0 ? (
            <div className="flex h-full min-h-[90px] flex-col items-center justify-center rounded-2xl bg-white/[0.02] p-3 text-center">
              <p className="text-[11px] font-medium text-white/60">
                Belum ada todo task
              </p>
              <p className="mt-0.5 text-[9.5px] text-white/35">
                Ketik task baru di kolom atas lalu tekan Enter
              </p>
            </div>
          ) : (
            todos.map((todo) => {
              return (
                <div
                  key={todo.id}
                  onClick={() => toggleTodo(todo.id)}
                  className="group flex cursor-pointer items-center justify-between gap-2.5 rounded-xl bg-white/[0.03] px-2.5 py-1.5 transition-all hover:bg-white/[0.06]"
                >
                  {/* Left: Checkbox circle + Title */}
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleTodo(todo.id);
                      }}
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full transition-all ${
                        todo.completed
                          ? 'bg-emerald-500 text-neutral-950 shadow-xs'
                          : 'border-2 border-white/30 hover:border-emerald-400'
                      }`}
                    >
                      {todo.completed && (
                        <CheckIcon size={10} className="stroke-[3]" />
                      )}
                    </button>

                    <span
                      className={`truncate text-[11.5px] transition-all select-none ${
                        todo.completed
                          ? 'text-white/40 line-through'
                          : 'font-medium text-white/90'
                      }`}
                    >
                      {todo.title}
                    </span>
                  </div>

                  {/* Right: Delete action */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteTodo(todo.id);
                    }}
                    title="Hapus task"
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-white/30 opacity-0 transition-all hover:bg-red-500/20 hover:text-red-300 group-hover:opacity-100"
                  >
                    <TrashBinTrashIcon size={12} />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Separator */}
      <div className="flex w-2 shrink-0 items-center justify-center self-stretch">
        <div className="h-full w-px bg-white/10" />
      </div>

      {/* RIGHT COLUMN: Sticky note list */}
      <NoteList />
    </div>
  );
};
