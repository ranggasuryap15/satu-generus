/**
 * @file src/routes/(admin)/admin/sensus/+page.server.ts
 * @purpose Rekapitulasi sensus Kartu Keluarga & Jamaah Mandiri/Perantau, metrik dashboard, serta form actions penambahan sensus, anggota, edit anggota/keluarga, dan pembuatan akun mandiri (createMemberAccount)
 * @usedBy src/routes/(admin)/admin/sensus/+page.svelte
 * @dependencies src/lib/db, src/lib/db/schema, src/lib/server/crypto, src/lib/server/auth, src/lib/server/scope, src/lib/utils (normalizeDateToISO), drizzle-orm
 * @publicFunctions load, actions.createSensus, actions.addAnggotaKeluarga, actions.updateAnggota, actions.updateKeluarga, actions.createMemberAccount
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
				if (k.noKkEncrypted) {
					try {
						noKkMasked = maskSensitive(decryptSensitive(k.noKkEncrypted));
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
				let nikMasked = 'Belum Ada NIK';
				const hasNik = !!a.nikEncrypted;
				if (hasNik) {
					try {
						nikMasked = maskSensitive(decryptSensitive(a.nikEncrypted!));
					} catch (_) {
						nikMasked = '****';
					}
				}

				return {
					id: a.id,
					userId: a.userId,
					namaLengkap:
						a.namaLengkap ||
						(a.statusHubungan === 'Kepala Keluarga' ? k.kepalaKeluargaNama || 'Kepala Keluarga' : a.statusHubungan),
					nikMasked,
					hasNik,
					statusHubungan: a.statusHubungan,
					tanggalLahir: a.tanggalLahir,
					jenisKelamin: a.jenisKelamin,
					tempatLahir: a.tempatLahir || '-',
					tempatLahirRaw: a.tempatLahir || '',
					profesi: a.profesi || '-',
					profesiRaw: a.profesi || '',
					noTelepon: a.noTelepon || '-',
					noTeleponRaw: a.noTelepon || '',
					statusGenerus: a.statusGenerus || '-',
					statusGenerusRaw: a.statusGenerus || '',
					statusPernikahan: a.statusPernikahan || '-',
					statusPernikahanRaw: a.statusPernikahan || '',
					statusJamaah: a.statusJamaah || 'Aktif',
					isrun: a.isrun || 'Tidak',
					golonganDarah: a.golonganDarah || '-',
					golonganDarahRaw: a.golonganDarah || ''
				};
			});

			return {
				id: k.id,
				isKk,
				noKkMasked,
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
		let noKkEncrypted: string | null = null;
		let anggotaList: Array<{
			namaLengkap?: string;
			nik?: string;
			statusHubungan: string;
			tanggalLahir: string;
			jenisKelamin: string;
		}> = [];

		if (!isMandiri) {
			if (noKk) {
				if (noKk.length !== 16 || !/^\d+$/.test(noKk)) {
					return fail(400, {
						error: 'Nomor Kartu Keluarga harus 16 digit angka jika diisi.'
					});
				}
				noKkEncrypted = encryptSensitive(noKk);
			} else {
				noKkEncrypted = null;
			}

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
				if (a.nik && a.nik.trim()) {
					const cleanNik = a.nik.trim();
					if (cleanNik.length !== 16 || !/^\d+$/.test(cleanNik)) {
						return fail(400, {
							error: `NIK anggota ke-${i + 1} (${a.namaLengkap || 'Anggota'}) harus 16 digit angka jika diisi.`
						});
					}
				}
				if (!a.statusHubungan || !a.tanggalLahir || !a.jenisKelamin) {
					return fail(400, {
						error: `Data anggota ke-${i + 1} belum lengkap (Status, Tanggal Lahir, dan Jenis Kelamin wajib diisi).`
					});
				}
			}
		} else {
			// Validasi Data Diri Jamaah Mandiri / Perantau (Tanpa KK)
			const nikMandiri = formData.get('nik')?.toString()?.trim() || '';
			const tanggalLahirMandiri = formData.get('tanggalLahir')?.toString()?.trim() || '';
			const jenisKelaminMandiri = formData.get('jenisKelamin')?.toString()?.trim() || '';

			if (nikMandiri) {
				if (nikMandiri.length !== 16 || !/^\d+$/.test(nikMandiri)) {
					return fail(400, {
						error: 'NIK jamaah perorangan/perantau harus 16 digit angka jika diisi.'
					});
				}
			}
			if (!tanggalLahirMandiri || !jenisKelaminMandiri) {
				return fail(400, {
					error: 'Tanggal lahir dan jenis kelamin jamaah wajib diisi.'
				});
			}

			noKkEncrypted = null;
			anggotaList = [
				{
					namaLengkap,
					nik: nikMandiri || undefined,
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
					const nikVal = a.nik && a.nik.trim() ? encryptSensitive(a.nik.trim()) : null;

					tx.insert(anggotaKeluarga)
						.values({
							keluargaId: newKeluarga.id,
							userId: isKepala ? newUser.id : null,
							namaLengkap: memberNama,
							nikEncrypted: nikVal,
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

		if (!namaLengkap) {
			return fail(400, { error: 'Nama lengkap anggota keluarga wajib diisi.' });
		}

		if (nik) {
			if (nik.length !== 16 || !/^\d+$/.test(nik)) {
				return fail(400, { error: 'NIK harus berupa 16 digit angka jika diisi.' });
			}
		}

		if (!statusHubungan || !tanggalLahir || !jenisKelamin) {
			return fail(400, { error: 'Status hubungan, tanggal lahir, dan jenis kelamin wajib diisi.' });
		}

		try {
			db.insert(anggotaKeluarga)
				.values({
					keluargaId,
					namaLengkap,
					nikEncrypted: nik ? encryptSensitive(nik) : null,
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
	},

	createMemberAccount: async ({ request, locals }) => {
		if (!locals.user || !locals.isAdmin) {
			throw redirect(303, '/login');
		}

		const formData = await request.formData();
		const anggotaId = formData.get('anggotaId')?.toString() || '';
		const email = formData.get('email')?.toString()?.trim() || '';
		const noTelepon = formData.get('noTelepon')?.toString()?.trim() || '';
		const password = formData.get('password')?.toString() || '';

		if (!anggotaId) {
			return fail(400, { errorAccount: 'ID anggota keluarga tidak valid.' });
		}
		if (!password || password.length < 6) {
			return fail(400, { errorAccount: 'Kata sandi akun minimal 6 karakter.' });
		}
		if (!email && !noTelepon) {
			return fail(400, { errorAccount: 'Minimal isi Email atau Nomor HP untuk kredensial login.' });
		}

		const targetAnggota = db
			.select()
			.from(anggotaKeluarga)
			.where(eq(anggotaKeluarga.id, anggotaId))
			.get();

		if (!targetAnggota) {
			return fail(404, { errorAccount: 'Data anggota keluarga tidak ditemukan.' });
		}
		if (targetAnggota.userId) {
			return fail(400, { errorAccount: 'Anggota ini sudah memiliki akun login mandiri.' });
		}

		// Cari kelompok keluarga untuk user baru
		const parentKeluarga = db
			.select({
				kelompokId: users.kelompokId
			})
			.from(keluarga)
			.leftJoin(users, eq(keluarga.kepalaKeluargaId, users.id))
			.where(eq(keluarga.id, targetAnggota.keluargaId))
			.get();

		const kelompokId = parentKeluarga?.kelompokId || null;

		if (email) {
			const existingEmail = db
				.select()
				.from(users)
				.where(eq(users.email, email.toLowerCase()))
				.get();
			if (existingEmail) {
				return fail(400, { errorAccount: 'Email tersebut sudah terdaftar pada akun lain.' });
			}
		}

		const passwordHash = await hashPassword(password);

		try {
			db.transaction((tx) => {
				const [newUser] = tx
					.insert(users)
					.values({
						kelompokId,
						namaLengkap: targetAnggota.namaLengkap || 'Jamaah',
						email: email ? email.toLowerCase() : null,
						noTelepon: noTelepon || targetAnggota.noTelepon || null,
						passwordHash
					})
					.returning()
					.all();

				tx.update(anggotaKeluarga)
					.set({
						userId: newUser.id,
						noTelepon: noTelepon || targetAnggota.noTelepon
					})
					.where(eq(anggotaKeluarga.id, anggotaId))
					.run();
			});

			return {
				success: 'Akun login mandiri berhasil dibuat untuk anggota keluarga!'
			};
		} catch (err) {
			console.error('Gagal membuat akun anggota keluarga:', err);
			return fail(500, {
				errorAccount: 'Terjadi kesalahan sistem saat membuat akun login.'
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
		const accessibleWilayah = getAccessibleWilayah(adminScope);

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

		const existingAnggota = db
			.select()
			.from(anggotaKeluarga)
			.where(eq(anggotaKeluarga.id, anggotaId))
			.get();

		if (!existingAnggota) {
			return fail(404, { error: 'Data anggota keluarga tidak ditemukan.' });
		}

		const parentKeluarga = db
			.select({
				id: keluarga.id,
				kelompokId: users.kelompokId,
				kepalaKeluargaId: keluarga.kepalaKeluargaId
			})
			.from(keluarga)
			.leftJoin(users, eq(keluarga.kepalaKeluargaId, users.id))
			.where(eq(keluarga.id, existingAnggota.keluargaId))
			.get();

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

		if (nik) {
			if (nik.length !== 16 || !/^\d+$/.test(nik)) {
				return fail(400, { error: 'NIK harus berupa 16 digit angka jika diisi.' });
			}
		}

		try {
			const updatePayload: Record<string, any> = {
				namaLengkap,
				statusHubungan,
				tanggalLahir: normalizeDateToISO(tanggalLahir),
				jenisKelamin,
				tempatLahir: tempatLahir || null,
				profesi: profesi || null,
				noTelepon: noTelepon || null,
				statusGenerus: statusGenerus || null,
				statusPernikahan: statusPernikahan || null,
				statusJamaah: statusJamaah === 'Aktif' ? 'Aktif' : 'Tidak Aktif',
				isrun: isrun === 'Ya' ? 'Ya' : 'Tidak',
				golonganDarah: golonganDarah || null
			};

			if (nik) {
				updatePayload.nikEncrypted = encryptSensitive(nik);
			}

			db.update(anggotaKeluarga)
				.set(updatePayload)
				.where(eq(anggotaKeluarga.id, anggotaId))
				.run();

			if (existingAnggota.userId) {
				db.update(users)
					.set({
						namaLengkap,
						noTelepon: noTelepon || null
					})
					.where(eq(users.id, existingAnggota.userId))
					.run();
			} else if (parentKeluarga?.kepalaKeluargaId && existingAnggota.statusHubungan === 'Kepala Keluarga') {
				db.update(users)
					.set({
						namaLengkap,
						noTelepon: noTelepon || null
					})
					.where(eq(users.id, parentKeluarga.kepalaKeluargaId))
					.run();
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
		const accessibleWilayah = getAccessibleWilayah(adminScope);

		const formData = await request.formData();
		const keluargaId = formData.get('keluargaId')?.toString() || '';
		const noKk = formData.get('noKk')?.toString()?.trim() || '';
		const alamatLengkap = formData.get('alamatLengkap')?.toString()?.trim() || '';
		const kelompokIdStr = formData.get('kelompokId')?.toString()?.trim() || '';

		if (!keluargaId) {
			return fail(400, { error: 'ID Kartu Keluarga tidak valid.' });
		}

		const targetKeluarga = db
			.select({
				id: keluarga.id,
				isKk: keluarga.isKk,
				kepalaKeluargaId: keluarga.kepalaKeluargaId,
				kelompokId: users.kelompokId
			})
			.from(keluarga)
			.leftJoin(users, eq(keluarga.kepalaKeluargaId, users.id))
			.where(eq(keluarga.id, keluargaId))
			.get();

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

		if (noKk) {
			if (noKk.length !== 16 || !/^\d+$/.test(noKk)) {
				return fail(400, { error: 'Nomor KK harus berupa 16 digit angka jika diisi.' });
			}
		}

		try {
			const keluargaUpdatePayload: Record<string, any> = {
				alamatLengkap: alamatLengkap || null
			};
			if (noKk) {
				keluargaUpdatePayload.noKkEncrypted = encryptSensitive(noKk);
			}

			db.update(keluarga)
				.set(keluargaUpdatePayload)
				.where(eq(keluarga.id, keluargaId))
				.run();

			if (newKelompokId !== null && targetKeluarga.kepalaKeluargaId) {
				db.update(users)
					.set({ kelompokId: newKelompokId })
					.where(eq(users.id, targetKeluarga.kepalaKeluargaId))
					.run();
			}

			return {
				success: 'Data Kartu Keluarga & domisili berhasil diperbarui.'
			};
		} catch (err) {
			console.error('Gagal memperbarui Kartu Keluarga:', err);
			return fail(500, { error: 'Terjadi kesalahan sistem saat memperbarui data keluarga.' });
		}
	}
};
