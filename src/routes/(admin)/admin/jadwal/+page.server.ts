/**
 * @file src/routes/(admin)/admin/jadwal/+page.server.ts
 * @purpose Server load & actions untuk pengelolaan jadwal pengajian bertingkat (Desa & Kelompok), default NULL saat klik tab pengajian, persistensi filter terpilih setelah simpan/edit/hapus via URL parameter & cookies, template siklus rutin, generator sesi bulanan dengan pewarisan lokasi default Desa & Kelompok, serta penghapusan aman sesi pengajian (beserta presensi kehadiran terkait)
 * @usedBy src/routes/(admin)/admin/jadwal/+page.svelte
 * @dependencies src/lib/db, src/lib/db/schema (jadwalPengajianTemplate, presensiJadwal, presensiKehadiran, kelompok, desa), src/lib/server/scope, src/lib/jadwal, drizzle-orm
 * @publicFunctions load, actions.saveTemplate, actions.deleteTemplate, actions.generateSesiBulanan, actions.createSesiManual, actions.updateSesiOverride, actions.deleteSesi
 * @sideEffects Menulis dan membaca tabel jadwal_pengajian_template, presensi_jadwal, dan presensi_kehadiran di SQLite, serta menyimpan preferensi tab aktif di cookies
 */

import { fail, redirect, type Cookies } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/db';
import { jadwalPengajianTemplate, presensiJadwal, presensiKehadiran, kelompok, desa } from '$lib/db/schema';
import { getAdminScope, getAccessibleWilayah, isKelompokAllowed } from '$lib/server/scope';
import { hitungTanggalSesiBulanan } from '$lib/jadwal';
import { normalizeDateToISO } from '$lib/utils';
import { eq, and, desc, asc } from 'drizzle-orm';

const COOKIE_OPTS = { path: '/', httpOnly: false, sameSite: 'lax' as const, maxAge: 60 * 60 * 24 * 7 };

function syncJadwalCookies(
	cookies: Cookies,
	scope: string | null | undefined,
	desaId?: number | null,
	kelompokId?: number | null
) {
	const tab = (scope || '').toLowerCase() === 'desa' ? 'desa' : 'kelompok';
	cookies.set('admin_jadwal_tab', tab, COOKIE_OPTS);
	if (tab === 'desa' && desaId) {
		cookies.set('admin_jadwal_desa_id', String(desaId), COOKIE_OPTS);
	} else if (tab === 'kelompok' && kelompokId) {
		cookies.set('admin_jadwal_kelompok_id', String(kelompokId), COOKIE_OPTS);
	}
}

export const load: PageServerLoad = async ({ locals, url, cookies }) => {
	if (!locals.user || !locals.isAdmin) {
		throw redirect(303, '/login');
	}

	const adminScope = getAdminScope(locals.roles);
	const accessibleWilayah = getAccessibleWilayah(adminScope);

	const isKelompokOnly = adminScope.level === 'Kelompok';
	const canManageDesa =
		adminScope.level === 'Desa' || adminScope.level === 'Daerah' || adminScope.isPusat;

	// Penentuan Tab aktif dari URL parameter (?tab=kelompok atau ?tab=desa) atau cookie
	const cookieTab = cookies.get('admin_jadwal_tab');
	const urlTab = url.searchParams.get('tab');
	const effectiveTab = urlTab || cookieTab;
	const currentTab: 'desa' | 'kelompok' = isKelompokOnly || effectiveTab === 'kelompok' ? 'kelompok' : 'desa';
	cookies.set('admin_jadwal_tab', currentTab, { path: '/', httpOnly: false, sameSite: 'lax', maxAge: 60 * 60 * 24 * 7 });

	// Penentuan Desa aktif (default NULL saat klik tab desa / baru buka, dipertahankan setelah simpan/edit)
	const isTabDesaExplicit = url.searchParams.has('tab') && url.searchParams.get('tab') === 'desa';
	const urlDesaId = url.searchParams.get('desaId');
	const cookieDesaId = cookies.get('admin_jadwal_desa_id');
	let selectedDesaId: number | null = null;

	if (canManageDesa && accessibleWilayah.desaList.length > 0) {
		if (accessibleWilayah.desaList.length === 1) {
			// Jika scope hanya 1 desa (misal Admin Desa), otomatis gunakan desa tersebut
			selectedDesaId = accessibleWilayah.desaList[0].id;
		} else if (urlDesaId && accessibleWilayah.desaList.some((d) => d.id === Number(urlDesaId))) {
			// Jika ada desaId eksplisit di URL query
			selectedDesaId = Number(urlDesaId);
		} else if (isTabDesaExplicit && !urlDesaId) {
			// Ketika klik tab desa, defaultnya adalah NULL
			selectedDesaId = null;
			cookies.delete('admin_jadwal_desa_id', { path: '/' });
		} else if (!url.searchParams.has('tab') && !urlDesaId) {
			// Buka halaman pertama kali tanpa query params, default NULL
			selectedDesaId = null;
		} else if (cookieDesaId && accessibleWilayah.desaList.some((d) => d.id === Number(cookieDesaId))) {
			// Selesai simpan/edit form yang me-restore via cookie
			selectedDesaId = Number(cookieDesaId);
		} else {
			selectedDesaId = null;
		}

		if (selectedDesaId) {
			cookies.set('admin_jadwal_desa_id', String(selectedDesaId), { path: '/', httpOnly: false, sameSite: 'lax', maxAge: 60 * 60 * 24 * 7 });
		}
	}

	// Penentuan Kelompok aktif (default NULL saat klik tab kelompok, dipertahankan setelah simpan/edit)
	const isTabKelompokExplicit = url.searchParams.has('tab') && url.searchParams.get('tab') === 'kelompok';
	const urlKelompokId = url.searchParams.get('kelompokId');
	const cookieKelompokId = cookies.get('admin_jadwal_kelompok_id');
	let selectedKelompokId: number | null = null;

	if (accessibleWilayah.kelompokList.length > 0) {
		if (isKelompokOnly && adminScope.kelompokIds.length > 0) {
			// Admin kelompok selalu terikat pada kelompoknya sendiri
			selectedKelompokId = adminScope.kelompokIds[0];
		} else if (accessibleWilayah.kelompokList.length === 1) {
			selectedKelompokId = accessibleWilayah.kelompokList[0].id;
		} else if (urlKelompokId && accessibleWilayah.kelompokList.some((k) => k.id === Number(urlKelompokId))) {
			// Jika ada kelompokId eksplisit di URL query
			selectedKelompokId = Number(urlKelompokId);
		} else if (isTabKelompokExplicit && !urlKelompokId) {
			// Ketika klik tab kelompok, defaultnya adalah NULL
			selectedKelompokId = null;
			cookies.delete('admin_jadwal_kelompok_id', { path: '/' });
		} else if (!url.searchParams.has('tab') && !urlKelompokId) {
			// Buka halaman pertama kali tanpa query params, default NULL
			selectedKelompokId = null;
		} else if (cookieKelompokId && accessibleWilayah.kelompokList.some((k) => k.id === Number(cookieKelompokId))) {
			// Selesai simpan/edit form yang me-restore via cookie
			selectedKelompokId = Number(cookieKelompokId);
		} else {
			selectedKelompokId = null;
		}

		if (selectedKelompokId) {
			cookies.set('admin_jadwal_kelompok_id', String(selectedKelompokId), { path: '/', httpOnly: false, sameSite: 'lax', maxAge: 60 * 60 * 24 * 7 });
		}
	}

	// 1. Query Data Jadwal Desa (Template Rutin & Sesi Konkret)
	let desaTemplates: Array<typeof jadwalPengajianTemplate.$inferSelect> = [];
	let desaSesiList: Array<typeof presensiJadwal.$inferSelect> = [];

	if (canManageDesa && selectedDesaId) {
		desaTemplates = db
			.select()
			.from(jadwalPengajianTemplate)
			.where(
				and(
					eq(jadwalPengajianTemplate.tingkatScope, 'Desa'),
					eq(jadwalPengajianTemplate.desaId, selectedDesaId)
				)
			)
			.orderBy(asc(jadwalPengajianTemplate.mingguKe), asc(jadwalPengajianTemplate.hari))
			.all();

		desaSesiList = db
			.select()
			.from(presensiJadwal)
			.where(
				and(
					eq(presensiJadwal.tingkatScope, 'Desa'),
					eq(presensiJadwal.desaId, selectedDesaId)
				)
			)
			.orderBy(desc(presensiJadwal.tanggal))
			.limit(50)
			.all();
	}

	// 2. Query Data Jadwal Kelompok (Template Rutin & Sesi Konkret)
	let kelompokTemplates: Array<typeof jadwalPengajianTemplate.$inferSelect> = [];
	let kelompokSesiList: Array<typeof presensiJadwal.$inferSelect> = [];

	if (selectedKelompokId) {
		kelompokTemplates = db
			.select()
			.from(jadwalPengajianTemplate)
			.where(
				and(
					eq(jadwalPengajianTemplate.tingkatScope, 'Kelompok'),
					eq(jadwalPengajianTemplate.kelompokId, selectedKelompokId)
				)
			)
			.orderBy(asc(jadwalPengajianTemplate.hari))
			.all();

		kelompokSesiList = db
			.select()
			.from(presensiJadwal)
			.where(
				and(
					eq(presensiJadwal.tingkatScope, 'Kelompok'),
					eq(presensiJadwal.kelompokId, selectedKelompokId)
				)
			)
			.orderBy(desc(presensiJadwal.tanggal))
			.limit(50)
			.all();
	}

	return {
		adminScope,
		isKelompokOnly,
		canManageDesa,
		currentTab,
		desaList: accessibleWilayah.desaList,
		kelompokList: accessibleWilayah.kelompokList,
		selectedDesaId,
		selectedKelompokId,
		desaTemplates,
		desaSesiList,
		kelompokTemplates,
		kelompokSesiList
	};
};

export const actions: Actions = {
	/**
	 * Menyimpan atau memperbarui pola template pengajian rutin
	 */
	saveTemplate: async ({ request, locals, cookies }) => {
		if (!locals.user || !locals.isAdmin) return fail(401, { error: 'Unauthorized' });

		const formData = await request.formData();
		const idRaw = formData.get('id')?.toString();
		const templateId = idRaw ? parseInt(idRaw, 10) : null;
		const tingkatScope = (formData.get('tingkatScope')?.toString() || 'Kelompok') as 'Desa' | 'Kelompok';
		const desaIdRaw = formData.get('desaId')?.toString();
		const kelompokIdRaw = formData.get('kelompokId')?.toString();
		const tipePola = (formData.get('tipePola')?.toString() || (tingkatScope === 'Desa' ? 'mingguan_ke' : 'hari_rutin')) as 'mingguan_ke' | 'hari_rutin';
		const mingguKeRaw = formData.get('mingguKe')?.toString();
		const hariRaw = formData.get('hari')?.toString() || '0';
		const jamMulai = formData.get('jamMulai')?.toString()?.trim();
		const jamSelesai = formData.get('jamSelesai')?.toString()?.trim() || null;
		const namaKegiatan = formData.get('namaKegiatan')?.toString()?.trim();
		const detailMateri = formData.get('detailMateri')?.toString()?.trim() || null;
		const isLibur = formData.get('isLibur')?.toString() === 'true';
		const lokasiNama = formData.get('lokasiNama')?.toString()?.trim() || null;
		const gmapsUrl = formData.get('gmapsUrl')?.toString()?.trim() || null;

		// Validasi input wajib
		if (!namaKegiatan) {
			return fail(400, { error: 'Nama kegiatan pengajian wajib diisi.' });
		}
		if (!jamMulai) {
			return fail(400, { error: 'Jam mulai kegiatan wajib diisi (contoh: 08:30).' });
		}

		const desaId = desaIdRaw ? parseInt(desaIdRaw, 10) : null;
		const kelompokId = kelompokIdRaw ? parseInt(kelompokIdRaw, 10) : null;
		const mingguKe = mingguKeRaw ? parseInt(mingguKeRaw, 10) : null;
		const hari = parseInt(hariRaw, 10);

		// Validasi hak akses scope
		const adminScope = getAdminScope(locals.roles);
		const accessibleWilayah = getAccessibleWilayah(adminScope);

		if (tingkatScope === 'Kelompok') {
			if (!kelompokId || !isKelompokAllowed(kelompokId, accessibleWilayah.allowedKelompokIdSet, adminScope.isPusat)) {
				return fail(403, { error: 'Anda tidak memiliki wewenang untuk kelompok ini.' });
			}
		} else {
			if (!desaId || (!adminScope.isPusat && !accessibleWilayah.desaList.some((d) => d.id === desaId))) {
				return fail(403, { error: 'Anda tidak memiliki wewenang untuk desa ini.' });
			}
		}

		syncJadwalCookies(cookies, tingkatScope, desaId, kelompokId);

		let finalLokasiNama = lokasiNama;
		let finalGmapsUrl = gmapsUrl;
		let targetLat: string | null = null;
		let targetLng: string | null = null;
		let targetRadius = 100;

		if (tingkatScope === 'Desa' && desaId) {
			const desaRow = db.select().from(desa).where(eq(desa.id, desaId)).get();
			if (desaRow) {
				if (!finalLokasiNama) finalLokasiNama = desaRow.lokasiNama || desaRow.nama;
				if (!finalGmapsUrl) {
					finalGmapsUrl =
						desaRow.gmapsUrl ||
						(desaRow.latitude && desaRow.longitude
							? `https://www.google.com/maps?q=${desaRow.latitude},${desaRow.longitude}`
							: null);
				}
				targetLat = desaRow.latitude;
				targetLng = desaRow.longitude;
				targetRadius = desaRow.radiusMeter || 100;
			}
		} else if (tingkatScope === 'Kelompok' && kelompokId) {
			const kelompokRow = db.select().from(kelompok).where(eq(kelompok.id, kelompokId)).get();
			if (kelompokRow) {
				if (!finalLokasiNama) finalLokasiNama = kelompokRow.lokasiNama || kelompokRow.nama;
				if (!finalGmapsUrl) {
					finalGmapsUrl =
						kelompokRow.gmapsUrl ||
						(kelompokRow.latitude && kelompokRow.longitude
							? `https://www.google.com/maps?q=${kelompokRow.latitude},${kelompokRow.longitude}`
							: null);
				}
				targetLat = kelompokRow.latitude;
				targetLng = kelompokRow.longitude;
				targetRadius = kelompokRow.radiusMeter || 100;
			}
		}

		try {
			if (templateId) {
				db.update(jadwalPengajianTemplate)
					.set({
						tingkatScope,
						desaId: tingkatScope === 'Desa' ? desaId : null,
						kelompokId: tingkatScope === 'Kelompok' ? kelompokId : null,
						tipePola,
						mingguKe: tipePola === 'mingguan_ke' ? mingguKe : null,
						hari,
						jamMulai,
						jamSelesai,
						namaKegiatan,
						detailMateri,
						isLibur,
						lokasiNama: finalLokasiNama,
						latitude: targetLat,
						longitude: targetLng,
						radiusMeter: targetRadius,
						gmapsUrl: finalGmapsUrl
					})
					.where(eq(jadwalPengajianTemplate.id, templateId))
					.run();
			} else {
				db.insert(jadwalPengajianTemplate)
					.values({
						tingkatScope,
						desaId: tingkatScope === 'Desa' ? desaId : null,
						kelompokId: tingkatScope === 'Kelompok' ? kelompokId : null,
						tipePola,
						mingguKe: tipePola === 'mingguan_ke' ? mingguKe : null,
						hari,
						jamMulai,
						jamSelesai,
						namaKegiatan,
						detailMateri,
						isLibur,
						lokasiNama: finalLokasiNama,
						latitude: targetLat,
						longitude: targetLng,
						radiusMeter: targetRadius,
						gmapsUrl: finalGmapsUrl,
						isActive: true
					})
					.run();
			}

			return { success: true, message: 'Template Jadwal Tersimpan' };
		} catch (err) {
			console.error('Error saat menyimpan template jadwal:', err);
			return fail(500, { error: 'Terjadi kesalahan sistem saat menyimpan template jadwal.' });
		}
	},

	/**
	 * Menghapus template jadwal rutin
	 */
	deleteTemplate: async ({ request, locals, cookies }) => {
		if (!locals.user || !locals.isAdmin) return fail(401, { error: 'Unauthorized' });

		const formData = await request.formData();
		const id = parseInt(formData.get('id')?.toString() || '0', 10);
		if (!id) return fail(400, { error: 'ID template tidak valid.' });

		try {
			const existing = db.select().from(jadwalPengajianTemplate).where(eq(jadwalPengajianTemplate.id, id)).get();
			if (existing) {
				syncJadwalCookies(cookies, existing.tingkatScope, existing.desaId, existing.kelompokId);
			}
			db.delete(jadwalPengajianTemplate).where(eq(jadwalPengajianTemplate.id, id)).run();
			return { success: true, message: 'Template Jadwal Dihapus' };
		} catch (err) {
			console.error('Error menghapus template jadwal:', err);
			return fail(500, { error: 'Gagal menghapus template jadwal.' });
		}
	},

	/**
	 * Meng-generate sesi-sesi tanggal konkret untuk suatu bulan dari template rutin aktif
	 */
	generateSesiBulanan: async ({ request, locals, cookies }) => {
		if (!locals.user || !locals.isAdmin) return fail(401, { error: 'Unauthorized' });

		const formData = await request.formData();
		const tingkatScope = (formData.get('tingkatScope')?.toString() || 'Kelompok') as 'Desa' | 'Kelompok';
		const desaId = formData.get('desaId') ? parseInt(formData.get('desaId')!.toString(), 10) : null;
		const kelompokId = formData.get('kelompokId') ? parseInt(formData.get('kelompokId')!.toString(), 10) : null;
		const year = parseInt(formData.get('year')?.toString() || String(new Date().getFullYear()), 10);
		const month = parseInt(formData.get('month')?.toString() || String(new Date().getMonth() + 1), 10);

		// Validasi scope wewenang
		const adminScope = getAdminScope(locals.roles);
		const accessibleWilayah = getAccessibleWilayah(adminScope);

		if (tingkatScope === 'Kelompok') {
			if (!kelompokId || !isKelompokAllowed(kelompokId, accessibleWilayah.allowedKelompokIdSet, adminScope.isPusat)) {
				return fail(403, { error: 'Anda tidak memiliki wewenang untuk kelompok ini.' });
			}
		} else {
			if (!desaId || (!adminScope.isPusat && !accessibleWilayah.desaList.some((d) => d.id === desaId))) {
				return fail(403, { error: 'Anda tidak memiliki wewenang untuk desa ini.' });
			}
		}

		syncJadwalCookies(cookies, tingkatScope, desaId, kelompokId);

		// Ambil seluruh template aktif untuk scope ini
		const templates = db
			.select()
			.from(jadwalPengajianTemplate)
			.where(
				and(
					eq(jadwalPengajianTemplate.tingkatScope, tingkatScope),
					tingkatScope === 'Desa'
						? eq(jadwalPengajianTemplate.desaId, desaId!)
						: eq(jadwalPengajianTemplate.kelompokId, kelompokId!),
					eq(jadwalPengajianTemplate.isActive, true)
				)
			)
			.all();

		if (templates.length === 0) {
			return fail(400, {
				error: 'Belum ada template jadwal rutin yang dibuat. Silakan tambahkan template terlebih dahulu.'
			});
		}

		let createdCount = 0;
		let skippedCount = 0;

		let defaultLokasiNama: string | null = null;
		let defaultGmapsUrl: string | null = null;
		let defaultLat: string | null = null;
		let defaultLng: string | null = null;
		let defaultRadius = 100;

		if (tingkatScope === 'Desa' && desaId) {
			const dRow = db.select().from(desa).where(eq(desa.id, desaId)).get();
			if (dRow) {
				defaultLokasiNama = dRow.lokasiNama || dRow.nama;
				defaultGmapsUrl =
					dRow.gmapsUrl ||
					(dRow.latitude && dRow.longitude
						? `https://www.google.com/maps?q=${dRow.latitude},${dRow.longitude}`
						: null);
				defaultLat = dRow.latitude;
				defaultLng = dRow.longitude;
				defaultRadius = dRow.radiusMeter || 100;
			}
		} else if (tingkatScope === 'Kelompok' && kelompokId) {
			const kRow = db.select().from(kelompok).where(eq(kelompok.id, kelompokId)).get();
			if (kRow) {
				defaultLokasiNama = kRow.lokasiNama || kRow.nama;
				defaultGmapsUrl =
					kRow.gmapsUrl ||
					(kRow.latitude && kRow.longitude
						? `https://www.google.com/maps?q=${kRow.latitude},${kRow.longitude}`
						: null);
				defaultLat = kRow.latitude;
				defaultLng = kRow.longitude;
				defaultRadius = kRow.radiusMeter || 100;
			}
		}

		try {
			db.transaction((tx) => {
				for (const tmpl of templates) {
					const dates = hitungTanggalSesiBulanan({
						year,
						month,
						tipePola: tmpl.tipePola,
						hari: tmpl.hari,
						mingguKe: tmpl.mingguKe
					});

					for (const tanggal of dates) {
						// Periksa apakah sesi pada tanggal ini sudah ada agar tidak menimpa override
						const existing = tx
							.select({ id: presensiJadwal.id })
							.from(presensiJadwal)
							.where(
								and(
									eq(presensiJadwal.tingkatScope, tingkatScope),
									tingkatScope === 'Desa'
										? eq(presensiJadwal.desaId, desaId!)
										: eq(presensiJadwal.kelompokId, kelompokId!),
									eq(presensiJadwal.tanggal, tanggal)
								)
							)
							.get();

						if (existing) {
							skippedCount++;
							continue;
						}

						tx.insert(presensiJadwal)
							.values({
								tingkatScope,
								desaId: tingkatScope === 'Desa' ? desaId : null,
								kelompokId: tingkatScope === 'Kelompok' ? kelompokId : null,
								templateId: tmpl.id,
								tanggal,
								jamMulai: tmpl.jamMulai,
								jamSelesai: tmpl.jamSelesai,
								namaKegiatan: tmpl.namaKegiatan,
								detailMateri: tmpl.detailMateri,
								status: tmpl.isLibur ? 'libur' : 'aktif',
								isOverride: false,
								lokasiNama: tmpl.lokasiNama || defaultLokasiNama,
								latitude: tmpl.latitude || defaultLat,
								longitude: tmpl.longitude || defaultLng,
								radiusMeter: tmpl.radiusMeter || defaultRadius,
								gmapsUrl: tmpl.gmapsUrl || defaultGmapsUrl
							})
							.run();

						createdCount++;
					}
				}
			});

			return {
				success: true,
				message: `${createdCount} Sesi Jadwal Dibuat`
			};
		} catch (err) {
			console.error('Error generate sesi bulanan:', err);
			return fail(500, { error: 'Gagal men-generate sesi jadwal bulanan.' });
		}
	},

	/**
	 * Membuat sesi jadwal pengajian manual / insidental
	 */
	createSesiManual: async ({ request, locals, cookies }) => {
		if (!locals.user || !locals.isAdmin) return fail(401, { error: 'Unauthorized' });

		const formData = await request.formData();
		const tingkatScope = (formData.get('tingkatScope')?.toString() || 'Kelompok') as 'Desa' | 'Kelompok';
		const desaId = formData.get('desaId') ? parseInt(formData.get('desaId')!.toString(), 10) : null;
		const kelompokId = formData.get('kelompokId') ? parseInt(formData.get('kelompokId')!.toString(), 10) : null;
		const tanggalRaw = formData.get('tanggal')?.toString();
		const jamMulai = formData.get('jamMulai')?.toString()?.trim();
		const jamSelesai = formData.get('jamSelesai')?.toString()?.trim() || null;
		const namaKegiatan = formData.get('namaKegiatan')?.toString()?.trim();
		const detailMateri = formData.get('detailMateri')?.toString()?.trim() || null;
		const status = formData.get('status')?.toString() || 'aktif';
		const lokasiNama = formData.get('lokasiNama')?.toString()?.trim() || null;
		const gmapsUrl = formData.get('gmapsUrl')?.toString()?.trim() || null;

		if (!namaKegiatan) return fail(400, { error: 'Nama kegiatan wajib diisi.' });
		if (!tanggalRaw) return fail(400, { error: 'Tanggal kegiatan wajib diisi.' });
		if (!jamMulai) return fail(400, { error: 'Jam mulai kegiatan wajib diisi.' });

		syncJadwalCookies(cookies, tingkatScope, desaId, kelompokId);

		const tanggal = normalizeDateToISO(tanggalRaw);

		let finalLokasiNama = lokasiNama;
		let finalGmapsUrl = gmapsUrl;
		let targetLat: string | null = null;
		let targetLng: string | null = null;
		let targetRadius = 100;

		if (tingkatScope === 'Desa' && desaId) {
			const desaRow = db.select().from(desa).where(eq(desa.id, desaId)).get();
			if (desaRow) {
				if (!finalLokasiNama) finalLokasiNama = desaRow.lokasiNama || desaRow.nama;
				if (!finalGmapsUrl) {
					finalGmapsUrl =
						desaRow.gmapsUrl ||
						(desaRow.latitude && desaRow.longitude
							? `https://www.google.com/maps?q=${desaRow.latitude},${desaRow.longitude}`
							: null);
				}
				targetLat = desaRow.latitude;
				targetLng = desaRow.longitude;
				targetRadius = desaRow.radiusMeter || 100;
			}
		} else if (tingkatScope === 'Kelompok' && kelompokId) {
			const kelompokRow = db.select().from(kelompok).where(eq(kelompok.id, kelompokId)).get();
			if (kelompokRow) {
				if (!finalLokasiNama) finalLokasiNama = kelompokRow.lokasiNama || kelompokRow.nama;
				if (!finalGmapsUrl) {
					finalGmapsUrl =
						kelompokRow.gmapsUrl ||
						(kelompokRow.latitude && kelompokRow.longitude
							? `https://www.google.com/maps?q=${kelompokRow.latitude},${kelompokRow.longitude}`
							: null);
				}
				targetLat = kelompokRow.latitude;
				targetLng = kelompokRow.longitude;
				targetRadius = kelompokRow.radiusMeter || 100;
			}
		}

		try {
			db.insert(presensiJadwal)
				.values({
					tingkatScope,
					desaId: tingkatScope === 'Desa' ? desaId : null,
					kelompokId: tingkatScope === 'Kelompok' ? kelompokId : null,
					tanggal,
					jamMulai,
					jamSelesai,
					namaKegiatan,
					detailMateri,
					status,
					isOverride: false,
					lokasiNama: finalLokasiNama,
					gmapsUrl: finalGmapsUrl,
					latitude: targetLat,
					longitude: targetLng,
					radiusMeter: targetRadius
				})
				.run();

			return { success: true, message: 'Jadwal Pengajian Dibuat' };
		} catch (err) {
			console.error('Error create sesi manual:', err);
			return fail(500, { error: 'Gagal membuat sesi jadwal pengajian.' });
		}
	},

	/**
	 * Mengubah 1 sesi jadwal pengajian mendadak (Single-Instance Override)
	 * Tidak merusak template rutin maupun jadwal di tanggal lainnya!
	 */
	updateSesiOverride: async ({ request, locals, cookies }) => {
		if (!locals.user || !locals.isAdmin) return fail(401, { error: 'Unauthorized' });

		const formData = await request.formData();
		const id = parseInt(formData.get('id')?.toString() || '0', 10);
		if (!id) return fail(400, { error: 'ID sesi jadwal tidak valid.' });

		const jamMulai = formData.get('jamMulai')?.toString()?.trim();
		const jamSelesai = formData.get('jamSelesai')?.toString()?.trim() || null;
		const namaKegiatan = formData.get('namaKegiatan')?.toString()?.trim();
		const detailMateri = formData.get('detailMateri')?.toString()?.trim() || null;
		const status = formData.get('status')?.toString() || 'aktif';
		const lokasiNama = formData.get('lokasiNama')?.toString()?.trim() || null;
		const gmapsUrl = formData.get('gmapsUrl')?.toString()?.trim() || null;

		if (!namaKegiatan) return fail(400, { error: 'Nama kegiatan wajib diisi.' });
		if (!jamMulai) return fail(400, { error: 'Jam mulai wajib diisi.' });

		try {
			const existing = db.select().from(presensiJadwal).where(eq(presensiJadwal.id, id)).get();
			if (existing) {
				syncJadwalCookies(cookies, existing.tingkatScope, existing.desaId, existing.kelompokId);
			}
			db.update(presensiJadwal)
				.set({
					jamMulai,
					jamSelesai,
					namaKegiatan,
					detailMateri,
					status,
					isOverride: true, // Menandai bahwa jadwal ini mengalami perubahan khusus
					lokasiNama,
					gmapsUrl
				})
				.where(eq(presensiJadwal.id, id))
				.run();

			return { success: true, message: 'Jadwal Berhasil Diperbarui' };
		} catch (err) {
			console.error('Error updating sesi override:', err);
			return fail(500, { error: 'Gagal memperbarui jadwal sesi.' });
		}
	},

	/**
	 * Menghapus satu sesi pengajian beserta data presensi kehadiran yang terkait
	 */
	deleteSesi: async ({ request, locals, cookies }) => {
		if (!locals.user || !locals.isAdmin) return fail(401, { error: 'Unauthorized' });

		const formData = await request.formData();
		const id = parseInt(formData.get('id')?.toString() || '0', 10);
		if (!id) return fail(400, { error: 'ID sesi tidak valid.' });

		try {
			const existing = db.select().from(presensiJadwal).where(eq(presensiJadwal.id, id)).get();
			if (existing) {
				syncJadwalCookies(cookies, existing.tingkatScope, existing.desaId, existing.kelompokId);
			}
			// Hapus kehadiran terkait lebih dulu untuk integritas data terjamin
			db.delete(presensiKehadiran).where(eq(presensiKehadiran.jadwalId, id)).run();
			db.delete(presensiJadwal).where(eq(presensiJadwal.id, id)).run();
			return { success: true, message: 'Jadwal Dihapus' };
		} catch (err) {
			console.error('Error delete sesi:', err);
			return fail(500, { error: 'Gagal menghapus sesi jadwal.' });
		}
	}
};

