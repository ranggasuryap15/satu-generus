/**
 * @file src/lib/confirmSubmit.ts
 * @purpose Helper SubmitFunction untuk use:enhance yang menampilkan modal konfirmasi global (confirmAction)
 *          SEBELUM form action dieksekusi. Sesuai RULES.md: CREATE & UPDATE CONFIRMATION — klik "Simpan"
 *          tidak boleh langsung mengirim form; harus dikonfirmasi dulu ("Ya, Simpan" / "Batal").
 * @usedBy Semua halaman CRUD: presensi, sensus, jadwal, wilayah, keuangan, profil, fr, shodaqoh
 * @dependencies $app/forms (SubmitFunction), #lib/confirm.svelte.ts (confirmAction, ConfirmOptions)
 * @publicFunctions confirmSubmit
 * @example
 *   use:enhance={confirmSubmit(
 *     { title: 'Simpan Jadwal?', message: 'Yakin ingin menyimpan jadwal ini?', confirmText: 'Ya, Simpan', cancelText: 'Batal', variant: 'primary' },
 *     keepScrollSubmit({ onSuccess: ... })
 *   )}
 */

import { confirmAction, type ConfirmOptions } from '#lib/confirm.svelte.ts';
import type { SubmitFunction } from '$app/forms';

/**
 * Membungkus SubmitFunction apa pun (keepScrollSubmit, handler custom) dengan modal konfirmasi simpan.
 * Jika pengguna menekan "Batal", submit dibatalkan (cancel()); jika "Ya, Simpan", handler asli dilanjutkan.
 */
export function confirmSubmit(options: ConfirmOptions, submit: SubmitFunction): SubmitFunction {
	return async (input) => {
		const ok = await confirmAction(options);
		if (!ok) {
			input.cancel();
			return;
		}
		return submit(input);
	};
}