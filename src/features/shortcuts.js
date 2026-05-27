// src/features/shortcuts.js
import { navigateTo } from '../router.js';
import { focusSearch } from '../ui/search.js';
import { isAnyModalOpen } from '../ui/modal.js';
import { $ } from '../ui/dom.js';
import { hasPermission } from '../core/permissions.js';
import { openCreateTaskModal } from './task-create.js';

export function initShortcuts() {
  document.addEventListener('keydown', (e) => {
    const tag = document.activeElement?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

    const modals = [
      $('#modal-task-detail'),
      $('#modal-task-create'),
      $('#modal-member-create'),
      $('#modal-onboarding')
    ];
    if (isAnyModalOpen(modals) && e.key !== 'Escape') return;

    switch (e.key) {
      case 'n':
      case 'N':
        if (hasPermission('canCreateTask')) openCreateTaskModal();
        break;
      case '1': navigateTo('kanban'); break;
      case '2': navigateTo('list'); break;
      case '3': navigateTo('analytics'); break;
      case '4': navigateTo('team'); break;
      case '5': navigateTo('activity'); break;
      case '6': navigateTo('roadmap'); break;
      case '/':
        e.preventDefault();
        focusSearch();
        break;
    }
  });
}
