/**
 * @file src/routes/(admin)/admin/presensi/+page.server.ts
 * @purpose Memuat seluruh jadwal pengajian dan menangani aksi pembuatan jadwal kegiatan baru bagi admin
 * @usedBy src/routes/(admin)/admin/presensi/+page.svelte
 * @dependencies src/lib/db, src/lib/db/schema, drizzle-orm
 * @publicFunctions load, actions.createJadwal
 * @sideEffects Query jadwal & rekap kehadiran, insert jadwal pengajian baru ke SQLite
 */

import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/db';
import { presensiJadwal, presensiKehadiran, kelompok } from '$lib/db/schema';
import { eq, desc } from 'drizzle-orm';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user || !locals.isAdmin) {
		throw redirect(303, '/login');
	}

	// Query daftar kelompok yang tersedia
	const kelompokList = db.select().from(kelompok).all();

	// Query daftar jadwal kegiatan join kelompok
	const rawJadwal = db
		.select({
			id: presensiJadwal.id,
			kelompokId: presensiJadwal.kelompokId,
			kelompokNama: kelompok.nama,
			tanggal: presensiJadwal.tanggal,
			namaKegiatan: presensiJadwal.namaKegiatan
		})
		.from(presensiJadwal)
		.leftJoin(kelompok, eq(presensiJadwal.kelompokId, kelompok.id))
		.orderBy(desc(presensiJadwal.tanggal))
		.all();

	// Ambil rekap kehadiran per jadwal
	const rawKehadiran = db.select().from(presensiKehadiran).all();

	const daftarJadwal = rawJadwal.map((j) => {
		const kehadiranTerkait = rawKehadiran.filter((k) => k.jadwalId === j.id);
		const hadirCount = kehadiranTerkait.filter((k) => k.status === 'Hadir').length;
		return {
			...j,
			totalPeserta: kehadiranTerkait.length,
			totalHadir: hadirCount
		};
	});

	return {
		kelompokList,
		daftarJadwal
	};
};

export const actions: Actions = {
	createJadwal: async ({ request, locals }) => {
		if (!locals.user || !locals.isAdmin) {
			return fail(403, { error: 'Akses ditolak.' });
		}

		const formData = await request.formData();
		const namaKegiatan = formData.get('namaKegiatan')?.toString()?.trim() || '';
		const tanggal = formData.get('tanggal')?.toString()?.trim() || '';
		const kelompokIdStr = formData.get('kelompokId')?.toString() || '';
		const kelompokId = parseInt(kelompokIdStr, 10);

		if (!namaKegiatan || !tanggal || isNaN(kelompokId)) {
			return fail(400, {
				error: 'Nama kegiatan, tanggal, dan kelompok wajib diisi.'
			});
		}

		try {
			db.insert(presensiJadwal)
				.values({
					kelompokId,
					tanggal,
					namaKegiatan
				})
				.run();
		} catch (error) {
			console.error('Gagal membuat jadwal:', error);
			return fail(500, { error: 'Terjadi kesalahan sistem saat membuat jadwal.' });
		}

		return { success: true };
	}
};
