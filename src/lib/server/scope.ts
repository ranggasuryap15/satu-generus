/**
 * @file src/lib/server/scope.ts
 * @purpose Evaluasi wewenang administratif berjenjang (Pusat, Daerah, Desa, Kelompok), filter wilayah RBAC, validasi hak mutasi dapukan, proteksi CRUD rekening/QRIS KU & Superadmin, otorisasi modul Keuangan/KU, serta otorisasi modifikasi shodaqoh khusus KU dan Kyai
 * @usedBy src/routes/(admin)/admin/sensus/+page.server.ts, src/routes/(admin)/admin/wilayah/*, src/routes/(admin)/admin/dapukan/+page.server.ts, src/routes/(admin)/admin/profil-wilayah/+page.server.ts, src/routes/(admin)/admin/keuangan/*
 * @dependencies src/lib/db, src/lib/db/schema, drizzle-orm
 * @publicFunctions getAdminScope, getAccessibleWilayah, isKelompokAllowed, canManageDapukan, canManageRekening, canAccessKeuangan, canManageFr, canManageShodaqoh
 * @sideEffects Membaca data relasi master daerah, desa, dan kelompok dari SQLite
 */

import { db } from '$lib/db';
import { daerah, desa, kelompok } from '$lib/db/schema';
import { inArray, eq } from 'drizzle-orm';

export interface AdminScope {
	level: 'Pusat' | 'Daerah' | 'Desa' | 'Kelompok';
	isPusat: boolean;
	daerahIds: number[];
	desaIds: number[];
	kelompokIds: number[];
}

export interface AccessibleWilayah {
	daerahList: Array<typeof daerah.$inferSelect>;
	desaList: Array<typeof desa.$inferSelect & { daerahNama?: string }>;
	kelompokList: Array<typeof kelompok.$inferSelect & { desaNama?: string; daerahNama?: string; daerahId?: number }>;
	allowedKelompokIdSet: Set<number>;
}

/**
 * Menganalisis wewenang tertinggi dari daftar role seorang admin
 */
export function getAdminScope(roles: App.UserRole[] = []): AdminScope {
	const safeRoles = Array.isArray(roles) ? roles : [];

	// 1. Cek tingkat Pusat (Superadmin / Pengurus Pusat)
	const hasPusat = safeRoles.some(
		(r) => r.tingkatScope === 'Pusat' || r.namaDapukan === 'Superadmin'
	);
	if (hasPusat) {
		return {
			level: 'Pusat',
			isPusat: true,
			daerahIds: [],
			desaIds: [],
			kelompokIds: []
		};
	}

	// 2. Cek tingkat Daerah
	const daerahRoles = safeRoles.filter((r) => r.tingkatScope === 'Daerah' && r.daerahId !== null);
	if (daerahRoles.length > 0) {
		const daerahIds = Array.from(new Set(daerahRoles.map((r) => r.daerahId as number)));
		return {
			level: 'Daerah',
			isPusat: false,
			daerahIds,
			desaIds: [],
			kelompokIds: []
		};
	}

	// 3. Cek tingkat Desa
	const desaRoles = safeRoles.filter((r) => r.tingkatScope === 'Desa' && r.desaId !== null);
	if (desaRoles.length > 0) {
		const desaIds = Array.from(new Set(desaRoles.map((r) => r.desaId as number)));
		return {
			level: 'Desa',
			isPusat: false,
			daerahIds: [],
			desaIds,
			kelompokIds: []
		};
	}

	// 4. Cek tingkat Kelompok
	const kelompokRoles = safeRoles.filter((r) => r.tingkatScope === 'Kelompok' && r.kelompokId !== null);
	const kelompokIds = Array.from(new Set(kelompokRoles.map((r) => r.kelompokId as number)));
	return {
		level: 'Kelompok',
		isPusat: false,
		daerahIds: [],
		desaIds: [],
		kelompokIds
	};
}

/**
 * Menghasilkan daftar wilayah (daerah, desa, kelompok) yang boleh diakses/dilihat sesuai scope admin
 */
export function getAccessibleWilayah(scope: AdminScope): AccessibleWilayah {
	// Ambil semua master data wilayah sekali untuk efisiensi
	const allDaerah = db.select().from(daerah).all();
	const allDesa = db.select().from(desa).all();
	const allKelompok = db.select().from(kelompok).all();

	const daerahMap = new Map(allDaerah.map((d) => [d.id, d]));
	const desaMap = new Map(allDesa.map((d) => [d.id, d]));

	if (scope.isPusat) {
		const enrichedDesa = allDesa.map((d) => ({
			...d,
			daerahNama: daerahMap.get(d.daerahId)?.nama || ''
		}));
		const enrichedKelompok = allKelompok.map((k) => {
			const parentDesa = desaMap.get(k.desaId);
			return {
				...k,
				desaNama: parentDesa?.nama || '',
				daerahNama: parentDesa ? daerahMap.get(parentDesa.daerahId)?.nama || '' : '',
				daerahId: parentDesa?.daerahId
			};
		});

		return {
			daerahList: allDaerah,
			desaList: enrichedDesa,
			kelompokList: enrichedKelompok,
			allowedKelompokIdSet: new Set(allKelompok.map((k) => k.id))
		};
	}

	if (scope.level === 'Daerah') {
		const filteredDaerah = allDaerah.filter((d) => scope.daerahIds.includes(d.id));
		const filteredDesa = allDesa
			.filter((d) => scope.daerahIds.includes(d.daerahId))
			.map((d) => ({
				...d,
				daerahNama: daerahMap.get(d.daerahId)?.nama || ''
			}));
		const allowedDesaIdSet = new Set(filteredDesa.map((d) => d.id));

		const filteredKelompok = allKelompok
			.filter((k) => allowedDesaIdSet.has(k.desaId))
			.map((k) => {
				const parentDesa = desaMap.get(k.desaId);
				return {
					...k,
					desaNama: parentDesa?.nama || '',
					daerahNama: parentDesa ? daerahMap.get(parentDesa.daerahId)?.nama || '' : '',
					daerahId: parentDesa?.daerahId
				};
			});

		return {
			daerahList: filteredDaerah,
			desaList: filteredDesa,
			kelompokList: filteredKelompok,
			allowedKelompokIdSet: new Set(filteredKelompok.map((k) => k.id))
		};
	}

	if (scope.level === 'Desa') {
		const filteredDesa = allDesa
			.filter((d) => scope.desaIds.includes(d.id))
			.map((d) => ({
				...d,
				daerahNama: daerahMap.get(d.daerahId)?.nama || ''
			}));

		const relevantDaerahIds = new Set(filteredDesa.map((d) => d.daerahId));
		const filteredDaerah = allDaerah.filter((d) => relevantDaerahIds.has(d.id));
		const allowedDesaIdSet = new Set(filteredDesa.map((d) => d.id));

		const filteredKelompok = allKelompok
			.filter((k) => allowedDesaIdSet.has(k.desaId))
			.map((k) => {
				const parentDesa = desaMap.get(k.desaId);
				return {
					...k,
					desaNama: parentDesa?.nama || '',
					daerahNama: parentDesa ? daerahMap.get(parentDesa.daerahId)?.nama || '' : '',
					daerahId: parentDesa?.daerahId
				};
			});

		return {
			daerahList: filteredDaerah,
			desaList: filteredDesa,
			kelompokList: filteredKelompok,
			allowedKelompokIdSet: new Set(filteredKelompok.map((k) => k.id))
		};
	}

	// Scope Kelompok
	const filteredKelompok = allKelompok
		.filter((k) => scope.kelompokIds.includes(k.id))
		.map((k) => {
			const parentDesa = desaMap.get(k.desaId);
			return {
				...k,
				desaNama: parentDesa?.nama || '',
				daerahNama: parentDesa ? daerahMap.get(parentDesa.daerahId)?.nama || '' : '',
				daerahId: parentDesa?.daerahId
			};
		});

	const relevantDesaIds = new Set(filteredKelompok.map((k) => k.desaId));
	const filteredDesa = allDesa
		.filter((d) => relevantDesaIds.has(d.id))
		.map((d) => ({
			...d,
			daerahNama: daerahMap.get(d.daerahId)?.nama || ''
		}));

	const relevantDaerahIds = new Set(filteredDesa.map((d) => d.daerahId));
	const filteredDaerah = allDaerah.filter((d) => relevantDaerahIds.has(d.id));

	return {
		daerahList: filteredDaerah,
		desaList: filteredDesa,
		kelompokList: filteredKelompok,
		allowedKelompokIdSet: new Set(filteredKelompok.map((k) => k.id))
	};
}

/**
 * Validasi apakah kelompokId tertentu berada di bawah wewenang admin
 */
export function isKelompokAllowed(
	kelompokId: number,
	allowedKelompokIdSet: Set<number>,
	isPusat: boolean
): boolean {
	if (isPusat) return true;
	return allowedKelompokIdSet.has(kelompokId);
}

/**
 * Memeriksa apakah admin memiliki wewenang untuk menambahkan atau mengelola penugasan dapukan
 * Aturan wewenang:
 * - Admin Pusat, Daerah, Desa: berwenang mengelola dapukan sesuai tingkat cakupannya.
 * - Admin Kelompok: HANYA pengurus 4S dengan dapukan Kyai atau Sekretaris/Penerobos yang dapat menambahkan/mengelola pengurus. 4S lain (KU/Bendahara, Mubaligh/Ulama, Aghnia) tidak diizinkan.
 */
export function canManageDapukan(roles: App.UserRole[]): boolean {
	const adminScope = getAdminScope(roles);

	// Pusat, Daerah, dan Desa memiliki hak penugasan pengurus pada lingkup masing-masing
	if (adminScope.isPusat || adminScope.level === 'Daerah' || adminScope.level === 'Desa') {
		return true;
	}

	// Pada tingkat Kelompok: hanya 4S dengan dapukan Kyai atau Sekretaris/Penerobos
	if (adminScope.level === 'Kelompok') {
		return roles.some((r) => {
			if (r.tingkatScope !== 'Kelompok' || !r.is4S) return false;
			const nama = (r.namaDapukan || r.namaDapukanCustom || '').trim().toLowerCase();
			return (
				nama.includes('kyai') ||
				nama.includes('ketua') ||
				nama.includes('sekretaris') ||
				nama.includes('penerobos')
			);
		});
	}

	return false;
}

/**
 * Memeriksa apakah user berwenang melakukan CRUD pada rekening & QRIS shodaqoh wilayah
 * - Superadmin / Pusat: Selalu berwenang CRUD di semua wilayah.
 * - KU / Bendahara: Berwenang CRUD jika berada pada scope wilayah terkait (atau tingkat di atasnya).
 * - Peran 4S lainnya (Kyai, Sekretaris, dll) & admin lain: Hanya dapat melihat (Read-Only).
 */
export function canManageRekening(
	roles: App.UserRole[],
	scopeLevel?: 'Pusat' | 'Daerah' | 'Desa' | 'Kelompok',
	targetId?: number
): boolean {
	const adminScope = getAdminScope(roles);
	if (adminScope.isPusat) return true;

	return roles.some((r) => {
		const dapukanNama = (r.namaDapukan || r.namaDapukanCustom || '').toLowerCase();
		const isAuthorized =
			dapukanNama.includes('ku') ||
			dapukanNama.includes('bendahara') ||
			dapukanNama.includes('keuangan');
		if (!isAuthorized) return false;

		// Jika tidak ada target spesifik, cukup pastikan user memiliki peran KU
		if (!scopeLevel || !targetId) return true;

		// Jika target adalah Kelompok
		if (scopeLevel === 'Kelompok') {
			if (r.tingkatScope === 'Kelompok' && r.kelompokId === targetId) return true;
			if (r.tingkatScope === 'Desa' && r.desaId) {
				const k = db
					.select({ desaId: kelompok.desaId })
					.from(kelompok)
					.where(eq(kelompok.id, targetId))
					.get();
				if (k && k.desaId === r.desaId) return true;
			}
			if (r.tingkatScope === 'Daerah' && r.daerahId) {
				const k = db
					.select({ desaId: kelompok.desaId })
					.from(kelompok)
					.where(eq(kelompok.id, targetId))
					.get();
				if (k && k.desaId) {
					const d = db
						.select({ daerahId: desa.daerahId })
						.from(desa)
						.where(eq(desa.id, k.desaId))
						.get();
					if (d && d.daerahId === r.daerahId) return true;
				}
			}
		}

		// Jika target adalah Desa
		if (scopeLevel === 'Desa') {
			if (r.tingkatScope === 'Desa' && r.desaId === targetId) return true;
			if (r.tingkatScope === 'Daerah' && r.daerahId) {
				const d = db
					.select({ daerahId: desa.daerahId })
					.from(desa)
					.where(eq(desa.id, targetId))
					.get();
				if (d && d.daerahId === r.daerahId) return true;
			}
		}

		// Jika target adalah Daerah
		if (scopeLevel === 'Daerah') {
			if (r.tingkatScope === 'Daerah' && r.daerahId === targetId) return true;
		}

		return false;
	});
}

/**
 * Memeriksa apakah user berwenang melihat grup menu & modul Keuangan/KU
 * - Kyai, KU/Bendahara, Aghnia: Berwenang
 * - Superadmin / Tingkat Pusat: Selalu berwenang
 * - Peran lain: Tidak berwenang
 */
export function canAccessKeuangan(roles: App.UserRole[]): boolean {
	const adminScope = getAdminScope(roles);
	if (adminScope.isPusat) return true;

	return roles.some((r) => {
		const dapukanNama = (r.namaDapukan || r.namaDapukanCustom || '').toLowerCase();
		return (
			dapukanNama.includes('kyai') ||
			dapukanNama.includes('ketua') ||
			dapukanNama.includes('ku') ||
			dapukanNama.includes('bendahara') ||
			dapukanNama.includes('keuangan') ||
			dapukanNama.includes('aghnia') ||
			dapukanNama.includes('agniya')
		);
	});
}

/**
 * Memeriksa apakah user berwenang mengedit/menyimpan angka setoran FR Jamaah
 * - Superadmin / Pusat: Selalu berwenang
 * - KU / Bendahara: Berwenang jika berada pada scope wilayah terkait (atau tingkat di atasnya)
 * - Kyai & Aghnia: Read-Only (Hanya melihat)
 */
export function canManageFr(
	roles: App.UserRole[],
	scopeLevel?: 'Pusat' | 'Daerah' | 'Desa' | 'Kelompok',
	targetId?: number
): boolean {
	return canManageRekening(roles, scopeLevel, targetId);
}

/**
 * Memeriksa apakah user berwenang mengubah konfigurasi shodaqoh (detail rekening, QRIS, jenis shodaqoh, dan approval transaksi)
 * - Khusus KU dan Kyai (serta Superadmin / Tingkat Pusat)
 * - Admin selain itu tidak bisa (Read-Only)
 */
export function canManageShodaqoh(
	roles: App.UserRole[],
	scopeLevel?: 'Pusat' | 'Daerah' | 'Desa' | 'Kelompok',
	targetId?: number
): boolean {
	const adminScope = getAdminScope(roles);
	if (adminScope.isPusat) return true;

	return roles.some((r) => {
		const dapukanNama = (r.namaDapukan || r.namaDapukanCustom || '').toLowerCase();
		const isAuthorizedRole =
			dapukanNama.includes('kyai') ||
			dapukanNama.includes('ketua') ||
			dapukanNama.includes('ku') ||
			dapukanNama.includes('bendahara') ||
			dapukanNama.includes('keuangan');
		if (!isAuthorizedRole) return false;

		// Jika tidak ada target spesifik, cukup pastikan peran KU atau Kyai
		if (!scopeLevel || !targetId) return true;

		// Jika target adalah Kelompok
		if (scopeLevel === 'Kelompok') {
			if (r.tingkatScope === 'Kelompok' && r.kelompokId === targetId) return true;
			if (r.tingkatScope === 'Desa' && r.desaId) {
				const k = db
					.select({ desaId: kelompok.desaId })
					.from(kelompok)
					.where(eq(kelompok.id, targetId))
					.get();
				if (k && k.desaId === r.desaId) return true;
			}
			if (r.tingkatScope === 'Daerah' && r.daerahId) {
				const k = db
					.select({ desaId: kelompok.desaId })
					.from(kelompok)
					.where(eq(kelompok.id, targetId))
					.get();
				if (k && k.desaId) {
					const d = db
						.select({ daerahId: desa.daerahId })
						.from(desa)
						.where(eq(desa.id, k.desaId))
						.get();
					if (d && d.daerahId === r.daerahId) return true;
				}
			}
		}

		// Jika target adalah Desa
		if (scopeLevel === 'Desa') {
			if (r.tingkatScope === 'Desa' && r.desaId === targetId) return true;
			if (r.tingkatScope === 'Daerah' && r.daerahId) {
				const d = db
					.select({ daerahId: desa.daerahId })
					.from(desa)
					.where(eq(desa.id, targetId))
					.get();
				if (d && d.daerahId === r.daerahId) return true;
			}
		}

		// Jika target adalah Daerah
		if (scopeLevel === 'Daerah') {
			if (r.tingkatScope === 'Daerah' && r.daerahId === targetId) return true;
		}

		return false;
	});
}



