<!--
  @file src/routes/(app)/+layout.svelte
  @purpose Layout utama untuk zona client/jamaah (Mobile-first) dengan Top Bar dan Bottom Navbar
  @usedBy Semua route di dalam grouping (app)
  @dependencies ClientTopBar, BottomNavbar
  @publicFunctions N/A (Svelte Component)
  @sideEffects Menata struktur tampilan mobile-first dengan container terpusat dan navigasi bawah
-->
<script lang="ts">
	import ClientTopBar from '$lib/components/navigation/ClientTopBar.svelte';
	import BottomNavbar from '$lib/components/navigation/BottomNavbar.svelte';

	let { children } = $props();
</script>

<div class="min-h-screen bg-background text-foreground flex flex-col transition-colors selection:bg-primary/20">
	<ClientTopBar />

	<main class="flex-1 w-full max-w-md mx-auto px-4 py-5 pb-24">
		{@render children()}
	</main>

	<BottomNavbar />
</div>

