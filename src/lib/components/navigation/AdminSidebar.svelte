<!--
  @file src/lib/components/navigation/AdminSidebar.svelte
  @purpose Komponen Sidebar navigasi admin responsif (sembunyi di mobile, persisten di desktop >= 768px)
  @usedBy src/routes/(admin)/+layout.svelte
  @dependencies @lucide/svelte (LayoutDashboard, Users, CalendarCheck, MapPin, ShieldCheck, LogOut, ExternalLink, X)
  @publicFunctions N/A (Svelte Component)
  @sideEffects Menavigasikan admin ke modul-modul manajemen data dan menangani buka/tutup drawer mobile
-->
<script lang="ts">
	import {
		CalendarCheck,
		ExternalLink,
		LayoutDashboard,
		LogOut,
		MapPin,
		ShieldCheck,
		Users,
		X
	} from '@lucide/svelte';

	interface AdminNavItem {
		href: string;
		label: string;
		icon: any;
	}

	let { isOpen = false, onClose = () => {} } = $props<{
		isOpen?: boolean;
		onClose?: () => void;
	}>();

	const menuItems: AdminNavItem[] = [
		{ href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
		{ href: '/admin/sensus', label: 'Sensus & KK', icon: Users },
		{ href: '/admin/presensi', label: 'Presensi', icon: CalendarCheck },
		{ href: '/admin/wilayah', label: 'Hierarki Wilayah', icon: MapPin },
		{ href: '/admin/dapukan', label: 'Dapukan & RBAC', icon: ShieldCheck }
	];
</script>

<!-- Backdrop Blur khusus mobile saat drawer terbuka -->
{#if isOpen}
	<div
		class="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden transition-opacity"
		onclick={onClose}
		role="presentation"
	></div>
{/if}

<!-- Sidebar Drawer: Tersembunyi di mode mobile (< 768px) kecuali dipicu terbuka, persisten di desktop -->
<aside
	class="
		fixed md:static inset-y-0 left-0 z-50
		w-64 bg-card border-r border-border min-h-screen
		flex flex-col justify-between p-4 transition-transform duration-200 select-none
		{isOpen ? 'translate-x-0 shadow-2xl flex' : '-translate-x-full md:translate-x-0 hidden md:flex'}
	"
	aria-label="Navigasi Sidebar Admin"
>
	<div class="space-y-6">
		<!-- Brand & Logo + Tombol Tutup Mobile -->
		<div class="flex items-center justify-between px-2 py-1">
			<div class="flex items-center gap-3">
				<div
					class="w-9 h-9 rounded-xl bg-primary text-primary-foreground font-bold flex items-center justify-center text-sm shadow"
				>
					SG
				</div>
				<div>
					<h2 class="text-sm font-bold text-foreground tracking-tight leading-none">Satu Generus</h2>
					<span class="text-[11px] text-foreground/60 font-medium">Panel Pengurus</span>
				</div>
			</div>

			<!-- Tombol Close khusus tampilan mobile -->
			<button
				type="button"
				onclick={onClose}
				class="p-1.5 rounded-lg text-foreground/60 hover:text-foreground hover:bg-secondary md:hidden transition-colors"
				aria-label="Tutup Menu Sidebar"
			>
				<X class="w-5 h-5" />
			</button>
		</div>

		<!-- Navigasi Menu -->
		<nav class="space-y-1">
			{#each menuItems as item}
				<a
					href={item.href}
					onclick={onClose}
					class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium text-foreground/70 hover:bg-secondary hover:text-foreground transition-colors group"
				>
					<item.icon class="w-4 h-4 text-foreground/60 group-hover:text-primary transition-colors" />
					<span>{item.label}</span>
				</a>
			{/each}
		</nav>
	</div>

	<!-- Bottom Section: Link ke Client & Logout -->
	<div class="border-t border-border pt-4 space-y-1">
		<a
			href="/"
			onclick={onClose}
			class="flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-foreground/70 hover:bg-secondary hover:text-foreground transition-colors"
		>
			<span class="flex items-center gap-2">
				<ExternalLink class="w-4 h-4 text-foreground/50" />
				Tampilan Jamaah
			</span>
			<span class="text-[10px] bg-secondary px-1.5 py-0.5 rounded text-foreground/60">Client</span>
		</a>

		<a
			href="/logout"
			class="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
		>
			<LogOut class="w-4 h-4" />
			<span>Keluar Akun</span>
		</a>
	</div>
</aside>
