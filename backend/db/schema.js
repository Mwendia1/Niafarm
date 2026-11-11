const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'niafarm.db');
const raw = new sqlite3.Database(DB_PATH);

const db = {
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      raw.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ lastInsertRowid: this.lastID, changes: this.changes });
      });
    });
  },
  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      raw.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
    });
  },
  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      raw.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
    });
  },
  exec(sql) {
    return new Promise((resolve, reject) => {
      raw.exec(sql, err => err ? reject(err) : resolve());
    });
  }
};

async function initSchema() {
  const tables = `
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT, uuid TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL,
      phone TEXT, role TEXT NOT NULL DEFAULT 'farm_worker', farm_id INTEGER,
      avatar TEXT, is_active INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS farms (
      id INTEGER PRIMARY KEY AUTOINCREMENT, uuid TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL, location TEXT, owner_name TEXT, phone TEXT, email TEXT,
      size TEXT, farming_type TEXT, num_houses INTEGER DEFAULT 0,
      registration_date TEXT, owner_id INTEGER NOT NULL, is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS farm_houses (
      id INTEGER PRIMARY KEY AUTOINCREMENT, uuid TEXT UNIQUE NOT NULL,
      farm_id INTEGER NOT NULL, name TEXT NOT NULL, capacity INTEGER DEFAULT 0,
      description TEXT, created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS poultry_batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT, uuid TEXT UNIQUE NOT NULL,
      farm_id INTEGER NOT NULL, batch_number TEXT NOT NULL, poultry_type TEXT NOT NULL,
      breed TEXT, initial_count INTEGER NOT NULL DEFAULT 0,
      current_count INTEGER NOT NULL DEFAULT 0, arrival_date TEXT NOT NULL,
      age_weeks INTEGER DEFAULT 0, supplier TEXT, purchase_price REAL DEFAULT 0,
      house_id INTEGER, status TEXT DEFAULT 'active', notes TEXT,
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS poultry_mortality (
      id INTEGER PRIMARY KEY AUTOINCREMENT, uuid TEXT UNIQUE NOT NULL,
      batch_id INTEGER NOT NULL, farm_id INTEGER NOT NULL, date TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 0, cause TEXT, notes TEXT,
      recorded_by INTEGER, created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS feed_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
      category TEXT NOT NULL, description TEXT, farm_id INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS feed_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT, uuid TEXT UNIQUE NOT NULL,
      batch_id INTEGER NOT NULL, farm_id INTEGER NOT NULL, feed_type_id INTEGER,
      feed_name TEXT NOT NULL, quantity_kg REAL NOT NULL DEFAULT 0,
      date TEXT NOT NULL, cost REAL DEFAULT 0, notes TEXT,
      recorded_by INTEGER, created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS feed_schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT, uuid TEXT UNIQUE NOT NULL,
      batch_id INTEGER NOT NULL, farm_id INTEGER NOT NULL, feed_type TEXT NOT NULL,
      quantity_kg REAL NOT NULL, frequency TEXT NOT NULL, time_of_day TEXT,
      is_active INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS health_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT, uuid TEXT UNIQUE NOT NULL,
      batch_id INTEGER NOT NULL, farm_id INTEGER NOT NULL, date TEXT NOT NULL,
      type TEXT NOT NULL, description TEXT, treatment TEXT, medication TEXT,
      dosage TEXT, vet_name TEXT, cost REAL DEFAULT 0, outcome TEXT, notes TEXT,
      recorded_by INTEGER, created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS vaccination_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT, uuid TEXT UNIQUE NOT NULL,
      batch_id INTEGER NOT NULL, farm_id INTEGER NOT NULL, vaccine_name TEXT NOT NULL,
      date_given TEXT, next_due_date TEXT, age_at_vaccination INTEGER, method TEXT,
      administered_by TEXT, cost REAL DEFAULT 0, status TEXT DEFAULT 'scheduled',
      notes TEXT, created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS egg_production (
      id INTEGER PRIMARY KEY AUTOINCREMENT, uuid TEXT UNIQUE NOT NULL,
      batch_id INTEGER NOT NULL, farm_id INTEGER NOT NULL, date TEXT NOT NULL,
      total_collected INTEGER DEFAULT 0, good_eggs INTEGER DEFAULT 0,
      broken_eggs INTEGER DEFAULT 0, damaged_eggs INTEGER DEFAULT 0,
      small_eggs INTEGER DEFAULT 0, medium_eggs INTEGER DEFAULT 0,
      large_eggs INTEGER DEFAULT 0, xlarge_eggs INTEGER DEFAULT 0,
      eggs_sold INTEGER DEFAULT 0, notes TEXT, recorded_by INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT, uuid TEXT UNIQUE NOT NULL,
      farm_id INTEGER NOT NULL, name TEXT NOT NULL, category TEXT NOT NULL,
      quantity REAL NOT NULL DEFAULT 0, unit TEXT NOT NULL,
      purchase_price REAL DEFAULT 0, supplier TEXT, purchase_date TEXT,
      expiry_date TEXT, low_stock_threshold REAL DEFAULT 10, notes TEXT,
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS inventory_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT, uuid TEXT UNIQUE NOT NULL,
      inventory_id INTEGER NOT NULL, farm_id INTEGER NOT NULL, type TEXT NOT NULL,
      quantity REAL NOT NULL, date TEXT NOT NULL, reference TEXT, notes TEXT,
      recorded_by INTEGER, created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT, uuid TEXT UNIQUE NOT NULL,
      farm_id INTEGER NOT NULL, name TEXT NOT NULL, phone TEXT, email TEXT,
      address TEXT, customer_type TEXT DEFAULT 'individual', notes TEXT,
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT, uuid TEXT UNIQUE NOT NULL,
      farm_id INTEGER NOT NULL, customer_id INTEGER, customer_name TEXT,
      sale_date TEXT NOT NULL, total_amount REAL NOT NULL DEFAULT 0,
      amount_paid REAL DEFAULT 0, payment_method TEXT DEFAULT 'cash',
      payment_status TEXT DEFAULT 'paid', notes TEXT, recorded_by INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT, sale_id INTEGER NOT NULL,
      product_type TEXT NOT NULL, batch_id INTEGER, description TEXT,
      quantity REAL NOT NULL, unit TEXT, unit_price REAL NOT NULL, total_price REAL NOT NULL
    );
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT, uuid TEXT UNIQUE NOT NULL,
      farm_id INTEGER NOT NULL, category TEXT NOT NULL, description TEXT NOT NULL,
      amount REAL NOT NULL DEFAULT 0, date TEXT NOT NULL,
      payment_method TEXT DEFAULT 'cash', reference TEXT, batch_id INTEGER,
      notes TEXT, recorded_by INTEGER, created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS income (
      id INTEGER PRIMARY KEY AUTOINCREMENT, uuid TEXT UNIQUE NOT NULL,
      farm_id INTEGER NOT NULL, source TEXT NOT NULL, description TEXT,
      amount REAL NOT NULL DEFAULT 0, date TEXT NOT NULL,
      payment_method TEXT DEFAULT 'cash', reference TEXT, notes TEXT,
      recorded_by INTEGER, created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT, uuid TEXT UNIQUE NOT NULL,
      user_id INTEGER NOT NULL, farm_id INTEGER, type TEXT NOT NULL,
      title TEXT NOT NULL, message TEXT NOT NULL, priority TEXT DEFAULT 'normal',
      is_read INTEGER DEFAULT 0, due_date TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS farm_activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT, uuid TEXT UNIQUE NOT NULL,
      farm_id INTEGER NOT NULL, user_id INTEGER, activity_type TEXT NOT NULL,
      description TEXT NOT NULL, reference_id INTEGER, reference_type TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS user_roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT, role_name TEXT UNIQUE NOT NULL,
      permissions TEXT NOT NULL, description TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `;
  await db.exec(tables);

  const roles = [
    ['admin', '["all"]', 'Full system access'],
    ['farm_owner', '["farms","flocks","feeding","health","eggs","inventory","sales","expenses","reports","notifications","settings"]', 'Farm owner'],
    ['farm_manager', '["flocks","feeding","health","eggs","inventory","sales","expenses","reports"]', 'Farm manager'],
    ['farm_worker', '["flocks","feeding","health","eggs","inventory"]', 'Farm worker'],
    ['accountant', '["expenses","sales","reports","inventory"]', 'Accountant'],
  ];
  for (const [name, perms, desc] of roles) {
    await db.run('INSERT OR IGNORE INTO user_roles (role_name, permissions, description) VALUES (?,?,?)', [name, perms, desc]);
  }

  const feeds = [
    ['Chick Starter', 'starter', 'For chicks 0-4 weeks'],
    ['Grower Feed', 'grower', 'For growing birds 4-8 weeks'],
    ['Broiler Finisher', 'finisher', 'For broilers 8+ weeks'],
    ['Layer Mash', 'layer', 'For laying hens'],
    ['Kienyeji Feed', 'kienyeji', 'For indigenous birds'],
  ];
  for (const [name, cat, desc] of feeds) {
    const ex = await db.get('SELECT id FROM feed_types WHERE name = ?', [name]);
    if (!ex) await db.run('INSERT INTO feed_types (name, category, description) VALUES (?,?,?)', [name, cat, desc]);
  }

  try { await db.run('ALTER TABLE users ADD COLUMN avatar TEXT'); } catch {}
  try { await db.run('ALTER TABLE users ADD COLUMN job_title TEXT'); } catch {}
  try { await db.run('ALTER TABLE users ADD COLUMN added_by INTEGER'); } catch {}
  console.log('Database ready');
}

initSchema().catch(err => console.error('DB init error:', err));

module.exports = db;
