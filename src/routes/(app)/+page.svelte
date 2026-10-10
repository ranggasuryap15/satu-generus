<!--
  @file src/routes/(app)/+page.svelte
  @purpose Halaman beranda client/jamaah (Mobile-First) dengan launcher Quick Access aplikasi, jadwal pengajian bertingkat (Kelompok & Desa) lengkap dengan jam wajib dan detail materi, dan modal ekosistem aplikasi
  @usedBy Route utama client '/'
  @dependencies @lucide/svelte, $lib/utils (formatDateDDMMYYYY), $lib/jadwal (formatDateIndoFull), Svelte 5 Runes
  @publicFunctions openAppDetail, closeModals
  @sideEffects Menavigasikan jamaah ke layanan utama atau membuka modal rincian aplikasi ekosistem
-->
<script lang="ts">
	import {
		AlertCircle,
		Calendar,
		ChevronRight,
		Clock,
		Compass,
		ExternalLink,
		GraduationCap,
		LayoutGrid,
		MapPin,
		QrCode,
		Sparkles,
		Users,
		X
	} from '@lucide/svelte';
	import type { PageData } from './$types';
	import { formatDateDDMMYYYY } from '$lib/utils';
	import { formatDateIndoFull } from '$lib/jadwal';

	let { data } = $props<{ data: PageData }>();

	let showAppsModal = $state(false);
	let selectedAppModal = $state<'haramain' | 'ppg' | null>(null);
	let jadwalTab = $state<'kelompok' | 'desa'>('kelompok');

	const currentJadwalList = $derived(
		jadwalTab === 'kelompok' ? data.upcomingJadwalKelompok : data.upcomingJadwalDesa
	);

	function openAppDetail(appId: 'haramain' | 'ppg') {
		selectedAppModal = appId;
	}

	function closeModals() {
		showAppsModal = false;
		selectedAppModal = null;
	}
</script>

<svelte:head>
	<title>Beranda - Satu Generus</title>
</svelte:head>

<div class="space-y-4 sm:space-y-5">
	<!-- Sambutan & Status Pengguna -->
	<section class="bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-sm">
		<div class="flex items-center justify-between">
			<div>
				<p class="text-[11px] sm:text-xs font-medium text-foreground/60">Selamat Datang,</p>
				<h2 class="text-base sm:text-lg font-bold text-foreground tracking-tight">{data.user.namaLengkap}</h2>
			</div>
			<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary">
				{data.kelompokNama}
			</span>
		</div>
		<p class="text-xs text-foreground/70 mt-2 leading-relaxed">
			Akses layanan sensus keluarga, presensi kegiatan pengajian, dan ekosistem aplikasi generus dalam satu genggaman.
		</p>
	</section>

	<!-- Akses Cepat Aplikasi & Layanan (Quick Access Launcher) -->
	<section class="bg-card border border-border rounded-2xl p-4 shadow-sm space-y-3">
		<div class="flex items-center justify-between px-1">
			<div class="flex items-center gap-1.5">
				<Sparkles class="w-4 h-4 text-primary" />
				<h3 class="text-xs font-bold text-foreground tracking-tight">Akses Cepat & Aplikasi</h3>
			</div>
			<button
				type="button"
				onclick={() => (showAppsModal = true)}
				class="text-[11px] font-semibold text-primary hover:underline flex items-center gap-0.5"
			>
				Lihat Semua <ChevronRight class="w-3 h-3" />
			</button>
		</div>

		<!-- Grid Ikon Aplikasi: 5 Kolom Proporsional di Mobile & Tablet -->
		<div class="grid grid-cols-5 gap-2 sm:gap-3 text-center">
			<!-- 1. Presensi -->
			<a
				href="/presensi"
				class="flex flex-col items-center group transition-all"
			>
				<div class="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-xs group-hover:scale-105 group-hover:bg-emerald-500/20 group-active:scale-95 transition-all">
					<QrCode class="w-6 h-6 stroke-[2.2]" />
				</div>
				<span class="text-[11px] sm:text-xs font-semibold text-foreground mt-1.5 leading-tight group-hover:text-primary transition-colors">
					Presensi
				</span>
			</a>

			<!-- 2. Data Keluarga -->
			<a
				href="/sensus"
				class="flex flex-col items-center group transition-all"
			>
				<div class="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-600 dark:text-sky-400 flex items-center justify-center shadow-xs group-hover:scale-105 group-hover:bg-sky-500/20 group-active:scale-95 transition-all">
					<Users class="w-6 h-6 stroke-[2.2]" />
				</div>
				<span class="text-[11px] sm:text-xs font-semibold text-foreground mt-1.5 leading-tight group-hover:text-primary transition-colors">
					Data Keluarga
				</span>
			</a>

			<!-- 3. Menuju Haramain -->
			<button
				type="button"
				onclick={() => openAppDetail('haramain')}
				class="flex flex-col items-center group transition-all"
			>
				<div class="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-xs group-hover:scale-105 group-hover:bg-amber-500/20 group-active:scale-95 transition-all relative">
					<Compass class="w-6 h-6 stroke-[2.2]" />
					<span class="absolute -top-1 -right-1 flex h-2.5 w-2.5">
						<span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
						<span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
					</span>
				</div>
				<span class="text-[11px] sm:text-xs font-semibold text-foreground mt-1.5 leading-tight group-hover:text-primary transition-colors">
					Haramain
				</span>
			</button>

			<!-- 4. SI-PPG -->
			<button
				type="button"
				onclick={() => openAppDetail('ppg')}
				class="flex flex-col items-center group transition-all"
			>
				<div class="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center shadow-xs group-hover:scale-105 group-hover:bg-purple-500/20 group-active:scale-95 transition-all">
					<GraduationCap class="w-6 h-6 stroke-[2.2]" />
				</div>
				<span class="text-[11px] sm:text-xs font-semibold text-foreground mt-1.5 leading-tight group-hover:text-primary transition-colors">
					SI-PPG
				</span>
			</button>

			<!-- 5. Lainnya (Etc) -->
			<button
				type="button"
				onclick={() => (showAppsModal = true)}
				class="flex flex-col items-center group transition-all"
			>
				<div class="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-secondary border border-border text-foreground/70 flex items-center justify-center shadow-xs group-hover:scale-105 group-hover:text-primary group-active:scale-95 transition-all">
					<LayoutGrid class="w-6 h-6 stroke-[2.2]" />
				</div>
				<span class="text-[11px] sm:text-xs font-semibold text-foreground mt-1.5 leading-tight group-hover:text-primary transition-colors">
					Lainnya
				</span>
			</button>
		</div>
	</section>

	<!-- Jadwal Kegiatan Terdekat (Kelompok & Desa) -->
	<section class="bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-2">
				<Calendar class="w-4 h-4 text-primary" />
				<h3 class="text-xs font-bold text-foreground">Jadwal Pengajian Terdekat</h3>
			</div>
			<a href="/presensi" class="text-[11px] font-semibold text-primary hover:underline flex items-center">
				Presensi Mandiri <ChevronRight class="w-3 h-3 ml-0.5" />
			</a>
		</div>

		<!-- Switcher Tab: Kelompok vs Desa -->
		<div class="flex items-center gap-2 border-b border-border/70 pb-2 text-xs">
			<button
				type="button"
				onclick={() => (jadwalTab = 'kelompok')}
				class="px-3 py-1 rounded-lg font-bold transition-all {jadwalTab === 'kelompok'
					? 'bg-primary/10 text-primary border border-primary/20'
					: 'text-foreground/60 hover:text-foreground'}"
			>
				Kelompok ({data.kelompokNama})
			</button>
			<button
				type="button"
				onclick={() => (jadwalTab = 'desa')}
				class="px-3 py-1 rounded-lg font-bold transition-all {jadwalTab === 'desa'
					? 'bg-primary/10 text-primary border border-primary/20'
					: 'text-foreground/60 hover:text-foreground'}"
			>
				Desa ({data.desaNama})
			</button>
		</div>

		<!-- Daftar Jadwal Terdekat -->
		<div class="space-y-2.5 pt-1">
			{#if currentJadwalList.length === 0}
				<p class="text-xs text-foreground/50 py-4 text-center">
					Belum ada jadwal pengajian {jadwalTab === 'kelompok' ? 'kelompok' : 'desa'} terdekat saat ini.
				</p>
			{:else}
				{#each currentJadwalList as jadwal}
					<div class="p-3 rounded-xl border border-border/80 bg-background/50 hover:border-primary/40 transition-all space-y-1.5 {jadwal.isOverride ? 'border-amber-500/30 bg-amber-500/5' : ''}">
						<div class="flex items-center justify-between gap-2">
							<div class="flex items-center gap-2">
								<span class="text-xs font-bold text-foreground">
									{formatDateIndoFull(jadwal.tanggal)}
								</span>
								{#if jadwal.status === 'libur'}
									<span class="px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400">
										Libur
									</span>
								{/if}
								{#if jadwal.isOverride}
									<span class="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300">
										Perubahan Khusus
									</span>
								{/if}
							</div>

							<!-- Jam Pelaksanaan (Wajib diisi & jelas) -->
							<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-primary/10 text-primary font-mono">
								<Clock class="w-3 h-3" />
								<span>{jadwal.jamMulai}{jadwal.jamSelesai ? ` - ${jadwal.jamSelesai}` : ''} WIB</span>
							</span>
						</div>

						<h4 class="text-xs font-bold text-foreground/90">
							{jadwal.namaKegiatan}
						</h4>

						{#if jadwal.detailMateri}
							<p class="text-[11px] text-foreground/75 bg-secondary/30 p-2 rounded-lg leading-relaxed whitespace-pre-line">
								{jadwal.detailMateri}
							</p>
						{/if}

						{#if jadwal.lokasiNama}
							<div class="flex items-center gap-1 text-[10.5px] text-foreground/60 pt-0.5">
								<MapPin class="w-3 h-3 text-foreground/40 shrink-0" />
								<span class="truncate">{jadwal.lokasiNama}</span>
							</div>
						{/if}
					</div>
				{/each}
			{/if}
		</div>
	</section>
</div>

<!-- Modal Dialog: Semua Aplikasi & Layanan Ekosistem Satu Generus -->
{#if showAppsModal}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
		role="dialog"
		aria-modal="true"
	>
		<div class="bg-card border border-border rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4">
			<div class="flex items-center justify-between border-b border-border pb-3">
				<div class="flex items-center gap-2">
					<LayoutGrid class="w-4 h-4 text-primary" />
					<h3 class="text-sm font-bold text-foreground">Semua Layanan & Aplikasi</h3>
				</div>
				<button
					type="button"
					onclick={closeModals}
					class="p-1 text-foreground/50 hover:text-foreground rounded-lg"
					aria-label="Tutup"
				>
					<X class="w-4 h-4" />
				</button>
			</div>

			<div class="grid grid-cols-1 gap-2.5 max-h-[60vh] overflow-y-auto pr-1">
				<a
					href="/presensi"
					onclick={closeModals}
					class="flex items-center gap-3 p-2.5 rounded-xl border border-border bg-secondary/30 hover:bg-secondary/70 transition-colors"
				>
					<div class="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
						<QrCode class="w-5 h-5" />
					</div>
					<div class="flex-1 min-w-0">
						<h4 class="text-xs font-bold text-foreground">Presensi Pengajian</h4>
						<p class="text-[11px] text-foreground/60 truncate">Scan QR kehadiran kegiatan pengajian</p>
					</div>
					<ChevronRight class="w-4 h-4 text-foreground/40 shrink-0" />
				</a>

				<a
					href="/sensus"
					onclick={closeModals}
					class="flex items-center gap-3 p-2.5 rounded-xl border border-border bg-secondary/30 hover:bg-secondary/70 transition-colors"
				>
					<div class="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
						<Users class="w-5 h-5" />
					</div>
					<div class="flex-1 min-w-0">
						<h4 class="text-xs font-bold text-foreground">Data Keluarga (Sensus)</h4>
						<p class="text-[11px] text-foreground/60 truncate">Kelola data KK & anggota keluarga</p>
					</div>
					<ChevronRight class="w-4 h-4 text-foreground/40 shrink-0" />
				</a>

				<button
					type="button"
					onclick={() => openAppDetail('haramain')}
					class="flex items-center gap-3 p-2.5 rounded-xl border border-border bg-secondary/30 hover:bg-secondary/70 text-left transition-colors w-full"
				>
					<div class="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
						<Compass class="w-5 h-5" />
					</div>
					<div class="flex-1 min-w-0">
						<div class="flex items-center gap-1.5">
							<h4 class="text-xs font-bold text-foreground">Menuju Haramain</h4>
							<span class="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300">Ekosistem</span>
						</div>
						<p class="text-[11px] text-foreground/60 truncate">Program & tabungan umroh/haji jamaah</p>
					</div>
					<ChevronRight class="w-4 h-4 text-foreground/40 shrink-0" />
				</button>

				<button
					type="button"
					onclick={() => openAppDetail('ppg')}
					class="flex items-center gap-3 p-2.5 rounded-xl border border-border bg-secondary/30 hover:bg-secondary/70 text-left transition-colors w-full"
				>
					<div class="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
						<GraduationCap class="w-5 h-5" />
					</div>
					<div class="flex-1 min-w-0">
						<div class="flex items-center gap-1.5">
							<h4 class="text-xs font-bold text-foreground">SI-PPG</h4>
							<span class="text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-700 dark:text-purple-300">Ekosistem</span>
						</div>
						<p class="text-[11px] text-foreground/60 truncate">Sistem Pembinaan Penggerak Pembina Generus</p>
					</div>
					<ChevronRight class="w-4 h-4 text-foreground/40 shrink-0" />
				</button>

				<a
					href="/sensus/tambah"
					onclick={closeModals}
					class="flex items-center gap-3 p-2.5 rounded-xl border border-dashed border-border hover:bg-secondary/40 transition-colors"
				>
					<div class="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
						<Users class="w-5 h-5" />
					</div>
					<div class="flex-1 min-w-0">
						<h4 class="text-xs font-bold text-foreground">Daftar Sensus Baru</h4>
						<p class="text-[11px] text-foreground/60 truncate">Registrasi mandiri data keluarga jamaah</p>
					</div>
					<ChevronRight class="w-4 h-4 text-foreground/40 shrink-0" />
				</a>
			</div>
		</div>
	</div>
{/if}

<!-- Modal Detail Aplikasi Khusus (Menuju Haramain / SI-PPG) -->
{#if selectedAppModal}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
		role="dialog"
		aria-modal="true"
	>
		<div class="bg-card border border-border rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4">
			<div class="flex items-start justify-between">
				<div class="flex items-center gap-3">
					{#if selectedAppModal === 'haramain'}
						<div class="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-xs">
							<Compass class="w-6 h-6 stroke-[2.2]" />
						</div>
						<div>
							<h3 class="text-sm font-bold text-foreground">Menuju Haramain</h3>
							<span class="text-[10px] font-semibold text-amber-600 dark:text-amber-400">Aplikasi Terintegrasi</span>
						</div>
					{:else}
						<div class="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center shadow-xs">
							<GraduationCap class="w-6 h-6 stroke-[2.2]" />
						</div>
						<div>
							<h3 class="text-sm font-bold text-foreground">SI-PPG</h3>
							<span class="text-[10px] font-semibold text-purple-600 dark:text-purple-400">Sistem Informasi PPG</span>
						</div>
					{/if}
				</div>
				<button
					type="button"
					onclick={closeModals}
					class="p-1 text-foreground/50 hover:text-foreground rounded-lg"
					aria-label="Tutup"
				>
					<X class="w-4 h-4" />
				</button>
			</div>

			<div class="text-xs text-foreground/75 space-y-2 leading-relaxed">
				{#if selectedAppModal === 'haramain'}
					<p>
						<strong>Menuju Haramain</strong> adalah platform pendampingan dan perencanaan ibadah Umroh & Haji bagi warga jamaah.
					</p>
					<div class="p-3 bg-secondary/50 rounded-xl space-y-1.5 text-[11px]">
						<div class="flex items-center gap-1.5 text-foreground font-semibold">
							<span>✨</span> <span>Fitur Unggulan:</span>
						</div>
						<ul class="list-disc list-inside space-y-1 text-foreground/70">
							<li>Simulasi & tabungan ibadah terencana</li>
							<li>Informasi jadwal keberangkatan resmi</li>
							<li>Panduan manasik & doa digital</li>
						</ul>
					</div>
				{:else}
					<p>
						<strong>SI-PPG</strong> (Sistem Informasi Pembinaan Penggerak Pembina Generus) mengelola kurikulum dan target capaian generasi penerus.
					</p>
					<div class="p-3 bg-secondary/50 rounded-xl space-y-1.5 text-[11px]">
						<div class="flex items-center gap-1.5 text-foreground font-semibold">
							<span>📚</span> <span>Fokus Pembinaan:</span>
						</div>
						<ul class="list-disc list-inside space-y-1 text-foreground/70">
							<li>Evaluasi capaian 3 Sukses Generus</li>
							<li>Monitoring jenjang Paud s/d Usia Nikah</li>
							<li>Silabus dan bahan ajar pengajian terstandar</li>
						</ul>
					</div>
				{/if}
			</div>

			<div class="flex gap-2 pt-1">
				<button
					type="button"
					onclick={closeModals}
					class="flex-1 py-2 rounded-xl border border-border text-xs font-semibold text-foreground/80 hover:bg-secondary transition-colors"
				>
					Tutup
				</button>
				<button
					type="button"
					onclick={() => {
						alert('Aplikasi terhubung dengan akun Satu Generus Anda.');
						closeModals();
					}}
					class="flex-1 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors flex items-center justify-center gap-1.5 shadow-sm"
				>
					<span>Buka Aplikasi</span>
					<ExternalLink class="w-3.5 h-3.5" />
				</button>
			</div>
		</div>
	</div>
{/if}
