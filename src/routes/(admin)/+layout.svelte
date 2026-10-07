<!--
  @file src/routes/(admin)/+layout.svelte
  @purpose Layout utama zona admin (Desktop-first) dengan Sidebar responsif (hidden di mobile) dan Top Bar
  @usedBy Semua route di dalam grouping (admin)
  @dependencies AdminSidebar, AdminTopBar, Svelte 5 Runes
  @publicFunctions N/A (Svelte Component)
  @sideEffects Menata struktur tampilan desktop dengan sidebar persisten di kiri dan drawer di mobile
-->
<script lang="ts">
	import AdminSidebar from '$lib/components/navigation/AdminSidebar.svelte';
	import AdminTopBar from '$lib/components/navigation/AdminTopBar.svelte';

	let { children } = $props();
	let isMobileSidebarOpen = $state(false);
</script>

<div class="min-h-screen bg-background text-foreground flex transition-colors selection:bg-primary/20">
	<AdminSidebar isOpen={isMobileSidebarOpen} onClose={() => (isMobileSidebarOpen = false)} />

	<div class="flex-1 flex flex-col min-w-0">
		<AdminTopBar onToggleSidebar={() => (isMobileSidebarOpen = !isMobileSidebarOpen)} />

		<main class="flex-1 p-4 md:p-6 overflow-y-auto">
			{@render children()}
		</main>
	</div>
</div>
