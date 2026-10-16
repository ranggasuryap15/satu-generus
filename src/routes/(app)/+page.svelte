<!--
  @file src/routes/(app)/+page.svelte
  @purpose Halaman beranda client/jamaah sesuai konsep Flat Design Minimalist: Banner Hijau Melengkung terintegrasi, Floating 5-Launcher Card, Infaq & Shodaqoh, Ringkasan Bulan Ini (Kehadiran, Izin, Shodaqoh), Jadwal Pengajian (Kelompok vs Desa), dan Transaksi Terakhir
  @usedBy Route utama client '/'
  @dependencies @lucide/svelte, #lib/components/ThemeToggle.svelte, #lib/jadwal (formatDateIndoFull), Svelte 5 Runes
  @publicFunctions openAppDetail, closeModals
  @sideEffects Menavigasikan jamaah ke layanan utama atau membuka modal rincian aplikasi ekosistem
-->
<script lang="ts">
	import {
		Bell,
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
		Search,
		Users,
		X
	} from '@lucide/svelte';
	import ThemeToggle from '#lib/components/ThemeToggle.svelte';
	import type { PageData } from './$types';
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

<div class="space-y-4">
	<!-- 1. Header Hijau Melengkung Terintegrasi (Full-width dengan Sudut Bawah Melengkung) -->
	<header class="bg-[#166534] dark:bg-[#14532D] text-white px-5 pt-4 pb-12 rounded-b-[28px] shadow-sm">
		<!-- Top Bar: Logo SG & Action Icons (Theme, Search, Notif) -->
		<div class="flex items-center justify-between mb-4">
			<div class="flex items-center gap-2">
				<div class="w-8 h-8 rounded-full bg-white/20 text-white font-bold flex items-center justify-center text-xs shadow-xs">
					SG
				</div>
				<span class="text-base font-bold text-white tracking-tight">Satu Generus</span>
			</div>

			<div class="flex items-center gap-0.5">
				<ThemeToggle />
				<button
					type="button"
					class="p-2 text-white/80 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
					aria-label="Pencarian"
				>
					<Search class="w-5 h-5 stroke-[2]" />
				</button>
				<button
					type="button"
					onclick={() => (showAppsModal = true)}
					class="p-2 text-white/80 hover:text-white rounded-xl hover:bg-white/10 transition-colors relative cursor-pointer"
					aria-label="Notifikasi"
				>
					<Bell class="w-5 h-5 stroke-[2]" />
					<span class="w-2 h-2 rounded-full bg-emerald-400 absolute top-2 right-2 ring-2 ring-[#166534]"></span>
				</button>
			</div>
		</div>

		<!-- Status Jamaah & Kelompok -->
		<div class="flex items-center gap-2 mb-2">
			<span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/20 text-white backdrop-blur-xs">
				Jamaah
			</span>
			<span class="text-xs font-medium text-white/90">
				{data.kelompokNama}
			</span>
		</div>

		<!-- Sapaan Pengguna -->
		<div>
			<p class="text-xs text-white/80 font-normal">Selamat Datang,</p>
			<h1 class="text-xl sm:text-2xl font-bold text-white tracking-tight mt-0.5">
				{data.user.namaLengkap}
			</h1>
		</div>
	</header>

	<!-- 2. Floating Launcher Card: 5 Kolom Ikon Melingkar (Overlapping Header) -->
	<div class="-mt-8 px-4">
		<div class="bg-[#1E293B] border border-slate-700/60 rounded-2xl p-3.5 shadow-md">
			<div class="grid grid-cols-5 gap-1.5 text-center">
				<!-- 1. Presensi -->
				<a href="/presensi" class="flex flex-col items-center group cursor-pointer">
					<div class="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-emerald-950/80 border border-emerald-500/30 text-emerald-400 flex items-center justify-center group-hover:scale-105 active:scale-95 transition-all">
						<QrCode class="w-5 h-5 stroke-[2.2]" />
					</div>
					<span class="text-[11px] font-medium text-slate-300 mt-1.5">Presensi</span>
				</a>

				<!-- 2. Isrun/FR -->
				<a href="/transaksi" class="flex flex-col items-center group cursor-pointer">
					<div class="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-amber-950/80 border border-amber-500/30 text-amber-400 flex items-center justify-center group-hover:scale-105 active:scale-95 transition-all">
						<HandCoins class="w-5 h-5 stroke-[2.2]" />
					</div>
					<span class="text-[11px] font-medium text-slate-300 mt-1.5">Isrun/FR</span>
				</a>

				<!-- 3. Keluarga -->
				<a href="/sensus" class="flex flex-col items-center group cursor-pointer">
					<div class="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-sky-950/80 border border-sky-500/30 text-sky-400 flex items-center justify-center group-hover:scale-105 active:scale-95 transition-all">
						<Users class="w-5 h-5 stroke-[2.2]" />
					</div>
					<span class="text-[11px] font-medium text-slate-300 mt-1.5">Keluarga</span>
				</a>

				<!-- 4. SI-PPG -->
				<button
					type="button"
					onclick={() => openAppDetail('ppg')}
					class="flex flex-col items-center group cursor-pointer"
				>
					<div class="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-purple-950/80 border border-purple-500/30 text-purple-400 flex items-center justify-center group-hover:scale-105 active:scale-95 transition-all">
						<GraduationCap class="w-5 h-5 stroke-[2.2]" />
					</div>
					<span class="text-[11px] font-medium text-slate-300 mt-1.5">SI-PPG</span>
				</button>

				<!-- 5. Lainnya -->
				<button
					type="button"
					onclick={() => (showAppsModal = true)}
					class="flex flex-col items-center group cursor-pointer"
				>
					<div class="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-slate-800 border border-slate-600/50 text-slate-300 flex items-center justify-center group-hover:scale-105 active:scale-95 transition-all">
						<LayoutGrid class="w-5 h-5 stroke-[2.2]" />
					</div>
					<span class="text-[11px] font-medium text-slate-300 mt-1.5">Lainnya</span>
				</button>
			</div>
		</div>
	</div>

	<!-- 3. Kartu Infaq & Shodaqoh -->
	<div class="px-4">
		<a
			href="/shodaqoh"
			class="bg-[#1E293B] border border-slate-700/60 rounded-2xl p-3.5 flex items-center justify-between shadow-xs hover:border-slate-600 transition-colors block cursor-pointer"
		>
			<div class="flex items-center gap-3">
				<div class="w-10 h-10 rounded-full bg-amber-950/80 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
					<HeartHandshake class="w-5 h-5" />
				</div>
				<div>
					<h3 class="text-sm font-bold text-slate-100">Infaq & Shodaqoh</h3>
					<p class="text-xs text-slate-400 font-medium">QRIS · Bank</p>
				</div>
			</div>
			<ChevronRight class="w-4 h-4 text-slate-400" />
		</a>
	</div>

	<!-- 4. Ringkasan Bulan Ini (3 Kolom Kartu) -->
	<section class="px-4 space-y-2.5">
		<h3 class="text-sm font-bold text-slate-100 tracking-tight">Ringkasan Bulan Ini</h3>
		<div class="grid grid-cols-3 gap-2.5">
			<div class="bg-[#1E293B] border border-slate-700/60 rounded-2xl p-3">
				<span class="text-base font-bold text-emerald-400 block tracking-tight">
					{data.ringkasan.kehadiranText}
				</span>
				<span class="text-xs text-slate-400 font-medium mt-0.5 block">Kehadiran</span>
			</div>
			<div class="bg-[#1E293B] border border-slate-700/60 rounded-2xl p-3">
				<span class="text-base font-bold text-sky-400 block tracking-tight">
					{data.ringkasan.izinCount}
				</span>
				<span class="text-xs text-slate-400 font-medium mt-0.5 block">Izin</span>
			</div>
			<div class="bg-[#1E293B] border border-slate-700/60 rounded-2xl p-3">
				<span class="text-base font-bold text-amber-400 block tracking-tight">
					{data.ringkasan.shodaqohText}
				</span>
				<span class="text-xs text-slate-400 font-medium mt-0.5 block">Shodaqoh</span>
			</div>
		</div>
	</section>

	<!-- 5. Jadwal Pengajian -->
	<section class="px-4 space-y-3">
		<div class="flex items-center justify-between px-0.5">
			<div class="flex items-center gap-2">
				<Calendar class="w-4 h-4 text-emerald-400" />
				<h3 class="text-sm font-bold text-slate-100 tracking-tight">
					Jadwal Pengajian
				</h3>
			</div>
			<a
				href="/presensi"
				class="text-xs font-semibold text-emerald-400 hover:underline flex items-center gap-0.5"
			>
				Mandiri <ChevronRight class="w-3.5 h-3.5" />
			</a>
		</div>

		<!-- Segmented Control Flat Switcher: Kelompok vs Desa -->
		<div class="grid grid-cols-2 p-1 bg-[#0F172A] rounded-xl text-xs">
			<button
				type="button"
				onclick={() => (jadwalTab = 'kelompok')}
				class="py-2 px-3 rounded-lg transition-all text-center truncate cursor-pointer {jadwalTab === 'kelompok'
					? 'bg-[#1E293B] text-white shadow-xs font-bold'
					: 'text-slate-400 hover:text-slate-200 font-medium'}"
			>
				Kelompok ({data.kelompokNama})
			</button>
			<button
				type="button"
				onclick={() => (jadwalTab = 'desa')}
				class="py-2 px-3 rounded-lg transition-all text-center truncate cursor-pointer {jadwalTab === 'desa'
					? 'bg-[#1E293B] text-white shadow-xs font-bold'
					: 'text-slate-400 hover:text-slate-200 font-medium'}"
			>
				Desa ({data.desaNama})
			</button>
		</div>

		<!-- Daftar Jadwal Terdekat (Cards atau Empty State Dashed) -->
		<div class="space-y-3 pt-0.5">
			{#if currentJadwalList.length === 0}
				<div class="border border-slate-700/60 bg-[#1E293B]/50 rounded-2xl p-6 text-center space-y-2">
					<div class="w-10 h-10 rounded-xl bg-slate-800 text-slate-400 mx-auto flex items-center justify-center">
						<Calendar class="w-5 h-5 stroke-[1.8]" />
					</div>
					<p class="text-xs text-slate-400">
						Belum ada jadwal {jadwalTab === 'kelompok' ? 'kelompok' : 'desa'}.
					</p>
				</div>
			{:else}
				{#each currentJadwalList as jadwal}
					<div class="p-3.5 rounded-2xl border transition-colors space-y-2 bg-[#1E293B] border-slate-700/60 shadow-xs">
						<div class="flex items-center justify-between gap-2">
							<span class="text-xs sm:text-sm font-bold text-slate-100">
								{formatDateIndoFull(jadwal.tanggal)}
							</span>
							{#if jadwal.status === 'libur'}
								<span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-950/60 text-rose-300 border border-rose-800/40">
									Libur
								</span>
							{:else if jadwal.isOverride}
								<span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-950/60 text-amber-300 border border-amber-800/40">
									Perubahan
								</span>
							{/if}
						</div>

						<h4 class="text-xs sm:text-sm font-semibold text-slate-200">
							{jadwal.namaKegiatan}
						</h4>

						<div class="flex items-center gap-3 text-xs text-slate-400 flex-wrap pt-0.5">
							<span class="flex items-center gap-1 font-mono text-[11px]">
								<Clock class="w-3.5 h-3.5 text-slate-400" />
								<span>{jadwal.jamMulai}{jadwal.jamSelesai ? ` - ${jadwal.jamSelesai}` : ''} WIB</span>
							</span>
							{#if jadwal.lokasiNama}
								<span class="flex items-center gap-1 truncate text-[11px]">
									<MapPin class="w-3.5 h-3.5 text-slate-400 shrink-0" />
									<span class="truncate">{jadwal.lokasiNama}</span>
								</span>
							{/if}
						</div>
					</div>
				{/each}
			{/if}
		</div>
	</section>

	<!-- 6. Transaksi Terakhir -->
	<section class="px-4 space-y-2.5">
		<div class="flex items-center justify-between px-0.5">
			<div class="flex items-center gap-2">
				<HandCoins class="w-4 h-4 text-emerald-400" />
				<h3 class="text-sm font-bold text-slate-100 tracking-tight">
					Transaksi Terakhir
				</h3>
			</div>
			<a
				href="/transaksi"
				class="text-xs font-semibold text-emerald-400 hover:underline flex items-center gap-0.5"
			>
				Semua <ChevronRight class="w-3.5 h-3.5" />
			</a>
		</div>

		<div class="bg-[#1E293B] border border-slate-700/60 rounded-2xl divide-y divide-slate-700/50 overflow-hidden shadow-xs">
			{#each data.transaksiTerakhir as item}
				<div class="p-3.5 flex items-center justify-between">
					<div class="flex items-center gap-3">
						<div class="w-9 h-9 rounded-full flex items-center justify-center shrink-0 {item.statusColor === 'emerald' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}">
							{#if item.judul.toLowerCase().includes('infaq') || item.judul.toLowerCase().includes('shodaqoh')}
								<HeartHandshake class="w-4 h-4" />
							{:else}
								<HandCoins class="w-4 h-4" />
							{/if}
						</div>
						<div>
							<h4 class="text-xs sm:text-sm font-bold text-slate-100 leading-snug">
								{item.judul}
							</h4>
							<p class="text-[11px] text-slate-400 font-medium">
								{item.tanggalStr} · {item.metode}
							</p>
						</div>
					</div>

					<div class="text-right">
						<span class="text-xs sm:text-sm font-bold text-slate-100 block">
							Rp{item.nominal.toLocaleString('id-ID')}
						</span>
						<span class="text-[10px] font-semibold {item.statusColor === 'emerald' ? 'text-emerald-400' : 'text-amber-400'}">
							{item.status}
						</span>
					</div>
				</div>
			{/each}
		</div>
	</section>
</div>

<!-- Modal Ekosistem Aplikasi (SI-PPG & Haramain) -->
{#if showAppsModal}
	<div
		class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
		role="dialog"
		aria-modal="true"
		tabindex="-1"
		onclick={(e) => {
			if (e.target === e.currentTarget) closeModals();
		}}
		onkeydown={(e) => {
			if (e.key === 'Escape') closeModals();
		}}
	>
		<div class="bg-[#1E293B] border border-slate-700 rounded-t-3xl sm:rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-xl">
			<div class="flex items-center justify-between pb-3 border-b border-slate-700/60">
				<h3 class="text-base font-bold text-slate-100">Ekosistem Aplikasi</h3>
				<button
					type="button"
					onclick={closeModals}
					class="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
				>
					<X class="w-5 h-5" />
				</button>
			</div>

			<div class="space-y-2.5">
				<button
					type="button"
					onclick={() => openAppDetail('ppg')}
					class="w-full p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 hover:border-emerald-500/50 flex items-center justify-between transition-all text-left group cursor-pointer"
				>
					<div class="flex items-center gap-3">
						<div class="w-10 h-10 rounded-xl bg-purple-950/60 text-purple-400 flex items-center justify-center">
							<GraduationCap class="w-5 h-5" />
						</div>
						<div>
							<h4 class="text-sm font-bold text-slate-100 group-hover:text-emerald-400 transition-colors">SI-PPG</h4>
							<p class="text-xs text-slate-400">Sistem Informasi Pembinaan Penggerak Pembina Generus</p>
						</div>
					</div>
					<ChevronRight class="w-4 h-4 text-slate-400" />
				</button>

				<button
					type="button"
					onclick={() => openAppDetail('haramain')}
					class="w-full p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 hover:border-emerald-500/50 flex items-center justify-between transition-all text-left group cursor-pointer"
				>
					<div class="flex items-center gap-3">
						<div class="w-10 h-10 rounded-xl bg-amber-950/60 text-amber-400 flex items-center justify-center">
							<Compass class="w-5 h-5" />
						</div>
						<div>
							<h4 class="text-sm font-bold text-slate-100 group-hover:text-emerald-400 transition-colors">Haramain Store</h4>
							<p class="text-xs text-slate-400">Pusat Belanja & Kebutuhan Umroh</p>
						</div>
					</div>
					<ChevronRight class="w-4 h-4 text-slate-400" />
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Modal Detail SI-PPG / Haramain -->
{#if selectedAppModal}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
		role="dialog"
		aria-modal="true"
		tabindex="-1"
		onclick={(e) => {
			if (e.target === e.currentTarget) closeModals();
		}}
		onkeydown={(e) => {
			if (e.key === 'Escape') closeModals();
		}}
	>
		<div class="bg-[#1E293B] border border-slate-700 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-xl">
			{#if selectedAppModal === 'ppg'}
				<div class="w-12 h-12 rounded-2xl bg-purple-950/80 border border-purple-500/40 text-purple-400 mx-auto flex items-center justify-center">
					<GraduationCap class="w-6 h-6" />
				</div>
				<div class="text-center space-y-1">
					<h3 class="text-base font-bold text-slate-100">SI-PPG</h3>
					<p class="text-xs text-slate-400 leading-relaxed">
						Sistem Informasi Pembinaan Penggerak Pembina Generus terintegrasi untuk kurikulum, raport, dan pemantauan santri TPQ / Generus.
					</p>
				</div>
			{:else}
				<div class="w-12 h-12 rounded-2xl bg-amber-950/80 border border-amber-500/40 text-amber-400 mx-auto flex items-center justify-center">
					<Compass class="w-6 h-6" />
				</div>
				<div class="text-center space-y-1">
					<h3 class="text-base font-bold text-slate-100">Haramain Store</h3>
					<p class="text-xs text-slate-400 leading-relaxed">
						Layanan perlengkapan ibadah, kurma, oleh-oleh haji dan umroh resmi untuk jamaah.
					</p>
				</div>
			{/if}

			<button
				type="button"
				onclick={closeModals}
				class="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
			>
				Tutup
			</button>
		</div>
	</div>
{/if}
