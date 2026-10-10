/**
 * @file src/routes/(admin)/admin/presensi/[jadwalId]/+page.server.ts
 * @purpose Memuat daftar checklist absensi jamaah per jadwal, verifikasi bukti foto/lokasi, menangani approval izin/sakit, dan update status manual
 * @usedBy src/routes/(admin)/admin/presensi/[jadwalId]/+page.svelte
 * @dependencies src/lib/db, src/lib/db/schema, drizzle-orm
 * @publicFunctions load, actions.updateStatus, actions.approveIzin, actions.rejectIzin
 * @sideEffects Query detail jadwal & kehadiran, serta update record presensi_kehadiran ke SQLite
 */

import { error, redirect, fail } from '@sveltejs/kit';
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

	const kelompokData = jadwal.kelompokId
		? db.select().from(kelompok).where(eq(kelompok.id, jadwal.kelompokId)).get()
		: null;

	// Ambil semua jamaah di kelompok ini
	const jamaahList = jadwal.kelompokId
		? db
				.select({
					id: users.id,
					namaLengkap: users.namaLengkap,
					email: users.email,
					noTelepon: users.noTelepon
				})
				.from(users)
				.where(eq(users.kelompokId, jadwal.kelompokId))
				.all()
		: [];

	// Ambil status kehadiran yang sudah tercatat
	const kehadiranList = db
		.select()
		.from(presensiKehadiran)
		.where(eq(presensiKehadiran.jadwalId, jadwalId))
		.all();

	const recordMap = new Map<string, (typeof kehadiranList)[number]>();
	kehadiranList.forEach((k) => {
		recordMap.set(k.userId, k);
	});

	const pesertaWithStatus = jamaahList.map((j) => {
		const rec = recordMap.get(j.id);
		return {
			...j,
			status: rec?.status || 'Belum Terdata',
			metodeKehadiran: rec?.metodeKehadiran || null,
			fotoUrl: rec?.fotoUrl || null,
			latitude: rec?.latitude || null,
			longitude: rec?.longitude || null,
			keteranganIzin: rec?.keteranganIzin || null,
			statusApproval: rec?.statusApproval || (rec ? 'Disetujui' : null),
			catatanAdmin: rec?.catatanAdmin || null,
			waktuScan: rec?.waktuScan || null
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
			return fail(400, { error: 'Data tidak lengkap' });
		}

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

		const nowUnix = Math.floor(Date.now() / 1000);

		if (existing) {
			db.update(presensiKehadiran)
				.set({
					status,
					statusApproval: 'Disetujui',
					waktuScan: status === 'Hadir' ? nowUnix : existing.waktuScan
				})
				.where(eq(presensiKehadiran.id, existing.id))
				.run();
		} else {
			db.insert(presensiKehadiran)
				.values({
					jadwalId,
					userId,
					status,
					statusApproval: 'Disetujui',
					waktuScan: status === 'Hadir' ? nowUnix : null
				})
				.run();
		}

		return { success: true };
	},

	approveIzin: async ({ request, params, locals }) => {
		if (!locals.user || !locals.isAdmin) {
			throw error(403, 'Akses ditolak');
		}

		const jadwalId = parseInt(params.jadwalId || '0', 10);
		const formData = await request.formData();
		const userId = formData.get('userId')?.toString() || '';
		const catatan = formData.get('catatanAdmin')?.toString()?.trim() || null;

		if (!userId) {
			return fail(400, { error: 'User ID wajib disertakan.' });
		}

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
					statusApproval: 'Disetujui',
					catatanAdmin: catatan
				})
				.where(eq(presensiKehadiran.id, existing.id))
				.run();
		}

		return { success: true, message: 'Permohonan izin berhasil disetujui.' };
	},

	rejectIzin: async ({ request, params, locals }) => {
		if (!locals.user || !locals.isAdmin) {
			throw error(403, 'Akses ditolak');
		}

		const jadwalId = parseInt(params.jadwalId || '0', 10);
		const formData = await request.formData();
		const userId = formData.get('userId')?.toString() || '';
		const catatan = formData.get('catatanAdmin')?.toString()?.trim() || 'Permohonan izin tidak disetujui';

		if (!userId) {
			return fail(400, { error: 'User ID wajib disertakan.' });
		}

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
					status: 'Alpa',
					statusApproval: 'Ditolak',
					catatanAdmin: catatan
				})
				.where(eq(presensiKehadiran.id, existing.id))
				.run();
		}

		return { success: true, message: 'Permohonan izin telah ditolak (status diubah ke Alpa).' };
	}
};
