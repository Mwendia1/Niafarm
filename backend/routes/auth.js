const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/schema');
const { JWT_SECRET, authenticateToken } = require('../middleware/auth');

router.post('/register', async (req, res) => {
  try {
    const { name, email, password, phone, role } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password required' });
    const existing = await db.get('SELECT id FROM users WHERE email = ?', [email]);
    if (existing) return res.status(409).json({ error: 'Email already registered' });
    const hash = bcrypt.hashSync(password, 10);
    const uuid = uuidv4();
    const allowed = ['admin','farm_owner','farm_manager','farm_worker','accountant'];
    const userRole = allowed.includes(role) ? role : 'farm_owner';
    const result = await db.run('INSERT INTO users (uuid, name, email, password, phone, role) VALUES (?,?,?,?,?,?)', [uuid, name, email, hash, phone || null, userRole]);
    const token = jwt.sign({ id: result.lastInsertRowid, uuid, name, email, role: userRole }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: result.lastInsertRowid, uuid, name, email, role: userRole } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    const user = await db.get('SELECT * FROM users WHERE email = ? AND is_active = 1', [email]);
    if (!user || !bcrypt.compareSync(password, user.password)) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user.id, uuid: user.uuid, name: user.name, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, uuid: user.uuid, name: user.name, email: user.email, role: user.role } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    const user = await db.get('SELECT * FROM users WHERE id = ?', [req.user.id]);
    if (!bcrypt.compareSync(current_password, user.password)) return res.status(400).json({ error: 'Current password incorrect' });
    const hash = bcrypt.hashSync(new_password, 10);
    await db.run("UPDATE users SET password = ?, updated_at = datetime('now') WHERE id = ?", [hash, req.user.id]);
    res.json({ message: 'Password changed successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = await db.get('SELECT id, uuid, name, email, phone, role, avatar, created_at FROM users WHERE id = ?', [req.user.id]);
    res.json(user);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { name, phone } = req.body;
    await db.run("UPDATE users SET name = ?, phone = ?, updated_at = datetime('now') WHERE id = ?", [name, phone, req.user.id]);
    res.json({ message: 'Profile updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

const multer = require('multer');
const upload = multer({
  dest: require('path').join(__dirname, '../uploads/avatars'),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Images only'));
    cb(null, true);
  }
});

router.post('/avatar', authenticateToken, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    await db.run("UPDATE users SET avatar = ?, updated_at = datetime('now') WHERE id = ?", [avatarUrl, req.user.id]);
    res.json({ avatar: avatarUrl });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Admin: get all users
router.get('/users', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    res.json(await db.all('SELECT id, uuid, name, email, phone, role, is_active, created_at FROM users ORDER BY created_at DESC'));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Admin: impersonate a user
router.post('/impersonate/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const user = await db.get('SELECT id, uuid, name, email, role FROM users WHERE id = ? AND is_active = 1', [req.params.id]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const token = jwt.sign({ id: user.id, uuid: user.uuid, name: user.name, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '2h' });
    res.json({ token, user });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
