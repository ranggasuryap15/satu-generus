/**
 * @file src/routes/(admin)/admin/presensi/+page.server.ts
 * @purpose Memuat seluruh jadwal pengajian dengan urutan tanggal terdekat paling atas dan menangani aksi pembuatan jadwal kegiatan baru bagi admin dengan pembatasan wewenang scope wilayah
 * @usedBy src/routes/(admin)/admin/presensi/+page.svelte
 * @dependencies src/lib/db, src/lib/db/schema, src/lib/server/scope, src/lib/utils (normalizeDateToISO), drizzle-orm
 * @publicFunctions load, actions.createJadwal
 * @sideEffects Query jadwal (diurutkan tanggal terdekat) & rekap kehadiran sesuai scope, insert jadwal pengajian baru ke SQLite
 */

import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/db';
import { presensiJadwal, presensiKehadiran, kelompok } from '$lib/db/schema';
import { eq, desc, inArray, or, sql } from 'drizzle-orm';
import { normalizeDateToISO } from '$lib/utils';
import { getAdminScope, getAccessibleWilayah, isKelompokAllowed } from '$lib/server/scope';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user || !locals.isAdmin) {
		throw redirect(303, '/login');
	}

	const adminScope = getAdminScope(locals.roles || []);
	const accessibleWilayah = getAccessibleWilayah(adminScope);

	// 1. Query daftar kelompok yang dapat diakses oleh admin
	let kelompokList = accessibleWilayah.kelompokList;
	if (adminScope.isPusat) {
		kelompokList = db.select().from(kelompok).all();
	}

	// 2. Query jadwal kegiatan sesuai scope
	let jadwalCondition;
	if (adminScope.isPusat) {
		jadwalCondition = undefined;
	} else {
		const allowedKelompokIds = Array.from(accessibleWilayah.allowedKelompokIdSet);
		if (allowedKelompokIds.length === 0) {
			return { kelompokList: [], daftarJadwal: [] };
		}

		if (adminScope.level === 'Kelompok') {
			jadwalCondition = inArray(presensiJadwal.kelompokId, allowedKelompokIds);
		} else if (adminScope.level === 'Desa') {
			jadwalCondition =
				adminScope.desaIds.length > 0
					? or(
							inArray(presensiJadwal.desaId, adminScope.desaIds),
							inArray(presensiJadwal.kelompokId, allowedKelompokIds)
						)
					: inArray(presensiJadwal.kelompokId, allowedKelompokIds);
		} else {
			const allowedDesaIds = accessibleWilayah.desaList.map((d) => d.id);
			jadwalCondition =
				allowedDesaIds.length > 0
					? or(
							inArray(presensiJadwal.desaId, allowedDesaIds),
							inArray(presensiJadwal.kelompokId, allowedKelompokIds)
						)
					: inArray(presensiJadwal.kelompokId, allowedKelompokIds);
		}
	}

	const query = db
		.select({
			id: presensiJadwal.id,
			kelompokId: presensiJadwal.kelompokId,
			kelompokNama: kelompok.nama,
			tanggal: presensiJadwal.tanggal,
			namaKegiatan: presensiJadwal.namaKegiatan,
			lokasiNama: presensiJadwal.lokasiNama,
			latitude: presensiJadwal.latitude,
			longitude: presensiJadwal.longitude,
			radiusMeter: presensiJadwal.radiusMeter,
			gmapsUrl: presensiJadwal.gmapsUrl
		})
		.from(presensiJadwal)
		.leftJoin(kelompok, eq(presensiJadwal.kelompokId, kelompok.id))
		.orderBy(
			sql`ABS(julianday(${presensiJadwal.tanggal}) - julianday(date('now', 'localtime'))) ASC`,
			sql`CASE WHEN ${presensiJadwal.tanggal} >= date('now', 'localtime') THEN 0 ELSE 1 END ASC`,
			desc(presensiJadwal.tanggal)
		);

	const rawJadwal = jadwalCondition ? query.where(jadwalCondition).all() : query.all();

	// Rekap kehadiran untuk jadwal yang ditampilkan saja (minimum I/O)
	const jadwalIds = rawJadwal.map((j) => j.id);
	const rawKehadiran =
		jadwalIds.length > 0
			? db
					.select()
					.from(presensiKehadiran)
					.where(inArray(presensiKehadiran.jadwalId, jadwalIds))
					.all()
			: [];

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

		const adminScope = getAdminScope(locals.roles || []);
		const accessibleWilayah = getAccessibleWilayah(adminScope);

		const formData = await request.formData();
		const namaKegiatan = formData.get('namaKegiatan')?.toString()?.trim() || '';
		const tanggal = formData.get('tanggal')?.toString()?.trim() || '';
		const kelompokIdStr = formData.get('kelompokId')?.toString() || '';
		const kelompokId = parseInt(kelompokIdStr, 10);
		const lokasiNama = formData.get('lokasiNama')?.toString()?.trim() || null;
		const latitude = formData.get('latitude')?.toString()?.trim() || null;
		const longitude = formData.get('longitude')?.toString()?.trim() || null;
		const radiusMeterStr = formData.get('radiusMeter')?.toString() || '100';
		const radiusMeter = parseInt(radiusMeterStr, 10) || 100;
		const gmapsUrl = formData.get('gmapsUrl')?.toString()?.trim() || null;

		if (!namaKegiatan || !tanggal || isNaN(kelompokId)) {
			return fail(400, {
				error: 'Nama kegiatan, tanggal, dan kelompok wajib diisi.'
			});
		}

		if (!isKelompokAllowed(kelompokId, accessibleWilayah.allowedKelompokIdSet, adminScope.isPusat)) {
			return fail(403, {
				error: 'Akses ditolak: Anda tidak memiliki wewenang untuk membuat jadwal di kelompok ini.'
			});
		}

		try {
			db.insert(presensiJadwal)
				.values({
					kelompokId,
					tanggal: normalizeDateToISO(tanggal),
					namaKegiatan,
					lokasiNama,
					latitude,
					longitude,
					radiusMeter,
					gmapsUrl
				})
				.run();
		} catch (error) {
			console.error('Gagal membuat jadwal:', error);
			return fail(500, { error: 'Terjadi kesalahan sistem saat membuat jadwal.' });
		}

		return { success: true };
	}
};
