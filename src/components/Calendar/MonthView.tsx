import React from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, parseISO, isToday } from 'date-fns';
import { getColorForEvent } from '@/lib/colorRulesStorage';

interface Event {
  id: string;
  summary: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  description?: string;
  calendarColor?: string;
}

interface MonthViewProps {
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
  // First check user-defined color rules (and TYPE tags in description)
  const ruleColor = getColorForEvent(event.summary || '', undefined, event.description);
  if (ruleColor) return ruleColor;

  // Fallback to Google Calendar color or default
  if (event.calendarColor) {
    const lower = event.calendarColor.toLowerCase();
    if (colorReplacements[lower]) return colorReplacements[lower];
    if (isColorTooLight(event.calendarColor)) return EVENT_COLORS[index % EVENT_COLORS.length];
    return event.calendarColor;
  }
  return EVENT_COLORS[index % EVENT_COLORS.length];
};

const MonthView: React.FC<MonthViewProps> = ({ events, currentDate }) => {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const days = eachDayOfInterval({
    start: startDate,
    end: endDate,
  });

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const getEventDate = (event: Event): Date | null => {
    const dateStr = event.start?.dateTime || event.start?.date;
    if (!dateStr) return null;
    return parseISO(dateStr);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--background)', margin: '0 20px 20px' }}>
      {/* Header */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        borderBottom: '1px solid var(--border)',
        position: 'sticky',
        top: '57px',
        background: 'var(--background)',
        zIndex: 20,
      }}>
        {weekDays.map((day) => (
          <div key={day} style={{
            padding: '12px',
            textAlign: 'center',
            fontWeight: '600',
            fontSize: '0.75rem',
            color: 'var(--foreground-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}>
            {day}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
        {days.map((day) => {
          const dayEvents = events.filter(e => {
            const eventDate = getEventDate(e);
            return eventDate && isSameDay(eventDate, day);
          });
          const isCurrentMonth = isSameMonth(day, monthStart);
          const todayHighlight = isToday(day);

          return (
            <div
              key={day.toString()}
              style={{
                borderRight: '1px solid var(--border)',
                borderBottom: '1px solid var(--border)',
                padding: '8px',
                background: !isCurrentMonth ? 'rgba(0,0,0,0.15)' : todayHighlight ? 'rgba(99, 102, 241, 0.05)' : 'transparent',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                minHeight: '110px',
              }}
            >
              <div style={{
                textAlign: 'center',
                marginBottom: '4px',
              }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  fontSize: '0.85rem',
                  background: todayHighlight ? 'var(--primary)' : 'transparent',
                  color: todayHighlight ? 'white' : !isCurrentMonth ? 'var(--foreground-muted)' : 'var(--foreground)',
                  fontWeight: todayHighlight ? '600' : '400',
                }}>
                  {format(day, 'd')}
                </span>
              </div>

              {/* Events */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflowY: 'auto', flex: 1 }}>
                {dayEvents.slice(0, 3).map((event, idx) => {
                  const color = getEventColor(event, idx);
                  return (
                    <div
                      key={event.id}
                      style={{
                        fontSize: '0.7rem',
                        background: color,
                        color: 'white',
                        padding: '2px 6px',
                        borderRadius: '3px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        fontWeight: '500',
                      }}
                      title={event.summary}
                    >
                      {event.summary}
                    </div>
                  );
                })}
                {dayEvents.length > 3 && (
                  <div style={{
                    fontSize: '0.65rem',
                    color: 'var(--foreground-muted)',
                    textAlign: 'center',
                  }}>
                    +{dayEvents.length - 3} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MonthView;
