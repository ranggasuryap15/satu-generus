<!--
  @file src/routes/(admin)/admin/wilayah/+page.svelte
  @purpose Halaman manajemen Data Wilayah lengkap (Daerah, Desa, Kelompok, Sub-Kelompok), modal detail kelompok dengan Leaflet, kontrol RBAC visual berjenjang
  @usedBy Route admin '/admin/wilayah'
  @dependencies @lucide/svelte, Svelte 5 Runes, $lib/components/SearchableSelect.svelte, $lib/components/LocationPicker.svelte
  @publicFunctions openAddDaerahModal, closeAddDaerahModal, openAddKelompokModal, closeAddKelompokModal, openAddDesaModal, closeAddDesaModal, openAddSubKelompokModal, closeAddSubKelompokModal, openKelompokDetail, closeKelompokDetail, resetFilter
  @sideEffects Menampilkan data wilayah sesuai scope RBAC, menyaring data, mengelola lokasi kelompok dengan Leaflet, dan mengirim update ke server
-->
<script lang="ts">
	import {
		Building,
		ChevronDown,
		ChevronUp,
		FileSpreadsheet,
		Filter,
		Home,
		Layers,
		MapPin,
		Plus,
		RotateCcw,
		Search,
		ShieldCheck,
		SlidersHorizontal,
		Users,
		X,
		ExternalLink,
		Compass,
		CheckCircle2,
		Navigation
	} from '@lucide/svelte';
	import type { ActionData, PageData } from './$types';
	import SearchableSelect from '$lib/components/SearchableSelect.svelte';
	import LocationPicker from '$lib/components/LocationPicker.svelte';

	let { data, form } = $props<{ data: PageData; form: ActionData }>();

	// State Tab Tampilan
	let activeTab = $state<'kelompok' | 'subKelompok'>('kelompok');

	// State Filter & Pencarian
	let searchQuery = $state('');
	let selectedFilterDaerahId = $state<string | number>('');
	let selectedFilterDesaId = $state<string | number>('');
	let showMobileFilter = $state(false);

	// State Modal Tambah
	let showAddDaerahModal = $state(false);
	let showAddKelompokModal = $state(false);
	let showAddDesaModal = $state(false);
	let showAddSubKelompokModal = $state(false);

	// State Modal Detail & Lokasi Kelompok
	let showKelompokDetailModal = $state(false);
	let selectedKelompok = $state<(typeof data.kelompokList)[number] | null>(null);

	// State Form Edit Lokasi Kelompok
	let editLokasiNama = $state('');
	let editLatitude = $state('');
	let editLongitude = $state('');
	let editRadiusMeter = $state(100);
	let editGmapsUrl = $state('');

	function openKelompokDetail(k: (typeof data.kelompokList)[number]) {
		selectedKelompok = k;
		editLokasiNama = k.lokasiNama || '';
		editLatitude = k.latitude || '';
		editLongitude = k.longitude || '';
		editRadiusMeter = k.radiusMeter || 100;
		editGmapsUrl = k.gmapsUrl || '';
		showKelompokDetailModal = true;
	}

	function closeKelompokDetail() {
		showKelompokDetailModal = false;
		selectedKelompok = null;
	}

	// Form Tambah Daerah
	let inputNamaDaerah = $state('');
	let inputProvinsi = $state('');
	let inputKotaKabupaten = $state('');

	// Form Tambah Kelompok
	let inputNamaKelompok = $state('');
	let selectedDesaId = $state<string | number>('');
	let inputKelurahan = $state('');

	// Form Tambah Desa
	let inputNamaDesa = $state('');
	let selectedDaerahId = $state<string | number>('');
	let inputKecamatan = $state('');

	// Form Tambah Sub-Kelompok
	let inputNamaSubKelompok = $state('');
	let selectedKelompokId = $state<string | number>('');
	let inputKeteranganSubKelompok = $state('');

	// Opsi Select
	const daerahOptions = $derived(
		(data.daerahList || []).map((d: (typeof data.daerahList)[number]) => ({
			value: d.id,
			label: d.nama,
			sublabel: d.kotaKabupaten
		}))
	);

	const desaOptions = $derived(
		(data.desaList || []).map((d: (typeof data.desaList)[number]) => ({
			value: d.id,
			label: d.nama,
			sublabel: d.daerahNama ? `Daerah ${d.daerahNama}` : undefined
		}))
	);

	const kelompokOptions = $derived(
		(data.kelompokList || []).map((k: (typeof data.kelompokList)[number]) => ({
			value: k.id,
			label: k.nama,
			sublabel: k.desaNama ? `Desa ${k.desaNama}` : undefined
		}))
	);

	// Opsi Filter Desa (Disesuaikan jika Daerah dipilih)
	const filteredDesaFilterOptions = $derived(
		(data.desaList || []).filter((d: (typeof data.desaList)[number]) => {
			if (!selectedFilterDaerahId) return true;
			return String(d.daerahId) === String(selectedFilterDaerahId);
		})
	);

	// Hitung Filter Aktif
	const activeFilterCount = $derived(
		(selectedFilterDaerahId ? 1 : 0) +
			(selectedFilterDesaId ? 1 : 0) +
			(searchQuery.trim() ? 1 : 0)
	);

	function resetFilter() {
		searchQuery = '';
		selectedFilterDaerahId = '';
		selectedFilterDesaId = '';
	}

	// Filter Data Kelompok
	let filteredKelompok = $derived(
		(data.kelompokList || []).filter((k: (typeof data.kelompokList)[number]) => {
			if (selectedFilterDaerahId) {
				const matchDesa = (data.desaList || []).find((d: (typeof data.desaList)[number]) => d.id === k.desaId);
				if (!matchDesa || String(matchDesa.daerahId) !== String(selectedFilterDaerahId)) {
					return false;
				}
			}

			if (selectedFilterDesaId && String(k.desaId) !== String(selectedFilterDesaId)) {
				return false;
			}

			if (searchQuery.trim()) {
				const q = searchQuery.toLowerCase();
				return (
					k.nama.toLowerCase().includes(q) ||
					(k.desaNama || '').toLowerCase().includes(q) ||
					(k.daerahNama || '').toLowerCase().includes(q) ||
					(k.kelurahan || '').toLowerCase().includes(q)
				);
			}

			return true;
		})
	);

	// Filter Data Sub-Kelompok
	let filteredSubKelompok = $derived(
		(data.subKelompokList || []).filter((sk: (typeof data.subKelompokList)[number]) => {
			if (selectedFilterDaerahId) {
				const matchKelompok = (data.kelompokList || []).find((k: (typeof data.kelompokList)[number]) => k.id === sk.kelompokId);
				if (!matchKelompok) return false;
				const matchDesa = (data.desaList || []).find((d: (typeof data.desaList)[number]) => d.id === matchKelompok.desaId);
				if (!matchDesa || String(matchDesa.daerahId) !== String(selectedFilterDaerahId)) {
					return false;
				}
			}

			if (selectedFilterDesaId) {
				const matchKelompok = (data.kelompokList || []).find((k: (typeof data.kelompokList)[number]) => k.id === sk.kelompokId);
				if (!matchKelompok || String(matchKelompok.desaId) !== String(selectedFilterDesaId)) {
					return false;
				}
			}

			if (searchQuery.trim()) {
				const q = searchQuery.toLowerCase();
				return (
					sk.nama.toLowerCase().includes(q) ||
					(sk.kelompokNama || '').toLowerCase().includes(q) ||
					(sk.desaNama || '').toLowerCase().includes(q) ||
					(sk.daerahNama || '').toLowerCase().includes(q) ||
					(sk.keterangan || '').toLowerCase().includes(q)
				);
			}

			return true;
		})
	);

	// Reset forms
	function resetAddDaerahForm() {
		inputNamaDaerah = '';
		inputProvinsi = '';
		inputKotaKabupaten = '';
	}

	function resetAddKelompokForm() {
		inputNamaKelompok = '';
		selectedDesaId = '';
		inputKelurahan = '';
	}

	function resetAddDesaForm() {
		inputNamaDesa = '';
		selectedDaerahId = '';
		inputKecamatan = '';
	}

	function resetAddSubKelompokForm() {
		inputNamaSubKelompok = '';
		selectedKelompokId = '';
		inputKeteranganSubKelompok = '';
	}

	function closeAddDaerahModal() {
		showAddDaerahModal = false;
	}

	function closeAddKelompokModal() {
		showAddKelompokModal = false;
	}

	function closeAddDesaModal() {
		showAddDesaModal = false;
	}

	function closeAddSubKelompokModal() {
		showAddSubKelompokModal = false;
	}

	$effect(() => {
		if (form?.success) {
			resetAddDaerahForm();
			resetAddKelompokForm();
			resetAddDesaForm();
			resetAddSubKelompokForm();
			showAddDaerahModal = false;
			showAddKelompokModal = false;
			showAddDesaModal = false;
			showAddSubKelompokModal = false;
		}
	});
</script>

<svelte:head>
	<title>Data Wilayah - Admin Satu Generus</title>
</svelte:head>

<div class="space-y-5 max-w-[100vw] overflow-x-hidden p-2 sm:p-4">
	<!-- Page Header & Action Bar -->
	<div
		class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card border border-border p-4 rounded-xl shadow-xs"
	>
		<div>
			<h1 class="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
				<MapPin class="w-5 h-5 text-primary" />
				<span>Data Wilayah Jamaah</span>
			</h1>
			<p class="text-xs text-foreground/60 mt-0.5">
				Kelola struktur data wilayah berjenjang: Daerah &rarr; Desa &rarr; Kelompok &rarr; Sub-Kelompok.
			</p>
		</div>

		<div class="flex items-center gap-2 flex-wrap">
			<!-- Badge Scope Wewenang Admin -->
			<div
				class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium bg-muted/40 text-foreground/80 border-border"
			>
				<ShieldCheck class="w-3.5 h-3.5 text-primary" />
				<span>Scope: <strong class="text-foreground">{data.adminScope.level}</strong></span>
				{#if data.adminScope.level === 'Desa' && data.desaList.length > 0}
					<span class="text-foreground/50">({data.desaList.map((d) => d.nama).join(', ')})</span>
				{:else if data.adminScope.level === 'Daerah' && data.daerahList.length > 0}
					<span class="text-foreground/50">({data.daerahList.map((d) => d.nama).join(', ')})</span>
				{:else if data.adminScope.level === 'Kelompok' && data.kelompokList.length > 0}
					<span class="text-foreground/50">({data.kelompokList.map((k) => k.nama).join(', ')})</span>
				{:else if data.adminScope.isPusat}
					<span class="text-foreground/50">(Seluruh Wilayah)</span>
				{/if}
			</div>

			{#if data.permissions.canBatchInsert}
				<a
					href="/admin/wilayah/batch"
					class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary/40 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold transition-all shadow-xs"
				>
					<FileSpreadsheet class="w-3.5 h-3.5" />
					<span>Batch Insert Wilayah</span>
				</a>
			{/if}

			{#if data.permissions.canCreateDaerah}
				<button
					type="button"
					onclick={() => (showAddDaerahModal = true)}
					class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold transition-all shadow-xs"
				>
					<MapPin class="w-3.5 h-3.5" />
					<span>+ Daerah</span>
				</button>
			{/if}

			{#if data.permissions.canCreateDesa}
				<button
					type="button"
					onclick={() => {
						if (data.daerahList.length === 1) {
							selectedDaerahId = data.daerahList[0].id;
						}
						showAddDesaModal = true;
					}}
					class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-secondary/50 hover:bg-secondary text-foreground text-xs font-semibold transition-colors"
				>
					<Building class="w-3.5 h-3.5 text-primary" />
					<span>+ Desa</span>
				</button>
			{/if}

			{#if data.permissions.canCreateKelompok}
				<button
					type="button"
					onclick={() => {
						if (data.desaList.length === 1) {
							selectedDesaId = data.desaList[0].id;
						}
						showAddKelompokModal = true;
					}}
					class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-secondary/50 hover:bg-secondary text-foreground text-xs font-semibold transition-colors"
				>
					<Home class="w-3.5 h-3.5 text-primary" />
					<span>+ Kelompok</span>
				</button>
			{/if}

			{#if data.permissions.canCreateSubKelompok}
				<button
					type="button"
					onclick={() => {
						if (data.kelompokList.length === 1) {
							selectedKelompokId = data.kelompokList[0].id;
						}
						showAddSubKelompokModal = true;
					}}
					class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-secondary/50 hover:bg-secondary text-foreground text-xs font-semibold transition-colors"
				>
					<Layers class="w-3.5 h-3.5 text-blue-500" />
					<span>+ Sub-Kelompok</span>
				</button>
			{/if}
		</div>
	</div>

	<!-- Notifikasi Feedback Form -->
	{#if form?.error}
		<div
			class="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-xl flex items-center gap-2"
		>
			<span>{form.error}</span>
		</div>
	{/if}
	{#if form?.success}
		<div
			class="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs rounded-xl flex items-center gap-2 font-medium"
		>
			<span>Data wilayah berhasil disimpan ke sistem.</span>
		</div>
	{/if}

	<!-- Dashboard Metrik Data Wilayah (Daerah, Desa, Kelompok, Sub-Kelompok) -->
	<div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
		<!-- 1. Daerah -->
		<div class="bg-card border border-border rounded-xl p-3.5 sm:p-4 shadow-xs flex items-center justify-between">
			<div>
				<p class="text-[11px] font-semibold text-foreground/60 uppercase tracking-wider">Daerah</p>
				<p class="text-xl sm:text-2xl font-bold text-foreground mt-0.5">{data.daerahList.length}</p>
				<p class="text-[10.5px] text-foreground/50 mt-0.5">Kota / Kabupaten</p>
			</div>
			<div class="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
				<MapPin class="w-5 h-5" />
			</div>
		</div>

		<!-- 2. Desa -->
		<div class="bg-card border border-border rounded-xl p-3.5 sm:p-4 shadow-xs flex items-center justify-between">
			<div>
				<p class="text-[11px] font-semibold text-foreground/60 uppercase tracking-wider">Desa</p>
				<p class="text-xl sm:text-2xl font-bold text-foreground mt-0.5">{data.desaList.length}</p>
				<p class="text-[10.5px] text-foreground/50 mt-0.5">Kecamatan</p>
			</div>
			<div class="w-10 h-10 rounded-xl bg-accent/20 text-accent flex items-center justify-center shrink-0">
				<Building class="w-5 h-5" />
			</div>
		</div>

		<!-- 3. Kelompok -->
		<div class="bg-card border border-border rounded-xl p-3.5 sm:p-4 shadow-xs flex items-center justify-between">
			<div>
				<p class="text-[11px] font-semibold text-foreground/60 uppercase tracking-wider">Kelompok</p>
				<p class="text-xl sm:text-2xl font-bold text-foreground mt-0.5">{data.kelompokList.length}</p>
				<p class="text-[10.5px] text-foreground/50 mt-0.5">Basis Jamaah</p>
			</div>
			<div class="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center text-foreground/70 shrink-0">
				<Home class="w-5 h-5" />
			</div>
		</div>

		<!-- 4. Sub-Kelompok -->
		<div class="bg-card border border-border rounded-xl p-3.5 sm:p-4 shadow-xs flex items-center justify-between">
			<div>
				<p class="text-[11px] font-semibold text-foreground/60 uppercase tracking-wider">Sub-Kelompok</p>
				<p class="text-xl sm:text-2xl font-bold text-foreground mt-0.5">{data.subKelompokList.length}</p>
				<p class="text-[10.5px] text-foreground/50 mt-0.5">Rukun / Lingkungan</p>
			</div>
			<div class="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
				<Layers class="w-5 h-5" />
			</div>
		</div>
	</div>

	<!-- ============================================================== -->
	<!-- FILTER DATA WILAYAH: LENGKAP DI DESKTOP, COLLAPSE DI MOBILE -->
	<!-- ============================================================== -->
	<div class="bg-card border border-border rounded-xl shadow-xs overflow-hidden">
		<!-- Desktop Filter Bar & Mobile Header -->
		<div class="p-3.5 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
			<!-- Input Pencarian (Selalu Tampil) -->
			<div class="relative flex-1 max-w-md">
				<Search class="w-4 h-4 text-foreground/40 absolute left-3 top-1/2 -translate-y-1/2" />
				<input
					type="search"
					placeholder="Cari nama kelompok, sub-kelompok, desa, daerah..."
					bind:value={searchQuery}
					class="w-full bg-secondary/50 border border-border rounded-lg pl-9 pr-3 py-2 text-xs text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary focus:bg-background transition-all"
				/>
			</div>

			<!-- Mobile Filter Toggle Button (Hanya Muncul di Layar Mobile/Tablet) -->
			<div class="flex md:hidden items-center justify-between gap-2">
				<button
					type="button"
					onclick={() => (showMobileFilter = !showMobileFilter)}
					class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-secondary/50 text-xs font-semibold text-foreground transition-colors"
				>
					<SlidersHorizontal class="w-3.5 h-3.5 text-primary" />
					<span>Filter Data</span>
					{#if activeFilterCount > 0}
						<span class="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-bold">
							{activeFilterCount}
						</span>
					{/if}
					{#if showMobileFilter}
						<ChevronUp class="w-3.5 h-3.5 text-foreground/60" />
					{:else}
						<ChevronDown class="w-3.5 h-3.5 text-foreground/60" />
					{/if}
				</button>

				{#if activeFilterCount > 0}
					<button
						type="button"
						onclick={resetFilter}
						class="text-[11px] text-destructive hover:underline font-medium inline-flex items-center gap-1"
					>
						<RotateCcw class="w-3 h-3" />
						<span>Reset</span>
					</button>
				{/if}
			</div>

			<!-- Desktop Filter Options (Otomatis Tampil di Desktop, md:flex) -->
			<div class="hidden md:flex items-center gap-2.5 flex-wrap">
				<!-- Filter Daerah -->
				<div class="w-40">
					<select
						bind:value={selectedFilterDaerahId}
						class="w-full bg-secondary/50 border border-border rounded-lg px-2.5 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:bg-background transition-all"
					>
						<option value="">Semua Daerah</option>
						{#each data.daerahList as d}
							<option value={d.id}>{d.nama}</option>
						{/each}
					</select>
				</div>

				<!-- Filter Desa -->
				<div class="w-44">
					<select
						bind:value={selectedFilterDesaId}
						class="w-full bg-secondary/50 border border-border rounded-lg px-2.5 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:bg-background transition-all"
					>
						<option value="">Semua Desa</option>
						{#each filteredDesaFilterOptions as d}
							<option value={d.id}>{d.nama}</option>
						{/each}
					</select>
				</div>

				<!-- Tombol Reset Filter -->
				{#if activeFilterCount > 0}
					<button
						type="button"
						onclick={resetFilter}
						class="p-2 rounded-lg border border-border hover:bg-destructive/10 text-foreground/60 hover:text-destructive text-xs transition-colors"
						title="Reset Filter"
					>
						<RotateCcw class="w-3.5 h-3.5" />
					</button>
				{/if}
			</div>
		</div>

		<!-- Mobile Filter Accordion (Collapse di Layar Mobile) -->
		{#if showMobileFilter}
			<div class="block md:hidden border-t border-border p-3.5 bg-secondary/20 space-y-3">
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
					<div>
						<label class="block text-[10.5px] font-semibold text-foreground/70 mb-1">
							Saring Berdasarkan Daerah
						</label>
						<select
							bind:value={selectedFilterDaerahId}
							class="w-full bg-card border border-border rounded-lg px-2.5 py-2 text-xs text-foreground focus:ring-1 focus:ring-primary"
						>
							<option value="">Semua Daerah</option>
							{#each data.daerahList as d}
								<option value={d.id}>{d.nama}</option>
							{/each}
						</select>
					</div>

					<div>
						<label class="block text-[10.5px] font-semibold text-foreground/70 mb-1">
							Saring Berdasarkan Desa
						</label>
						<select
							bind:value={selectedFilterDesaId}
							class="w-full bg-card border border-border rounded-lg px-2.5 py-2 text-xs text-foreground focus:ring-1 focus:ring-primary"
						>
							<option value="">Semua Desa</option>
							{#each filteredDesaFilterOptions as d}
								<option value={d.id}>{d.nama}</option>
							{/each}
						</select>
					</div>
				</div>

				<div class="flex items-center justify-between pt-1">
					<button
						type="button"
						onclick={resetFilter}
						class="text-[11px] text-destructive hover:underline font-medium inline-flex items-center gap-1"
					>
						<RotateCcw class="w-3 h-3" />
						<span>Reset Semua Filter</span>
					</button>

					<button
						type="button"
						onclick={() => (showMobileFilter = false)}
						class="px-3 py-1 rounded-md bg-secondary text-foreground text-xs font-semibold"
					>
						Tutup
					</button>
				</div>
			</div>
		{/if}

		<!-- Tab Tampilan: Kelompok vs Sub-Kelompok -->
		<div class="flex items-center gap-1 px-4 border-t border-border bg-secondary/30">
			<button
				type="button"
				onclick={() => (activeTab = 'kelompok')}
				class="py-2.5 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 {activeTab ===
				'kelompok'
					? 'border-primary text-primary'
					: 'border-transparent text-foreground/60 hover:text-foreground'}"
			>
				<Home class="w-3.5 h-3.5" />
				<span>Data Kelompok ({filteredKelompok.length})</span>
			</button>

			<button
				type="button"
				onclick={() => (activeTab = 'subKelompok')}
				class="py-2.5 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 {activeTab ===
				'subKelompok'
					? 'border-primary text-primary'
					: 'border-transparent text-foreground/60 hover:text-foreground'}"
			>
				<Layers class="w-3.5 h-3.5" />
				<span>Data Sub-Kelompok ({filteredSubKelompok.length})</span>
			</button>
		</div>
	</div>

	<!-- ============================================================== -->
	<!-- TABEL DATA: TAB KELOMPOK ATAU TAB SUB-KELOMPOK -->
	<!-- ============================================================== -->
	{#if activeTab === 'kelompok'}
		<!-- Tabel Kelompok -->
		<div class="bg-card border border-border rounded-xl overflow-hidden shadow-xs">
			<div class="overflow-x-auto">
				<table class="w-full text-left text-xs">
					<thead class="bg-secondary/60 text-foreground/70 uppercase text-[10px] tracking-wider border-b border-border">
						<tr>
							<th class="py-3 px-4 font-semibold">Nama Kelompok</th>
							<th class="py-3 px-4 font-semibold">Lokasi Basis</th>
							<th class="py-3 px-4 font-semibold">Sub-Kelompok</th>
							<th class="py-3 px-4 font-semibold">Kelurahan / Domisili</th>
							<th class="py-3 px-4 font-semibold">Desa Induk</th>
							<th class="py-3 px-4 font-semibold">Daerah Induk</th>
							<th class="py-3 px-4 font-semibold text-right">Populasi Jamaah</th>
							<th class="py-3 px-4 font-semibold text-center">Aksi</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-border">
						{#if filteredKelompok.length === 0}
							<tr>
								<td colspan="8" class="py-12 text-center text-foreground/50">
									Belum ada unit kelompok yang cocok dengan filter atau pencarian.
								</td>
							</tr>
						{:else}
							{#each filteredKelompok as k}
								<tr
									onclick={() => openKelompokDetail(k)}
									class="hover:bg-secondary/40 transition-colors cursor-pointer group"
								>
									<td class="py-3.5 px-4 font-semibold text-foreground flex items-center gap-2">
										<div class="w-6 h-6 rounded bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors flex items-center justify-center font-mono text-[10px] shrink-0">
											KL
										</div>
										<span class="group-hover:text-primary transition-colors">{k.nama}</span>
									</td>

									<!-- Kolom Status Lokasi Basis Kelompok -->
									<td class="py-3.5 px-4">
										{#if k.latitude && k.longitude}
											<div class="space-y-0.5">
												<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
													<MapPin class="w-3 h-3 text-emerald-600 shrink-0" />
													<span class="truncate max-w-[130px]">{k.lokasiNama || 'Lokasi Terdaftar'}</span>
												</span>
												<span class="block text-[9.5px] text-foreground/50 font-mono pl-1">
													Radius: &plusmn;{k.radiusMeter || 100}m
												</span>
											</div>
										{:else}
											<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-medium bg-amber-500/10 text-amber-700 dark:text-amber-300">
												<MapPin class="w-3 h-3 text-amber-600/60 shrink-0" />
												<span>Belum Diset</span>
											</span>
										{/if}
									</td>

									<td class="py-3.5 px-4">
										{#if k.totalSubKelompok > 0}
											<button
												type="button"
												onclick={(e) => {
													e.stopPropagation();
													searchQuery = k.nama;
													activeTab = 'subKelompok';
												}}
												class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-blue-500/10 text-blue-700 dark:text-blue-300 hover:bg-blue-500/20 transition-colors"
											>
												<Layers class="w-3 h-3" />
												<span>{k.totalSubKelompok} Sub-Kelompok</span>
											</button>
										{:else}
											<span class="text-foreground/40 text-[11px]">-</span>
										{/if}
									</td>
									<td class="py-3.5 px-4 text-foreground/70">{k.kelurahan || '-'}</td>
									<td class="py-3.5 px-4 font-medium text-foreground">{k.desaNama || '-'}</td>
									<td class="py-3.5 px-4 text-foreground/60">{k.daerahNama || '-'}</td>
									<td class="py-3.5 px-4 text-right">
										<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-secondary text-foreground/80">
											<Users class="w-3 h-3 text-primary" />
											{k.totalJamaah} Jamaah
										</span>
									</td>
									<td class="py-3.5 px-4 text-center">
										<button
											type="button"
											onclick={(e) => {
												e.stopPropagation();
												openKelompokDetail(k);
											}}
											class="px-2.5 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-[10.5px] font-bold transition-colors cursor-pointer"
										>
											Detail & Lokasi
										</button>
									</td>
								</tr>
							{/each}
						{/if}
					</tbody>
				</table>
			</div>
		</div>
	{:else}
		<!-- Tabel Sub-Kelompok -->
		<div class="bg-card border border-border rounded-xl overflow-hidden shadow-xs">
			<div class="overflow-x-auto">
				<table class="w-full text-left text-xs">
					<thead class="bg-secondary/60 text-foreground/70 uppercase text-[10px] tracking-wider border-b border-border">
						<tr>
							<th class="py-3 px-4 font-semibold">Nama Sub-Kelompok</th>
							<th class="py-3 px-4 font-semibold">Kelompok Induk</th>
							<th class="py-3 px-4 font-semibold">Keterangan / Rukun</th>
							<th class="py-3 px-4 font-semibold">Desa Induk</th>
							<th class="py-3 px-4 font-semibold">Daerah Induk</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-border">
						{#if filteredSubKelompok.length === 0}
							<tr>
								<td colspan="5" class="py-12 text-center text-foreground/50">
									Belum ada unit sub-kelompok yang cocok dengan filter atau pencarian.
								</td>
							</tr>
						{:else}
							{#each filteredSubKelompok as sk}
								<tr class="hover:bg-secondary/30 transition-colors">
									<td class="py-3.5 px-4 font-semibold text-foreground flex items-center gap-2">
										<div class="w-6 h-6 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-mono text-[10px] shrink-0">
											SK
										</div>
										<span>{sk.nama}</span>
									</td>
									<td class="py-3.5 px-4 font-medium text-foreground">{sk.kelompokNama || '-'}</td>
									<td class="py-3.5 px-4 text-foreground/70">{sk.keterangan || '-'}</td>
									<td class="py-3.5 px-4 text-foreground/70">{sk.desaNama || '-'}</td>
									<td class="py-3.5 px-4 text-foreground/60">{sk.daerahNama || '-'}</td>
								</tr>
							{/each}
						{/if}
					</tbody>
				</table>
			</div>
		</div>
	{/if}
</div>

<!-- Modal Tambah Daerah Baru -->
{#if showAddDaerahModal}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
		role="dialog"
		aria-modal="true"
	>
		<div class="bg-card border border-border rounded-2xl max-w-md w-full p-6 shadow-xl space-y-5">
			<div class="flex items-center justify-between pb-3 border-b border-border">
				<div class="flex items-center gap-2">
					<div class="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
						<MapPin class="w-4 h-4" />
					</div>
					<h3 class="text-sm font-bold text-foreground">Tambah Daerah Baru</h3>
				</div>
				<button
					type="button"
					onclick={closeAddDaerahModal}
					class="p-1 rounded-lg hover:bg-secondary text-foreground/60 hover:text-foreground"
				>
					<X class="w-5 h-5" />
				</button>
			</div>

			<form method="POST" action="?/createDaerah" class="space-y-4">
				<div>
					<label for="namaDaerah" class="block text-xs font-semibold text-foreground mb-1.5">
						Nama Daerah *
					</label>
					<input
						id="namaDaerah"
						name="nama"
						type="text"
						bind:value={inputNamaDaerah}
						required
						placeholder="Contoh: Surabaya Barat / Jakarta Selatan"
						class="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
					/>
				</div>

				<div>
					<label for="kotaKabupaten" class="block text-xs font-semibold text-foreground mb-1.5">
						Kota / Kabupaten *
					</label>
					<input
						id="kotaKabupaten"
						name="kotaKabupaten"
						type="text"
						bind:value={inputKotaKabupaten}
						required
						placeholder="Contoh: Kota Surabaya / Kota Administrasi Jakarta Selatan"
						class="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
					/>
				</div>

				<div>
					<label for="provinsi" class="block text-xs font-semibold text-foreground mb-1.5">
						Provinsi *
					</label>
					<input
						id="provinsi"
						name="provinsi"
						type="text"
						bind:value={inputProvinsi}
						required
						placeholder="Contoh: Jawa Timur / DKI Jakarta"
						class="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
					/>
				</div>

				<div class="flex items-center justify-end gap-2 pt-3 border-t border-border">
					<button
						type="button"
						onclick={closeAddDaerahModal}
						class="px-4 py-2 rounded-lg border border-border text-xs font-semibold text-foreground/80 hover:bg-secondary"
					>
						Batal
					</button>
					<button
						type="submit"
						class="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90"
					>
						Simpan Daerah
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- Modal Tambah Kelompok Baru -->
{#if showAddKelompokModal}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
		role="dialog"
		aria-modal="true"
	>
		<div class="bg-card border border-border rounded-2xl max-w-md w-full p-6 shadow-xl space-y-5">
			<div class="flex items-center justify-between pb-3 border-b border-border">
				<div class="flex items-center gap-2">
					<div class="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
						<Home class="w-4 h-4" />
					</div>
					<h3 class="text-sm font-bold text-foreground">Tambah Kelompok Baru</h3>
				</div>
				<button
					type="button"
					onclick={closeAddKelompokModal}
					class="p-1 rounded-lg hover:bg-secondary text-foreground/60 hover:text-foreground"
				>
					<X class="w-5 h-5" />
				</button>
			</div>

			<form method="POST" action="?/createKelompok" class="space-y-4">
				<div>
					<label for="namaKelompok" class="block text-xs font-semibold text-foreground mb-1.5">
						Nama Kelompok *
					</label>
					<input
						id="namaKelompok"
						name="nama"
						type="text"
						bind:value={inputNamaKelompok}
						required
						placeholder="Contoh: Kelompok 2"
						class="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
					/>
				</div>

				<div>
					<label for="desaId" class="block text-xs font-semibold text-foreground mb-1.5">
						Desa Induk *
					</label>
					{#if data.desaList.length === 1}
						<div
							class="px-3 py-2 bg-secondary/40 border border-border rounded-lg text-xs font-semibold text-foreground flex items-center justify-between"
						>
							<span>{data.desaList[0].nama}</span>
							<span class="text-[10.5px] text-foreground/50 font-normal">Wilayah Binaan Anda</span>
						</div>
						<input type="hidden" name="desaId" value={data.desaList[0].id} />
					{:else}
						<SearchableSelect
							id="desaId"
							name="desaId"
							options={desaOptions}
							bind:value={selectedDesaId}
							required
							placeholder="-- Pilih Desa Induk --"
							searchPlaceholder="Cari nama desa..."
						/>
					{/if}
				</div>

				<div>
					<label for="kelurahan" class="block text-xs font-semibold text-foreground mb-1.5">
						Kelurahan / Keterangan Domisili
					</label>
					<input
						id="kelurahan"
						name="kelurahan"
						type="text"
						bind:value={inputKelurahan}
						placeholder="Contoh: Senayan"
						class="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
					/>
				</div>

				<div class="flex items-center justify-end gap-2 pt-3 border-t border-border">
					<button
						type="button"
						onclick={closeAddKelompokModal}
						class="px-4 py-2 rounded-lg border border-border text-xs font-semibold text-foreground/80 hover:bg-secondary"
					>
						Batal
					</button>
					<button
						type="submit"
						class="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90"
					>
						Simpan Kelompok
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- Modal Tambah Desa Baru -->
{#if showAddDesaModal}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
		role="dialog"
		aria-modal="true"
	>
		<div class="bg-card border border-border rounded-2xl max-w-md w-full p-6 shadow-xl space-y-5">
			<div class="flex items-center justify-between pb-3 border-b border-border">
				<div class="flex items-center gap-2">
					<div class="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
						<Building class="w-4 h-4" />
					</div>
					<h3 class="text-sm font-bold text-foreground">Tambah Desa Baru</h3>
				</div>
				<button
					type="button"
					onclick={closeAddDesaModal}
					class="p-1 rounded-lg hover:bg-secondary text-foreground/60 hover:text-foreground"
				>
					<X class="w-5 h-5" />
				</button>
			</div>

			<form method="POST" action="?/createDesa" class="space-y-4">
				<div>
					<label for="namaDesa" class="block text-xs font-semibold text-foreground mb-1.5">
						Nama Desa *
					</label>
					<input
						id="namaDesa"
						name="nama"
						type="text"
						bind:value={inputNamaDesa}
						required
						placeholder="Contoh: Kebayoran Baru"
						class="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
					/>
				</div>

				<div>
					<label for="daerahId" class="block text-xs font-semibold text-foreground mb-1.5">
						Daerah Induk *
					</label>
					{#if data.daerahList.length === 1}
						<div
							class="px-3 py-2 bg-secondary/40 border border-border rounded-lg text-xs font-semibold text-foreground flex items-center justify-between"
						>
							<span>{data.daerahList[0].nama}</span>
							<span class="text-[10.5px] text-foreground/50 font-normal">Daerah Binaan Anda</span>
						</div>
						<input type="hidden" name="daerahId" value={data.daerahList[0].id} />
					{:else}
						<SearchableSelect
							id="daerahId"
							name="daerahId"
							options={daerahOptions}
							bind:value={selectedDaerahId}
							required
							placeholder="-- Pilih Daerah Induk --"
							searchPlaceholder="Cari nama daerah atau kabupaten..."
						/>
					{/if}
				</div>

				<div>
					<label for="kecamatan" class="block text-xs font-semibold text-foreground mb-1.5">
						Kecamatan Administratif
					</label>
					<input
						id="kecamatan"
						name="kecamatan"
						type="text"
						bind:value={inputKecamatan}
						placeholder="Contoh: Kebayoran Baru"
						class="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
					/>
				</div>

				<div class="flex items-center justify-end gap-2 pt-3 border-t border-border">
					<button
						type="button"
						onclick={closeAddDesaModal}
						class="px-4 py-2 rounded-lg border border-border text-xs font-semibold text-foreground/80 hover:bg-secondary"
					>
						Batal
					</button>
					<button
						type="submit"
						class="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90"
					>
						Simpan Desa
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- Modal Tambah Sub-Kelompok Baru -->
{#if showAddSubKelompokModal}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
		role="dialog"
		aria-modal="true"
	>
		<div class="bg-card border border-border rounded-2xl max-w-md w-full p-6 shadow-xl space-y-5">
			<div class="flex items-center justify-between pb-3 border-b border-border">
				<div class="flex items-center gap-2">
					<div class="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
						<Layers class="w-4 h-4" />
					</div>
					<h3 class="text-sm font-bold text-foreground">Tambah Sub-Kelompok Baru</h3>
				</div>
				<button
					type="button"
					onclick={closeAddSubKelompokModal}
					class="p-1 rounded-lg hover:bg-secondary text-foreground/60 hover:text-foreground"
				>
					<X class="w-5 h-5" />
				</button>
			</div>

			<form method="POST" action="?/createSubKelompok" class="space-y-4">
				<div>
					<label for="namaSubKelompok" class="block text-xs font-semibold text-foreground mb-1.5">
						Nama Sub-Kelompok *
					</label>
					<input
						id="namaSubKelompok"
						name="nama"
						type="text"
						bind:value={inputNamaSubKelompok}
						required
						placeholder="Contoh: Rukun 1 / Lingkungan A"
						class="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
					/>
				</div>

				<div>
					<label for="subKelompokKelompokId" class="block text-xs font-semibold text-foreground mb-1.5">
						Kelompok Induk *
					</label>
					{#if data.kelompokList.length === 1}
						<div
							class="px-3 py-2 bg-secondary/40 border border-border rounded-lg text-xs font-semibold text-foreground flex items-center justify-between"
						>
							<span>{data.kelompokList[0].nama}</span>
							<span class="text-[10.5px] text-foreground/50 font-normal">Kelompok Binaan Anda</span>
						</div>
						<input type="hidden" name="kelompokId" value={data.kelompokList[0].id} />
					{:else}
						<SearchableSelect
							id="subKelompokKelompokId"
							name="kelompokId"
							options={kelompokOptions}
							bind:value={selectedKelompokId}
							required
							placeholder="-- Pilih Kelompok Induk --"
							searchPlaceholder="Cari nama kelompok..."
						/>
					{/if}
				</div>

				<div>
					<label for="keteranganSubKelompok" class="block text-xs font-semibold text-foreground mb-1.5">
						Keterangan / Rukun (Opsional)
					</label>
					<input
						id="keteranganSubKelompok"
						name="keterangan"
						type="text"
						bind:value={inputKeteranganSubKelompok}
						placeholder="Contoh: RT 01-03 RW 05"
						class="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
					/>
				</div>

				<div class="flex items-center justify-end gap-2 pt-3 border-t border-border">
					<button
						type="button"
						onclick={closeAddSubKelompokModal}
						class="px-4 py-2 rounded-lg border border-border text-xs font-semibold text-foreground/80 hover:bg-secondary"
					>
						Batal
					</button>
					<button
						type="submit"
						class="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90"
					>
						Simpan Sub-Kelompok
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- Modal Detail & Pengaturan Lokasi Kelompok -->
{#if showKelompokDetailModal && selectedKelompok}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-background/80 backdrop-blur-sm"
		role="dialog"
		aria-modal="true"
		tabindex="-1"
		onclick={(e) => {
			if (e.target === e.currentTarget) closeKelompokDetail();
		}}
		onkeydown={(e) => {
			if (e.key === 'Escape') closeKelompokDetail();
		}}
	>
		<div
			class="bg-card border border-border rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
		>
			<!-- Modal Header -->
			<div class="px-5 py-4 border-b border-border flex items-center justify-between bg-secondary/30">
				<div class="flex items-center gap-2.5">
					<div class="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
						KL
					</div>
					<div>
						<h3 class="text-sm font-bold text-foreground flex items-center gap-1.5">
							<span>Detail {selectedKelompok.nama}</span>
						</h3>
						<p class="text-[11px] text-foreground/60">
							Desa {selectedKelompok.desaNama || '-'} &bull; Daerah {selectedKelompok.daerahNama || '-'}
						</p>
					</div>
				</div>

				<button
					type="button"
					onclick={closeKelompokDetail}
					class="p-1.5 rounded-lg hover:bg-secondary text-foreground/60 hover:text-foreground cursor-pointer transition-colors"
					aria-label="Tutup detail kelompok"
				>
					<X class="w-4 h-4" />
				</button>
			</div>

			<!-- Modal Body (Scrollable) -->
			<div class="p-4 sm:p-6 overflow-y-auto space-y-5 text-xs">
				<!-- Ringkasan Informasi Kelompok -->
				<div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
					<div class="bg-secondary/40 border border-border/80 rounded-xl p-2.5 text-center">
						<span class="text-[10px] text-foreground/50 uppercase font-semibold">Kelurahan</span>
						<p class="font-bold text-foreground text-xs mt-0.5 truncate">{selectedKelompok.kelurahan || '-'}</p>
					</div>
					<div class="bg-secondary/40 border border-border/80 rounded-xl p-2.5 text-center">
						<span class="text-[10px] text-foreground/50 uppercase font-semibold">Desa Induk</span>
						<p class="font-bold text-foreground text-xs mt-0.5 truncate">{selectedKelompok.desaNama || '-'}</p>
					</div>
					<div class="bg-secondary/40 border border-border/80 rounded-xl p-2.5 text-center">
						<span class="text-[10px] text-foreground/50 uppercase font-semibold">Populasi</span>
						<p class="font-bold text-primary text-xs mt-0.5">{selectedKelompok.totalJamaah} Jamaah</p>
					</div>
					<div class="bg-secondary/40 border border-border/80 rounded-xl p-2.5 text-center">
						<span class="text-[10px] text-foreground/50 uppercase font-semibold">Sub-Kelompok</span>
						<p class="font-bold text-foreground text-xs mt-0.5">{selectedKelompok.totalSubKelompok} Rukun</p>
					</div>
				</div>

				<!-- Section Pengaturan Lokasi Basis Kelompok -->
				<div class="space-y-3 pt-2 border-t border-border/80">
					<div class="flex items-center justify-between gap-2">
						<div>
							<h4 class="text-xs font-bold text-foreground flex items-center gap-1.5">
								<MapPin class="w-4 h-4 text-primary" />
								<span>Titik Lokasi Basis Kelompok</span>
							</h4>
							<p class="text-[11px] text-foreground/60 mt-0.5 leading-relaxed">
								Titik koordinat & radius ini menjadi acuan validasi presensi jamaah kelompok. Jamaah hanya dapat presensi jika berada dalam radius lokasi ini.
							</p>
						</div>

						<!-- Quick Access Google Maps jika lokasi sudah ada -->
						{#if (editLatitude && editLongitude) || editGmapsUrl}
							<a
								href={editGmapsUrl || `https://www.google.com/maps?q=${editLatitude},${editLongitude}`}
								target="_blank"
								rel="noopener noreferrer"
								class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold text-[11px] shrink-0 transition-colors shadow-xs"
								title="Buka titik koordinat kelompok di Google Maps"
							>
								<span>Buka di Google Maps</span>
								<ExternalLink class="w-3.5 h-3.5" />
							</a>
						{/if}
					</div>

					<form method="POST" action="?/updateKelompokLocation" class="space-y-4">
						<input type="hidden" name="kelompokId" value={selectedKelompok.id} />
						<input type="hidden" name="lokasiNama" value={editLokasiNama} />
						<input type="hidden" name="latitude" value={editLatitude} />
						<input type="hidden" name="longitude" value={editLongitude} />
						<input type="hidden" name="radiusMeter" value={editRadiusMeter} />
						<input type="hidden" name="gmapsUrl" value={editGmapsUrl} />

						<!-- Komponen Peta Interaktif Leaflet + Draggable Pin + Pencarian + Link GMaps -->
						<LocationPicker
							bind:latitude={editLatitude}
							bind:longitude={editLongitude}
							bind:lokasiNama={editLokasiNama}
							bind:radiusMeter={editRadiusMeter}
							bind:gmapsUrl={editGmapsUrl}
						/>

						<div class="flex items-center justify-between gap-2 pt-2 border-t border-border">
							{#if editLatitude && editLongitude}
								<span class="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
									<CheckCircle2 class="w-3.5 h-3.5" />
									<span>Koordinat Terpilih: {editLatitude}, {editLongitude} (&plusmn;{editRadiusMeter}m)</span>
								</span>
							{:else}
								<span class="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
									Belum ada koordinat lokasi yang dipilih.
								</span>
							{/if}

							<div class="flex items-center gap-2">
								<button
									type="button"
									onclick={closeKelompokDetail}
									class="px-4 py-2 rounded-lg border border-border text-xs font-semibold text-foreground/80 hover:bg-secondary cursor-pointer"
								>
									Tutup
								</button>
								<button
									type="submit"
									class="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-all shadow-sm cursor-pointer"
								>
									Simpan Lokasi Kelompok
								</button>
							</div>
						</div>
					</form>
				</div>
			</div>
		</div>
	</div>
{/if}
