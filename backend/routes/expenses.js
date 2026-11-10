const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db/schema');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/', async (req, res) => {
  try {
    const { farm_id, category, start_date, end_date } = req.query;
    if (!farm_id) return res.status(400).json({ error: 'farm_id required' });
    let sql = 'SELECT * FROM expenses WHERE farm_id = ?';
    const params = [farm_id];
    if (category) { sql += ' AND category = ?'; params.push(category); }
    if (start_date) { sql += ' AND date >= ?'; params.push(start_date); }
    if (end_date) { sql += ' AND date <= ?'; params.push(end_date); }
    sql += ' ORDER BY date DESC';
    res.json(await db.all(sql, params));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { farm_id, category, description, amount, date, payment_method, reference, batch_id, notes } = req.body;
    if (!farm_id || !category || !description || !amount || !date)
      return res.status(400).json({ error: 'Required fields missing' });
    await db.run('INSERT INTO expenses (uuid, farm_id, category, description, amount, date, payment_method, reference, batch_id, notes, recorded_by) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [uuidv4(), farm_id, category, description, amount, date, payment_method || 'cash', reference, batch_id || null, notes, req.user.id]);
    await db.run('INSERT INTO farm_activities (uuid, farm_id, user_id, activity_type, description) VALUES (?,?,?,?,?)',
      [uuidv4(), farm_id, req.user.id, 'expense_recorded', `Expense: ${description} - KSh ${amount}`]);
    res.json({ message: 'Expense recorded' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const { category, description, amount, date, payment_method, reference, notes } = req.body;
    await db.run('UPDATE expenses SET category=?, description=?, amount=?, date=?, payment_method=?, reference=?, notes=? WHERE uuid=?',
      [category, description, amount, date, payment_method, reference, notes, req.params.id]);
    res.json({ message: 'Updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM expenses WHERE uuid = ?', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/income', async (req, res) => {
  try {
    const { farm_id, start_date, end_date } = req.query;
    if (!farm_id) return res.status(400).json({ error: 'farm_id required' });
    let sql = 'SELECT * FROM income WHERE farm_id = ?';
    const params = [farm_id];
    if (start_date) { sql += ' AND date >= ?'; params.push(start_date); }
    if (end_date) { sql += ' AND date <= ?'; params.push(end_date); }
    sql += ' ORDER BY date DESC';
    res.json(await db.all(sql, params));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/income', async (req, res) => {
  try {
    const { farm_id, source, description, amount, date, payment_method, reference, notes } = req.body;
    if (!farm_id || !source || !amount || !date)
      return res.status(400).json({ error: 'Required fields missing' });
    await db.run('INSERT INTO income (uuid, farm_id, source, description, amount, date, payment_method, reference, notes, recorded_by) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [uuidv4(), farm_id, source, description, amount, date, payment_method || 'cash', reference, notes, req.user.id]);
    res.json({ message: 'Income recorded' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/summary', async (req, res) => {
  try {
    const { farm_id, start_date, end_date } = req.query;
    if (!farm_id) return res.status(400).json({ error: 'farm_id required' });
    let dateFilter = '';
    const expParams = [farm_id];
    const incParams = [farm_id];
    if (start_date && end_date) {
      dateFilter = 'AND date BETWEEN ? AND ?';
      expParams.push(start_date, end_date);
      incParams.push(start_date, end_date);
    }
    const totalExpenses = await db.get(`SELECT SUM(amount) as total FROM expenses WHERE farm_id = ? ${dateFilter}`, expParams);
    const totalIncome = await db.get(`SELECT SUM(amount) as total FROM income WHERE farm_id = ? ${dateFilter}`, incParams);
    const expenseByCategory = await db.all(`SELECT category, SUM(amount) as total FROM expenses WHERE farm_id = ? ${dateFilter} GROUP BY category`, expParams);
    const monthlyData = await db.all(`
      SELECT month, SUM(income) as income, SUM(expenses) as expenses FROM (
        SELECT strftime('%Y-%m', date) as month, amount as income, 0 as expenses FROM income WHERE farm_id = ?
        UNION ALL
        SELECT strftime('%Y-%m', date) as month, 0 as income, amount as expenses FROM expenses WHERE farm_id = ?
      ) GROUP BY month ORDER BY month DESC LIMIT 12
    `, [farm_id, farm_id]);
    const totalBirds = await db.get("SELECT SUM(current_count) as total FROM poultry_batches WHERE farm_id = ? AND status = 'active'", [farm_id]);
    const income = totalIncome.total || 0;
    const expenses = totalExpenses.total || 0;
    res.json({
      total_income: income,
      total_expenses: expenses,
      gross_profit: income - expenses,
      net_profit: income - expenses,
      expense_by_category: expenseByCategory,
      monthly_data: monthlyData.reverse(),
      cost_per_bird: (totalBirds.total || 0) > 0 ? (expenses / totalBirds.total).toFixed(2) : 0
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
