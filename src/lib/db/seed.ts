/**
 * @file src/lib/db/seed.ts
 * @purpose Script seeder data awal master wilayah, struktur 4S baku daerah/desa/kelompok (Kyai, Wakil Kyai, Sekretaris/Penerobos, KU/Bendahara, Mubaligh/Ulama, Aghnia) dan akun admin (Superadmin & Admin Pusat)
 * @usedBy npm run db:seed, pengujian lokal, dan setup lingkungan awal
 * @dependencies src/lib/db, src/lib/db/schema, src/lib/server/auth, drizzle-orm
 * @publicFunctions seed
 * @sideEffects Menulis/memperbarui record ke PostgreSQL tabel daerah, desa, kelompok, dapukan, users, user_dapukan, pos_anggaran_infaq
 */

import { db, client, first } from './index';
import { daerah, desa, kelompok, dapukan, users, userDapukan, posAnggaranInfaq } from './schema';
import { hashPassword } from '../server/auth';
import { count, eq } from 'drizzle-orm';

export async function seed() {
	console.log('🌱 Memulai seeding database Satu Generus...');

	// 1. Master Dapukan Baku (Admin Pusat, Superadmin & 4S Daerah/Desa/Kelompok)
	const masterDapukan = [
		{ namaDapukan: 'Superadmin', is4S: true, keterangan: 'Akses penuh seluruh sistem' },
		{ namaDapukan: 'Admin Pusat', is4S: false, keterangan: 'Pengurus / Administrator tingkat Pusat' },
		{ namaDapukan: 'Kyai', is4S: true, keterangan: 'Pengurus 4S lini Keimaman / Kyai (Daerah, Desa, Kelompok)' },
		{ namaDapukan: 'Wakil Kyai', is4S: true, keterangan: 'Pengurus 4S lini Wakil Keimaman / Wakil Kyai (Daerah, Desa, Kelompok)' },
		{ namaDapukan: 'Sekretaris / Penerobos', is4S: true, keterangan: 'Pengurus 4S lini Sekretaris / Penerobos' },
		{ namaDapukan: 'KU/Bendahara', is4S: true, keterangan: 'Pengurus 4S lini Keuangan / Bendahara' },
		{ namaDapukan: 'Mubaligh/Ulama', is4S: true, keterangan: 'Pengurus 4S lini Mubaligh / Ulama' },
		{ namaDapukan: 'Aghnia', is4S: true, keterangan: 'Pengurus 4S lini Aghnia' }
	];

	// Bersihkan dapukan non-4S lama (Seksi Acara) dan migrasikan nama lama bila ada
	(await db.delete(dapukan).where(eq(dapukan.namaDapukan, 'Seksi Acara')));
(await db.update(dapukan).set({ namaDapukan: 'Kyai' }).where(eq(dapukan.namaDapukan, 'Ketua')));
(await db.update(dapukan).set({ namaDapukan: 'Sekretaris / Penerobos' }).where(eq(dapukan.namaDapukan, 'Sekretaris')));
(await db.update(dapukan).set({ namaDapukan: 'KU/Bendahara' }).where(eq(dapukan.namaDapukan, 'Bendahara')));
(await db.update(dapukan).set({ namaDapukan: 'Mubaligh/Ulama' }).where(eq(dapukan.namaDapukan, 'Penasihat')));

	for (const d of masterDapukan) {
		const existing = (await first(db.select().from(dapukan).where(eq(dapukan.namaDapukan, d.namaDapukan))));
		if (!existing) {
(await db.insert(dapukan).values(d));
		}
	}
	console.log('  👔 Master Dapukan baku (Superadmin & 4S) siap.');

	const getDapukan = async (name: string) =>
		await first(db.select().from(dapukan).where(eq(dapukan.namaDapukan, name)));

	const dapukanSuperadmin = await getDapukan('Superadmin');
	const dapukanAdminPusat = await getDapukan('Admin Pusat');
	const dapukanKyai = await getDapukan('Kyai');

	// 2. Master Wilayah: 2 Daerah (Cikarang 1 dan Cikarang 2)
	const listDaerah = [
		{ nama: 'Cikarang 1', provinsi: 'Jawa Barat', kotaKabupaten: 'Kabupaten Bekasi' },
		{ nama: 'Cikarang 2', provinsi: 'Jawa Barat', kotaKabupaten: 'Kabupaten Bekasi' }
	];

	const daerahRecords: Record<string, typeof daerah.$inferSelect> = {};

	for (const d of listDaerah) {
		let rec = (await first(db.select().from(daerah).where(eq(daerah.nama, d.nama))));
		if (!rec) {
			[rec] = (await db.insert(daerah).values(d).returning());
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
		let rec = (await first(db.select().from(desa).where(eq(desa.nama, ds.nama))));
		if (!rec) {
			[rec] = (await db
				.insert(desa)
				.values({
					daerahId: parentDaerah.id,
					nama: ds.nama,
					kecamatan: ds.kecamatan
				})
				.returning()
);
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

			let rec = (await db
				.select()
				.from(kelompok)
				.where(eq(kelompok.desaId, parentDesa.id))
				)
				.find((k) => k.nama === namaKelompok);

			if (!rec) {
				[rec] = (await db
					.insert(kelompok)
					.values({
						desaId: parentDesa.id,
						nama: namaKelompok,
						kelurahan: ds.nama
					})
					.returning()
);
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
			dapukanId: dapukanAdminPusat?.id
		},
		// c. Admin Daerah (Cikarang 1)
		{
			email: 'admin.daerah@satugenerus.id',
			namaLengkap: 'Admin Daerah Cikarang 1',
			kelompokId: kelompok1KarangRahayu.id,
			scope: 'Daerah',
			dapukanId: dapukanKyai?.id,
			daerahId: daerahCikarang1.id
		},
		// d. Admin Desa (Karang Rahayu)
		{
			email: 'admin.desa@satugenerus.id',
			namaLengkap: 'Admin Desa Karang Rahayu',
			kelompokId: kelompok1KarangRahayu.id,
			scope: 'Desa',
			dapukanId: dapukanKyai?.id,
			desaId: desaKarangRahayu.id
		},
		// e. Admin Kelompok (Kelompok 1)
		{
			email: 'admin.kelompok@satugenerus.id',
			namaLengkap: 'Admin Kelompok 1 Karang Rahayu',
			kelompokId: kelompok1KarangRahayu.id,
			scope: 'Kelompok',
			dapukanId: dapukanKyai?.id,
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
		let userRec = (await first(db.select().from(users).where(eq(users.email, plan.email))));

		if (!userRec) {
			[userRec] = (await db
				.insert(users)
				.values({
					namaLengkap: plan.namaLengkap,
					email: plan.email,
					passwordHash: defaultHash,
					kelompokId: plan.kelompokId
				})
				.returning()
);
		} else {
			// Perbarui password dan nama jika sudah ada
			await db
				.update(users)
				.set({
					namaLengkap: plan.namaLengkap,
					passwordHash: defaultHash,
					kelompokId: plan.kelompokId
				})
				.where(eq(users.id, userRec.id));
		}

		// Set wewenang dapukan jika user memiliki scope admin
		if (plan.scope && plan.dapukanId) {
			const existingRole = (await first(db
				.select()
				.from(userDapukan)
				.where(eq(userDapukan.userId, userRec.id))
				));

			if (!existingRole) {
(await db.insert(userDapukan)
					.values({
						userId: userRec.id,
						dapukanId: plan.dapukanId,
						tingkatScope: plan.scope,
						daerahId: plan.daerahId,
						desaId: plan.desaId,
						kelompokId: plan.assignedKelompokId
					})
);
			} else {
(await db.update(userDapukan)
					.set({
						dapukanId: plan.dapukanId,
						tingkatScope: plan.scope,
						daerahId: plan.daerahId,
						desaId: plan.desaId,
						kelompokId: plan.assignedKelompokId
					})
					.where(eq(userDapukan.id, existingRole.id))
);
			}
		}

		console.log(`  👤 Akun siap: ${plan.email} (${plan.scope ? `Admin ${plan.scope}` : 'Jamaah'})`);
	}

	// Seed 4 Hak Wajib default (sebelumnya di auto-heal src/lib/db/index.ts)
	const wajibCount = await first(
		db.select({ val: count() }).from(posAnggaranInfaq).where(eq(posAnggaranInfaq.isWajib, true))
	);
	if (!wajibCount || Number(wajibCount.val) === 0) {
		const now = Date.now();
		await db
			.insert(posAnggaranInfaq)
			.values([
				{ id: 'hw_pusat', kode: 'HW-PUSAT', nama: 'Hak Pusat', deskripsi: 'Alokasi wajib rutin untuk tingkat Pusat', tingkatScope: 'Pusat', isWajib: true, tipeAlokasi: 'nominal', urutan: 1, isActive: true, createdAt: now, updatedAt: now },
				{ id: 'hw_daerah', kode: 'HW-DAERAH', nama: 'Hak Daerah', deskripsi: 'Alokasi wajib rutin untuk tingkat Daerah', tingkatScope: 'Daerah', isWajib: true, tipeAlokasi: 'nominal', urutan: 2, isActive: true, createdAt: now, updatedAt: now },
				{ id: 'hw_desa', kode: 'HW-DESA', nama: 'Hak Desa', deskripsi: 'Alokasi wajib rutin untuk tingkat Desa', tingkatScope: 'Desa', isWajib: true, tipeAlokasi: 'nominal', urutan: 3, isActive: true, createdAt: now, updatedAt: now },
				{ id: 'hw_kelompok', kode: 'HW-KELOMPOK', nama: 'Hak Kelompok', deskripsi: 'Alokasi wajib rutin untuk tingkat Kelompok', tingkatScope: 'Kelompok', isWajib: true, tipeAlokasi: 'nominal', urutan: 4, isActive: true, createdAt: now, updatedAt: now }
			])
			.onConflictDoNothing();
		console.log('  💰 4 Hak Wajib (Pusat, Daerah, Desa, Kelompok) siap.');
	}

	console.log('✅ Seeding database berhasil rampung!');
}

if (process.argv[1]?.endsWith('seed.ts') || process.argv[1]?.endsWith('seed.js')) {
	seed()
		.then(async () => {
			await client.end();
			process.exit(0);
		})
		.catch(async (err) => {
			console.error('❌ Gagal seeding:', err);
			await client.end();
			process.exit(1);
		});
}


