/**
 * @file src/routes/(admin)/admin/dapukan/+page.server.ts
 * @purpose Memuat daftar struktur dapukan/jabatan dan penugasan RBAC pengurus serta menangani mutasi pengurus
 * @usedBy src/routes/(admin)/admin/dapukan/+page.svelte
 * @dependencies src/lib/db, src/lib/db/schema, drizzle-orm
 * @publicFunctions load, actions.assignDapukan, actions.removeDapukan
 * @sideEffects Insert/Delete pada user_dapukan, query join multi-tabel users, dapukan, wilayah
 */

import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/db';
import { dapukan, userDapukan, users, daerah, desa, kelompok } from '$lib/db/schema';
import { eq, desc } from 'drizzle-orm';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user || !locals.isAdmin) {
		throw redirect(303, '/login');
	}

	// 1. Master Dapukan Tetap
	const masterDapukan = db.select().from(dapukan).all();

	// 2. Daftar Penugasan Pengurus Aktif join Users, Dapukan, dan Wilayah
	const daftarPengurus = db
		.select({
			id: userDapukan.id,
			userId: userDapukan.userId,
			userNama: users.namaLengkap,
			userEmail: users.email,
			dapukanId: userDapukan.dapukanId,
			dapukanNama: dapukan.namaDapukan,
			is4S: dapukan.is4S,
			namaDapukanCustom: userDapukan.namaDapukanCustom,
			tingkatScope: userDapukan.tingkatScope,
			daerahNama: daerah.nama,
			desaNama: desa.nama,
			kelompokNama: kelompok.nama
		})
		.from(userDapukan)
		.leftJoin(users, eq(userDapukan.userId, users.id))
		.leftJoin(dapukan, eq(userDapukan.dapukanId, dapukan.id))
		.leftJoin(daerah, eq(userDapukan.daerahId, daerah.id))
		.leftJoin(desa, eq(userDapukan.desaId, desa.id))
		.leftJoin(kelompok, eq(userDapukan.kelompokId, kelompok.id))
		.orderBy(desc(userDapukan.id))
		.all();

	// 3. Opsi Users Jamaah untuk pilihan penugasan
	const userList = db
		.select({
			id: users.id,
			namaLengkap: users.namaLengkap,
			email: users.email
		})
		.from(users)
		.all();

	// 4. Opsi Wilayah
	const daerahList = db.select().from(daerah).all();
	const desaList = db.select().from(desa).all();
	const kelompokList = db.select().from(kelompok).all();

	return {
		masterDapukan,
		daftarPengurus,
		userList,
		daerahList,
		desaList,
		kelompokList
	};
};

export const actions: Actions = {
	assignDapukan: async ({ request, locals }) => {
		if (!locals.user || !locals.isAdmin) {
			return fail(403, { error: 'Akses ditolak.' });
		}

		const formData = await request.formData();
		const userId = formData.get('userId')?.toString()?.trim() || '';
		const tipeJabatan = formData.get('tipeJabatan')?.toString() || 'tetap'; // 'tetap' | 'custom'
		const dapukanIdStr = formData.get('dapukanId')?.toString() || '';
		const namaDapukanCustom = formData.get('namaDapukanCustom')?.toString()?.trim() || null;
		const tingkatScope = formData.get('tingkatScope')?.toString() || 'Kelompok';

		const daerahIdStr = formData.get('daerahId')?.toString() || '';
		const desaIdStr = formData.get('desaId')?.toString() || '';
		const kelompokIdStr = formData.get('kelompokId')?.toString() || '';

		if (!userId) {
			return fail(400, { error: 'Pilih jamaah yang akan ditugaskan.' });
		}

		const dapukanId = tipeJabatan === 'tetap' && dapukanIdStr ? parseInt(dapukanIdStr, 10) : null;
		const daerahId = daerahIdStr ? parseInt(daerahIdStr, 10) : null;
		const desaId = desaIdStr ? parseInt(desaIdStr, 10) : null;
		const kelompokId = kelompokIdStr ? parseInt(kelompokIdStr, 10) : null;

		if (tipeJabatan === 'tetap' && !dapukanId) {
			return fail(400, { error: 'Pilih jabatan tetap master data.' });
		}
		if (tipeJabatan === 'custom' && !namaDapukanCustom) {
			return fail(400, { error: 'Tulis nama jabatan tentatif / kepanitiaan kustom.' });
		}

		try {
			db.insert(userDapukan)
				.values({
					userId,
					dapukanId,
					namaDapukanCustom: tipeJabatan === 'custom' ? namaDapukanCustom : null,
					tingkatScope,
					daerahId,
					desaId,
					kelompokId
				})
				.run();
		} catch (error) {
			console.error('Gagal menugaskan dapukan:', error);
			return fail(500, { error: 'Terjadi kesalahan sistem saat menyimpan penugasan pengurus.' });
		}

		return { success: true };
	},

	removeDapukan: async ({ request, locals }) => {
		if (!locals.user || !locals.isAdmin) {
			return fail(403, { error: 'Akses ditolak.' });
		}

		const formData = await request.formData();
		const id = formData.get('id')?.toString()?.trim() || '';

		if (!id) {
			return fail(400, { error: 'ID penugasan tidak valid.' });
		}

		try {
			db.delete(userDapukan).where(eq(userDapukan.id, id)).run();
		} catch (error) {
			console.error('Gagal mencabut penugasan:', error);
			return fail(500, { error: 'Gagal mencabut penugasan pengurus.' });
		}

		return { success: true };
	}
};

