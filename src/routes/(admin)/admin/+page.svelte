<!--
  @file src/routes/(admin)/admin/+page.svelte
  @purpose Halaman utama Dashboard Admin untuk rekapitulasi data demografi, quick access modul pengurus, dan presensi dinamis
  @usedBy Route admin '/admin'
  @dependencies @lucide/svelte, $lib/components/Pagination.svelte, $lib/utils (formatDateDDMMYYYY), Svelte 5 Runes
  @publicFunctions N/A (Svelte Component)
  @sideEffects Menampilkan metrik data sensus, quick access modul administratif, dan ringkasan operasional jamaah
-->
<script lang="ts">
	import {
		ArrowRight,
		Calendar,
		CalendarCheck,
		CalendarDays,
		HandCoins,
		HeartHandshake,
		Home,
		Landmark,
		MapPin,
		Plus,
		ShieldCheck,
		Users
	} from '@lucide/svelte';
	import { formatDateDDMMYYYY } from '$lib/utils';
	import Pagination from '$lib/components/Pagination.svelte';
	import type { PageData } from './$types';

	let { data } = $props<{ data: PageData }>();

	let currentPage = $state(1);
	let pageSize = $state(5);

	let paginatedRecentJadwal = $derived(
		(data.recentJadwal || []).slice((currentPage - 1) * pageSize, currentPage * pageSize)
	);

	const canAccessKeuangan = $derived(Boolean(data.canAccessKeuangan));

	const quickAccessItems = $derived([
		{
			href: '/admin/profil-wilayah',
			title: 'Profil Wilayah',
			description: 'QRIS, rekening & info wilayah',
			icon: Landmark,
			badge: '4S',
			color: 'text-sky-600 dark:text-sky-400 bg-sky-500/10 border-sky-500/20'
		},
		{
			href: '/admin/sensus',
			title: 'Sensus Jamaah',
			description: 'Data KK, mutasi & anggota',
			icon: Users,
			badge: null,
			color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border-indigo-500/20'
		},
		{
			href: '/admin/presensi',
			title: 'Presensi Pengajian',
			description: 'Scan QR & rekap kehadiran',
			icon: CalendarCheck,
			badge: null,
			color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
		},
		{
			href: '/admin/jadwal',
			title: 'Jadwal Pengajian',
			description: 'Agenda daerah, desa & kelompok',
			icon: CalendarDays,
			badge: null,
			color: 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20'
		},
		...(canAccessKeuangan
			? [
					{
						href: '/admin/keuangan',
						title: 'Keuangan & FR',
						description: 'Dashboard & laporan FR jamaah',
						icon: HandCoins,
						badge: 'KU/Kyai',
						color: 'text-teal-600 dark:text-teal-400 bg-teal-500/10 border-teal-500/20'
					},
					{
						href: '/admin/keuangan/shodaqoh',
						title: 'Shodaqoh Wilayah',
						description: 'Rekap transfer, QRIS & approval',
						icon: HeartHandshake,
						badge: 'KU/Kyai',
						color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
					}
				]
			: []),
		{
			href: '/admin/dapukan',
			title: 'Dapukan & RBAC',
			description: 'Hak akses & struktur pengurus',
			icon: ShieldCheck,
			badge: null,
			color: 'text-purple-600 dark:text-purple-400 bg-purple-500/10 border-purple-500/20'
		},
		{
			href: '/admin/wilayah',
			title: 'Data Wilayah',
			description: 'Master daerah, desa & kelompok',
			icon: MapPin,
			badge: null,
			color: 'text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/20'
		}
	]);

	const statCards = $derived([
		{
			label: 'Total Jamaah',
			value: data.stats.totalJamaah.toLocaleString('id-ID'),
			icon: Users,
			sub: 'Terdaftar di sistem'
		},
		{
			label: 'Total Kartu Keluarga',
			value: data.stats.totalKeluarga.toLocaleString('id-ID'),
			icon: Home,
			sub: 'Tersensus & terenkripsi'
		},
		{
			label: 'Jadwal Pengajian',
			value: data.stats.totalJadwal.toLocaleString('id-ID'),
			icon: Calendar,
			sub: 'Kegiatan terjadwal'
		},
		{
			label: 'Pengurus 4S Aktif',
			value: data.stats.totalPengurus.toLocaleString('id-ID'),
			icon: ShieldCheck,
			sub: 'Hak akses administratif'
		}
	]);
</script>

<svelte:head>
	<title>Dashboard Admin - Satu Generus</title>
</svelte:head>

<div class="space-y-6">
	<!-- Page Header -->
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
		<div>
			<h1 class="text-xl font-bold text-foreground tracking-tight">Dashboard Ringkasan</h1>
			<p class="text-xs text-foreground/60 mt-0.5">
				Pantau data demografi sensus dan aktivitas presensi pengajian secara real-time.
			</p>
		</div>

		<div class="flex items-center gap-2">
			<a
				href="/admin/sensus"
				class="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card text-xs font-semibold text-foreground/80 hover:bg-secondary transition-colors"
			>
				<span>Kelola Sensus</span>
				<ArrowRight class="w-3.5 h-3.5" />
			</a>
			<a
				href="/admin/presensi"
				class="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors shadow-sm"
			>
				<Plus class="w-3.5 h-3.5" />
				<span>Buat Jadwal Baru</span>
			</a>
		</div>
	</div>

	<!-- Stats Grid -->
	<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
		{#each statCards as stat}
			<div class="bg-card border border-border rounded-xl p-4 shadow-sm">
				<div class="flex items-center justify-between">
					<span class="text-xs font-medium text-foreground/60">{stat.label}</span>
					<div class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
						<stat.icon class="w-4 h-4" />
					</div>
				</div>
				<p class="text-2xl font-bold text-foreground mt-2">{stat.value}</p>
				<p class="text-[11px] text-foreground/50 mt-1">{stat.sub}</p>
			</div>
		{/each}
	</div>

	<!-- Quick Access Modul Pengurus / Admin Quick Access -->
	<div class="space-y-3">
		<div class="flex items-center justify-between">
			<h2 class="text-sm font-semibold text-foreground tracking-tight">Akses Cepat Pengurus</h2>
			<span class="text-[11px] text-foreground/50">Pintasan modul administratif</span>
		</div>

		<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
			{#each quickAccessItems as item}
				<a
					href={item.href}
					class="group p-3.5 rounded-xl border border-border bg-card hover:bg-secondary/40 hover:border-primary/30 transition-all shadow-xs flex flex-col justify-between gap-3 active:scale-[0.98]"
				>
					<div class="flex items-start justify-between gap-2">
						<div class="w-9 h-9 rounded-xl flex items-center justify-center border {item.color} transition-transform group-hover:scale-105">
							<item.icon class="w-4 h-4" />
						</div>
						{#if item.badge}
							<span class="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-primary/10 text-primary border border-primary/20">
								{item.badge}
							</span>
						{/if}
					</div>

					<div>
						<h3 class="text-xs font-semibold text-foreground group-hover:text-primary transition-colors flex items-center gap-1">
							<span>{item.title}</span>
							<ArrowRight class="w-3 h-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-primary" />
						</h3>
						<p class="text-[11px] text-foreground/55 line-clamp-1 mt-0.5">
							{item.description}
						</p>
					</div>
				</a>
			{/each}
		</div>
	</div>

	<!-- Section Rekapitulasi & Tabel Kegiatan Terbaru -->
	<div class="bg-card border border-border rounded-xl p-5 shadow-sm space-y-4">
		<div class="flex items-center justify-between">
			<div>
				<h2 class="text-sm font-semibold text-foreground">Aktivitas Presensi Pengajian Terakhir</h2>
				<p class="text-xs text-foreground/60 mt-0.5">Daftar kegiatan pengajian yang baru dibuat atau sedang berjalan.</p>
			</div>

			<a
				href="/admin/presensi"
				class="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1"
			>
				Lihat Semua Jadwal <ArrowRight class="w-3 h-3" />
			</a>
		</div>

		<!-- Presentasi Jadwal: Compact Cards di Mobile (< md), Tabel di Desktop (>= md) -->
		{#if data.recentJadwal.length === 0}
			<div class="border border-border rounded-xl p-8 text-center text-foreground/50 text-sm">
				Belum ada jadwal kegiatan pengajian.
			</div>
		{:else}
			<!-- 1. Tampilan Mobile: Compact Cards -->
			<div class="md:hidden space-y-2.5">
				{#each paginatedRecentJadwal as item}
					<div class="border border-border rounded-xl p-3.5 bg-card flex items-center justify-between gap-3 shadow-xs">
						<div class="min-w-0">
							<span class="font-mono text-xs font-semibold text-primary">
								{formatDateDDMMYYYY(item.tanggal)}
							</span>
							<h4 class="text-sm font-semibold text-foreground truncate mt-0.5">
								{item.namaKegiatan}
							</h4>
							<p class="text-xs text-foreground/60 truncate mt-0.5">
								{item.kelompokNama || 'Semua Kelompok'}
							</p>
						</div>

						<a
							href={`/admin/presensi/${item.id}`}
							class="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary font-semibold text-xs shrink-0 transition-colors"
						>
							Presensi
						</a>
					</div>
				{/each}
				<Pagination
					bind:currentPage
					bind:pageSize
					totalItems={data.recentJadwal.length}
					pageSizeOptions={[5, 10, 20]}
				/>
			</div>

			<!-- 2. Tampilan Desktop: Tabel Lengkap -->
			<div class="hidden md:block border border-border rounded-xl overflow-hidden shadow-xs">
				<table class="w-full text-left text-sm">
					<thead class="bg-secondary/60 text-foreground/70 uppercase text-xs tracking-wider border-b border-border">
						<tr>
							<th class="py-3 px-4 font-semibold">Tanggal</th>
							<th class="py-3 px-4 font-semibold">Nama Kegiatan</th>
							<th class="py-3 px-4 font-semibold">Kelompok</th>
							<th class="py-3 px-4 font-semibold text-right">Aksi</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-border">
						{#each paginatedRecentJadwal as item}
							<tr class="hover:bg-secondary/30 transition-colors">
								<td class="py-3 px-4 font-mono font-medium text-foreground">{formatDateDDMMYYYY(item.tanggal)}</td>
								<td class="py-3 px-4 font-semibold text-foreground">{item.namaKegiatan}</td>
								<td class="py-3 px-4 text-foreground/70">{item.kelompokNama || '-'}</td>
								<td class="py-3 px-4 text-right">
									<a
										href={`/admin/presensi/${item.id}`}
										class="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground font-semibold text-xs transition-colors"
									>
										Presensi
									</a>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
				<div class="p-4 border-t border-border">
					<Pagination
						bind:currentPage
						bind:pageSize
						totalItems={data.recentJadwal.length}
						pageSizeOptions={[5, 10, 20]}
					/>
				</div>
			</div>
		{/if}
	</div>
</div>
