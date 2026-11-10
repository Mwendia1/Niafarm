// ===== REPORTS MODULE =====
async function loadReports() {
  const farmId = state.getCurrentFarmId();
  if (!farmId) return;
  await populateBatchSelects(farmId);
  // Set default date range (last 30 days)
  const end = fmt.dateInput(new Date());
  const start = fmt.dateInput(new Date(Date.now() - 30 * 86400000));
  document.getElementById('reportStartDate').value = start;
  document.getElementById('reportEndDate').value = end;
}

async function generateReport() {
  const farmId = state.getCurrentFarmId();
  const type = document.getElementById('reportType').value;
  const start = document.getElementById('reportStartDate').value;
  const end = document.getElementById('reportEndDate').value;
  const batchId = document.getElementById('reportBatchFilter').value;
  if (!type) { toast.error('Select a report type'); return; }

  const container = document.getElementById('reportOutput');
  container.innerHTML = `<div class="loading"><div class="spinner"></div> Generating report...</div>`;

  try {
    let data, html = '';
    const batchParam = batchId ? `&batch_id=${batchId}` : '';
    const dateParam = start && end ? `&start_date=${start}&end_date=${end}` : '';

    switch (type) {
      case 'production':
        data = await api.get(`/reports/production?farm_id=${farmId}${batchParam}${dateParam}`);
        html = renderProductionReport(data, start, end);
        break;
      case 'mortality':
        data = await api.get(`/reports/mortality?farm_id=${farmId}${batchParam}${dateParam}`);
        html = renderMortalityReport(data, start, end);
        break;
      case 'feed':
        data = await api.get(`/reports/feed-consumption?farm_id=${farmId}${batchParam}${dateParam}`);
        html = renderFeedReport(data, start, end);
        break;
      case 'financial':
        data = await api.get(`/reports/financial?farm_id=${farmId}${dateParam}`);
        html = renderFinancialReport(data, start, end);
        break;
      case 'vaccination':
        data = await api.get(`/reports/vaccination-history?farm_id=${farmId}${batchParam}`);
        html = renderVaccinationReport(data);
        break;
      case 'inventory':
        data = await api.get(`/reports/inventory-usage?farm_id=${farmId}${dateParam}`);
        html = renderInventoryReport(data, start, end);
        break;
      case 'population':
        data = await api.get(`/flocks?farm_id=${farmId}`);
        html = renderPopulationReport(data);
        break;
    }
    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = `<div class="alert alert-error">Failed to generate report: ${err.message}</div>`;
  }
}

function renderProductionReport(data, start, end) {
  const total = data.reduce((s, r) => s + r.total_collected, 0);
  const good = data.reduce((s, r) => s + r.good_eggs, 0);
  const sold = data.reduce((s, r) => s + r.eggs_sold, 0);
  return `
    <div id="printableReport">
      <h3 style="margin-bottom:16px">🥚 Egg Production Report (${fmt.date(start)} – ${fmt.date(end)})</h3>
      <div class="summary-grid" style="margin-bottom:20px">
        <div class="summary-card"><div class="summary-icon orange">🥚</div><div class="summary-info"><div class="label">Total Collected</div><div class="value">${fmt.number(total)}</div></div></div>
        <div class="summary-card"><div class="summary-icon green">✅</div><div class="summary-info"><div class="label">Good Eggs</div><div class="value">${fmt.number(good)}</div></div></div>
        <div class="summary-card"><div class="summary-icon blue">💰</div><div class="summary-info"><div class="label">Eggs Sold</div><div class="value">${fmt.number(sold)}</div></div></div>
        <div class="summary-card"><div class="summary-icon green">📦</div><div class="summary-info"><div class="label">Stock Remaining</div><div class="value">${fmt.number(good - sold)}</div></div></div>
      </div>
      <div class="table-wrapper"><table>
        <thead><tr><th>Date</th><th>Batch</th><th>Total</th><th>Good</th><th>Broken</th><th>Damaged</th><th>Sold</th></tr></thead>
        <tbody>${data.map(r => `<tr><td>${fmt.date(r.date)}</td><td>${r.batch_number}</td><td>${r.total_collected}</td><td>${r.good_eggs}</td><td>${r.broken_eggs}</td><td>${r.damaged_eggs}</td><td>${r.eggs_sold}</td></tr>`).join('') || '<tr><td colspan="7" style="text-align:center">No data</td></tr>'}</tbody>
      </table></div>
    </div>`;
}

function renderMortalityReport(data, start, end) {
  const total = data.reduce((s, r) => s + r.count, 0);
  return `
    <div id="printableReport">
      <h3 style="margin-bottom:16px">💀 Mortality Report (${fmt.date(start)} – ${fmt.date(end)})</h3>
      <div class="alert alert-error" style="margin-bottom:16px">Total Deaths: <strong>${total}</strong></div>
      <div class="table-wrapper"><table>
        <thead><tr><th>Date</th><th>Batch</th><th>Type</th><th>Count</th><th>Cause</th><th>Notes</th></tr></thead>
        <tbody>${data.map(r => `<tr><td>${fmt.date(r.date)}</td><td>${r.batch_number}</td><td>${r.poultry_type}</td><td style="color:var(--danger);font-weight:700">${r.count}</td><td>${r.cause||'-'}</td><td>${r.notes||'-'}</td></tr>`).join('') || '<tr><td colspan="6" style="text-align:center">No mortality recorded</td></tr>'}</tbody>
      </table></div>
    </div>`;
}

function renderFeedReport(data, start, end) {
  return `
    <div id="printableReport">
      <h3 style="margin-bottom:16px">🌾 Feed Consumption Report (${fmt.date(start)} – ${fmt.date(end)})</h3>
      <h4 style="margin-bottom:8px">Summary by Feed Type</h4>
      <div class="table-wrapper" style="margin-bottom:20px"><table>
        <thead><tr><th>Feed Name</th><th>Total (kg)</th><th>Total Cost</th></tr></thead>
        <tbody>${data.summary.map(s => `<tr><td>${s.feed_name}</td><td>${s.total_kg} kg</td><td>${fmt.currency(s.total_cost)}</td></tr>`).join('') || '<tr><td colspan="3" style="text-align:center">No data</td></tr>'}</tbody>
      </table></div>
      <h4 style="margin-bottom:8px">Detailed Records</h4>
      <div class="table-wrapper"><table>
        <thead><tr><th>Date</th><th>Batch</th><th>Feed</th><th>Qty (kg)</th><th>Cost</th></tr></thead>
        <tbody>${data.records.map(r => `<tr><td>${fmt.date(r.date)}</td><td>${r.batch_number}</td><td>${r.feed_name}</td><td>${r.quantity_kg}</td><td>${fmt.currency(r.cost)}</td></tr>`).join('') || '<tr><td colspan="5" style="text-align:center">No data</td></tr>'}</tbody>
      </table></div>
    </div>`;
}

function renderFinancialReport(data, start, end) {
  return `
    <div id="printableReport">
      <h3 style="margin-bottom:16px">📊 Financial Report (${fmt.date(start)} – ${fmt.date(end)})</h3>
      <div class="summary-grid" style="margin-bottom:20px">
        <div class="summary-card"><div class="summary-icon green">💰</div><div class="summary-info"><div class="label">Total Income</div><div class="value">${fmt.currency(data.total_income)}</div></div></div>
        <div class="summary-card"><div class="summary-icon red">💸</div><div class="summary-info"><div class="label">Total Expenses</div><div class="value">${fmt.currency(data.total_expenses)}</div></div></div>
        <div class="summary-card"><div class="summary-icon ${data.profit>=0?'green':'red'}">📈</div><div class="summary-info"><div class="label">Net Profit/Loss</div><div class="value ${data.profit>=0?'text-profit':'text-loss'}">${fmt.currency(data.profit)}</div></div></div>
      </div>
      <h4 style="margin-bottom:8px">Expenses</h4>
      <div class="table-wrapper" style="margin-bottom:20px"><table>
        <thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Amount</th></tr></thead>
        <tbody>${data.expenses.map(e => `<tr><td>${fmt.date(e.date)}</td><td>${e.category}</td><td>${e.description}</td><td>${fmt.currency(e.amount)}</td></tr>`).join('') || '<tr><td colspan="4" style="text-align:center">No expenses</td></tr>'}</tbody>
      </table></div>
      <h4 style="margin-bottom:8px">Income</h4>
      <div class="table-wrapper"><table>
        <thead><tr><th>Date</th><th>Source</th><th>Description</th><th>Amount</th></tr></thead>
        <tbody>${data.income.map(i => `<tr><td>${fmt.date(i.date)}</td><td>${i.source}</td><td>${i.description||'-'}</td><td style="color:var(--primary)">${fmt.currency(i.amount)}</td></tr>`).join('') || '<tr><td colspan="4" style="text-align:center">No income</td></tr>'}</tbody>
      </table></div>
    </div>`;
}

function renderVaccinationReport(data) {
  return `
    <div id="printableReport">
      <h3 style="margin-bottom:16px">💉 Vaccination History Report</h3>
      <div class="table-wrapper"><table>
        <thead><tr><th>Batch</th><th>Vaccine</th><th>Date Given</th><th>Next Due</th><th>Method</th><th>By</th><th>Status</th></tr></thead>
        <tbody>${data.map(v => `<tr><td>${v.batch_number}</td><td>${v.vaccine_name}</td><td>${fmt.date(v.date_given)}</td><td>${fmt.date(v.next_due_date)}</td><td>${v.method||'-'}</td><td>${v.administered_by||'-'}</td><td><span class="badge ${v.status==='completed'?'badge-green':'badge-orange'}">${v.status}</span></td></tr>`).join('') || '<tr><td colspan="7" style="text-align:center">No vaccination records</td></tr>'}</tbody>
      </table></div>
    </div>`;
}

function renderInventoryReport(data, start, end) {
  return `
    <div id="printableReport">
      <h3 style="margin-bottom:16px">📦 Inventory Usage Report (${fmt.date(start)} – ${fmt.date(end)})</h3>
      <div class="table-wrapper"><table>
        <thead><tr><th>Date</th><th>Item</th><th>Category</th><th>Type</th><th>Quantity</th><th>Unit</th></tr></thead>
        <tbody>${data.map(r => `<tr><td>${fmt.date(r.date)}</td><td>${r.name}</td><td>${r.category}</td><td><span class="badge ${r.type==='purchase'?'badge-green':'badge-orange'}">${r.type}</span></td><td>${r.quantity}</td><td>${r.unit}</td></tr>`).join('') || '<tr><td colspan="6" style="text-align:center">No data</td></tr>'}</tbody>
      </table></div>
    </div>`;
}

function renderPopulationReport(batches) {
  const active = batches.filter(b => b.status === 'active');
  return `
    <div id="printableReport">
      <h3 style="margin-bottom:16px">🐔 Poultry Population Report</h3>
      <div class="table-wrapper"><table>
        <thead><tr><th>Batch</th><th>Type</th><th>Breed</th><th>Initial</th><th>Current</th><th>Deaths</th><th>Mortality %</th><th>Status</th></tr></thead>
        <tbody>${batches.map(b => {
          const deaths = b.initial_count - b.current_count;
          const rate = b.initial_count > 0 ? ((deaths/b.initial_count)*100).toFixed(1) : 0;
          return `<tr><td>${b.batch_number}</td><td>${b.poultry_type}</td><td>${b.breed||'-'}</td><td>${b.initial_count}</td><td><strong>${b.current_count}</strong></td><td style="color:var(--danger)">${deaths}</td><td>${rate}%</td><td><span class="badge ${b.status==='active'?'badge-green':'badge-grey'}">${b.status}</span></td></tr>`;
        }).join('') || '<tr><td colspan="8" style="text-align:center">No batches</td></tr>'}</tbody>
        <tfoot><tr style="font-weight:700;background:var(--grey-50)"><td colspan="3">TOTAL (Active)</td><td>${active.reduce((s,b)=>s+b.initial_count,0)}</td><td>${active.reduce((s,b)=>s+b.current_count,0)}</td><td>${active.reduce((s,b)=>s+(b.initial_count-b.current_count),0)}</td><td colspan="2"></td></tr></tfoot>
      </table></div>
    </div>`;
}

function printReport() {
  const content = document.getElementById('printableReport');
  if (!content) { toast.error('Generate a report first'); return; }
  const win = window.open('', '_blank');
  win.document.write(`<html><head><title>NiaFarm Report</title><style>body{font-family:sans-serif;padding:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f5f5f5}.badge{padding:2px 8px;border-radius:12px;font-size:11px}.text-profit{color:green}.text-loss{color:red}</style></head><body>${content.outerHTML}</body></html>`);
  win.document.close();
  win.print();
}

function exportCSV() {
  const table = document.querySelector('#reportOutput table');
  if (!table) { toast.error('Generate a report first'); return; }
  const rows = Array.from(table.querySelectorAll('tr'));
  const csv = rows.map(row => Array.from(row.querySelectorAll('th,td')).map(cell => `"${cell.textContent.trim()}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'niafarm_report.csv'; a.click();
}
