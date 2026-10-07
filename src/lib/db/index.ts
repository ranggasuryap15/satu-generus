/**
 * @file src/lib/db/index.ts
 * @purpose Inisialisasi koneksi SQLite (better-sqlite3) dan instance Drizzle ORM
 * @usedBy Backend server routes (+page.server.ts, +server.ts, hooks.server.ts, scripts migrasi/seed)
 * @dependencies better-sqlite3, drizzle-orm/better-sqlite3, src/lib/db/schema.ts
 * @publicFunctions db, sqlite
 * @sideEffects Membuka koneksi file database SQLite, mengaktifkan PRAGMA WAL, foreign_keys, synchronous
 */

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import fs from 'node:fs';
import path from 'node:path';

const dbPath = process.env.DATABASE_URL || path.resolve(process.cwd(), 'data/sqlite.db');

// Pastikan direktori database ada sebelum membuka file
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
	fs.mkdirSync(dbDir, { recursive: true });
}

export const sqlite = new Database(dbPath);

// Konfigurasi performa & kehandalan SQLite
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');
sqlite.pragma('busy_timeout = 5000');
sqlite.pragma('synchronous = NORMAL');

export const db = drizzle(sqlite, { schema });

