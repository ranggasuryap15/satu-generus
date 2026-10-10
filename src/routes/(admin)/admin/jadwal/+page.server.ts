/**
 * @file src/routes/(admin)/admin/jadwal/+page.server.ts
 * @purpose Server load & actions untuk pengelolaan jadwal pengajian bertingkat (Desa & Kelompok), template siklus rutin, generator sesi bulanan, dan override perubahan jadwal insidental
 * @usedBy src/routes/(admin)/admin/jadwal/+page.svelte
 * @dependencies src/lib/db, src/lib/db/schema, src/lib/server/scope, src/lib/jadwal, drizzle-orm
 * @publicFunctions load, actions.saveTemplate, actions.deleteTemplate, actions.generateSesiBulanan, actions.createSesiManual, actions.updateSesiOverride, actions.deleteSesi
 * @sideEffects Menulis dan membaca tabel jadwal_pengajian_template dan presensi_jadwal di SQLite
 */

import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/db';
import { jadwalPengajianTemplate, presensiJadwal, kelompok, desa } from '$lib/db/schema';
import { getAdminScope, getAccessibleWilayah, isKelompokAllowed } from '$lib/server/scope';
import { hitungTanggalSesiBulanan } from '$lib/jadwal';
import { normalizeDateToISO } from '$lib/utils';
import { eq, and, desc, asc } from 'drizzle-orm';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user || !locals.isAdmin) {
		throw redirect(303, '/login');
	}

	const adminScope = getAdminScope(locals.roles);
	const accessibleWilayah = getAccessibleWilayah(adminScope);

	const isKelompokOnly = adminScope.level === 'Kelompok';
	const canManageDesa =
		adminScope.level === 'Desa' || adminScope.level === 'Daerah' || adminScope.isPusat;

	// Penentuan Desa aktif
	const urlDesaId = url.searchParams.get('desaId');
	let selectedDesaId: number | null = null;
	if (canManageDesa && accessibleWilayah.desaList.length > 0) {
		if (urlDesaId && accessibleWilayah.desaList.some((d) => d.id === Number(urlDesaId))) {
			selectedDesaId = Number(urlDesaId);
		} else {
			selectedDesaId = accessibleWilayah.desaList[0].id;
		}
	}

	// Penentuan Kelompok aktif
	const urlKelompokId = url.searchParams.get('kelompokId');
	let selectedKelompokId: number | null = null;
	if (accessibleWilayah.kelompokList.length > 0) {
		if (urlKelompokId && accessibleWilayah.kelompokList.some((k) => k.id === Number(urlKelompokId))) {
			selectedKelompokId = Number(urlKelompokId);
		} else if (isKelompokOnly && adminScope.kelompokIds.length > 0) {
			selectedKelompokId = adminScope.kelompokIds[0];
		} else if (locals.user.kelompokId && accessibleWilayah.kelompokList.some((k) => k.id === locals.user?.kelompokId)) {
			selectedKelompokId = locals.user.kelompokId;
		} else {
			selectedKelompokId = accessibleWilayah.kelompokList[0].id;
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
	saveTemplate: async ({ request, locals }) => {
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
						lokasiNama,
						gmapsUrl
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
						lokasiNama,
						gmapsUrl,
						isActive: true
					})
					.run();
			}

			return { success: true, message: 'Template jadwal rutin berhasil disimpan.' };
		} catch (err) {
			console.error('Error saat menyimpan template jadwal:', err);
			return fail(500, { error: 'Terjadi kesalahan sistem saat menyimpan template jadwal.' });
		}
	},

	/**
	 * Menghapus template jadwal rutin
	 */
	deleteTemplate: async ({ request, locals }) => {
		if (!locals.user || !locals.isAdmin) return fail(401, { error: 'Unauthorized' });

		const formData = await request.formData();
		const id = parseInt(formData.get('id')?.toString() || '0', 10);
		if (!id) return fail(400, { error: 'ID template tidak valid.' });

		try {
			db.delete(jadwalPengajianTemplate).where(eq(jadwalPengajianTemplate.id, id)).run();
			return { success: true, message: 'Template jadwal berhasil dihapus.' };
		} catch (err) {
			console.error('Error menghapus template jadwal:', err);
			return fail(500, { error: 'Gagal menghapus template jadwal.' });
		}
	},

	/**
	 * Meng-generate sesi-sesi tanggal konkret untuk suatu bulan dari template rutin aktif
	 */
	generateSesiBulanan: async ({ request, locals }) => {
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
								lokasiNama: tmpl.lokasiNama,
								latitude: tmpl.latitude,
								longitude: tmpl.longitude,
								radiusMeter: tmpl.radiusMeter,
								gmapsUrl: tmpl.gmapsUrl
							})
							.run();

						createdCount++;
					}
				}
			});

			return {
				success: true,
				message: `Berhasil men-generate ${createdCount} sesi jadwal (${skippedCount} jadwal yang sudah ada dilewati agar tidak menimpa data).`
			};
		} catch (err) {
			console.error('Error generate sesi bulanan:', err);
			return fail(500, { error: 'Gagal men-generate sesi jadwal bulanan.' });
		}
	},

	/**
	 * Membuat sesi jadwal pengajian manual / insidental
	 */
	createSesiManual: async ({ request, locals }) => {
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

		const tanggal = normalizeDateToISO(tanggalRaw);

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
					lokasiNama,
					gmapsUrl
				})
				.run();

			return { success: true, message: 'Sesi jadwal pengajian berhasil dibuat.' };
		} catch (err) {
			console.error('Error create sesi manual:', err);
			return fail(500, { error: 'Gagal membuat sesi jadwal pengajian.' });
		}
	},

	/**
	 * Mengubah 1 sesi jadwal pengajian mendadak (Single-Instance Override)
	 * Tidak merusak template rutin maupun jadwal di tanggal lainnya!
	 */
	updateSesiOverride: async ({ request, locals }) => {
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

			return { success: true, message: 'Perubahan jadwal khusus berhasil disimpan untuk sesi ini.' };
		} catch (err) {
			console.error('Error updating sesi override:', err);
			return fail(500, { error: 'Gagal memperbarui jadwal sesi.' });
		}
	},

	/**
	 * Menghapus satu sesi pengajian
	 */
	deleteSesi: async ({ request, locals }) => {
		if (!locals.user || !locals.isAdmin) return fail(401, { error: 'Unauthorized' });

		const formData = await request.formData();
		const id = parseInt(formData.get('id')?.toString() || '0', 10);
		if (!id) return fail(400, { error: 'ID sesi tidak valid.' });

		try {
			db.delete(presensiJadwal).where(eq(presensiJadwal.id, id)).run();
			return { success: true, message: 'Sesi jadwal berhasil dihapus.' };
		} catch (err) {
			console.error('Error delete sesi:', err);
			return fail(500, { error: 'Gagal menghapus sesi jadwal.' });
		}
	}
};

