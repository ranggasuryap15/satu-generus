/**
 * @file src/routes/api/sensus/parse/+server.ts
 * @purpose Endpoint API untuk mengurai (parse) dan memvalidasi file Excel (.xlsx) atau CSV (.csv) sensus jamaah sebelum disimpan ke database
 * @usedBy Modal Import Sensus di antarmuka admin
 * @dependencies src/lib/server/sensusImport, src/lib/server/scope, @sveltejs/kit
 * @publicFunctions POST
 * @sideEffects Membaca file stream upload dari multipart/form-data dan mengembalikan JSON pratinjau data & status validasi
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseSensusBuffer } from '#lib/server/sensusImport.js';
import { getAdminScope, getAccessibleWilayah } from '#lib/server/scope.js';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user || !locals.isAdmin) {
		throw error(403, 'Akses ditolak. Hanya admin yang berhak melakukan import data sensus.');
	}

	try {
		const formData = await request.formData();
		const file = formData.get('file') as File | null;
		const defaultKelompokIdRaw = formData.get('defaultKelompokId')?.toString() || '';

		if (!file || !(file instanceof File) || file.size === 0) {
			return json(
				{
					success: false,
					totalBaris: 0,
					totalJiwa: 0,
					totalKeluarga: 0,
					totalMandiri: 0,
					totalAkun: 0,
					hasErrors: true,
					families: [],
					globalErrors: ['Silakan pilih file Excel (.xlsx) atau CSV (.csv) untuk diimpor.']
				},
				{ status: 400 }
			);
		}

		// Validasi batas ukuran file (maksimal 10 MB)
		const MAX_FILE_SIZE = 10 * 1024 * 1024;
		if (file.size > MAX_FILE_SIZE) {
			return json(
				{
					success: false,
					totalBaris: 0,
					totalJiwa: 0,
					totalKeluarga: 0,
					totalMandiri: 0,
					totalAkun: 0,
					hasErrors: true,
					families: [],
					globalErrors: ['Ukuran file terlalu besar. Maksimal ukuran file adalah 10 MB.']
				},
				{ status: 400 }
			);
		}

		// Ambil daftar kelompok yang dapat diakses oleh admin
		const adminScope = getAdminScope(locals.roles || []);
		const accessibleWilayah = await getAccessibleWilayah(adminScope);

		const kelompokMap = new Map<string, number>();
		for (const k of accessibleWilayah.kelompokList) {
			kelompokMap.set(k.nama.toLowerCase().trim(), k.id);
		}

		let defaultKelompokId: number | undefined;
		if (defaultKelompokIdRaw && defaultKelompokIdRaw !== 'ALL' && !isNaN(Number(defaultKelompokIdRaw))) {
			defaultKelompokId = parseInt(defaultKelompokIdRaw, 10);
		} else if (accessibleWilayah.kelompokList.length === 1) {
			defaultKelompokId = accessibleWilayah.kelompokList[0].id;
		}

		const arrayBuffer = await file.arrayBuffer();
		const buffer = Buffer.from(arrayBuffer);

		const result = parseSensusBuffer(buffer, {
			defaultKelompokId,
			kelompokMap
		});

		return json(result);
	} catch (err: any) {
		console.error('[API Sensus Parse Error]:', err);
		return json(
			{
				success: false,
				totalBaris: 0,
				totalJiwa: 0,
				totalKeluarga: 0,
				totalMandiri: 0,
				totalAkun: 0,
				hasErrors: true,
				families: [],
				globalErrors: ['Gagal membaca file: ' + (err?.message || 'Format file tidak didukung atau rusak')]
			},
			{ status: 500 }
		);
	}
};
