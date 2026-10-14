/**
 * @file src/routes/(app)/presensi/+page.server.ts
 * @purpose Memuat jadwal pengajian dengan fallback lokasi kelompok, QR token, validasi radius GPS, serta mutasi presensi mandiri & permohonan izin dengan respon feedback ringkas bebas over-information sesuai DESIGN.md
 * @usedBy src/routes/(app)/presensi/+page.svelte
 * @dependencies src/lib/db, src/lib/db/schema, drizzle-orm, src/lib/server/upload, src/lib/presensi-waktu
 * @publicFunctions load, actions.presensiMandiri, actions.ajukanIzin
 * @sideEffects Validasi tanggal & jam mulai jadwal, validasi jarak radius Haversine lokasi kelompok, menyimpan file foto ke root uploads/presensi, dan menulis presensi_kehadiran ke SQLite
 */

import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db, first } from '#lib/db/index.js';
import { presensiJadwal, presensiKehadiran, kelompok } from '#lib/db/schema.js';
import { eq, desc, and } from 'drizzle-orm';
import { saveUploadedFile } from '#lib/server/upload.js';
import { validasiWaktuPresensi } from '#lib/presensi-waktu.js';

async function saveUploadedFoto(
	fileOrBase64: File | string | null | undefined,
	prefix: string
): Promise<string | null> {
	return saveUploadedFile(fileOrBase64, 'presensi', prefix);
}

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(303, '/login?redirectTo=/presensi');
	}

	const userKelompokId = locals.user.kelompokId;
	let kelompokNama = 'Kelompok';
	let kelompokData: (typeof kelompok.$inferSelect) | undefined = undefined;

	if (userKelompokId) {
		kelompokData = (await first(db.select().from(kelompok).where(eq(kelompok.id, userKelompokId))));
		if (kelompokData) kelompokNama = kelompokData.nama;
	}

	// Ambil jadwal kegiatan untuk kelompok jamaah
	const jadwalList = (await (userKelompokId ? db
				.select()
				.from(presensiJadwal)
				.where(eq(presensiJadwal.kelompokId, userKelompokId))
				.orderBy(desc(presensiJadwal.tanggal)) : []));

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

	const jadwalWithStatus = jadwalList.map((j) => {
		const rec = recordMap.get(j.id);
		// Prioritaskan lokasi jadwal jika ada, fallback ke lokasi basis kelompok
		const venueLat = j.latitude || kelompokData?.latitude || null;
		const venueLng = j.longitude || kelompokData?.longitude || null;
		const venueRadius = j.radiusMeter || kelompokData?.radiusMeter || 100;
		const venueNama = j.lokasiNama || kelompokData?.lokasiNama || kelompokData?.nama || null;
		const venueGmaps = j.gmapsUrl || kelompokData?.gmapsUrl || null;
		const statusWaktu = validasiWaktuPresensi(j.tanggal, j.jamMulai);

		return {
			id: j.id,
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

	// QR Payload unik jamaah (format: SGQR:userId:kelompokId)
	const qrPayload = `SGQR:${locals.user.id}:${userKelompokId || 0}`;

	return {
		user: locals.user,
		kelompokNama,
		kelompokData: kelompokData
			? {
					id: kelompokData.id,
					nama: kelompokData.nama,
					lokasiNama: kelompokData.lokasiNama,
					latitude: kelompokData.latitude,
					longitude: kelompokData.longitude,
					radiusMeter: kelompokData.radiusMeter,
					gmapsUrl: kelompokData.gmapsUrl
				}
			: null,
		qrPayload,
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

			// Ambil detail kelompok untuk validasi jarak radius
			const targetKelompokId = jadwal.kelompokId || locals.user.kelompokId;
			const targetKelompok = targetKelompokId
				? await first(db.select().from(kelompok).where(eq(kelompok.id, targetKelompokId)))
				: null;

			const targetLatStr = jadwal.latitude || targetKelompok?.latitude || null;
			const targetLngStr = jadwal.longitude || targetKelompok?.longitude || null;
			const targetRadius = jadwal.radiusMeter || targetKelompok?.radiusMeter || 100;

			if (!targetLatStr || !targetLngStr) {
				return fail(400, {
					error: 'Lokasi kelompok belum didaftarkan oleh admin. Anda tidak dapat presensi menggunakan lokasi. Silakan gunakan metode Hadir Online dengan foto bukti gambar.'
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
					error: `Di luar radius lokasi kelompok (~${distanceMeters}m). Silakan beralih ke Hadir Online.`
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
	}
};
