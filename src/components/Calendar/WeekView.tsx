import React, { useState, useRef, useEffect } from 'react';
import { format, startOfWeek, addDays, parseISO, isSameDay, isToday } from 'date-fns';
import EventModal from './EventModal';
import CreateEventModal from './CreateEventModal';

interface Event {
  id: string;
  summary: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  description?: string;
  location?: string;
  calendarColor?: string;
  calendarId?: string;
}

interface WeekViewProps {
  events: Event[];
  currentDate: Date;
  onEventChange?: () => void;
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

const WeekView: React.FC<WeekViewProps> = ({ events, currentDate, onEventChange }) => {
  const startOfCurrentWeek = startOfWeek(currentDate, { weekStartsOn: 0 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(startOfCurrentWeek, i));
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const HOUR_HEIGHT = 48;

  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [createModalData, setCreateModalData] = useState<{ startTime: Date; endTime: Date } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ day: Date; minutes: number } | null>(null);
  const [dragEnd, setDragEnd] = useState<{ minutes: number } | null>(null);
  const dragDayRef = useRef<Date | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute
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

    const duration = Math.max(20, endMinutes - startMinutes);

    return {
      top: (startMinutes / 60) * HOUR_HEIGHT,
      height: (duration / 60) * HOUR_HEIGHT,
      startMinutes,
      endMinutes,
    };
  };

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

  const formatEventTime = (event: Event) => {
    const startStr = event.start.dateTime;
    const endStr = event.end.dateTime;
    if (!startStr || !endStr) return '';
    const start = parseISO(startStr);
    const end = parseISO(endStr);
    return `${format(start, 'h:mm a')} - ${format(end, 'h:mm a')}`;
  };

  const handleDeleteEvent = async (event: Event) => {
    try {
      const res = await fetch(`/api/events?eventId=${event.id}&calendarId=${event.calendarId || 'primary'}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setSelectedEvent(null);
        onEventChange?.();
      } else {
        alert('Failed to delete event');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to delete event');
    }
  };

  const handleCreateEvent = async (eventData: { summary: string; start: Date; end: Date; description?: string }) => {
    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary: eventData.summary,
          start: eventData.start.toISOString(),
          end: eventData.end.toISOString(),
          description: eventData.description,
        }),
      });
      if (res.ok) {
        setCreateModalData(null);
        onEventChange?.();
      } else {
        alert('Failed to create event');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to create event');
    }
  };

  const getMinutesFromY = (y: number, rect: DOMRect) => {
    const relativeY = y - rect.top;
    const minutes = Math.floor((relativeY / HOUR_HEIGHT) * 60);
    // Snap to 15-minute intervals
    return Math.max(0, Math.min(24 * 60, Math.round(minutes / 15) * 15));
  };

  const handleMouseDown = (e: React.MouseEvent, day: Date) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const minutes = getMinutesFromY(e.clientY, rect);
    setIsDragging(true);
    setDragStart({ day, minutes });
    setDragEnd({ minutes });
    dragDayRef.current = day;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !dragStart) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const minutes = getMinutesFromY(e.clientY, rect);
    setDragEnd({ minutes });
  };

  const handleMouseUp = () => {
    if (isDragging && dragStart && dragEnd && dragDayRef.current) {
      const startMinutes = Math.min(dragStart.minutes, dragEnd.minutes);
      const endMinutes = Math.max(dragStart.minutes, dragEnd.minutes);

      if (endMinutes - startMinutes >= 15) {
        const startTime = new Date(dragDayRef.current);
        startTime.setHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0);

        const endTime = new Date(dragDayRef.current);
        endTime.setHours(Math.floor(endMinutes / 60), endMinutes % 60, 0, 0);

        setCreateModalData({ startTime, endTime });
      }
    }
    setIsDragging(false);
    setDragStart(null);
    setDragEnd(null);
    dragDayRef.current = null;
  };

  const getDragPreviewStyle = () => {
    if (!isDragging || !dragStart || !dragEnd) return null;
    const startMinutes = Math.min(dragStart.minutes, dragEnd.minutes);
    const endMinutes = Math.max(dragStart.minutes, dragEnd.minutes);
    return {
      top: (startMinutes / 60) * HOUR_HEIGHT,
      height: ((endMinutes - startMinutes) / 60) * HOUR_HEIGHT,
    };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', background: 'var(--background)' }}>
      {/* Sticky Header */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--border)',
        paddingLeft: '60px',
        position: 'sticky',
        top: '57px',
        background: 'var(--background)',
        zIndex: 30,
      }}>
        {weekDays.map((day) => {
          const todayHighlight = isToday(day);
          return (
            <div key={day.toString()} style={{
              flex: 1,
              padding: '12px 8px',
              textAlign: 'center',
              borderLeft: '1px solid var(--border)',
            }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--foreground-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {format(day, 'EEE')}
              </div>
              <div style={{
                fontWeight: '600',
                fontSize: '1.5rem',
                width: '40px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '4px auto 0',
                borderRadius: '50%',
                background: todayHighlight ? 'var(--primary)' : 'transparent',
                color: todayHighlight ? 'white' : 'var(--foreground)',
              }}>
                {format(day, 'd')}
              </div>
            </div>
          );
        })}
      </div>

      {/* Calendar Grid */}
      <div style={{ display: 'flex', flex: 1 }} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
        {/* Time Column */}
        <div style={{ width: '60px', flexShrink: 0, borderRight: '1px solid var(--border)' }}>
          {hours.map((hour) => (
            <div key={hour} style={{ height: `${HOUR_HEIGHT}px`, position: 'relative' }}>
              <span style={{
                position: 'absolute',
                top: '-9px',
                right: '8px',
                fontSize: '0.7rem',
                color: 'var(--foreground-muted)',
              }}>
                {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
              </span>
            </div>
          ))}
        </div>

        {/* Days */}
        {weekDays.map((day, dayIndex) => {
          const dayEvents = events.filter(e => {
            const startStr = e.start.dateTime || e.start.date;
            return startStr && isSameDay(parseISO(startStr), day);
          });
          const eventLayouts = getEventsWithLayout(dayEvents);
          const dragPreview = getDragPreviewStyle();
          const isCurrentDragDay = dragDayRef.current && isSameDay(dragDayRef.current, day);

          return (
            <div
              key={day.toString()}
              style={{
                flex: 1,
                position: 'relative',
                borderLeft: '1px solid var(--border)',
                background: isToday(day) ? 'rgba(99, 102, 241, 0.03)' : 'transparent',
                cursor: 'crosshair',
              }}
              onMouseDown={(e) => handleMouseDown(e, day)}
              onMouseMove={handleMouseMove}
            >
              {/* Hour lines */}
              {hours.map((hour) => (
                <div key={hour} style={{
                  height: `${HOUR_HEIGHT}px`,
                  borderBottom: '1px solid var(--border)',
                  opacity: 0.5,
                }} />
              ))}

              {/* Current time indicator */}
              {isToday(day) && (
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

              {/* Drag preview */}
              {isCurrentDragDay && dragPreview && (
                <div
                  style={{
                    position: 'absolute',
                    top: `${dragPreview.top}px`,
                    height: `${dragPreview.height}px`,
                    left: '2px',
                    right: '2px',
                    background: 'var(--primary)',
                    opacity: 0.5,
                    borderRadius: '4px',
                    pointerEvents: 'none',
                  }}
                />
              )}

              {/* Events */}
              {dayEvents.filter(e => e.start.dateTime).map((event, eventIndex) => {
                const pos = getEventPosition(event);
                const layout = eventLayouts.get(event.id);
                if (!pos || !layout) return null;

                const width = `calc((100% - 4px) / ${layout.totalColumns})`;
                const left = `calc(${layout.column} * (100% - 4px) / ${layout.totalColumns} + 2px)`;
                const color = getEventColor(event, eventIndex);

                return (
                  <div
                    key={event.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedEvent(event);
                    }}
                    style={{
                      position: 'absolute',
                      top: `${pos.top}px`,
                      height: `${Math.max(pos.height, 24)}px`,
                      left,
                      width,
                      background: color,
                      borderRadius: '4px',
                      padding: '2px 4px',
                      color: 'white',
                      fontSize: '0.65rem',
                      overflow: 'hidden',
                      cursor: 'pointer',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                      zIndex: 10,
                    }}
                    title={`${event.summary}\n${formatEventTime(event)}`}
                  >
                    <div style={{ fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {event.summary}
                    </div>
                    {pos.height > 30 && (
                      <div style={{ opacity: 0.9, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {formatEventTime(event)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Event Modal */}
      {selectedEvent && (
        <EventModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onDelete={handleDeleteEvent}
        />
      )}

      {/* Create Event Modal */}
      {createModalData && (
        <CreateEventModal
          startTime={createModalData.startTime}
          endTime={createModalData.endTime}
          onClose={() => setCreateModalData(null)}
          onCreate={handleCreateEvent}
        />
      )}
    </div>
  );
};

export default WeekView;
