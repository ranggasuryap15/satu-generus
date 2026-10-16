<!--
  @file src/routes/(app)/+page.svelte
  @purpose Halaman beranda client/jamaah sesuai konsep Flat Design Minimalist yang di-upsize: Banner Hijau Melengkung terintegrasi, Switcher Mode Admin ⇄ Jamaah (jika admin), Modal Notifikasi Pengajian interaktif, Floating 5-Launcher Card (Presensi, Isrun/FR, Keluarga, SI-PPG, Lainnya), Infaq & Shodaqoh, Ringkasan Bulan Ini (Kehadiran, Izin, Shodaqoh), Jadwal Pengajian Terdekat dengan tombol Presensi & Semua, serta Transaksi Terakhir
  @usedBy Route utama client '/'
  @dependencies @lucide/svelte, $app/state (page), #lib/components/ThemeToggle.svelte, #lib/jadwal (formatDateIndoFull), Svelte 5 Runes
  @publicFunctions openAppDetail, closeModals, toggleNotif, closeNotif
  @sideEffects Menampilkan modal notifikasi jamaah, navigasi presensi dengan parameter jadwal, modal ekosistem aplikasi
-->
<script lang="ts">
	import { page } from '$app/state';
	import {
		AlertTriangle,
		Bell,
		BellOff,
		Calendar,
		CalendarClock,
		CheckCircle2,
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

	// State Modal Notifikasi
	let isNotifOpen = $state(false);

	// State Modal Ekosistem Aplikasi
	let showAppsModal = $state(false);
	let selectedAppModal = $state<'haramain' | 'ppg' | null>(null);

	// Tab Jadwal (Kelompok vs Desa)
	let jadwalTab = $state<'kelompok' | 'desa'>('kelompok');

	// Notifikasi & Admin Status dari layout root / layout client
	interface NotifItem {
		id: string;
		kategori: 'jadwal' | 'presensi' | 'info';
		judul: string;
		pesan: string;
		waktu: string;
		statusBadge: string;
		badgeVariant: 'primary' | 'warning' | 'emerald' | 'amber' | 'rose';
		link: string;
		isImportant: boolean;
		tanggalRaw?: string;
	}

	const notifikasiList = $derived((page.data.notifikasiList as NotifItem[]) || []);
	const unreadCount = $derived(Number(page.data.unreadNotifCount) || 0);
	const isAdmin = $derived(Boolean(page.data.isAdmin));

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

	function closeNotif() {
		isNotifOpen = false;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			if (isNotifOpen) closeNotif();
			if (showAppsModal || selectedAppModal) closeModals();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<svelte:head>
	<title>Beranda - Satu Generus</title>
</svelte:head>

<div class="space-y-4 pb-4">
	<!-- 1. Header Hijau Melengkung Terintegrasi (Upsized & Rounded) -->
	<header class="bg-[#166534] dark:bg-[#14532D] text-white px-5 pt-5 pb-14 rounded-b-[32px] shadow-sm">
		<!-- Top Bar: Logo SG & Action Icons (Theme, Search, Notif) -->
		<div class="flex items-center justify-between mb-3.5">
			<div class="flex items-center gap-3">
				<div class="w-11 h-11 rounded-2xl bg-white/20 text-white font-black flex items-center justify-center text-sm shadow-xs tracking-tight">
					SG
				</div>
				<div>
					<span class="text-lg sm:text-xl font-black text-white tracking-tight block leading-tight">
						Satu Generus
					</span>
					<span class="text-[11px] sm:text-xs text-white/80 font-medium">
						Sistem Terpadu Jamaah
					</span>
				</div>
			</div>

			<div class="flex items-center gap-1">
				<ThemeToggle />

				<!-- Tombol Notifikasi yang Sebenarnya -->
				<button
					type="button"
					onclick={() => (isNotifOpen = true)}
					class="p-2.5 text-white/90 hover:text-white rounded-xl hover:bg-white/15 transition-all relative cursor-pointer active:scale-95"
					aria-label="Pemberitahuan & Notifikasi"
					aria-expanded={isNotifOpen}
				>
					<Bell class="w-6 h-6 stroke-[2]" />
					{#if unreadCount > 0}
						<span class="absolute top-1 right-1 min-w-5 h-5 px-1 rounded-full bg-rose-500 text-white font-black text-[10px] flex items-center justify-center shadow-xs animate-pulse">
							{unreadCount > 9 ? '9+' : unreadCount}
						</span>
					{:else if notifikasiList.length > 0}
						<span class="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-amber-300 ring-2 ring-[#166534]"></span>
					{/if}
				</button>
			</div>
		</div>

		<!-- Status Jamaah & Switcher Mode Admin (Jika User adalah Admin) -->
		<div class="flex items-center gap-2 mb-3 flex-wrap">
			{#if isAdmin}
				<a
					href="/admin"
					class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white text-xs sm:text-sm font-bold border border-white/30 backdrop-blur-xs transition-all active:scale-95 shadow-xs group"
					title="Beralih ke Panel Pengurus/Admin"
				>
					<span class="w-2.5 h-2.5 rounded-full bg-emerald-300 animate-pulse"></span>
					<span>Mode: <strong class="underline decoration-white/70">Jamaah</strong></span>
					<span class="text-emerald-200 group-hover:translate-x-0.5 transition-transform">⇄ Ke Admin</span>
				</a>
			{:else}
				<span class="px-3 py-1 rounded-full text-xs sm:text-sm font-semibold bg-white/20 text-white backdrop-blur-xs">
					Jamaah
				</span>
			{/if}

			<span class="text-xs sm:text-sm font-semibold text-white/90 bg-black/10 px-2.5 py-1 rounded-full">
				{data.kelompokNama}
			</span>
		</div>

		<!-- Sapaan Pengguna (Upsized) -->
		<div class="pt-1">
			<p class="text-xs sm:text-sm text-white/80 font-medium">Selamat Datang,</p>
			<h1 class="text-2xl sm:text-3xl font-black text-white tracking-tight mt-0.5 line-clamp-1">
				{data.user.namaLengkap}
			</h1>
		</div>
	</header>

	<!-- 2. Floating Launcher Card: 5 Kolom Ikon Melingkar (Upsized & Overlapping Header) -->
	<div class="-mt-9 px-4">
		<div class="bg-[#1E293B] border border-slate-700/60 rounded-3xl p-4 sm:p-5 shadow-lg">
			<div class="grid grid-cols-5 gap-2 text-center">
				<!-- 1. Presensi -->
				<a href="/presensi" class="flex flex-col items-center group cursor-pointer">
					<div class="w-13 h-13 sm:w-15 sm:h-15 rounded-full bg-emerald-950/80 border border-emerald-500/30 text-emerald-400 flex items-center justify-center group-hover:scale-105 active:scale-95 transition-all shadow-xs">
						<QrCode class="w-6 h-6 sm:w-7 sm:h-7 stroke-[2.2]" />
					</div>
					<span class="text-xs sm:text-sm font-semibold text-slate-200 mt-2">Presensi</span>
				</a>

				<!-- 2. Isrun/FR -->
				<a href="/transaksi" class="flex flex-col items-center group cursor-pointer">
					<div class="w-13 h-13 sm:w-15 sm:h-15 rounded-full bg-amber-950/80 border border-amber-500/30 text-amber-400 flex items-center justify-center group-hover:scale-105 active:scale-95 transition-all shadow-xs">
						<HandCoins class="w-6 h-6 sm:w-7 sm:h-7 stroke-[2.2]" />
					</div>
					<span class="text-xs sm:text-sm font-semibold text-slate-200 mt-2">Isrun/FR</span>
				</a>

				<!-- 3. Keluarga -->
				<a href="/sensus" class="flex flex-col items-center group cursor-pointer">
					<div class="w-13 h-13 sm:w-15 sm:h-15 rounded-full bg-sky-950/80 border border-sky-500/30 text-sky-400 flex items-center justify-center group-hover:scale-105 active:scale-95 transition-all shadow-xs">
						<Users class="w-6 h-6 sm:w-7 sm:h-7 stroke-[2.2]" />
					</div>
					<span class="text-xs sm:text-sm font-semibold text-slate-200 mt-2">Keluarga</span>
				</a>

				<!-- 4. SI-PPG -->
				<button
					type="button"
					onclick={() => openAppDetail('ppg')}
					class="flex flex-col items-center group cursor-pointer"
				>
					<div class="w-13 h-13 sm:w-15 sm:h-15 rounded-full bg-purple-950/80 border border-purple-500/30 text-purple-400 flex items-center justify-center group-hover:scale-105 active:scale-95 transition-all shadow-xs">
						<GraduationCap class="w-6 h-6 sm:w-7 sm:h-7 stroke-[2.2]" />
					</div>
					<span class="text-xs sm:text-sm font-semibold text-slate-200 mt-2">SI-PPG</span>
				</button>

				<!-- 5. Lainnya -->
				<button
					type="button"
					onclick={() => (showAppsModal = true)}
					class="flex flex-col items-center group cursor-pointer"
				>
					<div class="w-13 h-13 sm:w-15 sm:h-15 rounded-full bg-slate-800 border border-slate-600/40 text-slate-300 flex items-center justify-center group-hover:scale-105 active:scale-95 transition-all shadow-xs">
						<LayoutGrid class="w-6 h-6 sm:w-7 sm:h-7 stroke-[2.2]" />
					</div>
					<span class="text-xs sm:text-sm font-semibold text-slate-200 mt-2">Lainnya</span>
				</button>
			</div>
		</div>
	</div>

	<!-- 3. Infaq & Shodaqoh Card (Upsized) -->
	<section class="px-4">
		<div class="bg-[#1E293B] border border-slate-700/60 rounded-3xl p-4 sm:p-5 shadow-md flex items-center justify-between gap-4">
			<div class="flex items-center gap-3.5 min-w-0">
				<div class="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-amber-950/80 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
					<HeartHandshake class="w-6 h-6 sm:w-7 sm:h-7" />
				</div>
				<div class="min-w-0">
					<div class="flex items-center gap-2 flex-wrap">
						<h3 class="text-base sm:text-lg font-bold text-slate-100">
							Infaq & Shodaqoh
						</h3>
						<span class="px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold bg-emerald-950/80 border border-emerald-500/30 text-emerald-300">
							QRIS · Bank
						</span>
					</div>
					<p class="text-xs sm:text-sm text-slate-300 mt-0.5 line-clamp-1">
						Tunaikan infaq dan shodaqoh secara mandiri
					</p>
				</div>
			</div>

			<a
				href="/shodaqoh"
				class="shrink-0 px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs sm:text-sm font-black transition-all active:scale-95 flex items-center gap-1 shadow-xs"
			>
				<span>Tunaikan</span>
				<ChevronRight class="w-4 h-4 stroke-[2.5]" />
			</a>
		</div>
	</section>

	<!-- 4. Ringkasan Bulan Ini (3 Kolom Kartu - Upsized) -->
	<section class="px-4 space-y-2.5">
		<h3 class="text-base sm:text-lg font-bold text-slate-100 tracking-tight px-1">
			Ringkasan Bulan Ini
		</h3>
		<div class="grid grid-cols-3 gap-2.5 text-center">
			<!-- Kehadiran -->
			<div class="bg-[#1E293B] border border-slate-700/60 rounded-2xl p-3.5 sm:p-4 shadow-xs">
				<span class="text-xl sm:text-2xl font-black text-emerald-400 block tracking-tight">
					{data.ringkasan.kehadiranText}
				</span>
				<span class="text-xs sm:text-sm text-slate-300 font-semibold mt-1 block">Kehadiran</span>
			</div>

			<!-- Izin -->
			<div class="bg-[#1E293B] border border-slate-700/60 rounded-2xl p-3.5 sm:p-4 shadow-xs">
				<span class="text-xl sm:text-2xl font-black text-sky-400 block tracking-tight">
					{data.ringkasan.izinCount}
				</span>
				<span class="text-xs sm:text-sm text-slate-300 font-semibold mt-1 block">Izin</span>
			</div>

			<!-- Shodaqoh -->
			<div class="bg-[#1E293B] border border-slate-700/60 rounded-2xl p-3.5 sm:p-4 shadow-xs">
				<span class="text-xl sm:text-2xl font-black text-amber-400 block tracking-tight">
					{data.ringkasan.shodaqohText}
				</span>
				<span class="text-xs sm:text-sm text-slate-300 font-semibold mt-1 block">Shodaqoh</span>
			</div>
		</div>
	</section>

	<!-- 5. Jadwal Pengajian (Tombol 'Semua' & Aksi 'Presensi') -->
	<section class="px-4 space-y-3">
		<div class="flex items-center justify-between px-1">
			<div class="flex items-center gap-2">
				<Calendar class="w-5 h-5 text-emerald-400" />
				<h3 class="text-base sm:text-lg font-bold text-slate-100 tracking-tight">
					Jadwal Pengajian
				</h3>
			</div>
			<!-- Tombol Semua mengarah ke halaman jadwal sebulan penuh -->
			<a
				href="/jadwal?from=beranda"
				class="text-xs sm:text-sm font-bold text-emerald-400 hover:underline flex items-center gap-1 py-1"
			>
				Semua <ChevronRight class="w-4 h-4 stroke-[2.5]" />
			</a>
		</div>

		<!-- Segmented Control Flat Switcher: Kelompok vs Desa -->
		<div class="grid grid-cols-2 p-1.5 bg-[#0F172A] rounded-2xl text-xs sm:text-sm">
			<button
				type="button"
				onclick={() => (jadwalTab = 'kelompok')}
				class="py-2.5 px-3 rounded-xl transition-all text-center truncate cursor-pointer {jadwalTab === 'kelompok'
					? 'bg-[#1E293B] text-white shadow-xs font-bold'
					: 'text-slate-400 hover:text-slate-200 font-medium'}"
			>
				Kelompok ({data.kelompokNama})
			</button>
			<button
				type="button"
				onclick={() => (jadwalTab = 'desa')}
				class="py-2.5 px-3 rounded-xl transition-all text-center truncate cursor-pointer {jadwalTab === 'desa'
					? 'bg-[#1E293B] text-white shadow-xs font-bold'
					: 'text-slate-400 hover:text-slate-200 font-medium'}"
			>
				Desa ({data.desaNama})
			</button>
		</div>

		<!-- Daftar Jadwal Terdekat (Cards atau Empty State Dashed) -->
		<div class="space-y-3 pt-0.5">
			{#if currentJadwalList.length === 0}
				<div class="border border-slate-700/60 bg-[#1E293B]/50 rounded-2xl p-7 text-center space-y-2.5">
					<div class="w-12 h-12 rounded-2xl bg-slate-800 text-slate-400 mx-auto flex items-center justify-center">
						<Calendar class="w-6 h-6 stroke-[1.8]" />
					</div>
					<p class="text-xs sm:text-sm text-slate-300">
						Belum ada jadwal {jadwalTab === 'kelompok' ? 'kelompok' : 'desa'} terdekat.
					</p>
				</div>
			{:else}
				{#each currentJadwalList as jadwal}
					<div class="p-4 sm:p-5 rounded-2xl border transition-colors space-y-3 bg-[#1E293B] border-slate-700/60 shadow-xs">
						<div class="flex items-center justify-between gap-2">
							<span class="text-sm sm:text-base font-bold text-slate-100">
								{formatDateIndoFull(jadwal.tanggal)}
							</span>
							{#if jadwal.status === 'libur'}
								<span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-950/60 text-rose-300 border border-rose-800/40">
									Libur
								</span>
							{:else if jadwal.isOverride}
								<span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-950/60 text-amber-300 border border-amber-800/40">
									Perubahan
								</span>
							{/if}
						</div>

						<a
							href={jadwal.status !== 'libur' ? `/presensi?jadwalId=${jadwal.id}` : '#'}
							class="block text-sm sm:text-base font-bold text-slate-100 hover:text-emerald-400 transition-colors"
						>
							{jadwal.namaKegiatan}
						</a>

						<div class="flex items-center gap-3.5 text-xs sm:text-sm text-slate-300 flex-wrap">
							<span class="flex items-center gap-1.5 font-mono">
								<Clock class="w-4 h-4 text-slate-400 shrink-0" />
								<span>{jadwal.jamMulai}{jadwal.jamSelesai ? ` - ${jadwal.jamSelesai}` : ''} WIB</span>
							</span>
							{#if jadwal.lokasiNama}
								<span class="flex items-center gap-1.5 truncate">
									<MapPin class="w-4 h-4 text-slate-400 shrink-0" />
									<span class="truncate">{jadwal.lokasiNama}</span>
								</span>
							{/if}
						</div>

						<!-- Tombol Aksi Presensi Langsung Terhubung ke Jadwal Ini -->
						{#if jadwal.status !== 'libur'}
							<div class="pt-3 border-t border-slate-700/60 flex items-center justify-between gap-2">
								<span class="text-xs text-slate-400 font-medium">Pengajian Terdekat</span>
								<a
									href="/presensi?jadwalId={jadwal.id}"
									class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-xs sm:text-sm font-black transition-all active:scale-95 shadow-xs"
								>
									<QrCode class="w-4 h-4" />
									<span>Presensi</span>
								</a>
							</div>
						{/if}
					</div>
				{/each}
			{/if}
		</div>
	</section>

	<!-- 6. Transaksi Terakhir (Upsized) -->
	<section class="px-4 space-y-2.5">
		<div class="flex items-center justify-between px-1">
			<div class="flex items-center gap-2">
				<HandCoins class="w-5 h-5 text-emerald-400" />
				<h3 class="text-base sm:text-lg font-bold text-slate-100 tracking-tight">
					Transaksi Terakhir
				</h3>
			</div>
			<a
				href="/transaksi"
				class="text-xs sm:text-sm font-bold text-emerald-400 hover:underline flex items-center gap-1 py-1"
			>
				Semua <ChevronRight class="w-4 h-4 stroke-[2.5]" />
			</a>
		</div>

		<div class="bg-[#1E293B] border border-slate-700/60 rounded-3xl divide-y divide-slate-700/50 overflow-hidden shadow-xs">
			{#if data.transaksiTerakhir.length === 0}
				<div class="p-6 text-center text-xs sm:text-sm text-slate-400">
					Belum ada riwayat transaksi bulan ini.
				</div>
			{:else}
				{#each data.transaksiTerakhir as item}
					<div class="p-4 flex items-center justify-between gap-3">
						<div class="flex items-center gap-3.5 min-w-0">
							<div class="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center shrink-0 {item.statusColor === 'emerald' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}">
								{#if item.judul.toLowerCase().includes('infaq') || item.judul.toLowerCase().includes('shodaqoh')}
									<HeartHandshake class="w-5 h-5 sm:w-6 sm:h-6" />
								{:else}
									<HandCoins class="w-5 h-5 sm:w-6 sm:h-6" />
								{/if}
							</div>
							<div class="min-w-0">
								<h4 class="text-sm sm:text-base font-bold text-slate-100 leading-snug truncate">
									{item.judul}
								</h4>
								<p class="text-xs sm:text-sm text-slate-400 font-medium mt-0.5">
									{item.tanggalStr} · {item.metode}
								</p>
							</div>
						</div>

						<div class="text-right shrink-0">
							<span class="text-sm sm:text-base font-black text-slate-100 block">
								Rp{item.nominal.toLocaleString('id-ID')}
							</span>
							<span class="text-xs font-bold {item.statusColor === 'emerald' ? 'text-emerald-400' : 'text-amber-400'}">
								{item.status}
							</span>
						</div>
					</div>
				{/each}
			{/if}
		</div>
	</section>
</div>

<!-- Modal Popover Notifikasi Jamaah yang Sebenarnya (Bukan SI-PPG) -->
{#if isNotifOpen}
	<div
		class="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-start justify-center p-3 sm:p-4 pt-16 sm:pt-20 transition-opacity animate-in fade-in duration-150"
		role="dialog"
		aria-modal="true"
		tabindex="-1"
		onclick={(e) => {
			if (e.target === e.currentTarget) closeNotif();
		}}
	>
		<div
			class="w-full max-w-md bg-[#1E293B] border border-slate-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[82vh] transition-all animate-in zoom-in-95 duration-150"
		>
			<!-- Header Notifikasi -->
			<div class="px-5 py-4 border-b border-slate-700/80 bg-slate-900/40 flex items-center justify-between shrink-0">
				<div class="flex items-center gap-3">
					<div class="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
						<Bell class="w-5 h-5" />
					</div>
					<div>
						<h2 class="text-base font-bold text-slate-100 leading-tight">
							Pemberitahuan
						</h2>
						<p class="text-xs text-slate-400 leading-tight">
							Jadwal pengajian & status presensi
						</p>
					</div>
				</div>

				<div class="flex items-center gap-2">
					{#if unreadCount > 0}
						<span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
							{unreadCount} Baru
						</span>
					{/if}
					<button
						type="button"
						onclick={closeNotif}
						class="w-9 h-9 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center transition-colors cursor-pointer"
						aria-label="Tutup Notifikasi"
					>
						<X class="w-5 h-5" />
					</button>
				</div>
			</div>

			<!-- Body Notifikasi: Daftar Pemberitahuan Real -->
			<div class="overflow-y-auto divide-y divide-slate-700/60 p-2 flex-1">
				{#if notifikasiList.length === 0}
					<div class="py-12 px-4 text-center space-y-3">
						<div class="w-14 h-14 rounded-2xl bg-slate-800 text-slate-400 mx-auto flex items-center justify-center">
							<BellOff class="w-7 h-7" />
						</div>
						<p class="text-sm font-bold text-slate-200">Tidak Ada Pemberitahuan Baru</p>
						<p class="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
							Semua jadwal pengajian kelompok dan riwayat presensi Anda saat ini sudah diperbarui.
						</p>
					</div>
				{:else}
					{#each notifikasiList as item (item.id)}
						<a
							href={item.link}
							onclick={closeNotif}
							class="p-3.5 rounded-2xl flex items-start gap-3.5 hover:bg-slate-800/60 transition-colors group block text-left"
						>
							<div
								class="w-9 h-9 rounded-xl shrink-0 flex items-center justify-center mt-0.5
								{item.badgeVariant === 'warning'
									? 'bg-amber-500/15 text-amber-400'
									: item.badgeVariant === 'emerald'
										? 'bg-emerald-500/15 text-emerald-400'
										: item.badgeVariant === 'rose'
											? 'bg-rose-500/15 text-rose-400'
											: 'bg-emerald-500/15 text-emerald-400'}"
							>
								{#if item.badgeVariant === 'warning'}
									<AlertTriangle class="w-5 h-5" />
								{:else if item.kategori === 'jadwal'}
									<CalendarClock class="w-5 h-5" />
								{:else if item.badgeVariant === 'emerald'}
									<CheckCircle2 class="w-5 h-5" />
								{:else}
									<Clock class="w-5 h-5" />
								{/if}
							</div>

							<div class="flex-1 min-w-0 space-y-1">
								<div class="flex items-center justify-between gap-1.5">
									<span class="text-xs sm:text-sm font-bold text-slate-100 group-hover:text-emerald-400 transition-colors truncate">
										{item.judul}
									</span>
									<span
										class="text-[10px] sm:text-xs px-2 py-0.5 rounded font-semibold shrink-0 tracking-tight
										{item.badgeVariant === 'warning'
											? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
											: item.badgeVariant === 'emerald'
												? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
												: item.badgeVariant === 'rose'
													? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
													: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'}"
									>
										{item.statusBadge}
									</span>
								</div>

								<p class="text-xs text-slate-300 leading-snug line-clamp-2">
									{item.pesan}
								</p>

								<div class="flex items-center justify-between pt-1 text-[11px] text-slate-400">
									<span>{item.waktu}</span>
									<span class="inline-flex items-center gap-1 text-emerald-400 font-bold group-hover:underline">
										Buka <ChevronRight class="w-3.5 h-3.5" />
									</span>
								</div>
							</div>
						</a>
					{/each}
				{/if}
			</div>

			<!-- Footer Notifikasi -->
			<div class="p-3 border-t border-slate-700/80 bg-slate-900/40 flex items-center justify-between gap-2 shrink-0">
				<a
					href="/presensi"
					onclick={closeNotif}
					class="text-xs sm:text-sm font-bold text-emerald-400 hover:underline px-2 py-1 inline-flex items-center gap-1"
				>
					Buka Presensi <ChevronRight class="w-4 h-4" />
				</a>

				<button
					type="button"
					onclick={closeNotif}
					class="px-4 py-2 text-xs sm:text-sm font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition-colors cursor-pointer"
				>
					Tutup
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Modal Ekosistem Aplikasi (SI-PPG & Haramain Store) -->
{#if showAppsModal}
	<div
		class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200"
		role="dialog"
		aria-modal="true"
		tabindex="-1"
		onclick={(e) => {
			if (e.target === e.currentTarget) closeModals();
		}}
	>
		<div class="bg-[#1E293B] border border-slate-700 rounded-t-3xl sm:rounded-3xl max-w-sm w-full p-5 sm:p-6 space-y-4 shadow-2xl">
			<div class="flex items-center justify-between pb-3 border-b border-slate-700/60">
				<h3 class="text-base sm:text-lg font-bold text-slate-100">Ekosistem Aplikasi</h3>
				<button
					type="button"
					onclick={closeModals}
					class="p-1 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
				>
					<X class="w-5 h-5" />
				</button>
			</div>

			<div class="space-y-3">
				<button
					type="button"
					onclick={() => openAppDetail('ppg')}
					class="w-full p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60 hover:border-emerald-500/50 flex items-center justify-between transition-all text-left group cursor-pointer"
				>
					<div class="flex items-center gap-3">
						<div class="w-11 h-11 rounded-2xl bg-purple-950/60 text-purple-400 flex items-center justify-center">
							<GraduationCap class="w-6 h-6" />
						</div>
						<div>
							<h4 class="text-sm sm:text-base font-bold text-slate-100 group-hover:text-emerald-400 transition-colors">SI-PPG</h4>
							<p class="text-xs text-slate-400">Pembinaan Penggerak Pembina Generus</p>
						</div>
					</div>
					<ChevronRight class="w-5 h-5 text-slate-400" />
				</button>

				<button
					type="button"
					onclick={() => openAppDetail('haramain')}
					class="w-full p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60 hover:border-emerald-500/50 flex items-center justify-between transition-all text-left group cursor-pointer"
				>
					<div class="flex items-center gap-3">
						<div class="w-11 h-11 rounded-2xl bg-amber-950/60 text-amber-400 flex items-center justify-center">
							<Compass class="w-6 h-6" />
						</div>
						<div>
							<h4 class="text-sm sm:text-base font-bold text-slate-100 group-hover:text-emerald-400 transition-colors">Haramain Store</h4>
							<p class="text-xs text-slate-400">Pusat Belanja & Kebutuhan Umroh</p>
						</div>
					</div>
					<ChevronRight class="w-5 h-5 text-slate-400" />
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Modal Detail SI-PPG / Haramain -->
{#if selectedAppModal}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200"
		role="dialog"
		aria-modal="true"
		tabindex="-1"
		onclick={(e) => {
			if (e.target === e.currentTarget) closeModals();
		}}
	>
		<div class="bg-[#1E293B] border border-slate-700 rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
			{#if selectedAppModal === 'ppg'}
				<div class="w-14 h-14 rounded-2xl bg-purple-950/80 border border-purple-500/40 text-purple-400 mx-auto flex items-center justify-center">
					<GraduationCap class="w-7 h-7" />
				</div>
				<div class="text-center space-y-1.5">
					<h3 class="text-lg font-bold text-slate-100">SI-PPG</h3>
					<p class="text-xs sm:text-sm text-slate-300 leading-relaxed">
						Sistem Informasi Pembinaan Penggerak Pembina Generus terintegrasi untuk kurikulum, raport, dan pemantauan santri TPQ / Generus.
					</p>
				</div>
			{:else}
				<div class="w-14 h-14 rounded-2xl bg-amber-950/80 border border-amber-500/40 text-amber-400 mx-auto flex items-center justify-center">
					<Compass class="w-7 h-7" />
				</div>
				<div class="text-center space-y-1.5">
					<h3 class="text-lg font-bold text-slate-100">Haramain Store</h3>
					<p class="text-xs sm:text-sm text-slate-300 leading-relaxed">
						Layanan perlengkapan ibadah, kurma, oleh-oleh haji dan umroh resmi untuk jamaah.
					</p>
				</div>
			{/if}

			<button
				type="button"
				onclick={closeModals}
				class="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs sm:text-sm font-bold transition-colors cursor-pointer"
			>
				Tutup
			</button>
		</div>
	</div>
{/if}
