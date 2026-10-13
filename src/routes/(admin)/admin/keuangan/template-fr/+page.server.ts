/**
 * @file src/routes/(admin)/admin/keuangan/template-fr/+page.server.ts
 * @purpose Controller backend manajemen template infaq/shodaqoh rutin (FR/Isrun), hierarki pos anggaran dinamis (termasuk 4 Hak Wajib), konfigurasi paket bundle tarif, serta penentuan target nominal granular per-jamaah
 * @usedBy src/routes/(admin)/admin/keuangan/template-fr/+page.svelte
 * @dependencies @sveltejs/kit, src/lib/db, src/lib/db/schema, src/lib/server/scope, drizzle-orm, @paralleldrive/cuid2
 * @publicFunctions load, actions.createTemplate, actions.updateTemplate, actions.deleteTemplate, actions.createPos, actions.updatePos, actions.deletePos, actions.saveTemplatePos, actions.saveBundle, actions.deleteBundle, actions.assignBundleToJamaah, actions.updateJamaahTarif
 * @sideEffects DB read & write pada tabel template_infaq_rutin, pos_anggaran_infaq, template_infaq_pos, template_infaq_bundle, dan template_infaq_jamaah di SQLite
 */

import { fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { db, sqlite } from '$lib/db';
import {
	templateInfaqRutin,
	posAnggaranInfaq,
	templateInfaqPos,
	templateInfaqBundle,
	templateInfaqJamaah,
	anggotaKeluarga,
	keluarga,
	users,
	kelompok,
	desa
} from '$lib/db/schema';
import { eq, and, asc, desc, inArray, isNull, or } from 'drizzle-orm';
import { getAdminScope, getAccessibleWilayah, canAccessKeuangan, canManageFr } from '$lib/server/scope';
import { createId } from '@paralleldrive/cuid2';

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

	const currentYear = new Date().getFullYear();
	const tahunParam = Number(url.searchParams.get('tahun')) || currentYear;
	const urlKelompokId = url.searchParams.get('kelompokId');

	// Penentuan kelompok terpilih
	let selectedKelompokId: number | null = null;
	if (urlKelompokId) {
		const parsed = Number(urlKelompokId);
		if (adminScope.isPusat || accessibleWilayah.allowedKelompokIdSet.has(parsed)) {
			selectedKelompokId = parsed;
		}
	} else if (adminScope.level === 'Kelompok' && adminScope.kelompokIds.length > 0) {
		selectedKelompokId = adminScope.kelompokIds[0];
	} else if (accessibleWilayah.kelompokList.length > 0) {
		selectedKelompokId = accessibleWilayah.kelompokList[0].id;
	}

	const canEdit = selectedKelompokId
		? canManageFr(roles, 'Kelompok', selectedKelompokId)
		: false;

	// 1. Ambil seluruh master pos anggaran (baik pos global wajib maupun kustom kelompok ini)
	const rawPosList = db
		.select()
		.from(posAnggaranInfaq)
		.where(
			and(
				eq(posAnggaranInfaq.isActive, true),
				selectedKelompokId
					? or(
							eq(posAnggaranInfaq.isWajib, true),
							eq(posAnggaranInfaq.kelompokId, selectedKelompokId),
							isNull(posAnggaranInfaq.kelompokId)
						)
					: eq(posAnggaranInfaq.isWajib, true)
			)
		)
		.orderBy(asc(posAnggaranInfaq.urutan), asc(posAnggaranInfaq.nama))
		.all();

	// 2. Ambil daftar template infaq rutin untuk kelompok dan tahun terpilih
	let templateList: Array<typeof templateInfaqRutin.$inferSelect> = [];
	if (selectedKelompokId) {
		templateList = db
			.select()
			.from(templateInfaqRutin)
			.where(
				and(
					eq(templateInfaqRutin.kelompokId, selectedKelompokId),
					eq(templateInfaqRutin.tahun, tahunParam)
				)
			)
			.orderBy(desc(templateInfaqRutin.createdAt))
			.all();
	}

	// 3. Tentukan template aktif saat ini
	const urlTemplateId = url.searchParams.get('templateId');
	const selectedTemplate =
		templateList.find((t) => t.id === urlTemplateId) ||
		templateList.find((t) => t.status === 'aktif') ||
		templateList[0] ||
		null;

	// 4. Jika template terpilih ada, ambil rincian pos, bundle, dan tarif jamaah
	let templatePosList: Array<{
		id: string;
		posId: string;
		posNama: string;
		posKode: string;
		isWajib: boolean;
		nominalTarget: number | null;
		persentaseSplit: number | null;
		urutan: number;
	}> = [];

	let bundleList: Array<typeof templateInfaqBundle.$inferSelect> = [];

	let jamaahTarifList: Array<{
		anggotaId: string;
		namaLengkap: string;
		statusHubungan: string;
		statusGenerus: string | null;
		kepalaKeluargaNama: string;
		bundleId: string | null;
		bundleNama: string | null;
		nominalTarget: number;
		isCustom: boolean;
		catatan: string | null;
	}> = [];

	if (selectedTemplate && selectedKelompokId) {
		// A. Rincian Pos Template
		const rawTemplatePos = db
			.select({
				id: templateInfaqPos.id,
				posId: templateInfaqPos.posId,
				posNama: posAnggaranInfaq.nama,
				posKode: posAnggaranInfaq.kode,
				isWajib: posAnggaranInfaq.isWajib,
				nominalTarget: templateInfaqPos.nominalTarget,
				persentaseSplit: templateInfaqPos.persentaseSplit,
				urutan: templateInfaqPos.urutan
			})
			.from(templateInfaqPos)
			.innerJoin(posAnggaranInfaq, eq(templateInfaqPos.posId, posAnggaranInfaq.id))
			.where(eq(templateInfaqPos.templateId, selectedTemplate.id))
			.orderBy(asc(templateInfaqPos.urutan))
			.all();

		templatePosList = rawTemplatePos;

		// B. Daftar Paket / Bundle Tarif
		bundleList = db
			.select()
			.from(templateInfaqBundle)
			.where(eq(templateInfaqBundle.templateId, selectedTemplate.id))
			.orderBy(asc(templateInfaqBundle.urutan), asc(templateInfaqBundle.nominal))
			.all();

		// C. Daftar Jamaah Wajib Isrun di Kelompok ini
		const rawJamaah = db
			.select({
				id: anggotaKeluarga.id,
				namaLengkap: anggotaKeluarga.namaLengkap,
				statusHubungan: anggotaKeluarga.statusHubungan,
				statusGenerus: anggotaKeluarga.statusGenerus,
				kepalaKeluargaNama: users.namaLengkap
			})
			.from(anggotaKeluarga)
			.innerJoin(keluarga, eq(anggotaKeluarga.keluargaId, keluarga.id))
			.innerJoin(users, eq(keluarga.kepalaKeluargaId, users.id))
			.where(
				and(
					eq(users.kelompokId, selectedKelompokId),
					eq(anggotaKeluarga.isrun, 'Ya'),
					eq(anggotaKeluarga.statusJamaah, 'Aktif')
				)
			)
			.orderBy(asc(anggotaKeluarga.namaLengkap))
			.all();

		// D. Tarif Khusus Jamaah yang sudah diatur
		const rawTarifJamaah = db
			.select({
				id: templateInfaqJamaah.id,
				anggotaKeluargaId: templateInfaqJamaah.anggotaKeluargaId,
				bundleId: templateInfaqJamaah.bundleId,
				bundleNama: templateInfaqBundle.nama,
				nominalTarget: templateInfaqJamaah.nominalTarget,
				isCustom: templateInfaqJamaah.isCustom,
				catatan: templateInfaqJamaah.catatan
			})
			.from(templateInfaqJamaah)
			.leftJoin(templateInfaqBundle, eq(templateInfaqJamaah.bundleId, templateInfaqBundle.id))
			.where(eq(templateInfaqJamaah.templateId, selectedTemplate.id))
			.all();

		const tarifMap = new Map(rawTarifJamaah.map((t) => [t.anggotaKeluargaId, t]));

		// Gabungkan data jamaah dengan tarif
		jamaahTarifList = rawJamaah.map((j) => {
			const tarif = tarifMap.get(j.id);
			return {
				anggotaId: j.id,
				namaLengkap: j.namaLengkap || '',
				statusHubungan: j.statusHubungan,
				statusGenerus: j.statusGenerus,
				kepalaKeluargaNama: j.kepalaKeluargaNama,
				bundleId: tarif?.bundleId || null,
				bundleNama: tarif?.bundleNama || null,
				nominalTarget: tarif?.nominalTarget ?? selectedTemplate.nominalMinimumDefault,
				isCustom: tarif?.isCustom ?? false,
				catatan: tarif?.catatan || null
			};
		});
	}

	return {
		adminScope,
		accessibleWilayah,
		tahun: tahunParam,
		selectedKelompokId,
		canEdit,
		posList: rawPosList,
		templateList,
		selectedTemplate,
		templatePosList,
		bundleList,
		jamaahTarifList
	};
};

// Helper internal untuk mengecek otorisasi aksi
function checkAuth(locals: App.Locals, kelompokId: number | null) {
	if (!locals.user || !locals.isAdmin) {
		return fail(401, { error: 'Anda harus login sebagai pengurus.' });
	}
	const roles = locals.roles || [];
	if (!canAccessKeuangan(roles)) {
		return fail(403, { error: 'Akses menu keuangan ditolak.' });
	}
	if (!kelompokId || !canManageFr(roles, 'Kelompok', kelompokId)) {
		return fail(403, { error: 'Anda tidak memiliki wewenang untuk mengelola keuangan kelompok ini.' });
	}
	return null;
}

export const actions: Actions = {
	/**
	 * Membuat Template Infaq Rutin Baru
	 */
	createTemplate: async ({ request, locals }) => {
		const formData = await request.formData();
		const kelompokId = Number(formData.get('kelompokId'));
		const authErr = checkAuth(locals, kelompokId);
		if (authErr) return authErr;

		const nama = formData.get('nama')?.toString()?.trim();
		const tahun = Number(formData.get('tahun')) || new Date().getFullYear();
		const bulanMulai = Number(formData.get('bulanMulai')) || 1;
		const bulanSelesai = Number(formData.get('bulanSelesai')) || 12;
		const nominalMinimum = Number(formData.get('nominalMinimumDefault')) || 0;
		const catatan = formData.get('catatan')?.toString()?.trim() || null;

		if (!nama) {
			return fail(400, { error: 'Nama template wajib diisi.' });
		}

		try {
			const newId = createId();
			const now = Date.now();

			db.transaction((tx) => {
				// Insert Template Header
				tx.insert(templateInfaqRutin)
					.values({
						id: newId,
						nama,
						tingkatScope: 'Kelompok',
						kelompokId,
						tahun,
						bulanMulai,
						bulanSelesai,
						nominalMinimumDefault: nominalMinimum,
						status: 'aktif',
						catatan,
						createdByUserId: locals.user?.id || null,
						createdAt: now,
						updatedAt: now
					})
					.run();

				// Otomatis masukkan 4 Hak Wajib ke dalam template baru
				const hakWajibList = tx
					.select()
					.from(posAnggaranInfaq)
					.where(eq(posAnggaranInfaq.isWajib, true))
					.all();

				let urut = 1;
				for (const hw of hakWajibList) {
					tx.insert(templateInfaqPos)
						.values({
							id: createId(),
							templateId: newId,
							posId: hw.id,
							nominalTarget: Math.round(nominalMinimum / 4),
							persentaseSplit: 25,
							urutan: urut++
						})
						.run();
				}

				// Otomatis buat Paket Standar awal
				tx.insert(templateInfaqBundle)
					.values({
						id: createId(),
						templateId: newId,
						nama: 'Paket Standar',
						nominal: nominalMinimum,
						deskripsi: 'Paket nominal minimum acuan standar',
						urutan: 1
					})
					.run();
			});

			return { success: true, message: 'Template infaq rutin berhasil dibuat.' };
		} catch (err) {
			console.error('Error create template:', err);
			return fail(500, { error: 'Gagal membuat template infaq rutin.' });
		}
	},

	/**
	 * Mengubah Informasi / Status Template
	 */
	updateTemplate: async ({ request, locals }) => {
		const formData = await request.formData();
		const templateId = formData.get('templateId')?.toString();
		const kelompokId = Number(formData.get('kelompokId'));
		const authErr = checkAuth(locals, kelompokId);
		if (authErr) return authErr;

		if (!templateId) return fail(400, { error: 'ID template tidak valid.' });

		const nama = formData.get('nama')?.toString()?.trim();
		const nominalMinimum = Number(formData.get('nominalMinimumDefault')) || 0;
		const status = formData.get('status')?.toString() || 'aktif';
		const catatan = formData.get('catatan')?.toString()?.trim() || null;

		if (!nama) return fail(400, { error: 'Nama template wajib diisi.' });

		try {
			db.update(templateInfaqRutin)
				.set({
					nama,
					nominalMinimumDefault: nominalMinimum,
					status,
					catatan,
					updatedAt: Date.now()
				})
				.where(eq(templateInfaqRutin.id, templateId))
				.run();

			return { success: true, message: 'Perubahan template berhasil disimpan.' };
		} catch (err) {
			console.error('Error update template:', err);
			return fail(500, { error: 'Gagal memperbarui template.' });
		}
	},

	/**
	 * Menghapus Template
	 */
	deleteTemplate: async ({ request, locals }) => {
		const formData = await request.formData();
		const templateId = formData.get('templateId')?.toString();
		const kelompokId = Number(formData.get('kelompokId'));
		const authErr = checkAuth(locals, kelompokId);
		if (authErr) return authErr;

		if (!templateId) return fail(400, { error: 'ID template tidak valid.' });

		try {
			db.delete(templateInfaqRutin).where(eq(templateInfaqRutin.id, templateId)).run();
			return { success: true, message: 'Template infaq rutin berhasil dihapus.' };
		} catch (err) {
			console.error('Error delete template:', err);
			return fail(500, { error: 'Gagal menghapus template.' });
		}
	},

	/**
	 * Menambah Pos Anggaran Baru (Fleksibel, bisa sub-pos dengan parentId)
	 */
	createPos: async ({ request, locals }) => {
		const formData = await request.formData();
		const kelompokId = Number(formData.get('kelompokId'));
		const authErr = checkAuth(locals, kelompokId);
		if (authErr) return authErr;

		const nama = formData.get('nama')?.toString()?.trim();
		const kode = formData.get('kode')?.toString()?.trim() || `POS-${Date.now().toString().slice(-4)}`;
		const parentId = formData.get('parentId')?.toString()?.trim() || null;
		const deskripsi = formData.get('deskripsi')?.toString()?.trim() || null;
		const tipeAlokasi = formData.get('tipeAlokasi')?.toString() || 'nominal';

		if (!nama) return fail(400, { error: 'Nama pos anggaran wajib diisi.' });

		try {
			const now = Date.now();
			db.insert(posAnggaranInfaq)
				.values({
					id: createId(),
					parentId,
					kode: kode.toUpperCase(),
					nama,
					deskripsi,
					tingkatScope: 'Kelompok',
					kelompokId,
					isWajib: false,
					tipeAlokasi,
					urutan: 10,
					isActive: true,
					createdAt: now,
					updatedAt: now
				})
				.run();

			return { success: true, message: 'Pos anggaran baru berhasil ditambahkan.' };
		} catch (err) {
			console.error('Error create pos:', err);
			return fail(500, { error: 'Gagal menambahkan pos anggaran.' });
		}
	},

	/**
	 * Menghapus Pos Anggaran Kustom (4 Hak Wajib dilindungi dari penghapusan)
	 */
	deletePos: async ({ request, locals }) => {
		const formData = await request.formData();
		const posId = formData.get('posId')?.toString();
		const kelompokId = Number(formData.get('kelompokId'));
		const authErr = checkAuth(locals, kelompokId);
		if (authErr) return authErr;

		if (!posId) return fail(400, { error: 'ID pos anggaran tidak valid.' });

		const posRow = db.select().from(posAnggaranInfaq).where(eq(posAnggaranInfaq.id, posId)).get();
		if (!posRow) return fail(404, { error: 'Pos anggaran tidak ditemukan.' });
		if (posRow.isWajib) return fail(400, { error: 'Pos 4 Hak Wajib tidak boleh dihapus untuk menjaga integritas organisasi.' });

		try {
			db.delete(posAnggaranInfaq).where(eq(posAnggaranInfaq.id, posId)).run();
			return { success: true, message: 'Pos anggaran berhasil dihapus.' };
		} catch (err) {
			console.error('Error delete pos:', err);
			return fail(500, { error: 'Gagal menghapus pos anggaran.' });
		}
	},

	/**
	 * Menambah Pos ke Template
	 */
	addPosToTemplate: async ({ request, locals }) => {
		const formData = await request.formData();
		const templateId = formData.get('templateId')?.toString();
		const posId = formData.get('posId')?.toString();
		const nominalTarget = Number(formData.get('nominalTarget')) || 0;
		const persentaseSplit = Number(formData.get('persentaseSplit')) || 0;
		const kelompokId = Number(formData.get('kelompokId'));
		const authErr = checkAuth(locals, kelompokId);
		if (authErr) return authErr;

		if (!templateId || !posId) return fail(400, { error: 'Template atau pos tidak valid.' });

		try {
			db.insert(templateInfaqPos)
				.values({
					id: createId(),
					templateId,
					posId,
					nominalTarget,
					persentaseSplit,
					urutan: 10
				})
				.run();

			return { success: true, message: 'Pos anggaran berhasil dimasukkan ke template.' };
		} catch (err) {
			console.error('Error add pos to template:', err);
			return fail(500, { error: 'Gagal menambahkan pos ke template (mungkin sudah ada).' });
		}
	},

	/**
	 * Menghapus Pos dari Template
	 */
	removePosFromTemplate: async ({ request, locals }) => {
		const formData = await request.formData();
		const templatePosId = formData.get('templatePosId')?.toString();
		const kelompokId = Number(formData.get('kelompokId'));
		const authErr = checkAuth(locals, kelompokId);
		if (authErr) return authErr;

		if (!templatePosId) return fail(400, { error: 'ID pos template tidak valid.' });

		try {
			db.delete(templateInfaqPos).where(eq(templateInfaqPos.id, templatePosId)).run();
			return { success: true, message: 'Pos anggaran berhasil dikeluarkan dari template.' };
		} catch (err) {
			console.error('Error remove pos from template:', err);
			return fail(500, { error: 'Gagal mengeluarkan pos dari template.' });
		}
	},

	/**
	 * Membuat / Mengupdate Paket atau Bundle Tarif
	 */
	saveBundle: async ({ request, locals }) => {
		const formData = await request.formData();
		const bundleId = formData.get('bundleId')?.toString()?.trim() || null;
		const templateId = formData.get('templateId')?.toString();
		const nama = formData.get('nama')?.toString()?.trim();
		const nominal = Number(formData.get('nominal')) || 0;
		const deskripsi = formData.get('deskripsi')?.toString()?.trim() || null;
		const kelompokId = Number(formData.get('kelompokId'));
		const authErr = checkAuth(locals, kelompokId);
		if (authErr) return authErr;

		if (!templateId || !nama) return fail(400, { error: 'Nama paket bundle wajib diisi.' });

		try {
			if (bundleId) {
				db.update(templateInfaqBundle)
					.set({ nama, nominal, deskripsi })
					.where(eq(templateInfaqBundle.id, bundleId))
					.run();
			} else {
				db.insert(templateInfaqBundle)
					.values({
						id: createId(),
						templateId,
						nama,
						nominal,
						deskripsi,
						urutan: 1
					})
					.run();
			}

			return { success: true, message: 'Paket tarif berhasil disimpan.' };
		} catch (err) {
			console.error('Error save bundle:', err);
			return fail(500, { error: 'Gagal menyimpan paket tarif.' });
		}
	},

	/**
	 * Menghapus Paket Bundle
	 */
	deleteBundle: async ({ request, locals }) => {
		const formData = await request.formData();
		const bundleId = formData.get('bundleId')?.toString();
		const kelompokId = Number(formData.get('kelompokId'));
		const authErr = checkAuth(locals, kelompokId);
		if (authErr) return authErr;

		if (!bundleId) return fail(400, { error: 'ID paket bundle tidak valid.' });

		try {
			db.delete(templateInfaqBundle).where(eq(templateInfaqBundle.id, bundleId)).run();
			return { success: true, message: 'Paket tarif berhasil dihapus.' };
		} catch (err) {
			console.error('Error delete bundle:', err);
			return fail(500, { error: 'Gagal menghapus paket tarif.' });
		}
	},

	/**
	 * Terapkan Bundle Tarif ke Banyak Jamaah Sekaligus (Fast Assignment)
	 */
	assignBundleToJamaah: async ({ request, locals }) => {
		const formData = await request.formData();
		const templateId = formData.get('templateId')?.toString();
		const bundleId = formData.get('bundleId')?.toString();
		const anggotaIdsRaw = formData.get('anggotaIds')?.toString();
		const kelompokId = Number(formData.get('kelompokId'));
		const authErr = checkAuth(locals, kelompokId);
		if (authErr) return authErr;

		if (!templateId || !bundleId || !anggotaIdsRaw) {
			return fail(400, { error: 'Pilih minimal satu jamaah dan satu paket tarif bundle.' });
		}

		const anggotaIds = anggotaIdsRaw.split(',').map((id) => id.trim()).filter(Boolean);
		if (anggotaIds.length === 0) {
			return fail(400, { error: 'Daftar jamaah tidak boleh kosong.' });
		}

		const bundleRow = db.select().from(templateInfaqBundle).where(eq(templateInfaqBundle.id, bundleId)).get();
		if (!bundleRow) return fail(404, { error: 'Paket tarif bundle tidak ditemukan.' });

		try {
			const now = Date.now();
			const upsertStmt = sqlite.prepare(`
				INSERT INTO template_infaq_jamaah (id, template_id, anggota_keluarga_id, bundle_id, nominal_target, is_custom, catatan, updated_at)
				VALUES (?, ?, ?, ?, ?, 0, ?, ?)
				ON CONFLICT(template_id, anggota_keluarga_id) DO UPDATE SET
					bundle_id = excluded.bundle_id,
					nominal_target = excluded.nominal_target,
					is_custom = 0,
					updated_at = excluded.updated_at
			`);

			db.transaction(() => {
				for (const aId of anggotaIds) {
					upsertStmt.run(createId(), templateId, aId, bundleId, bundleRow.nominal, null, now);
				}
			});

			return {
				success: true,
				message: `Berhasil menerapkan paket "${bundleRow.nama}" (${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(bundleRow.nominal)}) ke ${anggotaIds.length} jamaah.`
			};
		} catch (err) {
			console.error('Error assign bundle to jamaah:', err);
			return fail(500, { error: 'Gagal menerapkan paket tarif ke jamaah.' });
		}
	},

	/**
	 * Mengatur Tarif Manual / Kustom per-Jamaah (Granular Override)
	 */
	updateJamaahTarif: async ({ request, locals }) => {
		const formData = await request.formData();
		const templateId = formData.get('templateId')?.toString();
		const anggotaId = formData.get('anggotaId')?.toString();
		const nominalTarget = Number(formData.get('nominalTarget')) || 0;
		const catatan = formData.get('catatan')?.toString()?.trim() || null;
		const kelompokId = Number(formData.get('kelompokId'));
		const authErr = checkAuth(locals, kelompokId);
		if (authErr) return authErr;

		if (!templateId || !anggotaId) {
			return fail(400, { error: 'Data jamaah atau template tidak valid.' });
		}

		try {
			const now = Date.now();
			sqlite.prepare(`
				INSERT INTO template_infaq_jamaah (id, template_id, anggota_keluarga_id, bundle_id, nominal_target, is_custom, catatan, updated_at)
				VALUES (?, ?, ?, NULL, ?, 1, ?, ?)
				ON CONFLICT(template_id, anggota_keluarga_id) DO UPDATE SET
					nominal_target = excluded.nominal_target,
					is_custom = 1,
					catatan = excluded.catatan,
					updated_at = excluded.updated_at
			`).run(createId(), templateId, anggotaId, nominalTarget, catatan, now);

			return { success: true, message: 'Tarif khusus jamaah berhasil disimpan.' };
		} catch (err) {
			console.error('Error update tarif jamaah:', err);
			return fail(500, { error: 'Gagal memperbarui tarif khusus jamaah.' });
		}
	}
};
