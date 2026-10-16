/**
 * @file src/routes/(app)/presensi/+page.server.ts
 * @purpose Memuat jadwal pengajian aktif rentang kemarin s/d besok (H-1 s/d H+1) tingkat kelompok & desa, pewarisan lokasi kelompok/desa persisten yang terikat ke profil jamaah tanpa tergantung ada/tidaknya jadwal aktif, QR token unik, validasi radius GPS, serta mutasi presensi mandiri, permohonan izin, & kalibrasi lokasi kelompok oleh admin
 * @usedBy src/routes/(app)/presensi/+page.svelte
 * @dependencies src/lib/db, src/lib/db/schema, drizzle-orm, src/lib/server/upload, src/lib/presensi-waktu (validasiWaktuPresensi, getWaktuSekarangWIB)
 * @publicFunctions load, actions.presensiMandiri, actions.ajukanIzin, actions.updateLokasiKelompokSaatIni
 * @sideEffects Validasi tanggal & jam mulai jadwal, validasi jarak radius Haversine lokasi kelompok/desa, update lokasi koordinat kelompok oleh admin, menyimpan file foto ke root uploads/presensi, dan menulis presensi_kehadiran ke database
 */

import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db, first } from '#lib/db/index.js';
import { presensiJadwal, presensiKehadiran, kelompok, desa } from '#lib/db/schema.js';
import { eq, desc, and, or } from 'drizzle-orm';
import { saveUploadedFile } from '#lib/server/upload.js';
import { validasiWaktuPresensi, getWaktuSekarangWIB } from '#lib/presensi-waktu.js';

async function saveUploadedFoto(
	fileOrBase64: File | string | null | undefined,
	prefix: string
): Promise<string | null> {
	return saveUploadedFile(fileOrBase64, 'presensi', prefix);
}

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) {
		throw redirect(303, '/login?redirectTo=/presensi');
	}

	const userKelompokId = locals.user.kelompokId;
	let kelompokNama = 'Kelompok';
	let kelompokData: (typeof kelompok.$inferSelect) | undefined = undefined;
	let desaData: (typeof desa.$inferSelect) | undefined = undefined;
	let desaLokasiKelompok: (typeof kelompok.$inferSelect) | undefined = undefined;

	if (userKelompokId) {
		kelompokData = (await first(db.select().from(kelompok).where(eq(kelompok.id, userKelompokId))));
		if (kelompokData) {
			kelompokNama = kelompokData.nama;
			if (kelompokData.desaId) {
				desaData = (await first(db.select().from(desa).where(eq(desa.id, kelompokData.desaId))));
				if (desaData?.lokasiKelompokId) {
					desaLokasiKelompok = await first(
						db.select().from(kelompok).where(eq(kelompok.id, desaData.lokasiKelompokId))
					);
				}
			}
		}
	}

	// Lokasi efektif desa (jika desa menunjuk lokasiKelompokId)
	const desaEffectiveLat = desaData?.latitude || desaLokasiKelompok?.latitude || null;
	const desaEffectiveLng = desaData?.longitude || desaLokasiKelompok?.longitude || null;
	const desaEffectiveRadius = desaData?.radiusMeter || desaLokasiKelompok?.radiusMeter || 100;
	const desaEffectiveLokasiNama = desaData?.lokasiNama || desaData?.nama || desaLokasiKelompok?.lokasiNama || desaLokasiKelompok?.nama || null;
	const desaEffectiveGmapsUrl = desaData?.gmapsUrl || desaLokasiKelompok?.gmapsUrl || null;

	// Lokasi basis kelompok jamaah (fallback ke desa jika kelompok belum set lat/lng)
	const kelompokLat = kelompokData?.latitude || desaEffectiveLat || null;
	const kelompokLng = kelompokData?.longitude || desaEffectiveLng || null;
	const kelompokRadius = kelompokData?.radiusMeter || desaEffectiveRadius || 100;
	const kelompokLokasiNama = kelompokData?.lokasiNama || kelompokData?.nama || desaEffectiveLokasiNama || kelompokNama;
	const kelompokGmapsUrl = kelompokData?.gmapsUrl || desaEffectiveGmapsUrl || null;

	// Ambil jadwal kegiatan untuk kelompok jamaah maupun desa jamaah
	const userDesaId = kelompokData?.desaId || null;
	const jadwalList = (await (userKelompokId
		? db
				.select()
				.from(presensiJadwal)
				.where(
					userDesaId
						? or(eq(presensiJadwal.kelompokId, userKelompokId), eq(presensiJadwal.desaId, userDesaId))
						: eq(presensiJadwal.kelompokId, userKelompokId)
				)
				.orderBy(desc(presensiJadwal.tanggal))
		: userDesaId
			? db
					.select()
					.from(presensiJadwal)
					.where(eq(presensiJadwal.desaId, userDesaId))
					.orderBy(desc(presensiJadwal.tanggal))
			: []));

	// Ambil riwayat kehadiran jamaah ini
	const kehadiranRecords = (await db
		.select()
		.from(presensiKehadiran)
		.where(eq(presensiKehadiran.userId, locals.user.id))
	);
	const recordMap = new Map<number, (typeof kehadiranRecords)[number]>();
	kehadiranRecords.forEach((k) => {
		recordMap.set(k.jadwalId, k);
	});

	// Hitung rentang kemarin (H-1), hari ini (H), dan besok (H+1) dalam zona waktu WIB
	const waktuWIB = getWaktuSekarangWIB();
	const hariIni = waktuWIB.tanggal;
	const dHariIni = new Date(`${hariIni}T12:00:00Z`);
	const dKemarin = new Date(dHariIni.getTime() - 24 * 60 * 60 * 1000);
	const dBesok = new Date(dHariIni.getTime() + 24 * 60 * 60 * 1000);
	const tanggalKemarin = dKemarin.toISOString().slice(0, 10);
	const tanggalBesok = dBesok.toISOString().slice(0, 10);

	const jadwalWithStatus = jadwalList.map((j) => {
		const rec = recordMap.get(j.id);
		const isDesaScope = j.tingkatScope === 'Desa' || Boolean(j.desaId && !j.kelompokId);
		const defaultLat = isDesaScope ? (desaEffectiveLat || kelompokLat) : (kelompokLat || desaEffectiveLat);
		const defaultLng = isDesaScope ? (desaEffectiveLng || kelompokLng) : (kelompokLng || desaEffectiveLng);
		const defaultRadius = isDesaScope ? (desaEffectiveRadius || kelompokRadius) : (kelompokRadius || desaEffectiveRadius);
		const defaultNama = isDesaScope ? (desaEffectiveLokasiNama || kelompokLokasiNama) : (kelompokLokasiNama || desaEffectiveLokasiNama);
		const defaultGmaps = isDesaScope ? (desaEffectiveGmapsUrl || kelompokGmapsUrl) : (kelompokGmapsUrl || desaEffectiveGmapsUrl);

		const venueLat = j.latitude || defaultLat || null;
		const venueLng = j.longitude || defaultLng || null;
		const venueRadius = j.radiusMeter || defaultRadius || 100;
		const venueNama = j.lokasiNama || defaultNama || null;
		const venueGmaps = j.gmapsUrl || defaultGmaps || null;
		const statusWaktu = validasiWaktuPresensi(j.tanggal, j.jamMulai);

		return {
			id: j.id,
			isDesaScope,
			tanggal: j.tanggal,
			jamMulai: j.jamMulai,
			jamSelesai: j.jamSelesai,
			namaKegiatan: j.namaKegiatan,
			lokasiNama: venueNama,
			latitudeVenue: venueLat,
			longitudeVenue: venueLng,
			radiusMeterVenue: venueRadius,
			gmapsUrlVenue: venueGmaps,
			hasVenueLocation: Boolean(venueLat && venueLng),
			hasCustomVenueLocation: Boolean(j.latitude && j.longitude),
			statusKehadiran: rec?.status || 'Belum Terdata',
			metodeKehadiran: rec?.metodeKehadiran || null,
			fotoUrl: rec?.fotoUrl || null,
			latitude: rec?.latitude || null,
			longitude: rec?.longitude || null,
			alamatLokasi: rec?.alamatLokasi || null,
			keteranganIzin: rec?.keteranganIzin || null,
			statusApproval: rec?.statusApproval || (rec ? 'Disetujui' : null),
			catatanAdmin: rec?.catatanAdmin || null,
			waktuScan: rec?.waktuScan || null,
			bisaPresensi: statusWaktu.isValid,
			pesanStatusWaktu: statusWaktu.error || null,
			waktuBukaPresensi: statusWaktu.bukaPukul
		};
	});

	// List pengajian aktif untuk pilihan dropdown (HANYA rentang kemarin s/d besok)
	const activeJadwalList = jadwalWithStatus
		.filter((j) => j.tanggal >= tanggalKemarin && j.tanggal <= tanggalBesok)
		.sort((a, b) => {
			if (a.tanggal !== b.tanggal) return a.tanggal.localeCompare(b.tanggal);
			return (a.jamMulai || '').localeCompare(b.jamMulai || '');
		});

	// Default jadwalId dari URL query param jika ada
	const queryJadwalId = parseInt(url.searchParams.get('jadwalId') || '', 10);
	const targetJadwal = !isNaN(queryJadwalId) ? jadwalWithStatus.find((j) => j.id === queryJadwalId) : undefined;
	if (targetJadwal && !activeJadwalList.some((j) => j.id === targetJadwal.id)) {
		activeJadwalList.push(targetJadwal);
		activeJadwalList.sort((a, b) => {
			if (a.tanggal !== b.tanggal) return a.tanggal.localeCompare(b.tanggal);
			return (a.jamMulai || '').localeCompare(b.jamMulai || '');
		});
	}
	const defaultJadwalId = targetJadwal ? targetJadwal.id : activeJadwalList[0]?.id || null;

	// QR Payload unik jamaah (format: SGQR:userId:kelompokId)
	const qrPayload = `SGQR:${locals.user.id}:${userKelompokId || 0}`;

	return {
		user: locals.user,
		kelompokNama,
		kelompokData: {
			id: kelompokData?.id || null,
			nama: kelompokNama,
			lokasiNama: kelompokLokasiNama,
			latitude: kelompokLat,
			longitude: kelompokLng,
			radiusMeter: kelompokRadius,
			gmapsUrl: kelompokGmapsUrl
		},
		qrPayload,
		activeJadwalList,
		defaultJadwalId,
		jadwalList: jadwalWithStatus
	};
};

export const actions: Actions = {
	presensiMandiri: async ({ request, locals }) => {
		if (!locals.user) {
			return fail(401, { error: 'Anda harus login untuk melakukan presensi.' });
		}

		const formData = await request.formData();
		const jadwalIdStr = formData.get('jadwalId')?.toString() || '';
		const jadwalId = parseInt(jadwalIdStr, 10);
		const metode = (formData.get('metode')?.toString() || 'offline') as 'offline' | 'online';
		const latitude = formData.get('latitude')?.toString()?.trim() || null;
		const longitude = formData.get('longitude')?.toString()?.trim() || null;
		const alamatLokasi = formData.get('alamatLokasi')?.toString()?.trim() || null;
		const fotoFile = formData.get('foto');
		const fotoBase64 = formData.get('fotoBase64')?.toString();

		if (isNaN(jadwalId)) {
			return fail(400, { error: 'Pilih jadwal kegiatan pengajian terlebih dahulu.' });
		}

		// Validasi Jadwal Kegiatan
		const jadwal = (await first(db.select().from(presensiJadwal).where(eq(presensiJadwal.id, jadwalId))));
		if (!jadwal) {
			return fail(404, { error: 'Jadwal kegiatan pengajian tidak ditemukan.' });
		}

		if (jadwal.status !== 'aktif') {
			return fail(400, {
				error: `Kegiatan ini berstatus ${jadwal.status}, presensi tidak dapat dilakukan.`
			});
		}

		// Validasi Integritas Waktu: Tanggal sama & jam minimal 1 jam sebelum jam dimulai
		const validasiWaktu = validasiWaktuPresensi(jadwal.tanggal, jadwal.jamMulai);
		if (!validasiWaktu.isValid) {
			return fail(400, {
				error: validasiWaktu.error
			});
		}

		// Validasi Kriteria Hadir Offline
		if (metode === 'offline') {
			if (!latitude || !longitude) {
				return fail(400, {
					error: 'Presensi Hadir Offline wajib mendeteksi lokasi GPS Anda. Aktifkan lokasi perangkat dan coba lagi.'
				});
			}

			// Ambil detail kelompok dan desa untuk validasi jarak radius
			const targetKelompokId = jadwal.kelompokId || locals.user.kelompokId;
			const targetKelompok = targetKelompokId
				? await first(db.select().from(kelompok).where(eq(kelompok.id, targetKelompokId)))
				: null;

			const targetDesaId = jadwal.desaId || targetKelompok?.desaId;
			const targetDesa = targetDesaId
				? await first(db.select().from(desa).where(eq(desa.id, targetDesaId)))
				: null;

			let targetDesaLokasiKelompok: typeof targetKelompok = null;
			if (targetDesa?.lokasiKelompokId) {
				targetDesaLokasiKelompok = await first(
					db.select().from(kelompok).where(eq(kelompok.id, targetDesa.lokasiKelompokId))
				);
			}

			const isDesaSesi = jadwal.tingkatScope === 'Desa' || Boolean(jadwal.desaId && !jadwal.kelompokId);
			const targetDesaLat = targetDesa?.latitude || targetDesaLokasiKelompok?.latitude;
			const targetDesaLng = targetDesa?.longitude || targetDesaLokasiKelompok?.longitude;
			const targetDesaRadius = targetDesa?.radiusMeter || targetDesaLokasiKelompok?.radiusMeter;

			const fallbackLat = isDesaSesi
				? (targetDesaLat || targetKelompok?.latitude)
				: (targetKelompok?.latitude || targetDesaLat);
			const fallbackLng = isDesaSesi
				? (targetDesaLng || targetKelompok?.longitude)
				: (targetKelompok?.longitude || targetDesaLng);
			const fallbackRadius = isDesaSesi
				? (targetDesaRadius || targetKelompok?.radiusMeter)
				: (targetKelompok?.radiusMeter || targetDesaRadius);

			const targetLatStr = jadwal.latitude || fallbackLat || null;
			const targetLngStr = jadwal.longitude || fallbackLng || null;
			const targetRadius = jadwal.radiusMeter || fallbackRadius || 100;

			if (!targetLatStr || !targetLngStr) {
				return fail(400, {
					error: 'Lokasi kegiatan belum didaftarkan oleh admin. Anda tidak dapat presensi menggunakan lokasi. Silakan gunakan metode Hadir Online dengan foto bukti gambar.'
				});
			}

			// Hitung jarak Haversine di server
			const latUser = parseFloat(latitude);
			const lonUser = parseFloat(longitude);
			const latVenue = parseFloat(targetLatStr);
			const lonVenue = parseFloat(targetLngStr);

			if (isNaN(latUser) || isNaN(lonUser) || isNaN(latVenue) || isNaN(lonVenue)) {
				return fail(400, {
					error: 'Koordinat lokasi tidak valid.'
				});
			}

			const R = 6371e3; // Radius bumi dalam meter
			const dLat = ((latVenue - latUser) * Math.PI) / 180;
			const dLon = ((lonVenue - lonUser) * Math.PI) / 180;
			const a =
				Math.sin(dLat / 2) * Math.sin(dLat / 2) +
				Math.cos((latUser * Math.PI) / 180) *
					Math.cos((latVenue * Math.PI) / 180) *
					Math.sin(dLon / 2) *
					Math.sin(dLon / 2);
			const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
			const distanceMeters = Math.round(R * c);

			if (distanceMeters > targetRadius) {
				return fail(400, {
					error: `Di luar radius lokasi kegiatan (~${distanceMeters}m). Silakan beralih ke Hadir Online.`
				});
			}

			if ((!fotoFile || (fotoFile instanceof File && fotoFile.size === 0)) && !fotoBase64) {
				return fail(400, {
					error: 'Wajib mengambil foto kamera di lokasi.'
				});
			}
		}

		// Validasi Kriteria Hadir Online
		if (metode === 'online') {
			if ((!fotoFile || (fotoFile instanceof File && fotoFile.size === 0)) && !fotoBase64) {
				return fail(400, {
					error: 'Wajib mengunggah foto bukti / screenshot.'
				});
			}
		}

		// Simpan Bukti Foto
		let fotoUrl: string | null = null;
		try {
			fotoUrl = await saveUploadedFoto(
				fotoBase64 || (fotoFile as File),
				`hadir_${metode}_${locals.user.id}`
			);
		} catch (uploadErr) {
			console.error('Gagal menyimpan foto bukti presensi:', uploadErr);
			return fail(500, { error: 'Gagal mengunggah foto bukti kehadiran.' });
		}

		if (!fotoUrl) {
			return fail(400, { error: 'Foto bukti kehadiran tidak valid.' });
		}

		// Simpan atau Perbarui Kehadiran
		try {
			const existing = (await first(db
				.select()
				.from(presensiKehadiran)
				.where(
					and(
						eq(presensiKehadiran.jadwalId, jadwalId),
						eq(presensiKehadiran.userId, locals.user.id)
					)
				)
				));

			const nowUnix = Math.floor(Date.now() / 1000);

			if (existing) {
(await db.update(presensiKehadiran)
					.set({
						status: 'Hadir',
						metodeKehadiran: metode,
						fotoUrl,
						latitude,
						longitude,
						alamatLokasi,
						keteranganIzin: null,
						statusApproval: 'Disetujui',
						waktuScan: nowUnix
					})
					.where(eq(presensiKehadiran.id, existing.id))
);
			} else {
(await db.insert(presensiKehadiran)
					.values({
						jadwalId,
						userId: locals.user.id,
						status: 'Hadir',
						metodeKehadiran: metode,
						fotoUrl,
						latitude,
						longitude,
						alamatLokasi,
						keteranganIzin: null,
						statusApproval: 'Disetujui',
						waktuScan: nowUnix
					})
);
			}
		} catch (dbErr) {
			console.error('Error saat menyimpan presensi mandiri:', dbErr);
			return fail(500, { error: 'Terjadi kesalahan sistem saat menyimpan kehadiran.' });
		}

		return {
			success: true,
			message: 'Presensi Berhasil'
		};
	},

	ajukanIzin: async ({ request, locals }) => {
		if (!locals.user) {
			return fail(401, { error: 'Anda harus login untuk mengajukan permohonan izin.' });
		}

		const formData = await request.formData();
		const jadwalIdStr = formData.get('jadwalId')?.toString() || '';
		const jadwalId = parseInt(jadwalIdStr, 10);
		const status = (formData.get('status')?.toString() || 'Izin') as 'Izin' | 'Sakit';
		const alasan = formData.get('alasan')?.toString()?.trim() || '';
		const fotoFile = formData.get('foto');
		const fotoBase64 = formData.get('fotoBase64')?.toString();

		if (isNaN(jadwalId)) {
			return fail(400, { error: 'Pilih jadwal kegiatan pengajian terlebih dahulu.' });
		}

		if (!alasan) {
			return fail(400, { error: 'Alasan permohonan izin / sakit wajib diisi.' });
		}

		let fotoUrl: string | null = null;
		if (
			(fotoFile && fotoFile instanceof File && fotoFile.size > 0) ||
			(fotoBase64 && fotoBase64.trim())
		) {
			try {
				fotoUrl = await saveUploadedFoto(
					fotoBase64 || (fotoFile as File),
					`izin_${status.toLowerCase()}_${locals.user.id}`
				);
			} catch (uploadErr) {
				console.error('Gagal mengunggah foto bukti izin:', uploadErr);
			}
		}

		try {
			const existing = (await first(db
				.select()
				.from(presensiKehadiran)
				.where(
					and(
						eq(presensiKehadiran.jadwalId, jadwalId),
						eq(presensiKehadiran.userId, locals.user.id)
					)
				)
				));

			const nowUnix = Math.floor(Date.now() / 1000);

			if (existing) {
(await db.update(presensiKehadiran)
					.set({
						status,
						metodeKehadiran: 'izin',
						fotoUrl,
						latitude: null,
						longitude: null,
						alamatLokasi: null,
						keteranganIzin: alasan,
						statusApproval: 'Menunggu Persetujuan',
						waktuScan: nowUnix
					})
					.where(eq(presensiKehadiran.id, existing.id))
);
			} else {
(await db.insert(presensiKehadiran)
					.values({
						jadwalId,
						userId: locals.user.id,
						status,
						metodeKehadiran: 'izin',
						fotoUrl,
						latitude: null,
						longitude: null,
						alamatLokasi: null,
						keteranganIzin: alasan,
						statusApproval: 'Menunggu Persetujuan',
						waktuScan: nowUnix
					})
);
			}
		} catch (dbErr) {
			console.error('Error saat menyimpan permohonan izin:', dbErr);
			return fail(500, { error: 'Terjadi kesalahan sistem saat mengajukan izin.' });
		}

		return {
			success: true,
			message: 'Permohonan Terkirim'
		};
	},

	updateLokasiKelompokSaatIni: async ({ request, locals }) => {
		if (!locals.user || !locals.isAdmin) {
			return fail(403, { error: 'Hanya admin yang memiliki akses untuk menyinkronkan lokasi kelompok.' });
		}
		if (!locals.user.kelompokId) {
			return fail(400, { error: 'Akun Anda tidak terikat dengan kelompok manapun.' });
		}

		const formData = await request.formData();
		const lat = formData.get('latitude')?.toString()?.trim();
		const lng = formData.get('longitude')?.toString()?.trim();
		const lokasiNama = formData.get('lokasiNama')?.toString()?.trim();
		const radiusMeterStr = formData.get('radiusMeter')?.toString()?.trim();
		const radiusMeter = radiusMeterStr ? parseInt(radiusMeterStr, 10) : undefined;

		if (!lat || !lng) {
			return fail(400, { error: 'Koordinat GPS saat ini belum terdeteksi.' });
		}

		try {
			const updateData: {
				latitude: string;
				longitude: string;
				lokasiNama?: string;
				radiusMeter?: number;
			} = {
				latitude: lat,
				longitude: lng
			};

			if (lokasiNama) {
				updateData.lokasiNama = lokasiNama;
			}
			if (radiusMeter && !isNaN(radiusMeter) && radiusMeter > 0) {
				updateData.radiusMeter = radiusMeter;
			}

			await db
				.update(kelompok)
				.set(updateData)
				.where(eq(kelompok.id, locals.user.kelompokId));

			return {
				success: true,
				message: 'Titik acuan lokasi kelompok berhasil disinkronkan ke posisi GPS saat ini.'
			};
		} catch (err) {
			console.error('Gagal memperbarui lokasi kelompok:', err);
			return fail(500, { error: 'Terjadi kesalahan sistem saat memperbarui lokasi kelompok.' });
		}
	}
};
