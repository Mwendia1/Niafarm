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
  } catch (err) { toast.error('Failed to load inventory: ' + err.message); }
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
        <button class="btn btn-sm btn-outline" onclick="openTransactionModal('${item.uuid}', '${item.name}')"> Stock</button>
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

function filterInventory() {
  const q = document.getElementById('inventorySearch').value.toLowerCase();
  const cat = document.getElementById('inventoryCatFilter').value;
  document.querySelectorAll('#inventoryTableBody tr').forEach(row => {
    const text = row.textContent.toLowerCase();
    row.style.display = (!q || text.includes(q)) && (!cat || text.includes(cat)) ? '' : 'none';
  });
}
