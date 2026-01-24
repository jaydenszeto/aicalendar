'use client';

import React, { useState, useCallback } from 'react';
import DayView from './DayView';
import WeekView from './WeekView';
import MonthView from './MonthView';
import FloatingInput from './FloatingInput';
import ApiKeyModal from '../Settings/ApiKeyModal';
import ColorRulesModal from '../Settings/ColorRulesModal';

import { useSession, signIn, signOut } from "next-auth/react";

const CalendarView = () => {
  const { data: session } = useSession();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'day' | 'week' | 'month'>('week');
  const [events, setEvents] = useState<any[]>([]);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [showColorRulesModal, setShowColorRulesModal] = useState(false);

  const fetchEvents = useCallback(async () => {
    if (!session?.accessToken) return;
    try {
      const res = await fetch('/api/events');
      if (res.status === 401) return;
      const data = await res.json();
      if (data.events) {
        setEvents(data.events);
      }
    } catch (e) {
      console.error("Failed to fetch events", e);
    }
  }, [session]);

  React.useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const navigatePrev = () => {
    const newDate = new Date(currentDate);
    if (view === 'day') {
      newDate.setDate(newDate.getDate() - 1);
    } else if (view === 'week') {
      newDate.setDate(newDate.getDate() - 7);
    } else {
      newDate.setMonth(newDate.getMonth() - 1);
    }
    setCurrentDate(newDate);
  };

  const navigateNext = () => {
    const newDate = new Date(currentDate);
    if (view === 'day') {
      newDate.setDate(newDate.getDate() + 1);
    } else if (view === 'week') {
      newDate.setDate(newDate.getDate() + 7);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const formatDateRange = () => {
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    if (view === 'day') {
      return currentDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    } else if (view === 'week') {
      const startOfWeek = new Date(currentDate);
      const day = startOfWeek.getDay();
      startOfWeek.setDate(startOfWeek.getDate() - day);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(endOfWeek.getDate() + 6);
      return `${startOfWeek.toLocaleDateString('en-US', options)} - ${endOfWeek.toLocaleDateString('en-US', options)}, ${endOfWeek.getFullYear()}`;
    } else {
      return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)' }}>
      {/* Sticky Header */}
      <header style={{
        padding: '12px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid var(--border)',
        position: 'sticky',
        top: 0,
        background: 'var(--background)',
        zIndex: 50,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: 0 }}>My Calendar</h2>

          {/* Navigation */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              onClick={goToToday}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                background: 'var(--surface)',
                color: 'var(--foreground)',
                border: '1px solid var(--border)',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: '500',
              }}
            >
              Today
            </button>
            <button
              onClick={navigatePrev}
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                background: 'var(--surface)',
                color: 'var(--foreground)',
                border: '1px solid var(--border)',
                cursor: 'pointer',
                fontSize: '1rem',
              }}
            >
              ‹
            </button>
            <button
              onClick={navigateNext}
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                background: 'var(--surface)',
                color: 'var(--foreground)',
                border: '1px solid var(--border)',
                cursor: 'pointer',
                fontSize: '1rem',
              }}
            >
              ›
            </button>
            <span style={{ fontSize: '0.95rem', fontWeight: '500', marginLeft: '8px' }}>
              {formatDateRange()}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', background: 'var(--surface)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border)' }}>
          {['day', 'week', 'month'].map((v) => (
            <button
              key={v}
              onClick={() => setView(v as any)}
              style={{
                padding: '5px 14px',
                borderRadius: '6px',
                background: view === v ? 'var(--primary)' : 'transparent',
                color: view === v ? 'white' : 'var(--foreground-muted)',
                border: 'none',
                cursor: 'pointer',
                textTransform: 'capitalize',
                fontWeight: view === v ? '600' : '400',
                fontSize: '0.85rem',
                transition: 'all 0.15s ease'
              }}
            >
              {v}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {!session ? (
            <button
              onClick={() => signIn('google')}
              style={{ padding: '8px 16px', borderRadius: '8px', background: 'var(--primary)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem' }}
            >
              Connect Google Calendar
            </button>
          ) : (
            <>
              <button
                onClick={() => setShowApiKeyModal(true)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '8px',
                  background: 'var(--surface)',
                  color: 'var(--foreground)',
                  border: '1px solid var(--border)',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                ⚙️ Settings
              </button>
              <button
                onClick={() => setShowColorRulesModal(true)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '8px',
                  background: 'var(--surface)',
                  color: 'var(--foreground)',
                  border: '1px solid var(--border)',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                }}
              >
                🎨 Colors
              </button>
              <span style={{ fontSize: '0.85rem', color: 'var(--foreground-muted)' }}>{session.user?.name}</span>
              <button
                onClick={() => signOut()}
                style={{ padding: '6px 14px', borderRadius: '8px', background: 'var(--surface)', color: 'var(--foreground)', border: '1px solid var(--border)', cursor: 'pointer', fontSize: '0.85rem' }}
              >
                Sign Out
              </button>
            </>
          )}
        </div>
      </header>

      {/* Calendar Content - scrolls with page */}
      <div style={{ paddingBottom: '100px' }}>
        {view === 'day' && <DayView events={events} currentDate={currentDate} />}
        {view === 'week' && <WeekView events={events} currentDate={currentDate} onEventChange={fetchEvents} />}
        {view === 'month' && <MonthView events={events} currentDate={currentDate} />}
      </div>

      <FloatingInput onEventCreated={fetchEvents} events={events} />
      <ApiKeyModal isOpen={showApiKeyModal} onClose={() => setShowApiKeyModal(false)} />
      <ColorRulesModal isOpen={showColorRulesModal} onClose={() => setShowColorRulesModal(false)} />
    </div>
  );
};

export default CalendarView;
