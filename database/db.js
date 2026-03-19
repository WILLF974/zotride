const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

// Ensure data/ directory exists
const dataDir = path.join(__dirname, '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, 'zotride.db');

let db;

// Try better-sqlite3 first (production Linux), fallback to node:sqlite (Mac/Node 22+)
try {
  const Database = require('better-sqlite3');
  db = new Database(dbPath);
  console.log('SQLite: using better-sqlite3');
} catch (err) {
  console.log('better-sqlite3 not available, falling back to node:sqlite');
  const { DatabaseSync } = require('node:sqlite');
  db = new DatabaseSync(dbPath);
}

db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pseudo TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    moto_marque TEXT DEFAULT '',
    moto_cylindree TEXT DEFAULT '',
    role TEXT DEFAULT 'user',
    validated INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sorties (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titre TEXT NOT NULL,
    description TEXT DEFAULT '',
    date TEXT NOT NULL,
    heure TEXT NOT NULL,
    nb_max_participants INTEGER DEFAULT 20,
    created_by INTEGER NOT NULL,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS waypoints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sortie_id INTEGER NOT NULL,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    nom TEXT DEFAULT '',
    ordre INTEGER DEFAULT 0,
    is_rassemblement INTEGER DEFAULT 0,
    FOREIGN KEY (sortie_id) REFERENCES sorties(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS participants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sortie_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(sortie_id, user_id),
    FOREIGN KEY (sortie_id) REFERENCES sorties(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS participant_locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sortie_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(sortie_id, user_id),
    FOREIGN KEY (sortie_id) REFERENCES sorties(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS radar_positions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT UNIQUE NOT NULL,
    pseudo TEXT NOT NULL DEFAULT 'Anonyme',
    moto_marque TEXT DEFAULT '',
    moto_cylindree TEXT DEFAULT '',
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info',
    read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

// Create default admin if not exists
const adminExists = db.prepare("SELECT id FROM users WHERE role = 'admin'").get();
if (!adminExists) {
  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare(`
    INSERT INTO users (pseudo, email, password, role, validated)
    VALUES (?, ?, ?, 'admin', 1)
  `).run('Admin', 'admin@zotride.fr', hash);
  console.log('Admin créé : admin@zotride.fr / admin123');
}

module.exports = db;
