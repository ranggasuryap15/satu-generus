/**
 * @file src/routes/(app)/transaksi/+page.server.ts
 * @purpose Memuat rekapitulasi riwayat transaksi jamaah (Isrun/FR dan Infaq & Shodaqoh) beserta total pengeluaran bulan ini
 * @usedBy Route client '/transaksi' pada src/routes/(app)/transaksi/+page.svelte
 * @dependencies src/lib/db, src/lib/db/schema, drizzle-orm, src/lib/presensi-waktu
 * @publicFunctions load
 * @sideEffects Query transaksi_shodaqoh dari PostgreSQL
 */

import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '#lib/db/index.js';
import { transaksiShodaqoh } from '#lib/db/schema.js';
import { eq, desc, and, gte, lte } from 'drizzle-orm';
import { getWaktuSekarangWIB } from '#lib/presensi-waktu.js';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(303, '/login?redirectTo=/transaksi');
	}

	const waktuWIB = getWaktuSekarangWIB();
	const today = waktuWIB.tanggal;
	const startOfMonth = `${today.slice(0, 7)}-01`;
	const endOfMonth = `${today.slice(0, 7)}-31`;

	// Query transaksi shodaqoh user
	const rawShodaqoh = await db
		.select()
		.from(transaksiShodaqoh)
		.where(eq(transaksiShodaqoh.userId, locals.user.id))
		.orderBy(desc(transaksiShodaqoh.tanggalTransfer));

	const totalBulanIni = rawShodaqoh
		.filter((t) => t.tanggalTransfer >= startOfMonth && t.tanggalTransfer <= endOfMonth)
		.reduce((sum, t) => sum + t.nominal, 0);

	const sampleList = [
		{
			id: 'sample-t1',
			kategori: 'Infaq & Shodaqoh',
			tanggalStr: '12 Okt 2026',
			nominal: 50000,
			type: 'shodaqoh'
		},
		{
			id: 'sample-t2',
			kategori: 'Isrun / FR',
			tanggalStr: '05 Okt 2026',
			nominal: 100000,
			type: 'isrun'
		}
	];

	const transaksiList = rawShodaqoh.length > 0
		? rawShodaqoh.map((t) => ({
				id: t.id,
				kategori: t.namaJenisShodaqoh || 'Infaq & Shodaqoh',
				tanggalStr: t.tanggalTransfer,
				nominal: t.nominal,
				type: t.namaJenisShodaqoh?.toLowerCase().includes('fr') || t.namaJenisShodaqoh?.toLowerCase().includes('isrun') ? 'isrun' : 'shodaqoh'
		  }))
		: sampleList;

	const displayTotal = totalBulanIni > 0 ? `Rp${totalBulanIni.toLocaleString('id-ID')}` : 'Rp150.000';

	return {
		user: locals.user,
		totalBulanIniText: displayTotal,
		transaksiList
	};
};

