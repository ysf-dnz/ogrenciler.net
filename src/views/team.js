// src/views/team.js
import { $, refreshIcons } from '../ui/dom.js';
import { state } from '../core/state.js';
import { escapeHTML } from '../core/utils.js';
import { hasPermission, SYSTEM_ROLE_LABELS } from '../core/permissions.js';
import { showToast } from '../ui/toast.js';
import { pushUndo, performUndo } from '../core/undo.js';
import { logActivity } from '../core/activity.js';
import { saveStateAndRerender } from '../router.js';

let onMembersChanged = null;

export function setMemberChangeCallback(cb) {
  onMembersChanged = cb;
}

export function renderTeamView() {
  const container = $('#team-cards-container');
  const countLabel = $('#team-count-label');
  if (!container) return;

  if (countLabel) countLabel.textContent = `Toplam ${state.members.length} ekip üyesi kayıtlı.`;

  if (state.members.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i data-lucide="users" class="empty-state-icon"></i>
        <p class="empty-state-title">Henüz ekip üyesi bulunmuyor.</p>
      </div>`;
    refreshIcons(container);
    return;
  }

  const canManage = hasPermission('canManageMembers');

  container.innerHTML = state.members.map(m => {
    const activeTasks = state.tasks.filter(t => t.assigneeId === m.id && t.status !== 'done').length;
    const doneTasks = state.tasks.filter(t => t.assigneeId === m.id && t.status === 'done').length;

    const deleteBtn = canManage
      ? `<button class="btn-delete-member" data-id="${m.id}" title="Üyeyi Sil" aria-label="Üyeyi Sil"><i data-lucide="trash-2"></i></button>`
      : '';

    return `
      <div class="team-card card">
        ${deleteBtn}
        <div class="team-avatar-lg" style="background:${m.color}">${escapeHTML(m.avatar)}</div>
        <div class="team-info">
          <h3>${escapeHTML(m.name)}</h3>
          <p class="role">${escapeHTML(m.role || 'Üye')}</p>
          <span class="role-badge role-${m.systemRole || 'member'}">${SYSTEM_ROLE_LABELS[m.systemRole] || 'Üye'}</span>
        </div>
        <div class="team-stats">
          <div class="team-stat">
            <div class="team-stat-val">${activeTasks}</div>
            <div class="team-stat-label">Aktif</div>
          </div>
          <div class="team-stat">
            <div class="team-stat-val">${doneTasks}</div>
            <div class="team-stat-label">Tamamlanan</div>
          </div>
        </div>
      </div>`;
  }).join('');

  refreshIcons(container);
}

export function initTeamInteractions() {
  const container = $('#team-cards-container');
  if (!container) return;

  container.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-delete-member');
    if (!btn) return;
    if (!hasPermission('canManageMembers')) return;
    const memberId = btn.dataset.id;

    if (memberId === state.loggedInUserId) {
      showToast('Kendinizi silemezsiniz.', 'error');
      return;
    }

    const member = state.members.find(m => m.id === memberId);
    if (member && member.systemRole === 'admin') {
      const adminCount = state.members.filter(m => m.systemRole === 'admin').length;
      if (adminCount <= 1) {
        showToast('Son admini silemezsiniz.', 'error');
        return;
      }
    }

    if (!confirm('Bu üyeyi silmek istediğinize emin misiniz? (Atanan görevler "Atanmamış" olarak görünecektir)')) return;

    pushUndo();
    state.members = state.members.filter(m => m.id !== memberId);
    state.tasks.forEach(t => {
      if (t.assigneeId === memberId) t.assigneeId = '';
    });
    logActivity('üye_silindi', null, member ? member.name : '');
    if (onMembersChanged) onMembersChanged();
    saveStateAndRerender();
    showToast('Ekip üyesi silindi.', 'info', () => { performUndo(); if (onMembersChanged) onMembersChanged(); saveStateAndRerender(); });
  });
}
