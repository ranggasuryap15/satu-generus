<!--
  @file src/lib/components/navigation/BottomNavbar.svelte
  @purpose Komponen navigasi bawah (Bottom Navbar) client jamaah 5 kolom dengan Center Elevated FAB Presensi (Beranda, Keluarga, Presensi, Transaksi, Profil) sesuai konsep Flat Design Minimalist
  @usedBy src/routes/(app)/+layout.svelte
  @dependencies $app/state (page), @lucide/svelte (Home, Users, QrCode, Wallet, User)
  @publicFunctions isItemActive
  @sideEffects Navigasi halaman client melalui tag link dengan penanda visual rute aktif
-->
<script lang="ts">
	import { page } from '$app/state';
	import { Home, QrCode, User, Users, Wallet } from '@lucide/svelte';

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
		{ href: '/transaksi', label: 'Transaksi', icon: Wallet },
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
		if (item.href === '/transaksi') {
			return page.url.pathname === '/transaksi' || page.url.pathname.startsWith('/transaksi');
		}
		return page.url.pathname === item.href || page.url.pathname.startsWith(`${item.href}/`);
	}
</script>

<nav
	class="fixed bottom-3 inset-x-3 z-40 max-w-md mx-auto bg-[#1A2234]/95 dark:bg-[#1E293B]/95 backdrop-blur-md border border-slate-700/60 rounded-2xl shadow-xl px-2 py-1.5"
	aria-label="Navigasi Utama Client"
>
	<div class="grid grid-cols-5 items-end justify-items-center h-13">
		{#each navItems as item}
			{@const active = isItemActive(item)}
			{#if item.isFab}
				<!-- Center Elevated FAB Button untuk Presensi -->
				<a
					href={item.href}
					class="flex flex-col items-center justify-center -mt-6 select-none group cursor-pointer"
					aria-current={active ? 'page' : undefined}
				>
					<div
						class="w-12 h-12 rounded-full bg-[#05A875] text-slate-950 flex items-center justify-center shadow-lg border-[3px] border-[#131927] transition-transform duration-200 group-hover:scale-105 active:scale-95"
					>
						<item.icon class="w-6 h-6 stroke-[2.2]" />
					</div>
					<span
						class="text-[10px] mt-1 tracking-tight font-bold transition-colors {active
							? 'text-emerald-400'
							: 'text-slate-400 group-hover:text-slate-200'}"
					>
						{item.label}
					</span>
				</a>
			{:else}
				<!-- Normal Tab Item -->
				<a
					href={item.href}
					class="flex flex-col items-center justify-center w-full h-full py-1 transition-all group select-none cursor-pointer"
					aria-current={active ? 'page' : undefined}
				>
					<div
						class="w-10 h-7 rounded-xl flex items-center justify-center transition-all duration-200 {active
							? 'bg-emerald-500/15 text-emerald-400'
							: 'text-slate-400 group-hover:text-slate-200 group-hover:bg-slate-800/50'}"
					>
						<item.icon class="w-4.5 h-4.5 transition-transform duration-200 {active ? 'stroke-[2.2]' : 'stroke-[1.8]'}" />
					</div>
					<span
						class="text-[10px] mt-0.5 tracking-tight transition-colors duration-150 {active
							? 'font-bold text-emerald-400'
							: 'font-medium text-slate-400 group-hover:text-slate-200'}"
					>
						{item.label}
					</span>
				</a>
			{/if}
		{/each}
	</div>
</nav>

