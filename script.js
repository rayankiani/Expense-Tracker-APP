'use strict';

// ===== STATE =====
let transactions = JSON.parse(localStorage.getItem('aurum_transactions') || '[]');
let activeSection = 'dashboard';
let filterType = 'all';
let filterCat = 'all';
let editingId = null;

const CATEGORY_ICONS = {
  food: '🍜', transport: '🚌', shopping: '🛍',
  bills: '⚡', entertainment: '🎬', other: '📦'
};
const CATEGORY_COLORS = {
  food: '#e8b84b', transport: '#5b8dee', shopping: '#cf72b5',
  bills: '#e05c6b', entertainment: '#9b72cf', other: '#4caf7d'
};

// ===== DOM REFS =====
const $ = id => document.getElementById(id);
const sections = {
  dashboard: $('section-dashboard'),
  transactions: $('section-transactions'),
  add: $('section-add'),
  analytics: $('section-analytics')
};

// ===== NAVIGATION =====
function navigateTo(section) {
  if (!sections[section]) return;
  Object.values(sections).forEach(s => s.classList.remove('active'));
  sections[section].classList.add('active');
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.section === section);
  });
  activeSection = section;
  closeSidebar();

  if (section === 'dashboard') renderDashboard();
  if (section === 'transactions') renderTransactions();
  if (section === 'analytics') renderAnalytics();
}

document.querySelectorAll('[data-section]').forEach(el => {
  el.addEventListener('click', e => {
    e.preventDefault();
    navigateTo(el.dataset.section);
  });
});

// ===== SIDEBAR MOBILE =====
const sidebar = $('sidebar');
const overlay = $('overlay');
const hamburger = $('hamburger');

function openSidebar() {
  sidebar.classList.add('open');
  overlay.classList.add('visible');
  hamburger.classList.add('open');
}
function closeSidebar() {
  sidebar.classList.remove('open');
  overlay.classList.remove('visible');
  hamburger.classList.remove('open');
}
hamburger.addEventListener('click', () => sidebar.classList.contains('open') ? closeSidebar() : openSidebar());
$('sidebarClose').addEventListener('click', closeSidebar);
overlay.addEventListener('click', closeSidebar);

// ===== THEME =====
function applyTheme(dark) {
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  $('themeToggle').checked = dark;
  $('themeToggleMobile').checked = dark;
  localStorage.setItem('aurum_theme', dark ? 'dark' : 'light');
}
const savedTheme = localStorage.getItem('aurum_theme');
applyTheme(savedTheme !== 'light');
$('themeToggle').addEventListener('change', e => applyTheme(e.target.checked));
$('themeToggleMobile').addEventListener('change', e => applyTheme(e.target.checked));

// ===== DATE =====
function formatDate(isoStr) {
  const d = new Date(isoStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function todayISO() {
  return new Date().toISOString().split('T')[0];
}
function monthISO(date) {
  const d = date || new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Update header date
const headerDate = $('headerDate');
if (headerDate) {
  const now = new Date();
  headerDate.textContent = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

// ===== SAVE =====
function save() {
  localStorage.setItem('aurum_transactions', JSON.stringify(transactions));
}

// ===== HELPERS =====
function fmt(n) {
  return 'PKR ' + Math.abs(n).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtCompact(n) {
  return n >= 1000 ? `PKR ${(n / 1000).toFixed(1)}k` : `PKR ${n.toFixed(0)}`;
}
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// ===== DASHBOARD =====
function renderDashboard() {
  const income = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expenses = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const balance = income - expenses;

  $('totalBalance').textContent = fmt(balance);
  $('totalIncome').textContent = fmt(income);
  $('totalExpenses').textContent = fmt(expenses);

  const thisMonth = monthISO();
  const monthlyExp = transactions
    .filter(t => t.type === 'expense' && t.date.startsWith(thisMonth))
    .reduce((s, t) => s + t.amount, 0);
  $('monthlySpend').textContent = fmt(monthlyExp);
  $('txCount').textContent = transactions.length;

  // Top category
  const catTotals = {};
  transactions.filter(t => t.type === 'expense').forEach(t => {
    catTotals[t.category] = (catTotals[t.category] || 0) + t.amount;
  });
  const topCat = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0];
  $('topCategory').textContent = topCat ? (CATEGORY_ICONS[topCat[0]] + ' ' + capitalize(topCat[0])) : '—';

  // Avg daily
  const days = new Set(transactions.filter(t => t.type === 'expense').map(t => t.date)).size;
  $('avgDaily').textContent = days > 0 ? fmt(expenses / days) : 'PKR 0.00';

  // Recent 5
  const recent = [...transactions].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt).slice(0, 5);
  const recentList = $('recentList');
  const recentEmpty = $('recentEmpty');
  if (recent.length === 0) {
    recentList.innerHTML = '';
    recentEmpty.classList.remove('hidden');
  } else {
    recentEmpty.classList.add('hidden');
    recentList.innerHTML = recent.map(t => buildTxHTML(t, false)).join('');
    recentList.querySelectorAll('.tx-btn.delete').forEach(btn => {
      btn.addEventListener('click', () => deleteTx(btn.dataset.id, true));
    });
    recentList.querySelectorAll('.tx-btn.edit').forEach(btn => {
      btn.addEventListener('click', () => startEdit(btn.dataset.id));
    });
  }
}

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

// ===== BUILD TX HTML =====
function buildTxHTML(t, withAnim = true) {
  return `<div class="tx-item${withAnim ? '' : ''}" data-id="${t.id}">
    <div class="tx-icon">${CATEGORY_ICONS[t.category] || '📦'}</div>
    <div class="tx-info">
      <div class="tx-title">${escapeHTML(t.title)}</div>
      <div class="tx-meta">
        <span>${formatDate(t.date)}</span>
        <span class="tx-cat-badge">${capitalize(t.category)}</span>
        ${t.notes ? `<span>${escapeHTML(t.notes.substring(0, 30))}${t.notes.length > 30 ? '…' : ''}</span>` : ''}
      </div>
    </div>
    <div class="tx-amount ${t.type}">${fmt(t.amount)}</div>
    <div class="tx-actions">
      <button class="tx-btn edit" data-id="${t.id}" title="Edit">✏</button>
      <button class="tx-btn delete" data-id="${t.id}" title="Delete">✕</button>
    </div>
  </div>`;
}

function escapeHTML(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ===== TRANSACTIONS PAGE =====
function getFilteredTx() {
  const query = ($('searchInput').value || '').trim().toLowerCase();
  const from = $('filterDateFrom').value;
  const to = $('filterDateTo').value;
  return transactions.filter(t => {
    if (filterType !== 'all' && t.type !== filterType) return false;
    if (filterCat !== 'all' && t.category !== filterCat) return false;
    if (query && !t.title.toLowerCase().includes(query) && !t.notes?.toLowerCase().includes(query)) return false;
    if (from && t.date < from) return false;
    if (to && t.date > to) return false;
    return true;
  }).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
}

function renderTransactions() {
  const filtered = getFilteredTx();
  const list = $('txList');
  const empty = $('emptyState');
  if (filtered.length === 0) {
    list.innerHTML = '';
    empty.classList.remove('hidden');
  } else {
    empty.classList.add('hidden');
    list.innerHTML = filtered.map(t => buildTxHTML(t)).join('');
    list.querySelectorAll('.tx-btn.delete').forEach(btn => {
      btn.addEventListener('click', () => deleteTx(btn.dataset.id, false));
    });
    list.querySelectorAll('.tx-btn.edit').forEach(btn => {
      btn.addEventListener('click', () => startEdit(btn.dataset.id));
    });
  }
}

// Filter pills
document.querySelectorAll('[data-filter]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    filterType = btn.dataset.filter;
    renderTransactions();
  });
});
document.querySelectorAll('[data-cat]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-cat]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    filterCat = btn.dataset.cat;
    renderTransactions();
  });
});
$('searchInput').addEventListener('input', renderTransactions);
$('filterDateFrom').addEventListener('change', renderTransactions);
$('filterDateTo').addEventListener('change', renderTransactions);

// ===== ADD / EDIT =====
let currentType = 'expense';
document.querySelectorAll('.type-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentType = btn.dataset.type;
  });
});

// Set today's date by default
$('txDate').value = todayISO();

$('submitBtn').addEventListener('click', e => {
  rippleEffect(e, $('submitBtn'));
  submitTransaction();
});
$('cancelEditBtn').addEventListener('click', cancelEdit);

function submitTransaction() {
  const title = $('txTitle').value.trim();
  const amount = parseFloat($('txAmount').value);
  const date = $('txDate').value;
  const category = $('txCategory').value;
  const notes = $('txNotes').value.trim();
  let valid = true;

  $('errTitle').textContent = '';
  $('errAmount').textContent = '';

  if (!title) { $('errTitle').textContent = 'Title is required.'; valid = false; }
  if (!amount || amount <= 0 || isNaN(amount)) { $('errAmount').textContent = 'Enter a valid amount.'; valid = false; }
  if (!valid) return;

  if (editingId) {
    const idx = transactions.findIndex(t => t.id === editingId);
    if (idx !== -1) {
      transactions[idx] = { ...transactions[idx], title, amount, date, category, notes, type: currentType };
      save();
      toast('Transaction updated', 'info');
    }
    cancelEdit();
  } else {
    const tx = { id: uid(), title, amount, date, category, notes, type: currentType, createdAt: Date.now() };
    transactions.unshift(tx);
    save();
    toast('Transaction added!', 'success');
    resetForm();
  }
  renderDashboard();
}

function resetForm() {
  $('txTitle').value = '';
  $('txAmount').value = '';
  $('txDate').value = todayISO();
  $('txNotes').value = '';
  $('txCategory').value = 'food';
  $('errTitle').textContent = '';
  $('errAmount').textContent = '';
  currentType = 'expense';
  document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('.type-btn[data-type="expense"]').classList.add('active');
}

function startEdit(id) {
  const t = transactions.find(tx => tx.id === id);
  if (!t) return;
  editingId = id;
  navigateTo('add');
  $('txTitle').value = t.title;
  $('txAmount').value = t.amount;
  $('txDate').value = t.date;
  $('txCategory').value = t.category;
  $('txNotes').value = t.notes || '';
  currentType = t.type;
  document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`.type-btn[data-type="${t.type}"]`).classList.add('active');
  $('formTitle').textContent = 'Edit Transaction';
  $('submitBtn').querySelector('.btn-text').textContent = 'Save Changes';
  $('cancelEditBtn').classList.remove('hidden');
  $('formCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function cancelEdit() {
  editingId = null;
  $('formTitle').textContent = 'Add Transaction';
  $('submitBtn').querySelector('.btn-text').textContent = 'Add Transaction';
  $('cancelEditBtn').classList.add('hidden');
  resetForm();
}

function deleteTx(id, fromDash) {
  const item = document.querySelector(`.tx-item[data-id="${id}"]`);
  if (item) {
    item.classList.add('removing');
    setTimeout(() => {
      transactions = transactions.filter(t => t.id !== id);
      save();
      toast('Transaction deleted', 'error');
      renderDashboard();
      if (!fromDash) renderTransactions();
    }, 280);
  } else {
    transactions = transactions.filter(t => t.id !== id);
    save();
    toast('Transaction deleted', 'error');
    renderDashboard();
    if (!fromDash) renderTransactions();
  }
}

// ===== RIPPLE =====
function rippleEffect(e, btn) {
  const ripple = btn.querySelector('.btn-ripple');
  if (!ripple) return;
  const rect = btn.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  ripple.style.left = x + 'px';
  ripple.style.top = y + 'px';
  ripple.style.animation = 'none';
  ripple.offsetHeight; // reflow
  ripple.style.animation = 'ripple 0.6s ease-out forwards';
}

// ===== TOAST =====
function toast(msg, type = 'info') {
  const icons = { success: '✓', error: '✕', info: '◈' };
  const container = $('toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span class="toast-icon">${icons[type]}</span><span class="toast-msg">${msg}</span>`;
  container.appendChild(el);
  el.addEventListener('click', () => removeToast(el));
  setTimeout(() => removeToast(el), 3500);
}
function removeToast(el) {
  if (!el.parentNode) return;
  el.classList.add('exit');
  setTimeout(() => el.remove(), 300);
}

// ===== ANALYTICS =====
function renderAnalytics() {
  renderDonutChart();
  renderBarChart();
  renderMonthlyChart();
}

// --- DONUT CHART ---
function renderDonutChart() {
  const canvas = $('categoryChart');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const cats = {};
  transactions.filter(t => t.type === 'expense').forEach(t => {
    cats[t.category] = (cats[t.category] || 0) + t.amount;
  });
  const entries = Object.entries(cats).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((s, [, v]) => s + v, 0);

  if (total === 0) {
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text3').trim() || '#5a5a72';
    ctx.font = '14px DM Sans, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No expense data yet', W / 2, H / 2);
    $('donutVal').textContent = '—';
    $('categoryLegend').innerHTML = '';
    return;
  }

  $('donutVal').textContent = fmt(total);

  const cx = W / 2, cy = H / 2, r = Math.min(W, H) * 0.42, ri = r * 0.6;
  let startAngle = -Math.PI / 2;
  const gaps = 0.03;
  const arcData = [];

  entries.forEach(([cat, val], i) => {
    const slice = (val / total) * (Math.PI * 2 - gaps * entries.length);
    arcData.push({ cat, val, start: startAngle + gaps / 2, end: startAngle + slice + gaps / 2, color: CATEGORY_COLORS[cat] || '#888' });
    startAngle += slice + gaps;
  });

  // Animate
  let progress = 0;
  const duration = 800;
  const start = performance.now();
  function drawFrame(now) {
    progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    ctx.clearRect(0, 0, W, H);
    arcData.forEach(({ start, end, color }) => {
      const currentEnd = start + (end - start) * eased;
      ctx.beginPath();
      ctx.arc(cx, cy, r, start, currentEnd);
      ctx.arc(cx, cy, ri, currentEnd, start, true);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    });
    if (progress < 1) requestAnimationFrame(drawFrame);
  }
  requestAnimationFrame(drawFrame);

  // Legend
  $('categoryLegend').innerHTML = arcData.map(({ cat, val, color }) => `
    <div class="legend-item">
      <div class="legend-left">
        <div class="legend-dot" style="background:${color}"></div>
        <span class="legend-label">${CATEGORY_ICONS[cat]} ${capitalize(cat)}</span>
      </div>
      <span class="legend-pct">${((val / total) * 100).toFixed(1)}%</span>
    </div>
  `).join('');
}

// --- INCOME VS EXPENSE BAR ---
function renderBarChart() {
  const canvas = $('incomeExpenseChart');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const income = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const isDark = document.documentElement.dataset.theme === 'dark';
  const textColor = isDark ? '#9090aa' : '#5a5a72';
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

  const max = Math.max(income, expense, 1);
  const padL = 60, padR = 20, padT = 20, padB = 40;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const barW = Math.min(chartW * 0.25, 80);
  const gap = (chartW - barW * 2) / 3;

  // Grid lines
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padT + (chartH / 4) * i;
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
    const val = max - (max / 4) * i;
    ctx.fillStyle = textColor;
    ctx.font = '11px DM Sans, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(fmtCompact(val), padL - 6, y + 4);
  }

  const colors = { income: '#4caf7d', expense: '#e05c6b' };
  const data = [{ label: 'Income', val: income, color: colors.income }, { label: 'Expense', val: expense, color: colors.expense }];

  let progress = 0;
  const start = performance.now();
  function drawFrame(now) {
    progress = Math.min((now - start) / 700, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    ctx.clearRect(0, 0, W, H);

    // Redraw grid
    ctx.strokeStyle = gridColor; ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padT + (chartH / 4) * i;
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
      const val2 = max - (max / 4) * i;
      ctx.fillStyle = textColor; ctx.font = '11px DM Sans, sans-serif'; ctx.textAlign = 'right';
      ctx.fillText(fmtCompact(val2), padL - 6, y + 4);
    }

    data.forEach(({ label, val, color }, i) => {
      const x = padL + gap + i * (barW + gap);
      const barH2 = (val / max) * chartH * eased;
      const y = padT + chartH - barH2;

      // Bar shadow / glow
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      const grad = ctx.createLinearGradient(0, y, 0, padT + chartH);
      grad.addColorStop(0, color);
      grad.addColorStop(1, color + '44');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(x, y, barW, barH2, [6, 6, 0, 0]);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Value label
      ctx.fillStyle = color;
      ctx.font = '600 12px DM Sans, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(fmtCompact(val), x + barW / 2, y - 8);

      // X label
      ctx.fillStyle = textColor;
      ctx.font = '12px DM Sans, sans-serif';
      ctx.fillText(label, x + barW / 2, padT + chartH + 20);
    });
    if (progress < 1) requestAnimationFrame(drawFrame);
  }
  requestAnimationFrame(drawFrame);
}

// --- MONTHLY LINE CHART ---
function renderMonthlyChart() {
  const canvas = $('monthlyChart');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const isDark = document.documentElement.dataset.theme === 'dark';
  const textColor = isDark ? '#9090aa' : '#5a5a72';
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

  // Last 6 months
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    months.push({
      key: monthISO(d),
      label: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
    });
  }

  const incomeByMonth = {}, expByMonth = {};
  months.forEach(m => { incomeByMonth[m.key] = 0; expByMonth[m.key] = 0; });
  transactions.forEach(t => {
    const mk = t.date.substring(0, 7);
    if (incomeByMonth[mk] !== undefined) {
      if (t.type === 'income') incomeByMonth[mk] += t.amount;
      else expByMonth[mk] += t.amount;
    }
  });

  const incomeVals = months.map(m => incomeByMonth[m.key]);
  const expVals = months.map(m => expByMonth[m.key]);
  const maxVal = Math.max(...incomeVals, ...expVals, 1);

  const padL = 60, padR = 20, padT = 20, padB = 36;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const stepX = chartW / (months.length - 1 || 1);

  function getY(val) { return padT + chartH - (val / maxVal) * chartH; }
  function getX(i) { return padL + i * stepX; }

  // Grid & labels
  ctx.strokeStyle = gridColor; ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padT + (chartH / 4) * i;
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
    const val = maxVal - (maxVal / 4) * i;
    ctx.fillStyle = textColor; ctx.font = '11px DM Sans, sans-serif'; ctx.textAlign = 'right';
    ctx.fillText(fmtCompact(val), padL - 6, y + 4);
  }
  months.forEach((m, i) => {
    ctx.fillStyle = textColor; ctx.font = '11px DM Sans, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(m.label, getX(i), H - 6);
  });

  // Draw lines animated
  let progress = 0;
  const startT = performance.now();
  function drawLine(vals, color, fill) {
    const count = Math.floor(vals.length * progress);
    if (count < 2) return;
    const pts = vals.slice(0, count + 1).map((v, i) => ({ x: getX(i), y: getY(v) }));

    // Area fill
    ctx.beginPath();
    ctx.moveTo(pts[0].x, getY(0));
    pts.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(pts[pts.length - 1].x, getY(0));
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, padT, 0, padT + chartH);
    grad.addColorStop(0, color + '33');
    grad.addColorStop(1, color + '00');
    ctx.fillStyle = grad;
    ctx.fill();

    // Line
    ctx.beginPath();
    pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Dots
    pts.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowBlur = 0;
    });
  }

  function frame(now) {
    progress = Math.min((now - startT) / 900, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    ctx.clearRect(0, 0, W, H);

    ctx.strokeStyle = gridColor; ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padT + (chartH / 4) * i;
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
      const val = maxVal - (maxVal / 4) * i;
      ctx.fillStyle = textColor; ctx.font = '11px DM Sans, sans-serif'; ctx.textAlign = 'right';
      ctx.fillText(fmtCompact(val), padL - 6, y + 4);
    }
    months.forEach((m, i) => {
      ctx.fillStyle = textColor; ctx.font = '11px DM Sans, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(m.label, getX(i), H - 6);
    });

    // Modify vals for animation
    const animIncome = incomeVals.map(v => v * eased);
    const animExp = expVals.map(v => v * eased);
    drawLine(animIncome, '#4caf7d');
    drawLine(animExp, '#e05c6b');

    // Legend
    ctx.fillStyle = '#4caf7d'; ctx.font = '12px DM Sans, sans-serif'; ctx.textAlign = 'left';
    ctx.fillRect(padL, 8, 16, 3);
    ctx.fillText('Income', padL + 22, 14);
    ctx.fillStyle = '#e05c6b';
    ctx.fillRect(padL + 80, 8, 16, 3);
    ctx.fillText('Expense', padL + 102, 14);

    if (progress < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

// ===== INITIAL RENDER =====
renderDashboard();
