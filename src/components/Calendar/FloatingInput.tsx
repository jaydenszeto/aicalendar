'use client';

import React, { useState, useEffect, useRef } from 'react';
import { getApiKey } from '@/lib/apiKeyStorage';

interface Event {
  id: string;
  summary: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  calendarId?: string;
  description?: string;
  location?: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface PendingEvent {
  summary: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  description?: string;
}

interface PendingDeleteEvent {
  id: string;
  calendarId: string;
  summary: string;
}

interface FloatingInputProps {
  onEventCreated?: () => void;
  events?: Event[];
}

// Get events from today onwards, prioritizing upcoming events
const getRelevantEvents = (allEvents: Event[], limit: number = 100): Event[] => {
  const now = new Date();
  now.setHours(0, 0, 0, 0); // Start of today

  // Filter to events from today onwards
  const futureEvents = allEvents.filter(e => {
    const startStr = e.start.dateTime || e.start.date;
    if (!startStr) return false;
    const eventDate = new Date(startStr);
    return eventDate >= now;
  });

  // Sort by start time and take the limit
  return futureEvents
    .sort((a, b) => {
      const aStart = a.start.dateTime || a.start.date || '';
      const bStart = b.start.dateTime || b.start.date || '';
      return aStart.localeCompare(bStart);
    })
    .slice(0, limit);
};

const FloatingInput = ({ onEventCreated, events = [] }: FloatingInputProps) => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [pastedImage, setPastedImage] = useState<string | null>(null);
  const [conversationHistory, setConversationHistory] = useState<ChatMessage[]>([]);
  const [pendingEvents, setPendingEvents] = useState<PendingEvent[] | null>(null);
  const [pendingDeleteEvents, setPendingDeleteEvents] = useState<PendingDeleteEvent[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const conversationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Clear conversation history after 2 minutes of inactivity
  useEffect(() => {
    if (conversationHistory.length > 0) {
      if (conversationTimeoutRef.current) {
        clearTimeout(conversationTimeoutRef.current);
      }
      conversationTimeoutRef.current = setTimeout(() => {
        setConversationHistory([]);
      }, 2 * 60 * 1000); // 2 minutes
    }
    return () => {
      if (conversationTimeoutRef.current) {
        clearTimeout(conversationTimeoutRef.current);
      }
    };
  }, [conversationHistory]);

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  const addToHistory = (userMessage: string, assistantMessage: string) => {
    setConversationHistory(prev => [
      ...prev.slice(-6), // Keep last 3 exchanges (6 messages)
      { role: 'user', content: userMessage },
      { role: 'assistant', content: assistantMessage },
    ]);
  };

  const handleConfirmCreate = async () => {
    if (!pendingEvents || isLoading) return;

    setIsLoading(true);
    try {
      const res = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          forceCreate: true,
          pendingEvents,
          apiKey: getApiKey() || undefined,
        }),
      });

      const data = await res.json();
      if (data.success) {
        const message = data.message || `Created ${data.events?.length || 0} event(s)!`;
        setAiResponse(message);
        addToHistory('Yes, add them anyway', message);
        onEventCreated?.();
      } else {
        setAiResponse('Error: ' + (data.error || 'Failed to create events'));
      }
    } catch (err) {
      console.error(err);
      setAiResponse('Failed to create events');
    } finally {
      setIsLoading(false);
      setPendingEvents(null);
    }
  };

  const handleCancelCreate = () => {
    setPendingEvents(null);
    setAiResponse('Cancelled. No events were added.');
    addToHistory('No, cancel', 'Cancelled. No events were added.');
  };

  const handleConfirmDelete = async () => {
    if (!pendingDeleteEvents || isLoading) return;

    setIsLoading(true);
    try {
      const res = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          forceDelete: true,
          pendingDeleteEvents,
          apiKey: getApiKey() || undefined,
        }),
      });

      const data = await res.json();
      if (data.success) {
        const message = data.message || `Deleted ${data.deletedEvents?.length || 0} event(s)!`;
        setAiResponse(message);
        addToHistory('Yes, delete them', message);
        onEventCreated?.();
      } else {
        setAiResponse('Error: ' + (data.error || 'Failed to delete events'));
      }
    } catch (err) {
      console.error(err);
      setAiResponse('Failed to delete events');
    } finally {
      setIsLoading(false);
      setPendingDeleteEvents(null);
    }
  };

  const handleCancelDelete = () => {
    setPendingDeleteEvents(null);
    setAiResponse('Cancelled. No events were deleted.');
    addToHistory('No, cancel', 'Cancelled. No events were deleted.');
  };

  const handleResponse = (data: any, userMessage: string) => {
    if (data.success) {
      let responseMessage = '';
      if (data.type === 'question') {
        responseMessage = data.answer;
        setAiResponse(data.answer);
      } else if (data.type === 'delete') {
        // Deletion completed (after confirmation)
        responseMessage = data.message;
        setAiResponse(data.message);
        onEventCreated?.();
      } else if (data.type === 'confirmDelete') {
        // Ask for delete confirmation
        responseMessage = data.message;
        setAiResponse(data.message);
        setPendingDeleteEvents(data.pendingDeleteEvents);
      } else if (data.type === 'confirm') {
        // Ask for create confirmation
        responseMessage = data.message;
        setAiResponse(data.message);
        setPendingEvents(data.pendingEvents);
      } else if (data.type === 'create') {
        responseMessage = data.message || `Created ${data.events?.length || 0} event(s)!`;
        setAiResponse(responseMessage);
        onEventCreated?.();
      }
      addToHistory(userMessage, responseMessage);
    } else {
      setAiResponse('Error: ' + (data.error || 'Unknown error'));
    }
  };

  const processImage = async (base64: string, contextText: string) => {
    setIsLoading(true);
    const userMessage = contextText || "Extract events from this image";

    try {
      const res = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: userMessage,
          image: base64,
          existingEvents: getRelevantEvents(events),
          conversationHistory,
          apiKey: getApiKey() || undefined,
        }),
      });

      const data = await res.json();
      handleResponse(data, userMessage);
    } catch (err) {
      console.error(err);
      setAiResponse('Failed to process image');
    } finally {
      setIsLoading(false);
      setPastedImage(null);
      setInput('');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      setPastedImage(base64);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) continue;

        const reader = new FileReader();
        reader.onload = () => {
          const base64 = reader.result as string;
          setPastedImage(base64);
        };
        reader.readAsDataURL(file);
        break;
      }
    }
  };

  const clearPastedImage = () => {
    setPastedImage(null);
  };

  const clearConversation = () => {
    setConversationHistory([]);
    setPendingEvents(null);
    setPendingDeleteEvents(null);
    setAiResponse(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    // Clear any pending confirmation when user types something new
    if (pendingEvents) {
      setPendingEvents(null);
    }
    if (pendingDeleteEvents) {
      setPendingDeleteEvents(null);
    }

    if (pastedImage) {
      await processImage(pastedImage, input);
      return;
    }

    if (!input.trim()) return;

    setIsLoading(true);
    setAiResponse(null);
    const userMessage = input;

    try {
      const res = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: userMessage,
          existingEvents: getRelevantEvents(events),
          conversationHistory,
          apiKey: getApiKey() || undefined,
        }),
      });

      const data = await res.json();
      handleResponse(data, userMessage);
    } catch (err) {
      console.error(err);
      setAiResponse('Failed to process request');
    } finally {
      setIsLoading(false);
      setInput('');
    }
  };

  const dismissResponse = () => {
    if (!pendingEvents && !pendingDeleteEvents) {
      setAiResponse(null);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      left: '50%',
      transform: 'translateX(-50%)',
      width: '90%',
      maxWidth: '600px',
      zIndex: 100,
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
    }}>
      {/* AI Response Bubble */}
      {aiResponse && (
        <div
          onClick={dismissResponse}
          style={{
            background: 'var(--surface)',
            padding: '14px 18px',
            borderRadius: '12px',
            border: '1px solid var(--border)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            color: 'var(--foreground)',
            fontSize: '0.9rem',
            lineHeight: '1.5',
            cursor: (pendingEvents || pendingDeleteEvents) ? 'default' : 'pointer',
            maxHeight: '250px',
            overflowY: 'auto',
            whiteSpace: 'pre-wrap',
          }}
        >
          {aiResponse}

          {/* Create Confirmation Buttons */}
          {pendingEvents && (
            <div style={{
              display: 'flex',
              gap: '10px',
              marginTop: '12px',
            }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleConfirmCreate();
                }}
                disabled={isLoading}
                style={{
                  flex: 1,
                  padding: '8px 16px',
                  background: 'var(--primary)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  fontWeight: '500',
                  opacity: isLoading ? 0.6 : 1,
                }}
              >
                {isLoading ? 'Adding...' : 'Yes, add them'}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleCancelCreate();
                }}
                disabled={isLoading}
                style={{
                  flex: 1,
                  padding: '8px 16px',
                  background: 'transparent',
                  color: 'var(--foreground)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  fontWeight: '500',
                }}
              >
                No, cancel
              </button>
            </div>
          )}

          {/* Delete Confirmation Buttons */}
          {pendingDeleteEvents && (
            <div style={{
              display: 'flex',
              gap: '10px',
              marginTop: '12px',
            }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleConfirmDelete();
                }}
                disabled={isLoading}
                style={{
                  flex: 1,
                  padding: '8px 16px',
                  background: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  fontWeight: '500',
                  opacity: isLoading ? 0.6 : 1,
                }}
              >
                {isLoading ? 'Deleting...' : 'Yes, delete them'}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleCancelDelete();
                }}
                disabled={isLoading}
                style={{
                  flex: 1,
                  padding: '8px 16px',
                  background: 'transparent',
                  color: 'var(--foreground)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  fontWeight: '500',
                }}
              >
                No, cancel
              </button>
            </div>
          )}

          {!pendingEvents && !pendingDeleteEvents && (
            <div style={{
              fontSize: '0.7rem',
              color: 'var(--foreground-muted)',
              marginTop: '8px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <span>Click to dismiss</span>
              {conversationHistory.length > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    clearConversation();
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--foreground-muted)',
                    cursor: 'pointer',
                    fontSize: '0.7rem',
                    textDecoration: 'underline',
                  }}
                >
                  Clear conversation
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Pasted Image Preview */}
      {pastedImage && (
        <div style={{
          background: 'var(--surface)',
          padding: '10px',
          borderRadius: '12px',
          border: '1px solid var(--border)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}>
          <img
            src={pastedImage}
            alt="Pasted"
            style={{
              maxHeight: '60px',
              maxWidth: '100px',
              borderRadius: '6px',
              objectFit: 'cover',
            }}
          />
          <span style={{ flex: 1, fontSize: '0.85rem', color: 'var(--foreground-muted)' }}>
            Image ready - add context below or press send
          </span>
          <button
            onClick={clearPastedImage}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--foreground-muted)',
              fontSize: '1.2rem',
              padding: '4px 8px',
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* Input Form */}
      <form onSubmit={handleSubmit} style={{
        display: 'flex',
        gap: '10px',
        background: 'var(--surface)',
        padding: '8px 12px',
        borderRadius: '24px',
        border: '1px solid var(--border)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
      }}>
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        <input
          type="text"
          placeholder={isLoading ? "Thinking..." : pastedImage ? "Add context (e.g., 'due next week')..." : "Ask, add, or delete events... (paste images here)"}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onPaste={handlePaste}
          disabled={isLoading}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            color: 'var(--foreground)',
            fontSize: '0.95rem',
            outline: 'none',
            padding: '8px',
            opacity: isLoading ? 0.5 : 1,
          }}
        />
        <button type="button" onClick={handleImageClick} disabled={isLoading} style={{
          background: 'transparent',
          border: 'none',
          cursor: isLoading ? 'not-allowed' : 'pointer',
          color: 'var(--foreground-muted)',
          padding: '8px',
          opacity: isLoading ? 0.5 : 1,
          fontSize: '1.1rem',
        }}>
          📷
        </button>
        <button type="submit" disabled={isLoading || (!input.trim() && !pastedImage)} style={{
          background: (isLoading || (!input.trim() && !pastedImage)) ? 'var(--foreground-muted)' : 'var(--primary)',
          color: 'white',
          border: 'none',
          borderRadius: '50%',
          width: '38px',
          height: '38px',
          cursor: (isLoading || (!input.trim() && !pastedImage)) ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 'bold',
          fontSize: '1.1rem',
        }}>
          {isLoading ? '...' : '→'}
        </button>
      </form>
    </div>
  );
};

export default FloatingInput;
