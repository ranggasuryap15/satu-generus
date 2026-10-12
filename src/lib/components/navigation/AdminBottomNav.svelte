<!--
  @file src/lib/components/navigation/AdminBottomNav.svelte
  @purpose Komponen Bottom Navbar mobile admin (md:hidden) bergaya floating bar modern yang terangkat simetris dari bawah layar HP untuk mencegah tabrakan dengan tombol navigasi sistem Android/iOS
  @usedBy src/routes/(admin)/+layout.svelte
  @dependencies $app/state (page), @lucide/svelte (LayoutDashboard, Landmark, Users, HandCoins, CalendarCheck, Menu)
  @publicFunctions isItemActive
  @sideEffects Menavigasikan admin ke modul inti via mobile bottom bar dan membuka sidebar drawer untuk menu tambahan
-->
<script lang="ts">
	import { page } from '$app/state';
	import {
		CalendarCheck,
		HandCoins,
		Landmark,
		LayoutDashboard,
		Menu,
		Users
	} from '@lucide/svelte';

	let { onOpenSidebar = () => {} } = $props<{ onOpenSidebar?: () => void }>();

	const canAccessKeuangan = $derived(Boolean(page.data.canAccessKeuangan));
	const totalPending = $derived(Number(page.data.totalPendingApprovals) || 0);

	interface BottomNavItem {
		href: string;
		label: string;
		icon: any;
		badge?: number;
	}

	const navItems = $derived<BottomNavItem[]>([
		{ href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
		{ href: '/admin/profil-wilayah', label: 'Wilayah', icon: Landmark },
		{ href: '/admin/sensus', label: 'Sensus', icon: Users },
		canAccessKeuangan
			? { href: '/admin/keuangan', label: 'Keuangan', icon: HandCoins }
			: { href: '/admin/presensi', label: 'Presensi', icon: CalendarCheck, badge: totalPending }
	]);

	function isItemActive(href: string): boolean {
		if (href === '/admin') {
			return page.url.pathname === '/admin';
		}
		return page.url.pathname === href || page.url.pathname.startsWith(`${href}/`);
	}
</script>

<nav
	class="fixed bottom-3 inset-x-3 z-40 max-w-md mx-auto bg-card/95 backdrop-blur-md border border-border/90 rounded-2xl md:hidden shadow-xl px-1.5 py-1"
	aria-label="Navigasi Bawah Admin Mobile"
>
	<div class="grid grid-cols-5 h-14 items-center">
		{#each navItems as item}
			{@const active = isItemActive(item.href)}
			<a
				href={item.href}
				class="flex flex-col items-center justify-center h-full py-0.5 transition-all group relative select-none"
				aria-current={active ? 'page' : undefined}
			>
				<!-- Active Pill Background & Icon Container -->
				<div
					class="w-11 h-6.5 rounded-full flex items-center justify-center transition-all duration-200 relative {active
						? 'bg-primary/15 text-primary scale-105'
						: 'text-foreground/60 group-hover:text-foreground group-hover:bg-secondary/60'}"
				>
					<item.icon class="w-4.5 h-4.5 transition-transform duration-200 {active ? 'stroke-[2.3]' : 'stroke-[1.8]'}" />
					{#if item.badge && item.badge > 0}
						<span
							class="absolute -top-1 -right-1 min-w-3.5 h-3.5 px-0.5 rounded-full bg-rose-500 text-white font-bold text-[8px] flex items-center justify-center shadow-xs"
						>
							{item.badge > 9 ? '9+' : item.badge}
						</span>
					{/if}
				</div>

				<!-- Label -->
				<span
					class="text-[9.5px] tracking-tight mt-0.5 line-clamp-1 transition-colors duration-200 {active
						? 'font-bold text-primary'
						: 'font-medium text-foreground/60 group-hover:text-foreground'}"
				>
					{item.label}
				</span>
			</a>
		{/each}

		<!-- Tombol Buka Menu Sidebar Lengkap -->
		<button
			type="button"
			onclick={onOpenSidebar}
			class="flex flex-col items-center justify-center h-full py-0.5 transition-all group relative select-none cursor-pointer"
			aria-label="Buka Semua Menu Admin"
		>
			<div
				class="w-11 h-6.5 rounded-full flex items-center justify-center transition-all duration-200 text-foreground/60 group-hover:text-foreground group-hover:bg-secondary/60 relative"
			>
				<Menu class="w-4.5 h-4.5 stroke-[1.8]" />
				{#if canAccessKeuangan && totalPending > 0}
					<!-- Notifikasi pending approval tetap terlihat jika slot 4 adalah Keuangan -->
					<span
						class="absolute -top-1 -right-1 min-w-3.5 h-3.5 px-0.5 rounded-full bg-rose-500 text-white font-bold text-[8px] flex items-center justify-center shadow-xs"
					>
						{totalPending > 9 ? '9+' : totalPending}
					</span>
				{/if}
			</div>

			<span class="text-[9.5px] tracking-tight mt-0.5 font-medium text-foreground/60 group-hover:text-foreground">
				Lainnya
			</span>
		</button>
	</div>
</nav>

