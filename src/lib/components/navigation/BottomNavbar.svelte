<!--
  @file src/lib/components/navigation/BottomNavbar.svelte
  @purpose Komponen navigasi bawah (Bottom Navbar) ringkas dengan Quick Action Presensi dan penanda rute aktif untuk mobile client
  @usedBy src/routes/(app)/+layout.svelte
  @dependencies $app/state (page), @lucide/svelte (Home, Users, QrCode, User)
  @publicFunctions isItemActive
  @sideEffects Navigasi halaman client melalui tag link dengan penanda visual rute aktif
-->
<script lang="ts">
	import { page } from '$app/state';
	import { Home, QrCode, User, Users } from '@lucide/svelte';

	interface NavItem {
		href: string;
		label: string;
		icon: any;
		isFab?: boolean;
	}

	const navItems: NavItem[] = [
		{ href: '/', label: 'Beranda', icon: Home },
		{ href: '/sensus', label: 'Keluarga', icon: Users },
		{ href: '/presensi', label: 'Presensi', icon: QrCode, isFab: true },
		{ href: '/profil', label: 'Profil', icon: User }
	];

	function isItemActive(item: NavItem): boolean {
		if (item.href === '/') {
			return page.url.pathname === '/';
		}
		if (item.href === '/sensus') {
			return page.url.pathname === '/sensus' || page.url.pathname.startsWith('/sensus');
		}
		if (item.href === '/presensi') {
			return page.url.pathname === '/presensi' || page.url.pathname.startsWith('/presensi');
		}
		return page.url.pathname === item.href || page.url.pathname.startsWith(`${item.href}/`);
	}
</script>

<nav
	class="fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-md border-t border-border px-2 pb-safe"
	aria-label="Navigasi Utama Mobile"
>
	<div class="max-w-md mx-auto flex items-center justify-around h-16">
		{#each navItems as item}
			{@const active = isItemActive(item)}
			{#if item.isFab}
				<a
					href={item.href}
					class="-mt-6 flex flex-col items-center justify-center group"
					aria-label={item.label}
					aria-current={active ? 'page' : undefined}
				>
					<div
						class="w-13 h-13 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center transition-transform hover:scale-105 active:scale-95 border-4 border-background {active ? 'ring-2 ring-primary ring-offset-2 ring-offset-background scale-105' : ''}"
					>
						<item.icon class="w-6 h-6 stroke-[2.5]" />
					</div>
					<span class="text-[10px] mt-0.5 {active ? 'font-bold text-primary' : 'font-medium text-foreground/80'}">{item.label}</span>
				</a>
			{:else}
				<a
					href={item.href}
					class="flex flex-col items-center justify-center flex-1 py-1 transition-colors group relative {active ? 'text-primary' : 'text-foreground/60 hover:text-foreground'}"
					aria-current={active ? 'page' : undefined}
				>
					<item.icon class="w-5 h-5 transition-transform {active ? 'scale-110 text-primary' : 'group-hover:scale-110'}" />
					<span class="text-[11px] mt-1 {active ? 'font-bold text-primary' : 'font-medium text-foreground/60 group-hover:text-primary'}">{item.label}</span>
					{#if active}
						<span class="w-1.5 h-1.5 rounded-full bg-primary absolute bottom-0.5"></span>
					{/if}
				</a>
			{/if}
		{/each}
	</div>
</nav>

