/**
 * @file src/routes/(app)/presensi/+page.server.ts
 * @purpose Memuat jadwal pengajian aktif kelompok, token QR unik jamaah, dan riwayat presensi
 * @usedBy src/routes/(app)/presensi/+page.svelte
 * @dependencies src/lib/db, src/lib/db/schema, drizzle-orm
 * @publicFunctions load
 * @sideEffects Query jadwal pengajian dan riwayat kehadiran jamaah dari SQLite
 */

import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/db';
import { presensiJadwal, presensiKehadiran, kelompok } from '$lib/db/schema';
import { eq, desc } from 'drizzle-orm';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(303, '/login?redirectTo=/presensi');
	}

	const userKelompokId = locals.user.kelompokId;
	let kelompokNama = 'Kelompok';

	if (userKelompokId) {
		const kel = db.select().from(kelompok).where(eq(kelompok.id, userKelompokId)).get();
		if (kel) kelompokNama = kel.nama;
	}

	// Ambil jadwal kegiatan untuk kelompok jamaah
	const jadwalList = userKelompokId
		? db
				.select()
				.from(presensiJadwal)
				.where(eq(presensiJadwal.kelompokId, userKelompokId))
				.orderBy(desc(presensiJadwal.tanggal))
				.all()
		: [];

	// Ambil riwayat kehadiran jamaah ini
	const kehadiranRecords = db
		.select()
		.from(presensiKehadiran)
		.where(eq(presensiKehadiran.userId, locals.user.id))
		.all();

	const statusMap = new Map<number, string>();
	kehadiranRecords.forEach((k) => {
		statusMap.set(k.jadwalId, k.status);
	});

	const jadwalWithStatus = jadwalList.map((j) => ({
		id: j.id,
		tanggal: j.tanggal,
		namaKegiatan: j.namaKegiatan,
		statusKehadiran: statusMap.get(j.id) || 'Belum Terdata'
	}));

	// QR Payload unik jamaah (format: SGQR:userId:kelompokId)
	const qrPayload = `SGQR:${locals.user.id}:${userKelompokId || 0}`;

	return {
		user: locals.user,
		kelompokNama,
		qrPayload,
		jadwalList: jadwalWithStatus
	};
};
