/**
 * @file src/routes/(admin)/admin/wilayah/+page.server.ts
 * @purpose Memuat data wilayah administratif (Daerah, Desa, Kelompok, Sub-Kelompok) dan menangani aksi pembuatan unit wilayah baru
 * @usedBy src/routes/(admin)/admin/wilayah/+page.svelte
 * @dependencies src/lib/db, src/lib/db/schema, drizzle-orm
 * @publicFunctions load, actions.createDaerah, actions.createDesa, actions.createKelompok, actions.createSubKelompok, actions.updateKelompokLocation
 * @sideEffects Insert data daerah/desa/kelompok/sub_kelompok dan update lokasi kelompok ke SQLite, query agregasi jumlah jamaah dan sub-kelompok
 */

import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/db';
import { daerah, desa, kelompok, subKelompok } from '$lib/db/schema';
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

	// 3. Ambil seluruh kelompok join desa dan daerah dengan agregasi terindeks (minimum I/O, no Cartesian product)
	const kelompokList = db
		.select({
			id: kelompok.id,
			nama: kelompok.nama,
			kelurahan: kelompok.kelurahan,
			lokasiNama: kelompok.lokasiNama,
			latitude: kelompok.latitude,
			longitude: kelompok.longitude,
			radiusMeter: kelompok.radiusMeter,
			gmapsUrl: kelompok.gmapsUrl,
			desaId: kelompok.desaId,
			desaNama: desa.nama,
			daerahNama: daerah.nama,
			totalJamaah: sql<number>`(SELECT count(*) FROM users WHERE users.kelompok_id = ${kelompok.id})`,
			totalSubKelompok: sql<number>`(SELECT count(*) FROM sub_kelompok WHERE sub_kelompok.kelompok_id = ${kelompok.id})`
		})
		.from(kelompok)
		.leftJoin(desa, eq(kelompok.desaId, desa.id))
		.leftJoin(daerah, eq(desa.daerahId, daerah.id))
		.all();

	// 4. Ambil seluruh sub-kelompok join kelompok, desa, daerah
	const subKelompokList = db
		.select({
			id: subKelompok.id,
			nama: subKelompok.nama,
			keterangan: subKelompok.keterangan,
			kelompokId: subKelompok.kelompokId,
			kelompokNama: kelompok.nama,
			desaNama: desa.nama,
			daerahNama: daerah.nama
		})
		.from(subKelompok)
		.leftJoin(kelompok, eq(subKelompok.kelompokId, kelompok.id))
		.leftJoin(desa, eq(kelompok.desaId, desa.id))
		.leftJoin(daerah, eq(desa.daerahId, daerah.id))
		.all();

	return {
		daerahList,
		desaList,
		kelompokList,
		subKelompokList
	};
};

export const actions: Actions = {
	createDaerah: async ({ request, locals }) => {
		if (!locals.user || !locals.isAdmin) {
			return fail(403, { error: 'Akses ditolak.' });
		}

		const formData = await request.formData();
		const nama = formData.get('nama')?.toString()?.trim() || '';
		const provinsi = formData.get('provinsi')?.toString()?.trim() || '';
		const kotaKabupaten = formData.get('kotaKabupaten')?.toString()?.trim() || '';

		if (!nama || !provinsi || !kotaKabupaten) {
			return fail(400, { error: 'Nama daerah, Provinsi, dan Kota/Kabupaten wajib diisi.' });
		}

		try {
			db.insert(daerah)
				.values({
					nama,
					provinsi,
					kotaKabupaten
				})
				.run();
		} catch (error) {
			console.error('Gagal membuat daerah:', error);
			return fail(500, { error: 'Terjadi kesalahan sistem saat menyimpan daerah.' });
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
	},

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

	createSubKelompok: async ({ request, locals }) => {
		if (!locals.user || !locals.isAdmin) {
			return fail(403, { error: 'Akses ditolak.' });
		}

		const formData = await request.formData();
		const nama = formData.get('nama')?.toString()?.trim() || '';
		const keterangan = formData.get('keterangan')?.toString()?.trim() || '';
		const kelompokIdStr = formData.get('kelompokId')?.toString() || '';
		const kelompokId = parseInt(kelompokIdStr, 10);

		if (!nama || isNaN(kelompokId)) {
			return fail(400, { error: 'Nama sub-kelompok dan Kelompok induk wajib diisi.' });
		}

		try {
			db.insert(subKelompok)
				.values({
					kelompokId,
					nama,
					keterangan: keterangan || null
				})
				.run();
		} catch (error) {
			console.error('Gagal membuat sub-kelompok:', error);
			return fail(500, { error: 'Terjadi kesalahan sistem saat menyimpan sub-kelompok.' });
		}

		return { success: true };
	},

	updateKelompokLocation: async ({ request, locals }) => {
		if (!locals.user || !locals.isAdmin) {
			return fail(403, { error: 'Akses ditolak.' });
		}

		const formData = await request.formData();
		const kelompokId = parseInt(formData.get('kelompokId')?.toString() || '0', 10);
		const lokasiNama = formData.get('lokasiNama')?.toString()?.trim() || null;
		const latitude = formData.get('latitude')?.toString()?.trim() || null;
		const longitude = formData.get('longitude')?.toString()?.trim() || null;
		const radiusMeterRaw = parseInt(formData.get('radiusMeter')?.toString() || '100', 10);
		const radiusMeter = isNaN(radiusMeterRaw) ? 100 : radiusMeterRaw;
		const gmapsUrl = formData.get('gmapsUrl')?.toString()?.trim() || null;

		if (!kelompokId) {
			return fail(400, { error: 'ID Kelompok tidak valid.' });
		}

		try {
			db.update(kelompok)
				.set({
					lokasiNama,
					latitude,
					longitude,
					radiusMeter,
					gmapsUrl
				})
				.where(eq(kelompok.id, kelompokId))
				.run();

			return { success: true, message: 'Data lokasi kelompok berhasil disimpan.' };
		} catch (error: any) {
			console.error('Gagal memperbarui lokasi kelompok:', error);
			return fail(500, { error: `Terjadi kesalahan sistem: ${error.message}` });
		}
	}
};
