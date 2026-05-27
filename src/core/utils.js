// src/core/utils.js
// Saf yardımcı fonksiyonlar (hiçbir DOM/state bağımlılığı yok)

export function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&#39;')
    .replace(/"/g, '&quot;');
}

const TURKISH_MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

export function formatDateString(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return `${d.getDate()} ${TURKISH_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function getRelativeTime(isoString) {
  if (!isoString) return '';
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'Az önce';
  if (diffMin < 60) return `${diffMin} dk önce`;
  if (diffHr < 24) return `${diffHr} sa önce`;
  if (diffDay < 30) return `${diffDay} gün önce`;
  return formatDateString(isoString);
}

export function generateId() {
  return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

export function todayStr() {
  return new Date().toISOString().split('T')[0];
}

export function isOverdue(task) {
  if (!task.dueDate || task.status === 'done') return false;
  return task.dueDate < todayStr();
}

// Math.clamp polyfill — modül yüklenir yüklenmez aktif
if (!Math.clamp) {
  Math.clamp = function(val, min, max) {
    return Math.min(Math.max(val, min), max);
  };
}

// Sabitler
export const STATUS_LABELS = {
  'backlog': 'Beklemede',
  'todo': 'Yapılacak',
  'in-progress': 'Devam Ediyor',
  'done': 'Tamamlandı'
};

export const PRIORITY_LABELS = {
  'high': 'Yüksek',
  'medium': 'Orta',
  'low': 'Düşük'
};

export const MEMBER_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4',
  '#3b82f6', '#a855f7', '#d946ef', '#f59e0b', '#10b981'
];

export const VIEW_META = {
  kanban: { title: 'Kanban Pano', subtitle: 'Ekibinizin iş akışını görselleştirin ve takip edin.' },
  list: { title: 'Görev Listesi', subtitle: 'Arama, filtreleme ve toplu işlemlerle görevler.' },
  analytics: { title: 'Analiz & Rapor', subtitle: 'Proje istatistikleri ve ekip verimliliği analizleri.' },
  team: { title: 'Ekip Üyeleri', subtitle: 'Projedeki aktif katılımcılar ve rol tanımları.' },
  activity: { title: 'Aktivite Geçmişi', subtitle: 'Projenizdeki tüm hareketlerin kronolojik kaydı.' },
  roadmap: { title: 'Yol Haritası', subtitle: 'Görevlerin zaman çizelgesi üzerinde genel görünümü.' }
};
