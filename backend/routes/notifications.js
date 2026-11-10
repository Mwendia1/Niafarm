const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db/schema');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

// Get notifications
router.get('/', (req, res) => {
  const { farm_id, is_read } = req.query;
  let query = 'SELECT * FROM notifications WHERE user_id = ?';
  const params = [req.user.id];
  if (farm_id) { query += ' AND farm_id = ?'; params.push(farm_id); }
  if (is_read !== undefined) { query += ' AND is_read = ?'; params.push(is_read === 'true' ? 1 : 0); }
  query += ' ORDER BY created_at DESC LIMIT 50';
  res.json(db.prepare(query).all(...params));
});

// Mark as read
router.put('/:id/read', (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE uuid = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ message: 'Marked as read' });
});

// Mark all as read
router.put('/read-all', (req, res) => {
  const { farm_id } = req.body;
  let query = 'UPDATE notifications SET is_read = 1 WHERE user_id = ?';
  const params = [req.user.id];
  if (farm_id) { query += ' AND farm_id = ?'; params.push(farm_id); }
  db.prepare(query).run(...params);
  res.json({ message: 'All notifications marked as read' });
});

// Delete notification
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM notifications WHERE uuid = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ message: 'Notification deleted' });
});

// Create custom reminder
router.post('/', (req, res) => {
  const { farm_id, type, title, message, priority, due_date } = req.body;
  if (!title || !message) return res.status(400).json({ error: 'title and message required' });
  const uuid = uuidv4();
  db.prepare('INSERT INTO notifications (uuid, user_id, farm_id, type, title, message, priority, due_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(uuid, req.user.id, farm_id || null, type || 'reminder', title, message, priority || 'normal', due_date || null);
  res.json({ message: 'Reminder created' });
});

// Get users (admin only)
router.get('/users', (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'farm_owner') return res.status(403).json({ error: 'Forbidden' });
  const users = db.prepare('SELECT id, uuid, name, email, phone, role, is_active, created_at FROM users').all();
  res.json(users);
});

module.exports = router;
