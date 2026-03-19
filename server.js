require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const compression = require('compression');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(compression());
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Health check (before static)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', app: 'Zot Ride', version: '1.0.0' });
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/sorties', require('./routes/sorties'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/radar', require('./routes/radar'));

app.use(express.static(path.join(__dirname, 'public')));

// Radar public page
app.get('/radar', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'radar.html'));
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.message);
  res.status(500).json({ error: 'Erreur serveur interne' });
});

app.listen(PORT, () => {
  console.log(`\nZot Ride démarré sur http://localhost:${PORT}`);
  console.log(`Admin par défaut : admin@zotride.fr / admin123\n`);
});
