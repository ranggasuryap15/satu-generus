/**
 * @file src/routes/(admin)/admin/keuangan/template-fr/+page.server.ts
 * @purpose Controller backend Spreadsheet Template FR: mengelola lembar kerja 4 kolom (No, Uraian, Jumlah, Keterangan), group tarif (Group A, B, dst), duplikasi group, penyimpanan sel spreadsheet massal, seleksi kelompok adaptif (default null untuk admin multi-kelompok, auto-select kelompok sendiri untuk admin kelompok), serta penetapan jamaah massal
 * @usedBy src/routes/(admin)/admin/keuangan/template-fr/+page.svelte
 * @dependencies @sveltejs/kit, src/lib/db, src/lib/db/schema, src/lib/server/scope, drizzle-orm, @paralleldrive/cuid2
 * @publicFunctions load, actions.saveSpreadsheet, actions.createGroup, actions.duplicateGroup, actions.deleteGroup, actions.addPos, actions.updatePos, actions.deletePos, actions.assignJamaahToGroup, actions.removeJamaahFromGroup
 * @sideEffects DB read & write pada tabel template_infaq_rutin, template_infaq_group, template_infaq_group_pos, pos_anggaran_infaq, dan template_infaq_jamaah di SQLite
 */

import { fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { db, first } from '#lib/db/index.js';
import {
	templateInfaqRutin,
	templateInfaqGroup,
	templateInfaqGroupPos,
	posAnggaranInfaq,
	templateInfaqJamaah,
	anggotaKeluarga,
	keluarga,
	users
} from '#lib/db/schema.js';
import { eq, and, asc, desc, inArray, isNull, or, sql } from 'drizzle-orm';
import { getAdminScope, getAccessibleWilayah, canAccessKeuangan, canManageFr } from '#lib/server/scope.js';
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
	const accessibleWilayah = await getAccessibleWilayah(adminScope);

	const currentYear = new Date().getFullYear();
	const tahunParam = Number(url.searchParams.get('tahun')) || currentYear;
	const urlKelompokId = url.searchParams.get('kelompokId');

	// Penentuan kelompok terpilih:
	// - Jika ada query param kelompokId, validasi akses dan gunakan.
	// - Jika TIDAK ada query param:
	//   * Untuk Admin Kelompok: langsung otomatis muncul kelompoknya sendiri dan sematkan ke URL.
	//   * Untuk Admin tingkat atas (Desa/Daerah/Pusat): default NULL (harus dipilih manual lewat dropdown).
	let selectedKelompokId: number | null = null;
	const isAdminKelompok =
		adminScope.level === 'Kelompok' &&
		(adminScope.kelompokIds.length > 0 || Boolean(locals.user.kelompokId));

	if (urlKelompokId) {
		const parsed = Number(urlKelompokId);
		if (parsed > 0 && (adminScope.isPusat || accessibleWilayah.allowedKelompokIdSet.has(parsed))) {
			selectedKelompokId = parsed;
		}
	} else if (isAdminKelompok) {
		selectedKelompokId = adminScope.kelompokIds[0] || locals.user.kelompokId || null;
	}

	const canEdit = selectedKelompokId
		? await canManageFr(roles, 'Kelompok', selectedKelompokId)
		: false;

	// Pastikan kelompokId selalu persisten di URL khusus untuk admin kelompok agar formulir tidak mereset
	if (!urlKelompokId && selectedKelompokId && isAdminKelompok) {
		const targetUrl = new URL(url);
		targetUrl.searchParams.set('kelompokId', String(selectedKelompokId));
		targetUrl.searchParams.set('tahun', String(tahunParam));
		throw redirect(303, targetUrl.pathname + targetUrl.search);
	}

	if (!selectedKelompokId) {
		return {
			adminScope,
			accessibleWilayah,
			tahun: tahunParam,
			selectedKelompokId: null,
			canEdit: false,
			template: null,
			groups: [],
			selectedGroupId: null,
			selectedGroup: null,
			categoriesWithPos: [],
			groupPosValues: {},
			jamaahInSelectedGroup: [],
			allKelompokJamaah: []
		};
	}

	// 1. Dapatkan atau Buat Template Rutin untuk Kelompok & Tahun Ini
	let activeTemplate = (await db
		.select()
		.from(templateInfaqRutin)
		.where(
			and(
				eq(templateInfaqRutin.kelompokId, selectedKelompokId),
				eq(templateInfaqRutin.tahun, tahunParam)
			)
		)
		.orderBy(desc(templateInfaqRutin.createdAt))
		.limit(1)
		)[0];

	if (!activeTemplate && canEdit) {
		const now = Date.now();
		const newTemplateId = createId();
(await db.insert(templateInfaqRutin)
			.values({
				id: newTemplateId,
				nama: `Template FR ${tahunParam}`,
				tingkatScope: 'Kelompok',
				kelompokId: selectedKelompokId,
				tahun: tahunParam,
				bulanMulai: 1,
				bulanSelesai: 12,
				nominalMinimumDefault: 0,
				status: 'aktif',
				createdByUserId: locals.user.id,
				createdAt: now,
				updatedAt: now
			})
);
		activeTemplate = (await db
			.select()
			.from(templateInfaqRutin)
			.where(eq(templateInfaqRutin.id, newTemplateId))
			)[0];
	}

	// 2. Ambil Daftar Group Tarif (Group A, Group B, dst)
	let groups: Array<typeof templateInfaqGroup.$inferSelect> = [];
	if (activeTemplate) {
		groups = (await db
			.select()
			.from(templateInfaqGroup)
			.where(eq(templateInfaqGroup.templateId, activeTemplate.id))
			.orderBy(asc(templateInfaqGroup.urutan), asc(templateInfaqGroup.createdAt))
);
		// Jika belum ada group sama sekali, buat Group A sebagai group default
		if (groups.length === 0 && canEdit) {
			const now = Date.now();
			const newGroupId = createId();
(await db.insert(templateInfaqGroup)
				.values({
					id: newGroupId,
					templateId: activeTemplate.id,
					nama: 'Group A',
					keterangan: 'Skema Tarif Utama',
					urutan: 1,
					createdAt: now,
					updatedAt: now
				})
);
			groups = (await db
				.select()
				.from(templateInfaqGroup)
				.where(eq(templateInfaqGroup.id, newGroupId))
);
		}
	}

	// Tentukan group yang sedang dibuka di spreadsheet
	const requestedGroupId = url.searchParams.get('groupId');
	const selectedGroup =
		groups.find((g) => g.id === requestedGroupId) ||
		groups[0] ||
		null;

	// 3. Ambil Struktur Pos Anggaran (Hierarki Kategori & Sub-pos)
	const rawAllPos = (await db
		.select()
		.from(posAnggaranInfaq)
		.where(
			and(
				eq(posAnggaranInfaq.isActive, true),
				or(
					eq(posAnggaranInfaq.isWajib, true),
					eq(posAnggaranInfaq.kelompokId, selectedKelompokId),
					isNull(posAnggaranInfaq.kelompokId)
				)
			)
		)
		.orderBy(asc(posAnggaranInfaq.urutan), asc(posAnggaranInfaq.nama))
);
	// Pisahkan kategori induk (parentId IS NULL) dan sub-pos anak (parentId IS NOT NULL)
	const parentCategories = rawAllPos
		.filter((p) => !p.parentId)
		.sort((a, b) => a.urutan - b.urutan);

	const subPosList = rawAllPos.filter((p) => !!p.parentId);

	const categoriesWithPos = parentCategories.map((cat, idx) => {
		const children = subPosList
			.filter((sub) => sub.parentId === cat.id)
			.sort((a, b) => a.urutan - b.urutan);

		// Label huruf kategori: A, B, C, D...
		const letter = String.fromCharCode(65 + idx);

		return {
			...cat,
			labelKategori: `${letter}. ${cat.nama}`,
			subPos: children
		};
	});

	// 4. Ambil Nilai Spreadsheet (Jumlah & Keterangan) untuk Group Terpilih
	const groupPosValues: Record<string, { nominalJumlah: number; nominalKeterangan: number; keteranganTeks: string | null }> = {};

	if (selectedGroup) {
		const rawGroupPos = (await db
			.select()
			.from(templateInfaqGroupPos)
			.where(eq(templateInfaqGroupPos.groupId, selectedGroup.id))
);
		for (const gp of rawGroupPos) {
			groupPosValues[gp.posId] = {
				nominalJumlah: gp.nominalJumlah,
				nominalKeterangan: gp.nominalKeterangan,
				keteranganTeks: gp.keteranganTeks
			};
		}
	}

	// 5. Ambil Daftar Seluruh Jamaah Wajib Isrun di Kelompok Ini
	const rawJamaah = (await db
		.select({
			anggotaId: anggotaKeluarga.id,
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
);
	// Ambil assignment jamaah ke group di template ini
	let rawAssignments: Array<{
		anggotaKeluargaId: string;
		groupId: string | null;
	}> = [];

	if (activeTemplate) {
		rawAssignments = (await db
			.select({
				anggotaKeluargaId: templateInfaqJamaah.anggotaKeluargaId,
				groupId: templateInfaqJamaah.groupId
			})
			.from(templateInfaqJamaah)
			.where(eq(templateInfaqJamaah.templateId, activeTemplate.id))
);
	}

	const assignmentMap = new Map(rawAssignments.map((a) => [a.anggotaKeluargaId, a.groupId]));
	const groupNameMap = new Map(groups.map((g) => [g.id, g.nama]));

	const allKelompokJamaah = rawJamaah.map((j) => {
		const assignedGroupId = assignmentMap.get(j.anggotaId) || null;
		return {
			...j,
			namaLengkap: j.namaLengkap || '',
			assignedGroupId,
			assignedGroupName: assignedGroupId ? groupNameMap.get(assignedGroupId) || null : null,
			isInSelectedGroup: selectedGroup ? assignedGroupId === selectedGroup.id : false
		};
	});

	const jamaahInSelectedGroup = allKelompokJamaah.filter((j) => j.isInSelectedGroup);

	return {
		adminScope,
		accessibleWilayah,
		tahun: tahunParam,
		selectedKelompokId,
		canEdit,
		template: activeTemplate || null,
		groups,
		selectedGroupId: selectedGroup?.id || null,
		selectedGroup,
		categoriesWithPos,
		groupPosValues,
		jamaahInSelectedGroup,
		allKelompokJamaah
	};
};

async function checkAuth(locals: App.Locals, kelompokId: number | null) {
	if (!locals.user || !locals.isAdmin) {
		return fail(401, { error: 'Anda harus login sebagai pengurus.' });
	}
	const roles = locals.roles || [];
	if (!canAccessKeuangan(roles)) {
		return fail(403, { error: 'Akses menu keuangan ditolak.' });
	}
	if (!kelompokId || !(await canManageFr(roles, 'Kelompok', kelompokId))) {
		return fail(403, { error: 'Anda tidak memiliki wewenang untuk mengelola keuangan kelompok ini.' });
	}
	return null;
}

export const actions: Actions = {
	/**
	 * Simpan Perubahan Sel Spreadsheet (Jumlah, Keterangan, Catatan)
	 */
	saveSpreadsheet: async ({ request, locals }) => {
		const formData = await request.formData();
		const kelompokId = Number(formData.get('kelompokId'));
		const authErr = await checkAuth(locals, kelompokId);
		if (authErr) return authErr;

		const groupId = formData.get('groupId')?.toString();
		const cellsJson = formData.get('cellsData')?.toString();

		if (!groupId || !cellsJson) {
			return fail(400, { error: 'Data sel spreadsheet tidak valid.' });
		}

		try {
			const cells: Array<{
				posId: string;
				nama?: string;
				parentId?: string;
				isNew?: boolean;
				nominalJumlah: number;
				nominalKeterangan: number;
				keteranganTeks?: string;
			}> = JSON.parse(cellsJson);

			const now = Date.now();

			await db.transaction(async (tx) => {
				for (const item of cells) {
					let finalPosId = item.posId;

					// Jika merupakan baris baru yang dibuat realtime dari spreadsheet
					if (item.isNew) {
						const trimmedName = (item.nama || '').trim();
						if (!trimmedName) continue; // Abaikan baris jika namanya belum diisi

						finalPosId = createId();
						const countRow = await first(
							tx.execute(
								sql`SELECT COUNT(*) as c FROM pos_anggaran_infaq WHERE parent_id = ${item.parentId}`
							)
);
						const count = Number((countRow as any)?.c) || 0;
						const kode = `POS-${Date.now().toString().slice(-4)}`;

						await tx.execute(sql`
							INSERT INTO pos_anggaran_infaq (
								id, parent_id, kode, nama, deskripsi, tingkat_scope, kelompok_id,
								is_wajib, tipe_alokasi, urutan, is_active, created_at, updated_at
							) VALUES (
								${finalPosId}, ${item.parentId || null}, ${kode}, ${trimmedName}, '', 'Kelompok', ${kelompokId},
								false, 'nominal', ${count + 1}, true, ${now}, ${now}
							)
						`);
					}

					await tx.execute(sql`
						INSERT INTO template_infaq_group_pos (id, group_id, pos_id, nominal_jumlah, nominal_keterangan, keterangan_teks, urutan, created_at, updated_at)
						VALUES (
							${createId()}, ${groupId}, ${finalPosId}, ${Number(item.nominalJumlah) || 0},
							${Number(item.nominalKeterangan) || 0}, ${item.keteranganTeks || null}, 0, ${now}, ${now}
						)
						ON CONFLICT (group_id, pos_id) DO UPDATE SET
							nominal_jumlah = excluded.nominal_jumlah,
							nominal_keterangan = excluded.nominal_keterangan,
							keterangan_teks = excluded.keterangan_teks,
							updated_at = excluded.updated_at
					`);
				}

				// Update waktu di template group
				await tx.execute(sql`UPDATE template_infaq_group SET updated_at = ${now} WHERE id = ${groupId}`);
			});

			return { success: true, message: 'Seluruh angka spreadsheet berhasil disimpan.' };
		} catch (err: any) {
			console.error('[saveSpreadsheet Error]:', err);
			return fail(500, { error: err.message || 'Gagal menyimpan spreadsheet.' });
		}
	},

	/**
	 * Buat Group Baru (Group A, Group B, dll)
	 */
	createGroup: async ({ request, locals }) => {
		const formData = await request.formData();
		const kelompokId = Number(formData.get('kelompokId'));
		const authErr = await checkAuth(locals, kelompokId);
		if (authErr) return authErr;

		const templateId = formData.get('templateId')?.toString();
		const nama = formData.get('nama')?.toString()?.trim();
		const keterangan = formData.get('keterangan')?.toString()?.trim() || null;

		if (!templateId || !nama) {
			return fail(400, { error: 'Nama group wajib diisi.' });
		}

		try {
			const count = (await first(db.execute(sql`SELECT COUNT(*) as c FROM template_infaq_group WHERE template_id = ${templateId}`)) as any)?.c || 0;
			const newId = createId();
			const now = Date.now();

(await db.insert(templateInfaqGroup)
				.values({
					id: newId,
					templateId,
					nama,
					keterangan,
					urutan: count + 1,
					createdAt: now,
					updatedAt: now
				})
);
			return { success: true, message: `Group "${nama}" berhasil dibuat.`, createdGroupId: newId };
		} catch (err: any) {
			return fail(500, { error: err.message || 'Gagal membuat group baru.' });
		}
	},

	/**
	 * Duplikasi Group (Menyalin Seluruh Rincian Angka dari Group Sumber)
	 */
	duplicateGroup: async ({ request, locals }) => {
		const formData = await request.formData();
		const kelompokId = Number(formData.get('kelompokId'));
		const authErr = await checkAuth(locals, kelompokId);
		if (authErr) return authErr;

		const templateId = formData.get('templateId')?.toString();
		const sourceGroupId = formData.get('sourceGroupId')?.toString();
		const namaBaru = formData.get('namaBaru')?.toString()?.trim();

		if (!templateId || !sourceGroupId || !namaBaru) {
			return fail(400, { error: 'Group sumber dan nama group baru wajib diisi.' });
		}

		try {
			const now = Date.now();
			const newGroupId = createId();

			await db.transaction(async (tx) => {
				const countRow = await first(
					tx.execute(
						sql`SELECT COUNT(*) as c FROM template_infaq_group WHERE template_id = ${templateId}`
					)
);
				const count = Number((countRow as any)?.c) || 0;

				// 1. Buat record group baru
				await tx.execute(sql`
					INSERT INTO template_infaq_group (id, template_id, nama, keterangan, urutan, created_at, updated_at)
					VALUES (${newGroupId}, ${templateId}, ${namaBaru}, 'Hasil duplikasi dari group sebelumnya', ${count + 1}, ${now}, ${now})
				`);

				// 2. Salin seluruh sel angka dari group sumber
				const sourceRows = (await tx.execute(sql`
					SELECT pos_id, nominal_jumlah, nominal_keterangan, keterangan_teks, urutan
					FROM template_infaq_group_pos
					WHERE group_id = ${sourceGroupId}
				`)) as Array<{ pos_id: string; nominal_jumlah: number; nominal_keterangan: number; keterangan_teks: string; urutan: number }>;

				for (const row of sourceRows) {
					await tx.execute(sql`
						INSERT INTO template_infaq_group_pos (id, group_id, pos_id, nominal_jumlah, nominal_keterangan, keterangan_teks, urutan, created_at, updated_at)
						VALUES (
							${createId()}, ${newGroupId}, ${row.pos_id}, ${row.nominal_jumlah},
							${row.nominal_keterangan}, ${row.keterangan_teks}, ${row.urutan}, ${now}, ${now}
						)
					`);
				}
			});

			return { success: true, message: `Group "${namaBaru}" berhasil diduplikasi.`, newGroupId };
		} catch (err: any) {
			return fail(500, { error: err.message || 'Gagal menduplikasi group.' });
		}
	},

	/**
	 * Hapus Group
	 */
	deleteGroup: async ({ request, locals }) => {
		const formData = await request.formData();
		const kelompokId = Number(formData.get('kelompokId'));
		const authErr = await checkAuth(locals, kelompokId);
		if (authErr) return authErr;

		const groupId = formData.get('groupId')?.toString();
		if (!groupId) return fail(400, { error: 'ID group tidak valid.' });

		try {
(await db.delete(templateInfaqGroup).where(eq(templateInfaqGroup.id, groupId)));
			return { success: true, message: 'Group berhasil dihapus.' };
		} catch (err: any) {
			return fail(500, { error: err.message || 'Gagal menghapus group.' });
		}
	},

	/**
	 * Tambah Baris Uraian (Sub-pos Anggaran)
	 */
	addPos: async ({ request, locals }) => {
		const formData = await request.formData();
		const kelompokId = Number(formData.get('kelompokId'));
		const authErr = await checkAuth(locals, kelompokId);
		if (authErr) return authErr;

		const parentId = formData.get('parentId')?.toString() || null;
		const nama = formData.get('nama')?.toString()?.trim();
		const kode = formData.get('kode')?.toString()?.trim() || `POS-${Date.now().toString().slice(-4)}`;

		if (!nama) {
			return fail(400, { error: 'Nama uraian wajib diisi.' });
		}

		try {
			const now = Date.now();
			const count = (await first(db.execute(sql`SELECT COUNT(*) as c FROM pos_anggaran_infaq WHERE parent_id = ${parentId}`)) as any)?.c || 0;

(await db.insert(posAnggaranInfaq)
				.values({
					id: createId(),
					parentId,
					kode,
					nama,
					deskripsi: '',
					tingkatScope: 'Kelompok',
					kelompokId,
					isWajib: false,
					tipeAlokasi: 'nominal',
					urutan: count + 1,
					isActive: true,
					createdAt: now,
					updatedAt: now
				})
);
			return { success: true, message: `Uraian "${nama}" berhasil ditambahkan.` };
		} catch (err: any) {
			return fail(500, { error: err.message || 'Gagal menambah baris uraian.' });
		}
	},

	/**
	 * Edit Nama Baris Uraian
	 */
	updatePos: async ({ request, locals }) => {
		const formData = await request.formData();
		const kelompokId = Number(formData.get('kelompokId'));
		const authErr = await checkAuth(locals, kelompokId);
		if (authErr) return authErr;

		const posId = formData.get('posId')?.toString();
		const nama = formData.get('nama')?.toString()?.trim();

		if (!posId || !nama) {
			return fail(400, { error: 'Nama uraian tidak boleh kosong.' });
		}

		try {
(await db.update(posAnggaranInfaq)
				.set({ nama, updatedAt: Date.now() })
				.where(eq(posAnggaranInfaq.id, posId))
);
			return { success: true, message: 'Nama uraian berhasil diperbarui.' };
		} catch (err: any) {
			return fail(500, { error: err.message || 'Gagal memperbarui uraian.' });
		}
	},

	/**
	 * Hapus Baris Uraian (Pos Anggaran)
	 */
	deletePos: async ({ request, locals }) => {
		const formData = await request.formData();
		const kelompokId = Number(formData.get('kelompokId'));
		const authErr = await checkAuth(locals, kelompokId);
		if (authErr) return authErr;

		const posId = formData.get('posId')?.toString();
		if (!posId) return fail(400, { error: 'ID pos tidak valid.' });

		const pos = (await db.select().from(posAnggaranInfaq).where(eq(posAnggaranInfaq.id, posId)))[0];
		if (!pos) return fail(404, { error: 'Pos tidak ditemukan.' });
		if (pos.isWajib) {
			return fail(400, { error: 'Hak Wajib tidak boleh dihapus dari sistem.' });
		}

		try {
(await db.delete(posAnggaranInfaq).where(eq(posAnggaranInfaq.id, posId)));
			return { success: true, message: `Pos "${pos.nama}" berhasil dihapus.` };
		} catch (err: any) {
			return fail(500, { error: err.message || 'Gagal menghapus pos anggaran.' });
		}
	},

	/**
	 * Masukkan Banyak Jamaah Sekaligus ke dalam Group Terpilih (Bulk Assignment)
	 */
	assignJamaahToGroup: async ({ request, locals }) => {
		const formData = await request.formData();
		const kelompokId = Number(formData.get('kelompokId'));
		const authErr = await checkAuth(locals, kelompokId);
		if (authErr) return authErr;

		const templateId = formData.get('templateId')?.toString();
		const groupId = formData.get('groupId')?.toString();
		const anggotaIdsJson = formData.get('anggotaIds')?.toString();

		if (!templateId || !groupId || !anggotaIdsJson) {
			return fail(400, { error: 'Pilih group dan jamaah yang ingin dimasukkan.' });
		}

		try {
			const anggotaIds: string[] = JSON.parse(anggotaIdsJson);
			if (anggotaIds.length === 0) {
				return fail(400, { error: 'Tidak ada jamaah yang dipilih.' });
			}

			const now = Date.now();
			await db.transaction(async (tx) => {
				for (const aid of anggotaIds) {
					await tx.execute(sql`
				INSERT INTO template_infaq_jamaah (id, template_id, anggota_keluarga_id, group_id, nominal_target, is_custom, updated_at)
						VALUES (${createId()}, ${templateId}, ${aid}, ${groupId}, 0, false, ${now})
						ON CONFLICT (template_id, anggota_keluarga_id) DO UPDATE SET
					group_id = excluded.group_id,
					updated_at = excluded.updated_at
			`);
				}
			});

			return {
				success: true,
				message: `${anggotaIds.length} jamaah berhasil dimasukkan ke group ini.`
			};
		} catch (err: any) {
			console.error('[assignJamaahToGroup Error]:', err);
			return fail(500, { error: err.message || 'Gagal memasukkan jamaah ke group.' });
		}
	},

	/**
	 * Keluarkan Jamaah dari Group
	 */
	removeJamaahFromGroup: async ({ request, locals }) => {
		const formData = await request.formData();
		const kelompokId = Number(formData.get('kelompokId'));
		const authErr = await checkAuth(locals, kelompokId);
		if (authErr) return authErr;

		const templateId = formData.get('templateId')?.toString();
		const anggotaId = formData.get('anggotaId')?.toString();

		if (!templateId || !anggotaId) {
			return fail(400, { error: 'Data jamaah tidak valid.' });
		}

		try {
			await db.execute(sql`
				UPDATE template_infaq_jamaah
				SET group_id = NULL, updated_at = ${Date.now()}
				WHERE template_id = ${templateId} AND anggota_keluarga_id = ${anggotaId}
			`);

			return { success: true, message: 'Jamaah berhasil dikeluarkan dari group.' };
		} catch (err: any) {
			return fail(500, { error: err.message || 'Gagal mengeluarkan jamaah.' });
		}
	}
};
