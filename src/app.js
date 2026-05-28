bash

cat /tmp/ogrenciler.net-edited/src/app.js
Output

// src/app.js — Bootstrap
// Tüm modülleri başlatır, render fonksiyonlarını router'a kayıt eder,
// ve modüller arası callback iletişimini kurar.

import { state, saveState, reloadStateFromStorage } from './core/state.js';
import { escapeHTML } from './core/utils.js';

import { $ } from './ui/dom.js';
import { refreshIcons } from './ui/dom.js';
import { initTheme, initThemeToggle } from './ui/theme.js';
import { initGlobalSearch } from './ui/search.js';
import { attachModalEscapeHandlers } from './ui/modal.js';

import {
  initRouter,
  handleHash,
  navigateTo,
  registerView,
  renderCurrentView,
  updateSidebarStats,
  setAfterSaveCallback,
  setNavigationCallback
} from './router.js';

// Views
import { renderKanbanBoard, initKanbanInteractions, setKanbanTaskClickHandler } from './views/kanban.js';
import { renderListView, initListInteractions, populateFilterDropdowns, setListRowClickHandler } from './views/list.js';
import { renderAnalyticsView } from './views/analytics.js';
import { renderTeamView, initTeamInteractions, setMemberChangeCallback } from './views/team.js';
import { renderActivityView, initActivityInteractions } from './views/activity.js';
import { renderRoadmapView, setRoadmapBarClickHandler } from './views/roadmap.js';

// Features
import { initAuth, tryRestoreSession, showLogin, showApp, applyPermissions, setLoginSuccessCallback } from './features/auth.js';
import { openTaskDetailModal, initTaskDetailModal } from './features/task-modal.js';
import { initTaskCreate } from './features/task-create.js';
import { initMemberCreate, setMemberAddedCallback } from './features/member-create.js';
import { initOnboarding, checkOnboarding, setResetCompleteCallback } from './features/onboarding.js';
import { initShortcuts } from './features/shortcuts.js';
import { initExportImport, setImportCompleteCallback } from './features/export-import.js';
import { initMobileNav, closeMobileSidebar } from './features/mobile-nav.js';
import { initLabelManager } from './features/label-manager.js';

// -------- Aktif kullanıcı seçici (sidebar) --------
function populateActiveUserSelect() {
  const select = $('#active-user-select');
  if (!select) return;
  select.innerHTML = '';
  state.members.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = m.name;
    select.appendChild(opt);
  });
  select.value = state.activeUserId || '';
}

function initActiveUserSelect() {
  const select = $('#active-user-select');
  if (!select) return;
  select.addEventListener('change', () => {
    state.activeUserId = select.value;
    saveState();
    afterSave();
    renderCurrentView();
  });
}

// -------- Multi-tab senkronizasyon --------
function initMultiTabSync() {
  window.addEventListener('storage', (e) => {
    if (e.key === 'zenflow_state') {
      reloadStateFromStorage();
      populateActiveUserSelect();
      renderCurrentView();
      updateSidebarStats(state);
      applyPermissions();
    }
  });
}

// -------- Render kayıtları --------
function registerAllViews() {
  registerView('kanban', renderKanbanBoard);
  registerView('list', () => { populateFilterDropdowns(); renderListView(); });
  registerView('analytics', renderAnalyticsView);
  registerView('team', renderTeamView);
  registerView('activity', renderActivityView);
  registerView('roadmap', renderRoadmapView);
}

// -------- Tüm state değişikliklerinden sonra çalışan callback --------
function afterSave() {
  updateSidebarStats(state);
  populateFilterDropdowns();
  applyPermissions();
}

// -------- Modüller arası inter-callback'ler --------
function wireCallbacks() {
  setAfterSaveCallback(afterSave);

  // Mobil sidebar nav sonrası kapansın
  setNavigationCallback((view) => {
    const sidebar = $('#sidebar');
    if (sidebar && sidebar.classList.contains('open')) closeMobileSidebar();
  });

  // View'lardan task click → detail modal aç
  setKanbanTaskClickHandler(openTaskDetailModal);
  setListRowClickHandler(openTaskDetailModal);
  setRoadmapBarClickHandler(openTaskDetailModal);

  // Üye eklenip / silinince sidebar select güncellensin
  setMemberAddedCallback(populateActiveUserSelect);
  setMemberChangeCallback(populateActiveUserSelect);

  // İçe aktarma sonrası aktif kullanıcı seçici güncellensin
  setImportCompleteCallback(populateActiveUserSelect);

  // Onboarding reset sonrası temizle
  setResetCompleteCallback(() => {
    populateActiveUserSelect();
    afterSave();
    renderCurrentView();
  });

  // Login başarılı olunca init
  setLoginSuccessCallback(init);

  // Arama değişince mevcut view'ı yeniden render et
  initGlobalSearch(renderCurrentView);
}

// -------- Init (login sonrası) --------
function init() {
  initTheme();
  populateActiveUserSelect();
  populateFilterDropdowns();
  updateSidebarStats(state);
  handleHash();
  checkOnboarding();
  refreshIcons();
  applyPermissions();
}

// -------- Boot --------
function boot() {
  // Tema (login ekranında da geçerli)
  initTheme();
  initThemeToggle();

  // Modal cancel handler'ları
  attachModalEscapeHandlers([
    $('#modal-task-detail'),
    $('#modal-task-create'),
    $('#modal-member-create'),
    $('#modal-onboarding'),
    $('#modal-label-manager')
  ]);

  // Tüm modülleri başlat (event listener bağlamak için)
  initRouter();
  registerAllViews();
  initKanbanInteractions();
  initListInteractions();
  initTeamInteractions();
  initActivityInteractions();
  initTaskDetailModal();
  initTaskCreate();
  initMemberCreate();
  initOnboarding();
  initShortcuts();
  initExportImport();
  initMobileNav();
  initLabelManager();
  initActiveUserSelect();
  initAuth();
  initMultiTabSync();

  // Modüller arası bağlantılar
  wireCallbacks();

  // Session restore veya login göster
  if (tryRestoreSession()) {
    showApp();
    init();
  } else {
    showLogin();
  }
}

// DOM hazır olunca başlat
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
