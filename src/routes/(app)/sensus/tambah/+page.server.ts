/**
 * @file src/routes/(app)/sensus/tambah/+page.server.ts
 * @purpose Form action pemrosesan pendaftaran sensus KK dan anggota keluarga dengan enkripsi AES-256-GCM
 * @usedBy Wizard form sensus pada src/routes/(app)/sensus/tambah/+page.svelte
 * @dependencies src/lib/db, src/lib/db/schema, src/lib/server/crypto
 * @publicFunctions load, actions.default
 * @sideEffects Menulis record terenkripsi ke tabel keluarga dan anggota_keluarga dalam satu transaksi SQLite
 */

import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/db';
import { keluarga, anggotaKeluarga } from '$lib/db/schema';
import { encryptSensitive } from '$lib/server/crypto';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(303, '/login?redirectTo=/sensus/tambah');
	}
	return {
		user: locals.user
	};
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		if (!locals.user) {
			throw redirect(303, '/login');
		}

		const formData = await request.formData();
		const noKk = formData.get('noKk')?.toString()?.trim() || '';
		const alamatLengkap = formData.get('alamatLengkap')?.toString()?.trim() || '';
		const anggotaJson = formData.get('anggotaData')?.toString() || '[]';

		// Validasi Nomor KK
		if (!noKk || noKk.length !== 16 || !/^\d+$/.test(noKk)) {
			return fail(400, {
				error: 'Nomor Kartu Keluarga wajib 16 digit angka.',
				noKk,
				alamatLengkap
			});
		}

		let anggotaList: Array<{
			nik: string;
			statusHubungan: string;
			tanggalLahir: string;
			jenisKelamin: string;
		}> = [];

		try {
			anggotaList = JSON.parse(anggotaJson);
		} catch (_) {
			return fail(400, {
				error: 'Format data anggota keluarga tidak valid.',
				noKk,
				alamatLengkap
			});
		}

		if (!Array.isArray(anggotaList) || anggotaList.length === 0) {
			return fail(400, {
				error: 'Minimal 1 anggota keluarga wajib didaftarkan.',
				noKk,
				alamatLengkap
			});
		}

		// Validasi setiap anggota
		for (let i = 0; i < anggotaList.length; i++) {
			const a = anggotaList[i];
			if (!a.nik || a.nik.length !== 16 || !/^\d+$/.test(a.nik)) {
				return fail(400, {
					error: `NIK anggota ke-${i + 1} wajib 16 digit angka.`,
					noKk,
					alamatLengkap
				});
			}
			if (!a.statusHubungan || !a.tanggalLahir || !a.jenisKelamin) {
				return fail(400, {
					error: `Data anggota ke-${i + 1} belum lengkap.`,
					noKk,
					alamatLengkap
				});
			}
		}

		// Eksekusi enkripsi data sensitif (Zero Plaintext di DB)
		const noKkEncrypted = encryptSensitive(noKk);

		// Transaksi database: Minimum Lock & Atomicity
		try {
			db.transaction((tx) => {
				const [newKeluarga] = tx
					.insert(keluarga)
					.values({
						noKkEncrypted,
						kepalaKeluargaId: locals.user?.id,
						alamatLengkap
					})
					.returning()
					.all();

				for (const a of anggotaList) {
					tx.insert(anggotaKeluarga)
						.values({
							keluargaId: newKeluarga.id,
							nikEncrypted: encryptSensitive(a.nik),
							statusHubungan: a.statusHubungan,
							tanggalLahir: a.tanggalLahir,
							jenisKelamin: a.jenisKelamin
						})
						.run();
				}
			});
		} catch (error) {
			console.error('Gagal menyimpan sensus keluarga:', error);
			return fail(500, {
				error: 'Terjadi kesalahan sistem saat menyimpan data sensus.',
				noKk,
				alamatLengkap
			});
		}

		throw redirect(303, '/sensus');
	}
};
