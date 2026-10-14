/**
 * @file src/routes/(admin)/admin/keuangan/shodaqoh/+page.server.ts
 * @purpose Backend controller manajemen shodaqoh berjenjang wilayah (Kelompok, Desa, Daerah): rekapitulasi statistik & grafik transaksi, approval bukti transfer, CRUD rekening & QRIS (insert, update, delete), seleksi wilayah adaptif (default null jika banyak wilayah, auto-select kelompok sendiri untuk admin kelompok), serta isolasi jenis shodaqoh khusus KU dan Kyai
 * @usedBy src/routes/(admin)/admin/keuangan/shodaqoh/+page.svelte
 * @dependencies src/lib/db, src/lib/db/schema, src/lib/server/scope, drizzle-orm, @sveltejs/kit, src/lib/server/upload
 * @publicFunctions load, actions (approve, reject, addJenis, deleteJenis, saveRekening, deleteRekening)
 * @sideEffects Mutasi status approval transaksi shodaqoh, pembuatan jenis shodaqoh scoped, serta mutasi (tambah, perbarui, hapus) data rekening & QRIS wilayah di SQLite
 */

import { fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { db, first } from '$lib/db';
import {
	daerah,
	desa,
	kelompok,
	rekeningWilayah,
	jenisShodaqoh,
	transaksiShodaqoh,
	users
} from '$lib/db/schema';
import {
	getAdminScope,
	getAccessibleWilayah,
	canAccessKeuangan,
	canManageShodaqoh
} from '$lib/server/scope';
import { and, desc, eq, sql } from 'drizzle-orm';
import { saveUploadedFile } from '$lib/server/upload';

async function saveUploadedQris(fileOrBase64OrUrl: any): Promise<string | null> {
	return saveUploadedFile(fileOrBase64OrUrl, 'qris', 'qris');
}

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user || !locals.isAdmin) {
		throw redirect(303, '/login');
	}

	const roles = locals.roles || [];
	if (!canAccessKeuangan(roles)) {
		throw redirect(303, '/admin');
	}

	const adminScope = getAdminScope(roles);
	const accessibleWilayah = await getAccessibleWilayah(adminScope);

	const paramScope = url.searchParams.get('scope') as 'Pusat' | 'Daerah' | 'Desa' | 'Kelompok' | null;
	const paramId = url.searchParams.get('id') ? Number(url.searchParams.get('id')) : null;
	const filterStatus = url.searchParams.get('status') || 'Semua';

	let activeScope: 'Pusat' | 'Daerah' | 'Desa' | 'Kelompok' = paramScope || 'Kelompok';
	let activeId: number | null = null;

	// Evaluasi scope aktif berdasarkan parameter URL yang diizinkan
	if (paramScope && paramId) {
		if (paramScope === 'Kelompok' && (adminScope.isPusat || accessibleWilayah.allowedKelompokIdSet.has(paramId))) {
			activeScope = 'Kelompok';
			activeId = paramId;
		} else if (
			paramScope === 'Desa' &&
			(adminScope.isPusat || accessibleWilayah.desaList.some((d) => d.id === paramId))
		) {
			activeScope = 'Desa';
			activeId = paramId;
		} else if (
			paramScope === 'Daerah' &&
			(adminScope.isPusat || accessibleWilayah.daerahList.some((dr) => dr.id === paramId))
		) {
			activeScope = 'Daerah';
			activeId = paramId;
		}
	}

	// Default fallback sesuai hak akses jika paramId tidak ada di URL:
	// - Jika admin tingkat kelompok: langsung otomatis pilih kelompoknya sendiri dan sematkan ke URL.
	// - Jika admin tingkat atas (Desa/Daerah/Pusat) dengan banyak opsi: default NULL (harus dipilih manual).
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

	// Informasi detail entitas wilayah aktif
	let activeWilayahInfo: {
		nama: string;
		indukNama?: string;
		keterangan?: string;
	} = { nama: 'Pilih Wilayah' };

	if (activeScope === 'Kelompok' && activeId) {
		const k = accessibleWilayah.kelompokList.find((item) => item.id === activeId);
		if (k) {
			activeWilayahInfo = {
				nama: k.nama,
				indukNama: `${k.desaNama || '-'}, ${k.daerahNama || '-'}`
			};
		}
	} else if (activeScope === 'Desa' && activeId) {
		const d = accessibleWilayah.desaList.find((item) => item.id === activeId);
		if (d) {
			activeWilayahInfo = {
				nama: d.nama,
				indukNama: d.daerahNama || '-'
			};
		}
	} else if (activeScope === 'Daerah' && activeId) {
		const dr = accessibleWilayah.daerahList.find((item) => item.id === activeId);
		if (dr) {
			activeWilayahInfo = {
				nama: dr.nama,
				indukNama: dr.provinsi
			};
		}
	}

	// 1. Pastikan jenis shodaqoh default ("Shodaqoh Kelompok/Desa/Daerah" & "Shodaqoh Lainnya") telah ada untuk scope ini
	if (activeId) {
		const defaultNamaUtama = `Shodaqoh ${activeScope}`;
		const existingJenis = (await db
			.select()
			.from(jenisShodaqoh)
			.where(
				and(
					eq(jenisShodaqoh.tingkatScope, activeScope),
					activeScope === 'Kelompok'
						? eq(jenisShodaqoh.kelompokId, activeId)
						: activeScope === 'Desa'
							? eq(jenisShodaqoh.desaId, activeId)
							: eq(jenisShodaqoh.daerahId, activeId)
				)
			)
);
		const hasUtama = existingJenis.some((j) => j.nama.toLowerCase() === defaultNamaUtama.toLowerCase());
		const hasLainnya = existingJenis.some((j) => j.nama.toLowerCase().includes('lainnya'));

		const now = Math.floor(Date.now() / 1000);

		if (!hasUtama) {
(await db.insert(jenisShodaqoh)
				.values({
					tingkatScope: activeScope,
					daerahId: activeScope === 'Daerah' ? activeId : null,
					desaId: activeScope === 'Desa' ? activeId : null,
					kelompokId: activeScope === 'Kelompok' ? activeId : null,
					nama: defaultNamaUtama,
					deskripsi: `Penerimaan infaq & shodaqoh rutin ${activeScope}`,
					isDefault: true,
					isActive: true,
					createdAt: now,
					updatedAt: now
				})
);
		}

		if (!hasLainnya) {
(await db.insert(jenisShodaqoh)
				.values({
					tingkatScope: activeScope,
					daerahId: activeScope === 'Daerah' ? activeId : null,
					desaId: activeScope === 'Desa' ? activeId : null,
					kelompokId: activeScope === 'Kelompok' ? activeId : null,
					nama: 'Shodaqoh Lainnya',
					deskripsi: 'Alokasi shodaqoh umum atau keperluan mendesak',
					isDefault: true,
					isActive: true,
					createdAt: now,
					updatedAt: now
				})
);
		}
	}

	// 2. Ambil list jenis shodaqoh untuk wilayah aktif (terisolasi per wilayah)
	const listJenis = (await (activeId ? db
				.select()
				.from(jenisShodaqoh)
				.where(
					and(
						eq(jenisShodaqoh.tingkatScope, activeScope),
						activeScope === 'Kelompok'
							? eq(jenisShodaqoh.kelompokId, activeId)
							: activeScope === 'Desa'
								? eq(jenisShodaqoh.desaId, activeId)
								: eq(jenisShodaqoh.daerahId, activeId)
					)
				)
				.orderBy(desc(jenisShodaqoh.isDefault), desc(jenisShodaqoh.createdAt)) : []));

	// 3. Ambil daftar rekening & QRIS wilayah aktif
	const listRekening = (await (activeId ? db
				.select()
				.from(rekeningWilayah)
				.where(
					and(
						eq(rekeningWilayah.tingkatScope, activeScope),
						activeScope === 'Kelompok'
							? eq(rekeningWilayah.kelompokId, activeId)
							: activeScope === 'Desa'
								? eq(rekeningWilayah.desaId, activeId)
								: eq(rekeningWilayah.daerahId, activeId)
					)
				)
				.orderBy(desc(rekeningWilayah.createdAt)) : []));

	// 4. Query transaksi shodaqoh untuk wilayah aktif
	const whereCondition = and(
		eq(transaksiShodaqoh.tingkatScope, activeScope),
		activeScope === 'Kelompok'
			? eq(transaksiShodaqoh.kelompokId, activeId || 0)
			: activeScope === 'Desa'
				? eq(transaksiShodaqoh.desaId, activeId || 0)
				: eq(transaksiShodaqoh.daerahId, activeId || 0),
		filterStatus !== 'Semua' ? eq(transaksiShodaqoh.statusApproval, filterStatus) : undefined
	);
	const allTransaksi = (await (activeId ? db
				.select({
					id: transaksiShodaqoh.id,
					userId: transaksiShodaqoh.userId,
					namaPengirim: transaksiShodaqoh.namaPengirim,
					noTelepon: transaksiShodaqoh.noTelepon,
					namaJenisShodaqoh: transaksiShodaqoh.namaJenisShodaqoh,
					nominal: transaksiShodaqoh.nominal,
					tanggalTransfer: transaksiShodaqoh.tanggalTransfer,
					metodePembayaran: transaksiShodaqoh.metodePembayaran,
					buktiTransferUrl: transaksiShodaqoh.buktiTransferUrl,
					catatan: transaksiShodaqoh.catatan,
					statusApproval: transaksiShodaqoh.statusApproval,
					alasanPenolakan: transaksiShodaqoh.alasanPenolakan,
					approvedByUserId: transaksiShodaqoh.approvedByUserId,
					approvedAt: transaksiShodaqoh.approvedAt,
					createdAt: transaksiShodaqoh.createdAt,
					approvedByName: users.namaLengkap
				})
				.from(transaksiShodaqoh)
				.leftJoin(users, eq(transaksiShodaqoh.approvedByUserId, users.id))
				.where(whereCondition)
				.orderBy(desc(transaksiShodaqoh.createdAt)) : []));

	// 5. Agregasi Statistik Ringkasan
	let totalTerkumpul = 0;
	let totalPending = 0;
	let totalApproved = 0;
	let totalRejected = 0;

	// Statistik agregat dari seluruh transaksi wilayah ini (terlepas dari filter query)
	const unFilteredTransaksi = (await (activeId ? db
				.select({
					nominal: transaksiShodaqoh.nominal,
					statusApproval: transaksiShodaqoh.statusApproval,
					namaJenisShodaqoh: transaksiShodaqoh.namaJenisShodaqoh,
					tanggalTransfer: transaksiShodaqoh.tanggalTransfer
				})
				.from(transaksiShodaqoh)
				.where(
					and(
						eq(transaksiShodaqoh.tingkatScope, activeScope),
						activeScope === 'Kelompok'
							? eq(transaksiShodaqoh.kelompokId, activeId)
							: activeScope === 'Desa'
								? eq(transaksiShodaqoh.desaId, activeId)
								: eq(transaksiShodaqoh.daerahId, activeId)
					)
				) : []));

	const monthlyMap: Record<string, number> = {};
	const jenisMap: Record<string, number> = {};

	for (const t of unFilteredTransaksi) {
		if (t.statusApproval === 'Disetujui') {
			totalTerkumpul += t.nominal;
			totalApproved += 1;

			// Agregat bulanan (format YYYY-MM)
			const ym = t.tanggalTransfer ? t.tanggalTransfer.substring(0, 7) : 'Lainnya';
			monthlyMap[ym] = (monthlyMap[ym] || 0) + t.nominal;

			// Agregat per jenis
			jenisMap[t.namaJenisShodaqoh] = (jenisMap[t.namaJenisShodaqoh] || 0) + t.nominal;
		} else if (t.statusApproval === 'Menunggu Persetujuan') {
			totalPending += 1;
		} else if (t.statusApproval === 'Ditolak') {
			totalRejected += 1;
		}
	}

	// Susun array grafik tren bulanan (urutkan kronologis)
	const monthlyTrend = Object.entries(monthlyMap)
		.sort(([a], [b]) => a.localeCompare(b))
		.slice(-6)
		.map(([bulan, total]) => ({ bulan, total }));

	// Susun array distribusi jenis shodaqoh
	const jenisBreakdown = Object.entries(jenisMap)
		.map(([jenis, total]) => ({ jenis, total }))
		.sort((a, b) => b.total - a.total);

	const canManage = await canManageShodaqoh(roles, activeScope, activeId || undefined);

	return {
		activeScope,
		activeId,
		activeWilayahInfo,
		accessibleWilayah,
		listJenis,
		listRekening,
		transaksiList: allTransaksi,
		filterStatus,
		stats: {
			totalTerkumpul,
			totalPending,
			totalApproved,
			totalRejected,
			totalTransaksi: unFilteredTransaksi.length
		},
		monthlyTrend,
		jenisBreakdown,
		canManage
	};
};

export const actions: Actions = {
	approve: async ({ request, url, locals }) => {
		if (!locals.user || !locals.isAdmin) {
			return fail(401, { message: 'Akses tidak sah' });
		}

		const formData = await request.formData();
		const id = formData.get('id') as string;
		const scope = (formData.get('scope') as 'Pusat' | 'Daerah' | 'Desa' | 'Kelompok') || (url.searchParams.get('scope') as any);
		const targetId = Number(formData.get('targetId') || url.searchParams.get('id'));
		const tab = (formData.get('tab') as string) || url.searchParams.get('tab') || 'transaksi';

		if (!await canManageShodaqoh(locals.roles || [], scope, targetId)) {
			return fail(403, { message: 'Hanya KU dan Kyai yang dapat menyetujui transaksi shodaqoh' });
		}

		if (!id) {
			return fail(400, { message: 'ID transaksi diperlukan' });
		}

(await db.update(transaksiShodaqoh)
			.set({
				statusApproval: 'Disetujui',
				alasanPenolakan: null,
				approvedByUserId: locals.user.id,
				approvedAt: Math.floor(Date.now() / 1000),
				updatedAt: Math.floor(Date.now() / 1000)
			})
			.where(eq(transaksiShodaqoh.id, id))
);
		return { success: true, message: 'Laporan shodaqoh berhasil disetujui', scope, id: targetId, tab };
	},

	reject: async ({ request, url, locals }) => {
		if (!locals.user || !locals.isAdmin) {
			return fail(401, { message: 'Akses tidak sah' });
		}

		const formData = await request.formData();
		const id = formData.get('id') as string;
		const scope = (formData.get('scope') as 'Pusat' | 'Daerah' | 'Desa' | 'Kelompok') || (url.searchParams.get('scope') as any);
		const targetId = Number(formData.get('targetId') || url.searchParams.get('id'));
		const tab = (formData.get('tab') as string) || url.searchParams.get('tab') || 'transaksi';
		const alasanPenolakan = (formData.get('alasanPenolakan') as string) || 'Bukti transfer tidak valid';

		if (!await canManageShodaqoh(locals.roles || [], scope, targetId)) {
			return fail(403, { message: 'Hanya KU dan Kyai yang dapat menolak transaksi shodaqoh' });
		}

		if (!id) {
			return fail(400, { message: 'ID transaksi diperlukan' });
		}

(await db.update(transaksiShodaqoh)
			.set({
				statusApproval: 'Ditolak',
				alasanPenolakan,
				approvedByUserId: locals.user.id,
				approvedAt: Math.floor(Date.now() / 1000),
				updatedAt: Math.floor(Date.now() / 1000)
			})
			.where(eq(transaksiShodaqoh.id, id))
);
		return { success: true, message: 'Laporan shodaqoh ditolak', scope, id: targetId, tab };
	},

	addJenis: async ({ request, url, locals }) => {
		if (!locals.user || !locals.isAdmin) {
			return fail(401, { message: 'Akses tidak sah' });
		}

		const formData = await request.formData();
		const scope = (formData.get('scope') as 'Pusat' | 'Daerah' | 'Desa' | 'Kelompok') || (url.searchParams.get('scope') as any);
		const targetId = Number(formData.get('targetId') || url.searchParams.get('id'));
		const tab = (formData.get('tab') as string) || url.searchParams.get('tab') || 'jenis';
		const nama = ((formData.get('nama') as string) || '').trim();
		const deskripsi = ((formData.get('deskripsi') as string) || '').trim();

		if (!await canManageShodaqoh(locals.roles || [], scope, targetId)) {
			return fail(403, { message: 'Hanya KU dan Kyai yang dapat menambahkan jenis shodaqoh' });
		}

		if (!nama) {
			return fail(400, { message: 'Nama jenis shodaqoh wajib diisi' });
		}

		const now = Math.floor(Date.now() / 1000);

(await db.insert(jenisShodaqoh)
			.values({
				tingkatScope: scope,
				daerahId: scope === 'Daerah' ? targetId : null,
				desaId: scope === 'Desa' ? targetId : null,
				kelompokId: scope === 'Kelompok' ? targetId : null,
				nama,
				deskripsi: deskripsi || null,
				isDefault: false,
				isActive: true,
				createdAt: now,
				updatedAt: now
			})
);
		return { success: true, message: `Jenis shodaqoh "${nama}" berhasil ditambahkan`, scope, id: targetId, tab };
	},

	deleteJenis: async ({ request, url, locals }) => {
		if (!locals.user || !locals.isAdmin) {
			return fail(401, { message: 'Akses tidak sah' });
		}

		const formData = await request.formData();
		const id = formData.get('id') as string;
		const scope = (formData.get('scope') as 'Pusat' | 'Daerah' | 'Desa' | 'Kelompok') || (url.searchParams.get('scope') as any);
		const targetId = Number(formData.get('targetId') || url.searchParams.get('id'));
		const tab = (formData.get('tab') as string) || url.searchParams.get('tab') || 'jenis';

		if (!await canManageShodaqoh(locals.roles || [], scope, targetId)) {
			return fail(403, { message: 'Hanya KU dan Kyai yang dapat menghapus jenis shodaqoh' });
		}

		// Jangan izinkan penghapusan jenis default
		const target = (await first(db.select().from(jenisShodaqoh).where(eq(jenisShodaqoh.id, id))));
		if (target?.isDefault) {
			return fail(400, { message: 'Jenis shodaqoh default tidak dapat dihapus' });
		}

(await db.delete(jenisShodaqoh).where(eq(jenisShodaqoh.id, id)));

		return { success: true, message: 'Jenis shodaqoh berhasil dihapus', scope, id: targetId, tab };
	},

	saveRekening: async ({ request, url, locals }) => {
		if (!locals.user || !locals.isAdmin) {
			return fail(401, { message: 'Akses tidak sah' });
		}

		const formData = await request.formData();
		const scope = (formData.get('scope') as 'Pusat' | 'Daerah' | 'Desa' | 'Kelompok') || (url.searchParams.get('scope') as any);
		const targetId = Number(formData.get('targetId') || formData.get('id') || url.searchParams.get('id'));
		const tab = (formData.get('tab') as string) || url.searchParams.get('tab') || 'rekening';
		const rekeningId = (formData.get('rekeningId') as string) || null;
		const metodeTipe = (formData.get('metodeTipe') as 'bank' | 'qris') || (formData.get('metode') as 'bank' | 'qris') || 'bank';
		const atasNama = ((formData.get('atasNama') as string) || '').trim();
		const tipeTujuan = ((formData.get('tipeTujuan') as string) || 'Infaq & Shodaqoh').trim();
		const keterangan = ((formData.get('keterangan') as string) || '').trim() || null;
		const isActive = formData.has('isActive') ? (formData.get('isActive') === '1' || formData.get('isActive') === 'true') : true;

		if (!await canManageShodaqoh(locals.roles || [], scope, targetId)) {
			return fail(403, { message: 'Hanya KU dan Kyai yang dapat mengelola rekening/QRIS' });
		}

		if (!atasNama) {
			return fail(400, { message: 'Nama pemilik rekening/QRIS (Atas Nama) wajib diisi' });
		}

		let existing = null;
		if (rekeningId) {
			existing = (await first(db.select().from(rekeningWilayah).where(eq(rekeningWilayah.id, rekeningId))));
		}

		let namaBank = '';
		let nomorRekening = '';
		let qrisImageUrl: string | null = existing?.qrisImageUrl ?? null;

		if (metodeTipe === 'qris') {
			namaBank = String(formData.get('namaBank') || 'QRIS').trim() || 'QRIS';
			nomorRekening = String(formData.get('nomorRekening') || '-').trim() || '-';

			const qrisFile = formData.get('qrisFile') || formData.get('qrisImage');
			const qrisUrlText = String(formData.get('qrisImageUrl') || '').trim();

			if ((qrisFile instanceof File && qrisFile.size > 0) || qrisUrlText) {
				qrisImageUrl = await saveUploadedQris(
					qrisFile instanceof File && qrisFile.size > 0 ? qrisFile : qrisUrlText
				);
			}

			if (!qrisImageUrl) {
				return fail(400, { message: 'File gambar atau tautan QRIS wajib diunggah untuk metode QRIS' });
			}
		} else {
			// Transfer Bank
			namaBank = String(formData.get('namaBank') || '').trim();
			nomorRekening = String(formData.get('nomorRekening') || '').trim();
			qrisImageUrl = null;

			if (!namaBank || !nomorRekening) {
				return fail(400, { message: 'Nama bank dan nomor rekening wajib diisi untuk transfer bank' });
			}
		}

		const now = Math.floor(Date.now() / 1000);

		if (rekeningId && existing) {
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
			return { success: true, message: `Rekening/QRIS ${namaBank} berhasil diperbarui`, scope, id: targetId, tab };
		} else {
(await db.insert(rekeningWilayah)
				.values({
					tingkatScope: scope,
					daerahId: scope === 'Daerah' ? targetId : null,
					desaId: scope === 'Desa' ? targetId : null,
					kelompokId: scope === 'Kelompok' ? targetId : null,
					namaBank,
					nomorRekening,
					atasNama,
					tipeTujuan,
					qrisImageUrl,
					keterangan,
					isActive,
					createdAt: now
				})
);
			return { success: true, message: `Rekening/QRIS ${namaBank} berhasil disimpan`, scope, id: targetId, tab };
		}
	},

	deleteRekening: async ({ request, url, locals }) => {
		if (!locals.user || !locals.isAdmin) {
			return fail(401, { message: 'Akses tidak sah' });
		}

		const formData = await request.formData();
		const id = (formData.get('id') as string) || (formData.get('rekeningId') as string);
		const scope = (formData.get('scope') as 'Pusat' | 'Daerah' | 'Desa' | 'Kelompok') || (url.searchParams.get('scope') as any);
		const targetId = Number(formData.get('targetId') || formData.get('id') || url.searchParams.get('id'));
		const tab = (formData.get('tab') as string) || url.searchParams.get('tab') || 'rekening';

		if (!await canManageShodaqoh(locals.roles || [], scope, targetId)) {
			return fail(403, { message: 'Hanya KU dan Kyai yang dapat menghapus rekening/QRIS' });
		}

(await db.delete(rekeningWilayah).where(eq(rekeningWilayah.id, id)));

		return { success: true, message: 'Rekening/QRIS berhasil dihapus', scope, id: targetId, tab };
	}
};

