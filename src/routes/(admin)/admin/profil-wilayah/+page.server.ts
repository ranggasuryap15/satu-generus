/**
 * @file src/routes/(admin)/admin/profil-wilayah/+page.server.ts
 * @purpose Backend controller halaman dedicated Profil Wilayah: hanya dapat diakses/dilihat oleh seluruh jajaran 4S & Superadmin, dengan seleksi filter scope adaptif bergaya shodaqoh (Kelompok, Desa, Daerah), hak modifikasi rekening/QRIS shodaqoh khusus KU dan Superadmin, serta pelestarian state scope & id wilayah pada setiap action
 * @usedBy src/routes/(admin)/admin/profil-wilayah/+page.svelte
 * @dependencies src/lib/db, src/lib/db/schema, src/lib/server/scope, drizzle-orm, @sveltejs/kit, src/lib/server/upload
 * @publicFunctions load, actions (updateLokasi, addRekening, updateRekening, deleteRekening)
 * @sideEffects Query dan mutasi SQLite pada tabel kelompok, desa, daerah, dan rekening_wilayah (minimum I/O & index-optimized)
 */

import { fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { db, first } from '#lib/db/index.js';
import { daerah, desa, kelompok, subKelompok, rekeningWilayah } from '#lib/db/schema.js';
import { and, desc, eq } from 'drizzle-orm';
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
		// Validasi apakah admin berhak mengakses wilayah ini
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
	// - Jika admin tingkat kelompok: langsung otomatis pilih kelompoknya sendiri dan sematkan ke URL.
	// - Jika admin tingkat atas (Desa/Daerah/Pusat) dengan banyak opsi: default NULL (harus dipilih manual via filter fleksibel).
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
	let subWilayahList: any[] = [];
	let canManageFinance = false;

	if (activeScope && activeId) {
		canManageFinance = await canManageRekening(roles, activeScope, activeId);

		if (activeScope === 'Kelompok') {
			const k = (await first(db
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
				));

			if (k) {
				profilData = k;
				subWilayahList = (await db
					.select()
					.from(subKelompok)
					.where(eq(subKelompok.kelompokId, activeId))
);
				daftarRekening = (await db
					.select()
					.from(rekeningWilayah)
					.where(and(eq(rekeningWilayah.tingkatScope, 'Kelompok'), eq(rekeningWilayah.kelompokId, activeId)))
					.orderBy(desc(rekeningWilayah.createdAt))
);
			}
		} else if (activeScope === 'Desa') {
			const d = (await first(db
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
				));

			if (d) {
				profilData = d;
				subWilayahList = (await db
					.select()
					.from(kelompok)
					.where(eq(kelompok.desaId, activeId))
);
				daftarRekening = (await db
					.select()
					.from(rekeningWilayah)
					.where(and(eq(rekeningWilayah.tingkatScope, 'Desa'), eq(rekeningWilayah.desaId, activeId)))
					.orderBy(desc(rekeningWilayah.createdAt))
);
			}
		} else if (activeScope === 'Daerah') {
			const dr = (await first(db
				.select()
				.from(daerah)
				.where(eq(daerah.id, activeId))
				));

			if (dr) {
				profilData = dr;
				const desas = (await db
					.select()
					.from(desa)
					.where(eq(desa.daerahId, activeId))
);
				const kelompokInDaerah = accessibleWilayah.kelompokList.filter(
					(k) => k.daerahId === activeId
				);
				subWilayahList = desas.map((des) => ({
					...des,
					kelompokCount: kelompokInDaerah.filter((k) => k.desaId === des.id).length
				}));

				daftarRekening = (await db
					.select()
					.from(rekeningWilayah)
					.where(and(eq(rekeningWilayah.tingkatScope, 'Daerah'), eq(rekeningWilayah.daerahId, activeId)))
					.orderBy(desc(rekeningWilayah.createdAt))
);
			}
		}
	}

	// Ambil alokasi kustom unik yang sudah tersimpan di wilayah ini (hanya scope wilayah ini, tidak bocor ke wilayah lain)
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
		subWilayahList,
		canManageFinance
	};
};

export const actions: Actions = {
	/**
	 * Memperbarui titik lokasi, koordinat GPS, radius geofencing, dan link GMaps
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

		if (!id || !scope) {
			return fail(400, { error: 'Parameter wilayah tidak valid.' });
		}

		if (scope === 'Kelompok') {
(await db.update(kelompok)
				.set({
					lokasiNama: lokasiNama || null,
					latitude,
					longitude,
					radiusMeter,
					gmapsUrl
				})
				.where(eq(kelompok.id, id))
);
		} else if (scope === 'Desa') {
(await db.update(desa)
				.set({
					lokasiNama: lokasiNama || null,
					latitude,
					longitude,
					radiusMeter,
					gmapsUrl
				})
				.where(eq(desa.id, id))
);
		} else if (scope === 'Daerah') {
(await db.update(daerah)
				.set({
					lokasiNama: lokasiNama || null,
					latitude,
					longitude,
					radiusMeter,
					gmapsUrl
				})
				.where(eq(daerah.id, id))
);
		}

		return { success: true, message: 'Informasi lokasi wilayah berhasil diperbarui.', scope, id };
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
		const atasNama = String(formData.get('atasNama') || '').trim();
		const tipeTujuan = String(formData.get('tipeTujuan') || 'Infaq/Shodaqoh').trim();
		const keterangan = String(formData.get('keterangan') || '').trim() || null;

		let namaBank = '';
		let nomorRekening = '';
		let qrisImageUrl: string | null = null;

		if (metode === 'qris') {
			namaBank = String(formData.get('namaBank') || 'QRIS').trim() || 'QRIS';
			nomorRekening = String(formData.get('nomorRekening') || '-').trim() || '-';

			if (!atasNama) {
				return fail(400, { error: 'Atas nama QRIS wajib diisi.' });
			}

			const qrisFile = formData.get('qrisFile');
			const qrisUrlText = String(formData.get('qrisImageUrl') || '').trim();
			qrisImageUrl = await saveUploadedQris(
				qrisFile instanceof File && qrisFile.size > 0 ? qrisFile : qrisUrlText
			);
			if (!qrisImageUrl) {
				return fail(400, { error: 'Gambar QRIS wajib diunggah atau diisi tautan gambarnya.' });
			}
		} else {
			// Transfer Bank
			namaBank = String(formData.get('namaBank') || '').trim();
			nomorRekening = String(formData.get('nomorRekening') || '').trim();

			if (!namaBank || !nomorRekening || !atasNama) {
				return fail(400, { error: 'Nama bank, nomor rekening, dan atas nama rekening wajib diisi.' });
			}
		}

(await db.insert(rekeningWilayah)
			.values({
				tingkatScope: scope,
				daerahId: scope === 'Daerah' ? id : null,
				desaId: scope === 'Desa' ? id : null,
				kelompokId: scope === 'Kelompok' ? id : null,
				namaBank,
				nomorRekening,
				atasNama,
				tipeTujuan,
				qrisImageUrl,
				keterangan,
				isActive: true,
				createdAt: Math.floor(Date.now() / 1000)
			})
);
		return { success: true, message: 'Rekening/QRIS shodaqoh berhasil ditambahkan.', scope, id };
	},

	/**
	 * Memperbarui rekening shodaqoh atau QRIS (Khusus KU / Kyai / Sekretaris / Superadmin)
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
				error: 'Akses ditolak: Hanya pengurus KU/Bendahara atau Superadmin yang berwenang memperbarui rekening/QRIS shodaqoh.'
			});
		}

		const existing = (await first(db.select().from(rekeningWilayah).where(eq(rekeningWilayah.id, rekeningId))));
		if (!existing) {
			return fail(404, { error: 'Data rekening tidak ditemukan.' });
		}

		const metode = String(formData.get('metode') || 'bank');
		const atasNama = String(formData.get('atasNama') || '').trim();
		const tipeTujuan = String(formData.get('tipeTujuan') || 'Infaq/Shodaqoh').trim();
		const keterangan = String(formData.get('keterangan') || '').trim() || null;
		const isActive = formData.get('isActive') === '1' || formData.get('isActive') === 'true';

		let namaBank = '';
		let nomorRekening = '';
		let qrisImageUrl: string | null = existing.qrisImageUrl;

		if (metode === 'qris') {
			namaBank = String(formData.get('namaBank') || 'QRIS').trim() || 'QRIS';
			nomorRekening = String(formData.get('nomorRekening') || '-').trim() || '-';

			if (!atasNama) {
				return fail(400, { error: 'Atas nama QRIS wajib diisi.' });
			}

			const qrisFile = formData.get('qrisFile');
			const qrisUrlText = String(formData.get('qrisImageUrl') || '').trim();
			if ((qrisFile instanceof File && qrisFile.size > 0) || qrisUrlText) {
				qrisImageUrl = await saveUploadedQris(
					qrisFile instanceof File && qrisFile.size > 0 ? qrisFile : qrisUrlText
				);
			}

			if (!qrisImageUrl) {
				return fail(400, { error: 'Gambar QRIS wajib diunggah atau diisi tautan gambarnya.' });
			}
		} else {
			// Transfer Bank
			namaBank = String(formData.get('namaBank') || '').trim();
			nomorRekening = String(formData.get('nomorRekening') || '').trim();
			qrisImageUrl = null;

			if (!namaBank || !nomorRekening || !atasNama) {
				return fail(400, { error: 'Nama bank, nomor rekening, dan atas nama rekening wajib diisi.' });
			}
		}

(await db.update(rekeningWilayah)
			.set({
				namaBank,
				nomorRekening,
				atasNama,
				tipeTujuan,
				qrisImageUrl,
				keterangan,
				isActive
			})
			.where(eq(rekeningWilayah.id, rekeningId))
);
		return { success: true, message: 'Rekening/QRIS shodaqoh berhasil diperbarui.', scope, id };
	},

	/**
	 * Menghapus rekening shodaqoh (Khusus KU / Superadmin)
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
				error: 'Akses ditolak: Hanya pengurus KU/Bendahara atau Superadmin yang berwenang menghapus rekening shodaqoh.'
			});
		}

(await db.delete(rekeningWilayah).where(eq(rekeningWilayah.id, rekeningId)));

		return { success: true, message: 'Rekening shodaqoh berhasil dihapus.', scope, id };
	}
};

