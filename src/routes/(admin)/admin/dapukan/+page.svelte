<!--
  @file src/routes/(admin)/admin/dapukan/+page.svelte
  @purpose Halaman manajemen struktur dapukan dan penugasan RBAC pengurus dengan dialog konfirmasi simpan penugasan, konfirmasi batal jika isian terisi, pagination data, proteksi wewenang 4S, penguncian scope wilayah, dan scroll retention
  @usedBy Route admin '/admin/dapukan'
  @dependencies @lucide/svelte, Svelte 5 Runes, $lib/components/SearchableSelect.svelte, $lib/components/Pagination.svelte, $app/forms (enhance), $lib/confirm.svelte (confirmAction)
  @publicFunctions openAssignModal, closeAssignModal, resetAssignForm, handleAssignSubmit, openEditModal, closeEditModal, confirmRemove
  @sideEffects Menampilkan data dapukan/pengurus dan mengirim form mutasi pengurus ke server dengan konfirmasi modal interaktif
-->
<script lang="ts">
	import {
		ShieldCheck,
		Plus,
		Search,
		UserCheck,
		Trash2,
		Pencil,
		X,
		Award,
		MapPin,
		AlertTriangle
	} from '@lucide/svelte';
	import type { PageData, ActionData } from './$types';
	import SearchableSelect from '$lib/components/SearchableSelect.svelte';
	import Pagination from '$lib/components/Pagination.svelte';
	import { confirmAction } from '$lib/confirm.svelte';
	import { enhance } from '$app/forms';
	import { keepScrollSubmit } from '$lib/keepScroll';

	let { data, form } = $props<{ data: PageData; form: ActionData }>();

	let searchQuery = $state('');
	let showAssignModal = $state(false);
	let showEditModal = $state(false);
	let showRemoveModal = $state(false);
	let selectedPengurusToRemove = $state<{ id: string; nama: string; dapukan: string } | null>(null);

	// Edit State
	let editingPengurus = $state<(typeof data.daftarPengurus)[number] | null>(null);
	let editTipeDapukan = $state<'tetap' | 'custom'>('tetap');
	let editScope = $state<'Pusat' | 'Daerah' | 'Desa' | 'Kelompok'>('Kelompok');
	let editDapukanId = $state<string | number>('');
	let editNamaDapukanCustom = $state('');
	let editKelompokId = $state<string | number>('');
	let editDesaId = $state<string | number>('');
	let editDaerahId = $state<string | number>('');

	// Form State
	let tipeDapukan = $state<'tetap' | 'custom'>('tetap');
	let selectedScope = $state<'Pusat' | 'Daerah' | 'Desa' | 'Kelompok'>('Kelompok');
	let selectedUserId = $state<string | number>('');
	let selectedDapukanId = $state<string | number>('');
	let inputNamaDapukanCustom = $state('');
	let selectedKelompokId = $state<string | number>('');
	let selectedDesaId = $state<string | number>('');
	let selectedDaerahId = $state<string | number>('');

	// Jamaah terpilih beserta basis wilayahnya
	const selectedUserObj = $derived(
		(data.userList || []).find((u: (typeof data.userList)[number]) => String(u.id) === String(selectedUserId))
	);

	// Options untuk Searchable Dropdowns
	const userOptions = $derived(
		(data.userList || []).map((u: (typeof data.userList)[number]) => {
			let sub = '';
			if (u.kelompokNama) {
				sub = `${u.kelompokNama} • ${u.desaNama || ''}`;
			} else {
				sub = u.email || 'Tanpa Email';
			}
			return {
				value: u.id,
				label: u.namaLengkap,
				sublabel: sub
			};
		})
	);

	const masterDapukanOptions = $derived(
		(data.masterDapukan || [])
			.filter((m: (typeof data.masterDapukan)[number]) => {
				if (selectedScope === 'Pusat') {
					// Di tingkat Pusat: tidak ada 4S, hanya Admin Pusat atau Superadmin
					return !m.is4S || m.namaDapukan === 'Superadmin';
				}
				// Di tingkat Daerah, Desa, Kelompok: 4S berlaku penuh, sembunyikan Admin Pusat
				return m.namaDapukan !== 'Admin Pusat';
			})
			.map((m: (typeof data.masterDapukan)[number]) => ({
				value: m.id,
				label: m.namaDapukan,
				sublabel: m.is4S ? '4S' : undefined
			}))
	);

	const editMasterDapukanOptions = $derived(
		(data.masterDapukan || [])
			.filter((m: (typeof data.masterDapukan)[number]) => {
				if (editScope === 'Pusat') {
					return !m.is4S || m.namaDapukan === 'Superadmin';
				}
				return m.namaDapukan !== 'Admin Pusat';
			})
			.map((m: (typeof data.masterDapukan)[number]) => ({
				value: m.id,
				label: m.namaDapukan,
				sublabel: m.is4S ? '4S' : undefined
			}))
	);

	// Opsi Kelompok: Jika jamaah memiliki basis kelompok, kunci hanya ke kelompok basisnya
	const kelompokOptions = $derived.by(() => {
		if (selectedUserObj?.kelompokId) {
			const matching = (data.kelompokList || []).find((k: (typeof data.kelompokList)[number]) => k.id === selectedUserObj.kelompokId);
			if (matching) {
				return [
					{
						value: matching.id,
						label: matching.nama,
						sublabel: `Terkunci: Basis ${selectedUserObj.namaLengkap}`
					}
				];
			}
			return [
				{
					value: selectedUserObj.kelompokId,
					label: selectedUserObj.kelompokNama || `Kelompok #${selectedUserObj.kelompokId}`,
					sublabel: `Terkunci: Basis ${selectedUserObj.namaLengkap}`
				}
			];
		}
		return (data.kelompokList || []).map((k: (typeof data.kelompokList)[number]) => ({
			value: k.id,
			label: k.nama
		}));
	});

	// Opsi Desa: Jika jamaah memiliki basis desa, kunci hanya ke desa basisnya
	const desaOptions = $derived.by(() => {
		if (selectedUserObj?.desaId) {
			const matching = (data.desaList || []).find((d: (typeof data.desaList)[number]) => d.id === selectedUserObj.desaId);
			if (matching) {
				return [
					{
						value: matching.id,
						label: matching.nama,
						sublabel: `Terkunci: Basis ${selectedUserObj.namaLengkap}`
					}
				];
			}
			return [
				{
					value: selectedUserObj.desaId,
					label: selectedUserObj.desaNama || `Desa #${selectedUserObj.desaId}`,
					sublabel: `Terkunci: Basis ${selectedUserObj.namaLengkap}`
				}
			];
		}
		return (data.desaList || []).map((d: (typeof data.desaList)[number]) => ({
			value: d.id,
			label: d.nama
		}));
	});

	// Opsi Daerah: Jika jamaah memiliki basis daerah, kunci hanya ke daerah basisnya
	const daerahOptions = $derived.by(() => {
		if (selectedUserObj?.daerahId) {
			const matching = (data.daerahList || []).find((dr: (typeof data.daerahList)[number]) => dr.id === selectedUserObj.daerahId);
			if (matching) {
				return [
					{
						value: matching.id,
						label: matching.nama,
						sublabel: `Terkunci: Basis ${selectedUserObj.namaLengkap}`
					}
				];
			}
			return [
				{
					value: selectedUserObj.daerahId,
					label: selectedUserObj.daerahNama || `Daerah #${selectedUserObj.daerahId}`,
					sublabel: `Terkunci: Basis ${selectedUserObj.namaLengkap}`
				}
			];
		}
		return (data.daerahList || []).map((dr: (typeof data.daerahList)[number]) => ({
			value: dr.id,
			label: dr.nama,
			sublabel: dr.kotaKabupaten
		}));
	});

	// Jamaah terpilih saat edit penugasan
	const editingUserObj = $derived(
		editingPengurus?.userId
			? (data.userList || []).find((u: (typeof data.userList)[number]) => String(u.id) === String(editingPengurus?.userId))
			: null
	);

	// Opsi Kelompok saat Edit: Jika jamaah memiliki basis kelompok, kunci hanya ke kelompok basisnya
	const editKelompokOptions = $derived.by(() => {
		if (editingUserObj?.kelompokId) {
			const matching = (data.kelompokList || []).find((k: (typeof data.kelompokList)[number]) => k.id === editingUserObj.kelompokId);
			if (matching) {
				return [
					{
						value: matching.id,
						label: matching.nama,
						sublabel: `Terkunci: Basis ${editingUserObj.namaLengkap}`
					}
				];
			}
			return [
				{
					value: editingUserObj.kelompokId,
					label: editingUserObj.kelompokNama || `Kelompok #${editingUserObj.kelompokId}`,
					sublabel: `Terkunci: Basis ${editingUserObj.namaLengkap}`
				}
			];
		}
		return (data.kelompokList || []).map((k: (typeof data.kelompokList)[number]) => ({
			value: k.id,
			label: k.nama
		}));
	});

	// Opsi Desa saat Edit: Jika jamaah memiliki basis desa, kunci hanya ke desa basisnya
	const editDesaOptions = $derived.by(() => {
		if (editingUserObj?.desaId) {
			const matching = (data.desaList || []).find((d: (typeof data.desaList)[number]) => d.id === editingUserObj.desaId);
			if (matching) {
				return [
					{
						value: matching.id,
						label: matching.nama,
						sublabel: `Terkunci: Basis ${editingUserObj.namaLengkap}`
					}
				];
			}
			return [
				{
					value: editingUserObj.desaId,
					label: editingUserObj.desaNama || `Desa #${editingUserObj.desaId}`,
					sublabel: `Terkunci: Basis ${editingUserObj.namaLengkap}`
				}
			];
		}
		return (data.desaList || []).map((d: (typeof data.desaList)[number]) => ({
			value: d.id,
			label: d.nama
		}));
	});

	// Opsi Daerah saat Edit: Jika jamaah memiliki basis daerah, kunci hanya ke daerah basisnya
	const editDaerahOptions = $derived.by(() => {
		if (editingUserObj?.daerahId) {
			const matching = (data.daerahList || []).find((dr: (typeof data.daerahList)[number]) => dr.id === editingUserObj.daerahId);
			if (matching) {
				return [
					{
						value: matching.id,
						label: matching.nama,
						sublabel: `Terkunci: Basis ${editingUserObj.namaLengkap}`
					}
				];
			}
			return [
				{
					value: editingUserObj.daerahId,
					label: editingUserObj.daerahNama || `Daerah #${editingUserObj.daerahId}`,
					sublabel: `Terkunci: Basis ${editingUserObj.namaLengkap}`
				}
			];
		}
		return (data.daerahList || []).map((dr: (typeof data.daerahList)[number]) => ({
			value: dr.id,
			label: dr.nama,
			sublabel: dr.kotaKabupaten
		}));
	});

	// Sinkronisasi otomatis dan auto-select saat jamaah atau tingkat scope dipilih
	$effect(() => {
		if (selectedUserObj) {
			if (selectedScope === 'Kelompok') {
				if (selectedUserObj.kelompokId) {
					selectedKelompokId = selectedUserObj.kelompokId;
				}
			} else if (selectedScope === 'Desa') {
				if (selectedUserObj.desaId) {
					selectedDesaId = selectedUserObj.desaId;
				}
			} else if (selectedScope === 'Daerah') {
				if (selectedUserObj.daerahId) {
					selectedDaerahId = selectedUserObj.daerahId;
				}
			}
		}
	});

	// Sinkronisasi otomatis pada modal edit saat tingkat scope berubah
	$effect(() => {
		if (editingUserObj && showEditModal) {
			if (editScope === 'Kelompok' && editingUserObj.kelompokId) {
				editKelompokId = editingUserObj.kelompokId;
			} else if (editScope === 'Desa' && editingUserObj.desaId) {
				editDesaId = editingUserObj.desaId;
			} else if (editScope === 'Daerah' && editingUserObj.daerahId) {
				editDaerahId = editingUserObj.daerahId;
			}
		}
	});

	function isAssignFormDirty() {
		return (
			String(selectedUserId).trim() !== '' ||
			String(selectedDapukanId).trim() !== '' ||
			inputNamaDapukanCustom.trim() !== '' ||
			String(selectedKelompokId).trim() !== '' ||
			String(selectedDesaId).trim() !== '' ||
			String(selectedDaerahId).trim() !== '' ||
			tipeDapukan !== 'tetap' ||
			selectedScope !== 'Kelompok'
		);
	}

	function resetAssignForm() {
		selectedUserId = '';
		tipeDapukan = 'tetap';
		selectedDapukanId = '';
		inputNamaDapukanCustom = '';
		selectedScope = 'Kelompok';
		selectedKelompokId = '';
		selectedDesaId = '';
		selectedDaerahId = '';
	}

	function openAssignModal() {
		if (!data.canManageDapukan) return;
		showAssignModal = true;
	}

	function openEditModal(p: (typeof data.daftarPengurus)[number]) {
		if (!data.canManageDapukan) return;
		editingPengurus = p;
		editTipeDapukan = p.namaDapukanCustom ? 'custom' : 'tetap';
		editDapukanId = p.dapukanId ?? '';
		editNamaDapukanCustom = p.namaDapukanCustom ?? '';
		editScope = (p.tingkatScope as 'Pusat' | 'Daerah' | 'Desa' | 'Kelompok') ?? 'Kelompok';
		editKelompokId = p.kelompokId ?? '';
		editDesaId = p.desaId ?? '';
		editDaerahId = p.daerahId ?? '';
		showEditModal = true;
	}

	function closeEditModal() {
		showEditModal = false;
		editingPengurus = null;
	}

	async function closeAssignModal() {
		if (isAssignFormDirty()) {
			const ok = await confirmAction({
				title: 'Tutup Formulir Penugasan?',
				message:
					'Ada isian penugasan yang belum disimpan. Tetap tutup formulir? Isian yang belum disimpan akan dibatalkan.',
				confirmText: 'Ya, Tutup Formulir',
				cancelText: 'Lanjut Mengisi',
				variant: 'warning'
			});
			if (ok) {
				resetAssignForm();
				showAssignModal = false;
			}
		} else {
			resetAssignForm();
			showAssignModal = false;
		}
	}

	async function handleAssignSubmit({ cancel }: { cancel: () => void }) {
		const ok = await confirmAction({
			title: 'Simpan Penugasan Pengurus?',
			message:
				'Pastikan nama jamaah, dapukan, dan wilayah wewenang sudah sesuai. Yakin ingin menyimpan penugasan pengurus ini?',
			confirmText: 'Ya, Simpan',
			cancelText: 'Batal',
			variant: 'primary'
		});

		if (!ok) {
			cancel();
			return;
		}

		const scrollY = typeof window !== 'undefined' ? window.scrollY : 0;

		return async ({
			result,
			update
		}: {
			result: any;
			update: (options?: { reset?: boolean }) => Promise<void>;
		}) => {
			if (result.type === 'success') {
				resetAssignForm();
				showAssignModal = false;
			}
			await update({ reset: false });
			if (typeof window !== 'undefined') {
				window.scrollTo({ top: scrollY, behavior: 'instant' });
			}
		};
	}

	$effect(() => {
		if (form?.success) {
			resetAssignForm();
			showAssignModal = false;
			showEditModal = false;
			editingPengurus = null;
		}
	});

	let currentPage = $state(1);
	let pageSize = $state(10);

	$effect(() => {
		searchQuery;
		currentPage = 1;
	});

	let filteredPengurus = $derived(
		(data.daftarPengurus || []).filter((p: (typeof data.daftarPengurus)[number]) => {
			const q = searchQuery.toLowerCase();
			const dapukan = (p.namaDapukanCustom || p.dapukanNama || '').toLowerCase();
			const user = (p.userNama || '').toLowerCase();
			const scope = (p.tingkatScope || '').toLowerCase();
			return user.includes(q) || dapukan.includes(q) || scope.includes(q);
		})
	);

	let paginatedPengurus = $derived(
		filteredPengurus.slice((currentPage - 1) * pageSize, currentPage * pageSize)
	);
</script>

<svelte:head>
	<title>Dapukan & RBAC - Admin Satu Generus</title>
</svelte:head>

<div class="space-y-6">
	<!-- Page Header -->
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
		<div>
			<h1 class="text-xl font-bold text-foreground tracking-tight">Manajemen Dapukan & RBAC</h1>
			<p class="text-xs text-foreground/60 mt-0.5">
				Kelola struktur dapukan 4S dan dapukan tentatif serta lingkup wewenang administratif pengurus.
			</p>
		</div>

		{#if data.canManageDapukan}
			<button
				type="button"
				onclick={openAssignModal}
				class="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-all shadow-sm active:scale-95"
			>
				<Plus class="w-4 h-4" />
				<span>Tugaskan Pengurus Baru</span>
			</button>
		{:else}
			<div
				class="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/70 text-foreground/50 text-xs font-medium border border-border"
				title="Pada tingkat kelompok, hanya pengurus 4S dengan dapukan Kyai atau Sekretaris / Penerobos yang dapat menugaskan pengurus"
			>
				<ShieldCheck class="w-4 h-4 text-foreground/40" />
				<span>Khusus 4S Kyai / Penerobos</span>
			</div>
		{/if}
	</div>

	<!-- Notifikasi Feedback Form -->
	{#if form?.error}
		<div class="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-xl flex items-center gap-2">
			<span>{form.error}</span>
		</div>
	{/if}
	{#if form?.success}
		<div class="p-3 bg-primary/10 border border-primary/20 text-primary text-xs rounded-xl flex items-center gap-2 font-medium">
			<span>Data penugasan pengurus berhasil diperbarui.</span>
		</div>
	{/if}

	<!-- Section: Struktur Dapukan 4S -->
	<div class="bg-card border border-border rounded-xl p-5 shadow-sm space-y-3">
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-2">
				<Award class="w-4 h-4 text-primary" />
				<h2 class="text-sm font-bold text-foreground">Struktur Dapukan 4S</h2>
			</div>
			<span class="text-[11px] text-foreground/50">Hak Akses Modifikasi Administratif</span>
		</div>

		<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
			{#each data.masterDapukan as m}
				<div class="p-3 rounded-lg border border-border bg-secondary/30 flex items-center justify-between">
					<div>
						<p class="text-xs font-bold text-foreground">{m.namaDapukan}</p>
						<p class="text-[10px] text-foreground/50">Struktur 4S</p>
					</div>
					{#if m.is4S}
						<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary">
							<ShieldCheck class="w-3 h-3" />
							4S Admin
						</span>
					{:else}
						<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-secondary text-foreground/60">
							Anggota
						</span>
					{/if}
				</div>
			{/each}
		</div>
	</div>

	<!-- Search Bar -->
	<div class="bg-card border border-border rounded-xl p-4 shadow-sm flex items-center justify-between">
		<div class="relative w-full sm:w-80">
			<Search class="w-4 h-4 text-foreground/40 absolute left-3 top-1/2 -translate-y-1/2" />
			<input
				type="search"
				placeholder="Cari nama pengurus, dapukan, scope..."
				bind:value={searchQuery}
				class="w-full bg-secondary/50 border border-border rounded-lg pl-9 pr-3 py-2 text-xs text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary focus:bg-background transition-all"
			/>
		</div>

		<span class="text-xs text-foreground/60">
			Total <span class="font-bold text-foreground">{filteredPengurus.length}</span> penugasan pengurus
		</span>
	</div>

	<!-- Presentasi Data: Compact Cards di Mobile (< md), Tabel Lengkap di Desktop (>= md) -->
	{#if filteredPengurus.length === 0}
		<div class="bg-card border border-border rounded-2xl p-8 text-center text-foreground/50 text-sm">
			Belum ada pengurus yang ditugaskan atau sesuai pencarian.
		</div>
	{:else}
		<!-- 1. Tampilan Mobile: Compact Cards -->
		<div class="md:hidden space-y-3">
			{#each paginatedPengurus as p}
				<div class="bg-card border border-border rounded-xl p-3.5 shadow-xs space-y-2.5">
					<div class="flex items-start justify-between gap-2">
						<div class="flex items-center gap-2.5 min-w-0">
							<div class="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
								{(p.userNama || 'U')[0]}
							</div>
							<div class="min-w-0">
								<h3 class="text-sm font-semibold text-foreground truncate">{p.userNama || '-'}</h3>
								{#if p.userEmail}
									<p class="text-xs text-foreground/50 truncate">{p.userEmail}</p>
								{/if}
							</div>
						</div>

						{#if data.canManageDapukan}
							<div class="flex items-center gap-1 shrink-0">
								<button
									type="button"
									onclick={() => openEditModal(p)}
									class="p-2 rounded-lg text-primary hover:bg-primary/10 transition-colors"
									title="Ubah Penugasan"
									aria-label="Ubah Penugasan"
								>
									<Pencil class="w-4 h-4" />
								</button>
								<button
									type="button"
									onclick={() => {
										selectedPengurusToRemove = {
											id: p.id,
											nama: p.userNama || 'Pengurus',
											dapukan: p.namaDapukanCustom || p.dapukanNama || 'Dapukan'
										};
										showRemoveModal = true;
									}}
									class="p-2 rounded-lg text-destructive hover:bg-destructive/10 transition-colors"
									title="Cabut Penugasan"
									aria-label="Cabut Penugasan"
								>
									<Trash2 class="w-4 h-4" />
								</button>
							</div>
						{/if}
					</div>

					<!-- Rincian Dapukan & Wilayah -->
					<div class="flex flex-wrap items-center gap-2 pt-1 border-t border-border/50 text-xs">
						<span class="font-medium text-foreground">
							{p.namaDapukanCustom || p.dapukanNama || '-'}
						</span>
						<span class="text-foreground/40">•</span>
						<span class="inline-flex items-center px-2 py-0.5 rounded bg-secondary text-foreground/80 font-medium">
							{p.tingkatScope}
						</span>
						<span class="text-foreground/40">•</span>
						<span class="inline-flex items-center gap-1 text-foreground/70 truncate">
							<MapPin class="w-3.5 h-3.5 text-foreground/40 shrink-0" />
							<span class="truncate">{p.kelompokNama || p.desaNama || p.daerahNama || 'Semua Wilayah'}</span>
						</span>
					</div>

					<!-- Status Wewenang 4S -->
					<div>
						{#if p.is4S}
							<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary">
								<ShieldCheck class="w-3.5 h-3.5" />
								Admin CRUD (4S)
							</span>
						{:else}
							<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary text-foreground/60">
								Pengurus (Read-Only)
							</span>
						{/if}
					</div>
				</div>
			{/each}
			<Pagination bind:currentPage bind:pageSize totalItems={filteredPengurus.length} />
		</div>

		<!-- 2. Tampilan Desktop: Tabel Data Lengkap -->
		<div class="hidden md:block bg-card border border-border rounded-xl overflow-hidden shadow-sm">
			<div class="overflow-x-auto">
				<table class="w-full text-left text-sm">
					<thead class="bg-secondary/60 text-foreground/70 uppercase text-xs tracking-wider border-b border-border">
						<tr>
							<th class="py-3 px-4 font-semibold">Nama Pengurus</th>
							<th class="py-3 px-4 font-semibold">Dapukan</th>
							<th class="py-3 px-4 font-semibold">Tingkat Scope</th>
							<th class="py-3 px-4 font-semibold">Wilayah Cakupan</th>
							<th class="py-3 px-4 font-semibold">Hak Wewenang</th>
							<th class="py-3 px-4 font-semibold text-right">Aksi</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-border">
						{#each paginatedPengurus as p}
							<tr class="hover:bg-secondary/30 transition-colors">
								<td class="py-3.5 px-4 font-semibold text-foreground">
									<div class="flex items-center gap-2">
										<div class="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
											{(p.userNama || 'U')[0]}
										</div>
										<div>
											<p class="leading-tight">{p.userNama || '-'}</p>
											<p class="text-xs text-foreground/50 leading-tight">{p.userEmail || ''}</p>
										</div>
									</div>
								</td>
								<td class="py-3.5 px-4">
									{#if p.namaDapukanCustom}
										<span class="font-medium text-foreground">{p.namaDapukanCustom}</span>
										<span class="block text-xs text-foreground/50">(Tentatif/Kustom)</span>
									{:else}
										<span class="font-bold text-primary">{p.dapukanNama || '-'}</span>
									{/if}
								</td>
								<td class="py-3.5 px-4">
									<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-secondary text-foreground/80">
										{p.tingkatScope}
									</span>
								</td>
								<td class="py-3.5 px-4 text-foreground/70">
									<span class="inline-flex items-center gap-1">
										<MapPin class="w-3.5 h-3.5 text-foreground/40" />
										{p.kelompokNama || p.desaNama || p.daerahNama || 'Semua Wilayah'}
									</span>
								</td>
								<td class="py-3.5 px-4">
									{#if p.is4S}
										<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary">
											<ShieldCheck class="w-3.5 h-3.5" />
											Admin CRUD (4S)
										</span>
									{:else}
										<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary text-foreground/60">
											Pengurus (Read-Only)
										</span>
									{/if}
								</td>
								<td class="py-3.5 px-4 text-right">
									{#if data.canManageDapukan}
										<div class="inline-flex items-center justify-end gap-1">
											<button
												type="button"
												onclick={() => openEditModal(p)}
												class="p-1.5 rounded-lg text-primary hover:bg-primary/10 transition-colors"
												title="Ubah Penugasan"
												aria-label="Ubah Penugasan"
											>
												<Pencil class="w-4 h-4" />
											</button>
											<button
												type="button"
												onclick={() => {
													selectedPengurusToRemove = {
														id: p.id,
														nama: p.userNama || 'Pengurus',
														dapukan: p.namaDapukanCustom || p.dapukanNama || 'Dapukan'
													};
													showRemoveModal = true;
												}}
												class="p-1.5 rounded-lg text-destructive hover:bg-destructive/10 transition-colors"
												title="Cabut Penugasan"
												aria-label="Cabut Penugasan"
											>
												<Trash2 class="w-4 h-4" />
											</button>
										</div>
									{:else}
										<span class="text-foreground/30 text-xs">-</span>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<div class="p-4 border-t border-border">
				<Pagination bind:currentPage bind:pageSize totalItems={filteredPengurus.length} />
			</div>
		</div>
	{/if}
</div>

<!-- Modal Tugaskan Pengurus Baru -->
{#if showAssignModal}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
		role="dialog"
		aria-modal="true"
		onclick={(e) => {
			if (e.target === e.currentTarget) closeAssignModal();
		}}
	>
		<div class="bg-card border border-border rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-5 max-h-[90vh] overflow-y-auto">
			<div class="flex items-center justify-between pb-3 border-b border-border">
				<div class="flex items-center gap-2">
					<div class="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
						<UserCheck class="w-4 h-4" />
					</div>
					<h3 class="text-sm font-bold text-foreground">Tugaskan Pengurus Baru</h3>
				</div>
				<button
					type="button"
					onclick={closeAssignModal}
					class="p-1 rounded-lg hover:bg-secondary text-foreground/60 hover:text-foreground"
				>
					<X class="w-5 h-5" />
				</button>
			</div>

			<form
				method="POST"
				action="?/assignDapukan"
				use:enhance={handleAssignSubmit}
				class="space-y-4"
			>
				<!-- Pilih User Jamaah -->
				<div>
					<label for="userId" class="block text-xs font-semibold text-foreground mb-1.5">
						Pilih Jamaah *
					</label>
					<SearchableSelect
						id="userId"
						name="userId"
						options={userOptions}
						bind:value={selectedUserId}
						required
						placeholder="-- Pilih Nama Jamaah --"
						searchPlaceholder="Cari nama jamaah atau wilayah..."
					/>
				</div>

				<!-- Informasi Basis Wilayah Jamaah Terpilih -->
				{#if selectedUserObj}
					<div class="p-3 bg-secondary/40 border border-border rounded-xl space-y-1">
						<div class="flex items-center gap-1.5 text-xs font-semibold text-foreground">
							<MapPin class="w-3.5 h-3.5 text-primary" />
							<span>Basis Wilayah Jamaah:</span>
						</div>
						<div class="text-[11px] text-foreground/80 pl-5">
							{#if selectedUserObj.kelompokNama}
								<span class="font-medium text-foreground">{selectedUserObj.kelompokNama}</span>
								<span class="text-foreground/40 mx-1.5">•</span>
								<span>{selectedUserObj.desaNama || 'Desa -'}</span>
								<span class="text-foreground/40 mx-1.5">•</span>
								<span>{selectedUserObj.daerahNama || 'Daerah -'}</span>
								<p class="text-[10px] text-primary font-medium mt-1">
									Pilihan wilayah cakupan otomatis diselaraskan & dikunci ke basis wilayah jamaah di atas.
								</p>
							{:else}
								<span class="italic text-foreground/50">Belum terikat kelompok manapun (Jamaah Bebas).</span>
							{/if}
						</div>
					</div>
				{/if}

				<!-- Jenis Dapukan: Baku vs Kustom -->
				<div>
					<span class="block text-xs font-semibold text-foreground mb-2">Tipe Dapukan *</span>
					<div class="grid grid-cols-2 gap-3">
						<label class="p-3 border rounded-xl flex items-center gap-2.5 cursor-pointer transition-colors {tipeDapukan === 'tetap' ? 'border-primary bg-primary/5' : 'border-border bg-secondary/30'}">
							<input
								type="radio"
								name="tipeDapukan"
								value="tetap"
								bind:group={tipeDapukan}
								class="text-primary focus:ring-primary"
							/>
							<div>
								<span class="text-xs font-bold text-foreground block">Dapukan 4S</span>
								<span class="text-[10px] text-foreground/60 block">Hak Admin Elevated</span>
							</div>
						</label>

						<label class="p-3 border rounded-xl flex items-center gap-2.5 cursor-pointer transition-colors {tipeDapukan === 'custom' ? 'border-primary bg-primary/5' : 'border-border bg-secondary/30'}">
							<input
								type="radio"
								name="tipeDapukan"
								value="custom"
								bind:group={tipeDapukan}
								class="text-primary focus:ring-primary"
							/>
							<div>
								<span class="text-xs font-bold text-foreground block">Tentatif / Panitia</span>
								<span class="text-[10px] text-foreground/60 block">Dapukan Khusus Lokal</span>
							</div>
						</label>
					</div>
				</div>

				{#if tipeDapukan === 'tetap'}
					<div>
						<label for="dapukanId" class="block text-xs font-semibold text-foreground mb-1.5">
							Pilih Dapukan 4S *
						</label>
						<SearchableSelect
							id="dapukanId"
							name="dapukanId"
							options={masterDapukanOptions}
							bind:value={selectedDapukanId}
							required
							placeholder="-- Pilih Dapukan 4S --"
							searchPlaceholder="Cari nama dapukan..."
						/>
					</div>
				{:else}
					<div>
						<label for="namaDapukanCustom" class="block text-xs font-semibold text-foreground mb-1.5">
							Nama Dapukan Tentatif / Panitia *
						</label>
						<input
							id="namaDapukanCustom"
							name="namaDapukanCustom"
							type="text"
							bind:value={inputNamaDapukanCustom}
							required
							placeholder="Contoh: Panitia Qurban, Seksi Konsumsi"
							class="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
						/>
					</div>
				{/if}

				<!-- Tingkat Scope Wilayah -->
				<div>
					<label for="tingkatScope" class="block text-xs font-semibold text-foreground mb-1.5">
						Tingkat Scope Wewenang *
					</label>
					<select
						id="tingkatScope"
						name="tingkatScope"
						bind:value={selectedScope}
						required
						class="w-full bg-secondary/50 border border-border rounded-lg px-2.5 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
					>
						<option value="Kelompok">Kelompok (Tingkat Basis)</option>
						{#if data.isPusat || data.adminScopeLevel === 'Daerah' || data.adminScopeLevel === 'Desa'}
							<option value="Desa">Desa (Mengawasi Semua Kelompok)</option>
						{/if}
						{#if data.isPusat || data.adminScopeLevel === 'Daerah'}
							<option value="Daerah">Daerah (Mengawasi Semua Desa)</option>
						{/if}
						{#if data.isPusat}
							<option value="Pusat">Pusat (Akses Nasional)</option>
						{/if}
					</select>
				</div>

				<!-- Pemilihan Wilayah Terkait Sesuai Scope -->
				{#if selectedScope === 'Kelompok'}
					<div>
						<div class="flex items-center justify-between mb-1.5">
							<label for="kelompokId" class="block text-sm font-semibold text-foreground">
								Pilih Kelompok Cakupan *
							</label>
							{#if selectedUserObj?.kelompokId}
								<span class="text-xs text-primary font-semibold">Terkunci ke Basis Jamaah</span>
							{/if}
						</div>
						<SearchableSelect
							id="kelompokId"
							name="kelompokId"
							options={kelompokOptions}
							bind:value={selectedKelompokId}
							disabled={Boolean(selectedUserObj?.kelompokId)}
							required
							placeholder="-- Pilih Kelompok Cakupan --"
							searchPlaceholder="Cari kelompok..."
						/>
						{#if selectedUserObj?.kelompokId}
							<p class="text-xs text-foreground/60 mt-1">
								Scope kelompok dikunci ke basis kelompok jamaah ({selectedUserObj.kelompokNama}).
							</p>
						{/if}
					</div>
				{:else if selectedScope === 'Desa'}
					<div>
						<div class="flex items-center justify-between mb-1.5">
							<label for="desaId" class="block text-sm font-semibold text-foreground">
								Pilih Desa Cakupan *
							</label>
							{#if selectedUserObj?.desaId}
								<span class="text-xs text-primary font-semibold">Terkunci ke Basis Jamaah</span>
							{/if}
						</div>
						<SearchableSelect
							id="desaId"
							name="desaId"
							options={desaOptions}
							bind:value={selectedDesaId}
							disabled={Boolean(selectedUserObj?.desaId)}
							required
							placeholder="-- Pilih Desa Cakupan --"
							searchPlaceholder="Cari desa..."
						/>
						{#if selectedUserObj?.desaId}
							<p class="text-xs text-foreground/60 mt-1">
								Scope desa dikunci ke basis desa jamaah ({selectedUserObj.desaNama}).
							</p>
						{/if}
					</div>
				{:else if selectedScope === 'Daerah'}
					<div>
						<div class="flex items-center justify-between mb-1.5">
							<label for="daerahId" class="block text-sm font-semibold text-foreground">
								Pilih Daerah Cakupan *
							</label>
							{#if selectedUserObj?.daerahId}
								<span class="text-xs text-primary font-semibold">Terkunci ke Basis Jamaah</span>
							{/if}
						</div>
						<SearchableSelect
							id="daerahId"
							name="daerahId"
							options={daerahOptions}
							bind:value={selectedDaerahId}
							disabled={Boolean(selectedUserObj?.daerahId)}
							required
							placeholder="-- Pilih Daerah Cakupan --"
							searchPlaceholder="Cari daerah..."
						/>
						{#if selectedUserObj?.daerahId}
							<p class="text-xs text-foreground/60 mt-1">
								Scope daerah dikunci ke basis daerah jamaah ({selectedUserObj.daerahNama}).
							</p>
						{/if}
					</div>
				{/if}

				<div class="flex items-center justify-between gap-2 pt-3 border-t border-border">
					{#if isAssignFormDirty()}
						<button
							type="button"
							onclick={resetAssignForm}
							class="text-xs text-destructive hover:underline font-semibold"
						>
							Kosongkan Isian
						</button>
					{:else}
						<div></div>
					{/if}
					<div class="flex items-center gap-2">
						<button
							type="button"
							onclick={closeAssignModal}
							class="px-4 py-2.5 rounded-xl border border-border text-sm font-semibold text-foreground/80 hover:bg-secondary"
						>
							Batal
						</button>
						<button
							type="submit"
							class="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90"
						>
							Simpan Penugasan
						</button>
					</div>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- Modal Ubah Penugasan Pengurus -->
{#if showEditModal && editingPengurus}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
		role="dialog"
		aria-modal="true"
		onclick={(e) => {
			if (e.target === e.currentTarget) closeEditModal();
		}}
	>
		<div class="bg-card border border-border rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-5 max-h-[90vh] overflow-y-auto">
			<div class="flex items-center justify-between pb-3 border-b border-border">
				<div class="flex items-center gap-2">
					<div class="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
						<Pencil class="w-4 h-4" />
					</div>
					<div>
						<h3 class="text-sm font-bold text-foreground">Ubah Penugasan Pengurus</h3>
						<p class="text-[11px] text-foreground/60">{editingPengurus.userNama || '-'}</p>
					</div>
				</div>
				<button
					type="button"
					onclick={closeEditModal}
					class="p-1 rounded-lg hover:bg-secondary text-foreground/60 hover:text-foreground"
				>
					<X class="w-5 h-5" />
				</button>
			</div>

			<form
				method="POST"
				action="?/updateDapukan"
				use:enhance={keepScrollSubmit({ onSuccess: () => closeEditModal() })}
				class="space-y-4"
			>
				<input type="hidden" name="id" value={editingPengurus.id} />

				<!-- Informasi Pengurus & Basis Wilayah -->
				<div class="p-3 bg-secondary/40 border border-border rounded-xl space-y-1.5">
					<div class="flex items-center justify-between">
						<span class="text-xs font-semibold text-foreground">{editingPengurus.userNama}</span>
						{#if editingPengurus.userEmail}
							<span class="text-[11px] text-foreground/50">{editingPengurus.userEmail}</span>
						{/if}
					</div>
					{#if editingUserObj}
						<div class="text-[11px] text-foreground/70 flex items-center gap-1.5 pt-1 border-t border-border/50">
							<MapPin class="w-3.5 h-3.5 text-primary shrink-0" />
							<span>Basis Wilayah:</span>
							<span class="font-medium text-foreground">
								{editingUserObj.kelompokNama || '-'}{editingUserObj.desaNama ? ` • ${editingUserObj.desaNama}` : ''}{editingUserObj.daerahNama ? ` • ${editingUserObj.daerahNama}` : ''}
							</span>
						</div>
					{/if}
				</div>

				<!-- Jenis Dapukan: Baku vs Kustom -->
				<div>
					<span class="block text-xs font-semibold text-foreground mb-2">Tipe Dapukan *</span>
					<div class="grid grid-cols-2 gap-3">
						<label class="p-3 border rounded-xl flex items-center gap-2.5 cursor-pointer transition-colors {editTipeDapukan === 'tetap' ? 'border-primary bg-primary/5' : 'border-border bg-secondary/30'}">
							<input
								type="radio"
								name="tipeDapukan"
								value="tetap"
								bind:group={editTipeDapukan}
								class="text-primary focus:ring-primary"
							/>
							<div>
								<span class="text-xs font-bold text-foreground block">Dapukan 4S</span>
								<span class="text-[10px] text-foreground/60 block">Hak Admin Elevated</span>
							</div>
						</label>

						<label class="p-3 border rounded-xl flex items-center gap-2.5 cursor-pointer transition-colors {editTipeDapukan === 'custom' ? 'border-primary bg-primary/5' : 'border-border bg-secondary/30'}">
							<input
								type="radio"
								name="tipeDapukan"
								value="custom"
								bind:group={editTipeDapukan}
								class="text-primary focus:ring-primary"
							/>
							<div>
								<span class="text-xs font-bold text-foreground block">Tentatif / Panitia</span>
								<span class="text-[10px] text-foreground/60 block">Dapukan Khusus Lokal</span>
							</div>
						</label>
					</div>
				</div>

				{#if editTipeDapukan === 'tetap'}
					<div>
						<label for="editDapukanId" class="block text-xs font-semibold text-foreground mb-1.5">
							Pilih Dapukan 4S *
						</label>
						<SearchableSelect
							id="editDapukanId"
							name="dapukanId"
							options={editMasterDapukanOptions}
							bind:value={editDapukanId}
							required
							placeholder="-- Pilih Dapukan 4S --"
							searchPlaceholder="Cari nama dapukan..."
						/>
					</div>
				{:else}
					<div>
						<label for="editNamaDapukanCustom" class="block text-xs font-semibold text-foreground mb-1.5">
							Nama Dapukan Tentatif / Panitia *
						</label>
						<input
							id="editNamaDapukanCustom"
							name="namaDapukanCustom"
							type="text"
							bind:value={editNamaDapukanCustom}
							required
							placeholder="Contoh: Panitia Qurban, Seksi Konsumsi"
							class="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
						/>
					</div>
				{/if}

				<!-- Tingkat Scope Wilayah -->
				<div>
					<label for="editTingkatScope" class="block text-xs font-semibold text-foreground mb-1.5">
						Tingkat Scope Wewenang *
					</label>
					<select
						id="editTingkatScope"
						name="tingkatScope"
						bind:value={editScope}
						required
						class="w-full bg-secondary/50 border border-border rounded-lg px-2.5 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
					>
						<option value="Kelompok">Kelompok (Tingkat Basis)</option>
						{#if data.isPusat || data.adminScopeLevel === 'Daerah' || data.adminScopeLevel === 'Desa'}
							<option value="Desa">Desa (Mengawasi Semua Kelompok)</option>
						{/if}
						{#if data.isPusat || data.adminScopeLevel === 'Daerah'}
							<option value="Daerah">Daerah (Mengawasi Semua Desa)</option>
						{/if}
						{#if data.isPusat}
							<option value="Pusat">Pusat (Akses Nasional)</option>
						{/if}
					</select>
				</div>

				<!-- Pemilihan Wilayah Terkait Sesuai Scope -->
				{#if editScope === 'Kelompok'}
					<div>
						<div class="flex items-center justify-between mb-1.5">
							<label for="editKelompokId" class="block text-sm font-semibold text-foreground">
								Pilih Kelompok Cakupan *
							</label>
							{#if editingUserObj?.kelompokId}
								<span class="text-xs text-primary font-semibold">Terkunci ke Basis Jamaah</span>
							{/if}
						</div>
						<SearchableSelect
							id="editKelompokId"
							name="kelompokId"
							options={editKelompokOptions}
							bind:value={editKelompokId}
							disabled={Boolean(editingUserObj?.kelompokId)}
							required
							placeholder="-- Pilih Kelompok Cakupan --"
							searchPlaceholder="Cari kelompok..."
						/>
						{#if editingUserObj?.kelompokId}
							<p class="text-xs text-foreground/60 mt-1">
								Scope kelompok dikunci ke basis kelompok jamaah ({editingUserObj.kelompokNama}).
							</p>
						{/if}
					</div>
				{:else if editScope === 'Desa'}
					<div>
						<div class="flex items-center justify-between mb-1.5">
							<label for="editDesaId" class="block text-sm font-semibold text-foreground">
								Pilih Desa Cakupan *
							</label>
							{#if editingUserObj?.desaId}
								<span class="text-xs text-primary font-semibold">Terkunci ke Basis Jamaah</span>
							{/if}
						</div>
						<SearchableSelect
							id="editDesaId"
							name="desaId"
							options={editDesaOptions}
							bind:value={editDesaId}
							disabled={Boolean(editingUserObj?.desaId)}
							required
							placeholder="-- Pilih Desa Cakupan --"
							searchPlaceholder="Cari desa..."
						/>
						{#if editingUserObj?.desaId}
							<p class="text-xs text-foreground/60 mt-1">
								Scope desa dikunci ke basis desa jamaah ({editingUserObj.desaNama}).
							</p>
						{/if}
					</div>
				{:else if editScope === 'Daerah'}
					<div>
						<div class="flex items-center justify-between mb-1.5">
							<label for="editDaerahId" class="block text-sm font-semibold text-foreground">
								Pilih Daerah Cakupan *
							</label>
							{#if editingUserObj?.daerahId}
								<span class="text-xs text-primary font-semibold">Terkunci ke Basis Jamaah</span>
							{/if}
						</div>
						<SearchableSelect
							id="editDaerahId"
							name="daerahId"
							options={editDaerahOptions}
							bind:value={editDaerahId}
							disabled={Boolean(editingUserObj?.daerahId)}
							required
							placeholder="-- Pilih Daerah Cakupan --"
							searchPlaceholder="Cari daerah..."
						/>
						{#if editingUserObj?.daerahId}
							<p class="text-xs text-foreground/60 mt-1">
								Scope daerah dikunci ke basis daerah jamaah ({editingUserObj.daerahNama}).
							</p>
						{/if}
					</div>
				{/if}

				<div class="flex items-center justify-end gap-2 pt-3 border-t border-border">
					<button
						type="button"
						onclick={closeEditModal}
						class="px-4 py-2.5 rounded-xl border border-border text-sm font-semibold text-foreground/80 hover:bg-secondary"
					>
						Batal
					</button>
					<button
						type="submit"
						class="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90"
					>
						Simpan Perubahan
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- Modal Konfirmasi Cabut Penugasan -->
{#if showRemoveModal && selectedPengurusToRemove}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
		role="dialog"
		aria-modal="true"
		onclick={(e) => {
			if (e.target === e.currentTarget) {
				showRemoveModal = false;
				selectedPengurusToRemove = null;
			}
		}}
	>
		<div class="bg-card border border-border rounded-2xl max-w-sm w-full p-6 shadow-xl space-y-4 text-center">
			<div class="w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
				<AlertTriangle class="w-6 h-6" />
			</div>

			<div>
				<h3 class="text-sm font-bold text-foreground">Cabut Penugasan Pengurus?</h3>
				<p class="text-xs text-foreground/60 mt-1 leading-relaxed">
					Apakah Anda yakin ingin mencabut dapukan <strong class="text-foreground">{selectedPengurusToRemove.dapukan}</strong> dari <strong class="text-foreground">{selectedPengurusToRemove.nama}</strong>?
				</p>
			</div>

			<form
				method="POST"
				action="?/removeDapukan"
				use:enhance={keepScrollSubmit({
					onSuccess: () => {
						showRemoveModal = false;
						selectedPengurusToRemove = null;
					}
				})}
				class="flex items-center justify-center gap-2 pt-2"
			>
				<input type="hidden" name="id" value={selectedPengurusToRemove.id} />

				<button
					type="button"
					onclick={() => {
						showRemoveModal = false;
						selectedPengurusToRemove = null;
					}}
					class="px-4 py-2 rounded-lg border border-border text-xs font-semibold text-foreground/80 hover:bg-secondary"
				>
					Batal
				</button>
				<button
					type="submit"
					class="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-xs font-semibold hover:bg-destructive/90"
				>
					Ya, Cabut Dapukan
				</button>
			</form>
		</div>
	</div>
{/if}

