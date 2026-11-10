const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db/schema');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/', async (req, res) => {
  try {
    const { farm_id, category } = req.query;
    if (!farm_id) return res.status(400).json({ error: 'farm_id required' });
    let sql = 'SELECT * FROM inventory WHERE farm_id = ?';
    const params = [farm_id];
    if (category) { sql += ' AND category = ?'; params.push(category); }
    sql += ' ORDER BY name ASC';
    res.json(await db.all(sql, params));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/alerts/low-stock', async (req, res) => {
  try {
    const { farm_id } = req.query;
    if (!farm_id) return res.status(400).json({ error: 'farm_id required' });
    res.json(await db.all('SELECT * FROM inventory WHERE farm_id = ? AND quantity <= low_stock_threshold', [farm_id]));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/alerts/expiring', async (req, res) => {
  try {
    const { farm_id, days } = req.query;
    if (!farm_id) return res.status(400).json({ error: 'farm_id required' });
    const d = days || 30;
    res.json(await db.all(`SELECT * FROM inventory WHERE farm_id = ? AND expiry_date IS NOT NULL AND expiry_date <= date('now', '+${d} days') AND expiry_date >= date('now')`, [farm_id]));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const item = await db.get('SELECT * FROM inventory WHERE uuid = ?', [req.params.id]);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    res.json(item);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { farm_id, name, category, quantity, unit, purchase_price, supplier, purchase_date, expiry_date, low_stock_threshold, notes } = req.body;
    if (!farm_id || !name || !category || !unit) return res.status(400).json({ error: 'Required fields missing' });
    const uuid = uuidv4();
    const result = await db.run('INSERT INTO inventory (uuid, farm_id, name, category, quantity, unit, purchase_price, supplier, purchase_date, expiry_date, low_stock_threshold, notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
      [uuid, farm_id, name, category, quantity || 0, unit, purchase_price || 0, supplier, purchase_date, expiry_date, low_stock_threshold || 10, notes]);
    if (quantity > 0) {
      await db.run('INSERT INTO inventory_transactions (uuid, inventory_id, farm_id, type, quantity, date, notes) VALUES (?,?,?,?,?,?,?)',
        [uuidv4(), result.lastInsertRowid, farm_id, 'purchase', quantity, purchase_date || new Date().toISOString().split('T')[0], 'Initial stock']);
    }
    if ((quantity || 0) <= (low_stock_threshold || 10)) {
      await db.run('INSERT INTO notifications (uuid, user_id, farm_id, type, title, message, priority) VALUES (?,?,?,?,?,?,?)',
        [uuidv4(), req.user.id, farm_id, 'low_stock', `Low Stock: ${name}`, `${name} stock is low (${quantity} ${unit})`, 'high']);
    }
    res.json({ message: 'Item added', id: result.lastInsertRowid, uuid });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, category, unit, purchase_price, supplier, expiry_date, low_stock_threshold, notes } = req.body;
    await db.run("UPDATE inventory SET name=?, category=?, unit=?, purchase_price=?, supplier=?, expiry_date=?, low_stock_threshold=?, notes=?, updated_at=datetime('now') WHERE uuid=?",
      [name, category, unit, purchase_price, supplier, expiry_date, low_stock_threshold, notes, req.params.id]);
    res.json({ message: 'Updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM inventory WHERE uuid = ?', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/transaction', async (req, res) => {
  try {
    const item = await db.get('SELECT * FROM inventory WHERE uuid = ?', [req.params.id]);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    const { type, quantity, date, reference, notes } = req.body;
    if (!type || !quantity) return res.status(400).json({ error: 'type and quantity required' });
    await db.run('INSERT INTO inventory_transactions (uuid, inventory_id, farm_id, type, quantity, date, reference, notes, recorded_by) VALUES (?,?,?,?,?,?,?,?,?)',
      [uuidv4(), item.id, item.farm_id, type, quantity, date, reference, notes, req.user.id]);
    if (type === 'purchase' || type === 'adjustment_in') {
      await db.run("UPDATE inventory SET quantity = quantity + ?, updated_at = datetime('now') WHERE id = ?", [quantity, item.id]);
    } else {
      await db.run("UPDATE inventory SET quantity = quantity - ?, updated_at = datetime('now') WHERE id = ?", [quantity, item.id]);
    }
    const updated = await db.get('SELECT * FROM inventory WHERE id = ?', [item.id]);
    if (updated.quantity <= updated.low_stock_threshold) {
      await db.run('INSERT INTO notifications (uuid, user_id, farm_id, type, title, message, priority) VALUES (?,?,?,?,?,?,?)',
        [uuidv4(), req.user.id, item.farm_id, 'low_stock', `Low Stock: ${item.name}`, `${item.name} is running low (${updated.quantity} ${item.unit} remaining)`, 'high']);
    }
    res.json({ message: 'Transaction recorded', new_quantity: updated.quantity });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id/transactions', async (req, res) => {
  try {
    const item = await db.get('SELECT * FROM inventory WHERE uuid = ?', [req.params.id]);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    res.json(await db.all('SELECT * FROM inventory_transactions WHERE inventory_id = ? ORDER BY date DESC', [item.id]));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
