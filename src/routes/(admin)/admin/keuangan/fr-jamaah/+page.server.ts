/**
 * @file src/routes/(admin)/admin/keuangan/fr-jamaah/+page.server.ts
 * @purpose Backend controller halaman FR Jamaah: memuat daftar jamaah wajib isrun per kelompok terpilih beserta status peran, bukti transfer jamaah, rincian breakdown pos, hierarki pos anggaran infaq (Hak Pusat s/d Hak Kelompok), serta menangani batch upsert setoran, approval/reject setoran, dan input/edit setoran manual fleksibel khusus KU
 * @usedBy src/routes/(admin)/admin/keuangan/fr-jamaah/+page.svelte
 * @dependencies @sveltejs/kit, src/lib/db, src/lib/db/schema, src/lib/server/scope, drizzle-orm, @paralleldrive/cuid2
 * @publicFunctions load, actions.saveFr, actions.saveSetoranManual, actions.approveSetoran, actions.rejectSetoran
 * @sideEffects DB read pada anggota_keluarga, keluarga, users, user_dapukan, dapukan, kelompok, pos_anggaran_infaq, dan transaksi_fr; atomic update/upsert write pada transaksi_fr
 */

import { fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { db, first } from '$lib/db';
import { anggotaKeluarga, keluarga, users, kelompok, desa, transaksiFr, userDapukan, dapukan, posAnggaranInfaq } from '$lib/db/schema';
import { eq, and, asc, inArray, or, isNull, sql } from 'drizzle-orm';
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
	const accessibleWilayah = await getAccessibleWilayah(adminScope);

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
		? await canManageFr(roles, 'Kelompok', selectedKelompokId)
		: false;

	type BreakdownItem = {
		posId: string;
		nama: string;
		kode: string;
		nominal: number;
	};

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
		rawCatatan: string;
		buktiUrl: string | null;
		metode: string | null;
		tanggalLapor: string | null;
		diinputOleh: string | null;
		breakdownItems: BreakdownItem[];
		updatedAt: number | null;
		isPengurus: boolean;
		dapukanNama: string | null;
	}> = [];

	let categoriesWithPos: Array<{
		id: string;
		nama: string;
		labelKategori: string;
		subPos: Array<{
			posId: string;
			kode: string;
			nama: string;
			isWajib: boolean;
		}>;
	}> = [];

	let selectedKelompokNama = '';
	let desaId: number | null = null;
	let daerahId: number | null = null;

	if (selectedKelompokId) {
		const kRow = (await first(db
			.select({
				id: kelompok.id,
				nama: kelompok.nama,
				desaId: kelompok.desaId,
				daerahId: desa.daerahId
			})
			.from(kelompok)
			.leftJoin(desa, eq(kelompok.desaId, desa.id))
			.where(eq(kelompok.id, selectedKelompokId))
			));

		if (kRow) {
			selectedKelompokNama = kRow.nama;
			desaId = kRow.desaId;
			daerahId = kRow.daerahId;

			// 1. Query anggota keluarga wajib isrun di kelompok ini
			const rawJamaah = (await db
				.select({
					id: anggotaKeluarga.id,
					namaLengkap: anggotaKeluarga.namaLengkap,
					jenisKelamin: anggotaKeluarga.jenisKelamin,
					statusGenerus: anggotaKeluarga.statusGenerus,
					statusHubungan: anggotaKeluarga.statusHubungan,
					profesi: anggotaKeluarga.profesi,
					noTelepon: anggotaKeluarga.noTelepon,
					keluargaId: anggotaKeluarga.keluargaId,
					userId: anggotaKeluarga.userId,
					kepalaKeluargaId: keluarga.kepalaKeluargaId,
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
			// 2. Query transaksi FR yang sudah tercatat pada periode ini
			const rawFr = (await db
				.select()
				.from(transaksiFr)
				.where(
					and(
						eq(transaksiFr.kelompokId, selectedKelompokId),
						eq(transaksiFr.tahun, tahunParam),
						eq(transaksiFr.bulan, bulanParam)
					)
				)
);
			const frMap = new Map<string, typeof rawFr[number]>();
			for (const f of rawFr) {
				frMap.set(f.anggotaKeluargaId, f);
			}

			// 3. Query penugasan pengurus (userDapukan) untuk akun jamaah / kepala keluarga
			const targetUserIds = Array.from(
				new Set(
					rawJamaah
						.map((j: (typeof rawJamaah)[number]) => (j.statusHubungan === 'Kepala Keluarga' ? j.kepalaKeluargaId : j.userId))
						.filter((uid: string | null | undefined): uid is string => Boolean(uid))
				)
			);
			const userDapukanMap = new Map<string, string>();
			if (targetUserIds.length > 0) {
				const rawDapukan = (await db
					.select({
						userId: userDapukan.userId,
						namaDapukan: dapukan.namaDapukan,
						namaDapukanCustom: userDapukan.namaDapukanCustom
					})
					.from(userDapukan)
					.leftJoin(dapukan, eq(userDapukan.dapukanId, dapukan.id))
					.where(inArray(userDapukan.userId, targetUserIds))
);
				for (const d of rawDapukan) {
					if (!userDapukanMap.has(d.userId)) {
						userDapukanMap.set(d.userId, d.namaDapukan || d.namaDapukanCustom || 'Pengurus');
					}
				}
			}

			// 4. Query kamus pos anggaran infaq untuk resolusi nama pos pada breakdown & form input KU
			const posRows = (await db
				.select({
					id: posAnggaranInfaq.id,
					parentId: posAnggaranInfaq.parentId,
					nama: posAnggaranInfaq.nama,
					kode: posAnggaranInfaq.kode,
					isWajib: posAnggaranInfaq.isWajib,
					urutan: posAnggaranInfaq.urutan
				})
				.from(posAnggaranInfaq)
				.where(
					and(
						eq(posAnggaranInfaq.isActive, true),
						or(
							eq(posAnggaranInfaq.isWajib, true),
							selectedKelompokId ? eq(posAnggaranInfaq.kelompokId, selectedKelompokId) : isNull(posAnggaranInfaq.kelompokId),
							isNull(posAnggaranInfaq.kelompokId)
						)
					)
				)
				.orderBy(asc(posAnggaranInfaq.urutan), asc(posAnggaranInfaq.nama))
);
			const posMap = new Map<string, { nama: string; kode: string }>();
			for (const p of posRows) {
				posMap.set(p.id, { nama: p.nama, kode: p.kode });
			}

			// Bentuk struktur hierarki pos (A. Hak Pusat, B. Hak Daerah, dst) untuk modal input KU
			const parentCategories = posRows
				.filter((p) => !p.parentId)
				.sort((a, b) => a.urutan - b.urutan);

			const subPosList = posRows.filter((p) => !!p.parentId);

			categoriesWithPos = parentCategories.map((cat, idx) => {
				const children = subPosList
					.filter((sub) => sub.parentId === cat.id)
					.sort((a, b) => a.urutan - b.urutan)
					.map((sub) => ({
						posId: sub.id,
						kode: sub.kode,
						nama: sub.nama,
						isWajib: Boolean(sub.isWajib)
					}));

				const letter = String.fromCharCode(65 + idx);
				return {
					id: cat.id,
					nama: cat.nama,
					labelKategori: `${letter}. ${cat.nama}`,
					subPos: children
				};
			});

			// 5. Gabungkan data jamaah dengan transaksi periode aktif, status pengurus, dan bukti upload
			jamaahList = rawJamaah.map((j) => {
				const existing = frMap.get(j.id);
				const targetUid = j.statusHubungan === 'Kepala Keluarga' ? j.kepalaKeluargaId : j.userId;
				const dapukanName = targetUid ? userDapukanMap.get(targetUid) : null;
				const isPengurus = Boolean(dapukanName);

				let buktiUrl: string | null = null;
				const breakdownItems: BreakdownItem[] = [];
				let metode: string | null = null;
				let catatanUser = '';
				let tanggalLapor: string | null = null;
				let diinputOleh: string | null = null;

				if (existing?.catatan) {
					try {
						const parsed = JSON.parse(existing.catatan);
						if (parsed && typeof parsed === 'object') {
							buktiUrl = parsed.buktiUrl || null;
							metode = parsed.metode || null;
							catatanUser = parsed.catatan || '';
							tanggalLapor = parsed.tanggalLapor || null;
							diinputOleh = parsed.diinputOleh || null;

							if (parsed.breakdown && typeof parsed.breakdown === 'object') {
								for (const [posId, nom] of Object.entries(parsed.breakdown)) {
									const nVal = Number(nom) || 0;
									if (nVal > 0) {
										const pos = posMap.get(posId);
										breakdownItems.push({
											posId,
											nama: pos?.nama || 'Pos Anggaran',
											kode: pos?.kode || '',
											nominal: nVal
										});
									}
								}
							}
						}
					} catch (_) {
						catatanUser = existing.catatan || '';
					}
				}

				let statusBayar = 'Belum';
				if (existing) {
					if (existing.statusBayar === 'Menunggu Konfirmasi' || existing.statusBayar === 'Menunggu') {
						statusBayar = 'Menunggu Konfirmasi';
					} else if (existing.statusBayar === 'Belum') {
						statusBayar = 'Belum';
					} else if (existing.statusBayar === 'Diterima' || existing.statusBayar === 'Lunas') {
						statusBayar = 'Diterima';
					} else if (existing.nominal > 0) {
						statusBayar = 'Diterima';
					}
				}

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
					statusBayar,
					catatan: catatanUser,
					rawCatatan: existing?.catatan ?? '',
					buktiUrl,
					metode: metode || (existing?.nominal ? 'Tunai' : null),
					tanggalLapor,
					diinputOleh,
					breakdownItems,
					updatedAt: existing?.updatedAt ?? null,
					isPengurus,
					dapukanNama: dapukanName || null
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
		jamaahList,
		categoriesWithPos
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

		const canEdit = await canManageFr(locals.roles || [], 'Kelompok', kelompokId);
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
		const kRow = (await first(db
			.select({
				id: kelompok.id,
				desaId: kelompok.desaId,
				daerahId: desa.daerahId
			})
			.from(kelompok)
			.leftJoin(desa, eq(kelompok.desaId, desa.id))
			.where(eq(kelompok.id, kelompokId))
			));

		const safeDesaId = kRow?.desaId || null;
		const safeDaerahId = kRow?.daerahId || null;

		const now = Math.floor(Date.now() / 1000);
		const userId = locals.user.id;

		// Batch upsert dalam satu transaksi PostgreSQL (minimum I/O, atomic)
		const runBatch = async (rows: typeof items) => {
			await db.transaction(async (tx) => {
				for (const r of rows) {
					const safeNominal = Math.max(0, Math.floor(Number(r.nominal) || 0));
					const status = r.statusBayar || (safeNominal > 0 ? 'Lunas' : 'Belum');
					const catatan = r.catatan ? String(r.catatan).trim() : null;

					await tx.execute(sql`
			INSERT INTO transaksi_fr (
							id, anggota_keluarga_id, kelompok_id, desa_id, daerah_id,
							tahun, bulan, nominal, status_bayar, catatan,
							updated_by_user_id, created_at, updated_at
			) VALUES (
							${createId()}, ${r.anggotaId}, ${kelompokId}, ${safeDesaId}, ${safeDaerahId},
							${tahun}, ${bulan}, ${safeNominal}, ${status}, ${catatan},
							${userId}, ${now}, ${now}
			)
						ON CONFLICT (anggota_keluarga_id, tahun, bulan) DO UPDATE SET
				nominal = excluded.nominal,
				status_bayar = excluded.status_bayar,
				catatan = excluded.catatan,
				updated_by_user_id = excluded.updated_by_user_id,
				updated_at = excluded.updated_at
		`);
			}
		});
		};

		try {
			await runBatch(items);
		} catch (err: any) {
			console.error('[FR Save Error]:', err);
			return fail(500, { error: `Gagal menyimpan data FR: ${err?.message || 'Database error'}` });
		}

		return {
			success: true,
			message: `Berhasil menyimpan data FR untuk ${items.length} jamaah.`
		};
	},

	/**
	 * Menyimpan / memperbarui setoran Isrun/FR jamaah secara manual oleh KU
	 * (Mendukung jamaah setor buku fisik offline maupun verifikasi koreksi online)
	 */
	saveSetoranManual: async ({ request, locals }) => {
		if (!locals.user || !locals.isAdmin) {
			return fail(401, { error: 'Sesi kedaluwarsa. Silakan login kembali.' });
		}

		const formData = await request.formData();
		const kelompokId = Number(formData.get('kelompokId') || 0);
		const anggotaId = String(formData.get('anggotaId') || '');
		const tahun = Number(formData.get('tahun') || 0);
		const bulan = Number(formData.get('bulan') || 0);
		const nominal = Math.max(0, Math.floor(Number(formData.get('nominal')) || 0));
		const metode = String(formData.get('metode') || 'Tunai');
		const statusBayar = String(formData.get('statusBayar') || 'Diterima');
		const catatanText = String(formData.get('catatan') || '');
		const breakdownJson = String(formData.get('breakdownJson') || '{}');

		if (!kelompokId || !anggotaId || !tahun || !bulan) {
			return fail(400, { error: 'Parameter setoran tidak lengkap.' });
		}

		const canEdit = await canManageFr(locals.roles || [], 'Kelompok', kelompokId);
		if (!canEdit) {
			return fail(403, {
				error: 'Akses ditolak: Hanya pengurus KU/Bendahara atau Superadmin yang berwenang menyimpan setoran FR.'
			});
		}

		let parsedBreakdown: Record<string, number> = {};
		try {
			parsedBreakdown = JSON.parse(breakdownJson);
		} catch (_) {
			parsedBreakdown = {};
		}

		// Dapatkan wilayah desa & daerah
		const kRow = (await first(db
			.select({
				id: kelompok.id,
				desaId: kelompok.desaId,
				daerahId: desa.daerahId
			})
			.from(kelompok)
			.leftJoin(desa, eq(kelompok.desaId, desa.id))
			.where(eq(kelompok.id, kelompokId))
			));

		const safeDesaId = kRow?.desaId || null;
		const safeDaerahId = kRow?.daerahId || null;

		// Cek transaksi existing untuk mempertahankan file buktiUrl jika ada
		const existing = await first(db.execute(sql`SELECT id, catatan FROM transaksi_fr WHERE anggota_keluarga_id = ${anggotaId} AND tahun = ${tahun} AND bulan = ${bulan}`)) as { id: string; catatan: string | null } | undefined;

		let existingBuktiUrl: string | undefined = undefined;
		if (existing?.catatan) {
			try {
				const oldP = JSON.parse(existing.catatan);
				if (oldP.buktiUrl) existingBuktiUrl = oldP.buktiUrl;
			} catch (_) {}
		}

		const now = Math.floor(Date.now() / 1000);
		const userId = locals.user.id;

		const catatanPayload = JSON.stringify({
			breakdown: parsedBreakdown,
			metode: metode || 'Tunai',
			buktiUrl: existingBuktiUrl || undefined,
			catatan: catatanText.trim() || undefined,
			diinputOleh: `${locals.user.namaLengkap} (KU)`,
			tanggalLapor: new Date().toISOString()
		});

		try {
			await db.execute(sql`INSERT INTO transaksi_fr (
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
						${createId()}, ${anggotaId}, ${kelompokId}, ${safeDesaId}, ${safeDaerahId}, ${tahun}, ${bulan}, ${nominal}, ${statusBayar}, ${catatanPayload}, ${userId}, ${now}, ${now}
					)
					ON CONFLICT(anggota_keluarga_id, tahun, bulan) DO UPDATE SET
						nominal = excluded.nominal,
						status_bayar = excluded.status_bayar,
						catatan = excluded.catatan,
						updated_by_user_id = excluded.updated_by_user_id,
						updated_at = excluded.updated_at`);
		} catch (err: any) {
			console.error('[FR Save Manual Error]:', err);
			return fail(500, { error: `Gagal menyimpan setoran: ${err?.message || 'Database error'}` });
		}

		return {
			success: true,
			message: `Data setoran Isrun/FR jamaah berhasil disimpan (Status: ${statusBayar}).`
		};
	},

	/**
	 * Menyetujui setoran shodaqoh FR mandiri dari jamaah (Khusus KU / Superadmin)
	 */
	approveSetoran: async ({ request, locals }) => {
		if (!locals.user || !locals.isAdmin) {
			return fail(401, { error: 'Sesi kedaluwarsa. Silakan login kembali.' });
		}

		const formData = await request.formData();
		const kelompokId = Number(formData.get('kelompokId') || 0);
		const transaksiId = formData.get('transaksiId') ? String(formData.get('transaksiId')) : null;
		const anggotaId = formData.get('anggotaId') ? String(formData.get('anggotaId')) : null;
		const tahun = Number(formData.get('tahun') || 0);
		const bulan = Number(formData.get('bulan') || 0);

		if (!kelompokId || (!transaksiId && (!anggotaId || !tahun || !bulan))) {
			return fail(400, { error: 'Parameter persetujuan setoran tidak lengkap.' });
		}

		const canEdit = await canManageFr(locals.roles || [], 'Kelompok', kelompokId);
		if (!canEdit) {
			return fail(403, {
				error: 'Akses ditolak: Hanya pengurus KU/Bendahara atau Superadmin yang berwenang menyetujui setoran FR.'
			});
		}

		const now = Math.floor(Date.now() / 1000);
		const userId = locals.user.id;

		try {
			if (transaksiId) {
				await db.execute(sql`UPDATE transaksi_fr
						 SET status_bayar = 'Diterima',
						     updated_by_user_id = ${userId},
						     updated_at = ${now}
						 WHERE id = ${transaksiId}`);
			} else if (anggotaId && tahun && bulan) {
				await db.execute(sql`UPDATE transaksi_fr
						 SET status_bayar = 'Diterima',
						     updated_by_user_id = ${userId},
						     updated_at = ${now}
						 WHERE anggota_keluarga_id = ${anggotaId} AND tahun = ${tahun} AND bulan = ${bulan}`);
			}
		} catch (err: any) {
			console.error('[FR Approve Error]:', err);
			return fail(500, { error: `Gagal menyetujui setoran: ${err?.message || 'Database error'}` });
		}

		return {
			success: true,
			message: 'Setoran Isrun/FR jamaah berhasil disetujui & berstatus Diterima.'
		};
	},

	/**
	 * Mengembalikan status setoran atau menolak (Khusus KU / Superadmin)
	 */
	rejectSetoran: async ({ request, locals, url }) => {
		if (!locals.user || !locals.isAdmin) {
			return fail(401, { error: 'Sesi kedaluwarsa. Silakan login kembali.' });
		}

		const formData = await request.formData();
		const transaksiId = formData.get('transaksiId') ? String(formData.get('transaksiId')) : null;
		const anggotaId = formData.get('anggotaId') ? String(formData.get('anggotaId')) : null;
		const tahun = Number(formData.get('tahun') || url.searchParams.get('tahun') || 0);
		const bulan = Number(formData.get('bulan') || url.searchParams.get('bulan') || 0);
		let kelompokId = Number(formData.get('kelompokId') || url.searchParams.get('kelompokId') || 0);

		// Resolve kelompokId jika belum ada dari formData/url
		if (!kelompokId && transaksiId) {
			const trx = await first(db.execute(sql`SELECT kelompok_id FROM transaksi_fr WHERE id = ${transaksiId}`)) as { kelompok_id: number } | undefined;
			if (trx?.kelompok_id) kelompokId = trx.kelompok_id;
		}

		if (!kelompokId && anggotaId) {
			const aRow = await first(db.execute(sql`SELECT u.kelompok_id 
					 FROM anggota_keluarga ak 
					 JOIN keluarga k ON ak.keluarga_id = k.id 
					 JOIN users u ON k.kepala_keluarga_id = u.id 
					 WHERE ak.id = ${anggotaId}`)) as { kelompok_id: number } | undefined;
			if (aRow?.kelompok_id) kelompokId = aRow.kelompok_id;
		}

		if (!kelompokId || (!transaksiId && (!anggotaId || !tahun || !bulan))) {
			return fail(400, { error: 'Parameter pembatalan setoran tidak lengkap.' });
		}

		const canEdit = await canManageFr(locals.roles || [], 'Kelompok', kelompokId);
		if (!canEdit) {
			return fail(403, {
				error: 'Akses ditolak: Hanya pengurus KU/Bendahara atau Superadmin yang berwenang mengubah status setoran FR.'
			});
		}

		const now = Math.floor(Date.now() / 1000);
		const userId = locals.user.id;

		try {
			if (transaksiId) {
				await db.execute(sql`UPDATE transaksi_fr
						 SET status_bayar = 'Belum',
						     nominal = 0,
						     catatan = NULL,
						     updated_by_user_id = ${userId},
						     updated_at = ${now}
						 WHERE id = ${transaksiId}`);
			} else if (anggotaId && tahun && bulan) {
				await db.execute(sql`UPDATE transaksi_fr
						 SET status_bayar = 'Belum',
						     nominal = 0,
						     catatan = NULL,
						     updated_by_user_id = ${userId},
						     updated_at = ${now}
						 WHERE anggota_keluarga_id = ${anggotaId} AND tahun = ${tahun} AND bulan = ${bulan}`);
			}
		} catch (err: any) {
			console.error('[FR Reject Error]:', err);
			return fail(500, { error: `Gagal mengubah status setoran: ${err?.message || 'Database error'}` });
		}

		return {
			success: true,
			message: 'Status setoran berhasil dikembalikan ke Belum.'
		};
	}
};

