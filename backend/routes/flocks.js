const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db/schema');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/', async (req, res) => {
  try {
    const { farm_id } = req.query;
    if (!farm_id) return res.status(400).json({ error: 'farm_id required' });
    const batches = await db.all(
      'SELECT pb.*, fh.name as house_name FROM poultry_batches pb LEFT JOIN farm_houses fh ON pb.house_id = fh.id WHERE pb.farm_id = ? ORDER BY pb.created_at DESC',
      [farm_id]
    );
    res.json(batches);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const batch = await db.get(
      'SELECT pb.*, fh.name as house_name FROM poultry_batches pb LEFT JOIN farm_houses fh ON pb.house_id = fh.id WHERE pb.uuid = ?',
      [req.params.id]
    );
    if (!batch) return res.status(404).json({ error: 'Batch not found' });
    res.json(batch);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { farm_id, batch_number, poultry_type, breed, initial_count, arrival_date, age_weeks, supplier, purchase_price, house_id, notes } = req.body;
    if (!farm_id || !batch_number || !poultry_type || !initial_count || !arrival_date)
      return res.status(400).json({ error: 'farm_id, batch_number, poultry_type, initial_count, arrival_date required' });
    const uuid = uuidv4();
    const result = await db.run(
      'INSERT INTO poultry_batches (uuid, farm_id, batch_number, poultry_type, breed, initial_count, current_count, arrival_date, age_weeks, supplier, purchase_price, house_id, notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [uuid, farm_id, batch_number, poultry_type, breed, initial_count, initial_count, arrival_date, age_weeks || 0, supplier, purchase_price || 0, house_id || null, notes]
    );
    await db.run('INSERT INTO farm_activities (uuid, farm_id, user_id, activity_type, description, reference_id, reference_type) VALUES (?,?,?,?,?,?,?)',
      [uuidv4(), farm_id, req.user.id, 'batch_added', `New batch "${batch_number}" added (${initial_count} ${poultry_type})`, result.lastInsertRowid, 'batch']);
    res.json({ message: 'Batch created', id: result.lastInsertRowid, uuid });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const { batch_number, poultry_type, breed, arrival_date, age_weeks, supplier, purchase_price, house_id, status, notes } = req.body;
    await db.run(
      "UPDATE poultry_batches SET batch_number=?, poultry_type=?, breed=?, arrival_date=?, age_weeks=?, supplier=?, purchase_price=?, house_id=?, status=?, notes=?, updated_at=datetime('now') WHERE uuid=?",
      [batch_number, poultry_type, breed, arrival_date, age_weeks, supplier, purchase_price, house_id, status, notes, req.params.id]
    );
    res.json({ message: 'Batch updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.run("UPDATE poultry_batches SET status = 'closed', updated_at = datetime('now') WHERE uuid = ?", [req.params.id]);
    res.json({ message: 'Batch closed' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/mortality', async (req, res) => {
  try {
    const batch = await db.get('SELECT * FROM poultry_batches WHERE uuid = ?', [req.params.id]);
    if (!batch) return res.status(404).json({ error: 'Batch not found' });
    const { date, count, cause, notes } = req.body;
    if (!count || count <= 0) return res.status(400).json({ error: 'Valid count required' });
    await db.run('INSERT INTO poultry_mortality (uuid, batch_id, farm_id, date, count, cause, notes, recorded_by) VALUES (?,?,?,?,?,?,?,?)',
      [uuidv4(), batch.id, batch.farm_id, date, count, cause, notes, req.user.id]);
    await db.run("UPDATE poultry_batches SET current_count = current_count - ?, updated_at = datetime('now') WHERE id = ?", [count, batch.id]);
    await db.run('INSERT INTO farm_activities (uuid, farm_id, user_id, activity_type, description, reference_id, reference_type) VALUES (?,?,?,?,?,?,?)',
      [uuidv4(), batch.farm_id, req.user.id, 'mortality_recorded', `${count} bird(s) died in batch ${batch.batch_number}`, batch.id, 'batch']);
    res.json({ message: 'Mortality recorded' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id/mortality', async (req, res) => {
  try {
    const batch = await db.get('SELECT * FROM poultry_batches WHERE uuid = ?', [req.params.id]);
    if (!batch) return res.status(404).json({ error: 'Batch not found' });
    const records = await db.all('SELECT * FROM poultry_mortality WHERE batch_id = ? ORDER BY date DESC', [batch.id]);
    res.json(records);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
