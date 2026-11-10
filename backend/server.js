const express = require('express');
const cors = require('cors');
const path = require('path');

// Initialize DB
require('./db/schema');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend
app.use(express.static(path.join(__dirname, '../frontend')));

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/farms', require('./routes/farms'));
app.use('/api/flocks', require('./routes/flocks'));
app.use('/api/feeding', require('./routes/feeding'));
app.use('/api/health', require('./routes/health'));
app.use('/api/eggs', require('./routes/eggs'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/sales', require('./routes/sales'));
app.use('/api/expenses', require('./routes/expenses'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/notifications', require('./routes/notifications'));

// Catch-all: serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🐔 NiaFarm Server running at http://localhost:${PORT}`);
  console.log(`   Open your browser and go to http://localhost:${PORT}\n`);
});
