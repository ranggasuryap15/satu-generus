/**
 * @file src/routes/(app)/+page.server.ts
 * @purpose Memuat informasi ringkasan jamaah, kelompok, desa, dan jadwal pengajian terdekat (Kelompok & Desa)
 * @usedBy src/routes/(app)/+page.svelte
 * @dependencies src/lib/db, src/lib/db/schema, drizzle-orm
 * @publicFunctions load
 * @sideEffects Query kelompok, desa, dan jadwal pengajian terbaru dari SQLite
 */

import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/db';
import { desa, kelompok, presensiJadwal } from '$lib/db/schema';
import { eq, desc, and } from 'drizzle-orm';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(303, '/login');
	}

	let kelompokNama = 'Kelompok Jamaah';
	let desaId: number | null = null;
	let desaNama = 'Desa Jamaah';

	if (locals.user.kelompokId) {
		const kel = db
			.select({
				id: kelompok.id,
				nama: kelompok.nama,
				desaId: kelompok.desaId,
				desaNama: desa.nama
			})
			.from(kelompok)
			.leftJoin(desa, eq(kelompok.desaId, desa.id))
			.where(eq(kelompok.id, locals.user.kelompokId))
			.get();

		if (kel) {
			kelompokNama = kel.nama;
			desaId = kel.desaId;
			if (kel.desaNama) desaNama = kel.desaNama;
		}
	}

	// Jadwal pengajian kelompok jamaah terbaru
	const upcomingJadwalKelompok = locals.user.kelompokId
		? db
				.select()
				.from(presensiJadwal)
				.where(
					and(
						eq(presensiJadwal.kelompokId, locals.user.kelompokId),
						eq(presensiJadwal.tingkatScope, 'Kelompok')
					)
				)
				.orderBy(desc(presensiJadwal.tanggal))
				.limit(4)
				.all()
		: [];

	// Jadwal pengajian tingkat desa jamaah terbaru
	const upcomingJadwalDesa = desaId
		? db
				.select()
				.from(presensiJadwal)
				.where(
					and(
						eq(presensiJadwal.desaId, desaId),
						eq(presensiJadwal.tingkatScope, 'Desa')
					)
				)
				.orderBy(desc(presensiJadwal.tanggal))
				.limit(4)
				.all()
		: [];

	return {
		user: locals.user,
		kelompokNama,
		desaNama,
		upcomingJadwalKelompok,
		upcomingJadwalDesa
	};
};

