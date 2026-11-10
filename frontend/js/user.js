// ===== USER DASHBOARD JS =====
const API = 'http://localhost:3000/api';
let uState = { user: null, farm: null, batches: [] };

// ===== HELPERS =====
function uToken() { return localStorage.getItem('nf_token'); }
function uHeaders() { return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${uToken()}` }; }

async function uApi(method, path, body) {
  const opts = { method, headers: uHeaders() };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(API + path, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function uToast(msg, type = 'default') {
  const c = document.getElementById('toastContainer');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  c.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

function uFmt(n) { return Number(n || 0).toLocaleString(); }
function uCurrency(n) { return `KSh ${Number(n || 0).toLocaleString()}`; }
function uDate(d) { return d ? new Date(d).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'; }
function uToday() { return new Date().toISOString().split('T')[0]; }

function uGetFormData(id) {
  const data = {};
  new FormData(document.getElementById(id)).forEach((v, k) => { data[k] = v; });
  return data;
}

function uOpenModal(id) {
  document.getElementById(id).classList.add('open');
  document.body.style.overflow = 'hidden';
}

function uCloseModal(id) {
  document.getElementById(id).classList.remove('open');
  document.body.style.overflow = '';
}

// ===== AUTH =====
document.getElementById('loginFormEl').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('button[type=submit]');
  btn.disabled = true; btn.textContent = 'Signing in...';
  document.getElementById('loginError').style.display = 'none';
  try {
    const data = await uApi('POST', '/auth/login', {
      email: document.getElementById('loginEmail').value,
      password: document.getElementById('loginPassword').value
    });
    localStorage.setItem('nf_token', data.token);
    uState.user = data.user;
    // Redirect admin to admin dashboard
    if (data.user.role === 'admin' || data.user.role === 'farm_owner') {
      window.location.href = 'index.html';
      return;
    }
    uShowApp(data.user);
  } catch (err) {
    document.getElementById('loginError').textContent = err.message;
    document.getElementById('loginError').style.display = 'block';
  } finally { btn.disabled = false; btn.textContent = 'Sign In'; }
});

async function uShowApp(user) {
  document.getElementById('authSection').style.display = 'none';
  document.getElementById('userApp').style.display = 'block';
  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  document.getElementById('uAvatar').textContent = initials;
  document.getElementById('uUserName').textContent = user.name;
  document.getElementById('uUserRole').textContent = user.role.replace(/_/g, ' ');
  await uLoadFarm();
  uLoadDashboard();
  uLoadNotifCount();
}

async function uLoadFarm() {
  try {
    const farms = await uApi('GET', '/farms');
    if (!farms.length) { document.getElementById('uFarmName').textContent = 'No farm assigned'; return; }
    uState.farm = farms[0];
    document.getElementById('uFarmName').textContent = uState.farm.name;
    await uLoadBatches();
  } catch (err) { uToast('Failed to load farm: ' + err.message, 'error'); }
}

async function uLoadBatches() {
  if (!uState.farm) return;
  try {
    const batches = await uApi('GET', `/flocks?farm_id=${uState.farm.id}`);
    uState.batches = batches.filter(b => b.status === 'active');
    uPopulateBatchSelects();
  } catch {}
}

function uPopulateBatchSelects() {
  document.querySelectorAll('.u-batch-select').forEach(sel => {
    const val = sel.value;
    sel.innerHTML = '<option value="">Select Batch</option>' +
      uState.batches.map(b => `<option value="${b.id}">${b.batch_number} (${b.poultry_type} - ${b.current_count} birds)</option>`).join('');
    if (val) sel.value = val;
  });
}

function uLogout() {
  localStorage.removeItem('nf_token');
  location.reload();
}

// ===== INIT =====
(async function init() {
  const token = uToken();
  if (!token) return;
  try {
    const profile = await uApi('GET', '/auth/profile');
    uState.user = profile;
    if (profile.role === 'admin' || profile.role === 'farm_owner') {
      window.location.href = 'index.html';
      return;
    }
    uShowApp(profile);
  } catch { localStorage.removeItem('nf_token'); }
})();

// ===== TAB SWITCHING =====
function uSwitchTab(tabId, btn) {
  document.querySelectorAll('.u-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.u-nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(tabId).classList.add('active');
  btn.classList.add('active');
  if (tabId === 'uFeeding') uLoadFeeding();
  if (tabId === 'uHealth') uLoadHealth();
  if (tabId === 'uEggs') uLoadEggs();
  if (tabId === 'uInventory') uLoadInventory();
}

// ===== DASHBOARD =====
async function uLoadDashboard() {
  if (!uState.farm) return;
  const farmId = uState.farm.id;
  try {
    const data = await uApi('GET', `/reports/dashboard?farm_id=${farmId}`);
    const s = data.summary;

    document.getElementById('uTotalBirds').textContent = uFmt(s.total_birds);
    document.getElementById('uActiveBatches').textContent = `${s.active_batches} active batch(es)`;
    document.getElementById('uTodayEggs').textContent = uFmt(s.today_eggs);
    document.getElementById('uFeedStock').textContent = `${uFmt(s.feed_stock_kg)} kg`;
    document.getElementById('uMonthDeaths').textContent = uFmt(s.month_deaths);

    if (s.low_stock_alerts > 0) {
      document.getElementById('uFeedStockSub').textContent = `${s.low_stock_alerts} item(s) low`;
      document.getElementById('uFeedStockSub').style.color = 'var(--danger)';
    }

    // Alerts
    const alerts = [];
    if (s.low_stock_alerts > 0) alerts.push(`<div class="alert alert-warning">${s.low_stock_alerts} inventory item(s) are running low on stock.</div>`);
    if (s.month_deaths > 0) alerts.push(`<div class="alert alert-error">${s.month_deaths} bird(s) died this month. Check health records.</div>`);
    if (s.unread_notifications > 0) alerts.push(`<div class="alert alert-info">You have ${s.unread_notifications} unread notification(s).</div>`);
    document.getElementById('uAlerts').innerHTML = alerts.join('');

    // Batch table
    const tbody = document.getElementById('uBatchTable');
    if (!uState.batches.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--grey-500)">No active batches</td></tr>';
    } else {
      tbody.innerHTML = uState.batches.map(b => {
        const deaths = b.initial_count - b.current_count;
        const rate = b.initial_count > 0 ? ((deaths / b.initial_count) * 100).toFixed(1) : 0;
        return `<tr>
          <td><strong>${b.batch_number}</strong></td>
          <td><span class="badge badge-green">${b.poultry_type}</span></td>
          <td><strong>${uFmt(b.current_count)}</strong></td>
          <td style="color:var(--danger)">${deaths}</td>
          <td>${rate}%</td>
          <td>${uDate(b.arrival_date)}</td>
          <td><span class="badge badge-green">${b.status}</span></td>
        </tr>`;
      }).join('');
    }

    // Upcoming vaccinations
    const vaxEl = document.getElementById('uUpcomingVax');
    if (!data.upcoming_vaccinations.length) {
      vaxEl.innerHTML = '<p style="color:var(--grey-500);font-size:13px">No upcoming vaccinations in the next 14 days.</p>';
    } else {
      const today = new Date();
      vaxEl.innerHTML = data.upcoming_vaccinations.map(v => {
        const due = new Date(v.next_due_date);
        const daysLeft = Math.ceil((due - today) / 86400000);
        const color = daysLeft < 0 ? 'var(--danger)' : daysLeft <= 3 ? 'var(--warning)' : 'var(--primary)';
        return `<div class="u-vax-item">
          <div class="u-vax-date" style="background:${color}">
            <span>${due.getDate()}</span>
            <span>${due.toLocaleString('default', { month: 'short' })}</span>
          </div>
          <div class="u-vax-info">
            <div class="u-vax-name">${v.vaccine_name}</div>
            <div class="u-vax-batch">Batch: ${v.batch_number}</div>
          </div>
          <div class="u-vax-days" style="color:${color}">
            ${daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : daysLeft === 0 ? 'Today!' : `${daysLeft}d left`}
          </div>
        </div>`;
      }).join('');
    }
  } catch (err) { uToast('Failed to load dashboard: ' + err.message, 'error'); }
}

// ===== FEEDING =====
async function uLoadFeeding() {
  if (!uState.farm) return;
  const farmId = uState.farm.id;
  try {
    const [records, schedules] = await Promise.all([
      uApi('GET', `/feeding?farm_id=${farmId}`),
      uApi('GET', `/feeding/schedules?farm_id=${farmId}`)
    ]);

    const tbody = document.getElementById('uFeedTable');
    if (!records.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--grey-500)">No feeding records yet</td></tr>';
    } else {
      tbody.innerHTML = records.slice(0, 30).map(r => `<tr>
        <td>${uDate(r.date)}</td>
        <td>${r.batch_number}</td>
        <td>${r.feed_name}</td>
        <td><strong>${r.quantity_kg} kg</strong></td>
        <td>${uCurrency(r.cost)}</td>
        <td>${r.notes || '-'}</td>
      </tr>`).join('');
    }

    const stbody = document.getElementById('uScheduleTable');
    if (!schedules.length) {
      stbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--grey-500)">No schedules set</td></tr>';
    } else {
      stbody.innerHTML = schedules.map(s => `<tr>
        <td>${s.batch_number}</td>
        <td>${s.feed_type}</td>
        <td>${s.quantity_kg} kg</td>
        <td>${s.frequency}</td>
        <td>${s.time_of_day || '-'}</td>
      </tr>`).join('');
    }
  } catch (err) { uToast('Failed to load feeding: ' + err.message, 'error'); }
}

async function uSaveFeed() {
  const data = uGetFormData('uFeedForm');
  data.farm_id = uState.farm.id;
  if (!data.batch_id || !data.feed_name || !data.quantity_kg || !data.date) {
    uToast('Please fill all required fields', 'error'); return;
  }
  try {
    await uApi('POST', '/feeding', data);
    uToast('Feeding record saved', 'success');
    uCloseModal('uFeedModal');
    document.getElementById('uFeedForm').reset();
    uLoadDashboard();
    uLoadFeeding();
  } catch (err) { uToast(err.message, 'error'); }
}

// ===== HEALTH =====
async function uLoadHealth() {
  if (!uState.farm) return;
  const farmId = uState.farm.id;
  try {
    const [records, vaccinations] = await Promise.all([
      uApi('GET', `/health?farm_id=${farmId}`),
      uApi('GET', `/health/vaccinations?farm_id=${farmId}`)
    ]);

    // Vaccination calendar
    const calEl = document.getElementById('uVaxCalendar');
    const upcoming = vaccinations.filter(v => v.next_due_date && v.status !== 'completed')
      .sort((a, b) => new Date(a.next_due_date) - new Date(b.next_due_date));
    if (!upcoming.length) {
      calEl.innerHTML = '<p style="color:var(--grey-500);font-size:13px">No upcoming vaccinations scheduled.</p>';
    } else {
      const today = new Date();
      calEl.innerHTML = upcoming.map(v => {
        const due = new Date(v.next_due_date);
        const daysLeft = Math.ceil((due - today) / 86400000);
        const color = daysLeft < 0 ? 'var(--danger)' : daysLeft <= 3 ? 'var(--warning)' : 'var(--primary)';
        return `<div class="u-vax-item">
          <div class="u-vax-date" style="background:${color}">
            <span>${due.getDate()}</span><span>${due.toLocaleString('default', { month: 'short' })}</span>
          </div>
          <div class="u-vax-info">
            <div class="u-vax-name">${v.vaccine_name}</div>
            <div class="u-vax-batch">Batch: ${v.batch_number}</div>
          </div>
          <div class="u-vax-days" style="color:${color}">
            ${daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : daysLeft === 0 ? 'Today!' : `${daysLeft}d left`}
          </div>
        </div>`;
      }).join('');
    }

    // Vaccination table
    const vtbody = document.getElementById('uVaxTable');
    if (!vaccinations.length) {
      vtbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--grey-500)">No vaccination records</td></tr>';
    } else {
      const today = new Date();
      vtbody.innerHTML = vaccinations.map(v => {
        const due = v.next_due_date ? new Date(v.next_due_date) : null;
        const isOverdue = due && due < today && v.status !== 'completed';
        let badge = `<span class="badge badge-grey">${v.status}</span>`;
        if (v.status === 'completed') badge = `<span class="badge badge-green">Completed</span>`;
        else if (isOverdue) badge = `<span class="badge badge-red">Overdue</span>`;
        else if (due && (due - today) < 7 * 86400000) badge = `<span class="badge badge-orange">Due Soon</span>`;
        return `<tr style="${isOverdue ? 'background:var(--danger-light)' : ''}">
          <td>${v.batch_number}</td>
          <td><strong>${v.vaccine_name}</strong></td>
          <td>${uDate(v.date_given)}</td>
          <td>${uDate(v.next_due_date)}</td>
          <td>${badge}</td>
          <td><button class="btn btn-sm btn-outline" onclick="uMarkVaxDone('${v.uuid}')">Mark Done</button></td>
        </tr>`;
      }).join('');
    }

    // Health records table
    const htbody = document.getElementById('uHealthTable');
    if (!records.length) {
      htbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--grey-500)">No health records</td></tr>';
    } else {
      htbody.innerHTML = records.slice(0, 20).map(r => `<tr>
        <td>${uDate(r.date)}</td>
        <td>${r.batch_number}</td>
        <td><span class="badge badge-blue">${r.type}</span></td>
        <td>${r.description || '-'}</td>
        <td>${r.medication || '-'}</td>
      </tr>`).join('');
    }
  } catch (err) { uToast('Failed to load health records: ' + err.message, 'error'); }
}

async function uSaveHealth() {
  const data = uGetFormData('uHealthForm');
  data.farm_id = uState.farm.id;
  if (!data.batch_id || !data.date || !data.type) { uToast('Please fill required fields', 'error'); return; }
  try {
    await uApi('POST', '/health', data);
    uToast('Health record saved', 'success');
    uCloseModal('uHealthModal');
    document.getElementById('uHealthForm').reset();
    uLoadHealth();
  } catch (err) { uToast(err.message, 'error'); }
}

async function uSaveVac() {
  const data = uGetFormData('uVacForm');
  data.farm_id = uState.farm.id;
  if (!data.batch_id || !data.vaccine_name) { uToast('Batch and vaccine name required', 'error'); return; }
  try {
    await uApi('POST', '/health/vaccinations', data);
    uToast('Vaccination record saved', 'success');
    uCloseModal('uVacModal');
    document.getElementById('uVacForm').reset();
    uLoadHealth();
    uLoadNotifCount();
  } catch (err) { uToast(err.message, 'error'); }
}

async function uMarkVaxDone(uuid) {
  try {
    await uApi('PUT', `/health/vaccinations/${uuid}`, { status: 'completed', date_given: uToday() });
    uToast('Vaccination marked as completed', 'success');
    uLoadHealth();
  } catch (err) { uToast(err.message, 'error'); }
}

// ===== EGGS =====
async function uLoadEggs() {
  if (!uState.farm) return;
  const farmId = uState.farm.id;
  try {
    const [records, summary] = await Promise.all([
      uApi('GET', `/eggs?farm_id=${farmId}`),
      uApi('GET', `/eggs/summary?farm_id=${farmId}&period=month`)
    ]);

    const s = summary.summary;
    document.getElementById('uEggSummary').innerHTML = `
      <div class="u-egg-stat"><div class="label">Total Collected</div><div class="value">${uFmt(s.total_eggs)}</div></div>
      <div class="u-egg-stat"><div class="label">Good Eggs</div><div class="value">${uFmt(s.good_eggs)}</div></div>
      <div class="u-egg-stat"><div class="label">Broken/Damaged</div><div class="value">${uFmt((s.broken_eggs || 0) + (s.damaged_eggs || 0))}</div></div>
      <div class="u-egg-stat"><div class="label">Eggs Sold</div><div class="value">${uFmt(s.eggs_sold)}</div></div>
      <div class="u-egg-stat"><div class="label">Stock Remaining</div><div class="value">${uFmt(s.stock_remaining)}</div></div>
      <div class="u-egg-stat"><div class="label">Days Recorded</div><div class="value">${s.days_recorded || 0}</div></div>
    `;

    const tbody = document.getElementById('uEggTable');
    if (!records.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--grey-500)">No egg records yet</td></tr>';
    } else {
      tbody.innerHTML = records.slice(0, 30).map(r => `<tr>
        <td>${uDate(r.date)}</td>
        <td>${r.batch_number}</td>
        <td><strong>${uFmt(r.total_collected)}</strong></td>
        <td style="color:var(--primary)">${uFmt(r.good_eggs)}</td>
        <td style="color:var(--danger)">${uFmt(r.broken_eggs)}</td>
        <td style="color:var(--warning)">${uFmt(r.damaged_eggs)}</td>
        <td>${uFmt(r.eggs_sold)}</td>
      </tr>`).join('');
    }
  } catch (err) { uToast('Failed to load egg records: ' + err.message, 'error'); }
}

// Auto-calc good eggs in both egg forms
document.addEventListener('input', (e) => {
  const maps = [
    { total: 'uEggQTotal', broken: 'uEggQBroken', damaged: 'uEggQDamaged', good: 'uEggQGood' },
    { total: 'uEggTotal', broken: 'uEggBroken', damaged: 'uEggDamaged', good: 'uEggGood' }
  ];
  maps.forEach(m => {
    if ([m.total, m.broken, m.damaged].includes(e.target.id)) {
      const total = parseInt(document.getElementById(m.total)?.value) || 0;
      const broken = parseInt(document.getElementById(m.broken)?.value) || 0;
      const damaged = parseInt(document.getElementById(m.damaged)?.value) || 0;
      const goodEl = document.getElementById(m.good);
      if (goodEl) goodEl.value = Math.max(0, total - broken - damaged);
    }
  });
});

async function uSaveEggQuick() {
  const data = uGetFormData('uEggQuickForm');
  data.farm_id = uState.farm.id;
  if (!data.batch_id || !data.date || !data.total_collected) { uToast('Batch, date and total required', 'error'); return; }
  try {
    await uApi('POST', '/eggs', data);
    uToast('Egg production recorded', 'success');
    uCloseModal('uEggQuickModal');
    document.getElementById('uEggQuickForm').reset();
    uLoadDashboard();
  } catch (err) { uToast(err.message, 'error'); }
}

async function uSaveEgg() {
  const data = uGetFormData('uEggForm');
  data.farm_id = uState.farm.id;
  if (!data.batch_id || !data.date) { uToast('Batch and date required', 'error'); return; }
  try {
    await uApi('POST', '/eggs', data);
    uToast('Egg production recorded', 'success');
    uCloseModal('uEggModal');
    document.getElementById('uEggForm').reset();
    uLoadEggs();
    uLoadDashboard();
  } catch (err) { uToast(err.message, 'error'); }
}

// ===== MORTALITY =====
async function uSaveMortality() {
  const data = uGetFormData('uMortalityForm');
  data.farm_id = uState.farm.id;
  if (!data.batch_id || !data.date || !data.count) { uToast('Batch, date and count required', 'error'); return; }
  try {
    const batch = uState.batches.find(b => b.id == data.batch_id);
    if (!batch) { uToast('Batch not found', 'error'); return; }
    await uApi('POST', `/flocks/${batch.uuid}/mortality`, data);
    uToast('Mortality recorded', 'success');
    uCloseModal('uMortalityModal');
    document.getElementById('uMortalityForm').reset();
    await uLoadBatches();
    uLoadDashboard();
  } catch (err) { uToast(err.message, 'error'); }
}

// ===== INVENTORY =====
async function uLoadInventory() {
  if (!uState.farm) return;
  const farmId = uState.farm.id;
  try {
    const [items, lowStock, expiring] = await Promise.all([
      uApi('GET', `/inventory?farm_id=${farmId}`),
      uApi('GET', `/inventory/alerts/low-stock?farm_id=${farmId}`),
      uApi('GET', `/inventory/alerts/expiring?farm_id=${farmId}&days=30`)
    ]);

    const alertEl = document.getElementById('uInvAlerts');
    const alerts = [];
    if (lowStock.length) alerts.push(`<div class="alert alert-warning">${lowStock.length} item(s) are low on stock: ${lowStock.map(i => i.name).join(', ')}</div>`);
    if (expiring.length) alerts.push(`<div class="alert alert-error">${expiring.length} item(s) expiring within 30 days: ${expiring.map(i => i.name).join(', ')}</div>`);
    alertEl.innerHTML = alerts.join('');

    const tbody = document.getElementById('uInvTable');
    if (!items.length) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--grey-500)">No inventory items</td></tr>';
    } else {
      tbody.innerHTML = items.map(item => {
        const isLow = item.quantity <= item.low_stock_threshold;
        return `<tr style="${isLow ? 'background:var(--warning-light)' : ''}">
          <td><strong>${item.name}</strong></td>
          <td><span class="badge badge-grey">${item.category}</span></td>
          <td style="color:${isLow ? 'var(--danger)' : 'inherit'}"><strong>${item.quantity}</strong>${isLow ? ' <span class="badge badge-red">Low</span>' : ''}</td>
          <td>${item.unit}</td>
          <td>${isLow ? '<span style="color:var(--danger);font-weight:600">Low Stock</span>' : '<span style="color:var(--primary);font-weight:600">OK</span>'}</td>
        </tr>`;
      }).join('');
    }
  } catch (err) { uToast('Failed to load inventory: ' + err.message, 'error'); }
}

// ===== NOTIFICATIONS =====
async function uLoadNotifCount() {
  if (!uState.farm) return;
  try {
    const notifs = await uApi('GET', `/notifications?farm_id=${uState.farm.id}&is_read=false`);
    const count = notifs.length;
    const badge = document.getElementById('uNotifCount');
    if (count > 0) { badge.textContent = count > 9 ? '9+' : count; badge.style.display = 'flex'; }
    else badge.style.display = 'none';
  } catch {}
}

async function uToggleNotifPanel() {
  const panel = document.getElementById('uNotifPanel');
  if (panel.classList.contains('open')) { panel.classList.remove('open'); return; }
  panel.classList.add('open');
  try {
    const notifs = await uApi('GET', `/notifications?farm_id=${uState.farm.id}`);
    const list = document.getElementById('uNotifList');
    if (!notifs.length) {
      list.innerHTML = '<div style="padding:20px;text-align:center;color:var(--grey-500)">No notifications</div>';
      return;
    }
    list.innerHTML = notifs.slice(0, 20).map(n => `
      <div class="notif-item notif-priority-${n.priority} ${n.is_read ? '' : 'unread'}" onclick="uMarkNotifRead('${n.uuid}', this)">
        <div class="notif-title">${n.title}</div>
        <div class="notif-msg">${n.message}</div>
        <div class="notif-time">${n.created_at}</div>
      </div>
    `).join('');
  } catch {}
}

async function uMarkNotifRead(uuid, el) {
  try {
    await uApi('PUT', `/notifications/${uuid}/read`);
    el.classList.remove('unread');
    uLoadNotifCount();
  } catch {}
}

async function uMarkAllRead() {
  try {
    await uApi('PUT', '/notifications/read-all', { farm_id: uState.farm.id });
    uToast('All notifications marked as read', 'success');
    document.getElementById('uNotifPanel').classList.remove('open');
    uLoadNotifCount();
  } catch (err) { uToast(err.message, 'error'); }
}

// Close notif panel on outside click
document.addEventListener('click', (e) => {
  const panel = document.getElementById('uNotifPanel');
  if (panel?.classList.contains('open') && !panel.contains(e.target) && !e.target.closest('#uNotifBtn')) {
    panel.classList.remove('open');
  }
});

// Set default dates on modal open
document.addEventListener('click', (e) => {
  const today = uToday();
  const dateMap = {
    uMortalityModal: 'uMortDate',
    uEggQuickModal: 'uEggQuickDate',
    uFeedModal: 'uFeedDate',
    uEggModal: 'uEggDate',
    uHealthModal: 'uHealthDate',
    uVacModal: 'uVacDate'
  };
  const btn = e.target.closest('[onclick]');
  if (btn) {
    const onclick = btn.getAttribute('onclick');
    Object.entries(dateMap).forEach(([modal, dateId]) => {
      if (onclick.includes(modal)) {
        setTimeout(() => {
          const el = document.getElementById(dateId);
          if (el && !el.value) el.value = today;
          uPopulateBatchSelects();
        }, 50);
      }
    });
  }
});
