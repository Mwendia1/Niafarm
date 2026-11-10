const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db/schema');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/', async (req, res) => {
  try {
    const { farm_id, is_read } = req.query;
    let sql = 'SELECT * FROM notifications WHERE user_id = ?';
    const params = [req.user.id];
    if (farm_id) { sql += ' AND farm_id = ?'; params.push(farm_id); }
    if (is_read !== undefined) { sql += ' AND is_read = ?'; params.push(is_read === 'true' ? 1 : 0); }
    sql += ' ORDER BY created_at DESC LIMIT 50';
    res.json(await db.all(sql, params));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { farm_id, type, title, message, priority, due_date } = req.body;
    if (!title || !message) return res.status(400).json({ error: 'title and message required' });
    await db.run('INSERT INTO notifications (uuid, user_id, farm_id, type, title, message, priority, due_date) VALUES (?,?,?,?,?,?,?,?)',
      [uuidv4(), req.user.id, farm_id || null, type || 'reminder', title, message, priority || 'normal', due_date || null]);
    res.json({ message: 'Reminder created' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/read-all', async (req, res) => {
  try {
    const { farm_id } = req.body;
    let sql = 'UPDATE notifications SET is_read = 1 WHERE user_id = ?';
    const params = [req.user.id];
    if (farm_id) { sql += ' AND farm_id = ?'; params.push(farm_id); }
    await db.run(sql, params);
    res.json({ message: 'All marked as read' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id/read', async (req, res) => {
  try {
    await db.run('UPDATE notifications SET is_read = 1 WHERE uuid = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ message: 'Marked as read' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM notifications WHERE uuid = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/users', async (req, res) => {
  try {
    if (!['admin', 'farm_owner'].includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
    res.json(await db.all('SELECT id, uuid, name, email, phone, role, is_active, created_at FROM users'));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
