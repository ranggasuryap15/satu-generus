/**
 * @file src/lib/confirmSubmit.ts
 * @purpose Helper SubmitFunction untuk use:enhance yang menampilkan modal konfirmasi global (confirmAction)
 *          SEBELUM form action dieksekusi, dengan dukungan pra-validasi opsional (beforeConfirm).
 * @usedBy Semua halaman CRUD: sensus, presensi, jadwal, wilayah, keuangan, profil, fr, shodaqoh
 * @dependencies $app/forms (SubmitFunction), #lib/confirm.svelte.ts (confirmAction, ConfirmOptions)
 * @publicFunctions confirmSubmit
 * @sideEffects Menampilkan modal dialog konfirmasi dan membatalkan submit jika user membatalkan atau pra-validasi gagal
 */

import { confirmAction, type ConfirmOptions } from '#lib/confirm.svelte.ts';
import type { SubmitFunction } from '$app/forms';

/**
 * Membungkus SubmitFunction apa pun (keepScrollSubmit, handler custom) dengan modal konfirmasi simpan.
 * Jika parameter beforeConfirm diberikan dan mengembalikan false, submit dibatalkan seketika tanpa membuka dialog konfirmasi.
 * Jika pengguna menekan "Batal", submit dibatalkan (cancel()); jika "Ya, Simpan", handler asli dilanjutkan.
 */
export function confirmSubmit(
	options: ConfirmOptions,
	submit: SubmitFunction,
	beforeConfirm?: () => boolean | void
): SubmitFunction {
	return async (input) => {
		if (beforeConfirm) {
			const isValid = beforeConfirm();
			if (isValid === false) {
				input.cancel();
				return;
			}
		}
		const ok = await confirmAction(options);
		if (!ok) {
			input.cancel();
			return;
		}
		return submit(input);
	};
}