// src/views/analytics.js
import { $ } from '../ui/dom.js';
import { state } from '../core/state.js';
import { escapeHTML, todayStr } from '../core/utils.js';

function animateKPI(selector, target, suffix = '') {
  const el = $(selector);
  if (!el) return;
  el.setAttribute('data-target', target);
  const start = parseInt(el.textContent) || 0;
  if (start === target) { el.textContent = target + suffix; return; }

  const duration = 800;
  const startTime = performance.now();

  function step(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(start + (target - start) * eased);
    el.textContent = current + suffix;
    if (progress < 1) requestAnimationFrame(step);
    else el.textContent = target + suffix;
  }
  requestAnimationFrame(step);
}

export function renderAnalyticsView() {
  const total = state.tasks.length;
  const done = state.tasks.filter(t => t.status === 'done').length;
  const active = state.tasks.filter(t => t.status === 'in-progress').length;
  const rate = total > 0 ? Math.round((done / total) * 100) : 0;

  const today = todayStr();
  const doneOnTime = state.tasks.filter(t => {
    if (t.status !== 'done') return false;
    if (!t.dueDate) return true;
    return t.dueDate >= today;
  }).length;
  const velocity = done > 0 ? Math.clamp(Math.round((doneOnTime / done) * 100), 0, 100) : 0;

  animateKPI('#kpi-total-tasks', total);
  animateKPI('#kpi-active-tasks', active);
  animateKPI('#kpi-completion-rate', rate, '%');
  animateKPI('#kpi-velocity', velocity);

  // Radial ring
  const circumference = 2 * Math.PI * 80;
  const offset = circumference - (rate / 100) * circumference;
  const ring = $('#analytics-ring');
  if (ring) {
    ring.style.strokeDasharray = circumference;
    ring.style.strokeDashoffset = offset;
  }
  const pctEl = $('#analytics-percentage');
  if (pctEl) pctEl.textContent = `${rate}%`;

  // Legend counts
  const counts = {
    backlog: state.tasks.filter(t => t.status === 'backlog').length,
    todo: state.tasks.filter(t => t.status === 'todo').length,
    'in-progress': state.tasks.filter(t => t.status === 'in-progress').length,
    done
  };
  const setText = (id, val) => { const el = $(id); if (el) el.textContent = val; };
  setText('#legend-backlog-count', counts.backlog);
  setText('#legend-todo-count', counts.todo);
  setText('#legend-progress-count', counts['in-progress']);
  setText('#legend-done-count', counts.done);

  // Priority bars
  const prioCount = {
    high: state.tasks.filter(t => t.priority === 'high').length,
    medium: state.tasks.filter(t => t.priority === 'medium').length,
    low: state.tasks.filter(t => t.priority === 'low').length
  };
  ['high', 'medium', 'low'].forEach(p => {
    setText(`#priority-count-${p}`, prioCount[p]);
    const bar = $(`#priority-bar-${p}`);
    if (bar) {
      const pct = total > 0 ? (prioCount[p] / total) * 100 : 0;
      bar.style.width = `${pct}%`;
    }
  });

  // Assignee bar chart
  const chartContainer = $('#assignee-bar-chart');
  if (chartContainer) {
    const maxTasks = Math.max(...state.members.map(m =>
      state.tasks.filter(t => t.assigneeId === m.id).length
    ), 1);

    chartContainer.innerHTML = state.members.map(m => {
      const memberTasks = state.tasks.filter(t => t.assigneeId === m.id);
      const memberDone = memberTasks.filter(t => t.status === 'done').length;
      const memberTotal = memberTasks.length;
      const pct = maxTasks > 0 ? (memberTotal / maxTasks) * 100 : 0;

      return `
        <div class="chart-bar-row">
          <div class="avatar-badge" style="background:${m.color}">${escapeHTML(m.avatar)}</div>
          <div class="bar-wrapper">
            <div class="bar-info">
              <span>${escapeHTML(m.name)}</span>
              <span>${memberDone}/${memberTotal}</span>
            </div>
            <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
          </div>
        </div>`;
    }).join('');
  }
}
