<!--
  @file src/lib/components/navigation/AdminSidebar.svelte
  @purpose Komponen Sidebar navigasi admin responsif dengan pengelompokan menu (Ikhtisar, Pusat Data, Pengajian, Sistem), penanda rute aktif, dan badge permohonan pending
  @usedBy src/routes/(admin)/+layout.svelte
  @dependencies $app/state (page), @lucide/svelte
  @publicFunctions isItemActive
  @sideEffects Menavigasikan admin ke modul-modul manajemen data, menandai menu aktif, menampilkan badge approval presensi, dan menangani drawer mobile
-->
<script lang="ts">
	import { page } from '$app/state';
	import {
		CalendarCheck,
		CalendarDays,
		ExternalLink,
		FileSpreadsheet,
		LayoutDashboard,
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

	interface NavGroup {
		title?: string;
		items: AdminNavItem[];
	}

	let { isOpen = false, onClose = () => {} } = $props<{
		isOpen?: boolean;
		onClose?: () => void;
	}>();

	const totalPending = $derived(Number(page.data.totalPendingApprovals) || 0);

	const menuGroups: NavGroup[] = [
		{
			items: [{ href: '/admin', label: 'Dashboard', icon: LayoutDashboard }]
		},
		{
			title: 'Pusat Data',
			items: [
				{ href: '/admin/sensus', label: 'Sensus & KK', icon: Users },
				{ href: '/admin/sensus/batch', label: 'Batch Input Sensus', icon: FileSpreadsheet },
				{ href: '/admin/wilayah', label: 'Data Wilayah', icon: MapPin },
				{ href: '/admin/wilayah/batch', label: 'Batch Input Wilayah', icon: FileSpreadsheet }
			]
		},
		{
			title: 'Pengajian & Presensi',
			items: [
				{ href: '/admin/jadwal', label: 'Jadwal Pengajian', icon: CalendarDays },
				{ href: '/admin/presensi', label: 'Presensi Pengajian', icon: CalendarCheck }
			]
		},
		{
			title: 'Sistem & Otoritas',
			items: [
				{ href: '/admin/dapukan', label: 'Dapukan & RBAC', icon: ShieldCheck }
			]
		}
	];

	function isItemActive(href: string): boolean {
		if (href === '/admin') {
			return page.url.pathname === '/admin';
		}
		return page.url.pathname === href || page.url.pathname.startsWith(`${href}/`);
	}
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

		<!-- Navigasi Menu Berkelompok -->
		<nav class="space-y-4">
			{#each menuGroups as group}
				<div class="space-y-1">
					{#if group.title}
						<div class="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
							{group.title}
						</div>
					{/if}
					{#each group.items as item}
						{@const active = isItemActive(item.href)}
						<a
							href={item.href}
							onclick={onClose}
							class="flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors group {active
								? 'bg-secondary text-foreground font-semibold shadow-xs'
								: 'text-foreground/70 hover:bg-secondary/60 hover:text-foreground'}"
							aria-current={active ? 'page' : undefined}
						>
							<div class="flex items-center gap-3 min-w-0">
								<item.icon class="w-4 h-4 shrink-0 transition-colors {active ? 'text-primary' : 'text-foreground/60 group-hover:text-primary'}" />
								<span class="truncate">{item.label}</span>
							</div>
							{#if item.href === '/admin/presensi' && totalPending > 0}
								<span class="px-1.5 py-0.2 rounded-full bg-rose-500 text-white font-bold text-[9.5px] leading-tight shrink-0 shadow-xs">
									{totalPending}
								</span>
							{/if}
						</a>
					{/each}
				</div>
			{/each}
		</nav>
	</div>

	<!-- Bottom Section: Link ke Tampilan Jamaah (Client) -->
	<div class="border-t border-border pt-4">
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
	</div>
</aside>
