<!--
  @file src/routes/+error.svelte
  @purpose Komponen halaman error global aplikasi Satu Generus
  @usedBy SvelteKit runtime saat terjadi error (404, 500, dll)
  @dependencies $app/state (page), @lucide/svelte
-->
<script lang="ts">
	import { page } from '$app/state';
	import { AlertTriangle, ArrowLeft, RefreshCw, Home } from '@lucide/svelte';
</script>

<svelte:head>
	<title>{page.status} - {page.error?.message || 'Terjadi Kesalahan'}</title>
</svelte:head>

<div class="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
	<div class="max-w-md w-full bg-card border border-border rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-5">
		<div class="w-16 h-16 rounded-2xl bg-destructive/15 text-destructive mx-auto flex items-center justify-center shadow-inner">
			<AlertTriangle class="w-8 h-8" />
		</div>

		<div class="space-y-2">
			<span class="text-xs font-bold tracking-wider uppercase text-destructive/80 bg-destructive/10 px-3 py-1 rounded-full">
				Error {page.status}
			</span>
			<h1 class="text-xl sm:text-2xl font-bold text-foreground tracking-tight pt-2">
				{page.status === 404 ? 'Halaman Tidak Ditemukan' : 'Terjadi Kesalahan Server'}
			</h1>
			<p class="text-xs sm:text-sm text-foreground/70 leading-relaxed max-w-sm mx-auto">
				{page.error?.message || 'Sistem mengalami kendala saat memproses permintaan Anda.'}
			</p>
		</div>

		<div class="pt-2 flex flex-col sm:flex-row gap-2.5">
			<button
				type="button"
				onclick={() => window.location.reload()}
				class="flex-1 py-2.5 px-4 rounded-xl border border-border bg-secondary hover:bg-secondary/80 text-foreground text-xs sm:text-sm font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer"
			>
				<RefreshCw class="w-4 h-4" />
				<span>Muat Ulang</span>
			</button>
			<a
				href="/"
				class="flex-1 py-2.5 px-4 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 shadow-sm"
			>
				<Home class="w-4 h-4" />
				<span>Kembali ke Beranda</span>
			</a>
		</div>
	</div>
</div>

