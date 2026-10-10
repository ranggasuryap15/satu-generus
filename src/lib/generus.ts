/**
 * @file src/lib/generus.ts
 * @purpose Helper kalkulasi umur, klasifikasi status generus otomatis, dan opsi metadata sensus jamaah sesuai jenis kelamin
 * @usedBy Form sensus, modul batch insert (/admin/sensus/batch), dan visualisasi data generus
 * @dependencies Tidak ada (Pure utility TypeScript)
 * @publicFunctions hitungUmur, hitungStatusGenerus, getDaftarStatusKeluargaByGender, DAFTAR_STATUS_GENERUS, DAFTAR_STATUS_PERNIKAHAN, DAFTAR_STATUS_KELUARGA, DAFTAR_GOLONGAN_DARAH
 * @sideEffects Tidak ada (Fungsi murni deterministik / read-only date)
 */

/**
 * Menghitung umur dalam tahun dari tanggal lahir ISO (YYYY-MM-DD) atau DD-MM-YYYY
 */
export function hitungUmur(tanggalLahir: string): number {
	if (!tanggalLahir) return 0;

	let tglStr = tanggalLahir.trim();
	// Jika format DD-MM-YYYY, ubah ke YYYY-MM-DD untuk parsing standar
	if (/^\d{2}-\d{2}-\d{4}$/.test(tglStr)) {
		const parts = tglStr.split('-');
		tglStr = `${parts[2]}-${parts[1]}-${parts[0]}`;
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
 * Menghitung klasifikasi Status Generus berdasarkan umur dan status pernikahan
 * Aturan:
 * - SD (7-12) => Caberawit
 * - SMP (13-15) => Pra Remaja
 * - SMA (16-17) => Remaja
 * - Usia 18-22 (Belum Menikah) => Pra Nikah
 * - Usia > 22 (Belum Menikah) => Usia Nikah
 * - Sudah Menikah (< 60) => Dewasa Menikah
 * - Usia >= 60 (Sudah Menikah atau Lansia) => Lansia
 * - Usia < 7 => Paud
 */
export function hitungStatusGenerus(umur: number, statusPernikahan: string = 'Belum Menikah'): string {
	const isMenikah = statusPernikahan === 'Sudah Menikah';

	if (isMenikah) {
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

export const DAFTAR_STATUS_PERNIKAHAN = ['Belum Menikah', 'Sudah Menikah'] as const;

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

export const DAFTAR_GOLONGAN_DARAH = ['-', 'A', 'B', 'AB', 'O'] as const;
export const DAFTAR_STATUS_JAMAAH = ['Aktif', 'Tidak Aktif'] as const;
export const DAFTAR_ISRUN = ['Tidak', 'Ya'] as const;

