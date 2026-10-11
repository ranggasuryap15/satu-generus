/**
 * @file src/routes/(admin)/admin/dapukan/+page.server.ts
 * @purpose Memuat daftar struktur dapukan, penugasan RBAC pengurus dengan proteksi hierarki wilayah jamaah, serta mutasi penugasan (khusus 4S Kyai / Sekretaris / Penerobos pada tingkat kelompok)
 * @usedBy src/routes/(admin)/admin/dapukan/+page.svelte
 * @dependencies src/lib/db, src/lib/db/schema, src/lib/server/scope, drizzle-orm
 * @publicFunctions load, actions.assignDapukan, actions.removeDapukan
 * @sideEffects Insert/Delete pada user_dapukan, query join multi-tabel users, dapukan, wilayah
 */

import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/db';
import { dapukan, userDapukan, users, daerah, desa, kelompok } from '$lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { getAdminScope, getAccessibleWilayah, isKelompokAllowed, canManageDapukan } from '$lib/server/scope';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user || !locals.isAdmin) {
		throw redirect(303, '/login');
	}

	const adminScope = getAdminScope(locals.roles || []);
	const accessible = getAccessibleWilayah(adminScope);

	// 1. Master Dapukan Tetap
	const masterDapukan = db.select().from(dapukan).all();

	// 2. Daftar Penugasan Pengurus Aktif join Users, Dapukan, dan Wilayah
	const daftarPengurus = db
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
		.orderBy(desc(userDapukan.id))
		.all();

	// 3. Opsi Users Jamaah join Wilayah Basis untuk pilihan penugasan yang tersaring
	const rawUserList = db
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
		.all();

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
		const accessible = getAccessibleWilayah(adminScope);

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
		const targetUser = db
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
			.get();

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
		}

		try {
			db.insert(userDapukan)
				.values({
					userId,
					dapukanId,
					namaDapukanCustom: tipeDapukan === 'custom' ? namaDapukanCustom : null,
					tingkatScope,
					daerahId: finalDaerahId,
					desaId: finalDesaId,
					kelompokId: finalKelompokId
				})
				.run();
		} catch (error) {
			console.error('Gagal menugaskan dapukan:', error);
			return fail(500, { error: 'Terjadi kesalahan sistem saat menyimpan penugasan pengurus.' });
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
		const accessible = getAccessibleWilayah(adminScope);

		const formData = await request.formData();
		const id = formData.get('id')?.toString()?.trim() || '';

		if (!id) {
			return fail(400, { error: 'ID penugasan tidak valid.' });
		}

		const targetAssignment = db.select().from(userDapukan).where(eq(userDapukan.id, id)).get();
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
			db.delete(userDapukan).where(eq(userDapukan.id, id)).run();
		} catch (error) {
			console.error('Gagal mencabut penugasan:', error);
			return fail(500, { error: 'Gagal mencabut penugasan pengurus.' });
		}

		return { success: true };
	}
};

