const express = require('express');
const router = express.Router();
const db = require('../db/schema');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/dashboard', async (req, res) => {
  try {
    const { farm_id } = req.query;
    if (!farm_id) return res.status(400).json({ error: 'farm_id required' });

    const [totalBirds, activeBatches, todayEggs, totalFeedStock, monthExpenses, monthIncome, totalDeaths, lowStockItems, unreadNotifications] = await Promise.all([
      db.get("SELECT SUM(current_count) as total FROM poultry_batches WHERE farm_id = ? AND status = 'active'", [farm_id]),
      db.get("SELECT COUNT(*) as count FROM poultry_batches WHERE farm_id = ? AND status = 'active'", [farm_id]),
      db.get("SELECT SUM(total_collected) as total FROM egg_production WHERE farm_id = ? AND date = date('now')", [farm_id]),
      db.get("SELECT SUM(quantity) as total FROM inventory WHERE farm_id = ? AND category = 'feeds'", [farm_id]),
      db.get("SELECT SUM(amount) as total FROM expenses WHERE farm_id = ? AND strftime('%Y-%m', date) = strftime('%Y-%m', 'now')", [farm_id]),
      db.get("SELECT SUM(amount) as total FROM income WHERE farm_id = ? AND strftime('%Y-%m', date) = strftime('%Y-%m', 'now')", [farm_id]),
      db.get("SELECT SUM(count) as total FROM poultry_mortality WHERE farm_id = ? AND strftime('%Y-%m', date) = strftime('%Y-%m', 'now')", [farm_id]),
      db.get('SELECT COUNT(*) as count FROM inventory WHERE farm_id = ? AND quantity <= low_stock_threshold', [farm_id]),
      db.get('SELECT COUNT(*) as count FROM notifications WHERE farm_id = ? AND is_read = 0', [farm_id]),
    ]);

    const eggTrend = await db.all("SELECT date, SUM(total_collected) as total FROM egg_production WHERE farm_id = ? AND date >= date('now', '-7 days') GROUP BY date ORDER BY date ASC", [farm_id]);
    const financialTrend = await db.all(`
      SELECT month, SUM(income) as income, SUM(expenses) as expenses FROM (
        SELECT strftime('%Y-%m', date) as month, amount as income, 0 as expenses FROM income WHERE farm_id = ?
        UNION ALL
        SELECT strftime('%Y-%m', date) as month, 0 as income, amount as expenses FROM expenses WHERE farm_id = ?
      ) GROUP BY month ORDER BY month DESC LIMIT 6
    `, [farm_id, farm_id]);
    const flockDist = await db.all("SELECT poultry_type, SUM(current_count) as count FROM poultry_batches WHERE farm_id = ? AND status = 'active' GROUP BY poultry_type", [farm_id]);
    const recentActivities = await db.all("SELECT fa.*, u.name as user_name FROM farm_activities fa LEFT JOIN users u ON fa.user_id = u.id WHERE fa.farm_id = ? ORDER BY fa.created_at DESC LIMIT 10", [farm_id]);
    const upcomingVaccinations = await db.all("SELECT vr.*, pb.batch_number FROM vaccination_records vr JOIN poultry_batches pb ON vr.batch_id = pb.id WHERE vr.farm_id = ? AND vr.next_due_date >= date('now') AND vr.next_due_date <= date('now', '+14 days') ORDER BY vr.next_due_date ASC LIMIT 5", [farm_id]);

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
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/production', async (req, res) => {
  try {
    const { farm_id, batch_id, start_date, end_date } = req.query;
    if (!farm_id) return res.status(400).json({ error: 'farm_id required' });
    let sql = 'SELECT ep.*, pb.batch_number, pb.poultry_type FROM egg_production ep JOIN poultry_batches pb ON ep.batch_id = pb.id WHERE ep.farm_id = ?';
    const params = [farm_id];
    if (batch_id) { sql += ' AND ep.batch_id = ?'; params.push(batch_id); }
    if (start_date) { sql += ' AND ep.date >= ?'; params.push(start_date); }
    if (end_date) { sql += ' AND ep.date <= ?'; params.push(end_date); }
    sql += ' ORDER BY ep.date DESC';
    res.json(await db.all(sql, params));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/mortality', async (req, res) => {
  try {
    const { farm_id, batch_id, start_date, end_date } = req.query;
    if (!farm_id) return res.status(400).json({ error: 'farm_id required' });
    let sql = 'SELECT pm.*, pb.batch_number, pb.poultry_type FROM poultry_mortality pm JOIN poultry_batches pb ON pm.batch_id = pb.id WHERE pm.farm_id = ?';
    const params = [farm_id];
    if (batch_id) { sql += ' AND pm.batch_id = ?'; params.push(batch_id); }
    if (start_date) { sql += ' AND pm.date >= ?'; params.push(start_date); }
    if (end_date) { sql += ' AND pm.date <= ?'; params.push(end_date); }
    sql += ' ORDER BY pm.date DESC';
    res.json(await db.all(sql, params));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/feed-consumption', async (req, res) => {
  try {
    const { farm_id, batch_id, start_date, end_date } = req.query;
    if (!farm_id) return res.status(400).json({ error: 'farm_id required' });
    let sql = 'SELECT fr.*, pb.batch_number FROM feed_records fr JOIN poultry_batches pb ON fr.batch_id = pb.id WHERE fr.farm_id = ?';
    const params = [farm_id];
    if (batch_id) { sql += ' AND fr.batch_id = ?'; params.push(batch_id); }
    if (start_date) { sql += ' AND fr.date >= ?'; params.push(start_date); }
    if (end_date) { sql += ' AND fr.date <= ?'; params.push(end_date); }
    sql += ' ORDER BY fr.date DESC';
    const records = await db.all(sql, params);
    const summaryParams = [farm_id];
    let summarySql = 'SELECT feed_name, SUM(quantity_kg) as total_kg, SUM(cost) as total_cost FROM feed_records WHERE farm_id = ?';
    if (batch_id) { summarySql += ' AND batch_id = ?'; summaryParams.push(batch_id); }
    if (start_date) { summarySql += ' AND date >= ?'; summaryParams.push(start_date); }
    if (end_date) { summarySql += ' AND date <= ?'; summaryParams.push(end_date); }
    summarySql += ' GROUP BY feed_name';
    const summary = await db.all(summarySql, summaryParams);
    res.json({ records, summary });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/financial', async (req, res) => {
  try {
    const { farm_id, start_date, end_date } = req.query;
    if (!farm_id) return res.status(400).json({ error: 'farm_id required' });
    let dateFilter = '';
    const params = [farm_id];
    if (start_date && end_date) { dateFilter = 'AND date BETWEEN ? AND ?'; params.push(start_date, end_date); }
    const expenses = await db.all(`SELECT * FROM expenses WHERE farm_id = ? ${dateFilter} ORDER BY date DESC`, params);
    const income = await db.all(`SELECT * FROM income WHERE farm_id = ? ${dateFilter} ORDER BY date DESC`, params);
    const totalExp = expenses.reduce((s, e) => s + e.amount, 0);
    const totalInc = income.reduce((s, i) => s + i.amount, 0);
    res.json({ expenses, income, total_expenses: totalExp, total_income: totalInc, profit: totalInc - totalExp });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/vaccination-history', async (req, res) => {
  try {
    const { farm_id, batch_id } = req.query;
    if (!farm_id) return res.status(400).json({ error: 'farm_id required' });
    let sql = 'SELECT vr.*, pb.batch_number FROM vaccination_records vr JOIN poultry_batches pb ON vr.batch_id = pb.id WHERE vr.farm_id = ?';
    const params = [farm_id];
    if (batch_id) { sql += ' AND vr.batch_id = ?'; params.push(batch_id); }
    sql += ' ORDER BY vr.date_given DESC';
    res.json(await db.all(sql, params));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/inventory-usage', async (req, res) => {
  try {
    const { farm_id, start_date, end_date } = req.query;
    if (!farm_id) return res.status(400).json({ error: 'farm_id required' });
    let sql = 'SELECT it.*, i.name, i.category, i.unit FROM inventory_transactions it JOIN inventory i ON it.inventory_id = i.id WHERE it.farm_id = ?';
    const params = [farm_id];
    if (start_date) { sql += ' AND it.date >= ?'; params.push(start_date); }
    if (end_date) { sql += ' AND it.date <= ?'; params.push(end_date); }
    sql += ' ORDER BY it.date DESC';
    res.json(await db.all(sql, params));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
