// src/features/task-create.js
import { $ } from '../ui/dom.js';
import { state } from '../core/state.js';
import { escapeHTML, generateId } from '../core/utils.js';
import { hasPermission } from '../core/permissions.js';
import { pushUndo } from '../core/undo.js';
import { logActivity } from '../core/activity.js';
import { showToast } from '../ui/toast.js';
import { closeModalAnimated } from '../ui/modal.js';
import { saveStateAndRerender } from '../router.js';

function openCreateTaskModal() {
  const modal = $('#modal-task-create');
  if (!modal) return;

  const form = $('#form-create-task');
  if (form) form.reset();

  const createAssignee = $('#create-assignee');
  if (createAssignee) {
    createAssignee.innerHTML = '<option value="">Atanmamış</option>';
    state.members.forEach(m => {
      createAssignee.innerHTML += `<option value="${m.id}">${escapeHTML(m.name)}</option>`;
    });
  }

  const picker = $('#create-label-picker');
  if (picker) {
    picker.innerHTML = state.labels.map(l => `
      <span class="label-picker-item" data-label-id="${l.id}">
        <span class="label-dot" style="background: ${l.color}"></span>
        <span>${escapeHTML(l.name)}</span>
      </span>`).join('');

    picker.querySelectorAll('.label-picker-item').forEach(pill => {
      pill.addEventListener('click', () => {
        const lId = pill.dataset.labelId;
        const label = state.labels.find(l => l.id === lId);
        const active = pill.classList.toggle('selected');
        if (active) {
          pill.style.borderColor = label.color;
          pill.style.background = label.color + '15';
          pill.style.color = 'var(--text-primary)';
        } else {
          pill.style.borderColor = '';
          pill.style.background = '';
          pill.style.color = '';
        }
      });
    });
  }

  modal.showModal();
}

export { openCreateTaskModal };

export function initTaskCreate() {
  const modal = $('#modal-task-create');
  const btnCreate = $('#btn-create-task');

  if (btnCreate) {
    btnCreate.addEventListener('click', () => {
      if (!hasPermission('canCreateTask')) {
        showToast('Görev oluşturma yetkiniz yok.', 'error');
        return;
      }
      openCreateTaskModal();
    });
  }

  const form = $('#form-create-task');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const title = ($('#create-title')?.value || '').trim();
      if (!title) return;

      pushUndo();

      const picker = $('#create-label-picker');
      const labels = picker
        ? Array.from(picker.querySelectorAll('.label-picker-item.selected')).map(p => p.dataset.labelId)
        : [];

      const newTask = {
        id: generateId(),
        title,
        description: ($('#create-description')?.value || '').trim(),
        status: $('#create-status')?.value || 'backlog',
        priority: $('#create-priority')?.value || 'medium',
        assigneeId: $('#create-assignee')?.value || '',
        createdBy: state.activeUserId,
        dueDate: $('#create-due-date')?.value || '',
        createdDate: new Date().toISOString(),
        order: state.tasks.length,
        labels,
        subtasks: [],
        comments: []
      };

      state.tasks.push(newTask);
      logActivity('görev_oluşturuldu', newTask.id, newTask.title);
      closeModalAnimated(modal);
      saveStateAndRerender();
      showToast(`"${newTask.title}" oluşturuldu.`, 'success');
    });
  }

  const btnCancel = $('#btn-cancel-create');
  const btnClose = $('#btn-close-create');
  if (btnCancel) btnCancel.addEventListener('click', () => closeModalAnimated(modal));
  if (btnClose) btnClose.addEventListener('click', () => closeModalAnimated(modal));
}
