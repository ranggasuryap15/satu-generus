<!--
  @file src/lib/components/navigation/ClientTopBar.svelte
  @purpose Komponen Top Bar untuk tampilan client (mobile-first) dengan tautan kembali ke Panel Admin
  @usedBy src/routes/(app)/+layout.svelte
  @dependencies lucide-svelte (Search, Bell, ShieldCheck), src/lib/components/ThemeToggle.svelte, $app/state (page)
  @publicFunctions N/A (Svelte Component)
  @sideEffects Menampilkan header persisten di bagian atas layar client dan tautan kembali ke /admin bagi admin
-->
<script lang="ts">
	import { Search, Bell, ShieldCheck } from '@lucide/svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import { page } from '$app/state';

	let { title = 'Satu Generus' } = $props<{ title?: string }>();

	const isAdmin = $derived(page.data.isAdmin);
</script>

<header
	class="sticky top-0 z-30 w-full bg-card/90 backdrop-blur-md border-b border-border transition-colors"
>
	<div class="max-w-md mx-auto px-4 h-14 flex items-center justify-between">
		<div class="flex items-center gap-2">
			<div class="w-8 h-8 rounded-lg bg-primary text-primary-foreground font-semibold flex items-center justify-center text-sm shadow-sm">
				SG
			</div>
			<h1 class="text-base font-semibold text-foreground tracking-tight line-clamp-1">{title}</h1>
		</div>

		<div class="flex items-center gap-1.5">
			{#if isAdmin}
				<a
					href="/admin"
					class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 text-xs font-semibold transition-colors"
					title="Kembali ke Panel Admin"
				>
					<ShieldCheck class="w-3.5 h-3.5" />
					<span class="text-[11px]">Admin</span>
				</a>
			{/if}

			<button
				type="button"
				class="p-2 text-foreground/70 hover:text-foreground rounded-lg hover:bg-secondary transition-colors"
				aria-label="Pencarian"
			>
				<Search class="w-5 h-5" />
			</button>
			<button
				type="button"
				class="p-2 text-foreground/70 hover:text-foreground rounded-lg hover:bg-secondary transition-colors relative"
				aria-label="Notifikasi"
			>
				<Bell class="w-5 h-5" />
				<span class="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-accent"></span>
			</button>
			<ThemeToggle />
		</div>
	</div>
</header>


