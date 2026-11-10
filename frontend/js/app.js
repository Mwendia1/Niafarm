// ===== API CLIENT =====
const API_BASE = '/api';

const api = {
  token: () => localStorage.getItem('nf_token'),

  headers() {
    const h = { 'Content-Type': 'application/json' };
    if (this.token()) h['Authorization'] = `Bearer ${this.token()}`;
    return h;
  },

  async request(method, path, body) {
    try {
      const opts = { method, headers: this.headers() };
      if (body) opts.body = JSON.stringify(body);
      const res = await fetch(API_BASE + path, opts);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');
      return data;
    } catch (err) {
      if (!navigator.onLine) {
        offlineQueue.add(method, path, body);
        throw new Error('Saved offline. Will sync when connected.');
      }
      throw err;
    }
  },

  get: (path) => api.request('GET', path),
  post: (path, body) => api.request('POST', path, body),
  put: (path, body) => api.request('PUT', path, body),
  delete: (path) => api.request('DELETE', path),
};

// ===== OFFLINE QUEUE =====
const offlineQueue = {
  key: 'nf_offline_queue',
  add(method, path, body) {
    const q = this.get();
    q.push({ method, path, body, ts: Date.now() });
    localStorage.setItem(this.key, JSON.stringify(q));
  },
  get() {
    try { return JSON.parse(localStorage.getItem(this.key) || '[]'); } catch { return []; }
  },
  async sync() {
    const q = this.get();
    if (!q.length) return;
    const remaining = [];
    for (const item of q) {
      try {
        await api.request(item.method, item.path, item.body);
      } catch {
        remaining.push(item);
      }
    }
    localStorage.setItem(this.key, JSON.stringify(remaining));
    if (q.length !== remaining.length) toast.success(`Synced ${q.length - remaining.length} offline record(s)`);
  }
};

window.addEventListener('online', () => {
  document.querySelector('.offline-bar')?.classList.remove('visible');
  offlineQueue.sync();
});

window.addEventListener('offline', () => {
  document.querySelector('.offline-bar')?.classList.add('visible');
});

// ===== STATE =====
const state = {
  user: null,
  farms: [],
  currentFarm: null,
  batches: [],

  setUser(u) { this.user = u; localStorage.setItem('nf_user', JSON.stringify(u)); },
  getUser() {
    if (!this.user) { try { this.user = JSON.parse(localStorage.getItem('nf_user')); } catch {} }
    return this.user;
  },
  setFarms(f) { this.farms = f; },
  setCurrentFarm(f) {
    this.currentFarm = f;
    if (f) localStorage.setItem('nf_farm_id', f.id);
  },
  getCurrentFarmId() { return this.currentFarm?.id || localStorage.getItem('nf_farm_id'); },
};

// ===== TOAST =====
const toast = {
  show(msg, type = 'default', duration = 3500) {
    const container = document.getElementById('toastContainer');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    const icons = { success: '✅', error: '❌', warning: '⚠️', default: 'ℹ️' };
    el.innerHTML = `<span>${icons[type] || icons.default}</span><span>${msg}</span>`;
    container.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateX(100%)'; el.style.transition = '0.3s'; setTimeout(() => el.remove(), 300); }, duration);
  },
  success: (msg) => toast.show(msg, 'success'),
  error: (msg) => toast.show(msg, 'error'),
  warning: (msg) => toast.show(msg, 'warning'),
};

// ===== MODAL =====
const modal = {
  open(id) {
    const el = document.getElementById(id);
    if (el) { el.classList.add('open'); document.body.style.overflow = 'hidden'; }
  },
  close(id) {
    const el = document.getElementById(id);
    if (el) { el.classList.remove('open'); document.body.style.overflow = ''; }
  },
  closeAll() {
    document.querySelectorAll('.modal-overlay.open').forEach(m => { m.classList.remove('open'); });
    document.body.style.overflow = '';
  }
};

// Close modal on overlay click
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) modal.closeAll();
  if (e.target.classList.contains('modal-close')) modal.closeAll();
});

// ===== FORMATTING =====
const fmt = {
  currency: (n) => `KSh ${Number(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
  number: (n) => Number(n || 0).toLocaleString(),
  date: (d) => d ? new Date(d).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' }) : '-',
  dateInput: (d) => d ? d.split('T')[0] : new Date().toISOString().split('T')[0],
  percent: (n, total) => total > 0 ? ((n / total) * 100).toFixed(1) + '%' : '0%',
  ago: (d) => {
    const diff = Date.now() - new Date(d).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }
};

// ===== FORM HELPERS =====
function getFormData(formId) {
  const form = document.getElementById(formId);
  const data = {};
  new FormData(form).forEach((v, k) => { data[k] = v; });
  return data;
}

function resetForm(formId) {
  const form = document.getElementById(formId);
  if (form) form.reset();
}

function setFormData(formId, data) {
  const form = document.getElementById(formId);
  if (!form) return;
  Object.entries(data).forEach(([k, v]) => {
    const el = form.elements[k];
    if (el && v !== null && v !== undefined) el.value = v;
  });
}

// ===== CONFIRM DIALOG =====
function confirmAction(msg, onConfirm) {
  if (confirm(msg)) onConfirm();
}

// ===== NAVIGATION =====
function navigate(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const pageEl = document.getElementById(`page-${page}`);
  if (pageEl) pageEl.classList.add('active');
  const navEl = document.querySelector(`[data-page="${page}"]`);
  if (navEl) navEl.classList.add('active');
  const titles = {
    dashboard: 'Dashboard', farms: 'Farm Registration', flocks: 'Flock Management',
    feeding: 'Feeding Management', health: 'Health & Vaccination', eggs: 'Egg Production',
    inventory: 'Inventory Management', sales: 'Sales & Customers', expenses: 'Expenses & Finances',
    reports: 'Reports & Analytics', notifications: 'Notifications', settings: 'Settings'
  };
  document.getElementById('pageTitle').textContent = titles[page] || page;
  // Close sidebar on mobile
  if (window.innerWidth <= 768) document.querySelector('.sidebar')?.classList.remove('open');
  // Load page data
  loadPage(page);
}

// ===== POPULATE BATCH SELECTS =====
async function populateBatchSelects(farmId) {
  if (!farmId) return;
  try {
    const batches = await api.get(`/flocks?farm_id=${farmId}`);
    state.batches = batches;
    document.querySelectorAll('.batch-select').forEach(sel => {
      const val = sel.value;
      sel.innerHTML = '<option value="">Select Batch</option>' + batches.map(b => `<option value="${b.id}">${b.batch_number} (${b.poultry_type} - ${b.current_count} birds)</option>`).join('');
      if (val) sel.value = val;
    });
  } catch {}
}

// ===== POPULATE FARM SELECTS =====
async function loadFarms() {
  try {
    const farms = await api.get('/farms');
    state.setFarms(farms);
    const sel = document.getElementById('farmSelector');
    if (sel) {
      sel.innerHTML = farms.map(f => `<option value="${f.id}">${f.name}</option>`).join('');
      const savedId = state.getCurrentFarmId();
      if (savedId) sel.value = savedId;
      const selected = farms.find(f => f.id == sel.value) || farms[0];
      if (selected) {
        state.setCurrentFarm(selected);
        sel.value = selected.id;
      }
    }
    return farms;
  } catch { return []; }
}
