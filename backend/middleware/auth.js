const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'niafarm_secret_2024_poultry';

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access token required' });
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
  });
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if (roles.includes(req.user.role) || req.user.role === 'admin') return next();
    return res.status(403).json({ error: 'Insufficient permissions' });
  };
}

module.exports = { authenticateToken, requireRole, JWT_SECRET };
