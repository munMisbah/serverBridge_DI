import React, { useState } from 'react';
import { Plus, Trash2, Clock, MapPin, Check, X } from 'lucide-react';
import { useIsland } from '../../context/IslandContext';

export const CalendarTab: React.FC = () => {
  const { events, addEvent, deleteEvent } = useIsland();
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newTime, setNewTime] = useState('');
  const [newLocation, setNewLocation] = useState('');

  const today = new Date();
  const formattedToday = today.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const handleAdd = (e: React.FormEvent<HTMLFormElement>) => {
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
      color: '#8b5cf6',
    });

    setNewTitle('');
    setNewTime('');
    setNewLocation('');
    setIsAdding(false);
  };

  const formatEventDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const isToday = date.toDateString() === today.toDateString();
    const time = date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    return isToday
      ? `Today, ${time}`
      : `${date.toLocaleDateString([], {
          month: 'short',
          day: 'numeric',
        })}, ${time}`;
  };

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3.5">
        <div className="min-w-0">
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
            Agenda &amp; Calendar
          </span>
          <p className="mt-0.5 truncate text-[12px] font-semibold capitalize text-white">
            {formattedToday}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsAdding((visible) => !visible)}
          className="flex shrink-0 items-center gap-1 rounded-full bg-violet-500 px-2.5 py-1.5 text-[10px] font-semibold text-white transition-colors hover:bg-violet-400"
        >
          {isAdding ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
          <span>{isAdding ? 'Cancel' : 'New Event'}</span>
        </button>
      </div>

      {isAdding && (
        <form
          onSubmit={handleAdd}
          className="space-y-2 rounded-2xl border border-violet-500/20 bg-white/[0.03] p-3"
        >
          <input
            type="text"
            required
            placeholder="Event title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="w-full rounded-xl border border-white/[0.08] bg-white/[0.05] px-3 py-1.5 text-[11px] text-white placeholder-neutral-600 outline-none focus:border-violet-500/60"
          />

          <div className="grid grid-cols-2 gap-2">
            <input
              type="time"
              value={newTime}
              onChange={(e) => setNewTime(e.target.value)}
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.05] px-3 py-1.5 text-[11px] text-white outline-none focus:border-violet-500/60"
            />
            <input
              type="text"
              placeholder="Location (optional)"
              value={newLocation}
              onChange={(e) => setNewLocation(e.target.value)}
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.05] px-3 py-1.5 text-[11px] text-white placeholder-neutral-600 outline-none focus:border-violet-500/60"
            />
          </div>

          <div className="flex justify-end gap-2 pt-0.5">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="rounded-lg px-2.5 py-1 text-[10px] text-neutral-500 transition-colors hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-1 rounded-lg bg-violet-500 px-2.5 py-1 text-[10px] font-semibold text-white transition-colors hover:bg-violet-400"
            >
              <Check className="h-3 w-3" />
              <span>Save</span>
            </button>
          </div>
        </form>
      )}

      <div className="max-h-[300px] space-y-2 overflow-y-auto pr-1">
        {events.length === 0 ? (
          <p className="rounded-xl border border-white/[0.06] bg-white/[0.02] py-6 text-center text-[11px] text-neutral-600">
            No events scheduled
          </p>
        ) : (
          events.map((event) => (
            <div
              key={event.id}
              className="group flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] p-2.5 transition-colors hover:bg-white/[0.05]"
            >
              <div className="flex min-w-0 items-start gap-2.5">
                <div
                  className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: event.color || '#8b5cf6' }}
                />
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-semibold text-white">
                    {event.title}
                  </p>
                  <div className="mt-0.5 flex items-center gap-2 text-[10px] text-neutral-500">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatEventDate(event.startAt)}
                    </span>
                    {event.location && (
                      <span className="flex min-w-0 items-center gap-1">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="truncate">{event.location}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => deleteEvent(event.id)}
                className="shrink-0 rounded-md p-1 text-neutral-600 opacity-0 transition-all hover:bg-rose-500/10 hover:text-rose-400 group-hover:opacity-100"
                title="Delete event"
                aria-label="Delete event"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
