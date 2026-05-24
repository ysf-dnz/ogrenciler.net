document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  // ============================================================
  // 1. STATE & INITIALIZATION
  // ============================================================

  let state = ZenFlowData.load();
  let undoStack = [];
  const MAX_UNDO = 15;
  let selectedTaskIds = new Set();
  let activeView = 'kanban';
  let listSortColumn = 'createdDate';
  let listSortAsc = false;
  let searchQuery = '';
  let searchTimer = null;

  // DOM Cache
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const sidebar = $('#sidebar');
  const activeUserSelect = $('#active-user-select');
  const sidebarDoneCount = $('#sidebar-done-count');
  const sidebarProgressBar = $('#sidebar-progress-bar');
  const themeToggle = $('#theme-toggle');
  const themeText = themeToggle ? themeToggle.querySelector('.theme-text') : null;
  const btnExport = $('#btn-export-json');
  const btnImport = $('#btn-import-json');
  const importFileInput = $('#import-file-input');
  const hamburgerToggle = $('#hamburger-toggle');
  const viewTitle = $('#view-title');
  const viewSubtitle = $('#view-subtitle');
  const globalSearch = $('#global-search');
  const btnCreateTask = $('#btn-create-task');
  const kanbanBoard = $('#kanban-board');
  const toastContainer = $('#toast-container');

  // List view elements
  const filterStatus = $('#filter-status');
  const filterPriority = $('#filter-priority');
  const filterAssignee = $('#filter-assignee');
  const filterLabel = $('#filter-label');
  const btnClearFilters = $('#btn-clear-filters');
  const listTableBody = $('#list-table-body');
  const tableSelectAll = $('#table-select-all');
  const bulkActionsBar = $('#bulk-actions-bar');
  const bulkSelectedCount = $('#bulk-selected-count');
  const bulkStatusChange = $('#bulk-status-change');
  const bulkPriorityChange = $('#bulk-priority-change');
  const btnBulkDelete = $('#btn-bulk-delete');

  // Modals
  const modalTaskDetail = $('#modal-task-detail');
  const modalTaskCreate = $('#modal-task-create');
  const modalMemberCreate = $('#modal-member-create');
  const modalOnboarding = $('#modal-onboarding');

  // View title/subtitle map
  const viewMeta = {
    kanban: { title: 'Kanban Pano', subtitle: 'Ekibinizin iş akışını görselleştirin ve takip edin.' },
    list: { title: 'Görev Listesi', subtitle: 'Arama, filtreleme ve toplu işlemlerle görevler.' },
    analytics: { title: 'Analiz & Rapor', subtitle: 'Proje istatistikleri ve ekip verimliliği analizleri.' },
    team: { title: 'Ekip Üyeleri', subtitle: 'Projedeki aktif katılımcılar ve rol tanımları.' },
    activity: { title: 'Aktivite Geçmişi', subtitle: 'Projenizdeki tüm hareketlerin kronolojik kaydı.' },
    roadmap: { title: 'Yol Haritası', subtitle: 'Görevlerin zaman çizelgesi üzerinde genel görünümü.' }
  };

  const statusLabels = {
    'backlog': 'Beklemede',
    'todo': 'Yapılacak',
    'in-progress': 'Devam Ediyor',
    'done': 'Tamamlandı'
  };

  const priorityLabels = {
    'high': 'Yüksek',
    'medium': 'Orta',
    'low': 'Düşük'
  };

  const MEMBER_COLORS = [
    '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#ef4444',
    '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4',
    '#3b82f6', '#a855f7', '#d946ef', '#f59e0b', '#10b981'
  ];

  // ============================================================
  // 2. THEME TOGGLE
  // ============================================================

  function initTheme() {
    const saved = localStorage.getItem('zenflow_theme') || 'dark';
    applyTheme(saved);
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    if (themeText) {
      themeText.textContent = theme === 'dark' ? 'Açık Tema' : 'Koyu Tema';
    }
    localStorage.setItem('zenflow_theme', theme);
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    applyTheme(current === 'dark' ? 'light' : 'dark');
  }

  if (themeToggle) {
    themeToggle.addEventListener('click', toggleTheme);
  }

  // ============================================================
  // 3. ACTIVE USER
  // ============================================================

  function populateActiveUserSelect() {
    if (!activeUserSelect) return;
    activeUserSelect.innerHTML = '';
    state.members.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = m.name;
      activeUserSelect.appendChild(opt);
    });
    activeUserSelect.value = state.activeUserId || '';
  }

  if (activeUserSelect) {
    activeUserSelect.addEventListener('change', () => {
      state.activeUserId = activeUserSelect.value;
      saveStateAndRerender();
    });
  }

  // ============================================================
  // GAMIFICATION & EFFECTS
  // ============================================================

  function triggerGamification(task, cardElement) {
    if (window.confetti) {
      const isHighPriority = task.priority === 'high';
      const particleCount = isHighPriority ? 100 : 40;
      const spread = isHighPriority ? 70 : 50;
      
      confetti({
        particleCount,
        spread,
        origin: { y: 0.6 },
        colors: ['#8b5cf6', '#06b6d4', '#10b981']
      });
    }

    if (cardElement) {
      cardElement.classList.add('success-pulse');
      setTimeout(() => cardElement.classList.remove('success-pulse'), 1500);
    }
  }

  // ============================================================
  // 24. UTILITY FUNCTIONS
  // ============================================================

  function escapeHTML(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/'/g, '&#39;')
      .replace(/"/g, '&quot;');
  }

  const TURKISH_MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

  function formatDateString(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return `${d.getDate()} ${TURKISH_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  }

  function getRelativeTime(isoString) {
    if (!isoString) return '';
    const now = Date.now();
    const then = new Date(isoString).getTime();
    const diffMs = now - then;
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMs / 3600000);
    const diffDay = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return 'Az önce';
    if (diffMin < 60) return `${diffMin} dk önce`;
    if (diffHr < 24) return `${diffHr} sa önce`;
    if (diffDay < 30) return `${diffDay} gün önce`;
    return formatDateString(isoString);
  }

  function getMember(memberId) {
    if (!memberId) return { name: 'Atanmamış', avatar: '?', color: '#6b7280' };
    const m = state.members.find(m => m.id === memberId);
    return m || { name: 'Atanmamış', avatar: '?', color: '#6b7280' };
  }

  function getSubtaskStats(task) {
    if (!task.subtasks || task.subtasks.length === 0) return { total: 0, completed: 0, percent: 0 };
    const total = task.subtasks.length;
    const completed = task.subtasks.filter(s => s.completed).length;
    return { total, completed, percent: total > 0 ? Math.round((completed / total) * 100) : 0 };
  }

  function getLabel(labelId) {
    return state.labels.find(l => l.id === labelId) || null;
  }

  function generateId() {
    return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function todayStr() {
    return new Date().toISOString().split('T')[0];
  }

  // ============================================================
  // 8. UNDO SYSTEM
  // ============================================================

  function pushUndo() {
    undoStack.push(deepClone(state));
    if (undoStack.length > MAX_UNDO) {
      undoStack.shift();
    }
  }

  function performUndo() {
    if (undoStack.length === 0) return;
    state = undoStack.pop();
    ZenFlowData.save(state);
    populateActiveUserSelect();
    populateFilterDropdowns();
    saveStateAndRerender();
    showToast('İşlem geri alındı.', 'info');
  }

  // ============================================================
  // 7. TOAST SYSTEM
  // ============================================================

  function showToast(message, type = 'info', undoCallback = null, duration = 4000) {
    if (!toastContainer) return;

    const iconMap = {
      success: 'check-circle',
      error: 'alert-circle',
      info: 'info',
      warning: 'alert-triangle'
    };

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <i data-lucide="${iconMap[type] || 'info'}" class="toast-icon"></i>
      <span class="toast-message">${escapeHTML(message)}</span>
      ${undoCallback ? '<button class="toast-undo-btn">Geri Al</button>' : ''}
      <button class="toast-close-btn"><i data-lucide="x"></i></button>
    `;

    toastContainer.appendChild(toast);
    lucide.createIcons({ nodes: [toast] });

    const removeToast = () => {
      toast.classList.add('toast-removing');
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 300);
    };

    if (undoCallback) {
      const undoBtn = toast.querySelector('.toast-undo-btn');
      undoBtn.addEventListener('click', () => {
        undoCallback();
        removeToast();
      });
    }

    toast.querySelector('.toast-close-btn').addEventListener('click', removeToast);

    setTimeout(removeToast, duration);
  }

  // ============================================================
  // 9. ACTIVITY LOG
  // ============================================================

  function logActivity(action, taskId, details) {
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

  function renderActivityView() {
    const list = $('#activity-list');
    if (!list) return;

    if (!state.activityLog || state.activityLog.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <i data-lucide="clipboard-list"></i>
          <p>Henüz aktivite kaydı bulunmuyor.</p>
        </div>`;
      lucide.createIcons({ nodes: [list] });
      return;
    }

    const actionLabels = {
      'görev_oluşturuldu': 'yeni görev oluşturdu',
      'görev_silindi': 'bir görevi sildi',
      'görev_güncellendi': 'bir görevi güncelledi',
      'durum_değiştirildi': 'görev durumunu değiştirdi',
      'yorum_eklendi': 'yorum ekledi',
      'üye_eklendi': 'yeni üye ekledi',
      'görev_kopyalandı': 'bir görevi kopyaladı',
      'toplu_durum': 'toplu durum değişikliği yaptı',
      'toplu_öncelik': 'toplu öncelik değişikliği yaptı',
      'toplu_silme': 'toplu görev sildi',
      'alt_görev_eklendi': 'alt görev ekledi',
      'alt_görev_değiştirildi': 'alt görev durumunu değiştirdi',
      'aktivite_temizlendi': 'aktivite geçmişini temizledi'
    };

    list.innerHTML = state.activityLog.map(entry => {
      const member = getMember(entry.memberId);
      const actionText = actionLabels[entry.action] || entry.action;
      const task = entry.taskId ? state.tasks.find(t => t.id === entry.taskId) : null;
      const taskRef = task ? `<strong>"${escapeHTML(task.title)}"</strong>` : (entry.taskId ? '<em>(silinmiş görev)</em>' : '');

      return `
        <div class="activity-item">
          <div class="activity-avatar" style="background:${member.color}">${escapeHTML(member.avatar)}</div>
          <div class="activity-content">
            <p><strong>${escapeHTML(member.name)}</strong> ${actionText} ${taskRef}</p>
            ${entry.details ? `<span class="activity-detail">${escapeHTML(entry.details)}</span>` : ''}
            <span class="activity-time">${getRelativeTime(entry.timestamp)}</span>
          </div>
        </div>`;
    }).join('');
    lucide.createIcons({ nodes: [list] });
  }

  const btnClearActivity = $('#btn-clear-activity');
  if (btnClearActivity) {
    btnClearActivity.addEventListener('click', () => {
      pushUndo();
      state.activityLog = [];
      logActivity('aktivite_temizlendi', null, '');
      ZenFlowData.save(state);
      renderActivityView();
      showToast('Aktivite geçmişi temizlendi.', 'success');
    });
  }

  // ============================================================
  // 6. SIDEBAR STATS
  // ============================================================

  function updateSidebarStats() {
    const total = state.tasks.length;
    const done = state.tasks.filter(t => t.status === 'done').length;

    if (sidebarDoneCount) {
      sidebarDoneCount.textContent = `${done}/${total}`;
    }
    if (sidebarProgressBar) {
      const pct = total > 0 ? (done / total) * 100 : 0;
      sidebarProgressBar.style.width = `${pct}%`;
    }
  }

  // ============================================================
  // 25. CORE PATTERNS
  // ============================================================

  function saveStateAndRerender() {
    ZenFlowData.save(state);
    updateSidebarStats();
    populateFilterDropdowns();
    renderCurrentView();
  }

  function renderCurrentView() {
    switch (activeView) {
      case 'kanban': renderKanbanBoard(); break;
      case 'list': renderListView(); break;
      case 'analytics': renderAnalyticsView(); break;
      case 'team': renderTeamView(); break;
      case 'activity': renderActivityView(); break;
      case 'roadmap': renderRoadmapView(); break;
    }
  }

  // ============================================================
  // 4. ROUTING / NAVIGATION
  // ============================================================

  function navigateTo(view) {
    if (!viewMeta[view]) return;
    activeView = view;

    $$('.menu-item').forEach(item => {
      item.classList.toggle('active', item.dataset.view === view);
    });

    $$('.view-section').forEach(sec => {
      sec.classList.remove('active');
    });
    const targetView = $(`#${view}-view`);
    if (targetView) targetView.classList.add('active');

    if (viewTitle) viewTitle.textContent = viewMeta[view].title;
    if (viewSubtitle) viewSubtitle.textContent = viewMeta[view].subtitle;

    window.location.hash = view;
    if (view === 'list') {
      populateFilterDropdowns();
    }
    renderCurrentView();

    // Close mobile sidebar if open
    if (sidebar && sidebar.classList.contains('open')) {
      closeMobileSidebar();
    }
  }

  function handleHash() {
    const hash = window.location.hash.replace('#', '');
    if (viewMeta[hash]) {
      navigateTo(hash);
    } else {
      navigateTo('kanban');
    }
  }

  $$('.menu-item[data-view]').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo(item.dataset.view);
    });
  });

  window.addEventListener('hashchange', handleHash);

  // ============================================================
  // 5. GLOBAL SEARCH
  // ============================================================

  if (globalSearch) {
    globalSearch.addEventListener('input', (e) => {
      searchQuery = e.target.value.trim().toLowerCase();
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => renderCurrentView(), 250);
    });
  }

  function filterBySearch(tasks) {
    if (!searchQuery) return tasks;
    return tasks.filter(t =>
      (t.title && t.title.toLowerCase().includes(searchQuery)) ||
      (t.description && t.description.toLowerCase().includes(searchQuery))
    );
  }

  // ============================================================
  // 10. KANBAN BOARD
  // ============================================================

  function renderKanbanBoard() {
    if (!kanbanBoard) return;

    const statuses = ['backlog', 'todo', 'in-progress', 'done'];
    const filtered = filterBySearch(state.tasks);

    statuses.forEach(status => {
      const column = kanbanBoard.querySelector(`.column-cards[data-status="${status}"]`);
      const countEl = kanbanBoard.querySelector(`.kanban-column[data-status="${status}"] .column-count`);
      if (!column) return;

      const tasks = filtered
        .filter(t => t.status === status)
        .sort((a, b) => (a.order || 0) - (b.order || 0));

      if (countEl) countEl.textContent = tasks.length;

      if (tasks.length === 0) {
        column.innerHTML = `
          <div class="kanban-empty-state">
            <i data-lucide="inbox"></i>
            <p>Bu sütunda görev yok</p>
          </div>`;
        lucide.createIcons({ nodes: [column] });
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
          ? `<div class="subtask-progress-bar"><div class="subtask-progress-fill" style="width:${stats.percent}%"></div></div>`
          : '';

        return `
          <div class="task-card" data-id="${task.id}" draggable="true">
            <div class="card-header">
              <span class="priority-badge priority-${task.priority}">${priorityLabels[task.priority]}</span>
            </div>
            <h4 class="card-title">${escapeHTML(task.title)}</h4>
            ${task.description ? `<p class="card-description">${escapeHTML(task.description)}</p>` : ''}
            ${labelChips ? `<div class="card-labels">${labelChips}</div>` : ''}
            ${subtaskBar}
            <div class="card-footer">
              ${task.dueDate ? `<span class="card-due-date"><i data-lucide="calendar" class="icon-sm"></i> ${formatDateString(task.dueDate)}</span>` : '<span></span>'}
              <div class="card-assignee-avatar" style="background:${member.color}" title="${escapeHTML(member.name)}">${escapeHTML(member.avatar)}</div>
            </div>
          </div>`;
      }).join('');

      lucide.createIcons({ nodes: [column] });
    });
  }

  // Kanban card click → open detail
  if (kanbanBoard) {
    kanbanBoard.addEventListener('click', (e) => {
      const card = e.target.closest('.task-card');
      if (!card) return;
      // Don't open if we were dragging
      if (card.classList.contains('dragging')) return;
      openTaskDetailModal(card.dataset.id);
    });
  }

  // ============================================================
  // 11. DRAG AND DROP (Event Delegation, no memory leak)
  // ============================================================

  if (kanbanBoard) {
    kanbanBoard.addEventListener('dragstart', (e) => {
      const card = e.target.closest('.task-card');
      if (!card) return;
      card.classList.add('dragging');
      e.dataTransfer.setData('text/plain', card.dataset.id);
      e.dataTransfer.effectAllowed = 'move';
    });

    kanbanBoard.addEventListener('dragend', (e) => {
      const card = e.target.closest('.task-card');
      if (card) card.classList.remove('dragging');
    });

    kanbanBoard.addEventListener('dragover', (e) => {
      const col = e.target.closest('.column-cards');
      if (!col) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      col.classList.add('drag-over');
    });

    kanbanBoard.addEventListener('dragleave', (e) => {
      const col = e.target.closest('.column-cards');
      if (!col) return;
      // Only remove if we truly left the column
      const related = e.relatedTarget;
      if (related && col.contains(related)) return;
      col.classList.remove('drag-over');
    });

    kanbanBoard.addEventListener('drop', (e) => {
      e.preventDefault();
      const col = e.target.closest('.column-cards');
      if (!col) return;
      col.classList.remove('drag-over');

      const taskId = e.dataTransfer.getData('text/plain');
      const newStatus = col.dataset.status;
      const task = state.tasks.find(t => t.id === taskId);
      if (!task || task.status === newStatus) return;

      pushUndo();
      const oldStatus = task.status;
      task.status = newStatus;
      logActivity('durum_değiştirildi', taskId, `${statusLabels[oldStatus]} → ${statusLabels[newStatus]}`);
      saveStateAndRerender();
      showToast(`Görev "${task.title}" durumu güncellendi.`, 'success');

      if (newStatus === 'done') {
        const droppedCard = document.querySelector(`.task-card[data-id="${taskId}"]`);
        triggerGamification(task, droppedCard);
      }
    });
  }

  // ============================================================
  // 12. LIST VIEW
  // ============================================================

  function populateFilterDropdowns() {
    // Assignee
    if (filterAssignee) {
      const currentVal = filterAssignee.value;
      filterAssignee.innerHTML = '<option value="">Tüm Üyeler</option>';
      state.members.forEach(m => {
        filterAssignee.innerHTML += `<option value="${m.id}">${escapeHTML(m.name)}</option>`;
      });
      filterAssignee.value = currentVal || '';
    }
    // Label
    if (filterLabel) {
      const currentVal = filterLabel.value;
      filterLabel.innerHTML = '<option value="">Tüm Etiketler</option>';
      state.labels.forEach(l => {
        filterLabel.innerHTML += `<option value="${l.id}">${escapeHTML(l.name)}</option>`;
      });
      filterLabel.value = currentVal || '';
    }
  }

  function getFilteredTasks() {
    let tasks = [...state.tasks];

    // Global search
    tasks = filterBySearch(tasks);

    // Status filter
    if (filterStatus && filterStatus.value && filterStatus.value !== 'all') {
      tasks = tasks.filter(t => t.status === filterStatus.value);
    }
    // Priority filter
    if (filterPriority && filterPriority.value && filterPriority.value !== 'all') {
      tasks = tasks.filter(t => t.priority === filterPriority.value);
    }
    // Assignee filter
    if (filterAssignee && filterAssignee.value) {
      tasks = tasks.filter(t => t.assigneeId === filterAssignee.value);
    }
    // Label filter
    if (filterLabel && filterLabel.value) {
      tasks = tasks.filter(t => t.labels && t.labels.includes(filterLabel.value));
    }

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
        case 'status':
          const statusOrder = { backlog: 0, todo: 1, 'in-progress': 2, done: 3 };
          return ((statusOrder[a.status] || 0) - (statusOrder[b.status] || 0)) * dir;
        case 'priority':
          const prioOrder = { high: 0, medium: 1, low: 2 };
          return ((prioOrder[a.priority] || 0) - (prioOrder[b.priority] || 0)) * dir;
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

  function renderListView() {
    if (!listTableBody) return;

    // Update sort indicators
    $$('.task-table th.sortable').forEach(th => {
      th.classList.remove('sort-asc', 'sort-desc');
      if (th.dataset.sort === listSortColumn) {
        th.classList.add(listSortAsc ? 'sort-asc' : 'sort-desc');
      }
    });

    let tasks = getFilteredTasks();
    tasks = sortTasks(tasks);

    if (tasks.length === 0) {
      listTableBody.innerHTML = `
        <tr>
          <td colspan="8" class="empty-state">
            <i data-lucide="search-x"></i>
            <p>Filtrelere uygun görev bulunamadı.</p>
          </td>
        </tr>`;
      lucide.createIcons({ nodes: [listTableBody] });
      updateBulkBar();
      return;
    }

    listTableBody.innerHTML = tasks.map(task => {
      const member = getMember(task.assigneeId);
      const stats = getSubtaskStats(task);
      const taskLabels = (task.labels || []).map(lid => getLabel(lid)).filter(Boolean);
      const labelChips = taskLabels.map(l =>
        `<span class="label-chip" style="background:${l.color}">${escapeHTML(l.name)}</span>`
      ).join('');
      const isChecked = selectedTaskIds.has(task.id) ? 'checked' : '';

      return `
        <tr class="task-row" data-id="${task.id}">
          <td><input type="checkbox" class="task-checkbox" data-id="${task.id}" ${isChecked}></td>
          <td class="task-row-title">${escapeHTML(task.title)}</td>
          <td><span class="status-pill status-${task.status}">${statusLabels[task.status]}</span></td>
          <td><span class="priority-badge priority-${task.priority}">${priorityLabels[task.priority]}</span></td>
          <td>${labelChips || '-'}</td>
          <td>
            <div class="assignee-cell">
              <div class="mini-avatar" style="background:${member.color}">${escapeHTML(member.avatar)}</div>
              <span>${escapeHTML(member.name)}</span>
            </div>
          </td>
          <td>${task.dueDate ? formatDateString(task.dueDate) : '-'}</td>
          <td>${stats.total > 0 ? `${stats.completed}/${stats.total}` : '-'}</td>
        </tr>`;
    }).join('');

    lucide.createIcons({ nodes: [listTableBody] });
    updateBulkBar();
  }

  // List view: sort header clicks
  $$('.task-table th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.sort;
      if (listSortColumn === col) {
        listSortAsc = !listSortAsc;
      } else {
        listSortColumn = col;
        listSortAsc = true;
      }
      renderListView();
    });
  });

  // List view: filter change events
  [filterStatus, filterPriority, filterAssignee, filterLabel].forEach(el => {
    if (el) el.addEventListener('change', () => renderListView());
  });

  if (btnClearFilters) {
    btnClearFilters.addEventListener('click', () => {
      if (filterStatus) filterStatus.value = '';
      if (filterPriority) filterPriority.value = '';
      if (filterAssignee) filterAssignee.value = '';
      if (filterLabel) filterLabel.value = '';
      renderListView();
    });
  }

  // List view: row click → open detail
  if (listTableBody) {
    listTableBody.addEventListener('click', (e) => {
      // Handle checkbox separately
      if (e.target.classList.contains('task-checkbox')) {
        const id = e.target.dataset.id;
        if (e.target.checked) {
          selectedTaskIds.add(id);
        } else {
          selectedTaskIds.delete(id);
        }
        updateBulkBar();
        return;
      }

      const row = e.target.closest('.task-row');
      if (!row) return;
      openTaskDetailModal(row.dataset.id);
    });
  }

  // ============================================================
  // 13. BULK ACTIONS
  // ============================================================

  if (tableSelectAll) {
    tableSelectAll.addEventListener('change', () => {
      const checkboxes = listTableBody.querySelectorAll('.task-checkbox');
      checkboxes.forEach(cb => {
        cb.checked = tableSelectAll.checked;
        if (tableSelectAll.checked) {
          selectedTaskIds.add(cb.dataset.id);
        } else {
          selectedTaskIds.delete(cb.dataset.id);
        }
      });
      updateBulkBar();
    });
  }

  function updateBulkBar() {
    if (!bulkActionsBar) return;
    if (selectedTaskIds.size > 0) {
      bulkActionsBar.classList.add('visible');
      if (bulkSelectedCount) bulkSelectedCount.textContent = selectedTaskIds.size;
    } else {
      bulkActionsBar.classList.remove('visible');
    }
    // Reset bulk action selects
    if (bulkStatusChange) bulkStatusChange.value = '';
    if (bulkPriorityChange) bulkPriorityChange.value = '';
  }

  if (bulkStatusChange) {
    bulkStatusChange.addEventListener('change', () => {
      const newStatus = bulkStatusChange.value;
      if (!newStatus || selectedTaskIds.size === 0) return;

      pushUndo();
      selectedTaskIds.forEach(id => {
        const task = state.tasks.find(t => t.id === id);
        if (task) task.status = newStatus;
      });
      logActivity('toplu_durum', null, `${selectedTaskIds.size} görev → ${statusLabels[newStatus]}`);
      showToast(`${selectedTaskIds.size} görevin durumu güncellendi.`, 'success');
      selectedTaskIds.clear();
      saveStateAndRerender();
    });
  }

  if (bulkPriorityChange) {
    bulkPriorityChange.addEventListener('change', () => {
      const newPriority = bulkPriorityChange.value;
      if (!newPriority || selectedTaskIds.size === 0) return;

      pushUndo();
      selectedTaskIds.forEach(id => {
        const task = state.tasks.find(t => t.id === id);
        if (task) task.priority = newPriority;
      });
      logActivity('toplu_öncelik', null, `${selectedTaskIds.size} görev → ${priorityLabels[newPriority]}`);
      showToast(`${selectedTaskIds.size} görevin önceliği güncellendi.`, 'success');
      selectedTaskIds.clear();
      saveStateAndRerender();
    });
  }

  if (btnBulkDelete) {
    btnBulkDelete.addEventListener('click', () => {
      if (selectedTaskIds.size === 0) return;

      pushUndo();
      const count = selectedTaskIds.size;
      state.tasks = state.tasks.filter(t => !selectedTaskIds.has(t.id));
      logActivity('toplu_silme', null, `${count} görev silindi`);
      selectedTaskIds.clear();
      saveStateAndRerender();
      showToast(`${count} görev silindi.`, 'warning', performUndo);
    });
  }

  // ============================================================
  // 14. ANALYTICS VIEW
  // ============================================================

  function renderAnalyticsView() {
    const total = state.tasks.length;
    const done = state.tasks.filter(t => t.status === 'done').length;
    const active = state.tasks.filter(t => t.status === 'in-progress').length;
    const rate = total > 0 ? Math.round((done / total) * 100) : 0;

    // Velocity: done tasks that are NOT overdue
    const today = todayStr();
    const doneOnTime = state.tasks.filter(t => {
      if (t.status !== 'done') return false;
      if (!t.dueDate) return true; // no due date means not overdue
      return t.dueDate >= today;
    }).length;
    const velocity = done > 0 ? Math.clamp(Math.round((doneOnTime / done) * 100), 0, 100) : 0;

    // KPI animation
    animateKPI('#kpi-total-tasks', total);
    animateKPI('#kpi-active-tasks', active);
    animateKPI('#kpi-completion-rate', rate);
    animateKPI('#kpi-velocity', velocity);

    // Radial ring
    const circumference = 2 * Math.PI * 80; // 502.4
    const offset = circumference - (rate / 100) * circumference;
    const ring = $('#analytics-ring');
    if (ring) {
      ring.style.strokeDasharray = circumference;
      ring.style.strokeDashoffset = offset;
    }
    const pctEl = $('#analytics-percentage');
    if (pctEl) pctEl.textContent = `${rate}%`;

    // Legend counts
    const statusCounts = {
      backlog: state.tasks.filter(t => t.status === 'backlog').length,
      todo: state.tasks.filter(t => t.status === 'todo').length,
      'in-progress': state.tasks.filter(t => t.status === 'in-progress').length,
      done: done
    };
    const lbc = $('#legend-backlog-count'); if (lbc) lbc.textContent = statusCounts.backlog;
    const ltc = $('#legend-todo-count'); if (ltc) ltc.textContent = statusCounts.todo;
    const lpc = $('#legend-progress-count'); if (lpc) lpc.textContent = statusCounts['in-progress'];
    const ldc = $('#legend-done-count'); if (ldc) ldc.textContent = statusCounts.done;

    // Priority breakdown
    const prioCount = {
      high: state.tasks.filter(t => t.priority === 'high').length,
      medium: state.tasks.filter(t => t.priority === 'medium').length,
      low: state.tasks.filter(t => t.priority === 'low').length
    };
    ['high', 'medium', 'low'].forEach(p => {
      const countEl = $(`#priority-count-${p}`);
      const barEl = $(`#priority-bar-${p}`);
      if (countEl) countEl.textContent = prioCount[p];
      if (barEl) {
        const pct = total > 0 ? (prioCount[p] / total) * 100 : 0;
        barEl.style.width = `${pct}%`;
      }
    });

    // Assignee bar chart
    const chartContainer = $('#assignee-bar-chart');
    if (chartContainer) {
      const maxTasks = Math.max(...state.members.map(m =>
        state.tasks.filter(t => t.assigneeId === m.id).length
      ), 1);

      chartContainer.innerHTML = state.members.map(m => {
        const memberTasks = state.tasks.filter(t => t.assigneeId === m.id);
        const memberDone = memberTasks.filter(t => t.status === 'done').length;
        const memberTotal = memberTasks.length;
        const pct = maxTasks > 0 ? (memberTotal / maxTasks) * 100 : 0;

        return `
          <div class="bar-row">
            <div class="bar-label">
              <div class="mini-avatar" style="background:${m.color}">${escapeHTML(m.avatar)}</div>
              <span>${escapeHTML(m.name)}</span>
            </div>
            <div class="bar-track">
              <div class="bar-fill" style="width:${pct}%"></div>
            </div>
            <span class="bar-value">${memberDone}/${memberTotal}</span>
          </div>`;
      }).join('');
    }
  }

  // Math.clamp polyfill
  Math.clamp = Math.clamp || function(val, min, max) {
    return Math.min(Math.max(val, min), max);
  };

  function animateKPI(selector, target) {
    const el = $(selector);
    if (!el) return;
    el.setAttribute('data-target', target);
    const start = parseInt(el.textContent) || 0;
    if (start === target) { el.textContent = target; return; }

    const duration = 800;
    const startTime = performance.now();

    function step(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease out
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(start + (target - start) * eased);
      el.textContent = current;
      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        el.textContent = target;
      }
    }
    requestAnimationFrame(step);
  }

  // ============================================================
  // 15. TEAM VIEW
  // ============================================================

  function renderTeamView() {
    const container = $('#team-cards-container');
    const countLabel = $('#team-count-label');
    if (!container) return;

    if (countLabel) countLabel.textContent = `${state.members.length} üye`;

    if (state.members.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <i data-lucide="users"></i>
          <p>Henüz ekip üyesi bulunmuyor.</p>
        </div>`;
      lucide.createIcons({ nodes: [container] });
      return;
    }

    container.innerHTML = state.members.map(m => {
      const activeTasks = state.tasks.filter(t => t.assigneeId === m.id && t.status !== 'done').length;
      const doneTasks = state.tasks.filter(t => t.assigneeId === m.id && t.status === 'done').length;

      return `
        <div class="team-card">
          <button class="btn-delete-member ${hasPermission('canManageMembers') ? '' : 'perm-denied'}" data-id="${m.id}" title="Üyeyi Sil">
            <i data-lucide="trash-2"></i>
          </button>
          <div class="team-avatar" style="background:${m.color}">${escapeHTML(m.avatar)}</div>
          <h3 class="team-name">${escapeHTML(m.name)}</h3>
          <p class="team-role">${escapeHTML(m.role || 'Üye')}</p>
          <span class="role-badge role-${m.systemRole || 'member'}">${SYSTEM_ROLE_LABELS[m.systemRole] || 'Üye'}</span>
          <div class="team-stats">
            <div class="team-stat">
              <span class="team-stat-value">${activeTasks}</span>
              <span class="team-stat-label">Aktif</span>
            </div>
            <div class="team-stat">
              <span class="team-stat-value">${doneTasks}</span>
              <span class="team-stat-label">Tamamlanan</span>
            </div>
          </div>
        </div>`;
    }).join('');

    lucide.createIcons({ nodes: [container] });
  }

  // ============================================================
  // 15.5 ROADMAP VIEW
  // ============================================================

  function renderRoadmapView() {
    const container = $('#roadmap-container');
    if (!container) return;
    
    container.innerHTML = '';
    
    const tasks = state.tasks.filter(t => t.status !== 'done');
    if (tasks.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <i data-lucide="map"></i>
          <p>Yol haritasında gösterilecek aktif görev yok.</p>
        </div>`;
      lucide.createIcons({ nodes: [container] });
      return;
    }

    // Timeline Header (Months based on today + 3 months)
    const timeline = document.createElement('div');
    timeline.className = 'roadmap-timeline';
    const today = new Date();
    for (let i = 0; i < 4; i++) {
      const monthDiv = document.createElement('div');
      monthDiv.className = 'roadmap-month';
      const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
      monthDiv.textContent = d.toLocaleString('tr-TR', { month: 'long', year: 'numeric' });
      timeline.appendChild(monthDiv);
    }
    container.appendChild(timeline);

    // Calculate day offset and scale
    const msPerDay = 1000 * 60 * 60 * 24;
    const startDate = new Date(today.getFullYear(), today.getMonth(), 1).getTime();
    const endDate = new Date(today.getFullYear(), today.getMonth() + 4, 0).getTime();
    const totalDays = (endDate - startDate) / msPerDay;

    // Render Rows
    tasks.sort((a, b) => new Date(a.createdDate) - new Date(b.createdDate)).forEach(task => {
      const row = document.createElement('div');
      row.className = 'roadmap-row';

      const taskStart = new Date(task.createdDate).getTime();
      let taskEnd = task.dueDate ? new Date(task.dueDate).getTime() : taskStart + (3 * msPerDay);
      if (taskEnd < taskStart) taskEnd = taskStart + msPerDay;

      let leftPerc = ((taskStart - startDate) / msPerDay) / totalDays * 100;
      let widthPerc = ((taskEnd - taskStart) / msPerDay) / totalDays * 100;

      leftPerc = Math.max(0, Math.min(100, leftPerc));
      if (leftPerc + widthPerc > 100) widthPerc = 100 - leftPerc;

      const bar = document.createElement('div');
      bar.className = 'roadmap-bar';
      if (task.priority === 'high') bar.classList.add('priority-high');
      if (task.status === 'done') bar.classList.add('status-done');
      
      bar.style.left = leftPerc + '%';
      bar.style.width = widthPerc + '%';
      bar.textContent = task.title;
      bar.title = `${task.title} (${formatDateString(task.createdDate)} - ${task.dueDate ? formatDateString(task.dueDate) : 'Belirsiz'})`;

      bar.addEventListener('click', () => openTaskDetailModal(task.id));

      row.appendChild(bar);
      container.appendChild(row);
    });
  }

  // ============================================================
  // 16. TASK DETAIL MODAL
  // ============================================================

  let currentDetailTaskId = null;

  function openTaskDetailModal(taskId) {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task || !modalTaskDetail) return;

    currentDetailTaskId = taskId;

    const canEdit = canEditTask(task);
    const canDelete = hasPermission('canDeleteAnyTask');
    const canComment = hasPermission('canCreateTask');

    // Populate fields
    const detailId = $('#detail-task-id');
    if (detailId) detailId.textContent = task.id;

    const titleDisplay = $('#detail-task-title-display');
    if (titleDisplay) titleDisplay.textContent = task.title;

    const editTitle = $('#edit-title');
    if (editTitle) {
      editTitle.value = task.title || '';
      editTitle.disabled = !canEdit;
    }

    const editDesc = $('#edit-description');
    if (editDesc) {
      editDesc.value = task.description || '';
      editDesc.disabled = !canEdit;
    }

    const editStatus = $('#edit-status');
    if (editStatus) {
      editStatus.value = task.status;
      editStatus.disabled = !canEdit;
    }

    const editPriority = $('#edit-priority');
    if (editPriority) {
      editPriority.value = task.priority;
      editPriority.disabled = !canEdit;
    }

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
    if (editDueDate) {
      editDueDate.value = task.dueDate || '';
      editDueDate.disabled = !canEdit;
    }

    // Label picker
    renderDetailLabelPicker(task);

    // Subtasks
    renderDetailSubtasks(task);

    // Comments
    renderDetailComments(task);

    // Comment author select
    const commentAuthor = $('#comment-author-select');
    if (commentAuthor) {
      commentAuthor.innerHTML = '';
      state.members.forEach(m => {
        commentAuthor.innerHTML += `<option value="${m.id}">${escapeHTML(m.name)}</option>`;
      });
      commentAuthor.value = state.activeUserId || '';
      commentAuthor.disabled = !canComment;
    }

    // Comments input area visibility
    const addCommentBar = $('.add-comment-bar');
    if (addCommentBar) {
      addCommentBar.style.display = canComment ? '' : 'none';
    }

    // Buttons
    const btnSaveDetail = $('#btn-save-task-detail');
    if (btnSaveDetail) {
      btnSaveDetail.disabled = !canEdit;
      btnSaveDetail.classList.toggle('perm-denied', !canEdit);
      btnSaveDetail.title = !canEdit ? 'Bu işlem için yetkiniz yok' : '';
    }

    const btnDuplicateTask = $('#btn-duplicate-task');
    if (btnDuplicateTask) {
      btnDuplicateTask.disabled = !canEdit;
      btnDuplicateTask.classList.toggle('perm-denied', !canEdit);
      btnDuplicateTask.title = !canEdit ? 'Bu işlem için yetkiniz yok' : '';
    }

    const btnDeleteTask = $('#btn-delete-task');
    if (btnDeleteTask) {
      btnDeleteTask.disabled = !canDelete;
      btnDeleteTask.classList.toggle('perm-denied', !canDelete);
      btnDeleteTask.title = !canDelete ? 'Bu işlem için yetkiniz yok' : '';
    }

    modalTaskDetail.showModal();
  }

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
      list.innerHTML = '<p class="subtask-empty">Alt görev bulunmuyor.</p>';
    } else {
      list.innerHTML = task.subtasks.map(sub => `
        <div class="subtask-item">
          <input type="checkbox" class="subtask-checkbox" data-subtask-id="${sub.id}" ${sub.completed ? 'checked' : ''} ${canEdit ? '' : 'disabled'}>
          <span class="${sub.completed ? 'subtask-completed' : ''}">${escapeHTML(sub.title)}</span>
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
            ZenFlowData.save(state);
            renderDetailSubtasks(task);
            updateSidebarStats();
          });
        });
      }
    }

    const subtaskBar = document.querySelector('.add-subtask-bar');
    if (subtaskBar) {
      subtaskBar.style.display = canEdit ? '' : 'none';
    }
  }

  function renderDetailComments(task) {
    const list = $('#detail-comments-list');
    const countEl = $('#detail-comments-count');
    if (!list) return;

    const comments = task.comments || [];
    if (countEl) countEl.textContent = comments.length;

    if (comments.length === 0) {
      list.innerHTML = '<p class="comments-empty">Henüz yorum yok.</p>';
      return;
    }

    list.innerHTML = comments.map(c => {
      const member = getMember(c.memberId);
      return `
        <div class="comment-item">
          <div class="comment-avatar" style="background:${member.color}">${escapeHTML(member.avatar)}</div>
          <div class="comment-body">
            <div class="comment-header">
              <strong>${escapeHTML(member.name)}</strong>
              <span class="comment-time">${getRelativeTime(c.timestamp)}</span>
            </div>
            <p class="comment-text">${escapeHTML(c.text)}</p>
          </div>
        </div>`;
    }).join('');
  }

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
      task.subtasks.push({
        id: generateId(),
        title: input.value.trim(),
        completed: false
      });
      logActivity('alt_görev_eklendi', task.id, input.value.trim());
      input.value = '';
      ZenFlowData.save(state);
      renderDetailSubtasks(task);
      updateSidebarStats();
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
      ZenFlowData.save(state);
      renderDetailComments(task);
    });
  }

  // Save task detail
  const btnSaveDetail = $('#btn-save-task-detail');
  if (btnSaveDetail) {
    btnSaveDetail.addEventListener('click', () => {
      const task = state.tasks.find(t => t.id === currentDetailTaskId);
      if (!task) return;

      pushUndo();

      task.title = ($('#edit-title')?.value || '').trim() || task.title;
      task.description = ($('#edit-description')?.value || '').trim();
      task.status = $('#edit-status')?.value || task.status;
      task.priority = $('#edit-priority')?.value || task.priority;
      task.assigneeId = $('#edit-assignee')?.value || '';
      task.dueDate = $('#edit-due-date')?.value || '';

      // Gather labels from picker
      const picker = $('#detail-label-picker');
      if (picker) {
        task.labels = Array.from(picker.querySelectorAll('.label-picker-item.selected')).map(p => p.dataset.labelId);
      }

      logActivity('görev_güncellendi', task.id, task.title);
      closeModalAnimated(modalTaskDetail);
      saveStateAndRerender();
      showToast(`"${task.title}" güncellendi.`, 'success');
    });
  }

  // Delete task
  const btnDeleteTask = $('#btn-delete-task');
  if (btnDeleteTask) {
    btnDeleteTask.addEventListener('click', () => {
      const task = state.tasks.find(t => t.id === currentDetailTaskId);
      if (!task) return;

      pushUndo();
      const title = task.title;
      state.tasks = state.tasks.filter(t => t.id !== currentDetailTaskId);
      logActivity('görev_silindi', null, title);
      closeModalAnimated(modalTaskDetail);
      saveStateAndRerender();
      showToast(`"${title}" silindi.`, 'warning', performUndo);
    });
  }

  // Duplicate task
  const btnDuplicateTask = $('#btn-duplicate-task');
  if (btnDuplicateTask) {
    btnDuplicateTask.addEventListener('click', () => {
      const task = state.tasks.find(t => t.id === currentDetailTaskId);
      if (!task) return;

      pushUndo();
      const newTask = deepClone(task);
      newTask.id = generateId();
      newTask.title = task.title + ' (Kopya)';
      newTask.comments = [];
      newTask.createdDate = new Date().toISOString();
      state.tasks.push(newTask);
      logActivity('görev_kopyalandı', newTask.id, newTask.title);
      closeModalAnimated(modalTaskDetail);
      saveStateAndRerender();
      showToast(`"${newTask.title}" oluşturuldu.`, 'success');
    });
  }

  // Close detail modal
  const btnCloseDetail = $('#btn-close-detail');
  if (btnCloseDetail) {
    btnCloseDetail.addEventListener('click', () => closeModalAnimated(modalTaskDetail));
  }

  // ============================================================
  // 17. TASK CREATE MODAL
  // ============================================================

  if (btnCreateTask) {
    btnCreateTask.addEventListener('click', openCreateTaskModal);
  }

  function openCreateTaskModal() {
    if (!modalTaskCreate) return;

    const form = $('#form-create-task');
    if (form) form.reset();

    // Populate assignee
    const createAssignee = $('#create-assignee');
    if (createAssignee) {
      createAssignee.innerHTML = '<option value="">Atanmamış</option>';
      state.members.forEach(m => {
        createAssignee.innerHTML += `<option value="${m.id}">${escapeHTML(m.name)}</option>`;
      });
    }

    // Label picker
    const picker = $('#create-label-picker');
    if (picker) {
      picker.innerHTML = state.labels.map(l => `
        <span class="label-picker-item" data-label-id="${l.id}">
          <span class="label-dot" style="background: ${l.color}"></span>
          <span>${escapeHTML(l.name)}</span>
        </span>`
      ).join('');

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

    modalTaskCreate.showModal();
  }

  const formCreateTask = $('#form-create-task');
  if (formCreateTask) {
    formCreateTask.addEventListener('submit', (e) => {
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
      closeModalAnimated(modalTaskCreate);
      saveStateAndRerender();
      showToast(`"${newTask.title}" oluşturuldu.`, 'success');
    });
  }

  // Close / cancel create modal
  const btnCancelCreate = $('#btn-cancel-create');
  if (btnCancelCreate) {
    btnCancelCreate.addEventListener('click', () => closeModalAnimated(modalTaskCreate));
  }
  const btnCloseCreate = $('#btn-close-create');
  if (btnCloseCreate) {
    btnCloseCreate.addEventListener('click', () => closeModalAnimated(modalTaskCreate));
  }

  // ============================================================
  // 18. MEMBER CREATE MODAL
  // ============================================================

  const btnCreateMember = $('#btn-create-member');
  if (btnCreateMember) {
    btnCreateMember.addEventListener('click', () => {
      if (!modalMemberCreate) return;
      const form = $('#form-create-member');
      if (form) form.reset();
      modalMemberCreate.showModal();
    });
  }

  const formCreateMember = $('#form-create-member');
  if (formCreateMember) {
    formCreateMember.addEventListener('submit', (e) => {
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
      closeModalAnimated(modalMemberCreate);
      populateActiveUserSelect();
      saveStateAndRerender();
      showToast(`"${newMember.name}" ekibe eklendi.`, 'success');
    });
  }

  const btnCancelMember = $('#btn-cancel-member');
  if (btnCancelMember) {
    btnCancelMember.addEventListener('click', () => closeModalAnimated(modalMemberCreate));
  }
  const btnCloseMember = $('#btn-close-member');
  if (btnCloseMember) {
    btnCloseMember.addEventListener('click', () => closeModalAnimated(modalMemberCreate));
  }

  // ============================================================
  // 19. MODAL CLOSE WITH ANIMATION
  // ============================================================

  function closeModalAnimated(dialog) {
    if (!dialog || !dialog.open) return;
    const support = dialog.querySelector('.modal-closing-support');
    if (support) {
      support.classList.add('closing');
      setTimeout(() => {
        dialog.close();
        support.classList.remove('closing');
      }, 200);
    } else {
      dialog.close();
    }
  }

  // Handle Escape key for all modals
  [modalTaskDetail, modalTaskCreate, modalMemberCreate, modalOnboarding].forEach(modal => {
    if (!modal) return;
    modal.addEventListener('cancel', (e) => {
      e.preventDefault();
      closeModalAnimated(modal);
    });
  });

  // ============================================================
  // 20. ONBOARDING
  // ============================================================

  function checkOnboarding() {
    if (!state.onboardingDone && modalOnboarding) {
      modalOnboarding.showModal();
    }
  }

  const btnOnboardingStart = $('#btn-onboarding-start');
  if (btnOnboardingStart) {
    btnOnboardingStart.addEventListener('click', () => {
      state.onboardingDone = true;
      ZenFlowData.save(state);
      closeModalAnimated(modalOnboarding);
    });
  }

  const btnOnboardingClean = $('#btn-onboarding-clean');
  if (btnOnboardingClean) {
    btnOnboardingClean.addEventListener('click', () => {
      ZenFlowData.reset();
      state = ZenFlowData.load();
      state.onboardingDone = true;
      state.tasks = [];
      ZenFlowData.save(state);
      closeModalAnimated(modalOnboarding);
      populateActiveUserSelect();
      saveStateAndRerender();
    });
  }

  // ============================================================
  // 21. KEYBOARD SHORTCUTS
  // ============================================================

  document.addEventListener('keydown', (e) => {
    const tag = document.activeElement?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

    switch (e.key) {
      case 'n':
      case 'N':
        openCreateTaskModal();
        break;
      case '1':
        navigateTo('kanban');
        break;
      case '2':
        navigateTo('list');
        break;
      case '3':
        navigateTo('analytics');
        break;
      case '4':
        navigateTo('team');
        break;
      case '5':
        navigateTo('activity');
        break;
      case '6':
        navigateTo('roadmap');
        break;
      case '/':
        e.preventDefault();
        if (globalSearch) globalSearch.focus();
        break;
    }
  });

  // ============================================================
  // 22. EXPORT / IMPORT
  // ============================================================

  if (btnExport) {
    btnExport.addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ogrenciler_net_backup.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Veriler dışa aktarıldı.', 'success');
    });
  }

  if (btnImport) {
    btnImport.addEventListener('click', () => {
      if (importFileInput) importFileInput.click();
    });
  }

  if (importFileInput) {
    importFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const imported = JSON.parse(ev.target.result);
          if (!imported.tasks || !imported.members) {
            showToast('Geçersiz dosya formatı. "tasks" ve "members" alanları gerekli.', 'error');
            return;
          }
          state = imported;
          ZenFlowData.save(state);
          populateActiveUserSelect();
          saveStateAndRerender();
          showToast('Veriler başarıyla içe aktarıldı.', 'success');
        } catch (err) {
          showToast('Dosya okunamadı. Geçerli bir JSON dosyası seçin.', 'error');
        }
      };
      reader.readAsText(file);
      importFileInput.value = '';
    });
  }

  // ============================================================
  // 23. MOBILE HAMBURGER
  // ============================================================

  function closeMobileSidebar() {
    if (sidebar) sidebar.classList.remove('open');
    const overlay = document.querySelector('.sidebar-overlay');
    if (overlay) overlay.remove();
  }

  if (hamburgerToggle) {
    hamburgerToggle.addEventListener('click', () => {
      if (!sidebar) return;

      if (sidebar.classList.contains('open')) {
        closeMobileSidebar();
      } else {
        sidebar.classList.add('open');
        const overlay = document.createElement('div');
        overlay.className = 'sidebar-overlay';
        document.body.appendChild(overlay);
        overlay.addEventListener('click', closeMobileSidebar);
      }
    });
  }

  // ============================================================
  // DELETING MEMBERS
  // ============================================================

  const teamContainer = $('#team-cards-container');
  if (teamContainer) {
    teamContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-delete-member');
      if (!btn) return;
      const memberId = btn.dataset.id;
      if (confirm('Bu üyeyi silmek istediğinize emin misiniz? (Atanan görevler "Atanmamış" olarak görünecektir)')) {
        pushUndo();
        state.members = state.members.filter(m => m.id !== memberId);
        // Remove assignee from tasks assigned to this member
        state.tasks.forEach(t => {
          if (t.assigneeId === memberId) t.assigneeId = '';
        });
        logActivity('üye_silindi', null, 'Bir üye silindi.');
        saveStateAndRerender();
        showToast('Ekip üyesi silindi.', 'info', performUndo);
      }
    });
  }

  // ============================================================
  // REAL-TIME MULTI-TAB SYNC
  // ============================================================

  window.addEventListener('storage', (e) => {
    if (e.key === 'zenflow_state') {
      state = ZenFlowData.load();
      populateActiveUserSelect();
      renderCurrentView();
      updateSidebarStats();
      applyPermissions();
    }
  });

  // ============================================================
  // AUTH: PERMISSION SYSTEM
  // ============================================================

  function currentUser() {
    return state.members.find(m => m.id === state.loggedInUserId) || null;
  }

  function hasPermission(permKey) {
    const user = currentUser();
    if (!user) return false;
    const perms = ROLE_PERMISSIONS[user.systemRole];
    return perms ? perms[permKey] === true : false;
  }

  function canEditTask(task) {
    if (hasPermission('canEditAnyTask')) return true;
    if (!hasPermission('canEditOwnTasksOnly')) return false;
    return task.assigneeId === state.loggedInUserId || task.createdBy === state.loggedInUserId;
  }

  function applyPermissions() {
    // Create Task button
    const btnCreate = $('#btn-create-task');
    if (btnCreate) {
      if (!hasPermission('canCreateTask')) {
        btnCreate.classList.add('perm-denied');
        btnCreate.title = 'Bu işlem için yetkiniz yok';
      } else {
        btnCreate.classList.remove('perm-denied');
        btnCreate.title = '';
      }
    }

    // Create Member button
    const btnMember = $('#btn-create-member');
    if (btnMember) {
      if (!hasPermission('canManageMembers')) {
        btnMember.classList.add('perm-denied');
        btnMember.title = 'Bu işlem için yetkiniz yok';
      } else {
        btnMember.classList.remove('perm-denied');
        btnMember.title = '';
      }
    }

    // Bulk Actions bar — hide for non-admins
    if (bulkActionsBar && !hasPermission('canBulkActions')) {
      bulkActionsBar.classList.add('perm-denied');
    }

    // Export/Import buttons
    if (btnExport && !hasPermission('canExportImport')) {
      btnExport.classList.add('perm-denied');
      btnExport.title = 'Bu işlem için yetkiniz yok';
    } else if (btnExport) {
      btnExport.classList.remove('perm-denied');
    }
    if (btnImport && !hasPermission('canExportImport')) {
      btnImport.classList.add('perm-denied');
      btnImport.title = 'Bu işlem için yetkiniz yok';
    } else if (btnImport) {
      btnImport.classList.remove('perm-denied');
    }

    // Clear activity button
    const btnClearAct = $('#btn-clear-activity');
    if (btnClearAct && !hasPermission('canClearActivity')) {
      btnClearAct.classList.add('perm-denied');
      btnClearAct.title = 'Bu işlem için yetkiniz yok';
    } else if (btnClearAct) {
      btnClearAct.classList.remove('perm-denied');
    }

    // Kanban drag — remove draggable for viewers
    if (!hasPermission('canDragTasks')) {
      document.querySelectorAll('.task-card[draggable]').forEach(card => {
        card.removeAttribute('draggable');
        card.style.cursor = 'default';
      });
    }

    // System role field visibility in member modal
    const sysRoleField = $('#member-system-role');
    if (sysRoleField) {
      const group = sysRoleField.closest('.form-group');
      if (group) group.style.display = hasPermission('canChangeRoles') ? '' : 'none';
    }

    // Update sidebar user info
    const user = currentUser();
    if (user && activeUserSelect) {
      // Set the active user select to the logged-in user for non-admins
      if (!hasPermission('canChangeRoles')) {
        activeUserSelect.value = state.loggedInUserId;
        activeUserSelect.disabled = true;
      } else {
        activeUserSelect.disabled = false;
      }
    }
  }

  // ============================================================
  // AUTH: LOGIN SYSTEM
  // ============================================================

  const loginScreen = $('#login-screen');
  const appContainer = $('#app-container');
  const loginUserSelect = $('#login-user-select');
  const loginPin = $('#login-pin');
  const btnLogin = $('#btn-login');
  const loginError = $('#login-error');
  const btnLogout = $('#btn-logout');

  function populateLoginUsers() {
    if (!loginUserSelect) return;
    loginUserSelect.innerHTML = '';
    state.members.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = `${m.name} (${SYSTEM_ROLE_LABELS[m.systemRole] || 'Üye'})`;
      loginUserSelect.appendChild(opt);
    });
  }

  function showLogin() {
    if (loginScreen) loginScreen.style.display = 'flex';
    if (appContainer) appContainer.style.display = 'none';
    populateLoginUsers();
    if (loginPin) loginPin.value = '';
    if (loginError) loginError.textContent = '';
    lucide.createIcons();
  }

  function showApp() {
    if (loginScreen) loginScreen.style.display = 'none';
    if (appContainer) appContainer.style.display = 'grid';
  }

  function attemptLogin() {
    const userId = loginUserSelect?.value;
    const pin = loginPin?.value || '';
    const member = state.members.find(m => m.id === userId);

    if (!member) {
      if (loginError) loginError.textContent = 'Kullanıcı bulunamadı.';
      return;
    }

    if (member.pin && member.pin !== pin) {
      if (loginError) loginError.textContent = 'PIN kodu hatalı. Tekrar deneyin.';
      const card = document.querySelector('.login-card');
      if (card) {
        card.classList.add('login-shake');
        setTimeout(() => card.classList.remove('login-shake'), 500);
      }
      if (loginPin) { loginPin.value = ''; loginPin.focus(); }
      return;
    }

    // Login successful
    state.loggedInUserId = member.id;
    state.activeUserId = member.id;
    ZenFlowData.save(state);
    sessionStorage.setItem('zenflow_session', member.id);

    showApp();
    init();
  }

  if (btnLogin) {
    btnLogin.addEventListener('click', attemptLogin);
  }
  if (loginPin) {
    loginPin.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') attemptLogin();
    });
  }

  // Logout
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      sessionStorage.removeItem('zenflow_session');
      state.loggedInUserId = null;
      ZenFlowData.save(state);
      showLogin();
    });
  }

  // ============================================================
  // INITIALIZATION — BOOT SEQUENCE
  // ============================================================

  function init() {
    initTheme();
    populateActiveUserSelect();
    populateFilterDropdowns();
    updateSidebarStats();
    handleHash();
    checkOnboarding();
    lucide.createIcons();
    applyPermissions();
  }

  // Check session on load
  const savedSession = sessionStorage.getItem('zenflow_session');
  if (savedSession && state.members.find(m => m.id === savedSession)) {
    state.loggedInUserId = savedSession;
    state.activeUserId = savedSession;
    ZenFlowData.save(state);
    showApp();
    init();
  } else {
    showLogin();
    initTheme();
  }

});
