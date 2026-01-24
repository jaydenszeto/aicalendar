'use client';

import React, { useState, useEffect } from 'react';
import { format, parseISO, isBefore, isAfter, addDays } from 'date-fns';

interface Event {
  id: string;
  summary: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  description?: string;
}

interface AgendaViewProps {
  events: Event[];
  onClose: () => void;
}

const DEFAULT_TYPES = ['homework', 'lab', 'quiz', 'exam', 'project', 'assignment'];
const AGENDA_PREFS_KEY = 'aicalander_agenda_types';
const DONE_ITEMS_KEY = 'aicalander_agenda_done';

const getStoredTypes = (): string[] => {
  if (typeof window === 'undefined') return DEFAULT_TYPES;
  const stored = localStorage.getItem(AGENDA_PREFS_KEY);
  return stored ? JSON.parse(stored) : DEFAULT_TYPES;
};

const saveTypes = (types: string[]) => {
  if (typeof window !== 'undefined') localStorage.setItem(AGENDA_PREFS_KEY, JSON.stringify(types));
};

const getDoneItems = (): string[] => {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(DONE_ITEMS_KEY);
  return stored ? JSON.parse(stored) : [];
};

const saveDoneItems = (ids: string[]) => {
  if (typeof window !== 'undefined') localStorage.setItem(DONE_ITEMS_KEY, JSON.stringify(ids));
};

const AgendaView: React.FC<AgendaViewProps> = ({ events, onClose }) => {
  const [enabledTypes, setEnabledTypes] = useState<string[]>(DEFAULT_TYPES);
  const [customType, setCustomType] = useState('');
  const [doneItems, setDoneItems] = useState<string[]>([]);
  const [showDone, setShowDone] = useState(false);

  useEffect(() => {
    setEnabledTypes(getStoredTypes());
    setDoneItems(getDoneItems());
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const toggleType = (type: string) => {
    const newTypes = enabledTypes.includes(type)
      ? enabledTypes.filter(t => t !== type)
      : [...enabledTypes, type];
    setEnabledTypes(newTypes);
    saveTypes(newTypes);
  };

  const addCustomType = () => {
    if (customType.trim() && !enabledTypes.includes(customType.toLowerCase())) {
      const newTypes = [...enabledTypes, customType.toLowerCase()];
      setEnabledTypes(newTypes);
      saveTypes(newTypes);
      setCustomType('');
    }
  };

  const toggleDone = (id: string) => {
    const newDone = doneItems.includes(id)
      ? doneItems.filter(i => i !== id)
      : [...doneItems, id];
    setDoneItems(newDone);
    saveDoneItems(newDone);
  };

  const now = new Date();
  const twoWeeksLater = addDays(now, 14);

  const allMatchingEvents = events
    .filter(e => {
      const startStr = e.start.dateTime || e.start.date;
      if (!startStr) return false;
      const startDate = parseISO(startStr);
      if (isBefore(startDate, now) || isAfter(startDate, twoWeeksLater)) return false;
      const desc = (e.description || '').toLowerCase();
      const typeMatch = desc.match(/\[type:\s*(\w+)\]/);
      if (typeMatch && enabledTypes.includes(typeMatch[1])) return true;
      const title = (e.summary || '').toLowerCase();
      return enabledTypes.some(type => title.includes(type));
    })
    .sort((a, b) => parseISO(a.start.dateTime || a.start.date || '').getTime() - parseISO(b.start.dateTime || b.start.date || '').getTime());

  const activeEvents = allMatchingEvents.filter(e => !doneItems.includes(e.id));
  const completedEvents = allMatchingEvents.filter(e => doneItems.includes(e.id));
  const displayEvents = showDone ? completedEvents : activeEvents;

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
      onClick={onClose}
      onWheel={e => e.stopPropagation()}
    >
      <div
        style={{ background: 'var(--surface)', borderRadius: '12px', padding: '24px', width: '90%', maxWidth: '500px', maxHeight: '80vh', overflow: 'auto', border: '1px solid var(--border)' }}
        onClick={e => e.stopPropagation()}
        onWheel={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Agenda</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--foreground-muted)', cursor: 'pointer', fontSize: '1.5rem' }}>×</button>
        </div>

        {/* Type filters */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--foreground-muted)', marginBottom: '8px' }}>Show event types:</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
            {['homework', 'lab', 'quiz', 'exam', 'project', 'assignment', 'coffee', 'meeting'].map(type => (
              <button
                key={type}
                onClick={() => toggleType(type)}
                style={{
                  padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', border: '1px solid var(--border)',
                  background: enabledTypes.includes(type) ? 'var(--primary)' : 'transparent',
                  color: enabledTypes.includes(type) ? 'white' : 'var(--foreground-muted)', cursor: 'pointer',
                }}
              >
                {type}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <input
              type="text"
              value={customType}
              onChange={e => setCustomType(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addCustomType()}
              placeholder="Add custom type..."
              style={{ flex: 1, padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)', fontSize: '0.8rem' }}
            />
            <button onClick={addCustomType} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--foreground)', cursor: 'pointer', fontSize: '0.8rem' }}>
              Add
            </button>
          </div>
        </div>

        {/* Toggle active/done */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <button
            onClick={() => setShowDone(false)}
            style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '0.8rem', border: 'none', background: !showDone ? 'var(--primary)' : 'var(--background)', color: !showDone ? 'white' : 'var(--foreground-muted)', cursor: 'pointer' }}
          >
            Active ({activeEvents.length})
          </button>
          <button
            onClick={() => setShowDone(true)}
            style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '0.8rem', border: 'none', background: showDone ? 'var(--primary)' : 'var(--background)', color: showDone ? 'white' : 'var(--foreground-muted)', cursor: 'pointer' }}
          >
            Done ({completedEvents.length})
          </button>
        </div>

        {/* Event list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {displayEvents.length === 0 ? (
            <div style={{ color: 'var(--foreground-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '20px' }}>
              {showDone ? 'No completed items' : 'No upcoming items match your filters'}
            </div>
          ) : (
            displayEvents.map(event => {
              const startDate = parseISO(event.start.dateTime || event.start.date || '');
              const isDone = doneItems.includes(event.id);
              return (
                <div
                  key={event.id}
                  style={{ padding: '10px 12px', background: 'var(--background)', borderRadius: '8px', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '10px' }}
                >
                  <button
                    onClick={() => toggleDone(event.id)}
                    style={{
                      width: '20px', height: '20px', borderRadius: '4px', border: '2px solid var(--border)', background: isDone ? 'var(--primary)' : 'transparent', cursor: 'pointer', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '12px'
                    }}
                  >
                    {isDone && '✓'}
                  </button>
                  <div style={{ flex: 1, opacity: isDone ? 0.5 : 1 }}>
                    <div style={{ fontWeight: '500', fontSize: '0.9rem', marginBottom: '2px', textDecoration: isDone ? 'line-through' : 'none' }}>
                      {event.summary}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--foreground-muted)' }}>
                      {format(startDate, 'EEE, MMM d')} at {format(startDate, 'h:mm a')}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default AgendaView;
