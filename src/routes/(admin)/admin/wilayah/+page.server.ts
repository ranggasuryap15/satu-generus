/**
 * @file src/routes/(admin)/admin/wilayah/+page.server.ts
 * @purpose Memuat data wilayah administratif berjenjang sesuai scope admin (Pusat, Daerah, Desa, Kelompok) dan otorisasi ketat aksi CRUD unit wilayah (termasuk pembuatan wilayah tunggal cerdas/creatable dropdown, serta hapus single & batch untuk Pusat, Daerah, Desa)
 * @usedBy src/routes/(admin)/admin/wilayah/+page.svelte
 * @dependencies src/lib/db, src/lib/db/schema, src/lib/server/scope, drizzle-orm
 * @publicFunctions load, actions.createWilayah, actions.createDaerah, actions.createDesa, actions.createKelompok, actions.createSubKelompok, actions.updateKelompokLocation, actions.deleteKelompok, actions.batchDeleteKelompok, actions.deleteSubKelompok, actions.batchDeleteSubKelompok
 * @sideEffects Insert/Update/Delete data daerah/desa/kelompok/sub_kelompok ke SQLite dalam transaksi atomik, verifikasi hierarki RBAC
 */

import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/db';
import { daerah, desa, kelompok, subKelompok } from '$lib/db/schema';
import { eq, inArray, sql, and } from 'drizzle-orm';
import { getAdminScope, getAccessibleWilayah, isKelompokAllowed } from '$lib/server/scope';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user || !locals.isAdmin) {
		throw redirect(303, '/login');
	}

	const adminScope = getAdminScope(locals.roles);
	const accessibleWilayah = getAccessibleWilayah(adminScope);

	// 1. Ambil seluruh data daerah yang diizinkan dalam scope admin
	const daerahList = accessibleWilayah.daerahList;

	// 2. Ambil seluruh data desa yang diizinkan dalam scope admin
	const desaList = accessibleWilayah.desaList;

	// 3. Ambil seluruh kelompok yang diizinkan join desa dan daerah dengan agregasi terindeks
	const rawKelompokList = db
		.select({
			id: kelompok.id,
			nama: kelompok.nama,
			kelurahan: kelompok.kelurahan,
			lokasiNama: kelompok.lokasiNama,
			latitude: kelompok.latitude,
			longitude: kelompok.longitude,
			radiusMeter: kelompok.radiusMeter,
			gmapsUrl: kelompok.gmapsUrl,
			desaId: kelompok.desaId,
			desaNama: desa.nama,
			daerahNama: daerah.nama,
			totalJamaah: sql<number>`(SELECT count(*) FROM users WHERE users.kelompok_id = ${kelompok.id})`,
			totalSubKelompok: sql<number>`(SELECT count(*) FROM sub_kelompok WHERE sub_kelompok.kelompok_id = ${kelompok.id})`
		})
		.from(kelompok)
		.leftJoin(desa, eq(kelompok.desaId, desa.id))
		.leftJoin(daerah, eq(desa.daerahId, daerah.id))
		.all();

	const kelompokList = adminScope.isPusat
		? rawKelompokList
		: rawKelompokList.filter((k) => accessibleWilayah.allowedKelompokIdSet.has(k.id));

	// 4. Ambil seluruh sub-kelompok yang diizinkan
	const rawSubKelompokList = db
		.select({
			id: subKelompok.id,
			nama: subKelompok.nama,
			keterangan: subKelompok.keterangan,
			kelompokId: subKelompok.kelompokId,
			kelompokNama: kelompok.nama,
			desaNama: desa.nama,
			daerahNama: daerah.nama
		})
		.from(subKelompok)
		.leftJoin(kelompok, eq(subKelompok.kelompokId, kelompok.id))
		.leftJoin(desa, eq(kelompok.desaId, desa.id))
		.leftJoin(daerah, eq(desa.daerahId, daerah.id))
		.all();

	const subKelompokList = adminScope.isPusat
		? rawSubKelompokList
		: rawSubKelompokList.filter((sk) => accessibleWilayah.allowedKelompokIdSet.has(sk.kelompokId));

	// Hak izin CRUD administratif sesuai aturan RBAC (Hanya Pusat, Daerah, Desa yang boleh menghapus)
	const canDeleteWilayah = adminScope.isPusat || adminScope.level === 'Daerah' || adminScope.level === 'Desa';

	const permissions = {
		canCreateDaerah: adminScope.isPusat,
		canCreateDesa: adminScope.isPusat || adminScope.level === 'Daerah',
		canCreateKelompok: adminScope.isPusat || adminScope.level === 'Daerah' || adminScope.level === 'Desa',
		canCreateSubKelompok: true,
		canBatchInsert: adminScope.isPusat || adminScope.level === 'Daerah',
		canDeleteKelompok: canDeleteWilayah,
		canDeleteSubKelompok: canDeleteWilayah,
		scopeLevel: adminScope.level
	};

	return {
		adminScope,
		permissions,
		daerahList,
		desaList,
		kelompokList,
		subKelompokList
	};
};

export const actions: Actions = {
	createWilayah: async ({ request, locals }) => {
		if (!locals.user || !locals.isAdmin) {
			return fail(403, { error: 'Akses ditolak.' });
		}

		const adminScope = getAdminScope(locals.roles);
		const formData = await request.formData();

		const daerahValue = formData.get('daerahValue')?.toString()?.trim() || '';
		const daerahProvinsi = formData.get('daerahProvinsi')?.toString()?.trim() || '';
		const daerahKotaKabupaten = formData.get('daerahKotaKabupaten')?.toString()?.trim() || '';

		const desaValue = formData.get('desaValue')?.toString()?.trim() || '';
		const desaKecamatan = formData.get('desaKecamatan')?.toString()?.trim() || '';

		const kelompokValue = formData.get('kelompokValue')?.toString()?.trim() || '';
		const kelompokKelurahan = formData.get('kelompokKelurahan')?.toString()?.trim() || '';

		const subKelompokNama = formData.get('subKelompokNama')?.toString()?.trim() || '';
		const subKelompokKeterangan = formData.get('subKelompokKeterangan')?.toString()?.trim() || '';

		if (!daerahValue) {
			return fail(400, { error: 'Daerah wajib dipilih atau diisi.' });
		}

		const accessibleWilayah = getAccessibleWilayah(adminScope);

		try {
			const result = db.transaction((tx) => {
				let currentDaerahId: number;
				let isDaerahCreated = false;
				let isDesaCreated = false;
				let isKelompokCreated = false;
				let isSubKelompokCreated = false;

				// 1. EVALUASI DAERAH
				const parsedDaerahId = parseInt(daerahValue, 10);
				const isExistingDaerahId = !isNaN(parsedDaerahId) && String(parsedDaerahId) === daerahValue;

				if (isExistingDaerahId) {
					if (!adminScope.isPusat && !adminScope.daerahIds.includes(parsedDaerahId)) {
						throw new Error('Akses ditolak: Anda tidak memiliki wewenang pada Daerah yang dipilih.');
					}
					currentDaerahId = parsedDaerahId;
				} else {
					if (!adminScope.isPusat) {
						throw new Error('Akses ditolak: Hanya Pengurus Tingkat Pusat yang memiliki wewenang menambahkan Daerah baru.');
					}
					const existingD = tx
						.select()
						.from(daerah)
						.where(sql`lower(${daerah.nama}) = lower(${daerahValue})`)
						.get();

					if (existingD) {
						currentDaerahId = existingD.id;
					} else {
						const [newD] = tx
							.insert(daerah)
							.values({
								nama: daerahValue,
								provinsi: daerahProvinsi || daerahValue,
								kotaKabupaten: daerahKotaKabupaten || daerahValue
							})
							.returning()
							.all();
						currentDaerahId = newD.id;
						isDaerahCreated = true;
					}
				}

				// 2. EVALUASI DESA (jika diisi)
				let currentDesaId: number | null = null;
				if (desaValue) {
					const parsedDesaId = parseInt(desaValue, 10);
					const isExistingDesaId = !isNaN(parsedDesaId) && String(parsedDesaId) === desaValue;

					if (isExistingDesaId) {
						const existingDesa = tx
							.select()
							.from(desa)
							.where(eq(desa.id, parsedDesaId))
							.get();

						if (!existingDesa || existingDesa.daerahId !== currentDaerahId) {
							throw new Error('Data desa tidak valid atau tidak berada dalam Daerah yang dipilih.');
						}
						if (
							!adminScope.isPusat &&
							!adminScope.desaIds.includes(parsedDesaId) &&
							!adminScope.daerahIds.includes(currentDaerahId)
						) {
							throw new Error('Akses ditolak: Anda tidak memiliki wewenang pada Desa yang dipilih.');
						}
						currentDesaId = parsedDesaId;
					} else {
						if (!adminScope.isPusat && adminScope.level !== 'Daerah') {
							throw new Error('Akses ditolak: Hanya Pengurus Tingkat Pusat atau Daerah yang berwenang membuat Desa baru.');
						}
						if (!adminScope.isPusat && !adminScope.daerahIds.includes(currentDaerahId)) {
							throw new Error('Akses ditolak: Tidak dapat membuat Desa di luar Daerah binaan Anda.');
						}

						const existingDesaByName = tx
							.select()
							.from(desa)
							.where(
								and(
									eq(desa.daerahId, currentDaerahId),
									sql`lower(${desa.nama}) = lower(${desaValue})`
								)
							)
							.get();

						if (existingDesaByName) {
							currentDesaId = existingDesaByName.id;
						} else {
							const [newDesa] = tx
								.insert(desa)
								.values({
									daerahId: currentDaerahId,
									nama: desaValue,
									kecamatan: desaKecamatan || null
								})
								.returning()
								.all();
							currentDesaId = newDesa.id;
							isDesaCreated = true;
						}
					}
				}

				// 3. EVALUASI KELOMPOK (jika diisi)
				let currentKelompokId: number | null = null;
				if (kelompokValue) {
					if (!currentDesaId) {
						throw new Error('Untuk menambahkan Kelompok, Desa induk wajib dipilih atau dibuat terlebih dahulu.');
					}

					const parsedKelompokId = parseInt(kelompokValue, 10);
					const isExistingKelompokId = !isNaN(parsedKelompokId) && String(parsedKelompokId) === kelompokValue;

					if (isExistingKelompokId) {
						const existingKel = tx
							.select()
							.from(kelompok)
							.where(eq(kelompok.id, parsedKelompokId))
							.get();

						if (!existingKel || existingKel.desaId !== currentDesaId) {
							throw new Error('Data kelompok tidak valid atau tidak berada di bawah Desa yang dipilih.');
						}
						if (!adminScope.isPusat && !accessibleWilayah.allowedKelompokIdSet.has(parsedKelompokId)) {
							throw new Error('Akses ditolak: Anda tidak memiliki wewenang pada Kelompok yang dipilih.');
						}
						currentKelompokId = parsedKelompokId;
					} else {
						if (adminScope.level === 'Kelompok') {
							throw new Error('Akses ditolak: Admin tingkat Kelompok tidak memiliki wewenang membuat Kelompok baru.');
						}
						if (!adminScope.isPusat) {
							const allowedDesaIds = new Set(accessibleWilayah.desaList.map((d) => d.id));
							if (!allowedDesaIds.has(currentDesaId)) {
								throw new Error('Akses ditolak: Tidak dapat membuat Kelompok di luar Desa binaan Anda.');
							}
						}

						const existingKelByName = tx
							.select()
							.from(kelompok)
							.where(
								and(
									eq(kelompok.desaId, currentDesaId),
									sql`lower(${kelompok.nama}) = lower(${kelompokValue})`
								)
							)
							.get();

						if (existingKelByName) {
							currentKelompokId = existingKelByName.id;
						} else {
							const [newKel] = tx
								.insert(kelompok)
								.values({
									desaId: currentDesaId,
									nama: kelompokValue,
									kelurahan: kelompokKelurahan || null
								})
								.returning()
								.all();
							currentKelompokId = newKel.id;
							isKelompokCreated = true;
						}
					}
				}

				// 4. EVALUASI SUB-KELOMPOK (jika diisi)
				if (subKelompokNama) {
					if (!currentKelompokId) {
						throw new Error('Untuk menambahkan Sub-Kelompok, Kelompok induk wajib dipilih atau dibuat terlebih dahulu.');
					}
					if (!adminScope.isPusat && !accessibleWilayah.allowedKelompokIdSet.has(currentKelompokId)) {
						throw new Error('Akses ditolak: Tidak dapat membuat Sub-Kelompok di luar Kelompok binaan Anda.');
					}

					tx.insert(subKelompok)
						.values({
							kelompokId: currentKelompokId,
							nama: subKelompokNama,
							keterangan: subKelompokKeterangan || null
						})
						.run();
					isSubKelompokCreated = true;
				}

				const createdItems: string[] = [];
				if (isDaerahCreated) createdItems.push(`Daerah "${daerahValue}"`);
				if (isDesaCreated) createdItems.push(`Desa "${desaValue}"`);
				if (isKelompokCreated) createdItems.push(`Kelompok "${kelompokValue}"`);
				if (isSubKelompokCreated) createdItems.push(`Sub-Kelompok "${subKelompokNama}"`);

				return {
					createdItems,
					isAnyCreated: createdItems.length > 0
				};
			});

			if (!result.isAnyCreated) {
				return {
					success: true,
					message: 'Unit wilayah yang dipilih sudah ada di sistem. Tidak ada data baru yang dibuat.'
				};
			}

			return {
				success: true,
				message: `Berhasil menambahkan data wilayah: ${result.createdItems.join(', ')}.`
			};
		} catch (error: any) {
			console.error('Gagal memproses tambah wilayah:', error);
			return fail(400, { error: error.message || 'Terjadi kesalahan sistem saat menyimpan wilayah.' });
		}
	},

	createDaerah: async ({ request, locals }) => {
		if (!locals.user || !locals.isAdmin) {
			return fail(403, { error: 'Akses ditolak.' });
		}

		const adminScope = getAdminScope(locals.roles);
		if (!adminScope.isPusat) {
			return fail(403, {
				error: 'Akses ditolak: Hanya Pengurus Tingkat Pusat yang memiliki wewenang menambahkan Daerah.'
			});
		}

		const formData = await request.formData();
		const nama = formData.get('nama')?.toString()?.trim() || '';
		const provinsi = formData.get('provinsi')?.toString()?.trim() || '';
		const kotaKabupaten = formData.get('kotaKabupaten')?.toString()?.trim() || '';

		if (!nama || !provinsi || !kotaKabupaten) {
			return fail(400, { error: 'Nama daerah, Provinsi, dan Kota/Kabupaten wajib diisi.' });
		}

		try {
			db.insert(daerah)
				.values({
					nama,
					provinsi,
					kotaKabupaten
				})
				.run();
		} catch (error) {
			console.error('Gagal membuat daerah:', error);
			return fail(500, { error: 'Terjadi kesalahan sistem saat menyimpan daerah.' });
		}

		return { success: true };
	},

	createDesa: async ({ request, locals }) => {
		if (!locals.user || !locals.isAdmin) {
			return fail(403, { error: 'Akses ditolak.' });
		}

		const adminScope = getAdminScope(locals.roles);
		if (!adminScope.isPusat && adminScope.level !== 'Daerah') {
			return fail(403, {
				error: 'Akses ditolak: Hanya Pengurus Tingkat Pusat atau Daerah yang memiliki wewenang menambahkan Desa.'
			});
		}

		const formData = await request.formData();
		const nama = formData.get('nama')?.toString()?.trim() || '';
		const kecamatan = formData.get('kecamatan')?.toString()?.trim() || '';
		const daerahIdStr = formData.get('daerahId')?.toString() || '';
		const daerahId = parseInt(daerahIdStr, 10);

		if (!nama || isNaN(daerahId)) {
			return fail(400, { error: 'Nama desa dan Daerah induk wajib diisi.' });
		}

		if (!adminScope.isPusat && !adminScope.daerahIds.includes(daerahId)) {
			return fail(403, {
				error: 'Akses ditolak: Anda tidak memiliki wewenang untuk menambahkan Desa di luar Daerah binaan Anda.'
			});
		}

		try {
			db.insert(desa)
				.values({
					daerahId,
					nama,
					kecamatan: kecamatan || null
				})
				.run();
		} catch (error) {
			console.error('Gagal membuat desa:', error);
			return fail(500, { error: 'Terjadi kesalahan sistem saat menyimpan desa.' });
		}

		return { success: true };
	},

	createKelompok: async ({ request, locals }) => {
		if (!locals.user || !locals.isAdmin) {
			return fail(403, { error: 'Akses ditolak.' });
		}

		const adminScope = getAdminScope(locals.roles);
		if (adminScope.level === 'Kelompok') {
			return fail(403, {
				error: 'Akses ditolak: Admin tingkat Kelompok tidak memiliki wewenang membuat Kelompok baru.'
			});
		}

		const formData = await request.formData();
		const nama = formData.get('nama')?.toString()?.trim() || '';
		const kelurahan = formData.get('kelurahan')?.toString()?.trim() || '';
		const desaIdStr = formData.get('desaId')?.toString() || '';
		const desaId = parseInt(desaIdStr, 10);

		if (!nama || isNaN(desaId)) {
			return fail(400, { error: 'Nama kelompok dan Desa induk wajib diisi.' });
		}

		if (!adminScope.isPusat) {
			const accessibleWilayah = getAccessibleWilayah(adminScope);
			const allowedDesaIds = new Set(accessibleWilayah.desaList.map((d) => d.id));
			if (!allowedDesaIds.has(desaId)) {
				return fail(403, {
					error: 'Akses ditolak: Anda tidak memiliki wewenang membuat kelompok di luar Desa binaan Anda.'
				});
			}
		}

		try {
			db.insert(kelompok)
				.values({
					desaId,
					nama,
					kelurahan: kelurahan || null
				})
				.run();
		} catch (error) {
			console.error('Gagal membuat kelompok:', error);
			return fail(500, { error: 'Terjadi kesalahan sistem saat menyimpan kelompok.' });
		}

		return { success: true };
	},

	createSubKelompok: async ({ request, locals }) => {
		if (!locals.user || !locals.isAdmin) {
			return fail(403, { error: 'Akses ditolak.' });
		}

		const adminScope = getAdminScope(locals.roles);
		const formData = await request.formData();
		const nama = formData.get('nama')?.toString()?.trim() || '';
		const keterangan = formData.get('keterangan')?.toString()?.trim() || '';
		const kelompokIdStr = formData.get('kelompokId')?.toString() || '';
		const kelompokId = parseInt(kelompokIdStr, 10);

		if (!nama || isNaN(kelompokId)) {
			return fail(400, { error: 'Nama sub-kelompok dan Kelompok induk wajib diisi.' });
		}

		if (!adminScope.isPusat) {
			const accessibleWilayah = getAccessibleWilayah(adminScope);
			if (!accessibleWilayah.allowedKelompokIdSet.has(kelompokId)) {
				return fail(403, {
					error: 'Akses ditolak: Anda tidak memiliki wewenang membuat Sub-Kelompok di luar Kelompok binaan Anda.'
				});
			}
		}

		try {
			db.insert(subKelompok)
				.values({
					kelompokId,
					nama,
					keterangan: keterangan || null
				})
				.run();
		} catch (error) {
			console.error('Gagal membuat sub-kelompok:', error);
			return fail(500, { error: 'Terjadi kesalahan sistem saat menyimpan sub-kelompok.' });
		}

		return { success: true };
	},

	updateKelompokLocation: async ({ request, locals }) => {
		if (!locals.user || !locals.isAdmin) {
			return fail(403, { error: 'Akses ditolak.' });
		}

		const adminScope = getAdminScope(locals.roles);
		const formData = await request.formData();
		const kelompokId = parseInt(formData.get('kelompokId')?.toString() || '0', 10);
		const lokasiNama = formData.get('lokasiNama')?.toString()?.trim() || null;
		const latitude = formData.get('latitude')?.toString()?.trim() || null;
		const longitude = formData.get('longitude')?.toString()?.trim() || null;
		const radiusMeterRaw = parseInt(formData.get('radiusMeter')?.toString() || '100', 10);
		const radiusMeter = isNaN(radiusMeterRaw) ? 100 : radiusMeterRaw;
		const gmapsUrl = formData.get('gmapsUrl')?.toString()?.trim() || null;

		if (!kelompokId) {
			return fail(400, { error: 'ID Kelompok tidak valid.' });
		}

		if (!adminScope.isPusat) {
			const accessibleWilayah = getAccessibleWilayah(adminScope);
			if (!accessibleWilayah.allowedKelompokIdSet.has(kelompokId)) {
				return fail(403, {
					error: 'Akses ditolak: Anda tidak memiliki wewenang mengelola lokasi kelompok ini.'
				});
			}
		}

		try {
			db.update(kelompok)
				.set({
					lokasiNama,
					latitude,
					longitude,
					radiusMeter,
					gmapsUrl
				})
				.where(eq(kelompok.id, kelompokId))
				.run();

			return { success: true, message: 'Data lokasi kelompok berhasil disimpan.' };
		} catch (error: any) {
			console.error('Gagal memperbarui lokasi kelompok:', error);
			return fail(500, { error: `Terjadi kesalahan sistem: ${error.message}` });
		}
	},

	deleteKelompok: async ({ request, locals }) => {
		if (!locals.user || !locals.isAdmin) {
			return fail(403, { error: 'Akses ditolak.' });
		}

		const adminScope = getAdminScope(locals.roles);
		if (!adminScope.isPusat && adminScope.level !== 'Daerah' && adminScope.level !== 'Desa') {
			return fail(403, {
				error: 'Akses ditolak: Hanya Admin Tingkat Pusat, Daerah, dan Desa yang memiliki wewenang menghapus kelompok.'
			});
		}

		const formData = await request.formData();
		const kelompokId = parseInt(formData.get('kelompokId')?.toString() || '0', 10);

		if (!kelompokId) {
			return fail(400, { error: 'ID Kelompok tidak valid.' });
		}

		if (!adminScope.isPusat) {
			const accessibleWilayah = getAccessibleWilayah(adminScope);
			if (!accessibleWilayah.allowedKelompokIdSet.has(kelompokId)) {
				return fail(403, {
					error: 'Akses ditolak: Kelompok ini berada di luar wewenang cakupan wilayah Anda.'
				});
			}
		}

		try {
			db.transaction((tx) => {
				tx.delete(kelompok).where(eq(kelompok.id, kelompokId)).run();
			});

			return { success: true, message: 'Kelompok berhasil dihapus dari sistem.' };
		} catch (error: any) {
			console.error('Gagal menghapus kelompok:', error);
			return fail(500, { error: `Terjadi kesalahan sistem saat menghapus kelompok: ${error.message}` });
		}
	},

	batchDeleteKelompok: async ({ request, locals }) => {
		if (!locals.user || !locals.isAdmin) {
			return fail(403, { error: 'Akses ditolak.' });
		}

		const adminScope = getAdminScope(locals.roles);
		if (!adminScope.isPusat && adminScope.level !== 'Daerah' && adminScope.level !== 'Desa') {
			return fail(403, {
				error: 'Akses ditolak: Hanya Admin Tingkat Pusat, Daerah, dan Desa yang memiliki wewenang menghapus kelompok.'
			});
		}

		const formData = await request.formData();
		const kelompokIdsRaw = formData.get('kelompokIds')?.toString() || '';
		let parsedIds: number[] = [];
		try {
			parsedIds = JSON.parse(kelompokIdsRaw);
		} catch {
			parsedIds = kelompokIdsRaw
				.split(',')
				.map((id) => parseInt(id.trim(), 10))
				.filter((id) => !isNaN(id));
		}

		if (!Array.isArray(parsedIds) || parsedIds.length === 0) {
			return fail(400, { error: 'Pilih minimal satu kelompok untuk dihapus.' });
		}

		let validIds = parsedIds;
		if (!adminScope.isPusat) {
			const accessibleWilayah = getAccessibleWilayah(adminScope);
			validIds = parsedIds.filter((id) => accessibleWilayah.allowedKelompokIdSet.has(id));
			if (validIds.length === 0) {
				return fail(403, {
					error: 'Akses ditolak: Seluruh kelompok terpilih berada di luar cakupan wewenang wilayah Anda.'
				});
			}
		}

		try {
			db.transaction((tx) => {
				tx.delete(kelompok).where(inArray(kelompok.id, validIds)).run();
			});

			return { success: true, message: `${validIds.length} kelompok berhasil dihapus dari sistem.` };
		} catch (error: any) {
			console.error('Gagal menghapus batch kelompok:', error);
			return fail(500, { error: `Terjadi kesalahan sistem saat menghapus batch kelompok: ${error.message}` });
		}
	},

	deleteSubKelompok: async ({ request, locals }) => {
		if (!locals.user || !locals.isAdmin) {
			return fail(403, { error: 'Akses ditolak.' });
		}

		const adminScope = getAdminScope(locals.roles);
		if (!adminScope.isPusat && adminScope.level !== 'Daerah' && adminScope.level !== 'Desa') {
			return fail(403, {
				error: 'Akses ditolak: Hanya Admin Tingkat Pusat, Daerah, dan Desa yang memiliki wewenang menghapus sub-kelompok.'
			});
		}

		const formData = await request.formData();
		const subKelompokId = parseInt(formData.get('subKelompokId')?.toString() || '0', 10);

		if (!subKelompokId) {
			return fail(400, { error: 'ID Sub-Kelompok tidak valid.' });
		}

		try {
			db.delete(subKelompok).where(eq(subKelompok.id, subKelompokId)).run();
			return { success: true, message: 'Sub-kelompok berhasil dihapus.' };
		} catch (error: any) {
			console.error('Gagal menghapus sub-kelompok:', error);
			return fail(500, { error: `Terjadi kesalahan sistem saat menghapus sub-kelompok: ${error.message}` });
		}
	},

	batchDeleteSubKelompok: async ({ request, locals }) => {
		if (!locals.user || !locals.isAdmin) {
			return fail(403, { error: 'Akses ditolak.' });
		}

		const adminScope = getAdminScope(locals.roles);
		if (!adminScope.isPusat && adminScope.level !== 'Daerah' && adminScope.level !== 'Desa') {
			return fail(403, {
				error: 'Akses ditolak: Hanya Admin Tingkat Pusat, Daerah, dan Desa yang memiliki wewenang menghapus sub-kelompok.'
			});
		}

		const formData = await request.formData();
		const subKelompokIdsRaw = formData.get('subKelompokIds')?.toString() || '';
		let parsedIds: number[] = [];
		try {
			parsedIds = JSON.parse(subKelompokIdsRaw);
		} catch {
			parsedIds = subKelompokIdsRaw
				.split(',')
				.map((id) => parseInt(id.trim(), 10))
				.filter((id) => !isNaN(id));
		}

		if (!Array.isArray(parsedIds) || parsedIds.length === 0) {
			return fail(400, { error: 'Pilih minimal satu sub-kelompok untuk dihapus.' });
		}

		try {
			db.transaction((tx) => {
				tx.delete(subKelompok).where(inArray(subKelompok.id, parsedIds)).run();
			});

			return { success: true, message: `${parsedIds.length} sub-kelompok berhasil dihapus.` };
		} catch (error: any) {
			console.error('Gagal menghapus batch sub-kelompok:', error);
			return fail(500, { error: `Terjadi kesalahan sistem saat menghapus batch sub-kelompok: ${error.message}` });
		}
	}
};
