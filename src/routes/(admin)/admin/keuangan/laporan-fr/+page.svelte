<!--
  @file src/routes/(admin)/admin/keuangan/laporan-fr/+page.svelte
  @purpose Halaman Laporan FR: menyajikan rekapitulasi real-time angka shodaqoh FR jamaah berjenjang (Desa, Kelompok, Daerah) dengan tombol langsung menuju detail input FR Jamaah
  @usedBy Route admin '/admin/keuangan/laporan-fr'
  @dependencies @lucide/svelte, Svelte 5 Runes, $lib/components/SearchableSelect.svelte
  @publicFunctions applyFilter, formatRupiah
  @sideEffects Navigasi antar periode atau tingkat wilayah via URL query parameter
-->
<script lang="ts">
	import {
		Building2,
		Calendar,
		ChevronRight,
		ExternalLink,
		FileSpreadsheet,
		Filter,
		HandCoins,
		Layers,
		MapPin,
		Search,
		TrendingUp,
		Users
	} from '@lucide/svelte';
	import type { PageData } from './$types';
	import SearchableSelect from '$lib/components/SearchableSelect.svelte';

	let { data } = $props<{ data: PageData }>();

	let selectedTahun = $state<number>(data.tahun);
	let selectedBulan = $state<number>(data.bulan);
	let selectedDaerah = $state<string | number>(data.filterDaerahId ?? '');
	let selectedDesa = $state<string | number>(data.filterDesaId ?? '');

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

	const desaOptions = $derived(
		(selectedDaerah
			? data.accessibleWilayah.desaList.filter((d: any) => String(d.daerahId) === String(selectedDaerah))
			: data.accessibleWilayah.desaList
		).map((d: any) => ({
			value: d.id,
			label: d.nama,
			sublabel: d.daerahNama
		}))
	);

	function applyFilter() {
		const params = new URLSearchParams();
		params.set('tahun', String(selectedTahun));
		params.set('bulan', String(selectedBulan));
		if (selectedDaerah) params.set('daerahId', String(selectedDaerah));
		if (selectedDesa) params.set('desaId', String(selectedDesa));
		window.location.href = `/admin/keuangan/laporan-fr?${params.toString()}`;
	}

	function formatRupiah(num: number): string {
		return new Intl.NumberFormat('id-ID', {
			style: 'currency',
			currency: 'IDR',
			maximumFractionDigits: 0
		}).format(num);
	}

	// Agregasi Ringkasan
	const totalAkumulasi = $derived(
		data.scopeLevel === 'Kelompok'
			? (data.bulananList || []).reduce((acc: number, b: any) => acc + b.totalNominal, 0)
			: (data.targetKelompokList || []).reduce((acc: number, k: any) => acc + k.totalNominal, 0)
	);
</script>

<div class="space-y-6 pb-20">
	<!-- HEADER HALAMAN -->
	<div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
		<div>
			<div class="flex items-center gap-2">
				<FileSpreadsheet class="w-6 h-6 text-primary" />
				<h1 class="text-xl md:text-2xl font-bold text-foreground">Laporan FR (Rekapitulasi Shodaqoh)</h1>
			</div>
			<p class="text-xs md:text-sm text-foreground/60 mt-1">
				Rekapitulasi setoran FR secara berjenjang dan real-time dari seluruh kelompok binaan.
			</p>
		</div>

		<!-- Tombol Cepat ke FR Jamaah -->
		<a
			href="/admin/keuangan/fr-jamaah"
			class="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-xs hover:bg-primary/90 transition-colors shadow-xs w-fit"
		>
			<HandCoins class="w-4 h-4" />
			<span>Kelola FR Jamaah</span>
		</a>
	</div>

	<!-- FILTER PERIODE & WILAYAH -->
	<div class="bg-card border border-border rounded-2xl p-4 md:p-5 shadow-xs space-y-4">
		<div class="flex items-center gap-2">
			<Filter class="w-4 h-4 text-primary" />
			<h2 class="text-sm font-bold text-foreground">Filter Periode & Wilayah Laporan</h2>
		</div>

		<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
			<!-- Pilihan Bulan -->
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

			<!-- Pilihan Tahun -->
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

			<!-- Pilihan Daerah (Bagi Admin Daerah / Pusat) -->
			{#if data.adminScope?.isPusat}
				<div>
					<label for="filterDaerah" class="block text-xs font-semibold text-foreground mb-1">
						Pilih Daerah
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

			<!-- Pilihan Desa (Bagi Admin Daerah / Pusat) -->
			{#if data.adminScope?.level === 'Daerah' || data.adminScope?.isPusat}
				<div>
					<label for="filterDesa" class="block text-xs font-semibold text-foreground mb-1">
						Pilih Desa
					</label>
					<SearchableSelect
						id="filterDesa"
						name="desa"
						options={desaOptions}
						bind:value={selectedDesa}
						placeholder="-- Pilih Desa Binaan --"
						onchange={applyFilter}
					/>
				</div>
			{/if}
		</div>
	</div>

	<!-- RINGKASAN METRIK TOTAL -->
	<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
		<div class="bg-card border border-border rounded-xl p-4 shadow-xs space-y-1">
			<span class="text-xs text-foreground/60 font-medium">Periode Aktif</span>
			<div class="text-lg font-bold text-foreground">
				{bulanNames[data.bulan - 1]} {data.tahun}
			</div>
		</div>

		<div class="bg-card border border-border rounded-xl p-4 shadow-xs space-y-1">
			<span class="text-xs text-foreground/60 font-medium">
				{data.scopeLevel === 'Kelompok' ? 'Total Setoran 1 Tahun' : 'Total Setoran Periode Ini'}
			</span>
			<div class="text-xl font-bold text-primary truncate">
				{formatRupiah(totalAkumulasi)}
			</div>
		</div>

		<div class="bg-card border border-border rounded-xl p-4 shadow-xs space-y-1">
			<span class="text-xs text-foreground/60 font-medium">Status Data</span>
			<div class="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-1">
				<span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
				<span>Terakumulasi Real-time</span>
			</div>
		</div>
	</div>

	<!-- KONTEN LAPORAN: 1. SCOPE KELOMPOK (RIWAYAT 12 BULAN) -->
	{#if data.scopeLevel === 'Kelompok'}
		<div class="bg-card border border-border rounded-2xl p-4 md:p-5 shadow-xs space-y-4">
			<div>
				<h3 class="font-bold text-base text-foreground">
					Riwayat Setoran FR Tahun {data.tahun} - Kelompok {data.kelompokInfo?.nama}
				</h3>
				<p class="text-xs text-foreground/50 mt-0.5">
					Total {data.bulananList?.[0]?.totalWajib ?? 0} jamaah wajib isrun terdaftar.
				</p>
			</div>

			<div class="border border-border rounded-xl overflow-x-auto shadow-xs">
				<table class="w-full text-left text-xs min-w-[600px]">
					<thead class="bg-secondary/60 text-foreground/70 uppercase text-[11px] tracking-wider border-b border-border">
						<tr>
							<th class="py-3 px-4 font-semibold">Bulan</th>
							<th class="py-3 px-4 font-semibold">Jamaah Wajib</th>
							<th class="py-3 px-4 font-semibold">Sudah Menyetor</th>
							<th class="py-3 px-4 font-semibold">Total Nominal (Rp)</th>
							<th class="py-3 px-4 font-semibold text-right">Aksi</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-border">
						{#each data.bulananList || [] as b}
							<tr class="hover:bg-secondary/30 transition-colors">
								<td class="py-3 px-4 font-bold text-foreground">
									{bulanNames[b.bulan - 1]}
								</td>
								<td class="py-3 px-4 text-foreground/70">
									{b.totalWajib} Jamaah
								</td>
								<td class="py-3 px-4">
									<span class="font-bold text-foreground">{b.setorCount}</span>
									<span class="text-foreground/50 text-[11px]">
										({b.totalWajib ? Math.round((b.setorCount / b.totalWajib) * 100) : 0}%)
									</span>
								</td>
								<td class="py-3 px-4 font-mono font-bold text-primary">
									{formatRupiah(b.totalNominal)}
								</td>
								<td class="py-3 px-4 text-right">
									<a
										href={`/admin/keuangan/fr-jamaah?kelompokId=${data.kelompokInfo?.id}&tahun=${data.tahun}&bulan=${b.bulan}`}
										class="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground font-semibold text-xs transition-colors"
									>
										<span>Buka FR Jamaah</span>
										<ChevronRight class="w-3.5 h-3.5" />
									</a>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>

	<!-- KONTEN LAPORAN: 2. SCOPE DESA (DAFTAR KELOMPOK BINAAN) -->
	{:else if data.filterDesaId && data.targetKelompokList}
		<div class="bg-card border border-border rounded-2xl p-4 md:p-5 shadow-xs space-y-4">
			<div>
				<h3 class="font-bold text-base text-foreground">
					Rekapitulasi Kelompok Binaan - Periode {bulanNames[data.bulan - 1]} {data.tahun}
				</h3>
				<p class="text-xs text-foreground/50 mt-0.5">
					Setiap kelompok yang diinput oleh admin KU kelompok akan otomatis tampil di sini secara real-time.
				</p>
			</div>

			<div class="border border-border rounded-xl overflow-x-auto shadow-xs">
				<table class="w-full text-left text-xs min-w-[650px]">
					<thead class="bg-secondary/60 text-foreground/70 uppercase text-[11px] tracking-wider border-b border-border">
						<tr>
							<th class="py-3 px-4 font-semibold">Nama Kelompok</th>
							<th class="py-3 px-4 font-semibold">Jamaah Wajib Isrun</th>
							<th class="py-3 px-4 font-semibold">Sudah Menyetor</th>
							<th class="py-3 px-4 font-semibold">Total Nominal (Rp)</th>
							<th class="py-3 px-4 font-semibold text-right">Aksi</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-border">
						{#each data.targetKelompokList as k}
							<tr class="hover:bg-secondary/30 transition-colors">
								<td class="py-3 px-4 font-bold text-foreground">
									{k.nama}
								</td>
								<td class="py-3 px-4 text-foreground/70">
									{k.totalWajib} Jamaah
								</td>
								<td class="py-3 px-4">
									<span class="font-bold text-foreground">{k.setorCount}</span>
									<span class="text-foreground/50 text-[11px]">
										({k.totalWajib ? Math.round((k.setorCount / k.totalWajib) * 100) : 0}%)
									</span>
								</td>
								<td class="py-3 px-4 font-mono font-bold text-primary">
									{formatRupiah(k.totalNominal)}
								</td>
								<td class="py-3 px-4 text-right">
									<a
										href={`/admin/keuangan/fr-jamaah?kelompokId=${k.id}&tahun=${data.tahun}&bulan=${data.bulan}`}
										class="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-semibold text-xs hover:bg-primary/90 transition-colors shadow-xs"
									>
										<span>Buka FR Jamaah</span>
										<ChevronRight class="w-3.5 h-3.5" />
									</a>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>

	<!-- KONTEN LAPORAN: 3. DAERAH / PUSAT (REKAP PER DESA) -->
	{:else if data.desaRekapList && data.desaRekapList.length > 0}
		<div class="bg-card border border-border rounded-2xl p-4 md:p-5 shadow-xs space-y-4">
			<div>
				<h3 class="font-bold text-base text-foreground">
					Rekapitulasi Desa - Periode {bulanNames[data.bulan - 1]} {data.tahun}
				</h3>
				<p class="text-xs text-foreground/50 mt-0.5">
					Pilih salah satu desa untuk melihat rincian kelompok dan membuka data FR jamaah.
				</p>
			</div>

			<div class="border border-border rounded-xl overflow-x-auto shadow-xs">
				<table class="w-full text-left text-xs min-w-[650px]">
					<thead class="bg-secondary/60 text-foreground/70 uppercase text-[11px] tracking-wider border-b border-border">
						<tr>
							<th class="py-3 px-4 font-semibold">Nama Desa</th>
							<th class="py-3 px-4 font-semibold">Daerah</th>
							<th class="py-3 px-4 font-semibold">Jumlah Kelompok</th>
							<th class="py-3 px-4 font-semibold">Total Setoran FR (Rp)</th>
							<th class="py-3 px-4 font-semibold text-right">Aksi</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-border">
						{#each data.desaRekapList as d}
							<tr class="hover:bg-secondary/30 transition-colors">
								<td class="py-3 px-4 font-bold text-foreground">
									{d.nama}
								</td>
								<td class="py-3 px-4 text-foreground/60">
									{d.daerahNama || '-'}
								</td>
								<td class="py-3 px-4 text-foreground/80 font-medium">
									{d.kelompokCount} Kelompok
								</td>
								<td class="py-3 px-4 font-mono font-bold text-primary">
									{formatRupiah(d.totalNominal)}
								</td>
								<td class="py-3 px-4 text-right">
									<a
										href={`/admin/keuangan/laporan-fr?desaId=${d.id}&tahun=${data.tahun}&bulan=${data.bulan}`}
										class="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground font-semibold text-xs transition-colors"
									>
										<span>Buka Desa</span>
										<ChevronRight class="w-3.5 h-3.5" />
									</a>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{/if}
</div>

