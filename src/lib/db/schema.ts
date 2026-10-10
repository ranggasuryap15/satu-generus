/**
 * @file src/lib/db/schema.ts
 * @purpose Definisi schema tabel Drizzle ORM untuk SQLite sesuai SCHEMA.md (termasuk No KK/NIK nullable, kontak no_telepon user, sub-kelompok wilayah, serta rincian lengkap anggota keluarga)
 * @usedBy src/lib/db/index.ts, queries/actions di routes dan services
 * @dependencies drizzle-orm/sqlite-core, @paralleldrive/cuid2
 * @publicFunctions daerah, desa, kelompok, subKelompok, users, dapukan, userDapukan, keluarga, anggotaKeluarga, jadwalPengajianTemplate, presensiJadwal, presensiKehadiran
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
		kelurahan: text('kelurahan'),
		lokasiNama: text('lokasi_nama'),
		latitude: text('latitude'),
		longitude: text('longitude'),
		radiusMeter: integer('radius_meter').default(100),
		gmapsUrl: text('gmaps_url')
	},
	(table) => [index('kelompok_desa_id_idx').on(table.desaId)]
);

export const subKelompok = sqliteTable(
	'sub_kelompok',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		kelompokId: integer('kelompok_id')
			.notNull()
			.references(() => kelompok.id, { onDelete: 'cascade' }),
		nama: text('nama').notNull(),
		keterangan: text('keterangan')
	},
	(table) => [index('sub_kelompok_kelompok_id_idx').on(table.kelompokId)]
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
		noTelepon: text('no_telepon'),
		passwordHash: text('password_hash').notNull()
	},
	(table) => [
		index('users_kelompok_id_idx').on(table.kelompokId),
		index('users_no_telepon_idx').on(table.noTelepon)
	]
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
		isKk: integer('is_kk', { mode: 'boolean' }).notNull().default(true),
		noKkEncrypted: text('no_kk_encrypted'),
		kepalaKeluargaId: text('kepala_keluarga_id').references(() => users.id, {
			onDelete: 'set null'
		}),
		alamatLengkap: text('alamat_lengkap')
	},
	(table) => [
		index('keluarga_kepala_keluarga_id_idx').on(table.kepalaKeluargaId),
		index('keluarga_is_kk_idx').on(table.isKk)
	]
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
		nikEncrypted: text('nik_encrypted'),
		statusHubungan: text('status_hubungan').notNull(), // 'Bapak' | 'Ibu' | 'Anak' | 'Kepala Keluarga' | dll
		tanggalLahir: text('tanggal_lahir').notNull(), // ISO8601 YYYY-MM-DD
		jenisKelamin: text('jenis_kelamin').notNull(), // 'L' | 'P'
		tempatLahir: text('tempat_lahir'),
		profesi: text('profesi'),
		noTelepon: text('no_telepon'),
		statusGenerus: text('status_generus'), // 'Paud' | 'Caberawit' | 'Pra Remaja' | 'Remaja' | 'Pra Nikah' | 'Usia Nikah' | 'Dewasa Menikah' | 'Lansia'
		statusPernikahan: text('status_pernikahan'), // 'Belum Menikah' | 'Sudah Menikah'
		statusJamaah: text('status_jamaah').default('Aktif'), // 'Aktif' | 'Tidak Aktif'
		isrun: text('isrun').default('Tidak'), // 'Ya' | 'Tidak'
		golonganDarah: text('golongan_darah') // 'A' | 'B' | 'AB' | 'O' | '-'
	},
	(table) => [
		index('anggota_keluarga_keluarga_id_idx').on(table.keluargaId),
		index('anggota_keluarga_user_id_idx').on(table.userId),
		index('anggota_keluarga_status_generus_idx').on(table.statusGenerus)
	]
);

// ==========================================
// ==========================================
// 4. MODUL JADWAL & PRESENSI PENGAJIAN
// ==========================================

export const jadwalPengajianTemplate = sqliteTable(
	'jadwal_pengajian_template',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		tingkatScope: text('tingkat_scope').notNull(), // 'Desa' | 'Kelompok'
		desaId: integer('desa_id').references(() => desa.id, { onDelete: 'cascade' }),
		kelompokId: integer('kelompok_id').references(() => kelompok.id, { onDelete: 'cascade' }),
		tipePola: text('tipe_pola').notNull(), // 'mingguan_ke' (Desa: minggu 1..5) | 'hari_rutin' (Kelompok: hari tertentu)
		mingguKe: integer('minggu_ke'), // 1..5 untuk Desa
		hari: integer('hari').notNull(), // 0 (Ahad) .. 6 (Sabtu)
		jamMulai: text('jam_mulai').notNull(), // HH:mm (Wajib)
		jamSelesai: text('jam_selesai'), // HH:mm
		namaKegiatan: text('nama_kegiatan').notNull(),
		detailMateri: text('detail_materi'),
		isLibur: integer('is_libur', { mode: 'boolean' }).notNull().default(false),
		lokasiNama: text('lokasi_nama'),
		latitude: text('latitude'),
		longitude: text('longitude'),
		radiusMeter: integer('radius_meter').default(100),
		gmapsUrl: text('gmaps_url'),
		isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true)
	},
	(table) => [
		index('jadwal_template_scope_idx').on(table.tingkatScope),
		index('jadwal_template_desa_idx').on(table.desaId),
		index('jadwal_template_kelompok_idx').on(table.kelompokId)
	]
);

export const presensiJadwal = sqliteTable(
	'presensi_jadwal',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		tingkatScope: text('tingkat_scope').notNull().default('Kelompok'), // 'Desa' | 'Kelompok'
		desaId: integer('desa_id').references(() => desa.id, { onDelete: 'cascade' }),
		kelompokId: integer('kelompok_id').references(() => kelompok.id, { onDelete: 'cascade' }),
		templateId: integer('template_id').references(() => jadwalPengajianTemplate.id, { onDelete: 'set null' }),
		tanggal: text('tanggal').notNull(), // ISO8601 YYYY-MM-DD
		jamMulai: text('jam_mulai').notNull().default('08:00'), // HH:mm (Wajib diisi)
		jamSelesai: text('jam_selesai'), // HH:mm
		namaKegiatan: text('nama_kegiatan').notNull(),
		detailMateri: text('detail_materi'),
		isOverride: integer('is_override', { mode: 'boolean' }).notNull().default(false),
		status: text('status').notNull().default('aktif'), // 'aktif' | 'libur' | 'dibatalkan'
		lokasiNama: text('lokasi_nama'),
		latitude: text('latitude'),
		longitude: text('longitude'),
		radiusMeter: integer('radius_meter').default(100),
		gmapsUrl: text('gmaps_url')
	},
	(table) => [
		index('presensi_jadwal_kelompok_id_idx').on(table.kelompokId),
		index('presensi_jadwal_desa_id_idx').on(table.desaId),
		index('presensi_jadwal_tanggal_idx').on(table.tanggal),
		index('presensi_jadwal_scope_idx').on(table.tingkatScope)
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
		metodeKehadiran: text('metode_kehadiran'), // 'offline' | 'online' | 'izin'
		fotoUrl: text('foto_url'),
		latitude: text('latitude'),
		longitude: text('longitude'),
		alamatLokasi: text('alamat_lokasi'),
		keteranganIzin: text('keterangan_izin'),
		statusApproval: text('status_approval').default('Disetujui'), // 'Disetujui' | 'Menunggu Persetujuan' | 'Ditolak'
		catatanAdmin: text('catatan_admin'),
		waktuScan: integer('waktu_scan') // Timestamp unix
	},
	(table) => [
		index('presensi_kehadiran_jadwal_id_idx').on(table.jadwalId),
		index('presensi_kehadiran_user_id_idx').on(table.userId),
		index('presensi_kehadiran_status_approval_idx').on(table.statusApproval),
		uniqueIndex('presensi_kehadiran_jadwal_user_uniq').on(table.jadwalId, table.userId)
	]
);

