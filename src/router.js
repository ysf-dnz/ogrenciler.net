// src/router.js
// Router — view navigation, hash sync ve render dispatch

import { $, $$, refreshIcons } from './ui/dom.js';
import { VIEW_META } from './core/utils.js';
import { saveState } from './core/state.js';

let activeView = 'kanban';
let viewRenderers = {};
let onNavigate = null;

export function setActiveView(view) {
  activeView = view;
}

export function getActiveView() {
  return activeView;
}

export function registerView(name, renderFn) {
  viewRenderers[name] = renderFn;
}

export function renderCurrentView() {
  const fn = viewRenderers[activeView];
  if (fn) fn();
}

export function navigateTo(view) {
  if (!VIEW_META[view]) return;
  activeView = view;

  $$('.menu-item').forEach(item => {
    item.classList.toggle('active', item.dataset.view === view);
  });

  $$('.view-section').forEach(sec => {
    sec.classList.remove('active');
  });
  const targetView = $(`#${view}-view`);
  if (targetView) targetView.classList.add('active');

  const viewTitle = $('#view-title');
  const viewSubtitle = $('#view-subtitle');
  if (viewTitle) viewTitle.textContent = VIEW_META[view].title;
  if (viewSubtitle) viewSubtitle.textContent = VIEW_META[view].subtitle;

  window.location.hash = view;
  renderCurrentView();

  if (onNavigate) onNavigate(view);
}

export function setNavigationCallback(cb) {
  onNavigate = cb;
}

export function handleHash() {
  const hash = window.location.hash.replace('#', '');
  if (VIEW_META[hash]) {
    navigateTo(hash);
  } else {
    navigateTo('kanban');
  }
}

export function initRouter() {
  $$('.menu-item[data-view]').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo(item.dataset.view);
    });
  });

  window.addEventListener('hashchange', handleHash);
}

// Sidebar progress stats — burada da paylaşılan
export function updateSidebarStats(state) {
  const total = state.tasks.length;
  const done = state.tasks.filter(t => t.status === 'done').length;

  const sidebarDoneCount = $('#sidebar-done-count');
  const sidebarProgressBar = $('#sidebar-progress-bar');

  if (sidebarDoneCount) {
    sidebarDoneCount.textContent = `${done}/${total}`;
  }
  if (sidebarProgressBar) {
    const pct = total > 0 ? (done / total) * 100 : 0;
    sidebarProgressBar.style.width = `${pct}%`;
  }
}

// Tüm sistemi state değişikliğinden sonra senkronize eden tek fonksiyon
// Modüller pushUndo() ve mutate sonrası bunu çağırır
let onAfterSave = null;
export function setAfterSaveCallback(cb) {
  onAfterSave = cb;
}

export function saveStateAndRerender() {
  saveState();
  if (onAfterSave) onAfterSave();
  renderCurrentView();
}
