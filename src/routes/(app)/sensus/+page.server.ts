/**
 * @file src/routes/(app)/sensus/+page.server.ts
 * @purpose Menampilkan status sensus keluarga/mandiri dan memproses server actions untuk edit data kependudukan dan anggota (No KK dan NIK opsional/nullable)
 * @usedBy src/routes/(app)/sensus/+page.svelte
 * @dependencies src/lib/db, src/lib/db/schema, src/lib/server/crypto, src/lib/utils (normalizeDateToISO), drizzle-orm
 * @publicFunctions load, actions.updateKeluarga, actions.updateAnggota, actions.tambahAnggota, actions.hapusAnggota
 * @sideEffects Mengambil & memperbarui record keluarga dan anggotaKeluarga di SQLite dengan enkripsi AES-256-GCM
 */

import { fail, redirect, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/db';
import { keluarga, anggotaKeluarga } from '$lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { decryptSensitive, encryptSensitive, maskSensitive } from '$lib/server/crypto';
import { normalizeDateToISO } from '$lib/utils';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(303, '/login?redirectTo=/sensus');
	}

	// Cari kartu keluarga di mana user adalah kepala keluarga
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

	const isKk = keluargaRecord.isKk ?? true;

	// Dekripsi nomor KK untuk dimasking di tampilan
	let noKkMasked = 'Tanpa KK (Perantau)';
	if (isKk) {
		if (keluargaRecord.noKkEncrypted) {
			try {
				const decryptedKk = decryptSensitive(keluargaRecord.noKkEncrypted);
				noKkMasked = maskSensitive(decryptedKk);
			} catch (_) {
				noKkMasked = '****';
			}
		} else {
			noKkMasked = 'Belum Ada No. KK';
		}
	}

	// Ambil daftar anggota keluarga
	const rawAnggota = db
		.select()
		.from(anggotaKeluarga)
		.where(eq(anggotaKeluarga.keluargaId, keluargaRecord.id))
		.all();

	const anggotaList = rawAnggota.map((a) => {
		let nikMasked = 'Belum Ada NIK';
		const hasNik = !!a.nikEncrypted;
		if (hasNik) {
			try {
				const decNik = decryptSensitive(a.nikEncrypted!);
				nikMasked = maskSensitive(decNik);
			} catch (_) {
				nikMasked = '****';
			}
		}

		return {
			id: a.id,
			namaLengkap:
				a.namaLengkap ||
				(a.statusHubungan === 'Kepala Keluarga' ? (locals.user?.namaLengkap || 'Kepala Keluarga') : a.statusHubungan),
			nikMasked,
			hasNik,
			statusHubungan: a.statusHubungan,
			tanggalLahir: a.tanggalLahir,
			jenisKelamin: a.jenisKelamin
		};
	});

	return {
		hasKeluarga: true,
		keluarga: {
			id: keluargaRecord.id,
			isKk,
			noKkMasked,
			alamatLengkap: keluargaRecord.alamatLengkap
		},
		anggotaList
	};
};

export const actions: Actions = {
	updateKeluarga: async ({ request, locals }) => {
		if (!locals.user) {
			throw redirect(303, '/login');
		}

		const formData = await request.formData();
		const keluargaId = formData.get('keluargaId')?.toString() || '';
		const noKk = formData.get('noKk')?.toString()?.trim() || '';
		const alamatLengkap = formData.get('alamatLengkap')?.toString()?.trim() || '';

		if (!keluargaId) {
			return fail(400, { errorKeluarga: 'ID keluarga tidak ditemukan.' });
		}

		// Validasi kepemilikan KK oleh user saat ini
		const currentKeluarga = db
			.select()
			.from(keluarga)
			.where(and(eq(keluarga.id, keluargaId), eq(keluarga.kepalaKeluargaId, locals.user.id)))
			.get();

		if (!currentKeluarga) {
			return fail(403, { errorKeluarga: 'Anda tidak memiliki hak akses untuk mengubah data ini.' });
		}

		if (!alamatLengkap) {
			return fail(400, { errorKeluarga: 'Alamat lengkap wajib diisi.' });
		}

		const updatePayload: { alamatLengkap: string; noKkEncrypted?: string | null } = {
			alamatLengkap
		};

		// Jika input noKk diisi baru, validasi 16 digit dan enkripsi, jika dikosongkan set null
		if (noKk) {
			if (noKk.length !== 16 || !/^\d+$/.test(noKk)) {
				return fail(400, {
					errorKeluarga: 'Nomor Kartu Keluarga harus 16 digit angka jika diisi.'
				});
			}
			updatePayload.noKkEncrypted = encryptSensitive(noKk);
		} else {
			updatePayload.noKkEncrypted = null;
		}

		try {
			db.update(keluarga)
				.set(updatePayload)
				.where(eq(keluarga.id, keluargaId))
				.run();
		} catch (error) {
			console.error('Gagal memperbarui Kartu Keluarga:', error);
			return fail(500, { errorKeluarga: 'Terjadi kesalahan sistem saat memperbarui data KK.' });
		}

		return { successKeluarga: 'Data Kartu Keluarga berhasil diperbarui.' };
	},

	updateAnggota: async ({ request, locals }) => {
		if (!locals.user) {
			throw redirect(303, '/login');
		}

		const formData = await request.formData();
		const anggotaId = formData.get('anggotaId')?.toString() || '';
		const namaLengkap = formData.get('namaLengkap')?.toString()?.trim() || '';
		const nik = formData.get('nik')?.toString()?.trim() || '';
		const statusHubungan = formData.get('statusHubungan')?.toString()?.trim() || '';
		const tanggalLahir = formData.get('tanggalLahir')?.toString()?.trim() || '';
		const jenisKelamin = formData.get('jenisKelamin')?.toString()?.trim() || '';

		if (!anggotaId) {
			return fail(400, { errorAnggota: 'ID anggota keluarga tidak ditemukan.' });
		}

		// Pastikan anggota keluarga ini berada di dalam KK milik user
		const verifiedAnggota = db
			.select({ id: anggotaKeluarga.id })
			.from(anggotaKeluarga)
			.innerJoin(keluarga, eq(anggotaKeluarga.keluargaId, keluarga.id))
			.where(and(eq(anggotaKeluarga.id, anggotaId), eq(keluarga.kepalaKeluargaId, locals.user.id)))
			.get();

		if (!verifiedAnggota) {
			return fail(403, { errorAnggota: 'Anda tidak memiliki hak akses mengubah anggota ini.' });
		}

		if (!statusHubungan || !tanggalLahir || !jenisKelamin) {
			return fail(400, { errorAnggota: 'Semua kolom status, tanggal lahir, dan jenis kelamin wajib diisi.' });
		}

		const updatePayload: {
			namaLengkap?: string;
			statusHubungan: string;
			tanggalLahir: string;
			jenisKelamin: string;
			nikEncrypted?: string | null;
		} = {
			statusHubungan,
			tanggalLahir: normalizeDateToISO(tanggalLahir),
			jenisKelamin
		};

		if (namaLengkap) {
			updatePayload.namaLengkap = namaLengkap;
		}

		// Jika NIK diisi, validasi 16 digit angka dan enkripsi, jika dikosongkan set null
		if (nik) {
			if (nik.length !== 16 || !/^\d+$/.test(nik)) {
				return fail(400, { errorAnggota: 'NIK harus 16 digit angka jika diisi.' });
			}
			updatePayload.nikEncrypted = encryptSensitive(nik);
		} else {
			updatePayload.nikEncrypted = null;
		}

		try {
			db.update(anggotaKeluarga)
				.set(updatePayload)
				.where(eq(anggotaKeluarga.id, anggotaId))
				.run();
		} catch (error) {
			console.error('Gagal memperbarui data anggota keluarga:', error);
			return fail(500, { errorAnggota: 'Terjadi kesalahan sistem saat memperbarui anggota.' });
		}

		return { successAnggota: 'Data anggota keluarga berhasil diperbarui.' };
	},

	tambahAnggota: async ({ request, locals }) => {
		if (!locals.user) {
			throw redirect(303, '/login');
		}

		const formData = await request.formData();
		const keluargaId = formData.get('keluargaId')?.toString() || '';
		const namaLengkap = formData.get('namaLengkap')?.toString()?.trim() || '';
		const nik = formData.get('nik')?.toString()?.trim() || '';
		const statusHubungan = formData.get('statusHubungan')?.toString()?.trim() || '';
		const tanggalLahir = formData.get('tanggalLahir')?.toString()?.trim() || '';
		const jenisKelamin = formData.get('jenisKelamin')?.toString()?.trim() || '';

		if (!keluargaId) {
			return fail(400, { errorTambahAnggota: 'ID keluarga tidak ditemukan.' });
		}

		// Validasi kepemilikan KK
		const ownedKeluarga = db
			.select({ id: keluarga.id })
			.from(keluarga)
			.where(and(eq(keluarga.id, keluargaId), eq(keluarga.kepalaKeluargaId, locals.user.id)))
			.get();

		if (!ownedKeluarga) {
			return fail(403, { errorTambahAnggota: 'Akses ditolak.' });
		}

		if (!namaLengkap) {
			return fail(400, { errorTambahAnggota: 'Nama lengkap wajib diisi.' });
		}

		if (nik) {
			if (nik.length !== 16 || !/^\d+$/.test(nik)) {
				return fail(400, { errorTambahAnggota: 'NIK harus 16 digit angka jika diisi.' });
			}
		}

		if (!statusHubungan || !tanggalLahir || !jenisKelamin) {
			return fail(400, { errorTambahAnggota: 'Status hubungan, tanggal lahir, dan jenis kelamin wajib diisi.' });
		}

		try {
			db.insert(anggotaKeluarga)
				.values({
					keluargaId,
					namaLengkap,
					nikEncrypted: nik ? encryptSensitive(nik) : null,
					statusHubungan,
					tanggalLahir: normalizeDateToISO(tanggalLahir),
					jenisKelamin
				})
				.run();
		} catch (error) {
			console.error('Gagal menambahkan anggota keluarga:', error);
			return fail(500, { errorTambahAnggota: 'Terjadi kesalahan sistem saat menambah anggota.' });
		}

		return { successTambahAnggota: 'Anggota keluarga baru berhasil ditambahkan.' };
	},

	hapusAnggota: async ({ request, locals }) => {
		if (!locals.user) {
			throw redirect(303, '/login');
		}

		const formData = await request.formData();
		const anggotaId = formData.get('anggotaId')?.toString() || '';

		if (!anggotaId) {
			return fail(400, { errorHapusAnggota: 'ID anggota tidak valid.' });
		}

		// Cek kepemilikan
		const target = db
			.select({ id: anggotaKeluarga.id, keluargaId: anggotaKeluarga.keluargaId })
			.from(anggotaKeluarga)
			.innerJoin(keluarga, eq(anggotaKeluarga.keluargaId, keluarga.id))
			.where(and(eq(anggotaKeluarga.id, anggotaId), eq(keluarga.kepalaKeluargaId, locals.user.id)))
			.get();

		if (!target) {
			return fail(403, { errorHapusAnggota: 'Akses ditolak.' });
		}

		// Pastikan tidak menghapus jika tersisa 1 anggota
		const totalAnggota = db
			.select({ id: anggotaKeluarga.id })
			.from(anggotaKeluarga)
			.where(eq(anggotaKeluarga.keluargaId, target.keluargaId))
			.all();

		if (totalAnggota.length <= 1) {
			return fail(400, { errorHapusAnggota: 'Tidak dapat menghapus anggota terakhir di Kartu Keluarga.' });
		}

		try {
			db.delete(anggotaKeluarga).where(eq(anggotaKeluarga.id, anggotaId)).run();
		} catch (error) {
			console.error('Gagal menghapus anggota keluarga:', error);
			return fail(500, { errorHapusAnggota: 'Terjadi kesalahan sistem saat menghapus anggota.' });
		}

		return { successHapusAnggota: 'Anggota keluarga berhasil dihapus.' };
	}
};


