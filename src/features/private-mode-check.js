// src/features/private-mode-check.js
// Gizli/özel sekme tespiti ve kullanıcı uyarısı

import { showToast } from '../ui/toast.js';

/**
 * localStorage'ın gerçekten çalışıp çalışmadığını test eder.
 * Gizli/özel sekmede Safari/Chrome bazı tarayıcılar localStorage'ı
 * ya tamamen bloklar ya da sıfır kapasiteyle çalıştırır.
 */
export function checkPrivateMode() {
  const TEST_KEY = '__ogrenciler_test__';
  try {
    localStorage.setItem(TEST_KEY, '1');
    const val = localStorage.getItem(TEST_KEY);
    localStorage.removeItem(TEST_KEY);
    if (val !== '1') throw new Error('write-verify failed');
    // localStorage çalışıyor — normal sekme
    return false;
  } catch (e) {
    return true; // Gizli sekme veya depolama engellenmiş
  }
}

/**
 * Boot sırasında çağrılır. Eğer gizli sekme tespit edilirse
 * login ekranı gözükene kadar bekler, ardından uyarı gösterir.
 */
export function initPrivateModeWarning() {
  if (!checkPrivateMode()) return;

  // Login ekranı DOM'a yerleştikten sonra uyarıyı göster
  const showWarning = () => {
    // Ekrana sabit bir banner yerleştir
    const existing = document.getElementById('private-mode-banner');
    if (existing) return;

    const banner = document.createElement('div');
    banner.id = 'private-mode-banner';
    banner.innerHTML = `
      <span class="pmb-icon">⚠️</span>
      <span class="pmb-text">
        <strong>Gizli Sekme</strong> — Veriler bu oturumda kaydedilemez.
        Normal sekmede açın veya veritabanını dışa aktarın.
      </span>
      <button class="pmb-close" type="button" aria-label="Kapat">✕</button>
    `;

    document.body.appendChild(banner);

    banner.querySelector('.pmb-close').addEventListener('click', () => {
      banner.classList.add('pmb-hiding');
      setTimeout(() => banner.remove(), 300);
    });
  };

  // DOM hazırsa hemen göster, değilse biraz bekle
  if (document.readyState === 'complete') {
    showWarning();
  } else {
    window.addEventListener('load', showWarning);
  }
}
