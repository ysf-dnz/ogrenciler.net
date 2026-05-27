// src/ui/dom.js
// DOM sorgulama yardımcıları — modüller bunu kullanır

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => root.querySelectorAll(sel);

// Lucide icons — yeniden render etmeyi tek noktadan kontrol et
export function refreshIcons(node = null) {
  if (typeof window === 'undefined' || !window.lucide) return;
  if (node) {
    window.lucide.createIcons({ nodes: [node] });
  } else {
    window.lucide.createIcons();
  }
}
