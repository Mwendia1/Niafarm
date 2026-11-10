const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db/schema');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/', async (req, res) => {
  try {
    let farms;
    if (req.user.role === 'admin') {
      farms = await db.all('SELECT f.*, u.name as owner_name FROM farms f JOIN users u ON f.owner_id = u.id WHERE f.is_active = 1');
    } else {
      farms = await db.all('SELECT f.*, u.name as owner_name FROM farms f JOIN users u ON f.owner_id = u.id WHERE f.owner_id = ? AND f.is_active = 1', [req.user.id]);
    }
    res.json(farms);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const farm = await db.get('SELECT * FROM farms WHERE uuid = ? AND is_active = 1', [req.params.id]);
    if (!farm) return res.status(404).json({ error: 'Farm not found' });
    res.json(farm);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { name, location, owner_name, phone, email, size, farming_type, num_houses, registration_date } = req.body;
    if (!name) return res.status(400).json({ error: 'Farm name required' });
    const uuid = uuidv4();
    const result = await db.run(
      'INSERT INTO farms (uuid, name, location, owner_name, phone, email, size, farming_type, num_houses, registration_date, owner_id) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [uuid, name, location, owner_name, phone, email, size, farming_type, num_houses || 0, registration_date, req.user.id]
    );
    await db.run('INSERT INTO farm_activities (uuid, farm_id, user_id, activity_type, description) VALUES (?,?,?,?,?)',
      [uuidv4(), result.lastInsertRowid, req.user.id, 'farm_created', `Farm "${name}" registered`]);
    res.json({ message: 'Farm created', id: result.lastInsertRowid, uuid });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, location, owner_name, phone, email, size, farming_type, num_houses, registration_date } = req.body;
    await db.run(
      "UPDATE farms SET name=?, location=?, owner_name=?, phone=?, email=?, size=?, farming_type=?, num_houses=?, registration_date=?, updated_at=datetime('now') WHERE uuid=?",
      [name, location, owner_name, phone, email, size, farming_type, num_houses, registration_date, req.params.id]
    );
    res.json({ message: 'Farm updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.run('UPDATE farms SET is_active = 0 WHERE uuid = ?', [req.params.id]);
    res.json({ message: 'Farm deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:farmId/houses', async (req, res) => {
  try {
    const farm = await db.get('SELECT id FROM farms WHERE uuid = ?', [req.params.farmId]);
    if (!farm) return res.status(404).json({ error: 'Farm not found' });
    const houses = await db.all('SELECT * FROM farm_houses WHERE farm_id = ?', [farm.id]);
    res.json(houses);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:farmId/houses', async (req, res) => {
  try {
    const farm = await db.get('SELECT id FROM farms WHERE uuid = ?', [req.params.farmId]);
    if (!farm) return res.status(404).json({ error: 'Farm not found' });
    const { name, capacity, description } = req.body;
    const uuid = uuidv4();
    const result = await db.run('INSERT INTO farm_houses (uuid, farm_id, name, capacity, description) VALUES (?,?,?,?,?)',
      [uuid, farm.id, name, capacity || 0, description]);
    res.json({ message: 'House added', id: result.lastInsertRowid, uuid });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
