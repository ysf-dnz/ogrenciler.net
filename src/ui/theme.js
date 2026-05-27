// src/ui/theme.js
import { $ } from './dom.js';

const THEME_KEY = 'zenflow_theme';

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const themeText = $('#theme-toggle .theme-text');
  if (themeText) {
    themeText.textContent = theme === 'dark' ? 'Açık Tema' : 'Koyu Tema';
  }
  localStorage.setItem(THEME_KEY, theme);
}

export function initTheme() {
  const saved = localStorage.getItem(THEME_KEY) || 'dark';
  applyTheme(saved);
}

export function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

export function initThemeToggle() {
  const btn = $('#theme-toggle');
  if (btn) btn.addEventListener('click', toggleTheme);
}
