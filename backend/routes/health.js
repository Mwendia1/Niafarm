const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db/schema');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/', async (req, res) => {
  try {
    const { farm_id, batch_id } = req.query;
    if (!farm_id) return res.status(400).json({ error: 'farm_id required' });
    let sql = 'SELECT hr.*, pb.batch_number FROM health_records hr JOIN poultry_batches pb ON hr.batch_id = pb.id WHERE hr.farm_id = ?';
    const params = [farm_id];
    if (batch_id) { sql += ' AND hr.batch_id = ?'; params.push(batch_id); }
    sql += ' ORDER BY hr.date DESC';
    res.json(await db.all(sql, params));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

const canEditHealth = (user) => ['admin', 'farm_owner'].includes(user.role) || user.job_title === 'Veterinarian';

router.post('/', async (req, res) => {
  try {
    const editor = await db.get('SELECT role, job_title FROM users WHERE id = ?', [req.user.id]);
    if (!canEditHealth(editor)) return res.status(403).json({ error: 'Only farm owners and veterinarians can add health records' });
    const { farm_id, batch_id, date, type, description, treatment, medication, dosage, vet_name, cost, outcome, notes } = req.body;
    if (!farm_id || !batch_id || !date || !type) return res.status(400).json({ error: 'Required fields missing' });
    await db.run('INSERT INTO health_records (uuid, batch_id, farm_id, date, type, description, treatment, medication, dosage, vet_name, cost, outcome, notes, recorded_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [uuidv4(), batch_id, farm_id, date, type, description, treatment, medication, dosage, vet_name, cost || 0, outcome, notes, req.user.id]);
    await db.run('INSERT INTO farm_activities (uuid, farm_id, user_id, activity_type, description) VALUES (?,?,?,?,?)',
      [uuidv4(), farm_id, req.user.id, 'health_recorded', `Health record: ${type}`]);
    res.json({ message: 'Health record added' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const editor = await db.get('SELECT role, job_title FROM users WHERE id = ?', [req.user.id]);
    if (!canEditHealth(editor)) return res.status(403).json({ error: 'Forbidden' });
    const { type, description, treatment, medication, dosage, vet_name, cost, outcome, notes } = req.body;
    await db.run('UPDATE health_records SET type=?, description=?, treatment=?, medication=?, dosage=?, vet_name=?, cost=?, outcome=?, notes=? WHERE uuid=?',
      [type, description, treatment, medication, dosage, vet_name, cost, outcome, notes, req.params.id]);
    res.json({ message: 'Updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const editor = await db.get('SELECT role, job_title FROM users WHERE id = ?', [req.user.id]);
    if (!canEditHealth(editor)) return res.status(403).json({ error: 'Forbidden' });
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/vaccinations', async (req, res) => {
  try {
    const { farm_id, batch_id, status } = req.query;
    if (!farm_id) return res.status(400).json({ error: 'farm_id required' });
    let sql = 'SELECT vr.*, pb.batch_number FROM vaccination_records vr JOIN poultry_batches pb ON vr.batch_id = pb.id WHERE vr.farm_id = ?';
    const params = [farm_id];
    if (batch_id) { sql += ' AND vr.batch_id = ?'; params.push(batch_id); }
    if (status) { sql += ' AND vr.status = ?'; params.push(status); }
    sql += ' ORDER BY vr.next_due_date ASC';
    res.json(await db.all(sql, params));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/vaccinations', async (req, res) => {
  try {
    const editor = await db.get('SELECT role, job_title FROM users WHERE id = ?', [req.user.id]);
    if (!canEditHealth(editor)) return res.status(403).json({ error: 'Only farm owners and veterinarians can add vaccination records' });
    const { farm_id, batch_id, vaccine_name, date_given, next_due_date, age_at_vaccination, method, administered_by, cost, status, notes } = req.body;
    if (!farm_id || !batch_id || !vaccine_name) return res.status(400).json({ error: 'Required fields missing' });
    await db.run('INSERT INTO vaccination_records (uuid, batch_id, farm_id, vaccine_name, date_given, next_due_date, age_at_vaccination, method, administered_by, cost, status, notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
      [uuidv4(), batch_id, farm_id, vaccine_name, date_given, next_due_date, age_at_vaccination, method, administered_by, cost || 0, status || 'scheduled', notes]);
    if (next_due_date) {
      const batch = await db.get('SELECT * FROM poultry_batches WHERE id = ?', [batch_id]);
      await db.run('INSERT INTO notifications (uuid, user_id, farm_id, type, title, message, priority, due_date) VALUES (?,?,?,?,?,?,?,?)',
        [uuidv4(), req.user.id, farm_id, 'vaccination', `Vaccination Due: ${vaccine_name}`, `${vaccine_name} is due for batch ${batch?.batch_number || batch_id}`, 'high', next_due_date]);
    }
    await db.run('INSERT INTO farm_activities (uuid, farm_id, user_id, activity_type, description) VALUES (?,?,?,?,?)',
      [uuidv4(), farm_id, req.user.id, 'vaccination_recorded', `Vaccination: ${vaccine_name}`]);
    res.json({ message: 'Vaccination record added' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/vaccinations/:id', async (req, res) => {
  try {
    const editor = await db.get('SELECT role, job_title FROM users WHERE id = ?', [req.user.id]);
    if (!canEditHealth(editor)) return res.status(403).json({ error: 'Forbidden' });
    const { vaccine_name, date_given, next_due_date, age_at_vaccination, method, administered_by, cost, status, notes } = req.body;
    await db.run('UPDATE vaccination_records SET vaccine_name=?, date_given=?, next_due_date=?, age_at_vaccination=?, method=?, administered_by=?, cost=?, status=?, notes=? WHERE uuid=?',
      [vaccine_name, date_given, next_due_date, age_at_vaccination, method, administered_by, cost, status, notes, req.params.id]);
    res.json({ message: 'Updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/vaccinations/:id', async (req, res) => {
  try {
    const editor = await db.get('SELECT role, job_title FROM users WHERE id = ?', [req.user.id]);
    if (!canEditHealth(editor)) return res.status(403).json({ error: 'Forbidden' });
    await db.run('DELETE FROM vaccination_records WHERE uuid = ?', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/vaccination-templates', (req, res) => {
  res.json({
    templates: {
      broiler: [
        { day: 1, vaccine: "Marek's Disease", method: 'Subcutaneous injection', notes: 'At hatchery' },
        { day: 7, vaccine: 'Newcastle Disease (ND) + Infectious Bronchitis (IB)', method: 'Eye drop / Drinking water', notes: 'Consult vet for local strain' },
        { day: 14, vaccine: 'Gumboro (IBD)', method: 'Drinking water', notes: 'Consult vet for timing' },
        { day: 21, vaccine: 'Newcastle Disease Booster', method: 'Drinking water', notes: 'Consult vet' },
      ],
      layer: [
        { day: 1, vaccine: "Marek's Disease", method: 'Subcutaneous injection', notes: 'At hatchery' },
        { day: 7, vaccine: 'Newcastle Disease + IB', method: 'Eye drop', notes: 'Consult vet' },
        { day: 14, vaccine: 'Gumboro (IBD)', method: 'Drinking water', notes: 'Consult vet' },
        { day: 28, vaccine: 'Fowl Pox', method: 'Wing web stab', notes: 'Consult vet' },
        { day: 42, vaccine: 'Newcastle Disease Booster', method: 'Drinking water', notes: 'Consult vet' },
        { day: 112, vaccine: 'Newcastle Disease + IB (Pre-lay)', method: 'Injection', notes: 'Before laying starts' },
      ],
      kienyeji: [
        { day: 7, vaccine: 'Newcastle Disease', method: 'Eye drop / Drinking water', notes: 'Consult local vet' },
        { day: 21, vaccine: 'Gumboro', method: 'Drinking water', notes: 'Consult vet' },
        { day: 42, vaccine: 'Newcastle Disease Booster', method: 'Drinking water', notes: 'Every 3 months thereafter' },
      ]
    },
    disclaimer: 'These are general reference schedules only. Always consult a qualified poultry veterinarian for advice specific to your location, local disease risks, and current vaccine availability.'
  });
});

module.exports = router;
