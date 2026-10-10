<!--
  @file src/routes/(admin)/+layout.svelte
  @purpose Layout utama zona admin (Desktop-first) dengan Sidebar responsif, Top Bar, dan Footer
  @usedBy Semua route di dalam grouping (admin)
  @dependencies AdminSidebar, AdminTopBar, AppFooter, Svelte 5 Runes
  @publicFunctions N/A (Svelte Component)
  @sideEffects Menata struktur tampilan desktop dengan sidebar persisten di kiri, footer pembuat, dan drawer di mobile
-->
<script lang="ts">
	import AdminSidebar from '$lib/components/navigation/AdminSidebar.svelte';
	import AdminTopBar from '$lib/components/navigation/AdminTopBar.svelte';
	import AppFooter from '$lib/components/AppFooter.svelte';

	let { children } = $props();
	let isMobileSidebarOpen = $state(false);
</script>

<div class="min-h-screen bg-background text-foreground flex transition-colors selection:bg-primary/20">
	<AdminSidebar isOpen={isMobileSidebarOpen} onClose={() => (isMobileSidebarOpen = false)} />

	<div class="flex-1 flex flex-col min-w-0">
		<AdminTopBar onToggleSidebar={() => (isMobileSidebarOpen = !isMobileSidebarOpen)} />

		<main class="flex-1 p-4 md:p-6 overflow-y-auto flex flex-col justify-between">
			<div class="flex-1">
				{@render children()}
			</div>
			<AppFooter class="border-t border-border/40 mt-8 pt-4 pb-2" />
		</main>
	</div>
</div>
