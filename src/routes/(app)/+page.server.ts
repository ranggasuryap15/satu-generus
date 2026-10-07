/**
 * @file src/routes/(app)/+page.server.ts
 * @purpose Memuat informasi ringkasan jamaah, kelompok, dan jadwal pengajian terdekat
 * @usedBy src/routes/(app)/+page.svelte
 * @dependencies src/lib/db, src/lib/db/schema, drizzle-orm
 * @publicFunctions load
 * @sideEffects Query kelompok dan jadwal pengajian terbaru dari SQLite
 */

import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/db';
import { kelompok, presensiJadwal } from '$lib/db/schema';
import { eq, desc } from 'drizzle-orm';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(303, '/login');
	}

	let kelompokNama = 'Kelompok Jamaah';
	if (locals.user.kelompokId) {
		const kel = db.select().from(kelompok).where(eq(kelompok.id, locals.user.kelompokId)).get();
		if (kel) kelompokNama = kel.nama;
	}

	// Jadwal kegiatan pengajian kelompok jamaah terbaru
	const upcomingJadwal = locals.user.kelompokId
		? db
				.select()
				.from(presensiJadwal)
				.where(eq(presensiJadwal.kelompokId, locals.user.kelompokId))
				.orderBy(desc(presensiJadwal.tanggal))
				.limit(3)
				.all()
		: [];

	return {
		user: locals.user,
		kelompokNama,
		upcomingJadwal
	};
};

