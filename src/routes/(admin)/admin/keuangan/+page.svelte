<!--
  @file src/routes/(admin)/admin/keuangan/+page.svelte
  @purpose Halaman Dashboard Keuangan: menyajikan metrik KPI keuangan, grafik fluktuasi bulanan 12 bulan, dan diagram perbandingan setoran shodaqoh antar kelompok binaan sesuai scope wewenang admin (Kyai, KU, Aghnia)
  @usedBy Route admin '/admin/keuangan'
  @dependencies @lucide/svelte, Svelte 5 Runes, $lib/components/SearchableSelect.svelte
  @publicFunctions applyFilter, formatRupiah
  @sideEffects Mengubah query URL saat filter tahun, bulan, atau wilayah diganti
-->
<script lang="ts">
	import {
		Building2,
		Calendar,
		ChevronRight,
		CreditCard,
		FileSpreadsheet,
		Filter,
		HandCoins,
		Layers,
		TrendingUp,
		Users,
		Wallet,
		ArrowUpRight,
		Percent
	} from '@lucide/svelte';
	import type { PageData } from './$types';
	import SearchableSelect from '$lib/components/SearchableSelect.svelte';

	let { data } = $props<{ data: PageData }>();

	let selectedTahun = $state<number>(data.tahun);
	let selectedBulan = $state<number>(data.bulan);
	let selectedDaerah = $state<string | number>(data.filterDaerahId ?? '');
	let selectedDesa = $state<string | number>(data.filterDesaId ?? '');
	let selectedKelompok = $state<string | number>(data.filterKelompokId ?? '');

	const bulanNames = [
		'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
		'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
	];
	const bulanOptions = bulanNames.map((nama, idx) => ({
		value: idx + 1,
		label: nama
	}));

	const currentYear = new Date().getFullYear();
	const tahunOptions = [
		currentYear - 2,
		currentYear - 1,
		currentYear,
		currentYear + 1
	].map((y) => ({ value: y, label: String(y) }));

	const daerahOptions = $derived(
		(data.accessibleWilayah.daerahList || []).map((dr: any) => ({
			value: dr.id,
			label: dr.nama
		}))
	);

	const availableDesaList = $derived(
		selectedDaerah
			? data.accessibleWilayah.desaList.filter((d: any) => String(d.daerahId) === String(selectedDaerah))
			: data.accessibleWilayah.desaList
	);

	const desaOptions = $derived(
		availableDesaList.map((d: any) => ({
			value: d.id,
			label: d.nama,
			sublabel: d.daerahNama
		}))
	);

	const availableKelompokList = $derived(
		selectedDesa
			? data.accessibleWilayah.kelompokList.filter((k: any) => String(k.desaId) === String(selectedDesa))
			: data.accessibleWilayah.kelompokList
	);

	const kelompokOptions = $derived(
		availableKelompokList.map((k: any) => ({
			value: k.id,
			label: k.nama,
			sublabel: k.desaNama ? `Desa ${k.desaNama}` : undefined
		}))
	);

	function applyFilter() {
		const params = new URLSearchParams();
		params.set('tahun', String(selectedTahun));
		params.set('bulan', String(selectedBulan));
		if (selectedDaerah) params.set('daerahId', String(selectedDaerah));
		if (selectedDesa) params.set('desaId', String(selectedDesa));
		if (selectedKelompok) params.set('kelompokId', String(selectedKelompok));
		window.location.href = `/admin/keuangan?${params.toString()}`;
	}

	function formatRupiah(num: number): string {
		return new Intl.NumberFormat('id-ID', {
			style: 'currency',
			currency: 'IDR',
			maximumFractionDigits: 0
		}).format(num);
	}

	// Perhitungan Skala Grafik Tren Bulanan
	const maxTrenVal = $derived(
		Math.max(...(data.trenBulanan || []).map((t: any) => t.total), 1)
	);

	// Perhitungan Skala Grafik Komparasi
	const maxKompVal = $derived(
		Math.max(...(data.komparasiKelompok || []).map((k: any) => k.totalNominal), 1)
	);
</script>

<div class="space-y-6 pb-20">
	<!-- HEADER HALAMAN -->
	<div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
		<div>
			<div class="flex items-center gap-2">
				<TrendingUp class="w-6 h-6 text-primary" />
				<h1 class="text-xl md:text-2xl font-bold text-foreground">Dashboard Keuangan & FR</h1>
			</div>
			<p class="text-xs md:text-sm text-foreground/60 mt-1">
				Ikhtisar pergerakan shodaqoh FR, tren bulanan, dan evaluasi capaian partisipasi jamaah.
			</p>
		</div>

		<!-- Tombol Aksi Navigasi Cepat -->
		<div class="flex items-center gap-2">
			<a
				href="/admin/keuangan/laporan-fr"
				class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground font-semibold text-xs transition-colors shadow-xs"
			>
				<FileSpreadsheet class="w-4 h-4 text-primary" />
				<span>Laporan FR</span>
			</a>
			<a
				href="/admin/keuangan/fr-jamaah"
				class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-xs transition-colors shadow-xs"
			>
				<HandCoins class="w-4 h-4" />
				<span>Input FR Jamaah</span>
			</a>
		</div>
	</div>

	<!-- FILTER PERIODE & WILAYAH -->
	<div class="bg-card border border-border rounded-2xl p-4 md:p-5 shadow-xs space-y-4">
		<div class="flex items-center gap-2">
			<Filter class="w-4 h-4 text-primary" />
			<h2 class="text-sm font-bold text-foreground">Filter Wilayah & Periode Analitik</h2>
		</div>

		<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
			<div>
				<label for="filterBulan" class="block text-xs font-semibold text-foreground mb-1">
					Bulan
				</label>
				<select
					id="filterBulan"
					bind:value={selectedBulan}
					onchange={applyFilter}
					class="w-full bg-secondary/50 border border-border rounded-xl px-3.5 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
				>
					{#each bulanOptions as b}
						<option value={b.value}>{b.label}</option>
					{/each}
				</select>
			</div>

			<div>
				<label for="filterTahun" class="block text-xs font-semibold text-foreground mb-1">
					Tahun
				</label>
				<select
					id="filterTahun"
					bind:value={selectedTahun}
					onchange={applyFilter}
					class="w-full bg-secondary/50 border border-border rounded-xl px-3.5 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
				>
					{#each tahunOptions as t}
						<option value={t.value}>{t.label}</option>
					{/each}
				</select>
			</div>

			{#if data.adminScope.isPusat}
				<div>
					<label for="filterDaerah" class="block text-xs font-semibold text-foreground mb-1">
						Daerah
					</label>
					<SearchableSelect
						id="filterDaerah"
						name="daerah"
						options={daerahOptions}
						bind:value={selectedDaerah}
						placeholder="-- Semua Daerah --"
						onchange={applyFilter}
					/>
				</div>
			{/if}

			{#if data.adminScope.level === 'Daerah' || data.adminScope.isPusat}
				<div>
					<label for="filterDesa" class="block text-xs font-semibold text-foreground mb-1">
						Desa
					</label>
					<SearchableSelect
						id="filterDesa"
						name="desa"
						options={desaOptions}
						bind:value={selectedDesa}
						placeholder="-- Semua Desa --"
						onchange={applyFilter}
					/>
				</div>
			{/if}

			<div>
				<label for="filterKelompok" class="block text-xs font-semibold text-foreground mb-1">
					Kelompok
				</label>
				<SearchableSelect
					id="filterKelompok"
					name="kelompok"
					options={kelompokOptions}
					bind:value={selectedKelompok}
					placeholder="-- Semua Kelompok --"
					onchange={applyFilter}
				/>
			</div>
		</div>
	</div>

	<!-- 1. KPI CARDS METRIK KEUANGAN -->
	<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
		<!-- Total Bulan Ini -->
		<div class="bg-card border border-border rounded-2xl p-4 md:p-5 shadow-xs space-y-2">
			<div class="flex items-center justify-between">
				<span class="text-xs text-foreground/60 font-medium">Total Bulan Ini</span>
				<div class="p-2 rounded-xl bg-primary/10 text-primary">
					<Wallet class="w-4 h-4" />
				</div>
			</div>
			<div class="text-xl md:text-2xl font-bold text-foreground truncate">
				{formatRupiah(data.kpi.totalBulanIni)}
			</div>
			<p class="text-[11px] text-foreground/50">
				Periode {bulanNames[data.bulan - 1]} {data.tahun}
			</p>
		</div>

		<!-- Total Tahun Ini -->
		<div class="bg-card border border-border rounded-2xl p-4 md:p-5 shadow-xs space-y-2">
			<div class="flex items-center justify-between">
				<span class="text-xs text-foreground/60 font-medium">Akumulasi Tahun {data.tahun}</span>
				<div class="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
					<TrendingUp class="w-4 h-4" />
				</div>
			</div>
			<div class="text-xl md:text-2xl font-bold text-emerald-600 dark:text-emerald-400 truncate">
				{formatRupiah(data.kpi.totalTahunIni)}
			</div>
			<p class="text-[11px] text-foreground/50">
				Akumulasi 12 bulan berjalan
			</p>
		</div>

		<!-- Partisipasi Jamaah -->
		<div class="bg-card border border-border rounded-2xl p-4 md:p-5 shadow-xs space-y-2">
			<div class="flex items-center justify-between">
				<span class="text-xs text-foreground/60 font-medium">Partisipasi Setor FR</span>
				<div class="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
					<Percent class="w-4 h-4" />
				</div>
			</div>
			<div class="text-xl md:text-2xl font-bold text-foreground">
				{data.kpi.partisipasiPersen}%
			</div>
			<p class="text-[11px] text-foreground/50">
				{data.kpi.totalSudahSetorBulanIni} dari {data.kpi.totalWajibIsrun} jamaah wajib
			</p>
		</div>

		<!-- Total Wajib Isrun -->
		<div class="bg-card border border-border rounded-2xl p-4 md:p-5 shadow-xs space-y-2">
			<div class="flex items-center justify-between">
				<span class="text-xs text-foreground/60 font-medium">Total Wajib Isrun</span>
				<div class="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
					<Users class="w-4 h-4" />
				</div>
			</div>
			<div class="text-xl md:text-2xl font-bold text-foreground">
				{data.kpi.totalWajibIsrun}
			</div>
			<p class="text-[11px] text-foreground/50">
				Berdasarkan status sensus aktif
			</p>
		</div>
	</div>

	<!-- 2. GRAFIK TREN BULANAN 12 BULAN (NAIK-TURUN) -->
	<div class="bg-card border border-border rounded-2xl p-4 md:p-5 shadow-xs space-y-4">
		<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
			<div>
				<h3 class="font-bold text-base text-foreground">
					Grafik Tren Setoran FR Sepanjang Tahun {data.tahun}
				</h3>
				<p class="text-xs text-foreground/50 mt-0.5">
					Fluktuasi naik-turun angka total penerimaan shodaqoh FR dari bulan Januari hingga Desember.
				</p>
			</div>
			<span class="text-xs font-mono font-bold text-primary self-start sm:self-auto">
				Puncak: {formatRupiah(maxTrenVal)}
			</span>
		</div>

		<!-- Visualisasi Diagram Batang & Garis Responsif -->
		<div class="h-64 w-full pt-6 flex items-end gap-1.5 sm:gap-3 border-b border-border/80 pb-2">
			{#each data.trenBulanan || [] as item}
				{@const heightPercent = maxTrenVal > 0 ? Math.round((item.total / maxTrenVal) * 100) : 0}
				{@const isCurrentMonth = item.bulan === data.bulan}
				<div class="flex-1 flex flex-col items-center gap-2 h-full justify-end group relative">
					<!-- Tooltip Hover -->
					<div class="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-10 bg-card border border-border px-2 py-1 rounded-lg shadow-lg text-[10px] font-mono whitespace-nowrap pointer-events-none z-10 text-foreground">
						<span class="font-bold">{item.nama}:</span> {formatRupiah(item.total)}
					</div>

					<!-- Bar -->
					<div
						class="w-full rounded-t-lg transition-all duration-300 {isCurrentMonth ? 'bg-primary' : 'bg-primary/30 group-hover:bg-primary/60'}"
						style={`height: ${Math.max(heightPercent, 4)}%`}
					></div>

					<!-- Label Bulan -->
					<span class="text-[10px] sm:text-xs font-medium {isCurrentMonth ? 'font-bold text-primary' : 'text-foreground/50'}">
						{item.nama}
					</span>
				</div>
			{/each}
		</div>
	</div>

	<!-- 3. GRAFIK KOMPARASI ANTAR KELOMPOK (JIKA LEBIH DARI 1 KELOMPOK) -->
	{#if data.komparasiKelompok && data.komparasiKelompok.length > 1}
		<div class="bg-card border border-border rounded-2xl p-4 md:p-5 shadow-xs space-y-4">
			<div>
				<h3 class="font-bold text-base text-foreground">
					Grafik Perbandingan Setoran Antar Kelompok ({bulanNames[data.bulan - 1]} {data.tahun})
				</h3>
				<p class="text-xs text-foreground/50 mt-0.5">
					Peringkat perolehan nominal shodaqoh FR antar kelompok binaan dalam periode aktif.
				</p>
			</div>

			<div class="space-y-3 pt-2">
				{#each data.komparasiKelompok as k, idx}
					{@const widthPercent = maxKompVal > 0 ? Math.round((k.totalNominal / maxKompVal) * 100) : 0}
					<div class="space-y-1">
						<div class="flex items-center justify-between text-xs">
							<div class="flex items-center gap-1.5 font-semibold text-foreground">
								<span class="text-foreground/40 font-mono w-4">{idx + 1}.</span>
								<span>{k.nama}</span>
								{#if k.desaNama}
									<span class="text-[11px] text-foreground/50 font-normal">({k.desaNama})</span>
								{/if}
							</div>
							<span class="font-mono font-bold text-primary">
								{formatRupiah(k.totalNominal)}
							</span>
						</div>

						<!-- Bar Horizontal -->
						<div class="h-2.5 w-full bg-secondary/70 rounded-full overflow-hidden">
							<div
								class="h-full bg-primary rounded-full transition-all duration-300"
								style={`width: ${widthPercent}%`}
							></div>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>

