/**
 * @file src/routes/(app)/sensus/+page.server.ts
 * @purpose Menampilkan status sensus keluarga pengguna saat ini dan daftar anggota keluarga
 * @usedBy src/routes/(app)/sensus/+page.svelte
 * @dependencies src/lib/db, src/lib/db/schema, src/lib/server/crypto
 * @publicFunctions load
 * @sideEffects Query data keluarga dan anggota keluarga dari SQLite dengan masking NIK/KK
 */

import { redirect, type ServerLoad } from '@sveltejs/kit';
import { db } from '$lib/db';
import { keluarga, anggotaKeluarga, users } from '$lib/db/schema';
import { eq } from 'drizzle-orm';
import { decryptSensitive, maskSensitive } from '$lib/server/crypto';

export const load: ServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(303, '/login?redirectTo=/sensus');
	}

	// Cari kartu keluarga di mana user adalah kepala keluarga atau anggota
	const keluargaRecord = db
		.select()
		.from(keluarga)
		.where(eq(keluarga.kepalaKeluargaId, locals.user.id))
		.get();

	if (!keluargaRecord) {
		return {
			hasKeluarga: false,
			keluarga: null,
			anggotaList: []
		};
	}

	// Dekripsi nomor KK untuk dimasking di tampilan
	let noKkMasked = '****';
	try {
		const decryptedKk = decryptSensitive(keluargaRecord.noKkEncrypted);
		noKkMasked = maskSensitive(decryptedKk);
	} catch (_) {}

	// Ambil daftar anggota keluarga
	const rawAnggota = db
		.select()
		.from(anggotaKeluarga)
		.where(eq(anggotaKeluarga.keluargaId, keluargaRecord.id))
		.all();

	const anggotaList = rawAnggota.map((a) => {
		let nikMasked = '****';
		try {
			const decNik = decryptSensitive(a.nikEncrypted);
			nikMasked = maskSensitive(decNik);
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
		hasKeluarga: true,
		keluarga: {
			id: keluargaRecord.id,
			noKkMasked,
			alamatLengkap: keluargaRecord.alamatLengkap
		},
		anggotaList
	};
};

