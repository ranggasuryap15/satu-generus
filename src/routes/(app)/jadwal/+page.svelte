<!--
  @file src/routes/(app)/jadwal/+page.svelte
  @purpose Halaman jadwal pengajian sebulan penuh untuk jamaah (kelompok & desa), navigasi bulan fleksibel, indikator status kehadiran, dan tautan langsung presensi hari ini
  @usedBy Route client '/jadwal'
  @dependencies @lucide/svelte, #lib/jadwal (NAMA_BULAN_INDO, formatDateIndoFull), Svelte 5 Runes
  @publicFunctions changeMonth, goToCurrentMonth
  @sideEffects Navigasi halaman dengan URL search params (?bulan=..&tahun=..)
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import {
		ArrowLeft,
		Calendar,
		ChevronLeft,
		ChevronRight,
		Clock,
		ExternalLink,
		MapPin,
		CheckCircle2,
		AlertCircle,
		UserCheck,
		Sparkles
	} from '@lucide/svelte';
	import type { PageData } from './$types';
	import { NAMA_BULAN_INDO, formatDateIndoFull } from '#lib/jadwal.js';

	let { data } = $props<{ data: PageData }>();

	let activeScope = $state<'kelompok' | 'desa'>('kelompok');

	const currentJadwalList = $derived(
		activeScope === 'kelompok' ? data.jadwalKelompok : data.jadwalDesa
	);

	const namaBulanAktif = $derived(NAMA_BULAN_INDO[data.bulan - 1] || 'Bulan');

	function changeMonth(delta: number) {
		let newMonth = data.bulan + delta;
		let newYear = data.tahun;

		if (newMonth < 1) {
			newMonth = 12;
			newYear -= 1;
		} else if (newMonth > 12) {
			newMonth = 1;
			newYear += 1;
		}

		goto(`/jadwal?bulan=${newMonth}&tahun=${newYear}`);
	}

	function goToCurrentMonth() {
		const now = new Date();
		const currentYear = now.getFullYear();
		const currentMonth = now.getMonth() + 1;
		goto(`/jadwal?bulan=${currentMonth}&tahun=${currentYear}`);
	}

	const isViewingCurrentMonth = $derived.by(() => {
		const currentYear = parseInt(data.today.slice(0, 4), 10);
		const currentMonth = parseInt(data.today.slice(5, 7), 10);
		return data.tahun === currentYear && data.bulan === currentMonth;
	});
</script>

<svelte:head>
	<title>Jadwal Pengajian Bulanan - Satu Generus</title>
</svelte:head>

<div class="space-y-4 max-w-2xl mx-auto pb-12">
	<!-- Top Bar: Navigasi Kembali & Judul Halaman -->
	<div class="flex items-center justify-between border-b border-border/70 pb-3">
		<div class="flex items-center gap-3">
			<a
				href="/"
				class="p-2 rounded-xl border border-border bg-card hover:bg-secondary text-foreground/70 hover:text-foreground transition-all cursor-pointer shadow-2xs"
				title="Kembali ke Beranda"
			>
				<ArrowLeft class="w-4 h-4" />
			</a>
			<div>
				<h1 class="text-base sm:text-lg font-bold text-foreground tracking-tight">
					Jadwal Pengajian
				</h1>
				<p class="text-xs text-foreground/60">
					Seluruh jadwal kegiatan pengajian dalam sebulan
				</p>
			</div>
		</div>

		{#if !isViewingCurrentMonth}
			<button
				type="button"
				onclick={goToCurrentMonth}
				class="px-2.5 py-1 text-xs font-semibold rounded-lg bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors cursor-pointer"
			>
				Bulan Ini
			</button>
		{/if}
	</div>

	<!-- Month Navigation Card (Flat & Modern) -->
	<div class="bg-card border border-border rounded-2xl p-3 sm:p-4 shadow-xs flex items-center justify-between gap-2">
		<button
			type="button"
			onclick={() => changeMonth(-1)}
			class="p-2 rounded-xl border border-border bg-secondary/50 hover:bg-secondary text-foreground/70 hover:text-foreground transition-colors cursor-pointer"
			title="Bulan Sebelumnya"
		>
			<ChevronLeft class="w-4 h-4" />
		</button>

		<div class="text-center">
			<span class="text-xs font-medium text-foreground/50 uppercase tracking-wider block">
				Periode Kalender
			</span>
			<h2 class="text-sm sm:text-base font-bold text-foreground">
				{namaBulanAktif} {data.tahun}
			</h2>
		</div>

		<button
			type="button"
			onclick={() => changeMonth(1)}
			class="p-2 rounded-xl border border-border bg-secondary/50 hover:bg-secondary text-foreground/70 hover:text-foreground transition-colors cursor-pointer"
			title="Bulan Berikutnya"
		>
			<ChevronRight class="w-4 h-4" />
		</button>
	</div>

	<!-- Segmented Control Switcher: Kelompok vs Desa -->
	<div class="grid grid-cols-2 p-1.5 bg-secondary/70 rounded-2xl text-xs sm:text-sm">
		<button
			type="button"
			onclick={() => (activeScope = 'kelompok')}
			class="py-2.5 px-3 rounded-xl transition-all text-center truncate cursor-pointer {activeScope === 'kelompok'
				? 'bg-card text-foreground shadow-xs font-bold'
				: 'text-foreground/60 hover:text-foreground font-medium'}"
		>
			Kelompok ({data.kelompokNama})
		</button>
		<button
			type="button"
			onclick={() => (activeScope = 'desa')}
			class="py-2.5 px-3 rounded-xl transition-all text-center truncate cursor-pointer {activeScope === 'desa'
				? 'bg-card text-foreground shadow-xs font-bold'
				: 'text-foreground/60 hover:text-foreground font-medium'}"
		>
			Desa ({data.desaNama})
		</button>
	</div>

	<!-- List Jadwal Pengajian -->
	<div class="space-y-3">
		{#if currentJadwalList.length === 0}
			<div class="border border-dashed border-border bg-card/40 rounded-3xl p-8 sm:p-10 text-center space-y-3">
				<div class="w-12 h-12 rounded-2xl bg-secondary text-foreground/40 mx-auto flex items-center justify-center">
					<Calendar class="w-6 h-6 stroke-[1.8]" />
				</div>
				<div class="space-y-1">
					<p class="text-sm font-semibold text-foreground">Tidak Ada Jadwal Pengajian</p>
					<p class="text-xs text-foreground/60 max-w-sm mx-auto leading-relaxed">
						Belum ada kegiatan pengajian {activeScope === 'kelompok' ? 'kelompok' : 'desa'} yang dijadwalkan pada bulan {namaBulanAktif} {data.tahun}.
					</p>
				</div>
			</div>
		{:else}
			{#each currentJadwalList as j}
				<div
					class="p-4 rounded-2xl border transition-all space-y-3 shadow-xs relative {j.isHariIni
						? 'bg-primary/5 border-primary/40 ring-1 ring-primary/30'
						: j.status === 'libur'
							? 'bg-rose-50/50 border-rose-200/70 dark:bg-rose-950/20 dark:border-rose-900/40 opacity-80'
							: 'bg-card border-border hover:border-border/80'}"
				>
					<!-- Header Kartu: Tanggal, Status Hari Ini / Rutin, dan Jam -->
					<div class="flex items-start justify-between gap-2 flex-wrap">
						<div class="space-y-1">
							<div class="flex items-center gap-2 flex-wrap">
								<span class="text-sm font-bold text-foreground">
									{formatDateIndoFull(j.tanggal)}
								</span>

								{#if j.isHariIni}
									<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary text-primary-foreground tracking-wide">
										HARI INI
									</span>
								{/if}

								{#if j.status === 'libur'}
									<span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/50">
										Libur
									</span>
								{/if}

								{#if j.isRutin}
									<span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-secondary text-foreground/70 border border-border">
										Rutin
									</span>
								{/if}

								{#if j.isOverride}
									<span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/50">
										Khusus
									</span>
								{/if}
							</div>
						</div>

						<!-- Jam Pelaksanaan -->
						<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold bg-primary/10 text-primary font-mono shrink-0">
							<Clock class="w-3.5 h-3.5" />
							<span>{j.jamMulai}{j.jamSelesai ? ` - ${j.jamSelesai}` : ''} WIB</span>
						</span>
					</div>

					<!-- Judul & Materi Kegiatan -->
					<div>
						<h3 class="text-sm font-bold text-foreground">
							{j.namaKegiatan}
						</h3>
						{#if j.detailMateri}
							<p class="text-xs text-foreground/70 bg-secondary/40 border border-border/60 p-2.5 rounded-xl leading-relaxed whitespace-pre-line mt-1.5">
								{j.detailMateri}
							</p>
						{/if}
					</div>

					<!-- Lokasi Kegiatan -->
					{#if j.lokasiNama || j.gmapsUrl}
						<div class="flex items-center justify-between gap-2 text-xs text-foreground/60 pt-0.5">
							<div class="flex items-center gap-1.5 min-w-0">
								<MapPin class="w-3.5 h-3.5 text-primary shrink-0" />
								<span class="truncate">{j.lokasiNama || 'Lokasi Kegiatan'}</span>
							</div>
							{#if j.gmapsUrl || (j.latitude && j.longitude)}
								<a
									href={j.gmapsUrl || `https://www.google.com/maps?q=${j.latitude},${j.longitude}`}
									target="_blank"
									rel="noopener noreferrer"
									class="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline shrink-0"
								>
									<span>Buka Maps</span>
									<ExternalLink class="w-3 h-3" />
								</a>
							{/if}
						</div>
					{/if}

					<!-- Footer Kartu: Status Kehadiran Jamaah & Tombol Aksi Presensi -->
					<div class="pt-2.5 border-t border-border/60 flex items-center justify-between gap-2 flex-wrap">
						<!-- Status Kehadiran -->
						<div>
							{#if j.statusKehadiran === 'Hadir'}
								<span class="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
									<CheckCircle2 class="w-4 h-4" />
									<span>Sudah Hadir ({j.metodeKehadiran === 'offline' ? 'Offline' : 'Online'})</span>
								</span>
							{:else if j.statusKehadiran === 'Izin' || j.statusKehadiran === 'Sakit'}
								<span class="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
									<AlertCircle class="w-4 h-4" />
									<span>{j.statusKehadiran} ({j.statusApproval || 'Menunggu'})</span>
								</span>
							{:else if j.isHariIni}
								<span class="text-xs font-medium text-primary">
									Kegiatan Berlangsung Hari Ini
								</span>
							{:else if j.isSudahLewat}
								<span class="text-xs text-foreground/40 font-medium">
									Sudah Selesai (Tidak Terdata)
								</span>
							{:else}
								<span class="text-xs text-foreground/50 font-medium">
									Akan Datang
								</span>
							{/if}
						</div>

						<!-- Tombol Aksi Cepat Presensi jika hari ini -->
						{#if j.isHariIni && !j.statusKehadiran && j.status !== 'libur'}
							<a
								href={`/presensi?jadwalId=${j.id}`}
								class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition-all shadow-2xs active:scale-98"
							>
								<UserCheck class="w-3.5 h-3.5" />
								<span>Presensi Sekarang</span>
							</a>
						{/if}
					</div>
				</div>
			{/each}
		{/if}
	</div>
</div>

