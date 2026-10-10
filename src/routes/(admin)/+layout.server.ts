/**
 * @file src/routes/(admin)/+layout.server.ts
 * @purpose Layout server load untuk area admin: memvalidasi hak akses admin dan memuat rekap notifikasi permohonan izin/sakit yang membutuhkan persetujuan
 * @usedBy src/routes/(admin)/+layout.svelte dan komponen navigasi AdminTopBar / AdminSidebar
 * @dependencies @sveltejs/kit, src/lib/db, src/lib/db/schema, drizzle-orm
 * @publicFunctions load
 * @sideEffects DB read ke tabel presensi_kehadiran, users, presensi_jadwal, dan kelompok dengan filter status_approval 'Menunggu Persetujuan'
 */

import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { db } from '$lib/db';
import { presensiKehadiran, presensiJadwal, users, kelompok } from '$lib/db/schema';
import { count, desc, eq } from 'drizzle-orm';

export const load: LayoutServerLoad = async ({ locals }) => {
	if (!locals.user || !locals.isAdmin) {
		throw redirect(303, '/login');
	}

	// 1. Agregasi jumlah total permohonan izin/sakit yang menunggu approval (cepat & minimum I/O memanfaatkan index status_approval)
	const [pendingCountRes] = db
		.select({ val: count() })
		.from(presensiKehadiran)
		.where(eq(presensiKehadiran.statusApproval, 'Menunggu Persetujuan'))
		.all();

	const totalPendingApprovals = pendingCountRes?.val ?? 0;

	// 2. Muat 8 item notifikasi permohonan izin/sakit pending terbaru untuk dropdown lonceng admin
	const pendingApprovalList = db
		.select({
			id: presensiKehadiran.id,
			jadwalId: presensiKehadiran.jadwalId,
			userId: presensiKehadiran.userId,
			status: presensiKehadiran.status,
			keteranganIzin: presensiKehadiran.keteranganIzin,
			fotoUrl: presensiKehadiran.fotoUrl,
			waktuScan: presensiKehadiran.waktuScan,
			namaJamaah: users.namaLengkap,
			namaKegiatan: presensiJadwal.namaKegiatan,
			tanggalJadwal: presensiJadwal.tanggal,
			kelompokNama: kelompok.nama
		})
		.from(presensiKehadiran)
		.innerJoin(users, eq(presensiKehadiran.userId, users.id))
		.innerJoin(presensiJadwal, eq(presensiKehadiran.jadwalId, presensiJadwal.id))
		.leftJoin(kelompok, eq(presensiJadwal.kelompokId, kelompok.id))
		.where(eq(presensiKehadiran.statusApproval, 'Menunggu Persetujuan'))
		.orderBy(desc(presensiKehadiran.waktuScan), desc(presensiKehadiran.id))
		.limit(8)
		.all();

	return {
		totalPendingApprovals,
		pendingApprovalList
	};
};

