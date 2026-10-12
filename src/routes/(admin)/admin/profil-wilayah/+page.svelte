<!--
  @file src/routes/(admin)/admin/profil-wilayah/+page.svelte
  @purpose Halaman dedicated profil wilayah (Kelompok/Desa/Daerah) untuk manajemen lokasi geotagging tempat pengajian, rekening/QRIS shodaqoh berotoritas KU/Superadmin, dan hierarki sub-wilayah dengan dropdown pencarian interaktif dan scroll retention
  @usedBy Route admin '/admin/profil-wilayah'
  @dependencies @lucide/svelte, Svelte 5 Runes, $lib/components/SearchableSelect.svelte, $lib/components/LocationPicker.svelte, $lib/components/Pagination.svelte, $app/forms (enhance), $lib/keepScroll.ts (keepScrollSubmit)
  @publicFunctions openLocationModal, closeLocationModal, openAddRekeningModal, closeAddRekeningModal, openEditRekeningModal, closeEditRekeningModal, copyToClipboard
  @sideEffects Mengirim form updateLokasi, addRekening, updateRekening, deleteRekening via enhance tanpa reload kasar dan menjaga scroll
-->
<script lang="ts">
	import {
		Building2,
		CreditCard,
		ExternalLink,
		Eye,
		Globe,
		Landmark,
		Lock,
		MapPin,
		Pencil,
		Plus,
		QrCode,
		ShieldCheck,
		Trash2,
		Users,
		X,
		Copy,
		Check,
		Layers
	} from '@lucide/svelte';
	import type { PageData, ActionData } from './$types';
	import SearchableSelect from '$lib/components/SearchableSelect.svelte';
	import LocationPicker from '$lib/components/LocationPicker.svelte';
	import Pagination from '$lib/components/Pagination.svelte';
	import { enhance } from '$app/forms';
	import { keepScrollSubmit } from '$lib/keepScroll';
	import { confirmAction } from '$lib/confirm.svelte';

	let { data, form } = $props<{ data: PageData; form: ActionData }>();

	// State Selector Cascading (Khusus Pusat / Superadmin atau Admin Berlingkup Luas)
	let selectedDaerahId = $state<string | number>(
		data.activeScope === 'Daerah' ? data.activeId || '' : (data.profilData?.daerahId || '')
	);
	let selectedDesaId = $state<string | number>(
		data.activeScope === 'Desa' ? data.activeId || '' : (data.profilData?.desaId || '')
	);
	let selectedKelompokId = $state<string | number>(
		data.activeScope === 'Kelompok' ? data.activeId || '' : ''
	);

	// State Modal Edit Lokasi
	let showLocationModal = $state(false);
	let editLokasiNama = $state('');
	let editLatitude = $state('');
	let editLongitude = $state('');
	let editRadiusMeter = $state(100);
	let editGmapsUrl = $state('');

	// State Modal Rekening
	let showRekeningModal = $state(false);
	let isEditingRekening = $state(false);
	let editRekeningId = $state('');
	let inputNamaBank = $state('');
	let inputNomorRekening = $state('');
	let inputAtasNama = $state('');
	let inputTipeTujuan = $state('Infaq & Shodaqoh');
	let inputQrisImageUrl = $state('');
	let inputKeterangan = $state('');
	let inputIsActive = $state(true);

	// State Modal Preview QRIS
	let previewQrisUrl = $state<string | null>(null);
	let previewQrisTitle = $state<string>('');

	// State Feedback Copy No Rekening
	let copiedRekeningId = $state<string | null>(null);

	// State Pagination Sub Wilayah
	let subPage = $state(1);
	let subPageSize = $state(10);
	let paginatedSubWilayah = $derived(
		(data.subWilayahList || []).slice((subPage - 1) * subPageSize, subPage * subPageSize)
	);

	function openLocationModal() {
		if (!data.profilData) return;
		editLokasiNama = data.profilData.lokasiNama || '';
		editLatitude = data.profilData.latitude || '';
		editLongitude = data.profilData.longitude || '';
		editRadiusMeter = data.profilData.radiusMeter || 100;
		editGmapsUrl = data.profilData.gmapsUrl || '';
		showLocationModal = true;
	}

	function closeLocationModal() {
		showLocationModal = false;
	}

	function openAddRekeningModal() {
		isEditingRekening = false;
		editRekeningId = '';
		inputNamaBank = '';
		inputNomorRekening = '';
		inputAtasNama = '';
		inputTipeTujuan = 'Infaq & Shodaqoh';
		inputQrisImageUrl = '';
		inputKeterangan = '';
		inputIsActive = true;
		showRekeningModal = true;
	}

	function openEditRekeningModal(rek: (typeof data.daftarRekening)[number]) {
		isEditingRekening = true;
		editRekeningId = rek.id;
		inputNamaBank = rek.namaBank;
		inputNomorRekening = rek.nomorRekening;
		inputAtasNama = rek.atasNama;
		inputTipeTujuan = rek.tipeTujuan || 'Infaq & Shodaqoh';
		inputQrisImageUrl = rek.qrisImageUrl || '';
		inputKeterangan = rek.keterangan || '';
		inputIsActive = rek.isActive ?? true;
		showRekeningModal = true;
	}

	function closeRekeningModal() {
		showRekeningModal = false;
	}

	async function copyToClipboard(text: string, id: string) {
		try {
			await navigator.clipboard.writeText(text);
			copiedRekeningId = id;
			setTimeout(() => {
				if (copiedRekeningId === id) copiedRekeningId = null;
			}, 2000);
		} catch (e) {
			console.error('Gagal menyalin:', e);
		}
	}

	$effect(() => {
		if (form?.success) {
			showLocationModal = false;
			showRekeningModal = false;
		}
	});

	// Opsi filter bertingkat untuk Superadmin / Multi-Wilayah
	const availableDesaList = $derived(
		selectedDaerahId
			? data.accessibleWilayah.desaList.filter((d: any) => String(d.daerahId) === String(selectedDaerahId))
			: data.accessibleWilayah.desaList
	);

	const availableKelompokList = $derived(
		selectedDesaId
			? data.accessibleWilayah.kelompokList.filter((k: any) => String(k.desaId) === String(selectedDesaId))
			: []
	);

	const daerahOptions = $derived(
		(data.accessibleWilayah.daerahList || []).map((dr: any) => ({
			value: dr.id,
			label: dr.nama,
			sublabel: dr.kotaKabupaten ? `${dr.kotaKabupaten}, ${dr.provinsi}` : dr.provinsi
		}))
	);

	const desaOptions = $derived(
		availableDesaList.map((d: any) => ({
			value: d.id,
			label: d.nama,
			sublabel: d.kecamatan ? `Kec. ${d.kecamatan}` : undefined
		}))
	);

	const kelompokOptions = $derived(
		availableKelompokList.map((k: any) => ({
			value: k.id,
			label: k.nama,
			sublabel: k.lokasiNama || undefined
		}))
	);

	function onSelectDaerah(val: string | number) {
		selectedDaerahId = val;
		selectedDesaId = '';
		selectedKelompokId = '';
		if (val) {
			window.location.href = `/admin/profil-wilayah?scope=Daerah&id=${val}`;
		}
	}

	function onSelectDesa(val: string | number) {
		selectedDesaId = val;
		selectedKelompokId = '';
		if (val) {
			window.location.href = `/admin/profil-wilayah?scope=Desa&id=${val}`;
		}
	}

	function onSelectKelompok(val: string | number) {
		selectedKelompokId = val;
		if (val) {
			window.location.href = `/admin/profil-wilayah?scope=Kelompok&id=${val}`;
		}
	}
</script>

<svelte:head>
	<title>Profil Wilayah & Rekening - Admin Satu Generus</title>
</svelte:head>

<div class="space-y-6">
	<!-- Page Header -->
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
		<div>
			<h1 class="text-xl font-bold text-foreground tracking-tight flex items-center gap-2">
				<Landmark class="w-6 h-6 text-primary" />
				<span>Profil & Pengaturan Wilayah</span>
			</h1>
			<p class="text-xs text-foreground/60 mt-0.5">
				Kelola titik lokasi pengajian, nomor rekening & QRIS shodaqoh resmi, serta hierarki wilayah.
			</p>
		</div>

		{#if data.profilData}
			<div class="flex items-center gap-2">
				<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
					<span class="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
					{data.activeScope}: {data.profilData.nama}
				</span>
			</div>
		{/if}
	</div>

	<!-- Selector Bertingkat (Tampil untuk Pusat / Superadmin atau jika admin memiliki akses multi-wilayah) -->
	{#if data.adminScope.isPusat || data.accessibleWilayah.daerahList.length > 1 || data.accessibleWilayah.desaList.length > 1}
		<div class="bg-card border border-border rounded-xl p-4 shadow-xs space-y-3">
			<div class="flex items-center justify-between">
				<h2 class="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
					<Layers class="w-4 h-4 text-primary" />
					<span>Pilih Lingkup Wilayah yang Ingin Dikelola</span>
				</h2>
			</div>

			<div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
				<!-- Pilih Daerah -->
				<div>
					<label for="select-daerah" class="block text-xs font-medium text-foreground/70 mb-1">Pilih Daerah</label>
					<SearchableSelect
						id="select-daerah"
						name="pilihDaerah"
						options={daerahOptions}
						value={selectedDaerahId}
						placeholder="-- Cari / Pilih Daerah --"
						searchPlaceholder="Ketik nama daerah atau kota..."
						onchange={onSelectDaerah}
					/>
				</div>

				<!-- Pilih Desa -->
				<div>
					<label for="select-desa" class="block text-xs font-medium text-foreground/70 mb-1">Pilih Desa</label>
					<SearchableSelect
						id="select-desa"
						name="pilihDesa"
						options={desaOptions}
						value={selectedDesaId}
						disabled={!selectedDaerahId}
						placeholder={selectedDaerahId ? '-- Cari / Pilih Desa --' : '-- Pilih Daerah Dahulu --'}
						searchPlaceholder="Ketik nama desa..."
						onchange={onSelectDesa}
					/>
				</div>

				<!-- Pilih Kelompok -->
				<div>
					<label for="select-kelompok" class="block text-xs font-medium text-foreground/70 mb-1">Pilih Kelompok</label>
					<SearchableSelect
						id="select-kelompok"
						name="pilihKelompok"
						options={kelompokOptions}
						value={selectedKelompokId}
						disabled={!selectedDesaId}
						placeholder={selectedDesaId ? '-- Cari / Pilih Kelompok --' : '-- Pilih Desa Dahulu --'}
						searchPlaceholder="Ketik nama kelompok..."
						onchange={onSelectKelompok}
					/>
				</div>
			</div>
		</div>
	{/if}

	<!-- Empty State jika belum ada wilayah yang dipilih (Misal Superadmin pertama buka) -->
	{#if !data.profilData}
		<div class="bg-card border border-border rounded-2xl p-12 text-center space-y-4 shadow-xs">
			<div class="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
				<Landmark class="w-8 h-8" />
			</div>
			<div class="max-w-md mx-auto space-y-1.5">
				<h3 class="text-base font-bold text-foreground">Silakan Pilih Lingkup Wilayah</h3>
				<p class="text-xs text-foreground/60 leading-relaxed">
					Gunakan pilihan Daerah, Desa, atau Kelompok di atas untuk melihat detail tempat, mengatur titik koordinat GPS, serta mengelola rekening shodaqoh resmi.
				</p>
			</div>
		</div>
	{:else}
		<!-- 1. BLOK INFORMASI LOKASI & TEMPAT PENGAJIAN -->
		<div class="bg-card border border-border rounded-2xl p-5 shadow-xs space-y-4">
			<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
				<div class="flex items-center gap-3">
					<div class="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
						<Building2 class="w-5 h-5" />
					</div>
					<div>
						<h2 class="text-base font-bold text-foreground leading-tight">
							{data.profilData.nama}
						</h2>
						<p class="text-xs text-foreground/50">
							{#if data.activeScope === 'Kelompok'}
								Kelompok • Desa {data.profilData.desaNama} • {data.profilData.daerahNama}
							{:else if data.activeScope === 'Desa'}
								Desa • Kecamatan {data.profilData.kecamatan || '-'} • {data.profilData.daerahNama}
							{:else}
								Daerah • {data.profilData.kotaKabupaten}, {data.profilData.provinsi}
							{/if}
						</p>
					</div>
				</div>

				<button
					type="button"
					onclick={openLocationModal}
					class="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors shadow-xs"
				>
					<Pencil class="w-3.5 h-3.5" />
					<span>Ubah Titik Lokasi</span>
				</button>
			</div>

			<!-- Detail Lokasi Geotagging -->
			<div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
				<div class="p-3.5 rounded-xl bg-secondary/40 border border-border/60 space-y-1">
					<span class="text-foreground/50 font-medium">Nama Tempat / Majelis:</span>
					<p class="text-sm font-semibold text-foreground">
						{data.profilData.lokasiNama || 'Belum diisi'}
					</p>
				</div>

				<div class="p-3.5 rounded-xl bg-secondary/40 border border-border/60 space-y-1">
					<span class="text-foreground/50 font-medium">Koordinat GPS & Radius:</span>
					{#if data.profilData.latitude && data.profilData.longitude}
						<div class="flex items-center gap-2">
							<span class="font-mono font-semibold text-foreground">
								{data.profilData.latitude}, {data.profilData.longitude}
							</span>
							<span class="px-1.5 py-0.5 rounded bg-primary/10 text-primary font-bold text-[10px]">
								±{data.profilData.radiusMeter || 100}m
							</span>
						</div>
					{:else}
						<p class="text-foreground/50 italic">Belum disetel pin koordinat</p>
					{/if}
				</div>

				<div class="p-3.5 rounded-xl bg-secondary/40 border border-border/60 space-y-1">
					<span class="text-foreground/50 font-medium">Navigasi Peta Google:</span>
					<div>
						{#if data.profilData.gmapsUrl}
							<a
								href={data.profilData.gmapsUrl}
								target="_blank"
								rel="noopener noreferrer"
								class="inline-flex items-center gap-1 text-primary hover:underline font-semibold"
							>
								<span>Buka di Google Maps</span>
								<ExternalLink class="w-3.5 h-3.5" />
							</a>
						{:else if data.profilData.latitude && data.profilData.longitude}
							<a
								href={`https://www.google.com/maps?q=${data.profilData.latitude},${data.profilData.longitude}`}
								target="_blank"
								rel="noopener noreferrer"
								class="inline-flex items-center gap-1 text-primary hover:underline font-semibold"
							>
								<span>Buka Pin Koordinat</span>
								<ExternalLink class="w-3.5 h-3.5" />
							</a>
						{:else}
							<span class="text-foreground/50 italic">Tautan belum tersedia</span>
						{/if}
					</div>
				</div>
			</div>
		</div>

		<!-- 2. BLOK REKENING & QRIS SHODAQOH / INFAQ -->
		<div class="bg-card border border-border rounded-2xl p-5 shadow-xs space-y-4">
			<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
				<div>
					<div class="flex items-center gap-2">
						<CreditCard class="w-5 h-5 text-primary" />
						<h2 class="text-base font-bold text-foreground">Rekening & QRIS Shodaqoh</h2>
						{#if data.canManageFinance}
							<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
								<ShieldCheck class="w-3.5 h-3.5" />
								KU / Superadmin
							</span>
						{:else}
							<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-secondary text-foreground/60">
								<Lock class="w-3.5 h-3.5" />
								Read-Only
							</span>
						{/if}
					</div>
					<p class="text-xs text-foreground/50 mt-0.5">
						Rekening resmi penerimaan infaq/shodaqoh jamaah untuk {data.activeScope} {data.profilData.nama}.
					</p>
				</div>

				{#if data.canManageFinance}
					<button
						type="button"
						onclick={openAddRekeningModal}
						class="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors shadow-xs"
					>
						<Plus class="w-4 h-4" />
						<span>Tambah Rekening / QRIS</span>
					</button>
				{/if}
			</div>

			<!-- Daftar Kartu Rekening -->
			{#if data.daftarRekening.length === 0}
				<div class="p-8 text-center text-foreground/50 text-xs rounded-xl border border-dashed border-border">
					Belum ada nomor rekening atau QRIS shodaqoh yang ditambahkan untuk wilayah ini.
				</div>
			{:else}
				<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
					{#each data.daftarRekening as rek}
						<div class="bg-card border border-border rounded-xl p-4 shadow-xs space-y-3 relative overflow-hidden flex flex-col justify-between">
							<div class="space-y-2">
								<div class="flex items-start justify-between gap-2">
									<div>
										<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary">
											{rek.tipeTujuan}
										</span>
										<h3 class="text-sm font-bold text-foreground mt-1">{rek.namaBank}</h3>
									</div>

									{#if rek.qrisImageUrl}
										<button
											type="button"
											onclick={() => {
												previewQrisUrl = rek.qrisImageUrl;
												previewQrisTitle = `${rek.namaBank} - ${rek.atasNama}`;
											}}
											class="p-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-primary transition-colors cursor-pointer"
											title="Lihat Kode QRIS"
										>
											<QrCode class="w-5 h-5" />
										</button>
									{/if}
								</div>

								<div class="bg-secondary/40 rounded-lg p-2.5 space-y-1">
									<div class="flex items-center justify-between gap-2">
										<span class="font-mono text-sm font-bold text-foreground tracking-wide select-all">
											{rek.nomorRekening}
										</span>
										<button
											type="button"
											onclick={() => copyToClipboard(rek.nomorRekening, rek.id)}
											class="p-1 text-foreground/50 hover:text-foreground transition-colors cursor-pointer"
											title="Salin Nomor Rekening"
										>
											{#if copiedRekeningId === rek.id}
												<Check class="w-3.5 h-3.5 text-emerald-500" />
											{:else}
												<Copy class="w-3.5 h-3.5" />
											{/if}
										</button>
									</div>
									<p class="text-xs text-foreground/60 truncate font-medium">a.n. {rek.atasNama}</p>
								</div>

								{#if rek.keterangan}
									<p class="text-xs text-foreground/50 italic line-clamp-2">
										"{rek.keterangan}"
									</p>
								{/if}
							</div>

							<!-- Aksi Rekening (Hanya KU / Superadmin) -->
							{#if data.canManageFinance}
								<div class="pt-2 border-t border-border/50 flex items-center justify-end gap-1.5">
									<button
										type="button"
										onclick={() => openEditRekeningModal(rek)}
										class="p-1.5 rounded-lg text-primary hover:bg-primary/10 transition-colors"
										title="Ubah Rekening"
									>
										<Pencil class="w-3.5 h-3.5" />
									</button>

									<form method="POST" action="?/deleteRekening" use:enhance={keepScrollSubmit()}>
										<input type="hidden" name="rekeningId" value={rek.id} />
										<input type="hidden" name="scope" value={data.activeScope} />
										<input type="hidden" name="id" value={data.activeId} />
										<button
											type="submit"
											onclick={async (e) => {
												e.preventDefault();
												const ok = await confirmAction({
													title: 'Hapus Rekening Shodaqoh?',
													message: `Yakin ingin menghapus rekening ${rek.namaBank} (${rek.nomorRekening})?`,
													confirmText: 'Ya, Hapus Rekening',
													variant: 'danger'
												});
												if (ok) e.currentTarget.form?.requestSubmit();
											}}
											class="p-1.5 rounded-lg text-destructive hover:bg-destructive/10 transition-colors"
											title="Hapus Rekening"
										>
											<Trash2 class="w-3.5 h-3.5" />
										</button>
									</form>
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<!-- 3. BLOK HIERARKI SUB-WILAYAH BAWAHAN -->
		<div class="bg-card border border-border rounded-2xl p-5 shadow-xs space-y-4">
			<div class="flex items-center justify-between pb-3 border-b border-border">
				<div>
					<h2 class="text-base font-bold text-foreground">
						{#if data.activeScope === 'Kelompok'}
							Daftar Sub-Kelompok (RT / Blok)
						{:else if data.activeScope === 'Desa'}
							Daftar Kelompok Binaan
						{:else}
							Daftar Desa dalam Daerah
						{/if}
					</h2>
					<p class="text-xs text-foreground/50 mt-0.5">
						Unit struktur bawahan yang berada di bawah wewenang {data.activeScope} {data.profilData.nama}.
					</p>
				</div>
			</div>

			{#if data.subWilayahList.length === 0}
				<div class="p-6 text-center text-foreground/50 text-xs rounded-xl border border-dashed border-border">
					Belum ada data bawahan tercatat.
				</div>
			{:else}
				<!-- Tampilan Desktop Table -->
				<div class="border border-border rounded-xl overflow-hidden shadow-xs">
					<table class="w-full text-left text-sm">
						<thead class="bg-secondary/60 text-foreground/70 uppercase text-xs tracking-wider border-b border-border">
							<tr>
								<th class="py-3 px-4 font-semibold">Nama Unit</th>
								{#if data.activeScope === 'Kelompok'}
									<th class="py-3 px-4 font-semibold">Keterangan</th>
								{:else if data.activeScope === 'Desa'}
									<th class="py-3 px-4 font-semibold">Lokasi Tempat</th>
									<th class="py-3 px-4 font-semibold text-right">Aksi</th>
								{:else}
									<th class="py-3 px-4 font-semibold">Kecamatan</th>
									<th class="py-3 px-4 font-semibold">Jumlah Kelompok</th>
									<th class="py-3 px-4 font-semibold text-right">Aksi</th>
								{/if}
							</tr>
						</thead>
						<tbody class="divide-y divide-border">
							{#each paginatedSubWilayah as item}
								<tr class="hover:bg-secondary/30 transition-colors">
									<td class="py-3 px-4 font-semibold text-foreground">
										{item.nama}
									</td>
									{#if data.activeScope === 'Kelompok'}
										<td class="py-3 px-4 text-foreground/70 text-xs">
											{item.keterangan || '-'}
										</td>
									{:else if data.activeScope === 'Desa'}
										<td class="py-3 px-4 text-foreground/70 text-xs">
											{item.lokasiNama || '-'}
										</td>
										<td class="py-3 px-4 text-right">
											<a
												href={`/admin/profil-wilayah?scope=Kelompok&id=${item.id}`}
												class="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground font-semibold text-xs transition-colors"
											>
												<span>Buka Profil</span>
											</a>
										</td>
									{:else}
										<td class="py-3 px-4 text-foreground/70 text-xs">
											{item.kecamatan || '-'}
										</td>
										<td class="py-3 px-4 text-foreground/70 text-xs font-semibold">
											{item.kelompokCount || 0} Kelompok
										</td>
										<td class="py-3 px-4 text-right">
											<a
												href={`/admin/profil-wilayah?scope=Desa&id=${item.id}`}
												class="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground font-semibold text-xs transition-colors"
											>
												<span>Buka Profil</span>
											</a>
										</td>
									{/if}
								</tr>
							{/each}
						</tbody>
					</table>
					<div class="p-4 border-t border-border">
						<Pagination
							bind:currentPage={subPage}
							bind:pageSize={subPageSize}
							totalItems={data.subWilayahList.length}
							pageSizeOptions={[5, 10, 25]}
						/>
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>

<!-- MODAL FORM UBAH LOKASI GEOTAGGING -->
{#if showLocationModal}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
		role="dialog"
		aria-modal="true"
		onclick={(e) => {
			if (e.target === e.currentTarget) closeLocationModal();
		}}
	>
		<div class="bg-card border border-border rounded-2xl max-w-xl w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
			<div class="flex items-center justify-between pb-3 border-b border-border">
				<div class="flex items-center gap-2">
					<MapPin class="w-5 h-5 text-primary" />
					<h3 class="font-bold text-base text-foreground">
						Atur Titik Lokasi ({data.activeScope} {data.profilData?.nama})
					</h3>
				</div>
				<button
					type="button"
					onclick={closeLocationModal}
					class="p-1 rounded-lg text-foreground/40 hover:text-foreground hover:bg-secondary transition-colors"
				>
					<X class="w-5 h-5" />
				</button>
			</div>

			<form method="POST" action="?/updateLokasi" use:enhance={keepScrollSubmit()} class="space-y-4">
				<input type="hidden" name="scope" value={data.activeScope} />
				<input type="hidden" name="id" value={data.activeId} />

				<div>
					<label for="editLokasiNama" class="block text-xs font-semibold text-foreground mb-1">
						Nama Tempat / Masjid / Majelis
					</label>
					<input
						type="text"
						id="editLokasiNama"
						name="lokasiNama"
						bind:value={editLokasiNama}
						placeholder="Contoh: Masjid Baitul Makmur, Aula Kelompok 1"
						class="w-full bg-secondary/50 border border-border rounded-xl px-3.5 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
					/>
				</div>

				<LocationPicker
					bind:lokasiNama={editLokasiNama}
					bind:latitude={editLatitude}
					bind:longitude={editLongitude}
					bind:radiusMeter={editRadiusMeter}
					bind:gmapsUrl={editGmapsUrl}
				/>

				<div class="flex items-center justify-end gap-2 pt-3 border-t border-border">
					<button
						type="button"
						onclick={closeLocationModal}
						class="px-4 py-2 rounded-xl text-xs font-semibold text-foreground/70 hover:bg-secondary transition-colors"
					>
						Batal
					</button>
					<button
						type="submit"
						class="px-4 py-2 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-xs"
					>
						Simpan Perubahan Lokasi
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- MODAL FORM TAMBAH / UBAH REKENING SHODAQOH -->
{#if showRekeningModal}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
		role="dialog"
		aria-modal="true"
		onclick={(e) => {
			if (e.target === e.currentTarget) closeRekeningModal();
		}}
	>
		<div class="bg-card border border-border rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
			<div class="flex items-center justify-between pb-3 border-b border-border">
				<div class="flex items-center gap-2">
					<CreditCard class="w-5 h-5 text-primary" />
					<h3 class="font-bold text-base text-foreground">
						{isEditingRekening ? 'Ubah Rekening Shodaqoh' : 'Tambah Rekening Shodaqoh'}
					</h3>
				</div>
				<button
					type="button"
					onclick={closeRekeningModal}
					class="p-1 rounded-lg text-foreground/40 hover:text-foreground hover:bg-secondary transition-colors"
				>
					<X class="w-5 h-5" />
				</button>
			</div>

			<form
				method="POST"
				action={isEditingRekening ? '?/updateRekening' : '?/addRekening'}
				use:enhance={keepScrollSubmit()}
				class="space-y-3.5"
			>
				<input type="hidden" name="scope" value={data.activeScope} />
				<input type="hidden" name="id" value={data.activeId} />
				{#if isEditingRekening}
					<input type="hidden" name="rekeningId" value={editRekeningId} />
				{/if}

				<div>
					<label for="inputNamaBank" class="block text-xs font-semibold text-foreground mb-1">
						Nama Bank / E-Wallet / Provider *
					</label>
					<input
						type="text"
						id="inputNamaBank"
						name="namaBank"
						bind:value={inputNamaBank}
						placeholder="Misal: Bank Syariah Indonesia (BSI), BCA, QRIS Mandiri"
						required
						class="w-full bg-secondary/50 border border-border rounded-xl px-3.5 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
					/>
				</div>

				<div>
					<label for="inputNomorRekening" class="block text-xs font-semibold text-foreground mb-1">
						Nomor Rekening / No. VA *
					</label>
					<input
						type="text"
						id="inputNomorRekening"
						name="nomorRekening"
						bind:value={inputNomorRekening}
						placeholder="Misal: 7123456789 atau 081234567890"
						required
						class="w-full font-mono bg-secondary/50 border border-border rounded-xl px-3.5 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
					/>
				</div>

				<div>
					<label for="inputAtasNama" class="block text-xs font-semibold text-foreground mb-1">
						Atas Nama Rekening *
					</label>
					<input
						type="text"
						id="inputAtasNama"
						name="atasNama"
						bind:value={inputAtasNama}
						placeholder="Misal: Kas Infaq Majelis Kebayoran"
						required
						class="w-full bg-secondary/50 border border-border rounded-xl px-3.5 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
					/>
				</div>

				<div>
					<label for="inputTipeTujuan" class="block text-xs font-semibold text-foreground mb-1">
						Tipe Alokasi / Tujuan
					</label>
					<select
						id="inputTipeTujuan"
						name="tipeTujuan"
						bind:value={inputTipeTujuan}
						class="w-full bg-secondary/50 border border-border rounded-xl px-3.5 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
					>
						<option value="Infaq & Shodaqoh">Infaq & Shodaqoh</option>
						<option value="Infaq Operasional">Infaq Operasional</option>
						<option value="Pembangunan Tempat">Pembangunan Tempat</option>
						<option value="Kas Sosial Jamaah">Kas Sosial Jamaah</option>
						<option value="Kegiatan Remaja & Generus">Kegiatan Remaja & Generus</option>
					</select>
				</div>

				<div>
					<label for="inputQrisImageUrl" class="block text-xs font-semibold text-foreground mb-1">
						Tautan Gambar QRIS (Opsional)
					</label>
					<input
						type="text"
						id="inputQrisImageUrl"
						name="qrisImageUrl"
						bind:value={inputQrisImageUrl}
						placeholder="URL gambar QRIS atau path gambar"
						class="w-full bg-secondary/50 border border-border rounded-xl px-3.5 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
					/>
				</div>

				<div>
					<label for="inputKeterangan" class="block text-xs font-semibold text-foreground mb-1">
						Catatan / Pesan Shodaqoh
					</label>
					<textarea
						id="inputKeterangan"
						name="keterangan"
						bind:value={inputKeterangan}
						rows="2"
						placeholder="Misal: Mohon tambahkan kode unik 01 di akhir nominal transfer."
						class="w-full bg-secondary/50 border border-border rounded-xl px-3.5 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
					></textarea>
				</div>

				{#if isEditingRekening}
					<div class="flex items-center gap-2 pt-1">
						<input
							type="checkbox"
							id="inputIsActive"
							name="isActive"
							value="1"
							bind:checked={inputIsActive}
							class="rounded border-border text-primary focus:ring-primary"
						/>
						<label for="inputIsActive" class="text-xs font-medium text-foreground">
							Rekening aktif (Dapat dilihat jamaah)
						</label>
					</div>
				{/if}

				<div class="flex items-center justify-end gap-2 pt-3 border-t border-border">
					<button
						type="button"
						onclick={closeRekeningModal}
						class="px-4 py-2 rounded-xl text-xs font-semibold text-foreground/70 hover:bg-secondary transition-colors"
					>
						Batal
					</button>
					<button
						type="submit"
						class="px-4 py-2 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-xs"
					>
						{isEditingRekening ? 'Simpan Rekening' : 'Tambah Rekening'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- MODAL PREVIEW QRIS -->
{#if previewQrisUrl}
	<div
		class="fixed inset-0 z-60 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
		role="dialog"
		aria-modal="true"
		onclick={(e) => {
			if (e.target === e.currentTarget) previewQrisUrl = null;
		}}
	>
		<div class="bg-card border border-border rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4 text-center">
			<div class="flex items-center justify-between pb-2 border-b border-border">
				<h3 class="font-bold text-sm text-foreground">{previewQrisTitle || 'Kode QRIS Shodaqoh'}</h3>
				<button
					type="button"
					onclick={() => (previewQrisUrl = null)}
					class="p-1 rounded-lg text-foreground/40 hover:text-foreground transition-colors"
				>
					<X class="w-4 h-4" />
				</button>
			</div>

			<div class="p-3 bg-white rounded-xl shadow-inner flex items-center justify-center">
				<img
					src={previewQrisUrl}
					alt="QRIS Shodaqoh"
					class="max-w-full max-h-72 object-contain rounded"
					onerror={(e) => {
						(e.currentTarget as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>';
					}}
				/>
			</div>

			<p class="text-xs text-foreground/60">
				Pindai QRIS ini melalui aplikasi M-Banking atau Dompet Digital untuk menyalurkan shodaqoh.
			</p>
		</div>
	</div>
{/if}
