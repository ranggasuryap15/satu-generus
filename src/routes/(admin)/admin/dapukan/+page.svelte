<!--
  @file src/routes/(admin)/admin/dapukan/+page.svelte
  @purpose Halaman manajemen struktur dapukan/jabatan dan penugasan RBAC pengurus dengan proteksi wewenang 4S (Kyai/Penerobos di tingkat kelompok) serta penguncian scope wilayah
  @usedBy Route admin '/admin/dapukan'
  @dependencies @lucide/svelte, Svelte 5 Runes, $lib/components/SearchableSelect.svelte
  @publicFunctions openAssignModal, closeAssignModal, resetAssignForm, confirmRemove
  @sideEffects Menampilkan data dapukan/pengurus dan mengirim form mutasi pengurus ke server
-->
<script lang="ts">
	import {
		ShieldCheck,
		Plus,
		Search,
		UserCheck,
		Trash2,
		X,
		Award,
		MapPin,
		AlertTriangle
	} from '@lucide/svelte';
	import type { PageData, ActionData } from './$types';
	import SearchableSelect from '$lib/components/SearchableSelect.svelte';
	import { confirmAction } from '$lib/confirm.svelte';

	let { data, form } = $props<{ data: PageData; form: ActionData }>();

	let searchQuery = $state('');
	let showAssignModal = $state(false);
	let showRemoveModal = $state(false);
	let selectedPengurusToRemove = $state<{ id: string; nama: string; jabatan: string } | null>(null);

	// Form State
	let tipeJabatan = $state<'tetap' | 'custom'>('tetap');
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
		(data.masterDapukan || []).map((m: (typeof data.masterDapukan)[number]) => ({
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

	function isAssignFormDirty() {
		return (
			String(selectedUserId).trim() !== '' ||
			String(selectedDapukanId).trim() !== '' ||
			inputNamaDapukanCustom.trim() !== '' ||
			String(selectedKelompokId).trim() !== '' ||
			String(selectedDesaId).trim() !== '' ||
			String(selectedDaerahId).trim() !== '' ||
			tipeJabatan !== 'tetap' ||
			selectedScope !== 'Kelompok'
		);
	}

	function resetAssignForm() {
		selectedUserId = '';
		tipeJabatan = 'tetap';
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

	async function closeAssignModal() {
		if (isAssignFormDirty()) {
			const ok = await confirmAction({
				title: 'Tutup Formulir Penugasan?',
				message:
					'Ada isian penugasan yang belum disimpan. Tetap tutup modal? Isian Anda akan tetap tersimpan sebagai draf.',
				confirmText: 'Ya, Tutup Modal',
				cancelText: 'Lanjut Mengisi',
				variant: 'warning'
			});
			if (ok) {
				showAssignModal = false;
			}
		} else {
			showAssignModal = false;
		}
	}

	$effect(() => {
		if (form?.success) {
			resetAssignForm();
			showAssignModal = false;
		}
	});

	let filteredPengurus = $derived(
		(data.daftarPengurus || []).filter((p: (typeof data.daftarPengurus)[number]) => {
			const q = searchQuery.toLowerCase();
			const jabatan = (p.namaDapukanCustom || p.dapukanNama || '').toLowerCase();
			const user = (p.userNama || '').toLowerCase();
			const scope = (p.tingkatScope || '').toLowerCase();
			return user.includes(q) || jabatan.includes(q) || scope.includes(q);
		})
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
				Kelola jabatan baku (4S) dan jabatan tentatif serta lingkup wewenang administratif pengurus.
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
				title="Pada tingkat kelompok, hanya pengurus 4S dengan jabatan Kyai atau Sekretaris / Penerobos yang dapat menugaskan pengurus"
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

	<!-- Section: Master Dapukan Baku (4S) -->
	<div class="bg-card border border-border rounded-xl p-5 shadow-sm space-y-3">
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-2">
				<Award class="w-4 h-4 text-primary" />
				<h2 class="text-sm font-bold text-foreground">Struktur Master Dapukan Baku (4S)</h2>
			</div>
			<span class="text-[11px] text-foreground/50">Hak Akses Modifikasi Administratif</span>
		</div>

		<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
			{#each data.masterDapukan as m}
				<div class="p-3 rounded-lg border border-border bg-secondary/30 flex items-center justify-between">
					<div>
						<p class="text-xs font-bold text-foreground">{m.namaDapukan}</p>
						<p class="text-[10px] text-foreground/50">Master Global</p>
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
				placeholder="Cari nama pengurus, jabatan, scope..."
				bind:value={searchQuery}
				class="w-full bg-secondary/50 border border-border rounded-lg pl-9 pr-3 py-2 text-xs text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary focus:bg-background transition-all"
			/>
		</div>

		<span class="text-xs text-foreground/60">
			Total <span class="font-bold text-foreground">{filteredPengurus.length}</span> penugasan pengurus
		</span>
	</div>

	<!-- Tabel Penugasan Pengurus RBAC -->
	<div class="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
		<div class="overflow-x-auto">
			<table class="w-full text-left text-xs">
				<thead class="bg-secondary/60 text-foreground/70 uppercase text-[10px] tracking-wider border-b border-border">
					<tr>
						<th class="py-3 px-4 font-semibold">Nama Pengurus</th>
						<th class="py-3 px-4 font-semibold">Jabatan / Dapukan</th>
						<th class="py-3 px-4 font-semibold">Tingkat Scope</th>
						<th class="py-3 px-4 font-semibold">Wilayah Cakupan</th>
						<th class="py-3 px-4 font-semibold">Hak Wewenang</th>
						<th class="py-3 px-4 font-semibold text-right">Aksi</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-border">
					{#if filteredPengurus.length === 0}
						<tr>
							<td colspan="6" class="py-12 text-center text-foreground/50">
								Belum ada pengurus yang ditugaskan atau sesuai pencarian.
							</td>
						</tr>
					{:else}
						{#each filteredPengurus as p}
							<tr class="hover:bg-secondary/30 transition-colors">
								<td class="py-3.5 px-4 font-semibold text-foreground">
									<div class="flex items-center gap-2">
										<div class="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
											{(p.userNama || 'U')[0]}
										</div>
										<div>
											<p class="leading-tight">{p.userNama || '-'}</p>
											<p class="text-[10px] text-foreground/50 leading-tight">{p.userEmail || ''}</p>
										</div>
									</div>
								</td>
								<td class="py-3.5 px-4">
									{#if p.namaDapukanCustom}
										<span class="font-medium text-foreground">{p.namaDapukanCustom}</span>
										<span class="block text-[10px] text-foreground/50">(Tentatif/Kustom)</span>
									{:else}
										<span class="font-bold text-primary">{p.dapukanNama || '-'}</span>
										<span class="block text-[10px] text-foreground/50">(Master Baku)</span>
									{/if}
								</td>
								<td class="py-3.5 px-4">
									<span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-secondary text-foreground/80">
										{p.tingkatScope}
									</span>
								</td>
								<td class="py-3.5 px-4 text-foreground/70">
									<span class="inline-flex items-center gap-1">
										<MapPin class="w-3 h-3 text-foreground/40" />
										{p.kelompokNama || p.desaNama || p.daerahNama || 'Semua Wilayah'}
									</span>
								</td>
								<td class="py-3.5 px-4">
									{#if p.is4S}
										<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary">
											<ShieldCheck class="w-3 h-3" />
											Admin CRUD (4S)
										</span>
									{:else}
										<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-secondary text-foreground/60">
											Pengurus (Read-Only)
										</span>
									{/if}
								</td>
								<td class="py-3.5 px-4 text-right">
									{#if data.canManageDapukan}
										<button
											type="button"
											onclick={() => {
												selectedPengurusToRemove = {
													id: p.id,
													nama: p.userNama || 'Pengurus',
													jabatan: p.namaDapukanCustom || p.dapukanNama || 'Jabatan'
												};
												showRemoveModal = true;
											}}
											class="p-1.5 rounded-lg text-destructive hover:bg-destructive/10 transition-colors"
											title="Cabut Penugasan"
										>
											<Trash2 class="w-4 h-4" />
										</button>
									{:else}
										<span class="text-foreground/30 text-xs">-</span>
									{/if}
								</td>
							</tr>
						{/each}
					{/if}
				</tbody>
			</table>
		</div>
	</div>
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

			<form method="POST" action="?/assignDapukan" class="space-y-4">
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

				<!-- Jenis Jabatan: Baku vs Kustom -->
				<div>
					<span class="block text-xs font-semibold text-foreground mb-2">Tipe Jabatan *</span>
					<div class="grid grid-cols-2 gap-3">
						<label class="p-3 border rounded-xl flex items-center gap-2.5 cursor-pointer transition-colors {tipeJabatan === 'tetap' ? 'border-primary bg-primary/5' : 'border-border bg-secondary/30'}">
							<input
								type="radio"
								name="tipeJabatan"
								value="tetap"
								bind:group={tipeJabatan}
								class="text-primary focus:ring-primary"
							/>
							<div>
								<span class="text-xs font-bold text-foreground block">Jabatan Baku 4S</span>
								<span class="text-[10px] text-foreground/60 block">Hak Admin Elevated</span>
							</div>
						</label>

						<label class="p-3 border rounded-xl flex items-center gap-2.5 cursor-pointer transition-colors {tipeJabatan === 'custom' ? 'border-primary bg-primary/5' : 'border-border bg-secondary/30'}">
							<input
								type="radio"
								name="tipeJabatan"
								value="custom"
								bind:group={tipeJabatan}
								class="text-primary focus:ring-primary"
							/>
							<div>
								<span class="text-xs font-bold text-foreground block">Tentatif / Panitia</span>
								<span class="text-[10px] text-foreground/60 block">Jabatan Khusus Lokal</span>
							</div>
						</label>
					</div>
				</div>

				{#if tipeJabatan === 'tetap'}
					<div>
						<label for="dapukanId" class="block text-xs font-semibold text-foreground mb-1.5">
							Pilih Jabatan Master 4S *
						</label>
						<SearchableSelect
							id="dapukanId"
							name="dapukanId"
							options={masterDapukanOptions}
							bind:value={selectedDapukanId}
							required
							placeholder="-- Pilih Jabatan Master 4S --"
							searchPlaceholder="Cari nama jabatan..."
						/>
					</div>
				{:else}
					<div>
						<label for="namaDapukanCustom" class="block text-xs font-semibold text-foreground mb-1.5">
							Nama Jabatan Tentatif / Panitia *
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
							<label for="kelompokId" class="block text-xs font-semibold text-foreground">
								Pilih Kelompok Cakupan *
							</label>
							{#if selectedUserObj?.kelompokId}
								<span class="text-[10px] text-primary font-semibold">Terkunci ke Basis Jamaah</span>
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
							<p class="text-[10px] text-foreground/50 mt-1">
								Scope kelompok dikunci ke basis kelompok jamaah ({selectedUserObj.kelompokNama}).
							</p>
						{/if}
					</div>
				{:else if selectedScope === 'Desa'}
					<div>
						<div class="flex items-center justify-between mb-1.5">
							<label for="desaId" class="block text-xs font-semibold text-foreground">
								Pilih Desa Cakupan *
							</label>
							{#if selectedUserObj?.desaId}
								<span class="text-[10px] text-primary font-semibold">Terkunci ke Basis Jamaah</span>
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
							<p class="text-[10px] text-foreground/50 mt-1">
								Scope desa dikunci ke basis desa jamaah ({selectedUserObj.desaNama}).
							</p>
						{/if}
					</div>
				{:else if selectedScope === 'Daerah'}
					<div>
						<div class="flex items-center justify-between mb-1.5">
							<label for="daerahId" class="block text-xs font-semibold text-foreground">
								Pilih Daerah Cakupan *
							</label>
							{#if selectedUserObj?.daerahId}
								<span class="text-[10px] text-primary font-semibold">Terkunci ke Basis Jamaah</span>
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
							<p class="text-[10px] text-foreground/50 mt-1">
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
							onclick={closeAssignModal}
							class="px-4 py-2 rounded-lg border border-border text-xs font-semibold text-foreground/80 hover:bg-secondary"
						>
							Batal
						</button>
						<button
							type="submit"
							class="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90"
						>
							Simpan Penugasan
						</button>
					</div>
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
					Apakah Anda yakin ingin mencabut jabatan <strong class="text-foreground">{selectedPengurusToRemove.jabatan}</strong> dari <strong class="text-foreground">{selectedPengurusToRemove.nama}</strong>?
				</p>
			</div>

			<form method="POST" action="?/removeDapukan" class="flex items-center justify-center gap-2 pt-2">
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
					Ya, Cabut Jabatan
				</button>
			</form>
		</div>
	</div>
{/if}

