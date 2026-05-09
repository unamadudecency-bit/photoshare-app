const jwt = require('jsonwebtoken');
const config = require('../config');

function verifyToken(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid token' });
  }
  try {
    const token = header.split(' ')[1];
    const payload = jwt.verify(token, config.jwt.secret);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function requireCreator(req, res, next) {
  if (req.user?.role !== 'creator') {
    return res.status(403).json({ error: 'Creator role required' });
  }
  next();
}

module.exports = { verifyToken, requireCreator };