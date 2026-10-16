<!--
  @file src/routes/(app)/+layout.svelte
  @purpose Layout utama untuk zona client/jamaah (Mobile-first) dengan Top Bar terintegrasi, Bottom Navbar 5-item, dan Footer
  @usedBy Semua route di dalam grouping (app)
  @dependencies ClientTopBar, BottomNavbar, AppFooter, $app/state (page), Svelte 5 Runes
  @publicFunctions N/A (Svelte Component)
  @sideEffects Menata struktur tampilan mobile-first dengan container terpusat, header terintegrasi pada beranda/presensi/transaksi/sensus, dan navigasi bawah
-->
<script lang="ts">
	import { page } from '$app/state';
	import ClientTopBar from '#lib/components/navigation/ClientTopBar.svelte';
	import BottomNavbar from '#lib/components/navigation/BottomNavbar.svelte';
	import AppFooter from '#lib/components/AppFooter.svelte';

	let { children } = $props();

	const hasIntegratedHeader = $derived(
		page.url.pathname === '/' ||
		page.url.pathname.startsWith('/presensi') ||
		page.url.pathname.startsWith('/transaksi') ||
		page.url.pathname === '/sensus'
	);
</script>

<div class="min-h-screen bg-background text-foreground flex flex-col transition-colors selection:bg-primary/20">
	{#if !hasIntegratedHeader}
		<ClientTopBar />
	{/if}

	<main class="flex-1 w-full max-w-md mx-auto {hasIntegratedHeader ? 'pb-24' : 'px-4 py-5 pb-24'} flex flex-col justify-between">
		<div>
			{@render children()}
		</div>
		<AppFooter class="mt-6" />
	</main>

	<BottomNavbar />
</div>

