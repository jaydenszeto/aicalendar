import React, { useState, useEffect } from 'react';
import { format, parseISO, isSameDay, isToday } from 'date-fns';

interface Event {
  id: string;
  summary: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  description?: string;
  location?: string;
  calendarColor?: string;
}

interface DayViewProps {
  events: Event[];
  currentDate: Date;
}

const EVENT_COLORS = [
  '#6366f1', '#8b5cf6', '#a855f7', '#ec4899', '#f43f5e',
  '#ef4444', '#f97316', '#ca8a04', '#16a34a', '#0d9488',
  '#0891b2', '#3b82f6',
];

const isColorTooLight = (hex: string): boolean => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6;
};

const colorReplacements: Record<string, string> = {
  '#7ae7bf': '#0d9488', '#51b749': '#16a34a', '#fbd75b': '#ca8a04',
  '#ffb878': '#ea580c', '#ff887c': '#dc2626', '#a4bdfc': '#3b82f6',
  '#dbadff': '#9333ea', '#e1e1e1': '#6366f1',
};

const getEventColor = (event: Event, index: number) => {
  if (event.calendarColor) {
    const lower = event.calendarColor.toLowerCase();
    if (colorReplacements[lower]) return colorReplacements[lower];
    if (isColorTooLight(event.calendarColor)) return EVENT_COLORS[index % EVENT_COLORS.length];
    return event.calendarColor;
  }
  return EVENT_COLORS[index % EVENT_COLORS.length];
};

const DayView: React.FC<DayViewProps> = ({ events, currentDate }) => {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const HOUR_HEIGHT = 60;
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Calculate current time indicator position
  const getCurrentTimePosition = () => {
    const minutes = currentTime.getHours() * 60 + currentTime.getMinutes();
    return (minutes / 60) * HOUR_HEIGHT;
  };

  const getEventPosition = (event: Event) => {
    const startStr = event.start.dateTime || event.start.date;
    const endStr = event.end.dateTime || event.end.date;
    if (!startStr || !endStr) return null;

    const start = parseISO(startStr);
    const end = parseISO(endStr);

    const startMinutes = start.getHours() * 60 + start.getMinutes();
    let endMinutes = end.getHours() * 60 + end.getMinutes();

    // Handle events that cross midnight or span multiple days
    // If end time appears before start time, it means event crosses midnight
    if (endMinutes <= startMinutes) {
      // Cap at end of day (24:00 = 1440 minutes)
      endMinutes = 24 * 60;
    }

    const duration = Math.max(30, endMinutes - startMinutes);

    return {
      top: (startMinutes / 60) * HOUR_HEIGHT,
      height: (duration / 60) * HOUR_HEIGHT,
      startMinutes,
      endMinutes,
    };
  };

  // Calculate overlapping events
  const getEventsWithLayout = (dayEvents: Event[]) => {
    const timedEvents = dayEvents.filter(e => e.start.dateTime);
    // Stable sort: first by start time, then by event ID for consistent ordering
    const sorted = [...timedEvents].sort((a, b) => {
      const aPos = getEventPosition(a);
      const bPos = getEventPosition(b);
      const timeDiff = (aPos?.startMinutes || 0) - (bPos?.startMinutes || 0);
      if (timeDiff !== 0) return timeDiff;
      return a.id.localeCompare(b.id);
    });

    const columns: Event[][] = [];

    sorted.forEach(event => {
      const eventPos = getEventPosition(event);
      if (!eventPos) return;

      let placed = false;
      for (let i = 0; i < columns.length; i++) {
        const lastInColumn = columns[i][columns[i].length - 1];
        const lastPos = getEventPosition(lastInColumn);

        if (lastPos && eventPos.startMinutes >= lastPos.endMinutes) {
          columns[i].push(event);
          placed = true;
          break;
        }
      }

      if (!placed) {
        columns.push([event]);
      }
    });

    const eventLayouts = new Map<string, { column: number; totalColumns: number }>();

    columns.forEach((column, colIndex) => {
      column.forEach(event => {
        const eventPos = getEventPosition(event);
        if (!eventPos) return;

        let overlappingColumns = 1;
        columns.forEach((otherColumn, otherColIndex) => {
          if (otherColIndex === colIndex) return;
          const hasOverlap = otherColumn.some(otherEvent => {
            const otherPos = getEventPosition(otherEvent);
            if (!otherPos) return false;
            return eventPos.startMinutes < otherPos.endMinutes && eventPos.endMinutes > otherPos.startMinutes;
          });
          if (hasOverlap) overlappingColumns++;
        });

        eventLayouts.set(event.id, {
          column: colIndex,
          totalColumns: Math.max(overlappingColumns, columns.length > 1 ? columns.length : 1),
        });
      });
    });

    return eventLayouts;
  };

  const dayEvents = events.filter(e => {
    const startStr = e.start.dateTime || e.start.date;
    return startStr && e.start.dateTime && isSameDay(parseISO(startStr), currentDate);
  });

  const eventLayouts = getEventsWithLayout(dayEvents);
  const todayHighlight = isToday(currentDate);

  const formatEventTime = (event: Event) => {
    const startStr = event.start.dateTime;
    const endStr = event.end.dateTime;
    if (!startStr || !endStr) return '';
    return `${format(parseISO(startStr), 'h:mm a')} - ${format(parseISO(endStr), 'h:mm a')}`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--background)' }}>
      {/* Day Header */}
      <div style={{
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        borderBottom: '1px solid var(--border)',
        position: 'sticky',
        top: '57px',
        background: 'var(--background)',
        zIndex: 20,
      }}>
        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: todayHighlight ? 'var(--primary)' : 'var(--surface)',
          color: todayHighlight ? 'white' : 'var(--foreground)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 'bold',
          fontSize: '1.75rem',
        }}>
          {format(currentDate, 'd')}
        </div>
        <div>
          <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>{format(currentDate, 'EEEE')}</div>
          <div style={{ fontSize: '0.9rem', color: 'var(--foreground-muted)' }}>{format(currentDate, 'MMMM yyyy')}</div>
        </div>
      </div>

      {/* Time Grid */}
      <div style={{ display: 'flex' }}>
        {/* Time Labels */}
        <div style={{ width: '70px', flexShrink: 0, borderRight: '1px solid var(--border)' }}>
          {hours.map((hour) => (
            <div key={hour} style={{ height: `${HOUR_HEIGHT}px`, position: 'relative' }}>
              <span style={{
                position: 'absolute',
                top: '-10px',
                right: '12px',
                fontSize: '0.75rem',
                color: 'var(--foreground-muted)',
              }}>
                {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
              </span>
            </div>
          ))}
        </div>

        {/* Events Area */}
        <div style={{ flex: 1, position: 'relative' }}>
          {/* Hour lines */}
          {hours.map((hour) => (
            <div key={hour} style={{
              height: `${HOUR_HEIGHT}px`,
              borderBottom: '1px solid var(--border)',
              opacity: 0.5,
            }} />
          ))}

          {/* Current time indicator */}
          {isToday(currentDate) && (
            <div
              style={{
                position: 'absolute',
                top: `${getCurrentTimePosition()}px`,
                left: 0,
                right: 0,
                zIndex: 20,
                pointerEvents: 'none',
              }}
            >
              <div style={{
                position: 'absolute',
                left: '-5px',
                top: '-5px',
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: '#ef4444',
              }} />
              <div style={{
                height: '2px',
                background: '#ef4444',
                boxShadow: '0 0 4px rgba(239, 68, 68, 0.5)',
              }} />
            </div>
          )}

          {/* Events */}
          {dayEvents.map((event, eventIndex) => {
            const pos = getEventPosition(event);
            const layout = eventLayouts.get(event.id);
            if (!pos || !layout) return null;

            const color = getEventColor(event, eventIndex);
            const columnWidth = 100 / layout.totalColumns;
            const leftPercent = layout.column * columnWidth;

            return (
              <div
                key={event.id}
                style={{
                  position: 'absolute',
                  top: `${pos.top}px`,
                  height: `${Math.max(pos.height, 30)}px`,
                  left: `calc(${leftPercent}% + 4px)`,
                  width: `calc(${columnWidth}% - 8px)`,
                  background: color,
                  borderRadius: '6px',
                  padding: '8px 12px',
                  color: 'white',
                  fontSize: '0.9rem',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                }}
              >
                <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>{event.summary}</div>
                <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>
                  {formatEventTime(event)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default DayView;
