/**
 * @file src/routes/(admin)/admin/profil-wilayah/+page.server.ts
 * @purpose Backend controller halaman dedicated Profil Wilayah: manajemen lokasi & tempat pengajian (termasuk opsi pewarisan lokasi Desa dari Kelompok binaan), dashboard statistik jamaah & persentase capaian setoran isrun/FR bulan ini, daftar sesi pengajian terbaru dengan direct shortcut tambah jadwal, rekening/QRIS shodaqoh resmi, serta filter wilayah adaptif (Kelompok, Desa, Daerah)
 * @usedBy src/routes/(admin)/admin/profil-wilayah/+page.svelte
 * @dependencies src/lib/db, src/lib/db/schema, src/lib/server/scope, drizzle-orm, @sveltejs/kit, src/lib/server/upload
 * @publicFunctions load, actions (updateLokasi, addRekening, updateRekening, deleteRekening)
 * @sideEffects Query terindeks multi-tabel (keluarga, anggota_keluarga, presensi_jadwal, transaksi_fr, rekening_wilayah) dengan minimum I/O dan mutasi data lokasi/rekening
 */

import { fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { db, first } from '#lib/db/index.js';
import {
	daerah,
	desa,
	kelompok,
	rekeningWilayah,
	keluarga,
	anggotaKeluarga,
	users,
	transaksiFr,
	presensiJadwal
} from '#lib/db/schema.js';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { getAdminScope, getAccessibleWilayah, canManageRekening } from '#lib/server/scope.js';
import { saveUploadedFile } from '#lib/server/upload.js';

async function saveUploadedQris(fileOrBase64OrUrl: any): Promise<string | null> {
	return saveUploadedFile(fileOrBase64OrUrl, 'qris', 'qris');
}

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user || !locals.isAdmin) {
		throw redirect(303, '/login');
	}

	const roles = locals.roles || [];
	// Hanya seluruh jajaran pengurus 4S atau Superadmin/Pusat yang berhak melihat halaman profil wilayah
	const is4S = roles.some((r) => r.is4S === true || r.tingkatScope === 'Pusat');
	if (!is4S) {
		throw redirect(303, '/admin');
	}

	const adminScope = getAdminScope(roles);
	const accessibleWilayah = await getAccessibleWilayah(adminScope);

	const paramScope = url.searchParams.get('scope') as 'Pusat' | 'Daerah' | 'Desa' | 'Kelompok' | null;
	const paramId = url.searchParams.get('id') ? Number(url.searchParams.get('id')) : null;

	let activeScope: 'Pusat' | 'Daerah' | 'Desa' | 'Kelompok' = paramScope || 'Kelompok';
	let activeId: number | null = null;

	// Penentuan wilayah aktif berdasarkan scope role dan parameter URL
	if (paramScope && paramId) {
		if (paramScope === 'Kelompok') {
			if (adminScope.isPusat || accessibleWilayah.allowedKelompokIdSet.has(paramId)) {
				activeScope = 'Kelompok';
				activeId = paramId;
			}
		} else if (paramScope === 'Desa') {
			const desaAllowed = accessibleWilayah.desaList.some((d) => d.id === paramId);
			if (adminScope.isPusat || desaAllowed) {
				activeScope = 'Desa';
				activeId = paramId;
			}
		} else if (paramScope === 'Daerah') {
			const daerahAllowed = accessibleWilayah.daerahList.some((dr) => dr.id === paramId);
			if (adminScope.isPusat || daerahAllowed) {
				activeScope = 'Daerah';
				activeId = paramId;
			}
		}
	}

	// Default fallback sesuai hak akses jika paramId tidak ada di URL:
	const isAdminKelompok =
		adminScope.level === 'Kelompok' &&
		(adminScope.kelompokIds.length > 0 || Boolean(locals.user.kelompokId));

	if (!activeId && isAdminKelompok) {
		activeScope = 'Kelompok';
		activeId =
			adminScope.kelompokIds[0] ||
			locals.user.kelompokId ||
			(accessibleWilayah.kelompokList[0]?.id ?? null);

		if (activeId && !url.searchParams.get('id')) {
			const targetUrl = new URL(url);
			targetUrl.searchParams.set('scope', 'Kelompok');
			targetUrl.searchParams.set('id', String(activeId));
			throw redirect(303, targetUrl.pathname + targetUrl.search);
		}
	}

	// Ambil detail wilayah terpilih
	let profilData: any = null;
	let daftarRekening: Array<typeof rekeningWilayah.$inferSelect> = [];
	let canManageFinance = false;
	let kelompokInDesa: Array<{
		id: number;
		nama: string;
		lokasiNama: string | null;
		latitude: string | null;
		longitude: string | null;
		radiusMeter: number | null;
		gmapsUrl: string | null;
	}> = [];

	// Data Metrik Dashboard Jamaah & Isrun
	let dashboardStats = {
		totalJamaah: 0,
		totalKk: 0,
		totalLaki: 0,
		totalPerempuan: 0,
		totalWajibIsrun: 0,
		sudahBayarIsrunCount: 0,
		persenBayarIsrun: 0,
		totalNominalIsrunBulanIni: 0,
		tahunIni: new Date().getFullYear(),
		bulanIni: new Date().getMonth() + 1
	};

	// Daftar Jadwal Pengajian Terdekat / Terbaru
	let daftarJadwal: Array<typeof presensiJadwal.$inferSelect> = [];

	if (activeScope && activeId) {
		canManageFinance = await canManageRekening(roles, activeScope, activeId);

		const now = new Date();
		const tahunIni = now.getFullYear();
		const bulanIni = now.getMonth() + 1;
		dashboardStats.tahunIni = tahunIni;
		dashboardStats.bulanIni = bulanIni;

		if (activeScope === 'Kelompok') {
			const k = await first(
				db
					.select({
						id: kelompok.id,
						nama: kelompok.nama,
						desaId: kelompok.desaId,
						kelurahan: kelompok.kelurahan,
						lokasiNama: kelompok.lokasiNama,
						latitude: kelompok.latitude,
						longitude: kelompok.longitude,
						radiusMeter: kelompok.radiusMeter,
						gmapsUrl: kelompok.gmapsUrl,
						desaNama: desa.nama,
						daerahId: desa.daerahId,
						daerahNama: daerah.nama
					})
					.from(kelompok)
					.innerJoin(desa, eq(kelompok.desaId, desa.id))
					.innerJoin(daerah, eq(desa.daerahId, daerah.id))
					.where(eq(kelompok.id, activeId))
			);

			if (k) {
				profilData = k;

				// 1. Rekening & QRIS Kelompok
				daftarRekening = await db
					.select()
					.from(rekeningWilayah)
					.where(and(eq(rekeningWilayah.tingkatScope, 'Kelompok'), eq(rekeningWilayah.kelompokId, activeId)))
					.orderBy(desc(rekeningWilayah.createdAt));

				// 2. Metrik Dashboard Jamaah Kelompok (Single Join Terindeks)
				const [statJamaah] = await db
					.select({
						totalJamaah: sql<number>`count(distinct ${anggotaKeluarga.id})`,
						totalLaki: sql<number>`count(case when ${anggotaKeluarga.jenisKelamin} = 'L' then 1 end)`,
						totalPerempuan: sql<number>`count(case when ${anggotaKeluarga.jenisKelamin} = 'P' then 1 end)`,
						totalKk: sql<number>`count(distinct ${keluarga.id})`,
						totalWajibIsrun: sql<number>`count(case when ${anggotaKeluarga.isrun} = 'Ya' then 1 end)`
					})
					.from(anggotaKeluarga)
					.innerJoin(keluarga, eq(anggotaKeluarga.keluargaId, keluarga.id))
					.innerJoin(users, eq(keluarga.kepalaKeluargaId, users.id))
					.where(and(eq(users.kelompokId, activeId), eq(anggotaKeluarga.statusJamaah, 'Aktif')));

				if (statJamaah) {
					dashboardStats.totalJamaah = Number(statJamaah.totalJamaah) || 0;
					dashboardStats.totalLaki = Number(statJamaah.totalLaki) || 0;
					dashboardStats.totalPerempuan = Number(statJamaah.totalPerempuan) || 0;
					dashboardStats.totalKk = Number(statJamaah.totalKk) || 0;
					dashboardStats.totalWajibIsrun = Number(statJamaah.totalWajibIsrun) || 0;
				}

				// 3. Setoran Isrun Bulan Ini
				const [statIsrun] = await db
					.select({
						sudahBayarCount: sql<number>`count(distinct ${transaksiFr.anggotaKeluargaId})`,
						totalNominal: sql<number>`coalesce(sum(${transaksiFr.nominal}), 0)`
					})
					.from(transaksiFr)
					.where(
						and(
							eq(transaksiFr.kelompokId, activeId),
							eq(transaksiFr.tahun, tahunIni),
							eq(transaksiFr.bulan, bulanIni),
							sql`${transaksiFr.nominal} > 0`
						)
					);

				if (statIsrun) {
					dashboardStats.sudahBayarIsrunCount = Number(statIsrun.sudahBayarCount) || 0;
					dashboardStats.totalNominalIsrunBulanIni = Number(statIsrun.totalNominal) || 0;
					dashboardStats.persenBayarIsrun =
						dashboardStats.totalWajibIsrun > 0
							? Math.min(100, Math.round((dashboardStats.sudahBayarIsrunCount / dashboardStats.totalWajibIsrun) * 100))
							: 0;
				}

				// 4. Jadwal Pengajian Kelompok
				daftarJadwal = await db
					.select()
					.from(presensiJadwal)
					.where(eq(presensiJadwal.kelompokId, activeId))
					.orderBy(desc(presensiJadwal.tanggal), desc(presensiJadwal.jamMulai))
					.limit(6);
			}
		} else if (activeScope === 'Desa') {
			const d = await first(
				db
					.select({
						id: desa.id,
						nama: desa.nama,
						daerahId: desa.daerahId,
						kecamatan: desa.kecamatan,
						lokasiNama: desa.lokasiNama,
						latitude: desa.latitude,
						longitude: desa.longitude,
						radiusMeter: desa.radiusMeter,
						gmapsUrl: desa.gmapsUrl,
						lokasiKelompokId: desa.lokasiKelompokId,
						daerahNama: daerah.nama
					})
					.from(desa)
					.innerJoin(daerah, eq(desa.daerahId, daerah.id))
					.where(eq(desa.id, activeId))
			);

			if (d) {
				profilData = d;

				// Daftar kelompok binaan di desa ini untuk opsi pilihan lokasi pengajian desa
				kelompokInDesa = await db
					.select({
						id: kelompok.id,
						nama: kelompok.nama,
						lokasiNama: kelompok.lokasiNama,
						latitude: kelompok.latitude,
						longitude: kelompok.longitude,
						radiusMeter: kelompok.radiusMeter,
						gmapsUrl: kelompok.gmapsUrl
					})
					.from(kelompok)
					.where(eq(kelompok.desaId, activeId))
					.orderBy(kelompok.nama);

				// Rekening Desa
				daftarRekening = await db
					.select()
					.from(rekeningWilayah)
					.where(and(eq(rekeningWilayah.tingkatScope, 'Desa'), eq(rekeningWilayah.desaId, activeId)))
					.orderBy(desc(rekeningWilayah.createdAt));

				// Metrik Dashboard Jamaah Desa (Agregasi seluruh kelompok di desa)
				const kIds = kelompokInDesa.map((k) => k.id);
				if (kIds.length > 0) {
					const [statJamaah] = await db
						.select({
							totalJamaah: sql<number>`count(distinct ${anggotaKeluarga.id})`,
							totalLaki: sql<number>`count(case when ${anggotaKeluarga.jenisKelamin} = 'L' then 1 end)`,
							totalPerempuan: sql<number>`count(case when ${anggotaKeluarga.jenisKelamin} = 'P' then 1 end)`,
							totalKk: sql<number>`count(distinct ${keluarga.id})`,
							totalWajibIsrun: sql<number>`count(case when ${anggotaKeluarga.isrun} = 'Ya' then 1 end)`
						})
						.from(anggotaKeluarga)
						.innerJoin(keluarga, eq(anggotaKeluarga.keluargaId, keluarga.id))
						.innerJoin(users, eq(keluarga.kepalaKeluargaId, users.id))
						.where(and(inArray(users.kelompokId, kIds), eq(anggotaKeluarga.statusJamaah, 'Aktif')));

					if (statJamaah) {
						dashboardStats.totalJamaah = Number(statJamaah.totalJamaah) || 0;
						dashboardStats.totalLaki = Number(statJamaah.totalLaki) || 0;
						dashboardStats.totalPerempuan = Number(statJamaah.totalPerempuan) || 0;
						dashboardStats.totalKk = Number(statJamaah.totalKk) || 0;
						dashboardStats.totalWajibIsrun = Number(statJamaah.totalWajibIsrun) || 0;
					}

					const [statIsrun] = await db
						.select({
							sudahBayarCount: sql<number>`count(distinct ${transaksiFr.anggotaKeluargaId})`,
							totalNominal: sql<number>`coalesce(sum(${transaksiFr.nominal}), 0)`
						})
						.from(transaksiFr)
						.where(
							and(
								inArray(transaksiFr.kelompokId, kIds),
								eq(transaksiFr.tahun, tahunIni),
								eq(transaksiFr.bulan, bulanIni),
								sql`${transaksiFr.nominal} > 0`
							)
						);

					if (statIsrun) {
						dashboardStats.sudahBayarIsrunCount = Number(statIsrun.sudahBayarCount) || 0;
						dashboardStats.totalNominalIsrunBulanIni = Number(statIsrun.totalNominal) || 0;
						dashboardStats.persenBayarIsrun =
							dashboardStats.totalWajibIsrun > 0
								? Math.min(100, Math.round((dashboardStats.sudahBayarIsrunCount / dashboardStats.totalWajibIsrun) * 100))
								: 0;
					}
				}

				// Jadwal Pengajian Desa
				daftarJadwal = await db
					.select()
					.from(presensiJadwal)
					.where(eq(presensiJadwal.desaId, activeId))
					.orderBy(desc(presensiJadwal.tanggal), desc(presensiJadwal.jamMulai))
					.limit(6);
			}
		} else if (activeScope === 'Daerah') {
			const dr = await first(db.select().from(daerah).where(eq(daerah.id, activeId)));

			if (dr) {
				profilData = dr;

				daftarRekening = await db
					.select()
					.from(rekeningWilayah)
					.where(and(eq(rekeningWilayah.tingkatScope, 'Daerah'), eq(rekeningWilayah.daerahId, activeId)))
					.orderBy(desc(rekeningWilayah.createdAt));

				// Jadwal Tingkat Daerah (jika ada)
				daftarJadwal = await db
					.select()
					.from(presensiJadwal)
					.where(eq(presensiJadwal.tingkatScope, 'Daerah'))
					.orderBy(desc(presensiJadwal.tanggal), desc(presensiJadwal.jamMulai))
					.limit(6);
			}
		}
	}

	// Alokasi kustom unik pada wilayah aktif
	const standardAlokasi = ['Infaq/Shodaqoh', 'Pembangunan', 'Lainnya'];
	const customAlokasiList = Array.from(
		new Set(
			daftarRekening
				.map((r) => r.tipeTujuan?.trim())
				.filter((t): t is string => Boolean(t && !standardAlokasi.includes(t)))
		)
	);

	return {
		adminScope,
		accessibleWilayah,
		activeScope,
		activeId,
		profilData,
		daftarRekening,
		customAlokasiList,
		canManageFinance,
		kelompokInDesa,
		dashboardStats,
		daftarJadwal
	};
};

export const actions: Actions = {
	/**
	 * Memperbarui titik lokasi, koordinat GPS, radius geofencing, dan link GMaps
	 * Untuk Desa: mendukung opsi memilih dari kelompok binaan atau koordinat manual
	 */
	updateLokasi: async ({ request, locals }) => {
		if (!locals.user || !locals.isAdmin) {
			return fail(401, { error: 'Sesi kedaluwarsa. Silakan login kembali.' });
		}

		const formData = await request.formData();
		const scope = String(formData.get('scope') || '');
		const id = Number(formData.get('id') || 0);
		const lokasiNama = String(formData.get('lokasiNama') || '').trim();
		const latitude = String(formData.get('latitude') || '').trim() || null;
		const longitude = String(formData.get('longitude') || '').trim() || null;
		const radiusMeter = Number(formData.get('radiusMeter') || 100);
		const gmapsUrl = String(formData.get('gmapsUrl') || '').trim() || null;
		const lokasiKelompokIdStr = formData.get('lokasiKelompokId')?.toString() || '';
		const lokasiKelompokId = lokasiKelompokIdStr ? Number(lokasiKelompokIdStr) : null;

		if (!id || !scope) {
			return fail(400, { error: 'Parameter wilayah tidak valid.' });
		}

		if (scope === 'Kelompok') {
			await db
				.update(kelompok)
				.set({
					lokasiNama: lokasiNama || null,
					latitude,
					longitude,
					radiusMeter,
					gmapsUrl
				})
				.where(eq(kelompok.id, id));
		} else if (scope === 'Desa') {
			let finalNama = lokasiNama;
			let finalLat = latitude;
			let finalLng = longitude;
			let finalRadius = radiusMeter;
			let finalGmaps = gmapsUrl;

			// Jika memilih dari kelompok binaan, warisi data lokasi dari kelompok tersebut
			if (lokasiKelompokId) {
				const srcKelompok = await first(
					db.select().from(kelompok).where(eq(kelompok.id, lokasiKelompokId))
				);
				if (srcKelompok) {
					finalNama = lokasiNama || srcKelompok.lokasiNama || `Masjid ${srcKelompok.nama}`;
					finalLat = srcKelompok.latitude || latitude;
					finalLng = srcKelompok.longitude || longitude;
					finalRadius = srcKelompok.radiusMeter || radiusMeter;
					finalGmaps = srcKelompok.gmapsUrl || gmapsUrl;
				}
			}

			await db
				.update(desa)
				.set({
					lokasiNama: finalNama || null,
					latitude: finalLat,
					longitude: finalLng,
					radiusMeter: finalRadius,
					gmapsUrl: finalGmaps,
					lokasiKelompokId: lokasiKelompokId || null
				})
				.where(eq(desa.id, id));
		} else if (scope === 'Daerah') {
			await db
				.update(daerah)
				.set({
					lokasiNama: lokasiNama || null,
					latitude,
					longitude,
					radiusMeter,
					gmapsUrl
				})
				.where(eq(daerah.id, id));
		}

		return { success: true, message: 'Informasi lokasi pengajian wilayah berhasil diperbarui.', scope, id };
	},

	/**
	 * Menambahkan rekening shodaqoh atau QRIS baru (Khusus KU / Kyai / Sekretaris / Superadmin)
	 */
	addRekening: async ({ request, locals }) => {
		if (!locals.user || !locals.isAdmin) {
			return fail(401, { error: 'Sesi kedaluwarsa. Silakan login kembali.' });
		}

		const formData = await request.formData();
		const scope = formData.get('scope') as 'Pusat' | 'Daerah' | 'Desa' | 'Kelompok';
		const id = Number(formData.get('id') || 0);

		const canManage = await canManageRekening(locals.roles || [], scope, id);
		if (!canManage) {
			return fail(403, {
				error: 'Akses ditolak: Hanya pengurus KU/Bendahara atau Superadmin yang berwenang menambah rekening/QRIS shodaqoh.'
			});
		}

		const metode = String(formData.get('metode') || 'bank'); // 'bank' | 'qris'
		const namaBank = String(formData.get('namaBank') || '').trim();
		const nomorRekening = String(formData.get('nomorRekening') || '').trim();
		const atasNama = String(formData.get('atasNama') || '').trim();
		const tipeTujuan = String(formData.get('tipeTujuan') || 'Infaq & Shodaqoh').trim();
		const keterangan = String(formData.get('keterangan') || '').trim() || null;
		const isActive = formData.get('isActive') !== 'false';

		let qrisImageUrl: string | null = null;
		const qrisFile = formData.get('qrisFile');
		const qrisUrlInput = String(formData.get('qrisUrl') || '').trim();

		if (metode === 'qris') {
			if (qrisFile instanceof File && qrisFile.size > 0) {
				qrisImageUrl = await saveUploadedQris(qrisFile);
			} else if (qrisUrlInput) {
				qrisImageUrl = qrisUrlInput;
			}
		}

		if (!namaBank || !atasNama) {
			return fail(400, { error: 'Nama Bank / Layanan dan Atas Nama wajib diisi.' });
		}
		if (metode === 'bank' && !nomorRekening) {
			return fail(400, { error: 'Nomor rekening bank wajib diisi.' });
		}

		const newRekening = {
			tingkatScope: scope,
			daerahId: scope === 'Daerah' ? id : null,
			desaId: scope === 'Desa' ? id : null,
			kelompokId: scope === 'Kelompok' ? id : null,
			namaBank,
			nomorRekening: metode === 'qris' ? (nomorRekening || 'QRIS') : nomorRekening,
			atasNama,
			tipeTujuan: tipeTujuan || 'Infaq & Shodaqoh',
			qrisImageUrl,
			keterangan,
			isActive,
			createdAt: Date.now()
		};

		await db.insert(rekeningWilayah).values(newRekening);

		return { success: true, message: 'Rekening shodaqoh berhasil ditambahkan.', scope, id };
	},

	/**
	 * Memperbarui rekening shodaqoh atau QRIS
	 */
	updateRekening: async ({ request, locals }) => {
		if (!locals.user || !locals.isAdmin) {
			return fail(401, { error: 'Sesi kedaluwarsa. Silakan login kembali.' });
		}

		const formData = await request.formData();
		const rekeningId = String(formData.get('rekeningId') || '');
		const scope = formData.get('scope') as 'Pusat' | 'Daerah' | 'Desa' | 'Kelompok';
		const id = Number(formData.get('id') || 0);

		const canManage = await canManageRekening(locals.roles || [], scope, id);
		if (!canManage) {
			return fail(403, {
				error: 'Akses ditolak: Hanya pengurus KU/Bendahara atau Superadmin yang berwenang mengubah rekening/QRIS.'
			});
		}

		const metode = String(formData.get('metode') || 'bank');
		const namaBank = String(formData.get('namaBank') || '').trim();
		const nomorRekening = String(formData.get('nomorRekening') || '').trim();
		const atasNama = String(formData.get('atasNama') || '').trim();
		const tipeTujuan = String(formData.get('tipeTujuan') || 'Infaq & Shodaqoh').trim();
		const keterangan = String(formData.get('keterangan') || '').trim() || null;
		const isActive = formData.get('isActive') !== 'false';

		let qrisImageUrl: string | null = null;
		const existingQris = String(formData.get('existingQrisUrl') || '').trim() || null;
		const qrisFile = formData.get('qrisFile');
		const qrisUrlInput = String(formData.get('qrisUrl') || '').trim();

		if (metode === 'qris') {
			if (qrisFile instanceof File && qrisFile.size > 0) {
				qrisImageUrl = await saveUploadedQris(qrisFile);
			} else if (qrisUrlInput) {
				qrisImageUrl = qrisUrlInput;
			} else {
				qrisImageUrl = existingQris;
			}
		}

		if (!namaBank || !atasNama) {
			return fail(400, { error: 'Nama Bank dan Atas Nama wajib diisi.' });
		}
		if (metode === 'bank' && !nomorRekening) {
			return fail(400, { error: 'Nomor rekening bank wajib diisi.' });
		}

		await db
			.update(rekeningWilayah)
			.set({
				namaBank,
				nomorRekening: metode === 'qris' ? (nomorRekening || 'QRIS') : nomorRekening,
				atasNama,
				tipeTujuan: tipeTujuan || 'Infaq & Shodaqoh',
				qrisImageUrl,
				keterangan,
				isActive
			})
			.where(eq(rekeningWilayah.id, rekeningId));

		return { success: true, message: 'Rekening berhasil diperbarui.', scope, id };
	},

	/**
	 * Menghapus rekening shodaqoh
	 */
	deleteRekening: async ({ request, locals }) => {
		if (!locals.user || !locals.isAdmin) {
			return fail(401, { error: 'Sesi kedaluwarsa. Silakan login kembali.' });
		}

		const formData = await request.formData();
		const rekeningId = String(formData.get('rekeningId') || '');
		const scope = formData.get('scope') as 'Pusat' | 'Daerah' | 'Desa' | 'Kelompok';
		const id = Number(formData.get('id') || 0);

		const canManage = await canManageRekening(locals.roles || [], scope, id);
		if (!canManage) {
			return fail(403, {
				error: 'Akses ditolak: Hanya pengurus KU/Bendahara atau Superadmin yang berwenang menghapus rekening.'
			});
		}

		if (!rekeningId) {
			return fail(400, { error: 'ID rekening tidak valid.' });
		}

		await db.delete(rekeningWilayah).where(eq(rekeningWilayah.id, rekeningId));

		return { success: true, message: 'Rekening berhasil dihapus.', scope, id };
	}
};
