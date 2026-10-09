<!--
  @file src/routes/(admin)/admin/wilayah/+page.svelte
  @purpose Halaman manajemen hierarki wilayah (Daerah -> Desa -> Kelompok) dan penambahan unit wilayah dengan proteksi draf modal
  @usedBy Route admin '/admin/wilayah'
  @dependencies @lucide/svelte, Svelte 5 Runes, $lib/components/SearchableSelect.svelte
  @publicFunctions openAddKelompokModal, closeAddKelompokModal, openAddDesaModal, closeAddDesaModal, resetAddKelompokForm, resetAddDesaForm
  @sideEffects Menampilkan data hierarki wilayah dan mengirimkan form pembuatan unit ke server
-->
<script lang="ts">
	import { MapPin, Plus, Search, Building, Home, Users, X } from '@lucide/svelte';
	import type { PageData, ActionData } from './$types';
	import SearchableSelect from '$lib/components/SearchableSelect.svelte';

	let { data, form } = $props<{ data: PageData; form: ActionData }>();

	let searchQuery = $state('');
	let showAddKelompokModal = $state(false);
	let showAddDesaModal = $state(false);

	let inputNamaKelompok = $state('');
	let selectedDesaId = $state<string | number>('');
	let inputKelurahan = $state('');

	let inputNamaDesa = $state('');
	let selectedDaerahId = $state<string | number>('');
	let inputKecamatan = $state('');

	const desaOptions = $derived(
		(data.desaList || []).map((d: (typeof data.desaList)[number]) => ({
			value: d.id,
			label: d.nama,
			sublabel: d.daerahNama ? `Daerah ${d.daerahNama}` : undefined
		}))
	);

	const daerahOptions = $derived(
		(data.daerahList || []).map((d: (typeof data.daerahList)[number]) => ({
			value: d.id,
			label: d.nama,
			sublabel: d.kotaKabupaten
		}))
	);

	function isAddKelompokDirty() {
		return (
			inputNamaKelompok.trim() !== '' ||
			String(selectedDesaId).trim() !== '' ||
			inputKelurahan.trim() !== ''
		);
	}

	function resetAddKelompokForm() {
		inputNamaKelompok = '';
		selectedDesaId = '';
		inputKelurahan = '';
	}

	function openAddKelompokModal() {
		showAddKelompokModal = true;
	}

	function closeAddKelompokModal() {
		if (isAddKelompokDirty()) {
			if (
				confirm(
					'Ada isian kelompok yang belum disimpan. Tetap tutup modal? (Isian Anda akan tetap tersimpan sebagai draf)'
				)
			) {
				showAddKelompokModal = false;
			}
		} else {
			showAddKelompokModal = false;
		}
	}

	function isAddDesaDirty() {
		return (
			inputNamaDesa.trim() !== '' ||
			String(selectedDaerahId).trim() !== '' ||
			inputKecamatan.trim() !== ''
		);
	}

	function resetAddDesaForm() {
		inputNamaDesa = '';
		selectedDaerahId = '';
		inputKecamatan = '';
	}

	function openAddDesaModal() {
		showAddDesaModal = true;
	}

	function closeAddDesaModal() {
		if (isAddDesaDirty()) {
			if (
				confirm(
					'Ada isian desa yang belum disimpan. Tetap tutup modal? (Isian Anda akan tetap tersimpan sebagai draf)'
				)
			) {
				showAddDesaModal = false;
			}
		} else {
			showAddDesaModal = false;
		}
	}

	$effect(() => {
		if (form?.success) {
			resetAddKelompokForm();
			resetAddDesaForm();
			showAddKelompokModal = false;
			showAddDesaModal = false;
		}
	});

	let filteredKelompok = $derived(
		(data.kelompokList || []).filter((k: (typeof data.kelompokList)[number]) => {
			const q = searchQuery.toLowerCase();
			return (
				k.nama.toLowerCase().includes(q) ||
				(k.desaNama || '').toLowerCase().includes(q) ||
				(k.daerahNama || '').toLowerCase().includes(q) ||
				(k.kelurahan || '').toLowerCase().includes(q)
			);
		})
	);
</script>

<svelte:head>
	<title>Hierarki Wilayah - Admin Satu Generus</title>
</svelte:head>

<div class="space-y-6">
	<!-- Page Header -->
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
		<div>
			<h1 class="text-xl font-bold text-foreground tracking-tight">Hierarki Wilayah Jamaah</h1>
			<p class="text-xs text-foreground/60 mt-0.5">
				Kelola struktur organisasi relasi berjenjang: Daerah &rarr; Desa &rarr; Kelompok.
			</p>
		</div>

		<div class="flex items-center gap-2">
			<button
				type="button"
				onclick={openAddDesaModal}
				class="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card text-xs font-semibold text-foreground/80 hover:bg-secondary transition-all shadow-sm active:scale-95"
			>
				<Building class="w-3.5 h-3.5 text-primary" />
				<span>Tambah Desa</span>
			</button>

			<button
				type="button"
				onclick={openAddKelompokModal}
				class="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-all shadow-sm active:scale-95"
			>
				<Plus class="w-4 h-4" />
				<span>Tambah Kelompok</span>
			</button>
		</div>
	</div>

	<!-- Notifikasi Feedback Form -->
	{#if form?.error}
		<div class="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-xl flex items-center gap-2">
			<span>{form.error}</span>
		</div>
	{/if}
	{#if form?.success}
		<div class="p-3 bg-primary/10 border border-primary/20 text-primary text-xs rounded-xl flex items-center gap-2 font-medium">
			<span>Data wilayah berhasil disimpan ke sistem.</span>
		</div>
	{/if}

	<!-- Metric Cards Hierarki -->
	<div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
		<div class="bg-card border border-border rounded-xl p-4 shadow-sm flex items-center justify-between">
			<div>
				<p class="text-xs font-medium text-foreground/60">Tingkat Daerah</p>
				<p class="text-2xl font-bold text-foreground mt-1">{data.daerahList.length}</p>
				<p class="text-[11px] text-foreground/50 mt-0.5">Cakupan Kota/Kabupaten</p>
			</div>
			<div class="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
				<MapPin class="w-5 h-5" />
			</div>
		</div>

		<div class="bg-card border border-border rounded-xl p-4 shadow-sm flex items-center justify-between">
			<div>
				<p class="text-xs font-medium text-foreground/60">Tingkat Desa</p>
				<p class="text-2xl font-bold text-foreground mt-1">{data.desaList.length}</p>
				<p class="text-[11px] text-foreground/50 mt-0.5">Cakupan Kecamatan</p>
			</div>
			<div class="w-10 h-10 rounded-xl bg-accent/20 text-accent flex items-center justify-center">
				<Building class="w-5 h-5" />
			</div>
		</div>

		<div class="bg-card border border-border rounded-xl p-4 shadow-sm flex items-center justify-between">
			<div>
				<p class="text-xs font-medium text-foreground/60">Tingkat Kelompok</p>
				<p class="text-2xl font-bold text-foreground mt-1">{data.kelompokList.length}</p>
				<p class="text-[11px] text-foreground/50 mt-0.5">Basis Jamaah Terdaftar</p>
			</div>
			<div class="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center text-foreground/70">
				<Home class="w-5 h-5" />
			</div>
		</div>
	</div>

	<!-- Search Bar -->
	<div class="bg-card border border-border rounded-xl p-4 shadow-sm flex items-center justify-between">
		<div class="relative w-full sm:w-80">
			<Search class="w-4 h-4 text-foreground/40 absolute left-3 top-1/2 -translate-y-1/2" />
			<input
				type="search"
				placeholder="Cari kelompok, desa, atau daerah..."
				bind:value={searchQuery}
				class="w-full bg-secondary/50 border border-border rounded-lg pl-9 pr-3 py-2 text-xs text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary focus:bg-background transition-all"
			/>
		</div>

		<span class="text-xs text-foreground/60">
			Total <span class="font-bold text-foreground">{filteredKelompok.length}</span> kelompok
		</span>
	</div>

	<!-- Tabel Data Hierarki -->
	<div class="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
		<div class="overflow-x-auto">
			<table class="w-full text-left text-xs">
				<thead class="bg-secondary/60 text-foreground/70 uppercase text-[10px] tracking-wider border-b border-border">
					<tr>
						<th class="py-3 px-4 font-semibold">Nama Kelompok</th>
						<th class="py-3 px-4 font-semibold">Kelurahan / Domisili</th>
						<th class="py-3 px-4 font-semibold">Desa Induk</th>
						<th class="py-3 px-4 font-semibold">Daerah Induk</th>
						<th class="py-3 px-4 font-semibold text-right">Populasi Jamaah</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-border">
					{#if filteredKelompok.length === 0}
						<tr>
							<td colspan="5" class="py-12 text-center text-foreground/50">
								Belum ada unit kelompok yang cocok dengan pencarian.
							</td>
						</tr>
					{:else}
						{#each filteredKelompok as k}
							<tr class="hover:bg-secondary/30 transition-colors">
								<td class="py-3.5 px-4 font-semibold text-foreground flex items-center gap-2">
									<div class="w-6 h-6 rounded bg-primary/10 text-primary flex items-center justify-center font-mono text-[10px]">
										KL
									</div>
									<span>{k.nama}</span>
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
							</tr>
						{/each}
					{/if}
				</tbody>
			</table>
		</div>
	</div>
</div>

<!-- Modal Tambah Kelompok Baru -->
{#if showAddKelompokModal}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
		role="dialog"
		aria-modal="true"
		onclick={(e) => {
			if (e.target === e.currentTarget) closeAddKelompokModal();
		}}
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
					<SearchableSelect
						id="desaId"
						name="desaId"
						options={desaOptions}
						bind:value={selectedDesaId}
						required
						placeholder="-- Pilih Desa Induk --"
						searchPlaceholder="Cari nama desa..."
					/>
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

				<div class="flex items-center justify-between gap-2 pt-3 border-t border-border">
					{#if isAddKelompokDirty()}
						<button
							type="button"
							onclick={resetAddKelompokForm}
							class="text-[11px] text-destructive hover:underline font-medium"
						>
							Kosongkan Isian
						</button>
					{:else}
						<div></div>
					{/if}
					<div class="flex items-center gap-2">
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
		onclick={(e) => {
			if (e.target === e.currentTarget) closeAddDesaModal();
		}}
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
					<SearchableSelect
						id="daerahId"
						name="daerahId"
						options={daerahOptions}
						bind:value={selectedDaerahId}
						required
						placeholder="-- Pilih Daerah Induk --"
						searchPlaceholder="Cari nama daerah atau kabupaten..."
					/>
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

				<div class="flex items-center justify-between gap-2 pt-3 border-t border-border">
					{#if isAddDesaDirty()}
						<button
							type="button"
							onclick={resetAddDesaForm}
							class="text-[11px] text-destructive hover:underline font-medium"
						>
							Kosongkan Isian
						</button>
					{:else}
						<div></div>
					{/if}
					<div class="flex items-center gap-2">
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
				</div>
			</form>
		</div>
	</div>
{/if}

