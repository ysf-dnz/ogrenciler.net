// src/ui/toast.js
import { $, refreshIcons } from './dom.js';
import { escapeHTML } from '../core/utils.js';

const ICON_MAP = {
  success: 'check-circle',
  error: 'alert-circle',
  info: 'info',
  warning: 'alert-triangle'
};

export function showToast(message, type = 'info', undoCallback = null, duration = 4000) {
  const container = $('#toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.innerHTML = `
    <i data-lucide="${ICON_MAP[type] || 'info'}" class="toast-icon"></i>
    <span class="toast-message">${escapeHTML(message)}</span>
    ${undoCallback ? '<button class="toast-undo" type="button">Geri Al</button>' : ''}
    <button class="toast-close" type="button" aria-label="Kapat"><i data-lucide="x"></i></button>
  `;

  container.appendChild(toast);
  refreshIcons(toast);

  const removeToast = () => {
    toast.classList.add('toast-removing');
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 300);
  };

  if (undoCallback) {
    const undoBtn = toast.querySelector('.toast-undo');
    undoBtn.addEventListener('click', () => {
      undoCallback();
      removeToast();
    });
  }

  toast.querySelector('.toast-close').addEventListener('click', removeToast);

  setTimeout(removeToast, duration);
}
