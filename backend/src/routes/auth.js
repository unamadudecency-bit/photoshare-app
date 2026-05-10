const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { users } = require('../db');
const config = require('../config');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// Register (public — registers as consumer; creators added via admin script)
router.post('/register', async (req, res) => {
  try {
    const { email, password, displayName } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password required' });
    }

    // Check duplicate
    const { resources } = await users.items
      .query({
        query: 'SELECT * FROM c WHERE c.email = @e',
        parameters: [{ name: '@e', value: email }]
      })
      .fetchAll();
    if (resources.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = {
      id: uuidv4(),
      email,
      passwordHash,
      displayName: displayName || email.split('@')[0],
      role: 'consumer',
      createdAt: new Date().toISOString()
    };
    await users.items.create(user);

    const token = jwt.sign(
      { id: user.id, email, role: user.role },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );
    res.json({
      token,
      user: { id: user.id, email, displayName: user.displayName, role: user.role }
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password required' });
    }

    const { resources } = await users.items
      .query({
        query: 'SELECT * FROM c WHERE c.email = @e',
        parameters: [{ name: '@e', value: email }]
      })
      .fetchAll();

    const user = resources[0];
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { id: user.id, email, role: user.role },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );
    res.json({
      token,
      user: { id: user.id, email, displayName: user.displayName, role: user.role }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Whoami
router.get('/me', verifyToken, (req, res) => {
  res.json({ user: req.user });
});

router.post('/dev-upgrade-to-creator', verifyToken, async (req, res) => {
  try {
    const { resources } = await users.items
      .query({
        query: 'SELECT * FROM c WHERE c.id = @id',
        parameters: [{ name: '@id', value: req.user.id }]
      })
      .fetchAll();
    const user = resources[0];
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.role = 'creator';
    // upsert is safer than replace when partition key resolution differs across SDK versions
    await users.items.upsert(user);

    // Issue a new token with the upgraded role
    const newToken = jwt.sign(
      { id: user.id, email: user.email, role: 'creator' },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );
    res.json({
      token: newToken,
      user: { id: user.id, email: user.email, displayName: user.displayName, role: 'creator' }
    });
  } catch (err) {
    console.error('Upgrade error:', err);
    res.status(500).json({ error: 'Upgrade failed', detail: err.message });
  }
});

module.exports = router;