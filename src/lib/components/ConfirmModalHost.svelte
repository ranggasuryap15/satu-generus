<!--
  @file src/lib/components/ConfirmModalHost.svelte
  @purpose Komponen modal konfirmasi global berdesain modern dengan backdrop blur, icon dinamis, dan keyboard shortcuts
  @usedBy src/routes/+layout.svelte
  @dependencies @lucide/svelte (AlertTriangle, AlertCircle, Info, X), #lib/confirm.svelte
  @publicFunctions N/A (Svelte Component)
  @sideEffects Mengontrol rendering modal konfirmasi di root viewport dan menangkap keyboard Escape
-->
<script lang="ts">
	import { AlertTriangle, AlertCircle, Info, X } from '@lucide/svelte';
	import { confirmModalState } from '#lib/confirm.svelte.ts';

	function handleConfirm() {
		confirmModalState.resolve(true);
	}

	function handleCancel() {
		confirmModalState.resolve(false);
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (!confirmModalState.isOpen) return;
		if (event.key === 'Escape') {
			event.preventDefault();
			handleCancel();
		}
	}
</script>

<svelte:window onkeydown={handleKeyDown} />

{#if confirmModalState.isOpen}
	<div
		class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-150"
		role="dialog"
		aria-modal="true"
		aria-labelledby="confirm-modal-title"
		tabindex="-1"
		onclick={(e) => {
			if (e.target === e.currentTarget) handleCancel();
		}}
	>
		<div
			class="bg-card border border-border rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4 text-center animate-in zoom-in-95 duration-150 relative"
		>
			<button
				type="button"
				onclick={handleCancel}
				class="absolute right-3.5 top-3.5 p-1 rounded-lg hover:bg-secondary text-foreground/50 hover:text-foreground transition-colors"
				aria-label="Tutup dialog"
			>
				<X class="w-4 h-4" />
			</button>

			<!-- Ikon Sesuai Varian -->
			<div class="mx-auto flex items-center justify-center">
				{#if confirmModalState.variant === 'danger'}
					<div class="w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
						<AlertCircle class="w-6 h-6" />
					</div>
				{:else if confirmModalState.variant === 'warning'}
					<div class="w-12 h-12 rounded-full bg-amber-500/15 text-amber-500 flex items-center justify-center">
						<AlertTriangle class="w-6 h-6" />
					</div>
				{:else}
					<div class="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
						<Info class="w-6 h-6" />
					</div>
				{/if}
			</div>

			<!-- Teks Judul & Deskripsi Pesan -->
			<div class="space-y-2">
				<h3 id="confirm-modal-title" class="text-base sm:text-lg font-bold text-foreground tracking-tight">
					{confirmModalState.title}
				</h3>
				<p class="text-sm text-foreground/75 leading-relaxed max-w-xs mx-auto">
					{confirmModalState.message}
				</p>
			</div>

			<!-- Tombol Batal & Konfirmasi -->
			<div class="flex items-center justify-center gap-2.5 pt-2">
				<button
					type="button"
					onclick={handleCancel}
					class="w-full py-2.5 px-4 rounded-xl border border-border text-sm font-semibold text-foreground/80 hover:bg-secondary hover:text-foreground transition-all active:scale-95"
				>
					{confirmModalState.cancelText}
				</button>

				<button
					type="button"
					onclick={handleConfirm}
					class="w-full py-2.5 px-4 rounded-xl text-sm font-semibold shadow-sm transition-all active:scale-95 {confirmModalState.variant === 'danger'
						? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
						: confirmModalState.variant === 'warning'
							? 'bg-amber-500 text-white hover:bg-amber-600'
							: 'bg-primary text-primary-foreground hover:bg-primary/90'}"
				>
					{confirmModalState.confirmText}
				</button>
			</div>
		</div>
	</div>
{/if}

