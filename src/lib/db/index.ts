/**
 * @file src/lib/db/index.ts
 * @purpose Inisialisasi koneksi SQLite (better-sqlite3) dan instance Drizzle ORM
 * @usedBy Backend server routes (+page.server.ts, +server.ts, hooks.server.ts, scripts migrasi/seed)
 * @dependencies better-sqlite3, drizzle-orm/better-sqlite3, src/lib/db/schema.ts
 * @publicFunctions db, sqlite
 * @sideEffects Membuka koneksi file database SQLite, mengaktifkan PRAGMA WAL & foreign_keys, dan auto-migrasi kolom skema yang belum ada
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

// Auto-heal / migrasi otomatis skema kolom SQLite jika belum ada di database server
try {
	const tableKeluarga = sqlite
		.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='keluarga'")
		.get();
	if (tableKeluarga) {
		const keluargaCols = (
			sqlite.prepare('PRAGMA table_info(keluarga)').all() as Array<{ name: string }>
		).map((c) => c.name);
		if (!keluargaCols.includes('is_kk')) {
			sqlite.exec('ALTER TABLE keluarga ADD COLUMN is_kk INTEGER NOT NULL DEFAULT 1');
			sqlite.exec('CREATE INDEX IF NOT EXISTS keluarga_is_kk_idx ON keluarga (is_kk)');
		}
	}

	const tableAnggota = sqlite
		.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='anggota_keluarga'")
		.get();
	if (tableAnggota) {
		const anggotaCols = (
			sqlite.prepare('PRAGMA table_info(anggota_keluarga)').all() as Array<{ name: string }>
		).map((c) => c.name);
		if (!anggotaCols.includes('nama_lengkap')) {
			sqlite.exec('ALTER TABLE anggota_keluarga ADD COLUMN nama_lengkap TEXT');
		}
	}
} catch (migErr) {
	console.error('[DB Auto-Migration] Gagal memeriksa atau memperbarui kolom skema SQLite:', migErr);
}

export const db = drizzle(sqlite, { schema });

