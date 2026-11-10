const express = require('express');
const router = express.Router();
const db = require('../db/schema');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

// Dashboard summary
router.get('/dashboard', (req, res) => {
  const { farm_id } = req.query;
  if (!farm_id) return res.status(400).json({ error: 'farm_id required' });

  const totalBirds = db.prepare("SELECT SUM(current_count) as total FROM poultry_batches WHERE farm_id = ? AND status = 'active'").get(farm_id);
  const activeBatches = db.prepare("SELECT COUNT(*) as count FROM poultry_batches WHERE farm_id = ? AND status = 'active'").get(farm_id);
  const todayEggs = db.prepare("SELECT SUM(total_collected) as total FROM egg_production WHERE farm_id = ? AND date = date('now')").get(farm_id);
  const totalFeedStock = db.prepare("SELECT SUM(quantity) as total FROM inventory WHERE farm_id = ? AND category = 'feeds'").get(farm_id);
  const monthExpenses = db.prepare("SELECT SUM(amount) as total FROM expenses WHERE farm_id = ? AND strftime('%Y-%m', date) = strftime('%Y-%m', 'now')").get(farm_id);
  const monthIncome = db.prepare("SELECT SUM(amount) as total FROM income WHERE farm_id = ? AND strftime('%Y-%m', date) = strftime('%Y-%m', 'now')").get(farm_id);
  const totalDeaths = db.prepare("SELECT SUM(count) as total FROM poultry_mortality WHERE farm_id = ? AND strftime('%Y-%m', date) = strftime('%Y-%m', 'now')").get(farm_id);
  const lowStockItems = db.prepare('SELECT COUNT(*) as count FROM inventory WHERE farm_id = ? AND quantity <= low_stock_threshold').get(farm_id);
  const unreadNotifications = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE farm_id = ? AND is_read = 0').get(farm_id);

  // Egg production last 7 days
  const eggTrend = db.prepare("SELECT date, SUM(total_collected) as total FROM egg_production WHERE farm_id = ? AND date >= date('now', '-7 days') GROUP BY date ORDER BY date ASC").all(farm_id);

  // Income vs expenses last 6 months
  const financialTrend = db.prepare(`
    SELECT month, SUM(income) as income, SUM(expenses) as expenses FROM (
      SELECT strftime('%Y-%m', date) as month, amount as income, 0 as expenses FROM income WHERE farm_id = ?
      UNION ALL
      SELECT strftime('%Y-%m', date) as month, 0 as income, amount as expenses FROM expenses WHERE farm_id = ?
    ) GROUP BY month ORDER BY month DESC LIMIT 6
  `).all(farm_id, farm_id);

  // Flock distribution
  const flockDist = db.prepare("SELECT poultry_type, SUM(current_count) as count FROM poultry_batches WHERE farm_id = ? AND status = 'active' GROUP BY poultry_type").all(farm_id);

  // Recent activities
  const recentActivities = db.prepare("SELECT fa.*, u.name as user_name FROM farm_activities fa LEFT JOIN users u ON fa.user_id = u.id WHERE fa.farm_id = ? ORDER BY fa.created_at DESC LIMIT 10").all(farm_id);

  // Upcoming vaccinations
  const upcomingVaccinations = db.prepare("SELECT vr.*, pb.batch_number FROM vaccination_records vr JOIN poultry_batches pb ON vr.batch_id = pb.id WHERE vr.farm_id = ? AND vr.next_due_date >= date('now') AND vr.next_due_date <= date('now', '+14 days') ORDER BY vr.next_due_date ASC LIMIT 5").all(farm_id);

  const income = monthIncome.total || 0;
  const expenses = monthExpenses.total || 0;

  res.json({
    summary: {
      total_birds: totalBirds.total || 0,
      active_batches: activeBatches.count || 0,
      today_eggs: todayEggs.total || 0,
      feed_stock_kg: totalFeedStock.total || 0,
      month_expenses: expenses,
      month_income: income,
      month_profit: income - expenses,
      month_deaths: totalDeaths.total || 0,
      low_stock_alerts: lowStockItems.count || 0,
      unread_notifications: unreadNotifications.count || 0
    },
    egg_trend: eggTrend,
    financial_trend: financialTrend.reverse(),
    flock_distribution: flockDist,
    recent_activities: recentActivities,
    upcoming_vaccinations: upcomingVaccinations
  });
});

// Full reports
router.get('/production', (req, res) => {
  const { farm_id, batch_id, start_date, end_date } = req.query;
  if (!farm_id) return res.status(400).json({ error: 'farm_id required' });
  const params = [farm_id];
  let batchFilter = '';
  let dateFilter = '';
  if (batch_id) { batchFilter = 'AND ep.batch_id = ?'; params.push(batch_id); }
  if (start_date) { dateFilter += ' AND ep.date >= ?'; params.push(start_date); }
  if (end_date) { dateFilter += ' AND ep.date <= ?'; params.push(end_date); }
  const data = db.prepare(`SELECT ep.*, pb.batch_number, pb.poultry_type FROM egg_production ep JOIN poultry_batches pb ON ep.batch_id = pb.id WHERE ep.farm_id = ? ${batchFilter} ${dateFilter} ORDER BY ep.date DESC`).all(...params);
  res.json(data);
});

router.get('/mortality', (req, res) => {
  const { farm_id, batch_id, start_date, end_date } = req.query;
  if (!farm_id) return res.status(400).json({ error: 'farm_id required' });
  const params = [farm_id];
  let filters = '';
  if (batch_id) { filters += ' AND pm.batch_id = ?'; params.push(batch_id); }
  if (start_date) { filters += ' AND pm.date >= ?'; params.push(start_date); }
  if (end_date) { filters += ' AND pm.date <= ?'; params.push(end_date); }
  const data = db.prepare(`SELECT pm.*, pb.batch_number, pb.poultry_type FROM poultry_mortality pm JOIN poultry_batches pb ON pm.batch_id = pb.id WHERE pm.farm_id = ? ${filters} ORDER BY pm.date DESC`).all(...params);
  res.json(data);
});

router.get('/feed-consumption', (req, res) => {
  const { farm_id, batch_id, start_date, end_date } = req.query;
  if (!farm_id) return res.status(400).json({ error: 'farm_id required' });
  const params = [farm_id];
  let filters = '';
  if (batch_id) { filters += ' AND fr.batch_id = ?'; params.push(batch_id); }
  if (start_date) { filters += ' AND fr.date >= ?'; params.push(start_date); }
  if (end_date) { filters += ' AND fr.date <= ?'; params.push(end_date); }
  const data = db.prepare(`SELECT fr.*, pb.batch_number FROM feed_records fr JOIN poultry_batches pb ON fr.batch_id = pb.id WHERE fr.farm_id = ? ${filters} ORDER BY fr.date DESC`).all(...params);
  const summary = db.prepare(`SELECT feed_name, SUM(quantity_kg) as total_kg, SUM(cost) as total_cost FROM feed_records WHERE farm_id = ? ${filters} GROUP BY feed_name`).all(...params);
  res.json({ records: data, summary });
});

router.get('/financial', (req, res) => {
  const { farm_id, start_date, end_date } = req.query;
  if (!farm_id) return res.status(400).json({ error: 'farm_id required' });
  const params = [farm_id];
  let dateFilter = '';
  if (start_date && end_date) { dateFilter = 'AND date BETWEEN ? AND ?'; params.push(start_date, end_date); }
  const expenses = db.prepare(`SELECT * FROM expenses WHERE farm_id = ? ${dateFilter} ORDER BY date DESC`).all(...params);
  const income = db.prepare(`SELECT * FROM income WHERE farm_id = ? ${dateFilter} ORDER BY date DESC`).all(...params);
  const totalExp = expenses.reduce((s, e) => s + e.amount, 0);
  const totalInc = income.reduce((s, i) => s + i.amount, 0);
  res.json({ expenses, income, total_expenses: totalExp, total_income: totalInc, profit: totalInc - totalExp });
});

router.get('/vaccination-history', (req, res) => {
  const { farm_id, batch_id } = req.query;
  if (!farm_id) return res.status(400).json({ error: 'farm_id required' });
  const params = [farm_id];
  let filter = '';
  if (batch_id) { filter = 'AND vr.batch_id = ?'; params.push(batch_id); }
  const data = db.prepare(`SELECT vr.*, pb.batch_number FROM vaccination_records vr JOIN poultry_batches pb ON vr.batch_id = pb.id WHERE vr.farm_id = ? ${filter} ORDER BY vr.date_given DESC`).all(...params);
  res.json(data);
});

router.get('/inventory-usage', (req, res) => {
  const { farm_id, start_date, end_date } = req.query;
  if (!farm_id) return res.status(400).json({ error: 'farm_id required' });
  const params = [farm_id];
  let dateFilter = '';
  if (start_date) { dateFilter += ' AND it.date >= ?'; params.push(start_date); }
  if (end_date) { dateFilter += ' AND it.date <= ?'; params.push(end_date); }
  const data = db.prepare(`SELECT it.*, i.name, i.category, i.unit FROM inventory_transactions it JOIN inventory i ON it.inventory_id = i.id WHERE it.farm_id = ? ${dateFilter} ORDER BY it.date DESC`).all(...params);
  res.json(data);
});

module.exports = router;
