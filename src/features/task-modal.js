// src/features/task-modal.js
import { $ } from '../ui/dom.js';
import { state, saveState } from '../core/state.js';
import { escapeHTML, deepClone, generateId, getRelativeTime } from '../core/utils.js';
import { getMember, getSubtaskStats, logActivity } from '../core/activity.js';
import { canEditTask, canDeleteTask, hasPermission } from '../core/permissions.js';
import { pushUndo, performUndo } from '../core/undo.js';
import { showToast } from '../ui/toast.js';
import { closeModalAnimated } from '../ui/modal.js';
import { saveStateAndRerender } from '../router.js';

let currentDetailTaskId = null;

function renderDetailLabelPicker(task) {
  const picker = $('#detail-label-picker');
  if (!picker) return;
  const canEdit = canEditTask(task);

  picker.innerHTML = state.labels.map(l => {
    const isSelected = task.labels && task.labels.includes(l.id);
    const styleStr = isSelected
      ? `border-color: ${l.color}; background: ${l.color}15; color: var(--text-primary);`
      : '';
    return `
      <span class="label-picker-item ${isSelected ? 'selected' : ''}" data-label-id="${l.id}" style="${styleStr}">
        <span class="label-dot" style="background: ${l.color}"></span>
        <span>${escapeHTML(l.name)}</span>
      </span>`;
  }).join('');

  picker.querySelectorAll('.label-picker-item').forEach(pill => {
    if (canEdit) {
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
    } else {
      pill.style.cursor = 'default';
      pill.style.opacity = '0.7';
    }
  });
}

function renderDetailSubtasks(task) {
  const list = $('#detail-subtasks-list');
  const progressEl = $('#detail-subtask-progress');
  const progressText = $('#detail-subtask-text');
  if (!list) return;

  const stats = getSubtaskStats(task);
  const canEdit = canEditTask(task);

  if (progressEl) progressEl.style.width = `${stats.percent}%`;
  if (progressText) progressText.textContent = `${stats.completed}/${stats.total} alt görev tamamlandı`;

  if (!task.subtasks || task.subtasks.length === 0) {
    list.innerHTML = '<p style="color:var(--text-muted);font-size:12px;">Alt görev bulunmuyor.</p>';
  } else {
    list.innerHTML = task.subtasks.map(sub => `
      <div class="subtask-item ${sub.completed ? 'completed' : ''}">
        <input type="checkbox" class="subtask-checkbox" data-subtask-id="${sub.id}" ${sub.completed ? 'checked' : ''} ${canEdit ? '' : 'disabled'}>
        <span class="subtask-title-text">${escapeHTML(sub.title)}</span>
      </div>
    `).join('');

    if (canEdit) {
      list.querySelectorAll('.subtask-checkbox').forEach(cb => {
        cb.addEventListener('change', () => {
          pushUndo();
          const subId = cb.dataset.subtaskId;
          const subtask = task.subtasks.find(s => s.id === subId);
          if (subtask) subtask.completed = cb.checked;
          logActivity('alt_görev_değiştirildi', task.id, subtask ? subtask.title : '');
          saveState();
          renderDetailSubtasks(task);
        });
      });
    }
  }

  const bar = document.querySelector('.add-subtask-bar');
  if (bar) bar.style.display = canEdit ? 'flex' : 'none';
}

function renderDetailComments(task) {
  const list = $('#detail-comments-list');
  const countEl = $('#detail-comments-count');
  if (!list) return;

  const comments = task.comments || [];
  if (countEl) countEl.textContent = comments.length;

  if (comments.length === 0) {
    list.innerHTML = '<p style="color:var(--text-muted);font-size:12px;">Henüz yorum yok.</p>';
    return;
  }

  list.innerHTML = comments.map(c => {
    const member = getMember(c.memberId);
    return `
      <div class="comment-item">
        <div class="avatar-badge" style="background:${member.color}">${escapeHTML(member.avatar)}</div>
        <div class="comment-bubble">
          <div class="comment-author-info">
            <span class="comment-author">${escapeHTML(member.name)}</span>
            <span class="comment-time">${getRelativeTime(c.timestamp)}</span>
          </div>
          <p class="comment-text">${escapeHTML(c.text)}</p>
        </div>
      </div>`;
  }).join('');
}

export function openTaskDetailModal(taskId) {
  const task = state.tasks.find(t => t.id === taskId);
  const modal = $('#modal-task-detail');
  if (!task || !modal) return;

  currentDetailTaskId = taskId;

  const canEdit = canEditTask(task);
  const canDelete = canDeleteTask(task);
  const canComment = hasPermission('canCreateTask');

  const set = (sel, key, val, disabled = false) => {
    const el = $(sel);
    if (!el) return;
    if (key === 'text') el.textContent = val;
    else el[key] = val;
    if (disabled !== null) el.disabled = !canEdit;
  };

  set('#detail-task-id', 'text', task.id.substring(0, 10).toUpperCase(), null);
  set('#detail-task-title-display', 'text', task.title, null);

  const editTitle = $('#edit-title');
  if (editTitle) { editTitle.value = task.title || ''; editTitle.disabled = !canEdit; }

  const editDesc = $('#edit-description');
  if (editDesc) { editDesc.value = task.description || ''; editDesc.disabled = !canEdit; }

  const editStatus = $('#edit-status');
  if (editStatus) { editStatus.value = task.status; editStatus.disabled = !canEdit; }

  const editPriority = $('#edit-priority');
  if (editPriority) { editPriority.value = task.priority; editPriority.disabled = !canEdit; }

  const editAssignee = $('#edit-assignee');
  if (editAssignee) {
    editAssignee.innerHTML = '<option value="">Atanmamış</option>';
    state.members.forEach(m => {
      editAssignee.innerHTML += `<option value="${m.id}">${escapeHTML(m.name)}</option>`;
    });
    editAssignee.value = task.assigneeId || '';
    editAssignee.disabled = !canEdit;
  }

  const editDueDate = $('#edit-due-date');
  if (editDueDate) { editDueDate.value = task.dueDate || ''; editDueDate.disabled = !canEdit; }

  renderDetailLabelPicker(task);
  renderDetailSubtasks(task);
  renderDetailComments(task);

  const commentAuthor = $('#comment-author-select');
  if (commentAuthor) {
    commentAuthor.innerHTML = '';
    state.members.forEach(m => {
      commentAuthor.innerHTML += `<option value="${m.id}">${escapeHTML(m.name)}</option>`;
    });
    commentAuthor.value = state.activeUserId || '';
    commentAuthor.disabled = !canComment;
  }

  const addCommentBar = $('.add-comment-bar');
  if (addCommentBar) addCommentBar.style.display = canComment ? '' : 'none';

  // Action buttons
  const setPerm = (sel, can) => {
    const el = $(sel);
    if (!el) return;
    el.disabled = !can;
    el.classList.toggle('perm-denied', !can);
    el.title = !can ? 'Bu işlem için yetkiniz yok' : '';
  };
  setPerm('#btn-save-task-detail', canEdit);
  setPerm('#btn-duplicate-task', hasPermission('canCreateTask'));
  setPerm('#btn-delete-task', canDelete);

  modal.showModal();
}

export function initTaskDetailModal() {
  const modal = $('#modal-task-detail');
  if (!modal) return;

  // Close
  const btnClose = $('#btn-close-detail');
  if (btnClose) btnClose.addEventListener('click', () => closeModalAnimated(modal));

  // Add subtask
  const btnAddSubtask = $('#btn-add-subtask');
  if (btnAddSubtask) {
    btnAddSubtask.addEventListener('click', () => {
      const input = $('#new-subtask-title');
      if (!input || !input.value.trim()) return;
      const task = state.tasks.find(t => t.id === currentDetailTaskId);
      if (!task) return;
      pushUndo();
      if (!task.subtasks) task.subtasks = [];
      task.subtasks.push({ id: generateId(), title: input.value.trim(), completed: false });
      logActivity('alt_görev_eklendi', task.id, input.value.trim());
      input.value = '';
      saveState();
      renderDetailSubtasks(task);
    });
  }

  // Add comment
  const btnAddComment = $('#btn-add-comment');
  if (btnAddComment) {
    btnAddComment.addEventListener('click', () => {
      const textInput = $('#new-comment-text');
      const authorSelect = $('#comment-author-select');
      if (!textInput || !textInput.value.trim()) return;
      const task = state.tasks.find(t => t.id === currentDetailTaskId);
      if (!task) return;
      pushUndo();
      if (!task.comments) task.comments = [];
      task.comments.push({
        id: generateId(),
        memberId: authorSelect ? authorSelect.value : state.activeUserId,
        text: textInput.value.trim(),
        timestamp: new Date().toISOString()
      });
      logActivity('yorum_eklendi', task.id, textInput.value.trim().substring(0, 50));
      textInput.value = '';
      saveState();
      renderDetailComments(task);
    });
  }

  // Save
  const btnSave = $('#btn-save-task-detail');
  if (btnSave) {
    btnSave.addEventListener('click', () => {
      const task = state.tasks.find(t => t.id === currentDetailTaskId);
      if (!task) return;
      pushUndo();
      task.title = ($('#edit-title')?.value || '').trim() || task.title;
      task.description = ($('#edit-description')?.value || '').trim();
      task.status = $('#edit-status')?.value || task.status;
      task.priority = $('#edit-priority')?.value || task.priority;
      task.assigneeId = $('#edit-assignee')?.value || '';
      task.dueDate = $('#edit-due-date')?.value || '';

      const picker = $('#detail-label-picker');
      if (picker) {
        task.labels = Array.from(picker.querySelectorAll('.label-picker-item.selected'))
          .map(p => p.dataset.labelId);
      }

      logActivity('görev_güncellendi', task.id, task.title);
      closeModalAnimated(modal);
      saveStateAndRerender();
      showToast(`"${task.title}" güncellendi.`, 'success');
    });
  }

  // Delete
  const btnDelete = $('#btn-delete-task');
  if (btnDelete) {
    btnDelete.addEventListener('click', () => {
      const task = state.tasks.find(t => t.id === currentDetailTaskId);
      if (!task) return;
      if (!confirm(`"${task.title}" görevini silmek istediğinize emin misiniz?`)) return;
      pushUndo();
      const title = task.title;
      state.tasks = state.tasks.filter(t => t.id !== currentDetailTaskId);
      logActivity('görev_silindi', null, title);
      closeModalAnimated(modal);
      saveStateAndRerender();
      showToast(`"${title}" silindi.`, 'warning', () => { performUndo(); saveStateAndRerender(); });
    });
  }

  // Duplicate
  const btnDup = $('#btn-duplicate-task');
  if (btnDup) {
    btnDup.addEventListener('click', () => {
      const task = state.tasks.find(t => t.id === currentDetailTaskId);
      if (!task) return;
      pushUndo();
      const newTask = deepClone(task);
      newTask.id = generateId();
      newTask.title = task.title + ' (Kopya)';
      newTask.comments = [];
      newTask.createdDate = new Date().toISOString();
      newTask.createdBy = state.activeUserId;
      state.tasks.push(newTask);
      logActivity('görev_kopyalandı', newTask.id, newTask.title);
      closeModalAnimated(modal);
      saveStateAndRerender();
      showToast(`"${newTask.title}" oluşturuldu.`, 'success');
    });
  }
}
