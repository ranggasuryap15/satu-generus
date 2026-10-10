/**
 * @file src/routes/(admin)/admin/presensi/[jadwalId]/scan/+page.server.ts
 * @purpose Memuat detail jadwal kegiatan untuk halaman scanner kamera presensi admin
 * @usedBy src/routes/(admin)/admin/presensi/[jadwalId]/scan/+page.svelte
 * @dependencies src/lib/db, src/lib/db/schema, drizzle-orm
 * @publicFunctions load
 * @sideEffects Query detail jadwal pengajian dari SQLite
 */

import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/db';
import { presensiJadwal, kelompok } from '$lib/db/schema';
import { eq } from 'drizzle-orm';

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!locals.user || !locals.isAdmin) {
		throw redirect(303, '/login');
	}

	const jadwalId = parseInt(params.jadwalId, 10);
	if (isNaN(jadwalId)) {
		throw error(400, 'ID jadwal tidak valid');
	}

	const jadwal = db.select().from(presensiJadwal).where(eq(presensiJadwal.id, jadwalId)).get();
	if (!jadwal) {
		throw error(404, 'Jadwal pengajian tidak ditemukan');
	}

	const kelompokData = jadwal.kelompokId
		? db.select().from(kelompok).where(eq(kelompok.id, jadwal.kelompokId)).get()
		: null;

	return {
		jadwal,
		kelompokNama: kelompokData?.nama || 'Kelompok'
	};
};
