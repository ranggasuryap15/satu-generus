/**
 * @file src/routes/(admin)/admin/presensi/[jadwalId]/scan/+page.server.ts
 * @purpose Memuat detail jadwal kegiatan (kelompok maupun desa) untuk halaman scanner kamera presensi admin
 * @usedBy src/routes/(admin)/admin/presensi/[jadwalId]/scan/+page.svelte
 * @dependencies src/lib/db, src/lib/db/schema, drizzle-orm
 * @publicFunctions load
 * @sideEffects Query detail jadwal pengajian dan data wilayah kelompok/desa dari PostgreSQL
 */

import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db, first } from '#lib/db/index.js';
import { presensiJadwal, kelompok, desa } from '#lib/db/schema.js';
import { eq } from 'drizzle-orm';

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!locals.user || !locals.isAdmin) {
		throw redirect(303, '/login');
	}

	const jadwalId = parseInt(params.jadwalId, 10);
	if (isNaN(jadwalId)) {
		throw error(400, 'ID jadwal tidak valid');
	}

	const jadwal = (await first(db.select().from(presensiJadwal).where(eq(presensiJadwal.id, jadwalId))));
	if (!jadwal) {
		throw error(404, 'Jadwal pengajian tidak ditemukan');
	}

	let wilayahNama = 'Wilayah';
	if (jadwal.tingkatScope === 'Desa' && jadwal.desaId) {
		const desaData = await first(db.select().from(desa).where(eq(desa.id, jadwal.desaId)));
		wilayahNama = desaData?.nama || 'Desa';
	} else if (jadwal.kelompokId) {
		const kelompokData = await first(db.select().from(kelompok).where(eq(kelompok.id, jadwal.kelompokId)));
		wilayahNama = kelompokData?.nama || 'Kelompok';
	}

	return {
		jadwal,
		kelompokNama: wilayahNama
	};
};
