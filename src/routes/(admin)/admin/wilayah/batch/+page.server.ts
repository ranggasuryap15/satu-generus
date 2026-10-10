/**
 * @file src/routes/(admin)/admin/wilayah/batch/+page.server.ts
 * @purpose Server load & action untuk batch insert data wilayah (Daerah, Desa, Kelompok, Sub-Kelompok) secara atomik dalam satu transaksi SQLite
 * @usedBy src/routes/(admin)/admin/wilayah/batch/+page.svelte
 * @dependencies src/lib/db, src/lib/db/schema, drizzle-orm
 * @publicFunctions load, actions.default
 * @sideEffects Menulis data massal ke tabel daerah, desa, kelompok, dan sub_kelompok dalam transaksi SQLite terisolasi
 */

import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/db';
import { daerah, desa, kelompok, subKelompok } from '$lib/db/schema';
import { eq } from 'drizzle-orm';

export interface BatchSubKelompokInput {
	id?: string;
	nama: string;
	keterangan?: string;
}

export interface BatchKelompokInput {
	id?: string;
	nama: string;
	kelurahan?: string;
	subKelompoks?: BatchSubKelompokInput[];
}

export interface BatchDesaGroup {
	id?: string;
	daerahNama: string;
	provinsi?: string;
	kotaKabupaten?: string;
	desaNama: string;
	kecamatan?: string;
	kelompoks: BatchKelompokInput[];
}

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user || !locals.isAdmin) {
		throw redirect(303, '/login');
	}

	const daerahList = db.select().from(daerah).all();
	const desaList = db
		.select({
			id: desa.id,
			nama: desa.nama,
			daerahId: desa.daerahId,
			daerahNama: daerah.nama
		})
		.from(desa)
		.leftJoin(daerah, eq(desa.daerahId, daerah.id))
		.all();

	return {
		daerahList,
		desaList
	};
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		if (!locals.user || !locals.isAdmin) {
			throw redirect(303, '/login');
		}

		const formData = await request.formData();
		const rawBatchData = formData.get('batchData')?.toString() || '[]';

		let parsedData: any;
		try {
			parsedData = JSON.parse(rawBatchData);
		} catch (_) {
			return fail(400, { error: 'Format data JSON batch tidak valid.' });
		}

		if (!Array.isArray(parsedData) || parsedData.length === 0) {
			return fail(400, { error: 'Belum ada data wilayah yang diisi untuk diproses.' });
		}

		// Validasi dasar
		let totalKelompokCount = 0;
		for (let i = 0; i < parsedData.length; i++) {
			const group = parsedData[i] as BatchDesaGroup;
			if (!group.daerahNama?.trim()) {
				return fail(400, { error: `Grup #${i + 1}: Nama Daerah wajib diisi.` });
			}
			if (!group.desaNama?.trim()) {
				return fail(400, { error: `Grup #${i + 1} (${group.daerahNama}): Nama Desa wajib diisi.` });
			}
			if (!group.kelompoks || group.kelompoks.length === 0) {
				return fail(400, {
					error: `Grup #${i + 1} (${group.desaNama}): Minimal harus memiliki 1 Kelompok.`
				});
			}

			for (let k = 0; k < group.kelompoks.length; k++) {
				const kl = group.kelompoks[k];
				if (!kl.nama?.trim()) {
					return fail(400, {
						error: `Grup #${i + 1} (${group.desaNama}), Kelompok #${k + 1}: Nama kelompok wajib diisi.`
					});
				}
				totalKelompokCount++;
			}
		}

		if (totalKelompokCount === 0) {
			return fail(400, { error: 'Belum ada unit kelompok yang valid untuk disimpan.' });
		}

		let createdDaerahCount = 0;
		let createdDesaCount = 0;
		let createdKelompokCount = 0;
		let createdSubKelompokCount = 0;

		try {
			db.transaction((tx) => {
				// Cache daerah & desa di memori untuk mencegah SELECT berulang (minimum I/O)
				const existingDaerahMap = new Map<string, number>();
				const allDaerah = tx.select().from(daerah).all();
				for (const d of allDaerah) {
					existingDaerahMap.set(d.nama.trim().toLowerCase(), d.id);
				}

				const existingDesaMap = new Map<string, number>(); // key: `${daerahId}:${desaNama.toLowerCase()}`
				const allDesa = tx.select().from(desa).all();
				for (const d of allDesa) {
					existingDesaMap.set(`${d.daerahId}:${d.nama.trim().toLowerCase()}`, d.id);
				}

				const existingKelompokMap = new Map<string, number>(); // key: `${desaId}:${kelompokNama.toLowerCase()}`
				const allKelompok = tx.select().from(kelompok).all();
				for (const k of allKelompok) {
					existingKelompokMap.set(`${k.desaId}:${k.nama.trim().toLowerCase()}`, k.id);
				}

				for (const group of parsedData as BatchDesaGroup[]) {
					const cleanDaerahNama = group.daerahNama.trim();
					const daerahKey = cleanDaerahNama.toLowerCase();

					let daerahId = existingDaerahMap.get(daerahKey);
					if (!daerahId) {
						const [newDaerah] = tx
							.insert(daerah)
							.values({
								nama: cleanDaerahNama,
								provinsi: group.provinsi?.trim() || 'DKI Jakarta',
								kotaKabupaten: group.kotaKabupaten?.trim() || cleanDaerahNama
							})
							.returning()
							.all();
						daerahId = newDaerah.id;
						existingDaerahMap.set(daerahKey, daerahId);
						createdDaerahCount++;
					}

					// 2. Lookup / Insert Desa
					const cleanDesaNama = group.desaNama.trim();
					const desaKey = `${daerahId}:${cleanDesaNama.toLowerCase()}`;

					let desaId = existingDesaMap.get(desaKey);
					if (!desaId) {
						const [newDesa] = tx
							.insert(desa)
							.values({
								daerahId,
								nama: cleanDesaNama,
								kecamatan: group.kecamatan?.trim() || cleanDesaNama
							})
							.returning()
							.all();
						desaId = newDesa.id;
						existingDesaMap.set(desaKey, desaId);
						createdDesaCount++;
					}

					// 3. Insert Kelompok-Kelompok & Sub-Kelompok
					for (const kl of group.kelompoks) {
						const cleanKelompokNama = kl.nama.trim();
						const kelompokKey = `${desaId}:${cleanKelompokNama.toLowerCase()}`;

						let kelompokId = existingKelompokMap.get(kelompokKey);
						if (!kelompokId) {
							const [newKelompok] = tx
								.insert(kelompok)
								.values({
									desaId,
									nama: cleanKelompokNama,
									kelurahan: kl.kelurahan?.trim() || null
								})
								.returning()
								.all();
							kelompokId = newKelompok.id;
							existingKelompokMap.set(kelompokKey, kelompokId);
							createdKelompokCount++;
						}

						// 4. Insert Sub-Kelompok jika ada
						if (kl.subKelompoks && kl.subKelompoks.length > 0) {
							for (const sk of kl.subKelompoks) {
								if (sk.nama?.trim()) {
									tx.insert(subKelompok)
										.values({
											kelompokId,
											nama: sk.nama.trim(),
											keterangan: sk.keterangan?.trim() || null
										})
										.run();
									createdSubKelompokCount++;
								}
							}
						}
					}
				}
			});
		} catch (dbErr) {
			console.error('Error saat transaksi batch insert wilayah:', dbErr);
			return fail(500, {
				error: 'Terjadi kesalahan sistem database saat menyimpan data batch wilayah.'
			});
		}

		return {
			success: true,
			summary: {
				totalDaerah: createdDaerahCount,
				totalDesa: createdDesaCount,
				totalKelompok: createdKelompokCount,
				totalSubKelompok: createdSubKelompokCount
			}
		};
	}
};
