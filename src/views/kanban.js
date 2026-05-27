// src/views/kanban.js
import { $, refreshIcons } from '../ui/dom.js';
import { state } from '../core/state.js';
import { escapeHTML, formatDateString, isOverdue, PRIORITY_LABELS, STATUS_LABELS } from '../core/utils.js';
import { getMember, getLabel, getSubtaskStats, logActivity } from '../core/activity.js';
import { hasPermission, canEditTask } from '../core/permissions.js';
import { filterBySearch } from '../ui/search.js';
import { showToast } from '../ui/toast.js';
import { pushUndo } from '../core/undo.js';
import { saveStateAndRerender } from '../router.js';

let onTaskClick = null;

export function setKanbanTaskClickHandler(handler) {
  onTaskClick = handler;
}

export function renderKanbanBoard() {
  const board = $('#kanban-board');
  if (!board) return;

  const statuses = ['backlog', 'todo', 'in-progress', 'done'];
  const filtered = filterBySearch(state.tasks);
  const canDrag = hasPermission('canDragTasks');

  statuses.forEach(status => {
    const column = board.querySelector(`.column-cards[data-status="${status}"]`);
    const countEl = board.querySelector(`.kanban-column[data-status="${status}"] .column-count`);
    if (!column) return;

    const tasks = filtered
      .filter(t => t.status === status)
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    if (countEl) countEl.textContent = tasks.length;

    if (tasks.length === 0) {
      column.innerHTML = `
        <div class="empty-state" style="padding:30px 10px;">
          <i data-lucide="inbox" class="empty-state-icon" style="width:32px;height:32px;"></i>
          <p class="empty-state-desc">Bu sütunda görev yok</p>
        </div>`;
      refreshIcons(column);
      return;
    }

    column.innerHTML = tasks.map(task => {
      const member = getMember(task.assigneeId);
      const stats = getSubtaskStats(task);
      const taskLabels = (task.labels || []).map(lid => getLabel(lid)).filter(Boolean);

      const labelChips = taskLabels.map(l =>
        `<span class="label-chip" style="background:${l.color}">${escapeHTML(l.name)}</span>`
      ).join('');

      const subtaskBar = stats.total > 0
        ? `<div class="card-subtasks-summary">
             <span>Alt görevler: ${stats.completed}/${stats.total}</span>
             <div class="card-subtasks-bar"><div class="card-subtasks-fill" style="width:${stats.percent}%"></div></div>
           </div>`
        : '';

      const overdueClass = isOverdue(task) ? ' overdue' : '';
      const draggableAttr = canDrag ? 'draggable="true"' : '';

      return `
        <div class="task-card" data-id="${task.id}" ${draggableAttr}>
          <div class="card-tags">
            <span class="priority-badge priority-${task.priority}">${PRIORITY_LABELS[task.priority]}</span>
          </div>
          <h4 class="card-title">${escapeHTML(task.title)}</h4>
          ${task.description ? `<p class="card-desc">${escapeHTML(task.description)}</p>` : ''}
          ${labelChips ? `<div class="card-labels-row">${labelChips}</div>` : ''}
          ${subtaskBar}
          <div class="card-footer">
            ${task.dueDate ? `<span class="card-due-date${overdueClass}"><i data-lucide="calendar" class="due-icon"></i> ${formatDateString(task.dueDate)}</span>` : '<span></span>'}
            <div class="avatar-badge" style="background:${member.color}" title="${escapeHTML(member.name)}">${escapeHTML(member.avatar)}</div>
          </div>
        </div>`;
    }).join('');

    refreshIcons(column);
  });
}

function triggerGamification(task, cardElement) {
  if (window.confetti) {
    const isHighPriority = task.priority === 'high';
    window.confetti({
      particleCount: isHighPriority ? 100 : 40,
      spread: isHighPriority ? 70 : 50,
      origin: { y: 0.6 },
      colors: ['#8b5cf6', '#06b6d4', '#10b981']
    });
  }
  if (cardElement) {
    cardElement.classList.add('success-pulse');
    setTimeout(() => cardElement.classList.remove('success-pulse'), 1500);
  }
}

export function initKanbanInteractions() {
  const board = $('#kanban-board');
  if (!board) return;

  // Card click
  board.addEventListener('click', (e) => {
    const card = e.target.closest('.task-card');
    if (!card) return;
    if (card.classList.contains('dragging')) return;
    if (onTaskClick) onTaskClick(card.dataset.id);
  });

  // Drag & drop
  board.addEventListener('dragstart', (e) => {
    const card = e.target.closest('.task-card');
    if (!card) return;
    if (!hasPermission('canDragTasks')) {
      e.preventDefault();
      return;
    }
    card.classList.add('dragging');
    e.dataTransfer.setData('text/plain', card.dataset.id);
    e.dataTransfer.effectAllowed = 'move';
  });

  board.addEventListener('dragend', (e) => {
    const card = e.target.closest('.task-card');
    if (card) card.classList.remove('dragging');
  });

  board.addEventListener('dragover', (e) => {
    const col = e.target.closest('.column-cards');
    if (!col) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    col.classList.add('drag-over');
  });

  board.addEventListener('dragleave', (e) => {
    const col = e.target.closest('.column-cards');
    if (!col) return;
    const related = e.relatedTarget;
    if (related && col.contains(related)) return;
    col.classList.remove('drag-over');
  });

  board.addEventListener('drop', (e) => {
    e.preventDefault();
    const col = e.target.closest('.column-cards');
    if (!col) return;
    col.classList.remove('drag-over');

    const taskId = e.dataTransfer.getData('text/plain');
    const newStatus = col.dataset.status;
    const task = state.tasks.find(t => t.id === taskId);
    if (!task || task.status === newStatus) return;
    if (!canEditTask(task)) {
      showToast('Bu görevi taşıma yetkiniz yok.', 'error');
      return;
    }

    pushUndo();
    const oldStatus = task.status;
    task.status = newStatus;
    logActivity('durum_değiştirildi', taskId, `${STATUS_LABELS[oldStatus]} → ${STATUS_LABELS[newStatus]}`);
    saveStateAndRerender();
    showToast(`Görev "${task.title}" durumu güncellendi.`, 'success');

    if (newStatus === 'done') {
      const droppedCard = document.querySelector(`.task-card[data-id="${taskId}"]`);
      triggerGamification(task, droppedCard);
    }
  });
}
