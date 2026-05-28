// src/core/state.js
// Uygulama state'inin tek kaynağı. Modüller direkt 'state' import edip okur,
// ama yazmak için saveState() çağırması gerekir.

import { saveToFirebase, loadFromFirebase, subscribeToRemoteChanges, initFirebase, isFirebaseReady } from './firebase.js';

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
  // --- Dizi korumaları: eksik ya da bozuksa seed ile doldur ---
  if (!Array.isArray(parsed.members)) {
    parsed.members = JSON.parse(JSON.stringify(DEFAULT_MEMBERS));
  }
  if (!Array.isArray(parsed.tasks)) {
    parsed.tasks = JSON.parse(JSON.stringify(DEFAULT_TASKS));
  }
  if (!Array.isArray(parsed.labels)) {
    parsed.labels = JSON.parse(JSON.stringify(DEFAULT_LABELS));
  }
  if (!Array.isArray(parsed.activityLog)) {
    parsed.activityLog = [];
  }

  // --- Skalar alan korumaları ---
  if (!parsed.activeUserId) parsed.activeUserId = parsed.members?.[0]?.id || 'm1';
  if (parsed.loggedInUserId === undefined) parsed.loggedInUserId = null;
  if (parsed.onboardingDone === undefined) parsed.onboardingDone = false;

  // --- Görev uyumluluk düzeltmeleri ---
  parsed.tasks.forEach(t => {
    if (!Array.isArray(t.labels)) t.labels = [];
    if (!t.createdBy) t.createdBy = t.assigneeId;
    if (t.order === undefined) t.order = 0;
    if (!Array.isArray(t.subtasks)) t.subtasks = [];
    if (!Array.isArray(t.comments)) t.comments = [];
  });

  // --- Üye uyumluluk düzeltmeleri ---
  parsed.members.forEach(m => {
    if (!m.systemRole) m.systemRole = 'member';
    if (!m.pin) m.pin = '0000';
    if (!m.color) m.color = '#6366f1';
    if (!m.avatar && m.name) {
      m.avatar = m.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    }
  });

  // En az bir admin garantisi
  const hasAdmin = parsed.members.some(m => m.systemRole === 'admin');
  if (!hasAdmin && parsed.members.length > 0) {
    parsed.members[0].systemRole = 'admin';
  }

  return parsed;
}

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === 'object') {
        return migrate(parsed);
      }
    }
  } catch (e) {
    console.error('ZenFlow state yüklenirken hata:', e);
  }
  return getDefault();
}

// State singleton — modüller bunu import eder
// Doğrudan mutate edilebilir ama saveState() çağrılmazsa kalıcı olmaz
export let state = loadState();

export function saveState() {
  try {
    const serialized = JSON.stringify(state);
    localStorage.setItem(STORAGE_KEY, serialized);
    // Yazmanın gerçekleştiğini doğrula
    const verify = localStorage.getItem(STORAGE_KEY);
    if (!verify) {
      console.error('ZenFlow: localStorage yazımı doğrulanamadı.');
      return false;
    }
    // Firebase'e de kaydet (async, hata uygulamayı durdurmaz)
    if (isFirebaseReady()) {
      saveToFirebase(state).catch(e =>
        console.warn('[Firebase] Arka plan kayıt hatası:', e)
      );
    }
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

// ─── Firebase Senkronizasyonu ─────────────────────────────────────────────────

/**
 * Uygulama başlangıcında Firebase'den veriyi çekip state'i günceller.
 * localStorage'daki cihaza özgü alanlar (loggedInUserId, activeUserId) korunur.
 * @returns {Promise<boolean>} Firebase'den veri yüklendi mi
 */
export async function syncFromFirebase() {
  // Firebase başlatılmamışsa başlat
  if (!isFirebaseReady()) {
    initFirebase();
  }
  if (!isFirebaseReady()) return false;

  const remoteData = await loadFromFirebase();
  if (!remoteData) return false;

  // Cihaza özgü alanları koru
  const localAuth = {
    loggedInUserId: state.loggedInUserId,
    activeUserId:   state.activeUserId
  };

  // State'i güncelle
  Object.assign(state, remoteData, localAuth);
  migrate(state);

  // Yerel cache'i de güncelle
  try {
    localStorage.setItem('zenflow_state', JSON.stringify(state));
  } catch (_) {}

  return true;
}

/**
 * Başka cihazlardan gelen gerçek zamanlı değişiklikleri dinler.
 * @param {function} rerenderCallback — state güncellendikten sonra çalışır
 */
let _remoteSyncStarted = false;

export function startRemoteSync(rerenderCallback) {
  if (!isFirebaseReady()) return;
  if (_remoteSyncStarted) return;   // Sadece bir kez başlat
  _remoteSyncStarted = true;

  subscribeToRemoteChanges((remoteData) => {
    const localAuth = {
      loggedInUserId: state.loggedInUserId,
      activeUserId:   state.activeUserId
    };
    Object.assign(state, remoteData, localAuth);
    migrate(state);
    try {
      localStorage.setItem('zenflow_state', JSON.stringify(state));
    } catch (_) {}
    rerenderCallback();
  });
}
