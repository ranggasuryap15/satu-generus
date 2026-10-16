/**
 * @file src/lib/presensi-waktu.ts
 * @purpose Utility domain untuk validasi waktu presensi jamaah, normalisasi format jam 24H (HH:mm) dengan default 20:00 - 21:30, dan kalkulasi batas buka presensi 1 jam sebelum acara
 * @usedBy src/routes/(app)/presensi/+page.server.ts, src/routes/(app)/presensi/+page.svelte, src/routes/(admin)/admin/jadwal/+page.server.ts
 * @dependencies src/lib/utils (formatDateDDMMYYYY)
 * @publicFunctions normalizeJam24H, parseJamMulai, hitungWaktuBukaPresensi, getWaktuSekarangWIB, validasiWaktuPresensi
 * @sideEffects Tidak ada (pure utility / deterministic validation)
 */

import { formatDateDDMMYYYY } from './utils';

export interface ValidasiPresensiResult {
	isValid: boolean;
	error?: string;
	bukaPukul?: string;
}

/**
 * Normalisasi string jam ke format standar 24 Jam (HH:mm)
 * Mendukung pemisah titik (.) maupun titik dua (:).
 * Contoh: "20.00" -> "20:00", "21.30" -> "21:30"
 */
export function normalizeJam24H(jamInput?: string | null, fallback: string = '20:00'): string {
	if (!jamInput || !jamInput.trim()) return fallback;
	const cleaned = jamInput.trim().replace('.', ':');
	const parts = cleaned.split(':');
	const jam = parseInt(parts[0], 10);
	const menit = parseInt(parts[1], 10) || 0;
	if (isNaN(jam) || jam < 0 || jam > 23 || menit < 0 || menit > 59) {
		return fallback;
	}
	return `${String(jam).padStart(2, '0')}:${String(menit).padStart(2, '0')}`;
}

/**
 * Parsing jam mulai kegiatan dari string ke komponen jam dan menit (24H)
 * Fallback ke default 20:00 jika nilai kosong atau tidak valid
 */
export function parseJamMulai(jamMulai?: string | null): { jam: number; menit: number; formatted: string } {
	if (!jamMulai) return { jam: 20, menit: 0, formatted: '20:00' };
	const cleaned = jamMulai.trim().replace('.', ':');
	const parts = cleaned.split(':');
	const jam = parseInt(parts[0], 10);
	const menit = parseInt(parts[1], 10) || 0;
	if (isNaN(jam) || jam < 0 || jam > 23) {
		return { jam: 20, menit: 0, formatted: '20:00' };
	}
	const cleanMenit = isNaN(menit) || menit < 0 || menit > 59 ? 0 : menit;
	const formatted = `${String(jam).padStart(2, '0')}:${String(cleanMenit).padStart(2, '0')}`;
	return { jam, menit: cleanMenit, formatted };
}

/**
 * Menghitung waktu paling awal presensi dibuka (1 jam sebelum jam mulai kegiatan).
 * Jika jam mulai < 01:00, batas waktu buka presensi ditahan di 00:00 pada tanggal yang sama.
 */
export function hitungWaktuBukaPresensi(jam: number, menit: number): { jam: number; menit: number; formatted: string } {
	let totalMenit = jam * 60 + menit - 60;
	if (totalMenit < 0) totalMenit = 0;
	const jamBuka = Math.floor(totalMenit / 60);
	const menitBuka = totalMenit % 60;
	const formatted = `${String(jamBuka).padStart(2, '0')}:${String(menitBuka).padStart(2, '0')}`;
	return { jam: jamBuka, menit: menitBuka, formatted };
}

/**
 * Mendapatkan tanggal (YYYY-MM-DD) dan jam saat ini dalam zona waktu Asia/Jakarta (WIB)
 */
export function getWaktuSekarangWIB(now: Date = new Date()): {
	tanggal: string;
	jam: number;
	menit: number;
	jamFormatted: string;
} {
	const tanggalFormatter = new Intl.DateTimeFormat('en-CA', {
		timeZone: 'Asia/Jakarta',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	});
	const tanggal = tanggalFormatter.format(now);

	const timeFormatter = new Intl.DateTimeFormat('id-ID', {
		timeZone: 'Asia/Jakarta',
		hour: '2-digit',
		minute: '2-digit',
		hour12: false
	});
	const timeParts = timeFormatter.format(now).replace('.', ':').split(':');
	const jam = parseInt(timeParts[0], 10) || 0;
	const menit = parseInt(timeParts[1], 10) || 0;
	const jamFormatted = `${String(jam).padStart(2, '0')}:${String(menit).padStart(2, '0')}`;

	return { tanggal, jam, menit, jamFormatted };
}

/**
 * Memvalidasi apakah presensi diizinkan berdasarkan aturan:
 * 1. Harus di tanggal yang sama dengan jadwal kegiatan
 * 2. Jam presensi minimal 1 jam sebelum jam kegiatan dimulai
 */
export function validasiWaktuPresensi(
	jadwalTanggal: string,
	jadwalJamMulai: string | null | undefined,
	now: Date = new Date()
): ValidasiPresensiResult {
	const waktuSekarang = getWaktuSekarangWIB(now);
	const { jam: jamMulaiH, menit: jamMulaiM } = parseJamMulai(jadwalJamMulai);
	const waktuBuka = hitungWaktuBukaPresensi(jamMulaiH, jamMulaiM);

	// 1. Validasi Tanggal: Wajib di tanggal yang sama
	if (waktuSekarang.tanggal !== jadwalTanggal) {
		if (waktuSekarang.tanggal < jadwalTanggal) {
			return {
				isValid: false,
				error: `Presensi belum dibuka. Presensi hanya dapat dilakukan pada tanggal kegiatan (${formatDateDDMMYYYY(jadwalTanggal)}).`,
				bukaPukul: waktuBuka.formatted
			};
		} else {
			return {
				isValid: false,
				error: `Presensi telah ditutup. Presensi hanya dapat dilakukan pada tanggal yang sama dengan kegiatan (${formatDateDDMMYYYY(jadwalTanggal)}).`,
				bukaPukul: waktuBuka.formatted
			};
		}
	}

	// 2. Validasi Jam: Minimal 1 jam sebelum jam dimulai
	const sekarangTotalMenit = waktuSekarang.jam * 60 + waktuSekarang.menit;
	const bukaTotalMenit = waktuBuka.jam * 60 + waktuBuka.menit;

	if (sekarangTotalMenit < bukaTotalMenit) {
		return {
			isValid: false,
			error: `Presensi belum dibuka. Presensi untuk kegiatan ini baru dapat dilakukan paling cepat 1 jam sebelum dimulai (mulai pukul ${waktuBuka.formatted} WIB).`,
			bukaPukul: waktuBuka.formatted
		};
	}

	return { isValid: true, bukaPukul: waktuBuka.formatted };
}
