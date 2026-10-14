/**
 * @file src/lib/db/index.ts
 * @purpose Inisialisasi koneksi PostgreSQL (postgres-js) dan instance Drizzle ORM, termasuk normalisasi tipe int8/numeric menjadi number
 * @usedBy Backend server routes (+page.server.ts, +server.ts, hooks.server.ts, scripts migrasi/seed)
 * @dependencies postgres, drizzle-orm/postgres-js, src/lib/db/schema.ts
 * @publicFunctions db, client, first
 * @sideEffects Membuka connection pool PostgreSQL saat modul pertama kali di-import
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString =
	process.env.DATABASE_URL || 'postgres://satu_generus:satu_generus@localhost:5432/satu_generus';

// Pool dikonfigurasi untuk SvelteKit (adapter-node) yang berjalan single-process.
// max: 10 cukup untuk beban MVP; naikkan bila jumlah worker/CPU bertambah.
export const client = postgres(connectionString, {
	max: Number(process.env.DB_POOL_MAX ?? 10),
	idle_timeout: 20,
	connect_timeout: 10,
	// Paksa timezone koneksi agar CURRENT_DATE PostgreSQL setara dengan date('now','localtime') SQLite
	connection: { timezone: 'Asia/Jakarta' },
	// postgres-js mengembalikan int8 (bigint) & numeric sebagai STRING. Tanpa override ini,
	// count()/sum() menjadi string dan merusak aritmetika (contoh: "3" + 1 === "31").
	types: {
		bigint: {
			to: 20,
			from: [20],
			serialize: (v: number | bigint) => String(v),
			parse: (v: string) => Number(v)
		},
		numeric: {
			to: 1700,
			from: [1700],
			serialize: (v: number) => String(v),
			parse: (v: string) => Number(v)
		}
	}
});

export const db = drizzle(client, { schema });

/**
 * Mengambil satu baris pertama dari query Drizzle PostgreSQL.
 * Pengganti langsung `.get()` milik SQLite.
 */
export async function first<T>(query: Promise<T[]>): Promise<T | undefined> {
	const rows = await query;
	return rows[0];
}
