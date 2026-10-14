/**
 * @file src/routes/(admin)/admin/dapukan/+page.server.ts
 * @purpose Memuat daftar struktur dapukan dan penugasan RBAC pengurus yang dibatasi hierarki scope (hanya scope sendiri dan ke bawah), validasi integritas keunikan Kyai, pencegahan penugasan manual Superadmin/Admin Pusat, serta mutasi penugasan
 * @usedBy src/routes/(admin)/admin/dapukan/+page.svelte
 * @dependencies src/lib/db, src/lib/db/schema, src/lib/server/scope, drizzle-orm
 * @publicFunctions load, actions.assignDapukan, actions.updateDapukan, actions.removeDapukan
 * @sideEffects Insert/Update/Delete pada user_dapukan, query join multi-tabel users, dapukan, wilayah
 */

import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db, first } from '#lib/db/index.js';
import { dapukan, userDapukan, users, daerah, desa, kelompok } from '#lib/db/schema.js';
import { eq, desc, and, ne } from 'drizzle-orm';
import {
	getAdminScope,
	getAccessibleWilayah,
	getDapukanScopeCondition,
	isDapukanAssignableManually,
	isKelompokAllowed,
	canManageDapukan
} from '#lib/server/scope.js';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user || !locals.isAdmin) {
		throw redirect(303, '/login');
	}

	const adminScope = getAdminScope(locals.roles || []);
	const accessible = await getAccessibleWilayah(adminScope);

	// 1. Master Dapukan Tetap
	const masterDapukan = (await db.select().from(dapukan));

	// 2. Daftar Penugasan Pengurus Aktif join Users, Dapukan, dan Wilayah
	const daftarPengurus = (await db
		.select({
			id: userDapukan.id,
			userId: userDapukan.userId,
			userNama: users.namaLengkap,
			userEmail: users.email,
			dapukanId: userDapukan.dapukanId,
			dapukanNama: dapukan.namaDapukan,
			is4S: dapukan.is4S,
			namaDapukanCustom: userDapukan.namaDapukanCustom,
			tingkatScope: userDapukan.tingkatScope,
			daerahId: userDapukan.daerahId,
			desaId: userDapukan.desaId,
			kelompokId: userDapukan.kelompokId,
			daerahNama: daerah.nama,
			desaNama: desa.nama,
			kelompokNama: kelompok.nama
		})
		.from(userDapukan)
		.leftJoin(users, eq(userDapukan.userId, users.id))
		.leftJoin(dapukan, eq(userDapukan.dapukanId, dapukan.id))
		.leftJoin(daerah, eq(userDapukan.daerahId, daerah.id))
		.leftJoin(desa, eq(userDapukan.desaId, desa.id))
		.leftJoin(kelompok, eq(userDapukan.kelompokId, kelompok.id))
		// Batasi sesuai hierarki: admin hanya melihat dapukan pada scope-nya dan ke bawah
		.where(getDapukanScopeCondition(adminScope, accessible))
		.orderBy(desc(userDapukan.id))
);

	// 3. Opsi Users Jamaah join Wilayah Basis untuk pilihan penugasan yang tersaring
	const rawUserList = (await db
		.select({
			id: users.id,
			namaLengkap: users.namaLengkap,
			email: users.email,
			kelompokId: users.kelompokId,
			kelompokNama: kelompok.nama,
			desaId: kelompok.desaId,
			desaNama: desa.nama,
			daerahId: desa.daerahId,
			daerahNama: daerah.nama
		})
		.from(users)
		.leftJoin(kelompok, eq(users.kelompokId, kelompok.id))
		.leftJoin(desa, eq(kelompok.desaId, desa.id))
		.leftJoin(daerah, eq(desa.daerahId, daerah.id))
);
	const userList = rawUserList.filter((u) => {
		if (adminScope.isPusat) return true;
		if (!u.kelompokId) return false;
		return accessible.allowedKelompokIdSet.has(u.kelompokId);
	});

	// 4. Opsi Wilayah sesuai Scope Akses Admin
	const daerahList = accessible.daerahList;
	const desaList = accessible.desaList;
	const kelompokList = accessible.kelompokList;

	return {
		masterDapukan,
		daftarPengurus,
		userList,
		daerahList,
		desaList,
		kelompokList,
		adminScopeLevel: adminScope.level,
		isPusat: adminScope.isPusat,
		canManageDapukan: canManageDapukan(locals.roles || [])
	};
};

export const actions: Actions = {
	assignDapukan: async ({ request, locals }) => {
		if (!locals.user || !locals.isAdmin) {
			return fail(403, { error: 'Akses ditolak.' });
		}

		if (!canManageDapukan(locals.roles || [])) {
			return fail(403, {
				error: 'Akses ditolak: Pada tingkat kelompok, hanya pengurus 4S dengan dapukan Kyai atau Sekretaris / Penerobos yang dapat menugaskan pengurus baru.'
			});
		}

		const adminScope = getAdminScope(locals.roles || []);
		const accessible = await getAccessibleWilayah(adminScope);

		const formData = await request.formData();
		const userId = formData.get('userId')?.toString()?.trim() || '';
		const tipeDapukan = formData.get('tipeDapukan')?.toString() || 'tetap'; // 'tetap' | 'custom'
		const dapukanIdStr = formData.get('dapukanId')?.toString() || '';
		const namaDapukanCustom = formData.get('namaDapukanCustom')?.toString()?.trim() || null;
		const tingkatScope = formData.get('tingkatScope')?.toString() || 'Kelompok';

		const daerahIdStr = formData.get('daerahId')?.toString() || '';
		const desaIdStr = formData.get('desaId')?.toString() || '';
		const kelompokIdStr = formData.get('kelompokId')?.toString() || '';

		if (!userId) {
			return fail(400, { error: 'Pilih jamaah yang akan ditugaskan.' });
		}

		// Validasi wewenang admin terhadap tingkatScope yang dipilih
		if (!adminScope.isPusat) {
			if (tingkatScope === 'Pusat') {
				return fail(403, { error: 'Anda tidak memiliki wewenang untuk menugaskan pengurus tingkat Pusat.' });
			}
			if (tingkatScope === 'Daerah' && adminScope.level !== 'Daerah') {
				return fail(403, { error: 'Anda tidak memiliki wewenang untuk menugaskan pengurus tingkat Daerah.' });
			}
			if (tingkatScope === 'Desa' && adminScope.level === 'Kelompok') {
				return fail(403, { error: 'Anda tidak memiliki wewenang untuk menugaskan pengurus tingkat Desa.' });
			}
		}

		// Ambil data basis wilayah jamaah yang ditugaskan
		const targetUser = (await first(db
			.select({
				id: users.id,
				namaLengkap: users.namaLengkap,
				kelompokId: users.kelompokId,
				kelompokNama: kelompok.nama,
				desaId: kelompok.desaId,
				desaNama: desa.nama,
				daerahId: desa.daerahId,
				daerahNama: daerah.nama
			})
			.from(users)
			.leftJoin(kelompok, eq(users.kelompokId, kelompok.id))
			.leftJoin(desa, eq(kelompok.desaId, desa.id))
			.leftJoin(daerah, eq(desa.daerahId, daerah.id))
			.where(eq(users.id, userId))
			));

		if (!targetUser) {
			return fail(400, { error: 'Data jamaah tidak ditemukan.' });
		}

		const dapukanId = tipeDapukan === 'tetap' && dapukanIdStr ? parseInt(dapukanIdStr, 10) : null;
		if (tipeDapukan === 'tetap' && !dapukanId) {
			return fail(400, { error: 'Pilih dapukan tetap master data.' });
		}
		if (tipeDapukan === 'custom' && !namaDapukanCustom) {
			return fail(400, { error: 'Tulis nama dapukan tentatif / kepanitiaan kustom.' });
		}

		let selectedDapukan: typeof dapukan.$inferSelect | undefined;
		if (tipeDapukan === 'tetap' && dapukanId) {
			selectedDapukan = (await first(db.select().from(dapukan).where(eq(dapukan.id, dapukanId))));
			if (!selectedDapukan) {
				return fail(400, { error: 'Dapukan tetap tidak ditemukan.' });
			}
			if (!isDapukanAssignableManually(selectedDapukan.namaDapukan)) {
				return fail(400, { error: 'Dapukan Superadmin tidak dapat ditugaskan secara manual.' });
			}
			if (selectedDapukan.namaDapukan.trim().toLowerCase() === 'admin pusat') {
				return fail(400, { error: 'Dapukan Admin Pusat tidak dapat ditugaskan secara manual.' });
			}
		}

		let finalKelompokId: number | null = null;
		let finalDesaId: number | null = null;
		let finalDaerahId: number | null = null;

		if (tingkatScope === 'Kelompok') {
			const kId = kelompokIdStr ? parseInt(kelompokIdStr, 10) : null;
			if (!kId) {
				return fail(400, { error: 'Pilih kelompok cakupan untuk wewenang tingkat Kelompok.' });
			}
			// Kunci scope: jika user memiliki basis kelompok, cakupan wajib sama dengan kelompok basis user
			if (targetUser.kelompokId && kId !== targetUser.kelompokId) {
				return fail(400, {
					error: `Cakupan kelompok harus sesuai dengan basis kelompok jamaah (${targetUser.kelompokNama || 'Kelompok Asal'}).`
				});
			}
			if (!isKelompokAllowed(kId, accessible.allowedKelompokIdSet, adminScope.isPusat)) {
				return fail(403, { error: 'Anda tidak memiliki wewenang pada kelompok yang dipilih.' });
			}
			finalKelompokId = kId;
		} else if (tingkatScope === 'Desa') {
			const dId = desaIdStr ? parseInt(desaIdStr, 10) : null;
			if (!dId) {
				return fail(400, { error: 'Pilih desa cakupan untuk wewenang tingkat Desa.' });
			}
			// Kunci scope: jika user memiliki basis desa, cakupan wajib sama dengan desa basis user
			if (targetUser.desaId && dId !== targetUser.desaId) {
				return fail(400, {
					error: `Cakupan desa harus sesuai dengan basis desa jamaah (${targetUser.desaNama || 'Desa Asal'}).`
				});
			}
			const allowedDesaIds = new Set(accessible.desaList.map((d) => d.id));
			if (!adminScope.isPusat && !allowedDesaIds.has(dId)) {
				return fail(403, { error: 'Anda tidak memiliki wewenang pada desa yang dipilih.' });
			}
			finalDesaId = dId;
		} else if (tingkatScope === 'Daerah') {
			const drId = daerahIdStr ? parseInt(daerahIdStr, 10) : null;
			if (!drId) {
				return fail(400, { error: 'Pilih daerah cakupan untuk wewenang tingkat Daerah.' });
			}
			// Kunci scope: jika user memiliki basis daerah, cakupan wajib sama dengan daerah basis user
			if (targetUser.daerahId && drId !== targetUser.daerahId) {
				return fail(400, {
					error: `Cakupan daerah harus sesuai dengan basis daerah jamaah (${targetUser.daerahNama || 'Daerah Asal'}).`
				});
			}
			const allowedDaerahIds = new Set(accessible.daerahList.map((dr) => dr.id));
			if (!adminScope.isPusat && !allowedDaerahIds.has(drId)) {
				return fail(403, { error: 'Anda tidak memiliki wewenang pada daerah yang dipilih.' });
			}
			finalDaerahId = drId;
		} else if (tingkatScope === 'Pusat') {
			if (!adminScope.isPusat) {
				return fail(403, { error: 'Hanya wewenang Pusat yang dapat menugaskan pengurus tingkat Pusat.' });
			}
			// Integritas 4S: 4S hanya berlaku sampai tingkat Daerah (Kelompok, Desa, Daerah).
			// Untuk tingkat Pusat, seluruh pengurus bertindak sebagai non-4S / kepanitiaan tentatif.
			if (tipeDapukan === 'tetap' && selectedDapukan?.is4S) {
				return fail(400, {
					error: 'Struktur dapukan 4S hanya berlaku hingga tingkat Daerah. Untuk tingkat Pusat, silakan gunakan kepanitiaan tentatif.'
				});
			}
		}

		// Validasi Integritas Dapukan: Kyai hanya boleh ada 1 di setiap lingkup (Kelompok, Desa, Daerah)
		// Sedangkan Wakil Kyai dan dapukan lainnya diperbolehkan lebih dari satu.
		if (tipeDapukan === 'tetap' && dapukanId && tingkatScope !== 'Pusat' && selectedDapukan) {
			const isKyai = selectedDapukan.namaDapukan.trim().toLowerCase() === 'kyai';

			if (isKyai) {
				const queryScope = db
					.select({
						id: userDapukan.id,
						namaLengkap: users.namaLengkap
					})
					.from(userDapukan)
					.innerJoin(users, eq(userDapukan.userId, users.id))
					.where(
						and(
							eq(userDapukan.dapukanId, dapukanId),
							eq(userDapukan.tingkatScope, tingkatScope),
							tingkatScope === 'Kelompok' && finalKelompokId !== null
								? eq(userDapukan.kelompokId, finalKelompokId)
								: tingkatScope === 'Desa' && finalDesaId !== null
									? eq(userDapukan.desaId, finalDesaId)
									: tingkatScope === 'Daerah' && finalDaerahId !== null
										? eq(userDapukan.daerahId, finalDaerahId)
										: undefined
						)
					);
				const existingKyai = await first(queryScope);
				if (existingKyai) {
					const scopeLabel =
						tingkatScope === 'Kelompok'
							? `kelompok ${targetUser.kelompokNama || ''}`.trim()
							: tingkatScope === 'Desa'
								? `desa ${targetUser.desaNama || ''}`.trim()
								: `daerah ${targetUser.daerahNama || ''}`.trim();
					return fail(400, {
						error: `Dapukan Kyai untuk ${scopeLabel} sudah diemban oleh ${existingKyai.namaLengkap}. Hanya boleh ada 1 Kyai di setiap kelompok, desa, atau daerah. Untuk pendamping, gunakan dapukan Wakil Kyai.`
					});
				}
			}
		}

		try {
(await db.insert(userDapukan)
				.values({
					userId,
					dapukanId,
					namaDapukanCustom: tipeDapukan === 'custom' ? namaDapukanCustom : null,
					tingkatScope,
					daerahId: finalDaerahId,
					desaId: finalDesaId,
					kelompokId: finalKelompokId
				})
);
		} catch (error) {
			console.error('Gagal menugaskan dapukan:', error);
			return fail(500, { error: 'Terjadi kesalahan sistem saat menyimpan penugasan pengurus.' });
		}

		return { success: true };
	},

	updateDapukan: async ({ request, locals }) => {
		if (!locals.user || !locals.isAdmin) {
			return fail(403, { error: 'Akses ditolak.' });
		}

		if (!canManageDapukan(locals.roles || [])) {
			return fail(403, {
				error: 'Akses ditolak: Pada tingkat kelompok, hanya pengurus 4S dengan dapukan Kyai atau Sekretaris / Penerobos yang dapat mengubah penugasan pengurus.'
			});
		}

		const adminScope = getAdminScope(locals.roles || []);
		const accessible = await getAccessibleWilayah(adminScope);

		const formData = await request.formData();
		const id = formData.get('id')?.toString()?.trim() || '';
		const tipeDapukan = formData.get('tipeDapukan')?.toString() || 'tetap';
		const dapukanIdStr = formData.get('dapukanId')?.toString() || '';
		const namaDapukanCustom = formData.get('namaDapukanCustom')?.toString()?.trim() || '';
		const tingkatScope = formData.get('tingkatScope')?.toString() as 'Pusat' | 'Daerah' | 'Desa' | 'Kelompok';
		const daerahIdStr = formData.get('daerahId')?.toString() || '';
		const desaIdStr = formData.get('desaId')?.toString() || '';
		const kelompokIdStr = formData.get('kelompokId')?.toString() || '';

		if (!id) {
			return fail(400, { error: 'ID penugasan tidak valid.' });
		}

		const existingAssignment = (await first(db.select().from(userDapukan).where(eq(userDapukan.id, id))));
		if (!existingAssignment) {
			return fail(404, { error: 'Data penugasan tidak ditemukan.' });
		}

		// Validasi wewenang admin terhadap penugasan yang diedit saat ini
		if (!adminScope.isPusat) {
			if (existingAssignment.tingkatScope === 'Pusat') {
				return fail(403, { error: 'Anda tidak berwenang mengedit penugasan tingkat Pusat.' });
			}
			if (
				existingAssignment.tingkatScope === 'Daerah' &&
				(!existingAssignment.daerahId || !adminScope.daerahIds.includes(existingAssignment.daerahId))
			) {
				return fail(403, { error: 'Anda tidak berwenang mengedit penugasan pada daerah ini.' });
			}
			if (
				existingAssignment.tingkatScope === 'Desa' &&
				(!existingAssignment.desaId || !adminScope.desaIds.includes(existingAssignment.desaId))
			) {
				return fail(403, { error: 'Anda tidak berwenang mengedit penugasan pada desa ini.' });
			}
			if (
				existingAssignment.tingkatScope === 'Kelompok' &&
				(!existingAssignment.kelompokId || !accessible.allowedKelompokIdSet.has(existingAssignment.kelompokId))
			) {
				return fail(403, { error: 'Anda tidak berwenang mengedit penugasan pada kelompok ini.' });
			}

			// Validasi wewenang admin terhadap tingkatScope baru yang akan diterapkan
			if (tingkatScope === 'Pusat') {
				return fail(403, { error: 'Anda tidak memiliki wewenang untuk menugaskan pengurus tingkat Pusat.' });
			}
			if (tingkatScope === 'Daerah' && adminScope.level !== 'Daerah') {
				return fail(403, { error: 'Anda tidak memiliki wewenang untuk menugaskan pengurus tingkat Daerah.' });
			}
			if (tingkatScope === 'Desa' && adminScope.level === 'Kelompok') {
				return fail(403, { error: 'Anda tidak memiliki wewenang untuk menugaskan pengurus tingkat Desa.' });
			}
		}

		// Ambil data basis wilayah jamaah yang bersangkutan
		const targetUser = (await first(db
			.select({
				id: users.id,
				namaLengkap: users.namaLengkap,
				kelompokId: users.kelompokId,
				kelompokNama: kelompok.nama,
				desaId: kelompok.desaId,
				desaNama: desa.nama,
				daerahId: desa.daerahId,
				daerahNama: daerah.nama
			})
			.from(users)
			.leftJoin(kelompok, eq(users.kelompokId, kelompok.id))
			.leftJoin(desa, eq(kelompok.desaId, desa.id))
			.leftJoin(daerah, eq(desa.daerahId, daerah.id))
			.where(eq(users.id, existingAssignment.userId))
			));

		if (!targetUser) {
			return fail(400, { error: 'Data jamaah tidak ditemukan.' });
		}

		const dapukanId = tipeDapukan === 'tetap' && dapukanIdStr ? parseInt(dapukanIdStr, 10) : null;
		if (tipeDapukan === 'tetap' && !dapukanId) {
			return fail(400, { error: 'Pilih dapukan tetap master data.' });
		}
		if (tipeDapukan === 'custom' && !namaDapukanCustom) {
			return fail(400, { error: 'Tulis nama dapukan tentatif / kepanitiaan kustom.' });
		}

		let selectedDapukan: typeof dapukan.$inferSelect | undefined;
		if (tipeDapukan === 'tetap' && dapukanId) {
			selectedDapukan = (await first(db.select().from(dapukan).where(eq(dapukan.id, dapukanId))));
			if (!selectedDapukan) {
				return fail(400, { error: 'Dapukan tetap tidak ditemukan.' });
			}
			if (!isDapukanAssignableManually(selectedDapukan.namaDapukan)) {
				return fail(400, { error: 'Dapukan Superadmin tidak dapat ditugaskan secara manual.' });
			}
			if (selectedDapukan.namaDapukan.trim().toLowerCase() === 'admin pusat') {
				return fail(400, { error: 'Dapukan Admin Pusat tidak dapat ditugaskan secara manual.' });
			}
		}

		let finalKelompokId: number | null = null;
		let finalDesaId: number | null = null;
		let finalDaerahId: number | null = null;

		if (tingkatScope === 'Kelompok') {
			const kId = kelompokIdStr ? parseInt(kelompokIdStr, 10) : null;
			if (!kId) {
				return fail(400, { error: 'Pilih kelompok cakupan untuk wewenang tingkat Kelompok.' });
			}
			if (targetUser.kelompokId && kId !== targetUser.kelompokId) {
				return fail(400, {
					error: `Cakupan kelompok harus sesuai dengan basis kelompok jamaah (${targetUser.kelompokNama || 'Kelompok Asal'}).`
				});
			}
			if (!isKelompokAllowed(kId, accessible.allowedKelompokIdSet, adminScope.isPusat)) {
				return fail(403, { error: 'Anda tidak memiliki wewenang pada kelompok yang dipilih.' });
			}
			finalKelompokId = kId;
		} else if (tingkatScope === 'Desa') {
			const dId = desaIdStr ? parseInt(desaIdStr, 10) : null;
			if (!dId) {
				return fail(400, { error: 'Pilih desa cakupan untuk wewenang tingkat Desa.' });
			}
			if (targetUser.desaId && dId !== targetUser.desaId) {
				return fail(400, {
					error: `Cakupan desa harus sesuai dengan basis desa jamaah (${targetUser.desaNama || 'Desa Asal'}).`
				});
			}
			const allowedDesaIds = new Set(accessible.desaList.map((d) => d.id));
			if (!adminScope.isPusat && !allowedDesaIds.has(dId)) {
				return fail(403, { error: 'Anda tidak memiliki wewenang pada desa yang dipilih.' });
			}
			finalDesaId = dId;
		} else if (tingkatScope === 'Daerah') {
			const drId = daerahIdStr ? parseInt(daerahIdStr, 10) : null;
			if (!drId) {
				return fail(400, { error: 'Pilih daerah cakupan untuk wewenang tingkat Daerah.' });
			}
			if (targetUser.daerahId && drId !== targetUser.daerahId) {
				return fail(400, {
					error: `Cakupan daerah harus sesuai dengan basis daerah jamaah (${targetUser.daerahNama || 'Daerah Asal'}).`
				});
			}
			const allowedDaerahIds = new Set(accessible.daerahList.map((dr) => dr.id));
			if (!adminScope.isPusat && !allowedDaerahIds.has(drId)) {
				return fail(403, { error: 'Anda tidak memiliki wewenang pada daerah yang dipilih.' });
			}
			finalDaerahId = drId;
		} else if (tingkatScope === 'Pusat') {
			if (!adminScope.isPusat) {
				return fail(403, { error: 'Hanya wewenang Pusat yang dapat menugaskan pengurus tingkat Pusat.' });
			}
			// Integritas 4S: 4S hanya berlaku sampai tingkat Daerah (Kelompok, Desa, Daerah).
			// Untuk tingkat Pusat, seluruh pengurus bertindak sebagai non-4S / kepanitiaan tentatif.
			if (tipeDapukan === 'tetap' && selectedDapukan?.is4S) {
				return fail(400, {
					error: 'Struktur dapukan 4S hanya berlaku hingga tingkat Daerah. Untuk tingkat Pusat, silakan gunakan kepanitiaan tentatif.'
				});
			}
		}

		// Validasi Integritas Dapukan: Kyai hanya boleh ada 1 di setiap lingkup (Kelompok, Desa, Daerah)
		// Sedangkan Wakil Kyai dan dapukan lainnya diperbolehkan lebih dari satu.
		if (tipeDapukan === 'tetap' && dapukanId && tingkatScope !== 'Pusat' && selectedDapukan) {
			const isKyai = selectedDapukan.namaDapukan.trim().toLowerCase() === 'kyai';

			if (isKyai) {
				const queryScope = db
					.select({
						id: userDapukan.id,
						namaLengkap: users.namaLengkap
					})
					.from(userDapukan)
					.innerJoin(users, eq(userDapukan.userId, users.id))
					.where(
						and(
							ne(userDapukan.id, id),
							eq(userDapukan.dapukanId, dapukanId),
							eq(userDapukan.tingkatScope, tingkatScope),
							tingkatScope === 'Kelompok' && finalKelompokId !== null
								? eq(userDapukan.kelompokId, finalKelompokId)
								: tingkatScope === 'Desa' && finalDesaId !== null
									? eq(userDapukan.desaId, finalDesaId)
									: tingkatScope === 'Daerah' && finalDaerahId !== null
										? eq(userDapukan.daerahId, finalDaerahId)
										: undefined
						)
					);
				const existingKyai = await first(queryScope);
				if (existingKyai) {
					const scopeLabel =
						tingkatScope === 'Kelompok'
							? `kelompok ${targetUser.kelompokNama || ''}`.trim()
							: tingkatScope === 'Desa'
								? `desa ${targetUser.desaNama || ''}`.trim()
								: `daerah ${targetUser.daerahNama || ''}`.trim();
					return fail(400, {
						error: `Dapukan Kyai untuk ${scopeLabel} sudah diemban oleh ${existingKyai.namaLengkap}. Hanya boleh ada 1 Kyai di setiap kelompok, desa, atau daerah. Untuk pendamping, gunakan dapukan Wakil Kyai.`
					});
				}
			}
		}

		try {
(await db.update(userDapukan)
				.set({
					dapukanId,
					namaDapukanCustom: tipeDapukan === 'custom' ? namaDapukanCustom : null,
					tingkatScope,
					daerahId: finalDaerahId,
					desaId: finalDesaId,
					kelompokId: finalKelompokId
				})
				.where(eq(userDapukan.id, id))
);
		} catch (error) {
			console.error('Gagal memperbarui dapukan:', error);
			return fail(500, { error: 'Terjadi kesalahan sistem saat memperbarui penugasan pengurus.' });
		}

		return { success: true };
	},

	removeDapukan: async ({ request, locals }) => {
		if (!locals.user || !locals.isAdmin) {
			return fail(403, { error: 'Akses ditolak.' });
		}

		if (!canManageDapukan(locals.roles || [])) {
			return fail(403, {
				error: 'Akses ditolak: Pada tingkat kelompok, hanya pengurus 4S dengan dapukan Kyai atau Sekretaris / Penerobos yang dapat mencabut penugasan pengurus.'
			});
		}

		const adminScope = getAdminScope(locals.roles || []);
		const accessible = await getAccessibleWilayah(adminScope);

		const formData = await request.formData();
		const id = formData.get('id')?.toString()?.trim() || '';

		if (!id) {
			return fail(400, { error: 'ID penugasan tidak valid.' });
		}

		const targetAssignment = (await first(db.select().from(userDapukan).where(eq(userDapukan.id, id))));
		if (!targetAssignment) {
			return fail(404, { error: 'Data penugasan tidak ditemukan.' });
		}

		if (!adminScope.isPusat) {
			if (targetAssignment.tingkatScope === 'Pusat') {
				return fail(403, { error: 'Anda tidak berwenang mencabut penugasan tingkat Pusat.' });
			}
			if (
				targetAssignment.tingkatScope === 'Daerah' &&
				(!targetAssignment.daerahId || !adminScope.daerahIds.includes(targetAssignment.daerahId))
			) {
				return fail(403, { error: 'Anda tidak berwenang mencabut penugasan pada daerah ini.' });
			}
			if (
				targetAssignment.tingkatScope === 'Desa' &&
				(!targetAssignment.desaId || !adminScope.desaIds.includes(targetAssignment.desaId))
			) {
				return fail(403, { error: 'Anda tidak berwenang mencabut penugasan pada desa ini.' });
			}
			if (
				targetAssignment.tingkatScope === 'Kelompok' &&
				(!targetAssignment.kelompokId || !accessible.allowedKelompokIdSet.has(targetAssignment.kelompokId))
			) {
				return fail(403, { error: 'Anda tidak berwenang mencabut penugasan pada kelompok ini.' });
			}
		}

		try {
(await db.delete(userDapukan).where(eq(userDapukan.id, id)));
		} catch (error) {
			console.error('Gagal mencabut penugasan:', error);
			return fail(500, { error: 'Gagal mencabut penugasan pengurus.' });
		}

		return { success: true };
	}
};

