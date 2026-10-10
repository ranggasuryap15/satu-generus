/**
 * @file src/routes/(admin)/admin/sensus/+page.server.ts
 * @purpose Rekapitulasi sensus Kartu Keluarga & Jamaah Mandiri/Perantau, metrik dashboard, serta form actions penambahan sensus dan anggota keluarga dengan proteksi RBAC
 * @usedBy src/routes/(admin)/admin/sensus/+page.svelte
 * @dependencies src/lib/db, src/lib/db/schema, src/lib/server/crypto, src/lib/server/auth, src/lib/server/scope, src/lib/utils (normalizeDateToISO), drizzle-orm
 * @publicFunctions load, actions.createSensus, actions.addAnggotaKeluarga
 * @sideEffects Transaksi penulisan database tabel users, keluarga, anggota_keluarga; query join multi-tabel terindeks
 */

import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/db';
import { keluarga, anggotaKeluarga, users, kelompok, desa, daerah, userDapukan, dapukan } from '$lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { decryptSensitive, encryptSensitive, maskSensitive } from '$lib/server/crypto';
import { hashPassword } from '$lib/server/auth';
import { getAdminScope, getAccessibleWilayah, isKelompokAllowed } from '$lib/server/scope';
import { normalizeDateToISO } from '$lib/utils';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user || !locals.isAdmin) {
		throw redirect(303, '/login');
	}

	try {
		// 1. Evaluasi Hierarki Scope Admin (Pusat, Daerah, Desa, Kelompok)
		const adminScope = getAdminScope(locals.roles);
		const accessibleWilayah = getAccessibleWilayah(adminScope);

		// 2. Query Data Keluarga join Users, Kelompok, Desa, Daerah (Single JOIN, 0 N+1)
		const rawKeluargaList = db
			.select({
				id: keluarga.id,
				isKk: keluarga.isKk,
				noKkEncrypted: keluarga.noKkEncrypted,
				alamatLengkap: keluarga.alamatLengkap,
				kepalaKeluargaId: keluarga.kepalaKeluargaId,
				kepalaKeluargaNama: users.namaLengkap,
				kepalaKeluargaEmail: users.email,
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
			.all();

		// Saring keluarga sesuai kelompok yang diizinkan dalam scope admin
		const scopedKeluargaList = rawKeluargaList.filter((k) => {
			if (adminScope.isPusat) return true;
			if (!k.kelompokId) return false;
			return accessibleWilayah.allowedKelompokIdSet.has(k.kelompokId);
		});

		// 3. Batch Query Anggota Keluarga (1 scan, O(1) Map lookup)
		const rawAnggotaList = db.select().from(anggotaKeluarga).all();
		const anggotaByKeluargaMap = new Map<string, typeof rawAnggotaList>();
		for (const a of rawAnggotaList) {
			const list = anggotaByKeluargaMap.get(a.keluargaId) || [];
			list.push(a);
			anggotaByKeluargaMap.set(a.keluargaId, list);
		}

		// 4. Batch Query Peran Pengurus / 4S untuk Kepala Keluarga
		const rawRoles = db
			.select({
				userId: userDapukan.userId,
				dapukanNama: dapukan.namaDapukan,
				namaDapukanCustom: userDapukan.namaDapukanCustom,
				is4S: dapukan.is4S,
				tingkatScope: userDapukan.tingkatScope
			})
			.from(userDapukan)
			.leftJoin(dapukan, eq(userDapukan.dapukanId, dapukan.id))
			.all();

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

		// 5. Transformasi Data dengan Masking
		const daftarKeluarga = scopedKeluargaList.map((k) => {
			const isKk = k.isKk ?? true;
			let noKkMasked = 'Tanpa KK';

			if (isKk) {
				totalKeluarga++;
				try {
					noKkMasked = maskSensitive(decryptSensitive(k.noKkEncrypted));
				} catch (_) {
					noKkMasked = '****';
				}
			} else {
				totalMandiri++;
				noKkMasked = 'Tanpa KK (Perantau)';
			}

			const familyMembers = anggotaByKeluargaMap.get(k.id) || [];
			totalJiwa += familyMembers.length;

			const userRoles = k.kepalaKeluargaId ? roleByUserIdMap.get(k.kepalaKeluargaId) || [] : [];
			const is4S = userRoles.some((r) => r.is4S === true);
			const isPengurus = userRoles.length > 0;
			if (is4S) totalPengurus4S++;
			if (isPengurus) totalPengurus++;

			const primaryRole = userRoles[0];
			const jabatanNama = primaryRole
				? primaryRole.namaDapukanCustom || primaryRole.dapukanNama || 'Pengurus'
				: 'Jamaah Biasa';

			const anggotaFormatted = familyMembers.map((a) => {
				let nikMasked = '****';
				try {
					nikMasked = maskSensitive(decryptSensitive(a.nikEncrypted));
				} catch (_) {}

				return {
					id: a.id,
					namaLengkap:
						a.namaLengkap ||
						(a.statusHubungan === 'Kepala Keluarga' ? k.kepalaKeluargaNama || 'Kepala Keluarga' : a.statusHubungan),
					nikMasked,
					statusHubungan: a.statusHubungan,
					tanggalLahir: a.tanggalLahir,
					jenisKelamin: a.jenisKelamin
				};
			});

			return {
				id: k.id,
				isKk,
				noKkMasked,
				alamatLengkap: k.alamatLengkap || '-',
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
				jabatanNama,
				jumlahAnggota: anggotaFormatted.length,
				anggota: anggotaFormatted
			};
		});

		// 6. Ringkasan Metrik Dashboard
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
		const accessibleWilayah = getAccessibleWilayah(adminScope);

		const formData = await request.formData();
		const namaLengkap = formData.get('namaLengkap')?.toString()?.trim() || '';
		const email = formData.get('email')?.toString()?.trim()?.toLowerCase() || '';
		const kelompokIdStr = formData.get('kelompokId')?.toString()?.trim() || '';
		const noKk = formData.get('noKk')?.toString()?.trim() || '';
		const alamatLengkap = formData.get('alamatLengkap')?.toString()?.trim() || '';
		const anggotaJson = formData.get('anggotaData')?.toString() || '[]';

		const kelompokId = parseInt(kelompokIdStr, 10);

		// Validasi Kelengkapan Akun & Wilayah
		if (!namaLengkap || !email || isNaN(kelompokId)) {
			return fail(400, {
				error: 'Nama lengkap, email, dan kelompok basis wajib diisi.'
			});
		}

		// Validasi Strict Scope Admin
		if (!isKelompokAllowed(kelompokId, accessibleWilayah.allowedKelompokIdSet, adminScope.isPusat)) {
			return fail(403, {
				error: 'Anda tidak memiliki hak wewenang untuk mendaftarkan jamaah di kelompok ini.'
			});
		}

		// Validasi Keunikan Email
		const existingUser = db.select({ id: users.id }).from(users).where(eq(users.email, email)).get();
		if (existingUser) {
			return fail(400, {
				error: `Email ${email} sudah terdaftar pada akun lain.`
			});
		}

		const tipeSensus = formData.get('tipeSensus')?.toString()?.trim() || 'keluarga';
		const isMandiri = tipeSensus === 'mandiri';

		// Validasi Nomor KK jika tipe sensus adalah Kartu Keluarga
		let noKkEncrypted = '';
		let anggotaList: Array<{
			namaLengkap?: string;
			nik: string;
			statusHubungan: string;
			tanggalLahir: string;
			jenisKelamin: string;
		}> = [];

		if (!isMandiri) {
			if (!noKk || noKk.length !== 16 || !/^\d+$/.test(noKk)) {
				return fail(400, {
					error: 'Nomor Kartu Keluarga wajib 16 digit angka.'
				});
			}
			noKkEncrypted = encryptSensitive(noKk);

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
				if (!a.nik || a.nik.length !== 16 || !/^\d+$/.test(a.nik)) {
					return fail(400, {
						error: `NIK anggota ke-${i + 1} wajib 16 digit angka.`
					});
				}
				if (!a.statusHubungan || !a.tanggalLahir || !a.jenisKelamin) {
					return fail(400, {
						error: `Data anggota ke-${i + 1} belum lengkap.`
					});
				}
			}
		} else {
			// Validasi Data Diri Jamaah Mandiri / Perantau (Tanpa KK)
			const nikMandiri = formData.get('nik')?.toString()?.trim() || '';
			const tanggalLahirMandiri = formData.get('tanggalLahir')?.toString()?.trim() || '';
			const jenisKelaminMandiri = formData.get('jenisKelamin')?.toString()?.trim() || '';

			if (!nikMandiri || nikMandiri.length !== 16 || !/^\d+$/.test(nikMandiri)) {
				return fail(400, {
					error: 'NIK jamaah perorangan/perantau wajib 16 digit angka.'
				});
			}
			if (!tanggalLahirMandiri || !jenisKelaminMandiri) {
				return fail(400, {
					error: 'Tanggal lahir dan jenis kelamin jamaah wajib diisi.'
				});
			}

			noKkEncrypted = encryptSensitive('MANDIRI');
			anggotaList = [
				{
					namaLengkap,
					nik: nikMandiri,
					statusHubungan: 'Mandiri / Perantau',
					tanggalLahir: tanggalLahirMandiri,
					jenisKelamin: jenisKelaminMandiri
				}
			];
		}

		// Password Baku Default Sesuai Spesifikasi: 'jokam354'
		const defaultHash = await hashPassword('jokam354');

		// Eksekusi Transaksi DB Atomik (Minimum Lock)
		try {
			db.transaction((tx) => {
				// 1. Buat Akun Jamaah Baru
				const [newUser] = tx
					.insert(users)
					.values({
						namaLengkap,
						email,
						passwordHash: defaultHash,
						kelompokId
					})
					.returning()
					.all();

				// 2. Buat Record Sensus (isKk: false untuk Mandiri/Perantau agar tidak dihitung KK)
				const [newKeluarga] = tx
					.insert(keluarga)
					.values({
						isKk: !isMandiri,
						noKkEncrypted,
						kepalaKeluargaId: newUser.id,
						alamatLengkap
					})
					.returning()
					.all();

				// 3. Masukkan Anggota Keluarga / Data Diri Jiwa
				for (let i = 0; i < anggotaList.length; i++) {
					const a = anggotaList[i];
					const isKepala = isMandiri || a.statusHubungan === 'Kepala Keluarga' || i === 0;
					const memberNama = a.namaLengkap?.trim() || (isKepala ? namaLengkap : a.statusHubungan);

					tx.insert(anggotaKeluarga)
						.values({
							keluargaId: newKeluarga.id,
							userId: isKepala ? newUser.id : null,
							namaLengkap: memberNama,
							nikEncrypted: encryptSensitive(a.nik),
							statusHubungan: a.statusHubungan,
							tanggalLahir: normalizeDateToISO(a.tanggalLahir),
							jenisKelamin: a.jenisKelamin
						})
						.run();
				}
			});
		} catch (err) {
			console.error('Gagal membuat sensus baru:', err);
			return fail(500, {
				error: 'Terjadi kesalahan sistem saat menyimpan data sensus.'
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
		const accessibleWilayah = getAccessibleWilayah(adminScope);

		const formData = await request.formData();
		const keluargaId = formData.get('keluargaId')?.toString()?.trim() || '';
		const namaLengkap = formData.get('namaLengkap')?.toString()?.trim() || '';
		const nik = formData.get('nik')?.toString()?.trim() || '';
		const statusHubungan = formData.get('statusHubungan')?.toString()?.trim() || '';
		const tanggalLahir = formData.get('tanggalLahir')?.toString()?.trim() || '';
		const jenisKelamin = formData.get('jenisKelamin')?.toString()?.trim() || '';

		if (!keluargaId) {
			return fail(400, { error: 'ID Kartu Keluarga tidak valid.' });
		}

		// Cari keluarga dan verifikasi scope
		const targetKeluarga = db
			.select({
				id: keluarga.id,
				kelompokId: users.kelompokId
			})
			.from(keluarga)
			.leftJoin(users, eq(keluarga.kepalaKeluargaId, users.id))
			.where(eq(keluarga.id, keluargaId))
			.get();

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

		if (!namaLengkap || !nik || nik.length !== 16 || !/^\d+$/.test(nik)) {
			return fail(400, { error: 'Nama lengkap dan 16 digit NIK wajib diisi.' });
		}

		if (!statusHubungan || !tanggalLahir || !jenisKelamin) {
			return fail(400, { error: 'Semua kolom data anggota keluarga wajib diisi.' });
		}

		try {
			db.insert(anggotaKeluarga)
				.values({
					keluargaId,
					namaLengkap,
					nikEncrypted: encryptSensitive(nik),
					statusHubungan,
					tanggalLahir: normalizeDateToISO(tanggalLahir),
					jenisKelamin
				})
				.run();
		} catch (err) {
			console.error('Gagal menambahkan anggota keluarga:', err);
			return fail(500, { error: 'Terjadi kesalahan sistem saat menambahkan anggota.' });
		}

		return {
			success: 'Anggota keluarga baru berhasil ditambahkan.'
		};
	}
};
