/**
 * @file src/routes/api/sensus/template/+server.ts
 * @purpose Endpoint API untuk mengunduh template resmi sensus jamaah dalam format Microsoft Excel (.xlsx) atau CSV (.csv)
 * @usedBy Tombol "Unduh Template Excel" dan "Unduh Template CSV" di antarmuka sensus admin
 * @dependencies src/lib/server/sensusImport, @sveltejs/kit
 * @publicFunctions GET
 * @sideEffects Menghasilkan file binary stream XLSX atau teks CSV untuk diunduh langsung oleh browser pengguna
 */

import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generateSensusTemplateCsv, generateSensusTemplateXlsx } from '#lib/server/sensusImport.js';

export const GET: RequestHandler = async ({ locals, url }) => {
	// Proteksi hanya untuk akun admin yang terautentikasi
	if (!locals.user || !locals.isAdmin) {
		throw error(403, 'Akses ditolak. Hanya admin yang diizinkan mengunduh template.');
	}

	const format = url.searchParams.get('format')?.toLowerCase() || 'xlsx';

	if (format === 'csv') {
		const csvContent = generateSensusTemplateCsv();
		return new Response(csvContent, {
			headers: {
				'Content-Type': 'text/csv; charset=utf-8',
				'Content-Disposition': 'attachment; filename="Template_Sensus_Jamaah.csv"',
				'Cache-Control': 'no-cache'
			}
		});
	}

	// Default: Microsoft Excel (.xlsx)
	const xlsxBuffer = generateSensusTemplateXlsx();
	return new Response(xlsxBuffer, {
		headers: {
			'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
			'Content-Disposition': 'attachment; filename="Template_Sensus_Jamaah.xlsx"',
			'Cache-Control': 'no-cache'
		}
	});
};
