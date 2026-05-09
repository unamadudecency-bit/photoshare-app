const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');
const config = require('./config');

const app = express();

// Security & performance middleware
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }));
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '15mb' }));

// Rate limit
app.use('/api/', rateLimit({ windowMs: 60_000, max: 100 }));

// Serve uploaded files (mock mode) and frontend statics
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
// Serve frontend statics — works in both local dev (../../frontend) and Azure deploy (../frontend)
const frontendDirAzure = path.join(__dirname, '..', 'frontend');
const frontendDirLocal = path.join(__dirname, '..', '..', 'frontend');
const fs = require('fs');
const frontendDir = fs.existsSync(frontendDirAzure) ? frontendDirAzure : frontendDirLocal;
app.use(express.static(frontendDir));
console.log('Serving frontend from:', frontendDir);

// Health endpoint
app.get('/api/health', (req, res) =>
  res.json({ status: 'ok', mode: config.useMocks ? 'mock' : 'azure', timestamp: new Date().toISOString() })
);

// API routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/photos', require('./routes/photos'));
app.use('/api/comments', require('./routes/comments'));

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Server error' });
});

if (require.main === module) {
  app.listen(config.port, () => {
    console.log(`API listening on http://localhost:${config.port}`);
    console.log(`   Mode: ${config.useMocks ? 'MOCK (in-memory)' : 'AZURE'}`);
    console.log(`   Health: http://localhost:${config.port}/api/health`);
  });
}

module.exports = app;