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
const PRESET_TYPES = ['homework', 'lab', 'quiz', 'exam', 'project', 'assignment', 'coffee', 'meeting'];
const AGENDA_PREFS_KEY = 'aicalander_agenda_types';
const DONE_ITEMS_KEY = 'aicalander_agenda_done';
const CUSTOM_TASKS_KEY = 'aicalander_custom_tasks';

interface CustomTask {
  id: string;
  summary: string;
  dueDate: string;
  type: string;
}

const getCustomTasks = (): CustomTask[] => {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(CUSTOM_TASKS_KEY);
  return stored ? JSON.parse(stored) : [];
};

const saveCustomTasks = (tasks: CustomTask[]) => {
  if (typeof window !== 'undefined') localStorage.setItem(CUSTOM_TASKS_KEY, JSON.stringify(tasks));
};

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
  const [customTasks, setCustomTasks] = useState<CustomTask[]>([]);
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskDate, setNewTaskDate] = useState('');
  const [newTaskType, setNewTaskType] = useState('homework');

  useEffect(() => {
    setEnabledTypes(getStoredTypes());
    setDoneItems(getDoneItems());
    setCustomTasks(getCustomTasks());
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

  const removeType = (type: string) => {
    const newTypes = enabledTypes.filter(t => t !== type);
    setEnabledTypes(newTypes);
    saveTypes(newTypes);
  };

  const addCustomTask = () => {
    if (!newTaskName.trim() || !newTaskDate) return;
    const task: CustomTask = {
      id: `task_${Date.now()}`,
      summary: newTaskName.trim(),
      dueDate: newTaskDate,
      type: newTaskType,
    };
    const updated = [...customTasks, task];
    setCustomTasks(updated);
    saveCustomTasks(updated);
    setNewTaskName('');
    setNewTaskDate('');
    setShowAddTask(false);
  };

  const deleteCustomTask = (id: string) => {
    const updated = customTasks.filter(t => t.id !== id);
    setCustomTasks(updated);
    saveCustomTasks(updated);
    // Also remove from done items if it was there
    const newDone = doneItems.filter(i => i !== id);
    setDoneItems(newDone);
    saveDoneItems(newDone);
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

  // Filter calendar events
  const matchingCalendarEvents = events
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
    .map(e => ({ ...e, isCustomTask: false as const }));

  // Filter custom tasks
  const matchingCustomTasks = customTasks
    .filter(t => {
      const taskDate = parseISO(t.dueDate);
      if (isBefore(taskDate, now) || isAfter(taskDate, twoWeeksLater)) return false;
      return enabledTypes.includes(t.type);
    })
    .map(t => ({
      id: t.id,
      summary: t.summary,
      start: { dateTime: t.dueDate, date: undefined as string | undefined },
      end: { dateTime: t.dueDate, date: undefined as string | undefined },
      description: `[type: ${t.type}]`,
      isCustomTask: true as const,
      type: t.type,
    }));

  // Combine and sort by date
  const allMatchingItems = [...matchingCalendarEvents, ...matchingCustomTasks]
    .sort((a, b) => parseISO(a.start.dateTime || a.start.date || '').getTime() - parseISO(b.start.dateTime || b.start.date || '').getTime());

  const activeItems = allMatchingItems.filter(e => !doneItems.includes(e.id));
  const completedItems = allMatchingItems.filter(e => doneItems.includes(e.id));
  const displayItems = showDone ? completedItems : activeItems;

  // Get custom types (types that aren't in the preset list)
  const customTypes = enabledTypes.filter(t => !PRESET_TYPES.includes(t));

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
          <div style={{ fontSize: '0.8rem', color: 'var(--foreground-muted)', marginBottom: '8px' }}>Filter by type:</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
            {PRESET_TYPES.map(type => (
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
            {/* Show custom types with remove button */}
            {customTypes.map(type => (
              <div key={type} style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                <button
                  onClick={() => toggleType(type)}
                  style={{
                    padding: '4px 8px', borderRadius: '12px 0 0 12px', fontSize: '0.75rem', border: '1px solid var(--border)', borderRight: 'none',
                    background: enabledTypes.includes(type) ? 'var(--primary)' : 'transparent',
                    color: enabledTypes.includes(type) ? 'white' : 'var(--foreground-muted)', cursor: 'pointer',
                  }}
                >
                  {type}
                </button>
                <button
                  onClick={() => removeType(type)}
                  style={{
                    padding: '4px 6px', borderRadius: '0 12px 12px 0', fontSize: '0.7rem', border: '1px solid var(--border)',
                    background: 'var(--surface)', color: 'var(--foreground-muted)', cursor: 'pointer',
                  }}
                  title="Remove type"
                >
                  ×
                </button>
              </div>
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

        {/* Toggle active/done + Add task button */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center' }}>
          <button
            onClick={() => setShowDone(false)}
            style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '0.8rem', border: 'none', background: !showDone ? 'var(--primary)' : 'var(--background)', color: !showDone ? 'white' : 'var(--foreground-muted)', cursor: 'pointer' }}
          >
            Active ({activeItems.length})
          </button>
          <button
            onClick={() => setShowDone(true)}
            style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '0.8rem', border: 'none', background: showDone ? 'var(--primary)' : 'var(--background)', color: showDone ? 'white' : 'var(--foreground-muted)', cursor: 'pointer' }}
          >
            Done ({completedItems.length})
          </button>
          <div style={{ flex: 1 }} />
          <button
            onClick={() => setShowAddTask(!showAddTask)}
            style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '0.8rem', border: '1px solid var(--primary)', background: showAddTask ? 'var(--primary)' : 'transparent', color: showAddTask ? 'white' : 'var(--primary)', cursor: 'pointer' }}
          >
            + Add Task
          </button>
        </div>

        {/* Add task form */}
        {showAddTask && (
          <div style={{ marginBottom: '12px', padding: '12px', background: 'var(--background)', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <input
              type="text"
              value={newTaskName}
              onChange={e => setNewTaskName(e.target.value)}
              placeholder="Task name..."
              style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--foreground)', fontSize: '0.85rem', marginBottom: '8px', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <input
                type="datetime-local"
                value={newTaskDate}
                onChange={e => setNewTaskDate(e.target.value)}
                style={{ flex: 1, padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--foreground)', fontSize: '0.85rem' }}
              />
              <select
                value={newTaskType}
                onChange={e => setNewTaskType(e.target.value)}
                style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--foreground)', fontSize: '0.85rem' }}
              >
                {enabledTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowAddTask(false)}
                style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '0.8rem', border: '1px solid var(--border)', background: 'transparent', color: 'var(--foreground-muted)', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={addCustomTask}
                disabled={!newTaskName.trim() || !newTaskDate}
                style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '0.8rem', border: 'none', background: 'var(--primary)', color: 'white', cursor: newTaskName.trim() && newTaskDate ? 'pointer' : 'not-allowed', opacity: newTaskName.trim() && newTaskDate ? 1 : 0.5 }}
              >
                Add Task
              </button>
            </div>
          </div>
        )}

        {/* Event/Task list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {displayItems.length === 0 ? (
            <div style={{ color: 'var(--foreground-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '20px' }}>
              {showDone ? 'No completed items' : 'No upcoming items match your filters'}
            </div>
          ) : (
            displayItems.map(item => {
              const startDate = parseISO(item.start.dateTime || item.start.date || '');
              const isDone = doneItems.includes(item.id);
              const isCustom = 'isCustomTask' in item && item.isCustomTask;
              return (
                <div
                  key={item.id}
                  style={{ padding: '10px 12px', background: 'var(--background)', borderRadius: '8px', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '10px' }}
                >
                  <button
                    onClick={() => toggleDone(item.id)}
                    style={{
                      width: '20px', height: '20px', borderRadius: '4px', border: '2px solid var(--border)', background: isDone ? 'var(--primary)' : 'transparent', cursor: 'pointer', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '12px'
                    }}
                  >
                    {isDone && '✓'}
                  </button>
                  <div style={{ flex: 1, opacity: isDone ? 0.5 : 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontWeight: '500', fontSize: '0.9rem', textDecoration: isDone ? 'line-through' : 'none' }}>
                        {item.summary}
                      </span>
                      {isCustom && (
                        <span style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', background: 'var(--primary)', color: 'white', opacity: 0.8 }}>
                          task
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--foreground-muted)', marginTop: '2px' }}>
                      {format(startDate, 'EEE, MMM d')} at {format(startDate, 'h:mm a')}
                    </div>
                  </div>
                  {isCustom && (
                    <button
                      onClick={() => deleteCustomTask(item.id)}
                      style={{ background: 'none', border: 'none', color: 'var(--foreground-muted)', cursor: 'pointer', fontSize: '1rem', padding: '4px', opacity: 0.6 }}
                      title="Delete task"
                    >
                      🗑
                    </button>
                  )}
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
