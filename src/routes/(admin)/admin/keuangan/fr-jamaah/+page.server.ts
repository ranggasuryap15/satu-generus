/**
 * @file src/routes/(admin)/admin/keuangan/fr-jamaah/+page.server.ts
 * @purpose Backend controller halaman FR Jamaah: memuat daftar jamaah wajib isrun per kelompok terpilih dan menangani batch upsert setoran bulanan shodaqoh FR khusus KU & Superadmin
 * @usedBy src/routes/(admin)/admin/keuangan/fr-jamaah/+page.svelte
 * @dependencies @sveltejs/kit, src/lib/db, src/lib/db/schema, src/lib/server/scope, drizzle-orm, @paralleldrive/cuid2
 * @publicFunctions load, actions.saveFr
 * @sideEffects DB read pada anggota_keluarga, keluarga, users, kelompok, dan transaksi_fr; atomic batch upsert write pada transaksi_fr
 */

import { fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { db, sqlite } from '$lib/db';
import { anggotaKeluarga, keluarga, users, kelompok, desa, transaksiFr } from '$lib/db/schema';
import { eq, and, asc } from 'drizzle-orm';
import { getAdminScope, getAccessibleWilayah, canAccessKeuangan, canManageFr } from '$lib/server/scope';
import { createId } from '@paralleldrive/cuid2';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user || !locals.isAdmin) {
		throw redirect(303, '/login');
	}

	const roles = locals.roles || [];
	// Hanya Kyai, KU, Aghnia, atau Superadmin yang berhak mengakses
	if (!canAccessKeuangan(roles)) {
		throw redirect(303, '/admin');
	}

	const adminScope = getAdminScope(roles);
	const accessibleWilayah = getAccessibleWilayah(adminScope);

	// Parameter Periode & Kelompok
	const currentYear = new Date().getFullYear();
	const currentMonth = new Date().getMonth() + 1;

	const tahunParam = Number(url.searchParams.get('tahun')) || currentYear;
	const bulanParam = Number(url.searchParams.get('bulan')) || currentMonth;
	const urlKelompokId = url.searchParams.get('kelompokId');

	// Default kelompok: jika admin scope Kelompok, langsung kunci ke kelompoknya.
	// Jika admin selain Kelompok (Pusat, Daerah, Desa), default null jika tidak dipilih.
	let selectedKelompokId: number | null = null;
	if (urlKelompokId) {
		const parsed = Number(urlKelompokId);
		if (adminScope.isPusat || accessibleWilayah.allowedKelompokIdSet.has(parsed)) {
			selectedKelompokId = parsed;
		}
	} else if (adminScope.level === 'Kelompok' && adminScope.kelompokIds.length > 0) {
		selectedKelompokId = adminScope.kelompokIds[0];
	}

	// Otoritas edit: Hanya KU pada scope kelompok terkait atau Superadmin
	const canEdit = selectedKelompokId
		? canManageFr(roles, 'Kelompok', selectedKelompokId)
		: false;

	let jamaahList: Array<{
		id: string;
		namaLengkap: string;
		jenisKelamin: string;
		statusGenerus: string | null;
		statusHubungan: string;
		profesi: string | null;
		noTelepon: string | null;
		keluargaId: string;
		kepalaKeluargaNama: string | null;
		transaksiId: string | null;
		nominal: number;
		statusBayar: string;
		catatan: string;
		updatedAt: number | null;
	}> = [];

	let selectedKelompokNama = '';
	let desaId: number | null = null;
	let daerahId: number | null = null;

	if (selectedKelompokId) {
		const kRow = db
			.select({
				id: kelompok.id,
				nama: kelompok.nama,
				desaId: kelompok.desaId,
				daerahId: desa.daerahId
			})
			.from(kelompok)
			.leftJoin(desa, eq(kelompok.desaId, desa.id))
			.where(eq(kelompok.id, selectedKelompokId))
			.get();

		if (kRow) {
			selectedKelompokNama = kRow.nama;
			desaId = kRow.desaId;
			daerahId = kRow.daerahId;

			// 1. Query anggota keluarga wajib isrun di kelompok ini
			const rawJamaah = db
				.select({
					id: anggotaKeluarga.id,
					namaLengkap: anggotaKeluarga.namaLengkap,
					jenisKelamin: anggotaKeluarga.jenisKelamin,
					statusGenerus: anggotaKeluarga.statusGenerus,
					statusHubungan: anggotaKeluarga.statusHubungan,
					profesi: anggotaKeluarga.profesi,
					noTelepon: anggotaKeluarga.noTelepon,
					keluargaId: anggotaKeluarga.keluargaId,
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

			// 2. Query transaksi FR yang sudah tercatat pada periode ini
			const rawFr = db
				.select()
				.from(transaksiFr)
				.where(
					and(
						eq(transaksiFr.kelompokId, selectedKelompokId),
						eq(transaksiFr.tahun, tahunParam),
						eq(transaksiFr.bulan, bulanParam)
					)
				)
				.all();

			const frMap = new Map<string, typeof rawFr[number]>();
			for (const f of rawFr) {
				frMap.set(f.anggotaKeluargaId, f);
			}

			// 3. Gabungkan data jamaah dengan transaksi periode aktif
			jamaahList = rawJamaah.map((j) => {
				const existing = frMap.get(j.id);
				return {
					id: j.id,
					namaLengkap: j.namaLengkap || 'Tanpa Nama',
					jenisKelamin: j.jenisKelamin,
					statusGenerus: j.statusGenerus,
					statusHubungan: j.statusHubungan,
					profesi: j.profesi,
					noTelepon: j.noTelepon,
					keluargaId: j.keluargaId,
					kepalaKeluargaNama: j.kepalaKeluargaNama,
					transaksiId: existing?.id || null,
					nominal: existing?.nominal ?? 0,
					statusBayar: existing?.statusBayar ?? (existing?.nominal ? 'Lunas' : 'Belum'),
					catatan: existing?.catatan ?? '',
					updatedAt: existing?.updatedAt ?? null
				};
			});
		}
	}

	const isFinanceAdmin = adminScope.isPusat || roles.some((r) => {
		const nama = (r.namaDapukan || r.namaDapukanCustom || '').toLowerCase();
		return nama.includes('ku') || nama.includes('bendahara') || nama.includes('keuangan');
	});

	return {
		adminScope,
		accessibleWilayah,
		selectedKelompokId,
		selectedKelompokNama,
		desaId,
		daerahId,
		tahun: tahunParam,
		bulan: bulanParam,
		canEdit,
		isFinanceAdmin,
		jamaahList
	};
};

export const actions: Actions = {
	/**
	 * Menyimpan / memperbarui angka FR jamaah secara batch (Khusus KU / Superadmin)
	 */
	saveFr: async ({ request, locals }) => {
		if (!locals.user || !locals.isAdmin) {
			return fail(401, { error: 'Sesi kedaluwarsa. Silakan login kembali.' });
		}

		const formData = await request.formData();
		const kelompokId = Number(formData.get('kelompokId') || 0);
		const tahun = Number(formData.get('tahun') || 0);
		const bulan = Number(formData.get('bulan') || 0);
		const desaId = formData.get('desaId') ? Number(formData.get('desaId')) : null;
		const daerahId = formData.get('daerahId') ? Number(formData.get('daerahId')) : null;
		const rawPayload = String(formData.get('itemsJson') || '[]');

		if (!kelompokId || !tahun || !bulan) {
			return fail(400, { error: 'Parameter kelompok, tahun, dan bulan wajib disertakan.' });
		}

		const canEdit = canManageFr(locals.roles || [], 'Kelompok', kelompokId);
		if (!canEdit) {
			return fail(403, {
				error: 'Akses ditolak: Hanya pengurus KU/Bendahara atau Superadmin yang berwenang mengisi atau mengubah FR Jamaah.'
			});
		}

		let items: Array<{
			anggotaId: string;
			nominal: number;
			statusBayar?: string;
			catatan?: string;
		}> = [];

		try {
			items = JSON.parse(rawPayload);
		} catch {
			return fail(400, { error: 'Format data perubahan FR tidak valid.' });
		}

		if (!Array.isArray(items) || items.length === 0) {
			return { success: true, message: 'Tidak ada perubahan yang disimpan.' };
		}

		// Validasi dan ambil relasi desa & daerah langsung dari database kelompok demi integritas foreign key
		const kRow = db
			.select({
				id: kelompok.id,
				desaId: kelompok.desaId,
				daerahId: desa.daerahId
			})
			.from(kelompok)
			.leftJoin(desa, eq(kelompok.desaId, desa.id))
			.where(eq(kelompok.id, kelompokId))
			.get();

		const safeDesaId = kRow?.desaId || null;
		const safeDaerahId = kRow?.daerahId || null;

		const now = Math.floor(Date.now() / 1000);
		const userId = locals.user.id;

		// Prepared statement batch upsert (minimum I/O, atomic transaction)
		const upsertStmt = sqlite.prepare(`
			INSERT INTO transaksi_fr (
				id,
				anggota_keluarga_id,
				kelompok_id,
				desa_id,
				daerah_id,
				tahun,
				bulan,
				nominal,
				status_bayar,
				catatan,
				updated_by_user_id,
				created_at,
				updated_at
			) VALUES (
				?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
			)
			ON CONFLICT(anggota_keluarga_id, tahun, bulan) DO UPDATE SET
				nominal = excluded.nominal,
				status_bayar = excluded.status_bayar,
				catatan = excluded.catatan,
				updated_by_user_id = excluded.updated_by_user_id,
				updated_at = excluded.updated_at
		`);

		const runBatch = sqlite.transaction((rows) => {
			for (const r of rows) {
				const safeNominal = Math.max(0, Math.floor(Number(r.nominal) || 0));
				const status = r.statusBayar || (safeNominal > 0 ? 'Lunas' : 'Belum');
				const catatan = r.catatan ? String(r.catatan).trim() : null;

				upsertStmt.run(
					createId(),
					r.anggotaId,
					kelompokId,
					safeDesaId,
					safeDaerahId,
					tahun,
					bulan,
					safeNominal,
					status,
					catatan,
					userId,
					now,
					now
				);
			}
		});

		try {
			runBatch(items);
		} catch (err: any) {
			console.error('[FR Save Error]:', err);
			return fail(500, { error: `Gagal menyimpan data FR: ${err?.message || 'Database error'}` });
		}

		return {
			success: true,
			message: `Berhasil menyimpan data FR untuk ${items.length} jamaah.`
		};
	}
};

