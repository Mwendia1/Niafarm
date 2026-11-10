const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db/schema');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

// Get expenses
router.get('/', (req, res) => {
  const { farm_id, category, start_date, end_date } = req.query;
  if (!farm_id) return res.status(400).json({ error: 'farm_id required' });
  let query = 'SELECT * FROM expenses WHERE farm_id = ?';
  const params = [farm_id];
  if (category) { query += ' AND category = ?'; params.push(category); }
  if (start_date) { query += ' AND date >= ?'; params.push(start_date); }
  if (end_date) { query += ' AND date <= ?'; params.push(end_date); }
  query += ' ORDER BY date DESC';
  res.json(db.prepare(query).all(...params));
});

// Add expense
router.post('/', (req, res) => {
  const { farm_id, category, description, amount, date, payment_method, reference, batch_id, notes } = req.body;
  if (!farm_id || !category || !description || !amount || !date) return res.status(400).json({ error: 'Required fields missing' });
  const uuid = uuidv4();
  db.prepare('INSERT INTO expenses (uuid, farm_id, category, description, amount, date, payment_method, reference, batch_id, notes, recorded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(uuid, farm_id, category, description, amount, date, payment_method || 'cash', reference, batch_id || null, notes, req.user.id);
  db.prepare(`INSERT INTO farm_activities (uuid, farm_id, user_id, activity_type, description) VALUES (?, ?, ?, ?, ?)`)
    .run(uuidv4(), farm_id, req.user.id, 'expense_recorded', `Expense: ${description} - KSh ${amount}`);
  res.json({ message: 'Expense recorded' });
});

router.put('/:id', (req, res) => {
  const { category, description, amount, date, payment_method, reference, notes } = req.body;
  db.prepare('UPDATE expenses SET category=?, description=?, amount=?, date=?, payment_method=?, reference=?, notes=? WHERE uuid=?')
    .run(category, description, amount, date, payment_method, reference, notes, req.params.id);
  res.json({ message: 'Expense updated' });
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM expenses WHERE uuid = ?').run(req.params.id);
  res.json({ message: 'Expense deleted' });
});

// Get income
router.get('/income', (req, res) => {
  const { farm_id, start_date, end_date } = req.query;
  if (!farm_id) return res.status(400).json({ error: 'farm_id required' });
  let query = 'SELECT * FROM income WHERE farm_id = ?';
  const params = [farm_id];
  if (start_date) { query += ' AND date >= ?'; params.push(start_date); }
  if (end_date) { query += ' AND date <= ?'; params.push(end_date); }
  query += ' ORDER BY date DESC';
  res.json(db.prepare(query).all(...params));
});

// Add income
router.post('/income', (req, res) => {
  const { farm_id, source, description, amount, date, payment_method, reference, notes } = req.body;
  if (!farm_id || !source || !amount || !date) return res.status(400).json({ error: 'Required fields missing' });
  const uuid = uuidv4();
  db.prepare('INSERT INTO income (uuid, farm_id, source, description, amount, date, payment_method, reference, notes, recorded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(uuid, farm_id, source, description, amount, date, payment_method || 'cash', reference, notes, req.user.id);
  res.json({ message: 'Income recorded' });
});

// Financial summary
router.get('/summary', (req, res) => {
  const { farm_id, start_date, end_date } = req.query;
  if (!farm_id) return res.status(400).json({ error: 'farm_id required' });
  let dateFilter = '';
  const params = [farm_id];
  if (start_date && end_date) {
    dateFilter = 'AND date BETWEEN ? AND ?';
    params.push(start_date, end_date);
  }
  const totalExpenses = db.prepare(`SELECT SUM(amount) as total FROM expenses WHERE farm_id = ? ${dateFilter}`).get(...params);
  const totalIncome = db.prepare(`SELECT SUM(amount) as total FROM income WHERE farm_id = ? ${dateFilter}`).get(...params);
  const expenseByCategory = db.prepare(`SELECT category, SUM(amount) as total FROM expenses WHERE farm_id = ? ${dateFilter} GROUP BY category`).all(...params);
  const monthlyData = db.prepare(`
    SELECT strftime('%Y-%m', date) as month,
    SUM(CASE WHEN type='expense' THEN amount ELSE 0 END) as expenses,
    SUM(CASE WHEN type='income' THEN amount ELSE 0 END) as income
    FROM (
      SELECT date, amount, 'expense' as type FROM expenses WHERE farm_id = ?
      UNION ALL
      SELECT date, amount, 'income' as type FROM income WHERE farm_id = ?
    ) GROUP BY month ORDER BY month DESC LIMIT 12
  `).all(farm_id, farm_id);
  const totalBirds = db.prepare('SELECT SUM(current_count) as total FROM poultry_batches WHERE farm_id = ? AND status = "active"').get(farm_id);
  const totalEggs = db.prepare('SELECT SUM(good_eggs) - SUM(eggs_sold) as stock FROM egg_production WHERE farm_id = ?').get(farm_id);
  const income = totalIncome.total || 0;
  const expenses = totalExpenses.total || 0;
  res.json({
    total_income: income,
    total_expenses: expenses,
    gross_profit: income - expenses,
    net_profit: income - expenses,
    expense_by_category: expenseByCategory,
    monthly_data: monthlyData,
    cost_per_bird: totalBirds.total > 0 ? (expenses / totalBirds.total).toFixed(2) : 0
  });
});

module.exports = router;
