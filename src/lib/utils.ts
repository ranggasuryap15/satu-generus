/**
 * @file src/lib/utils.ts
 * @purpose Utility functions untuk UI styling, helper types, dan format tanggal baku DD-MM-YYYY
 * @usedBy Komponen UI, Layout, dan Pages di seluruh aplikasi
 * @dependencies clsx, tailwind-merge
 * @publicFunctions cn, formatDateDDMMYYYY
 * @sideEffects Tidak ada (pure utility)
 */

import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

/**
 * Mengubah string tanggal ISO (YYYY-MM-DD), ISO datetime, atau Date menjadi format baku DD-MM-YYYY.
 * Contoh: "2026-10-10" -> "10-10-2026"
 * Menggunakan string parsing langsung untuk mencegah pergeseran zona waktu (timezone shift).
 */
export function formatDateDDMMYYYY(dateInput: string | Date | null | undefined): string {
	if (!dateInput) return '-';

	if (typeof dateInput === 'string') {
		const cleanDate = dateInput.trim();
		if (!cleanDate) return '-';

		// Jika sudah dalam format DD-MM-YYYY
		if (/^\d{2}-\d{2}-\d{4}$/.test(cleanDate)) {
			return cleanDate;
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChild<T> = T extends { child?: any } ? Omit<T, 'child'> : T;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChildren<T> = T extends { children?: any } ? Omit<T, 'children'> : T;
export type WithoutChildrenOrChild<T> = WithoutChildren<WithoutChild<T>>;
export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & { ref?: U | null };
