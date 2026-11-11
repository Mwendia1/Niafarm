// ===== INVENTORY MODULE =====
let editingInventoryId = null;

async function loadInventory() {
  const farmId = state.getCurrentFarmId();
  if (!farmId) return;
  try {
    const [items, lowStock, expiring] = await Promise.all([
      api.get(`/inventory?farm_id=${farmId}`),
      api.get(`/inventory/alerts/low-stock?farm_id=${farmId}`),
      api.get(`/inventory/alerts/expiring?farm_id=${farmId}&days=30`)
    ]);
    renderInventoryAlerts(lowStock, expiring);
    renderInventoryTable(items);
    loadAmenitiesDropdown(farmId);
  } catch (err) { toast.error('Failed to load inventory: ' + err.message); }
}

async function loadAmenitiesDropdown(farmId) {
  try {
    const farm = state.currentFarm;
    if (!farm) return;
    const houses = await api.get(`/farms/${farm.uuid}/houses`);
    const sel = document.getElementById('amenitiesDropdown');
    if (!sel) return;
    sel.innerHTML = `<option value="">🏠 Farm Amenities (${houses.length})</option>` +
      houses.map(h => `<option value="${h.uuid}" data-house='${JSON.stringify(h).replace(/'/g, "&apos;")}'>${h.name} (cap: ${h.capacity})</option>`).join('');
    if (!houses.length) sel.innerHTML = `<option value="">🏠 No houses added</option>`;
  } catch {}
}

function openAmenity(sel) {
  const opt = sel.options[sel.selectedIndex];
  if (!opt.value) return;
  try {
    const h = JSON.parse(opt.dataset.house.replace(/&apos;/g, "'"));
    const content = `
      <div style="display:flex;flex-direction:column;gap:10px">
        <div style="display:flex;justify-content:space-between"><span style="color:var(--grey-600)">Name</span><strong>${h.name}</strong></div>
        <div style="display:flex;justify-content:space-between"><span style="color:var(--grey-600)">Capacity</span><strong>${fmt.number(h.capacity)} birds</strong></div>
        <div style="display:flex;justify-content:space-between"><span style="color:var(--grey-600)">Description</span><strong>${h.description || '-'}</strong></div>
        <div style="display:flex;justify-content:space-between"><span style="color:var(--grey-600)">Added</span><strong>${fmt.date(h.created_at)}</strong></div>
      </div>`;
    document.getElementById('amenityModalTitle').textContent = `🏠 ${h.name}`;
    document.getElementById('amenityModalContent').innerHTML = content;
    modal.open('amenityModal');
  } catch {}
  sel.value = '';
}

function renderInventoryAlerts(lowStock, expiring) {
  const el = document.getElementById('inventoryAlerts');
  const alerts = [];
  if (lowStock.length) alerts.push(`<div class="alert alert-warning"> ${lowStock.length} item(s) are low on stock: ${lowStock.map(i => i.name).join(', ')}</div>`);
  if (expiring.length) alerts.push(`<div class="alert alert-error"> ${expiring.length} item(s) expiring within 30 days: ${expiring.map(i => i.name).join(', ')}</div>`);
  el.innerHTML = alerts.join('');
}

function renderInventoryTable(items) {
  const tbody = document.getElementById('inventoryTableBody');
  if (!items.length) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><div class="empty-icon"></div><h4>No inventory items</h4><p>Click "Add Item" to start tracking inventory</p></div></td></tr>`;
    return;
  }
  const catIcons = { feeds:'', vaccines:'', medicines:'', feeders:'', drinkers:'', equipment:'', cleaning:'', packaging:'' };
  tbody.innerHTML = items.map(item => {
    const isLow = item.quantity <= item.low_stock_threshold;
    const isExpiring = item.expiry_date && new Date(item.expiry_date) <= new Date(Date.now() + 30 * 86400000);
    return `
    <tr style="${isLow ? 'background:var(--warning-light)' : ''}">
      <td>${catIcons[item.category] || ''} ${item.name}</td>
      <td><span class="badge badge-grey">${item.category}</span></td>
      <td>
        <strong style="color:${isLow ? 'var(--danger)' : 'var(--grey-900)'}">${item.quantity} ${item.unit}</strong>
        ${isLow ? '<span class="badge badge-red" style="margin-left:4px">Low</span>' : ''}
      </td>
      <td>${fmt.currency(item.purchase_price)}</td>
      <td>${item.supplier || '-'}</td>
      <td style="color:${isExpiring ? 'var(--danger)' : ''}">${fmt.date(item.expiry_date)}</td>
      <td>${fmt.date(item.purchase_date)}</td>
      <td>
        <button class="btn btn-sm btn-primary" onclick="openTransactionModal('${item.uuid}', '${item.name}')"> Stock</button>
        <button class="btn btn-sm btn-outline" onclick="editInventoryItem('${item.uuid}')"></button>
        <button class="btn btn-sm btn-danger" onclick="deleteInventoryItem('${item.uuid}', '${item.name}')"></button>
      </td>
    </tr>`;
  }).join('');
}

function openAddInventoryModal() {
  editingInventoryId = null;
  document.getElementById('inventoryModalTitle').textContent = 'Add Inventory Item';
  resetForm('inventoryForm');
  document.getElementById('invPurchaseDate').value = fmt.dateInput(new Date());
  modal.open('inventoryModal');
}

async function editInventoryItem(uuid) {
  try {
    const item = await api.get(`/inventory/${uuid}`);
    editingInventoryId = uuid;
    document.getElementById('inventoryModalTitle').textContent = 'Edit Inventory Item';
    setFormData('inventoryForm', {
      name: item.name, category: item.category, unit: item.unit,
      purchase_price: item.purchase_price, supplier: item.supplier,
      expiry_date: fmt.dateInput(item.expiry_date), low_stock_threshold: item.low_stock_threshold, notes: item.notes
    });
    modal.open('inventoryModal');
  } catch (err) { toast.error(err.message); }
}

async function saveInventoryItem() {
  const data = getFormData('inventoryForm');
  data.farm_id = state.getCurrentFarmId();
  if (!data.name || !data.category || !data.unit) { toast.error('Name, category and unit required'); return; }
  try {
    if (editingInventoryId) {
      await api.put(`/inventory/${editingInventoryId}`, data);
      toast.success('Item updated');
    } else {
      await api.post('/inventory', data);
      toast.success('Item added to inventory');
    }
    modal.close('inventoryModal');
    await loadInventory();
  } catch (err) { toast.error(err.message); }
}

async function deleteInventoryItem(uuid, name) {
  confirmAction(`Delete "${name}" from inventory?`, async () => {
    try { await api.delete(`/inventory/${uuid}`); toast.success('Item deleted'); await loadInventory(); }
    catch (err) { toast.error(err.message); }
  });
}

let transactionItemUuid = null;
function openTransactionModal(uuid, name) {
  transactionItemUuid = uuid;
  document.getElementById('transactionItemName').textContent = name;
  resetForm('transactionForm');
  document.getElementById('transactionDate').value = fmt.dateInput(new Date());
  modal.open('transactionModal');
}

async function saveTransaction() {
  const data = getFormData('transactionForm');
  if (!data.type || !data.quantity) { toast.error('Type and quantity required'); return; }
  try {
    const result = await api.post(`/inventory/${transactionItemUuid}/transaction`, data);
    toast.success(`Transaction recorded. New quantity: ${result.new_quantity}`);
    modal.close('transactionModal');
    await loadInventory();
  } catch (err) { toast.error(err.message); }
}

function toggleInventoryMenu(e) {
  e.stopPropagation();
  const sub = document.getElementById('inventorySubMenu');
  const arrow = document.getElementById('inventoryArrow');
  const open = sub.style.display === 'block';
  sub.style.display = open ? 'none' : 'block';
  arrow.style.transform = open ? '' : 'rotate(180deg)';
  if (!open) navigate('inventory');
}

async function openAmenitiesPanel() {
  modal.open('amenitiesPanelModal');
  const el = document.getElementById('amenitiesPanelContent');
  try {
    const farm = state.currentFarm;
    if (!farm) { el.innerHTML = '<p class="text-muted">No farm selected.</p>'; return; }
    const houses = await api.get(`/farms/${farm.uuid}/houses`);
    if (!houses.length) {
      el.innerHTML = `<div class="empty-state"><div class="empty-icon">🏠</div><h4>No amenities added</h4><p>Add houses from Farm Registration page.</p></div>`;
      return;
    }
    el.innerHTML = houses.map(h => `
      <div style="display:flex;align-items:center;gap:12px;padding:12px;border:1px solid var(--grey-200);border-radius:8px;margin-bottom:8px">
        <div style="font-size:28px">🏠</div>
        <div style="flex:1">
          <div style="font-weight:600;font-size:14px">${h.name}</div>
          <div style="font-size:12px;color:var(--grey-600)">Capacity: ${fmt.number(h.capacity)} birds</div>
          ${h.description ? `<div style="font-size:12px;color:var(--grey-500)">${h.description}</div>` : ''}
        </div>
        <div class="badge badge-green">Active</div>
      </div>`).join('');
  } catch (err) { el.innerHTML = `<div class="alert alert-error">${err.message}</div>`; }
}
  const q = document.getElementById('inventorySearch').value.toLowerCase();
  const cat = document.getElementById('inventoryCatFilter').value;
  document.querySelectorAll('#inventoryTableBody tr').forEach(row => {
    const text = row.textContent.toLowerCase();
    row.style.display = (!q || text.includes(q)) && (!cat || text.includes(cat)) ? '' : 'none';
  });
}
