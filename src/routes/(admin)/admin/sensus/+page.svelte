<!--
  @file src/routes/(admin)/admin/sensus/+page.svelte
  @purpose Rekapitulasi sensus Kartu Keluarga, dashboard statistik singkat, filter bertingkat, dan form modal pendaftaran sensus serta anggota
  @usedBy Route admin '/admin/sensus'
  @dependencies @lucide/svelte, Svelte 5 Runes, $lib/components/SearchableSelect.svelte, $lib/utils (formatDateDDMMYYYY)
  @publicFunctions requestUnmask, openCreateModal, openAddMemberModal, resetFilters
  @sideEffects Menampilkan metrik, unmask data sensitif via /api/sensus/unmask, submit form createSensus & addAnggotaKeluarga
-->
<script lang="ts">
	import {
		Search,
		Eye,
		ShieldCheck,
		Users,
		Download,
		X,
		Home,
		UserCheck,
		MapPin,
		Plus,
		CheckCircle2,
		AlertCircle,
		Filter,
		RotateCcw,
		UserPlus,
		Trash2
	} from '@lucide/svelte';
	import type { PageData, ActionData } from './$types';
	import SearchableSelect from '$lib/components/SearchableSelect.svelte';
	import { formatDateDDMMYYYY } from '$lib/utils';

	let { data, form } = $props<{ data: PageData; form: ActionData }>();

	// State Pencarian & Filter
	let searchQuery = $state('');
	let filterDaerahId = $state<string | number>('ALL');
	let filterDesaId = $state<string | number>('ALL');
	let filterKelompokId = $state<string | number>('ALL');
	let filterPeran = $state<'ALL' | '4S' | 'PENGURUS' | 'JAMAAH'>('ALL');

	// State Modal Detail & Unmasking
	let selectedKeluarga = $state<(typeof data.daftarKeluarga)[0] | null>(null);
	let showUnmaskModal = $state(false);
	let unmaskLoading = $state(false);
	let unmaskedData = $state<{ label: string; value: string } | null>(null);

	// State Modal Tambah Sensus Baru (Akun + KK + Anggota)
	let showCreateModal = $state(false);
	let newNamaLengkap = $state('');
	let newEmail = $state('');
	let newKelompokId = $state<string | number>('');
	let newNoKk = $state('');
	let newAlamatLengkap = $state('');
	interface NewAnggotaRow {
		nik: string;
		statusHubungan: string;
		tanggalLahir: string;
		jenisKelamin: string;
	}
	let newAnggotaList = $state<NewAnggotaRow[]>([
		{ nik: '', statusHubungan: 'Kepala Keluarga', tanggalLahir: '', jenisKelamin: 'Laki-laki' }
	]);

	// State Modal Tambah Anggota ke KK yang Ada
	let showAddMemberModal = $state(false);
	let targetKeluargaForMember = $state<(typeof data.daftarKeluarga)[0] | null>(null);
	let memberNik = $state('');
	let memberStatus = $state('Anak');
	let memberTanggalLahir = $state('');
	let memberJenisKelamin = $state('Laki-laki');

	// Options Filter Daerah (Default 'ALL')
	const daerahFilterOptions = $derived([
		{ value: 'ALL', label: 'Semua Daerah (All)' },
		...(data.wilayahOptions.daerahList || []).map((d: (typeof data.wilayahOptions.daerahList)[number]) => ({
			value: d.id,
			label: d.nama,
			sublabel: d.kotaKabupaten
		}))
	]);

	// Filter Desa Dinamis berdasarkan Daerah terpilih
	const availableDesaList = $derived(
		filterDaerahId === 'ALL'
			? data.wilayahOptions.desaList || []
			: (data.wilayahOptions.desaList || []).filter(
					(d: (typeof data.wilayahOptions.desaList)[number]) => d.daerahId === Number(filterDaerahId)
				)
	);

	const desaFilterOptions = $derived([
		{ value: 'ALL', label: 'Semua Desa (All)' },
		...availableDesaList.map((d: (typeof data.wilayahOptions.desaList)[number]) => ({
			value: d.id,
			label: d.nama,
			sublabel: d.daerahNama ? `Daerah ${d.daerahNama}` : undefined
		}))
	]);

	// Filter Kelompok Dinamis berdasarkan Desa atau Daerah terpilih
	const availableKelompokList = $derived(
		filterDesaId !== 'ALL'
			? (data.wilayahOptions.kelompokList || []).filter(
					(k: (typeof data.wilayahOptions.kelompokList)[number]) => k.desaId === Number(filterDesaId)
				)
			: filterDaerahId !== 'ALL'
				? (data.wilayahOptions.kelompokList || []).filter(
						(k: (typeof data.wilayahOptions.kelompokList)[number]) => k.daerahId === Number(filterDaerahId)
					)
				: data.wilayahOptions.kelompokList || []
	);

	const kelompokFilterOptions = $derived([
		{ value: 'ALL', label: 'Semua Kelompok (All)' },
		...availableKelompokList.map((k: (typeof data.wilayahOptions.kelompokList)[number]) => ({
			value: k.id,
			label: k.nama,
			sublabel: k.desaNama ? `Desa ${k.desaNama}` : undefined
		}))
	]);

	// Opsi Pilihan Kelompok saat Tambah Sensus Baru (Hanya yang dalam scope)
	const kelompokCreationOptions = $derived(
		(data.wilayahOptions.kelompokList || []).map((k: (typeof data.wilayahOptions.kelompokList)[number]) => ({
			value: k.id,
			label: `${k.nama} (Desa ${k.desaNama || '-'})`,
			sublabel: k.daerahNama ? `Daerah ${k.daerahNama}` : undefined
		}))
	);

	// Opsi Filter Kategori Peran / 4S
	const peranFilterOptions = [
		{ value: 'ALL', label: 'Semua Kategori (All)' },
		{ value: '4S', label: 'Pengurus 4S Saja' },
		{ value: 'PENGURUS', label: 'Semua Pengurus' },
		{ value: 'JAMAAH', label: 'Jamaah Biasa' }
	];

	// Filter Hasil Sensus
	let filteredKeluarga = $derived(
		(data.daftarKeluarga || []).filter((k: (typeof data.daftarKeluarga)[number]) => {
			// 1. Text Search
			const q = searchQuery.toLowerCase().trim();
			if (q) {
				const matchKk = k.noKkMasked.toLowerCase().includes(q);
				const matchNama = k.kepalaKeluargaNama.toLowerCase().includes(q);
				const matchEmail = (k.kepalaKeluargaEmail || '').toLowerCase().includes(q);
				const matchAlamat = (k.alamatLengkap || '').toLowerCase().includes(q);
				const matchKelompok = (k.kelompokNama || '').toLowerCase().includes(q);
				const matchDesa = (k.desaNama || '').toLowerCase().includes(q);
				const matchDaerah = (k.daerahNama || '').toLowerCase().includes(q);
				if (!matchKk && !matchNama && !matchEmail && !matchAlamat && !matchKelompok && !matchDesa && !matchDaerah) {
					return false;
				}
			}

			// 2. Filter Daerah
			if (filterDaerahId !== 'ALL' && k.daerahId !== Number(filterDaerahId)) {
				return false;
			}

			// 3. Filter Desa
			if (filterDesaId !== 'ALL' && k.desaId !== Number(filterDesaId)) {
				return false;
			}

			// 4. Filter Kelompok
			if (filterKelompokId !== 'ALL' && k.kelompokId !== Number(filterKelompokId)) {
				return false;
			}

			// 5. Filter Peran / 4S
			if (filterPeran === '4S' && !k.is4S) return false;
			if (filterPeran === 'PENGURUS' && !k.isPengurus) return false;
			if (filterPeran === 'JAMAAH' && k.isPengurus) return false;

			return true;
		})
	);

	function resetFilters() {
		searchQuery = '';
		filterDaerahId = 'ALL';
		filterDesaId = 'ALL';
		filterKelompokId = 'ALL';
		filterPeran = 'ALL';
	}

	function openCreateModal() {
		newNamaLengkap = '';
		newEmail = '';
		newKelompokId = '';
		newNoKk = '';
		newAlamatLengkap = '';
		newAnggotaList = [
			{ nik: '', statusHubungan: 'Kepala Keluarga', tanggalLahir: '', jenisKelamin: 'Laki-laki' }
		];
		showCreateModal = true;
	}

	function addAnggotaRow() {
		newAnggotaList = [
			...newAnggotaList,
			{ nik: '', statusHubungan: 'Anak', tanggalLahir: '', jenisKelamin: 'Laki-laki' }
		];
	}

	function removeAnggotaRow(index: number) {
		if (newAnggotaList.length <= 1) return;
		newAnggotaList = newAnggotaList.filter((_, idx) => idx !== index);
	}

	function openAddMemberModal(k: (typeof data.daftarKeluarga)[number]) {
		targetKeluargaForMember = k;
		memberNik = '';
		memberStatus = 'Anak';
		memberTanggalLahir = '';
		memberJenisKelamin = 'Laki-laki';
		showAddMemberModal = true;
	}

	async function requestUnmask(params: { keluargaId?: string; anggotaId?: string; label: string }) {
		unmaskLoading = true;
		showUnmaskModal = true;
		unmaskedData = null;

		try {
			const res = await fetch('/api/sensus/unmask', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(params)
			});
			const result = await res.json();
			if (res.ok) {
				unmaskedData = { label: params.label, value: result.original };
			} else {
				alert(result.error || 'Gagal unmask data');
				showUnmaskModal = false;
			}
		} catch (err) {
			alert('Terjadi kesalahan jaringan.');
			showUnmaskModal = false;
		} finally {
			unmaskLoading = false;
		}
	}
</script>

<svelte:head>
	<title>Sensus Kartu Keluarga - Admin Satu Generus</title>
</svelte:head>

<div class="space-y-6">
	<!-- Page Header & Action Button -->
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
		<div>
			<div class="flex items-center gap-2">
				<h1 class="text-xl font-bold text-foreground tracking-tight">Rekapitulasi Sensus Kartu Keluarga</h1>
				<span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20">
					Scope {data.adminScope.level}
				</span>
			</div>
			<p class="text-xs text-foreground/60 mt-0.5">
				Kelola data kependudukan jamaah terenkripsi AES-256-GCM sesuai cakupan wewenang administratif Anda.
			</p>
		</div>

		<div class="flex items-center gap-2">
			<button
				type="button"
				class="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card text-xs font-medium text-foreground/80 hover:bg-secondary transition-colors"
			>
				<Download class="w-3.5 h-3.5" />
				Export CSV
			</button>

			<button
				type="button"
				onclick={openCreateModal}
				class="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-all shadow-sm active:scale-95"
			>
				<Plus class="w-4 h-4" />
				<span>Tambah Sensus Baru</span>
			</button>
		</div>
	</div>

	<!-- Notifikasi Feedback Server Action -->
	{#if form?.error}
		<div class="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
			<AlertCircle class="w-4 h-4 shrink-0" />
			<span>{form.error}</span>
		</div>
	{/if}
	{#if form?.success}
		<div class="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
			<CheckCircle2 class="w-4 h-4 shrink-0" />
			<span>{form.success}</span>
		</div>
	{/if}

	<!-- 1. DASHBOARD STATISTIK SINGKAT DI BAGIAN ATAS -->
	<div class="grid grid-cols-2 md:grid-cols-4 gap-3">
		<!-- Total KK -->
		<div class="bg-card border border-border rounded-xl p-4 shadow-sm flex items-center gap-3">
			<div class="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
				<Home class="w-5 h-5" />
			</div>
			<div>
				<p class="text-[11px] font-medium text-foreground/60">Total Kartu Keluarga</p>
				<p class="text-xl font-bold text-foreground mt-0.5">{data.dashboardStats.totalKeluarga}</p>
			</div>
		</div>

		<!-- Total Jiwa / Jamaah -->
		<div class="bg-card border border-border rounded-xl p-4 shadow-sm flex items-center gap-3">
			<div class="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
				<Users class="w-5 h-5" />
			</div>
			<div>
				<p class="text-[11px] font-medium text-foreground/60">Total Jiwa / Anggota</p>
				<p class="text-xl font-bold text-foreground mt-0.5">{data.dashboardStats.totalJiwa}</p>
			</div>
		</div>

		<!-- Total Pengurus & 4S -->
		<div class="bg-card border border-border rounded-xl p-4 shadow-sm flex items-center gap-3">
			<div class="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
				<ShieldCheck class="w-5 h-5" />
			</div>
			<div>
				<p class="text-[11px] font-medium text-foreground/60">Pengurus & 4S</p>
				<p class="text-xl font-bold text-foreground mt-0.5">
					{data.dashboardStats.totalPengurus}
					<span class="text-xs font-normal text-foreground/60">({data.dashboardStats.totalPengurus4S} 4S)</span>
				</p>
			</div>
		</div>

		<!-- Cakupan Wilayah -->
		<div class="bg-card border border-border rounded-xl p-4 shadow-sm flex items-center gap-3">
			<div class="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center shrink-0">
				<MapPin class="w-5 h-5" />
			</div>
			<div>
				<p class="text-[11px] font-medium text-foreground/60">Cakupan Wilayah</p>
				<p class="text-xs font-bold text-foreground mt-0.5 truncate">
					{data.dashboardStats.totalDaerah} Daerah • {data.dashboardStats.totalDesa} Desa • {data.dashboardStats.totalKelompok} Kel.
				</p>
			</div>
		</div>
	</div>

	<!-- 2. FILTER TOOLBAR LENGKAP (Daerah, Desa, Kelompok, Pengurus/4S/Jamaah, Pencarian) -->
	<div class="bg-card border border-border rounded-2xl p-4 shadow-sm space-y-3">
		<div class="flex items-center justify-between pb-2 border-b border-border text-xs">
			<div class="flex items-center gap-2 font-semibold text-foreground">
				<Filter class="w-3.5 h-3.5 text-primary" />
				<span>Filter Data Sensus (Default: All)</span>
			</div>
			{#if searchQuery || filterDaerahId !== 'ALL' || filterDesaId !== 'ALL' || filterKelompokId !== 'ALL' || filterPeran !== 'ALL'}
				<button
					type="button"
					onclick={resetFilters}
					class="inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-medium cursor-pointer"
				>
					<RotateCcw class="w-3 h-3" />
					<span>Reset Filter</span>
				</button>
			{/if}
		</div>

		<!-- Baris Filter Dropdown Search -->
		<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
			<!-- Filter Daerah -->
			<div>
				<span class="block text-[11px] font-medium text-foreground/70 mb-1">Daerah</span>
				<SearchableSelect
					name="filterDaerah"
					options={daerahFilterOptions}
					bind:value={filterDaerahId}
					placeholder="Semua Daerah (All)"
					searchPlaceholder="Cari daerah..."
					onchange={() => {
						filterDesaId = 'ALL';
						filterKelompokId = 'ALL';
					}}
				/>
			</div>

			<!-- Filter Desa -->
			<div>
				<span class="block text-[11px] font-medium text-foreground/70 mb-1">Desa</span>
				<SearchableSelect
					name="filterDesa"
					options={desaFilterOptions}
					bind:value={filterDesaId}
					placeholder="Semua Desa (All)"
					searchPlaceholder="Cari desa..."
					onchange={() => {
						filterKelompokId = 'ALL';
					}}
				/>
			</div>

			<!-- Filter Kelompok -->
			<div>
				<span class="block text-[11px] font-medium text-foreground/70 mb-1">Kelompok</span>
				<SearchableSelect
					name="filterKelompok"
					options={kelompokFilterOptions}
					bind:value={filterKelompokId}
					placeholder="Semua Kelompok (All)"
					searchPlaceholder="Cari kelompok..."
				/>
			</div>

			<!-- Filter Peran / 4S / Jamaah -->
			<div>
				<span class="block text-[11px] font-medium text-foreground/70 mb-1">Peran / Kategori</span>
				<SearchableSelect
					name="filterPeran"
					options={peranFilterOptions}
					bind:value={filterPeran}
					placeholder="Semua Kategori (All)"
					searchPlaceholder="Cari kategori..."
				/>
			</div>
		</div>

		<!-- Pencarian Kata Kunci -->
		<div class="pt-1 flex flex-col sm:flex-row items-center justify-between gap-3">
			<div class="relative w-full sm:w-96">
				<Search class="w-4 h-4 text-foreground/40 absolute left-3 top-1/2 -translate-y-1/2" />
				<input
					type="search"
					placeholder="Cari No. KK, kepala keluarga, alamat, wilayah..."
					bind:value={searchQuery}
					class="w-full bg-secondary/50 border border-border rounded-lg pl-9 pr-3 py-2 text-xs text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary focus:bg-background transition-all"
				/>
			</div>

			<div class="text-xs text-foreground/60 w-full sm:w-auto text-left sm:text-right">
				Menampilkan <span class="font-bold text-foreground">{filteredKeluarga.length}</span> dari {data.daftarKeluarga.length} kartu keluarga
			</div>
		</div>
	</div>

	<!-- 3. TABEL DATA SENSUS KARTU KELUARGA -->
	<div class="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
		<div class="overflow-x-auto">
			<table class="w-full text-left text-xs text-foreground/80">
				<thead class="bg-secondary/40 text-foreground/60 uppercase text-[10px] tracking-wider border-b border-border">
					<tr>
						<th class="py-3 px-4 font-semibold">No. Kartu Keluarga</th>
						<th class="py-3 px-4 font-semibold">Kepala Keluarga</th>
						<th class="py-3 px-4 font-semibold">Wilayah Basis</th>
						<th class="py-3 px-4 font-semibold">Alamat Domisili</th>
						<th class="py-3 px-4 font-semibold">Jiwa</th>
						<th class="py-3 px-4 font-semibold text-right">Aksi</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-border">
					{#if filteredKeluarga.length === 0}
						<tr>
							<td colspan="6" class="py-12 text-center text-foreground/40">
								<div class="flex flex-col items-center justify-center gap-2">
									<Users class="w-8 h-8 opacity-40" />
									<span class="text-xs">Tidak ada data sensus keluarga yang sesuai filter.</span>
								</div>
							</td>
						</tr>
					{:else}
						{#each filteredKeluarga as k}
							<tr class="hover:bg-secondary/20 transition-colors">
								<!-- No. KK dengan Unmask Eye -->
								<td class="py-3.5 px-4 font-mono font-medium text-foreground">
									<div class="flex items-center gap-1.5">
										<span>{k.noKkMasked}</span>
										<button
											type="button"
											onclick={() => requestUnmask({ keluargaId: k.id, label: `No. KK (${k.kepalaKeluargaNama})` })}
											class="text-primary hover:text-primary/80 p-1 rounded hover:bg-primary/10 transition-colors"
											title="Buka Enkripsi No. KK"
										>
											<Eye class="w-3.5 h-3.5" />
										</button>
									</div>
								</td>

								<!-- Kepala Keluarga & Role Badge -->
								<td class="py-3.5 px-4">
									<div class="flex flex-col">
										<div class="flex items-center gap-1.5">
											<span class="font-semibold text-foreground">{k.kepalaKeluargaNama}</span>
											{#if k.is4S}
												<span class="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
													4S
												</span>
											{:else if k.isPengurus}
												<span class="px-1.5 py-0.2 rounded text-[9px] font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
													Pengurus
												</span>
											{/if}
										</div>
										<span class="text-[10px] text-foreground/50">{k.kepalaKeluargaEmail}</span>
									</div>
								</td>

								<!-- Wilayah Basis -->
								<td class="py-3.5 px-4">
									<div class="flex flex-col text-[11px]">
										<span class="font-medium text-foreground">{k.kelompokNama}</span>
										<span class="text-[10px] text-foreground/50">Desa {k.desaNama} • {k.daerahNama}</span>
									</div>
								</td>

								<!-- Alamat -->
								<td class="py-3.5 px-4 text-foreground/70 max-w-xs truncate">{k.alamatLengkap}</td>

								<!-- Jumlah Jiwa -->
								<td class="py-3.5 px-4">
									<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-secondary text-foreground/80">
										<Users class="w-3 h-3" />
										{k.jumlahAnggota} Jiwa
									</span>
								</td>

								<!-- Tombol Aksi -->
								<td class="py-3.5 px-4 text-right">
									<div class="inline-flex items-center gap-1.5 justify-end">
										<button
											type="button"
											onclick={() => openAddMemberModal(k)}
											class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border hover:bg-secondary text-foreground/80 text-xs font-medium transition-colors"
											title="Tambah Anggota Keluarga"
										>
											<UserPlus class="w-3.5 h-3.5 text-primary" />
											<span class="hidden sm:inline">+ Anggota</span>
										</button>

										<button
											type="button"
											onclick={() => (selectedKeluarga = k)}
											class="px-2.5 py-1 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground font-medium text-xs transition-colors"
										>
											Detail
										</button>
									</div>
								</td>
							</tr>
						{/each}
					{/if}
				</tbody>
			</table>
		</div>
	</div>
</div>

<!-- MODAL TAMBAH SENSUS BARU (AKUN DENGAN DEFAULT PASSWORD jokam354 + KK + ANGGOTA) -->
{#if showCreateModal}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
		role="dialog"
		aria-modal="true"
		onclick={(e) => {
			if (e.target === e.currentTarget) showCreateModal = false;
		}}
	>
		<div class="bg-card border border-border rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto">
			<div class="flex items-center justify-between pb-3 border-b border-border">
				<div>
					<h3 class="text-sm font-bold text-foreground">Tambah Sensus & Akun Jamaah Baru</h3>
					<p class="text-[11px] text-foreground/60 mt-0.5">
						Mendaftarkan akun jamaah baru sekaligus membuat Kartu Keluarga dan anggota.
					</p>
				</div>
				<button
					type="button"
					onclick={() => (showCreateModal = false)}
					class="p-1 rounded-lg hover:bg-secondary text-foreground/60 hover:text-foreground"
				>
					<X class="w-5 h-5" />
				</button>
			</div>

			<!-- Notice Password Default jokam354 -->
			<div class="p-3 rounded-xl bg-primary/10 border border-primary/20 text-xs flex items-center gap-2.5 text-foreground">
				<ShieldCheck class="w-4 h-4 text-primary shrink-0" />
				<div>
					<span class="font-bold text-primary">Password Baku Otomatis: </span>
					<span class="font-mono font-semibold bg-background/70 px-1.5 py-0.5 rounded border border-border">jokam354</span>
					<span class="text-foreground/70 ml-1">(Jamaah dapat mengubahnya setelah login via menu Profil).</span>
				</div>
			</div>

			<form method="POST" action="?/createSensus" class="space-y-4">
				<!-- Input Tersembunyi JSON Anggota Data -->
				<input type="hidden" name="anggotaData" value={JSON.stringify(newAnggotaList)} />

				<!-- BAGIAN 1: DATA AKUN JAMAAH (KEPALA KELUARGA) -->
				<div class="p-4 rounded-xl border border-border bg-secondary/20 space-y-3">
					<h4 class="text-xs font-bold text-foreground flex items-center gap-1.5">
						<UserCheck class="w-3.5 h-3.5 text-primary" />
						1. Data Akun Jamaah (Kepala Keluarga)
					</h4>

					<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
						<div>
							<label for="namaLengkap" class="block text-[11px] font-semibold text-foreground mb-1">
								Nama Lengkap *
							</label>
							<input
								id="namaLengkap"
								name="namaLengkap"
								type="text"
								required
								bind:value={newNamaLengkap}
								placeholder="Contoh: Ahmad Dahlan"
								class="w-full bg-secondary/60 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
							/>
						</div>

						<div>
							<label for="email" class="block text-[11px] font-semibold text-foreground mb-1">
								Alamat Email *
							</label>
							<input
								id="email"
								name="email"
								type="email"
								required
								bind:value={newEmail}
								placeholder="ahmad@example.com"
								class="w-full bg-secondary/60 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
							/>
						</div>
					</div>

					<!-- Kelompok Basis Scope Admin -->
					<div>
						<label for="kelompokId" class="block text-[11px] font-semibold text-foreground mb-1">
							Kelompok Basis (Sesuai Scope Anda: {data.adminScope.level}) *
						</label>
						<SearchableSelect
							id="kelompokId"
							name="kelompokId"
							options={kelompokCreationOptions}
							bind:value={newKelompokId}
							required
							placeholder="-- Pilih Kelompok Basis Jamaah --"
							searchPlaceholder="Cari nama kelompok atau desa..."
						/>
					</div>
				</div>

				<!-- BAGIAN 2: DATA KARTU KELUARGA -->
				<div class="p-4 rounded-xl border border-border bg-secondary/20 space-y-3">
					<h4 class="text-xs font-bold text-foreground flex items-center gap-1.5">
						<Home class="w-3.5 h-3.5 text-primary" />
						2. Data Kartu Keluarga
					</h4>

					<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
						<div>
							<label for="noKk" class="block text-[11px] font-semibold text-foreground mb-1">
								Nomor Kartu Keluarga (16 Digit) *
							</label>
							<input
								id="noKk"
								name="noKk"
								type="text"
								maxlength="16"
								pattern="[0-9]{16}"
								required
								bind:value={newNoKk}
								placeholder="3216xxxxxxxxxxxx"
								class="w-full bg-secondary/60 border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
							/>
						</div>

						<div>
							<label for="alamatLengkap" class="block text-[11px] font-semibold text-foreground mb-1">
								Alamat Lengkap Domisili *
							</label>
							<input
								id="alamatLengkap"
								name="alamatLengkap"
								type="text"
								required
								bind:value={newAlamatLengkap}
								placeholder="Jl. Mawar No. 12, RT 01/RW 02"
								class="w-full bg-secondary/60 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
							/>
						</div>
					</div>
				</div>

				<!-- BAGIAN 3: DATA ANGGOTA KELUARGA -->
				<div class="p-4 rounded-xl border border-border bg-secondary/20 space-y-3">
					<div class="flex items-center justify-between">
						<h4 class="text-xs font-bold text-foreground flex items-center gap-1.5">
							<Users class="w-3.5 h-3.5 text-primary" />
							3. Data Anggota Keluarga ({newAnggotaList.length} Jiwa)
						</h4>
						<button
							type="button"
							onclick={addAnggotaRow}
							class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 text-xs font-semibold transition-colors"
						>
							<Plus class="w-3.5 h-3.5" />
							<span>Tambah Anggota</span>
						</button>
					</div>

					<div class="space-y-3 max-h-60 overflow-y-auto pr-1">
						{#each newAnggotaList as anggota, idx}
							<div class="p-3 rounded-lg border border-border bg-card space-y-2">
								<div class="flex items-center justify-between text-xs font-semibold text-foreground">
									<span>Anggota #{idx + 1} ({anggota.statusHubungan})</span>
									{#if idx > 0}
										<button
											type="button"
											onclick={() => removeAnggotaRow(idx)}
											class="text-destructive hover:text-destructive/80 p-0.5"
											title="Hapus baris"
										>
											<Trash2 class="w-3.5 h-3.5" />
										</button>
									{/if}
								</div>

								<div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
									<div>
										<label for={`new-status-${idx}`} class="block text-[10px] text-foreground/60 mb-0.5">Status *</label>
										<select
											id={`new-status-${idx}`}
											bind:value={anggota.statusHubungan}
											required
											class="w-full bg-secondary/50 border border-border rounded-lg px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
										>
											<option value="Kepala Keluarga">Kepala Keluarga</option>
											<option value="Suami">Suami</option>
											<option value="Istri">Istri</option>
											<option value="Anak">Anak</option>
											<option value="Orang Tua">Orang Tua</option>
											<option value="Famili Lain">Famili Lain</option>
										</select>
									</div>

									<div>
										<label for={`new-nik-${idx}`} class="block text-[10px] text-foreground/60 mb-0.5">NIK (16 Digit) *</label>
										<input
											id={`new-nik-${idx}`}
											type="text"
											maxlength="16"
											pattern="[0-9]{16}"
											required
											bind:value={anggota.nik}
											placeholder="3216xxxxxxxxxxxx"
											class="w-full bg-secondary/50 border border-border rounded-lg px-2 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
										/>
									</div>

									<div>
										<label for={`new-tgl-${idx}`} class="block text-[10px] text-foreground/60 mb-0.5">Tgl Lahir *</label>
										<input
											id={`new-tgl-${idx}`}
											type="date"
											required
											bind:value={anggota.tanggalLahir}
											class="w-full bg-secondary/50 border border-border rounded-lg px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
										/>
									</div>

									<div>
										<label for={`new-jk-${idx}`} class="block text-[10px] text-foreground/60 mb-0.5">Jenis Kelamin *</label>
										<select
											id={`new-jk-${idx}`}
											bind:value={anggota.jenisKelamin}
											required
											class="w-full bg-secondary/50 border border-border rounded-lg px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
										>
											<option value="Laki-laki">Laki-laki</option>
											<option value="Perempuan">Perempuan</option>
										</select>
									</div>
								</div>
							</div>
						{/each}
					</div>
				</div>

				<div class="flex items-center justify-end gap-2 pt-3 border-t border-border">
					<button
						type="button"
						onclick={() => (showCreateModal = false)}
						class="px-4 py-2 rounded-lg border border-border text-xs font-semibold text-foreground/80 hover:bg-secondary"
					>
						Batal
					</button>
					<button
						type="submit"
						class="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 shadow-sm"
					>
						Simpan Sensus & Buat Akun
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- MODAL TAMBAH ANGGOTA KELUARGA (UNTUK KK YANG TELAH DIBUAT) -->
{#if showAddMemberModal && targetKeluargaForMember}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
		role="dialog"
		aria-modal="true"
		onclick={(e) => {
			if (e.target === e.currentTarget) showAddMemberModal = false;
		}}
	>
		<div class="bg-card border border-border rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
			<div class="flex items-center justify-between pb-3 border-b border-border">
				<div>
					<h3 class="text-sm font-bold text-foreground">Tambah Anggota Keluarga</h3>
					<p class="text-[11px] text-foreground/60 font-mono mt-0.5">
						KK: {targetKeluargaForMember.noKkMasked} ({targetKeluargaForMember.kepalaKeluargaNama})
					</p>
				</div>
				<button
					type="button"
					onclick={() => (showAddMemberModal = false)}
					class="p-1 rounded-lg hover:bg-secondary text-foreground/60 hover:text-foreground"
				>
					<X class="w-5 h-5" />
				</button>
			</div>

			<form method="POST" action="?/addAnggotaKeluarga" class="space-y-3 text-xs">
				<input type="hidden" name="keluargaId" value={targetKeluargaForMember.id} />

				<div>
					<label for="memberStatus" class="block font-semibold text-foreground mb-1">
						Status Hubungan Keluarga *
					</label>
					<select
						id="memberStatus"
						name="statusHubungan"
						required
						bind:value={memberStatus}
						class="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
					>
						<option value="Istri">Istri</option>
						<option value="Anak">Anak</option>
						<option value="Suami">Suami</option>
						<option value="Orang Tua">Orang Tua</option>
						<option value="Kepala Keluarga">Kepala Keluarga</option>
						<option value="Famili Lain">Famili Lain</option>
					</select>
				</div>

				<div>
					<label for="memberNik" class="block font-semibold text-foreground mb-1">
						NIK (16 Digit Angka) *
					</label>
					<input
						id="memberNik"
						name="nik"
						type="text"
						maxlength="16"
						pattern="[0-9]{16}"
						required
						bind:value={memberNik}
						placeholder="3216xxxxxxxxxxxx"
						class="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
					/>
				</div>

				<div>
					<label for="memberTgl" class="block font-semibold text-foreground mb-1">
						Tanggal Lahir *
					</label>
					<input
						id="memberTgl"
						name="tanggalLahir"
						type="date"
						required
						bind:value={memberTanggalLahir}
						class="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
					/>
				</div>

				<div>
					<label for="memberJk" class="block font-semibold text-foreground mb-1">
						Jenis Kelamin *
					</label>
					<select
						id="memberJk"
						name="jenisKelamin"
						required
						bind:value={memberJenisKelamin}
						class="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
					>
						<option value="Laki-laki">Laki-laki</option>
						<option value="Perempuan">Perempuan</option>
					</select>
				</div>

				<div class="flex items-center justify-end gap-2 pt-3 border-t border-border">
					<button
						type="button"
						onclick={() => (showAddMemberModal = false)}
						class="px-4 py-2 rounded-lg border border-border text-xs font-semibold text-foreground/80 hover:bg-secondary"
					>
						Batal
					</button>
					<button
						type="submit"
						class="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90"
					>
						Simpan Anggota
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- MODAL DETAIL ANGGOTA KELUARGA & UNMASK -->
{#if selectedKeluarga}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
		role="dialog"
		aria-modal="true"
		onclick={(e) => {
			if (e.target === e.currentTarget) selectedKeluarga = null;
		}}
	>
		<div class="bg-card border border-border rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-5">
			<div class="flex items-center justify-between pb-3 border-b border-border">
				<div>
					<div class="flex items-center gap-2">
						<h3 class="text-sm font-bold text-foreground">Rincian Anggota Kartu Keluarga</h3>
						<span class="text-[10px] bg-secondary px-2 py-0.5 rounded-full text-foreground/70 font-semibold">
							{selectedKeluarga.anggota.length} Jiwa
						</span>
					</div>
					<p class="text-xs text-foreground/60 font-mono mt-0.5">{selectedKeluarga.noKkMasked} • {selectedKeluarga.kepalaKeluargaNama}</p>
				</div>
				<button
					type="button"
					onclick={() => (selectedKeluarga = null)}
					class="p-1 rounded-lg hover:bg-secondary text-foreground/60 hover:text-foreground"
				>
					<X class="w-5 h-5" />
				</button>
			</div>

			<div class="space-y-2.5 max-h-80 overflow-y-auto pr-1">
				{#each selectedKeluarga.anggota as a}
					<div class="p-3 rounded-xl border border-border bg-secondary/30 flex items-center justify-between text-xs">
						<div>
							<div class="flex items-center gap-2">
								<span class="font-semibold text-foreground">{a.statusHubungan}</span>
								<span class="text-[10px] bg-secondary px-1.5 py-0.5 rounded text-foreground/70">
									{a.jenisKelamin}
								</span>
							</div>
							<div class="flex items-center gap-2 mt-1">
								<span class="font-mono text-[11px] text-foreground/70">NIK: {a.nikMasked}</span>
								<button
									type="button"
									onclick={() => requestUnmask({ anggotaId: a.id, label: `NIK (${a.statusHubungan})` })}
									class="text-primary hover:text-primary/80 p-0.5 rounded hover:bg-primary/10 transition-colors"
									title="Buka Enkripsi NIK"
								>
									<Eye class="w-3.5 h-3.5" />
								</button>
							</div>
							<p class="text-[10px] text-foreground/50 mt-0.5">Tgl Lahir: {formatDateDDMMYYYY(a.tanggalLahir)}</p>
						</div>
					</div>
				{/each}
			</div>

			<div class="flex items-center justify-between pt-3 border-t border-border">
				<button
					type="button"
					onclick={() => {
						const target = selectedKeluarga;
						selectedKeluarga = null;
						if (target) openAddMemberModal(target);
					}}
					class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-foreground hover:bg-secondary"
				>
					<UserPlus class="w-3.5 h-3.5 text-primary" />
					<span>+ Tambah Anggota</span>
				</button>

				<button
					type="button"
					onclick={() => (selectedKeluarga = null)}
					class="px-4 py-1.5 rounded-lg bg-secondary text-foreground text-xs font-semibold hover:bg-secondary/80"
				>
					Tutup
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- MODAL UNMASK RESULT -->
{#if showUnmaskModal}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
		role="dialog"
		aria-modal="true"
		onclick={(e) => {
			if (e.target === e.currentTarget) {
				showUnmaskModal = false;
				unmaskedData = null;
			}
		}}
	>
		<div class="bg-card border border-border rounded-2xl max-w-sm w-full p-6 shadow-xl space-y-4 text-center">
			<div class="w-10 h-10 rounded-full bg-primary/10 text-primary mx-auto flex items-center justify-center">
				<Eye class="w-5 h-5" />
			</div>

			<div>
				<h3 class="text-sm font-bold text-foreground">Dekripsi Data Sensitif Berhasil</h3>
				<p class="text-[11px] text-foreground/60 mt-1">Data asli dibuka melalui enkripsi AES-256-GCM.</p>
			</div>

			<div class="p-4 rounded-xl bg-secondary/50 border border-border">
				{#if unmaskLoading}
					<p class="text-xs text-foreground/60 animate-pulse">Sedang mendekripsi dari database...</p>
				{:else if unmaskedData}
					<span class="block text-[11px] text-foreground/60 mb-1">{unmaskedData.label}</span>
					<span class="font-mono text-base font-bold text-primary tracking-wider select-all">
						{unmaskedData.value}
					</span>
				{/if}
			</div>

			<button
				type="button"
				onclick={() => {
					showUnmaskModal = false;
					unmaskedData = null;
				}}
				class="w-full py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
			>
				Tutup
			</button>
		</div>
	</div>
{/if}
