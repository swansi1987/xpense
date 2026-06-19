import Database from 'better-sqlite3';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

let db: Database.Database | null = null;

export function getDb() {
  if (db) return db;

  const dbPath = process.env.DATABASE_URL?.replace('file:', '') || './xpense.db';
  
  // Ensure directory exists if path has dirs
  const dir = dbPath.includes('/') || dbPath.includes('\\') ? dbPath.substring(0, Math.max(dbPath.lastIndexOf('/'), dbPath.lastIndexOf('\\'))) : '.';
  if (dir !== '.' && !existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL'); // better performance + durability
  db.pragma('foreign_keys = ON');

  initSchema(db);
  return db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS trips (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      currency TEXT NOT NULL DEFAULT 'INR',
      currency_symbol TEXT NOT NULL DEFAULT '₹',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS members (
      user_id TEXT NOT NULL,
      trip_id TEXT NOT NULL,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      joined_at TEXT NOT NULL,
      PRIMARY KEY (user_id, trip_id),
      FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      trip_id TEXT NOT NULL,
      description TEXT NOT NULL,
      amount INTEGER NOT NULL,
      category TEXT NOT NULL,
      expense_date TEXT NOT NULL,
      paid_by_user_id TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS expense_shares (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      expense_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      amount INTEGER NOT NULL,
      FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES members(user_id)  -- loose, since per trip
    );

    CREATE INDEX IF NOT EXISTS idx_members_trip ON members(trip_id);
    CREATE INDEX IF NOT EXISTS idx_expenses_trip ON expenses(trip_id);
    CREATE INDEX IF NOT EXISTS idx_shares_expense ON expense_shares(expense_id);
  `);
}

export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}
