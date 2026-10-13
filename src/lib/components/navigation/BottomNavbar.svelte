<!--
  @file src/lib/components/navigation/BottomNavbar.svelte
  @purpose Komponen navigasi bawah (Bottom Navbar) client jamaah bergaya floating bar modern yang konsisten tampil di mode mobile maupun desktop terpusat (max-w-md)
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
	}

	const navItems: NavItem[] = [
		{ href: '/', label: 'Beranda', icon: Home },
		{ href: '/sensus', label: 'Keluarga', icon: Users },
		{ href: '/presensi', label: 'Presensi', icon: QrCode },
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
	class="fixed bottom-3 inset-x-3 z-40 max-w-md mx-auto bg-card/95 backdrop-blur-md border border-border/90 rounded-2xl shadow-xl px-1.5 py-1"
	aria-label="Navigasi Utama Client"
>
	<div class="grid grid-cols-4 h-14 items-center">
		{#each navItems as item}
			{@const active = isItemActive(item)}
			<a
				href={item.href}
				class="flex flex-col items-center justify-center h-full py-0.5 transition-all group relative select-none"
				aria-current={active ? 'page' : undefined}
			>
				<!-- Active Pill Background & Icon Container -->
				<div
					class="w-12 h-6.5 rounded-full flex items-center justify-center transition-all duration-200 relative {active
						? 'bg-primary/15 text-primary scale-105'
						: 'text-foreground/60 group-hover:text-foreground group-hover:bg-secondary/60'}"
				>
					<item.icon class="w-4.5 h-4.5 transition-transform duration-200 {active ? 'stroke-[2.3]' : 'stroke-[1.8]'}" />
				</div>

				<!-- Menu Label -->
				<span
					class="text-[10px] mt-0.5 tracking-tight transition-colors duration-150 {active
						? 'font-bold text-primary'
						: 'font-medium text-foreground/60 group-hover:text-foreground'}"
				>
					{item.label}
				</span>
			</a>
		{/each}
	</div>
</nav>

