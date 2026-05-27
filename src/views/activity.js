// src/views/activity.js
import { $, refreshIcons } from '../ui/dom.js';
import { state } from '../core/state.js';
import { escapeHTML, getRelativeTime } from '../core/utils.js';
import { getMember, logActivity, ACTION_LABELS } from '../core/activity.js';
import { saveState } from '../core/state.js';
import { pushUndo } from '../core/undo.js';
import { hasPermission } from '../core/permissions.js';
import { showToast } from '../ui/toast.js';

export function renderActivityView() {
  const list = $('#activity-list');
  if (!list) return;

  if (!state.activityLog || state.activityLog.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <i data-lucide="clipboard-list" class="empty-state-icon"></i>
        <p class="empty-state-title">Henüz aktivite kaydı bulunmuyor.</p>
      </div>`;
    refreshIcons(list);
    return;
  }

  list.innerHTML = state.activityLog.map(entry => {
    const member = getMember(entry.memberId);
    const actionText = ACTION_LABELS[entry.action] || entry.action;
    const task = entry.taskId ? state.tasks.find(t => t.id === entry.taskId) : null;
    const taskRef = task
      ? `<strong>"${escapeHTML(task.title)}"</strong>`
      : (entry.taskId ? '<em>(silinmiş görev)</em>' : '');

    return `
      <div class="activity-item">
        <span class="activity-dot" style="background:${member.color}"></span>
        <div class="activity-body">
          <p class="activity-action"><strong>${escapeHTML(member.name)}</strong> ${actionText} ${taskRef}</p>
          ${entry.details ? `<span class="activity-detail">${escapeHTML(entry.details)}</span>` : ''}
          <span class="activity-time">${getRelativeTime(entry.timestamp)}</span>
        </div>
      </div>`;
  }).join('');
  refreshIcons(list);
}

export function initActivityInteractions() {
  const btn = $('#btn-clear-activity');
  if (!btn) return;

  btn.addEventListener('click', () => {
    if (!hasPermission('canClearActivity')) {
      showToast('Aktivite geçmişini temizleme yetkiniz yok.', 'error');
      return;
    }
    pushUndo();
    state.activityLog = [];
    logActivity('aktivite_temizlendi', null, '');
    saveState();
    renderActivityView();
    showToast('Aktivite geçmişi temizlendi.', 'success');
  });
}
