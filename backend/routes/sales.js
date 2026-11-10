const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db/schema');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/customers', async (req, res) => {
  try {
    const { farm_id } = req.query;
    if (!farm_id) return res.status(400).json({ error: 'farm_id required' });
    res.json(await db.all('SELECT * FROM customers WHERE farm_id = ? ORDER BY name ASC', [farm_id]));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/customers', async (req, res) => {
  try {
    const { farm_id, name, phone, email, address, customer_type, notes } = req.body;
    if (!farm_id || !name) return res.status(400).json({ error: 'farm_id and name required' });
    const uuid = uuidv4();
    const result = await db.run('INSERT INTO customers (uuid, farm_id, name, phone, email, address, customer_type, notes) VALUES (?,?,?,?,?,?,?,?)',
      [uuid, farm_id, name, phone, email, address, customer_type || 'individual', notes]);
    res.json({ message: 'Customer added', id: result.lastInsertRowid, uuid });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/customers/:id', async (req, res) => {
  try {
    const { name, phone, email, address, customer_type, notes } = req.body;
    await db.run("UPDATE customers SET name=?, phone=?, email=?, address=?, customer_type=?, notes=?, updated_at=datetime('now') WHERE uuid=?",
      [name, phone, email, address, customer_type, notes, req.params.id]);
    res.json({ message: 'Updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/customers/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM customers WHERE uuid = ?', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/', async (req, res) => {
  try {
    const { farm_id, start_date, end_date, payment_status } = req.query;
    if (!farm_id) return res.status(400).json({ error: 'farm_id required' });
    let sql = 'SELECT s.*, c.name as customer_name_ref FROM sales s LEFT JOIN customers c ON s.customer_id = c.id WHERE s.farm_id = ?';
    const params = [farm_id];
    if (start_date) { sql += ' AND s.sale_date >= ?'; params.push(start_date); }
    if (end_date) { sql += ' AND s.sale_date <= ?'; params.push(end_date); }
    if (payment_status) { sql += ' AND s.payment_status = ?'; params.push(payment_status); }
    sql += ' ORDER BY s.sale_date DESC';
    const sales = await db.all(sql, params);
    for (const sale of sales) {
      sale.items = await db.all('SELECT * FROM sale_items WHERE sale_id = ?', [sale.id]);
    }
    res.json(sales);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const sale = await db.get('SELECT s.*, c.name as customer_name_ref, c.phone as customer_phone FROM sales s LEFT JOIN customers c ON s.customer_id = c.id WHERE s.uuid = ?', [req.params.id]);
    if (!sale) return res.status(404).json({ error: 'Sale not found' });
    sale.items = await db.all('SELECT * FROM sale_items WHERE sale_id = ?', [sale.id]);
    res.json(sale);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { farm_id, customer_id, customer_name, sale_date, items, payment_method, payment_status, notes } = req.body;
    if (!farm_id || !items || !items.length) return res.status(400).json({ error: 'farm_id and items required' });
    const total = items.reduce((s, i) => s + (i.quantity * i.unit_price), 0);
    const uuid = uuidv4();
    const result = await db.run(
      'INSERT INTO sales (uuid, farm_id, customer_id, customer_name, sale_date, total_amount, amount_paid, payment_method, payment_status, notes, recorded_by) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [uuid, farm_id, customer_id || null, customer_name || null, sale_date, total, payment_status === 'paid' ? total : 0, payment_method || 'cash', payment_status || 'paid', notes, req.user.id]
    );
    const saleId = result.lastInsertRowid;
    for (const item of items) {
      await db.run('INSERT INTO sale_items (sale_id, product_type, batch_id, description, quantity, unit, unit_price, total_price) VALUES (?,?,?,?,?,?,?,?)',
        [saleId, item.product_type, item.batch_id || null, item.description, item.quantity, item.unit, item.unit_price, item.quantity * item.unit_price]);
      if (item.product_type === 'live_chicken' && item.batch_id) {
        await db.run("UPDATE poultry_batches SET current_count = current_count - ?, updated_at = datetime('now') WHERE id = ?", [item.quantity, item.batch_id]);
      }
    }
    await db.run('INSERT INTO income (uuid, farm_id, source, description, amount, date, payment_method, reference, recorded_by) VALUES (?,?,?,?,?,?,?,?,?)',
      [uuidv4(), farm_id, 'sales', `Sale #${saleId}`, total, sale_date, payment_method || 'cash', uuid, req.user.id]);
    await db.run('INSERT INTO farm_activities (uuid, farm_id, user_id, activity_type, description) VALUES (?,?,?,?,?)',
      [uuidv4(), farm_id, req.user.id, 'sale_recorded', `Sale of KSh ${total.toLocaleString()} recorded`]);
    res.json({ message: 'Sale recorded', id: saleId, uuid, total });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const { payment_status, amount_paid, payment_method, notes } = req.body;
    await db.run('UPDATE sales SET payment_status=?, amount_paid=?, payment_method=?, notes=? WHERE uuid=?',
      [payment_status, amount_paid, payment_method, notes, req.params.id]);
    res.json({ message: 'Updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
