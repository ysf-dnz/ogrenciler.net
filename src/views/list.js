// src/views/list.js
import { $, $$, refreshIcons } from '../ui/dom.js';
import { state } from '../core/state.js';
import { escapeHTML, formatDateString, STATUS_LABELS, PRIORITY_LABELS } from '../core/utils.js';
import { getMember, getLabel, getSubtaskStats, logActivity } from '../core/activity.js';
import { hasPermission } from '../core/permissions.js';
import { filterBySearch } from '../ui/search.js';
import { showToast } from '../ui/toast.js';
import { pushUndo, performUndo } from '../core/undo.js';
import { saveStateAndRerender } from '../router.js';

const selectedTaskIds = new Set();
let listSortColumn = 'createdDate';
let listSortAsc = false;
let onRowClick = null;

export function setListRowClickHandler(handler) {
  onRowClick = handler;
}

export function populateFilterDropdowns() {
  const filterAssignee = $('#filter-assignee');
  const filterLabel = $('#filter-label');

  if (filterAssignee) {
    const currentVal = filterAssignee.value;
    filterAssignee.innerHTML = '<option value="all">Tüm Üyeler</option>';
    state.members.forEach(m => {
      filterAssignee.innerHTML += `<option value="${m.id}">${escapeHTML(m.name)}</option>`;
    });
    filterAssignee.value = currentVal || 'all';
  }

  if (filterLabel) {
    const currentVal = filterLabel.value;
    filterLabel.innerHTML = '<option value="all">Tüm Etiketler</option>';
    state.labels.forEach(l => {
      filterLabel.innerHTML += `<option value="${l.id}">${escapeHTML(l.name)}</option>`;
    });
    filterLabel.value = currentVal || 'all';
  }
}

function getFilteredTasks() {
  let tasks = filterBySearch([...state.tasks]);

  const fs = $('#filter-status')?.value;
  const fp = $('#filter-priority')?.value;
  const fa = $('#filter-assignee')?.value;
  const fl = $('#filter-label')?.value;

  if (fs && fs !== 'all') tasks = tasks.filter(t => t.status === fs);
  if (fp && fp !== 'all') tasks = tasks.filter(t => t.priority === fp);
  if (fa && fa !== 'all') tasks = tasks.filter(t => t.assigneeId === fa);
  if (fl && fl !== 'all') tasks = tasks.filter(t => t.labels && t.labels.includes(fl));

  return tasks;
}

function sortTasks(tasks) {
  const col = listSortColumn;
  const dir = listSortAsc ? 1 : -1;

  return tasks.sort((a, b) => {
    let va, vb;
    switch (col) {
      case 'title':
        va = (a.title || '').toLowerCase();
        vb = (b.title || '').toLowerCase();
        return va.localeCompare(vb, 'tr') * dir;
      case 'status': {
        const order = { backlog: 0, todo: 1, 'in-progress': 2, done: 3 };
        return ((order[a.status] || 0) - (order[b.status] || 0)) * dir;
      }
      case 'priority': {
        const order = { high: 0, medium: 1, low: 2 };
        return ((order[a.priority] || 0) - (order[b.priority] || 0)) * dir;
      }
      case 'assignee':
        va = getMember(a.assigneeId).name.toLowerCase();
        vb = getMember(b.assigneeId).name.toLowerCase();
        return va.localeCompare(vb, 'tr') * dir;
      case 'dueDate':
        va = a.dueDate || '9999-12-31';
        vb = b.dueDate || '9999-12-31';
        return va.localeCompare(vb) * dir;
      case 'progress':
        va = getSubtaskStats(a).percent;
        vb = getSubtaskStats(b).percent;
        return (va - vb) * dir;
      default:
        va = a.createdDate || '';
        vb = b.createdDate || '';
        return vb.localeCompare(va) * dir;
    }
  });
}

export function renderListView() {
  const tbody = $('#list-table-body');
  if (!tbody) return;

  // Sort indicators
  $$('.task-table th.sortable').forEach(th => {
    th.classList.remove('sort-asc', 'sort-desc');
    if (th.dataset.sort === listSortColumn) {
      th.classList.add(listSortAsc ? 'sort-asc' : 'sort-desc');
    }
  });

  let tasks = sortTasks(getFilteredTasks());

  if (tasks.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="8">
        <div class="empty-state">
          <i data-lucide="search-x" class="empty-state-icon"></i>
          <p class="empty-state-title">Filtrelere uygun görev bulunamadı.</p>
        </div>
      </td></tr>`;
    refreshIcons(tbody);
    updateBulkBar();
    return;
  }

  tbody.innerHTML = tasks.map(task => {
    const member = getMember(task.assigneeId);
    const stats = getSubtaskStats(task);
    const taskLabels = (task.labels || []).map(lid => getLabel(lid)).filter(Boolean);
    const labelChips = taskLabels.map(l =>
      `<span class="label-chip" style="background:${l.color}">${escapeHTML(l.name)}</span>`
    ).join('');
    const isChecked = selectedTaskIds.has(task.id) ? 'checked' : '';
    const statusKey = task.status === 'in-progress' ? 'progress' : task.status;

    return `
      <tr data-id="${task.id}">
        <td><input type="checkbox" class="task-checkbox subtask-checkbox" data-id="${task.id}" ${isChecked}></td>
        <td class="table-title-col">${escapeHTML(task.title)}</td>
        <td><span class="table-status-pill status-${statusKey}">${STATUS_LABELS[task.status]}</span></td>
        <td><span class="priority-badge priority-${task.priority}">${PRIORITY_LABELS[task.priority]}</span></td>
        <td><div class="table-labels-cell">${labelChips || '-'}</div></td>
        <td>
          <div class="table-assignee-cell">
            <div class="avatar-badge" style="background:${member.color}">${escapeHTML(member.avatar)}</div>
            <span>${escapeHTML(member.name)}</span>
          </div>
        </td>
        <td>${task.dueDate ? formatDateString(task.dueDate) : '-'}</td>
        <td>${stats.total > 0 ? `${stats.completed}/${stats.total}` : '-'}</td>
      </tr>`;
  }).join('');

  refreshIcons(tbody);
  updateBulkBar();
}

function selectAllVisible(checked) {
  const tbody = $('#list-table-body');
  if (!tbody) return;
  tbody.querySelectorAll('.task-checkbox').forEach(cb => {
    cb.checked = checked;
    if (checked) selectedTaskIds.add(cb.dataset.id);
    else selectedTaskIds.delete(cb.dataset.id);
  });
  updateBulkBar();
}

function updateBulkBar() {
  const bar = $('#bulk-actions-bar');
  if (!bar) return;
  if (selectedTaskIds.size > 0 && hasPermission('canBulkActions')) {
    bar.style.display = 'flex';
    const count = $('#bulk-selected-count');
    if (count) count.textContent = `${selectedTaskIds.size} görev seçildi`;
  } else {
    bar.style.display = 'none';
  }
  const bs = $('#bulk-status-change');
  const bp = $('#bulk-priority-change');
  if (bs) bs.value = '';
  if (bp) bp.value = '';
}

export function initListInteractions() {
  // Sort header clicks
  $$('.task-table th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.sort;
      if (listSortColumn === col) listSortAsc = !listSortAsc;
      else { listSortColumn = col; listSortAsc = true; }
      renderListView();
    });
  });

  // Filter changes
  ['filter-status', 'filter-priority', 'filter-assignee', 'filter-label'].forEach(id => {
    const el = $(`#${id}`);
    if (el) el.addEventListener('change', renderListView);
  });

  // Clear filters
  const btnClear = $('#btn-clear-filters');
  if (btnClear) {
    btnClear.addEventListener('click', () => {
      ['filter-status', 'filter-priority', 'filter-assignee', 'filter-label'].forEach(id => {
        const el = $(`#${id}`);
        if (el) el.value = 'all';
      });
      renderListView();
    });
  }

  // Row click → detail
  const tbody = $('#list-table-body');
  if (tbody) {
    tbody.addEventListener('click', (e) => {
      if (e.target.classList.contains('task-checkbox')) {
        const id = e.target.dataset.id;
        if (e.target.checked) selectedTaskIds.add(id);
        else selectedTaskIds.delete(id);
        updateBulkBar();
        return;
      }
      const row = e.target.closest('tr[data-id]');
      if (!row) return;
      if (onRowClick) onRowClick(row.dataset.id);
    });
  }

  // Select all checkboxes (both)
  const tableSelectAll = $('#table-select-all');
  const bulkSelectAll = $('#bulk-select-all');

  if (tableSelectAll) {
    tableSelectAll.addEventListener('change', () => {
      selectAllVisible(tableSelectAll.checked);
      if (bulkSelectAll) bulkSelectAll.checked = tableSelectAll.checked;
    });
  }
  if (bulkSelectAll) {
    bulkSelectAll.addEventListener('change', () => {
      selectAllVisible(bulkSelectAll.checked);
      if (tableSelectAll) tableSelectAll.checked = bulkSelectAll.checked;
    });
  }

  // Bulk status change
  const bulkStatus = $('#bulk-status-change');
  if (bulkStatus) {
    bulkStatus.addEventListener('change', () => {
      const newStatus = bulkStatus.value;
      if (!newStatus || selectedTaskIds.size === 0) return;
      pushUndo();
      selectedTaskIds.forEach(id => {
        const t = state.tasks.find(t => t.id === id);
        if (t) t.status = newStatus;
      });
      logActivity('toplu_durum', null, `${selectedTaskIds.size} görev → ${STATUS_LABELS[newStatus]}`);
      showToast(`${selectedTaskIds.size} görevin durumu güncellendi.`, 'success');
      selectedTaskIds.clear();
      saveStateAndRerender();
    });
  }

  // Bulk priority change
  const bulkPriority = $('#bulk-priority-change');
  if (bulkPriority) {
    bulkPriority.addEventListener('change', () => {
      const newPriority = bulkPriority.value;
      if (!newPriority || selectedTaskIds.size === 0) return;
      pushUndo();
      selectedTaskIds.forEach(id => {
        const t = state.tasks.find(t => t.id === id);
        if (t) t.priority = newPriority;
      });
      logActivity('toplu_öncelik', null, `${selectedTaskIds.size} görev → ${PRIORITY_LABELS[newPriority]}`);
      showToast(`${selectedTaskIds.size} görevin önceliği güncellendi.`, 'success');
      selectedTaskIds.clear();
      saveStateAndRerender();
    });
  }

  // Bulk delete
  const btnBulkDel = $('#btn-bulk-delete');
  if (btnBulkDel) {
    btnBulkDel.addEventListener('click', () => {
      if (selectedTaskIds.size === 0) return;
      if (!confirm(`${selectedTaskIds.size} görevi silmek istediğinize emin misiniz?`)) return;
      pushUndo();
      const count = selectedTaskIds.size;
      state.tasks = state.tasks.filter(t => !selectedTaskIds.has(t.id));
      logActivity('toplu_silme', null, `${count} görev silindi`);
      selectedTaskIds.clear();
      saveStateAndRerender();
      showToast(`${count} görev silindi.`, 'warning', () => { performUndo(); saveStateAndRerender(); });
    });
  }
}
