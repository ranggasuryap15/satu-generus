/**
 * @file src/routes/(admin)/admin/keuangan/shodaqoh/+page.server.ts
 * @purpose Backend controller manajemen shodaqoh berjenjang wilayah (Kelompok, Desa, Daerah): rekapitulasi statistik & grafik transaksi, approval bukti transfer, CRUD rekening & QRIS, serta isolasi jenis shodaqoh khusus KU dan Kyai. Semua action mengembalikan scope, id wilayah, dan tab aktif agar URL dan state tab tidak ter-reset ke tab default
 * @usedBy src/routes/(admin)/admin/keuangan/shodaqoh/+page.svelte
 * @dependencies src/lib/db, src/lib/db/schema, src/lib/server/scope, drizzle-orm, @sveltejs/kit, node:fs, node:path
 * @publicFunctions load, actions (approve, reject, addJenis, deleteJenis, saveRekening, deleteRekening)
 * @sideEffects Mutasi status approval transaksi shodaqoh, pembuatan jenis shodaqoh scoped, dan modifikasi data rekening/QRIS di SQLite
 */

import { fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/db';
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
import fs from 'node:fs';
import path from 'node:path';

async function saveUploadedQris(fileOrBase64OrUrl: any): Promise<string | null> {
	if (!fileOrBase64OrUrl) return null;
	const uploadDir = path.resolve(process.cwd(), 'static/uploads/qris');
	if (!fs.existsSync(uploadDir)) {
		fs.mkdirSync(uploadDir, { recursive: true });
	}

	if (fileOrBase64OrUrl instanceof File && fileOrBase64OrUrl.size > 0) {
		const rawExt = fileOrBase64OrUrl.type.split('/')[1] || 'png';
		const ext = rawExt === 'jpeg' ? 'jpg' : rawExt;
		const filename = `qris_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`;
		const arrayBuffer = await fileOrBase64OrUrl.arrayBuffer();
		fs.writeFileSync(path.join(uploadDir, filename), Buffer.from(arrayBuffer));
		return `/uploads/qris/${filename}`;
	}

	if (typeof fileOrBase64OrUrl === 'string') {
		const trimmed = fileOrBase64OrUrl.trim();
		if (trimmed.startsWith('data:image/')) {
			const matches = trimmed.match(/^data:image\/([a-zA-Z0-9-+]+);base64,(.+)$/);
			if (matches) {
				const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
				const buffer = Buffer.from(matches[2], 'base64');
				const filename = `qris_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`;
				fs.writeFileSync(path.join(uploadDir, filename), buffer);
				return `/uploads/qris/${filename}`;
			}
		}
		return trimmed || null;
	}

	return null;
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
	const accessibleWilayah = getAccessibleWilayah(adminScope);

	const paramScope = url.searchParams.get('scope') as 'Pusat' | 'Daerah' | 'Desa' | 'Kelompok' | null;
	const paramId = url.searchParams.get('id') ? Number(url.searchParams.get('id')) : null;
	const filterStatus = url.searchParams.get('status') || 'Semua';

	let activeScope: 'Pusat' | 'Daerah' | 'Desa' | 'Kelompok' = 'Kelompok';
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

	// Default fallback sesuai hak akses
	if (!activeId) {
		if (adminScope.level === 'Kelompok' && accessibleWilayah.kelompokList.length > 0) {
			activeScope = 'Kelompok';
			activeId = accessibleWilayah.kelompokList[0].id;
		} else if (adminScope.level === 'Desa' && accessibleWilayah.desaList.length > 0) {
			activeScope = 'Desa';
			activeId = accessibleWilayah.desaList[0].id;
		} else if (adminScope.level === 'Daerah' && accessibleWilayah.daerahList.length > 0) {
			activeScope = 'Daerah';
			activeId = accessibleWilayah.daerahList[0].id;
		} else if (accessibleWilayah.kelompokList.length > 0) {
			activeScope = 'Kelompok';
			activeId = accessibleWilayah.kelompokList[0].id;
		} else if (accessibleWilayah.desaList.length > 0) {
			activeScope = 'Desa';
			activeId = accessibleWilayah.desaList[0].id;
		} else if (accessibleWilayah.daerahList.length > 0) {
			activeScope = 'Daerah';
			activeId = accessibleWilayah.daerahList[0].id;
		}
	}

	// Informasi detail entitas wilayah aktif
	let activeWilayahInfo: {
		nama: string;
		indukNama?: string;
		keterangan?: string;
	} = { nama: '-' };

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
		const existingJenis = db
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
			.all();

		const hasUtama = existingJenis.some((j) => j.nama.toLowerCase() === defaultNamaUtama.toLowerCase());
		const hasLainnya = existingJenis.some((j) => j.nama.toLowerCase().includes('lainnya'));

		const now = Math.floor(Date.now() / 1000);

		if (!hasUtama) {
			db.insert(jenisShodaqoh)
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
				.run();
		}

		if (!hasLainnya) {
			db.insert(jenisShodaqoh)
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
				.run();
		}
	}

	// 2. Ambil list jenis shodaqoh untuk wilayah aktif (terisolasi per wilayah)
	const listJenis = activeId
		? db
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
				.orderBy(desc(jenisShodaqoh.isDefault), desc(jenisShodaqoh.createdAt))
				.all()
		: [];

	// 3. Ambil daftar rekening & QRIS wilayah aktif
	const listRekening = activeId
		? db
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
				.orderBy(desc(rekeningWilayah.createdAt))
				.all()
		: [];

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

	const allTransaksi = activeId
		? db
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
				.orderBy(desc(transaksiShodaqoh.createdAt))
				.all()
		: [];

	// 5. Agregasi Statistik Ringkasan
	let totalTerkumpul = 0;
	let totalPending = 0;
	let totalApproved = 0;
	let totalRejected = 0;

	// Statistik agregat dari seluruh transaksi wilayah ini (terlepas dari filter query)
	const unFilteredTransaksi = activeId
		? db
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
				)
				.all()
		: [];

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

	const canManage = canManageShodaqoh(roles, activeScope, activeId || undefined);

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

		if (!canManageShodaqoh(locals.roles || [], scope, targetId)) {
			return fail(403, { message: 'Hanya KU dan Kyai yang dapat menyetujui transaksi shodaqoh' });
		}

		if (!id) {
			return fail(400, { message: 'ID transaksi diperlukan' });
		}

		db.update(transaksiShodaqoh)
			.set({
				statusApproval: 'Disetujui',
				alasanPenolakan: null,
				approvedByUserId: locals.user.id,
				approvedAt: Math.floor(Date.now() / 1000),
				updatedAt: Math.floor(Date.now() / 1000)
			})
			.where(eq(transaksiShodaqoh.id, id))
			.run();

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

		if (!canManageShodaqoh(locals.roles || [], scope, targetId)) {
			return fail(403, { message: 'Hanya KU dan Kyai yang dapat menolak transaksi shodaqoh' });
		}

		if (!id) {
			return fail(400, { message: 'ID transaksi diperlukan' });
		}

		db.update(transaksiShodaqoh)
			.set({
				statusApproval: 'Ditolak',
				alasanPenolakan,
				approvedByUserId: locals.user.id,
				approvedAt: Math.floor(Date.now() / 1000),
				updatedAt: Math.floor(Date.now() / 1000)
			})
			.where(eq(transaksiShodaqoh.id, id))
			.run();

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

		if (!canManageShodaqoh(locals.roles || [], scope, targetId)) {
			return fail(403, { message: 'Hanya KU dan Kyai yang dapat menambahkan jenis shodaqoh' });
		}

		if (!nama) {
			return fail(400, { message: 'Nama jenis shodaqoh wajib diisi' });
		}

		const now = Math.floor(Date.now() / 1000);

		db.insert(jenisShodaqoh)
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
			.run();

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

		if (!canManageShodaqoh(locals.roles || [], scope, targetId)) {
			return fail(403, { message: 'Hanya KU dan Kyai yang dapat menghapus jenis shodaqoh' });
		}

		// Jangan izinkan penghapusan jenis default
		const target = db.select().from(jenisShodaqoh).where(eq(jenisShodaqoh.id, id)).get();
		if (target?.isDefault) {
			return fail(400, { message: 'Jenis shodaqoh default tidak dapat dihapus' });
		}

		db.delete(jenisShodaqoh).where(eq(jenisShodaqoh.id, id)).run();

		return { success: true, message: 'Jenis shodaqoh berhasil dihapus', scope, id: targetId, tab };
	},

	saveRekening: async ({ request, url, locals }) => {
		if (!locals.user || !locals.isAdmin) {
			return fail(401, { message: 'Akses tidak sah' });
		}

		const formData = await request.formData();
		const scope = (formData.get('scope') as 'Pusat' | 'Daerah' | 'Desa' | 'Kelompok') || (url.searchParams.get('scope') as any);
		const targetId = Number(formData.get('targetId') || url.searchParams.get('id'));
		const tab = (formData.get('tab') as string) || url.searchParams.get('tab') || 'rekening';
		const metodeTipe = formData.get('metodeTipe') as 'bank' | 'qris'; // 'bank' | 'qris'
		const namaBank = ((formData.get('namaBank') as string) || (metodeTipe === 'qris' ? 'QRIS' : '')).trim();
		const nomorRekening = ((formData.get('nomorRekening') as string) || (metodeTipe === 'qris' ? '-' : '')).trim();
		const atasNama = ((formData.get('atasNama') as string) || '').trim();
		const tipeTujuan = ((formData.get('tipeTujuan') as string) || 'Infaq & Shodaqoh').trim();
		const keterangan = ((formData.get('keterangan') as string) || '').trim();
		const qrisFileOrUrl = formData.get('qrisImage');

		if (!canManageShodaqoh(locals.roles || [], scope, targetId)) {
			return fail(403, { message: 'Hanya KU dan Kyai yang dapat mengelola rekening/QRIS' });
		}

		if (!atasNama) {
			return fail(400, { message: 'Nama pemilik rekening/QRIS (Atas Nama) wajib diisi' });
		}

		let qrisImageUrl: string | null = null;
		if (metodeTipe === 'qris') {
			qrisImageUrl = await saveUploadedQris(qrisFileOrUrl);
			if (!qrisImageUrl) {
				return fail(400, { message: 'File gambar atau link QRIS wajib diunggah untuk metode QRIS' });
			}
		}

		const now = Math.floor(Date.now() / 1000);

		db.insert(rekeningWilayah)
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
				keterangan: keterangan || null,
				isActive: true,
				createdAt: now
			})
			.run();

		return { success: true, message: `Rekening/QRIS ${namaBank} berhasil disimpan`, scope, id: targetId, tab };
	},

	deleteRekening: async ({ request, url, locals }) => {
		if (!locals.user || !locals.isAdmin) {
			return fail(401, { message: 'Akses tidak sah' });
		}

		const formData = await request.formData();
		const id = formData.get('id') as string;
		const scope = (formData.get('scope') as 'Pusat' | 'Daerah' | 'Desa' | 'Kelompok') || (url.searchParams.get('scope') as any);
		const targetId = Number(formData.get('targetId') || url.searchParams.get('id'));
		const tab = (formData.get('tab') as string) || url.searchParams.get('tab') || 'rekening';

		if (!canManageShodaqoh(locals.roles || [], scope, targetId)) {
			return fail(403, { message: 'Hanya KU dan Kyai yang dapat menghapus rekening/QRIS' });
		}

		db.delete(rekeningWilayah).where(eq(rekeningWilayah.id, id)).run();

		return { success: true, message: 'Rekening/QRIS berhasil dihapus', scope, id: targetId, tab };
	}
};

