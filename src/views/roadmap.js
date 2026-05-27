// src/views/roadmap.js
import { $, refreshIcons } from '../ui/dom.js';
import { state } from '../core/state.js';
import { formatDateString } from '../core/utils.js';

let onBarClick = null;

export function setRoadmapBarClickHandler(handler) {
  onBarClick = handler;
}

export function renderRoadmapView() {
  const container = $('#roadmap-container');
  if (!container) return;

  container.innerHTML = '';

  const tasks = state.tasks.filter(t => t.status !== 'done');
  if (tasks.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i data-lucide="map" class="empty-state-icon"></i>
        <p class="empty-state-title">Yol haritasında gösterilecek aktif görev yok.</p>
      </div>`;
    refreshIcons(container);
    return;
  }

  const timeline = document.createElement('div');
  timeline.className = 'roadmap-timeline';
  const today = new Date();
  for (let i = 0; i < 4; i++) {
    const monthDiv = document.createElement('div');
    monthDiv.className = 'roadmap-month';
    const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
    monthDiv.textContent = d.toLocaleString('tr-TR', { month: 'long', year: 'numeric' });
    timeline.appendChild(monthDiv);
  }
  container.appendChild(timeline);

  const msPerDay = 1000 * 60 * 60 * 24;
  const startDate = new Date(today.getFullYear(), today.getMonth(), 1).getTime();
  const endDate = new Date(today.getFullYear(), today.getMonth() + 4, 0).getTime();
  const totalDays = (endDate - startDate) / msPerDay;

  tasks.sort((a, b) => new Date(a.createdDate) - new Date(b.createdDate)).forEach(task => {
    const row = document.createElement('div');
    row.className = 'roadmap-row';

    const taskStart = new Date(task.createdDate).getTime();
    let taskEnd = task.dueDate ? new Date(task.dueDate).getTime() : taskStart + (3 * msPerDay);
    if (taskEnd < taskStart) taskEnd = taskStart + msPerDay;

    let leftPerc = ((taskStart - startDate) / msPerDay) / totalDays * 100;
    let widthPerc = ((taskEnd - taskStart) / msPerDay) / totalDays * 100;

    leftPerc = Math.max(0, Math.min(100, leftPerc));
    if (leftPerc + widthPerc > 100) widthPerc = 100 - leftPerc;
    if (widthPerc < 5) widthPerc = 5;

    const bar = document.createElement('div');
    bar.className = 'roadmap-bar';
    if (task.priority === 'high') bar.classList.add('priority-high');
    if (task.status === 'done') bar.classList.add('status-done');

    bar.style.left = leftPerc + '%';
    bar.style.width = widthPerc + '%';
    bar.textContent = task.title;
    bar.title = `${task.title} (${formatDateString(task.createdDate)} - ${task.dueDate ? formatDateString(task.dueDate) : 'Belirsiz'})`;

    bar.addEventListener('click', () => {
      if (onBarClick) onBarClick(task.id);
    });

    row.appendChild(bar);
    container.appendChild(row);
  });
}
