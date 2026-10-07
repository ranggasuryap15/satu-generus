/**
 * @file src/routes/(admin)/admin/presensi/[jadwalId]/+page.server.ts
 * @purpose Memuat daftar checklist absensi jamaah per jadwal dan menangani update status kehadiran manual
 * @usedBy src/routes/(admin)/admin/presensi/[jadwalId]/+page.svelte
 * @dependencies src/lib/db, src/lib/db/schema, drizzle-orm
 * @publicFunctions load, actions.updateStatus
 * @sideEffects Query detail jadwal, jamaah kelompok, dan upsert record presensi_kehadiran ke SQLite
 */

import { error, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/db';
import { presensiJadwal, presensiKehadiran, users, kelompok } from '$lib/db/schema';
import { eq, and } from 'drizzle-orm';

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

	const kelompokData = db.select().from(kelompok).where(eq(kelompok.id, jadwal.kelompokId)).get();

	// Ambil semua jamaah di kelompok ini
	const jamaahList = db
		.select({
			id: users.id,
			namaLengkap: users.namaLengkap,
			email: users.email
		})
		.from(users)
		.where(eq(users.kelompokId, jadwal.kelompokId))
		.all();

	// Ambil status kehadiran yang sudah tercatat
	const kehadiranList = db
		.select()
		.from(presensiKehadiran)
		.where(eq(presensiKehadiran.jadwalId, jadwalId))
		.all();

	const statusMap = new Map<string, { status: string; waktuScan: number | null }>();
	kehadiranList.forEach((k) => {
		statusMap.set(k.userId, { status: k.status, waktuScan: k.waktuScan });
	});

	const pesertaWithStatus = jamaahList.map((j) => {
		const record = statusMap.get(j.id);
		return {
			...j,
			status: record?.status || 'Belum Terdata',
			waktuScan: record?.waktuScan || null
		};
	});

	return {
		jadwal,
		kelompokNama: kelompokData?.nama || 'Kelompok',
		pesertaList: pesertaWithStatus
	};
};

export const actions: Actions = {
	updateStatus: async ({ request, params, locals }) => {
		if (!locals.user || !locals.isAdmin) {
			throw error(403, 'Akses ditolak');
		}

		const jadwalId = parseInt(params.jadwalId || '0', 10);
		const formData = await request.formData();
		const userId = formData.get('userId')?.toString() || '';
		const status = formData.get('status')?.toString() || 'Hadir';

		if (!userId || !status) {
			return { success: false, error: 'Data tidak lengkap' };
		}

		// Cek apakah record sudah ada untuk jadwalId dan userId ini
		const existing = db
			.select()
			.from(presensiKehadiran)
			.where(
				and(
					eq(presensiKehadiran.jadwalId, jadwalId),
					eq(presensiKehadiran.userId, userId)
				)
			)
			.get();

		if (existing) {
			db.update(presensiKehadiran)
				.set({
					status,
					waktuScan: status === 'Hadir' ? Math.floor(Date.now() / 1000) : null
				})
				.where(eq(presensiKehadiran.id, existing.id))
				.run();
		} else {
			db.insert(presensiKehadiran)
				.values({
					jadwalId,
					userId,
					status,
					waktuScan: status === 'Hadir' ? Math.floor(Date.now() / 1000) : null
				})
				.run();
		}

		return { success: true };
	}
};
