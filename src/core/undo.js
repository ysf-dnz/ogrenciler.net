// src/core/undo.js
import { state, saveState, replaceState } from './state.js';
import { deepClone } from './utils.js';

const MAX_UNDO = 15;
const undoStack = [];

export function pushUndo() {
  undoStack.push(deepClone(state));
  if (undoStack.length > MAX_UNDO) {
    undoStack.shift();
  }
}

export function performUndo() {
  if (undoStack.length === 0) return null;
  const restored = undoStack.pop();
  replaceState(restored);
  saveState();
  return restored;
}

export function canUndo() {
  return undoStack.length > 0;
}
