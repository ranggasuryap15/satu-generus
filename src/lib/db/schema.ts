/**
 * @file src/lib/db/schema.ts
 * @purpose Definisi schema tabel Drizzle ORM untuk SQLite sesuai SCHEMA.md
 * @usedBy src/lib/db/index.ts, queries/actions di routes dan services
 * @dependencies drizzle-orm/sqlite-core, @paralleldrive/cuid2
 * @publicFunctions daerah, desa, kelompok, users, dapukan, userDapukan, keluarga, anggotaKeluarga, presensiJadwal, presensiKehadiran
 * @sideEffects Mendefinisikan struktur tabel, relasi foreign key, dan indeks database SQLite
 */

import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { createId } from '@paralleldrive/cuid2';

// ==========================================
// 1. STRUKTUR WILAYAH (Hierarki Berjenjang)
// ==========================================

export const daerah = sqliteTable('daerah', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	nama: text('nama').notNull(),
	provinsi: text('provinsi').notNull(),
	kotaKabupaten: text('kota_kabupaten').notNull()
});

export const desa = sqliteTable(
	'desa',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		daerahId: integer('daerah_id')
			.notNull()
			.references(() => daerah.id, { onDelete: 'cascade' }),
		nama: text('nama').notNull(),
		kecamatan: text('kecamatan')
	},
	(table) => [index('desa_daerah_id_idx').on(table.daerahId)]
);

export const kelompok = sqliteTable(
	'kelompok',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		desaId: integer('desa_id')
			.notNull()
			.references(() => desa.id, { onDelete: 'cascade' }),
		nama: text('nama').notNull(),
		kelurahan: text('kelurahan')
	},
	(table) => [index('kelompok_desa_id_idx').on(table.desaId)]
);

// ==========================================
// 2. AUTENTIKASI & RBAC (Role-Based Access Control)
// ==========================================

export const users = sqliteTable(
	'users',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => createId()),
		kelompokId: integer('kelompok_id').references(() => kelompok.id, { onDelete: 'set null' }),
		namaLengkap: text('nama_lengkap').notNull(),
		email: text('email').unique(),
		passwordHash: text('password_hash').notNull()
	},
	(table) => [index('users_kelompok_id_idx').on(table.kelompokId)]
);

export const dapukan = sqliteTable('dapukan', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	namaDapukan: text('nama_dapukan').notNull(),
	is4S: integer('is_4s', { mode: 'boolean' }).notNull().default(false)
});

export const userDapukan = sqliteTable(
	'user_dapukan',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => createId()),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		dapukanId: integer('dapukan_id').references(() => dapukan.id, { onDelete: 'set null' }),
		namaDapukanCustom: text('nama_dapukan_custom'),
		tingkatScope: text('tingkat_scope').notNull(), // 'Pusat' | 'Daerah' | 'Desa' | 'Kelompok'
		daerahId: integer('daerah_id').references(() => daerah.id, { onDelete: 'cascade' }),
		desaId: integer('desa_id').references(() => desa.id, { onDelete: 'cascade' }),
		kelompokId: integer('kelompok_id').references(() => kelompok.id, { onDelete: 'cascade' })
	},
	(table) => [
		index('user_dapukan_user_id_idx').on(table.userId),
		index('user_dapukan_dapukan_id_idx').on(table.dapukanId),
		index('user_dapukan_scope_idx').on(table.tingkatScope),
		index('user_dapukan_composite_scope_idx').on(
			table.tingkatScope,
			table.daerahId,
			table.desaId,
			table.kelompokId
		)
	]
);

// ==========================================
// 3. DATA SENSUS KELUARGA (Enkripsi Aktif)
// ==========================================

export const keluarga = sqliteTable(
	'keluarga',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => createId()),
		noKkEncrypted: text('no_kk_encrypted').notNull(),
		kepalaKeluargaId: text('kepala_keluarga_id').references(() => users.id, {
			onDelete: 'set null'
		}),
		alamatLengkap: text('alamat_lengkap')
	},
	(table) => [index('keluarga_kepala_keluarga_id_idx').on(table.kepalaKeluargaId)]
);

export const anggotaKeluarga = sqliteTable(
	'anggota_keluarga',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => createId()),
		keluargaId: text('keluarga_id')
			.notNull()
			.references(() => keluarga.id, { onDelete: 'cascade' }),
		userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
		namaLengkap: text('nama_lengkap'),
		nikEncrypted: text('nik_encrypted').notNull(),
		statusHubungan: text('status_hubungan').notNull(), // 'Suami' | 'Istri' | 'Anak' | dll
		tanggalLahir: text('tanggal_lahir').notNull(), // ISO8601 YYYY-MM-DD
		jenisKelamin: text('jenis_kelamin').notNull() // 'L' | 'P'
	},
	(table) => [
		index('anggota_keluarga_keluarga_id_idx').on(table.keluargaId),
		index('anggota_keluarga_user_id_idx').on(table.userId)
	]
);

// ==========================================
// 4. MODUL PRESENSI PENGAJIAN
// ==========================================

export const presensiJadwal = sqliteTable(
	'presensi_jadwal',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		kelompokId: integer('kelompok_id')
			.notNull()
			.references(() => kelompok.id, { onDelete: 'cascade' }),
		tanggal: text('tanggal').notNull(), // ISO8601 YYYY-MM-DD
		namaKegiatan: text('nama_kegiatan').notNull()
	},
	(table) => [
		index('presensi_jadwal_kelompok_id_idx').on(table.kelompokId),
		index('presensi_jadwal_tanggal_idx').on(table.tanggal)
	]
);

export const presensiKehadiran = sqliteTable(
	'presensi_kehadiran',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => createId()),
		jadwalId: integer('jadwal_id')
			.notNull()
			.references(() => presensiJadwal.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		status: text('status').notNull(), // 'Hadir' | 'Izin' | 'Sakit' | 'Alpa'
		waktuScan: integer('waktu_scan') // Timestamp unix
	},
	(table) => [
		index('presensi_kehadiran_jadwal_id_idx').on(table.jadwalId),
		index('presensi_kehadiran_user_id_idx').on(table.userId),
		uniqueIndex('presensi_kehadiran_jadwal_user_uniq').on(table.jadwalId, table.userId)
	]
);

