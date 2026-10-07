/**
 * @file src/lib/db/seed.ts
 * @purpose Script seeder data awal master wilayah, dapukan 4S, akun admin demo, dan jamaah
 * @usedBy npm run db:seed, pengujian lokal, dan setup lingkungan awal
 * @dependencies src/lib/db, src/lib/db/schema, src/lib/server/auth
 * @publicFunctions seed
 * @sideEffects Menulis record awal ke SQLite tabel daerah, desa, kelompok, dapukan, users, user_dapukan
 */

import { db, sqlite } from './index';
import { daerah, desa, kelompok, dapukan, users, userDapukan } from './schema';
import { hashPassword } from '../server/auth';
import { eq } from 'drizzle-orm';

export async function seed() {
	console.log('🌱 Memulai seeding database Satu Generus...');

	// 1. Master Wilayah
	let [d1] = db.select().from(daerah).where(eq(daerah.nama, 'Daerah Jakarta Selatan')).all();
	if (!d1) {
		[d1] = db
			.insert(daerah)
			.values({
				nama: 'Daerah Jakarta Selatan',
				provinsi: 'DKI Jakarta',
				kotaKabupaten: 'Kota Jakarta Selatan'
			})
			.returning()
			.all();
		console.log('  📍 Daerah dibuat:', d1.nama);
	}

	let [ds1] = db.select().from(desa).where(eq(desa.nama, 'Desa Kebayoran')).all();
	if (!ds1) {
		[ds1] = db
			.insert(desa)
			.values({
				daerahId: d1.id,
				nama: 'Desa Kebayoran',
				kecamatan: 'Kebayoran Baru'
			})
			.returning()
			.all();
		console.log('  📍 Desa dibuat:', ds1.nama);
	}

	let [k1] = db.select().from(kelompok).where(eq(kelompok.nama, 'Kelompok 1')).all();
	if (!k1) {
		[k1] = db
			.insert(kelompok)
			.values({
				desaId: ds1.id,
				nama: 'Kelompok 1',
				kelurahan: 'Senayan'
			})
			.returning()
			.all();
		console.log('  📍 Kelompok dibuat:', k1.nama);
	}

	// 2. Master Dapukan Baku (4S)
	const masterDapukan = [
		{ namaDapukan: 'Ketua', is4S: true },
		{ namaDapukan: 'Sekretaris', is4S: true },
		{ namaDapukan: 'Bendahara', is4S: true },
		{ namaDapukan: 'Penasihat', is4S: true },
		{ namaDapukan: 'Seksi Acara', is4S: false }
	];

	for (const d of masterDapukan) {
		const existing = db.select().from(dapukan).where(eq(dapukan.namaDapukan, d.namaDapukan)).get();
		if (!existing) {
			db.insert(dapukan).values(d).run();
		}
	}
	console.log('  👔 Master Dapukan baku (4S) disiapkan');

	const ketuaDapukan = db.select().from(dapukan).where(eq(dapukan.namaDapukan, 'Ketua')).get();

	// 3. Akun Pengguna Demo
	const defaultHash = await hashPassword('password123');

	// Akun Admin (Pengurus 4S)
	let adminUser = db.select().from(users).where(eq(users.email, 'admin@satugenerus.id')).get();
	if (!adminUser) {
		[adminUser] = db
			.insert(users)
			.values({
				namaLengkap: 'Haji Ahmad Fauzi (Ketua Desa)',
				email: 'admin@satugenerus.id',
				passwordHash: defaultHash,
				kelompokId: k1.id
			})
			.returning()
			.all();

		if (ketuaDapukan) {
			db.insert(userDapukan)
				.values({
					userId: adminUser.id,
					dapukanId: ketuaDapukan.id,
					tingkatScope: 'Desa',
					desaId: ds1.id
				})
				.run();
		}
		console.log('  👤 User Admin (4S Desa) dibuat: admin@satugenerus.id / password123');
	}

	// Akun Jamaah Biasa
	let regularUser = db.select().from(users).where(eq(users.email, 'jamaah@satugenerus.id')).get();
	if (!regularUser) {
		[regularUser] = db
			.insert(users)
			.values({
				namaLengkap: 'Budi Santoso',
				email: 'jamaah@satugenerus.id',
				passwordHash: defaultHash,
				kelompokId: k1.id
			})
			.returning()
			.all();
		console.log('  👤 User Jamaah dibuat: jamaah@satugenerus.id / password123');
	}

	console.log('✅ Seeding database selesai!');
}

if (process.argv[1]?.endsWith('seed.ts') || process.argv[1]?.endsWith('seed.js')) {
	seed()
		.then(() => {
			sqlite.close();
			process.exit(0);
		})
		.catch((err) => {
			console.error('❌ Gagal seeding:', err);
			sqlite.close();
			process.exit(1);
		});
}

