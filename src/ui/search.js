// src/ui/search.js
import { $ } from './dom.js';

let searchQuery = '';
let searchTimer = null;
let onSearchChange = null;

export function getSearchQuery() {
  return searchQuery;
}

export function filterBySearch(tasks) {
  if (!searchQuery) return tasks;
  return tasks.filter(t =>
    (t.title && t.title.toLowerCase().includes(searchQuery)) ||
    (t.description && t.description.toLowerCase().includes(searchQuery))
  );
}

export function initGlobalSearch(callback) {
  onSearchChange = callback;
  const input = $('#global-search');
  if (!input) return;
  input.addEventListener('input', (e) => {
    searchQuery = e.target.value.trim().toLowerCase();
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      if (onSearchChange) onSearchChange();
    }, 250);
  });
}

export function focusSearch() {
  const input = $('#global-search');
  if (input) input.focus();
}
