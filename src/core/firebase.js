// src/core/firebase.js
// Firebase Realtime Database entegrasyonu
// Vanilla JS ES Modülü — npm gerektirmez, CDN üzerinden yüklenir

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {
  getDatabase,
  ref,
  set,
  get,
  onValue,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';

// ─── Config ──────────────────────────────────────────────────────────────────
const FIREBASE_CONFIG = {
  apiKey:            'AIzaSyD1mD6bsy9a9xOrOLH_9Gamc5QHIEUTpB8',
  authDomain:        'ogrenciler-94f92.firebaseapp.com',
  databaseURL:       'https://ogrenciler-94f92-default-rtdb.firebaseio.com',
  projectId:         'ogrenciler-94f92',
  storageBucket:     'ogrenciler-94f92.firebasestorage.app',
  messagingSenderId: '881036905284',
  appId:             '1:881036905284:web:83abe66ee1017c95c0a511'
};

// Tüm ekip verisi bu yolda saklanır
const DB_PATH = 'workspace/v1';

// ─── İç değişkenler ──────────────────────────────────────────────────────────
let _db            = null;
let _initialized   = false;
let _lastWriteTime = 0;        // Kendi yazdığımız anı takip et (echo'yu engelle)

// ─── Init ────────────────────────────────────────────────────────────────────
export function initFirebase() {
  if (_initialized) return true;
  try {
    const app = initializeApp(FIREBASE_CONFIG);
    _db = getDatabase(app);
    _initialized = true;
    console.log('[Firebase] ✓ Bağlantı kuruldu');
    return true;
  } catch (e) {
    console.error('[Firebase] ✗ Başlatma hatası:', e.message);
    return false;
  }
}

export function isFirebaseReady() {
  return _initialized && _db !== null;
}

// ─── Yükleme ─────────────────────────────────────────────────────────────────
/**
 * Firebase'den state'i bir kez yükler.
 * @returns {Promise<object|null>}
 */
export async function loadFromFirebase() {
  if (!isFirebaseReady()) return null;
  try {
    const snap = await get(ref(_db, DB_PATH));
    if (snap.exists()) {
      console.log('[Firebase] ✓ Veri yüklendi');
      return snap.val();
    }
    console.log('[Firebase] Bulutta henüz veri yok — seed kullanılacak');
    return null;
  } catch (e) {
    console.warn('[Firebase] ✗ Yükleme hatası:', e.message);
    return null;
  }
}

// ─── Kayıt ───────────────────────────────────────────────────────────────────
/**
 * State'i Firebase'e kaydeder (async, fire-and-forget).
 * Cihaza özgü alanlar (loggedInUserId, activeUserId) hariç tutulur.
 * @param {object} stateObj
 * @returns {Promise<boolean>}
 */
export async function saveToFirebase(stateObj) {
  if (!isFirebaseReady()) return false;
  try {
    // Cihaza özgü alanları Firebase'e gönderme
    const { loggedInUserId, activeUserId, ...sharedState } = stateObj;

    _lastWriteTime = Date.now();
    await set(ref(_db, DB_PATH), sharedState);
    return true;
  } catch (e) {
    console.warn('[Firebase] ✗ Kayıt hatası:', e.message);
    return false;
  }
}

// ─── Gerçek zamanlı dinleyici ─────────────────────────────────────────────────
/**
 * Başka bir cihaz/sekme state'i değiştirdiğinde callback'i çağırır.
 * Kendi yazdığımız değişiklikleri yoksayar (1 sn tolerans).
 * @param {function(object): void} callback
 */
export function subscribeToRemoteChanges(callback) {
  if (!isFirebaseReady()) return;

  onValue(ref(_db, DB_PATH), (snap) => {
    // Kendi az önce yazdığımız veriyi yoksay
    if (Date.now() - _lastWriteTime < 1500) return;
    if (!snap.exists()) return;

    console.log('[Firebase] ↓ Uzak değişiklik alındı');
    callback(snap.val());
  });
}
