/**
 * @file src/routes/(admin)/admin/keuangan/+page.server.ts
 * @purpose Backend controller Dashboard Keuangan: mengolah agregasi KPI, data tren fluktuasi bulanan 12 bulan, dan perbandingan antar kelompok/desa sesuai scope wewenang admin (Kyai, KU, Aghnia, Superadmin)
 * @usedBy src/routes/(admin)/admin/keuangan/+page.svelte
 * @dependencies @sveltejs/kit, src/lib/db, src/lib/db/schema, src/lib/server/scope, drizzle-orm
 * @publicFunctions load
 * @sideEffects DB read agregat pada tabel transaksi_fr, kelompok, desa, daerah, dan anggota_keluarga (index-optimized)
 */

import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/db';
import { kelompok, desa, daerah, anggotaKeluarga, keluarga, users, transaksiFr } from '$lib/db/schema';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { getAdminScope, getAccessibleWilayah, canAccessKeuangan } from '$lib/server/scope';

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
	const currentMonth = new Date().getMonth() + 1;

	const tahunParam = Number(url.searchParams.get('tahun')) || currentYear;
	const bulanParam = Number(url.searchParams.get('bulan')) || currentMonth;

	const filterDaerahId = url.searchParams.get('daerahId') ? Number(url.searchParams.get('daerahId')) : null;
	const filterDesaId = url.searchParams.get('desaId') ? Number(url.searchParams.get('desaId')) : null;
	const filterKelompokId = url.searchParams.get('kelompokId') ? Number(url.searchParams.get('kelompokId')) : null;

	// Tentukan scope target wilayah
	let targetKelompokIds: number[] = [];

	if (filterKelompokId) {
		targetKelompokIds = [filterKelompokId];
	} else if (adminScope.level === 'Kelompok' && adminScope.kelompokIds.length > 0) {
		targetKelompokIds = adminScope.kelompokIds;
	} else if (filterDesaId || (adminScope.level === 'Desa' && adminScope.desaIds.length > 0)) {
		const targetDesa = filterDesaId || adminScope.desaIds[0];
		targetKelompokIds = accessibleWilayah.kelompokList
			.filter((k) => k.desaId === targetDesa)
			.map((k) => k.id);
	} else if (filterDaerahId || (adminScope.level === 'Daerah' && adminScope.daerahIds.length > 0)) {
		const targetDaerah = filterDaerahId || adminScope.daerahIds[0];
		targetKelompokIds = accessibleWilayah.kelompokList
			.filter((k) => k.daerahId === targetDaerah)
			.map((k) => k.id);
	} else {
		// Pusat / Superadmin tanpa filter
		targetKelompokIds = accessibleWilayah.kelompokList.map((k) => k.id);
	}

	// 1. KPI Metrik Ringkasan
	let totalBulanIni = 0;
	let totalTahunIni = 0;
	let totalWajibIsrun = 0;
	let totalSudahSetorBulanIni = 0;

	if (targetKelompokIds.length > 0) {
		// Total bulan ini
		const [blnRes] = db
			.select({
				total: sql<number>`coalesce(sum(${transaksiFr.nominal}), 0)`,
				count: sql<number>`count(case when ${transaksiFr.nominal} > 0 then 1 end)`
			})
			.from(transaksiFr)
			.where(
				and(
					inArray(transaksiFr.kelompokId, targetKelompokIds),
					eq(transaksiFr.tahun, tahunParam),
					eq(transaksiFr.bulan, bulanParam)
				)
			)
			.all();

		totalBulanIni = blnRes?.total ?? 0;
		totalSudahSetorBulanIni = blnRes?.count ?? 0;

		// Total tahun ini
		const [thnRes] = db
			.select({
				total: sql<number>`coalesce(sum(${transaksiFr.nominal}), 0)`
			})
			.from(transaksiFr)
			.where(
				and(
					inArray(transaksiFr.kelompokId, targetKelompokIds),
					eq(transaksiFr.tahun, tahunParam)
				)
			)
			.all();

		totalTahunIni = thnRes?.total ?? 0;

		// Total jamaah wajib isrun
		const [wajibRes] = db
			.select({
				count: sql<number>`count(distinct ${anggotaKeluarga.id})`
			})
			.from(anggotaKeluarga)
			.innerJoin(keluarga, eq(anggotaKeluarga.keluargaId, keluarga.id))
			.innerJoin(users, eq(keluarga.kepalaKeluargaId, users.id))
			.where(
				and(
					inArray(users.kelompokId, targetKelompokIds),
					eq(anggotaKeluarga.isrun, 'Ya'),
					eq(anggotaKeluarga.statusJamaah, 'Aktif')
				)
			)
			.all();

		totalWajibIsrun = wajibRes?.count ?? 0;
	}

	// 2. Data Tren 12 Bulan (Januari s.d. Desember)
	let trenBulanan: Array<{ bulan: number; nama: string; total: number }> = [];
	const namaBulanPendek = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

	if (targetKelompokIds.length > 0) {
		const rawTren = db
			.select({
				bulan: transaksiFr.bulan,
				total: sql<number>`coalesce(sum(${transaksiFr.nominal}), 0)`
			})
			.from(transaksiFr)
			.where(
				and(
					inArray(transaksiFr.kelompokId, targetKelompokIds),
					eq(transaksiFr.tahun, tahunParam)
				)
			)
			.groupBy(transaksiFr.bulan)
			.all();

		const trenMap = new Map(rawTren.map((t) => [t.bulan, t.total]));
		trenBulanan = Array.from({ length: 12 }, (_, i) => {
			const b = i + 1;
			return {
				bulan: b,
				nama: namaBulanPendek[i],
				total: trenMap.get(b) ?? 0
			};
		});
	}

	// 3. Data Komparasi Antar Kelompok (di bawah Desa terkait atau Daerah)
	let komparasiKelompok: Array<{
		id: number;
		nama: string;
		desaNama?: string;
		totalNominal: number;
	}> = [];

	if (targetKelompokIds.length > 1) {
		const rawKomp = db
			.select({
				kelompokId: transaksiFr.kelompokId,
				total: sql<number>`coalesce(sum(${transaksiFr.nominal}), 0)`
			})
			.from(transaksiFr)
			.where(
				and(
					inArray(transaksiFr.kelompokId, targetKelompokIds),
					eq(transaksiFr.tahun, tahunParam),
					eq(transaksiFr.bulan, bulanParam)
				)
			)
			.groupBy(transaksiFr.kelompokId)
			.all();

		const kompMap = new Map(rawKomp.map((k) => [k.kelompokId, k.total]));
		komparasiKelompok = accessibleWilayah.kelompokList
			.filter((k) => targetKelompokIds.includes(k.id))
			.map((k) => ({
				id: k.id,
				nama: k.nama,
				desaNama: k.desaNama,
				totalNominal: kompMap.get(k.id) ?? 0
			}))
			.sort((a, b) => b.totalNominal - a.totalNominal);
	}

	return {
		adminScope,
		accessibleWilayah,
		tahun: tahunParam,
		bulan: bulanParam,
		filterDaerahId,
		filterDesaId,
		filterKelompokId,
		kpi: {
			totalBulanIni,
			totalTahunIni,
			totalWajibIsrun,
			totalSudahSetorBulanIni,
			partisipasiPersen: totalWajibIsrun
				? Math.round((totalSudahSetorBulanIni / totalWajibIsrun) * 100)
				: 0
		},
		trenBulanan,
		komparasiKelompok
	};
};

