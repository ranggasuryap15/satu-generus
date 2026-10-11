/**
 * @file src/lib/confirm.svelte.ts
 * @purpose State management dan helper Promise-based untuk modal konfirmasi global custom modern (pengganti browser native confirm)
 * @usedBy src/lib/components/ConfirmModalHost.svelte, routes admin dan routes umum di seluruh aplikasi
 * @dependencies Svelte 5 Runes ($state)
 * @publicFunctions confirmAction, confirmModalState
 * @sideEffects Mengontrol reaktivitas pembukaan dan penutupan modal dialog konfirmasi global
 */

export interface ConfirmOptions {
	title?: string;
	message: string;
	confirmText?: string;
	cancelText?: string;
	variant?: 'danger' | 'warning' | 'info' | 'primary';
}

class ConfirmModalState {
	isOpen = $state(false);
	title = $state('');
	message = $state('');
	confirmText = $state('Ya, Lanjutkan');
	cancelText = $state('Batal');
	variant = $state<'danger' | 'warning' | 'info' | 'primary'>('warning');
	private resolver: ((value: boolean) => void) | null = null;

	ask(options: ConfirmOptions): Promise<boolean> {
		this.title = options.title || 'Konfirmasi Tindakan';
		this.message = options.message;
		this.confirmText =
			options.confirmText || (options.variant === 'danger' ? 'Ya, Hapus' : 'Ya, Lanjutkan');
		this.cancelText = options.cancelText || 'Batal';
		this.variant = options.variant || 'warning';
		this.isOpen = true;

		return new Promise<boolean>((resolve) => {
			this.resolver = resolve;
		});
	}

	resolve(value: boolean) {
		this.isOpen = false;
		if (this.resolver) {
			this.resolver(value);
			this.resolver = null;
		}
	}
}

export const confirmModalState = new ConfirmModalState();

/**
 * Helper function async untuk memicu modal konfirmasi custom modern
 * Pengganti window.confirm() bawaan browser
 *
 * Contoh penggunaan:
 * ```ts
 * const ok = await confirmAction({
 *   title: 'Tutup Formulir?',
 *   message: 'Isian belum disimpan. Yakin ingin keluar?',
 *   variant: 'warning'
 * });
 * if (ok) closeModal();
 * ```
 */
export function confirmAction(options: ConfirmOptions | string): Promise<boolean> {
	if (typeof options === 'string') {
		return confirmModalState.ask({ message: options });
	}
	return confirmModalState.ask(options);
}

