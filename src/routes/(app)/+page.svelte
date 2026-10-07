<!--
  @file src/routes/(app)/+page.svelte
  @purpose Halaman beranda client/jamaah (Mobile-First) berbasis Card Layout sesuai DESIGN.md
  @usedBy Route utama client '/'
  @dependencies @lucide/svelte (QrCode, FileSpreadsheet, Users, ChevronRight, Calendar), Svelte 5 Runes
  @publicFunctions N/A (Svelte Component)
  @sideEffects Menampilkan menu tugas cepat dan ringkasan kartu informasi jamaah
-->
<script lang="ts">
	import { QrCode, FileSpreadsheet, Users, ChevronRight, Calendar } from '@lucide/svelte';
	import type { PageData } from './$types';

	let { data } = $props<{ data: PageData }>();
</script>

<svelte:head>
	<title>Beranda - Satu Generus</title>
</svelte:head>

<div class="space-y-5">
	<!-- Sambutan & Status Pengguna -->
	<section class="bg-card border border-border rounded-2xl p-5 shadow-sm">
		<div class="flex items-center justify-between">
			<div>
				<p class="text-xs font-medium text-foreground/60">Selamat Datang,</p>
				<h2 class="text-base font-bold text-foreground tracking-tight">{data.user.namaLengkap}</h2>
			</div>
			<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary">
				{data.kelompokNama}
			</span>
		</div>
		<p class="text-xs text-foreground/70 mt-2 leading-relaxed">
			Akses layanan sensus keluarga dan presensi kegiatan pengajian dalam satu genggaman.
		</p>
	</section>

	<!-- Aksi Cepat (Quick Tasks) -->
	<section class="space-y-2">
		<h3 class="text-xs font-bold text-foreground/70 uppercase tracking-wider px-1">Layanan Utama</h3>
		<div class="grid grid-cols-2 gap-3">
			<a
				href="/presensi"
				class="bg-card border border-border hover:border-primary/50 transition-all rounded-2xl p-4 flex flex-col justify-between group shadow-sm active:scale-98"
			>
				<div class="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
					<QrCode class="w-5 h-5" />
				</div>
				<div>
					<h4 class="text-xs font-bold text-foreground">Presensi QR</h4>
					<p class="text-[11px] text-foreground/60 mt-0.5">Scan kehadiran pengajian</p>
				</div>
			</a>

			<a
				href="/sensus"
				class="bg-card border border-border hover:border-primary/50 transition-all rounded-2xl p-4 flex flex-col justify-between group shadow-sm active:scale-98"
			>
				<div class="w-10 h-10 rounded-xl bg-accent/20 text-accent flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
					<FileSpreadsheet class="w-5 h-5" />
				</div>
				<div>
					<h4 class="text-xs font-bold text-foreground">Sensus Keluarga</h4>
					<p class="text-[11px] text-foreground/60 mt-0.5">Update KK & data anggota</p>
				</div>
			</a>
		</div>
	</section>

	<!-- Jadwal Kegiatan Terdekat -->
	<section class="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-3">
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-2">
				<Calendar class="w-4 h-4 text-primary" />
				<h3 class="text-xs font-bold text-foreground">Jadwal Pengajian Terdekat</h3>
			</div>
			<a href="/presensi" class="text-[11px] font-semibold text-primary hover:underline flex items-center">
				Lihat Semua <ChevronRight class="w-3 h-3 ml-0.5" />
			</a>
		</div>

		<div class="border-t border-border/60 pt-3 space-y-2.5">
			{#if data.upcomingJadwal.length === 0}
				<p class="text-xs text-foreground/50 py-3 text-center">
					Belum ada jadwal kegiatan pengajian baru untuk kelompok Anda.
				</p>
			{:else}
				{#each data.upcomingJadwal as jadwal}
					<div class="flex items-start justify-between p-2 rounded-lg hover:bg-secondary/40 transition-colors">
						<div>
							<h4 class="text-xs font-semibold text-foreground">{jadwal.namaKegiatan}</h4>
							<p class="text-[11px] text-foreground/60 font-mono mt-0.5">{jadwal.tanggal}</p>
						</div>
						<span class="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
							{data.kelompokNama}
						</span>
					</div>
				{/each}
			{/if}
		</div>
	</section>
</div>
