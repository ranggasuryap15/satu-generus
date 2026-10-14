/**
 * @file drizzle.config.ts
 * @purpose Konfigurasi Drizzle Kit untuk introspeksi, pembuatan migrasi, dan eksekusi skema PostgreSQL
 * @usedBy drizzle-kit CLI (npm run db:generate, npm run db:migrate, npm run db:push)
 * @dependencies drizzle-kit
 * @publicFunctions defineConfig
 * @sideEffects Menentukan direktori output migrasi dan kredensial koneksi database target
 */

import { defineConfig } from 'drizzle-kit';

export default defineConfig({
	schema: './src/lib/db/schema.ts',
	out: './drizzle',
	dialect: 'postgresql',
	dbCredentials: {
		url: process.env.DATABASE_URL || 'postgres://satu_generus:satu_generus@localhost:5432/satu_generus'
	}
});

