// ===== FEEDING MODULE =====
async function loadFeeding() {
  const farmId = state.getCurrentFarmId();
  if (!farmId) return;
  await populateBatchSelects(farmId);
  try {
    const records = await api.get(`/feeding?farm_id=${farmId}`);
    renderFeedingTable(records);
    loadFeedSummary(farmId);
  } catch (err) { toast.error('Failed to load feeding records: ' + err.message); }
}

async function loadFeedSummary(farmId) {
  try {
    const inv = await api.get(`/inventory?farm_id=${farmId}&category=feeds`);
    const totalStock = inv.reduce((s, i) => s + i.quantity, 0);
    document.getElementById('feedStockTotal').textContent = `${fmt.number(totalStock)} kg`;
  } catch {}
}

function renderFeedingTable(records) {
  const tbody = document.getElementById('feedingTableBody');
  if (!records.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">🌾</div><h4>No feeding records</h4><p>Click "Record Feeding" to add a record</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = records.map(r => `
    <tr>
      <td>${fmt.date(r.date)}</td>
      <td>${r.batch_number}</td>
      <td>${r.feed_name}</td>
      <td><strong>${r.quantity_kg} kg</strong></td>
      <td>${fmt.currency(r.cost)}</td>
      <td>${r.notes || '-'}</td>
      <td><button class="btn btn-sm btn-danger" onclick="deleteFeedRecord(${r.id})">🗑️</button></td>
    </tr>
  `).join('');
}

function openAddFeedModal() {
  resetForm('feedForm');
  document.getElementById('feedDate').value = fmt.dateInput(new Date());
  modal.open('feedModal');
}

async function saveFeedRecord() {
  const data = getFormData('feedForm');
  data.farm_id = state.getCurrentFarmId();
  if (!data.batch_id || !data.feed_name || !data.quantity_kg || !data.date) {
    toast.error('Please fill all required fields'); return;
  }
  try {
    await api.post('/feeding', data);
    toast.success('Feeding record saved');
    modal.close('feedModal');
    await loadFeeding();
  } catch (err) { toast.error(err.message); }
}

async function deleteFeedRecord(id) {
  confirmAction('Delete this feeding record?', async () => {
    try {
      // No delete endpoint needed — just reload; add if needed
      toast.warning('Delete not implemented for feed records to preserve history');
    } catch (err) { toast.error(err.message); }
  });
}

// FCR Calculator
async function calculateFCR() {
  const batchId = document.getElementById('fcrBatchSelect').value;
  if (!batchId) { toast.error('Select a batch'); return; }
  try {
    const result = await api.get(`/feeding/fcr?batch_id=${batchId}`);
    document.getElementById('fcrResult').innerHTML = `
      <div class="alert alert-info">
        <div><strong>Total Feed Used:</strong> ${result.total_feed_kg} kg</div>
        <div><strong>Birds Grown:</strong> ${result.birds_grown}</div>
        <div><strong>Estimated Weight:</strong> ${result.estimated_weight_kg} kg</div>
        <div style="margin-top:8px;font-size:16px"><strong>FCR: ${result.fcr}</strong>
          <span style="font-size:12px;color:var(--grey-600)"> (Lower is better. Target: 1.6–2.0 for broilers)</span>
        </div>
      </div>
    `;
  } catch (err) { toast.error(err.message); }
}

// Schedules
async function loadFeedSchedules() {
  const farmId = state.getCurrentFarmId();
  if (!farmId) return;
  try {
    const schedules = await api.get(`/feeding/schedules?farm_id=${farmId}`);
    const tbody = document.getElementById('scheduleTableBody');
    if (!schedules.length) {
      tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="empty-icon">📅</div><p>No schedules set</p></div></td></tr>`;
      return;
    }
    tbody.innerHTML = schedules.map(s => `
      <tr>
        <td>${s.batch_number}</td>
        <td>${s.feed_type}</td>
        <td>${s.quantity_kg} kg</td>
        <td>${s.frequency}</td>
        <td>${s.time_of_day || '-'}</td>
        <td><span class="badge badge-green">Active</span></td>
      </tr>
    `).join('');
  } catch {}
}

function openAddScheduleModal() {
  resetForm('scheduleForm');
  modal.open('scheduleModal');
}

async function saveSchedule() {
  const data = getFormData('scheduleForm');
  data.farm_id = state.getCurrentFarmId();
  if (!data.batch_id || !data.feed_type || !data.quantity_kg || !data.frequency) {
    toast.error('Please fill all required fields'); return;
  }
  try {
    await api.post('/feeding/schedules', data);
    toast.success('Schedule created');
    modal.close('scheduleModal');
    await loadFeedSchedules();
  } catch (err) { toast.error(err.message); }
}

function filterFeedRecords() {
  const q = document.getElementById('feedSearch').value.toLowerCase();
  document.querySelectorAll('#feedingTableBody tr').forEach(row => {
    row.style.display = !q || row.textContent.toLowerCase().includes(q) ? '' : 'none';
  });
}
