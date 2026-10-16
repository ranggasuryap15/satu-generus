/**
 * @file src/routes/(admin)/admin/sensus/+page.server.ts
 * @purpose Rekapitulasi sensus KK & Mandiri, metrik dashboard, penugasan dapukan pengurus KK, pengurutan hierarki keluarga standar (Kepala Keluarga -> Istri -> Anak), validasi integritas keunikan Kyai, validasi keunikan email & noTelepon, sinkronisasi noTelepon akun, penyediaan nilai dekripsi NIK/KK asli untuk modal edit, resolusi effectiveUserId & default isrun Kepala Keluarga, pembuatan akun mandiri (createMemberAccount) dengan default password jokam354, serta form actions sensus
 * @usedBy src/routes/(admin)/admin/sensus/+page.svelte
 * @dependencies src/lib/db, src/lib/db/schema, src/lib/server/crypto, src/lib/server/auth, src/lib/server/scope, src/lib/utils (normalizeDateToISO), src/lib/generus (hitungUmur, hitungStatusGenerus, isStatusHubunganMenikah, resolveStatusPernikahan, isStatusGenerusBelumMenikah, sortAnggotaKeluargaHierarki), drizzle-orm
 * @publicFunctions load, actions.createSensus, actions.addAnggotaKeluarga, actions.updateAnggota, actions.updateKeluarga, actions.deleteSensus, actions.pindahKelompok, actions.toggleStatusJamaah, actions.createMemberAccount, actions.assignDapukan
 * @sideEffects Transaksi penulisan database tabel users, keluarga, anggota_keluarga, user_dapukan; query join multi-tabel terindeks; sinkronisasi user_id, no_telepon & default isrun Kepala Keluarga; penanganan error duplikasi email & nomor HP
 */

import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db, first } from '#lib/db/index.js';
import { keluarga, anggotaKeluarga, users, kelompok, desa, daerah, userDapukan, dapukan, presensiKehadiran } from '#lib/db/schema.js';
import { eq, desc, inArray, and, isNotNull, ne } from 'drizzle-orm';
import { decryptSensitive, encryptSensitive, maskSensitive } from '#lib/server/crypto.js';
import { hashPassword } from '#lib/server/auth.js';
import {
	getAdminScope,
	getAccessibleWilayah,
	isDapukanAssignableManually,
	isKelompokAllowed,
	canManageDapukan
} from '#lib/server/scope.js';
import { normalizeDateToISO } from '#lib/utils.js';
import {
	hitungUmur,
	hitungStatusGenerus,
	isStatusHubunganMenikah,
	resolveStatusPernikahan,
	isStatusGenerusBelumMenikah,
	sortAnggotaKeluargaHierarki
} from '#lib/generus.js';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user || !locals.isAdmin) {
		throw redirect(303, '/login');
	}

	try {
		// 1. Evaluasi Hierarki Scope Admin (Pusat, Daerah, Desa, Kelompok)
		const adminScope = getAdminScope(locals.roles);
		const accessibleWilayah = await getAccessibleWilayah(adminScope);

		// 2. Query Data Keluarga join Users, Kelompok, Desa, Daerah (Single JOIN, 0 N+1)
		const rawKeluargaList = (await db
			.select({
				id: keluarga.id,
				isKk: keluarga.isKk,
				noKkEncrypted: keluarga.noKkEncrypted,
				alamatLengkap: keluarga.alamatLengkap,
				kepalaKeluargaId: keluarga.kepalaKeluargaId,
				kepalaKeluargaNama: users.namaLengkap,
				kepalaKeluargaEmail: users.email,
				kepalaKeluargaNoTelepon: users.noTelepon,
				kelompokId: users.kelompokId,
				kelompokNama: kelompok.nama,
				desaId: desa.id,
				desaNama: desa.nama,
				daerahId: daerah.id,
				daerahNama: daerah.nama
			})
			.from(keluarga)
			.leftJoin(users, eq(keluarga.kepalaKeluargaId, users.id))
			.leftJoin(kelompok, eq(users.kelompokId, kelompok.id))
			.leftJoin(desa, eq(kelompok.desaId, desa.id))
			.leftJoin(daerah, eq(desa.daerahId, daerah.id))
			.orderBy(desc(keluarga.id))
);
		// Saring keluarga sesuai kelompok yang diizinkan dalam scope admin
		const scopedKeluargaList = rawKeluargaList.filter((k) => {
			if (adminScope.isPusat) return true;
			if (!k.kelompokId) return false;
			return accessibleWilayah.allowedKelompokIdSet.has(k.kelompokId);
		});

		// 3. Struktur Dapukan 4S & Hak Kelola Dapukan
		const masterDapukan = (await db.select().from(dapukan));
		const canManageDapukanVal = canManageDapukan(locals.roles || []);

		// 4. Batch Query Anggota Keluarga join Users untuk akun email (1 scan, O(1) Map lookup)
		const rawAnggotaList = (await db
			.select({
				id: anggotaKeluarga.id,
				keluargaId: anggotaKeluarga.keluargaId,
				userId: anggotaKeluarga.userId,
				userEmail: users.email,
				userNama: users.namaLengkap,
				userNoTelepon: users.noTelepon,
				namaLengkap: anggotaKeluarga.namaLengkap,
				nikEncrypted: anggotaKeluarga.nikEncrypted,
				statusHubungan: anggotaKeluarga.statusHubungan,
				tanggalLahir: anggotaKeluarga.tanggalLahir,
				jenisKelamin: anggotaKeluarga.jenisKelamin,
				tempatLahir: anggotaKeluarga.tempatLahir,
				profesi: anggotaKeluarga.profesi,
				noTelepon: anggotaKeluarga.noTelepon,
				statusGenerus: anggotaKeluarga.statusGenerus,
				statusPernikahan: anggotaKeluarga.statusPernikahan,
				statusJamaah: anggotaKeluarga.statusJamaah,
				isrun: anggotaKeluarga.isrun,
				golonganDarah: anggotaKeluarga.golonganDarah
			})
			.from(anggotaKeluarga)
			.leftJoin(users, eq(anggotaKeluarga.userId, users.id))
);
		const anggotaByKeluargaMap = new Map<string, typeof rawAnggotaList>();
		for (const a of rawAnggotaList) {
			const list = anggotaByKeluargaMap.get(a.keluargaId) || [];
			list.push(a);
			anggotaByKeluargaMap.set(a.keluargaId, list);
		}

		// 5. Batch Query Peran Pengurus / 4S untuk Semua Akun Jamaah
		const rawRoles = (await db
			.select({
				userId: userDapukan.userId,
				dapukanNama: dapukan.namaDapukan,
				namaDapukanCustom: userDapukan.namaDapukanCustom,
				is4S: dapukan.is4S,
				tingkatScope: userDapukan.tingkatScope
			})
			.from(userDapukan)
			.leftJoin(dapukan, eq(userDapukan.dapukanId, dapukan.id))
);
		const roleByUserIdMap = new Map<string, typeof rawRoles>();
		for (const r of rawRoles) {
			const list = roleByUserIdMap.get(r.userId) || [];
			list.push(r);
			roleByUserIdMap.set(r.userId, list);
		}

		let totalJiwa = 0;
		let totalKeluarga = 0;
		let totalMandiri = 0;
		let totalPengurus = 0;
		let totalPengurus4S = 0;

		// 6. Transformasi Data dengan Masking dan Pemetaan Akun KK
		const daftarKeluarga = scopedKeluargaList.map((k) => {
			const isKk = k.isKk ?? true;
			let noKkMasked = 'Tanpa KK';

			let noKkPlain = '';
			if (isKk) {
				totalKeluarga++;
				if (k.noKkEncrypted) {
					try {
						noKkPlain = decryptSensitive(k.noKkEncrypted);
						noKkMasked = maskSensitive(noKkPlain);
					} catch (_) {
						noKkMasked = '****';
					}
				} else {
					noKkMasked = 'Belum Ada No. KK';
				}
			} else {
				totalMandiri++;
				noKkMasked = 'Tanpa KK (Perantau)';
			}

			const familyMembers = sortAnggotaKeluargaHierarki(anggotaByKeluargaMap.get(k.id) || []);
			totalJiwa += familyMembers.length;

			const anggotaFormatted = familyMembers.map((a) => {
				let nikPlain = '';
				let nikMasked = 'Belum Ada NIK';
				const hasNik = !!a.nikEncrypted;
				if (hasNik) {
					try {
						nikPlain = decryptSensitive(a.nikEncrypted!);
						nikMasked = maskSensitive(nikPlain);
					} catch (_) {
						nikMasked = '****';
					}
				}

				const effectiveUserId = a.userId || (a.statusHubungan === 'Kepala Keluarga' ? k.kepalaKeluargaId : null);
				const effectiveUserEmail = a.userEmail || (a.statusHubungan === 'Kepala Keluarga' ? k.kepalaKeluargaEmail : null);

				const aRoles = effectiveUserId ? roleByUserIdMap.get(effectiveUserId) || [] : [];
				const aIsPengurus = aRoles.length > 0;
				const aIs4S = aRoles.some((r) => r.is4S === true);
				const aPrimaryRole = aRoles[0];
				const aDapukanNama = aPrimaryRole
					? aPrimaryRole.namaDapukanCustom || aPrimaryRole.dapukanNama || 'Pengurus'
					: null;
				const aTingkatScope = aPrimaryRole?.tingkatScope || null;

				const statusPernikahanResolved = a.statusPernikahan || (isStatusHubunganMenikah(a.statusHubungan) ? 'Sudah Menikah' : null);
				const umur = a.tanggalLahir ? hitungUmur(a.tanggalLahir) : 0;
				const statusGenerusResolved = a.statusGenerus || (a.tanggalLahir ? hitungStatusGenerus(umur, statusPernikahanResolved || 'Belum Menikah') : null);

					const effectiveNoTelepon =
						a.noTelepon ||
						(a.userId ? a.userNoTelepon : null) ||
						(a.statusHubungan === 'Kepala Keluarga' ? k.kepalaKeluargaNoTelepon : null) ||
						'';

					return {
					id: a.id,
					userId: effectiveUserId,
					userEmail: effectiveUserEmail || null,
					namaLengkap:
						a.namaLengkap ||
						(a.statusHubungan === 'Kepala Keluarga' ? k.kepalaKeluargaNama || 'Kepala Keluarga' : a.statusHubungan),
					nikMasked,
					hasNik,
					nikRaw: nikPlain,
					statusHubungan: a.statusHubungan,
					tanggalLahir: a.tanggalLahir,
					jenisKelamin: a.jenisKelamin,
					tempatLahir: a.tempatLahir || '-',
					tempatLahirRaw: a.tempatLahir || '',
					profesi: a.profesi || '-',
					profesiRaw: a.profesi || '',
					noTelepon: effectiveNoTelepon || '-',
					noTeleponRaw: effectiveNoTelepon,
					statusGenerus: statusGenerusResolved || '-',
					statusGenerusRaw: statusGenerusResolved || '',
					statusPernikahan: statusPernikahanResolved || '-',
					statusPernikahanRaw: statusPernikahanResolved || '',
					statusJamaah: a.statusJamaah || 'Aktif',
					isrun: a.isrun || ((isKk && a.statusHubungan === 'Kepala Keluarga') ? 'Ya' : 'Tidak'),
					golonganDarah: a.golonganDarah || '-',
					golonganDarahRaw: a.golonganDarah || '',
					isPengurus: aIsPengurus,
					is4S: aIs4S,
					dapukanNama: aDapukanNama,
					tingkatScope: aTingkatScope
				};
			});

			// Kumpulkan seluruh akun jamaah yang ada di dalam KK ini
			const akunMap = new Map<
				string,
				{
					userId: string;
					nama: string;
					email: string;
					statusHubungan: string;
					isPengurus: boolean;
					is4S: boolean;
					dapukanNama: string | null;
					tingkatScope: string | null;
				}
			>();

			if (k.kepalaKeluargaId) {
				const roles = roleByUserIdMap.get(k.kepalaKeluargaId) || [];
				const isPengurus = roles.length > 0;
				const is4S = roles.some((r) => r.is4S === true);
				const primaryRole = roles[0];
				const dapukanNama = primaryRole
					? primaryRole.namaDapukanCustom || primaryRole.dapukanNama || 'Pengurus'
					: null;
				const tingkatScope = primaryRole?.tingkatScope || null;

				akunMap.set(k.kepalaKeluargaId, {
					userId: k.kepalaKeluargaId,
					nama: k.kepalaKeluargaNama || 'Kepala Keluarga',
					email: k.kepalaKeluargaEmail || '-',
					statusHubungan: 'Kepala Keluarga',
					isPengurus,
					is4S,
					dapukanNama,
					tingkatScope
				});
			}

			for (const a of anggotaFormatted) {
				if (a.userId && !akunMap.has(a.userId)) {
					akunMap.set(a.userId, {
						userId: a.userId,
						nama: a.namaLengkap,
						email: a.userEmail || '-',
						statusHubungan: a.statusHubungan,
						isPengurus: a.isPengurus,
						is4S: a.is4S,
						dapukanNama: a.dapukanNama,
						tingkatScope: a.tingkatScope
					});
				}
			}

			const akunList = Array.from(akunMap.values());

			const isPengurus = akunList.some((acc) => acc.isPengurus);
			const is4S = akunList.some((acc) => acc.is4S);
			if (is4S) totalPengurus4S++;
			if (isPengurus) totalPengurus++;

			const primaryPengurus = akunList.find((acc) => acc.is4S) || akunList.find((acc) => acc.isPengurus);
			const dapukanNama = primaryPengurus ? primaryPengurus.dapukanNama : null;

			return {
				id: k.id,
				isKk,
				noKkMasked,
				noKkRaw: noKkPlain,
				alamatLengkap: k.alamatLengkap || '-',
				alamatLengkapRaw: k.alamatLengkap || '',
				kepalaKeluargaId: k.kepalaKeluargaId,
				kepalaKeluargaNama: k.kepalaKeluargaNama || 'Belum ditautkan',
				kepalaKeluargaEmail: k.kepalaKeluargaEmail || '-',
				kelompokId: k.kelompokId,
				kelompokNama: k.kelompokNama || '-',
				desaId: k.desaId,
				desaNama: k.desaNama || '-',
				daerahId: k.daerahId,
				daerahNama: k.daerahNama || '-',
				is4S,
				isPengurus,
				dapukanNama,
				jumlahAnggota: anggotaFormatted.length,
				anggota: anggotaFormatted,
				akunList
			};
		});

		// 7. Ringkasan Metrik Dashboard
		const dashboardStats = {
			totalKeluarga,
			totalMandiri,
			totalJiwa,
			totalPengurus,
			totalPengurus4S,
			totalDaerah: accessibleWilayah.daerahList.length,
			totalDesa: accessibleWilayah.desaList.length,
			totalKelompok: accessibleWilayah.kelompokList.length
		};

		return {
			daftarKeluarga,
			dashboardStats,
			wilayahOptions: {
				daerahList: accessibleWilayah.daerahList,
				desaList: accessibleWilayah.desaList,
				kelompokList: accessibleWilayah.kelompokList
			},
			masterDapukan,
			canManageDapukan: canManageDapukanVal,
			adminScope: {
				level: adminScope.level,
				isPusat: adminScope.isPusat
			}
		};
	} catch (err: any) {
		// Teruskan redirect SvelteKit
		if (err?.status && err?.location) throw err;
		console.error('[Sensus Server Load Error]:', err);

		const adminScope = getAdminScope(locals.roles);
		return {
			daftarKeluarga: [],
			dashboardStats: {
				totalKeluarga: 0,
				totalMandiri: 0,
				totalJiwa: 0,
				totalPengurus: 0,
				totalPengurus4S: 0,
				totalDaerah: 0,
				totalDesa: 0,
				totalKelompok: 0
			},
			wilayahOptions: {
				daerahList: [],
				desaList: [],
				kelompokList: []
			},
			masterDapukan: [],
			canManageDapukan: false,
			adminScope: {
				level: adminScope.level,
				isPusat: adminScope.isPusat
			}
		};
	}
};

export const actions: Actions = {
	/**
	 * Membuat Sensus Baru: akun user baru dengan password default 'jokam354',
	 * kartu keluarga, dan data anggota keluarga sekaligus dalam 1 transaksi atomik.
	 */
	createSensus: async ({ request, locals }) => {
		if (!locals.user || !locals.isAdmin) {
			return fail(403, { error: 'Akses ditolak.' });
		}

		const adminScope = getAdminScope(locals.roles);
		const accessibleWilayah = await getAccessibleWilayah(adminScope);

		const formData = await request.formData();
		const namaLengkap = formData.get('namaLengkap')?.toString()?.trim() || '';
		const email = formData.get('email')?.toString()?.trim()?.toLowerCase() || '';
		const noTelepon = formData.get('noTelepon')?.toString()?.trim() || '';
		const kelompokIdStr = formData.get('kelompokId')?.toString()?.trim() || '';
		const noKk = formData.get('noKk')?.toString()?.trim() || '';
		const alamatLengkap = formData.get('alamatLengkap')?.toString()?.trim() || '';
		const anggotaJson = formData.get('anggotaData')?.toString() || '[]';

		const kelompokId = parseInt(kelompokIdStr, 10);

		// Validasi Kelengkapan Akun & Wilayah
		// Email bersifat OPSIONAL; login utama memakai Nomor HP. Bila diisi, formatnya divalidasi.
		if (!namaLengkap || isNaN(kelompokId)) {
			return fail(400, {
				error: 'Nama lengkap dan kelompok basis wajib diisi.'
			});
		}
		if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
			return fail(400, {
				error: 'Format alamat email tidak valid.'
			});
		}

		// Validasi No Telepon Wajib untuk Akun
		const cleanNoTelepon = noTelepon.replace(/\D/g, '');
		if (!cleanNoTelepon) {
			return fail(400, {
				error: 'Nomor HP/WhatsApp wajib diisi untuk pendaftaran akun jamaah.'
			});
		}
		if (!/^\d{8,16}$/.test(cleanNoTelepon)) {
			return fail(400, {
				error: 'Nomor HP harus berupa angka valid (8-16 digit).'
			});
		}

		// Validasi Strict Scope Admin
		if (!isKelompokAllowed(kelompokId, accessibleWilayah.allowedKelompokIdSet, adminScope.isPusat)) {
			return fail(403, {
				error: 'Anda tidak memiliki hak wewenang untuk mendaftarkan jamaah di kelompok ini.'
			});
		}

		// Validasi keunikan No HP (identifier login utama) — selalu dijalankan
		const existingPhone = (await first(
			db.select({ id: users.id }).from(users).where(eq(users.noTelepon, cleanNoTelepon))
		));
		if (existingPhone) {
			return fail(400, {
				error: `Nomor HP ${cleanNoTelepon} sudah terdaftar pada akun lain. Silakan gunakan nomor HP berbeda.`,
				field: 'noTelepon'
			});
		}

		// Validasi keunikan Email — hanya bila email diisi
		if (email) {
			const existingUser = (await first(
				db.select({ id: users.id }).from(users).where(eq(users.email, email))
			));
			if (existingUser) {
				return fail(400, {
					error: `Email ${email} sudah terdaftar pada akun lain. Silakan gunakan email berbeda atau kosongkan.`,
					field: 'email'
				});
			}
		}

		const tipeSensus = formData.get('tipeSensus')?.toString()?.trim() || 'keluarga';
		const isMandiri = tipeSensus === 'mandiri';

		// Validasi Nomor KK jika tipe sensus adalah Kartu Keluarga
		let noKkEncrypted: string | null = null;
		let anggotaList: Array<{
			namaLengkap?: string;
			nik?: string;
			statusHubungan: string;
			tempatLahir?: string;
			tanggalLahir: string;
			jenisKelamin: string;
			statusPernikahan?: string;
			statusGenerus?: string;
			profesi?: string;
			golonganDarah?: string;
			noTelepon?: string;
		}> = [];

		if (!isMandiri) {
			const cleanNoKk = noKk ? noKk.trim().replace(/\D/g, '') : '';
			if (cleanNoKk && cleanNoKk.length !== 16) {
				return fail(400, { error: 'Nomor Kartu Keluarga harus 16 digit angka jika diisi.' });
			}
			noKkEncrypted = cleanNoKk ? encryptSensitive(cleanNoKk) : null;

			try {
				anggotaList = JSON.parse(anggotaJson);
			} catch (_) {
				return fail(400, { error: 'Format data anggota keluarga tidak valid.' });
			}

			if (!Array.isArray(anggotaList) || anggotaList.length === 0) {
				return fail(400, { error: 'Minimal 1 anggota keluarga wajib didaftarkan.' });
			}

			for (let i = 0; i < anggotaList.length; i++) {
				const a = anggotaList[i];
				if (!a.statusHubungan || !a.tanggalLahir || !a.jenisKelamin) {
					return fail(400, {
						error: `Data anggota ke-${i + 1} belum lengkap (Status, Tanggal Lahir, dan Jenis Kelamin wajib diisi).`
					});
				}
				if (a.nik && a.nik.trim()) {
					const cNik = a.nik.trim().replace(/\D/g, '');
					if (cNik.length !== 16) {
						return fail(400, {
							error: `NIK anggota ke-${i + 1} (${a.namaLengkap || a.statusHubungan}) harus 16 digit angka jika diisi.`
						});
					}
				}
				if (a.noTelepon && a.noTelepon.trim()) {
					const cleanAnggotaHp = a.noTelepon.trim().replace(/\D/g, '');
					if (!/^\d{8,16}$/.test(cleanAnggotaHp)) {
						return fail(400, {
							error: `Nomor HP anggota ke-${i + 1} (${a.namaLengkap || a.statusHubungan}) tidak valid (harus 8-16 digit angka).`
						});
					}
				}
			}

			// Urutkan anggota keluarga sesuai hierarki resmi (Kepala Keluarga -> Istri -> Anak tertua ke termuda -> dst)
			anggotaList = sortAnggotaKeluargaHierarki(anggotaList);
		} else {
			// Validasi Data Diri Jamaah Mandiri / Perantau (Tanpa KK)
			const nikMandiri = formData.get('nik')?.toString()?.trim() || '';
			const cleanNikMandiri = nikMandiri ? nikMandiri.replace(/\D/g, '') : '';
			if (cleanNikMandiri && cleanNikMandiri.length !== 16) {
				return fail(400, { error: 'NIK jamaah mandiri harus 16 digit angka jika diisi.' });
			}
			const tempatLahirMandiri = formData.get('tempatLahir')?.toString()?.trim() || '';
			const tanggalLahirMandiri = formData.get('tanggalLahir')?.toString()?.trim() || '';
			const jenisKelaminMandiri = formData.get('jenisKelamin')?.toString()?.trim() || '';
			const statusPernikahanMandiri = formData.get('statusPernikahan')?.toString()?.trim() || 'Belum Menikah';
			const statusGenerusMandiri = formData.get('statusGenerus')?.toString()?.trim() || '';
			const profesiMandiri = formData.get('profesi')?.toString()?.trim() || '';
			const golonganDarahMandiri = formData.get('golonganDarah')?.toString()?.trim() || '';

			if (!tanggalLahirMandiri || !jenisKelaminMandiri) {
				return fail(400, {
					error: 'Tanggal lahir dan jenis kelamin jamaah wajib diisi.'
				});
			}

			noKkEncrypted = null;
			anggotaList = [
				{
					namaLengkap,
					nik: cleanNikMandiri || undefined,
					statusHubungan: 'Mandiri / Perantau',
					tempatLahir: tempatLahirMandiri,
					tanggalLahir: tanggalLahirMandiri,
					jenisKelamin: jenisKelaminMandiri,
					statusPernikahan: statusPernikahanMandiri,
					statusGenerus: statusGenerusMandiri,
					profesi: profesiMandiri,
					golonganDarah: golonganDarahMandiri,
					noTelepon: cleanNoTelepon
				}
			];
		}

		// Password Baku Default Sesuai Spesifikasi: 'jokam354'
		const defaultHash = await hashPassword('jokam354');

		// Eksekusi Transaksi DB Atomik (Minimum Lock)
		try {
			await db.transaction(async (tx) => {
				// 1. Buat Akun Jamaah Baru
				const [newUser] = (await tx
					.insert(users)
					.values({
						namaLengkap,
						// Email opsional: simpan NULL (bukan string kosong) agar constraint
						// UNIQUE pada kolom email tidak menolak banyak akun tanpa email.
						email: email || null,
						noTelepon: cleanNoTelepon,
						passwordHash: defaultHash,
						kelompokId
					})
					.returning()
				);
				// 2. Buat Record Sensus (isKk: false untuk Mandiri/Perantau agar tidak dihitung KK)
				const [newKeluarga] = (await tx
					.insert(keluarga)
					.values({
						isKk: !isMandiri,
						noKkEncrypted,
						kepalaKeluargaId: newUser.id,
						alamatLengkap
					})
					.returning()
				);
				// 3. Masukkan Anggota Keluarga / Data Diri Jiwa
				for (let i = 0; i < anggotaList.length; i++) {
					const a = anggotaList[i];
					const isKepala = isMandiri || a.statusHubungan === 'Kepala Keluarga' || i === 0;
					const memberNama = a.namaLengkap?.trim() || (isKepala ? namaLengkap : a.statusHubungan);
					const cleanMemberNik = a.nik ? a.nik.toString().trim().replace(/\D/g, '') : '';
					const nikVal = cleanMemberNik ? encryptSensitive(cleanMemberNik) : null;
					const isoTgl = normalizeDateToISO(a.tanggalLahir);
					const memberPernikahan = resolveStatusPernikahan(a.statusHubungan, (a as any).statusPernikahan);
					const umur = isoTgl ? hitungUmur(isoTgl) : 0;
					const calculatedGenerus = isoTgl ? hitungStatusGenerus(umur, memberPernikahan) : null;
					const memberGenerus = (a as any).statusGenerus || calculatedGenerus;
					const memberHp = isKepala
						? cleanNoTelepon
						: (a.noTelepon && a.noTelepon.trim() ? a.noTelepon.trim().replace(/\D/g, '') : null);
					const normalizedJk = (a.jenisKelamin === 'P' || a.jenisKelamin === 'Perempuan') ? 'P' : 'L';

					await tx.insert(anggotaKeluarga)
						.values({
							keluargaId: newKeluarga.id,
							userId: isKepala ? newUser.id : null,
							namaLengkap: memberNama,
							nikEncrypted: nikVal,
							statusHubungan: a.statusHubungan,
							tempatLahir: a.tempatLahir?.trim() || null,
							tanggalLahir: isoTgl,
							jenisKelamin: normalizedJk,
							statusPernikahan: memberPernikahan,
							statusGenerus: memberGenerus || null,
							profesi: a.profesi?.trim() || null,
							golonganDarah: a.golonganDarah?.trim() || null,
							noTelepon: memberHp,
							statusJamaah: 'Aktif',
							isrun: (!isMandiri && a.statusHubungan === 'Kepala Keluarga') ? 'Ya' : ((a as any).isrun || 'Tidak')
						});
				}
			});
		} catch (err: any) {
			console.error('Gagal membuat sensus baru:', err);
			const errMsg = err?.message || '';
			if (errMsg.includes('UNIQUE constraint failed: users.email')) {
				return fail(400, {
					error: `Email ${email} sudah terdaftar pada akun lain. Silakan gunakan email berbeda atau kosongkan.`,
					field: 'email'
				});
			}
			if (errMsg.includes('UNIQUE constraint failed: users.no_telepon')) {
				return fail(400, {
					error: `Nomor HP ${cleanNoTelepon} sudah terdaftar pada akun lain. Silakan gunakan nomor HP berbeda.`,
					field: 'noTelepon'
				});
			}
			return fail(500, {
				error: 'Terjadi kesalahan sistem saat menyimpan data sensus: ' + (errMsg || 'Gagal menyimpan ke database')
			});
		}

		const successMsg = isMandiri
			? `Akun jamaah perorangan/perantau ${namaLengkap} berhasil didaftarkan ke sensus (tidak dihitung KK) dengan password: jokam354`
			: `Akun jamaah ${namaLengkap} dan Kartu Keluarga berhasil dibuat dengan password awal: jokam354`;

		return {
			success: successMsg
		};
	},

	/**
	 * Menambahkan Anggota Keluarga ke Kartu Keluarga yang telah dibuat
	 */
	addAnggotaKeluarga: async ({ request, locals }) => {
		if (!locals.user || !locals.isAdmin) {
			return fail(403, { error: 'Akses ditolak.' });
		}

		const adminScope = getAdminScope(locals.roles);
		const accessibleWilayah = await getAccessibleWilayah(adminScope);

		const formData = await request.formData();
		const keluargaId = formData.get('keluargaId')?.toString()?.trim() || '';
		const namaLengkap = formData.get('namaLengkap')?.toString()?.trim() || '';
		const nik = formData.get('nik')?.toString()?.trim() || '';
		const statusHubungan = formData.get('statusHubungan')?.toString()?.trim() || '';
		const tanggalLahir = formData.get('tanggalLahir')?.toString()?.trim() || '';
		const jenisKelamin = formData.get('jenisKelamin')?.toString()?.trim() || '';
		const noTelepon = formData.get('noTelepon')?.toString()?.trim() || '';

		if (!keluargaId) {
			return fail(400, { error: 'ID Kartu Keluarga tidak valid.' });
		}

		// Cari keluarga dan verifikasi scope
		const targetKeluarga = (await first(db
			.select({
				id: keluarga.id,
				isKk: keluarga.isKk,
				kepalaKeluargaId: keluarga.kepalaKeluargaId,
				kelompokId: users.kelompokId
			})
			.from(keluarga)
			.leftJoin(users, eq(keluarga.kepalaKeluargaId, users.id))
			.where(eq(keluarga.id, keluargaId))
			));

		if (!targetKeluarga) {
			return fail(404, { error: 'Data Kartu Keluarga tidak ditemukan.' });
		}

		if (
			targetKeluarga.kelompokId &&
			!isKelompokAllowed(targetKeluarga.kelompokId, accessibleWilayah.allowedKelompokIdSet, adminScope.isPusat)
		) {
			return fail(403, {
				error: 'Akses ditolak: Kartu Keluarga berada di luar cakupan wewenang Anda.'
			});
		}

		if (!namaLengkap) {
			return fail(400, { error: 'Nama lengkap anggota keluarga wajib diisi.' });
		}

		if (!statusHubungan || !tanggalLahir || !jenisKelamin) {
			return fail(400, { error: 'Status hubungan, tanggal lahir, dan jenis kelamin wajib diisi.' });
		}

		let cleanNoTelepon: string | null = null;
		if (noTelepon) {
			cleanNoTelepon = noTelepon.replace(/\D/g, '');
			if (!/^\d{8,16}$/.test(cleanNoTelepon)) {
				return fail(400, { error: 'Nomor HP harus berupa angka valid (8-16 digit).' });
			}
		}

		try {
			const cleanNik = nik ? nik.trim().replace(/\D/g, '') : '';
			const tempatLahir = formData.get('tempatLahir')?.toString()?.trim() || '';
			const profesi = formData.get('profesi')?.toString()?.trim() || '';
			const golonganDarah = formData.get('golonganDarah')?.toString()?.trim() || '';
			const statusJamaah = formData.get('statusJamaah')?.toString()?.trim() || 'Aktif';
			const isrun = formData.get('isrun')?.toString()?.trim() || (statusHubungan === 'Kepala Keluarga' && (targetKeluarga.isKk ?? true) ? 'Ya' : 'Tidak');
			const statusGenerusInput = formData.get('statusGenerus')?.toString()?.trim() || '';
			const statusPernikahanInput = formData.get('statusPernikahan')?.toString()?.trim() || '';
			let resolvedPernikahan = resolveStatusPernikahan(statusHubungan, statusPernikahanInput);
			if (isStatusGenerusBelumMenikah(statusGenerusInput)) {
				resolvedPernikahan = 'Belum Menikah';
			} else if (statusGenerusInput === 'Dewasa Menikah') {
				resolvedPernikahan = 'Sudah Menikah';
			}
			const isoTgl = normalizeDateToISO(tanggalLahir);
			const umur = isoTgl ? hitungUmur(isoTgl) : 0;
			const resolvedGenerus = statusGenerusInput || (isoTgl ? hitungStatusGenerus(umur, resolvedPernikahan) : null);

			(await db.insert(anggotaKeluarga)
				.values({
					keluargaId,
					userId: statusHubungan === 'Kepala Keluarga' ? targetKeluarga.kepalaKeluargaId : null,
					namaLengkap,
					nikEncrypted: cleanNik ? encryptSensitive(cleanNik) : null,
					statusHubungan,
					tanggalLahir: isoTgl,
					jenisKelamin,
					tempatLahir: tempatLahir || null,
					profesi: profesi || null,
					golonganDarah: golonganDarah || null,
					noTelepon: cleanNoTelepon,
					statusPernikahan: resolvedPernikahan,
					statusGenerus: resolvedGenerus,
					statusJamaah: statusJamaah === 'Aktif' ? 'Aktif' : 'Tidak Aktif',
					isrun: isrun === 'Ya' ? 'Ya' : 'Tidak'
				})
			);
		} catch (err) {
			console.error('Gagal menambahkan anggota keluarga:', err);
			return fail(500, { error: 'Terjadi kesalahan sistem saat menambahkan anggota.' });
		}

		return {
			success: 'Anggota keluarga baru berhasil ditambahkan.'
		};
	},

	createMemberAccount: async ({ request, locals }) => {
		if (!locals.user || !locals.isAdmin) {
			throw redirect(303, '/login');
		}

		const formData = await request.formData();
		const anggotaId = formData.get('anggotaId')?.toString() || '';
		const email = formData.get('email')?.toString()?.trim() || '';
		const noTelepon = formData.get('noTelepon')?.toString()?.trim() || '';
		const rawPassword = formData.get('password')?.toString()?.trim();
		const password = rawPassword || 'jokam354';

		if (!anggotaId) {
			return fail(400, { errorAccount: 'ID anggota keluarga tidak valid.' });
		}
		if (!password || password.length < 6) {
			return fail(400, { errorAccount: 'Kata sandi akun minimal 6 karakter.' });
		}
		const cleanNoTelepon = noTelepon.replace(/\D/g, '');
		if (!cleanNoTelepon) {
			return fail(400, { errorAccount: 'Nomor HP/WhatsApp wajib diisi untuk pembuatan akun anggota.' });
		}
		if (!/^\d{8,16}$/.test(cleanNoTelepon)) {
			return fail(400, { errorAccount: 'Nomor HP harus berupa angka valid (8-16 digit).' });
		}

		const targetAnggota = (await first(db
			.select()
			.from(anggotaKeluarga)
			.where(eq(anggotaKeluarga.id, anggotaId))
			));

		if (!targetAnggota) {
			return fail(404, { errorAccount: 'Data anggota keluarga tidak ditemukan.' });
		}
		if (targetAnggota.userId) {
			return fail(400, { errorAccount: 'Anggota ini sudah memiliki akun login mandiri.' });
		}

		// Cari kelompok keluarga untuk user baru
		const parentKeluarga = (await first(db
			.select({
				kelompokId: users.kelompokId
			})
			.from(keluarga)
			.leftJoin(users, eq(keluarga.kepalaKeluargaId, users.id))
			.where(eq(keluarga.id, targetAnggota.keluargaId))
			));

		const kelompokId = parentKeluarga?.kelompokId || null;

		if (email) {
			const existingEmail = (await first(db
				.select()
				.from(users)
				.where(eq(users.email, email.toLowerCase()))
				));
			if (existingEmail) {
				return fail(400, { errorAccount: 'Email tersebut sudah terdaftar pada akun lain.', field: 'email' });
			}
		}

		const existingPhone = (await first(db
			.select({ id: users.id })
			.from(users)
			.where(eq(users.noTelepon, cleanNoTelepon))
			));
		if (existingPhone) {
			return fail(400, { errorAccount: `Nomor HP ${cleanNoTelepon} sudah terdaftar pada akun lain.`, field: 'noTelepon' });
		}

		const passwordHash = await hashPassword(password);

		try {
			await db.transaction(async (tx) => {
				const [newUser] = (await tx
					.insert(users)
					.values({
						kelompokId,
						namaLengkap: targetAnggota.namaLengkap || 'Jamaah',
						email: email ? email.toLowerCase() : null,
						noTelepon: cleanNoTelepon,
						passwordHash
					})
					.returning()
);
(await tx.update(anggotaKeluarga)
					.set({
						userId: newUser.id,
						noTelepon: cleanNoTelepon
					})
					.where(eq(anggotaKeluarga.id, anggotaId))
);
			});

			return {
				success: 'Akun login mandiri berhasil dibuat untuk anggota keluarga dengan password default: jokam354'
			};
		} catch (err: any) {
			console.error('Gagal membuat akun anggota keluarga:', err);
			const errMsg = err?.message || '';
			if (errMsg.includes('UNIQUE constraint failed: users.email')) {
				return fail(400, { errorAccount: 'Email tersebut sudah terdaftar pada akun lain.', field: 'email' });
			}
			if (errMsg.includes('UNIQUE constraint failed: users.no_telepon')) {
				return fail(400, { errorAccount: 'Nomor HP tersebut sudah terdaftar pada akun lain.', field: 'noTelepon' });
			}
			return fail(500, {
				errorAccount: 'Terjadi kesalahan sistem saat membuat akun login: ' + (errMsg || 'Gagal menyimpan akun')
			});
		}
	},

	/**
	 * Memperbarui data anggota keluarga secara manual versi admin (termasuk isrun, keaktifan, dll)
	 */
	updateAnggota: async ({ request, locals }) => {
		if (!locals.user || !locals.isAdmin) {
			return fail(403, { error: 'Akses ditolak.' });
		}

		const adminScope = getAdminScope(locals.roles);
		const accessibleWilayah = await getAccessibleWilayah(adminScope);

		const formData = await request.formData();
		const anggotaId = formData.get('anggotaId')?.toString() || '';
		const namaLengkap = formData.get('namaLengkap')?.toString()?.trim() || '';
		const nik = formData.get('nik')?.toString()?.trim() || '';
		const statusHubungan = formData.get('statusHubungan')?.toString()?.trim() || '';
		const tanggalLahir = formData.get('tanggalLahir')?.toString()?.trim() || '';
		const jenisKelamin = formData.get('jenisKelamin')?.toString()?.trim() || '';
		const tempatLahir = formData.get('tempatLahir')?.toString()?.trim() || '';
		const profesi = formData.get('profesi')?.toString()?.trim() || '';
		const noTelepon = formData.get('noTelepon')?.toString()?.trim() || '';
		const statusGenerus = formData.get('statusGenerus')?.toString()?.trim() || '';
		const statusPernikahan = formData.get('statusPernikahan')?.toString()?.trim() || '';
		const statusJamaah = formData.get('statusJamaah')?.toString()?.trim() || 'Aktif';
		const isrun = formData.get('isrun')?.toString()?.trim() || 'Tidak';
		const golonganDarah = formData.get('golonganDarah')?.toString()?.trim() || '';

		if (!anggotaId) {
			return fail(400, { error: 'ID anggota keluarga tidak valid.' });
		}

		const existingAnggota = (await first(db
			.select()
			.from(anggotaKeluarga)
			.where(eq(anggotaKeluarga.id, anggotaId))
			));

		if (!existingAnggota) {
			return fail(404, { error: 'Data anggota keluarga tidak ditemukan.' });
		}

		const parentKeluarga = (await first(db
			.select({
				id: keluarga.id,
				kelompokId: users.kelompokId,
				kepalaKeluargaId: keluarga.kepalaKeluargaId
			})
			.from(keluarga)
			.leftJoin(users, eq(keluarga.kepalaKeluargaId, users.id))
			.where(eq(keluarga.id, existingAnggota.keluargaId))
			));

		if (
			parentKeluarga?.kelompokId &&
			!isKelompokAllowed(parentKeluarga.kelompokId, accessibleWilayah.allowedKelompokIdSet, adminScope.isPusat)
		) {
			return fail(403, {
				error: 'Akses ditolak: Anggota keluarga berada di luar cakupan wewenang Anda.'
			});
		}

		if (!namaLengkap || !statusHubungan || !tanggalLahir || !jenisKelamin) {
			return fail(400, {
				error: 'Nama lengkap, status hubungan, tanggal lahir, dan jenis kelamin wajib diisi.'
			});
		}

		const hasAccount =
			!!existingAnggota.userId ||
			(existingAnggota.statusHubungan === 'Kepala Keluarga' && !!parentKeluarga?.kepalaKeluargaId);
		const cleanNoTelepon = noTelepon ? noTelepon.replace(/\D/g, '') : '';

		if (hasAccount) {
			if (!cleanNoTelepon) {
				return fail(400, { error: 'Nomor HP wajib diisi karena anggota ini memiliki akun login.' });
			}
			if (!/^\d{8,16}$/.test(cleanNoTelepon)) {
				return fail(400, { error: 'Nomor HP harus berupa angka valid (8-16 digit).' });
			}
		} else if (cleanNoTelepon) {
			if (!/^\d{8,16}$/.test(cleanNoTelepon)) {
				return fail(400, { error: 'Nomor HP harus berupa angka valid (8-16 digit).' });
			}
		}

		const cleanNik = nik ? nik.trim().replace(/\D/g, '') : '';

		try {
			let resolvedPernikahan = resolveStatusPernikahan(statusHubungan, statusPernikahan);
			if (isStatusGenerusBelumMenikah(statusGenerus)) {
				resolvedPernikahan = 'Belum Menikah';
			} else if (statusGenerus === 'Dewasa Menikah') {
				resolvedPernikahan = 'Sudah Menikah';
			}
			const isoTgl = normalizeDateToISO(tanggalLahir);
			const umur = isoTgl ? hitungUmur(isoTgl) : 0;
			const resolvedGenerus = statusGenerus || (isoTgl ? hitungStatusGenerus(umur, resolvedPernikahan) : null);

			const updatePayload: Record<string, any> = {
				namaLengkap,
				statusHubungan,
				tanggalLahir: isoTgl,
				jenisKelamin,
				tempatLahir: tempatLahir || null,
				profesi: profesi || null,
				noTelepon: cleanNoTelepon || null,
				statusGenerus: resolvedGenerus || null,
				statusPernikahan: resolvedPernikahan,
				statusJamaah: statusJamaah === 'Aktif' ? 'Aktif' : 'Tidak Aktif',
				isrun: isrun === 'Ya' ? 'Ya' : 'Tidak',
				golonganDarah: golonganDarah || null
			};

			if (cleanNik) {
				if (cleanNik.length !== 16) {
					return fail(400, { error: 'NIK harus berupa 16 digit angka jika diisi.' });
				}
				updatePayload.nikEncrypted = encryptSensitive(cleanNik);
			} else {
				updatePayload.nikEncrypted = null;
			}

(await db.update(anggotaKeluarga)
				.set(updatePayload)
				.where(eq(anggotaKeluarga.id, anggotaId))
);
			if (existingAnggota.userId) {
(await db.update(users)
					.set({
						namaLengkap,
						noTelepon: cleanNoTelepon || null
					})
					.where(eq(users.id, existingAnggota.userId))
);
			} else if (parentKeluarga?.kepalaKeluargaId && existingAnggota.statusHubungan === 'Kepala Keluarga') {
(await db.update(anggotaKeluarga)
					.set({ userId: parentKeluarga.kepalaKeluargaId })
					.where(eq(anggotaKeluarga.id, anggotaId))
);
(await db.update(users)
					.set({
						namaLengkap,
						noTelepon: cleanNoTelepon || null
					})
					.where(eq(users.id, parentKeluarga.kepalaKeluargaId))
);
			}

			return {
				success: `Data anggota "${namaLengkap}" berhasil diperbarui.`
			};
		} catch (err) {
			console.error('Gagal memperbarui anggota keluarga:', err);
			return fail(500, { error: 'Terjadi kesalahan sistem saat memperbarui data anggota.' });
		}
	},

	/**
	 * Memperbarui data Kartu Keluarga & domisili/kelompok basis
	 */
	updateKeluarga: async ({ request, locals }) => {
		if (!locals.user || !locals.isAdmin) {
			return fail(403, { error: 'Akses ditolak.' });
		}

		const adminScope = getAdminScope(locals.roles);
		const accessibleWilayah = await getAccessibleWilayah(adminScope);

		const formData = await request.formData();
		const keluargaId = formData.get('keluargaId')?.toString() || '';
		const noKk = formData.get('noKk')?.toString()?.trim() || '';
		const alamatLengkap = formData.get('alamatLengkap')?.toString()?.trim() || '';
		const kelompokIdStr = formData.get('kelompokId')?.toString()?.trim() || '';

		if (!keluargaId) {
			return fail(400, { error: 'ID Kartu Keluarga tidak valid.' });
		}

		const targetKeluarga = (await first(db
			.select({
				id: keluarga.id,
				isKk: keluarga.isKk,
				kepalaKeluargaId: keluarga.kepalaKeluargaId,
				kelompokId: users.kelompokId
			})
			.from(keluarga)
			.leftJoin(users, eq(keluarga.kepalaKeluargaId, users.id))
			.where(eq(keluarga.id, keluargaId))
			));

		if (!targetKeluarga) {
			return fail(404, { error: 'Data keluarga tidak ditemukan.' });
		}

		if (
			targetKeluarga.kelompokId &&
			!isKelompokAllowed(targetKeluarga.kelompokId, accessibleWilayah.allowedKelompokIdSet, adminScope.isPusat)
		) {
			return fail(403, { error: 'Akses ditolak: Kartu Keluarga berada di luar cakupan wewenang Anda.' });
		}

		let newKelompokId: number | null = null;
		if (kelompokIdStr) {
			const parsed = parseInt(kelompokIdStr, 10);
			if (!isNaN(parsed)) {
				if (!isKelompokAllowed(parsed, accessibleWilayah.allowedKelompokIdSet, adminScope.isPusat)) {
					return fail(403, { error: 'Kelompok tujuan berada di luar wewenang Anda.' });
				}
				newKelompokId = parsed;
			}
		}

		const cleanNoKk = noKk ? noKk.trim().replace(/\D/g, '') : '';

		try {
			const keluargaUpdatePayload: Record<string, any> = {
				alamatLengkap: alamatLengkap || null
			};
			if (cleanNoKk) {
				if (cleanNoKk.length !== 16) {
					return fail(400, { error: 'Nomor Kartu Keluarga harus berupa 16 digit angka jika diisi.' });
				}
				keluargaUpdatePayload.noKkEncrypted = encryptSensitive(cleanNoKk);
			} else {
				keluargaUpdatePayload.noKkEncrypted = null;
			}

(await db.update(keluarga)
				.set(keluargaUpdatePayload)
				.where(eq(keluarga.id, keluargaId))
);
			if (newKelompokId !== null) {
				const rawAnggotaWithUser = (await db
					.select({ userId: anggotaKeluarga.userId })
					.from(anggotaKeluarga)
					.where(and(eq(anggotaKeluarga.keluargaId, keluargaId), isNotNull(anggotaKeluarga.userId)))
);
				const userIdsToUpdate: string[] = [];
				if (targetKeluarga.kepalaKeluargaId) {
					userIdsToUpdate.push(targetKeluarga.kepalaKeluargaId);
				}
				for (const a of rawAnggotaWithUser) {
					if (a.userId && !userIdsToUpdate.includes(a.userId)) {
						userIdsToUpdate.push(a.userId);
					}
				}

				if (userIdsToUpdate.length > 0) {
(await db.update(users)
						.set({ kelompokId: newKelompokId })
						.where(inArray(users.id, userIdsToUpdate))
);
				}
			}

			return {
				success: 'Data Kartu Keluarga & domisili berhasil diperbarui.'
			};
		} catch (err) {
			console.error('Gagal memperbarui Kartu Keluarga:', err);
			return fail(500, { error: 'Terjadi kesalahan sistem saat memperbarui data keluarga.' });
		}
	},

	/**
	 * Menghapus Sensus (Kartu Keluarga atau Jamaah Mandiri/Perantau)
	 * Menghapus record anggota_keluarga, keluarga, dan akun user terkait
	 */
	deleteSensus: async ({ request, locals }) => {
		if (!locals.user || !locals.isAdmin) {
			return fail(403, { error: 'Akses ditolak.' });
		}

		const adminScope = getAdminScope(locals.roles);
		const accessibleWilayah = await getAccessibleWilayah(adminScope);

		const formData = await request.formData();
		const keluargaId = formData.get('keluargaId')?.toString() || '';

		if (!keluargaId) {
			return fail(400, { error: 'ID Sensus tidak valid.' });
		}

		const targetKeluarga = (await first(db
			.select({
				id: keluarga.id,
				isKk: keluarga.isKk,
				kepalaKeluargaId: keluarga.kepalaKeluargaId,
				kelompokId: users.kelompokId,
				namaKepala: users.namaLengkap
			})
			.from(keluarga)
			.leftJoin(users, eq(keluarga.kepalaKeluargaId, users.id))
			.where(eq(keluarga.id, keluargaId))
			));

		if (!targetKeluarga) {
			return fail(404, { error: 'Data sensus tidak ditemukan.' });
		}

		if (
			targetKeluarga.kelompokId &&
			!isKelompokAllowed(targetKeluarga.kelompokId, accessibleWilayah.allowedKelompokIdSet, adminScope.isPusat)
		) {
			return fail(403, { error: 'Akses ditolak: Data sensus berada di luar cakupan wewenang Anda.' });
		}

		if (targetKeluarga.kepalaKeluargaId && targetKeluarga.kepalaKeluargaId === locals.user.id) {
			return fail(400, { error: 'Anda tidak dapat menghapus sensus akun Anda sendiri saat sedang login.' });
		}

		try {
			// Kumpulkan semua userId yang terkait dengan KK ini
			const rawAnggotaWithUser = (await db
				.select({ userId: anggotaKeluarga.userId })
				.from(anggotaKeluarga)
				.where(and(eq(anggotaKeluarga.keluargaId, keluargaId), isNotNull(anggotaKeluarga.userId)))
);
			const userIdsToDelete: string[] = [];
			if (targetKeluarga.kepalaKeluargaId && targetKeluarga.kepalaKeluargaId !== locals.user.id) {
				userIdsToDelete.push(targetKeluarga.kepalaKeluargaId);
			}
			for (const a of rawAnggotaWithUser) {
				if (a.userId && a.userId !== locals.user.id && !userIdsToDelete.includes(a.userId)) {
					userIdsToDelete.push(a.userId);
				}
			}

			await db.transaction(async (tx) => {
				// Bersihkan presensi & peran jika ada
				if (userIdsToDelete.length > 0) {
(await tx.delete(userDapukan).where(inArray(userDapukan.userId, userIdsToDelete)));
(await tx.delete(presensiKehadiran).where(inArray(presensiKehadiran.userId, userIdsToDelete)));
				}

				// Hapus seluruh anggota keluarga
				(await tx.delete(anggotaKeluarga).where(eq(anggotaKeluarga.keluargaId, keluargaId)));

				// Hapus record keluarga
				(await tx.delete(keluarga).where(eq(keluarga.id, keluargaId)));

				// Hapus akun user
				if (userIdsToDelete.length > 0) {
(await tx.delete(users).where(inArray(users.id, userIdsToDelete)));
				}
			});

			return {
				success: 'Data sensus berhasil dihapus secara permanen.'
			};
		} catch (err) {
			console.error('Gagal menghapus sensus:', err);
			return fail(500, { error: 'Terjadi kesalahan sistem saat menghapus data sensus.' });
		}
	},

	/**
	 * Memindahkan Sensus ke kelompok lain yang terdaftar dalam wewenang admin
	 */
	pindahKelompok: async ({ request, locals }) => {
		if (!locals.user || !locals.isAdmin) {
			return fail(403, { error: 'Akses ditolak.' });
		}

		const adminScope = getAdminScope(locals.roles);
		const accessibleWilayah = await getAccessibleWilayah(adminScope);

		const formData = await request.formData();
		const keluargaId = formData.get('keluargaId')?.toString() || '';
		const targetKelompokIdStr = formData.get('kelompokId')?.toString()?.trim() || '';

		const targetKelompokId = parseInt(targetKelompokIdStr, 10);
		if (!keluargaId || isNaN(targetKelompokId)) {
			return fail(400, { error: 'ID Sensus dan Kelompok tujuan wajib dipilih.' });
		}

		// Validasi apakah kelompok tujuan ada dan dalam scope
		if (!isKelompokAllowed(targetKelompokId, accessibleWilayah.allowedKelompokIdSet, adminScope.isPusat)) {
			return fail(403, { error: 'Kelompok tujuan berada di luar cakupan wewenang Anda.' });
		}

		const targetKeluarga = (await first(db
			.select({
				id: keluarga.id,
				kepalaKeluargaId: keluarga.kepalaKeluargaId,
				kelompokId: users.kelompokId
			})
			.from(keluarga)
			.leftJoin(users, eq(keluarga.kepalaKeluargaId, users.id))
			.where(eq(keluarga.id, keluargaId))
			));

		if (!targetKeluarga) {
			return fail(404, { error: 'Data sensus tidak ditemukan.' });
		}

		// Validasi kelompok asal
		if (
			targetKeluarga.kelompokId &&
			!isKelompokAllowed(targetKeluarga.kelompokId, accessibleWilayah.allowedKelompokIdSet, adminScope.isPusat)
		) {
			return fail(403, { error: 'Akses ditolak: Data sensus saat ini berada di luar wewenang Anda.' });
		}

		const targetKelompokRow = (await first(db
			.select({ id: kelompok.id, nama: kelompok.nama })
			.from(kelompok)
			.where(eq(kelompok.id, targetKelompokId))
			));

		if (!targetKelompokRow) {
			return fail(404, { error: 'Kelompok tujuan tidak ditemukan di database.' });
		}

		try {
			// Ambil semua anggota keluarga yang punya akun user
			const rawAnggotaWithUser = (await db
				.select({ userId: anggotaKeluarga.userId })
				.from(anggotaKeluarga)
				.where(and(eq(anggotaKeluarga.keluargaId, keluargaId), isNotNull(anggotaKeluarga.userId)))
);
			const userIdsToUpdate: string[] = [];
			if (targetKeluarga.kepalaKeluargaId) {
				userIdsToUpdate.push(targetKeluarga.kepalaKeluargaId);
			}
			for (const a of rawAnggotaWithUser) {
				if (a.userId && !userIdsToUpdate.includes(a.userId)) {
					userIdsToUpdate.push(a.userId);
				}
			}

			await db.transaction(async (tx) => {
				if (userIdsToUpdate.length > 0) {
(await tx.update(users)
						.set({ kelompokId: targetKelompokId })
						.where(inArray(users.id, userIdsToUpdate))
);
				}
			});

			return {
				success: `Sensus berhasil dipindahkan ke kelompok ${targetKelompokRow.nama}.`
			};
		} catch (err) {
			console.error('Gagal memindahkan kelompok sensus:', err);
			return fail(500, { error: 'Terjadi kesalahan sistem saat memindahkan kelompok sensus.' });
		}
	},

	/**
	 * Mengubah status keaktifan jamaah (Aktif / Tidak Aktif) untuk satu individu di dalam KK
	 */
	toggleStatusJamaah: async ({ request, locals }) => {
		if (!locals.user || !locals.isAdmin) {
			return fail(403, { error: 'Akses ditolak.' });
		}

		const adminScope = getAdminScope(locals.roles);
		const accessibleWilayah = await getAccessibleWilayah(adminScope);

		const formData = await request.formData();
		const anggotaId = formData.get('anggotaId')?.toString() || '';
		const statusJamaah = formData.get('statusJamaah')?.toString()?.trim() || '';

		if (!anggotaId || (statusJamaah !== 'Aktif' && statusJamaah !== 'Tidak Aktif')) {
			return fail(400, { error: 'ID anggota atau status keaktifan tidak valid (harus Aktif atau Tidak Aktif).' });
		}

		const targetAnggota = (await first(db
			.select({
				id: anggotaKeluarga.id,
				namaLengkap: anggotaKeluarga.namaLengkap,
				keluargaId: anggotaKeluarga.keluargaId,
				kelompokId: users.kelompokId
			})
			.from(anggotaKeluarga)
			.innerJoin(keluarga, eq(anggotaKeluarga.keluargaId, keluarga.id))
			.leftJoin(users, eq(keluarga.kepalaKeluargaId, users.id))
			.where(eq(anggotaKeluarga.id, anggotaId))
			));

		if (!targetAnggota) {
			return fail(404, { error: 'Data anggota keluarga tidak ditemukan.' });
		}

		if (
			targetAnggota.kelompokId &&
			!isKelompokAllowed(targetAnggota.kelompokId, accessibleWilayah.allowedKelompokIdSet, adminScope.isPusat)
		) {
			return fail(403, { error: 'Akses ditolak: Anggota keluarga berada di luar cakupan wewenang Anda.' });
		}

		try {
(await db.update(anggotaKeluarga)
				.set({ statusJamaah })
				.where(eq(anggotaKeluarga.id, anggotaId))
);
			return {
				success: `Status ${targetAnggota.namaLengkap || 'anggota'} berhasil diubah menjadi ${statusJamaah}.`
			};
		} catch (err) {
			console.error('Gagal memperbarui status keaktifan jamaah:', err);
			return fail(500, { error: 'Terjadi kesalahan sistem saat memperbarui status keaktifan jamaah.' });
		}
	},

	/**
	 * Menjadikan akun sensus sebagai pengurus dengan penugasan Dapukan
	 */
	assignDapukan: async ({ request, locals }) => {
		if (!locals.user || !locals.isAdmin) {
			return fail(403, { error: 'Akses ditolak.' });
		}

		if (!canManageDapukan(locals.roles || [])) {
			return fail(403, {
				error: 'Akses ditolak: Pada tingkat kelompok, hanya pengurus 4S dengan dapukan Kyai atau Sekretaris / Penerobos yang dapat menugaskan pengurus.'
			});
		}

		const adminScope = getAdminScope(locals.roles);
		const accessible = await getAccessibleWilayah(adminScope);

		const formData = await request.formData();
		const userId = formData.get('userId')?.toString()?.trim() || '';
		const tipeDapukan = formData.get('tipeDapukan')?.toString() || 'tetap';
		const dapukanIdStr = formData.get('dapukanId')?.toString() || '';
		const namaDapukanCustom = formData.get('namaDapukanCustom')?.toString()?.trim() || '';
		const tingkatScope = (formData.get('tingkatScope')?.toString() || 'Kelompok') as 'Pusat' | 'Daerah' | 'Desa' | 'Kelompok';
		const kelompokIdStr = formData.get('kelompokId')?.toString() || '';
		const desaIdStr = formData.get('desaId')?.toString() || '';
		const daerahIdStr = formData.get('daerahId')?.toString() || '';

		if (!userId) {
			return fail(400, { error: 'Pilih akun jamaah yang akan diberikan dapukan.' });
		}

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
			return fail(404, { error: 'Data akun jamaah tidak ditemukan.' });
		}

		// Validasi wewenang admin terhadap tingkatScope
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

		const dapukanId = tipeDapukan === 'tetap' && dapukanIdStr ? parseInt(dapukanIdStr, 10) : null;
		if (tipeDapukan === 'tetap' && !dapukanId) {
			return fail(400, { error: 'Pilih dapukan 4S.' });
		}
		if (tipeDapukan === 'custom' && !namaDapukanCustom) {
			return fail(400, { error: 'Tulis nama dapukan tentatif / panitia kustom.' });
		}

		let finalKelompokId: number | null = null;
		let finalDesaId: number | null = null;
		let finalDaerahId: number | null = null;

		if (tingkatScope === 'Kelompok') {
			const kId = kelompokIdStr ? parseInt(kelompokIdStr, 10) : targetUser.kelompokId;
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
			const dId = desaIdStr ? parseInt(desaIdStr, 10) : targetUser.desaId;
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
			const drId = daerahIdStr ? parseInt(daerahIdStr, 10) : targetUser.daerahId;
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
			// Untuk tingkat Pusat, seluruh pengurus bertindak sebagai Admin Pusat / non-4S.
			if (tipeDapukan === 'tetap' && dapukanId) {
				const selectedDapukan = (await first(db.select().from(dapukan).where(eq(dapukan.id, dapukanId))));
				if (!selectedDapukan) {
					return fail(400, { error: 'Dapukan tetap tidak ditemukan.' });
				}
				// Superadmin hanya boleh dibuat oleh seeder, tidak lewat UI
				if (!isDapukanAssignableManually(selectedDapukan.namaDapukan)) {
					return fail(400, { error: 'Dapukan Superadmin tidak dapat ditugaskan secara manual.' });
				}
				if (selectedDapukan.is4S) {
					return fail(400, {
						error: 'Struktur dapukan 4S hanya berlaku hingga tingkat Daerah. Untuk tingkat Pusat, silakan gunakan dapukan Admin Pusat atau kepanitiaan tentatif.'
					});
				}
			}
		}

		// Validasi global: Superadmin tidak boleh ditugaskan lewat UI pada scope manapun
		if (tipeDapukan === 'tetap' && dapukanId) {
			const dapukanTerpilih = await first(db.select().from(dapukan).where(eq(dapukan.id, dapukanId)));
			if (!dapukanTerpilih) {
				return fail(400, { error: 'Dapukan tetap tidak ditemukan.' });
			}
			if (!isDapukanAssignableManually(dapukanTerpilih.namaDapukan)) {
				return fail(400, { error: 'Dapukan Superadmin tidak dapat ditugaskan secara manual.' });
			}
		}

		// Validasi Integritas Dapukan: Kyai hanya boleh ada 1 di setiap lingkup (Kelompok, Desa, Daerah)
		// Sedangkan Wakil Kyai dan dapukan lainnya diperbolehkan lebih dari satu.
		if (tipeDapukan === 'tetap' && dapukanId && tingkatScope !== 'Pusat') {
			const selectedDapukan = (await first(db.select().from(dapukan).where(eq(dapukan.id, dapukanId))));
			const isKyai = selectedDapukan?.namaDapukan.trim().toLowerCase() === 'kyai';

			if (isKyai) {
				const existingAssignment = (await first(db.select().from(userDapukan).where(eq(userDapukan.userId, userId))));
				const queryScope = db
					.select({
						id: userDapukan.id,
						namaLengkap: users.namaLengkap
					})
					.from(userDapukan)
					.innerJoin(users, eq(userDapukan.userId, users.id))
					.where(
						and(
							existingAssignment ? ne(userDapukan.id, existingAssignment.id) : undefined,
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
			const existingAssignment = (await first(db.select().from(userDapukan).where(eq(userDapukan.userId, userId))));
			if (existingAssignment) {
(await db.update(userDapukan)
					.set({
						dapukanId,
						namaDapukanCustom: tipeDapukan === 'custom' ? namaDapukanCustom : null,
						tingkatScope,
						daerahId: finalDaerahId,
						desaId: finalDesaId,
						kelompokId: finalKelompokId
					})
					.where(eq(userDapukan.id, existingAssignment.id))
);
			} else {
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
			}

			return {
				success: `Berhasil menetapkan dapukan untuk ${targetUser.namaLengkap}.`
			};
		} catch (err) {
			console.error('Gagal menugaskan dapukan sensus:', err);
			return fail(500, { error: 'Terjadi kesalahan sistem saat menyimpan penugasan dapukan.' });
		}
	}
};
