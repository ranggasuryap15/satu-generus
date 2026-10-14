/**
 * @file src/routes/(app)/+page.server.ts
 * @purpose Memuat informasi ringkasan jamaah, kelompok, desa, status kepemilikan KK, dan jadwal pengajian terdekat (Kelompok & Desa)
 * @usedBy src/routes/(app)/+page.svelte
 * @dependencies src/lib/db, src/lib/db/schema, src/lib/server/sensus (getKeluargaForUser), drizzle-orm
 * @publicFunctions load
 * @sideEffects Query kelompok, desa, status keluarga, dan jadwal pengajian terbaru dari SQLite
 */

import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db, first } from '#lib/db/index.js';
import { desa, kelompok, presensiJadwal } from '#lib/db/schema.js';
import { eq, desc, and } from 'drizzle-orm';
import { getKeluargaForUser } from '#lib/server/sensus.js';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(303, '/login');
	}

	let kelompokNama = 'Kelompok Jamaah';
	let desaId: number | null = null;
	let desaNama = 'Desa Jamaah';

	if (locals.user.kelompokId) {
		const kel = (await first(db
			.select({
				id: kelompok.id,
				nama: kelompok.nama,
				desaId: kelompok.desaId,
				desaNama: desa.nama
			})
			.from(kelompok)
			.leftJoin(desa, eq(kelompok.desaId, desa.id))
			.where(eq(kelompok.id, locals.user.kelompokId))
			));

		if (kel) {
			kelompokNama = kel.nama;
			desaId = kel.desaId;
			if (kel.desaNama) desaNama = kel.desaNama;
		}
	}

	// Jadwal pengajian kelompok jamaah terbaru
	const upcomingJadwalKelompok = (await (locals.user.kelompokId ? db
				.select()
				.from(presensiJadwal)
				.where(
					and(
						eq(presensiJadwal.kelompokId, locals.user.kelompokId),
						eq(presensiJadwal.tingkatScope, 'Kelompok')
					)
				)
				.orderBy(desc(presensiJadwal.tanggal))
				.limit(4) : []));

	// Jadwal pengajian tingkat desa jamaah terbaru
	const upcomingJadwalDesa = (await (desaId ? db
				.select()
				.from(presensiJadwal)
				.where(
					and(
						eq(presensiJadwal.desaId, desaId),
						eq(presensiJadwal.tingkatScope, 'Desa')
					)
				)
				.orderBy(desc(presensiJadwal.tanggal))
				.limit(4) : []));

	return {
		user: locals.user,
		hasKeluarga: await getKeluargaForUser(locals.user.id) !== null,
		kelompokNama,
		desaNama,
		upcomingJadwalKelompok,
		upcomingJadwalDesa
	};
};

