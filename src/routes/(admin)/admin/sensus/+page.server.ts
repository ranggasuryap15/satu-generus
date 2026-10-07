/**
 * @file src/routes/(admin)/admin/sensus/+page.server.ts
 * @purpose Memuat seluruh rekapitulasi data sensus Kartu Keluarga untuk admin
 * @usedBy src/routes/(admin)/admin/sensus/+page.svelte
 * @dependencies src/lib/db, src/lib/db/schema, src/lib/server/crypto
 * @publicFunctions load
 * @sideEffects Query list keluarga dan anggota keluarga dengan masking NIK/KK default
 */

import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/db';
import { keluarga, anggotaKeluarga, users } from '$lib/db/schema';
import { eq } from 'drizzle-orm';
import { decryptSensitive, maskSensitive } from '$lib/server/crypto';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user || !locals.isAdmin) {
		throw redirect(303, '/login');
	}

	// Query data keluarga join users (kepala keluarga)
	const rawKeluargaList = db
		.select({
			id: keluarga.id,
			noKkEncrypted: keluarga.noKkEncrypted,
			alamatLengkap: keluarga.alamatLengkap,
			kepalaKeluargaNama: users.namaLengkap
		})
		.from(keluarga)
		.leftJoin(users, eq(keluarga.kepalaKeluargaId, users.id))
		.all();

	// Ambil semua anggota keluarga
	const rawAnggotaList = db.select().from(anggotaKeluarga).all();

	const daftarKeluarga = rawKeluargaList.map((k) => {
		let noKkMasked = '****';
		try {
			noKkMasked = maskSensitive(decryptSensitive(k.noKkEncrypted));
		} catch (_) {}

		const anggotaTerkait = rawAnggotaList
			.filter((a) => a.keluargaId === k.id)
			.map((a) => {
				let nikMasked = '****';
				try {
					nikMasked = maskSensitive(decryptSensitive(a.nikEncrypted));
				} catch (_) {}

				return {
					id: a.id,
					nikMasked,
					statusHubungan: a.statusHubungan,
					tanggalLahir: a.tanggalLahir,
					jenisKelamin: a.jenisKelamin
				};
			});

		return {
			id: k.id,
			noKkMasked,
			alamatLengkap: k.alamatLengkap || '-',
			kepalaKeluargaNama: k.kepalaKeluargaNama || 'Belum ditautkan',
			jumlahAnggota: anggotaTerkait.length,
			anggota: anggotaTerkait
		};
	});

	return {
		daftarKeluarga
	};
};
