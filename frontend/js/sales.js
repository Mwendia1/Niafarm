// ===== SALES MODULE =====
let saleItems = [];

async function loadSales() {
  const farmId = state.getCurrentFarmId();
  if (!farmId) return;
  await populateBatchSelects(farmId);
  try {
    const [sales, customers] = await Promise.all([
      api.get(`/sales?farm_id=${farmId}`),
      api.get(`/sales/customers?farm_id=${farmId}`)
    ]);
    renderSalesSummary(sales);
    renderSalesTable(sales);
    renderCustomersTable(customers);
  } catch (err) { toast.error('Failed to load sales: ' + err.message); }
}

function renderSalesSummary(sales) {
  const total = sales.reduce((s, sale) => s + sale.total_amount, 0);
  const paid = sales.filter(s => s.payment_status === 'paid').reduce((s, sale) => s + sale.total_amount, 0);
  const unpaid = total - paid;
  document.getElementById('salesSummaryCards').innerHTML = `
    <div class="summary-grid" style="margin-bottom:0">
      <div class="summary-card"><div class="summary-icon green"></div><div class="summary-info"><div class="label">Total Sales</div><div class="value">${fmt.currency(total)}</div></div></div>
      <div class="summary-card"><div class="summary-icon blue"></div><div class="summary-info"><div class="label">Paid</div><div class="value">${fmt.currency(paid)}</div></div></div>
      <div class="summary-card"><div class="summary-icon red"></div><div class="summary-info"><div class="label">Outstanding</div><div class="value">${fmt.currency(unpaid)}</div></div></div>
      <div class="summary-card"><div class="summary-icon orange"></div><div class="summary-info"><div class="label">Total Transactions</div><div class="value">${sales.length}</div></div></div>
    </div>
  `;
}

function renderSalesTable(sales) {
  const tbody = document.getElementById('salesTableBody');
  if (!sales.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon"></div><h4>No sales recorded</h4><p>Click "New Sale" to record a sale</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = sales.map(s => `
    <tr>
      <td>${fmt.date(s.sale_date)}</td>
      <td>${s.customer_name || s.customer_name_ref || 'Walk-in'}</td>
      <td>${s.items?.map(i => i.description || i.product_type).join(', ') || '-'}</td>
      <td><strong>${fmt.currency(s.total_amount)}</strong></td>
      <td>${s.payment_method}</td>
      <td><span class="badge ${s.payment_status === 'paid' ? 'badge-green' : 'badge-red'}">${s.payment_status}</span></td>
      <td>
        <button class="btn btn-sm btn-outline" onclick="viewSaleReceipt('${s.uuid}')"> Receipt</button>
        ${s.payment_status !== 'paid' ? `<button class="btn btn-sm btn-primary" onclick="markSalePaid('${s.uuid}', ${s.total_amount})"> Mark Paid</button>` : ''}
      </td>
    </tr>
  `).join('');
}

function renderCustomersTable(customers) {
  const tbody = document.getElementById('customersTableBody');
  if (!customers.length) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><div class="empty-icon"></div><h4>No customers registered</h4></div></td></tr>`;
    return;
  }
  tbody.innerHTML = customers.map(c => `
    <tr>
      <td><strong>${c.name}</strong></td>
      <td>${c.phone || '-'}</td>
      <td>${c.email || '-'}</td>
      <td><span class="badge badge-grey">${c.customer_type}</span></td>
      <td>
        <button class="btn btn-sm btn-outline" onclick="editCustomer('${c.uuid}')"></button>
        <button class="btn btn-sm btn-danger" onclick="deleteCustomer('${c.uuid}', '${c.name}')"></button>
      </td>
    </tr>
  `).join('');
}

// New Sale
function openNewSaleModal() {
  saleItems = [];
  resetForm('saleForm');
  document.getElementById('saleDate').value = fmt.dateInput(new Date());
  renderSaleItems();
  modal.open('saleModal');
}

function addSaleItem() {
  saleItems.push({ product_type: '', description: '', quantity: 1, unit: 'pcs', unit_price: 0, batch_id: null });
  renderSaleItems();
}

function removeSaleItem(idx) {
  saleItems.splice(idx, 1);
  renderSaleItems();
}

function renderSaleItems() {
  const container = document.getElementById('saleItemsContainer');
  const batches = state.batches || [];
  container.innerHTML = saleItems.map((item, i) => `
    <div style="border:1px solid var(--grey-200);border-radius:8px;padding:12px;margin-bottom:10px">
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label">Product Type</label>
          <select class="form-control" onchange="updateSaleItem(${i},'product_type',this.value)">
            <option value="eggs" ${item.product_type==='eggs'?'selected':''}> Eggs</option>
            <option value="live_chicken" ${item.product_type==='live_chicken'?'selected':''}> Live Chicken</option>
            <option value="manure" ${item.product_type==='manure'?'selected':''}> Manure</option>
            <option value="other" ${item.product_type==='other'?'selected':''}> Other</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Batch (optional)</label>
          <select class="form-control" onchange="updateSaleItem(${i},'batch_id',this.value)">
            <option value="">No batch</option>
            ${batches.map(b => `<option value="${b.id}" ${item.batch_id==b.id?'selected':''}>${b.batch_number}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Description</label>
          <input class="form-control" value="${item.description}" oninput="updateSaleItem(${i},'description',this.value)" placeholder="e.g. 30 trays eggs">
        </div>
        <div class="form-group">
          <label class="form-label">Quantity</label>
          <input type="number" class="form-control" value="${item.quantity}" min="1" oninput="updateSaleItem(${i},'quantity',+this.value);calcSaleTotal()">
        </div>
        <div class="form-group">
          <label class="form-label">Unit</label>
          <input class="form-control" value="${item.unit}" oninput="updateSaleItem(${i},'unit',this.value)" placeholder="pcs/kg/trays">
        </div>
        <div class="form-group">
          <label class="form-label">Unit Price (KSh)</label>
          <input type="number" class="form-control" value="${item.unit_price}" min="0" oninput="updateSaleItem(${i},'unit_price',+this.value);calcSaleTotal()">
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center">
        <strong>Subtotal: ${fmt.currency(item.quantity * item.unit_price)}</strong>
        <button class="btn btn-sm btn-danger" onclick="removeSaleItem(${i})">Remove</button>
      </div>
    </div>
  `).join('') || '<p class="text-muted">No items added. Click "Add Item" below.</p>';
  calcSaleTotal();
}

function updateSaleItem(idx, field, value) {
  saleItems[idx][field] = value;
  calcSaleTotal();
}

function calcSaleTotal() {
  const total = saleItems.reduce((s, i) => s + (i.quantity * i.unit_price), 0);
  document.getElementById('saleTotalDisplay').textContent = fmt.currency(total);
}

async function saveSale() {
  if (!saleItems.length) { toast.error('Add at least one item'); return; }
  const data = getFormData('saleForm');
  data.farm_id = state.getCurrentFarmId();
  data.items = saleItems;
  if (!data.sale_date) { toast.error('Sale date required'); return; }
  try {
    const result = await api.post('/sales', data);
    toast.success(`Sale recorded: ${fmt.currency(result.total)}`);
    modal.close('saleModal');
    await loadSales();
  } catch (err) { toast.error(err.message); }
}

async function viewSaleReceipt(uuid) {
  try {
    const sale = await api.get(`/sales/${uuid}`);
    document.getElementById('receiptContent').innerHTML = `
      <div style="font-family:monospace;padding:20px;border:2px solid var(--grey-300);border-radius:8px">
        <div style="text-align:center;margin-bottom:16px">
          <div style="font-size:24px"></div>
          <h2 style="color:var(--primary-dark)">${state.currentFarm?.name || 'NiaFarm'}</h2>
          <p style="font-size:12px;color:var(--grey-600)">SALES RECEIPT</p>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:12px;font-size:13px">
          <div><strong>Receipt #:</strong> ${sale.id}</div>
          <div><strong>Date:</strong> ${fmt.date(sale.sale_date)}</div>
        </div>
        <div style="margin-bottom:12px;font-size:13px">
          <strong>Customer:</strong> ${sale.customer_name || sale.customer_name_ref || 'Walk-in Customer'}<br>
          ${sale.customer_phone ? `<strong>Phone:</strong> ${sale.customer_phone}` : ''}
        </div>
        <table style="width:100%;font-size:13px;border-collapse:collapse">
          <thead><tr style="border-bottom:2px solid var(--grey-300)"><th style="text-align:left;padding:6px">Item</th><th style="text-align:right;padding:6px">Qty</th><th style="text-align:right;padding:6px">Price</th><th style="text-align:right;padding:6px">Total</th></tr></thead>
          <tbody>${sale.items.map(i => `<tr style="border-bottom:1px solid var(--grey-100)"><td style="padding:6px">${i.description || i.product_type}</td><td style="text-align:right;padding:6px">${i.quantity} ${i.unit}</td><td style="text-align:right;padding:6px">${fmt.currency(i.unit_price)}</td><td style="text-align:right;padding:6px">${fmt.currency(i.total_price)}</td></tr>`).join('')}</tbody>
        </table>
        <div style="border-top:2px solid var(--grey-300);margin-top:12px;padding-top:12px;text-align:right">
          <div style="font-size:16px;font-weight:700">TOTAL: ${fmt.currency(sale.total_amount)}</div>
          <div style="font-size:13px;color:var(--grey-600)">Payment: ${sale.payment_method} · <span style="color:${sale.payment_status==='paid'?'var(--primary)':'var(--danger)'}">${sale.payment_status.toUpperCase()}</span></div>
        </div>
        <div style="text-align:center;margin-top:16px;font-size:11px;color:var(--grey-500)">Thank you for your business!</div>
      </div>
    `;
    modal.open('receiptModal');
  } catch (err) { toast.error(err.message); }
}

function printReceipt() { window.print(); }

async function markSalePaid(uuid, amount) {
  try {
    await api.put(`/sales/${uuid}`, { payment_status: 'paid', amount_paid: amount });
    toast.success('Sale marked as paid');
    await loadSales();
  } catch (err) { toast.error(err.message); }
}

// Customers
let editingCustomerId = null;
function openAddCustomerModal() {
  editingCustomerId = null;
  document.getElementById('customerModalTitle').textContent = 'Add Customer';
  resetForm('customerForm');
  modal.open('customerModal');
}

async function editCustomer(uuid) {
  try {
    const customers = await api.get(`/sales/customers?farm_id=${state.getCurrentFarmId()}`);
    const c = customers.find(c => c.uuid === uuid);
    if (!c) return;
    editingCustomerId = uuid;
    document.getElementById('customerModalTitle').textContent = 'Edit Customer';
    setFormData('customerForm', { name: c.name, phone: c.phone, email: c.email, address: c.address, customer_type: c.customer_type, notes: c.notes });
    modal.open('customerModal');
  } catch (err) { toast.error(err.message); }
}

async function saveCustomer() {
  const data = getFormData('customerForm');
  data.farm_id = state.getCurrentFarmId();
  if (!data.name) { toast.error('Customer name required'); return; }
  try {
    if (editingCustomerId) {
      await api.put(`/sales/customers/${editingCustomerId}`, data);
      toast.success('Customer updated');
    } else {
      await api.post('/sales/customers', data);
      toast.success('Customer added');
    }
    modal.close('customerModal');
    await loadSales();
  } catch (err) { toast.error(err.message); }
}

async function deleteCustomer(uuid, name) {
  confirmAction(`Delete customer "${name}"?`, async () => {
    try { await api.delete(`/sales/customers/${uuid}`); toast.success('Customer deleted'); await loadSales(); }
    catch (err) { toast.error(err.message); }
  });
}

function filterSales() {
  const q = document.getElementById('salesSearch').value.toLowerCase();
  document.querySelectorAll('#salesTableBody tr').forEach(row => {
    row.style.display = !q || row.textContent.toLowerCase().includes(q) ? '' : 'none';
  });
}
