/**
 * @file src/lib/server/sensusImport.ts
 * @purpose Utilitas generator template Excel/CSV dan parser file import sensus jamaah (.xlsx/.csv) dengan auto-kalkulasi generus, resolusi No KK virtual 16 digit terenkripsi, pengelompokan keluarga atomik, dan validasi pratinjau data
 * @usedBy src/routes/api/sensus/template/+server.ts, src/routes/api/sensus/parse/+server.ts, form actions di sensus
 * @dependencies xlsx, #lib/generus, #lib/utils, #lib/server/crypto
 * @publicFunctions generateVirtualNoKk, generateSensusTemplateXlsx, generateSensusTemplateCsv, parseSensusBuffer
 * @sideEffects Pembuatan file buffer XLSX in-memory dan parsing data spreadsheet
 */

import * as XLSX from 'xlsx';
import {
	DAFTAR_GOLONGAN_DARAH,
	DAFTAR_STATUS_GENERUS,
	DAFTAR_STATUS_JAMAAH,
	DAFTAR_STATUS_PERNIKAHAN,
	getDaftarStatusKeluargaByGender,
	hitungStatusGenerus,
	hitungUmur,
	isStatusHubunganMenikah,
	resolveStatusPernikahan
} from '#lib/generus.js';
import { formatDateDDMMYYYY, normalizeDateToISO } from '#lib/utils.js';

export interface ParsedMemberRow {
	id: string;
	barisKe: number;
	namaLengkap: string;
	jenisKelamin: 'L' | 'P';
	tempatLahir?: string;
	tanggalLahir: string; // ISO YYYY-MM-DD
	tanggalLahirDisplay: string; // DD-MM-YYYY
	umur: number;
	alamat?: string;
	profesi?: string;
	noTelepon?: string;
	statusGenerus: string;
	statusMenikah: 'Belum Menikah' | 'Sudah Menikah';
	statusKeluarga: string;
	noKk?: string;
	nik?: string;
	statusJamaah: 'Aktif' | 'Tidak Aktif';
	isrun: 'Ya' | 'Tidak';
	golonganDarah?: string;
	buatAkun: boolean;
	email?: string;
	kelompokId?: number;
	kelompokNama?: string;
	errors: string[];
	warnings: string[];
}

export interface ParsedFamilyGroup {
	id: string;
	idKeluargaRef?: string;
	noKk: string;
	virtualNoKk?: string;
	isVirtualKk: boolean;
	alamat: string;
	isPerantau: boolean;
	kelompokId?: number;
	kelompokNama?: string;
	members: ParsedMemberRow[];
}

export interface ParseResult {
	success: boolean;
	totalBaris: number;
	totalJiwa: number;
	totalKeluarga: number;
	totalMandiri: number;
	totalAkun: number;
	hasErrors: boolean;
	families: ParsedFamilyGroup[];
	globalErrors: string[];
}

/**
 * Menghasilkan No KK Virtual 16 digit unik berawalan '99'
 * Format: 99 + timestamp (8 digit) + kripto acak (6 digit) = 16 digit angka
 * Prefix '99' dijamin tidak pernah bentrok dengan No KK resmi negara (Dukcapil 11..94)
 */
export function generateVirtualNoKk(): string {
	const timestamp = Date.now().toString().slice(-8);
	const randomPart = Math.floor(100000 + Math.random() * 900000).toString();
	return `99${timestamp}${randomPart}`;
}

/**
 * Header kolom baku untuk template sensus
 */
export const TEMPLATE_HEADERS = [
	'No',
	'Nama Kelompok',
	'ID / No Keluarga',
	'No KK',
	'NIK',
	'Nama Lengkap',
	'Hubungan Keluarga',
	'Jenis Kelamin',
	'Tempat Lahir',
	'Tanggal Lahir (DD-MM-YYYY)',
	'Status Pernikahan',
	'Status Generus',
	'No HP / WhatsApp',
	'Email',
	'Alamat Lengkap',
	'Profesi',
	'Golongan Darah',
	'Status Jamaah',
	'Isrun',
	'Buatkan Akun Login'
];

/**
 * Contoh baris untuk template
 */
export const SAMPLE_ROWS = [
	[
		1,
		'Kelompok Timur',
		'1',
		'',
		'',
		'Ahmad Syuhada',
		'Kepala Keluarga',
		'L',
		'Surabaya',
		'15-08-1988',
		'Sudah Menikah',
		'Dewasa Menikah',
		'081234567890',
		'ahmad@example.com',
		'Jl. Melati No. 10 RT 02/03',
		'Wiraswasta',
		'O',
		'Aktif',
		'Ya',
		'Ya'
	],
	[
		2,
		'Kelompok Timur',
		'1',
		'',
		'',
		'Nurul Hidayah',
		'Istri',
		'P',
		'Sidoarjo',
		'20-11-1990',
		'Sudah Menikah',
		'Dewasa Menikah',
		'081298765432',
		'',
		'Jl. Melati No. 10 RT 02/03',
		'Ibu Rumah Tangga',
		'A',
		'Aktif',
		'Tidak',
		'Tidak'
	],
	[
		3,
		'Kelompok Timur',
		'1',
		'',
		'',
		'Muhammad Farhan',
		'Anak',
		'L',
		'Surabaya',
		'10-05-2015',
		'Belum Menikah',
		'Caberawit',
		'',
		'',
		'Jl. Melati No. 10 RT 02/03',
		'Pelajar',
		'O',
		'Aktif',
		'Tidak',
		'Tidak'
	],
	[
		4,
		'Kelompok Timur',
		'2',
		'',
		'',
		'Rian Pratama',
		'Mandiri / Perantau',
		'L',
		'Semarang',
		'25-01-2002',
		'Belum Menikah',
		'Pra Nikah',
		'085612349876',
		'rian.pratama@example.com',
		'Kos Pondok Melati Kamar 04',
		'Karyawan Swasta',
		'B',
		'Aktif',
		'Tidak',
		'Ya'
	]
];

/**
 * Menghasilkan file buffer Excel (.xlsx) dengan Sheet 1 (Template) dan Sheet 2 (Panduan Nilai Valid)
 */
export function generateSensusTemplateXlsx(): Buffer {
	const wb = XLSX.utils.book_new();

	// 1. Sheet 1: Data Sensus Jamaah
	const wsData = [TEMPLATE_HEADERS, ...SAMPLE_ROWS];
	const ws1 = XLSX.utils.aoa_to_sheet(wsData);

	// Tentukan lebar kolom agar nyaman dibaca
	ws1['!cols'] = [
		{ wch: 5 }, // No
		{ wch: 20 }, // Nama Kelompok
		{ wch: 18 }, // ID / No Keluarga
		{ wch: 20 }, // No KK
		{ wch: 20 }, // NIK
		{ wch: 25 }, // Nama Lengkap
		{ wch: 20 }, // Hubungan Keluarga
		{ wch: 14 }, // Jenis Kelamin
		{ wch: 18 }, // Tempat Lahir
		{ wch: 26 }, // Tanggal Lahir (DD-MM-YYYY)
		{ wch: 20 }, // Status Pernikahan
		{ wch: 18 }, // Status Generus
		{ wch: 20 }, // No HP / WhatsApp
		{ wch: 25 }, // Email
		{ wch: 32 }, // Alamat Lengkap
		{ wch: 20 }, // Profesi
		{ wch: 15 }, // Golongan Darah
		{ wch: 15 }, // Status Jamaah
		{ wch: 10 }, // Isrun
		{ wch: 18 } // Buatkan Akun Login
	];

	XLSX.utils.book_append_sheet(wb, ws1, 'Data Sensus Jamaah');

	// 2. Sheet 2: Panduan & Nilai Valid
	const wsGuideData = [
		['PANDUAN & ATURAN PENGISIAN TEMPLATE SENSUS JAMAAH', ''],
		['', ''],
		['KOLOM', 'ATURAN & PENJELASAN PENGISIAN'],
		['ID / No Keluarga', 'Pengikat keluarga sederhana (contoh: 1, 2, KEL-01). Baris dengan ID yang sama otomatis disatukan menjadi 1 Kartu Keluarga. Jika keluarga tidak memiliki No KK fisik, sistem akan membuatkan No KK Virtual unik terenkripsi secara otomatis.'],
		['No KK', 'Opsional (16 digit angka). Jika tidak punya No KK, kolom ini cukup dikosongkan.'],
		['NIK', 'Opsional (16 digit angka). Disimpan dengan enkripsi dua arah AES-256-GCM.'],
		['Nama Lengkap', 'Wajib diisi.'],
		['Hubungan Keluarga', 'Pilihan: Kepala Keluarga, Istri, Suami, Anak, Bapak, Ibu, Famili Lain, Mandiri / Perantau.'],
		['Jenis Kelamin', 'Pilihan: L (Laki-laki) atau P (Perempuan).'],
		['Tanggal Lahir', 'Wajib format DD-MM-YYYY (contoh: 15-08-1990) atau format tanggal Excel asli.'],
		['Status Pernikahan', 'Pilihan: Sudah Menikah, Belum Menikah. Otomatis terisi jika kosong.'],
		['Status Generus', 'Otomatis dihitung dari Umur & Status Pernikahan jika dikosongkan. Opsi: Paud, Caberawit, Pra Remaja, Remaja, Pra Nikah, Usia Nikah, Dewasa Menikah, Lansia.'],
		['No HP / WhatsApp', 'Wajib diisi jika jamaah ingin dibuatkan akun login (8-16 digit angka).'],
		['Email', 'Opsional untuk login alternatif.'],
		['Alamat Lengkap', 'Cukup diisi pada baris Kepala Keluarga / Mandiri.'],
		['Golongan Darah', 'Pilihan: A, B, AB, O, -'],
		['Status Jamaah', 'Pilihan: Aktif, Tidak Aktif (Default: Aktif).'],
		['Isrun', 'Pilihan: Ya, Tidak (Default Ya untuk Kepala Keluarga).'],
		['Buatkan Akun Login', 'Pilihan: Ya, Tidak (Default Ya untuk Kepala Keluarga yang memiliki No HP). Password awal: jokam354.']
	];
	const ws2 = XLSX.utils.aoa_to_sheet(wsGuideData);
	ws2['!cols'] = [{ wch: 25 }, { wch: 100 }];
	XLSX.utils.book_append_sheet(wb, ws2, 'Petunjuk & Nilai Valid');

	return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

/**
 * Menghasilkan file teks CSV untuk template sensus
 */
export function generateSensusTemplateCsv(): string {
	const rows = [TEMPLATE_HEADERS, ...SAMPLE_ROWS];
	return rows
		.map((row) =>
			row
				.map((val) => {
					const str = String(val ?? '');
					if (str.includes(',') || str.includes('"') || str.includes('\n')) {
						return `"${str.replace(/"/g, '""')}"`;
					}
					return str;
				})
				.join(',')
		)
		.join('\n');
}

/**
 * Membersihkan dan menormalkan nama kolom header agar fleksibel
 */
function normalizeHeaderName(header: string): string {
	return header
		.toLowerCase()
		.replace(/[^a-z0-9]/g, '')
		.trim();
}

/**
 * Mengonversi tanggal Excel (baik serial number, JS Date, atau string) ke format ISO YYYY-MM-DD
 */
function parseExcelDate(val: any): { iso: string; display: string } {
	if (!val && val !== 0) return { iso: '', display: '' };

	// Jika tipe Date asli JS
	if (val instanceof Date) {
		if (!isNaN(val.getTime())) {
			const day = String(val.getDate()).padStart(2, '0');
			const month = String(val.getMonth() + 1).padStart(2, '0');
			const year = val.getFullYear();
			return {
				iso: `${year}-${month}-${day}`,
				display: `${day}-${month}-${year}`
			};
		}
	}

	// Jika angka serial Excel (misal: 35000 s/d 60000)
	if (typeof val === 'number') {
		const parsed = XLSX.SSF.parse_date_code(val);
		if (parsed) {
			const day = String(parsed.d).padStart(2, '0');
			const month = String(parsed.m).padStart(2, '0');
			const year = parsed.y;
			return {
				iso: `${year}-${month}-${day}`,
				display: `${day}-${month}-${year}`
			};
		}
	}

	const str = String(val).trim();
	if (!str) return { iso: '', display: '' };

	// Cek jika format DD-MM-YYYY atau DD/MM/YYYY
	const dmyMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
	if (dmyMatch) {
		const [, d, m, y] = dmyMatch;
		const day = d.padStart(2, '0');
		const month = m.padStart(2, '0');
		return {
			iso: `${y}-${month}-${day}`,
			display: `${day}-${month}-${y}`
		};
	}

	// Cek jika format ISO YYYY-MM-DD
	const isoMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
	if (isoMatch) {
		const [, y, m, d] = isoMatch;
		const day = d.padStart(2, '0');
		const month = m.padStart(2, '0');
		return {
			iso: `${y}-${month}-${day}`,
			display: `${day}-${month}-${y}`
		};
	}

	const iso = normalizeDateToISO(str);
	const display = formatDateDDMMYYYY(str);
	return { iso, display };
}

/**
 * Mengurai buffer file XLSX/CSV menjadi grup keluarga dan anggota keluarga
 */
export function parseSensusBuffer(
	buffer: Buffer,
	options: {
		defaultKelompokId?: number;
		kelompokMap?: Map<string, number>; // nama kelompok lowercase -> id
	} = {}
): ParseResult {
	const workbook = XLSX.read(buffer, {
		type: 'buffer',
		cellDates: true,
		raw: false
	});

	const firstSheetName = workbook.SheetNames[0];
	if (!firstSheetName) {
		return {
			success: false,
			totalBaris: 0,
			totalJiwa: 0,
			totalKeluarga: 0,
			totalMandiri: 0,
			totalAkun: 0,
			hasErrors: true,
			families: [],
			globalErrors: ['File spreadsheet kosong atau tidak memiliki sheet yang dapat dibaca.']
		};
	}

	const sheet = workbook.Sheets[firstSheetName];
	const rawRows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: '' });

	if (rawRows.length < 2) {
		return {
			success: false,
			totalBaris: 0,
			totalJiwa: 0,
			totalKeluarga: 0,
			totalMandiri: 0,
			totalAkun: 0,
			hasErrors: true,
			families: [],
			globalErrors: ['File spreadsheet harus memiliki minimal 1 baris judul kolom dan 1 baris data.']
		};
	}

	// 1. Temukan baris header kolom
	let headerRowIndex = 0;
	let colMap: Record<string, number> = {};
	let foundHeader = false;

	for (let r = 0; r < Math.min(rawRows.length, 5); r++) {
		const row = rawRows[r];
		if (!Array.isArray(row)) continue;

		const tempMap: Record<string, number> = {};
		row.forEach((cell, idx) => {
			const norm = normalizeHeaderName(String(cell));
			if (norm.includes('nama') && !norm.includes('kelompok') && !norm.includes('keluarga')) {
				tempMap['nama'] = idx;
			} else if (norm.includes('kelompok')) {
				tempMap['kelompok'] = idx;
			} else if (norm.includes('idkeluarga') || norm.includes('nokeluarga') || norm.includes('kodekeluarga')) {
				tempMap['idKeluarga'] = idx;
			} else if (norm === 'nokk' || norm.includes('kartukeluarga') || norm === 'kk') {
				tempMap['noKk'] = idx;
			} else if (norm === 'nik') {
				tempMap['nik'] = idx;
			} else if (norm.includes('hubungan') || norm.includes('statuskeluarga')) {
				tempMap['hubungan'] = idx;
			} else if (norm === 'jk' || norm.includes('kelamin') || norm.includes('gender')) {
				tempMap['jk'] = idx;
			} else if (norm.includes('tempat') || norm.includes('tempatlahir')) {
				tempMap['tempatLahir'] = idx;
			} else if (norm.includes('tgl') || norm.includes('tanggal') || norm.includes('tgllahir')) {
				tempMap['tanggalLahir'] = idx;
			} else if (norm.includes('nikah') || norm.includes('pernikahan') || norm.includes('perkawinan')) {
				tempMap['pernikahan'] = idx;
			} else if (norm.includes('generus')) {
				tempMap['generus'] = idx;
			} else if (norm.includes('hp') || norm.includes('telp') || norm.includes('telepon') || norm.includes('wa')) {
				tempMap['noTelepon'] = idx;
			} else if (norm.includes('email')) {
				tempMap['email'] = idx;
			} else if (norm.includes('alamat') || norm.includes('domisili')) {
				tempMap['alamat'] = idx;
			} else if (norm.includes('profesi') || norm.includes('pekerjaan')) {
				tempMap['profesi'] = idx;
			} else if (norm.includes('darah') || norm.includes('goldar')) {
				tempMap['golonganDarah'] = idx;
			} else if (norm.includes('jamaah') || norm.includes('statusjamaah')) {
				tempMap['statusJamaah'] = idx;
			} else if (norm.includes('isrun')) {
				tempMap['isrun'] = idx;
			} else if (norm.includes('buatakun') || norm.includes('akun')) {
				tempMap['buatAkun'] = idx;
			}
		});

		if (tempMap['nama'] !== undefined && (tempMap['tanggalLahir'] !== undefined || tempMap['jk'] !== undefined)) {
			headerRowIndex = r;
			colMap = tempMap;
			foundHeader = true;
			break;
		}
	}

	if (!foundHeader) {
		return {
			success: false,
			totalBaris: 0,
			totalJiwa: 0,
			totalKeluarga: 0,
			totalMandiri: 0,
			totalAkun: 0,
			hasErrors: true,
			families: [],
			globalErrors: [
				'Kolom spreadsheet tidak dikenali. Pastikan terdapat kolom "Nama Lengkap", "Hubungan Keluarga", "Jenis Kelamin", dan "Tanggal Lahir".'
			]
		};
	}

	// 2. Baca baris-baris data
	const memberRows: ParsedMemberRow[] = [];
	const globalErrors: string[] = [];

	for (let i = headerRowIndex + 1; i < rawRows.length; i++) {
		const row = rawRows[i];
		if (!row || !Array.isArray(row) || row.every((c) => String(c).trim() === '')) {
			continue;
		}

		const barisKe = i + 1;
		const errors: string[] = [];
		const warnings: string[] = [];

		const rawNama = String(row[colMap['nama']] ?? '').trim();
		if (!rawNama) {
			// Lewati baris kosong tanpa nama
			continue;
		}

		// Kelompok
		let rowKelompokNama = colMap['kelompok'] !== undefined ? String(row[colMap['kelompok']] ?? '').trim() : '';
		let rowKelompokId = options.defaultKelompokId;
		if (rowKelompokNama && options.kelompokMap) {
			const cleanName = rowKelompokNama.toLowerCase();
			if (options.kelompokMap.has(cleanName)) {
				rowKelompokId = options.kelompokMap.get(cleanName);
			}
		}

		// Jenis Kelamin
		const rawJk = colMap['jk'] !== undefined ? String(row[colMap['jk']] ?? '').trim().toUpperCase() : '';
		let jk: 'L' | 'P' = 'L';
		if (rawJk === 'P' || rawJk.startsWith('PEREMPUAN') || rawJk.startsWith('WANITA')) {
			jk = 'P';
		} else if (rawJk === 'L' || rawJk.startsWith('LAKI') || rawJk.startsWith('PRIA')) {
			jk = 'L';
		} else if (rawJk) {
			warnings.push(`Jenis kelamin "${rawJk}" tidak standar, diatur ke "L".`);
		}

		// Hubungan Keluarga
		const rawHubungan = colMap['hubungan'] !== undefined ? String(row[colMap['hubungan']] ?? '').trim() : '';
		let statusKeluarga = rawHubungan || 'Anak';
		const allowedStatus = getDaftarStatusKeluargaByGender(jk);
		const matchedStatus = allowedStatus.find((s) => s.toLowerCase() === rawHubungan.toLowerCase());
		if (matchedStatus) {
			statusKeluarga = matchedStatus;
		} else if (rawHubungan.toLowerCase().includes('perantau') || rawHubungan.toLowerCase().includes('mandiri')) {
			statusKeluarga = 'Mandiri / Perantau';
		} else if (rawHubungan.toLowerCase().includes('kepala') || rawHubungan.toLowerCase() === 'bapak') {
			statusKeluarga = 'Kepala Keluarga';
			jk = 'L';
		} else if (rawHubungan.toLowerCase().includes('istri') || rawHubungan.toLowerCase() === 'ibu') {
			statusKeluarga = 'Istri';
			jk = 'P';
		}

		// Tanggal Lahir
		const rawTgl = colMap['tanggalLahir'] !== undefined ? row[colMap['tanggalLahir']] : '';
		const { iso: tglIso, display: tglDisplay } = parseExcelDate(rawTgl);
		if (!tglIso) {
			errors.push('Tanggal lahir tidak valid atau kosong (wajib format DD-MM-YYYY).');
		}

		// Umur
		const umur = tglIso ? hitungUmur(tglIso) : 0;

		// Status Pernikahan
		const rawNikah = colMap['pernikahan'] !== undefined ? String(row[colMap['pernikahan']] ?? '').trim() : '';
		let statusMenikah: 'Belum Menikah' | 'Sudah Menikah' = 'Belum Menikah';
		if (rawNikah) {
			statusMenikah = rawNikah.toLowerCase().includes('sudah') ? 'Sudah Menikah' : 'Belum Menikah';
		} else {
			statusMenikah = resolveStatusPernikahan(statusKeluarga);
		}

		// Status Generus
		const rawGenerus = colMap['generus'] !== undefined ? String(row[colMap['generus']] ?? '').trim() : '';
		let statusGenerus = rawGenerus;
		if (!statusGenerus) {
			statusGenerus = hitungStatusGenerus(umur, statusMenikah);
		}

		// No HP / WhatsApp
		const rawHp = colMap['noTelepon'] !== undefined ? String(row[colMap['noTelepon']] ?? '').trim() : '';
		const cleanHp = rawHp.replace(/\D/g, '');
		if (cleanHp && !/^\d{8,16}$/.test(cleanHp)) {
			warnings.push(`Nomor HP "${rawHp}" di luar rentang valid 8-16 digit angka.`);
		}

		// Email
		const rawEmail = colMap['email'] !== undefined ? String(row[colMap['email']] ?? '').trim().toLowerCase() : '';
		let cleanEmail = rawEmail;
		if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
			warnings.push(`Format email "${rawEmail}" tidak valid.`);
			cleanEmail = '';
		}

		// No KK & NIK
		const rawKk = colMap['noKk'] !== undefined ? String(row[colMap['noKk']] ?? '').replace(/\D/g, '') : '';
		const rawNik = colMap['nik'] !== undefined ? String(row[colMap['nik']] ?? '').replace(/\D/g, '') : '';
		if (rawKk && rawKk.length !== 16) {
			warnings.push(`No KK "${rawKk}" tidak 16 digit angka.`);
		}
		if (rawNik && rawNik.length !== 16) {
			warnings.push(`NIK "${rawNik}" tidak 16 digit angka.`);
		}

		// Alamat & Profesi
		const alamat = colMap['alamat'] !== undefined ? String(row[colMap['alamat']] ?? '').trim() : '';
		const profesi = colMap['profesi'] !== undefined ? String(row[colMap['profesi']] ?? '').trim() : '';
		const tempatLahir = colMap['tempatLahir'] !== undefined ? String(row[colMap['tempatLahir']] ?? '').trim() : '';

		// Golongan Darah
		const rawGoldar = colMap['golonganDarah'] !== undefined ? String(row[colMap['golonganDarah']] ?? '').trim().toUpperCase() : '';
		const golonganDarah = DAFTAR_GOLONGAN_DARAH.includes(rawGoldar as any) && rawGoldar !== '-' ? rawGoldar : undefined;

		// Status Jamaah & Isrun
		const rawStatusJam = colMap['statusJamaah'] !== undefined ? String(row[colMap['statusJamaah']] ?? '').trim() : '';
		const statusJamaah: 'Aktif' | 'Tidak Aktif' = rawStatusJam.toLowerCase().includes('tidak') ? 'Tidak Aktif' : 'Aktif';

		const rawIsrun = colMap['isrun'] !== undefined ? String(row[colMap['isrun']] ?? '').trim() : '';
		let isrun: 'Ya' | 'Tidak' = 'Tidak';
		if (rawIsrun) {
			isrun = rawIsrun.toLowerCase().includes('ya') ? 'Ya' : 'Tidak';
		} else if (statusKeluarga === 'Kepala Keluarga') {
			isrun = 'Ya';
		}

		// Buat Akun
		const rawBuatAkun = colMap['buatAkun'] !== undefined ? String(row[colMap['buatAkun']] ?? '').trim() : '';
		let buatAkun = false;
		if (rawBuatAkun) {
			buatAkun = rawBuatAkun.toLowerCase().includes('ya') || rawBuatAkun.toLowerCase().includes('true');
		} else if (statusKeluarga === 'Kepala Keluarga' && cleanHp) {
			buatAkun = true;
		}

		if (buatAkun && !cleanHp) {
			warnings.push(`Pilihan buat akun diaktifkan, namun Nomor HP kosong (akun memerlukan No HP untuk login).`);
		}

		// ID / No Keluarga (Grouping Marker)
		const rawIdKel = colMap['idKeluarga'] !== undefined ? String(row[colMap['idKeluarga']] ?? '').trim() : '';

		memberRows.push({
			id: `row_${barisKe}_${Math.random().toString(36).substring(2, 7)}`,
			barisKe,
			namaLengkap: rawNama,
			jenisKelamin: jk,
			tempatLahir: tempatLahir || undefined,
			tanggalLahir: tglIso,
			tanggalLahirDisplay: tglDisplay,
			umur,
			alamat: alamat || undefined,
			profesi: profesi || undefined,
			noTelepon: cleanHp || undefined,
			statusGenerus,
			statusMenikah,
			statusKeluarga,
			noKk: rawKk || undefined,
			nik: rawNik || undefined,
			statusJamaah,
			isrun,
			golonganDarah,
			buatAkun,
			email: cleanEmail || undefined,
			kelompokId: rowKelompokId,
			kelompokNama: rowKelompokNama || undefined,
			errors,
			warnings,
			// Custom field simpan referensi token
			...(rawIdKel ? { idKeluargaToken: rawIdKel } : {})
		} as any);
	}

	// 3. Pengelompokan Baris Menjadi Keluarga (Family Groups)
	const parsedFamilies: ParsedFamilyGroup[] = [];
	const kkMap = new Map<string, ParsedFamilyGroup>();
	const tokenMap = new Map<string, ParsedFamilyGroup>();
	let currentFamily: ParsedFamilyGroup | null = null;

	for (const m of memberRows) {
		const isPerantau = m.statusKeluarga === 'Mandiri / Perantau';
		const token = (m as any).idKeluargaToken as string | undefined;

		if (isPerantau) {
			// Mandiri / Perantau: selalu 1 kartu tersendiri
			parsedFamilies.push({
				id: `fam_${Math.random().toString(36).substring(2, 9)}`,
				noKk: '',
				isVirtualKk: false,
				alamat: m.alamat || '',
				isPerantau: true,
				kelompokId: m.kelompokId,
				kelompokNama: m.kelompokNama,
				members: [m]
			});
			currentFamily = null;
		} else if (m.noKk && m.noKk.trim().length === 16) {
			// Prioritas 1: No KK resmi 16 digit jika ada
			const cleanKk = m.noKk.trim();
			let fam = kkMap.get(cleanKk);
			if (!fam) {
				fam = {
					id: `fam_${Math.random().toString(36).substring(2, 9)}`,
					noKk: cleanKk,
					isVirtualKk: false,
					alamat: m.alamat || '',
					isPerantau: false,
					kelompokId: m.kelompokId,
					kelompokNama: m.kelompokNama,
					members: []
				};
				kkMap.set(cleanKk, fam);
				parsedFamilies.push(fam);
			}
			fam.members.push(m);
			if (!fam.alamat && m.alamat) fam.alamat = m.alamat;
			currentFamily = fam;
		} else if (token) {
			// Prioritas 2: Kolom ID / No Keluarga (Contoh: 1, 2, KEL-01)
			let fam = tokenMap.get(token);
			if (!fam) {
				const virtualKk = generateVirtualNoKk();
				fam = {
					id: `fam_${Math.random().toString(36).substring(2, 9)}`,
					idKeluargaRef: token,
					noKk: virtualKk,
					virtualNoKk: virtualKk,
					isVirtualKk: true,
					alamat: m.alamat || '',
					isPerantau: false,
					kelompokId: m.kelompokId,
					kelompokNama: m.kelompokNama,
					members: []
				};
				tokenMap.set(token, fam);
				parsedFamilies.push(fam);
			}
			fam.members.push(m);
			if (!fam.alamat && m.alamat) fam.alamat = m.alamat;
			currentFamily = fam;
		} else {
			// Prioritas 3: Pengelompokan Berurutan Alami (Natural Sequence)
			if (!currentFamily || currentFamily.isPerantau || m.statusKeluarga === 'Kepala Keluarga') {
				const virtualKk = generateVirtualNoKk();
				currentFamily = {
					id: `fam_${Math.random().toString(36).substring(2, 9)}`,
					noKk: virtualKk,
					virtualNoKk: virtualKk,
					isVirtualKk: true,
					alamat: m.alamat || '',
					isPerantau: false,
					kelompokId: m.kelompokId,
					kelompokNama: m.kelompokNama,
					members: [m]
				};
				parsedFamilies.push(currentFamily);
			} else {
				currentFamily.members.push(m);
				if (!currentFamily.alamat && m.alamat) currentFamily.alamat = m.alamat;
			}
		}
	}

	// 4. Hitung ringkasan statistik
	let totalJiwa = 0;
	let totalKeluarga = 0;
	let totalMandiri = 0;
	let totalAkun = 0;
	let hasErrors = false;

	for (const f of parsedFamilies) {
		if (f.isPerantau) {
			totalMandiri++;
		} else {
			totalKeluarga++;
		}
		for (const m of f.members) {
			totalJiwa++;
			if (m.buatAkun && m.noTelepon) {
				totalAkun++;
			}
			if (m.errors.length > 0) {
				hasErrors = true;
			}
		}
	}

	return {
		success: !hasErrors && totalJiwa > 0,
		totalBaris: memberRows.length,
		totalJiwa,
		totalKeluarga,
		totalMandiri,
		totalAkun,
		hasErrors,
		families: parsedFamilies,
		globalErrors
	};
}
