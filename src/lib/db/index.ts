/**
 * @file src/lib/db/index.ts
 * @purpose Inisialisasi koneksi SQLite (better-sqlite3) dan instance Drizzle ORM
 * @usedBy Backend server routes (+page.server.ts, +server.ts, hooks.server.ts, scripts migrasi/seed)
 * @dependencies better-sqlite3, drizzle-orm/better-sqlite3, src/lib/db/schema.ts
 * @publicFunctions db, sqlite
 * @sideEffects Membuka koneksi file database SQLite, mengaktifkan PRAGMA WAL & foreign_keys, auto-migrasi kolom & tabel skema (sub_kelompok, users, anggota_keluarga, jadwal_pengajian_template, presensi_jadwal, presensi_kehadiran, kelompok, desa, daerah, rekening_wilayah, transaksi_fr, pos_anggaran_infaq, template_infaq_rutin, template_infaq_group, template_infaq_group_pos, template_infaq_bundle, template_infaq_pos, template_infaq_jamaah, jenis_shodaqoh, transaksi_shodaqoh), auto-sinkronisasi user_id, auto-seed 4 Hak Wajib & sub-pos acuan
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
		const rawKeluargaInfo = sqlite.prepare('PRAGMA table_info(keluarga)').all() as Array<{ name: string; notnull: number }>;
		const keluargaCols = rawKeluargaInfo.map((c) => c.name);
		if (!keluargaCols.includes('is_kk')) {
			sqlite.exec('ALTER TABLE keluarga ADD COLUMN is_kk INTEGER NOT NULL DEFAULT 1');
			sqlite.exec('CREATE INDEX IF NOT EXISTS keluarga_is_kk_idx ON keluarga (is_kk)');
		}

		// Jika kolom no_kk_encrypted masih NOT NULL, ubah menjadi nullable
		const noKkCol = rawKeluargaInfo.find((c) => c.name === 'no_kk_encrypted');
		if (noKkCol && noKkCol.notnull === 1) {
			sqlite.exec('PRAGMA foreign_keys=OFF;');
			sqlite.exec(`
				CREATE TABLE keluarga_temp (
					id TEXT PRIMARY KEY NOT NULL,
					is_kk INTEGER NOT NULL DEFAULT 1,
					no_kk_encrypted TEXT,
					kepala_keluarga_id TEXT REFERENCES users(id) ON DELETE SET NULL,
					alamat_lengkap TEXT
				);
				INSERT INTO keluarga_temp (id, is_kk, no_kk_encrypted, kepala_keluarga_id, alamat_lengkap)
				SELECT id, COALESCE(is_kk, 1), no_kk_encrypted, kepala_keluarga_id, alamat_lengkap FROM keluarga;
				DROP TABLE keluarga;
				ALTER TABLE keluarga_temp RENAME TO keluarga;
				CREATE INDEX IF NOT EXISTS keluarga_kepala_keluarga_id_idx ON keluarga (kepala_keluarga_id);
				CREATE INDEX IF NOT EXISTS keluarga_is_kk_idx ON keluarga (is_kk);
			`);
			sqlite.pragma('foreign_keys = ON');
		}
	}

	const tableAnggota = sqlite
		.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='anggota_keluarga'")
		.get();
	if (tableAnggota) {
		const rawAnggotaInfo = sqlite.prepare('PRAGMA table_info(anggota_keluarga)').all() as Array<{ name: string; notnull: number }>;
		const anggotaCols = rawAnggotaInfo.map((c) => c.name);
		if (!anggotaCols.includes('nama_lengkap')) {
			sqlite.exec('ALTER TABLE anggota_keluarga ADD COLUMN nama_lengkap TEXT');
		}

		// Jika kolom nik_encrypted masih NOT NULL, ubah menjadi nullable
		const nikCol = rawAnggotaInfo.find((c) => c.name === 'nik_encrypted');
		if (nikCol && nikCol.notnull === 1) {
			sqlite.exec('PRAGMA foreign_keys=OFF;');
			sqlite.exec(`
				CREATE TABLE anggota_keluarga_temp (
					id TEXT PRIMARY KEY NOT NULL,
					keluarga_id TEXT NOT NULL REFERENCES keluarga(id) ON DELETE CASCADE,
					user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
					namaLengkap TEXT,
					nik_encrypted TEXT,
					status_hubungan TEXT NOT NULL,
					tanggal_lahir TEXT NOT NULL,
					jenis_kelamin TEXT NOT NULL,
					tempat_lahir TEXT,
					profesi TEXT,
					no_telepon TEXT,
					status_generus TEXT,
					status_pernikahan TEXT,
					status_jamaah TEXT DEFAULT 'Aktif',
					isrun TEXT DEFAULT 'Tidak',
					golongan_darah TEXT
				);
				INSERT INTO anggota_keluarga_temp (id, keluarga_id, user_id, namaLengkap, nik_encrypted, status_hubungan, tanggal_lahir, jenis_kelamin)
				SELECT id, keluarga_id, user_id, (CASE WHEN nama_lengkap IS NOT NULL THEN nama_lengkap ELSE NULL END), nik_encrypted, status_hubungan, tanggal_lahir, jenis_kelamin FROM anggota_keluarga;
				DROP TABLE anggota_keluarga;
				ALTER TABLE anggota_keluarga_temp RENAME TO anggota_keluarga;
				CREATE INDEX IF NOT EXISTS anggota_keluarga_keluarga_id_idx ON anggota_keluarga (keluarga_id);
				CREATE INDEX IF NOT EXISTS anggota_keluarga_user_id_idx ON anggota_keluarga (user_id);
			`);
			sqlite.pragma('foreign_keys = ON');
		}

		// Tambahkan kolom-kolom baru sensus jika belum ada
		const newAnggotaCols: Record<string, string> = {
			tempat_lahir: 'TEXT',
			profesi: 'TEXT',
			no_telepon: 'TEXT',
			status_generus: 'TEXT',
			status_pernikahan: 'TEXT',
			status_jamaah: "TEXT DEFAULT 'Aktif'",
			isrun: "TEXT DEFAULT 'Tidak'",
			golongan_darah: 'TEXT'
		};
		for (const [colName, colDef] of Object.entries(newAnggotaCols)) {
			if (!anggotaCols.includes(colName)) {
				sqlite.exec(`ALTER TABLE anggota_keluarga ADD COLUMN ${colName} ${colDef}`);
			}
		}
		sqlite.exec('CREATE INDEX IF NOT EXISTS anggota_keluarga_status_generus_idx ON anggota_keluarga (status_generus)');

		// Auto-heal: Sinkronisasi Kepala Keluarga yang belum memiliki user_id ke kepala_keluarga_id dari tabel keluarga
		sqlite.exec(`
			UPDATE anggota_keluarga
			SET user_id = (SELECT kepala_keluarga_id FROM keluarga WHERE keluarga.id = anggota_keluarga.keluarga_id)
			WHERE status_hubungan = 'Kepala Keluarga'
			  AND user_id IS NULL
			  AND keluarga_id IN (SELECT id FROM keluarga WHERE kepala_keluarga_id IS NOT NULL)
		`);

		// Auto-heal migrasi v1: Secara default, jika KK dan Kepala Keluarga, maka kewajiban isrun ('Ya')
		const userVer = (sqlite.prepare('PRAGMA user_version').get() as { user_version: number })?.user_version ?? 0;
		if (userVer < 1) {
			sqlite.exec(`
				UPDATE anggota_keluarga
				SET isrun = 'Ya'
				WHERE status_hubungan = 'Kepala Keluarga'
				  AND (isrun IS NULL OR isrun = 'Tidak')
				  AND keluarga_id IN (SELECT id FROM keluarga WHERE is_kk = 1 OR is_kk IS NULL);
				PRAGMA user_version = 1;
			`);
		}
	}

	// Auto-heal / migrasi kolom users jika belum memiliki no_telepon
	const tableUsers = sqlite
		.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
		.get();
	if (tableUsers) {
		const rawUsersInfo = sqlite.prepare('PRAGMA table_info(users)').all() as Array<{ name: string }>;
		const userCols = rawUsersInfo.map((c) => c.name);
		if (!userCols.includes('no_telepon')) {
			sqlite.exec('ALTER TABLE users ADD COLUMN no_telepon TEXT');
			sqlite.exec('CREATE INDEX IF NOT EXISTS users_no_telepon_idx ON users (no_telepon)');
		}
	}

	// Auto-create tabel sub_kelompok jika belum ada
	sqlite.exec(`
		CREATE TABLE IF NOT EXISTS sub_kelompok (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			kelompok_id INTEGER NOT NULL REFERENCES kelompok(id) ON DELETE CASCADE,
			nama TEXT NOT NULL,
			keterangan TEXT
		);
		CREATE INDEX IF NOT EXISTS sub_kelompok_kelompok_id_idx ON sub_kelompok (kelompok_id);
	`);

	// Auto-heal / migrasi kolom presensi_kehadiran untuk geolocation, foto bukti, dan approval izin
	const tableKehadiran = sqlite
		.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='presensi_kehadiran'")
		.get();
	if (tableKehadiran) {
		const rawKehadiranInfo = sqlite.prepare('PRAGMA table_info(presensi_kehadiran)').all() as Array<{ name: string }>;
		const kehadiranCols = rawKehadiranInfo.map((c) => c.name);
		const newKehadiranCols: Record<string, string> = {
			metode_kehadiran: 'TEXT',
			foto_url: 'TEXT',
			latitude: 'TEXT',
			longitude: 'TEXT',
			alamat_lokasi: 'TEXT',
			keterangan_izin: 'TEXT',
			status_approval: "TEXT DEFAULT 'Disetujui'",
			catatan_admin: 'TEXT'
		};
		for (const [colName, colDef] of Object.entries(newKehadiranCols)) {
			if (!kehadiranCols.includes(colName)) {
				sqlite.exec(`ALTER TABLE presensi_kehadiran ADD COLUMN ${colName} ${colDef}`);
			}
		}
		sqlite.exec('CREATE INDEX IF NOT EXISTS presensi_kehadiran_status_approval_idx ON presensi_kehadiran (status_approval)');
	}

	// Auto-heal / migrasi tabel jadwal_pengajian_template
	sqlite.exec(`
		CREATE TABLE IF NOT EXISTS jadwal_pengajian_template (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			tingkat_scope TEXT NOT NULL,
			desa_id INTEGER REFERENCES desa(id) ON DELETE CASCADE,
			kelompok_id INTEGER REFERENCES kelompok(id) ON DELETE CASCADE,
			tipe_pola TEXT NOT NULL,
			minggu_ke INTEGER,
			hari INTEGER NOT NULL,
			jam_mulai TEXT NOT NULL,
			jam_selesai TEXT,
			nama_kegiatan TEXT NOT NULL,
			detail_materi TEXT,
			is_libur INTEGER NOT NULL DEFAULT 0,
			lokasi_nama TEXT,
			latitude TEXT,
			longitude TEXT,
			radius_meter INTEGER DEFAULT 100,
			gmaps_url TEXT,
			is_active INTEGER NOT NULL DEFAULT 1
		);
		CREATE INDEX IF NOT EXISTS jadwal_template_scope_idx ON jadwal_pengajian_template (tingkat_scope);
		CREATE INDEX IF NOT EXISTS jadwal_template_desa_idx ON jadwal_pengajian_template (desa_id);
		CREATE INDEX IF NOT EXISTS jadwal_template_kelompok_idx ON jadwal_pengajian_template (kelompok_id);
	`);

	// Auto-heal / migrasi kolom presensi_jadwal untuk cakupan scope, jam wajib, detail materi, override, dan status
	const tableJadwal = sqlite
		.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='presensi_jadwal'")
		.get();
	if (tableJadwal) {
		const rawJadwalInfo = sqlite.prepare('PRAGMA table_info(presensi_jadwal)').all() as Array<{ name: string; notnull: number }>;
		const jadwalCols = rawJadwalInfo.map((c) => c.name);
		const newJadwalCols: Record<string, string> = {
			tingkat_scope: "TEXT NOT NULL DEFAULT 'Kelompok'",
			desa_id: 'INTEGER REFERENCES desa(id) ON DELETE CASCADE',
			template_id: 'INTEGER REFERENCES jadwal_pengajian_template(id) ON DELETE SET NULL',
			jam_mulai: "TEXT NOT NULL DEFAULT '08:00'",
			jam_selesai: 'TEXT',
			detail_materi: 'TEXT',
			is_override: 'INTEGER NOT NULL DEFAULT 0',
			status: "TEXT NOT NULL DEFAULT 'aktif'",
			lokasi_nama: 'TEXT',
			latitude: 'TEXT',
			longitude: 'TEXT',
			radius_meter: 'INTEGER DEFAULT 100',
			gmaps_url: 'TEXT'
		};
		for (const [colName, colDef] of Object.entries(newJadwalCols)) {
			if (!jadwalCols.includes(colName)) {
				sqlite.exec(`ALTER TABLE presensi_jadwal ADD COLUMN ${colName} ${colDef}`);
			}
		}

		// Jika kolom kelompok_id masih NOT NULL, ubah menjadi nullable agar pengajian tingkat Desa dapat tersimpan
		const kelompokCol = rawJadwalInfo.find((c) => c.name === 'kelompok_id');
		if (kelompokCol && kelompokCol.notnull === 1) {
			sqlite.exec('PRAGMA foreign_keys=OFF;');
			sqlite.exec(`
				CREATE TABLE presensi_jadwal_temp (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					tingkat_scope TEXT NOT NULL DEFAULT 'Kelompok',
					desa_id INTEGER REFERENCES desa(id) ON DELETE CASCADE,
					kelompok_id INTEGER REFERENCES kelompok(id) ON DELETE CASCADE,
					template_id INTEGER REFERENCES jadwal_pengajian_template(id) ON DELETE SET NULL,
					tanggal TEXT NOT NULL,
					jam_mulai TEXT NOT NULL DEFAULT '08:00',
					jam_selesai TEXT,
					nama_kegiatan TEXT NOT NULL,
					detail_materi TEXT,
					is_override INTEGER NOT NULL DEFAULT 0,
					status TEXT NOT NULL DEFAULT 'aktif',
					lokasi_nama TEXT,
					latitude TEXT,
					longitude TEXT,
					radius_meter INTEGER DEFAULT 100,
					gmaps_url TEXT
				);
				INSERT INTO presensi_jadwal_temp (
					id, tingkat_scope, desa_id, kelompok_id, template_id, tanggal, jam_mulai, jam_selesai, nama_kegiatan, detail_materi, is_override, status, lokasi_nama, latitude, longitude, radius_meter, gmaps_url
				)
				SELECT
					id,
					COALESCE(tingkat_scope, 'Kelompok'),
					desa_id,
					kelompok_id,
					template_id,
					tanggal,
					COALESCE(jam_mulai, '08:00'),
					jam_selesai,
					nama_kegiatan,
					detail_materi,
					COALESCE(is_override, 0),
					COALESCE(status, 'aktif'),
					lokasi_nama,
					latitude,
					longitude,
					radius_meter,
					gmaps_url
				FROM presensi_jadwal;
				DROP TABLE presensi_jadwal;
				ALTER TABLE presensi_jadwal_temp RENAME TO presensi_jadwal;
				CREATE INDEX IF NOT EXISTS presensi_jadwal_kelompok_id_idx ON presensi_jadwal (kelompok_id);
				CREATE INDEX IF NOT EXISTS presensi_jadwal_desa_id_idx ON presensi_jadwal (desa_id);
				CREATE INDEX IF NOT EXISTS presensi_jadwal_tanggal_idx ON presensi_jadwal (tanggal);
				CREATE INDEX IF NOT EXISTS presensi_jadwal_scope_idx ON presensi_jadwal (tingkat_scope);
				PRAGMA foreign_keys=ON;
			`);
		} else {
			sqlite.exec('CREATE INDEX IF NOT EXISTS presensi_jadwal_desa_id_idx ON presensi_jadwal (desa_id);');
			sqlite.exec('CREATE INDEX IF NOT EXISTS presensi_jadwal_scope_idx ON presensi_jadwal (tingkat_scope);');
		}
	}

	// Auto-heal / migrasi kolom kelompok untuk data lokasi, koordinat GPS, radius, dan link GMaps
	const tableKelompok = sqlite
		.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='kelompok'")
		.get();
	if (tableKelompok) {
		const rawKelompokInfo = sqlite.prepare('PRAGMA table_info(kelompok)').all() as Array<{ name: string }>;
		const kelompokCols = rawKelompokInfo.map((c) => c.name);
		const newKelompokCols: Record<string, string> = {
			lokasi_nama: 'TEXT',
			latitude: 'TEXT',
			longitude: 'TEXT',
			radius_meter: 'INTEGER DEFAULT 100',
			gmaps_url: 'TEXT'
		};
		for (const [colName, colDef] of Object.entries(newKelompokCols)) {
			if (!kelompokCols.includes(colName)) {
				sqlite.exec(`ALTER TABLE kelompok ADD COLUMN ${colName} ${colDef}`);
			}
		}
	}

	// Auto-heal / migrasi kolom desa untuk data lokasi, koordinat GPS, radius, dan link GMaps
	const tableDesa = sqlite
		.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='desa'")
		.get();
	if (tableDesa) {
		const rawDesaInfo = sqlite.prepare('PRAGMA table_info(desa)').all() as Array<{ name: string }>;
		const desaCols = rawDesaInfo.map((c) => c.name);
		const newDesaCols: Record<string, string> = {
			lokasi_nama: 'TEXT',
			latitude: 'TEXT',
			longitude: 'TEXT',
			radius_meter: 'INTEGER DEFAULT 100',
			gmaps_url: 'TEXT',
			lokasi_kelompok_id: 'INTEGER'
		};
		for (const [colName, colDef] of Object.entries(newDesaCols)) {
			if (!desaCols.includes(colName)) {
				sqlite.exec(`ALTER TABLE desa ADD COLUMN ${colName} ${colDef}`);
			}
		}
	}

	// Auto-heal / migrasi kolom daerah untuk data lokasi, koordinat GPS, radius, dan link GMaps
	const tableDaerah = sqlite
		.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='daerah'")
		.get();
	if (tableDaerah) {
		const rawDaerahInfo = sqlite.prepare('PRAGMA table_info(daerah)').all() as Array<{ name: string }>;
		const daerahCols = rawDaerahInfo.map((c) => c.name);
		const newDaerahCols: Record<string, string> = {
			lokasi_nama: 'TEXT',
			latitude: 'TEXT',
			longitude: 'TEXT',
			radius_meter: 'INTEGER DEFAULT 100',
			gmaps_url: 'TEXT'
		};
		for (const [colName, colDef] of Object.entries(newDaerahCols)) {
			if (!daerahCols.includes(colName)) {
				sqlite.exec(`ALTER TABLE daerah ADD COLUMN ${colName} ${colDef}`);
			}
		}
	}

	// Auto-heal / migrasi tabel rekening_wilayah untuk data rekening bank dan QRIS shodaqoh
	sqlite.exec(`
		CREATE TABLE IF NOT EXISTS rekening_wilayah (
			id TEXT PRIMARY KEY NOT NULL,
			tingkat_scope TEXT NOT NULL,
			daerah_id INTEGER REFERENCES daerah(id) ON DELETE CASCADE,
			desa_id INTEGER REFERENCES desa(id) ON DELETE CASCADE,
			kelompok_id INTEGER REFERENCES kelompok(id) ON DELETE CASCADE,
			nama_bank TEXT NOT NULL,
			nomor_rekening TEXT NOT NULL,
			atas_nama TEXT NOT NULL,
			tipe_tujuan TEXT NOT NULL DEFAULT 'Infaq & Shodaqoh',
			qris_image_url TEXT,
			keterangan TEXT,
			is_active INTEGER NOT NULL DEFAULT 1,
			created_at INTEGER NOT NULL
		);
		CREATE INDEX IF NOT EXISTS rekening_wilayah_scope_idx ON rekening_wilayah (tingkat_scope);
		CREATE INDEX IF NOT EXISTS rekening_wilayah_daerah_id_idx ON rekening_wilayah (daerah_id);
		CREATE INDEX IF NOT EXISTS rekening_wilayah_desa_id_idx ON rekening_wilayah (desa_id);
		CREATE INDEX IF NOT EXISTS rekening_wilayah_kelompok_id_idx ON rekening_wilayah (kelompok_id);
	`);

	// Auto-heal / migrasi tabel transaksi_fr untuk setoran FR bulanan jamaah
	sqlite.exec(`
		CREATE TABLE IF NOT EXISTS transaksi_fr (
			id TEXT PRIMARY KEY NOT NULL,
			anggota_keluarga_id TEXT NOT NULL REFERENCES anggota_keluarga(id) ON DELETE CASCADE,
			kelompok_id INTEGER NOT NULL REFERENCES kelompok(id) ON DELETE CASCADE,
			desa_id INTEGER REFERENCES desa(id) ON DELETE CASCADE,
			daerah_id INTEGER REFERENCES daerah(id) ON DELETE CASCADE,
			tahun INTEGER NOT NULL,
			bulan INTEGER NOT NULL,
			nominal INTEGER NOT NULL DEFAULT 0,
			status_bayar TEXT NOT NULL DEFAULT 'Lunas',
			catatan TEXT,
			updated_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
			created_at INTEGER NOT NULL,
			updated_at INTEGER NOT NULL
		);
		CREATE INDEX IF NOT EXISTS transaksi_fr_anggota_idx ON transaksi_fr (anggota_keluarga_id);
		CREATE INDEX IF NOT EXISTS transaksi_fr_kelompok_idx ON transaksi_fr (kelompok_id);
		CREATE INDEX IF NOT EXISTS transaksi_fr_periode_idx ON transaksi_fr (tahun, bulan);
		CREATE INDEX IF NOT EXISTS transaksi_fr_desa_periode_idx ON transaksi_fr (desa_id, tahun, bulan);
		CREATE UNIQUE INDEX IF NOT EXISTS transaksi_fr_unik_periode_idx ON transaksi_fr (anggota_keluarga_id, tahun, bulan);
	`);

	// Auto-heal / migrasi tabel jenis_shodaqoh untuk kategori/alokasi shodaqoh per wilayah
	sqlite.exec(`
		CREATE TABLE IF NOT EXISTS jenis_shodaqoh (
			id TEXT PRIMARY KEY NOT NULL,
			tingkat_scope TEXT NOT NULL,
			daerah_id INTEGER REFERENCES daerah(id) ON DELETE CASCADE,
			desa_id INTEGER REFERENCES desa(id) ON DELETE CASCADE,
			kelompok_id INTEGER REFERENCES kelompok(id) ON DELETE CASCADE,
			nama TEXT NOT NULL,
			deskripsi TEXT,
			is_default INTEGER NOT NULL DEFAULT 0,
			is_active INTEGER NOT NULL DEFAULT 1,
			created_at INTEGER NOT NULL,
			updated_at INTEGER NOT NULL
		);
		CREATE INDEX IF NOT EXISTS jenis_shodaqoh_scope_idx ON jenis_shodaqoh (tingkat_scope);
		CREATE INDEX IF NOT EXISTS jenis_shodaqoh_kelompok_idx ON jenis_shodaqoh (kelompok_id);
		CREATE INDEX IF NOT EXISTS jenis_shodaqoh_desa_idx ON jenis_shodaqoh (desa_id);
		CREATE INDEX IF NOT EXISTS jenis_shodaqoh_daerah_idx ON jenis_shodaqoh (daerah_id);
	`);

	// Auto-heal / migrasi tabel transaksi_shodaqoh untuk laporan shodaqoh jamaah & approval pengurus
	sqlite.exec(`
		CREATE TABLE IF NOT EXISTS transaksi_shodaqoh (
			id TEXT PRIMARY KEY NOT NULL,
			user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
			nama_pengirim TEXT NOT NULL,
			no_telepon TEXT,
			tingkat_scope TEXT NOT NULL,
			daerah_id INTEGER REFERENCES daerah(id) ON DELETE CASCADE,
			desa_id INTEGER REFERENCES desa(id) ON DELETE CASCADE,
			kelompok_id INTEGER REFERENCES kelompok(id) ON DELETE CASCADE,
			rekening_wilayah_id TEXT REFERENCES rekening_wilayah(id) ON DELETE SET NULL,
			jenis_shodaqoh_id TEXT REFERENCES jenis_shodaqoh(id) ON DELETE SET NULL,
			nama_jenis_shodaqoh TEXT NOT NULL,
			nominal INTEGER NOT NULL,
			tanggal_transfer TEXT NOT NULL,
			metode_pembayaran TEXT NOT NULL DEFAULT 'Transfer Bank',
			bukti_transfer_url TEXT,
			catatan TEXT,
			status_approval TEXT NOT NULL DEFAULT 'Menunggu Persetujuan',
			alasan_penolakan TEXT,
			approved_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
			approved_at INTEGER,
			created_at INTEGER NOT NULL,
			updated_at INTEGER NOT NULL
		);
		CREATE INDEX IF NOT EXISTS transaksi_shodaqoh_kelompok_idx ON transaksi_shodaqoh (kelompok_id);
		CREATE INDEX IF NOT EXISTS transaksi_shodaqoh_desa_idx ON transaksi_shodaqoh (desa_id);
		CREATE INDEX IF NOT EXISTS transaksi_shodaqoh_daerah_idx ON transaksi_shodaqoh (daerah_id);
		CREATE INDEX IF NOT EXISTS transaksi_shodaqoh_status_idx ON transaksi_shodaqoh (status_approval);
		CREATE INDEX IF NOT EXISTS transaksi_shodaqoh_tanggal_idx ON transaksi_shodaqoh (tanggal_transfer);
	`);

	// Auto-heal / migrasi kolom template_id di tabel transaksi_fr
	const rawTransaksiFrInfo = sqlite.prepare('PRAGMA table_info(transaksi_fr)').all() as Array<{ name: string }>;
	const transaksiFrCols = rawTransaksiFrInfo.map((c) => c.name);
	if (!transaksiFrCols.includes('template_id')) {
		sqlite.exec(`ALTER TABLE transaksi_fr ADD COLUMN template_id TEXT REFERENCES template_infaq_rutin(id) ON DELETE SET NULL;`);
		sqlite.exec(`CREATE INDEX IF NOT EXISTS transaksi_fr_template_idx ON transaksi_fr (template_id);`);
	}

	// Auto-heal / migrasi tabel pos_anggaran_infaq (Hierarki Pos Fleksibel & 4 Hak Wajib)
	sqlite.exec(`
		CREATE TABLE IF NOT EXISTS pos_anggaran_infaq (
			id TEXT PRIMARY KEY NOT NULL,
			parent_id TEXT REFERENCES pos_anggaran_infaq(id) ON DELETE CASCADE,
			kode TEXT NOT NULL,
			nama TEXT NOT NULL,
			deskripsi TEXT,
			tingkat_scope TEXT NOT NULL DEFAULT 'Kelompok',
			desa_id INTEGER REFERENCES desa(id) ON DELETE CASCADE,
			kelompok_id INTEGER REFERENCES kelompok(id) ON DELETE CASCADE,
			is_wajib INTEGER NOT NULL DEFAULT 0,
			tipe_alokasi TEXT NOT NULL DEFAULT 'nominal',
			urutan INTEGER NOT NULL DEFAULT 0,
			is_active INTEGER NOT NULL DEFAULT 1,
			created_at INTEGER NOT NULL,
			updated_at INTEGER NOT NULL
		);
		CREATE INDEX IF NOT EXISTS pos_anggaran_parent_idx ON pos_anggaran_infaq (parent_id);
		CREATE INDEX IF NOT EXISTS pos_anggaran_scope_idx ON pos_anggaran_infaq (tingkat_scope, kelompok_id, desa_id);
		CREATE INDEX IF NOT EXISTS pos_anggaran_urutan_idx ON pos_anggaran_infaq (urutan);
	`);

	// Auto-heal / migrasi tabel template_infaq_rutin
	sqlite.exec(`
		CREATE TABLE IF NOT EXISTS template_infaq_rutin (
			id TEXT PRIMARY KEY NOT NULL,
			nama TEXT NOT NULL,
			tingkat_scope TEXT NOT NULL DEFAULT 'Kelompok',
			desa_id INTEGER REFERENCES desa(id) ON DELETE CASCADE,
			kelompok_id INTEGER REFERENCES kelompok(id) ON DELETE CASCADE,
			tahun INTEGER NOT NULL,
			bulan_mulai INTEGER NOT NULL DEFAULT 1,
			bulan_selesai INTEGER NOT NULL DEFAULT 12,
			nominal_minimum_default INTEGER NOT NULL DEFAULT 0,
			status TEXT NOT NULL DEFAULT 'aktif',
			catatan TEXT,
			created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
			created_at INTEGER NOT NULL,
			updated_at INTEGER NOT NULL
		);
		CREATE INDEX IF NOT EXISTS template_infaq_periode_idx ON template_infaq_rutin (tahun, bulan_mulai, bulan_selesai);
		CREATE INDEX IF NOT EXISTS template_infaq_scope_idx ON template_infaq_rutin (tingkat_scope, kelompok_id, status);
	`);

	// Auto-heal / migrasi tabel template_infaq_bundle (Paket/Bundle Tarif)
	sqlite.exec(`
		CREATE TABLE IF NOT EXISTS template_infaq_bundle (
			id TEXT PRIMARY KEY NOT NULL,
			template_id TEXT NOT NULL REFERENCES template_infaq_rutin(id) ON DELETE CASCADE,
			nama TEXT NOT NULL,
			nominal INTEGER NOT NULL DEFAULT 0,
			deskripsi TEXT,
			urutan INTEGER NOT NULL DEFAULT 0
		);
		CREATE INDEX IF NOT EXISTS template_bundle_template_idx ON template_infaq_bundle (template_id);
	`);

	// Auto-heal / migrasi tabel template_infaq_pos
	sqlite.exec(`
		CREATE TABLE IF NOT EXISTS template_infaq_pos (
			id TEXT PRIMARY KEY NOT NULL,
			template_id TEXT NOT NULL REFERENCES template_infaq_rutin(id) ON DELETE CASCADE,
			pos_id TEXT NOT NULL REFERENCES pos_anggaran_infaq(id) ON DELETE RESTRICT,
			nominal_target INTEGER DEFAULT 0,
			persentase_split INTEGER DEFAULT 0,
			urutan INTEGER NOT NULL DEFAULT 0
		);
		CREATE INDEX IF NOT EXISTS template_pos_template_idx ON template_infaq_pos (template_id);
		CREATE UNIQUE INDEX IF NOT EXISTS template_pos_unik_idx ON template_infaq_pos (template_id, pos_id);
	`);

	// Auto-heal / migrasi tabel template_infaq_jamaah (Tarif Granular Jamaah)
	sqlite.exec(`
		CREATE TABLE IF NOT EXISTS template_infaq_jamaah (
			id TEXT PRIMARY KEY NOT NULL,
			template_id TEXT NOT NULL REFERENCES template_infaq_rutin(id) ON DELETE CASCADE,
			anggota_keluarga_id TEXT NOT NULL REFERENCES anggota_keluarga(id) ON DELETE CASCADE,
			bundle_id TEXT REFERENCES template_infaq_bundle(id) ON DELETE SET NULL,
			nominal_target INTEGER NOT NULL DEFAULT 0,
			is_custom INTEGER NOT NULL DEFAULT 0,
			catatan TEXT,
			updated_at INTEGER NOT NULL
		);
		CREATE INDEX IF NOT EXISTS template_jamaah_template_idx ON template_infaq_jamaah (template_id);
		CREATE INDEX IF NOT EXISTS template_jamaah_bundle_idx ON template_infaq_jamaah (bundle_id);
		CREATE UNIQUE INDEX IF NOT EXISTS template_jamaah_unik_idx ON template_infaq_jamaah (template_id, anggota_keluarga_id);
	`);

	// Seed otomatis 4 Hak Wajib jika belum ada di tabel pos_anggaran_infaq
	const countWajib = sqlite.prepare("SELECT COUNT(*) as count FROM pos_anggaran_infaq WHERE is_wajib = 1").get() as { count: number };
	if (!countWajib || countWajib.count === 0) {
		const now = Date.now();
		const defaultHakWajib = [
			{ id: 'hw_pusat', kode: 'HW-PUSAT', nama: 'Hak Pusat', tingkatScope: 'Pusat', urutan: 1 },
			{ id: 'hw_daerah', kode: 'HW-DAERAH', nama: 'Hak Daerah', tingkatScope: 'Daerah', urutan: 2 },
			{ id: 'hw_desa', kode: 'HW-DESA', nama: 'Hak Desa', tingkatScope: 'Desa', urutan: 3 },
			{ id: 'hw_kelompok', kode: 'HW-KELOMPOK', nama: 'Hak Kelompok', tingkatScope: 'Kelompok', urutan: 4 }
		];
		const insertStmt = sqlite.prepare(`
			INSERT OR IGNORE INTO pos_anggaran_infaq (id, kode, nama, deskripsi, tingkat_scope, is_wajib, tipe_alokasi, urutan, is_active, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, 1, 'nominal', ?, 1, ?, ?)
		`);
		for (const h of defaultHakWajib) {
			insertStmt.run(h.id, h.kode, h.nama, `Alokasi wajib rutin untuk tingkat ${h.tingkatScope}`, h.tingkatScope, h.urutan, now, now);
		}
	}

	// Auto-heal / migrasi tabel template_infaq_group dan template_infaq_group_pos (Spreadsheet Mode)
	sqlite.exec(`
		CREATE TABLE IF NOT EXISTS template_infaq_group (
			id TEXT PRIMARY KEY NOT NULL,
			template_id TEXT NOT NULL REFERENCES template_infaq_rutin(id) ON DELETE CASCADE,
			nama TEXT NOT NULL,
			keterangan TEXT,
			urutan INTEGER NOT NULL DEFAULT 0,
			created_at INTEGER NOT NULL,
			updated_at INTEGER NOT NULL
		);
		CREATE INDEX IF NOT EXISTS template_group_template_idx ON template_infaq_group (template_id);

		CREATE TABLE IF NOT EXISTS template_infaq_group_pos (
			id TEXT PRIMARY KEY NOT NULL,
			group_id TEXT NOT NULL REFERENCES template_infaq_group(id) ON DELETE CASCADE,
			pos_id TEXT NOT NULL REFERENCES pos_anggaran_infaq(id) ON DELETE CASCADE,
			nominal_jumlah INTEGER NOT NULL DEFAULT 0,
			nominal_keterangan INTEGER NOT NULL DEFAULT 0,
			keterangan_teks TEXT,
			urutan INTEGER NOT NULL DEFAULT 0,
			created_at INTEGER NOT NULL,
			updated_at INTEGER NOT NULL
		);
		CREATE INDEX IF NOT EXISTS group_pos_group_idx ON template_infaq_group_pos (group_id);
		CREATE UNIQUE INDEX IF NOT EXISTS group_pos_unik_idx ON template_infaq_group_pos (group_id, pos_id);
	`);

	// Auto-heal kolom group_id pada tabel template_infaq_jamaah jika belum ada
	const rawTemplateJamaahInfo = sqlite.prepare('PRAGMA table_info(template_infaq_jamaah)').all() as Array<{ name: string }>;
	const templateJamaahCols = rawTemplateJamaahInfo.map((c) => c.name);
	if (!templateJamaahCols.includes('group_id')) {
		sqlite.exec(`ALTER TABLE template_infaq_jamaah ADD COLUMN group_id TEXT REFERENCES template_infaq_group(id) ON DELETE SET NULL;`);
		sqlite.exec(`CREATE INDEX IF NOT EXISTS template_jamaah_group_idx ON template_infaq_jamaah (group_id);`);
	}

	// Seed sub-pos standar acuan jika pos anak masih kosong
	const countChildPos = sqlite.prepare("SELECT COUNT(*) as count FROM pos_anggaran_infaq WHERE parent_id IS NOT NULL").get() as { count: number };
	if (!countChildPos || countChildPos.count === 0) {
		const now = Date.now();
		const standardSubPos = [
			// A. Hak Pusat
			{ id: 'sub_pusat_isrun', parentId: 'hw_pusat', kode: 'HW-PUSAT-01', nama: 'Isrun/FR', urutan: 1 },
			// B. Hak Daerah
			{ id: 'sub_daerah_tenaga', parentId: 'hw_daerah', kode: 'HW-DAERAH-01', nama: 'Tenaga SB, konsumsi', urutan: 1 },
			{ id: 'sub_daerah_kendaraan', parentId: 'hw_daerah', kode: 'HW-DAERAH-02', nama: 'Kendaraan SB, Listrik, Sarpras', urutan: 2 },
			{ id: 'sub_daerah_org', parentId: 'hw_daerah', kode: 'HW-DAERAH-03', nama: 'Organisasi', urutan: 3 },
			{ id: 'sub_daerah_pondok', parentId: 'hw_daerah', kode: 'HW-DAERAH-04', nama: 'Operasional Pondok', urutan: 4 },
			{ id: 'sub_daerah_ppg', parentId: 'hw_daerah', kode: 'HW-DAERAH-05', nama: 'PPG & Jimpitan', urutan: 5 },
			{ id: 'sub_daerah_angsuran', parentId: 'hw_daerah', kode: 'HW-DAERAH-06', nama: 'Angsuran Ke Pusat', urutan: 6 },
			{ id: 'sub_daerah_tanah', parentId: 'hw_daerah', kode: 'HW-DAERAH-07', nama: 'Pembelian Tanah Setu', urutan: 7 },
			// C. Hak Desa
			{ id: 'sub_desa_desa', parentId: 'hw_desa', kode: 'HW-DESA-01', nama: 'Desa', urutan: 1 },
			// D. Hak Kelompok
			{ id: 'sub_kelompok_kas', parentId: 'hw_kelompok', kode: 'HW-KELOMPOK-01', nama: 'Kas Umum', urutan: 1 },
			{ id: 'sub_kelompok_org', parentId: 'hw_kelompok', kode: 'HW-KELOMPOK-02', nama: 'Organisasi', urutan: 2 },
			{ id: 'sub_kelompok_sosial', parentId: 'hw_kelompok', kode: 'HW-KELOMPOK-03', nama: 'Dana Sosial', urutan: 3 },
			{ id: 'sub_kelompok_pembangunan', parentId: 'hw_kelompok', kode: 'HW-KELOMPOK-04', nama: 'Kas Pembangunan', urutan: 4 },
			{ id: 'sub_kelompok_ukhro', parentId: 'hw_kelompok', kode: 'HW-KELOMPOK-05', nama: 'Ukhro MT', urutan: 5 },
			{ id: 'sub_kelompok_qurban', parentId: 'hw_kelompok', kode: 'HW-KELOMPOK-06', nama: 'Qurban', urutan: 6 }
		];

		const insertSubStmt = sqlite.prepare(`
			INSERT OR IGNORE INTO pos_anggaran_infaq (id, parent_id, kode, nama, deskripsi, tingkat_scope, is_wajib, tipe_alokasi, urutan, is_active, created_at, updated_at)
			VALUES (?, ?, ?, ?, '', 'Kelompok', 0, 'nominal', ?, 1, ?, ?)
		`);
		for (const s of standardSubPos) {
			insertSubStmt.run(s.id, s.parentId, s.kode, s.nama, s.urutan, now, now);
		}
	}
} catch (migErr) {
	console.error('[DB Auto-Migration] Gagal memeriksa atau memperbarui kolom skema SQLite:', migErr);
}

export const db = drizzle(sqlite, { schema });

