/**
 * @file src/routes/(admin)/admin/wilayah/+page.server.ts
 * @purpose Memuat hierarki wilayah administratif (Daerah, Desa, Kelompok) dan menangani penambahan wilayah baru
 * @usedBy src/routes/(admin)/admin/wilayah/+page.svelte
 * @dependencies src/lib/db, src/lib/db/schema, drizzle-orm
 * @publicFunctions load, actions.createKelompok, actions.createDesa
 * @sideEffects Insert data desa/kelompok ke SQLite, query join hierarki dengan agregasi jamaah
 */

import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/db';
import { daerah, desa, kelompok, users } from '$lib/db/schema';
import { eq, sql } from 'drizzle-orm';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user || !locals.isAdmin) {
		throw redirect(303, '/login');
	}

	// 1. Ambil seluruh data daerah
	const daerahList = db.select().from(daerah).all();

	// 2. Ambil seluruh data desa join nama daerah
	const desaList = db
		.select({
			id: desa.id,
			nama: desa.nama,
			kecamatan: desa.kecamatan,
			daerahId: desa.daerahId,
			daerahNama: daerah.nama
		})
		.from(desa)
		.leftJoin(daerah, eq(desa.daerahId, daerah.id))
		.all();

	// 3. Ambil seluruh kelompok join desa dan daerah beserta jumlah jamaah (minimum I/O)
	const kelompokList = db
		.select({
			id: kelompok.id,
			nama: kelompok.nama,
			kelurahan: kelompok.kelurahan,
			desaId: kelompok.desaId,
			desaNama: desa.nama,
			daerahNama: daerah.nama,
			totalJamaah: sql<number>`count(${users.id})`
		})
		.from(kelompok)
		.leftJoin(desa, eq(kelompok.desaId, desa.id))
		.leftJoin(daerah, eq(desa.daerahId, daerah.id))
		.leftJoin(users, eq(users.kelompokId, kelompok.id))
		.groupBy(kelompok.id)
		.all();

	return {
		daerahList,
		desaList,
		kelompokList
	};
};

export const actions: Actions = {
	createKelompok: async ({ request, locals }) => {
		if (!locals.user || !locals.isAdmin) {
			return fail(403, { error: 'Akses ditolak.' });
		}

		const formData = await request.formData();
		const nama = formData.get('nama')?.toString()?.trim() || '';
		const kelurahan = formData.get('kelurahan')?.toString()?.trim() || '';
		const desaIdStr = formData.get('desaId')?.toString() || '';
		const desaId = parseInt(desaIdStr, 10);

		if (!nama || isNaN(desaId)) {
			return fail(400, { error: 'Nama kelompok dan Desa induk wajib diisi.' });
		}

		try {
			db.insert(kelompok)
				.values({
					desaId,
					nama,
					kelurahan: kelurahan || null
				})
				.run();
		} catch (error) {
			console.error('Gagal membuat kelompok:', error);
			return fail(500, { error: 'Terjadi kesalahan sistem saat menyimpan kelompok.' });
		}

		return { success: true };
	},

	createDesa: async ({ request, locals }) => {
		if (!locals.user || !locals.isAdmin) {
			return fail(403, { error: 'Akses ditolak.' });
		}

		const formData = await request.formData();
		const nama = formData.get('nama')?.toString()?.trim() || '';
		const kecamatan = formData.get('kecamatan')?.toString()?.trim() || '';
		const daerahIdStr = formData.get('daerahId')?.toString() || '';
		const daerahId = parseInt(daerahIdStr, 10);

		if (!nama || isNaN(daerahId)) {
			return fail(400, { error: 'Nama desa dan Daerah induk wajib diisi.' });
		}

		try {
			db.insert(desa)
				.values({
					daerahId,
					nama,
					kecamatan: kecamatan || null
				})
				.run();
		} catch (error) {
			console.error('Gagal membuat desa:', error);
			return fail(500, { error: 'Terjadi kesalahan sistem saat menyimpan desa.' });
		}

		return { success: true };
	}
};

