import 'dotenv/config';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Resolve relative to the project root (two levels above server/src/db),
// not process.cwd(), so this works the same whether `npm run dev` is
// launched from server/ or anywhere else.
const projectRoot = path.resolve(__dirname, '../../../');
const DATABASE_URL = process.env.DATABASE_URL || './database/voip.sqlite';
const dbPath = path.resolve(projectRoot, DATABASE_URL);

// Make sure the containing folder (project/database) exists before
// better-sqlite3 tries to create the file inside it.
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

export const db = new Database(dbPath);

// WAL mode is a safe default for a single-process dev server: better
// concurrent read/write behavior, still a single plain file on disk.
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT NOT NULL UNIQUE,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS contacts (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       INTEGER NOT NULL,
    contact_id    INTEGER NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, contact_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (contact_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON contacts(user_id);
`);

console.log(`[db] SQLite ready at ${dbPath}`);

