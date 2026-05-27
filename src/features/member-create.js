// src/features/member-create.js
import { $ } from '../ui/dom.js';
import { state } from '../core/state.js';
import { generateId, MEMBER_COLORS } from '../core/utils.js';
import { hasPermission } from '../core/permissions.js';
import { pushUndo } from '../core/undo.js';
import { logActivity } from '../core/activity.js';
import { showToast } from '../ui/toast.js';
import { closeModalAnimated } from '../ui/modal.js';
import { saveStateAndRerender } from '../router.js';

let onMemberAdded = null;

export function setMemberAddedCallback(cb) {
  onMemberAdded = cb;
}

export function initMemberCreate() {
  const modal = $('#modal-member-create');
  const btn = $('#btn-create-member');

  if (btn) {
    btn.addEventListener('click', () => {
      if (!hasPermission('canManageMembers')) {
        showToast('Üye ekleme yetkiniz yok.', 'error');
        return;
      }
      if (!modal) return;
      const form = $('#form-create-member');
      if (form) form.reset();
      modal.showModal();
    });
  }

  const form = $('#form-create-member');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = ($('#member-name')?.value || '').trim();
      if (!name) return;

      pushUndo();

      const avatarInput = ($('#member-avatar')?.value || '').trim();
      const avatar = avatarInput || name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
      const color = MEMBER_COLORS[Math.floor(Math.random() * MEMBER_COLORS.length)];

      const newMember = {
        id: generateId(),
        name,
        role: ($('#member-role')?.value || '').trim() || 'Üye',
        systemRole: ($('#member-system-role')?.value || 'member'),
        pin: ($('#member-pin')?.value || '').trim() || '0000',
        avatar,
        color,
        joinedDate: new Date().toISOString()
      };

      state.members.push(newMember);
      logActivity('üye_eklendi', null, newMember.name);
      closeModalAnimated(modal);
      if (onMemberAdded) onMemberAdded();
      saveStateAndRerender();
      showToast(`"${newMember.name}" ekibe eklendi.`, 'success');
    });
  }

  const btnCancel = $('#btn-cancel-member');
  const btnClose = $('#btn-close-member');
  if (btnCancel) btnCancel.addEventListener('click', () => closeModalAnimated(modal));
  if (btnClose) btnClose.addEventListener('click', () => closeModalAnimated(modal));
}
