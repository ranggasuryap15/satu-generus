<!--
  @file src/routes/(admin)/+layout.svelte
  @purpose Layout utama zona admin (Desktop & Mobile) dengan Sidebar responsif, Top Bar, Bottom Navbar khusus mobile, dan Footer
  @usedBy Semua route di dalam grouping (admin)
  @dependencies AdminSidebar, AdminTopBar, AdminBottomNav, AppFooter, Svelte 5 Runes
  @publicFunctions N/A (Svelte Component)
  @sideEffects Menata struktur tampilan desktop dengan sidebar persisten di kiri, bottom navbar di mobile, dan drawer navigasi
-->
<script lang="ts">
	import AdminSidebar from '$lib/components/navigation/AdminSidebar.svelte';
	import AdminTopBar from '$lib/components/navigation/AdminTopBar.svelte';
	import AdminBottomNav from '$lib/components/navigation/AdminBottomNav.svelte';
	import AppFooter from '$lib/components/AppFooter.svelte';

	let { children } = $props();
	let isMobileSidebarOpen = $state(false);
</script>

<div class="min-h-screen bg-background text-foreground flex transition-colors selection:bg-primary/20">
	<AdminSidebar isOpen={isMobileSidebarOpen} onClose={() => (isMobileSidebarOpen = false)} />

	<div class="flex-1 flex flex-col min-w-0">
		<AdminTopBar onToggleSidebar={() => (isMobileSidebarOpen = !isMobileSidebarOpen)} />

		<main class="flex-1 p-4 md:p-6 pb-24 md:pb-6 overflow-y-auto flex flex-col justify-between">
			<div class="flex-1">
				{@render children()}
			</div>
			<AppFooter class="border-t border-border/40 mt-8 pt-4 pb-2" />
		</main>
	</div>

	<!-- Bottom Navbar Khusus Mobile Admin (md:hidden) -->
	<AdminBottomNav onOpenSidebar={() => (isMobileSidebarOpen = true)} />
</div>
