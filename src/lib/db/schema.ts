/**
 * @file src/lib/db/schema.ts
 * @purpose Definisi schema tabel Drizzle ORM untuk PostgreSQL sesuai SCHEMA.md (termasuk wilayah, rekening/QRIS wilayah, anggota keluarga, sensus, presensi pengajian, transaksi setoran FR, pos anggaran infaq fleksibel, template infaq rutin & bundling tarif, jenis shodaqoh wilayah, dan transaksi shodaqoh jamaah)
 * @usedBy src/lib/db/index.ts, queries/actions di routes dan services
 * @dependencies drizzle-orm/pg-core, @paralleldrive/cuid2
 * @publicFunctions daerah, desa, kelompok, subKelompok, users, dapukan, userDapukan, keluarga, anggotaKeluarga, jadwalPengajianTemplate, presensiJadwal, presensiKehadiran, rekeningWilayah, transaksiFr, posAnggaranInfaq, templateInfaqRutin, templateInfaqGroup, templateInfaqGroupPos, templateInfaqBundle, templateInfaqPos, templateInfaqJamaah, jenisShodaqoh, transaksiShodaqoh
 * @sideEffects Mendefinisikan struktur tabel, relasi foreign key, dan indeks database PostgreSQL
 */

import { pgTable, text, integer, bigint, boolean, serial, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';

// ==========================================
// 1. STRUKTUR WILAYAH (Hierarki Berjenjang)
// ==========================================

export const daerah = pgTable('daerah', {
	id: serial('id').primaryKey(),
	nama: text('nama').notNull(),
	provinsi: text('provinsi').notNull(),
	kotaKabupaten: text('kota_kabupaten').notNull(),
	lokasiNama: text('lokasi_nama'),
	latitude: text('latitude'),
	longitude: text('longitude'),
	radiusMeter: integer('radius_meter').default(100),
	gmapsUrl: text('gmaps_url')
});

export const desa = pgTable(
	'desa',
	{
		id: serial('id').primaryKey(),
		daerahId: integer('daerah_id')
			.notNull()
			.references(() => daerah.id, { onDelete: 'cascade' }),
		nama: text('nama').notNull(),
		kecamatan: text('kecamatan'),
		lokasiNama: text('lokasi_nama'),
		latitude: text('latitude'),
		longitude: text('longitude'),
		radiusMeter: integer('radius_meter').default(100),
		gmapsUrl: text('gmaps_url'),
		lokasiKelompokId: integer('lokasi_kelompok_id')
	},
	(table) => [
		index('desa_daerah_id_idx').on(table.daerahId),
		index('desa_lokasi_kelompok_id_idx').on(table.lokasiKelompokId)
	]
);

export const kelompok = pgTable(
	'kelompok',
	{
		id: serial('id').primaryKey(),
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

export const subKelompok = pgTable(
	'sub_kelompok',
	{
		id: serial('id').primaryKey(),
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

export const users = pgTable(
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

export const dapukan = pgTable('dapukan', {
	id: serial('id').primaryKey(),
	namaDapukan: text('nama_dapukan').notNull(),
	is4S: boolean('is_4s').notNull().default(false)
});

export const userDapukan = pgTable(
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

export const keluarga = pgTable(
	'keluarga',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => createId()),
		isKk: boolean('is_kk').notNull().default(true),
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

export const anggotaKeluarga = pgTable(
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

export const jadwalPengajianTemplate = pgTable(
	'jadwal_pengajian_template',
	{
		id: serial('id').primaryKey(),
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
		isLibur: boolean('is_libur').notNull().default(false),
		lokasiNama: text('lokasi_nama'),
		latitude: text('latitude'),
		longitude: text('longitude'),
		radiusMeter: integer('radius_meter').default(100),
		gmapsUrl: text('gmaps_url'),
		isActive: boolean('is_active').notNull().default(true)
	},
	(table) => [
		index('jadwal_template_scope_idx').on(table.tingkatScope),
		index('jadwal_template_desa_idx').on(table.desaId),
		index('jadwal_template_kelompok_idx').on(table.kelompokId)
	]
);

export const presensiJadwal = pgTable(
	'presensi_jadwal',
	{
		id: serial('id').primaryKey(),
		tingkatScope: text('tingkat_scope').notNull().default('Kelompok'), // 'Desa' | 'Kelompok'
		desaId: integer('desa_id').references(() => desa.id, { onDelete: 'cascade' }),
		kelompokId: integer('kelompok_id').references(() => kelompok.id, { onDelete: 'cascade' }),
		templateId: integer('template_id').references(() => jadwalPengajianTemplate.id, { onDelete: 'set null' }),
		tanggal: text('tanggal').notNull(), // ISO8601 YYYY-MM-DD
		jamMulai: text('jam_mulai').notNull().default('08:00'), // HH:mm (Wajib diisi)
		jamSelesai: text('jam_selesai'), // HH:mm
		namaKegiatan: text('nama_kegiatan').notNull(),
		detailMateri: text('detail_materi'),
		isOverride: boolean('is_override').notNull().default(false),
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

export const presensiKehadiran = pgTable(
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
		waktuScan: bigint('waktu_scan', { mode: 'number' }) // Timestamp unix
	},
	(table) => [
		index('presensi_kehadiran_jadwal_id_idx').on(table.jadwalId),
		index('presensi_kehadiran_user_id_idx').on(table.userId),
		index('presensi_kehadiran_status_approval_idx').on(table.statusApproval),
		uniqueIndex('presensi_kehadiran_jadwal_user_uniq').on(table.jadwalId, table.userId)
	]
);

// ==========================================
// 6. KEUANGAN & SHODAQOH WILAYAH (Rekening & QRIS)
// ==========================================

export const rekeningWilayah = pgTable(
	'rekening_wilayah',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => createId()),
		tingkatScope: text('tingkat_scope').notNull(), // 'Pusat' | 'Daerah' | 'Desa' | 'Kelompok'
		daerahId: integer('daerah_id').references(() => daerah.id, { onDelete: 'cascade' }),
		desaId: integer('desa_id').references(() => desa.id, { onDelete: 'cascade' }),
		kelompokId: integer('kelompok_id').references(() => kelompok.id, { onDelete: 'cascade' }),
		namaBank: text('nama_bank').notNull(), // e.g. 'Bank Syariah Indonesia (BSI)', 'BCA', 'QRIS', dll
		nomorRekening: text('nomor_rekening').notNull(),
		atasNama: text('atas_nama').notNull(),
		tipeTujuan: text('tipe_tujuan').notNull().default('Infaq & Shodaqoh'), // e.g. 'Infaq Operasional', 'Pembangunan', 'Kas Sosial'
		qrisImageUrl: text('qris_image_url'),
		keterangan: text('keterangan'),
		isActive: boolean('is_active').notNull().default(true),
		createdAt: bigint('created_at', { mode: 'number' }).notNull()
	},
	(table) => [
		index('rekening_wilayah_scope_idx').on(table.tingkatScope),
		index('rekening_wilayah_daerah_id_idx').on(table.daerahId),
		index('rekening_wilayah_desa_id_idx').on(table.desaId),
		index('rekening_wilayah_kelompok_id_idx').on(table.kelompokId)
	]
);

// ==========================================
// 7. TRANSAKSI & SETORAN FR JAMAAH
// ==========================================

export const transaksiFr = pgTable(
	'transaksi_fr',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => createId()),
		anggotaKeluargaId: text('anggota_keluarga_id')
			.notNull()
			.references(() => anggotaKeluarga.id, { onDelete: 'cascade' }),
		kelompokId: integer('kelompok_id')
			.notNull()
			.references(() => kelompok.id, { onDelete: 'cascade' }),
		desaId: integer('desa_id').references(() => desa.id, { onDelete: 'cascade' }),
		daerahId: integer('daerah_id').references(() => daerah.id, { onDelete: 'cascade' }),
		tahun: integer('tahun').notNull(),
		bulan: integer('bulan').notNull(),
		nominal: integer('nominal').notNull().default(0),
		statusBayar: text('status_bayar').notNull().default('Lunas'),
		catatan: text('catatan'),
		updatedByUserId: text('updated_by_user_id').references(() => users.id, {
			onDelete: 'set null'
		}),
		templateId: text('template_id').references((): any => templateInfaqRutin.id, {
			onDelete: 'set null'
		}),
		createdAt: bigint('created_at', { mode: 'number' }).notNull(),
		updatedAt: bigint('updated_at', { mode: 'number' }).notNull()
	},
	(table) => [
		index('transaksi_fr_anggota_idx').on(table.anggotaKeluargaId),
		index('transaksi_fr_kelompok_idx').on(table.kelompokId),
		index('transaksi_fr_template_idx').on(table.templateId),
		index('transaksi_fr_periode_idx').on(table.tahun, table.bulan),
		index('transaksi_fr_desa_periode_idx').on(table.desaId, table.tahun, table.bulan),
		uniqueIndex('transaksi_fr_unik_periode_idx').on(
			table.anggotaKeluargaId,
			table.tahun,
			table.bulan
		)
	]
);

// ==========================================
// 8. TEMPLATE INFAQ / SHODAQOH RUTIN (ISRUN / FR) & POS FLEKSIBEL
// ==========================================

export const posAnggaranInfaq = pgTable(
	'pos_anggaran_infaq',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => createId()),
		parentId: text('parent_id').references((): any => posAnggaranInfaq.id, { onDelete: 'cascade' }),
		kode: text('kode').notNull(), // HW-PUSAT, HW-DAERAH, HW-DESA, HW-KELOMPOK, OPERASIONAL, BANGUNAN, DLL
		nama: text('nama').notNull(), // 'Hak Daerah', 'Kas Operasional', 'Pembangunan Masjid'
		deskripsi: text('deskripsi'),
		tingkatScope: text('tingkat_scope').notNull().default('Kelompok'), // 'Pusat' | 'Daerah' | 'Desa' | 'Kelompok'
		desaId: integer('desa_id').references(() => desa.id, { onDelete: 'cascade' }),
		kelompokId: integer('kelompok_id').references(() => kelompok.id, { onDelete: 'cascade' }),
		isWajib: boolean('is_wajib').notNull().default(false), // true untuk 4 Hak Wajib
		tipeAlokasi: text('tipe_alokasi').notNull().default('nominal'), // 'nominal' | 'persentase'
		urutan: integer('urutan').notNull().default(0),
		isActive: boolean('is_active').notNull().default(true),
		createdAt: bigint('created_at', { mode: 'number' }).notNull(),
		updatedAt: bigint('updated_at', { mode: 'number' }).notNull()
	},
	(table) => [
		index('pos_anggaran_parent_idx').on(table.parentId),
		index('pos_anggaran_scope_idx').on(table.tingkatScope, table.kelompokId, table.desaId),
		index('pos_anggaran_urutan_idx').on(table.urutan)
	]
);

export const templateInfaqRutin = pgTable(
	'template_infaq_rutin',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => createId()),
		nama: text('nama').notNull(), // misal: "Template FR Kelompok 1 - 2026"
		tingkatScope: text('tingkat_scope').notNull().default('Kelompok'),
		desaId: integer('desa_id').references(() => desa.id, { onDelete: 'cascade' }),
		kelompokId: integer('kelompok_id').references(() => kelompok.id, { onDelete: 'cascade' }),
		tahun: integer('tahun').notNull(),
		bulanMulai: integer('bulan_mulai').notNull().default(1),
		bulanSelesai: integer('bulan_selesai').notNull().default(12),
		nominalMinimumDefault: integer('nominal_minimum_default').notNull().default(0),
		status: text('status').notNull().default('aktif'), // 'draf' | 'aktif' | 'arsip'
		catatan: text('catatan'),
		createdByUserId: text('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
		createdAt: bigint('created_at', { mode: 'number' }).notNull(),
		updatedAt: bigint('updated_at', { mode: 'number' }).notNull()
	},
	(table) => [
		index('template_infaq_periode_idx').on(table.tahun, table.bulanMulai, table.bulanSelesai),
		index('template_infaq_scope_idx').on(table.tingkatScope, table.kelompokId, table.status)
	]
);

export const templateInfaqGroup = pgTable(
	'template_infaq_group',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => createId()),
		templateId: text('template_id')
			.notNull()
			.references(() => templateInfaqRutin.id, { onDelete: 'cascade' }),
		nama: text('nama').notNull(), // Contoh: 'Group A', 'Group B', 'Group Khusus'
		keterangan: text('keterangan'),
		urutan: integer('urutan').notNull().default(0),
		createdAt: bigint('created_at', { mode: 'number' }).notNull(),
		updatedAt: bigint('updated_at', { mode: 'number' }).notNull()
	},
	(table) => [
		index('template_group_template_idx').on(table.templateId)
	]
);

export const templateInfaqGroupPos = pgTable(
	'template_infaq_group_pos',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => createId()),
		groupId: text('group_id')
			.notNull()
			.references(() => templateInfaqGroup.id, { onDelete: 'cascade' }),
		posId: text('pos_id')
			.notNull()
			.references(() => posAnggaranInfaq.id, { onDelete: 'cascade' }),
		nominalJumlah: integer('nominal_jumlah').notNull().default(0), // Kolom "Jumlah" (Angka minimum yang disarankan)
		nominalKeterangan: integer('nominal_keterangan').notNull().default(0), // Kolom "Keterangan" (Angka riil dibayar)
		keteranganTeks: text('keterangan_teks'),
		urutan: integer('urutan').notNull().default(0),
		createdAt: bigint('created_at', { mode: 'number' }).notNull(),
		updatedAt: bigint('updated_at', { mode: 'number' }).notNull()
	},
	(table) => [
		index('group_pos_group_idx').on(table.groupId),
		uniqueIndex('group_pos_unik_idx').on(table.groupId, table.posId)
	]
);

export const templateInfaqBundle = pgTable(
	'template_infaq_bundle',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => createId()),
		templateId: text('template_id')
			.notNull()
			.references(() => templateInfaqRutin.id, { onDelete: 'cascade' }),
		nama: text('nama').notNull(), // Contoh: 'Paket Standar', 'Paket Pelajar', 'Paket Keringanan'
		nominal: integer('nominal').notNull().default(0), // Misal: 100000, 50000, 25000, 0
		deskripsi: text('deskripsi'),
		urutan: integer('urutan').notNull().default(0)
	},
	(table) => [
		index('template_bundle_template_idx').on(table.templateId)
	]
);

export const templateInfaqPos = pgTable(
	'template_infaq_pos',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => createId()),
		templateId: text('template_id')
			.notNull()
			.references(() => templateInfaqRutin.id, { onDelete: 'cascade' }),
		posId: text('pos_id')
			.notNull()
			.references(() => posAnggaranInfaq.id, { onDelete: 'restrict' }),
		nominalTarget: integer('nominal_target').default(0),
		persentaseSplit: integer('persentase_split').default(0),
		urutan: integer('urutan').notNull().default(0)
	},
	(table) => [
		index('template_pos_template_idx').on(table.templateId),
		uniqueIndex('template_pos_unik_idx').on(table.templateId, table.posId)
	]
);

export const templateInfaqJamaah = pgTable(
	'template_infaq_jamaah',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => createId()),
		templateId: text('template_id')
			.notNull()
			.references(() => templateInfaqRutin.id, { onDelete: 'cascade' }),
		anggotaKeluargaId: text('anggota_keluarga_id')
			.notNull()
			.references(() => anggotaKeluarga.id, { onDelete: 'cascade' }),
		groupId: text('group_id').references(() => templateInfaqGroup.id, { onDelete: 'set null' }),
		bundleId: text('bundle_id').references(() => templateInfaqBundle.id, { onDelete: 'set null' }),
		nominalTarget: integer('nominal_target').notNull().default(0),
		isCustom: boolean('is_custom').notNull().default(false),
		catatan: text('catatan'),
		updatedAt: bigint('updated_at', { mode: 'number' }).notNull()
	},
	(table) => [
		index('template_jamaah_template_idx').on(table.templateId),
		index('template_jamaah_group_idx').on(table.groupId),
		index('template_jamaah_bundle_idx').on(table.bundleId),
		uniqueIndex('template_jamaah_unik_idx').on(table.templateId, table.anggotaKeluargaId)
	]
);

// ==========================================
// 8. SHODAQOH WILAYAH (Jenis & Transaksi Jamaah)
// ==========================================

export const jenisShodaqoh = pgTable(
	'jenis_shodaqoh',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => createId()),
		tingkatScope: text('tingkat_scope').notNull(), // 'Pusat' | 'Daerah' | 'Desa' | 'Kelompok'
		daerahId: integer('daerah_id').references(() => daerah.id, { onDelete: 'cascade' }),
		desaId: integer('desa_id').references(() => desa.id, { onDelete: 'cascade' }),
		kelompokId: integer('kelompok_id').references(() => kelompok.id, { onDelete: 'cascade' }),
		nama: text('nama').notNull(), // e.g. 'Shodaqoh Kelompok', 'Shodaqoh Lainnya', 'Pembangunan', 'Forsgi', 'Asad'
		deskripsi: text('deskripsi'),
		isDefault: boolean('is_default').notNull().default(false),
		isActive: boolean('is_active').notNull().default(true),
		createdAt: bigint('created_at', { mode: 'number' }).notNull(),
		updatedAt: bigint('updated_at', { mode: 'number' }).notNull()
	},
	(table) => [
		index('jenis_shodaqoh_scope_idx').on(table.tingkatScope),
		index('jenis_shodaqoh_kelompok_idx').on(table.kelompokId),
		index('jenis_shodaqoh_desa_idx').on(table.desaId),
		index('jenis_shodaqoh_daerah_idx').on(table.daerahId)
	]
);

export const transaksiShodaqoh = pgTable(
	'transaksi_shodaqoh',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => createId()),
		userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
		namaPengirim: text('nama_pengirim').notNull(),
		noTelepon: text('no_telepon'),
		tingkatScope: text('tingkat_scope').notNull(), // 'Pusat' | 'Daerah' | 'Desa' | 'Kelompok'
		daerahId: integer('daerah_id').references(() => daerah.id, { onDelete: 'cascade' }),
		desaId: integer('desa_id').references(() => desa.id, { onDelete: 'cascade' }),
		kelompokId: integer('kelompok_id').references(() => kelompok.id, { onDelete: 'cascade' }),
		rekeningWilayahId: text('rekening_wilayah_id').references(() => rekeningWilayah.id, {
			onDelete: 'set null'
		}),
		jenisShodaqohId: text('jenis_shodaqoh_id').references(() => jenisShodaqoh.id, {
			onDelete: 'set null'
		}),
		namaJenisShodaqoh: text('nama_jenis_shodaqoh').notNull(),
		nominal: integer('nominal').notNull(),
		tanggalTransfer: text('tanggal_transfer').notNull(), // YYYY-MM-DD
		metodePembayaran: text('metode_pembayaran').notNull().default('Transfer Bank'), // 'Transfer Bank' | 'QRIS' | 'Tunai'
		buktiTransferUrl: text('bukti_transfer_url'),
		catatan: text('catatan'),
		statusApproval: text('status_approval').notNull().default('Menunggu Persetujuan'), // 'Menunggu Persetujuan' | 'Disetujui' | 'Ditolak'
		alasanPenolakan: text('alasan_penolakan'),
		approvedByUserId: text('approved_by_user_id').references(() => users.id, {
			onDelete: 'set null'
		}),
		approvedAt: integer('approved_at'),
		createdAt: bigint('created_at', { mode: 'number' }).notNull(),
		updatedAt: bigint('updated_at', { mode: 'number' }).notNull()
	},
	(table) => [
		index('transaksi_shodaqoh_kelompok_idx').on(table.kelompokId),
		index('transaksi_shodaqoh_desa_idx').on(table.desaId),
		index('transaksi_shodaqoh_daerah_idx').on(table.daerahId),
		index('transaksi_shodaqoh_status_idx').on(table.statusApproval),
		index('transaksi_shodaqoh_tanggal_idx').on(table.tanggalTransfer)
	]
);



