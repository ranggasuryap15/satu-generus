/**
 * @file src/lib/db/seed.ts
 * @purpose Script seeder data awal master wilayah (Cikarang 1 & 2), 6 desa, 36 kelompok, dan 5 tingkatan akun admin
 * @usedBy npm run db:seed, pengujian lokal, dan setup lingkungan awal
 * @dependencies src/lib/db, src/lib/db/schema, src/lib/server/auth, drizzle-orm
 * @publicFunctions seed
 * @sideEffects Menulis record ke SQLite tabel daerah, desa, kelompok, dapukan, users, user_dapukan
 */

import { db, sqlite } from './index';
import { daerah, desa, kelompok, dapukan, users, userDapukan } from './schema';
import { hashPassword } from '../server/auth';
import { eq } from 'drizzle-orm';

export async function seed() {
	console.log('🌱 Memulai seeding database Satu Generus...');

	// 1. Master Dapukan Baku (4S & Superadmin)
	const masterDapukan = [
		{ namaDapukan: 'Superadmin', is4S: true, keterangan: 'Akses penuh seluruh sistem' },
		{ namaDapukan: 'Ketua', is4S: true, keterangan: 'Pengurus 4S lini Ketua' },
		{ namaDapukan: 'Sekretaris', is4S: true, keterangan: 'Pengurus 4S lini Sekretaris' },
		{ namaDapukan: 'Bendahara', is4S: true, keterangan: 'Pengurus 4S lini Bendahara' },
		{ namaDapukan: 'Penasihat', is4S: true, keterangan: 'Pengurus 4S lini Penasihat' },
		{ namaDapukan: 'Seksi Acara', is4S: false, keterangan: 'Dapukan operasional kegiatan' }
	];

	for (const d of masterDapukan) {
		const existing = db.select().from(dapukan).where(eq(dapukan.namaDapukan, d.namaDapukan)).get();
		if (!existing) {
			db.insert(dapukan).values(d).run();
		}
	}
	console.log('  👔 Master Dapukan baku (Superadmin & 4S) siap.');

	const getDapukan = (name: string) =>
		db.select().from(dapukan).where(eq(dapukan.namaDapukan, name)).get();

	const dapukanSuperadmin = getDapukan('Superadmin');
	const dapukanKetua = getDapukan('Ketua');

	// 2. Master Wilayah: 2 Daerah (Cikarang 1 dan Cikarang 2)
	const listDaerah = [
		{ nama: 'Cikarang 1', provinsi: 'Jawa Barat', kotaKabupaten: 'Kabupaten Bekasi' },
		{ nama: 'Cikarang 2', provinsi: 'Jawa Barat', kotaKabupaten: 'Kabupaten Bekasi' }
	];

	const daerahRecords: Record<string, typeof daerah.$inferSelect> = {};

	for (const d of listDaerah) {
		let rec = db.select().from(daerah).where(eq(daerah.nama, d.nama)).get();
		if (!rec) {
			[rec] = db.insert(daerah).values(d).returning().all();
			console.log('  📍 Daerah dibuat:', rec.nama);
		}
		daerahRecords[d.nama] = rec;
	}

	// 3. Master Desa: 3 di Cikarang 1, 3 di Cikarang 2
	const listDesa = [
		// Cikarang 1
		{ daerahNama: 'Cikarang 1', nama: 'Karang Rahayu', kecamatan: 'Karangbahagia' },
		{ daerahNama: 'Cikarang 1', nama: 'Sukaraya', kecamatan: 'Karangbahagia' },
		{ daerahNama: 'Cikarang 1', nama: 'Lippo Cikarang', kecamatan: 'Cikarang Selatan' },
		// Cikarang 2
		{ daerahNama: 'Cikarang 2', nama: 'Tambun', kecamatan: 'Tambun Selatan' },
		{ daerahNama: 'Cikarang 2', nama: 'Cibitung', kecamatan: 'Cibitung' },
		{ daerahNama: 'Cikarang 2', nama: 'Grand Wisata', kecamatan: 'Tambun Selatan' }
	];

	const desaRecords: Record<string, typeof desa.$inferSelect> = {};

	for (const ds of listDesa) {
		const parentDaerah = daerahRecords[ds.daerahNama];
		let rec = db.select().from(desa).where(eq(desa.nama, ds.nama)).get();
		if (!rec) {
			[rec] = db
				.insert(desa)
				.values({
					daerahId: parentDaerah.id,
					nama: ds.nama,
					kecamatan: ds.kecamatan
				})
				.returning()
				.all();
			console.log(`  📍 Desa dibuat: ${rec.nama} (${ds.daerahNama})`);
		}
		desaRecords[ds.nama] = rec;
	}

	// 4. Master Kelompok: Masing-masing ada 6 kelompok (Kelompok 1 s/d Kelompok 6)
	const kelompokRecords: Record<string, typeof kelompok.$inferSelect> = {};

	for (const ds of listDesa) {
		const parentDesa = desaRecords[ds.nama];
		for (let i = 1; i <= 6; i++) {
			const namaKelompok = `Kelompok ${i}`;
			const uniqueKey = `${ds.nama} - ${namaKelompok}`;

			let rec = db
				.select()
				.from(kelompok)
				.where(eq(kelompok.desaId, parentDesa.id))
				.all()
				.find((k) => k.nama === namaKelompok);

			if (!rec) {
				[rec] = db
					.insert(kelompok)
					.values({
						desaId: parentDesa.id,
						nama: namaKelompok,
						kelurahan: ds.nama
					})
					.returning()
					.all();
			}
			kelompokRecords[uniqueKey] = rec;
		}
	}
	console.log('  🏘️ 36 Kelompok (6 kelompok per desa) siap.');

	// 5. Akun Pengguna & Admin di Setiap Lini
	const defaultPassword = 'password123';
	const defaultHash = await hashPassword(defaultPassword);

	// Ambil referensi wilayah utama untuk penugasan
	const daerahCikarang1 = daerahRecords['Cikarang 1'];
	const desaKarangRahayu = desaRecords['Karang Rahayu'];
	const kelompok1KarangRahayu = kelompokRecords['Karang Rahayu - Kelompok 1'];

	interface SeedUserPlan {
		email: string;
		namaLengkap: string;
		kelompokId: number;
		scope: 'Pusat' | 'Daerah' | 'Desa' | 'Kelompok' | null;
		dapukanId?: number;
		daerahId?: number;
		desaId?: number;
		assignedKelompokId?: number;
	}

	const userPlans: SeedUserPlan[] = [
		// a. Superadmin
		{
			email: 'superadmin@satugenerus.id',
			namaLengkap: 'Superadmin Satu Generus',
			kelompokId: kelompok1KarangRahayu.id,
			scope: 'Pusat',
			dapukanId: dapukanSuperadmin?.id
		},
		// b. Admin Pusat
		{
			email: 'admin.pusat@satugenerus.id',
			namaLengkap: 'Admin Pengurus Pusat',
			kelompokId: kelompok1KarangRahayu.id,
			scope: 'Pusat',
			dapukanId: dapukanKetua?.id
		},
		// c. Admin Daerah (Cikarang 1)
		{
			email: 'admin.daerah@satugenerus.id',
			namaLengkap: 'Admin Daerah Cikarang 1',
			kelompokId: kelompok1KarangRahayu.id,
			scope: 'Daerah',
			dapukanId: dapukanKetua?.id,
			daerahId: daerahCikarang1.id
		},
		// d. Admin Desa (Karang Rahayu)
		{
			email: 'admin.desa@satugenerus.id',
			namaLengkap: 'Admin Desa Karang Rahayu',
			kelompokId: kelompok1KarangRahayu.id,
			scope: 'Desa',
			dapukanId: dapukanKetua?.id,
			desaId: desaKarangRahayu.id
		},
		// e. Admin Kelompok (Kelompok 1)
		{
			email: 'admin.kelompok@satugenerus.id',
			namaLengkap: 'Admin Kelompok 1 Karang Rahayu',
			kelompokId: kelompok1KarangRahayu.id,
			scope: 'Kelompok',
			dapukanId: dapukanKetua?.id,
			assignedKelompokId: kelompok1KarangRahayu.id
		},
		// f. Akun Jamaah Biasa
		{
			email: 'jamaah@satugenerus.id',
			namaLengkap: 'Budi Santoso (Jamaah)',
			kelompokId: kelompok1KarangRahayu.id,
			scope: null
		}
	];

	for (const plan of userPlans) {
		let userRec = db.select().from(users).where(eq(users.email, plan.email)).get();

		if (!userRec) {
			[userRec] = db
				.insert(users)
				.values({
					namaLengkap: plan.namaLengkap,
					email: plan.email,
					passwordHash: defaultHash,
					kelompokId: plan.kelompokId
				})
				.returning()
				.all();
		} else {
			// Perbarui password dan nama jika sudah ada
			db.update(users)
				.set({
					namaLengkap: plan.namaLengkap,
					passwordHash: defaultHash,
					kelompokId: plan.kelompokId
				})
				.where(eq(users.id, userRec.id))
				.run();
		}

		// Set wewenang dapukan jika user memiliki scope admin
		if (plan.scope && plan.dapukanId) {
			const existingRole = db
				.select()
				.from(userDapukan)
				.where(eq(userDapukan.userId, userRec.id))
				.get();

			if (!existingRole) {
				db.insert(userDapukan)
					.values({
						userId: userRec.id,
						dapukanId: plan.dapukanId,
						tingkatScope: plan.scope,
						daerahId: plan.daerahId,
						desaId: plan.desaId,
						kelompokId: plan.assignedKelompokId
					})
					.run();
			} else {
				db.update(userDapukan)
					.set({
						dapukanId: plan.dapukanId,
						tingkatScope: plan.scope,
						daerahId: plan.daerahId,
						desaId: plan.desaId,
						kelompokId: plan.assignedKelompokId
					})
					.where(eq(userDapukan.id, existingRole.id))
					.run();
			}
		}

		console.log(`  👤 Akun siap: ${plan.email} (${plan.scope ? `Admin ${plan.scope}` : 'Jamaah'})`);
	}

	console.log('✅ Seeding database berhasil rampung!');
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


