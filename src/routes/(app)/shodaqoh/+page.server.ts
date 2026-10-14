/**
 * @file src/routes/(app)/shodaqoh/+page.server.ts
 * @purpose Backend controller halaman shodaqoh jamaah mobile-first: menampilkan info rekening/QRIS resmi tingkat Kelompok dan Desa bagi jamaah, daftar jenis shodaqoh aktif, pelaporan konfirmasi transfer shodaqoh, dan riwayat donasi jamaah
 * @usedBy src/routes/(app)/shodaqoh/+page.svelte
 * @dependencies src/lib/db, src/lib/db/schema, drizzle-orm, @sveltejs/kit, src/lib/server/upload
 * @publicFunctions load, actions (laporShodaqoh)
 * @sideEffects Menyimpan file bukti transfer ke root uploads/bukti-transfer dan mencatat transaksi shodaqoh baru di tabel SQLite
 */

import { fail } from '@sveltejs/kit';
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
import { and, desc, eq, or } from 'drizzle-orm';
import { saveUploadedFile } from '$lib/server/upload';

async function saveUploadedBukti(fileOrBase64OrUrl: any): Promise<string | null> {
	return saveUploadedFile(fileOrBase64OrUrl, 'bukti-transfer', 'bukti');
}

export const load: PageServerLoad = async ({ locals, url }) => {
	const user = locals.user;

	// Tentukan wilayah jamaah: dari user.kelompokId jika ada, atau dari URL param
	const paramKelompokId = url.searchParams.get('kelompokId')
		? Number(url.searchParams.get('kelompokId'))
		: null;

	let targetKelompokId = paramKelompokId || (user?.kelompokId ? Number(user.kelompokId) : null);

	// Ambil daftar kelompok untuk switcher opsional jika user ingin berinfaq ke kelompok lain
	const allKelompok = db
		.select({
			id: kelompok.id,
			nama: kelompok.nama,
			desaId: kelompok.desaId,
			desaNama: desa.nama,
			daerahNama: daerah.nama
		})
		.from(kelompok)
		.innerJoin(desa, eq(kelompok.desaId, desa.id))
		.innerJoin(daerah, eq(desa.daerahId, daerah.id))
		.all();

	if (!targetKelompokId && allKelompok.length > 0) {
		targetKelompokId = allKelompok[0].id;
	}

	const selectedKelompok = allKelompok.find((k) => k.id === targetKelompokId);
	const targetDesaId = selectedKelompok?.desaId || null;

	// 1. Ambil rekening & QRIS aktif: Tingkat Kelompok dan Tingkat Desa
	const rekeningKelompokList = targetKelompokId
		? db
				.select()
				.from(rekeningWilayah)
				.where(
					and(
						eq(rekeningWilayah.tingkatScope, 'Kelompok'),
						eq(rekeningWilayah.kelompokId, targetKelompokId),
						eq(rekeningWilayah.isActive, true)
					)
				)
				.orderBy(desc(rekeningWilayah.createdAt))
				.all()
		: [];

	const rekeningDesaList = targetDesaId
		? db
				.select()
				.from(rekeningWilayah)
				.where(
					and(
						eq(rekeningWilayah.tingkatScope, 'Desa'),
						eq(rekeningWilayah.desaId, targetDesaId),
						eq(rekeningWilayah.isActive, true)
					)
				)
				.orderBy(desc(rekeningWilayah.createdAt))
				.all()
		: [];

	// Rekening gabungan untuk compatibility
	const rekeningList = [...rekeningKelompokList, ...rekeningDesaList];

	// 2. Ambil jenis shodaqoh aktif untuk Kelompok dan Desa
	const listJenisKelompok = targetKelompokId
		? db
				.select()
				.from(jenisShodaqoh)
				.where(
					and(
						eq(jenisShodaqoh.tingkatScope, 'Kelompok'),
						eq(jenisShodaqoh.kelompokId, targetKelompokId),
						eq(jenisShodaqoh.isActive, true)
					)
				)
				.orderBy(desc(jenisShodaqoh.isDefault), desc(jenisShodaqoh.createdAt))
				.all()
		: [];

	const listJenisDesa = targetDesaId
		? db
				.select()
				.from(jenisShodaqoh)
				.where(
					and(
						eq(jenisShodaqoh.tingkatScope, 'Desa'),
						eq(jenisShodaqoh.desaId, targetDesaId),
						eq(jenisShodaqoh.isActive, true)
					)
				)
				.orderBy(desc(jenisShodaqoh.isDefault), desc(jenisShodaqoh.createdAt))
				.all()
		: [];

	const rawCombinedJenis = [...listJenisKelompok, ...listJenisDesa];

	// Jika belum ada jenis di DB, fallback ke jenis default standar
	const finalJenisList =
		rawCombinedJenis.length > 0
			? rawCombinedJenis
			: [
					{
						id: 'default-kelompok',
						nama: 'Shodaqoh Kelompok',
						deskripsi: 'Penerimaan shodaqoh rutin kelompok',
						tingkatScope: 'Kelompok',
						isDefault: true
					},
					{
						id: 'default-desa',
						nama: 'Shodaqoh Desa',
						deskripsi: 'Penerimaan shodaqoh rutin desa',
						tingkatScope: 'Desa',
						isDefault: true
					},
					{
						id: 'default-lainnya',
						nama: 'Shodaqoh Lainnya',
						deskripsi: 'Alokasi shodaqoh umum atau keperluan mendesak',
						tingkatScope: 'Kelompok',
						isDefault: true
					}
				];

	// 3. Riwayat shodaqoh user yang login (jika ada)
	const riwayatSaya = user
		? db
				.select()
				.from(transaksiShodaqoh)
				.where(eq(transaksiShodaqoh.userId, user.id))
				.orderBy(desc(transaksiShodaqoh.createdAt))
				.limit(20)
				.all()
		: [];

	return {
		selectedKelompok,
		targetDesaId,
		allKelompok,
		rekeningKelompokList,
		rekeningDesaList,
		rekeningList,
		jenisList: finalJenisList,
		riwayatSaya,
		user
	};
};

export const actions: Actions = {
	laporShodaqoh: async ({ request, locals }) => {
		const formData = await request.formData();
		const kelompokId = Number(formData.get('kelompokId')) || null;
		const tingkatScope = ((formData.get('tingkatScope') as string) || 'Kelompok') as 'Kelompok' | 'Desa';
		const desaId = Number(formData.get('desaId')) || null;
		const rekeningWilayahId = ((formData.get('rekeningWilayahId') as string) || '').trim() || null;
		const namaPengirim = ((formData.get('namaPengirim') as string) || '').trim();
		const noTelepon = ((formData.get('noTelepon') as string) || '').trim();
		const namaJenisShodaqoh = ((formData.get('namaJenisShodaqoh') as string) || 'Shodaqoh Kelompok').trim();
		const nominal = Number(formData.get('nominal'));
		const tanggalTransfer = (formData.get('tanggalTransfer') as string) || new Date().toISOString().substring(0, 10);
		const metodePembayaran = (formData.get('metodePembayaran') as string) || 'Transfer Bank';
		const catatan = ((formData.get('catatan') as string) || '').trim();
		const buktiFile = formData.get('buktiTransfer');

		if (!namaPengirim) {
			return fail(400, { message: 'Nama pengirim wajib diisi' });
		}

		if (!nominal || nominal <= 0) {
			return fail(400, { message: 'Nominal shodaqoh harus lebih besar dari 0' });
		}

		if (tingkatScope === 'Desa' && !desaId) {
			return fail(400, { message: 'Wilayah desa tujuan wajib dipilih' });
		}

		if (tingkatScope === 'Kelompok' && !kelompokId) {
			return fail(400, { message: 'Wilayah kelompok tujuan wajib dipilih' });
		}

		// Simpan file bukti transfer
		const buktiTransferUrl = await saveUploadedBukti(buktiFile);

		const now = Math.floor(Date.now() / 1000);

		db.insert(transaksiShodaqoh)
			.values({
				userId: locals.user?.id || null,
				namaPengirim,
				noTelepon: noTelepon || null,
				tingkatScope,
				kelompokId: tingkatScope === 'Kelompok' ? kelompokId : null,
				desaId: tingkatScope === 'Desa' ? desaId : null,
				rekeningWilayahId,
				namaJenisShodaqoh,
				nominal,
				tanggalTransfer,
				metodePembayaran,
				buktiTransferUrl,
				catatan: catatan || null,
				statusApproval: 'Menunggu Persetujuan',
				createdAt: now,
				updatedAt: now
			})
			.run();

		return {
			success: true,
			message: 'Laporan Shodaqoh Terkirim'
		};
	}
};

