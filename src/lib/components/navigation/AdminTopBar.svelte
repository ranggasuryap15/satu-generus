<!--
  @file src/lib/components/navigation/AdminTopBar.svelte
  @purpose Komponen Header Top Bar untuk tampilan admin (Desktop-first)
  @usedBy src/routes/(admin)/+layout.svelte
  @dependencies lucide-svelte (Search, Bell, User), src/lib/components/ThemeToggle.svelte
  @publicFunctions N/A (Svelte Component)
  @sideEffects Menampilkan global search dan kontrol status admin
-->
<script lang="ts">
	import { Search, Bell, UserCheck } from 'lucide-svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
</script>

<header class="h-16 border-b border-border bg-card px-6 flex items-center justify-between transition-colors">
	<div class="flex items-center gap-3 w-96">
		<div class="relative w-full">
			<Search class="w-4 h-4 text-foreground/40 absolute left-3 top-1/2 -translate-y-1/2" />
			<input
				type="search"
				placeholder="Cari jamaah, KK, kelompok, kegiatan..."
				class="w-full bg-secondary/60 border border-border rounded-lg pl-9 pr-3 py-1.5 text-xs text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary focus:bg-background transition-all"
			/>
		</div>
	</div>

	<div class="flex items-center gap-3">
		<ThemeToggle />

		<button
			type="button"
			class="p-2 text-foreground/70 hover:text-foreground rounded-lg hover:bg-secondary transition-colors relative"
			aria-label="Notifikasi Admin"
		>
			<Bell class="w-4 h-4" />
			<span class="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-accent"></span>
		</button>

		<div class="h-6 w-px bg-border"></div>

		<div class="flex items-center gap-2 pl-1">
			<div class="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-medium text-xs">
				<UserCheck class="w-4 h-4" />
			</div>
			<div class="text-left hidden sm:block">
				<p class="text-xs font-semibold text-foreground leading-tight">Admin Daerah</p>
				<p class="text-[10px] text-foreground/60 leading-tight">Pengurus 4S</p>
			</div>
		</div>
	</div>
</header>

