<!--
  @file src/lib/components/navigation/AdminSidebar.svelte
  @purpose Komponen Sidebar vertikal navigasi admin (Desktop-first) sesuai spesifikasi DESIGN.md
  @usedBy src/routes/(admin)/+layout.svelte
  @dependencies lucide-svelte (LayoutDashboard, Users, CalendarCheck, MapPin, ShieldCheck, LogOut)
  @publicFunctions N/A (Svelte Component)
  @sideEffects Menavigasikan admin ke modul-modul manajemen data
-->
<script lang="ts">
	import {
		LayoutDashboard,
		Users,
		CalendarCheck,
		MapPin,
		ShieldCheck,
		LogOut,
		ExternalLink
	} from '@lucide/svelte';

	interface AdminNavItem {
		href: string;
		label: string;
		icon: any;
	}

	const menuItems: AdminNavItem[] = [
		{ href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
		{ href: '/admin/sensus', label: 'Sensus & KK', icon: Users },
		{ href: '/admin/presensi', label: 'Presensi', icon: CalendarCheck },
		{ href: '/admin/wilayah', label: 'Hierarki Wilayah', icon: MapPin },
		{ href: '/admin/dapukan', label: 'Dapukan & RBAC', icon: ShieldCheck }
	];
</script>

<aside
	class="w-64 bg-card border-r border-border min-h-screen flex flex-col justify-between p-4 transition-colors select-none"
	aria-label="Navigasi Sidebar Admin"
>
	<div class="space-y-6">
		<!-- Brand & Logo -->
		<div class="flex items-center gap-3 px-2 py-1">
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

		<!-- Navigasi Menu -->
		<nav class="space-y-1">
			{#each menuItems as item}
				<a
					href={item.href}
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

