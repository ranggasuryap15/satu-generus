<!--
  @file src/routes/(app)/+page.svelte
  @purpose Halaman beranda client/jamaah (Mobile-First) berbasis Card Layout sesuai DESIGN.md
  @usedBy Route utama client '/'
  @dependencies lucide-svelte (QrCode, FileSpreadsheet, Users, ChevronRight)
  @publicFunctions N/A (Svelte Component)
  @sideEffects Menampilkan menu tugas cepat dan ringkasan kartu informasi jamaah
-->
<script lang="ts">
	import { QrCode, FileSpreadsheet, Users, ChevronRight, Calendar } from '@lucide/svelte';
</script>

<div class="space-y-5">
	<!-- Sambutan & Status Pengguna -->
	<section class="bg-card border border-border rounded-xl p-4 shadow-sm">
		<div class="flex items-center justify-between">
			<div>
				<p class="text-xs font-medium text-foreground/60">Selamat Datang</p>
				<h2 class="text-lg font-semibold text-foreground tracking-tight">Jamaah Satu Generus</h2>
			</div>
			<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
				Kelompok 1
			</span>
		</div>
		<p class="text-xs text-foreground/70 mt-2 leading-relaxed">
			Akses layanan sensus keluarga dan presensi kegiatan pengajian dalam satu genggaman.
		</p>
	</section>

	<!-- Aksi Cepat (Quick Tasks) -->
	<section class="space-y-2">
		<h3 class="text-sm font-semibold text-foreground/80 px-1">Layanan Utama</h3>
		<div class="grid grid-cols-2 gap-3">
			<a
				href="/presensi"
				class="bg-card border border-border hover:border-primary/50 transition-colors rounded-xl p-4 flex flex-col justify-between group shadow-sm"
			>
				<div class="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
					<QrCode class="w-5 h-5" />
				</div>
				<div>
					<h4 class="text-sm font-semibold text-foreground">Presensi QR</h4>
					<p class="text-xs text-foreground/60 mt-0.5">Scan kehadiran pengajian</p>
				</div>
			</a>

			<a
				href="/sensus"
				class="bg-card border border-border hover:border-primary/50 transition-colors rounded-xl p-4 flex flex-col justify-between group shadow-sm"
			>
				<div class="w-10 h-10 rounded-lg bg-accent/20 text-accent flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
					<FileSpreadsheet class="w-5 h-5" />
				</div>
				<div>
					<h4 class="text-sm font-semibold text-foreground">Sensus Keluarga</h4>
					<p class="text-xs text-foreground/60 mt-0.5">Update KK & data anggota</p>
				</div>
			</a>
		</div>
	</section>

	<!-- Jadwal Kegiatan Terdekat -->
	<section class="bg-card border border-border rounded-xl p-4 shadow-sm space-y-3">
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-2">
				<Calendar class="w-4 h-4 text-primary" />
				<h3 class="text-sm font-semibold text-foreground">Jadwal Pengajian Terdekat</h3>
			</div>
			<a href="/presensi" class="text-xs font-medium text-primary hover:underline flex items-center">
				Lihat Semua <ChevronRight class="w-3 h-3 ml-0.5" />
			</a>
		</div>

		<div class="border-t border-border/60 pt-3 space-y-2">
			<div class="flex items-start justify-between">
				<div>
					<h4 class="text-xs font-semibold text-foreground">Pengajian Rutin Kelompok</h4>
					<p class="text-[11px] text-foreground/60">Masjid Baitul Muttaqin</p>
				</div>
				<span class="text-[11px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded">
					Hari Ini
				</span>
			</div>
		</div>
	</section>
</div>

