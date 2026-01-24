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

// Default event types to show in agenda
const DEFAULT_TYPES = ['homework', 'lab', 'quiz', 'exam', 'project', 'assignment'];

// Storage key for user preferences
const AGENDA_PREFS_KEY = 'aicalander_agenda_types';

const getStoredTypes = (): string[] => {
  if (typeof window === 'undefined') return DEFAULT_TYPES;
  const stored = localStorage.getItem(AGENDA_PREFS_KEY);
  if (!stored) return DEFAULT_TYPES;
  try {
    return JSON.parse(stored);
  } catch {
    return DEFAULT_TYPES;
  }
};

const saveTypes = (types: string[]) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(AGENDA_PREFS_KEY, JSON.stringify(types));
};

const AgendaView: React.FC<AgendaViewProps> = ({ events, onClose }) => {
  const [enabledTypes, setEnabledTypes] = useState<string[]>(DEFAULT_TYPES);
  const [customType, setCustomType] = useState('');

  useEffect(() => {
    setEnabledTypes(getStoredTypes());
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

  // Filter events that match enabled types (check description for [TYPE: xxx] or title for keywords)
  const now = new Date();
  const twoWeeksLater = addDays(now, 14);

  const filteredEvents = events
    .filter(e => {
      const startStr = e.start.dateTime || e.start.date;
      if (!startStr) return false;
      const startDate = parseISO(startStr);
      // Only show upcoming events (next 2 weeks)
      if (isBefore(startDate, now) || isAfter(startDate, twoWeeksLater)) return false;

      // Check for TYPE tag in description
      const desc = (e.description || '').toLowerCase();
      const typeMatch = desc.match(/\[type:\s*(\w+)\]/);
      if (typeMatch && enabledTypes.includes(typeMatch[1])) return true;

      // Check title for keywords
      const title = (e.summary || '').toLowerCase();
      return enabledTypes.some(type => title.includes(type));
    })
    .sort((a, b) => {
      const aStart = parseISO(a.start.dateTime || a.start.date || '');
      const bStart = parseISO(b.start.dateTime || b.start.date || '');
      return aStart.getTime() - bStart.getTime();
    });

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
    }} onClick={onClose}>
      <div style={{
        background: 'var(--surface)',
        borderRadius: '12px',
        padding: '24px',
        width: '90%',
        maxWidth: '500px',
        maxHeight: '80vh',
        overflow: 'auto',
        border: '1px solid var(--border)',
      }} onClick={e => e.stopPropagation()}>
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
                  padding: '4px 10px',
                  borderRadius: '12px',
                  fontSize: '0.75rem',
                  border: '1px solid var(--border)',
                  background: enabledTypes.includes(type) ? 'var(--primary)' : 'transparent',
                  color: enabledTypes.includes(type) ? 'white' : 'var(--foreground-muted)',
                  cursor: 'pointer',
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
              style={{
                flex: 1,
                padding: '6px 10px',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                background: 'var(--background)',
                color: 'var(--foreground)',
                fontSize: '0.8rem',
              }}
            />
            <button
              onClick={addCustomType}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--foreground)',
                cursor: 'pointer',
                fontSize: '0.8rem',
              }}
            >
              Add
            </button>
          </div>
        </div>

        {/* Event list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filteredEvents.length === 0 ? (
            <div style={{ color: 'var(--foreground-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '20px' }}>
              No upcoming items match your filters
            </div>
          ) : (
            filteredEvents.map(event => {
              const startDate = parseISO(event.start.dateTime || event.start.date || '');
              return (
                <div
                  key={event.id}
                  style={{
                    padding: '10px 12px',
                    background: 'var(--background)',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                  }}
                >
                  <div style={{ fontWeight: '500', fontSize: '0.9rem', marginBottom: '4px' }}>
                    {event.summary}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--foreground-muted)' }}>
                    {format(startDate, 'EEE, MMM d')} at {format(startDate, 'h:mm a')}
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
