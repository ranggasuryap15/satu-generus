<!--
  @file src/lib/components/navigation/ClientTopBar.svelte
  @purpose Komponen Top Bar untuk tampilan client (mobile-first) sesuai spesifikasi DESIGN.md
  @usedBy src/routes/(app)/+layout.svelte
  @dependencies lucide-svelte (Search, Bell), src/lib/components/ThemeToggle.svelte
  @publicFunctions N/A (Svelte Component)
  @sideEffects Menampilkan header persisten di bagian atas layar client
-->
<script lang="ts">
	import { Search, Bell } from 'lucide-svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';

	let { title = 'Satu Generus' } = $props<{ title?: string }>();
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

		<div class="flex items-center gap-1">
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

