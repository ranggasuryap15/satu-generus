<!--
  @file src/routes/(admin)/+layout.svelte
  @purpose Layout utama untuk zona admin (Desktop-first) dengan Sidebar vertikal dan Top Bar
  @usedBy Semua route di dalam grouping (admin)
  @dependencies AdminSidebar, AdminTopBar
  @publicFunctions N/A (Svelte Component)
  @sideEffects Menata struktur tampilan desktop dengan sidebar persisten di kiri dan area konten di kanan
-->
<script lang="ts">
	import AdminSidebar from '$lib/components/navigation/AdminSidebar.svelte';
	import AdminTopBar from '$lib/components/navigation/AdminTopBar.svelte';

	let { children } = $props();
</script>

<div class="min-h-screen bg-background text-foreground flex transition-colors selection:bg-primary/20">
	<AdminSidebar />

	<div class="flex-1 flex flex-col min-w-0">
		<AdminTopBar />

		<main class="flex-1 p-6 overflow-y-auto">
			{@render children()}
		</main>
	</div>
</div>

