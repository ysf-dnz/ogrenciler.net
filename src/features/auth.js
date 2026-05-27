// src/features/auth.js
import { $ } from '../ui/dom.js';
import { state, saveState } from '../core/state.js';
import { hasPermission, currentUser, SYSTEM_ROLE_LABELS } from '../core/permissions.js';
import { escapeHTML } from '../core/utils.js';
import { refreshIcons } from '../ui/dom.js';

const SESSION_KEY = 'zenflow_session';

let onLoginSuccess = null;

export function setLoginSuccessCallback(cb) {
  onLoginSuccess = cb;
}

function populateLoginUsers() {
  const select = $('#login-user-select');
  if (!select) return;
  select.innerHTML = '';
  state.members.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = `${m.name} (${SYSTEM_ROLE_LABELS[m.systemRole] || 'Üye'})`;
    select.appendChild(opt);
  });
}

export function showLogin() {
  const loginScreen = $('#login-screen');
  const appContainer = $('#app-container');
  if (loginScreen) loginScreen.style.display = 'flex';
  if (appContainer) appContainer.style.display = 'none';
  populateLoginUsers();
  const pin = $('#login-pin');
  const err = $('#login-error');
  if (pin) pin.value = '';
  if (err) err.textContent = '';
  refreshIcons();
}

export function showApp() {
  const loginScreen = $('#login-screen');
  const appContainer = $('#app-container');
  if (loginScreen) loginScreen.style.display = 'none';
  if (appContainer) appContainer.style.display = 'grid';
}

function attemptLogin() {
  const userId = $('#login-user-select')?.value;
  const pin = $('#login-pin')?.value || '';
  const error = $('#login-error');
  const member = state.members.find(m => m.id === userId);

  if (!member) {
    if (error) error.textContent = 'Kullanıcı bulunamadı.';
    return;
  }
  if (member.pin && member.pin !== pin) {
    if (error) error.textContent = 'PIN kodu hatalı. Tekrar deneyin.';
    const card = $('.login-card');
    if (card) {
      card.classList.add('login-shake');
      setTimeout(() => card.classList.remove('login-shake'), 500);
    }
    const pinInput = $('#login-pin');
    if (pinInput) { pinInput.value = ''; pinInput.focus(); }
    return;
  }

  state.loggedInUserId = member.id;
  state.activeUserId = member.id;
  saveState();
  sessionStorage.setItem(SESSION_KEY, member.id);

  showApp();
  if (onLoginSuccess) onLoginSuccess();
}

export function initAuth() {
  const btnLogin = $('#btn-login');
  const pinInput = $('#login-pin');
  const btnLogout = $('#btn-logout');

  if (btnLogin) btnLogin.addEventListener('click', attemptLogin);
  if (pinInput) {
    pinInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') attemptLogin();
    });
  }
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      sessionStorage.removeItem(SESSION_KEY);
      state.loggedInUserId = null;
      saveState();
      showLogin();
    });
  }
}

export function tryRestoreSession() {
  const savedSession = sessionStorage.getItem(SESSION_KEY);
  if (savedSession && state.members.find(m => m.id === savedSession)) {
    state.loggedInUserId = savedSession;
    state.activeUserId = savedSession;
    saveState();
    return true;
  }
  return false;
}

// Permission UI uygulamak — bütün butonlara perm-denied ekle/çıkar
export function applyPermissions() {
  const apply = (id, permKey) => {
    const el = $(`#${id}`);
    if (!el) return;
    const can = hasPermission(permKey);
    el.classList.toggle('perm-denied', !can);
    el.title = !can ? 'Bu işlem için yetkiniz yok' : '';
  };

  apply('btn-create-task', 'canCreateTask');
  apply('btn-create-member', 'canManageMembers');
  apply('btn-export-json', 'canExportImport');
  apply('btn-import-json', 'canExportImport');
  apply('btn-clear-activity', 'canClearActivity');

  // System role field visibility
  const sysRoleField = $('#member-system-role');
  if (sysRoleField) {
    const group = sysRoleField.closest('.form-group');
    if (group) group.style.display = hasPermission('canChangeRoles') ? '' : 'none';
  }

  // Lock active-user select for non-admins
  const activeUserSelect = $('#active-user-select');
  const user = currentUser();
  if (user && activeUserSelect) {
    if (!hasPermission('canChangeRoles')) {
      activeUserSelect.value = state.loggedInUserId;
      activeUserSelect.disabled = true;
    } else {
      activeUserSelect.disabled = false;
    }
  }
}
