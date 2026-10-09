/**
 * @file src/lib/utils.ts
 * @purpose Utility functions untuk UI styling, helper types, format tanggal baku DD-MM-YYYY dan konversi ISO
 * @usedBy Komponen UI, Layout, Pages, dan Server Actions di seluruh aplikasi
 * @dependencies clsx, tailwind-merge
 * @publicFunctions cn, formatDateDDMMYYYY, normalizeDateToISO
 * @sideEffects Tidak ada (pure utility)
 */

import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

/**
 * Mengubah string tanggal ISO (YYYY-MM-DD), ISO datetime, unix timestamp, atau Date menjadi format baku DD-MM-YYYY.
 * Contoh: "2026-10-10" -> "10-10-2026"
 * Menggunakan string parsing langsung untuk mencegah pergeseran zona waktu (timezone shift).
 */
export function formatDateDDMMYYYY(dateInput: string | number | Date | null | undefined): string {
	if (!dateInput && dateInput !== 0) return '-';

	if (typeof dateInput === 'number') {
		const ms = dateInput < 10000000000 ? dateInput * 1000 : dateInput;
		const d = new Date(ms);
		if (isNaN(d.getTime())) return '-';
		const day = String(d.getDate()).padStart(2, '0');
		const month = String(d.getMonth() + 1).padStart(2, '0');
		const year = d.getFullYear();
		return `${day}-${month}-${year}`;
	}

	if (typeof dateInput === 'string') {
		const cleanDate = dateInput.trim();
		if (!cleanDate) return '-';

		// Jika sudah dalam format DD-MM-YYYY
		if (/^\d{2}-\d{2}-\d{4}$/.test(cleanDate)) {
			return cleanDate;
		}

		// Jika format DD/MM/YYYY
		const slashMatch = cleanDate.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
		if (slashMatch) {
			const [, day, month, year] = slashMatch;
			return `${day.padStart(2, '0')}-${month.padStart(2, '0')}-${year}`;
		}

		// Jika format YYYY-MM-DD (dengan atau tanpa time)
		const datePart = cleanDate.split('T')[0].split(' ')[0];
		const parts = datePart.split('-');
		if (parts.length === 3 && parts[0].length === 4) {
			const [year, month, day] = parts;
			return `${day.padStart(2, '0')}-${month.padStart(2, '0')}-${year}`;
		}
	}

	const d = new Date(dateInput);
	if (isNaN(d.getTime())) return String(dateInput);

	const day = String(d.getDate()).padStart(2, '0');
	const month = String(d.getMonth() + 1).padStart(2, '0');
	const year = d.getFullYear();
	return `${day}-${month}-${year}`;
}

/**
 * Mengubah input tanggal string (DD-MM-YYYY, DD/MM/YYYY, atau ISO) menjadi format standar ISO YYYY-MM-DD
 * untuk penyimpanan konsisten di database SQLite.
 */
export function normalizeDateToISO(dateInput: string | Date | null | undefined): string {
	if (!dateInput) return '';

	if (dateInput instanceof Date) {
		if (isNaN(dateInput.getTime())) return '';
		const day = String(dateInput.getDate()).padStart(2, '0');
		const month = String(dateInput.getMonth() + 1).padStart(2, '0');
		const year = dateInput.getFullYear();
		return `${year}-${month}-${day}`;
	}

	const clean = String(dateInput).trim();
	if (!clean) return '';

	// Jika format DD-MM-YYYY atau DD/MM/YYYY
	const dmyMatch = clean.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
	if (dmyMatch) {
		const [, day, month, year] = dmyMatch;
		return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
	}

	// Jika format YYYY-MM-DD atau YYYY/MM/DD
	const ymdMatch = clean.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
	if (ymdMatch) {
		const [, year, month, day] = ymdMatch;
		return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
	}

	return clean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChild<T> = T extends { child?: any } ? Omit<T, 'child'> : T;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChildren<T> = T extends { children?: any } ? Omit<T, 'children'> : T;
export type WithoutChildrenOrChild<T> = WithoutChildren<WithoutChild<T>>;
export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & { ref?: U | null };
