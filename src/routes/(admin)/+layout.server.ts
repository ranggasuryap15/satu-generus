/**
 * @file src/routes/(admin)/+layout.server.ts
 * @purpose Layout server load untuk area admin: memvalidasi akses admin, memuat wewenang scope (adminScope), otorisasi menu Keuangan/KU, otorisasi modifikasi Shodaqoh KU & Kyai, rekap notifikasi presensi, dan agregasi transaksi shodaqoh pending
 * @usedBy src/routes/(admin)/+layout.svelte dan seluruh subhalaman admin
 * @dependencies @sveltejs/kit, src/lib/db, src/lib/db/schema, src/lib/server/scope, drizzle-orm
 * @publicFunctions load
 * @sideEffects DB read ke tabel presensi_kehadiran, users, presensi_jadwal, kelompok, dan transaksi_shodaqoh dengan filter status_approval 'pending' / 'Menunggu Persetujuan'
 */

import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { db } from '#lib/db/index.js';
import { presensiKehadiran, presensiJadwal, users, kelompok, transaksiShodaqoh } from '#lib/db/schema.js';
import { getAdminScope, canAccessKeuangan, canManageRekening, canManageShodaqoh } from '#lib/server/scope.js';
import { and, count, desc, eq, inArray } from 'drizzle-orm';

export const load: LayoutServerLoad = async ({ locals }) => {
	if (!locals.user || !locals.isAdmin) {
		throw redirect(303, '/login');
	}

	const adminScope = getAdminScope(locals.roles || []);
	const hasAccessKeuangan = canAccessKeuangan(locals.roles || []);

	// 1. Agregasi jumlah total permohonan izin/sakit yang menunggu approval (cepat & minimum I/O memanfaatkan index status_approval)
	const [pendingCountRes] = (await db
		.select({ val: count() })
		.from(presensiKehadiran)
		.where(eq(presensiKehadiran.statusApproval, 'Menunggu Persetujuan'))
);
	const totalPendingApprovals = pendingCountRes?.val ?? 0;

	// 2. Agregasi jumlah transaksi shodaqoh berstatus 'pending' sesuai scope wilayah admin (KU / Kyai)
	let totalPendingShodaqoh = 0;
	if (hasAccessKeuangan) {
		const shodaqohConditions = [eq(transaksiShodaqoh.statusApproval, 'pending')];

		if (!adminScope.isPusat) {
			if (adminScope.level === 'Kelompok' && adminScope.kelompokIds.length > 0) {
				shodaqohConditions.push(inArray(transaksiShodaqoh.kelompokId, adminScope.kelompokIds));
			} else if (adminScope.level === 'Desa' && adminScope.desaIds.length > 0) {
				shodaqohConditions.push(inArray(transaksiShodaqoh.desaId, adminScope.desaIds));
			} else if (adminScope.level === 'Daerah' && adminScope.daerahIds.length > 0) {
				shodaqohConditions.push(inArray(transaksiShodaqoh.daerahId, adminScope.daerahIds));
			}
		}

		const [pendingShodaqohRes] = (await db
			.select({ val: count() })
			.from(transaksiShodaqoh)
			.where(and(...shodaqohConditions))
);
		totalPendingShodaqoh = pendingShodaqohRes?.val ?? 0;
	}

	// 3. Muat 8 item notifikasi permohonan izin/sakit pending terbaru untuk dropdown lonceng admin
	const pendingApprovalList = (await db
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
);
	return {
		adminScope,
		totalPendingApprovals,
		totalPendingShodaqoh,
		pendingApprovalList,
		canAccessKeuangan: hasAccessKeuangan,
		canManageFinance: await canManageRekening(locals.roles || []),
		canManageShodaqoh: await canManageShodaqoh(locals.roles || [])
	};
};

