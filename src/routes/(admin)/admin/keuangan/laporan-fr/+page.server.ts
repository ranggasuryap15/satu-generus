/**
 * @file src/routes/(admin)/admin/keuangan/laporan-fr/+page.server.ts
 * @purpose Backend controller halaman Laporan FR: menyajikan rekapitulasi real-time shodaqoh FR berjenjang sesuai scope admin (Kelompok, Desa, Daerah, Pusat) dengan link navigasi langsung ke FR Jamaah
 * @usedBy src/routes/(admin)/admin/keuangan/laporan-fr/+page.svelte
 * @dependencies @sveltejs/kit, src/lib/db, src/lib/db/schema, src/lib/server/scope, drizzle-orm
 * @publicFunctions load
 * @sideEffects DB read agregat pada tabel kelompok, desa, daerah, anggota_keluarga, keluarga, users, dan transaksi_fr (minimum I/O, no N+1)
 */

import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db, first } from '#lib/db/index.js';
import { kelompok, desa, daerah, anggotaKeluarga, keluarga, users, transaksiFr } from '#lib/db/schema.js';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { getAdminScope, getAccessibleWilayah, canAccessKeuangan } from '#lib/server/scope.js';

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
	const currentMonth = new Date().getMonth() + 1;

	const tahunParam = Number(url.searchParams.get('tahun')) || currentYear;
	const bulanParam = Number(url.searchParams.get('bulan')) || currentMonth;

	// Filter Khusus Multi-Wilayah (Daerah & Pusat)
	const filterDaerahId = url.searchParams.get('daerahId') ? Number(url.searchParams.get('daerahId')) : null;
	const filterDesaId = url.searchParams.get('desaId') ? Number(url.searchParams.get('desaId')) : null;

	// 1. SCOPE KELOMPOK: Rekapitulasi Riwayat 12 Bulan untuk Kelompoknya
	if (adminScope.level === 'Kelompok' && adminScope.kelompokIds.length > 0) {
		const myKelompokId = adminScope.kelompokIds[0];
		const myKelompok = (await first(db.select().from(kelompok).where(eq(kelompok.id, myKelompokId))));

		// Hitung jumlah jamaah wajib isrun di kelompok ini
		const [wajibCountRes] = (await db
			.select({ count: sql<number>`count(distinct ${anggotaKeluarga.id})` })
			.from(anggotaKeluarga)
			.innerJoin(keluarga, eq(anggotaKeluarga.keluargaId, keluarga.id))
			.innerJoin(users, eq(keluarga.kepalaKeluargaId, users.id))
			.where(
				and(
					eq(users.kelompokId, myKelompokId),
					eq(anggotaKeluarga.isrun, 'Ya'),
					eq(anggotaKeluarga.statusJamaah, 'Aktif')
				)
			)
);
		const totalWajib = wajibCountRes?.count ?? 0;

		// Ambil transaksi 12 bulan dalam tahun terpilih
		const monthlyRaw = (await db
			.select({
				bulan: transaksiFr.bulan,
				totalNominal: sql<number>`sum(${transaksiFr.nominal})`,
				setorCount: sql<number>`count(case when ${transaksiFr.nominal} > 0 then 1 end)`
			})
			.from(transaksiFr)
			.where(
				and(
					eq(transaksiFr.kelompokId, myKelompokId),
					eq(transaksiFr.tahun, tahunParam)
				)
			)
			.groupBy(transaksiFr.bulan)
);
		const monthlyMap = new Map(monthlyRaw.map((m) => [m.bulan, m]));
		const bulananList = Array.from({ length: 12 }, (_, i) => {
			const b = i + 1;
			const m = monthlyMap.get(b);
			return {
				bulan: b,
				totalWajib,
				setorCount: m?.setorCount ?? 0,
				totalNominal: m?.totalNominal ?? 0
			};
		});

		return {
			scopeLevel: 'Kelompok' as const,
			adminScope,
			accessibleWilayah,
			tahun: tahunParam,
			bulan: bulanParam,
			kelompokInfo: myKelompok,
			bulananList
		};
	}

	// 2. SCOPE DESA / DAERAH / PUSAT: Rekapitulasi Berjenjang Daftar Kelompok / Desa
	let activeDesaId: number | null = null;
	if (adminScope.level === 'Desa' && adminScope.desaIds.length > 0) {
		activeDesaId = adminScope.desaIds[0];
	} else if (filterDesaId) {
		activeDesaId = filterDesaId;
	}

	let targetKelompokList: Array<{
		id: number;
		nama: string;
		desaId: number;
		desaNama?: string;
		totalWajib: number;
		setorCount: number;
		totalNominal: number;
	}> = [];

	let desaRekapList: Array<{
		id: number;
		nama: string;
		daerahNama?: string;
		kelompokCount: number;
		totalWajib: number;
		totalNominal: number;
	}> = [];

	if (activeDesaId) {
		// Tampilkan seluruh kelompok di desa aktif
		const rawKelompoks = (await db
			.select({
				id: kelompok.id,
				nama: kelompok.nama,
				desaId: kelompok.desaId,
				desaNama: desa.nama
			})
			.from(kelompok)
			.innerJoin(desa, eq(kelompok.desaId, desa.id))
			.where(eq(kelompok.desaId, activeDesaId))
);
		const kelompokIds = rawKelompoks.map((k) => k.id);

		if (kelompokIds.length > 0) {
			// Query total wajib isrun per kelompok
			const wajibPerKelompok = (await db
				.select({
					kelompokId: users.kelompokId,
					wajibCount: sql<number>`count(distinct ${anggotaKeluarga.id})`
				})
				.from(anggotaKeluarga)
				.innerJoin(keluarga, eq(anggotaKeluarga.keluargaId, keluarga.id))
				.innerJoin(users, eq(keluarga.kepalaKeluargaId, users.id))
				.where(
					and(
						inArray(users.kelompokId, kelompokIds),
						eq(anggotaKeluarga.isrun, 'Ya'),
						eq(anggotaKeluarga.statusJamaah, 'Aktif')
					)
				)
				.groupBy(users.kelompokId)
);
			const wajibMap = new Map(wajibPerKelompok.map((w) => [w.kelompokId, w.wajibCount]));

			// Query transaksi FR per kelompok pada tahun & bulan terpilih
			const frPerKelompok = (await db
				.select({
					kelompokId: transaksiFr.kelompokId,
					totalNominal: sql<number>`sum(${transaksiFr.nominal})`,
					setorCount: sql<number>`count(case when ${transaksiFr.nominal} > 0 then 1 end)`
				})
				.from(transaksiFr)
				.where(
					and(
						inArray(transaksiFr.kelompokId, kelompokIds),
						eq(transaksiFr.tahun, tahunParam),
						eq(transaksiFr.bulan, bulanParam)
					)
				)
				.groupBy(transaksiFr.kelompokId)
);
			const frMap = new Map(frPerKelompok.map((f) => [f.kelompokId, f]));

			targetKelompokList = rawKelompoks.map((k) => ({
				id: k.id,
				nama: k.nama,
				desaId: k.desaId,
				desaNama: k.desaNama,
				totalWajib: wajibMap.get(k.id) ?? 0,
				setorCount: frMap.get(k.id)?.setorCount ?? 0,
				totalNominal: frMap.get(k.id)?.totalNominal ?? 0
			}));
		}
	} else {
		// Tingkat Daerah / Pusat belum memilih desa: Tampilkan rekap per desa
		const accessibleDesas = filterDaerahId
			? accessibleWilayah.desaList.filter((d) => d.daerahId === filterDaerahId)
			: accessibleWilayah.desaList;

		const desaIds = accessibleDesas.map((d) => d.id);
		if (desaIds.length > 0) {
			const frPerDesa = (await db
				.select({
					desaId: transaksiFr.desaId,
					totalNominal: sql<number>`sum(${transaksiFr.nominal})`
				})
				.from(transaksiFr)
				.where(
					and(
						inArray(transaksiFr.desaId, desaIds),
						eq(transaksiFr.tahun, tahunParam),
						eq(transaksiFr.bulan, bulanParam)
					)
				)
				.groupBy(transaksiFr.desaId)
);
			const frDesaMap = new Map(frPerDesa.map((f) => [f.desaId, f.totalNominal]));

			desaRekapList = accessibleDesas.map((d) => {
				const kelompokInDesa = accessibleWilayah.kelompokList.filter((k) => k.desaId === d.id);
				return {
					id: d.id,
					nama: d.nama,
					daerahNama: d.daerahNama,
					kelompokCount: kelompokInDesa.length,
					totalWajib: 0,
					totalNominal: frDesaMap.get(d.id) ?? 0
				};
			});
		}
	}

	return {
		scopeLevel: (adminScope.level === 'Desa' ? 'Desa' : 'Daerah') as 'Desa' | 'Daerah',
		adminScope,
		accessibleWilayah,
		tahun: tahunParam,
		bulan: bulanParam,
		filterDaerahId,
		filterDesaId: activeDesaId,
		targetKelompokList,
		desaRekapList
	};
};

