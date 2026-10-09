/**
 * @file src/lib/server/scope.ts
 * @purpose Evaluasi wewenang administratif berjenjang (Pusat, Daerah, Desa, Kelompok) dan filter wilayah RBAC
 * @usedBy src/routes/(admin)/admin/sensus/+page.server.ts, rute admin lainnya yang memerlukan validasi scope
 * @dependencies src/lib/db, src/lib/db/schema, drizzle-orm
 * @publicFunctions getAdminScope, getAccessibleWilayah, isKelompokAllowed
 * @sideEffects Membaca data relasi master daerah, desa, dan kelompok dari SQLite
 */

import { db } from '$lib/db';
import { daerah, desa, kelompok } from '$lib/db/schema';
import { inArray } from 'drizzle-orm';

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
export function getAdminScope(roles: App.UserRole[]): AdminScope {
	// 1. Cek tingkat Pusat (Superadmin / Pengurus Pusat)
	const hasPusat = roles.some(
		(r) => r.tingkatScope === 'Pusat' || r.namaDapukan === 'Superadmin'
	);
	if (hasPusat || roles.length === 0) {
		return {
			level: 'Pusat',
			isPusat: true,
			daerahIds: [],
			desaIds: [],
			kelompokIds: []
		};
	}

	// 2. Cek tingkat Daerah
	const daerahRoles = roles.filter((r) => r.tingkatScope === 'Daerah' && r.daerahId !== null);
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
	const desaRoles = roles.filter((r) => r.tingkatScope === 'Desa' && r.desaId !== null);
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
	const kelompokRoles = roles.filter((r) => r.tingkatScope === 'Kelompok' && r.kelompokId !== null);
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
