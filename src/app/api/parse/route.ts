import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getGoogleCalendarClient } from '@/lib/google-calendar';

// Check if two events overlap
function eventsOverlap(
  newStart: string,
  newEnd: string,
  existingStart: string,
  existingEnd: string
): boolean {
  const ns = new Date(newStart).getTime();
  const ne = new Date(newEnd).getTime();
  const es = new Date(existingStart).getTime();
  const ee = new Date(existingEnd).getTime();

  return ns < ee && ne > es;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { text, image, existingEvents = [], conversationHistory = [], forceCreate = false, forceDelete = false, forceUpdate = false, pendingEvents = null, pendingDeleteEvents = null, pendingUpdateEvent = null, apiKey: userApiKey, timezone } = await req.json();

    // If we have pending events and forceCreate is true, just create them
    if (forceCreate && pendingEvents) {
      const calendar = getGoogleCalendarClient(session.accessToken);
      const createdEvents = [];
      for (const event of pendingEvents) {
        const response = await calendar.events.insert({
          calendarId: 'primary',
          requestBody: event,
        });
        createdEvents.push(response.data);
      }
      return NextResponse.json({
        success: true,
        type: 'create',
        events: createdEvents,
        message: `Created ${createdEvents.length} event(s)!`,
      });
    }

    // If we have pending delete events and forceDelete is true, delete them
    if (forceDelete && pendingDeleteEvents) {
      const calendar = getGoogleCalendarClient(session.accessToken);
      const deletedEvents: string[] = [];
      const failedEvents: string[] = [];

      for (const event of pendingDeleteEvents) {
        try {
          await calendar.events.delete({
            calendarId: event.calendarId || 'primary',
            eventId: event.id,
          });
          deletedEvents.push(event.summary);
        } catch (err: any) {
          console.error(`Failed to delete event ${event.id}:`, err);
          failedEvents.push(event.summary);
        }
      }

      let message = `Deleted ${deletedEvents.length} event(s): ${deletedEvents.join(', ')}`;
      if (failedEvents.length > 0) {
        message += `\nFailed to delete: ${failedEvents.join(', ')}`;
      }

      return NextResponse.json({
        success: true,
        type: 'delete',
        deletedEvents,
        failedEvents,
        message,
      });
    }

    // If we have pending update and forceUpdate is true, perform the update
    if (forceUpdate && pendingUpdateEvent) {
      const calendar = getGoogleCalendarClient(session.accessToken);

      try {
        const updateBody: any = {};
        if (pendingUpdateEvent.summary !== undefined) updateBody.summary = pendingUpdateEvent.summary;
        if (pendingUpdateEvent.description !== undefined) updateBody.description = pendingUpdateEvent.description;
        if (pendingUpdateEvent.start?.dateTime) updateBody.start = { dateTime: pendingUpdateEvent.start.dateTime };
        if (pendingUpdateEvent.end?.dateTime) updateBody.end = { dateTime: pendingUpdateEvent.end.dateTime };

        await calendar.events.patch({
          calendarId: pendingUpdateEvent.calendarId || 'primary',
          eventId: pendingUpdateEvent.id,
          requestBody: updateBody,
        });

        return NextResponse.json({
          success: true,
          type: 'update',
          message: `Updated event successfully!`,
        });
      } catch (err: any) {
        console.error('Failed to update event:', err);
        return NextResponse.json({
          success: false,
          error: 'Failed to update event: ' + (err.message || 'Unknown error'),
        }, { status: 500 });
      }
    }

    // Get current date/time with timezone
    // IMPORTANT: We need to use a timezone that's passed from the client
    // because the server runs in UTC, which causes "today" to be wrong for users in other timezones
    const now = new Date();

    // Try to get user's timezone from browser (defaults to UTC if not available)
    // In production, the server is in UTC, so we need the client's actual timezone
    const userTimeZone = timezone || 'UTC';

    const localDateString = now.toLocaleString('en-US', {
      timeZone: userTimeZone,
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    // Get timezone offset for ISO strings
    const tzOffset = -now.getTimezoneOffset();
    const tzSign = tzOffset >= 0 ? '+' : '-';
    const tzHours = String(Math.floor(Math.abs(tzOffset) / 60)).padStart(2, '0');
    const tzMins = String(Math.abs(tzOffset) % 60).padStart(2, '0');
    const tzString = `${tzSign}${tzHours}:${tzMins}`;

    // Get API key from request body or fallback to environment variable
    const apiKey = userApiKey || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: 'No API key configured. Please add your Gemini API key in Settings or contact the administrator.',
      }, { status: 400 });
    }

    // Initialize Gemini AI with the provided API key
    let genAI: GoogleGenerativeAI;
    try {
      genAI = new GoogleGenerativeAI(apiKey);
    } catch (error) {
      return NextResponse.json({
        success: false,
        error: 'Invalid API key format.',
      }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    // Build events context from passed events (include IDs for deletion)
    let eventsContext = '';
    if (existingEvents.length > 0) {
      const relevantEvents = existingEvents
        .filter((e: any) => e.start?.dateTime || e.start?.date)
        .slice(0, 100)
        .map((e: any) => {
          const startTime = e.start.dateTime || e.start.date;
          const location = e.location ? ` | Location: "${e.location}"` : '';
          const description = e.description ? ` | Description: "${e.description.slice(0, 200)}"` : '';
          return `- [ID: ${e.id}] [CalendarID: ${e.calendarId || 'primary'}] "${e.summary}" on ${startTime}${location}${description}`;
        })
        .join('\n');
      if (relevantEvents) {
        eventsContext = `\n\nUser's existing events (with IDs for reference):\n${relevantEvents}`;
      }
    }

    const systemPrompt = `You are a helpful calendar assistant. Current date and time: ${localDateString}. Timezone: ${userTimeZone} (${tzString}).

The user may either:
1. Ask a QUESTION about their calendar or schedule (e.g., "what do I have today?", "when is my next meeting?", "am I free tomorrow at 3pm?")
2. Want to CREATE new calendar events (e.g., "add meeting tomorrow at 2pm", "schedule coffee chat on Friday")
3. Want to DELETE existing calendar events (e.g., "delete my 3pm meeting", "remove the OP tabling events on the 21st", "cancel tomorrow's lunch")
4. Want to UPDATE/EDIT existing calendar events (e.g., "move my 3pm meeting to 4pm", "change the description of my CS70 class", "rename Coffee Chat to Team Standup")

CRITICAL RULES FOR ANSWERING QUESTIONS:
- When the user asks about their schedule, homework, assignments, deadlines, meetings, etc., ALWAYS look at the "User's existing events" list below and answer based on that data. NEVER ask for an image when answering questions - you already have their calendar data.
- ALWAYS search BOTH the event title/summary AND the description automatically. NEVER ask the user if they want you to search descriptions - just do it.
- When users ask about a TIME RANGE like "next week", "this month", "tomorrow", "soon", etc., search ALL events in that entire range and give a complete answer. Do NOT ask which specific day - just search the whole range.
- Events often have generic titles like person names but contain important keywords in their description (e.g., "Coffee Chat", "Meeting Type", "1:1", etc.).
- Homework, assignments, labs, quizzes, and exams are often saved as calendar events. When users ask "what homework do I have" or "what's due soon", search their existing events for these items.
- Look for TYPE TAGS in event descriptions: Events may have tags like "[TYPE: homework]", "[TYPE: lab]", "[TYPE: quiz]", "[TYPE: exam]", "[TYPE: project]", "[TYPE: assignment]" at the start of their description. Use these to quickly identify academic tasks.
- Understand common abbreviations: "hw" = "homework", "assign" = "assignment", etc.
- IMPORTANT: When listing events, list ALL matching events, not just one. If there are 5 homework assignments due soon, list all 5 with their due dates. Be thorough and complete. Scan the ENTIRE events list.
- ALWAYS sort events by date/time (earliest first) when listing them. This is especially important for homework/assignments - show what's due soonest at the top.
- Be helpful and give direct answers. Don't ask for unnecessary clarification or images.

${eventsContext}

Analyze the user's input and respond with JSON in one of these formats:

FOR QUESTIONS (type: "question"):
{
  "type": "question",
  "answer": "Your helpful answer about their schedule. When listing multiple events, format as a numbered or bulleted list."
}
Example: If user asks "what homework do I have due soon" and there are 4 items, list ALL 4:
{
  "type": "question",
  "answer": "You have the following due soon:\n\n1. Lab 1 - Jan 27, 2026 at 11:59 PM\n2. Homework 1 Coding - Jan 30, 2026 at 11:59 PM\n3. Homework 1 Coding Written - Jan 30, 2026 at 11:59 PM\n4. Homework 1 Prerequisite Math - Jan 30, 2026 at 11:59 PM"
}

FOR EVENT CREATION (type: "create"):
{
  "type": "create",
  "events": [
    {
      "summary": "Event title",
      "start": { "dateTime": "2026-01-22T15:00:00${tzString}" },
      "end": { "dateTime": "2026-01-22T16:00:00${tzString}" },
      "description": "Optional description"
    }
  ]
}

FOR EVENT DELETION (type: "delete"):
{
  "type": "delete",
  "eventsToDelete": [
    {
      "id": "event_id_from_existing_events_list",
      "calendarId": "calendar_id_from_existing_events_list",
      "summary": "Event title (for confirmation message)"
    }
  ],
  "message": "Brief confirmation message about what will be deleted"
}

FOR EVENT UPDATES/EDITS (type: "update"):
{
  "type": "update",
  "eventToUpdate": {
    "id": "event_id_from_existing_events_list",
    "calendarId": "calendar_id_from_existing_events_list",
    "summary": "New title (optional, omit if not changing)",
    "description": "New description (optional, omit if not changing)",
    "start": { "dateTime": "2026-01-22T15:00:00${tzString}" },
    "end": { "dateTime": "2026-01-22T16:00:00${tzString}" }
  },
  "message": "Brief description of what will be changed"
}
Example: User says "move my 3pm meeting to 4pm" - find the event at 3pm and update its start/end times to 4pm.
Example: User says "add description 'bring laptop' to my CS70 class" - find CS70 and add the description.
Example: User says "rename Coffee Chat to Team Standup" - update the summary field.

IMPORTANT RULES FOR EVENT CREATION:
- Use the user's LOCAL timezone (${tzString}) for all dateTime values
- If user says "3 PM", that means 15:00 in their local time
- If no duration specified, assume 1 hour
- For homework/assignment deadlines, use 30 minutes duration
- Year is 2026 if not specified
- NEVER create duplicate events - each event should appear only once in the array
- Check for conflicts with existing events and warn in your response if scheduling over an existing event
- When creating academic events (homework, labs, quizzes, exams, projects), add a TYPE TAG at the start of the description:
  * "[TYPE: homework]" for homework
  * "[TYPE: lab]" for labs
  * "[TYPE: quiz]" for quizzes
  * "[TYPE: exam]" for exams/midterms/finals
  * "[TYPE: project]" for projects
  * "[TYPE: assignment]" for other assignments

IMPORTANT RULES FOR PARSING IMAGES WITH DUE DATES/ASSIGNMENTS:
NOTE: These rules ONLY apply when an image is actually included in the request. If the user just asks a text question without an image, answer from their existing events instead.
When you receive an image (screenshot of assignments, syllabi, course pages, etc.):
1. CAREFULLY scan the ENTIRE image for ALL assignments, homework, labs, projects, quizzes, exams, or any items with due dates
2. Extract EACH item separately - do not combine or skip any
3. For each item, look for:
   - The assignment/task NAME (e.g., "Homework 1 Prerequisite Math", "Lab 1", "Quiz 2")
   - The DUE DATE and TIME (look for patterns like "Due: Jan 30 11:59 PM", "Due Date:", deadline dates)
   - Ignore "Released" dates or "Available from" dates - we only care about DUE dates
   - Ignore "Late Due Date" - only use the primary due date
4. COURSE/CLASS PREFIX: If the user provides context like a course name (e.g., "Math 53", "CS70", "Data C100"), ALWAYS prefix EVERY event title with that course name:
   - User says "Math 53" + image with "Homework 1" → Event title: "Math 53 Homework 1"
   - User says "cs70" + image with "Lab 1" → Event title: "CS70 Lab 1"
   - This helps the user identify which class each assignment belongs to
5. Create a calendar event for EACH assignment at the due date/time:
   - Event title should include the course prefix (if provided) + assignment name
   - Start time should be the due date/time
   - Duration should be 30 minutes (for a deadline reminder)
   - IMPORTANT: Add a type tag in the description field to categorize the event:
     * For homework: description should START with "[TYPE: homework]"
     * For labs: description should START with "[TYPE: lab]"
     * For quizzes: description should START with "[TYPE: quiz]"
     * For exams/midterms/finals: description should START with "[TYPE: exam]"
     * For projects: description should START with "[TYPE: project]"
     * For other assignments: description should START with "[TYPE: assignment]"
     * You can add additional info after the tag, e.g., "[TYPE: homework] Due date for Math 53"
6. If multiple assignments have the SAME due date/time, create SEPARATE events for each one
7. Pay attention to date formats: "Jan 30 11:59 PM" means January 30th at 11:59 PM
8. If no year is specified, use 2026
9. Be thorough - extract EVERY assignment visible in the image, even if there are many

INTELLIGENT PLANNING & SCHEDULING TIPS:
- When the user asks for scheduling advice, analyze their existing events to find free time slots
- Consider typical patterns: avoid scheduling study time late at night, suggest breaks between long sessions
- If user has back-to-back classes, don't schedule things during that time
- For homework/assignments, suggest starting earlier if the due date conflicts with other obligations
- Understand academic contexts: "midterm" = exam, "office hours" = help session, "discussion" = class section
- If asked "when should I study for X", look at when X is due and suggest time blocks before it
- Group related tasks when possible (e.g., "Math homework" near "Math class")

IMPORTANT RULES FOR EVENT DELETION:
- Only delete events that exist in the user's existing events list above
- Match events by looking at the summary/title and date/time
- Use the exact ID and CalendarID from the existing events list
- If the user's request is ambiguous, ask for clarification via a "question" type response
- Include all matching events if user refers to multiple events (e.g., "delete all OP tabling events")

IMPORTANT: Use the conversation history below to understand context from previous messages. If the user refers to something mentioned earlier (like "delete those" or "the first one"), use the conversation history to understand what they mean.

Respond ONLY with valid JSON, no markdown code blocks.`;

    // Build conversation history context
    let conversationContext = '';
    if (conversationHistory.length > 0) {
      conversationContext = '\n\nRecent conversation:\n' + conversationHistory
        .map((msg: { role: string; content: string }) => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
        .join('\n');
    }

    let parts: any[] = [{ text: systemPrompt }];

    // Add conversation history if present
    if (conversationContext) {
      parts.push({ text: conversationContext });
    }

    if (image) {
      const base64Data = image.split(',')[1];
      const mimeType = image.split(';')[0].split(':')[1];
      parts.push({
        inlineData: {
          data: base64Data,
          mimeType: mimeType
        }
      });
      parts.push({ text: `Current user message: ${text || "Extract ALL assignments, homework, labs, quizzes, exams, and deadlines from this image. Create a separate calendar event for each one at its due date/time."}` });
    } else {
      parts.push({ text: `Current user message: ${text}` });
    }

    const result = await model.generateContent(parts);
    const responseText = result.response.text();

    console.log("Gemini Response:", responseText);

    let parsedResult;
    try {
      parsedResult = JSON.parse(responseText);
    } catch (e) {
      const cleanText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      parsedResult = JSON.parse(cleanText);
    }

    // Handle question type - just return the answer
    if (parsedResult.type === 'question') {
      return NextResponse.json({
        success: true,
        type: 'question',
        answer: parsedResult.answer
      });
    }

    // Handle event deletion - ask for confirmation first
    if (parsedResult.type === 'delete') {
      const eventsToDelete = parsedResult.eventsToDelete || [];

      if (eventsToDelete.length === 0) {
        return NextResponse.json({
          success: true,
          type: 'question',
          answer: "I couldn't find any events matching your request to delete."
        });
      }

      // Build confirmation message
      const eventList = eventsToDelete.map((e: any) => `• ${e.summary}`).join('\n');
      const message = `Are you sure you want to delete ${eventsToDelete.length} event(s)?\n\n${eventList}`;

      return NextResponse.json({
        success: true,
        type: 'confirmDelete',
        pendingDeleteEvents: eventsToDelete,
        message,
      });
    }

    // Handle event update - ask for confirmation first
    if (parsedResult.type === 'update') {
      const eventToUpdate = parsedResult.eventToUpdate;

      if (!eventToUpdate || !eventToUpdate.id) {
        return NextResponse.json({
          success: true,
          type: 'question',
          answer: "I couldn't find the event you want to update. Can you be more specific?"
        });
      }

      return NextResponse.json({
        success: true,
        type: 'confirmUpdate',
        pendingUpdateEvent: eventToUpdate,
        message: parsedResult.message || `Update "${eventToUpdate.summary || 'event'}"?`,
      });
    }

    // Handle event creation
    const events = parsedResult.events || (parsedResult.summary ? [parsedResult] : []);

    if (events.length === 0) {
      return NextResponse.json({ error: 'Failed to parse event details' }, { status: 400 });
    }

    // Deduplicate events within the request by summary and start time
    const uniqueEvents = events.filter((event: any, index: number, self: any[]) =>
      index === self.findIndex((e) =>
        e.summary === event.summary &&
        e.start?.dateTime === event.start?.dateTime
      )
    );

    // Check for exact duplicates with existing events (same summary and same start time)
    const duplicates: string[] = [];
    const nonDuplicateEvents = uniqueEvents.filter((newEvent: any) => {
      const newStart = newEvent.start?.dateTime || newEvent.start?.date;
      if (!newStart) return true;

      const isDuplicate = existingEvents.some((existing: any) => {
        const existingStart = existing.start?.dateTime || existing.start?.date;
        // Check if same summary (case-insensitive) and same start time
        return existing.summary?.toLowerCase() === newEvent.summary?.toLowerCase() &&
               existingStart === newStart;
      });

      if (isDuplicate) {
        duplicates.push(newEvent.summary);
      }
      return !isDuplicate;
    });

    // If all events were duplicates
    if (nonDuplicateEvents.length === 0 && duplicates.length > 0) {
      return NextResponse.json({
        success: true,
        type: 'question',
        answer: `These events already exist on your calendar: ${duplicates.join(', ')}. No new events were created.`,
      });
    }

    // Check for time conflicts with existing events
    const conflicts: { newEvent: string; existingEvent: string }[] = [];
    for (const newEvent of nonDuplicateEvents) {
      if (!newEvent.start?.dateTime || !newEvent.end?.dateTime) continue;

      for (const existing of existingEvents) {
        if (!existing.start?.dateTime || !existing.end?.dateTime) continue;

        if (eventsOverlap(
          newEvent.start.dateTime,
          newEvent.end.dateTime,
          existing.start.dateTime,
          existing.end.dateTime
        )) {
          conflicts.push({
            newEvent: newEvent.summary,
            existingEvent: existing.summary,
          });
        }
      }
    }

    // Build confirmation message with event list
    const eventList = nonDuplicateEvents.map((e: any) => {
      const startDate = new Date(e.start.dateTime || e.start.date);
      const dateStr = startDate.toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
      return `• ${e.summary} - ${dateStr}`;
    }).join('\n');

    let confirmMessage = `Add ${nonDuplicateEvents.length} event(s) to your calendar?\n\n${eventList}`;

    // Add conflict warning if any
    if (conflicts.length > 0) {
      const conflictMessages = conflicts.map(c => `"${c.newEvent}" conflicts with "${c.existingEvent}"`);
      confirmMessage += `\n\n⚠️ Scheduling conflicts:\n${conflictMessages.join('\n')}`;
    }

    // Add duplicate info if any were skipped
    if (duplicates.length > 0) {
      confirmMessage += `\n\n(Skipping ${duplicates.length} duplicate(s): ${duplicates.join(', ')})`;
    }

    // Always ask for confirmation before creating events
    return NextResponse.json({
      success: true,
      type: 'confirm',
      pendingEvents: nonDuplicateEvents,
      message: confirmMessage,
    });
  } catch (error: any) {
    console.error('Error processing event:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
