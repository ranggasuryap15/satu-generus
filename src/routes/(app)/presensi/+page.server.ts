/**
 * @file src/routes/(app)/presensi/+page.server.ts
 * @purpose Memuat jadwal pengajian, riwayat absensi, QR token, serta menangani aksi presensi mandiri (offline GPS + foto kamera, online foto bukti) dan pengajuan izin/sakit (menunggu approval admin)
 * @usedBy src/routes/(app)/presensi/+page.svelte
 * @dependencies src/lib/db, src/lib/db/schema, drizzle-orm, node:fs, node:path
 * @publicFunctions load, actions.presensiMandiri, actions.ajukanIzin
 * @sideEffects Menulis file bukti foto ke static/uploads/presensi dan menyimpan record presensi_kehadiran ke SQLite
 */

import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/db';
import { presensiJadwal, presensiKehadiran, kelompok } from '$lib/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import fs from 'node:fs';
import path from 'node:path';

async function saveUploadedFoto(
	fileOrBase64: File | string | null | undefined,
	prefix: string
): Promise<string | null> {
	if (!fileOrBase64) return null;

	const uploadDir = path.resolve(process.cwd(), 'static/uploads/presensi');
	if (!fs.existsSync(uploadDir)) {
		fs.mkdirSync(uploadDir, { recursive: true });
	}

	// 1. Jika dikirim sebagai Base64 Data URL (dari kamera client-side canvas)
	if (typeof fileOrBase64 === 'string') {
		if (fileOrBase64.startsWith('data:image/')) {
			const matches = fileOrBase64.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
			if (matches) {
				const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
				const buffer = Buffer.from(matches[2], 'base64');
				const filename = `${prefix}_${Date.now()}.${ext}`;
				fs.writeFileSync(path.join(uploadDir, filename), buffer);
				return `/uploads/presensi/${filename}`;
			}
		}
		return fileOrBase64.trim() ? fileOrBase64 : null;
	}

	// 2. Jika dikirim sebagai File multipart
	if (fileOrBase64 instanceof File && fileOrBase64.size > 0) {
		const rawExt = fileOrBase64.type.split('/')[1] || 'jpg';
		const ext = rawExt === 'jpeg' ? 'jpg' : rawExt;
		const filename = `${prefix}_${Date.now()}.${ext}`;
		const arrayBuffer = await fileOrBase64.arrayBuffer();
		fs.writeFileSync(path.join(uploadDir, filename), Buffer.from(arrayBuffer));
		return `/uploads/presensi/${filename}`;
	}

	return null;
}

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

	const recordMap = new Map<number, (typeof kehadiranRecords)[number]>();
	kehadiranRecords.forEach((k) => {
		recordMap.set(k.jadwalId, k);
	});

	const jadwalWithStatus = jadwalList.map((j) => {
		const rec = recordMap.get(j.id);
		return {
			id: j.id,
			tanggal: j.tanggal,
			namaKegiatan: j.namaKegiatan,
			statusKehadiran: rec?.status || 'Belum Terdata',
			metodeKehadiran: rec?.metodeKehadiran || null,
			fotoUrl: rec?.fotoUrl || null,
			latitude: rec?.latitude || null,
			longitude: rec?.longitude || null,
			alamatLokasi: rec?.alamatLokasi || null,
			keteranganIzin: rec?.keteranganIzin || null,
			statusApproval: rec?.statusApproval || (rec ? 'Disetujui' : null),
			catatanAdmin: rec?.catatanAdmin || null,
			waktuScan: rec?.waktuScan || null
		};
	});

	// QR Payload unik jamaah (format: SGQR:userId:kelompokId)
	const qrPayload = `SGQR:${locals.user.id}:${userKelompokId || 0}`;

	return {
		user: locals.user,
		kelompokNama,
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

		// Validasi Kriteria Hadir Offline
		if (metode === 'offline') {
			if (!latitude || !longitude) {
				return fail(400, {
					error: 'Presensi Hadir Offline wajib mendeteksi lokasi GPS Anda. Aktifkan lokasi perangkat dan coba lagi.'
				});
			}
			if ((!fotoFile || (fotoFile instanceof File && fotoFile.size === 0)) && !fotoBase64) {
				return fail(400, {
					error: 'Presensi Hadir Offline wajib menyertakan foto langsung dari kamera.'
				});
			}
		}

		// Validasi Kriteria Hadir Online
		if (metode === 'online') {
			if ((!fotoFile || (fotoFile instanceof File && fotoFile.size === 0)) && !fotoBase64) {
				return fail(400, {
					error: 'Presensi Hadir Online wajib menyertakan foto bukti (kamera atau screenshot Zoom/SDC).'
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
			const existing = db
				.select()
				.from(presensiKehadiran)
				.where(
					and(
						eq(presensiKehadiran.jadwalId, jadwalId),
						eq(presensiKehadiran.userId, locals.user.id)
					)
				)
				.get();

			const nowUnix = Math.floor(Date.now() / 1000);

			if (existing) {
				db.update(presensiKehadiran)
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
					.run();
			} else {
				db.insert(presensiKehadiran)
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
					.run();
			}
		} catch (dbErr) {
			console.error('Error saat menyimpan presensi mandiri:', dbErr);
			return fail(500, { error: 'Terjadi kesalahan sistem saat menyimpan kehadiran.' });
		}

		return {
			success: true,
			message: `Presensi Hadir ${metode === 'offline' ? 'Offline' : 'Online'} berhasil dicatat!`
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
			const existing = db
				.select()
				.from(presensiKehadiran)
				.where(
					and(
						eq(presensiKehadiran.jadwalId, jadwalId),
						eq(presensiKehadiran.userId, locals.user.id)
					)
				)
				.get();

			const nowUnix = Math.floor(Date.now() / 1000);

			if (existing) {
				db.update(presensiKehadiran)
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
					.run();
			} else {
				db.insert(presensiKehadiran)
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
					.run();
			}
		} catch (dbErr) {
			console.error('Error saat menyimpan permohonan izin:', dbErr);
			return fail(500, { error: 'Terjadi kesalahan sistem saat mengajukan izin.' });
		}

		return {
			success: true,
			message: 'Permohonan izin berhasil diajukan dan sedang menunggu persetujuan admin!'
		};
	}
};
