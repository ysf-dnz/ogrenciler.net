// src/features/mobile-nav.js
import { $ } from '../ui/dom.js';

export function closeMobileSidebar() {
  const sidebar = $('#sidebar');
  if (sidebar) sidebar.classList.remove('open');
  const overlay = document.querySelector('.sidebar-overlay');
  if (overlay) {
    overlay.classList.remove('active');
    setTimeout(() => overlay.remove(), 200);
  }
}

export function initMobileNav() {
  const sidebar = $('#sidebar');
  const btn = $('#hamburger-toggle');
  if (!btn) return;

  btn.addEventListener('click', () => {
    if (!sidebar) return;
    if (sidebar.classList.contains('open')) {
      closeMobileSidebar();
    } else {
      sidebar.classList.add('open');
      let overlay = document.querySelector('.sidebar-overlay');
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'sidebar-overlay';
        document.body.appendChild(overlay);
        overlay.addEventListener('click', closeMobileSidebar);
      }
      // smooth fade-in
      requestAnimationFrame(() => overlay.classList.add('active'));
    }
  });
}
