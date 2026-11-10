// ===== HEALTH & VACCINATION MODULE =====
async function loadHealth() {
  const farmId = state.getCurrentFarmId();
  if (!farmId) return;
  await populateBatchSelects(farmId);
  try {
    const [records, vaccinations] = await Promise.all([
      api.get(`/health?farm_id=${farmId}`),
      api.get(`/health/vaccinations?farm_id=${farmId}`)
    ]);
    renderHealthTable(records);
    renderVaccinationTable(vaccinations);
    renderVaccinationCalendar(vaccinations);
  } catch (err) { toast.error('Failed to load health records: ' + err.message); }
}

function renderHealthTable(records) {
  const tbody = document.getElementById('healthTableBody');
  if (!records.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon"></div><h4>No health records</h4><p>Click "Add Health Record" to start tracking</p></div></td></tr>`;
    return;
  }
  const typeColors = { disease: 'badge-red', treatment: 'badge-blue', checkup: 'badge-green', injury: 'badge-orange' };
  tbody.innerHTML = records.map(r => `
    <tr>
      <td>${fmt.date(r.date)}</td>
      <td>${r.batch_number}</td>
      <td><span class="badge ${typeColors[r.type] || 'badge-grey'}">${r.type}</span></td>
      <td>${r.description || '-'}</td>
      <td>${r.medication || '-'}</td>
      <td>${fmt.currency(r.cost)}</td>
      <td>
        <button class="btn btn-sm btn-outline" onclick="editHealthRecord('${r.uuid}')"></button>
        <button class="btn btn-sm btn-danger" onclick="deleteHealthRecord('${r.uuid}')"></button>
      </td>
    </tr>
  `).join('');
}

function renderVaccinationTable(vaccinations) {
  const tbody = document.getElementById('vaccinationTableBody');
  if (!vaccinations.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon"></div><h4>No vaccination records</h4></div></td></tr>`;
    return;
  }
  const today = new Date();
  tbody.innerHTML = vaccinations.map(v => {
    const due = v.next_due_date ? new Date(v.next_due_date) : null;
    const isOverdue = due && due < today && v.status !== 'completed';
    const isDueSoon = due && !isOverdue && (due - today) < 7 * 86400000;
    let statusBadge = `<span class="badge badge-grey">${v.status}</span>`;
    if (v.status === 'completed') statusBadge = `<span class="badge badge-green"> Completed</span>`;
    else if (isOverdue) statusBadge = `<span class="badge badge-red"> Overdue</span>`;
    else if (isDueSoon) statusBadge = `<span class="badge badge-orange"> Due Soon</span>`;
    return `
    <tr style="${isOverdue ? 'background:var(--danger-light)' : isDueSoon ? 'background:var(--warning-light)' : ''}">
      <td>${v.batch_number}</td>
      <td><strong>${v.vaccine_name}</strong></td>
      <td>${fmt.date(v.date_given)}</td>
      <td>${fmt.date(v.next_due_date)}</td>
      <td>${v.administered_by || '-'}</td>
      <td>${statusBadge}</td>
      <td>
        <button class="btn btn-sm btn-outline" onclick="markVaccinationDone('${v.uuid}')"> Done</button>
        <button class="btn btn-sm btn-danger" onclick="deleteVaccination('${v.uuid}')"></button>
      </td>
    </tr>`;
  }).join('');
}

function renderVaccinationCalendar(vaccinations) {
  const el = document.getElementById('vaccinationCalendar');
  if (!el) return;
  const upcoming = vaccinations.filter(v => v.next_due_date && v.status !== 'completed').sort((a, b) => new Date(a.next_due_date) - new Date(b.next_due_date));
  if (!upcoming.length) { el.innerHTML = '<p class="text-muted">No upcoming vaccinations scheduled</p>'; return; }
  const today = new Date();
  el.innerHTML = upcoming.map(v => {
    const due = new Date(v.next_due_date);
    const daysLeft = Math.ceil((due - today) / 86400000);
    const color = daysLeft < 0 ? 'var(--danger)' : daysLeft <= 3 ? 'var(--warning)' : 'var(--primary)';
    return `
      <div style="display:flex;align-items:center;gap:12px;padding:10px;border-radius:8px;border:1px solid var(--grey-200);margin-bottom:8px">
        <div style="width:48px;height:48px;border-radius:8px;background:${color};color:white;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:11px;font-weight:700">
          <span>${due.getDate()}</span><span>${due.toLocaleString('default',{month:'short'})}</span>
        </div>
        <div style="flex:1">
          <div style="font-weight:600">${v.vaccine_name}</div>
          <div style="font-size:12px;color:var(--grey-600)">Batch: ${v.batch_number}</div>
        </div>
        <div style="font-size:12px;color:${color};font-weight:600">${daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : daysLeft === 0 ? 'Today!' : `${daysLeft}d left`}</div>
      </div>`;
  }).join('');
}

function openAddHealthModal() {
  resetForm('healthForm');
  document.getElementById('healthDate').value = fmt.dateInput(new Date());
  modal.open('healthModal');
}

async function saveHealthRecord() {
  const data = getFormData('healthForm');
  data.farm_id = state.getCurrentFarmId();
  if (!data.batch_id || !data.date || !data.type) { toast.error('Please fill required fields'); return; }
  try {
    await api.post('/health', data);
    toast.success('Health record saved');
    modal.close('healthModal');
    await loadHealth();
  } catch (err) { toast.error(err.message); }
}

async function deleteHealthRecord(uuid) {
  confirmAction('Delete this health record?', async () => {
    try { await api.delete(`/health/${uuid}`); toast.success('Record deleted'); await loadHealth(); }
    catch (err) { toast.error(err.message); }
  });
}

function openAddVaccinationModal() {
  resetForm('vaccinationForm');
  document.getElementById('vacDateGiven').value = fmt.dateInput(new Date());
  modal.open('vaccinationModal');
}

async function saveVaccination() {
  const data = getFormData('vaccinationForm');
  data.farm_id = state.getCurrentFarmId();
  if (!data.batch_id || !data.vaccine_name) { toast.error('Batch and vaccine name required'); return; }
  try {
    await api.post('/health/vaccinations', data);
    toast.success('Vaccination record saved');
    modal.close('vaccinationModal');
    await loadHealth();
    loadNotificationCount();
  } catch (err) { toast.error(err.message); }
}

async function markVaccinationDone(uuid) {
  try {
    await api.put(`/health/vaccinations/${uuid}`, { status: 'completed', date_given: fmt.dateInput(new Date()) });
    toast.success('Vaccination marked as completed');
    await loadHealth();
  } catch (err) { toast.error(err.message); }
}

async function deleteVaccination(uuid) {
  confirmAction('Delete this vaccination record?', async () => {
    try { await api.delete(`/health/vaccinations/${uuid}`); toast.success('Deleted'); await loadHealth(); }
    catch (err) { toast.error(err.message); }
  });
}

async function showVaccinationTemplates() {
  try {
    const data = await api.get('/health/vaccination-templates');
    const type = document.getElementById('templateType').value || 'broiler';
    const templates = data.templates[type] || [];
    document.getElementById('templateDisclaimer').textContent = data.disclaimer;
    document.getElementById('templateTableBody').innerHTML = templates.map(t => `
      <tr>
        <td>Day ${t.day}</td>
        <td><strong>${t.vaccine}</strong></td>
        <td>${t.method}</td>
        <td>${t.notes}</td>
      </tr>
    `).join('');
    modal.open('templateModal');
  } catch (err) { toast.error(err.message); }
}
