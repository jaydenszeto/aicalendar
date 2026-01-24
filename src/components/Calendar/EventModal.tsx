'use client';

import React from 'react';
import { format, parseISO } from 'date-fns';

interface Event {
  id: string;
  summary: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  description?: string;
  location?: string;
  calendarId?: string;
}

interface EventModalProps {
  event: Event | null;
  onClose: () => void;
  onDelete: (event: Event) => void;
}

const EventModal: React.FC<EventModalProps> = ({ event, onClose, onDelete }) => {
  if (!event) return null;

  const startStr = event.start?.dateTime || event.start?.date;
  const endStr = event.end?.dateTime || event.end?.date;

  const formatDateTime = (dateStr: string | undefined) => {
    if (!dateStr) return '';
    const date = parseISO(dateStr);
    return format(date, 'EEEE, MMMM d, yyyy h:mm a');
  };

  const formatTime = (dateStr: string | undefined) => {
    if (!dateStr) return '';
    const date = parseISO(dateStr);
    return format(date, 'h:mm a');
  };

  const handleDelete = () => {
    onDelete(event);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--surface)',
          borderRadius: '12px',
          padding: '24px',
          minWidth: '360px',
          maxWidth: '90%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
          border: '1px solid var(--border)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '600' }}>{event.summary}</h3>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              color: 'var(--foreground-muted)',
              padding: '0',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* Time */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', color: 'var(--foreground-muted)' }}>
          <span style={{ fontSize: '1.2rem' }}>🕐</span>
          <div>
            <div style={{ fontSize: '0.95rem' }}>
              {startStr && format(parseISO(startStr), 'EEEE, MMMM d, yyyy')}
            </div>
            <div style={{ fontSize: '0.9rem' }}>
              {formatTime(startStr)} - {formatTime(endStr)}
            </div>
          </div>
        </div>

        {/* Location */}
        {event.location && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', color: 'var(--foreground-muted)' }}>
            <span style={{ fontSize: '1.2rem' }}>📍</span>
            <div style={{ fontSize: '0.95rem' }}>
              {event.location}
            </div>
          </div>
        )}

        {/* Description */}
        {event.description && (
          <div style={{ marginBottom: '16px', padding: '12px', background: 'var(--background)', borderRadius: '8px' }}>
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--foreground-muted)', whiteSpace: 'pre-wrap' }}>
              {event.description}
            </p>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
          <button
            onClick={handleDelete}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              background: '#ef4444',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
              fontWeight: '500',
              fontSize: '0.9rem',
            }}
          >
            Delete
          </button>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              background: 'var(--primary)',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
              fontWeight: '500',
              fontSize: '0.9rem',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default EventModal;
