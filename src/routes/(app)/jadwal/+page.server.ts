/**
 * @file src/routes/(app)/jadwal/+page.server.ts
 * @purpose Memuat seluruh jadwal pengajian kelompok & desa dalam satu bulan kalender (baik yang sudah lewat maupun akan datang) lengkap dengan riwayat status kehadiran jamaah dan parameter navigasi kembali (presensi atau beranda)
 * @usedBy Route client '/jadwal' pada src/routes/(app)/jadwal/+page.svelte
 * @dependencies src/lib/db, src/lib/db/schema, src/lib/presensi-waktu, drizzle-orm
 * @publicFunctions load
 * @sideEffects Query kelompok, desa, presensi_jadwal, dan presensi_kehadiran dari PostgreSQL dalam rentang satu bulan kalender terindeks
 */

import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db, first } from '#lib/db/index.js';
import { desa, kelompok, presensiJadwal, presensiKehadiran } from '#lib/db/schema.js';
import { eq, and, gte, lte, asc, inArray } from 'drizzle-orm';
import { getWaktuSekarangWIB, validasiWaktuPresensi } from '#lib/presensi-waktu.js';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) {
		throw redirect(303, '/login?redirectTo=/jadwal');
	}

	const waktuWIB = getWaktuSekarangWIB();
	const today = waktuWIB.tanggal;

	// Resolusi parameter bulan & tahun (fallback ke bulan dan tahun saat ini)
	const currentYear = parseInt(today.slice(0, 4), 10);
	const currentMonth = parseInt(today.slice(5, 7), 10);

	let tahun = parseInt(url.searchParams.get('tahun') || '', 10);
	if (isNaN(tahun) || tahun < 2020 || tahun > 2100) {
		tahun = currentYear;
	}

	let bulan = parseInt(url.searchParams.get('bulan') || '', 10);
	if (isNaN(bulan) || bulan < 1 || bulan > 12) {
		bulan = currentMonth;
	}

	const from = url.searchParams.get('from') === 'presensi' ? 'presensi' : 'beranda';

	// Hitung rentang tanggal awal dan akhir bulan
	const lastDay = new Date(tahun, bulan, 0).getDate();
	const padBulan = String(bulan).padStart(2, '0');
	const startDate = `${tahun}-${padBulan}-01`;
	const endDate = `${tahun}-${padBulan}-${String(lastDay).padStart(2, '0')}`;

	let kelompokNama = 'Kelompok Jamaah';
	let desaId: number | null = null;
	let desaNama = 'Desa Jamaah';
	let kelompokData: (typeof kelompok.$inferSelect) | undefined = undefined;

	if (locals.user.kelompokId) {
		kelompokData = (await first(db
			.select()
			.from(kelompok)
			.where(eq(kelompok.id, locals.user.kelompokId))
		));

		if (kelompokData) {
			kelompokNama = kelompokData.nama;
			desaId = kelompokData.desaId;
			if (desaId) {
				const d = (await first(db.select().from(desa).where(eq(desa.id, desaId))));
				if (d) desaNama = d.nama;
			}
		}
	}

	// Query jadwal kegiatan kelompok untuk bulan terpilih (Single Query terindeks)
	const rawJadwalKelompok = locals.user.kelompokId
		? await db
				.select()
				.from(presensiJadwal)
				.where(
					and(
						eq(presensiJadwal.kelompokId, locals.user.kelompokId),
						eq(presensiJadwal.tingkatScope, 'Kelompok'),
						gte(presensiJadwal.tanggal, startDate),
						lte(presensiJadwal.tanggal, endDate)
					)
				)
				.orderBy(asc(presensiJadwal.tanggal), asc(presensiJadwal.jamMulai))
		: [];

	// Query jadwal kegiatan desa untuk bulan terpilih (Single Query terindeks)
	const rawJadwalDesa = desaId
		? await db
				.select()
				.from(presensiJadwal)
				.where(
					and(
						eq(presensiJadwal.desaId, desaId),
						eq(presensiJadwal.tingkatScope, 'Desa'),
						gte(presensiJadwal.tanggal, startDate),
						lte(presensiJadwal.tanggal, endDate)
					)
				)
				.orderBy(asc(presensiJadwal.tanggal), asc(presensiJadwal.jamMulai))
		: [];

	// Kumpulkan ID jadwal untuk batch query riwayat kehadiran jamaah ini
	const allJadwalIds = [...rawJadwalKelompok, ...rawJadwalDesa].map((j) => j.id);

	const kehadiranMap = new Map<number, typeof presensiKehadiran.$inferSelect>();
	if (allJadwalIds.length > 0) {
		const records = await db
			.select()
			.from(presensiKehadiran)
			.where(
				and(
					eq(presensiKehadiran.userId, locals.user.id),
					inArray(presensiKehadiran.jadwalId, allJadwalIds)
				)
			);
		for (const rec of records) {
			kehadiranMap.set(rec.jadwalId, rec);
		}
	}

	// Transformasi data jadwal dengan status kehadiran, lokasi, dan validasi waktu presensi
	function transformJadwal(j: (typeof presensiJadwal.$inferSelect)) {
		const rec = kehadiranMap.get(j.id);
		const venueLat = j.latitude || kelompokData?.latitude || null;
		const venueLng = j.longitude || kelompokData?.longitude || null;
		const venueNama = j.lokasiNama || kelompokData?.lokasiNama || kelompokData?.nama || null;
		const venueGmaps = j.gmapsUrl || kelompokData?.gmapsUrl || null;
		const statusWaktu = validasiWaktuPresensi(j.tanggal, j.jamMulai);

		return {
			id: j.id,
			tanggal: j.tanggal,
			jamMulai: j.jamMulai,
			jamSelesai: j.jamSelesai,
			namaKegiatan: j.namaKegiatan,
			detailMateri: j.detailMateri,
			status: j.status,
			isRutin: Boolean(j.templateId),
			isOverride: j.isOverride,
			lokasiNama: venueNama,
			latitude: venueLat,
			longitude: venueLng,
			gmapsUrl: venueGmaps,
			isHariIni: j.tanggal === today,
			isSudahLewat: j.tanggal < today,
			isAkanDatang: j.tanggal > today,
			bisaPresensi: statusWaktu.isValid,
			pesanStatusWaktu: statusWaktu.error || null,
			statusKehadiran: rec?.status || null,
			metodeKehadiran: rec?.metodeKehadiran || null,
			statusApproval: rec?.statusApproval || null
		};
	}

	return {
		user: locals.user,
		kelompokNama,
		desaNama,
		bulan,
		tahun,
		today,
		from,
		jadwalKelompok: rawJadwalKelompok.map(transformJadwal),
		jadwalDesa: rawJadwalDesa.map(transformJadwal)
	};
};

