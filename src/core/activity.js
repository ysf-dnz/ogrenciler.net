// src/core/activity.js
import { state } from './state.js';
import { generateId } from './utils.js';

export const ACTION_LABELS = {
  'görev_oluşturuldu': 'yeni görev oluşturdu',
  'görev_silindi': 'bir görevi sildi',
  'görev_güncellendi': 'bir görevi güncelledi',
  'durum_değiştirildi': 'görev durumunu değiştirdi',
  'yorum_eklendi': 'yorum ekledi',
  'üye_eklendi': 'yeni üye ekledi',
  'üye_silindi': 'bir ekip üyesini sildi',
  'görev_kopyalandı': 'bir görevi kopyaladı',
  'toplu_durum': 'toplu durum değişikliği yaptı',
  'toplu_öncelik': 'toplu öncelik değişikliği yaptı',
  'toplu_silme': 'toplu görev sildi',
  'alt_görev_eklendi': 'alt görev ekledi',
  'alt_görev_değiştirildi': 'alt görev durumunu değiştirdi',
  'aktivite_temizlendi': 'aktivite geçmişini temizledi'
};

export function logActivity(action, taskId, details) {
  state.activityLog.unshift({
    id: generateId(),
    timestamp: new Date().toISOString(),
    memberId: state.activeUserId,
    action,
    taskId: taskId || null,
    details: details || ''
  });
  if (state.activityLog.length > 100) {
    state.activityLog = state.activityLog.slice(0, 100);
  }
}

// Lookup helpers — birçok view'da kullanılan üye/etiket/altgörev erişimleri
export function getMember(memberId) {
  if (!memberId) return { name: 'Atanmamış', avatar: '?', color: '#6b7280' };
  const m = state.members.find(m => m.id === memberId);
  return m || { name: 'Atanmamış', avatar: '?', color: '#6b7280' };
}

export function getLabel(labelId) {
  return state.labels.find(l => l.id === labelId) || null;
}

export function getSubtaskStats(task) {
  if (!task.subtasks || task.subtasks.length === 0) return { total: 0, completed: 0, percent: 0 };
  const total = task.subtasks.length;
  const completed = task.subtasks.filter(s => s.completed).length;
  return { total, completed, percent: total > 0 ? Math.round((completed / total) * 100) : 0 };
}
