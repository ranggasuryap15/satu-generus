<!--
  @file src/routes/(admin)/admin/+page.svelte
  @purpose Halaman utama Dashboard Admin untuk rekapitulasi data demografi dan presensi
  @usedBy Route admin '/admin'
  @dependencies lucide-svelte (Users, Home, Calendar, ShieldCheck, Download, Plus)
  @publicFunctions N/A (Svelte Component)
  @sideEffects Menampilkan metrik data sensus dan ringkasan operasional jamaah
-->
<script lang="ts">
	import { Users, Home, Calendar, ShieldCheck, Download, Plus } from '@lucide/svelte';

	const stats = [
		{ label: 'Total Jamaah', value: '1,280', icon: Users, change: '+12 bln ini' },
		{ label: 'Total Kepala Keluarga', value: '342', icon: Home, change: '100% terverifikasi' },
		{ label: 'Jadwal Pengajian Aktif', value: '8', icon: Calendar, change: 'Minggu ini' },
		{ label: 'Pengurus 4S Aktif', value: '24', icon: ShieldCheck, change: 'Daerah & Desa' }
	];
</script>

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
			<button
				type="button"
				class="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card text-xs font-medium text-foreground/80 hover:bg-secondary transition-colors"
			>
				<Download class="w-3.5 h-3.5" />
				Export Data
			</button>
			<button
				type="button"
				class="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors shadow-sm"
			>
				<Plus class="w-3.5 h-3.5" />
				Buat Jadwal Baru
			</button>
		</div>
	</div>

	<!-- Stats Grid -->
	<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
		{#each stats as stat}
			<div class="bg-card border border-border rounded-xl p-4 shadow-sm">
				<div class="flex items-center justify-between">
					<span class="text-xs font-medium text-foreground/60">{stat.label}</span>
					<div class="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center text-primary">
						<stat.icon class="w-4 h-4" />
					</div>
				</div>
				<p class="text-2xl font-bold text-foreground mt-2">{stat.value}</p>
				<p class="text-[11px] text-foreground/50 mt-1">{stat.change}</p>
			</div>
		{/each}
	</div>

	<!-- Section Rekapitulasi & Tabel Data Awal -->
	<div class="bg-card border border-border rounded-xl p-5 shadow-sm space-y-4">
		<div class="flex items-center justify-between">
			<div>
				<h2 class="text-sm font-semibold text-foreground">Aktivitas Presensi Pengajian Terakhir</h2>
				<p class="text-xs text-foreground/60 mt-0.5">Daftar kehadiran 5 kegiatan terbaru di tingkat kelompok.</p>
			</div>
		</div>

		<div class="border border-border rounded-lg overflow-hidden">
			<table class="w-full text-left text-xs">
				<thead class="bg-secondary/60 text-foreground/70 uppercase text-[10px] tracking-wider border-b border-border">
					<tr>
						<th class="py-2.5 px-4 font-semibold">Tanggal</th>
						<th class="py-2.5 px-4 font-semibold">Nama Kegiatan</th>
						<th class="py-2.5 px-4 font-semibold">Kelompok</th>
						<th class="py-2.5 px-4 font-semibold">Status</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-border">
					<tr class="hover:bg-secondary/30 transition-colors">
						<td class="py-3 px-4 font-medium text-foreground">2026-10-07</td>
						<td class="py-3 px-4 text-foreground/80">Pengajian Rutin Muda/i</td>
						<td class="py-3 px-4 text-foreground/70">Kelompok 1</td>
						<td class="py-3 px-4">
							<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary">
								Selesai
							</span>
						</td>
					</tr>
				</tbody>
			</table>
		</div>
	</div>
</div>

