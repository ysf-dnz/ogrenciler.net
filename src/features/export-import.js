// src/features/export-import.js
import { $ } from '../ui/dom.js';
import { state, saveState, replaceState } from '../core/state.js';
import { hasPermission } from '../core/permissions.js';
import { showToast } from '../ui/toast.js';
import { pushUndo } from '../core/undo.js';
import { saveStateAndRerender } from '../router.js';

let onImportComplete = null;

export function setImportCompleteCallback(cb) {
  onImportComplete = cb;
}

export function initExportImport() {
  const btnExport = $('#btn-export-json');
  const btnImport = $('#btn-import-json');
  const fileInput = $('#import-file-input');

  if (btnExport) {
    btnExport.addEventListener('click', () => {
      if (!hasPermission('canExportImport')) {
        showToast('Dışa aktarma yetkiniz yok.', 'error');
        return;
      }
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
      if (!hasPermission('canExportImport')) {
        showToast('İçe aktarma yetkiniz yok.', 'error');
        return;
      }
      if (fileInput) fileInput.click();
    });
  }

  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
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
          pushUndo();
          // Mevcut oturumu koru
          imported.loggedInUserId = state.loggedInUserId;
          replaceState(imported);
          saveState();
          if (onImportComplete) onImportComplete();
          saveStateAndRerender();
          showToast('Veriler başarıyla içe aktarıldı.', 'success');
        } catch (err) {
          showToast('Dosya okunamadı. Geçerli bir JSON dosyası seçin.', 'error');
        }
      };
      reader.readAsText(file);
      fileInput.value = '';
    });
  }
}
