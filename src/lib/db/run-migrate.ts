/**
 * @file src/lib/db/run-migrate.ts
 * @purpose Runner migrasi Drizzle ke PostgreSQL yang dipakai lokal maupun build pipeline
 * @usedBy npm run db:migrate, entrypoint container, deploy.sh
 * @dependencies drizzle-orm/postgres-js/migrator, src/lib/db/index.ts
 * @publicFunctions runMigrations
 * @sideEffects Menjalankan file SQL di folder drizzle/ ke PostgreSQL lalu menutup pool
 */

import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db, client } from './index';
import path from 'node:path';

export async function runMigrations() {
	console.log('🔄 Menjalankan migrasi Drizzle ke PostgreSQL...');
	await migrate(db, { migrationsFolder: path.resolve(process.cwd(), 'drizzle') });
	console.log('✅ Migrasi database berhasil diterapkan.');
}

// Eksekusi langsung jika dipanggil via tsx/node
if (process.argv[1]?.endsWith('run-migrate.ts') || process.argv[1]?.endsWith('run-migrate.js')) {
	runMigrations()
		.then(() => client.end())
		.catch(async (error) => {
			console.error('❌ Gagal menjalankan migrasi:', error);
			await client.end();
			process.exit(1);
		});
}
