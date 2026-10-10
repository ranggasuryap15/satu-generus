/**
 * @file src/routes/(admin)/admin/sensus/batch/+page.server.ts
 * @purpose Server load & action untuk batch insert sensus keluarga, kalkulasi otomatis generus, dan pembuatan akun login
 * @usedBy src/routes/(admin)/admin/sensus/batch/+page.svelte
 * @dependencies src/lib/db, src/lib/db/schema, src/lib/server/crypto, src/lib/server/auth, src/lib/server/scope, src/lib/generus, src/lib/utils, drizzle-orm
 * @publicFunctions load, actions.default
 * @sideEffects Menulis record massal ke tabel users, keluarga, dan anggota_keluarga dalam satu transaksi SQLite atomik
 */

import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/db';
import { keluarga, anggotaKeluarga, users } from '$lib/db/schema';
import { encryptSensitive } from '$lib/server/crypto';
import { hashPassword } from '$lib/server/auth';
import { getAdminScope, getAccessibleWilayah, isKelompokAllowed } from '$lib/server/scope';
import { normalizeDateToISO } from '$lib/utils';
import { hitungStatusGenerus, hitungUmur } from '$lib/generus';
import { eq } from 'drizzle-orm';

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
	statusMenikah: 'Belum Menikah' | 'Sudah Menikah';
	statusKeluarga: string; // 'Bapak', 'Ibu', 'Anak', dll
	noKk?: string; // e.g. TB1-01 atau nomor KK
	nik?: string;
	statusJamaah?: 'Aktif' | 'Tidak Aktif';
	isrun?: 'Ya' | 'Tidak';
	golonganDarah?: string;
	isPerantau?: boolean;
	buatAkun?: boolean;
	email?: string;
	password?: string;
}

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user || !locals.isAdmin) {
		throw redirect(303, '/login');
	}

	const adminScope = getAdminScope(locals.roles);
	const accessibleWilayah = getAccessibleWilayah(adminScope);

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
		const defaultPassword = formData.get('defaultPassword')?.toString() || '12345678';
		const defaultKelompokIdRaw = formData.get('defaultKelompokId')?.toString() || '';
		const defaultKelompokId = defaultKelompokIdRaw ? parseInt(defaultKelompokIdRaw, 10) : null;

		let rows: BatchRowInput[] = [];
		try {
			rows = JSON.parse(rawBatchData);
		} catch (_) {
			return fail(400, { error: 'Format data batch tidak valid.' });
		}

		if (!Array.isArray(rows) || rows.length === 0) {
			return fail(400, { error: 'Belum ada data baris yang diisi untuk diproses.' });
		}

		const adminScope = getAdminScope(locals.roles);
		const accessibleWilayah = getAccessibleWilayah(adminScope);

		// Validasi dasar tiap baris
		const validRows: Array<BatchRowInput & { finalKelompokId: number | null }> = [];
		for (let i = 0; i < rows.length; i++) {
			const r = rows[i];
			const nama = r.namaLengkap?.trim();
			if (!nama) {
				return fail(400, { error: `Baris ke-${i + 1}: Nama lengkap wajib diisi.` });
			}
			if (!r.tanggalLahir?.trim()) {
				return fail(400, { error: `Baris ke-${i + 1} (${nama}): Tanggal lahir wajib diisi.` });
			}

			let kId = r.kelompokId ? parseInt(String(r.kelompokId), 10) : defaultKelompokId;
			if (kId && !isKelompokAllowed(kId, accessibleWilayah.allowedKelompokIdSet, adminScope.isPusat)) {
				return fail(403, {
					error: `Baris ke-${i + 1} (${nama}): Anda tidak memiliki wewenang untuk kelompok ID ${kId}.`
				});
			}

			validRows.push({
				...r,
				namaLengkap: nama,
				finalKelompokId: kId || null
			});
		}

		// Optimasi CPU: Pre-hash default password sekali saja
		const defaultPasswordHash = await hashPassword(defaultPassword);

		// Kelompokkan data per keluarga berdasarkan nilai noKk
		// Jika perantau atau noKk kosong / mandiri, buat grup terpisah
		const familyGroups = new Map<string, typeof validRows>();
		let standaloneIndex = 0;

		for (const r of validRows) {
			const isPerantau =
				!!r.isPerantau ||
				r.statusKeluarga.toLowerCase().includes('perantau') ||
				r.statusKeluarga.toLowerCase() === 'mandiri';
			const kkKey = isPerantau ? '' : r.noKk?.trim();
			if (kkKey) {
				const group = familyGroups.get(kkKey) || [];
				group.push(r);
				familyGroups.set(kkKey, group);
			} else {
				standaloneIndex++;
				familyGroups.set(`__STANDALONE_${standaloneIndex}__`, [r]);
			}
		}

		// Persiapan data existing users untuk mencegah crash unik email
		const existingUserEmails = new Set(
			db
				.select({ email: users.email })
				.from(users)
				.all()
				.filter((u) => !!u.email)
				.map((u) => u.email!.toLowerCase())
		);

		let totalUsersCreated = 0;
		let totalKeluargaCreated = 0;
		let totalAnggotaCreated = 0;

		try {
			db.transaction((tx) => {
				for (const [kkKey, members] of familyGroups.entries()) {
					const isActualKk = !kkKey.startsWith('__STANDALONE_');
					const noKkEncrypted = isActualKk ? encryptSensitive(kkKey) : null;

					// Cari kepala keluarga: anggota dengan status 'Bapak' atau 'Kepala Keluarga'
					let headIndex = members.findIndex(
						(m) =>
							m.statusKeluarga.toLowerCase() === 'bapak' ||
							m.statusKeluarga.toLowerCase() === 'kepala keluarga'
					);
					if (headIndex === -1) {
						headIndex = 0; // Default ke baris pertama
					}

					let kepalaKeluargaUserId: string | null = null;
					const headMember = members[headIndex];

					// Tentukan alamat keluarga dari kepala atau default
					const familyAlamat =
						members.find((m) => m.alamat && m.alamat.trim())?.alamat?.trim() || '-';

					// Map untuk menyimpan userId yang sudah dibuat per member
					const memberUserIds: Array<string | null> = new Array(members.length).fill(null);

					// Proses pembuatan akun user jika diminta
					for (let i = 0; i < members.length; i++) {
						const m = members[i];
						if (m.buatAkun) {
							let userEmail = m.email?.trim()?.toLowerCase() || null;
							if (userEmail && existingUserEmails.has(userEmail)) {
								// Hindari error email ganda
								userEmail = null;
							}
							if (userEmail) existingUserEmails.add(userEmail);

							const customHash =
								m.password && m.password !== defaultPassword
									? null // jika custom, nanti di-hash terpisah jika diperlukan
									: defaultPasswordHash;

							const [createdUser] = tx
								.insert(users)
								.values({
									kelompokId: m.finalKelompokId,
									namaLengkap: m.namaLengkap,
									email: userEmail,
									noTelepon: m.noTelepon?.trim() || null,
									passwordHash: customHash || defaultPasswordHash
								})
								.returning()
								.all();

							memberUserIds[i] = createdUser.id;
							totalUsersCreated++;

							if (i === headIndex) {
								kepalaKeluargaUserId = createdUser.id;
							}
						}
					}

					// Buat record keluarga
					const [newKeluarga] = tx
						.insert(keluarga)
						.values({
							isKk: isActualKk,
							noKkEncrypted,
							kepalaKeluargaId: kepalaKeluargaUserId,
							alamatLengkap: familyAlamat
						})
						.returning()
						.all();

					totalKeluargaCreated++;

					// Simpan seluruh anggota keluarga ke dalam keluarga ini
					for (let i = 0; i < members.length; i++) {
						const m = members[i];
						const umurCalc = hitungUmur(m.tanggalLahir);
						const statusGenerusFinal =
							m.statusGenerus || hitungStatusGenerus(umurCalc, m.statusMenikah);

						const nikEncrypted = m.nik?.trim() ? encryptSensitive(m.nik.trim()) : null;

						tx.insert(anggotaKeluarga)
							.values({
								keluargaId: newKeluarga.id,
								userId: memberUserIds[i] || null,
								namaLengkap: m.namaLengkap,
								nikEncrypted,
								statusHubungan: m.statusKeluarga || 'Anak',
								tanggalLahir: normalizeDateToISO(m.tanggalLahir),
								jenisKelamin: m.jenisKelamin === 'P' ? 'P' : 'L',
								tempatLahir: m.tempatLahir?.trim() || null,
								profesi: m.profesi?.trim() || null,
								noTelepon: m.noTelepon?.trim() || null,
								statusGenerus: statusGenerusFinal,
								statusPernikahan: m.statusMenikah || 'Belum Menikah',
								statusJamaah: m.statusJamaah || 'Aktif',
								isrun: m.isrun || 'Tidak',
								golonganDarah: m.golonganDarah || '-'
							})
							.run();

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
			}
		};
	}
};
