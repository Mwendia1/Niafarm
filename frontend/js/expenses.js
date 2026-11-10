// ===== EXPENSES & FINANCES MODULE =====
let finExpChart, finPieChart;

async function loadExpenses() {
  const farmId = state.getCurrentFarmId();
  if (!farmId) return;
  await populateBatchSelects(farmId);
  try {
    const [expenses, income, summary] = await Promise.all([
      api.get(`/expenses?farm_id=${farmId}`),
      api.get(`/expenses/income?farm_id=${farmId}`),
      api.get(`/expenses/summary?farm_id=${farmId}`)
    ]);
    renderFinanceSummary(summary);
    renderExpensesTable(expenses);
    renderIncomeTable(income);
    renderFinanceCharts(summary);
  } catch (err) { toast.error('Failed to load financial data: ' + err.message); }
}

function renderFinanceSummary(s) {
  const profit = s.gross_profit;
  document.getElementById('financeSummaryCards').innerHTML = `
    <div class="summary-grid" style="margin-bottom:0">
      <div class="summary-card"><div class="summary-icon green"></div><div class="summary-info"><div class="label">Total Income</div><div class="value">${fmt.currency(s.total_income)}</div></div></div>
      <div class="summary-card"><div class="summary-icon red"></div><div class="summary-info"><div class="label">Total Expenses</div><div class="value">${fmt.currency(s.total_expenses)}</div></div></div>
      <div class="summary-card"><div class="summary-icon ${profit>=0?'green':'red'}"></div><div class="summary-info"><div class="label">Net Profit/Loss</div><div class="value ${profit>=0?'text-profit':'text-loss'}">${profit>=0?'+':''}${fmt.currency(profit)}</div></div></div>
      <div class="summary-card"><div class="summary-icon blue"></div><div class="summary-info"><div class="label">Cost Per Bird</div><div class="value">${fmt.currency(s.cost_per_bird)}</div></div></div>
    </div>
  `;
}

function renderExpensesTable(expenses) {
  const tbody = document.getElementById('expensesTableBody');
  if (!expenses.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="empty-icon"></div><h4>No expenses recorded</h4></div></td></tr>`;
    return;
  }
  const catColors = { feeds:'badge-green', labour:'badge-blue', medicines:'badge-orange', equipment:'badge-grey', transport:'badge-blue', electricity:'badge-yellow', water:'badge-blue' };
  tbody.innerHTML = expenses.map(e => `
    <tr>
      <td>${fmt.date(e.date)}</td>
      <td><span class="badge ${catColors[e.category]||'badge-grey'}">${e.category}</span></td>
      <td>${e.description}</td>
      <td><strong>${fmt.currency(e.amount)}</strong></td>
      <td>${e.payment_method}</td>
      <td>
        <button class="btn btn-sm btn-outline" onclick="editExpense('${e.uuid}')"></button>
        <button class="btn btn-sm btn-danger" onclick="deleteExpense('${e.uuid}')"></button>
      </td>
    </tr>
  `).join('');
}

function renderIncomeTable(income) {
  const tbody = document.getElementById('incomeTableBody');
  if (!income.length) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><div class="empty-icon"></div><h4>No income recorded</h4></div></td></tr>`;
    return;
  }
  tbody.innerHTML = income.map(i => `
    <tr>
      <td>${fmt.date(i.date)}</td>
      <td><span class="badge badge-green">${i.source}</span></td>
      <td>${i.description || '-'}</td>
      <td><strong style="color:var(--primary)">${fmt.currency(i.amount)}</strong></td>
      <td>${i.payment_method}</td>
    </tr>
  `).join('');
}

function renderFinanceCharts(summary) {
  // Monthly income vs expenses
  const ctx1 = document.getElementById('finExpChart');
  if (ctx1) {
    if (finExpChart) finExpChart.destroy();
    const monthly = summary.monthly_data || [];
    finExpChart = new Chart(ctx1, {
      type: 'bar',
      data: {
        labels: monthly.map(m => m.month),
        datasets: [
          { label: 'Income', data: monthly.map(m => m.income||0), backgroundColor: 'rgba(46,125,50,0.7)', borderRadius: 4 },
          { label: 'Expenses', data: monthly.map(m => m.expenses||0), backgroundColor: 'rgba(198,40,40,0.7)', borderRadius: 4 }
        ]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } }, scales: { y: { beginAtZero: true } } }
    });
  }
  // Expense by category pie
  const ctx2 = document.getElementById('finPieChart');
  if (ctx2 && summary.expense_by_category?.length) {
    if (finPieChart) finPieChart.destroy();
    finPieChart = new Chart(ctx2, {
      type: 'doughnut',
      data: {
        labels: summary.expense_by_category.map(c => c.category),
        datasets: [{ data: summary.expense_by_category.map(c => c.total), backgroundColor: ['#2e7d32','#ff8f00','#0277bd','#7b1fa2','#c62828','#00838f','#558b2f','#4e342e'] }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
    });
  }
}

// Add Expense
let editingExpenseId = null;
function openAddExpenseModal() {
  editingExpenseId = null;
  document.getElementById('expenseModalTitle').textContent = 'Record Expense';
  resetForm('expenseForm');
  document.getElementById('expenseDate').value = fmt.dateInput(new Date());
  modal.open('expenseModal');
}

async function editExpense(uuid) {
  try {
    const expenses = await api.get(`/expenses?farm_id=${state.getCurrentFarmId()}`);
    const e = expenses.find(e => e.uuid === uuid);
    if (!e) return;
    editingExpenseId = uuid;
    document.getElementById('expenseModalTitle').textContent = 'Edit Expense';
    setFormData('expenseForm', { category: e.category, description: e.description, amount: e.amount, date: fmt.dateInput(e.date), payment_method: e.payment_method, reference: e.reference, notes: e.notes });
    modal.open('expenseModal');
  } catch (err) { toast.error(err.message); }
}

async function saveExpense() {
  const data = getFormData('expenseForm');
  data.farm_id = state.getCurrentFarmId();
  if (!data.category || !data.description || !data.amount || !data.date) { toast.error('Please fill all required fields'); return; }
  try {
    if (editingExpenseId) {
      await api.put(`/expenses/${editingExpenseId}`, data);
      toast.success('Expense updated');
    } else {
      await api.post('/expenses', data);
      toast.success('Expense recorded');
    }
    modal.close('expenseModal');
    await loadExpenses();
  } catch (err) { toast.error(err.message); }
}

async function deleteExpense(uuid) {
  confirmAction('Delete this expense record?', async () => {
    try { await api.delete(`/expenses/${uuid}`); toast.success('Expense deleted'); await loadExpenses(); }
    catch (err) { toast.error(err.message); }
  });
}

// Add Income
function openAddIncomeModal() {
  resetForm('incomeForm');
  document.getElementById('incomeDate').value = fmt.dateInput(new Date());
  modal.open('incomeModal');
}

async function saveIncome() {
  const data = getFormData('incomeForm');
  data.farm_id = state.getCurrentFarmId();
  if (!data.source || !data.amount || !data.date) { toast.error('Please fill all required fields'); return; }
  try {
    await api.post('/expenses/income', data);
    toast.success('Income recorded');
    modal.close('incomeModal');
    await loadExpenses();
  } catch (err) { toast.error(err.message); }
}

async function filterFinances() {
  const farmId = state.getCurrentFarmId();
  const start = document.getElementById('finStartDate').value;
  const end = document.getElementById('finEndDate').value;
  if (!start || !end) { toast.error('Select start and end dates'); return; }
  try {
    const [expenses, income, summary] = await Promise.all([
      api.get(`/expenses?farm_id=${farmId}&start_date=${start}&end_date=${end}`),
      api.get(`/expenses/income?farm_id=${farmId}&start_date=${start}&end_date=${end}`),
      api.get(`/expenses/summary?farm_id=${farmId}&start_date=${start}&end_date=${end}`)
    ]);
    renderFinanceSummary(summary);
    renderExpensesTable(expenses);
    renderIncomeTable(income);
  } catch (err) { toast.error(err.message); }
}
