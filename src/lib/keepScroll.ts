/**
 * @file src/lib/keepScroll.ts
 * @purpose Helper callback submit SvelteKit use:enhance untuk mempertahankan posisi scroll (scroll restoration) dan mencegah loncatan layar ke atas (0, 0) saat aksi form (edit, hapus, update, toggle) disubmit
 * @usedBy Halaman admin & app yang memiliki tabel aksi (jadwal, wilayah, sensus, presensi, dapukan)
 * @dependencies $app/forms (SubmitFunction, ActionResult)
 * @publicFunctions keepScrollSubmit
 * @sideEffects Menyimpan window.scrollY/scrollX sebelum submit dan memulihkan scroll position secara instan setelah DOM selesai di-update
 */

import type { ActionResult, SubmitFunction } from '$app/forms';

export interface KeepScrollOptions {
	/** Callback yang dipanggil saat submit berhasil (result.type === 'success') */
	onSuccess?: (result: ActionResult) => void;
	/** Callback yang dipanggil saat submit gagal (result.type === 'failure' | 'error') */
	onError?: (result: ActionResult) => void;
	/** Apakah mereset form input fields setelah submit. Default: false */
	resetForm?: boolean;
	/** Elemen atau selector target yang ingin di-scroll ke view setelah update */
	target?: HTMLElement | string | null;
	/** Callback sebelum submit untuk mengatur state loading */
	beforeSubmit?: () => void;
	/** Callback setelah submit selesai (baik sukses maupun gagal) */
	onFinally?: () => void;
}

/**
 * Membuat handler SubmitFunction untuk use:enhance SvelteKit yang menjaga posisi scroll layar
 * pengguna agar tidak ter-reset ke puncak halaman (0, 0).
 */
export function keepScrollSubmit(options?: KeepScrollOptions): SubmitFunction {
	return () => {
		const scrollY = typeof window !== 'undefined' ? window.scrollY : 0;
		const scrollX = typeof window !== 'undefined' ? window.scrollX : 0;

		options?.beforeSubmit?.();

		return async ({ result, update }) => {
			try {
				if (result.type === 'success') {
					options?.onSuccess?.(result);
				} else if (result.type === 'failure' || result.type === 'error') {
					options?.onError?.(result);
				}

				await update({ reset: options?.resetForm ?? false });

				if (typeof window !== 'undefined') {
					// Pulihkan posisi scroll secara instan tanpa loncatan ke atas
					window.scrollTo({ top: scrollY, left: scrollX, behavior: 'instant' });

					if (options?.target) {
						const el =
							typeof options.target === 'string'
								? document.querySelector(options.target)
								: options.target;
						el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
					}
				}
			} finally {
				options?.onFinally?.();
			}
		};
	};
}

