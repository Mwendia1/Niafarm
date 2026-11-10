const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db/schema');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/', async (req, res) => {
  try {
    const { farm_id, batch_id, start_date, end_date } = req.query;
    if (!farm_id) return res.status(400).json({ error: 'farm_id required' });
    let sql = 'SELECT ep.*, pb.batch_number FROM egg_production ep JOIN poultry_batches pb ON ep.batch_id = pb.id WHERE ep.farm_id = ?';
    const params = [farm_id];
    if (batch_id) { sql += ' AND ep.batch_id = ?'; params.push(batch_id); }
    if (start_date) { sql += ' AND ep.date >= ?'; params.push(start_date); }
    if (end_date) { sql += ' AND ep.date <= ?'; params.push(end_date); }
    sql += ' ORDER BY ep.date DESC';
    res.json(await db.all(sql, params));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { farm_id, batch_id, date, total_collected, good_eggs, broken_eggs, damaged_eggs, small_eggs, medium_eggs, large_eggs, xlarge_eggs, eggs_sold, notes } = req.body;
    if (!farm_id || !batch_id || !date) return res.status(400).json({ error: 'Required fields missing' });
    await db.run('INSERT INTO egg_production (uuid, batch_id, farm_id, date, total_collected, good_eggs, broken_eggs, damaged_eggs, small_eggs, medium_eggs, large_eggs, xlarge_eggs, eggs_sold, notes, recorded_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [uuidv4(), batch_id, farm_id, date, total_collected || 0, good_eggs || 0, broken_eggs || 0, damaged_eggs || 0, small_eggs || 0, medium_eggs || 0, large_eggs || 0, xlarge_eggs || 0, eggs_sold || 0, notes, req.user.id]);
    await db.run('INSERT INTO farm_activities (uuid, farm_id, user_id, activity_type, description) VALUES (?,?,?,?,?)',
      [uuidv4(), farm_id, req.user.id, 'eggs_recorded', `${total_collected || 0} eggs collected`]);
    res.json({ message: 'Egg production recorded' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const { total_collected, good_eggs, broken_eggs, damaged_eggs, small_eggs, medium_eggs, large_eggs, xlarge_eggs, eggs_sold, notes } = req.body;
    await db.run('UPDATE egg_production SET total_collected=?, good_eggs=?, broken_eggs=?, damaged_eggs=?, small_eggs=?, medium_eggs=?, large_eggs=?, xlarge_eggs=?, eggs_sold=?, notes=? WHERE uuid=?',
      [total_collected, good_eggs, broken_eggs, damaged_eggs, small_eggs, medium_eggs, large_eggs, xlarge_eggs, eggs_sold, notes, req.params.id]);
    res.json({ message: 'Updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM egg_production WHERE uuid = ?', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/summary', async (req, res) => {
  try {
    const { farm_id, period } = req.query;
    if (!farm_id) return res.status(400).json({ error: 'farm_id required' });
    let dateFilter = '';
    if (period === 'week') dateFilter = "AND ep.date >= date('now', '-7 days')";
    else if (period === 'month') dateFilter = "AND ep.date >= date('now', '-30 days')";
    else if (period === 'year') dateFilter = "AND ep.date >= date('now', '-365 days')";
    const summary = await db.get(`SELECT SUM(total_collected) as total_eggs, SUM(good_eggs) as good_eggs, SUM(broken_eggs) as broken_eggs, SUM(damaged_eggs) as damaged_eggs, SUM(eggs_sold) as eggs_sold, SUM(good_eggs) - SUM(eggs_sold) as stock_remaining, COUNT(DISTINCT date) as days_recorded FROM egg_production ep WHERE farm_id = ? ${dateFilter}`, [farm_id]);
    const daily = await db.all(`SELECT ep.date, SUM(ep.total_collected) as total, pb.batch_number FROM egg_production ep JOIN poultry_batches pb ON ep.batch_id = pb.id WHERE ep.farm_id = ? ${dateFilter} GROUP BY ep.date ORDER BY ep.date DESC LIMIT 30`, [farm_id]);
    res.json({ summary, daily });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
