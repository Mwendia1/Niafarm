// ===== EGG PRODUCTION MODULE =====
let eggProdChart;

async function loadEggs() {
  const farmId = state.getCurrentFarmId();
  if (!farmId) return;
  await populateBatchSelects(farmId);
  try {
    const [records, summary] = await Promise.all([
      api.get(`/eggs?farm_id=${farmId}`),
      api.get(`/eggs/summary?farm_id=${farmId}&period=month`)
    ]);
    renderEggSummary(summary.summary);
    renderEggTable(records);
    renderEggTrendChart(summary.daily);
  } catch (err) { toast.error('Failed to load egg records: ' + err.message); }
}

function renderEggSummary(s) {
  if (!s) return;
  document.getElementById('eggSummaryCards').innerHTML = `
    <div class="summary-grid" style="margin-bottom:0">
      <div class="summary-card"><div class="summary-icon orange"></div><div class="summary-info"><div class="label">Total Collected (Month)</div><div class="value">${fmt.number(s.total_eggs)}</div></div></div>
      <div class="summary-card"><div class="summary-icon green"></div><div class="summary-info"><div class="label">Good Eggs</div><div class="value">${fmt.number(s.good_eggs)}</div></div></div>
      <div class="summary-card"><div class="summary-icon red"></div><div class="summary-info"><div class="label">Broken/Damaged</div><div class="value">${fmt.number((s.broken_eggs||0)+(s.damaged_eggs||0))}</div></div></div>
      <div class="summary-card"><div class="summary-icon blue"></div><div class="summary-info"><div class="label">Stock Remaining</div><div class="value">${fmt.number(s.stock_remaining)}</div></div></div>
      <div class="summary-card"><div class="summary-icon green"></div><div class="summary-info"><div class="label">Eggs Sold</div><div class="value">${fmt.number(s.eggs_sold)}</div></div></div>
      <div class="summary-card"><div class="summary-icon blue"></div><div class="summary-info"><div class="label">Days Recorded</div><div class="value">${s.days_recorded || 0}</div></div></div>
    </div>
  `;
}

function renderEggTable(records) {
  const tbody = document.getElementById('eggTableBody');
  if (!records.length) {
    tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state"><div class="empty-icon"></div><h4>No egg production records</h4><p>Click "Record Production" to start tracking</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = records.map(r => `
    <tr>
      <td>${fmt.date(r.date)}</td>
      <td>${r.batch_number}</td>
      <td><strong>${fmt.number(r.total_collected)}</strong></td>
      <td style="color:var(--primary)">${fmt.number(r.good_eggs)}</td>
      <td style="color:var(--danger)">${fmt.number(r.broken_eggs)}</td>
      <td style="color:var(--warning)">${fmt.number(r.damaged_eggs)}</td>
      <td>${fmt.number(r.eggs_sold)}</td>
      <td>${r.notes || '-'}</td>
      <td>
        <button class="btn btn-sm btn-outline" onclick="editEggRecord('${r.uuid}', ${r.id})"></button>
        <button class="btn btn-sm btn-danger" onclick="deleteEggRecord('${r.uuid}')"></button>
      </td>
    </tr>
  `).join('');
}

function renderEggTrendChart(daily) {
  const ctx = document.getElementById('eggProdChart');
  if (!ctx) return;
  if (eggProdChart) eggProdChart.destroy();
  eggProdChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: daily.map(d => fmt.date(d.date)),
      datasets: [{ label: 'Eggs Collected', data: daily.map(d => d.total), borderColor: '#ff8f00', backgroundColor: 'rgba(255,143,0,0.1)', tension: 0.4, fill: true }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
  });
}

function openAddEggModal() {
  resetForm('eggForm');
  document.getElementById('eggDate').value = fmt.dateInput(new Date());
  modal.open('eggModal');
}

// Auto-calculate good eggs
document.addEventListener('input', (e) => {
  if (['eggTotal','eggBroken','eggDamaged'].includes(e.target.id)) {
    const total = parseInt(document.getElementById('eggTotal')?.value) || 0;
    const broken = parseInt(document.getElementById('eggBroken')?.value) || 0;
    const damaged = parseInt(document.getElementById('eggDamaged')?.value) || 0;
    const good = Math.max(0, total - broken - damaged);
    const goodEl = document.getElementById('eggGood');
    if (goodEl) goodEl.value = good;
  }
});

async function saveEggRecord() {
  const data = getFormData('eggForm');
  data.farm_id = state.getCurrentFarmId();
  if (!data.batch_id || !data.date) { toast.error('Batch and date required'); return; }
  try {
    await api.post('/eggs', data);
    toast.success('Egg production recorded');
    modal.close('eggModal');
    await loadEggs();
  } catch (err) { toast.error(err.message); }
}

async function deleteEggRecord(uuid) {
  confirmAction('Delete this egg production record?', async () => {
    try { await api.delete(`/eggs/${uuid}`); toast.success('Record deleted'); await loadEggs(); }
    catch (err) { toast.error(err.message); }
  });
}

async function filterEggsByPeriod(period) {
  const farmId = state.getCurrentFarmId();
  if (!farmId) return;
  document.querySelectorAll('.egg-period-btn').forEach(b => b.classList.remove('btn-primary'));
  event.target.classList.add('btn-primary');
  try {
    const summary = await api.get(`/eggs/summary?farm_id=${farmId}&period=${period}`);
    renderEggSummary(summary.summary);
    renderEggTrendChart(summary.daily);
  } catch {}
}
