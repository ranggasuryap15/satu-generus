/**
 * @file src/routes/(admin)/admin/+page.server.ts
 * @purpose Memuat statistik ringkasan demografi dan daftar aktivitas kegiatan pengajian untuk admin dengan proteksi scope hierarki wilayah (Pusat, Daerah, Desa, Kelompok)
 * @usedBy src/routes/(admin)/admin/+page.svelte
 * @dependencies src/lib/db, src/lib/db/schema, src/lib/server/scope, drizzle-orm
 * @publicFunctions load
 * @sideEffects Query metrik agregasi cepat dari SQLite dengan filter index wewenang admin (minimum I/O)
 */

import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/db';
import { users, keluarga, presensiJadwal, kelompok, userDapukan, dapukan } from '$lib/db/schema';
import { and, count, desc, eq, inArray, or } from 'drizzle-orm';
import { getAdminScope, getAccessibleWilayah } from '$lib/server/scope';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user || !locals.isAdmin) {
		throw redirect(303, '/login');
	}

	const adminScope = getAdminScope(locals.roles || []);
	const accessibleWilayah = await getAccessibleWilayah(adminScope);

	let totalJamaah = 0;
	let totalKeluarga = 0;
	let totalJadwal = 0;
	let totalPengurus = 0;
	let recentJadwal: Array<{
		id: number;
		tanggal: string;
		namaKegiatan: string;
		kelompokNama: string | null;
	}> = [];

	if (adminScope.isPusat) {
		// 1. Superadmin / Pusat: Agregasi global cepat
		const [jamaahCountRes] = (await db.select({ val: count() }).from(users));
		const [keluargaCountRes] = (await db.select({ val: count() }).from(keluarga));
		const [jadwalCountRes] = (await db.select({ val: count() }).from(presensiJadwal));
		const [pengurusCountRes] = (await db
			.select({ val: count() })
			.from(userDapukan)
			.innerJoin(dapukan, eq(userDapukan.dapukanId, dapukan.id))
			.where(eq(dapukan.is4S, true))
);
		totalJamaah = jamaahCountRes?.val ?? 0;
		totalKeluarga = keluargaCountRes?.val ?? 0;
		totalJadwal = jadwalCountRes?.val ?? 0;
		totalPengurus = pengurusCountRes?.val ?? 0;

		recentJadwal = (await db
			.select({
				id: presensiJadwal.id,
				tanggal: presensiJadwal.tanggal,
				namaKegiatan: presensiJadwal.namaKegiatan,
				kelompokNama: kelompok.nama
			})
			.from(presensiJadwal)
			.leftJoin(kelompok, eq(presensiJadwal.kelompokId, kelompok.id))
			.orderBy(desc(presensiJadwal.tanggal))
			.limit(50)
);
	} else {
		// 2. Terbatas Scope Wilayah (Kelompok, Desa, atau Daerah)
		const allowedKelompokIds = Array.from(accessibleWilayah.allowedKelompokIdSet);

		if (allowedKelompokIds.length > 0) {
			// A. Total Jamaah pada kelompok dalam scope admin
			const [jamaahRes] = (await db
				.select({ val: count() })
				.from(users)
				.where(inArray(users.kelompokId, allowedKelompokIds))
);
			totalJamaah = jamaahRes?.val ?? 0;

			// B. Total Kartu Keluarga pada kelompok dalam scope (via kepala keluarga)
			const [keluargaRes] = (await db
				.select({ val: count() })
				.from(keluarga)
				.innerJoin(users, eq(keluarga.kepalaKeluargaId, users.id))
				.where(inArray(users.kelompokId, allowedKelompokIds))
);
			totalKeluarga = keluargaRes?.val ?? 0;

			// C. Filter Jadwal Kegiatan
			let jadwalCondition;
			if (adminScope.level === 'Kelompok') {
				// HANYA kegiatan kelompok miliknya
				jadwalCondition = inArray(presensiJadwal.kelompokId, allowedKelompokIds);
			} else if (adminScope.level === 'Desa') {
				// Kegiatan desa binaan atau kelompok di bawah desanya
				jadwalCondition =
					adminScope.desaIds.length > 0
						? or(
								inArray(presensiJadwal.desaId, adminScope.desaIds),
								inArray(presensiJadwal.kelompokId, allowedKelompokIds)
							)
						: inArray(presensiJadwal.kelompokId, allowedKelompokIds);
			} else {
				// Tingkat Daerah
				const allowedDesaIds = accessibleWilayah.desaList.map((d) => d.id);
				jadwalCondition =
					allowedDesaIds.length > 0
						? or(
								inArray(presensiJadwal.desaId, allowedDesaIds),
								inArray(presensiJadwal.kelompokId, allowedKelompokIds)
							)
						: inArray(presensiJadwal.kelompokId, allowedKelompokIds);
			}

			// Total Jadwal
			const [jadwalRes] = (await db
				.select({ val: count() })
				.from(presensiJadwal)
				.where(jadwalCondition)
);
			totalJadwal = jadwalRes?.val ?? 0;

			// 5 Jadwal Terbaru Sesuai Scope
			recentJadwal = (await db
				.select({
					id: presensiJadwal.id,
					tanggal: presensiJadwal.tanggal,
					namaKegiatan: presensiJadwal.namaKegiatan,
					kelompokNama: kelompok.nama
				})
				.from(presensiJadwal)
				.leftJoin(kelompok, eq(presensiJadwal.kelompokId, kelompok.id))
				.where(jadwalCondition)
				.orderBy(desc(presensiJadwal.tanggal))
				.limit(50)
);
			// D. Pengurus 4S Aktif Sesuai Scope
			let pengurusScopeCondition;
			if (adminScope.level === 'Kelompok') {
				pengurusScopeCondition = inArray(userDapukan.kelompokId, allowedKelompokIds);
			} else if (adminScope.level === 'Desa') {
				pengurusScopeCondition =
					adminScope.desaIds.length > 0
						? or(
								inArray(userDapukan.desaId, adminScope.desaIds),
								inArray(userDapukan.kelompokId, allowedKelompokIds)
							)
						: inArray(userDapukan.kelompokId, allowedKelompokIds);
			} else {
				const allowedDesaIds = accessibleWilayah.desaList.map((d) => d.id);
				pengurusScopeCondition = or(
					inArray(userDapukan.daerahId, adminScope.daerahIds),
					allowedDesaIds.length > 0 ? inArray(userDapukan.desaId, allowedDesaIds) : undefined,
					inArray(userDapukan.kelompokId, allowedKelompokIds)
				);
			}

			const [pengurusRes] = (await db
				.select({ val: count() })
				.from(userDapukan)
				.innerJoin(dapukan, eq(userDapukan.dapukanId, dapukan.id))
				.where(
					pengurusScopeCondition
						? and(eq(dapukan.is4S, true), pengurusScopeCondition)
						: eq(dapukan.is4S, true)
				)
);
			totalPengurus = pengurusRes?.val ?? 0;
		}
	}

	return {
		stats: {
			totalJamaah,
			totalKeluarga,
			totalJadwal,
			totalPengurus
		},
		recentJadwal
	};
};
