import React, { useState } from 'react';
import { Plus, Trash2, Clock, MapPin, Check, X, Calendar as CalendarIcon } from 'lucide-react';
import { useIsland } from '../../context/IslandContext';

export const CalendarTab: React.FC = () => {
  const { events, addEvent, deleteEvent } = useIsland();
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newTime, setNewTime] = useState('');
  const [newLocation, setNewLocation] = useState('');

  const today = new Date();
  const formattedDay = today.toLocaleDateString('en-US', { weekday: 'long' });
  const formattedMonthYear = today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    let startAt = Date.now() + 1000 * 60 * 60;
    if (newTime) {
      const [hours, minutes] = newTime.split(':').map(Number);
      const target = new Date();
      target.setHours(hours, minutes, 0, 0);
      if (target.getTime() < Date.now()) {
        target.setDate(target.getDate() + 1);
      }
      startAt = target.getTime();
    }

    addEvent({
      title: newTitle.trim(),
      startAt,
      location: newLocation.trim() || undefined,
      color: '#007AFF',
    });

    setNewTitle('');
    setNewTime('');
    setNewLocation('');
    setIsAdding(false);
  };

  const formatEventTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const isToday = date.toDateString() === today.toDateString();
    const time = date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    return isToday ? `Today, ${time}` : `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${time}`;
  };

  return (
    <div className="flex h-full w-full gap-3 px-4 pt-3 pb-1.5 text-white select-none">
      {/* LEFT COLUMN: Apple Calendar Date Card & + New Event */}
      <div className="flex w-[145px] shrink-0 flex-col justify-between rounded-[20px] border border-white/[0.08] bg-white/[0.04] p-3 text-center shadow-lg backdrop-blur-xl">
        <div>
          <p className="text-[10.5px] font-bold uppercase tracking-wider text-[#FF3B30]">
            {formattedDay}
          </p>
          <p className="my-0.5 text-[38px] font-semibold tracking-tight text-white leading-none">
            {today.getDate()}
          </p>
          <p className="text-[11px] font-medium text-neutral-400">
            {formattedMonthYear}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsAdding((v) => !v)}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-full bg-[#007AFF] py-1.5 text-[11px] font-semibold text-white shadow-md transition-all hover:bg-[#0062cc] active:scale-95"
        >
          {isAdding ? <X className="size-3.5" /> : <Plus className="size-3.5" />}
          <span>{isAdding ? 'Cancel' : 'New Event'}</span>
        </button>
      </div>

      {/* RIGHT COLUMN: Schedule List & Add Form */}
      <div className="flex flex-1 min-w-0 flex-col justify-between">
        {/* Header */}
        <div className="flex items-center justify-between pb-1.5 border-b border-white/[0.06]">
          <span className="text-[12px] font-semibold text-white/90 tracking-tight">
            Today's Schedule
          </span>
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[9.5px] font-medium text-neutral-300">
            {events.length} Events
          </span>
        </div>

        {/* Content Area */}
        <div className="min-h-0 flex-1 overflow-y-auto pr-1 pt-1.5 space-y-1.5">
          {isAdding ? (
            <form onSubmit={handleAdd} className="space-y-1.5">
              <input
                type="text"
                required
                placeholder="Event title..."
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full rounded-xl border border-white/[0.1] bg-white/[0.06] px-2.5 py-1 text-[11px] text-white placeholder-neutral-500 outline-none focus:border-[#007AFF]"
                autoFocus
              />

              <div className="grid grid-cols-2 gap-1.5">
                <input
                  type="time"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  className="w-full rounded-xl border border-white/[0.1] bg-white/[0.06] px-2 py-1 text-[10.5px] text-white outline-none focus:border-[#007AFF]"
                />
                <input
                  type="text"
                  placeholder="Location (optional)"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  className="w-full rounded-xl border border-white/[0.1] bg-white/[0.06] px-2 py-1 text-[10.5px] text-white placeholder-neutral-500 outline-none focus:border-[#007AFF]"
                />
              </div>

              <div className="flex justify-end gap-1.5 pt-0.5">
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="rounded-full px-2.5 py-0.5 text-[10px] text-neutral-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1 rounded-full bg-[#007AFF] px-2.5 py-0.5 text-[10px] font-semibold text-white hover:bg-[#0062cc]"
                >
                  <Check className="size-3" />
                  <span>Save</span>
                </button>
              </div>
            </form>
          ) : events.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center py-4 text-center">
              <CalendarIcon className="size-5 text-neutral-600 mb-1" />
              <p className="text-[11px] text-neutral-400">No events today</p>
            </div>
          ) : (
            events.map((event) => (
              <div
                key={event.id}
                className="group flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.03] px-2.5 py-1.5 transition-colors hover:bg-white/[0.06]"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className="h-6 w-1 shrink-0 rounded-full"
                    style={{ backgroundColor: event.color || '#007AFF' }}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-[12px] font-semibold text-white tracking-tight leading-snug">
                      {event.title}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-neutral-400">
                      <span className="flex items-center gap-0.5">
                        <Clock className="size-2.5" />
                        {formatEventTime(event.startAt)}
                      </span>
                      {event.location && (
                        <span className="flex items-center gap-0.5 truncate text-neutral-500">
                          <MapPin className="size-2.5" />
                          {event.location}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => deleteEvent(event.id)}
                  className="flex size-5 shrink-0 items-center justify-center rounded-full text-neutral-500 opacity-0 transition-opacity hover:bg-rose-500/20 hover:text-rose-400 group-hover:opacity-100"
                  title="Delete event"
                  aria-label="Delete event"
                >
                  <Trash2 className="size-3" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
