/**
 * @file src/routes/(admin)/admin/+page.server.ts
 * @purpose Memuat statistik ringkasan demografi dan daftar aktivitas kegiatan pengajian untuk admin
 * @usedBy src/routes/(admin)/admin/+page.svelte
 * @dependencies src/lib/db, src/lib/db/schema, drizzle-orm
 * @publicFunctions load
 * @sideEffects Query metrik agregasi cepat dari SQLite menggunakan count()
 */

import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/db';
import { users, keluarga, presensiJadwal, kelompok, userDapukan } from '$lib/db/schema';
import { count, desc, eq } from 'drizzle-orm';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user || !locals.isAdmin) {
		throw redirect(303, '/login');
	}

	// Agregasi jumlah baris secara efisien (prinsip minimum I/O)
	const [jamaahCountRes] = db.select({ val: count() }).from(users).all();
	const [keluargaCountRes] = db.select({ val: count() }).from(keluarga).all();
	const [jadwalCountRes] = db.select({ val: count() }).from(presensiJadwal).all();
	const [pengurusCountRes] = db.select({ val: count() }).from(userDapukan).all();

	// 5 Jadwal kegiatan terbaru
	const recentJadwal = db
		.select({
			id: presensiJadwal.id,
			tanggal: presensiJadwal.tanggal,
			namaKegiatan: presensiJadwal.namaKegiatan,
			kelompokNama: kelompok.nama
		})
		.from(presensiJadwal)
		.leftJoin(kelompok, eq(presensiJadwal.kelompokId, kelompok.id))
		.orderBy(desc(presensiJadwal.tanggal))
		.limit(5)
		.all();

	return {
		stats: {
			totalJamaah: jamaahCountRes?.val ?? 0,
			totalKeluarga: keluargaCountRes?.val ?? 0,
			totalJadwal: jadwalCountRes?.val ?? 0,
			totalPengurus: pengurusCountRes?.val ?? 0
		},
		recentJadwal
	};
};

