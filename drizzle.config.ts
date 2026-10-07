/**
 * @file drizzle.config.ts
 * @purpose Konfigurasi Drizzle Kit untuk introspeksi, pembuatan migrasi, dan eksekusi skema SQLite
 * @usedBy drizzle-kit CLI (npm run db:generate, npm run db:migrate, npm run db:push)
 * @dependencies drizzle-kit
 * @publicFunctions defineConfig
 * @sideEffects Menentukan direktori output migrasi dan file target skema
 */

import { defineConfig } from 'drizzle-kit';

export default defineConfig({
	schema: './src/lib/db/schema.ts',
	out: './drizzle',
	dialect: 'sqlite',
	dbCredentials: {
		url: process.env.DATABASE_URL || './data/sqlite.db'
	}
});

