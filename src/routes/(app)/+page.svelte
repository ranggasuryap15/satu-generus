<!--
  @file src/routes/(app)/+page.svelte
  @purpose Halaman beranda client/jamaah (Modern, Minimalis & Flat) sesuai spesifikasi visual mockup: kartu sambutan Fresh Emerald, launcher 5 kolom pastel, kartu Infaq & Shodaqoh warm amber, tab pengajian segmented control (tautan ke jadwal sebulan dengan return origin 'beranda'), dan modal ekosistem
  @usedBy Route utama client '/'
  @dependencies @lucide/svelte, #lib/utils (formatDateDDMMYYYY), #lib/jadwal (formatDateIndoFull), Svelte 5 Runes
  @publicFunctions openAppDetail, closeModals
  @sideEffects Menavigasikan jamaah ke layanan utama atau membuka modal rincian aplikasi ekosistem
-->
<script lang="ts">
	import {
		Calendar,
		ChevronRight,
		Clock,
		Compass,
		ExternalLink,
		GraduationCap,
		HandCoins,
		HeartHandshake,
		LayoutGrid,
		MapPin,
		QrCode,
		Users,
		X
	} from '@lucide/svelte';
	import type { PageData } from './$types';
	import { formatDateDDMMYYYY } from '#lib/utils.js';
	import { formatDateIndoFull } from '#lib/jadwal.js';

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
	<!-- 1. Sambutan & Status Pengguna (Solid Fresh Emerald Card) -->
	<section class="bg-[#009B60] dark:bg-[#064E3B] text-white rounded-3xl p-5 sm:p-6 shadow-xs border border-transparent dark:border-emerald-700/30">
		<div class="flex items-center justify-between">
			<span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-white/20 text-white backdrop-blur-xs">
				Jamaah
			</span>
			<span class="text-xs sm:text-sm font-medium text-white/90">
				{data.kelompokNama}
			</span>
		</div>
		<div class="mt-4 sm:mt-5">
			<p class="text-xs sm:text-sm text-white/80 font-normal">Selamat Datang,</p>
			<h2 class="text-xl sm:text-2xl font-bold text-white tracking-tight mt-0.5">{data.user.namaLengkap}</h2>
		</div>
	</section>

	<!-- 2. Akses Cepat (Header Bersih & 5 Kolom Launcher Pastel) -->
	<section class="space-y-3.5 pt-1">
		<div class="flex items-center justify-between px-0.5">
			<h3 class="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight">
				Akses Cepat
			</h3>
			<button
				type="button"
				onclick={() => (showAppsModal = true)}
				class="text-xs sm:text-sm font-semibold text-[#009B60] dark:text-emerald-400 hover:underline flex items-center gap-0.5"
			>
				Lihat Semua <ChevronRight class="w-4 h-4" />
			</button>
		</div>

		<!-- Grid Ikon Aplikasi: 5 Kolom Proporsional Sesuai Desain Mockup -->
		<div class="grid grid-cols-5 gap-2 sm:gap-3 text-center">
			<!-- 1. Presensi (Mint Pastel) -->
			<a
				href="/presensi"
				class="flex flex-col items-center group transition-transform"
			>
				<div class="w-13 h-13 sm:w-15 sm:h-15 rounded-2xl bg-[#D7F5E9] dark:bg-emerald-950/60 text-[#009B60] dark:text-emerald-400 flex items-center justify-center group-hover:scale-105 group-active:scale-95 transition-all">
					<QrCode class="w-6 h-6 stroke-[2]" />
				</div>
				<span class="text-xs font-medium text-slate-800 dark:text-slate-200 mt-2 leading-tight">
					Presensi
				</span>
			</a>

			<!-- 2. Isrun/FR (Warm Cream) -->
			<a
				href="/fr"
				class="flex flex-col items-center group transition-transform"
			>
				<div class="w-13 h-13 sm:w-15 sm:h-15 rounded-2xl bg-[#FEF0D6] dark:bg-amber-950/50 text-[#D97706] dark:text-amber-400 flex items-center justify-center group-hover:scale-105 group-active:scale-95 transition-all">
					<HandCoins class="w-6 h-6 stroke-[2]" />
				</div>
				<span class="text-xs font-medium text-slate-800 dark:text-slate-200 mt-2 leading-tight">
					Isrun/FR
				</span>
			</a>

			<!-- 3. Keluarga (Soft Sky Blue) -->
			<a
				href="/sensus"
				class="flex flex-col items-center group transition-transform"
			>
				<div class="w-13 h-13 sm:w-15 sm:h-15 rounded-2xl bg-[#E0F2FE] dark:bg-sky-950/50 text-[#0284C7] dark:text-sky-400 flex items-center justify-center group-hover:scale-105 group-active:scale-95 transition-all">
					<Users class="w-6 h-6 stroke-[2]" />
				</div>
				<span class="text-xs font-medium text-slate-800 dark:text-slate-200 mt-2 leading-tight">
					Keluarga
				</span>
			</a>

			<!-- 4. SI-PPG (Soft Lilac) -->
			<button
				type="button"
				onclick={() => openAppDetail('ppg')}
				class="flex flex-col items-center group transition-transform"
			>
				<div class="w-13 h-13 sm:w-15 sm:h-15 rounded-2xl bg-[#F3E8FF] dark:bg-purple-950/50 text-[#9333EA] dark:text-purple-400 flex items-center justify-center group-hover:scale-105 group-active:scale-95 transition-all">
					<GraduationCap class="w-6 h-6 stroke-[2]" />
				</div>
				<span class="text-xs font-medium text-slate-800 dark:text-slate-200 mt-2 leading-tight">
					SI-PPG
				</span>
			</button>

			<!-- 5. Lainnya (Slate Neutral) -->
			<button
				type="button"
				onclick={() => (showAppsModal = true)}
				class="flex flex-col items-center group transition-transform"
			>
				<div class="w-13 h-13 sm:w-15 sm:h-15 rounded-2xl bg-[#F1F5F9] dark:bg-slate-800/80 text-[#52525B] dark:text-slate-300 flex items-center justify-center group-hover:scale-105 group-active:scale-95 transition-all">
					<LayoutGrid class="w-6 h-6 stroke-[2]" />
				</div>
				<span class="text-xs font-medium text-slate-800 dark:text-slate-200 mt-2 leading-tight">
					Lainnya
				</span>
			</button>
		</div>
	</section>

	<!-- 3. Pintasan Infaq & Shodaqoh Wilayah (Warm Amber Card) -->
	<a
		href="/shodaqoh"
		class="block p-4 sm:p-4.5 rounded-2xl sm:rounded-3xl bg-[#FEF3C7]/70 hover:bg-[#FEF3C7] dark:bg-[#20180d] dark:hover:bg-[#281e10] border border-[#FDE68A]/70 dark:border-amber-900/40 transition-all shadow-xs group"
	>
		<div class="flex items-center justify-between gap-3">
			<div class="flex items-center gap-3.5">
				<div class="w-12 h-12 rounded-2xl bg-[#F59E0B] text-[#451A03] dark:text-amber-950 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform shadow-2xs">
					<HeartHandshake class="w-6 h-6 stroke-[2.2]" />
				</div>
				<div>
					<h3 class="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
						Infaq & Shodaqoh Wilayah
					</h3>
					<p class="text-xs text-[#92400E] dark:text-amber-300/90 font-medium mt-0.5">
						Bayar via QRIS & Bank
					</p>
				</div>
			</div>
			<ChevronRight class="w-5 h-5 text-[#B45309] dark:text-amber-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
		</div>
	</a>

	<!-- 4. Jadwal Pengajian (Header, Segmented Tabs, List / Empty State) -->
	<section class="space-y-3.5 pt-1">
		<div class="flex items-center justify-between px-0.5">
			<div class="flex items-center gap-2">
				<Calendar class="w-5 h-5 text-[#009B60] dark:text-emerald-400" />
				<h3 class="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
					Jadwal Pengajian
				</h3>
			</div>
			<a
				href="/jadwal?from=beranda"
				class="text-xs sm:text-sm font-semibold text-[#009B60] dark:text-emerald-400 hover:underline flex items-center gap-0.5"
			>
				Lihat Semua <ChevronRight class="w-4 h-4" />
			</a>
		</div>

		<!-- Segmented Control Flat Switcher: Kelompok vs Desa -->
		<div class="grid grid-cols-2 p-1.5 bg-[#EEF2F6] dark:bg-slate-800/70 rounded-2xl text-xs sm:text-sm">
			<button
				type="button"
				onclick={() => (jadwalTab = 'kelompok')}
				class="py-2.5 px-3 rounded-xl transition-all text-center truncate {jadwalTab === 'kelompok'
					? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-bold'
					: 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-medium'}"
			>
				Kelompok ({data.kelompokNama})
			</button>
			<button
				type="button"
				onclick={() => (jadwalTab = 'desa')}
				class="py-2.5 px-3 rounded-xl transition-all text-center truncate {jadwalTab === 'desa'
					? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-bold'
					: 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-medium'}"
			>
				Desa ({data.desaNama})
			</button>
		</div>

		<!-- Daftar Jadwal Terdekat (Cards atau Empty State Dashed) -->
		<div class="space-y-3 pt-0.5">
			{#if currentJadwalList.length === 0}
				<div class="border border-dashed border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/20 rounded-3xl p-8 sm:p-10 text-center">
					<div class="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 mx-auto flex items-center justify-center mb-3">
						<Calendar class="w-6 h-6 stroke-[1.8]" />
					</div>
					<p class="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-xs mx-auto leading-relaxed">
						Belum ada jadwal pengajian {jadwalTab === 'kelompok' ? 'kelompok' : 'desa'} terdekat saat ini.
					</p>
				</div>
			{:else}
				{#each currentJadwalList as jadwal}
					<div class="p-4 rounded-2xl border transition-colors space-y-2.5 {jadwal.isOverride
						? 'bg-amber-50/50 border-amber-200/80 dark:bg-amber-950/20 dark:border-amber-900/40'
						: 'bg-white border-slate-200/80 dark:bg-card dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700'} shadow-xs">
						<div class="flex items-center justify-between gap-2">
							<div class="flex items-center gap-2 flex-wrap">
								<span class="text-sm font-bold text-slate-900 dark:text-slate-100">
									{formatDateIndoFull(jadwal.tanggal)}
								</span>
								{#if jadwal.status === 'libur'}
									<span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200/70 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/50">
										Libur
									</span>
								{/if}
								{#if jadwal.isOverride}
									<span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200/70 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/50">
										Perubahan Khusus
									</span>
								{/if}
							</div>

							<!-- Jam Pelaksanaan (Fresh Emerald Badge) -->
							<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold bg-[#D7F5E9] text-[#009B60] dark:bg-emerald-950/60 dark:text-emerald-400 font-mono shrink-0">
								<Clock class="w-3.5 h-3.5" />
								<span>{jadwal.jamMulai}{jadwal.jamSelesai ? ` - ${jadwal.jamSelesai}` : ''} WIB</span>
							</span>
						</div>

						<h4 class="text-sm font-semibold text-slate-800 dark:text-slate-200">
							{jadwal.namaKegiatan}
						</h4>

						{#if jadwal.detailMateri}
							<p class="text-xs sm:text-sm text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50 p-2.5 rounded-xl leading-relaxed whitespace-pre-line">
								{jadwal.detailMateri}
							</p>
						{/if}

						{#if jadwal.lokasiNama}
							<div class="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 pt-0.5">
								<MapPin class="w-3.5 h-3.5 text-slate-400 shrink-0" />
								<span class="truncate">{jadwal.lokasiNama}</span>
							</div>
						{/if}
					</div>
				{/each}
			{/if}
		</div>
	</section>
</div>

<!-- Modal Dialog: Semua Aplikasi & Layanan Ekosistem Satu Generus (Modern Flat) -->
{#if showAppsModal}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
		role="dialog"
		aria-modal="true"
		tabindex="-1"
	>
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="fixed inset-0"
			onclick={closeModals}
		></div>

		<div class="relative bg-card border border-border/80 dark:border-border/60 rounded-3xl max-w-sm w-full p-5 shadow-xl space-y-4">
			<div class="flex items-center justify-between border-b border-border/60 pb-3">
				<div class="flex items-center gap-2">
					<LayoutGrid class="w-5 h-5 text-[#009B60] dark:text-emerald-400" />
					<h3 class="text-sm font-bold text-foreground">Semua Layanan & Aplikasi</h3>
				</div>
				<button
					type="button"
					onclick={closeModals}
					class="p-1 text-muted-foreground hover:text-foreground rounded-lg transition-colors"
					aria-label="Tutup"
				>
					<X class="w-4 h-4" />
				</button>
			</div>

			<div class="grid grid-cols-1 gap-2.5 max-h-[60vh] overflow-y-auto pr-1">
				<a
					href="/presensi"
					onclick={closeModals}
					class="flex items-center gap-3 p-3 rounded-2xl border border-border/60 bg-slate-50/80 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors"
				>
					<div class="w-10 h-10 rounded-xl bg-[#D7F5E9] dark:bg-emerald-950/60 text-[#009B60] dark:text-emerald-400 flex items-center justify-center shrink-0">
						<QrCode class="w-5 h-5 stroke-[2]" />
					</div>
					<div class="flex-1 min-w-0">
						<h4 class="text-xs font-bold text-foreground">Presensi Pengajian</h4>
						<p class="text-[11px] text-muted-foreground truncate">Scan QR kehadiran kegiatan pengajian</p>
					</div>
					<ChevronRight class="w-4 h-4 text-muted-foreground/60 shrink-0" />
				</a>

				<a
					href="/fr"
					onclick={closeModals}
					class="flex items-center gap-3 p-3 rounded-2xl border border-border/60 bg-slate-50/80 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors"
				>
					<div class="w-10 h-10 rounded-xl bg-[#FEF0D6] dark:bg-amber-950/50 text-[#D97706] dark:text-amber-400 flex items-center justify-center shrink-0">
						<HandCoins class="w-5 h-5 stroke-[2]" />
					</div>
					<div class="flex-1 min-w-0">
						<div class="flex items-center gap-1.5">
							<h4 class="text-xs font-bold text-foreground">Isrun / FR Jamaah</h4>
							<span class="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">Wajib</span>
						</div>
						<p class="text-[11px] text-muted-foreground truncate">Lembar kewajiban 4 pos & pelaporan setoran FR</p>
					</div>
					<ChevronRight class="w-4 h-4 text-muted-foreground/60 shrink-0" />
				</a>

				<a
					href="/sensus"
					onclick={closeModals}
					class="flex items-center gap-3 p-3 rounded-2xl border border-border/60 bg-slate-50/80 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors"
				>
					<div class="w-10 h-10 rounded-xl bg-[#E0F2FE] dark:bg-sky-950/50 text-[#0284C7] dark:text-sky-400 flex items-center justify-center shrink-0">
						<Users class="w-5 h-5 stroke-[2]" />
					</div>
					<div class="flex-1 min-w-0">
						<h4 class="text-xs font-bold text-foreground">Data Keluarga (Sensus)</h4>
						<p class="text-[11px] text-muted-foreground truncate">Kelola data KK & anggota keluarga</p>
					</div>
					<ChevronRight class="w-4 h-4 text-muted-foreground/60 shrink-0" />
				</a>

				<button
					type="button"
					onclick={() => openAppDetail('ppg')}
					class="flex items-center gap-3 p-3 rounded-2xl border border-border/60 bg-slate-50/80 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800/80 text-left transition-colors w-full"
				>
					<div class="w-10 h-10 rounded-xl bg-[#F3E8FF] dark:bg-purple-950/50 text-[#9333EA] dark:text-purple-400 flex items-center justify-center shrink-0">
						<GraduationCap class="w-5 h-5 stroke-[2]" />
					</div>
					<div class="flex-1 min-w-0">
						<div class="flex items-center gap-1.5">
							<h4 class="text-xs font-bold text-foreground">SI-PPG</h4>
							<span class="text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300">Ekosistem</span>
						</div>
						<p class="text-[11px] text-muted-foreground truncate">Sistem Pembinaan Penggerak Pembina Generus</p>
					</div>
					<ChevronRight class="w-4 h-4 text-muted-foreground/60 shrink-0" />
				</button>

				<a
					href="/shodaqoh"
					onclick={closeModals}
					class="flex items-center gap-3 p-3 rounded-2xl border border-border/60 bg-slate-50/80 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors"
				>
					<div class="w-10 h-10 rounded-xl bg-[#FEF0D6] dark:bg-amber-950/50 text-[#D97706] dark:text-amber-400 flex items-center justify-center shrink-0">
						<HeartHandshake class="w-5 h-5 stroke-[2]" />
					</div>
					<div class="flex-1 min-w-0">
						<h4 class="text-xs font-bold text-foreground">Infaq & Shodaqoh</h4>
						<p class="text-[11px] text-muted-foreground truncate">QRIS, rekening bank & konfirmasi transfer</p>
					</div>
					<ChevronRight class="w-4 h-4 text-muted-foreground/60 shrink-0" />
				</a>

				<button
					type="button"
					onclick={() => openAppDetail('haramain')}
					class="flex items-center gap-3 p-3 rounded-2xl border border-border/60 bg-slate-50/80 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800/80 text-left transition-colors w-full"
				>
					<div class="w-10 h-10 rounded-xl bg-[#FEF0D6] dark:bg-amber-950/50 text-[#D97706] dark:text-amber-400 flex items-center justify-center shrink-0">
						<Compass class="w-5 h-5 stroke-[2]" />
					</div>
					<div class="flex-1 min-w-0">
						<div class="flex items-center gap-1.5">
							<h4 class="text-xs font-bold text-foreground">Menuju Haramain</h4>
							<span class="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">Ekosistem</span>
						</div>
						<p class="text-[11px] text-muted-foreground truncate">Program & tabungan umroh/haji jamaah</p>
					</div>
					<ChevronRight class="w-4 h-4 text-muted-foreground/60 shrink-0" />
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Modal Detail Aplikasi Khusus (Menuju Haramain / SI-PPG) -->
{#if selectedAppModal}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
		role="dialog"
		aria-modal="true"
		tabindex="-1"
	>
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="fixed inset-0"
			onclick={closeModals}
		></div>

		<div class="relative bg-card border border-border/80 dark:border-border/60 rounded-3xl max-w-sm w-full p-5 shadow-xl space-y-4">
			<div class="flex items-start justify-between">
				<div class="flex items-center gap-3">
					{#if selectedAppModal === 'haramain'}
						<div class="w-12 h-12 rounded-2xl bg-[#FEF0D6] dark:bg-amber-950/50 text-[#D97706] dark:text-amber-400 flex items-center justify-center">
							<Compass class="w-6 h-6 stroke-[2]" />
						</div>
						<div>
							<h3 class="text-base font-bold text-foreground">Menuju Haramain</h3>
							<span class="text-xs font-medium text-amber-700 dark:text-amber-400">Aplikasi Terintegrasi</span>
						</div>
					{:else}
						<div class="w-12 h-12 rounded-2xl bg-[#F3E8FF] dark:bg-purple-950/50 text-[#9333EA] dark:text-purple-400 flex items-center justify-center">
							<GraduationCap class="w-6 h-6 stroke-[2]" />
						</div>
						<div>
							<h3 class="text-base font-bold text-foreground">SI-PPG</h3>
							<span class="text-xs font-medium text-purple-700 dark:text-purple-400">Sistem Informasi PPG</span>
						</div>
					{/if}
				</div>
				<button
					type="button"
					onclick={closeModals}
					class="p-1.5 text-muted-foreground hover:text-foreground rounded-lg transition-colors"
					aria-label="Tutup"
				>
					<X class="w-4 h-4" />
				</button>
			</div>

			<div class="text-xs sm:text-sm text-foreground/80 space-y-2.5 leading-relaxed">
				{#if selectedAppModal === 'haramain'}
					<p>
						<strong class="font-semibold text-foreground">Menuju Haramain</strong> adalah platform pendampingan dan perencanaan ibadah Umroh & Haji bagi warga jamaah.
					</p>
					<div class="p-3 bg-slate-50 dark:bg-slate-800/40 border border-border/60 rounded-2xl space-y-1.5 text-xs">
						<div class="flex items-center gap-1.5 text-foreground font-semibold">
							<span>Fitur Layanan:</span>
						</div>
						<ul class="list-disc list-inside space-y-1 text-muted-foreground">
							<li>Simulasi & tabungan ibadah terencana</li>
							<li>Informasi jadwal keberangkatan resmi</li>
							<li>Panduan manasik & doa digital</li>
						</ul>
					</div>
				{:else}
					<p>
						<strong class="font-semibold text-foreground">SI-PPG</strong> (Sistem Informasi Pembinaan Penggerak Pembina Generus) mengelola kurikulum dan target capaian generasi penerus.
					</p>
					<div class="p-3 bg-slate-50 dark:bg-slate-800/40 border border-border/60 rounded-2xl space-y-1.5 text-xs">
						<div class="flex items-center gap-1.5 text-foreground font-semibold">
							<span>Fokus Pembinaan:</span>
						</div>
						<ul class="list-disc list-inside space-y-1 text-muted-foreground">
							<li>Evaluasi capaian 3 Sukses Generus</li>
							<li>Monitoring jenjang Paud s/d Usia Nikah</li>
							<li>Silabus dan bahan ajar pengajian terstandar</li>
						</ul>
					</div>
				{/if}
			</div>

			<div class="flex gap-2.5 pt-1">
				<button
					type="button"
					onclick={closeModals}
					class="flex-1 py-2.5 rounded-xl border border-border/80 text-xs sm:text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
				>
					Tutup
				</button>
				<button
					type="button"
					onclick={closeModals}
					class="flex-1 py-2.5 rounded-xl bg-[#009B60] text-white hover:bg-[#008753] dark:bg-emerald-600 dark:hover:bg-emerald-500 text-xs sm:text-sm font-semibold transition-colors flex items-center justify-center gap-1.5 shadow-xs"
				>
					<span>Buka Layanan</span>
					<ExternalLink class="w-3.5 h-3.5" />
				</button>
			</div>
		</div>
	</div>
{/if}
