/**
 * @file src/lib/generus.ts
 * @purpose Helper kalkulasi umur, klasifikasi status generus otomatis, opsi metadata sensus jamaah sesuai jenis kelamin, dan default status pernikahan berdasarkan hubungan keluarga
 * @usedBy Form sensus, modul batch insert (/admin/sensus/batch), dan visualisasi data generus
 * @dependencies Tidak ada (Pure utility TypeScript)
 * @publicFunctions hitungUmur, hitungStatusGenerus, getDaftarStatusKeluargaByGender, isStatusHubunganMenikah, isStatusHubunganKepala, resolveStatusPernikahan, isStatusGenerusBelumMenikah, resolvePernikahanFromGenerus, getHierarkiHubunganWeight, sortAnggotaKeluargaHierarki, DAFTAR_STATUS_GENERUS, DAFTAR_STATUS_PERNIKAHAN, DAFTAR_STATUS_KELUARGA, DAFTAR_GOLONGAN_DARAH
 * @sideEffects Tidak ada (Fungsi murni deterministik / read-only date)
 */

/**
 * Menghitung umur dalam tahun dari tanggal lahir ISO (YYYY-MM-DD), DD-MM-YYYY, DD/MM/YYYY, atau 8 digit
 */
export function hitungUmur(tanggalLahir: string): number {
	if (!tanggalLahir) return 0;

	let tglStr = tanggalLahir.trim();
	// Jika format DD-MM-YYYY atau DD/MM/YYYY, ubah ke YYYY-MM-DD untuk parsing standar
	const dmyMatch = tglStr.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
	if (dmyMatch) {
		const [, d, m, y] = dmyMatch;
		tglStr = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
	} else if (/^\d{8}$/.test(tglStr)) {
		const possibleYear = parseInt(tglStr.slice(0, 4), 10);
		if (possibleYear >= 1900 && possibleYear <= 2100) {
			tglStr = `${tglStr.slice(0, 4)}-${tglStr.slice(4, 6)}-${tglStr.slice(6, 8)}`;
		} else {
			tglStr = `${tglStr.slice(4, 8)}-${tglStr.slice(2, 4)}-${tglStr.slice(0, 2)}`;
		}
	}

	const birthDate = new Date(tglStr);
	if (isNaN(birthDate.getTime())) return 0;

	const today = new Date();
	let age = today.getFullYear() - birthDate.getFullYear();
	const m = today.getMonth() - birthDate.getMonth();
	if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
		age--;
	}

	return age < 0 ? 0 : age;
}

/**
 * Membersihkan dan menormalkan format nomor telepon:
 * - Menghilangkan spasi, tanda strip (-), titik (.), dan simbol lainnya
 * - Menormalkan awalan internasional (+62 atau 62) menjadi format nasional (0)
 * - Menangani kasus angka 0 depan terpotong oleh Excel (857... -> 0857...)
 */
export function cleanPhoneNumber(raw?: string | null): string {
	if (!raw) return '';
	const str = String(raw).trim();
	if (!str || str === '-') return '';

	let digits = str.replace(/\D/g, '');
	if (!digits) return '';

	// Jika diawali 62 (misal dari +628... atau 628...), ubah 62 menjadi 0
	if (digits.startsWith('62') && digits.length >= 10) {
		digits = '0' + digits.slice(2);
	}
	// Jika angka diawali 8 (karena angka 0 di depan hilang terpotong Excel)
	else if (digits.startsWith('8') && digits.length >= 9 && digits.length <= 14) {
		digits = '0' + digits;
	}

	return digits;
}

/**
 * Mengecek apakah status pernikahan mengindikasikan pernah menikah (Sudah Menikah, Duda, Janda)
 */
export function isStatusPernahMenikah(statusPernikahan?: string | null): boolean {
	if (!statusPernikahan) return false;
	const s = statusPernikahan.trim().toLowerCase();
	return s === 'sudah menikah' || s === 'duda' || s === 'janda';
}

/**
 * Menghitung klasifikasi Status Generus berdasarkan umur dan status pernikahan
 * Aturan:
 * - SD (7-12) => Caberawit
 * - SMP (13-15) => Pra Remaja
 * - SMA (16-17) => Remaja
 * - Usia 18-22 (Belum Menikah) => Pra Nikah
 * - Usia > 22 (Belum Menikah) => Usia Nikah
 * - Pernah Menikah (Sudah Menikah, Duda, Janda) (< 60) => Dewasa Menikah
 * - Usia >= 60 (Pernah Menikah atau Lansia) => Lansia
 * - Usia < 7 => Paud
 */
export function hitungStatusGenerus(umur: number, statusPernikahan: string = 'Belum Menikah'): string {
	const isPernahMenikah = isStatusPernahMenikah(statusPernikahan);

	if (isPernahMenikah) {
		if (umur >= 60) {
			return 'Lansia';
		}
		return 'Dewasa Menikah';
	}

	// Belum Menikah
	if (umur < 7) {
		return 'Paud';
	}
	if (umur >= 7 && umur <= 12) {
		return 'Caberawit';
	}
	if (umur >= 13 && umur <= 15) {
		return 'Pra Remaja';
	}
	if (umur >= 16 && umur <= 17) {
		return 'Remaja';
	}
	if (umur >= 18 && umur <= 22) {
		return 'Pra Nikah';
	}
	if (umur >= 60) {
		return 'Lansia';
	}

	return 'Usia Nikah';
}

export const DAFTAR_STATUS_GENERUS = [
	'Paud',
	'Caberawit',
	'Pra Remaja',
	'Remaja',
	'Pra Nikah',
	'Usia Nikah',
	'Dewasa Menikah',
	'Lansia'
] as const;

export const DAFTAR_STATUS_PERNIKAHAN = [
	'Belum Menikah',
	'Sudah Menikah',
	'Duda',
	'Janda'
] as const;

export type StatusPernikahanType = (typeof DAFTAR_STATUS_PERNIKAHAN)[number];

/**
 * Mengambil opsi status pernikahan yang selaras dengan jenis kelamin
 */
export function getDaftarStatusPernikahanByGender(jenisKelamin?: string | null): readonly StatusPernikahanType[] {
	if (jenisKelamin === 'L' || jenisKelamin === 'Laki-laki') {
		return ['Belum Menikah', 'Sudah Menikah', 'Duda'] as const;
	}
	if (jenisKelamin === 'P' || jenisKelamin === 'Perempuan') {
		return ['Belum Menikah', 'Sudah Menikah', 'Janda'] as const;
	}
	return DAFTAR_STATUS_PERNIKAHAN;
}

export const DAFTAR_STATUS_KELUARGA = [
	'Kepala Keluarga',
	'Bapak',
	'Ibu',
	'Istri',
	'Anak',
	'Mandiri / Perantau',
	'Famili Lain'
] as const;

export const DAFTAR_STATUS_KELUARGA_LAKI = [
	'Kepala Keluarga',
	'Bapak',
	'Anak',
	'Mandiri / Perantau',
	'Famili Lain'
] as const;

export const DAFTAR_STATUS_KELUARGA_PEREMPUAN = [
	'Ibu',
	'Istri',
	'Anak',
	'Mandiri / Perantau',
	'Famili Lain'
] as const;

/**
 * Mengambil daftar opsi hubungan keluarga yang valid sesuai jenis kelamin
 */
export function getDaftarStatusKeluargaByGender(jenisKelamin?: string | null): readonly string[] {
	if (jenisKelamin === 'L') {
		return DAFTAR_STATUS_KELUARGA_LAKI;
	}
	if (jenisKelamin === 'P') {
		return DAFTAR_STATUS_KELUARGA_PEREMPUAN;
	}
	return DAFTAR_STATUS_KELUARGA;
}

/**
 * Mengecek apakah status hubungan keluarga mengindikasikan status pernikahan default 'Sudah Menikah'
 * Berlaku untuk: Kepala Keluarga, Suami, Istri, Bapak, Ibu
 */
export function isStatusHubunganMenikah(statusHubungan?: string | null): boolean {
	if (!statusHubungan) return false;
	const s = statusHubungan.trim().toLowerCase();
	return (
		s === 'kepala keluarga' ||
		s === 'suami' ||
		s === 'istri' ||
		s === 'bapak' ||
		s === 'ibu'
	);
}

/**
 * Mengecek apakah status hubungan keluarga mengindikasikan kepala keluarga:
 * 'Kepala Keluarga', 'Bapak', 'Suami', atau 'Mandiri / Perantau'
 */
export function isStatusHubunganKepala(statusHubungan?: string | null): boolean {
	if (!statusHubungan) return false;
	const s = statusHubungan.trim().toLowerCase();
	return (
		s === 'kepala keluarga' ||
		s === 'bapak' ||
		s === 'suami' ||
		s.includes('perantau') ||
		s.includes('mandiri')
	);
}

/**
 * Menentukan status pernikahan default:
 * Jika status eksplisit telah ditentukan ('Sudah Menikah', 'Belum Menikah', 'Duda', 'Janda'), gunakan status tersebut.
 * Jika kosong / belum ditentukan, otomatis 'Sudah Menikah' jika hubungannya Kepala Keluarga, Suami, Istri, Bapak, atau Ibu.
 */
export function resolveStatusPernikahan(
	statusHubungan?: string | null,
	explicitStatus?: string | null
): StatusPernikahanType {
	if (
		explicitStatus === 'Sudah Menikah' ||
		explicitStatus === 'Belum Menikah' ||
		explicitStatus === 'Duda' ||
		explicitStatus === 'Janda'
	) {
		return explicitStatus;
	}
	return isStatusHubunganMenikah(statusHubungan) ? 'Sudah Menikah' : 'Belum Menikah';
}

export const DAFTAR_GOLONGAN_DARAH = ['-', 'A', 'B', 'AB', 'O'] as const;
export const DAFTAR_STATUS_JAMAAH = ['Aktif', 'Tidak Aktif'] as const;
export const DAFTAR_ISRUN = ['Tidak', 'Ya'] as const;

/**
 * Mengecek apakah status generus tergolong generus yang belum menikah:
 * Paud, Caberawit, Pra Remaja, Remaja, Pra Nikah, Usia Nikah
 */
export function isStatusGenerusBelumMenikah(statusGenerus?: string | null): boolean {
	if (!statusGenerus) return false;
	const s = statusGenerus.trim().toLowerCase();
	return (
		s === 'paud' ||
		s === 'caberawit' ||
		s === 'pra remaja' ||
		s === 'remaja' ||
		s === 'pra nikah' ||
		s === 'usia nikah'
	);
}

/**
 * Menentukan status pernikahan yang selaras berdasarkan status generus
 */
export function resolvePernikahanFromGenerus(
	statusGenerus?: string | null,
	currentPernikahan?: string | null
): StatusPernikahanType {
	if (!statusGenerus) {
		return isStatusPernahMenikah(currentPernikahan)
			? (currentPernikahan as StatusPernikahanType)
			: 'Belum Menikah';
	}
	const s = statusGenerus.trim().toLowerCase();
	if (
		s === 'paud' ||
		s === 'caberawit' ||
		s === 'pra remaja' ||
		s === 'remaja' ||
		s === 'pra nikah' ||
		s === 'usia nikah'
	) {
		return 'Belum Menikah';
	}
	if (s === 'dewasa menikah') {
		return isStatusPernahMenikah(currentPernikahan)
			? (currentPernikahan as StatusPernikahanType)
			: 'Sudah Menikah';
	}
	return isStatusPernahMenikah(currentPernikahan)
		? (currentPernikahan as StatusPernikahanType)
		: 'Belum Menikah';
}

/**
 * Mendapatkan bobot hierarki hubungan dalam satu KK:
 * 1. Kepala Keluarga (1)
 * 2. Istri (2) / Suami jika KK istri (2.5)
 * 3. Anak (3)
 * 4. Orang Tua / Mertua (4)
 * 5. Famili Lain / Lainnya (5)
 */
export function getHierarkiHubunganWeight(statusHubungan?: string | null): number {
	if (!statusHubungan) return 99;
	const s = statusHubungan.trim().toLowerCase();
	if (s === 'kepala keluarga' || s === 'bapak') return 1;
	if (s === 'istri' || s === 'ibu') return 2;
	if (s === 'suami') return 2.5;
	if (s === 'anak') return 3;
	if (s === 'orang tua' || s === 'mertua') return 4;
	if (s === 'famili lain') return 5;
	return 6;
}

/**
 * Mengurutkan array anggota keluarga dalam 1 KK sesuai hierarki resmi:
 * 1. Kepala Keluarga
 * 2. Istri
 * 3. Anak (berdasarkan umur dari yang tertua ke termuda)
 * 4. Orang Tua / Mertua (berdasarkan umur dari tertua ke termuda)
 * 5. Famili Lain / Lainnya
 */
export function sortAnggotaKeluargaHierarki<T extends { statusHubungan?: string; tanggalLahir?: string | null }>(
	anggotaList: T[]
): T[] {
	return [...anggotaList].sort((a, b) => {
		const weightA = getHierarkiHubunganWeight(a.statusHubungan);
		const weightB = getHierarkiHubunganWeight(b.statusHubungan);

		if (weightA !== weightB) {
			return weightA - weightB;
		}

		// Jika tingkat hierarki sama (misal sesama Anak atau sesama Orang Tua),
		// urutkan berdasarkan umur dari yang tertua ke termuda (umur lebih besar di atas)
		const umurA = a.tanggalLahir ? hitungUmur(a.tanggalLahir) : -1;
		const umurB = b.tanggalLahir ? hitungUmur(b.tanggalLahir) : -1;

		if (umurA !== umurB) {
			return umurB - umurA;
		}

		return 0;
	});
}


