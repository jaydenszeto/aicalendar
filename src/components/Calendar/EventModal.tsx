'use client';

import React, { useState } from 'react';
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
  onEdit?: (event: Event) => void;
}

const EventModal: React.FC<EventModalProps> = ({ event, onClose, onDelete, onEdit }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editData, setEditData] = useState({
    summary: '',
    description: '',
    startDate: '',
    startTime: '',
    endTime: '',
  });

  if (!event) return null;

  const startStr = event.start?.dateTime || event.start?.date;
  const endStr = event.end?.dateTime || event.end?.date;

  const formatTime = (dateStr: string | undefined) => {
    if (!dateStr) return '';
    const date = parseISO(dateStr);
    return format(date, 'h:mm a');
  };

  const handleDelete = () => {
    onDelete(event);
  };

  const startEditing = () => {
    const startDate = startStr ? parseISO(startStr) : new Date();
    const endDate = endStr ? parseISO(endStr) : new Date();

    setEditData({
      summary: event.summary || '',
      description: event.description || '',
      startDate: format(startDate, 'yyyy-MM-dd'),
      startTime: format(startDate, 'HH:mm'),
      endTime: format(endDate, 'HH:mm'),
    });
    setIsEditing(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Construct ISO datetime strings
      const startDateTime = `${editData.startDate}T${editData.startTime}:00`;
      const endDateTime = `${editData.startDate}T${editData.endTime}:00`;

      const response = await fetch('/api/events', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: event.id,
          calendarId: event.calendarId || 'primary',
          summary: editData.summary,
          description: editData.description,
          start: startDateTime,
          end: endDateTime,
        }),
      });

      if (response.ok) {
        setIsEditing(false);
        onEdit?.(event);
        onClose();
      } else {
        const error = await response.json();
        alert('Failed to save: ' + (error.error || 'Unknown error'));
      }
    } catch (err) {
      console.error('Failed to save event:', err);
      alert('Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
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
          minWidth: '400px',
          maxWidth: '90%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
          border: '1px solid var(--border)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          {isEditing ? (
            <input
              type="text"
              value={editData.summary}
              onChange={(e) => setEditData({ ...editData, summary: e.target.value })}
              style={{
                flex: 1,
                fontSize: '1.25rem',
                fontWeight: '600',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: 'var(--background)',
                color: 'var(--foreground)',
              }}
            />
          ) : (
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '600' }}>{event.summary}</h3>
          )}
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
              marginLeft: '12px',
            }}
          >
            ×
          </button>
        </div>

        {/* Time */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', color: 'var(--foreground-muted)' }}>
          <span style={{ fontSize: '1.2rem' }}>🕐</span>
          {isEditing ? (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flex: 1 }}>
              <input
                type="date"
                value={editData.startDate}
                onChange={(e) => setEditData({ ...editData, startDate: e.target.value })}
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                  background: 'var(--background)',
                  color: 'var(--foreground)',
                }}
              />
              <input
                type="time"
                value={editData.startTime}
                onChange={(e) => setEditData({ ...editData, startTime: e.target.value })}
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                  background: 'var(--background)',
                  color: 'var(--foreground)',
                }}
              />
              <span>to</span>
              <input
                type="time"
                value={editData.endTime}
                onChange={(e) => setEditData({ ...editData, endTime: e.target.value })}
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                  background: 'var(--background)',
                  color: 'var(--foreground)',
                }}
              />
            </div>
          ) : (
            <div>
              <div style={{ fontSize: '0.95rem' }}>
                {startStr && format(parseISO(startStr), 'EEEE, MMMM d, yyyy')}
              </div>
              <div style={{ fontSize: '0.9rem' }}>
                {formatTime(startStr)} - {formatTime(endStr)}
              </div>
            </div>
          )}
        </div>

        {/* Location */}
        {event.location && !isEditing && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', color: 'var(--foreground-muted)' }}>
            <span style={{ fontSize: '1.2rem' }}>📍</span>
            <div style={{ fontSize: '0.95rem' }}>
              {event.location}
            </div>
          </div>
        )}

        {/* Description */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px', color: 'var(--foreground-muted)' }}>
            <span style={{ fontSize: '1.2rem' }}>📝</span>
            <span style={{ fontSize: '0.9rem', fontWeight: '500' }}>Description</span>
          </div>
          {isEditing ? (
            <textarea
              value={editData.description}
              onChange={(e) => setEditData({ ...editData, description: e.target.value })}
              placeholder="Add a description..."
              rows={4}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: 'var(--background)',
                color: 'var(--foreground)',
                resize: 'vertical',
                fontFamily: 'inherit',
                fontSize: '0.9rem',
              }}
            />
          ) : (
            <div style={{ padding: '12px', background: 'var(--background)', borderRadius: '8px' }}>
              <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--foreground-muted)', whiteSpace: 'pre-wrap' }}>
                {event.description || 'No description'}
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
          {isEditing ? (
            <>
              <button
                onClick={handleCancel}
                disabled={isSaving}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  background: 'var(--surface)',
                  color: 'var(--foreground)',
                  border: '1px solid var(--border)',
                  cursor: 'pointer',
                  fontWeight: '500',
                  fontSize: '0.9rem',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  background: 'var(--primary)',
                  color: 'white',
                  border: 'none',
                  cursor: isSaving ? 'not-allowed' : 'pointer',
                  fontWeight: '500',
                  fontSize: '0.9rem',
                  opacity: isSaving ? 0.7 : 1,
                }}
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </>
          ) : (
            <>
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
                onClick={startEditing}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  background: 'var(--surface)',
                  color: 'var(--foreground)',
                  border: '1px solid var(--border)',
                  cursor: 'pointer',
                  fontWeight: '500',
                  fontSize: '0.9rem',
                }}
              >
                Edit
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
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default EventModal;
