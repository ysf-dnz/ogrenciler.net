// src/ui/modal.js

export function closeModalAnimated(dialog) {
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

// Tüm modallar için Escape handler'ını tek seferde bağla
export function attachModalEscapeHandlers(modals) {
  modals.forEach(modal => {
    if (!modal) return;
    modal.addEventListener('cancel', (e) => {
      e.preventDefault();
      closeModalAnimated(modal);
    });
  });
}

// Açık olan herhangi bir modal var mı?
export function isAnyModalOpen(modals) {
  return modals.some(m => m && m.open);
}
