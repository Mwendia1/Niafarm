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
    let sql = 'SELECT fr.*, pb.batch_number FROM feed_records fr JOIN poultry_batches pb ON fr.batch_id = pb.id WHERE fr.farm_id = ?';
    const params = [farm_id];
    if (batch_id) { sql += ' AND fr.batch_id = ?'; params.push(batch_id); }
    if (start_date) { sql += ' AND fr.date >= ?'; params.push(start_date); }
    if (end_date) { sql += ' AND fr.date <= ?'; params.push(end_date); }
    sql += ' ORDER BY fr.date DESC';
    res.json(await db.all(sql, params));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { farm_id, batch_id, feed_name, feed_type_id, quantity_kg, date, cost, notes } = req.body;
    if (!farm_id || !batch_id || !feed_name || !quantity_kg || !date)
      return res.status(400).json({ error: 'Required fields missing' });
    await db.run('INSERT INTO feed_records (uuid, batch_id, farm_id, feed_type_id, feed_name, quantity_kg, date, cost, notes, recorded_by) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [uuidv4(), batch_id, farm_id, feed_type_id || null, feed_name, quantity_kg, date, cost || 0, notes, req.user.id]);
    const invItem = await db.get("SELECT * FROM inventory WHERE farm_id = ? AND name LIKE ? AND category = 'feeds'", [farm_id, `%${feed_name}%`]);
    if (invItem) {
      await db.run("UPDATE inventory SET quantity = quantity - ?, updated_at = datetime('now') WHERE id = ?", [quantity_kg, invItem.id]);
      await db.run('INSERT INTO inventory_transactions (uuid, inventory_id, farm_id, type, quantity, date, notes) VALUES (?,?,?,?,?,?,?)',
        [uuidv4(), invItem.id, farm_id, 'usage', quantity_kg, date, 'Feed record usage']);
    }
    await db.run('INSERT INTO farm_activities (uuid, farm_id, user_id, activity_type, description) VALUES (?,?,?,?,?)',
      [uuidv4(), farm_id, req.user.id, 'feeding_recorded', `${quantity_kg}kg of ${feed_name} recorded`]);
    res.json({ message: 'Feed record added' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/types', async (req, res) => {
  try { res.json(await db.all('SELECT * FROM feed_types')); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/schedules', async (req, res) => {
  try {
    const { farm_id } = req.query;
    if (!farm_id) return res.status(400).json({ error: 'farm_id required' });
    res.json(await db.all(
      'SELECT fs.*, pb.batch_number FROM feed_schedules fs JOIN poultry_batches pb ON fs.batch_id = pb.id WHERE fs.farm_id = ? AND fs.is_active = 1',
      [farm_id]
    ));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/schedules', async (req, res) => {
  try {
    const { farm_id, batch_id, feed_type, quantity_kg, frequency, time_of_day } = req.body;
    if (!farm_id || !batch_id || !feed_type || !quantity_kg || !frequency)
      return res.status(400).json({ error: 'Required fields missing' });
    await db.run('INSERT INTO feed_schedules (uuid, batch_id, farm_id, feed_type, quantity_kg, frequency, time_of_day) VALUES (?,?,?,?,?,?,?)',
      [uuidv4(), batch_id, farm_id, feed_type, quantity_kg, frequency, time_of_day]);
    res.json({ message: 'Schedule created' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/fcr', async (req, res) => {
  try {
    const { batch_id } = req.query;
    if (!batch_id) return res.status(400).json({ error: 'batch_id required' });
    const batch = await db.get('SELECT * FROM poultry_batches WHERE id = ?', [batch_id]);
    if (!batch) return res.status(404).json({ error: 'Batch not found' });
    const totalFeed = await db.get('SELECT SUM(quantity_kg) as total FROM feed_records WHERE batch_id = ?', [batch_id]);
    const birdsGrown = batch.initial_count - batch.current_count;
    const avgWeight = 2.0;
    const totalWeight = birdsGrown * avgWeight;
    const fcr = totalWeight > 0 ? ((totalFeed.total || 0) / totalWeight).toFixed(2) : 0;
    res.json({ total_feed_kg: totalFeed.total || 0, birds_grown: birdsGrown, estimated_weight_kg: totalWeight, fcr });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
