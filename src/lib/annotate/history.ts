import type { AnnotationAction, HistoryState } from './types';

export function createEmptyHistory(): HistoryState {
  return { undoStack: [], redoStack: [] };
}

export function pushAction(history: HistoryState, action: AnnotationAction): HistoryState {
  return {
    undoStack: [...history.undoStack, action],
    redoStack: [], // Clear redo on new action
  };
}

export function undo(history: HistoryState): {
  history: HistoryState;
  action: AnnotationAction | null;
} {
  if (history.undoStack.length === 0) return { history, action: null };
  const action = history.undoStack[history.undoStack.length - 1];
  return {
    history: {
      undoStack: history.undoStack.slice(0, -1),
      redoStack: [...history.redoStack, action],
    },
    action,
  };
}

export function redo(history: HistoryState): {
  history: HistoryState;
  action: AnnotationAction | null;
} {
  if (history.redoStack.length === 0) return { history, action: null };
  const action = history.redoStack[history.redoStack.length - 1];
  return {
    history: {
      redoStack: history.redoStack.slice(0, -1),
      undoStack: [...history.undoStack, action],
    },
    action,
  };
}
