/**
 * @file src/lib/db/index.ts
 * @purpose Inisialisasi koneksi SQLite (better-sqlite3) dan instance Drizzle ORM
 * @usedBy Backend server routes (+page.server.ts, +server.ts, hooks.server.ts, scripts migrasi/seed)
 * @dependencies better-sqlite3, drizzle-orm/better-sqlite3, src/lib/db/schema.ts
 * @publicFunctions db, sqlite
 * @sideEffects Membuka koneksi file database SQLite, mengaktifkan PRAGMA WAL & foreign_keys, auto-migrasi kolom & tabel skema (sub_kelompok, users, anggota_keluarga, jadwal_pengajian_template, presensi_jadwal, presensi_kehadiran, dan kelompok)
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
} catch (migErr) {
	console.error('[DB Auto-Migration] Gagal memeriksa atau memperbarui kolom skema SQLite:', migErr);
}

export const db = drizzle(sqlite, { schema });

