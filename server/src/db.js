import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { config } from './config.js';

export const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT,
  role TEXT NOT NULL DEFAULT 'reporter' CHECK (role IN ('reporter','admin','technician')),
  department TEXT,
  photo TEXT,
  auth_provider TEXT NOT NULL DEFAULT 'local',
  google_id TEXT UNIQUE,
  email_verified INTEGER NOT NULL DEFAULT 0,
  verify_token TEXT,
  reset_token TEXT,
  reset_expires TEXT,
  blocked INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  icon TEXT NOT NULL DEFAULT 'wrench',
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS complaints (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_no TEXT UNIQUE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  anonymous INTEGER NOT NULL DEFAULT 0,
  category_id INTEGER NOT NULL REFERENCES categories(id),
  building TEXT NOT NULL,
  room TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','resolved')),
  assigned_to INTEGER REFERENCES users(id),
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  rating_comment TEXT,
  reopen_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_complaints_user ON complaints(user_id);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);
CREATE INDEX IF NOT EXISTS idx_complaints_assigned ON complaints(assigned_to);
CREATE INDEX IF NOT EXISTS idx_complaints_location ON complaints(building, room);

CREATE TABLE IF NOT EXISTS images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  complaint_id INTEGER NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  original_name TEXT,
  size INTEGER
);

CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  complaint_id INTEGER NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  author_id INTEGER NOT NULL REFERENCES users(id),
  message TEXT NOT NULL,
  internal INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS status_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  complaint_id INTEGER NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_by INTEGER REFERENCES users(id),
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  complaint_id INTEGER REFERENCES complaints(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, is_read);

CREATE TABLE IF NOT EXISTS complaint_supports (
  complaint_id INTEGER NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (complaint_id, user_id)
);

CREATE TABLE IF NOT EXISTS voice_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  complaint_id INTEGER NOT NULL UNIQUE REFERENCES complaints(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  size INTEGER
);

CREATE TABLE IF NOT EXISTS technician_categories (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, category_id)
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id INTEGER REFERENCES users(id),
  action TEXT NOT NULL,
  entity TEXT,
  entity_id INTEGER,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

// ---- Seed default categories (only if table is empty) ----
if (db.prepare('SELECT COUNT(*) c FROM categories').get().c === 0) {
  const ins = db.prepare('INSERT INTO categories (name, icon) VALUES (?, ?)');
  [['Computer', 'monitor'], ['Projector', 'projector'], ['Fan', 'fan'], ['Light', 'lightbulb'], ['Wi-Fi', 'wifi'], ['Other', 'wrench']]
    .forEach(([n, i]) => ins.run(n, i));
}

// ---- Seed first admin from env ----
if (config.admin.email && config.admin.password) {
  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(config.admin.email);
  if (!exists) {
    db.prepare(`INSERT INTO users (name, email, password_hash, role, email_verified)
                VALUES (?, ?, ?, 'admin', 1)`)
      .run(config.admin.name, config.admin.email, bcrypt.hashSync(config.admin.password, 12));
    console.log(`Admin account created: ${config.admin.email}`);
  }
}

export const audit = (actorId, action, entity, entityId, details) =>
  db.prepare('INSERT INTO audit_log (actor_id, action, entity, entity_id, details) VALUES (?,?,?,?,?)')
    .run(actorId ?? null, action, entity ?? null, entityId ?? null, details ? JSON.stringify(details) : null);
