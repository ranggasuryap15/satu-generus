/**
 * @file src/routes/(app)/+page.server.ts
 * @purpose Memuat ringkasan jamaah, kelompok, desa, status keluarga, dan daftar 2 pengajian terdekat (Kelompok & Desa) dari tanggal hari ini
 * @usedBy src/routes/(app)/+page.svelte
 * @dependencies src/lib/db, src/lib/db/schema, src/lib/server/sensus (getKeluargaForUser), src/lib/presensi-waktu (getWaktuSekarangWIB), drizzle-orm
 * @publicFunctions load
 * @sideEffects Query kelompok, desa, status keluarga, dan 2 jadwal pengajian terdekat dari PostgreSQL
 */

import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db, first } from '#lib/db/index.js';
import { desa, kelompok, presensiJadwal } from '#lib/db/schema.js';
import { eq, desc, asc, and, gte, lt } from 'drizzle-orm';
import { getKeluargaForUser } from '#lib/server/sensus.js';
import { getWaktuSekarangWIB } from '#lib/presensi-waktu.js';

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

	const waktuWIB = getWaktuSekarangWIB();
	const today = waktuWIB.tanggal;

	// Helper query 2 pengajian terdekat (prioritas hari ini ke depan, fallback ke terbaru bila jadwal mendatang < 2)
	async function getDuaPengajianTerdekat(scope: 'Kelompok' | 'Desa', scopeId: number | null) {
		if (!scopeId) return [];

		const scopeCondition =
			scope === 'Kelompok'
				? and(eq(presensiJadwal.kelompokId, scopeId), eq(presensiJadwal.tingkatScope, 'Kelompok'))
				: and(eq(presensiJadwal.desaId, scopeId), eq(presensiJadwal.tingkatScope, 'Desa'));

		// 1. Jadwal hari ini ke depan (diurutkan paling dekat dengan hari ini)
		const upcoming = await db
			.select()
			.from(presensiJadwal)
			.where(and(scopeCondition, gte(presensiJadwal.tanggal, today)))
			.orderBy(asc(presensiJadwal.tanggal), asc(presensiJadwal.jamMulai))
			.limit(2);

		if (upcoming.length >= 2) {
			return upcoming;
		}

		// 2. Jika jadwal ke depan < 2, lengkapi dengan jadwal yang baru lewat
		const needed = 2 - upcoming.length;
		const past = await db
			.select()
			.from(presensiJadwal)
			.where(and(scopeCondition, lt(presensiJadwal.tanggal, today)))
			.orderBy(desc(presensiJadwal.tanggal), desc(presensiJadwal.jamMulai))
			.limit(needed);

		return [...past.reverse(), ...upcoming];
	}

	// 2 pengajian terdekat untuk kelompok dan desa
	const upcomingJadwalKelompok = await getDuaPengajianTerdekat('Kelompok', locals.user.kelompokId);
	const upcomingJadwalDesa = await getDuaPengajianTerdekat('Desa', desaId);

	return {
		user: locals.user,
		hasKeluarga: await getKeluargaForUser(locals.user.id) !== null,
		kelompokNama,
		desaNama,
		upcomingJadwalKelompok,
		upcomingJadwalDesa
	};
};

