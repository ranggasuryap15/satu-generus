<!--
  @file src/lib/components/navigation/BottomNavbar.svelte
  @purpose Komponen navigasi bawah (Bottom Navbar) statis untuk tampilan mobile client/jamaah
  @usedBy src/routes/(app)/+layout.svelte
  @dependencies lucide-svelte (Home, Users, Plus, CalendarCheck, User)
  @publicFunctions N/A (Svelte Component)
  @sideEffects Navigasi halaman client melalui tag link
-->
<script lang="ts">
	import { Home, Users, Plus, CalendarCheck, User } from 'lucide-svelte';

	interface NavItem {
		href: string;
		label: string;
		icon: any;
		isFab?: boolean;
	}

	const navItems: NavItem[] = [
		{ href: '/', label: 'Beranda', icon: Home },
		{ href: '/sensus', label: 'Sensus', icon: Users },
		{ href: '/sensus/tambah', label: 'Tambah', icon: Plus, isFab: true },
		{ href: '/presensi', label: 'Presensi', icon: CalendarCheck },
		{ href: '/profil', label: 'Profil', icon: User }
	];
</script>

<nav
	class="fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-md border-t border-border px-2 pb-safe"
	aria-label="Navigasi Utama Mobile"
>
	<div class="max-w-md mx-auto flex items-center justify-around h-16">
		{#each navItems as item}
			{#if item.isFab}
				<a
					href={item.href}
					class="-mt-6 flex flex-col items-center justify-center"
					aria-label={item.label}
				>
					<div
						class="w-13 h-13 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center transition-transform hover:scale-105 active:scale-95 border-4 border-background"
					>
						<item.icon class="w-6 h-6 stroke-[2.5]" />
					</div>
					<span class="text-[10px] font-medium text-foreground/80 mt-0.5">{item.label}</span>
				</a>
			{:else}
				<a
					href={item.href}
					class="flex flex-col items-center justify-center flex-1 py-1 text-foreground/70 hover:text-primary transition-colors group"
				>
					<item.icon class="w-5 h-5 group-hover:scale-110 transition-transform" />
					<span class="text-[11px] font-medium mt-1 group-hover:text-primary">{item.label}</span>
				</a>
			{/if}
		{/each}
	</div>
</nav>

