/**
 * @file src/routes/(admin)/admin/sensus/batch/+page.server.ts
 * @purpose Server load & action untuk batch insert hierarki keluarga, mengikat anggota ke kartu keluarga yang sama (dengan atau tanpa No KK), kalkulasi otomatis generus, validasi noTelepon (wajib jika buat akun, opsional jika tidak), dan pembuatan akun login dengan default password jokam354
 * @usedBy src/routes/(admin)/admin/sensus/batch/+page.svelte
 * @dependencies src/lib/db, src/lib/db/schema, src/lib/server/crypto, src/lib/server/auth, src/lib/server/scope, src/lib/generus, src/lib/utils, drizzle-orm
 * @publicFunctions load, actions.default
 * @sideEffects Menulis record massal ke tabel users, keluarga, dan anggota_keluarga dalam satu transaksi SQLite atomik
 */

import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '#lib/db/index.js';
import { keluarga, anggotaKeluarga, users } from '#lib/db/schema.js';
import { encryptSensitive } from '#lib/server/crypto.js';
import { hashPassword } from '#lib/server/auth.js';
import { getAdminScope, getAccessibleWilayah, isKelompokAllowed } from '#lib/server/scope.js';
import { normalizeDateToISO } from '#lib/utils.js';
import { cleanPhoneNumber, hitungStatusGenerus, hitungUmur, isStatusHubunganKepala, resolveStatusPernikahan, type StatusPernikahanType } from '#lib/generus.js';

export interface BatchRowInput {
	id?: string;
	kelompokId?: number | string;
	namaLengkap: string;
	jenisKelamin: 'L' | 'P';
	tempatLahir?: string;
	tanggalLahir: string;
	umur?: number;
	alamat?: string;
	profesi?: string;
	noTelepon?: string;
	statusGenerus?: string;
	statusMenikah: StatusPernikahanType;
	statusKeluarga: string;
	noKk?: string;
	nik?: string;
	statusJamaah?: 'Aktif' | 'Tidak Aktif';
	isrun?: 'Ya' | 'Tidak';
	golonganDarah?: string;
	buatAkun?: boolean;
	email?: string;
	password?: string;
}

export interface FamilyBatchGroup {
	id?: string;
	noKk?: string;
	alamat?: string;
	isPerantau?: boolean;
	kelompokId?: number | string;
	members: BatchRowInput[];
}

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user || !locals.isAdmin) {
		throw redirect(303, '/login');
	}

	const adminScope = getAdminScope(locals.roles);
	const accessibleWilayah = await getAccessibleWilayah(adminScope);

	return {
		wilayahOptions: {
			kelompokList: accessibleWilayah.kelompokList.map((k) => ({
				id: k.id,
				nama: k.nama,
				desaNama: k.desaNama,
				daerahNama: k.daerahNama
			}))
		}
	};
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		if (!locals.user || !locals.isAdmin) {
			throw redirect(303, '/login');
		}

		const formData = await request.formData();
		const rawBatchData = formData.get('batchData')?.toString() || '[]';
		const defaultPassword = formData.get('defaultPassword')?.toString() || 'jokam354';
		const defaultKelompokIdRaw = formData.get('defaultKelompokId')?.toString() || '';
		const defaultKelompokId =
			defaultKelompokIdRaw && defaultKelompokIdRaw !== 'ALL' && !isNaN(Number(defaultKelompokIdRaw))
				? parseInt(defaultKelompokIdRaw, 10)
				: null;

		let parsedData: any;
		try {
			parsedData = JSON.parse(rawBatchData);
		} catch (_) {
			return fail(400, { error: 'Format data batch tidak valid.' });
		}

		if (!Array.isArray(parsedData) || parsedData.length === 0) {
			return fail(400, { error: 'Belum ada data keluarga yang diisi untuk diproses.' });
		}

		// Normalisasi ke format FamilyBatchGroup[]
		let familyGroups: FamilyBatchGroup[] = [];
		if ('members' in parsedData[0] && Array.isArray(parsedData[0].members)) {
			familyGroups = parsedData as FamilyBatchGroup[];
		} else {
			// Fallback jika format flat list legacy
			const flatRows = parsedData as BatchRowInput[];
			let standaloneIdx = 0;
			const tempMap = new Map<string, BatchRowInput[]>();
			for (const r of flatRows) {
				const isP =
					r.statusKeluarga?.toLowerCase().includes('perantau') ||
					r.statusKeluarga?.toLowerCase() === 'mandiri';
				const key = isP || !r.noKk?.trim() ? `__AUTO_${++standaloneIdx}__` : r.noKk.trim();
				const arr = tempMap.get(key) || [];
				arr.push(r);
				tempMap.set(key, arr);
			}
			for (const [key, mems] of tempMap.entries()) {
				const isP = key.startsWith('__AUTO_');
				familyGroups.push({
					id: key,
					noKk: isP ? '' : key,
					isPerantau: isP,
					members: mems
				});
			}
		}

		const adminScope = getAdminScope(locals.roles);
		const accessibleWilayah = await getAccessibleWilayah(adminScope);

		// Validasi dasar tiap anggota di dalam setiap keluarga
		let totalJiwa = 0;
		for (let fIdx = 0; fIdx < familyGroups.length; fIdx++) {
			const fam = familyGroups[fIdx];
			if (!fam.members || fam.members.length === 0) continue;

			for (let mIdx = 0; mIdx < fam.members.length; mIdx++) {
				const m = fam.members[mIdx];
				const nama = m.namaLengkap?.trim();
				if (!nama) {
					return fail(400, {
						error: `Keluarga #${fIdx + 1}, Anggota #${mIdx + 1}: Nama lengkap wajib diisi.`
					});
				}
				if (!m.tanggalLahir?.trim()) {
					return fail(400, {
						error: `Keluarga #${fIdx + 1} (${nama}): Tanggal lahir wajib diisi.`
					});
				}
				if (!m.statusKeluarga?.trim()) {
					return fail(400, {
						error: `Keluarga #${fIdx + 1} (${nama}): Hubungan keluarga wajib dipilih (tidak boleh kosong).`
					});
				}

				const cleanHp = m.noTelepon ? m.noTelepon.trim().replace(/\D/g, '') : '';
				if (m.buatAkun) {
					if (!cleanHp) {
						return fail(400, {
							error: `Keluarga #${fIdx + 1} (${nama}): Nomor HP wajib diisi jika membuat akun login.`
						});
					}
					if (!/^\d{8,16}$/.test(cleanHp)) {
						return fail(400, {
							error: `Keluarga #${fIdx + 1} (${nama}): Nomor HP harus berupa angka valid (8-16 digit).`
						});
					}
				} else if (cleanHp) {
					if (!/^\d{8,16}$/.test(cleanHp)) {
						return fail(400, {
							error: `Keluarga #${fIdx + 1} (${nama}): Nomor HP harus berupa angka valid (8-16 digit).`
						});
					}
				}

				let kId = m.kelompokId
					? parseInt(String(m.kelompokId), 10)
					: fam.kelompokId
						? parseInt(String(fam.kelompokId), 10)
						: defaultKelompokId;

				if (!kId) {
					return fail(400, {
						error: `Keluarga #${fIdx + 1} (${nama}): Kelompok belum dipilih.`
					});
				}

				if (!isKelompokAllowed(kId, accessibleWilayah.allowedKelompokIdSet, adminScope.isPusat)) {
					return fail(403, {
						error: `Keluarga #${fIdx + 1} (${nama}): Anda tidak memiliki wewenang untuk kelompok ID ${kId}.`
					});
				}
				totalJiwa++;
			}
		}

		if (totalJiwa === 0) {
			return fail(400, { error: 'Belum ada data anggota keluarga yang diisi untuk diproses.' });
		}

		// Optimasi CPU: Pre-hash default password sekali saja
		const defaultPasswordHash = await hashPassword(defaultPassword);

		// Persiapan data existing users untuk mencegah crash unik email
		const existingUserEmails = new Set(
(await db
				.select({ email: users.email })
				.from(users)
				)
				.filter((u) => !!u.email)
				.map((u) => u.email!.toLowerCase())
		);
		let totalUsersCreated = 0;
		let totalKeluargaCreated = 0;
		let totalAnggotaCreated = 0;
		const createdKeluargaIds: string[] = [];

		try {
			await db.transaction(async (tx) => {
				for (const fam of familyGroups) {
					if (!fam.members || fam.members.length === 0) continue;

					const isActualKk = !fam.isPerantau;
					const rawNoKk = fam.noKk ? fam.noKk.trim().replace(/\D/g, '').slice(0, 16) : '';
					const noKkEncrypted =
						isActualKk && rawNoKk ? encryptSensitive(rawNoKk) : null;

					// Cari kepala keluarga (Kepala Keluarga, Bapak, Suami, Mandiri), fallback index 0
					let headIndex = fam.members.findIndex((m) => isStatusHubunganKepala(m.statusKeluarga));
					if (headIndex === -1) {
						headIndex = 0;
					}

					let kepalaKeluargaUserId: string | null = null;
					const familyAlamat =
						fam.alamat?.trim() ||
						fam.members.find((m) => m.alamat && m.alamat.trim())?.alamat?.trim() ||
						'-';

					const memberUserIds: Array<string | null> = new Array(fam.members.length).fill(null);

					// 1. Proses pembuatan akun user jika diminta
					for (let i = 0; i < fam.members.length; i++) {
						const m = fam.members[i];
						if (m.buatAkun) {
							let userEmail = m.email?.trim()?.toLowerCase() || null;
							if (userEmail && existingUserEmails.has(userEmail)) {
								userEmail = null;
							}
							if (userEmail) existingUserEmails.add(userEmail);

							const kId = m.kelompokId
								? parseInt(String(m.kelompokId), 10)
								: fam.kelompokId
									? parseInt(String(fam.kelompokId), 10)
									: defaultKelompokId;

							const cleanHp = m.noTelepon ? m.noTelepon.trim().replace(/\D/g, '') : null;

							const [createdUser] = await tx
								.insert(users)
								.values({
									kelompokId: kId,
									namaLengkap: m.namaLengkap.trim(),
									email: userEmail,
									noTelepon: cleanHp || null,
									passwordHash: defaultPasswordHash
								})
								.returning();
							memberUserIds[i] = createdUser.id;
							totalUsersCreated++;

							if (i === headIndex) {
								kepalaKeluargaUserId = createdUser.id;
							}
						}
					}

					// 2. Buat record keluarga (1 KK atau 1 Mandiri/Perantau)
					const [newKeluarga] = await tx
						.insert(keluarga)
						.values({
							isKk: isActualKk,
							noKkEncrypted,
							kepalaKeluargaId: kepalaKeluargaUserId,
							alamatLengkap: familyAlamat
						})
						.returning();
					createdKeluargaIds.push(newKeluarga.id);
					totalKeluargaCreated++;

					// 3. Simpan seluruh anggota keluarga ke dalam record keluarga ini
					for (let i = 0; i < fam.members.length; i++) {
						const m = fam.members[i];
						const statusHubunganFinal = m.statusKeluarga || (i === 0 ? 'Kepala Keluarga' : 'Anak');
						const statusMenikahFinal = resolveStatusPernikahan(statusHubunganFinal, m.statusMenikah);
						const umurCalc = hitungUmur(m.tanggalLahir);
						// Status Generus selalu otomatis mengikuti umur & status pernikahan
						const statusGenerusFinal = hitungStatusGenerus(umurCalc, statusMenikahFinal);

						const rawNik = m.nik ? m.nik.trim().replace(/\D/g, '').slice(0, 16) : '';
						const nikEncrypted = rawNik ? encryptSensitive(rawNik) : null;

						await tx.insert(anggotaKeluarga).values({
							keluargaId: newKeluarga.id,
							userId: memberUserIds[i] || null,
							namaLengkap: m.namaLengkap.trim(),
							nikEncrypted,
							statusHubungan: statusHubunganFinal,
							tanggalLahir: normalizeDateToISO(m.tanggalLahir),
							jenisKelamin: m.jenisKelamin === 'P' ? 'P' : 'L',
							tempatLahir: m.tempatLahir?.trim() || null,
							profesi: m.profesi?.trim() || null,
							noTelepon: m.noTelepon?.trim() || null,
							statusGenerus: statusGenerusFinal,
							statusPernikahan: statusMenikahFinal,
							statusJamaah: m.statusJamaah || 'Aktif',
							isrun: m.isrun || 'Tidak',
							golonganDarah: m.golonganDarah && m.golonganDarah !== '-' ? m.golonganDarah.trim() : null
						});
						totalAnggotaCreated++;
					}
				}
			});
		} catch (dbErr) {
			console.error('Error saat transaksi batch insert sensus:', dbErr);
			return fail(500, {
				error: 'Terjadi kesalahan sistem saat menyimpan data batch sensus ke database.'
			});
		}

		return {
			success: true,
			summary: {
				totalJiwa: totalAnggotaCreated,
				totalKeluarga: totalKeluargaCreated,
				totalAkun: totalUsersCreated
			},
			importedBatch: {
				keluargaIds: createdKeluargaIds,
				totalKeluarga: totalKeluargaCreated,
				totalJiwa: totalAnggotaCreated,
				totalAkun: totalUsersCreated,
				timestamp: Date.now()
			}
		};
	}
};
