<!--
  @file src/routes/(admin)/admin/keuangan/fr-jamaah/+page.svelte
  @purpose Halaman FR Jamaah: daftar kartu simetris mobile dengan visibilitas nama & nominal angka yang jelas + tabel desktop data jamaah wajib isrun dengan inline editing nominal shodaqoh (numeric keypad only), ekspor data CSV/Excel, dan sticky floating save bar di atas bottom navbar mobile (z-50 bottom-20), diproteksi khusus KU (read-only bagi Kyai & Aghnia)
  @usedBy Route admin '/admin/keuangan/fr-jamaah'
  @dependencies @lucide/svelte, Svelte 5 Runes, $lib/components/SearchableSelect.svelte, $app/forms (enhance), $lib/keepScroll.ts (keepScrollSubmit)
  @publicFunctions handleNominalChange, handleCatatanChange, resetChanges, submitSave, exportToCsv
  @sideEffects Mengirim form batch upsert transaksi FR via action ?/saveFr dengan menjaga scroll; ekspor CSV langsung di browser client; input nominal membuka dial pad murni angka (inputmode=numeric, pattern=[0-9]*)
-->
<script lang="ts">
	import {
		Building2,
		Calendar,
		Check,
		ChevronDown,
		Download,
		Filter,
		HandCoins,
		Lock,
		RotateCcw,
		Save,
		Search,
		ShieldCheck,
		Users,
		AlertCircle
	} from '@lucide/svelte';
	import type { PageData, ActionData } from './$types';
	import SearchableSelect from '$lib/components/SearchableSelect.svelte';
	import { enhance } from '$app/forms';
	import { keepScrollSubmit } from '$lib/keepScroll';

	let { data, form } = $props<{ data: PageData; form: ActionData }>();

	// State Filter
	let selectedKelompok = $state<string | number>(data.selectedKelompokId ?? '');
	let selectedTahun = $state<number>(data.tahun);
	let selectedBulan = $state<number>(data.bulan);
	let searchQuery = $state('');
	let isFilterOpen = $state(false);

	$effect(() => {
		selectedKelompok = data.selectedKelompokId ?? '';
		selectedTahun = data.tahun;
		selectedBulan = data.bulan;
	});

	// Tracking Perubahan Data (Inline Edit)
	let editedValues = $state<Record<string, { nominal: number; catatan: string }>>({});
	let isSaving = $state(false);

	// Opsi Bulan & Tahun
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

	// Opsi Kelompok (SearchableSelect)
	const kelompokOptions = $derived(
		(data.accessibleWilayah.kelompokList || []).map((k: any) => ({
			value: k.id,
			label: k.nama,
			sublabel: k.desaNama ? `Desa ${k.desaNama}` : undefined
		}))
	);

	function applyFilter() {
		if (!selectedKelompok) {
			window.location.href = `/admin/keuangan/fr-jamaah?tahun=${selectedTahun}&bulan=${selectedBulan}`;
			return;
		}
		window.location.href = `/admin/keuangan/fr-jamaah?kelompokId=${selectedKelompok}&tahun=${selectedTahun}&bulan=${selectedBulan}`;
	}

	type JamaahItem = {
		id: string;
		namaLengkap: string;
		jenisKelamin: string;
		statusGenerus: string | null;
		statusHubungan: string;
		profesi: string | null;
		noTelepon: string | null;
		keluargaId: string;
		kepalaKeluargaNama: string | null;
		transaksiId: string | null;
		nominal: number;
		statusBayar: string;
		catatan: string;
		updatedAt: number | null;
	};

	function handleNominalInput(anggotaId: string, valueStr: string) {
		const rawDigits = valueStr.replace(/\D/g, '');
		const num = rawDigits ? parseInt(rawDigits, 10) : 0;
		const curCatatan = editedValues[anggotaId]?.catatan ?? (data.jamaahList.find((j: JamaahItem) => j.id === anggotaId)?.catatan || '');
		editedValues = {
			...editedValues,
			[anggotaId]: {
				nominal: num,
				catatan: curCatatan
			}
		};
	}

	function handleCatatanInput(anggotaId: string, val: string) {
		const curNominal = editedValues[anggotaId]?.nominal ?? (data.jamaahList.find((j: JamaahItem) => j.id === anggotaId)?.nominal || 0);
		editedValues = {
			...editedValues,
			[anggotaId]: {
				nominal: curNominal,
				catatan: val
			}
		};
	}

	function getEffectiveNominal(j: JamaahItem): number {
		return editedValues[j.id]?.nominal !== undefined ? editedValues[j.id].nominal : j.nominal;
	}

	function getEffectiveCatatan(j: JamaahItem): string {
		return editedValues[j.id]?.catatan !== undefined ? editedValues[j.id].catatan : j.catatan;
	}

	const dirtyCount = $derived(
		Object.keys(editedValues).filter((id) => {
			const original = data.jamaahList.find((j: JamaahItem) => j.id === id);
			if (!original) return false;
			return (
				editedValues[id].nominal !== original.nominal ||
				editedValues[id].catatan !== original.catatan
			);
		}).length
	);

	function resetChanges() {
		editedValues = {};
	}

	// Payload JSON untuk dikirim ke action saveFr
	const dirtyPayloadJson = $derived(
		JSON.stringify(
			Object.entries(editedValues)
				.filter(([id, val]) => {
					const orig = data.jamaahList.find((j: JamaahItem) => j.id === id);
					if (!orig) return false;
					return val.nominal !== orig.nominal || val.catatan !== orig.catatan;
				})
				.map(([id, val]) => ({
					anggotaId: id,
					nominal: val.nominal,
					statusBayar: val.nominal > 0 ? 'Lunas' : 'Belum',
					catatan: val.catatan
				}))
		)
	);

	// Filtering Jamaah di Tabel
	const filteredJamaah = $derived(
		data.jamaahList.filter((j: JamaahItem) => {
			if (!searchQuery.trim()) return true;
			const q = searchQuery.toLowerCase();
			return (
				j.namaLengkap.toLowerCase().includes(q) ||
				(j.kepalaKeluargaNama && j.kepalaKeluargaNama.toLowerCase().includes(q)) ||
				(j.statusGenerus && j.statusGenerus.toLowerCase().includes(q))
			);
		})
	);

	// Perhitungan Agregat Real-time
	const totalWajib = $derived(data.jamaahList.length);
	const totalSudahSetor = $derived(
		data.jamaahList.filter((j: JamaahItem) => getEffectiveNominal(j) > 0).length
	);
	const totalNominal = $derived(
		data.jamaahList.reduce((acc: number, j: JamaahItem) => acc + getEffectiveNominal(j), 0)
	);

	function formatRupiah(num: number): string {
		return new Intl.NumberFormat('id-ID', {
			style: 'currency',
			currency: 'IDR',
			maximumFractionDigits: 0
		}).format(num);
	}

	$effect(() => {
		if (form?.success) {
			editedValues = {};
			isSaving = false;
		} else if (form?.error) {
			isSaving = false;
		}
	});

	function exportToCsv() {
		if (!data.jamaahList || data.jamaahList.length === 0) return;

		const namaBulan = bulanNames[data.bulan - 1] || `Bulan ${data.bulan}`;
		const rows: string[][] = [
			['No', 'Nama Jamaah', 'Status Hubungan', 'Generus', 'Kepala Keluarga', 'Periode', 'Nominal FR (Rp)', 'Status Bayar', 'Catatan']
		];

		filteredJamaah.forEach((j: JamaahItem, idx: number) => {
			const effNominal = getEffectiveNominal(j);
			const effCatatan = getEffectiveCatatan(j);
			rows.push([
				String(idx + 1),
				`"${(j.namaLengkap || '').replace(/"/g, '""')}"`,
				`"${(j.statusHubungan || '').replace(/"/g, '""')}"`,
				`"${(j.statusGenerus || '-').replace(/"/g, '""')}"`,
				`"${(j.kepalaKeluargaNama || '-').replace(/"/g, '""')}"`,
				`"${namaBulan} ${data.tahun}"`,
				String(effNominal || 0),
				effNominal > 0 ? 'Lunas' : 'Belum',
				`"${(effCatatan || '').replace(/"/g, '""')}"`
			]);
		});

		const csvContent = '\uFEFF' + rows.map((r) => r.join(',')).join('\r\n');
		const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.setAttribute('download', `FR-Jamaah-${(data.selectedKelompokNama || 'Kelompok').replace(/\s+/g, '_')}-${namaBulan}-${data.tahun}.csv`);
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(url);
	}
</script>

<div class="space-y-6 pb-36 md:pb-24">
	<!-- HEADER HALAMAN -->
	<div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
		<div>
			<div class="flex items-center gap-2">
				<HandCoins class="w-6 h-6 text-primary" />
				<h1 class="text-xl md:text-2xl font-bold text-foreground">FR Jamaah (Wajib Isrun)</h1>
			</div>
			<p class="text-xs md:text-sm text-foreground/60 mt-1">
				Input dan kelola setoran shodaqoh FR bulanan jamaah wajib isrun sesuai data sensus wilayah.
			</p>
		</div>

		<!-- Status Wewenang -->
		<div class="flex items-center gap-2">
			{#if data.canEdit}
				<span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
					<ShieldCheck class="w-4 h-4" />
					<span>Akses Edit Aktif ({data.adminScope?.isPusat ? 'Superadmin' : 'KU'})</span>
				</span>
			{:else if data.isFinanceAdmin}
				<span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
					<ShieldCheck class="w-4 h-4" />
					<span>Pengurus {data.adminScope?.isPusat ? 'Superadmin' : 'KU'}</span>
				</span>
			{:else}
				<span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-secondary text-foreground/60 border border-border">
					<Lock class="w-4 h-4" />
					<span>Mode Read-Only (Kyai / Aghnia)</span>
				</span>
			{/if}
		</div>
	</div>

	<!-- FEEDBACK NOTIFIKASI -->
	{#if form?.success}
		<div class="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2 shadow-xs">
			<Check class="w-4 h-4 shrink-0" />
			<span>{form.message || 'Perubahan data FR berhasil disimpan ke database.'}</span>
		</div>
	{:else if form?.error}
		<div class="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2 shadow-xs">
			<AlertCircle class="w-4 h-4 shrink-0" />
			<span>{form.error}</span>
		</div>
	{/if}

	<!-- FILTER WILAYAH & PERIODE (COLLAPSIBLE DI MOBILE) -->
	<div class="bg-card border border-border rounded-2xl p-4 md:p-5 shadow-xs space-y-4">
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-2">
				<Filter class="w-4 h-4 text-primary" />
				<h2 class="text-sm font-bold text-foreground">Filter Wilayah & Periode Setoran</h2>
			</div>
			<button
				type="button"
				onclick={() => (isFilterOpen = !isFilterOpen)}
				class="md:hidden inline-flex items-center gap-1 text-xs font-medium text-foreground/60 hover:text-foreground"
			>
				<span>{isFilterOpen ? 'Tutup Filter' : 'Buka Filter'}</span>
				<ChevronDown class="w-4 h-4 transition-transform {isFilterOpen ? 'rotate-180' : ''}" />
			</button>
		</div>

		<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 {isFilterOpen ? 'block' : 'hidden md:grid'}">
			<!-- Pilihan Kelompok (SearchableSelect) -->
			<div class="sm:col-span-2">
				<label for="selectKelompok" class="block text-xs font-semibold text-foreground mb-1">
					Kelompok Binaan *
				</label>
				<SearchableSelect
					id="selectKelompok"
					name="kelompok"
					options={kelompokOptions}
					bind:value={selectedKelompok}
					placeholder="-- Pilih Kelompok Binaan --"
					searchPlaceholder="Cari nama kelompok..."
					onchange={applyFilter}
				/>
			</div>

			<!-- Pilihan Bulan -->
			<div>
				<label for="selectBulan" class="block text-xs font-semibold text-foreground mb-1">
					Bulan Setoran
				</label>
				<select
					id="selectBulan"
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
				<label for="selectTahun" class="block text-xs font-semibold text-foreground mb-1">
					Tahun Setoran
				</label>
				<select
					id="selectTahun"
					bind:value={selectedTahun}
					onchange={applyFilter}
					class="w-full bg-secondary/50 border border-border rounded-xl px-3.5 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
				>
					{#each tahunOptions as t}
						<option value={t.value}>{t.label}</option>
					{/each}
				</select>
			</div>
		</div>
	</div>

	<!-- KONDISI JIKA KELOMPOK BELUM DIPILIH -->
	{#if !data.selectedKelompokId}
		<div class="bg-card border border-border rounded-2xl p-12 text-center shadow-xs space-y-3">
			<div class="w-14 h-14 rounded-2xl bg-secondary/70 mx-auto flex items-center justify-center text-foreground/40">
				<Building2 class="w-7 h-7" />
			</div>
			<div class="max-w-md mx-auto space-y-1">
				<h3 class="font-bold text-base text-foreground">Kelompok Belum Dipilih</h3>
				<p class="text-xs text-foreground/60 leading-relaxed">
					Silakan pilih salah satu kelompok binaan pada filter dropdown di atas untuk memuat daftar jamaah yang wajib isrun dan mengisi setoran shodaqoh FR.
				</p>
			</div>
		</div>
	{:else}
		<!-- RINGKASAN METRIK PERIODE KELOMPOK -->
		<div class="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
			<div class="bg-card border border-border rounded-xl p-4 shadow-xs space-y-1">
				<span class="text-xs text-foreground/60 font-medium">Total Wajib Isrun</span>
				<div class="flex items-baseline gap-2">
					<span class="text-2xl font-bold text-foreground">{totalWajib}</span>
					<span class="text-xs text-foreground/50">Jamaah Aktif</span>
				</div>
			</div>

			<div class="bg-card border border-border rounded-xl p-4 shadow-xs space-y-1">
				<span class="text-xs text-foreground/60 font-medium">Sudah Menyetor FR</span>
				<div class="flex items-baseline gap-2">
					<span class="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{totalSudahSetor}</span>
					<span class="text-xs text-foreground/50">dari {totalWajib} ({totalWajib ? Math.round((totalSudahSetor / totalWajib) * 100) : 0}%)</span>
				</div>
			</div>

			<div class="bg-card border border-border rounded-xl p-4 shadow-xs space-y-1">
				<span class="text-xs text-foreground/60 font-medium">Akumulasi Shodaqoh FR</span>
				<div class="text-2xl font-bold text-primary truncate">
					{formatRupiah(totalNominal)}
				</div>
			</div>
		</div>

		<!-- TABEL DATA JAMAAH FR -->
		<div class="bg-card border border-border rounded-2xl p-4 md:p-5 shadow-xs space-y-4">
			<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
				<div>
					<h3 class="font-bold text-base text-foreground">
						Daftar Jamaah Kelompok {data.selectedKelompokNama}
					</h3>
					<p class="text-xs text-foreground/50 mt-0.5">
						Periode {bulanNames[data.bulan - 1]} {data.tahun}
					</p>
				</div>

				<!-- Pencarian Cepat Nama Jamaah & Tombol Ekspor -->
				<div class="flex items-center gap-2 w-full sm:w-auto">
					<div class="relative flex-1 sm:w-60">
						<Search class="w-4 h-4 text-foreground/40 absolute left-3 top-1/2 -translate-y-1/2" />
						<input
							type="text"
							bind:value={searchQuery}
							placeholder="Cari nama jamaah / KK..."
							class="w-full bg-secondary/50 border border-border rounded-xl pl-9 pr-3.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
						/>
					</div>

					<button
						type="button"
						onclick={exportToCsv}
						class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-card hover:bg-secondary text-foreground text-xs font-semibold shrink-0 transition-colors shadow-xs"
						title="Unduh daftar FR Jamaah dalam format CSV / Excel"
					>
						<Download class="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
						<span class="hidden sm:inline">Ekspor CSV</span>
						<span class="sm:hidden">CSV</span>
					</button>
				</div>
			</div>

			{#if filteredJamaah.length === 0}
				<div class="p-8 text-center text-foreground/50 text-xs rounded-xl border border-dashed border-border">
					{#if searchQuery}
						Tidak ada nama jamaah yang cocok dengan kata kunci pencarian "{searchQuery}".
					{:else}
						Tidak ditemukan data jamaah dengan status wajib isrun di kelompok ini.
					{/if}
				</div>
			{:else}
				<!-- DAFTAR KARTU MOBILE (md:hidden): card simetris dengan nama & angka nominal yang jelas -->
				<div class="md:hidden space-y-2.5">
					{#each filteredJamaah as j, idx (j.id)}
						{@const effNominal = getEffectiveNominal(j)}
						{@const effCatatan = getEffectiveCatatan(j)}
						{@const isRowDirty = editedValues[j.id] !== undefined && (editedValues[j.id].nominal !== j.nominal || editedValues[j.id].catatan !== j.catatan)}
						<div class="bg-card border border-border rounded-2xl p-3.5 space-y-3 shadow-xs transition-all {isRowDirty ? 'border-primary/60 bg-primary/5 ring-1 ring-primary/20' : 'hover:border-border/80'}">
							<!-- Header Kartu: No, Nama Jamaah & Status -->
							<div class="flex items-start justify-between gap-3">
								<div class="flex items-start gap-2.5 min-w-0 flex-1">
									<span class="w-6 h-6 rounded-lg bg-secondary text-foreground/70 font-mono text-xs font-bold flex items-center justify-center shrink-0 mt-0.5 border border-border/60">
										{idx + 1}
									</span>
									<div class="min-w-0 flex-1">
										<h4 class="text-sm font-bold text-foreground tracking-tight leading-snug truncate">
											{j.namaLengkap}
										</h4>
										<div class="flex flex-wrap items-center gap-1.5 text-[11px] text-foreground/60 mt-0.5">
											<span>{j.statusHubungan}</span>
											{#if j.statusGenerus}
												<span>•</span>
												<span class="text-foreground/75 font-medium">{j.statusGenerus}</span>
											{/if}
											{#if j.kepalaKeluargaNama}
												<span>•</span>
												<span class="truncate">KK: {j.kepalaKeluargaNama}</span>
											{/if}
										</div>
									</div>
								</div>

								<!-- Badge Status Pembayaran -->
								{#if effNominal > 0}
									<span class="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-2xs">
										<Check class="w-3 h-3 stroke-[2.5]" />
										<span>Lunas</span>
									</span>
								{:else}
									<span class="shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-secondary text-foreground/50 border border-border">
										Belum
									</span>
								{/if}
							</div>

							<!-- Form Input Simetris: Nominal (Kiri) & Catatan (Kanan) -->
							<div class="pt-2.5 border-t border-border/50">
								{#if data.canEdit}
									<div class="grid grid-cols-12 gap-2">
										<!-- Input Nominal Angka Jelas & Tegas -->
										<div class="col-span-6 relative">
											<span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold font-mono text-primary">
												Rp
											</span>
											<input
												type="text"
												inputmode="numeric"
												pattern="[0-9]*"
												autocomplete="off"
												value={effNominal ? effNominal.toLocaleString('id-ID') : ''}
												oninput={(e) => handleNominalInput(j.id, (e.target as HTMLInputElement).value)}
												placeholder="0"
												aria-label="Nominal FR {j.namaLengkap}"
												class="w-full pl-8 pr-2.5 py-2 rounded-xl border text-sm font-mono font-bold tracking-wide transition-all focus:outline-none focus:ring-1 {isRowDirty ? 'border-primary bg-primary/10 text-primary focus:ring-primary ring-1 ring-primary/30' : 'border-border bg-secondary/40 text-foreground focus:ring-primary'}"
											/>
										</div>

										<!-- Input Catatan Seimbang & Simetris -->
										<div class="col-span-6">
											<input
												type="text"
												value={effCatatan}
												oninput={(e) => handleCatatanInput(j.id, (e.target as HTMLInputElement).value)}
												placeholder="Catatan..."
												aria-label="Catatan {j.namaLengkap}"
												class="w-full px-3 py-2 rounded-xl border text-xs transition-all focus:outline-none focus:ring-1 {isRowDirty ? 'border-primary/50 bg-primary/5' : 'border-border bg-secondary/40 text-foreground focus:ring-primary'}"
											/>
										</div>
									</div>
								{:else}
									<div class="flex items-center justify-between text-xs py-0.5">
										<div class="flex items-center gap-1.5">
											<span class="text-[11px] text-foreground/50">Nominal:</span>
											<span class="font-mono font-bold text-sm text-foreground">
												{formatRupiah(effNominal)}
											</span>
										</div>
										{#if effCatatan}
											<span class="text-xs text-foreground/60 italic truncate max-w-[50%]">
												{effCatatan}
											</span>
										{/if}
									</div>
								{/if}
							</div>
						</div>
					{/each}
				</div>

				<div class="hidden md:block border border-border rounded-xl overflow-x-auto shadow-xs">
					<table class="w-full text-left text-xs min-w-[720px]">
						<thead class="bg-secondary/60 text-foreground/70 uppercase text-[11px] tracking-wider border-b border-border">
							<tr>
								<th class="py-2 px-3.5 font-semibold w-12 text-center">No</th>
								<th class="py-2 px-4 font-semibold">Nama Jamaah & Hubungan</th>
								<th class="py-2 px-4 font-semibold">Kepala Keluarga</th>
								<th class="py-2 px-4 font-semibold w-48">Nominal FR (Rp)</th>
								<th class="py-2 px-3 font-semibold w-24 text-center">Status</th>
								<th class="py-2 px-4 font-semibold">Catatan / Keterangan</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-border">
							{#each filteredJamaah as j, idx (j.id)}
								{@const effNominal = getEffectiveNominal(j)}
								{@const effCatatan = getEffectiveCatatan(j)}
								{@const isRowDirty = editedValues[j.id] !== undefined && (editedValues[j.id].nominal !== j.nominal || editedValues[j.id].catatan !== j.catatan)}
								<tr class="hover:bg-secondary/30 transition-colors {isRowDirty ? 'bg-primary/5' : ''}">
									<td class="py-2.5 px-3.5 text-center text-foreground/50 font-mono font-semibold">
										{idx + 1}
									</td>

									<!-- Nama & Detail Generus -->
									<td class="py-2.5 px-4">
										<div class="font-bold text-foreground text-sm tracking-tight">{j.namaLengkap}</div>
										<div class="flex items-center gap-1.5 text-[11px] text-foreground/60 mt-0.5">
											<span>{j.statusHubungan}</span>
											{#if j.statusGenerus}
												<span>•</span>
												<span class="inline-block px-1.5 py-0.2 rounded bg-secondary font-medium">
													{j.statusGenerus}
												</span>
											{/if}
										</div>
									</td>

									<!-- Kepala Keluarga -->
									<td class="py-2.5 px-4 text-foreground/80 text-xs">
										{j.kepalaKeluargaNama || '-'}
									</td>

									<!-- Input Nominal (Inline Editable) -->
									<td class="py-2.5 px-4">
										{#if data.canEdit}
											<div class="relative">
												<span class="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/50 font-mono text-xs font-bold">
													Rp
												</span>
												<input
													type="text"
													inputmode="numeric"
													pattern="[0-9]*"
													autocomplete="off"
													value={effNominal ? effNominal.toLocaleString('id-ID') : ''}
													oninput={(e) => handleNominalInput(j.id, (e.target as HTMLInputElement).value)}
													placeholder="0"
													class="w-full pl-9 pr-3 py-2 rounded-lg border text-sm font-mono font-bold tracking-wide transition-all focus:outline-none focus:ring-1 {isRowDirty ? 'border-primary bg-primary/10 text-primary focus:ring-primary' : 'border-border bg-secondary/50 text-foreground focus:ring-primary'}"
												/>
											</div>
										{:else}
											<span class="font-mono font-bold text-sm text-foreground">
												{formatRupiah(effNominal)}
											</span>
										{/if}
									</td>

									<!-- Status Pembayaran -->
									<td class="py-2 px-3 text-center">
										{#if effNominal > 0}
											<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
												Lunas
											</span>
										{:else}
											<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-secondary text-foreground/50">
												Belum
											</span>
										{/if}
									</td>

									<!-- Catatan -->
									<td class="py-2 px-4">
										{#if data.canEdit}
											<input
												type="text"
												value={effCatatan}
												oninput={(e) => handleCatatanInput(j.id, (e.target as HTMLInputElement).value)}
												placeholder="Opsional..."
												class="w-full px-2.5 py-1.5 rounded-lg border text-xs transition-all focus:outline-none focus:ring-1 {isRowDirty ? 'border-primary/50 bg-primary/5' : 'border-border bg-secondary/50 text-foreground focus:ring-primary'}"
											/>
										{:else}
											<span class="text-xs text-foreground/60 italic">
												{effCatatan || '-'}
											</span>
										{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>
	{/if}

	<!-- STICKY FLOATING ACTION BAR (MENGIKUTI SCROLL SAAT ADA PERUBAHAN) -->
	{#if dirtyCount > 0 && data.canEdit}
		<div class="fixed left-3 right-3 bottom-20 md:bottom-6 md:left-72 z-50 bg-card/95 backdrop-blur-md border border-primary/30 rounded-2xl p-3 shadow-2xl flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-3 duration-200">
			<div class="flex items-center gap-2 pl-2">
				<span class="w-2.5 h-2.5 rounded-full bg-primary animate-pulse"></span>
				<div class="text-xs font-semibold text-foreground">
					<span>{dirtyCount} data jamaah diubah</span>
					<span class="text-foreground/50 font-normal hidden sm:inline">• Belum disimpan</span>
				</div>
			</div>

			<div class="flex items-center gap-2">
				<button
					type="button"
					onclick={resetChanges}
					class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-foreground/70 hover:bg-secondary transition-colors"
				>
					<RotateCcw class="w-3.5 h-3.5" />
					<span class="hidden sm:inline">Batal</span>
				</button>

				<form
					method="POST"
					action={`?kelompokId=${data.selectedKelompokId}&tahun=${data.tahun}&bulan=${data.bulan}&/saveFr`}
					use:enhance={keepScrollSubmit({
						beforeSubmit: () => {
							isSaving = true;
						},
						onSuccess: () => {
							editedValues = {};
							isSaving = false;
						},
						onError: () => {
							isSaving = false;
						},
						onFinally: () => {
							isSaving = false;
						}
					})}
				>
					<input type="hidden" name="kelompokId" value={data.selectedKelompokId} />
					<input type="hidden" name="tahun" value={data.tahun} />
					<input type="hidden" name="bulan" value={data.bulan} />
					<input type="hidden" name="desaId" value={data.desaId ?? ''} />
					<input type="hidden" name="daerahId" value={data.daerahId ?? ''} />
					<input type="hidden" name="itemsJson" value={dirtyPayloadJson} />

					<button
						type="submit"
						disabled={isSaving}
						class="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50"
					>
						<Save class="w-4 h-4" />
						<span class="sm:hidden">{isSaving ? 'Menyimpan...' : 'Simpan'}</span>
						<span class="hidden sm:inline">{isSaving ? 'Menyimpan...' : 'Simpan Semua Perubahan'}</span>
					</button>
				</form>
			</div>
		</div>
	{/if}
</div>

