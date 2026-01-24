// Global undo storage for all calendar actions
// Supports: create, delete, edit, move

export type UndoAction =
  | { type: 'create'; eventId: string; calendarId: string }
  | { type: 'delete'; eventData: any }
  | { type: 'edit'; eventId: string; calendarId: string; original: { start: string; end: string; summary?: string; description?: string } }
  | { type: 'move'; eventId: string; calendarId: string; originalStart: string; originalEnd: string };

let undoStack: UndoAction[] = [];
let onChangeCallback: (() => void) | null = null;

export function pushUndo(action: UndoAction) {
  undoStack = [...undoStack.slice(-9), action];
}

export function popUndo(): UndoAction | undefined {
  const action = undoStack.pop();
  undoStack = [...undoStack];
  return action;
}

export function hasUndo(): boolean {
  return undoStack.length > 0;
}

export function setUndoCallback(cb: () => void) {
  onChangeCallback = cb;
}

export async function executeUndo(): Promise<boolean> {
  const action = popUndo();
  if (!action) return false;

  try {
    switch (action.type) {
      case 'create':
        // Undo create = delete the event
        await fetch('/api/events', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ eventId: action.eventId, calendarId: action.calendarId }),
        });
        break;

      case 'delete':
        // Undo delete = recreate the event
        await fetch('/api/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(action.eventData),
        });
        break;

      case 'edit':
      case 'move':
        // Undo edit/move = restore original values
        await fetch('/api/events', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventId: action.eventId,
            calendarId: action.calendarId,
            ...action.type === 'edit' ? action.original : { start: action.originalStart, end: action.originalEnd },
          }),
        });
        break;
    }
    onChangeCallback?.();
    return true;
  } catch {
    return false;
  }
}
