/**
 * @file src/routes/(app)/shodaqoh/+page.server.ts
 * @purpose Backend controller halaman shodaqoh jamaah mobile-first: menampilkan info rekening/QRIS wilayah, daftar jenis shodaqoh aktif scoped, pelaporan konfirmasi transfer shodaqoh, dan riwayat donasi jamaah
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
import { and, desc, eq } from 'drizzle-orm';
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

	// 1. Ambil rekening & QRIS aktif untuk kelompok yang dipilih
	const rekeningList = targetKelompokId
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

	// 2. Ambil jenis shodaqoh aktif yang terisolasi untuk kelompok ini
	const listJenis = targetKelompokId
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

	// Jika belum ada jenis di DB, fallback ke jenis default standar
	const finalJenisList =
		listJenis.length > 0
			? listJenis
			: [
					{
						id: 'default-kelompok',
						nama: 'Shodaqoh Kelompok',
						deskripsi: 'Penerimaan shodaqoh rutin kelompok',
						isDefault: true
					},
					{
						id: 'default-lainnya',
						nama: 'Shodaqoh Lainnya',
						deskripsi: 'Alokasi shodaqoh umum atau keperluan mendesak',
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
		allKelompok,
		rekeningList,
		jenisList: finalJenisList,
		riwayatSaya,
		user
	};
};

export const actions: Actions = {
	laporShodaqoh: async ({ request, locals }) => {
		const formData = await request.formData();
		const kelompokId = Number(formData.get('kelompokId'));
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

		if (!kelompokId) {
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
				tingkatScope: 'Kelompok',
				kelompokId,
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
			message: 'Laporan shodaqoh berhasil dikirim dan sedang menunggu verifikasi pengurus.'
		};
	}
};

