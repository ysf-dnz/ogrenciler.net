// src/core/state.js
// Uygulama state'inin tek kaynağı. Modüller direkt 'state' import edip okur,
// ama yazmak için saveState çağırması gerekir.

import { DEFAULT_TASKS, DEFAULT_MEMBERS, DEFAULT_LABELS } from '../data.js';

const STORAGE_KEY = 'zenflow_state';

function getDefault() {
  return {
    tasks: JSON.parse(JSON.stringify(DEFAULT_TASKS)),
    members: JSON.parse(JSON.stringify(DEFAULT_MEMBERS)),
    labels: JSON.parse(JSON.stringify(DEFAULT_LABELS)),
    activityLog: [],
    activeUserId: 'm1',
    loggedInUserId: null,
    onboardingDone: false
  };
}

function migrate(parsed) {
  // Eski verilerle uyumluluk: eksik alanları ekle
  if (!parsed.labels) parsed.labels = JSON.parse(JSON.stringify(DEFAULT_LABELS));
  if (!parsed.activityLog) parsed.activityLog = [];
  if (!parsed.activeUserId) parsed.activeUserId = parsed.members?.[0]?.id || 'm1';
  if (parsed.loggedInUserId === undefined) parsed.loggedInUserId = null;

  if (parsed.tasks) {
    parsed.tasks.forEach(t => {
      if (!t.labels) t.labels = [];
      if (!t.createdBy) t.createdBy = t.assigneeId;
      if (t.order === undefined) t.order = 0;
    });
  }

  if (parsed.members) {
    parsed.members.forEach(m => {
      if (!m.systemRole) m.systemRole = 'member';
      if (!m.pin) m.pin = '0000';
    });
    // En az bir admin olduğundan emin ol
    const hasAdmin = parsed.members.some(m => m.systemRole === 'admin');
    if (!hasAdmin && parsed.members.length > 0) {
      parsed.members[0].systemRole = 'admin';
    }
  }

  return parsed;
}

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return migrate(JSON.parse(saved));
    }
  } catch (e) {
    console.error('ZenFlow state yüklenirken hata:', e);
  }
  return getDefault();
}

// State proxy — modüller bunu import eder
// Doğrudan mutate edilebilir ama saveState() çağrılmazsa kalıcı olmaz
export let state = loadState();

export function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (e) {
    console.error('ZenFlow state kaydedilirken hata:', e);
    return false;
  }
}

export function replaceState(newState) {
  // İçe aktarma veya undo sonrası tüm state'i değiştir
  Object.keys(state).forEach(k => delete state[k]);
  Object.assign(state, newState);
}

export function resetState() {
  replaceState(getDefault());
  saveState();
}

// Multi-tab sync için dış dünyadan state'i yeniden yükle
export function reloadStateFromStorage() {
  replaceState(loadState());
}
