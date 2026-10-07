/**
 * @file src/lib/db/migrate.ts
 * @purpose Script eksekusi migrasi Drizzle ORM ke SQLite database
 * @usedBy npm run db:migrate, deployment build pipeline, atau container startup
 * @dependencies drizzle-orm/better-sqlite3/migrator, src/lib/db/index.ts
 * @publicFunctions runMigrations
 * @sideEffects Menjalankan file migrasi SQL dari folder drizzle/ ke database SQLite
 */

import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db, sqlite } from './index';
import path from 'node:path';

export function runMigrations() {
	console.log('🔄 Menjalankan migrasi Drizzle...');
	const migrationsFolder = path.resolve(process.cwd(), 'drizzle');
	migrate(db, { migrationsFolder });
	console.log('✅ Migrasi database berhasil diterapkan.');
}

// Eksekusi langsung jika dipanggil via node/tsx/node --import
if (process.argv[1]?.endsWith('migrate.ts') || process.argv[1]?.endsWith('migrate.js')) {
	try {
		runMigrations();
		sqlite.close();
		process.exit(0);
	} catch (error) {
		console.error('❌ Gagal menjalankan migrasi:', error);
		sqlite.close();
		process.exit(1);
	}
}

