<!--
  @file src/routes/(admin)/admin/keuangan/template-fr/+page.svelte
  @purpose Halaman manajemen template infaq/shodaqoh rutin (FR/Isrun), hierarki pos anggaran fleksibel (4 Hak Wajib + kustom sub-pos), pengaturan paket bundle tarif, serta assignment massal dan penyesuaian granular per-jamaah
  @usedBy Route admin '/admin/keuangan/template-fr'
  @dependencies @lucide/svelte, $app/forms (enhance), $lib/components/SearchableSelect.svelte, $lib/confirm.svelte, $lib/keepScroll.ts, Svelte 5 Runes
  @publicFunctions switchTab, openCreateTemplateModal, openCreateBundleModal, openCreatePosModal, openEditJamaahModal, toggleSelectAll, toggleSelectJamaah
  @sideEffects Mengirim server action POST untuk template, pos, bundle, dan tarif jamaah dengan posisi scroll terjaga
-->
<script lang="ts">
	import { enhance } from '$app/forms';
	import { keepScrollSubmit } from '$lib/keepScroll';
	import { confirmAction } from '$lib/confirm.svelte';
	import SearchableSelect from '$lib/components/SearchableSelect.svelte';
	import {
		AlertCircle,
		Check,
		CheckCircle2,
		Coins,
		Edit3,
		FileSpreadsheet,
		Filter,
		FolderTree,
		HandCoins,
		Layers,
		Package,
		Plus,
		Search,
		Settings,
		ShieldCheck,
		Trash2,
		UserCheck,
		Users,
		Wallet,
		X
	} from '@lucide/svelte';
	import type { PageData, ActionData } from './$types';

	let { data, form } = $props<{ data: PageData; form: ActionData }>();

	// Mode Tab Aktif: 'template' atau 'pos'
	let activeTab = $state<'template' | 'pos'>('template');

	// State Pencarian Jamaah
	let searchJamaah = $state('');

	// State Checkbox Multi-Select Jamaah untuk Fast Bundle Assignment
	let selectedAnggotaIds = $state<string[]>([]);

	// State Modal Template
	let showTemplateModal = $state(false);
	let newTemplateNama = $state('');
	let newTemplateTahun = $state(data.tahun);
	let newTemplateBulanMulai = $state(1);
	let newTemplateBulanSelesai = $state(12);
	let newTemplateNominalMin = $state(50000);
	let newTemplateCatatan = $state('');

	// State Modal Bundle
	let showBundleModal = $state(false);
	let editingBundleId = $state<string | null>(null);
	let bundleNama = $state('');
	let bundleNominal = $state(100000);
	let bundleDeskripsi = $state('');

	// State Modal Pos Anggaran Baru
	let showPosModal = $state(false);
	let newPosNama = $state('');
	let newPosKode = $state('');
	let newPosParentId = $state<string | null>(null);
	let newPosDeskripsi = $state('');

	// State Modal Masukkan Pos ke Template
	let showAddPosToTemplateModal = $state(false);
	let selectedAddPosId = $state('');
	let addPosNominalTarget = $state(0);
	let addPosPersentaseSplit = $state(0);

	// State Modal Edit Tarif Khusus Jamaah
	let showEditJamaahModal = $state(false);
	let editingJamaah = $state<{
		anggotaId: string;
		namaLengkap: string;
		nominalTarget: number;
		catatan: string | null;
	} | null>(null);
	let editJamaahNominal = $state(0);
	let editJamaahCatatan = $state('');

	// State Bundle terpilih untuk bulk assignment
	let selectedBulkBundleId = $state('');
	let isSubmitting = $state(false);

	// Format Rupiah Helper
	function formatRupiah(num: number): string {
		return new Intl.NumberFormat('id-ID', {
			style: 'currency',
			currency: 'IDR',
			maximumFractionDigits: 0
		}).format(num || 0);
	}

	// Opsi Kelompok untuk Dropdown
	const kelompokOptions = $derived(
		(data.accessibleWilayah.kelompokList || []).map((k: any) => ({
			value: k.id,
			label: k.nama,
			sublabel: k.desaNama ? `Desa ${k.desaNama}` : undefined
		}))
	);

	// Filter Daftar Jamaah
	const filteredJamaahList = $derived(
		(data.jamaahTarifList || []).filter((j: any) => {
			const q = searchJamaah.toLowerCase();
			return (
				j.namaLengkap.toLowerCase().includes(q) ||
				j.kepalaKeluargaNama.toLowerCase().includes(q) ||
				(j.bundleNama || '').toLowerCase().includes(q)
			);
		})
	);

	// Toggle Pilih Semua Jamaah Terfilter
	function toggleSelectAll() {
		if (selectedAnggotaIds.length === filteredJamaahList.length) {
			selectedAnggotaIds = [];
		} else {
			selectedAnggotaIds = filteredJamaahList.map((j: any) => j.anggotaId);
		}
	}

	function toggleSelectJamaah(id: string) {
		if (selectedAnggotaIds.includes(id)) {
			selectedAnggotaIds = selectedAnggotaIds.filter((item) => item !== id);
		} else {
			selectedAnggotaIds = [...selectedAnggotaIds, id];
		}
	}

	function handleKelompokChange(val: string | number) {
		const targetUrl = new URL(window.location.href);
		targetUrl.searchParams.set('kelompokId', String(val));
		window.location.href = targetUrl.toString();
	}

	function handleTahunChange(e: Event) {
		const targetUrl = new URL(window.location.href);
		targetUrl.searchParams.set('tahun', (e.target as HTMLSelectElement).value);
		window.location.href = targetUrl.toString();
	}

	function handleTemplateChange(e: Event) {
		const targetUrl = new URL(window.location.href);
		targetUrl.searchParams.set('templateId', (e.target as HTMLSelectElement).value);
		window.location.href = targetUrl.toString();
	}

	function openCreateTemplateModal() {
		newTemplateNama = `Template FR ${data.tahun}`;
		newTemplateTahun = data.tahun;
		newTemplateBulanMulai = 1;
		newTemplateBulanSelesai = 12;
		newTemplateNominalMin = 50000;
		newTemplateCatatan = '';
		showTemplateModal = true;
	}

	function openCreateBundleModal() {
		editingBundleId = null;
		bundleNama = '';
		bundleNominal = 100000;
		bundleDeskripsi = '';
		showBundleModal = true;
	}

	function openEditBundleModal(b: typeof data.bundleList[number]) {
		editingBundleId = b.id;
		bundleNama = b.nama;
		bundleNominal = b.nominal;
		bundleDeskripsi = b.deskripsi || '';
		showBundleModal = true;
	}

	function openCreatePosModal(parentId: string | null = null) {
		newPosNama = '';
		newPosKode = '';
		newPosParentId = parentId;
		newPosDeskripsi = '';
		showPosModal = true;
	}

	function openEditJamaahModal(j: typeof data.jamaahTarifList[number]) {
		editingJamaah = j;
		editJamaahNominal = j.nominalTarget;
		editJamaahCatatan = j.catatan || '';
		showEditJamaahModal = true;
	}
</script>

<svelte:head>
	<title>Template Infaq & Pos FR Rutin - Admin Satu Generus</title>
</svelte:head>

<div class="space-y-5 p-2 sm:p-4 max-w-7xl mx-auto">
	<!-- HEADER UTAMA -->
	<div class="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-card border border-border p-4 sm:p-5 rounded-2xl shadow-xs">
		<div class="space-y-1">
			<div class="flex items-center gap-2">
				<div class="p-2 rounded-xl bg-primary/10 text-primary">
					<Layers class="w-5 h-5" />
				</div>
				<h1 class="text-base sm:text-lg font-bold text-foreground tracking-tight">
					Template & Pos Infaq/FR Rutin
				</h1>
			</div>
			<p class="text-xs text-foreground/60 leading-relaxed">
				Kelola hierarki pos anggaran fleksibel (termasuk 4 Hak Wajib), buat template tentatif/tahunan, atur paket bundle tarif, serta nominal target per-jamaah.
			</p>
		</div>

		<!-- Tombol Aksi Cepat ke Halaman FR -->
		<div class="flex items-center gap-2 flex-wrap">
			<a
				href="/admin/keuangan/fr-jamaah{data.selectedKelompokId ? `?kelompokId=${data.selectedKelompokId}` : ''}"
				class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-xs transition-colors shadow-xs"
			>
				<HandCoins class="w-4 h-4" />
				<span>Input FR Jamaah</span>
			</a>
			<a
				href="/admin/keuangan/laporan-fr{data.selectedKelompokId ? `?kelompokId=${data.selectedKelompokId}` : ''}"
				class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground font-semibold text-xs transition-colors shadow-xs"
			>
				<FileSpreadsheet class="w-4 h-4 text-primary" />
				<span>Laporan FR</span>
			</a>
		</div>
	</div>

	<!-- FLASH MESSAGES -->
	{#if form?.error}
		<div class="flex items-start gap-2.5 p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs">
			<AlertCircle class="w-4 h-4 shrink-0 mt-0.5" />
			<span>{form.error}</span>
		</div>
	{/if}
	{#if form?.message}
		<div class="flex items-start gap-2.5 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-medium">
			<CheckCircle2 class="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
			<span>{form.message}</span>
		</div>
	{/if}

	<!-- BAR FILTER: KELOMPOK & TAHUN -->
	<div class="bg-card border border-border p-3.5 sm:p-4 rounded-xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
		<div class="flex flex-col sm:flex-row sm:items-center gap-3 w-full md:w-auto">
			<div class="w-full sm:w-64">
				<label for="kelompokSelect" class="block text-[11px] font-bold text-foreground/80 mb-1">
					Kelompok yang Dikelola:
				</label>
				<SearchableSelect
					id="kelompokSelect"
					name="kelompokSelect"
					options={kelompokOptions}
					value={data.selectedKelompokId || ''}
					onchange={handleKelompokChange}
					placeholder="-- Pilih Kelompok --"
					searchPlaceholder="Cari nama kelompok..."
				/>
			</div>

			<div class="w-28">
				<label for="tahunSelect" class="block text-[11px] font-bold text-foreground/80 mb-1">
					Tahun:
				</label>
				<select
					id="tahunSelect"
					value={data.tahun}
					onchange={handleTahunChange}
					class="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:ring-1 focus:ring-primary"
				>
					{#each [data.tahun - 1, data.tahun, data.tahun + 1] as y}
						<option value={y}>{y}</option>
					{/each}
				</select>
			</div>
		</div>

		<!-- Navigasi Tab -->
		<div class="flex items-center gap-1.5 border border-border p-1 bg-secondary/30 rounded-xl">
			<button
				type="button"
				onclick={() => (activeTab = 'template')}
				class="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all {activeTab === 'template'
					? 'bg-card text-foreground shadow-xs'
					: 'text-foreground/60 hover:text-foreground'}"
			>
				<Package class="w-3.5 h-3.5 text-primary" />
				<span>Template & Target Jamaah</span>
			</button>

			<button
				type="button"
				onclick={() => (activeTab = 'pos')}
				class="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all {activeTab === 'pos'
					? 'bg-card text-foreground shadow-xs'
					: 'text-foreground/60 hover:text-foreground'}"
			>
				<FolderTree class="w-3.5 h-3.5 text-primary" />
				<span>Hierarki Pos Anggaran</span>
			</button>
		</div>
	</div>

	<!-- ============================================================== -->
	<!-- TAB 1: TEMPLATE ANGGARAN, BUNDLE TARIF & TARGET JAMAAH         -->
	<!-- ============================================================== -->
	{#if activeTab === 'template'}
		<div class="space-y-6">
			<!-- Bar Pemilihan Template -->
			<div class="bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
				<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/70 pb-3">
					<div>
						<h2 class="text-sm font-bold text-foreground flex items-center gap-2">
							<span>Template Infaq Rutin Aktif</span>
							{#if data.selectedTemplate}
								<span class="text-[10.5px] px-2 py-0.5 rounded-full font-bold bg-primary/10 text-primary">
									Tahun {data.selectedTemplate.tahun} (Bulan {data.selectedTemplate.bulanMulai} - {data.selectedTemplate.bulanSelesai})
								</span>
							{/if}
						</h2>
						<p class="text-xs text-foreground/60 mt-0.5">
							Pilih template aktif untuk mengatur target pos, paket tarif bundle, dan besaran infaq rutin jamaah.
						</p>
					</div>

					<div class="flex items-center gap-2">
						{#if data.templateList.length > 1}
							<select
								value={data.selectedTemplate?.id || ''}
								onchange={handleTemplateChange}
								class="bg-secondary/50 border border-border rounded-xl px-3 py-1.5 text-xs text-foreground font-semibold"
							>
								{#each data.templateList as t}
									<option value={t.id}>{t.nama} ({t.status})</option>
								{/each}
							</select>
						{/if}

						{#if data.canEdit}
							<button
								type="button"
								onclick={openCreateTemplateModal}
								class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-xs transition-all"
							>
								<Plus class="w-3.5 h-3.5" />
								<span>Buat Template Baru</span>
							</button>
						{/if}
					</div>
				</div>

				{#if !data.selectedTemplate}
					<div class="text-center py-10 text-xs text-foreground/50 border border-dashed border-border rounded-xl space-y-2">
						<Package class="w-8 h-8 text-foreground/30 mx-auto" />
						<p>Belum ada template infaq rutin untuk kelompok dan tahun ini.</p>
						{#if data.canEdit}
							<button
								type="button"
								onclick={openCreateTemplateModal}
								class="text-primary font-semibold hover:underline"
							>
								+ Buat Template Pertama (Otomatis memuat 4 Hak Wajib)
							</button>
						{/if}
					</div>
				{:else}
					<!-- Ringkasan Info Template -->
					<div class="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
						<div class="bg-secondary/30 border border-border/80 rounded-xl p-3 space-y-1">
							<span class="text-[11px] text-foreground/60">Nama Template</span>
							<div class="text-xs font-bold text-foreground">{data.selectedTemplate.nama}</div>
						</div>
						<div class="bg-secondary/30 border border-border/80 rounded-xl p-3 space-y-1">
							<span class="text-[11px] text-foreground/60">Acuan Nominal Minimum</span>
							<div class="text-xs font-bold text-primary font-mono">
								{formatRupiah(data.selectedTemplate.nominalMinimumDefault)} / jiwa
							</div>
						</div>
						<div class="bg-secondary/30 border border-border/80 rounded-xl p-3 space-y-1">
							<span class="text-[11px] text-foreground/60">Status & Periode</span>
							<div class="text-xs font-bold text-foreground flex items-center gap-2">
								<span class="capitalize">{data.selectedTemplate.status}</span>
								<span class="text-foreground/40">•</span>
								<span>Bulan {data.selectedTemplate.bulanMulai} s.d {data.selectedTemplate.bulanSelesai}</span>
							</div>
						</div>
					</div>
				{/if}
			</div>

			{#if data.selectedTemplate}
				<!-- BAGIAN A: PAKET / BUNDLE TARIF -->
				<section class="bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
					<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/70 pb-3">
						<div>
							<h3 class="text-sm font-bold text-foreground flex items-center gap-2">
								<Package class="w-4 h-4 text-primary" />
								<span>Paket / Bundle Tarif Acuan</span>
								<span class="text-[10.5px] px-2 py-0.5 rounded-full font-bold bg-primary/10 text-primary">
									{data.bundleList.length} Paket
								</span>
							</h3>
							<p class="text-xs text-foreground/60 mt-0.5">
								Paket tarif ini digunakan untuk mempercepat pengisian nominal target jamaah secara berkelompok/massal.
							</p>
						</div>

						{#if data.canEdit}
							<button
								type="button"
								onclick={openCreateBundleModal}
								class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 border border-border text-foreground text-xs font-semibold transition-all"
							>
								<Plus class="w-3.5 h-3.5 text-primary" />
								<span>Tambah Paket Bundle</span>
							</button>
						{/if}
					</div>

					<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
						{#each data.bundleList as b}
							<div class="border border-border/80 bg-background rounded-xl p-3.5 space-y-2 flex flex-col justify-between">
								<div class="space-y-1">
									<div class="flex items-center justify-between">
										<span class="text-xs font-bold text-foreground">{b.nama}</span>
										{#if data.canEdit}
											<div class="flex items-center gap-1">
												<button
													type="button"
													onclick={() => openEditBundleModal(b)}
													class="p-1 rounded text-foreground/50 hover:text-foreground"
													title="Edit Bundle"
												>
													<Edit3 class="w-3 h-3" />
												</button>
												<form
													method="POST"
													action="?/deleteBundle"
													use:enhance={keepScrollSubmit()}
												>
													<input type="hidden" name="bundleId" value={b.id} />
													<input type="hidden" name="kelompokId" value={data.selectedKelompokId} />
													<button
														type="button"
														onclick={async (e) => {
															const formEl = (e.currentTarget as HTMLButtonElement).closest('form');
															const ok = await confirmAction({
																title: 'Hapus Paket Bundle?',
																message: `Apakah Anda yakin ingin menghapus paket "${b.nama}"?`,
																confirmText: 'Ya, Hapus',
																variant: 'danger'
															});
															if (ok && formEl) formEl.requestSubmit();
														}}
														class="p-1 rounded text-foreground/40 hover:text-destructive"
														title="Hapus Bundle"
													>
														<Trash2 class="w-3 h-3" />
													</button>
												</form>
											</div>
										{/if}
									</div>
									<div class="text-sm font-extrabold text-primary font-mono">
										{formatRupiah(b.nominal)}
									</div>
									{#if b.deskripsi}
										<p class="text-[11px] text-foreground/60 leading-relaxed">{b.deskripsi}</p>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				</section>

				<!-- BAGIAN B: DAFTAR JAMAAH & TARGET NOMINAL (GRANULAR + BULK ASSIGNMENT) -->
				<section class="bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
					<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/70 pb-3">
						<div>
							<h3 class="text-sm font-bold text-foreground flex items-center gap-2">
								<Users class="w-4 h-4 text-primary" />
								<span>Daftar Target Infaq Jamaah</span>
								<span class="text-[10.5px] px-2 py-0.5 rounded-full font-bold bg-primary/10 text-primary">
									{data.jamaahTarifList.length} Jamaah Wajib Isrun
								</span>
							</h3>
							<p class="text-xs text-foreground/60 mt-0.5">
								Setiap jamaah memiliki target nominal masing-masing. Terapkan bundle untuk pengisian cepat atau ubah manual perorangan.
							</p>
						</div>

						<div class="w-full sm:w-64">
							<div class="relative">
								<Search class="w-3.5 h-3.5 text-foreground/40 absolute left-3 top-1/2 -translate-y-1/2" />
								<input
									type="text"
									placeholder="Cari jamaah / KK..."
									bind:value={searchJamaah}
									class="w-full bg-secondary/50 border border-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-foreground focus:ring-1 focus:ring-primary"
								/>
							</div>
						</div>
					</div>

					<!-- ACTION BAR JIKA ADA JAMAAH YANG DICENTANG -->
					{#if selectedAnggotaIds.length > 0 && data.canEdit}
						<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 rounded-xl bg-primary/10 border border-primary/20">
							<div class="text-xs font-bold text-primary flex items-center gap-2">
								<CheckCircle2 class="w-4 h-4" />
								<span>{selectedAnggotaIds.length} jamaah terpilih</span>
							</div>

							<form
								method="POST"
								action="?/assignBundleToJamaah"
								use:enhance={keepScrollSubmit({
									onSuccess: () => { selectedAnggotaIds = []; }
								})}
								class="flex items-center gap-2"
							>
								<input type="hidden" name="templateId" value={data.selectedTemplate.id} />
								<input type="hidden" name="kelompokId" value={data.selectedKelompokId} />
								<input type="hidden" name="anggotaIds" value={selectedAnggotaIds.join(',')} />

								<select
									name="bundleId"
									bind:value={selectedBulkBundleId}
									required
									class="bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground font-semibold"
								>
									<option value="">-- Pilih Paket Bundle --</option>
									{#each data.bundleList as b}
										<option value={b.id}>{b.nama} ({formatRupiah(b.nominal)})</option>
									{/each}
								</select>

								<button
									type="submit"
									disabled={!selectedBulkBundleId}
									class="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-all disabled:opacity-50"
								>
									Terapkan ke Jamaah Terpilih
								</button>
							</form>
						</div>
					{/if}

					<!-- TABEL JAMAAH -->
					<div class="overflow-x-auto border border-border/80 rounded-xl">
						<table class="w-full text-xs text-left">
							<thead class="bg-secondary/40 text-foreground/70 font-semibold border-b border-border">
								<tr>
									{#if data.canEdit}
										<th class="p-3 w-10 text-center">
											<input
												type="checkbox"
												checked={selectedAnggotaIds.length > 0 && selectedAnggotaIds.length === filteredJamaahList.length}
												onchange={toggleSelectAll}
												class="rounded border-border"
											/>
										</th>
									{/if}
									<th class="p-3">Nama Jamaah</th>
									<th class="p-3">Kepala Keluarga</th>
									<th class="p-3">Status Bundle</th>
									<th class="p-3 text-right">Target Nominal / Bulan</th>
									<th class="p-3 text-center">Status Tarif</th>
									{#if data.canEdit}
										<th class="p-3 text-center w-20">Aksi</th>
									{/if}
								</tr>
							</thead>
							<tbody class="divide-y divide-border/60">
								{#each filteredJamaahList as j}
									<tr class="hover:bg-secondary/20 transition-colors">
										{#if data.canEdit}
											<td class="p-3 text-center">
												<input
													type="checkbox"
													checked={selectedAnggotaIds.includes(j.anggotaId)}
													onchange={() => toggleSelectJamaah(j.anggotaId)}
													class="rounded border-border"
												/>
											</td>
										{/if}
										<td class="p-3">
											<div class="font-bold text-foreground">{j.namaLengkap}</div>
											<div class="text-[11px] text-foreground/50">{j.statusHubungan}</div>
										</td>
										<td class="p-3 text-foreground/80">{j.kepalaKeluargaNama}</td>
										<td class="p-3">
											{#if j.bundleNama}
												<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary text-foreground text-[11px] font-medium border border-border">
													<Package class="w-3 h-3 text-primary" />
													<span>{j.bundleNama}</span>
												</span>
											{:else}
												<span class="text-[11px] text-foreground/40 italic">Tanpa bundle</span>
											{/if}
										</td>
										<td class="p-3 text-right font-mono font-bold text-foreground">
											{formatRupiah(j.nominalTarget)}
										</td>
										<td class="p-3 text-center">
											{#if j.isCustom}
												<span class="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400">
													Manual Khusus
												</span>
											{:else}
												<span class="px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-secondary text-foreground/60">
													Standar Bundle
												</span>
											{/if}
										</td>
										{#if data.canEdit}
											<td class="p-3 text-center">
												<button
													type="button"
													onclick={() => openEditJamaahModal(j)}
													class="p-1.5 rounded-lg text-primary hover:bg-primary/10 transition-colors"
													title="Atur Angka Manual"
												>
													<Edit3 class="w-3.5 h-3.5" />
												</button>
											</td>
										{/if}
									</tr>
								{:else}
									<tr>
										<td colspan="7" class="text-center py-8 text-foreground/40">
											Tidak ada data jamaah yang sesuai.
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</section>
			{/if}
		</div>
	{/if}

	<!-- ============================================================== -->
	<!-- TAB 2: STRUKTUR HIERARKI POS ANGGARAN (4 HAK WAJIB & KUSTOM)   -->
	<!-- ============================================================== -->
	{#if activeTab === 'pos'}
		<div class="space-y-6">
			<section class="bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
				<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/70 pb-3">
					<div>
						<h2 class="text-sm font-bold text-foreground flex items-center gap-2">
							<FolderTree class="w-4 h-4 text-primary" />
							<span>Pohon Hierarki Pos Anggaran Infaq</span>
						</h2>
						<p class="text-xs text-foreground/60 mt-0.5">
							Fondasi anggaran terdiri atas 4 Hak Wajib dan pos-pos tambahan yang dapat dibuat bercabang (induk & sub-pos).
						</p>
					</div>

					{#if data.canEdit}
						<button
							type="button"
							onclick={() => openCreatePosModal(null)}
							class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-xs transition-all"
						>
							<Plus class="w-3.5 h-3.5" />
							<span>Tambah Pos Induk Baru</span>
						</button>
					{/if}
				</div>

				<div class="space-y-2.5">
					{#each data.posList as p}
						<div class="flex items-center justify-between p-3.5 rounded-xl border border-border bg-background hover:border-primary/40 transition-all">
							<div class="flex items-center gap-3">
								<div class="p-2 rounded-lg {p.isWajib ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' : 'bg-primary/10 text-primary'}">
									{#if p.isWajib}
										<ShieldCheck class="w-4 h-4" />
									{:else}
										<FolderTree class="w-4 h-4" />
									{/if}
								</div>
								<div>
									<div class="flex items-center gap-2">
										<span class="text-xs font-bold text-foreground">{p.nama}</span>
										<span class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-secondary text-foreground/60">
											{p.kode}
										</span>
										{#if p.isWajib}
											<span class="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400">
												Hak Wajib
											</span>
										{/if}
									</div>
									{#if p.deskripsi}
										<p class="text-[11px] text-foreground/50 mt-0.5">{p.deskripsi}</p>
									{/if}
								</div>
							</div>

							{#if data.canEdit}
								<div class="flex items-center gap-2">
									<button
										type="button"
										onclick={() => openCreatePosModal(p.id)}
										class="inline-flex items-center gap-1 text-[11px] text-primary hover:underline font-semibold"
										title="Tambah Sub-Pos di bawah pos ini"
									>
										<Plus class="w-3 h-3" />
										<span>Sub-Pos</span>
									</button>

									{#if !p.isWajib}
										<form
											method="POST"
											action="?/deletePos"
											use:enhance={keepScrollSubmit()}
										>
											<input type="hidden" name="posId" value={p.id} />
											<input type="hidden" name="kelompokId" value={data.selectedKelompokId} />
											<button
												type="button"
												onclick={async (e) => {
													const formEl = (e.currentTarget as HTMLButtonElement).closest('form');
													const ok = await confirmAction({
														title: 'Hapus Pos Anggaran?',
														message: `Apakah Anda yakin ingin menghapus pos "${p.nama}"?`,
														confirmText: 'Ya, Hapus',
														variant: 'danger'
													});
													if (ok && formEl) formEl.requestSubmit();
												}}
												class="p-1.5 rounded-lg text-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors"
												title="Hapus Pos"
											>
												<Trash2 class="w-3.5 h-3.5" />
											</button>
										</form>
									{/if}
								</div>
							{/if}
						</div>
					{/each}
				</div>
			</section>
		</div>
	{/if}
</div>

<!-- ============================================================== -->
<!-- MODAL 1: BUAT TEMPLATE BARU                                    -->
<!-- ============================================================== -->
{#if showTemplateModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
		<div class="bg-card border border-border rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4">
			<div class="flex items-center justify-between border-b border-border pb-3">
				<h3 class="text-sm font-bold text-foreground">Buat Template Infaq Rutin</h3>
				<button
					type="button"
					onclick={() => (showTemplateModal = false)}
					class="p-1 rounded-lg text-foreground/50 hover:text-foreground"
				>
					<X class="w-4 h-4" />
				</button>
			</div>

			<form
				method="POST"
				action="?/createTemplate"
				use:enhance={keepScrollSubmit({
					beforeSubmit: () => { isSubmitting = true; },
					onFinally: () => { isSubmitting = false; },
					onSuccess: () => { showTemplateModal = false; }
				})}
				class="space-y-3.5 text-xs"
			>
				<input type="hidden" name="kelompokId" value={data.selectedKelompokId} />

				<div>
					<label for="tmplNama" class="block font-semibold text-foreground/80 mb-1">
						Nama Template <span class="text-destructive">*</span>
					</label>
					<input
						id="tmplNama"
						name="nama"
						type="text"
						required
						bind:value={newTemplateNama}
						placeholder="Contoh: Template FR 2026 / Perubahan Q3"
						class="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:ring-1 focus:ring-primary"
					/>
				</div>

				<div class="grid grid-cols-3 gap-2">
					<div>
						<label for="tmplTahun" class="block font-semibold text-foreground/80 mb-1">Tahun</label>
						<input
							id="tmplTahun"
							name="tahun"
							type="number"
							required
							bind:value={newTemplateTahun}
							class="w-full bg-secondary/50 border border-border rounded-lg px-2.5 py-2 text-xs text-foreground"
						/>
					</div>
					<div>
						<label for="tmplMulai" class="block font-semibold text-foreground/80 mb-1">Bulan Mulai</label>
						<select
							id="tmplMulai"
							name="bulanMulai"
							bind:value={newTemplateBulanMulai}
							class="w-full bg-secondary/50 border border-border rounded-lg px-2 py-2 text-xs text-foreground"
						>
							{#each Array(12) as _, i}
								<option value={i + 1}>Bulan {i + 1}</option>
							{/each}
						</select>
					</div>
					<div>
						<label for="tmplSelesai" class="block font-semibold text-foreground/80 mb-1">Bulan Selesai</label>
						<select
							id="tmplSelesai"
							name="bulanSelesai"
							bind:value={newTemplateBulanSelesai}
							class="w-full bg-secondary/50 border border-border rounded-lg px-2 py-2 text-xs text-foreground"
						>
							{#each Array(12) as _, i}
								<option value={i + 1}>Bulan {i + 1}</option>
							{/each}
						</select>
					</div>
				</div>

				<div>
					<label for="tmplMin" class="block font-semibold text-foreground/80 mb-1">
						Nominal Acuan Minimum Default (Rp)
					</label>
					<input
						id="tmplMin"
						name="nominalMinimumDefault"
						type="number"
						step="5000"
						bind:value={newTemplateNominalMin}
						class="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground"
					/>
				</div>

				<div>
					<label for="tmplCatatan" class="block font-semibold text-foreground/80 mb-1">Catatan Tambahan</label>
					<textarea
						id="tmplCatatan"
						name="catatan"
						rows="2"
						bind:value={newTemplateCatatan}
						class="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs text-foreground"
					></textarea>
				</div>

				<div class="flex gap-2 pt-2 border-t border-border">
					<button
						type="button"
						onclick={() => (showTemplateModal = false)}
						class="flex-1 py-2 rounded-lg border border-border bg-secondary/60 hover:bg-secondary font-semibold"
					>
						Batal
					</button>
					<button
						type="submit"
						disabled={isSubmitting}
						class="flex-1 py-2 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 disabled:opacity-50"
					>
						{isSubmitting ? 'Menyimpan...' : 'Simpan Template'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- ============================================================== -->
<!-- MODAL 2: BUAT / EDIT PAKET BUNDLE                              -->
<!-- ============================================================== -->
{#if showBundleModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
		<div class="bg-card border border-border rounded-2xl max-w-sm w-full p-5 sm:p-6 shadow-2xl space-y-4">
			<div class="flex items-center justify-between border-b border-border pb-3">
				<h3 class="text-sm font-bold text-foreground">
					{editingBundleId ? 'Edit Paket Bundle' : 'Tambah Paket Bundle'}
				</h3>
				<button
					type="button"
					onclick={() => (showBundleModal = false)}
					class="p-1 rounded-lg text-foreground/50 hover:text-foreground"
				>
					<X class="w-4 h-4" />
				</button>
			</div>

			<form
				method="POST"
				action="?/saveBundle"
				use:enhance={keepScrollSubmit({
					beforeSubmit: () => { isSubmitting = true; },
					onFinally: () => { isSubmitting = false; },
					onSuccess: () => { showBundleModal = false; }
				})}
				class="space-y-3.5 text-xs"
			>
				{#if editingBundleId}
					<input type="hidden" name="bundleId" value={editingBundleId} />
				{/if}
				<input type="hidden" name="templateId" value={data.selectedTemplate?.id} />
				<input type="hidden" name="kelompokId" value={data.selectedKelompokId} />

				<div>
					<label for="bNama" class="block font-semibold text-foreground/80 mb-1">
						Nama Paket Bundle <span class="text-destructive">*</span>
					</label>
					<input
						id="bNama"
						name="nama"
						type="text"
						required
						bind:value={bundleNama}
						placeholder="Contoh: Paket Standar / Paket Pelajar"
						class="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:ring-1 focus:ring-primary"
					/>
				</div>

				<div>
					<label for="bNominal" class="block font-semibold text-foreground/80 mb-1">
						Nominal Target (Rp) <span class="text-destructive">*</span>
					</label>
					<input
						id="bNominal"
						name="nominal"
						type="number"
						step="5000"
						required
						bind:value={bundleNominal}
						class="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground focus:ring-1 focus:ring-primary"
					/>
				</div>

				<div>
					<label for="bDesc" class="block font-semibold text-foreground/80 mb-1">Keterangan / Peruntukan</label>
					<input
						id="bDesc"
						name="deskripsi"
						type="text"
						bind:value={bundleDeskripsi}
						placeholder="Contoh: Untuk jamaah lajang / mahasiswa"
						class="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs text-foreground"
					/>
				</div>

				<div class="flex gap-2 pt-2 border-t border-border">
					<button
						type="button"
						onclick={() => (showBundleModal = false)}
						class="flex-1 py-2 rounded-lg border border-border bg-secondary/60 hover:bg-secondary font-semibold"
					>
						Batal
					</button>
					<button
						type="submit"
						disabled={isSubmitting}
						class="flex-1 py-2 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 disabled:opacity-50"
					>
						{isSubmitting ? 'Menyimpan...' : 'Simpan Paket'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- ============================================================== -->
<!-- MODAL 3: TAMBAH POS ANGGARAN BARU                              -->
<!-- ============================================================== -->
{#if showPosModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
		<div class="bg-card border border-border rounded-2xl max-w-sm w-full p-5 sm:p-6 shadow-2xl space-y-4">
			<div class="flex items-center justify-between border-b border-border pb-3">
				<h3 class="text-sm font-bold text-foreground">
					{newPosParentId ? 'Tambah Sub-Pos Anggaran' : 'Tambah Pos Induk Anggaran'}
				</h3>
				<button
					type="button"
					onclick={() => (showPosModal = false)}
					class="p-1 rounded-lg text-foreground/50 hover:text-foreground"
				>
					<X class="w-4 h-4" />
				</button>
			</div>

			<form
				method="POST"
				action="?/createPos"
				use:enhance={keepScrollSubmit({
					beforeSubmit: () => { isSubmitting = true; },
					onFinally: () => { isSubmitting = false; },
					onSuccess: () => { showPosModal = false; }
				})}
				class="space-y-3.5 text-xs"
			>
				<input type="hidden" name="kelompokId" value={data.selectedKelompokId} />
				{#if newPosParentId}
					<input type="hidden" name="parentId" value={newPosParentId} />
				{/if}

				<div>
					<label for="posNama" class="block font-semibold text-foreground/80 mb-1">
						Nama Pos Anggaran <span class="text-destructive">*</span>
					</label>
					<input
						id="posNama"
						name="nama"
						type="text"
						required
						bind:value={newPosNama}
						placeholder="Contoh: Kas Kebersihan Musholla / Asrama"
						class="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:ring-1 focus:ring-primary"
					/>
				</div>

				<div>
					<label for="posKode" class="block font-semibold text-foreground/80 mb-1">
						Kode Pos (Opsional)
					</label>
					<input
						id="posKode"
						name="kode"
						type="text"
						bind:value={newPosKode}
						placeholder="Contoh: OPERASIONAL-01"
						class="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs text-foreground font-mono"
					/>
				</div>

				<div>
					<label for="posDesc" class="block font-semibold text-foreground/80 mb-1">Keterangan / Rincian</label>
					<textarea
						id="posDesc"
						name="deskripsi"
						rows="2"
						bind:value={newPosDeskripsi}
						class="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs text-foreground"
					></textarea>
				</div>

				<div class="flex gap-2 pt-2 border-t border-border">
					<button
						type="button"
						onclick={() => (showPosModal = false)}
						class="flex-1 py-2 rounded-lg border border-border bg-secondary/60 hover:bg-secondary font-semibold"
					>
						Batal
					</button>
					<button
						type="submit"
						disabled={isSubmitting}
						class="flex-1 py-2 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 disabled:opacity-50"
					>
						{isSubmitting ? 'Menyimpan...' : 'Simpan Pos'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- ============================================================== -->
<!-- MODAL 4: ATUR ANGKA MANUAL / KHUSUS JAMAAH                     -->
<!-- ============================================================== -->
{#if showEditJamaahModal && editingJamaah}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
		<div class="bg-card border border-border rounded-2xl max-w-sm w-full p-5 sm:p-6 shadow-2xl space-y-4">
			<div class="flex items-center justify-between border-b border-border pb-3">
				<div>
					<h3 class="text-sm font-bold text-foreground">Atur Angka Khusus Jamaah</h3>
					<p class="text-[11px] text-foreground/50">{editingJamaah.namaLengkap}</p>
				</div>
				<button
					type="button"
					onclick={() => (showEditJamaahModal = false)}
					class="p-1 rounded-lg text-foreground/50 hover:text-foreground"
				>
					<X class="w-4 h-4" />
				</button>
			</div>

			<form
				method="POST"
				action="?/updateJamaahTarif"
				use:enhance={keepScrollSubmit({
					beforeSubmit: () => { isSubmitting = true; },
					onFinally: () => { isSubmitting = false; },
					onSuccess: () => { showEditJamaahModal = false; }
				})}
				class="space-y-3.5 text-xs"
			>
				<input type="hidden" name="templateId" value={data.selectedTemplate?.id} />
				<input type="hidden" name="kelompokId" value={data.selectedKelompokId} />
				<input type="hidden" name="anggotaId" value={editingJamaah.anggotaId} />

				<div>
					<label for="jmNominal" class="block font-semibold text-foreground/80 mb-1">
						Nominal Target Khusus (Rp) <span class="text-destructive">*</span>
					</label>
					<input
						id="jmNominal"
						name="nominalTarget"
						type="number"
						step="5000"
						required
						bind:value={editJamaahNominal}
						class="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground focus:ring-1 focus:ring-primary"
					/>
				</div>

				<div>
					<label for="jmCatatan" class="block font-semibold text-foreground/80 mb-1">Alasan / Catatan Penyesuaian</label>
					<input
						id="jmCatatan"
						name="catatan"
						type="text"
						bind:value={editJamaahCatatan}
						placeholder="Misal: Permintaan jamaah / Keringanan lansia"
						class="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs text-foreground"
					/>
				</div>

				<div class="flex gap-2 pt-2 border-t border-border">
					<button
						type="button"
						onclick={() => (showEditJamaahModal = false)}
						class="flex-1 py-2 rounded-lg border border-border bg-secondary/60 hover:bg-secondary font-semibold"
					>
						Batal
					</button>
					<button
						type="submit"
						disabled={isSubmitting}
						class="flex-1 py-2 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 disabled:opacity-50"
					>
						{isSubmitting ? 'Menyimpan...' : 'Simpan Perubahan'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

