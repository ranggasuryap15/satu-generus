<!--
  @file src/routes/(admin)/admin/+page.svelte
  @purpose Halaman utama Dashboard Admin untuk rekapitulasi data demografi dan presensi dinamis
  @usedBy Route admin '/admin'
  @dependencies @lucide/svelte (Users, Home, Calendar, ShieldCheck, ArrowRight, Plus), Svelte 5 Runes
  @publicFunctions N/A (Svelte Component)
  @sideEffects Menampilkan metrik data sensus dan ringkasan operasional jamaah
-->
<script lang="ts">
	import { ArrowRight, Calendar, Home, Plus, ShieldCheck, Users } from '@lucide/svelte';
	import type { PageData } from './$types';

	let { data } = $props<{ data: PageData }>();

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

		<div class="border border-border rounded-lg overflow-hidden">
			<table class="w-full text-left text-xs">
				<thead class="bg-secondary/60 text-foreground/70 uppercase text-[10px] tracking-wider border-b border-border">
					<tr>
						<th class="py-2.5 px-4 font-semibold">Tanggal</th>
						<th class="py-2.5 px-4 font-semibold">Nama Kegiatan</th>
						<th class="py-2.5 px-4 font-semibold">Kelompok</th>
						<th class="py-2.5 px-4 font-semibold text-right">Aksi</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-border">
					{#if data.recentJadwal.length === 0}
						<tr>
							<td colspan="4" class="py-8 text-center text-foreground/50">
								Belum ada jadwal kegiatan pengajian.
							</td>
						</tr>
					{:else}
						{#each data.recentJadwal as item}
							<tr class="hover:bg-secondary/30 transition-colors">
								<td class="py-3 px-4 font-mono font-medium text-foreground">{item.tanggal}</td>
								<td class="py-3 px-4 font-semibold text-foreground">{item.namaKegiatan}</td>
								<td class="py-3 px-4 text-foreground/70">{item.kelompokNama || '-'}</td>
								<td class="py-3 px-4 text-right">
									<a
										href={`/admin/presensi/${item.id}`}
										class="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-secondary hover:bg-secondary/80 text-foreground font-medium text-[11px] transition-colors"
									>
										Presensi
									</a>
								</td>
							</tr>
						{/each}
					{/if}
				</tbody>
			</table>
		</div>
	</div>
</div>
