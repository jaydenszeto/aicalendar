import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { getGoogleCalendarClient } from '@/lib/google-calendar';

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const timeMin = searchParams.get('timeMin');
  const timeMax = searchParams.get('timeMax');

  // Default to current month + next month
  const now = new Date();
  const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 2, 0);

  const calendar = getGoogleCalendarClient(session.accessToken);

  try {
    // First, get list of all calendars
    const calendarList = await calendar.calendarList.list();
    const calendars = calendarList.data.items || [];

    // Fetch events from all calendars
    const allEvents: any[] = [];

    for (const cal of calendars) {
      if (!cal.id) continue;

      try {
        const response = await calendar.events.list({
          calendarId: cal.id,
          timeMin: timeMin || defaultStart.toISOString(),
          timeMax: timeMax || defaultEnd.toISOString(),
          singleEvents: true,
          orderBy: 'startTime',
          maxResults: 250,
        });

        const events = response.data.items || [];
        // Add calendar color info to each event
        for (const event of events) {
          if (event.start?.dateTime || event.start?.date) {
            allEvents.push({
              ...event,
              calendarId: cal.id,
              calendarColor: cal.backgroundColor,
            });
          }
        }
      } catch (err) {
        // Skip calendars we can't access
        console.error(`Failed to fetch from calendar ${cal.id}:`, err);
      }
    }

    // Sort all events by start time
    allEvents.sort((a, b) => {
      const aStart = a.start?.dateTime || a.start?.date || '';
      const bStart = b.start?.dateTime || b.start?.date || '';
      return aStart.localeCompare(bStart);
    });

    return NextResponse.json({ events: allEvents });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}

// Create a new event
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { summary, start, end, description, location, timezone } = await req.json();

    if (!summary || !start || !end) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const calendar = getGoogleCalendarClient(session.accessToken);
    const tz = timezone || 'America/Los_Angeles';

    const response = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary,
        description,
        location,
        start: { dateTime: start, timeZone: tz },
        end: { dateTime: end, timeZone: tz },
      },
    });

    return NextResponse.json({ success: true, event: response.data });
  } catch (error: any) {
    console.error('Error creating event:', error);
    return NextResponse.json({ error: error.message || 'Failed to create event' }, { status: 500 });
  }
}

// Delete an event
export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get('eventId');
    const calendarId = searchParams.get('calendarId') || 'primary';

    if (!eventId) {
      return NextResponse.json({ error: 'Event ID required' }, { status: 400 });
    }

    const calendar = getGoogleCalendarClient(session.accessToken);

    await calendar.events.delete({
      calendarId,
      eventId,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting event:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete event' }, { status: 500 });
  }
}

// Update an event
export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { eventId, calendarId = 'primary', summary, description, location, start, end } = await req.json();

    if (!eventId) {
      return NextResponse.json({ error: 'Event ID required' }, { status: 400 });
    }

    const calendar = getGoogleCalendarClient(session.accessToken);

    // Build update payload only with provided fields
    const updateBody: any = {};
    if (summary !== undefined) updateBody.summary = summary;
    if (description !== undefined) updateBody.description = description;
    if (location !== undefined) updateBody.location = location;
    if (start !== undefined) updateBody.start = { dateTime: start };
    if (end !== undefined) updateBody.end = { dateTime: end };

    const response = await calendar.events.patch({
      calendarId,
      eventId,
      requestBody: updateBody,
    });

    return NextResponse.json({ success: true, event: response.data });
  } catch (error: any) {
    console.error('Error updating event:', error);
    return NextResponse.json({ error: error.message || 'Failed to update event' }, { status: 500 });
  }
}

