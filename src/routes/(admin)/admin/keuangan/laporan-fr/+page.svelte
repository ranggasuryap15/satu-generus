<!--
  @file src/routes/(admin)/admin/keuangan/laporan-fr/+page.svelte
  @purpose Halaman Laporan FR: menyajikan rekapitulasi real-time angka shodaqoh FR jamaah berjenjang (Desa, Kelompok, Daerah) dengan tombol ekspor CSV dan tautan langsung ke detail input FR Jamaah
  @usedBy Route admin '/admin/keuangan/laporan-fr'
  @dependencies @lucide/svelte, Svelte 5 Runes, #lib/components/SearchableSelect.svelte
  @publicFunctions applyFilter, formatRupiah, exportToCsv
  @sideEffects Navigasi antar periode via URL query parameter dan pengunduhan file CSV di browser client
-->
<script lang="ts">
	import {
		ArrowDown,
		ArrowUp,
		ArrowUpDown,
		Building2,
		Calendar,
		ChevronRight,
		Download,
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
	import SearchableSelect from '#lib/components/SearchableSelect.svelte';

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

	// State Sorting Tabel Kelompok
	type KelompokSortKey = 'nama' | 'totalWajib' | 'setorCount' | 'totalNominal';
	let kelompokSortKey = $state<KelompokSortKey>('nama');
	let kelompokSortDirection = $state<'asc' | 'desc'>('asc');

	function toggleKelompokSort(key: KelompokSortKey) {
		if (kelompokSortKey === key) {
			kelompokSortDirection = kelompokSortDirection === 'asc' ? 'desc' : 'asc';
		} else {
			kelompokSortKey = key;
			kelompokSortDirection = key === 'nama' ? 'asc' : 'desc';
		}
	}

	const sortedKelompokList = $derived.by(() => {
		const list = [...(data.targetKelompokList || [])];
		return list.sort((a, b) => {
			let cmp = 0;
			if (kelompokSortKey === 'nama') {
				cmp = a.nama.localeCompare(b.nama, undefined, { numeric: true, sensitivity: 'base' });
			} else if (kelompokSortKey === 'totalWajib') {
				cmp = a.totalWajib - b.totalWajib;
			} else if (kelompokSortKey === 'setorCount') {
				const pctA = a.totalWajib > 0 ? a.setorCount / a.totalWajib : 0;
				const pctB = b.totalWajib > 0 ? b.setorCount / b.totalWajib : 0;
				cmp = pctA === pctB ? a.setorCount - b.setorCount : pctA - pctB;
			} else if (kelompokSortKey === 'totalNominal') {
				cmp = a.totalNominal - b.totalNominal;
			}
			return kelompokSortDirection === 'asc' ? cmp : -cmp;
		});
	});

	// State Sorting Tabel Desa
	type DesaSortKey = 'nama' | 'daerahNama' | 'kelompokCount' | 'totalNominal';
	let desaSortKey = $state<DesaSortKey>('nama');
	let desaSortDirection = $state<'asc' | 'desc'>('asc');

	function toggleDesaSort(key: DesaSortKey) {
		if (desaSortKey === key) {
			desaSortDirection = desaSortDirection === 'asc' ? 'desc' : 'asc';
		} else {
			desaSortKey = key;
			desaSortDirection = key === 'nama' ? 'asc' : 'desc';
		}
	}

	const sortedDesaList = $derived.by(() => {
		const list = [...(data.desaRekapList || [])];
		return list.sort((a, b) => {
			let cmp = 0;
			if (desaSortKey === 'nama') {
				cmp = a.nama.localeCompare(b.nama, undefined, { numeric: true, sensitivity: 'base' });
			} else if (desaSortKey === 'daerahNama') {
				cmp = (a.daerahNama || '').localeCompare(b.daerahNama || '', undefined, {
					numeric: true,
					sensitivity: 'base'
				});
			} else if (desaSortKey === 'kelompokCount') {
				cmp = a.kelompokCount - b.kelompokCount;
			} else if (desaSortKey === 'totalNominal') {
				cmp = a.totalNominal - b.totalNominal;
			}
			return desaSortDirection === 'asc' ? cmp : -cmp;
		});
	});

	// State Sorting Tabel Bulanan (Scope Kelompok)
	type BulananSortKey = 'bulan' | 'totalWajib' | 'setorCount' | 'totalNominal';
	let bulananSortKey = $state<BulananSortKey>('bulan');
	let bulananSortDirection = $state<'asc' | 'desc'>('asc');

	function toggleBulananSort(key: BulananSortKey) {
		if (bulananSortKey === key) {
			bulananSortDirection = bulananSortDirection === 'asc' ? 'desc' : 'asc';
		} else {
			bulananSortKey = key;
			bulananSortDirection = key === 'bulan' ? 'asc' : 'desc';
		}
	}

	const sortedBulananList = $derived.by(() => {
		const list = [...(data.bulananList || [])];
		return list.sort((a, b) => {
			let cmp = 0;
			if (bulananSortKey === 'bulan') {
				cmp = a.bulan - b.bulan;
			} else if (bulananSortKey === 'totalWajib') {
				cmp = a.totalWajib - b.totalWajib;
			} else if (bulananSortKey === 'setorCount') {
				const pctA = a.totalWajib > 0 ? a.setorCount / a.totalWajib : 0;
				const pctB = b.totalWajib > 0 ? b.setorCount / b.totalWajib : 0;
				cmp = pctA === pctB ? a.setorCount - b.setorCount : pctA - pctB;
			} else if (bulananSortKey === 'totalNominal') {
				cmp = a.totalNominal - b.totalNominal;
			}
			return bulananSortDirection === 'asc' ? cmp : -cmp;
		});
	});

	function exportToCsv() {
		let rows: string[][] = [];
		const namaBulan = bulanNames[selectedBulan - 1] || `Bulan ${selectedBulan}`;

		if (data.scopeLevel === 'Kelompok') {
			rows.push(['No', 'Bulan', 'Tahun', 'Target Jamaah Wajib', 'Sudah Menyetor', 'Total Nominal (Rp)']);
			sortedBulananList.forEach((b: any, idx: number) => {
				rows.push([
					String(idx + 1),
					bulanNames[b.bulan - 1] || `Bulan ${b.bulan}`,
					String(data.tahun),
					String(b.totalWajib || 0),
					String(b.setorCount || 0),
					String(b.totalNominal || 0)
				]);
			});
		} else {
			rows.push(['No', 'Kelompok', 'Desa', 'Daerah', 'Periode', 'Target Jamaah', 'Sudah Menyetor', 'Persentase', 'Total Nominal (Rp)']);
			sortedKelompokList.forEach((k: any, idx: number) => {
				const count = k.setorCount ?? k.totalLunas ?? 0;
				const pct = k.totalWajib > 0 ? Math.round((count / k.totalWajib) * 100) : 0;
				rows.push([
					String(idx + 1),
					`"${(k.nama || '').replace(/"/g, '""')}"`,
					`"${(k.desaNama || '').replace(/"/g, '""')}"`,
					`"${(k.daerahNama || '').replace(/"/g, '""')}"`,
					`"${namaBulan} ${data.tahun}"`,
					String(k.totalWajib || 0),
					String(count),
					`${pct}%`,
					String(k.totalNominal || 0)
				]);
			});
		}

		const csvContent = '\uFEFF' + rows.map((r) => r.join(',')).join('\r\n');
		const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.setAttribute('download', `Laporan-FR-${data.scopeLevel}-${namaBulan}-${data.tahun}.csv`);
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(url);
	}
</script>

<div class="space-y-6 pb-20">
	<!-- HEADER HALAMAN -->
	<div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
		<div>
			<div class="flex items-center gap-2">
				<FileSpreadsheet class="w-6 h-6 text-primary" />
				<h1 class="text-xl md:text-2xl font-bold text-foreground">Laporan FR (Rekapitulasi Shodaqoh)</h1>
			</div>
		</div>

		<!-- Tombol Aksi Header -->
		<div class="flex items-center gap-2 flex-wrap">
			<button
				type="button"
				onclick={exportToCsv}
				class="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-border bg-card hover:bg-secondary/80 text-foreground font-semibold text-xs transition-colors shadow-xs"
				title="Unduh rekap dalam format CSV / Excel"
			>
				<Download class="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
				<span>Ekspor CSV</span>
			</button>

			<a
				href="/admin/keuangan/fr-jamaah"
				class="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-xs hover:bg-primary/90 transition-colors shadow-xs"
			>
				<HandCoins class="w-4 h-4" />
				<span>Kelola FR Jamaah</span>
			</a>
		</div>
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
					Total {data.bulananList?.[0]?.totalWajib ?? 0} jamaah wajib isrun terdaftar. Klik judul kolom untuk mengurutkan data.
				</p>
			</div>

			<div class="border border-border rounded-xl overflow-x-auto shadow-xs">
				<table class="w-full text-left text-xs min-w-[600px]">
					<thead class="bg-secondary/60 text-foreground/70 uppercase text-[11px] tracking-wider border-b border-border select-none">
						<tr>
							<th
								class="py-3 px-4 font-semibold cursor-pointer hover:bg-secondary/80 transition-colors group"
								onclick={() => toggleBulananSort('bulan')}
								title="Urutkan berdasarkan Bulan"
							>
								<div class="flex items-center gap-1.5">
									<span>Bulan</span>
									{#if bulananSortKey === 'bulan'}
										{#if bulananSortDirection === 'asc'}
											<ArrowUp class="w-3.5 h-3.5 text-primary shrink-0" />
										{:else}
											<ArrowDown class="w-3.5 h-3.5 text-primary shrink-0" />
										{/if}
									{:else}
										<ArrowUpDown class="w-3 h-3 text-muted-foreground/30 group-hover:text-foreground/60 shrink-0 transition-colors" />
									{/if}
								</div>
							</th>
							<th
								class="py-3 px-4 font-semibold cursor-pointer hover:bg-secondary/80 transition-colors group"
								onclick={() => toggleBulananSort('totalWajib')}
								title="Urutkan berdasarkan Jumlah Jamaah Wajib"
							>
								<div class="flex items-center gap-1.5">
									<span>Jamaah Wajib</span>
									{#if bulananSortKey === 'totalWajib'}
										{#if bulananSortDirection === 'asc'}
											<ArrowUp class="w-3.5 h-3.5 text-primary shrink-0" />
										{:else}
											<ArrowDown class="w-3.5 h-3.5 text-primary shrink-0" />
										{/if}
									{:else}
										<ArrowUpDown class="w-3 h-3 text-muted-foreground/30 group-hover:text-foreground/60 shrink-0 transition-colors" />
									{/if}
								</div>
							</th>
							<th
								class="py-3 px-4 font-semibold cursor-pointer hover:bg-secondary/80 transition-colors group"
								onclick={() => toggleBulananSort('setorCount')}
								title="Urutkan berdasarkan Jumlah Sudah Menyetor"
							>
								<div class="flex items-center gap-1.5">
									<span>Sudah Menyetor</span>
									{#if bulananSortKey === 'setorCount'}
										{#if bulananSortDirection === 'asc'}
											<ArrowUp class="w-3.5 h-3.5 text-primary shrink-0" />
										{:else}
											<ArrowDown class="w-3.5 h-3.5 text-primary shrink-0" />
										{/if}
									{:else}
										<ArrowUpDown class="w-3 h-3 text-muted-foreground/30 group-hover:text-foreground/60 shrink-0 transition-colors" />
									{/if}
								</div>
							</th>
							<th
								class="py-3 px-4 font-semibold cursor-pointer hover:bg-secondary/80 transition-colors group"
								onclick={() => toggleBulananSort('totalNominal')}
								title="Urutkan berdasarkan Total Nominal"
							>
								<div class="flex items-center gap-1.5">
									<span>Total Nominal (Rp)</span>
									{#if bulananSortKey === 'totalNominal'}
										{#if bulananSortDirection === 'asc'}
											<ArrowUp class="w-3.5 h-3.5 text-primary shrink-0" />
										{:else}
											<ArrowDown class="w-3.5 h-3.5 text-primary shrink-0" />
										{/if}
									{:else}
										<ArrowUpDown class="w-3 h-3 text-muted-foreground/30 group-hover:text-foreground/60 shrink-0 transition-colors" />
									{/if}
								</div>
							</th>
							<th class="py-3 px-4 font-semibold text-right">Aksi</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-border">
						{#each sortedBulananList as b}
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
					Setiap kelompok yang diinput oleh admin KU kelompok akan otomatis tampil di sini secara real-time. Klik judul kolom untuk mengurutkan data (ASC / DESC).
				</p>
			</div>

			<div class="border border-border rounded-xl overflow-x-auto shadow-xs">
				<table class="w-full text-left text-xs min-w-[650px]">
					<thead class="bg-secondary/60 text-foreground/70 uppercase text-[11px] tracking-wider border-b border-border select-none">
						<tr>
							<th
								class="py-3 px-4 font-semibold cursor-pointer hover:bg-secondary/80 transition-colors group"
								onclick={() => toggleKelompokSort('nama')}
								title="Urutkan berdasarkan Nama Kelompok (A-Z / Z-A)"
							>
								<div class="flex items-center gap-1.5">
									<span>Nama Kelompok</span>
									{#if kelompokSortKey === 'nama'}
										{#if kelompokSortDirection === 'asc'}
											<ArrowUp class="w-3.5 h-3.5 text-primary shrink-0" />
										{:else}
											<ArrowDown class="w-3.5 h-3.5 text-primary shrink-0" />
										{/if}
									{:else}
										<ArrowUpDown class="w-3 h-3 text-muted-foreground/30 group-hover:text-foreground/60 shrink-0 transition-colors" />
									{/if}
								</div>
							</th>
							<th
								class="py-3 px-4 font-semibold cursor-pointer hover:bg-secondary/80 transition-colors group"
								onclick={() => toggleKelompokSort('totalWajib')}
								title="Urutkan berdasarkan Target Jamaah Wajib Isrun"
							>
								<div class="flex items-center gap-1.5">
									<span>Jamaah Wajib Isrun</span>
									{#if kelompokSortKey === 'totalWajib'}
										{#if kelompokSortDirection === 'asc'}
											<ArrowUp class="w-3.5 h-3.5 text-primary shrink-0" />
										{:else}
											<ArrowDown class="w-3.5 h-3.5 text-primary shrink-0" />
										{/if}
									{:else}
										<ArrowUpDown class="w-3 h-3 text-muted-foreground/30 group-hover:text-foreground/60 shrink-0 transition-colors" />
									{/if}
								</div>
							</th>
							<th
								class="py-3 px-4 font-semibold cursor-pointer hover:bg-secondary/80 transition-colors group"
								onclick={() => toggleKelompokSort('setorCount')}
								title="Urutkan berdasarkan Persentase / Jumlah yang Sudah Menyetor"
							>
								<div class="flex items-center gap-1.5">
									<span>Sudah Menyetor</span>
									{#if kelompokSortKey === 'setorCount'}
										{#if kelompokSortDirection === 'asc'}
											<ArrowUp class="w-3.5 h-3.5 text-primary shrink-0" />
										{:else}
											<ArrowDown class="w-3.5 h-3.5 text-primary shrink-0" />
										{/if}
									{:else}
										<ArrowUpDown class="w-3 h-3 text-muted-foreground/30 group-hover:text-foreground/60 shrink-0 transition-colors" />
									{/if}
								</div>
							</th>
							<th
								class="py-3 px-4 font-semibold cursor-pointer hover:bg-secondary/80 transition-colors group"
								onclick={() => toggleKelompokSort('totalNominal')}
								title="Urutkan berdasarkan Total Nominal Infaq FR"
							>
								<div class="flex items-center gap-1.5">
									<span>Total Nominal (Rp)</span>
									{#if kelompokSortKey === 'totalNominal'}
										{#if kelompokSortDirection === 'asc'}
											<ArrowUp class="w-3.5 h-3.5 text-primary shrink-0" />
										{:else}
											<ArrowDown class="w-3.5 h-3.5 text-primary shrink-0" />
										{/if}
									{:else}
										<ArrowUpDown class="w-3 h-3 text-muted-foreground/30 group-hover:text-foreground/60 shrink-0 transition-colors" />
									{/if}
								</div>
							</th>
							<th class="py-3 px-4 font-semibold text-right">Aksi</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-border">
						{#each sortedKelompokList as k}
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
					Pilih salah satu desa untuk melihat rincian kelompok dan membuka data FR jamaah. Klik judul kolom untuk mengurutkan data.
				</p>
			</div>

			<div class="border border-border rounded-xl overflow-x-auto shadow-xs">
				<table class="w-full text-left text-xs min-w-[650px]">
					<thead class="bg-secondary/60 text-foreground/70 uppercase text-[11px] tracking-wider border-b border-border select-none">
						<tr>
							<th
								class="py-3 px-4 font-semibold cursor-pointer hover:bg-secondary/80 transition-colors group"
								onclick={() => toggleDesaSort('nama')}
								title="Urutkan berdasarkan Nama Desa"
							>
								<div class="flex items-center gap-1.5">
									<span>Nama Desa</span>
									{#if desaSortKey === 'nama'}
										{#if desaSortDirection === 'asc'}
											<ArrowUp class="w-3.5 h-3.5 text-primary shrink-0" />
										{:else}
											<ArrowDown class="w-3.5 h-3.5 text-primary shrink-0" />
										{/if}
									{:else}
										<ArrowUpDown class="w-3 h-3 text-muted-foreground/30 group-hover:text-foreground/60 shrink-0 transition-colors" />
									{/if}
								</div>
							</th>
							<th
								class="py-3 px-4 font-semibold cursor-pointer hover:bg-secondary/80 transition-colors group"
								onclick={() => toggleDesaSort('daerahNama')}
								title="Urutkan berdasarkan Nama Daerah"
							>
								<div class="flex items-center gap-1.5">
									<span>Daerah</span>
									{#if desaSortKey === 'daerahNama'}
										{#if desaSortDirection === 'asc'}
											<ArrowUp class="w-3.5 h-3.5 text-primary shrink-0" />
										{:else}
											<ArrowDown class="w-3.5 h-3.5 text-primary shrink-0" />
										{/if}
									{:else}
										<ArrowUpDown class="w-3 h-3 text-muted-foreground/30 group-hover:text-foreground/60 shrink-0 transition-colors" />
									{/if}
								</div>
							</th>
							<th
								class="py-3 px-4 font-semibold cursor-pointer hover:bg-secondary/80 transition-colors group"
								onclick={() => toggleDesaSort('kelompokCount')}
								title="Urutkan berdasarkan Jumlah Kelompok"
							>
								<div class="flex items-center gap-1.5">
									<span>Jumlah Kelompok</span>
									{#if desaSortKey === 'kelompokCount'}
										{#if desaSortDirection === 'asc'}
											<ArrowUp class="w-3.5 h-3.5 text-primary shrink-0" />
										{:else}
											<ArrowDown class="w-3.5 h-3.5 text-primary shrink-0" />
										{/if}
									{:else}
										<ArrowUpDown class="w-3 h-3 text-muted-foreground/30 group-hover:text-foreground/60 shrink-0 transition-colors" />
									{/if}
								</div>
							</th>
							<th
								class="py-3 px-4 font-semibold cursor-pointer hover:bg-secondary/80 transition-colors group"
								onclick={() => toggleDesaSort('totalNominal')}
								title="Urutkan berdasarkan Total Setoran FR"
							>
								<div class="flex items-center gap-1.5">
									<span>Total Setoran FR (Rp)</span>
									{#if desaSortKey === 'totalNominal'}
										{#if desaSortDirection === 'asc'}
											<ArrowUp class="w-3.5 h-3.5 text-primary shrink-0" />
										{:else}
											<ArrowDown class="w-3.5 h-3.5 text-primary shrink-0" />
										{/if}
									{:else}
										<ArrowUpDown class="w-3 h-3 text-muted-foreground/30 group-hover:text-foreground/60 shrink-0 transition-colors" />
									{/if}
								</div>
							</th>
							<th class="py-3 px-4 font-semibold text-right">Aksi</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-border">
						{#each sortedDesaList as d}
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

