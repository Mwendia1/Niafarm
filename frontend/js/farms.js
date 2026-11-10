// ===== FARMS MODULE =====
let editingFarmId = null;

async function loadFarmsPage() {
  try {
    const farms = await api.get('/farms');
    state.setFarms(farms);
    renderFarmsTable(farms);
  } catch (err) { toast.error('Failed to load farms: ' + err.message); }
}

function renderFarmsTable(farms) {
  const tbody = document.getElementById('farmsTableBody');
  if (!farms.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">🏡</div><h4>No farms registered</h4><p>Click "Add Farm" to register your first farm</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = farms.map(f => `
    <tr>
      <td><strong>${f.name}</strong></td>
      <td>${f.location || '-'}</td>
      <td>${f.owner_name || '-'}</td>
      <td>${f.farming_type || '-'}</td>
      <td>${f.phone || '-'}</td>
      <td>${fmt.date(f.registration_date)}</td>
      <td>
        <button class="btn btn-sm btn-outline" onclick="editFarm('${f.uuid}')">✏️ Edit</button>
        <button class="btn btn-sm btn-danger" onclick="deleteFarm('${f.uuid}', '${f.name}')">🗑️</button>
      </td>
    </tr>
  `).join('');
}

function openAddFarmModal() {
  editingFarmId = null;
  document.getElementById('farmModalTitle').textContent = 'Register New Farm';
  resetForm('farmForm');
  document.getElementById('farmRegDate').value = fmt.dateInput(new Date());
  modal.open('farmModal');
}

async function editFarm(uuid) {
  try {
    const farm = await api.get(`/farms/${uuid}`);
    editingFarmId = uuid;
    document.getElementById('farmModalTitle').textContent = 'Edit Farm';
    setFormData('farmForm', {
      name: farm.name, location: farm.location, owner_name: farm.owner_name,
      phone: farm.phone, email: farm.email, size: farm.size,
      farming_type: farm.farming_type, num_houses: farm.num_houses,
      registration_date: fmt.dateInput(farm.registration_date)
    });
    modal.open('farmModal');
  } catch (err) { toast.error('Failed to load farm: ' + err.message); }
}

async function saveFarm() {
  const data = getFormData('farmForm');
  if (!data.name) { toast.error('Farm name is required'); return; }
  try {
    if (editingFarmId) {
      await api.put(`/farms/${editingFarmId}`, data);
      toast.success('Farm updated successfully');
    } else {
      await api.post('/farms', data);
      toast.success('Farm registered successfully');
    }
    modal.close('farmModal');
    await loadFarmsPage();
    await loadFarms(); // refresh selector
  } catch (err) { toast.error(err.message); }
}

function deleteFarm(uuid, name) {
  confirmAction(`Delete farm "${name}"? This cannot be undone.`, async () => {
    try {
      await api.delete(`/farms/${uuid}`);
      toast.success('Farm deleted');
      await loadFarmsPage();
      await loadFarms();
    } catch (err) { toast.error(err.message); }
  });
}

// Farm selector change
document.getElementById('farmSelector').addEventListener('change', async (e) => {
  const farm = state.farms.find(f => f.id == e.target.value);
  if (farm) {
    state.setCurrentFarm(farm);
    await populateBatchSelects(farm.id);
    loadPage(getCurrentPage());
  }
});

function getCurrentPage() {
  const active = document.querySelector('.page.active');
  return active ? active.id.replace('page-', '') : 'dashboard';
}
