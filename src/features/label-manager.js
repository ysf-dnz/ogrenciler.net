// src/features/label-manager.js
// Etiket yönetimi: oluşturma, düzenleme, silme.
// state.labels dizisini mutate eder ve saveStateAndRerender() çağırır.

import { $ } from '../ui/dom.js';
import { state } from '../core/state.js';
import { generateId, escapeHTML } from '../core/utils.js';
import { hasPermission } from '../core/permissions.js';
import { showToast } from '../ui/toast.js';
import { closeModalAnimated } from '../ui/modal.js';
import { saveStateAndRerender } from '../router.js';
import { refreshIcons } from '../ui/dom.js';

// ---- CRUD işlemleri ----

export function addLabel(name, color) {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const newLabel = { id: generateId(), name: trimmed, color };
  state.labels.push(newLabel);
  saveStateAndRerender();
  return newLabel;
}

export function updateLabel(id, { name, color }) {
  const label = state.labels.find(l => l.id === id);
  if (!label) return false;
  if (name !== undefined) label.name = name.trim() || label.name;
  if (color !== undefined) label.color = color;
  saveStateAndRerender();
  return true;
}

export function deleteLabel(id) {
  const idx = state.labels.findIndex(l => l.id === id);
  if (idx === -1) return false;
  state.labels.splice(idx, 1);
  // Tüm görevlerdeki bu etikete ait referansları temizle
  state.tasks.forEach(t => {
    if (Array.isArray(t.labels)) {
      t.labels = t.labels.filter(lid => lid !== id);
    }
  });
  saveStateAndRerender();
  return true;
}

// ---- Modal render ----

function renderLabelList() {
  const list = $('#label-manager-list');
  if (!list) return;
  const canManage = hasPermission('canManageMembers'); // admin yetkisi

  if (state.labels.length === 0) {
    list.innerHTML = '<p style="color:var(--text-muted);font-size:13px;padding:8px 0;">Henüz etiket yok.</p>';
    return;
  }

  list.innerHTML = state.labels.map(l => `
    <div class="label-manager-row" data-label-id="${l.id}">
      <span class="label-color-swatch" style="background:${l.color};" title="${escapeHTML(l.color)}"></span>
      <input
        type="text"
        class="form-input form-input-sm label-name-input"
        value="${escapeHTML(l.name)}"
        data-label-id="${l.id}"
        ${canManage ? '' : 'disabled'}
        style="flex:1;"
      >
      <input
        type="color"
        class="label-color-input"
        value="${l.color}"
        data-label-id="${l.id}"
        ${canManage ? '' : 'disabled'}
        title="Rengi değiştir"
      >
      ${canManage ? `
        <button class="btn-ghost btn-sm btn-label-save" data-label-id="${l.id}" title="Kaydet" type="button">
          <i data-lucide="check"></i>
        </button>
        <button class="btn-ghost btn-sm btn-label-delete" data-label-id="${l.id}" title="Sil" type="button" style="color:var(--danger);">
          <i data-lucide="trash-2"></i>
        </button>
      ` : ''}
    </div>
  `).join('');

  refreshIcons(list);

  // Kaydet butonları
  list.querySelectorAll('.btn-label-save').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.labelId;
      const nameInput = list.querySelector(`.label-name-input[data-label-id="${id}"]`);
      const colorInput = list.querySelector(`.label-color-input[data-label-id="${id}"]`);
      const ok = updateLabel(id, {
        name: nameInput?.value || '',
        color: colorInput?.value || '#8b5cf6'
      });
      if (ok) {
        showToast('Etiket güncellendi.', 'success');
        renderLabelList();
      }
    });
  });

  // Silme butonları
  list.querySelectorAll('.btn-label-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.labelId;
      const label = state.labels.find(l => l.id === id);
      const usedIn = state.tasks.filter(t => t.labels?.includes(id)).length;
      const msg = usedIn > 0
        ? `"${label?.name}" etiketi ${usedIn} görevde kullanılıyor. Silmek istediğinize emin misiniz?`
        : `"${label?.name}" etiketini silmek istiyor musunuz?`;
      if (!confirm(msg)) return;
      deleteLabel(id);
      showToast('Etiket silindi.', 'info');
      renderLabelList();
    });
  });

  // Renk değişince swatch'ı anlık güncelle
  list.querySelectorAll('.label-color-input').forEach(input => {
    input.addEventListener('input', () => {
      const swatch = input.closest('.label-manager-row')?.querySelector('.label-color-swatch');
      if (swatch) swatch.style.background = input.value;
    });
  });
}

// ---- Modal init ----

export function initLabelManager() {
  const modal = $('#modal-label-manager');
  const btnOpen = $('#btn-manage-labels');
  const btnClose = $('#btn-close-label-manager');
  const btnAdd = $('#btn-add-label');
  const nameInput = $('#new-label-name');
  const colorInput = $('#new-label-color');

  if (btnOpen) {
    btnOpen.addEventListener('click', () => {
      if (!hasPermission('canManageMembers')) {
        showToast('Etiket yönetimi için admin yetkisi gerekli.', 'error');
        return;
      }
      renderLabelList();
      modal?.showModal();
    });
  }

  if (btnClose) {
    btnClose.addEventListener('click', () => closeModalAnimated(modal));
  }

  if (btnAdd) {
    btnAdd.addEventListener('click', () => {
      const name = nameInput?.value?.trim();
      if (!name) {
        showToast('Etiket adı boş olamaz.', 'error');
        return;
      }
      const color = colorInput?.value || '#8b5cf6';
      addLabel(name, color);
      showToast(`"${name}" etiketi eklendi.`, 'success');
      if (nameInput) nameInput.value = '';
      if (colorInput) colorInput.value = '#8b5cf6';
      renderLabelList();
    });
  }

  // Enter ile de ekleme
  if (nameInput) {
    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        btnAdd?.click();
      }
    });
  }
}
