// ===== FLOCKS MODULE =====
let editingBatchId = null;

async function loadFlocks() {
  const farmId = state.getCurrentFarmId();
  if (!farmId) return;
  try {
    const batches = await api.get(`/flocks?farm_id=${farmId}`);
    state.batches = batches;
    renderBatchCards(batches);
    renderBatchesTable(batches);
  } catch (err) { toast.error('Failed to load flocks: ' + err.message); }
}

function renderBatchCards(batches) {
  const active = batches.filter(b => b.status === 'active');
  document.getElementById('flockSummary').innerHTML = `
    <div class="summary-grid" style="margin-bottom:0">
      <div class="summary-card"><div class="summary-icon green"></div><div class="summary-info"><div class="label">Active Batches</div><div class="value">${active.length}</div></div></div>
      <div class="summary-card"><div class="summary-icon blue"></div><div class="summary-info"><div class="label">Total Birds</div><div class="value">${fmt.number(active.reduce((s,b)=>s+b.current_count,0))}</div></div></div>
      <div class="summary-card"><div class="summary-icon orange"></div><div class="summary-info"><div class="label">Initial Count</div><div class="value">${fmt.number(active.reduce((s,b)=>s+b.initial_count,0))}</div></div></div>
      <div class="summary-card"><div class="summary-icon red"></div><div class="summary-info"><div class="label">Total Deaths</div><div class="value">${fmt.number(active.reduce((s,b)=>s+(b.initial_count-b.current_count),0))}</div></div></div>
    </div>
  `;
}

function renderBatchesTable(batches) {
  const tbody = document.getElementById('batchesTableBody');
  if (!batches.length) {
    tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state"><div class="empty-icon"></div><h4>No batches registered</h4><p>Click "Add Batch" to register your first flock</p></div></td></tr>`;
    return;
  }
  const typeColors = { Broilers: 'badge-orange', Layers: 'badge-blue', Kienyeji: 'badge-green' };
  tbody.innerHTML = batches.map(b => {
    const mortality = b.initial_count - b.current_count;
    const mortalityRate = b.initial_count > 0 ? ((mortality / b.initial_count) * 100).toFixed(1) : 0;
    return `
    <tr>
      <td><strong>${b.batch_number}</strong></td>
      <td><span class="badge ${typeColors[b.poultry_type] || 'badge-grey'}">${b.poultry_type}</span></td>
      <td>${b.breed || '-'}</td>
      <td>${fmt.number(b.initial_count)}</td>
      <td><strong>${fmt.number(b.current_count)}</strong></td>
      <td><span style="color:var(--danger)">${mortality} (${mortalityRate}%)</span></td>
      <td>${fmt.date(b.arrival_date)}</td>
      <td><span class="badge ${b.status === 'active' ? 'badge-green' : 'badge-grey'}">${b.status}</span></td>
      <td>
        <button class="btn btn-sm btn-outline" onclick="viewBatch('${b.uuid}')"> View</button>
        <button class="btn btn-sm btn-outline" onclick="editBatch('${b.uuid}')"> Edit</button>
        <button class="btn btn-sm btn-warning" onclick="openMortalityModal('${b.uuid}', '${b.batch_number}')"> Mortality</button>
        <button class="btn btn-sm btn-danger" onclick="closeBatch('${b.uuid}', '${b.batch_number}')"> Close</button>
        <button class="btn btn-sm btn-danger" onclick="deleteBatch('${b.uuid}', '${b.batch_number}')"> Delete</button>
      </td>
    </tr>`;
  }).join('');
}

function openAddBatchModal() {
  editingBatchId = null;
  document.getElementById('batchModalTitle').textContent = 'Add New Batch';
  resetForm('batchForm');
  document.getElementById('batchArrivalDate').value = fmt.dateInput(new Date());
  modal.open('batchModal');
}

async function editBatch(uuid) {
  try {
    const batch = await api.get(`/flocks/${uuid}`);
    editingBatchId = uuid;
    document.getElementById('batchModalTitle').textContent = 'Edit Batch';
    setFormData('batchForm', {
      batch_number: batch.batch_number, poultry_type: batch.poultry_type, breed: batch.breed,
      initial_count: batch.initial_count, arrival_date: fmt.dateInput(batch.arrival_date),
      age_weeks: batch.age_weeks, supplier: batch.supplier, purchase_price: batch.purchase_price,
      status: batch.status, notes: batch.notes
    });
    modal.open('batchModal');
  } catch (err) { toast.error('Failed to load batch: ' + err.message); }
}

async function saveBatch() {
  const data = getFormData('batchForm');
  data.farm_id = state.getCurrentFarmId();
  if (!data.batch_number || !data.poultry_type || !data.initial_count || !data.arrival_date) {
    toast.error('Please fill all required fields'); return;
  }
  try {
    if (editingBatchId) {
      await api.put(`/flocks/${editingBatchId}`, data);
      toast.success('Batch updated');
    } else {
      await api.post('/flocks', data);
      toast.success('Batch added successfully');
    }
    modal.close('batchModal');
    await loadFlocks();
    await populateBatchSelects(data.farm_id);
  } catch (err) { toast.error(err.message); }
}

async function viewBatch(uuid) {
  try {
    const batch = await api.get(`/flocks/${uuid}`);
    const mortality = await api.get(`/flocks/${uuid}/mortality`);
    const totalDeaths = mortality.reduce((s, m) => s + m.count, 0);
    document.getElementById('batchDetailContent').innerHTML = `
      <div class="form-grid">
        <div><strong>Batch Number:</strong><p>${batch.batch_number}</p></div>
        <div><strong>Type:</strong><p>${batch.poultry_type}</p></div>
        <div><strong>Breed:</strong><p>${batch.breed || '-'}</p></div>
        <div><strong>Initial Count:</strong><p>${fmt.number(batch.initial_count)}</p></div>
        <div><strong>Current Count:</strong><p style="color:var(--primary);font-weight:700">${fmt.number(batch.current_count)}</p></div>
        <div><strong>Total Deaths:</strong><p style="color:var(--danger)">${fmt.number(totalDeaths)}</p></div>
        <div><strong>Arrival Date:</strong><p>${fmt.date(batch.arrival_date)}</p></div>
        <div><strong>Age (weeks):</strong><p>${batch.age_weeks || '-'}</p></div>
        <div><strong>Supplier:</strong><p>${batch.supplier || '-'}</p></div>
        <div><strong>Purchase Price:</strong><p>${fmt.currency(batch.purchase_price)}</p></div>
        <div><strong>House:</strong><p>${batch.house_name || '-'}</p></div>
        <div><strong>Status:</strong><p><span class="badge ${batch.status === 'active' ? 'badge-green' : 'badge-grey'}">${batch.status}</span></p></div>
      </div>
      ${batch.notes ? `<div style="margin-top:12px"><strong>Notes:</strong><p>${batch.notes}</p></div>` : ''}
      <h4 style="margin-top:20px;margin-bottom:12px">Mortality Records</h4>
      ${mortality.length ? `<table><thead><tr><th>Date</th><th>Count</th><th>Cause</th><th>Notes</th></tr></thead><tbody>
        ${mortality.map(m => `<tr><td>${fmt.date(m.date)}</td><td style="color:var(--danger)">${m.count}</td><td>${m.cause || '-'}</td><td>${m.notes || '-'}</td></tr>`).join('')}
      </tbody></table>` : '<p class="text-muted">No mortality records</p>'}
    `;
    modal.open('batchDetailModal');
  } catch (err) { toast.error(err.message); }
}

let mortalityBatchUuid = null;
function openMortalityModal(uuid, batchNumber) {
  mortalityBatchUuid = uuid;
  document.getElementById('mortalityBatchName').textContent = batchNumber;
  resetForm('mortalityForm');
  document.getElementById('mortalityDate').value = fmt.dateInput(new Date());
  modal.open('mortalityModal');
}

async function saveMortality() {
  const data = getFormData('mortalityForm');
  if (!data.count || data.count <= 0) { toast.error('Enter a valid count'); return; }
  try {
    await api.post(`/flocks/${mortalityBatchUuid}/mortality`, data);
    toast.success('Mortality recorded');
    modal.close('mortalityModal');
    await loadFlocks();
  } catch (err) { toast.error(err.message); }
}

function closeBatch(uuid, name) {
  confirmAction(`Close batch "${name}"? This will mark it as closed.`, async () => {
    try {
      await api.delete(`/flocks/${uuid}`);
      toast.success('Batch closed');
      await loadFlocks();
    } catch (err) { toast.error(err.message); }
  });
}

function filterBatches() {
  const q = document.getElementById('batchSearch').value.toLowerCase();
  const type = document.getElementById('batchTypeFilter').value;
  const rows = document.querySelectorAll('#batchesTableBody tr');
  rows.forEach(row => {
    const text = row.textContent.toLowerCase();
    const matchQ = !q || text.includes(q);
    const matchType = !type || text.includes(type.toLowerCase());
    row.style.display = matchQ && matchType ? '' : 'none';
  });
}
