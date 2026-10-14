<!--
  @file src/routes/(admin)/admin/profil-wilayah/+page.svelte
  @purpose Halaman dedicated profil wilayah (Kelompok/Desa/Daerah) untuk seluruh 4S & Superadmin: manajemen titik lokasi pengajian, rekening Bank & QRIS shodaqoh berotoritas khusus KU & Superadmin, filter wilayah fleksibel adaptif bergaya shodaqoh (scope switcher & searchable select), pelestarian state wilayah saat mutasi, hierarki sub-wilayah, dan navigasi wilayah
  @usedBy Route admin '/admin/profil-wilayah'
  @dependencies @lucide/svelte, $app/navigation, $app/state, Svelte 5 Runes, $lib/components/SearchableSelect.svelte, $lib/components/LocationPicker.svelte, $lib/components/Pagination.svelte, $app/forms (enhance), $lib/keepScroll.ts (keepScrollSubmit), $lib/confirm.svelte (confirmAction)
  @publicFunctions changeWilayah, openLocationModal, closeLocationModal, openAddRekeningModal, closeAddRekeningModal, openEditRekeningModal, closeEditRekeningModal, copyToClipboard, handleQrisFileChange
  @sideEffects Mengirim form updateLokasi, addRekening, updateRekening, deleteRekening via enhance dengan pelestarian query param scope & id wilayah aktif dan menjaga scroll
-->
<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { keepScrollSubmit } from '$lib/keepScroll';
	import { confirmAction } from '$lib/confirm.svelte';
	import SearchableSelect from '$lib/components/SearchableSelect.svelte';
	import LocationPicker from '$lib/components/LocationPicker.svelte';
	import Pagination from '$lib/components/Pagination.svelte';
	import {
		ArrowLeft,
		Building2,
		Check,
		ChevronRight,
		Copy,
		CreditCard,
		ExternalLink,
		Eye,
		Filter,
		Globe,
		Image as ImageIcon,
		Landmark,
		Layers,
		Lock,
		MapPin,
		Pencil,
		Plus,
		QrCode,
		ShieldCheck,
		Trash2,
		Upload,
		Users,
		X
	} from '@lucide/svelte';
	import type { PageData, ActionData } from './$types';

	let { data, form } = $props<{ data: PageData; form: ActionData }>();

	function changeWilayah(scope: string, id: number | null | undefined) {
		const url = new URL(page.url.href);
		url.searchParams.set('scope', scope);
		if (id && Number(id) > 0) {
			url.searchParams.set('id', String(id));
		} else {
			url.searchParams.delete('id');
		}
		goto(url.toString());
	}


	// State Modal Edit Lokasi
	let showLocationModal = $state(false);
	let editLokasiNama = $state('');
	let editLatitude = $state('');
	let editLongitude = $state('');
	let editRadiusMeter = $state(100);
	let editGmapsUrl = $state('');

	// State Modal Rekening / QRIS
	let showRekeningModal = $state(false);
	let isEditingRekening = $state(false);
	let editRekeningId = $state('');
	let inputMetode = $state<'bank' | 'qris'>('bank');
	let inputNamaBank = $state('');
	let inputNomorRekening = $state('');
	let inputAtasNama = $state('');
	let inputTipeTujuan = $state('Infaq/Shodaqoh');
	let inputQrisImageUrl = $state('');
	let inputKeterangan = $state('');
	let inputIsActive = $state(true);
	let inputQrisMode = $state<'upload' | 'url'>('upload');
	let qrisFilePreview = $state<string | null>(null);

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
		inputMetode = 'bank';
		inputNamaBank = '';
		inputNomorRekening = '';
		inputAtasNama = '';
		inputTipeTujuan = 'Infaq/Shodaqoh';
		inputQrisImageUrl = '';
		qrisFilePreview = null;
		inputQrisMode = 'upload';
		inputKeterangan = '';
		inputIsActive = true;
		showRekeningModal = true;
	}

	function openEditRekeningModal(rek: (typeof data.daftarRekening)[number]) {
		isEditingRekening = true;
		editRekeningId = rek.id;
		if (rek.qrisImageUrl || rek.namaBank?.toUpperCase() === 'QRIS') {
			inputMetode = 'qris';
			inputNamaBank = rek.namaBank || 'QRIS';
			inputNomorRekening = rek.nomorRekening === '-' ? '' : rek.nomorRekening;
			inputQrisImageUrl = rek.qrisImageUrl || '';
			qrisFilePreview = rek.qrisImageUrl || null;
			inputQrisMode = rek.qrisImageUrl ? 'url' : 'upload';
		} else {
			inputMetode = 'bank';
			inputNamaBank = rek.namaBank;
			inputNomorRekening = rek.nomorRekening;
			inputQrisImageUrl = '';
			qrisFilePreview = null;
			inputQrisMode = 'upload';
		}
		inputAtasNama = rek.atasNama;
		inputTipeTujuan = rek.tipeTujuan || 'Infaq/Shodaqoh';
		inputKeterangan = rek.keterangan || '';
		inputIsActive = rek.isActive ?? true;
		showRekeningModal = true;
	}

	function closeRekeningModal() {
		showRekeningModal = false;
	}

	function handleQrisFileChange(event: Event) {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];
		if (file) {
			const reader = new FileReader();
			reader.onload = (e) => {
				qrisFilePreview = (e.target?.result as string) || null;
			};
			reader.readAsDataURL(file);
		} else {
			qrisFilePreview = null;
		}
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
			if (form?.scope && form?.id && typeof window !== 'undefined') {
				const currentUrl = new URL(window.location.href);
				if (
					currentUrl.searchParams.get('scope') !== String(form.scope) ||
					currentUrl.searchParams.get('id') !== String(form.id)
				) {
					currentUrl.searchParams.set('scope', String(form.scope));
					currentUrl.searchParams.set('id', String(form.id));
					window.history.replaceState({}, '', currentUrl.toString());
				}
			}
		}
	});

	const kelompokOptions = $derived(
		(data.accessibleWilayah?.kelompokList || []).map((k: any) => ({
			value: k.id,
			label: `${k.nama}${k.desaNama ? ` (${k.desaNama})` : ''}`
		}))
	);

	const desaOptions = $derived(
		(data.accessibleWilayah?.desaList || []).map((d: any) => ({
			value: d.id,
			label: `${d.nama}${d.daerahNama ? ` (${d.daerahNama})` : ''}`
		}))
	);

	const daerahOptions = $derived(
		(data.accessibleWilayah?.daerahList || []).map((dr: any) => ({
			value: dr.id,
			label: dr.nama
		}))
	);

	const standardAlokasi = ['Infaq/Shodaqoh', 'Pembangunan', 'Lainnya'];
	const alokasiOptions = $derived([
		...standardAlokasi.map((a) => ({ value: a, label: a })),
		...(data.customAlokasiList || [])
			.filter((a: string) => !standardAlokasi.includes(a))
			.map((a: string) => ({ value: a, label: a, sublabel: 'Kustom Wilayah Ini' }))
	]);
</script>

<svelte:head>
	<title>Profil Wilayah & Rekening - Admin Satu Generus</title>
</svelte:head>

<div class="space-y-6">

	<!-- Top Header & Scope Selector -->
	<div class="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card border border-border p-4 md:p-6 rounded-2xl shadow-xs">
		<div class="space-y-1">
			<div class="flex items-center gap-2">
				<div class="w-9 h-9 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center border border-teal-500/20">
					<Landmark class="w-5 h-5" />
				</div>
				<div>
					<h1 class="text-lg md:text-xl font-bold text-foreground tracking-tight flex items-center gap-2">
						<span>Profil & Pengaturan Wilayah</span>
						{#if data.activeScope}
							<span class="text-xs px-2 py-0.5 rounded-full font-semibold bg-primary/10 text-primary border border-primary/20">
								{data.activeScope}
							</span>
						{/if}
					</h1>
					<p class="text-xs text-foreground/60">
						{#if data.profilData}
							{data.profilData.nama}
							{#if data.activeScope === 'Kelompok' && data.profilData.desaNama}
								• Desa {data.profilData.desaNama}
							{:else if data.activeScope === 'Desa' && data.profilData.daerahNama}
								• Daerah {data.profilData.daerahNama}
							{/if}
						{:else}
							Belum ada {data.activeScope ? data.activeScope.toLowerCase() : 'wilayah'} yang dipilih
						{/if}
					</p>
				</div>
			</div>
		</div>

		<!-- Switcher Scope Wilayah Sesuai Wewenang -->
		<div class="flex flex-wrap items-center gap-2">
			<!-- Pilih Tingkat Scope -->
			<div class="flex items-center bg-secondary/80 p-1 rounded-xl border border-border text-xs">
				{#if data.accessibleWilayah.kelompokList.length > 0}
					<button
						type="button"
						onclick={() => {
							const defaultId = data.accessibleWilayah.kelompokList.length === 1 ? data.accessibleWilayah.kelompokList[0].id : null;
							changeWilayah('Kelompok', defaultId);
						}}
						class="px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer {data.activeScope === 'Kelompok'
							? 'bg-card text-foreground font-bold shadow-xs'
							: 'text-foreground/60 hover:text-foreground'}"
					>
						Kelompok
					</button>
				{/if}
				{#if data.accessibleWilayah.desaList.length > 0}
					<button
						type="button"
						onclick={() => {
							const defaultId = data.accessibleWilayah.desaList.length === 1 ? data.accessibleWilayah.desaList[0].id : null;
							changeWilayah('Desa', defaultId);
						}}
						class="px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer {data.activeScope === 'Desa'
							? 'bg-card text-foreground font-bold shadow-xs'
							: 'text-foreground/60 hover:text-foreground'}"
					>
						Desa
					</button>
				{/if}
				{#if data.accessibleWilayah.daerahList.length > 0}
					<button
						type="button"
						onclick={() => {
							const defaultId = data.accessibleWilayah.daerahList.length === 1 ? data.accessibleWilayah.daerahList[0].id : null;
							changeWilayah('Daerah', defaultId);
						}}
						class="px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer {data.activeScope === 'Daerah'
							? 'bg-card text-foreground font-bold shadow-xs'
							: 'text-foreground/60 hover:text-foreground'}"
					>
						Daerah
					</button>
				{/if}
			</div>

			<!-- Dropdown Wilayah Spesifik dengan Fitur Pencarian Real-Time -->
			<div class="w-60 sm:w-72">
				{#if data.activeScope === 'Kelompok'}
					<SearchableSelect
						name="selectKelompok"
						options={kelompokOptions}
						value={data.activeId || ''}
						onchange={(val: string | number) => changeWilayah('Kelompok', val ? Number(val) : null)}
						placeholder="-- Cari Kelompok --"
						searchPlaceholder="Ketik nama kelompok..."
					/>
				{:else if data.activeScope === 'Desa'}
					<SearchableSelect
						name="selectDesa"
						options={desaOptions}
						value={data.activeId || ''}
						onchange={(val: string | number) => changeWilayah('Desa', val ? Number(val) : null)}
						placeholder="-- Cari Desa --"
						searchPlaceholder="Ketik nama desa..."
					/>
				{:else if data.activeScope === 'Daerah'}
					<SearchableSelect
						name="selectDaerah"
						options={daerahOptions}
						value={data.activeId || ''}
						onchange={(val: string | number) => changeWilayah('Daerah', val ? Number(val) : null)}
						placeholder="-- Cari Daerah --"
						searchPlaceholder="Ketik nama daerah..."
					/>
				{/if}
			</div>

			<!-- Badge Otoritas Keuangan (KU / Superadmin) -->
			{#if data.canManageFinance}
				<span class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[11px] font-bold">
					<ShieldCheck class="w-3.5 h-3.5" />
					KU / Superadmin
				</span>
			{/if}
		</div>
	</div>

	<!-- Bar Navigasi Kembali & Breadcrumbs Hierarki -->
	{#if data.profilData}
		<div class="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-card border border-border shadow-xs">
			<div class="flex items-center gap-2 text-xs">
				{#if data.activeScope === 'Kelompok'}
					<a
						href={`/admin/profil-wilayah?scope=Desa&id=${data.profilData.desaId}`}
						class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary font-bold transition-colors cursor-pointer"
					>
						<ArrowLeft class="w-3.5 h-3.5" />
						<span>Kembali ke Desa {data.profilData.desaNama}</span>
					</a>
				{:else if data.activeScope === 'Desa'}
					<a
						href={`/admin/profil-wilayah?scope=Daerah&id=${data.profilData.daerahId}`}
						class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary font-bold transition-colors cursor-pointer"
					>
						<ArrowLeft class="w-3.5 h-3.5" />
						<span>Kembali ke Daerah {data.profilData.daerahNama}</span>
					</a>
				{/if}

				<a
					href="/admin/wilayah"
					class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-foreground/60 hover:text-foreground hover:bg-secondary/60 transition-colors text-xs font-medium"
				>
					<span>Semua Data Wilayah</span>
				</a>
			</div>

			<!-- Breadcrumbs Hierarki Aktif -->
			<nav class="flex items-center gap-1.5 text-xs text-foreground/60 flex-wrap" aria-label="Hierarki Wilayah">
				{#if data.activeScope === 'Kelompok'}
					<a href={`/admin/profil-wilayah?scope=Daerah&id=${data.profilData.daerahId}`} class="hover:text-primary transition-colors">
						{data.profilData.daerahNama}
					</a>
					<ChevronRight class="w-3.5 h-3.5 text-foreground/40 shrink-0" />
					<a href={`/admin/profil-wilayah?scope=Desa&id=${data.profilData.desaId}`} class="hover:text-primary transition-colors">
						Desa {data.profilData.desaNama}
					</a>
					<ChevronRight class="w-3.5 h-3.5 text-foreground/40 shrink-0" />
					<span class="font-bold text-primary">Kelompok {data.profilData.nama}</span>
				{:else if data.activeScope === 'Desa'}
					<a href={`/admin/profil-wilayah?scope=Daerah&id=${data.profilData.daerahId}`} class="hover:text-primary transition-colors">
						{data.profilData.daerahNama}
					</a>
					<ChevronRight class="w-3.5 h-3.5 text-foreground/40 shrink-0" />
					<span class="font-bold text-primary">Desa {data.profilData.nama}</span>
				{:else if data.activeScope === 'Daerah'}
					<span class="font-bold text-primary">Daerah {data.profilData.nama}</span>
				{/if}
			</nav>
		</div>
	{/if}

	<!-- Empty State jika belum ada wilayah yang dipilih -->
	{#if !data.profilData}
		<div class="p-12 text-center bg-card border border-border rounded-2xl shadow-xs space-y-3">
			<div class="w-12 h-12 rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center mx-auto shadow-2xs">
				<Filter class="w-6 h-6" />
			</div>
			<div>
				<h3 class="text-sm sm:text-base font-bold text-foreground">Pilih Wilayah Terlebih Dahulu</h3>
				<p class="text-xs text-foreground/60 max-w-md mx-auto mt-1 leading-relaxed">
					Silakan tentukan tingkat wilayah dan pilih {data.activeScope ? data.activeScope.toLowerCase() : 'wilayah'} pada menu di atas untuk membuka profil lokasi, rekening shodaqoh resmi, dan hierarki wilayah.
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
											{#if rek.qrisImageUrl && (!rek.nomorRekening || rek.nomorRekening === '-')}
												QRIS Shodaqoh Digital
											{:else}
												{rek.nomorRekening}
											{/if}
										</span>
										{#if rek.nomorRekening && rek.nomorRekening !== '-'}
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
										{/if}
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

									<form method="POST" action={`?/deleteRekening&scope=${data.activeScope}&id=${data.activeId}`} use:enhance={keepScrollSubmit()}>
										<input type="hidden" name="rekeningId" value={rek.id} />
										<input type="hidden" name="scope" value={data.activeScope} />
										<input type="hidden" name="id" value={data.activeId} />
										<button
											type="button"
											onclick={async (e) => {
												const formEl = (e.currentTarget as HTMLButtonElement).closest('form');
												const ok = await confirmAction({
													title: 'Hapus Rekening Shodaqoh?',
													message: `Yakin ingin menghapus rekening ${rek.namaBank} (${rek.nomorRekening})?`,
													confirmText: 'Ya, Hapus Rekening',
													variant: 'danger'
												});
												if (ok && formEl) {
													formEl.requestSubmit();
												}
											}}
											class="p-1.5 rounded-lg text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
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

			<form method="POST" action={`?/updateLokasi&scope=${data.activeScope}&id=${data.activeId}`} use:enhance={keepScrollSubmit()} class="space-y-4">
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
					{#if inputMetode === 'qris'}
						<QrCode class="w-5 h-5 text-primary" />
					{:else}
						<CreditCard class="w-5 h-5 text-primary" />
					{/if}
					<h3 class="font-bold text-base text-foreground">
						{isEditingRekening
							? inputMetode === 'qris'
								? 'Ubah QRIS Shodaqoh'
								: 'Ubah Rekening Bank'
							: inputMetode === 'qris'
								? 'Tambah QRIS Shodaqoh'
								: 'Tambah Rekening Bank'}
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
				action={`${isEditingRekening ? '?/updateRekening' : '?/addRekening'}&scope=${data.activeScope}&id=${data.activeId}`}
				enctype="multipart/form-data"
				use:enhance={keepScrollSubmit()}
				class="space-y-3.5"
			>
				<input type="hidden" name="scope" value={data.activeScope} />
				<input type="hidden" name="id" value={data.activeId} />
				<input type="hidden" name="metode" value={inputMetode} />
				{#if isEditingRekening}
					<input type="hidden" name="rekeningId" value={editRekeningId} />
				{/if}

				<!-- 1. PILIHAN METODE (BANK VS QRIS) DI PALING ATAS -->
				<div>
					<span class="block text-xs font-semibold text-foreground mb-1.5">
						Metode Transaksi Shodaqoh *
					</span>
					<div class="grid grid-cols-2 gap-2 p-1 bg-secondary/50 rounded-xl border border-border">
						<button
							type="button"
							onclick={() => (inputMetode = 'bank')}
							class="flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all {inputMetode === 'bank' ? 'bg-card text-foreground shadow-xs border border-border' : 'text-foreground/60 hover:text-foreground'}"
						>
							<CreditCard class="w-4 h-4 {inputMetode === 'bank' ? 'text-primary' : ''}" />
							<span>Transfer Bank</span>
						</button>
						<button
							type="button"
							onclick={() => (inputMetode = 'qris')}
							class="flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all {inputMetode === 'qris' ? 'bg-card text-foreground shadow-xs border border-border' : 'text-foreground/60 hover:text-foreground'}"
						>
							<QrCode class="w-4 h-4 {inputMetode === 'qris' ? 'text-primary' : ''}" />
							<span>QRIS Shodaqoh</span>
						</button>
					</div>
				</div>

				<!-- 2. FORM KHUSUS TRANSFER BANK -->
				{#if inputMetode === 'bank'}
					<div>
						<label for="inputNamaBank" class="block text-xs font-semibold text-foreground mb-1">
							Nama Bank / E-Wallet *
						</label>
						<input
							type="text"
							id="inputNamaBank"
							name="namaBank"
							bind:value={inputNamaBank}
							placeholder="Misal: Bank Syariah Indonesia (BSI), BCA, Bank Mandiri"
							required
							class="w-full bg-secondary/50 border border-border rounded-xl px-3.5 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
						/>
					</div>

					<div>
						<label for="inputNomorRekening" class="block text-xs font-semibold text-foreground mb-1">
							Nomor Rekening *
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
				{:else}
					<!-- 3. FORM KHUSUS QRIS -->
					<div>
						<label for="inputAtasNamaQris" class="block text-xs font-semibold text-foreground mb-1">
							Atas Nama QRIS / Merchant *
						</label>
						<input
							type="text"
							id="inputAtasNamaQris"
							name="atasNama"
							bind:value={inputAtasNama}
							placeholder="Misal: QRIS Kas Pembangunan Majelis Kebayoran"
							required
							class="w-full bg-secondary/50 border border-border rounded-xl px-3.5 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
						/>
					</div>

					<div>
						<label for="inputNamaProviderQris" class="block text-xs font-semibold text-foreground mb-1">
							Label / Provider QRIS (Opsional)
						</label>
						<input
							type="text"
							id="inputNamaProviderQris"
							name="namaBank"
							bind:value={inputNamaBank}
							placeholder="Default: QRIS (atau QRIS Mandiri, QRIS BCA, dll)"
							class="w-full bg-secondary/50 border border-border rounded-xl px-3.5 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
						/>
					</div>

					<!-- UPLOAD BERKAS / URL GAMBAR QRIS -->
					<div class="space-y-2 p-3 bg-secondary/30 border border-border rounded-xl">
						<div class="flex items-center justify-between">
							<span class="block text-xs font-semibold text-foreground">
								Gambar QRIS Shodaqoh *
							</span>
							<div class="flex items-center gap-1 text-[11px]">
								<button
									type="button"
									onclick={() => (inputQrisMode = 'upload')}
									class="px-2 py-0.5 rounded font-medium transition-colors {inputQrisMode === 'upload' ? 'bg-primary text-primary-foreground' : 'text-foreground/60 hover:text-foreground'}"
								>
									Unggah Berkas
								</button>
								<button
									type="button"
									onclick={() => (inputQrisMode = 'url')}
									class="px-2 py-0.5 rounded font-medium transition-colors {inputQrisMode === 'url' ? 'bg-primary text-primary-foreground' : 'text-foreground/60 hover:text-foreground'}"
								>
									Tautan URL
								</button>
							</div>
						</div>

						{#if inputQrisMode === 'upload'}
							<input
								type="file"
								id="qrisFile"
								name="qrisFile"
								accept="image/*"
								onchange={handleQrisFileChange}
								class="w-full text-xs text-foreground/80 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
							/>
							<p class="text-[11px] text-foreground/50">
								Format: PNG, JPG, JPEG, WEBP.
							</p>
						{:else}
							<input
								type="text"
								id="inputQrisImageUrl"
								name="qrisImageUrl"
								bind:value={inputQrisImageUrl}
								oninput={() => (qrisFilePreview = inputQrisImageUrl)}
								placeholder="https://... atau /uploads/qris/..."
								class="w-full bg-secondary/50 border border-border rounded-xl px-3.5 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
							/>
						{/if}

						{#if qrisFilePreview || inputQrisImageUrl}
							<div class="pt-2 flex items-center gap-3">
								<div class="w-16 h-16 bg-white rounded-lg p-1 border border-border shrink-0 flex items-center justify-center overflow-hidden">
									<img
										src={qrisFilePreview || inputQrisImageUrl}
										alt="Preview QRIS"
										class="max-w-full max-h-full object-contain"
									/>
								</div>
								<span class="text-xs text-foreground/60">
									Pratinjau gambar QRIS yang akan ditampilkan kepada jamaah.
								</span>
							</div>
						{/if}
					</div>
				{/if}

				<!-- 4. TIPE ALOKASI / TUJUAN (SEARCHABLE SELECT DENGAN OPSI CUSTOM TERISOLASI) -->
				<div>
					<label for="inputTipeTujuan" class="block text-xs font-semibold text-foreground mb-1">
						Tipe Alokasi / Tujuan Shodaqoh *
					</label>
					<SearchableSelect
						id="inputTipeTujuan"
						name="tipeTujuan"
						options={alokasiOptions}
						bind:value={inputTipeTujuan}
						allowCustom={true}
						customLabel="Gunakan alokasi baru"
						searchPlaceholder="Cari alokasi atau ketik nama alokasi baru..."
						placeholder="-- Pilih Alokasi Shodaqoh --"
						required={true}
					/>
					<p class="text-[11px] text-foreground/50 mt-1">
						Pilih alokasi standar, alokasi wilayah ini, atau ketik langsung nama alokasi baru.
					</p>
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
						placeholder="Misal: Mohon sertakan berita transfer atau konfirmasi ke bendahara."
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
						{isEditingRekening
							? inputMetode === 'qris'
								? 'Simpan QRIS'
								: 'Simpan Rekening'
							: inputMetode === 'qris'
								? 'Tambah QRIS'
								: 'Tambah Rekening'}
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
