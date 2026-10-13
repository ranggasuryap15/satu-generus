/**
 * @file src/routes/(app)/fr/+page.server.ts
 * @purpose Backend controller halaman Isrun/FR client jamaah (Mobile-First): memuat lembar pos kewajiban FR terstruktur per kategori induk (A. Hak Pusat, B. Hak Daerah, C. Hak Desa, D. Hak Kelompok) mirip template KU, riwayat setoran per bulan, info rekening/QRIS kelompok, dan menangani pelaporan setoran mandiri jamaah
 * @usedBy src/routes/(app)/fr/+page.svelte
 * @dependencies @sveltejs/kit, src/lib/db, src/lib/db/schema, src/lib/server/sensus, src/lib/server/upload, drizzle-orm, @paralleldrive/cuid2
 * @publicFunctions load, actions.simpanSetoran
 * @sideEffects DB read pada anggota_keluarga, keluarga, template_infaq_rutin, template_infaq_group, template_infaq_group_pos, pos_anggaran_infaq, rekening_wilayah, transaksi_fr; DB upsert ke transaksi_fr; penyimpanan file upload bukti transfer ke uploads/bukti-transfer
 */

import { fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { db, sqlite } from '$lib/db';
import {
	anggotaKeluarga,
	keluarga,
	kelompok,
	rekeningWilayah,
	transaksiFr,
	templateInfaqRutin,
	templateInfaqGroup,
	templateInfaqGroupPos,
	templateInfaqJamaah,
	posAnggaranInfaq
} from '$lib/db/schema';
import { eq, and, or, isNull, desc, asc, inArray } from 'drizzle-orm';
import { getKeluargaForUser } from '$lib/server/sensus';
import { saveUploadedFile } from '$lib/server/upload';
import { createId } from '@paralleldrive/cuid2';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) {
		throw redirect(303, `/login?redirectTo=${encodeURIComponent(url.pathname + url.search)}`);
	}

	const userId = locals.user.id;
	const currentYear = new Date().getFullYear();
	const currentMonth = new Date().getMonth() + 1;

	const tahunParam = Number(url.searchParams.get('tahun')) || currentYear;
	const bulanParam = Number(url.searchParams.get('bulan')) || currentMonth;

	// 1. Dapatkan Kartu Keluarga (KK) dan daftar Anggota Keluarga yang wajib Isrun
	const keluargaRecord = getKeluargaForUser(userId);
	let anggotaWajibList: Array<{
		id: string;
		namaLengkap: string;
		statusHubungan: string;
		isCurrentUser: boolean;
	}> = [];

	let activeAnggotaId = url.searchParams.get('anggotaId') || '';

	if (keluargaRecord) {
		const rawAnggota = db
			.select({
				id: anggotaKeluarga.id,
				namaLengkap: anggotaKeluarga.namaLengkap,
				statusHubungan: anggotaKeluarga.statusHubungan,
				userId: anggotaKeluarga.userId,
				isrun: anggotaKeluarga.isrun
			})
			.from(anggotaKeluarga)
			.where(eq(anggotaKeluarga.keluargaId, keluargaRecord.id))
			.all();

		// Filter yang status isrun = 'Ya' (atau jika belum diisi, sertakan kepala/user itu sendiri)
		const filtered = rawAnggota.filter((a) => a.isrun === 'Ya' || a.userId === userId);
		anggotaWajibList = (filtered.length > 0 ? filtered : rawAnggota).map((a) => ({
			id: a.id,
			namaLengkap: a.namaLengkap || 'Tanpa Nama',
			statusHubungan: a.statusHubungan,
			isCurrentUser: a.userId === userId
		}));

		if (!activeAnggotaId && anggotaWajibList.length > 0) {
			const current = anggotaWajibList.find((a) => a.isCurrentUser);
			activeAnggotaId = current ? current.id : anggotaWajibList[0].id;
		}
	} else {
		// Fallback jika belum memiliki KK sensus, cek apakah ada anggota_keluarga dengan user_id ini
		const singleAnggota = db
			.select({
				id: anggotaKeluarga.id,
				namaLengkap: anggotaKeluarga.namaLengkap,
				statusHubungan: anggotaKeluarga.statusHubungan
			})
			.from(anggotaKeluarga)
			.where(eq(anggotaKeluarga.userId, userId))
			.get();

		if (singleAnggota) {
			anggotaWajibList = [
				{
					id: singleAnggota.id,
					namaLengkap: singleAnggota.namaLengkap || locals.user.namaLengkap,
					statusHubungan: singleAnggota.statusHubungan,
					isCurrentUser: true
				}
			];
			activeAnggotaId = singleAnggota.id;
		}
	}

	// 2. Dapatkan kelompok jamaah
	const userKelompokId = locals.user.kelompokId;
	let kelompokNama = 'Kelompok';
	let rekeningList: any[] = [];

	if (userKelompokId) {
		const kel = db
			.select({ id: kelompok.id, nama: kelompok.nama })
			.from(kelompok)
			.where(eq(kelompok.id, userKelompokId))
			.get();
		if (kel) kelompokNama = kel.nama;

		// Ambil rekening & QRIS aktif tingkat kelompok
		rekeningList = db
			.select()
			.from(rekeningWilayah)
			.where(
				and(
					eq(rekeningWilayah.tingkatScope, 'Kelompok'),
					eq(rekeningWilayah.kelompokId, userKelompokId),
					eq(rekeningWilayah.isActive, true)
				)
			)
			.orderBy(desc(rekeningWilayah.createdAt))
			.all();
	}

	// Jika belum ada anggota keluarga terdaftar sama sekali
	if (!activeAnggotaId) {
		return {
			hasAnggota: false,
			anggotaWajibList: [],
			activeAnggota: null,
			tahun: tahunParam,
			bulan: bulanParam,
			template: null,
			groupNama: '',
			categoriesWithPos: [],
			posList: [],
			transaksiExisting: null,
			kelompokNama,
			rekeningList
		};
	}

	const activeAnggota = anggotaWajibList.find((a) => a.id === activeAnggotaId) || anggotaWajibList[0];

	// 3. Ambil Transaksi Existing di Bulan & Tahun ini untuk Anggota Aktif
	const existingTransaksi = sqlite
		.prepare(
			`SELECT id, tahun, bulan, nominal, status_bayar, catatan, updated_at
			 FROM transaksi_fr
			 WHERE anggota_keluarga_id = ? AND tahun = ? AND bulan = ?`
		)
		.get(activeAnggota.id, tahunParam, bulanParam) as
		| {
				id: string;
				tahun: number;
				bulan: number;
				nominal: number;
				status_bayar: string;
				catatan: string | null;
				updated_at: number;
		  }
		| undefined;

	let existingBreakdown: Record<string, number> = {};
	let existingMetode = 'Tunai';
	let existingBuktiUrl = '';
	let existingCatatanUser = '';

	if (existingTransaksi?.catatan) {
		try {
			const parsed = JSON.parse(existingTransaksi.catatan);
			if (parsed.breakdown && typeof parsed.breakdown === 'object') {
				existingBreakdown = parsed.breakdown;
			}
			if (parsed.metode) existingMetode = parsed.metode;
			if (parsed.buktiUrl) existingBuktiUrl = parsed.buktiUrl;
			if (parsed.catatan) existingCatatanUser = parsed.catatan;
		} catch (_) {
			existingCatatanUser = existingTransaksi.catatan;
		}
	}

	// 4. Ambil Template Infaq Aktif untuk Kelompok ini pada Tahun Terpilih
	let template = userKelompokId
		? (sqlite
				.prepare(
					`SELECT id, tahun, status, tingkat_scope 
					 FROM template_infaq_rutin 
					 WHERE tingkat_scope = 'Kelompok' AND kelompok_id = ? AND tahun = ? AND status = 'aktif'
					 ORDER BY updated_at DESC LIMIT 1`
				)
				.get(userKelompokId, tahunParam) as { id: string; tahun: number; status: string; tingkat_scope: string } | undefined)
		: null;

	// Fallback ke template tahun berjalan jika tidak ketemu
	if (!template && userKelompokId) {
		template = sqlite
			.prepare(
				`SELECT id, tahun, status, tingkat_scope 
				 FROM template_infaq_rutin 
				 WHERE tingkat_scope = 'Kelompok' AND kelompok_id = ? AND status = 'aktif'
				 ORDER BY tahun DESC, updated_at DESC LIMIT 1`
			)
			.get(userKelompokId) as any;
	}

	// 5. Cari Group Jamaah di template tersebut
	let groupId: string | null = null;
	let groupNama = 'Standar';

	if (template) {
		const jamaahGroupRow = sqlite
			.prepare(
				`SELECT group_id FROM template_infaq_jamaah WHERE template_id = ? AND anggota_keluarga_id = ?`
			)
			.get(template.id, activeAnggota.id) as { group_id: string | null } | undefined;

		if (jamaahGroupRow?.group_id) {
			groupId = jamaahGroupRow.group_id;
		}

		// Jika belum ditentukan groupnya oleh KU, gunakan group pertama pada template ini
		if (!groupId) {
			const firstGroup = sqlite
				.prepare(
					`SELECT id, nama FROM template_infaq_group WHERE template_id = ? ORDER BY urutan ASC, created_at ASC LIMIT 1`
				)
				.get(template.id) as { id: string; nama: string } | undefined;

			if (firstGroup) {
				groupId = firstGroup.id;
				groupNama = firstGroup.nama;
			}
		} else {
			const gInfo = sqlite
				.prepare(`SELECT nama FROM template_infaq_group WHERE id = ?`)
				.get(groupId) as { nama: string } | undefined;
			if (gInfo) groupNama = gInfo.nama;
		}
	}

	// 6. Muat Struktur Pos Anggaran Lengkap (Hierarki Kategori Induk A-D & Sub-Pos) persis seperti Template KU
	const rawAllPos = db
		.select()
		.from(posAnggaranInfaq)
		.where(
			and(
				eq(posAnggaranInfaq.isActive, true),
				or(
					eq(posAnggaranInfaq.isWajib, true),
					userKelompokId ? eq(posAnggaranInfaq.kelompokId, userKelompokId) : isNull(posAnggaranInfaq.kelompokId),
					isNull(posAnggaranInfaq.kelompokId)
				)
			)
		)
		.orderBy(asc(posAnggaranInfaq.urutan), asc(posAnggaranInfaq.nama))
		.all();

	// Pisahkan kategori induk (parentId IS NULL) dan sub-pos anak (parentId IS NOT NULL)
	const parentCategories = rawAllPos
		.filter((p) => !p.parentId)
		.sort((a, b) => a.urutan - b.urutan);

	const subPosList = rawAllPos.filter((p) => !!p.parentId);

	// Ambil nominal saran KU dari template_infaq_group_pos jika group ditemukan
	const groupPosValues: Record<string, { nominalJumlah: number; keteranganTeks: string | null }> = {};
	if (groupId) {
		const rawGroupPos = db
			.select()
			.from(templateInfaqGroupPos)
			.where(eq(templateInfaqGroupPos.groupId, groupId))
			.all();

		for (const gp of rawGroupPos) {
			groupPosValues[gp.posId] = {
				nominalJumlah: gp.nominalJumlah || 0,
				keteranganTeks: gp.keteranganTeks || null
			};
		}
	}

	// Bentuk array categoriesWithPos terstruktur
	const categoriesWithPos = parentCategories.map((cat, idx) => {
		const children = subPosList
			.filter((sub) => sub.parentId === cat.id)
			.sort((a, b) => a.urutan - b.urutan)
			.map((sub) => {
				const gVal = groupPosValues[sub.id];
				let riil: number | null = null;
				if (existingBreakdown[sub.id] !== undefined) {
					riil = Number(existingBreakdown[sub.id]) || 0;
				}

				return {
					posId: sub.id,
					kode: sub.kode,
					nama: sub.nama,
					isWajib: sub.isWajib,
					nominalJumlah: gVal?.nominalJumlah ?? 0,
					nominalRiilBayar: riil,
					keteranganTeks: gVal?.keteranganTeks ?? ''
				};
			});

		const letter = String.fromCharCode(65 + idx);
		return {
			id: cat.id,
			nama: cat.nama,
			labelKategori: `${letter}. ${cat.nama}`,
			subPos: children
		};
	});

	// Flat posList untuk kompatibilitas data
	const posList = categoriesWithPos.flatMap((c) => c.subPos);

	return {
		hasAnggota: true,
		anggotaWajibList,
		activeAnggota,
		tahun: tahunParam,
		bulan: bulanParam,
		template,
		groupNama,
		categoriesWithPos,
		posList,
		transaksiExisting: existingTransaksi
			? {
					id: existingTransaksi.id,
					nominal: existingTransaksi.nominal,
					statusBayar: existingTransaksi.status_bayar,
					metode: existingMetode,
					buktiUrl: existingBuktiUrl,
					catatan: existingCatatanUser,
					updatedAt: existingTransaksi.updated_at
			  }
			: null,
		kelompokNama,
		rekeningList
	};
};

export const actions: Actions = {
	simpanSetoran: async ({ request, locals }) => {
		if (!locals.user) {
			return fail(401, { message: 'Sesi login telah berakhir' });
		}

		const formData = await request.formData();
		const anggotaId = formData.get('anggotaId')?.toString();
		const tahun = Number(formData.get('tahun'));
		const bulan = Number(formData.get('bulan'));
		const templateId = formData.get('templateId')?.toString() || null;
		const rincianRaw = formData.get('rincian')?.toString() || '[]';
		const metode = formData.get('metode')?.toString() || 'Tunai';
		const catatanTambahan = formData.get('catatan')?.toString() || '';
		const buktiFile = formData.get('buktiFile');

		if (!anggotaId || !tahun || !bulan) {
			return fail(400, { message: 'Data periode atau jamaah tidak lengkap' });
		}

		// Validasi otorisasi anggota keluarga terhadap user yang sedang login
		const userKK = getKeluargaForUser(locals.user.id);
		let isAuthorized = false;

		if (userKK) {
			const check = sqlite
				.prepare('SELECT id FROM anggota_keluarga WHERE id = ? AND keluarga_id = ?')
				.get(anggotaId, userKK.id);
			if (check) isAuthorized = true;
		} else {
			const checkSelf = sqlite
				.prepare('SELECT id FROM anggota_keluarga WHERE id = ? AND user_id = ?')
				.get(anggotaId, locals.user.id);
			if (checkSelf) isAuthorized = true;
		}

		if (!isAuthorized) {
			return fail(403, { message: 'Anda tidak memiliki hak akses untuk anggota jamaah ini' });
		}

		// Parse dan hitung total riil bayar
		let parsedRincian: Array<{ posId: string; riil: number; nama: string }> = [];
		try {
			parsedRincian = JSON.parse(rincianRaw);
		} catch (e) {
			return fail(400, { message: 'Format rincian pos tidak valid' });
		}

		const breakdownMap: Record<string, number> = {};
		let totalNominal = 0;

		for (const item of parsedRincian) {
			const n = Math.max(0, Math.floor(Number(item.riil) || 0));
			breakdownMap[item.posId] = n;
			totalNominal += n;
		}

		// Simpan upload bukti transfer jika ada
		let buktiUrl = '';
		if (buktiFile && typeof buktiFile === 'object' && (buktiFile as any).size > 0) {
			try {
				const saved = await saveUploadedFile(buktiFile, 'bukti-transfer', 'fr');
				if (saved) buktiUrl = saved;
			} catch (err: any) {
				console.error('Gagal mengunggah bukti setoran FR:', err);
			}
		}

		// Dapatkan wilayah anggota keluarga
		const anggotaInfo = sqlite
			.prepare(
				`SELECT a.id, u.kelompok_id, k.desa_id, d.daerah_id
				 FROM anggota_keluarga a
				 LEFT JOIN users u ON a.user_id = u.id
				 LEFT JOIN kelompok k ON COALESCE(u.kelompok_id, ?) = k.id
				 LEFT JOIN desa d ON k.desa_id = d.id
				 WHERE a.id = ?`
			)
			.get(locals.user.kelompokId || 0, anggotaId) as any;

		const kelompokId = locals.user.kelompokId || anggotaInfo?.kelompok_id;
		const desaId = anggotaInfo?.desa_id || null;
		const daerahId = anggotaInfo?.daerah_id || null;

		if (!kelompokId) {
			return fail(400, { message: 'Kelompok jamaah belum terdaftar dalam sistem' });
		}

		// Ambil transaksi existing di periode ini untuk mempertahankan buktiUrl lama jika tidak ada unggahan baru
		const existing = sqlite
			.prepare('SELECT id, catatan FROM transaksi_fr WHERE anggota_keluarga_id = ? AND tahun = ? AND bulan = ?')
			.get(anggotaId, tahun, bulan) as { id: string; catatan: string | null } | undefined;

		let finalBuktiUrl = buktiUrl;
		if (!finalBuktiUrl && existing?.catatan) {
			try {
				const oldParsed = JSON.parse(existing.catatan);
				if (oldParsed.buktiUrl) {
					finalBuktiUrl = oldParsed.buktiUrl;
				}
			} catch (_) {}
		}

		// Buat payload catatan JSON yang merekam breakdown riil bayar per pos
		const catatanPayload = JSON.stringify({
			breakdown: breakdownMap,
			metode,
			buktiUrl: finalBuktiUrl || undefined,
			catatan: catatanTambahan.trim() || undefined,
			diinputOleh: locals.user.namaLengkap,
			tanggalLapor: new Date().toISOString()
		});

		const now = Math.floor(Date.now() / 1000);
		// Status bayar: Jika setor tunai atau konfirmasi transfer, beri status 'Menunggu Konfirmasi' agar KU dapat memverifikasi
		const statusBayar = totalNominal > 0 ? 'Menunggu Konfirmasi' : 'Belum Bayar';

		if (existing) {
			sqlite
				.prepare(
					`UPDATE transaksi_fr
					 SET nominal = ?,
					     status_bayar = ?,
					     catatan = ?,
					     template_id = COALESCE(?, template_id),
					     updated_by_user_id = ?,
					     updated_at = ?
					 WHERE id = ?`
				)
				.run(
					totalNominal,
					statusBayar,
					catatanPayload,
					templateId,
					locals.user.id,
					now,
					existing.id
				);
		} else {
			const newId = createId();
			sqlite
				.prepare(
					`INSERT INTO transaksi_fr (
						id, anggota_keluarga_id, kelompok_id, desa_id, daerah_id,
						tahun, bulan, nominal, status_bayar, catatan,
						template_id, updated_by_user_id, created_at, updated_at
					) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
				)
				.run(
					newId,
					anggotaId,
					kelompokId,
					desaId,
					daerahId,
					tahun,
					bulan,
					totalNominal,
					statusBayar,
					catatanPayload,
					templateId,
					locals.user.id,
					now,
					now
				);
		}

		return {
			success: true,
			message: `Laporan setoran Isrun/FR bulan ${bulan}/${tahun} sebesar Rp ${totalNominal.toLocaleString('id-ID')} berhasil disimpan.`
		};
	}
};

