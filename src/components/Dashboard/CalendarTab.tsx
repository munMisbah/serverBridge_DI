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

    let startAt = Date.now() + 1000 * 60 * 60; // 1 hr default
    if (newTime) {
      const [h, m] = newTime.split(':').map(Number);
      const target = new Date();
      target.setHours(h, m, 0, 0);
      if (target.getTime() < Date.now()) {
        target.setDate(target.getDate() + 1); // tomorrow
      }
      startAt = target.getTime();
    }

    addEvent({
      title: newTitle.trim(),
      startAt,
      location: newLocation.trim() || undefined,
      color: '#3b82f6',
    });

    setNewTitle('');
    setNewTime('');
    setNewLocation('');
    setIsAdding(false);
  };

  const formatEventDate = (timestamp: number) => {
    const d = new Date(timestamp);
    const isToday = d.toDateString() === today.toDateString();
    const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return isToday ? `Today, ${timeStr}` : `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${timeStr}`;
  };

  return (
    <div className="space-y-3">
      {/* Date Header */}
      <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-2xl border border-white/5">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
            Agenda & Calendar
          </span>
          <p className="text-sm font-bold text-white capitalize mt-0.5">{formattedToday}</p>
        </div>

        <button
          type="button"
          onClick={() => setIsAdding((v) => !v)}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium transition-colors"
        >
          {isAdding ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          <span>{isAdding ? 'Cancel' : 'New Event'}</span>
        </button>
      </div>

      {/* Add Event Form Modal/Drawer */}
      {isAdding && (
        <form
          onSubmit={handleAdd}
          className="p-3 bg-neutral-900 rounded-2xl border border-violet-500/30 space-y-2 animate-in fade-in"
        >
          <input
            type="text"
            required
            placeholder="Event Title (e.g. Design review)"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="w-full bg-neutral-800 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-violet-500"
          />

          <div className="grid grid-cols-2 gap-2">
            <input
              type="time"
              value={newTime}
              onChange={(e) => setNewTime(e.target.value)}
              className="w-full bg-neutral-800 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-violet-500"
            />
            <input
              type="text"
              placeholder="Location (optional)"
              value={newLocation}
              onChange={(e) => setNewLocation(e.target.value)}
              className="w-full bg-neutral-800 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-violet-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-3 py-1 rounded-lg text-xs text-neutral-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-1 px-3 py-1 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold"
            >
              <Check className="w-3 h-3" />
              <span>Save</span>
            </button>
          </div>
        </form>
      )}

      {/* Events List */}
      <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
        {events.length === 0 ? (
          <p className="text-xs text-neutral-500 italic text-center py-4">No events scheduled</p>
        ) : (
          events.map((evt) => (
            <div
              key={evt.id}
              className="p-2.5 bg-neutral-900/80 rounded-xl border border-white/5 flex items-center justify-between gap-3 group hover:border-white/10 transition-colors"
            >
              <div className="flex items-start gap-2.5 min-w-0">
                <div
                  className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                  style={{ backgroundColor: evt.color || '#3b82f6' }}
                />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white truncate">{evt.title}</p>
                  <div className="flex items-center gap-2 text-[11px] text-neutral-400 mt-0.5">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatEventDate(evt.startAt)}
                    </span>
                    {evt.location && (
                      <span className="flex items-center gap-1 truncate text-neutral-500">
                        <MapPin className="w-3 h-3 shrink-0" />
                        <span className="truncate">{evt.location}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => deleteEvent(evt.id)}
                className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-rose-500/20 text-neutral-500 hover:text-rose-400 transition-all shrink-0"
                title="Delete event"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
