// ===== DASHBOARD MODULE =====
let eggChart, financeChart, flockChart;

async function loadDashboard() {
  const farmId = state.getCurrentFarmId();
  if (!farmId) return;
  const container = document.getElementById('dashboardContent');
  container.innerHTML = `<div class="loading"><div class="spinner"></div> Loading dashboard...</div>`;
  try {
    const data = await api.get(`/reports/dashboard?farm_id=${farmId}`);
    renderDashboard(data);
  } catch (err) {
    container.innerHTML = `<div class="alert alert-error">Failed to load dashboard: ${err.message}</div>`;
  }
}

function renderDashboard(data) {
  const s = data.summary;
  const profit = s.month_profit;
  const profitClass = profit >= 0 ? 'text-profit' : 'text-loss';
  const profitSign = profit >= 0 ? '+' : '';

  document.getElementById('dashboardContent').innerHTML = `
    <div class="summary-grid">
      <div class="summary-card" onclick="navigate('flocks')" style="cursor:pointer" title="Go to Flock Management">
        <div class="summary-icon green"></div>
        <div class="summary-info"><div class="label">Total Birds</div><div class="value">${fmt.number(s.total_birds)}</div><div class="sub">${s.active_batches} active batch(es)</div></div>
      </div>
      <div class="summary-card" onclick="navigate('eggs')" style="cursor:pointer" title="Go to Egg Production">
        <div class="summary-icon orange"></div>
        <div class="summary-info"><div class="label">Today's Eggs</div><div class="value">${fmt.number(s.today_eggs)}</div><div class="sub">Collected today</div></div>
      </div>
      <div class="summary-card" onclick="navigate('inventory')" style="cursor:pointer" title="Go to Inventory">
        <div class="summary-icon blue"></div>
        <div class="summary-info"><div class="label">Feed Stock</div><div class="value">${fmt.number(s.feed_stock_kg)} kg</div><div class="sub">${s.low_stock_alerts > 0 ? `<span style="color:var(--danger)"> ${s.low_stock_alerts} low stock</span>` : 'Stock OK'}</div></div>
      </div>
      <div class="summary-card" onclick="navigate('expenses')" style="cursor:pointer" title="Go to Finances">
        <div class="summary-icon green"></div>
        <div class="summary-info"><div class="label">Month Income</div><div class="value">${fmt.currency(s.month_income)}</div><div class="sub">This month</div></div>
      </div>
      <div class="summary-card" onclick="navigate('expenses')" style="cursor:pointer" title="Go to Finances">
        <div class="summary-icon red"></div>
        <div class="summary-info"><div class="label">Month Expenses</div><div class="value">${fmt.currency(s.month_expenses)}</div><div class="sub">This month</div></div>
      </div>
      <div class="summary-card" onclick="navigate('reports')" style="cursor:pointer" title="Go to Reports">
        <div class="summary-icon ${profit >= 0 ? 'green' : 'red'}"></div>
        <div class="summary-info"><div class="label">Month Profit/Loss</div><div class="value ${profitClass}">${profitSign}${fmt.currency(profit)}</div><div class="sub">Net this month</div></div>
      </div>
      <div class="summary-card" onclick="navigate('flocks')" style="cursor:pointer" title="Go to Flock Management">
        <div class="summary-icon red"></div>
        <div class="summary-info"><div class="label">Deaths This Month</div><div class="value">${fmt.number(s.month_deaths)}</div><div class="sub">Mortality recorded</div></div>
      </div>
      <div class="summary-card" onclick="navigate('notifications')" style="cursor:pointer" title="Go to Notifications">
        <div class="summary-icon orange"></div>
        <div class="summary-info"><div class="label">Notifications</div><div class="value">${s.unread_notifications}</div><div class="sub">Unread alerts</div></div>
      </div>
    </div>

    <div class="charts-grid">
      <div class="card">
        <div class="card-header"><h3> Egg Production (Last 7 Days)</h3></div>
        <div class="card-body"><div class="chart-container"><canvas id="eggChart"></canvas></div></div>
      </div>
      <div class="card">
        <div class="card-header"><h3> Income vs Expenses (6 Months)</h3></div>
        <div class="card-body"><div class="chart-container"><canvas id="financeChart"></canvas></div></div>
      </div>
    </div>

    <div class="charts-grid">
      <div class="card">
        <div class="card-header"><h3> Flock Distribution</h3></div>
        <div class="card-body"><div class="chart-container"><canvas id="flockChart"></canvas></div></div>
      </div>
      <div class="card">
        <div class="card-header"><h3> Upcoming Vaccinations</h3></div>
        <div class="card-body" id="upcomingVaccinations"></div>
      </div>
    </div>

    <div class="charts-grid">
      <div class="card">
        <div class="card-header"><h3> Recent Activities</h3></div>
        <div class="card-body" id="recentActivities"></div>
      </div>
      <div class="card">
        <div class="card-header"><h3> Alerts</h3></div>
        <div class="card-body" id="dashAlerts"></div>
      </div>
    </div>
  `;

  renderEggChart(data.egg_trend);
  renderFinanceChart(data.financial_trend);
  renderFlockChart(data.flock_distribution);
  renderUpcomingVaccinations(data.upcoming_vaccinations);
  renderRecentActivities(data.recent_activities);
  renderDashAlerts(data.summary);
}

function renderEggChart(trend) {
  const ctx = document.getElementById('eggChart');
  if (!ctx) return;
  if (eggChart) eggChart.destroy();
  eggChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: trend.map(d => fmt.date(d.date)),
      datasets: [{ label: 'Eggs Collected', data: trend.map(d => d.total), borderColor: '#ff8f00', backgroundColor: 'rgba(255,143,0,0.1)', tension: 0.4, fill: true, pointBackgroundColor: '#ff8f00' }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
  });
}

function renderFinanceChart(trend) {
  const ctx = document.getElementById('financeChart');
  if (!ctx) return;
  if (financeChart) financeChart.destroy();
  financeChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: trend.map(d => d.month),
      datasets: [
        { label: 'Income', data: trend.map(d => d.income || 0), backgroundColor: 'rgba(46,125,50,0.7)', borderRadius: 4 },
        { label: 'Expenses', data: trend.map(d => d.expenses || 0), backgroundColor: 'rgba(198,40,40,0.7)', borderRadius: 4 }
      ]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } }, scales: { y: { beginAtZero: true } } }
  });
}

function renderFlockChart(dist) {
  const ctx = document.getElementById('flockChart');
  if (!ctx) return;
  if (flockChart) flockChart.destroy();
  if (!dist.length) { ctx.parentElement.innerHTML = '<div class="empty-state"><div class="empty-icon"></div><p>No active flocks</p></div>'; return; }
  flockChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: dist.map(d => d.poultry_type),
      datasets: [{ data: dist.map(d => d.count), backgroundColor: ['#2e7d32','#ff8f00','#0277bd','#7b1fa2','#c62828'], borderWidth: 2 }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
  });
}

function renderUpcomingVaccinations(vaccinations) {
  const el = document.getElementById('upcomingVaccinations');
  if (!el) return;
  if (!vaccinations.length) { el.innerHTML = '<div class="empty-state"><div class="empty-icon"></div><p>No upcoming vaccinations</p></div>'; return; }
  el.innerHTML = vaccinations.map(v => `
    <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--grey-100)">
      <div style="font-size:24px"></div>
      <div style="flex:1">
        <div style="font-weight:600;font-size:13.5px">${v.vaccine_name}</div>
        <div style="font-size:12px;color:var(--grey-600)">Batch: ${v.batch_number}</div>
      </div>
      <div style="text-align:right">
        <div class="badge badge-orange">${fmt.date(v.next_due_date)}</div>
      </div>
    </div>
  `).join('');
}

function renderRecentActivities(activities) {
  const el = document.getElementById('recentActivities');
  if (!el) return;
  if (!activities.length) { el.innerHTML = '<div class="empty-state"><div class="empty-icon"></div><p>No recent activities</p></div>'; return; }
  const icons = { batch_added:'', mortality_recorded:'', feeding_recorded:'', eggs_recorded:'', sale_recorded:'', expense_recorded:'', vaccination_recorded:'', health_recorded:'', farm_created:'' };
  el.innerHTML = activities.map(a => `
    <div style="display:flex;align-items:flex-start;gap:10px;padding:8px 0;border-bottom:1px solid var(--grey-100)">
      <span style="font-size:18px">${icons[a.activity_type] || ''}</span>
      <div style="flex:1">
        <div style="font-size:13px;color:var(--grey-800)">${a.description}</div>
        <div style="font-size:11px;color:var(--grey-500)">${a.user_name || 'System'} · ${fmt.ago(a.created_at)}</div>
      </div>
    </div>
  `).join('');
}

function renderDashAlerts(s) {
  const el = document.getElementById('dashAlerts');
  if (!el) return;
  const alerts = [];
  if (s.low_stock_alerts > 0) alerts.push(`<div class="alert alert-warning"> ${s.low_stock_alerts} inventory item(s) are running low on stock.</div>`);
  if (s.month_deaths > 0) alerts.push(`<div class="alert alert-error"> ${s.month_deaths} bird(s) died this month. Review health records.</div>`);
  if (s.month_profit < 0) alerts.push(`<div class="alert alert-error"> Farm is running at a loss this month (${fmt.currency(s.month_profit)}).</div>`);
  if (s.unread_notifications > 0) alerts.push(`<div class="alert alert-info"> You have ${s.unread_notifications} unread notification(s).</div>`);
  if (!alerts.length) alerts.push(`<div class="alert alert-success"> All systems normal. Farm is running well!</div>`);
  el.innerHTML = alerts.join('');
}
