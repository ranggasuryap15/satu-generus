/**
 * @file src/routes/(app)/+layout.server.ts
 * @purpose Layout server load untuk zona jamaah (app): memuat data notifikasi jadwal pengajian terdekat, status perizinan, dan info kelompok/desa
 * @usedBy src/routes/(app)/+layout.svelte dan komponen navigasi ClientTopBar
 * @dependencies @sveltejs/kit, src/lib/db, src/lib/db/schema, drizzle-orm
 * @publicFunctions load
 * @sideEffects DB read ke tabel kelompok, desa, presensi_jadwal, dan presensi_kehadiran dengan query terindeks hemat I/O
 */

import type { LayoutServerLoad } from './$types';
import { db } from '$lib/db';
import { kelompok, presensiJadwal, presensiKehadiran } from '$lib/db/schema';
import { eq, desc, asc, and, or, gte } from 'drizzle-orm';

export interface ClientNotifItem {
	id: string;
	kategori: 'jadwal' | 'presensi' | 'info';
	judul: string;
	pesan: string;
	waktu: string;
	statusBadge: string;
	badgeVariant: 'primary' | 'warning' | 'emerald' | 'amber' | 'rose';
	link: string;
	isImportant: boolean;
	tanggalRaw?: string;
}

export const load: LayoutServerLoad = async ({ locals }) => {
	if (!locals.user) {
		return {
			notifikasiList: [] as ClientNotifItem[],
			unreadNotifCount: 0
		};
	}

	const userKelompokId = locals.user.kelompokId;
	let userDesaId: number | null = null;
	let kelompokNama = 'Kelompok';

	// 1. Ambil info kelompok & desa jamaah (1 look-up cepat via Primary Key)
	if (userKelompokId) {
		const kel = db
			.select({
				id: kelompok.id,
				nama: kelompok.nama,
				desaId: kelompok.desaId
			})
			.from(kelompok)
			.where(eq(kelompok.id, userKelompokId))
			.get();

		if (kel) {
			userDesaId = kel.desaId;
			kelompokNama = kel.nama;
		}
	}

	// 2. Dapatkan tanggal hari ini (YYYY-MM-DD)
	const now = new Date();
	const todayStr = now.toLocaleDateString('sv-SE'); // format ISO YYYY-MM-DD
	const tomorrow = new Date(now);
	tomorrow.setDate(now.getDate() + 1);
	const tomorrowStr = tomorrow.toLocaleDateString('sv-SE');

	const notifikasiList: ClientNotifItem[] = [];

	// 3. Ambil Jadwal Pengajian Terdekat (Kelompok & Desa)
	// Query hemat: hanya ambil jadwal aktif yang belum lewat (tanggal >= todayStr)
	const scopeConditions = [];
	if (userKelompokId) {
		scopeConditions.push(
			and(
				eq(presensiJadwal.kelompokId, userKelompokId),
				eq(presensiJadwal.tingkatScope, 'Kelompok')
			)
		);
	}
	if (userDesaId) {
		scopeConditions.push(
			and(
				eq(presensiJadwal.desaId, userDesaId),
				eq(presensiJadwal.tingkatScope, 'Desa')
			)
		);
	}

	if (scopeConditions.length > 0) {
		// Jadwal mendatang (tanggal >= todayStr)
		const upcomingJadwal = db
			.select({
				id: presensiJadwal.id,
				tingkatScope: presensiJadwal.tingkatScope,
				tanggal: presensiJadwal.tanggal,
				jamMulai: presensiJadwal.jamMulai,
				jamSelesai: presensiJadwal.jamSelesai,
				namaKegiatan: presensiJadwal.namaKegiatan,
				detailMateri: presensiJadwal.detailMateri,
				isOverride: presensiJadwal.isOverride,
				status: presensiJadwal.status,
				lokasiNama: presensiJadwal.lokasiNama
			})
			.from(presensiJadwal)
			.where(
				and(
					gte(presensiJadwal.tanggal, todayStr),
					eq(presensiJadwal.status, 'aktif'),
					or(...scopeConditions)
				)
			)
			.orderBy(asc(presensiJadwal.tanggal), asc(presensiJadwal.jamMulai))
			.limit(4)
			.all();

		// Jika tidak ada jadwal mendatang, ambil 2 jadwal terbaru sebelumnya
		let displayedJadwal = upcomingJadwal;
		if (displayedJadwal.length === 0) {
			displayedJadwal = db
				.select({
					id: presensiJadwal.id,
					tingkatScope: presensiJadwal.tingkatScope,
					tanggal: presensiJadwal.tanggal,
					jamMulai: presensiJadwal.jamMulai,
					jamSelesai: presensiJadwal.jamSelesai,
					namaKegiatan: presensiJadwal.namaKegiatan,
					detailMateri: presensiJadwal.detailMateri,
					isOverride: presensiJadwal.isOverride,
					status: presensiJadwal.status,
					lokasiNama: presensiJadwal.lokasiNama
				})
				.from(presensiJadwal)
				.where(
					and(
						eq(presensiJadwal.status, 'aktif'),
						or(...scopeConditions)
					)
				)
				.orderBy(desc(presensiJadwal.tanggal), desc(presensiJadwal.jamMulai))
				.limit(2)
				.all();
		}

		// Transformasi jadwal ke format notifikasi item
		for (const j of displayedJadwal) {
			const isToday = j.tanggal === todayStr;
			const isTomorrow = j.tanggal === tomorrowStr;

			let waktuLabel = j.tanggal;
			if (isToday) waktuLabel = 'Hari Ini';
			else if (isTomorrow) waktuLabel = 'Besok';

			const jamText = j.jamMulai ? `${j.jamMulai} WIB` : '';
			const materiText = j.detailMateri ? ` • Materi: ${j.detailMateri}` : '';
			const lokasiText = j.lokasiNama ? ` (${j.lokasiNama})` : '';

			let statusBadge = j.tingkatScope;
			let badgeVariant: ClientNotifItem['badgeVariant'] = 'primary';
			let isImportant = isToday || isTomorrow;

			if (j.isOverride) {
				statusBadge = 'Perubahan Jadwal';
				badgeVariant = 'warning';
				isImportant = true;
			} else if (isToday) {
				statusBadge = 'Hari Ini';
				badgeVariant = 'emerald';
			}

			notifikasiList.push({
				id: `jadwal-${j.id}`,
				kategori: 'jadwal',
				judul: `${j.namaKegiatan} [${j.tingkatScope}]`,
				pesan: `${waktuLabel} pukul ${jamText}${lokasiText}${materiText}`,
				waktu: `${j.tanggal} ${jamText}`.trim(),
				statusBadge,
				badgeVariant,
				link: '/presensi',
				isImportant,
				tanggalRaw: j.tanggal
			});
		}
	}

	// 4. Ambil Status Kehadiran / Izin Terakhir Jamaah (Maksimal 2 item terbaru)
	const userPresensiList = db
		.select({
			id: presensiKehadiran.id,
			status: presensiKehadiran.status,
			statusApproval: presensiKehadiran.statusApproval,
			catatanAdmin: presensiKehadiran.catatanAdmin,
			keteranganIzin: presensiKehadiran.keteranganIzin,
			namaKegiatan: presensiJadwal.namaKegiatan,
			tanggalJadwal: presensiJadwal.tanggal
		})
		.from(presensiKehadiran)
		.innerJoin(presensiJadwal, eq(presensiKehadiran.jadwalId, presensiJadwal.id))
		.where(eq(presensiKehadiran.userId, locals.user.id))
		.orderBy(desc(presensiJadwal.tanggal), desc(presensiKehadiran.id))
		.limit(2)
		.all();

	for (const p of userPresensiList) {
		let badgeVariant: ClientNotifItem['badgeVariant'] = 'primary';
		let isImportant = false;

		if (p.statusApproval === 'Menunggu Persetujuan') {
			badgeVariant = 'amber';
			isImportant = true;
		} else if (p.statusApproval === 'Disetujui') {
			badgeVariant = 'emerald';
		} else if (p.statusApproval === 'Ditolak') {
			badgeVariant = 'rose';
			isImportant = true;
		}

		const catatanText = p.catatanAdmin ? ` • Catatan: ${p.catatanAdmin}` : '';

		notifikasiList.push({
			id: `presensi-${p.id}`,
			kategori: 'presensi',
			judul: `Status ${p.status}: ${p.namaKegiatan}`,
			pesan: `Persetujuan: ${p.statusApproval || 'Disetujui'}${catatanText}`,
			waktu: p.tanggalJadwal,
			statusBadge: p.statusApproval || p.status,
			badgeVariant,
			link: '/presensi',
			isImportant,
			tanggalRaw: p.tanggalJadwal
		});
	}

	// 5. Hitung unread count (semua notifikasi yang penting atau jadwal hari ini/besok)
	const unreadNotifCount = notifikasiList.filter((n) => n.isImportant).length;

	return {
		notifikasiList,
		unreadNotifCount
	};
};

