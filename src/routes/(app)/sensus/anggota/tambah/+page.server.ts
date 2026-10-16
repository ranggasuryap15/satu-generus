/**
 * @file src/routes/(app)/sensus/anggota/tambah/+page.server.ts
 * @purpose Halaman tambah anggota keluarga baru untuk mode jamaah, mendukung multi-member dinamis dengan pengurutan hierarki resmi (Istri -> Anak tertua ke termuda -> famili) dan batch insert atomik berenkripsi NIK AES-256-GCM
 * @usedBy src/routes/(app)/sensus/anggota/tambah/+page.svelte
 * @dependencies src/lib/db, src/lib/db/schema, src/lib/server/crypto, src/lib/server/sensus, src/lib/utils, src/lib/generus (hitungStatusGenerus, hitungUmur, resolveStatusPernikahan, sortAnggotaKeluargaHierarki), drizzle-orm
 * @publicFunctions load, actions.default
 * @sideEffects Validasi kepemilikan KK, batch insert atomic pada tabel anggota_keluarga di SQLite dalam db.transaction
 */

import { fail, redirect, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '#lib/db/index.js';
import { anggotaKeluarga } from '#lib/db/schema.js';
import { eq } from 'drizzle-orm';
import { decryptSensitive, encryptSensitive, maskSensitive } from '#lib/server/crypto.js';
import { getKeluargaForUser, isUserInKeluarga } from '#lib/server/sensus.js';
import { normalizeDateToISO } from '#lib/utils.js';
import { hitungStatusGenerus, hitungUmur, resolveStatusPernikahan, sortAnggotaKeluargaHierarki } from '#lib/generus.js';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(303, '/login?redirectTo=/sensus/anggota/tambah');
	}

	const keluargaRecord = await getKeluargaForUser(locals.user.id);

	if (!keluargaRecord) {
		throw redirect(303, '/sensus/tambah');
	}

	const isKk = keluargaRecord.isKk ?? true;
	let noKkMasked = 'Tanpa KK (Perantau)';
	if (isKk) {
		if (keluargaRecord.noKkEncrypted) {
			try {
				const plain = decryptSensitive(keluargaRecord.noKkEncrypted);
				noKkMasked = maskSensitive(plain);
			} catch (_) {
				noKkMasked = '****';
			}
		} else {
			noKkMasked = 'Belum Ada No. KK';
		}
	}

	// Cek apakah KK ini sudah memiliki anggota berstatus Istri
	const existingMembers = await db
		.select({ id: anggotaKeluarga.id, statusHubungan: anggotaKeluarga.statusHubungan })
		.from(anggotaKeluarga)
		.where(eq(anggotaKeluarga.keluargaId, keluargaRecord.id));

	const hasIstri = existingMembers.some((m) => m.statusHubungan === 'Istri');

	return {
		keluarga: {
			id: keluargaRecord.id,
			isKk,
			noKkMasked,
			alamatLengkap: keluargaRecord.alamatLengkap
		},
		hasIstri,
		totalExistingMembers: existingMembers.length
	};
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		if (!locals.user) {
			throw redirect(303, '/login');
		}

		const formData = await request.formData();
		const keluargaId = formData.get('keluargaId')?.toString() || '';
		const anggotaJson = formData.get('anggotaJson')?.toString() || '';

		if (!keluargaId) {
			return fail(400, { error: 'ID Kartu Keluarga tidak valid.' });
		}

		// Validasi kepemilikan/keanggotaan KK oleh user saat ini
		const isMember = await isUserInKeluarga(locals.user.id, keluargaId);
		if (!isMember) {
			return fail(403, { error: 'Anda tidak memiliki hak akses untuk menambahkan anggota pada KK ini.' });
		}

		if (!anggotaJson) {
			return fail(400, { error: 'Data anggota keluarga tidak ditemukan.' });
		}

		let items: any[] = [];
		try {
			items = JSON.parse(anggotaJson);
		} catch (_) {
			return fail(400, { error: 'Format data anggota keluarga tidak valid.' });
		}

		if (!Array.isArray(items) || items.length === 0) {
			return fail(400, { error: 'Minimal harus mengisi 1 anggota keluarga baru.' });
		}

		const insertRows: Array<{
			keluargaId: string;
			namaLengkap: string;
			nikEncrypted: string | null;
			statusHubungan: string;
			tanggalLahir: string;
			tempatLahir: string | null;
			jenisKelamin: string;
			statusGenerus: string | null;
			statusPernikahan: string | null;
			profesi: string | null;
			golonganDarah: string | null;
			noTelepon: string | null;
			statusJamaah: string;
			isrun: string;
		}> = [];

		for (let i = 0; i < items.length; i++) {
			const item = items[i];
			const no = i + 1;

			const namaLengkap = item.namaLengkap?.toString()?.trim();
			if (!namaLengkap) {
				return fail(400, { error: `Nama lengkap anggota ke-${no} wajib diisi.` });
			}

			const statusHubungan = item.statusHubungan?.toString()?.trim();
			if (!statusHubungan) {
				return fail(400, { error: `Status hubungan keluarga anggota ke-${no} wajib dipilih.` });
			}

			const rawTgl = item.tanggalLahir?.toString()?.trim();
			if (!rawTgl) {
				return fail(400, { error: `Tanggal lahir anggota ke-${no} wajib diisi.` });
			}
			const isoTgl = normalizeDateToISO(rawTgl);
			if (!isoTgl) {
				return fail(400, { error: `Format tanggal lahir anggota ke-${no} tidak valid.` });
			}

			const jenisKelamin = item.jenisKelamin?.toString()?.trim();
			if (!jenisKelamin) {
				return fail(400, { error: `Jenis kelamin anggota ke-${no} wajib dipilih.` });
			}

			// NIK opsional, jika diisi validasi 16 digit angka
			let nikEncrypted: string | null = null;
			const cleanNik = item.nik ? item.nik.toString().trim().replace(/\D/g, '') : '';
			if (cleanNik) {
				if (cleanNik.length !== 16) {
					return fail(400, { error: `NIK anggota ke-${no} (${namaLengkap}) harus 16 digit angka jika diisi.` });
				}
				nikEncrypted = encryptSensitive(cleanNik);
			}

			// No Telepon opsional, jika diisi validasi 8-16 digit
			let cleanNoTelepon: string | null = null;
			if (item.noTelepon) {
				const rawHp = item.noTelepon.toString().trim().replace(/\D/g, '');
				if (rawHp) {
					if (!/^\d{8,16}$/.test(rawHp)) {
						return fail(400, { error: `Nomor HP anggota ke-${no} (${namaLengkap}) harus 8-16 digit angka.` });
					}
					cleanNoTelepon = rawHp;
				}
			}

			const tempatLahir = item.tempatLahir?.toString()?.trim() || null;
			const profesi = item.profesi?.toString()?.trim() || null;
			const golonganDarah = item.golonganDarah?.toString()?.trim() || null;

			// Kalkulasi status pernikahan default bila kosong
			let statusPernikahan = item.statusPernikahan?.toString()?.trim() || null;
			if (!statusPernikahan) {
				statusPernikahan = resolveStatusPernikahan(statusHubungan);
			}

			// Kalkulasi umur & status generus otomatis
			const umur = hitungUmur(isoTgl);
			let statusGenerus = item.statusGenerus?.toString()?.trim() || null;
			if (!statusGenerus) {
				statusGenerus = hitungStatusGenerus(umur, statusPernikahan);
			}

			insertRows.push({
				keluargaId,
				namaLengkap,
				nikEncrypted,
				statusHubungan,
				tanggalLahir: isoTgl,
				tempatLahir,
				jenisKelamin: jenisKelamin === 'L' || jenisKelamin === 'Laki-laki' ? 'L' : 'P',
				statusGenerus,
				statusPernikahan,
				profesi,
				golonganDarah,
				noTelepon: cleanNoTelepon,
				statusJamaah: 'Aktif',
				isrun: statusHubungan === 'Kepala Keluarga' ? 'Ya' : 'Tidak'
			});
		}

		try {
			const sortedRows = sortAnggotaKeluargaHierarki(insertRows);

			// Simpan semua anggota secara atomik dalam transaksi database sesuai hierarki resmi
			await db.transaction(async (tx) => {
				for (const row of sortedRows) {
					await tx.insert(anggotaKeluarga).values(row);
				}
			});
		} catch (error) {
			console.error('Gagal menambahkan anggota keluarga baru (batch):', error);
			return fail(500, { error: 'Terjadi kesalahan sistem saat menyimpan anggota keluarga.' });
		}

		throw redirect(303, '/sensus');
	}
};

