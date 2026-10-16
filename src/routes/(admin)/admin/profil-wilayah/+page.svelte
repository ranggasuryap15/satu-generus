<!--
  @file src/routes/(admin)/admin/profil-wilayah/+page.svelte
  @purpose Halaman dedicated profil wilayah (Kelompok/Desa/Daerah) untuk seluruh 4S & Superadmin: dashboard metrik jamaah & persentase isrun bulan ini, manajemen titik lokasi pengajian (termasuk 2 opsi pemilihan lokasi desa dari kelompok atau kustom tanpa duplikasi field nama lokasi), daftar jadwal pengajian dengan shortcut tambah jadwal, rekening Bank & QRIS shodaqoh, dan filter wilayah adaptif
  @usedBy Route admin '/admin/profil-wilayah'
  @dependencies @lucide/svelte, $app/navigation, $app/state, Svelte 5 Runes, #lib/components/SearchableSelect.svelte, #lib/components/LocationPicker.svelte, $app/forms (enhance), #lib/keepScroll.ts (keepScrollSubmit), #lib/confirm.svelte (confirmAction), #lib/jadwal (formatDateIndoFull)
  @publicFunctions changeWilayah, openLocationModal, closeLocationModal, openAddRekeningModal, closeAddRekeningModal, openEditRekeningModal, closeEditRekeningModal, copyToClipboard, handleQrisFileChange, handlePilihKelompokDesa
  @sideEffects Mengirim form updateLokasi, addRekening, updateRekening, deleteRekening via enhance dengan pelestarian query param scope & id wilayah aktif, menutup modal otomatis saat berhasil disimpan, dan menjaga scroll
-->
<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { keepScrollSubmit } from '#lib/keepScroll.js';
	import { confirmSubmit } from '#lib/confirmSubmit.ts';
	import { confirmAction } from '#lib/confirm.svelte.ts';
	import SearchableSelect from '#lib/components/SearchableSelect.svelte';
	import LocationPicker from '#lib/components/LocationPicker.svelte';
	import { formatDateIndoFull } from '#lib/jadwal.js';
	import {
		ArrowLeft,
		Building2,
		Calendar,
		CalendarClock,
		Check,
		ChevronRight,
		Clock,
		Coins,
		Copy,
		CreditCard,
		ExternalLink,
		Eye,
		Filter,
		Globe,
		HandCoins,
		Image as ImageIcon,
		Landmark,
		Layers,
		Lock,
		MapPin,
		Pencil,
		Percent,
		Plus,
		QrCode,
		ShieldCheck,
		Trash2,
		TrendingUp,
		Upload,
		UserCheck,
		Users,
		Wallet,
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
	let desaLokasiMode = $state<'kelompok' | 'manual'>('kelompok');
	let selectedLokasiKelompokId = $state<string | number>('');

	// State Modal Rekening / QRIS
	let showRekeningModal = $state(false);
	let isEditingRekening = $state(false);
	let editRekeningId = $state('');
	let inputMetode = $state<'bank' | 'qris'>('bank');
	let inputNamaBank = $state('');
	let inputNomorRekening = $state('');
	let inputAtasNama = $state('');
	let inputTipeTujuan = $state('Infaq & Shodaqoh');
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

	function openLocationModal() {
		if (!data.profilData) return;
		editLokasiNama = data.profilData.lokasiNama || '';
		editLatitude = data.profilData.latitude || '';
		editLongitude = data.profilData.longitude || '';
		editRadiusMeter = data.profilData.radiusMeter || 100;
		editGmapsUrl = data.profilData.gmapsUrl || '';

		if (data.activeScope === 'Desa') {
			selectedLokasiKelompokId = data.profilData.lokasiKelompokId || '';
			desaLokasiMode = data.profilData.lokasiKelompokId ? 'kelompok' : 'manual';
		}

		showLocationModal = true;
	}

	function closeLocationModal() {
		showLocationModal = false;
	}

	function handlePilihKelompokDesa() {
		if (!selectedLokasiKelompokId) return;
		const target = (data.kelompokInDesa || []).find(
			(k: any) => String(k.id) === String(selectedLokasiKelompokId)
		);
		if (target) {
			editLokasiNama = target.lokasiNama || `Masjid Kelompok ${target.nama}`;
			editLatitude = target.latitude || '';
			editLongitude = target.longitude || '';
			editRadiusMeter = target.radiusMeter || 100;
			editGmapsUrl = target.gmapsUrl || '';
		}
	}

	function openAddRekeningModal() {
		isEditingRekening = false;
		editRekeningId = '';
		inputMetode = 'bank';
		inputNamaBank = '';
		inputNomorRekening = '';
		inputAtasNama = '';
		inputTipeTujuan = 'Infaq & Shodaqoh';
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
		inputTipeTujuan = rek.tipeTujuan || 'Infaq & Shodaqoh';
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
				qrisFilePreview = e.target?.result as string;
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
				copiedRekeningId = null;
			}, 2000);
		} catch (err) {
			console.error('Gagal menyalin:', err);
		}
	}

	// Opsi filter wilayah untuk SearchableSelect
	const kelompokOptions = $derived(
		(data.accessibleWilayah.kelompokList || []).map((k: any) => ({
			value: k.id,
			label: `${k.nama} (Desa ${k.desaNama})`
		}))
	);

	const desaOptions = $derived(
		(data.accessibleWilayah.desaList || []).map((d: any) => ({
			value: d.id,
			label: `${d.nama} (${d.daerahNama})`
		}))
	);

	const daerahOptions = $derived(
		(data.accessibleWilayah.daerahList || []).map((dr: any) => ({
			value: dr.id,
			label: dr.nama
		}))
	);

	// URL shortcut tambah jadwal pengajian
	const urlTambahJadwal = $derived.by(() => {
		if (!data.activeId) return '/admin/jadwal';
		if (data.activeScope === 'Kelompok') {
			return `/admin/jadwal?tab=kelompok&kelompokId=${data.activeId}&tambah=1`;
		}
		if (data.activeScope === 'Desa') {
			return `/admin/jadwal?tab=desa&desaId=${data.activeId}&tambah=1`;
		}
		return '/admin/jadwal';
	});

	const urlLihatSemuaJadwal = $derived.by(() => {
		if (!data.activeId) return '/admin/jadwal';
		if (data.activeScope === 'Kelompok') {
			return `/admin/jadwal?tab=kelompok&kelompokId=${data.activeId}`;
		}
		if (data.activeScope === 'Desa') {
			return `/admin/jadwal?tab=desa&desaId=${data.activeId}`;
		}
		return '/admin/jadwal';
	});
</script>

<svelte:head>
	<title>Profil Wilayah - Satu Generus</title>
</svelte:head>

<div class="space-y-5 pb-12">
	<!-- Top Bar Header & Filter Wilayah Adaptif -->
	<div class="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-border">
		<div>
			<div class="flex items-center gap-2.5">
				<div class="w-10 h-10 rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
					<Landmark class="w-5 h-5" />
				</div>
				<div>
					<h1 class="text-xl sm:text-2xl font-black text-foreground tracking-tight">
						Profil Wilayah
					</h1>
					<p class="text-xs text-foreground/60 font-medium">
						{#if data.profilData}
							{data.activeScope} {data.profilData.nama}
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
						class="px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer {data.activeScope === 'Kelompok'
							? 'bg-card text-foreground shadow-xs'
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
						class="px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer {data.activeScope === 'Desa'
							? 'bg-card text-foreground shadow-xs'
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
						class="px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer {data.activeScope === 'Daerah'
							? 'bg-card text-foreground shadow-xs'
							: 'text-foreground/60 hover:text-foreground'}"
					>
						Daerah
					</button>
				{/if}
			</div>

			<!-- Dropdown Wilayah Spesifik -->
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
				<span class="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-bold">
					<ShieldCheck class="w-4 h-4" />
					<span>KU / Superadmin</span>
				</span>
			{/if}
		</div>
	</div>

	<!-- Breadcrumbs Navigasi Hierarki -->
	{#if data.profilData}
		<div class="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-card border border-border shadow-xs">
			<div class="flex items-center gap-2 text-xs">
				{#if data.activeScope === 'Kelompok'}
					<a
						href={`/admin/profil-wilayah?scope=Desa&id=${data.profilData.desaId}`}
						class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary font-bold transition-colors cursor-pointer"
					>
						<ArrowLeft class="w-3.5 h-3.5" />
						<span>Ke Desa {data.profilData.desaNama}</span>
					</a>
				{:else if data.activeScope === 'Desa'}
					<a
						href={`/admin/profil-wilayah?scope=Daerah&id=${data.profilData.daerahId}`}
						class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary font-bold transition-colors cursor-pointer"
					>
						<ArrowLeft class="w-3.5 h-3.5" />
						<span>Ke Daerah {data.profilData.daerahNama}</span>
					</a>
				{/if}

				<a
					href="/admin/wilayah"
					class="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-foreground/70 hover:text-foreground hover:bg-secondary/60 transition-colors text-xs font-semibold"
				>
					<span>Struktur Administratif Wilayah ➔</span>
				</a>
			</div>

			<!-- Breadcrumbs Path -->
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
		<div class="p-12 text-center bg-card border border-border rounded-3xl shadow-xs space-y-3">
			<div class="w-14 h-14 rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center mx-auto shadow-2xs">
				<Filter class="w-7 h-7" />
			</div>
			<div>
				<h3 class="text-base sm:text-lg font-bold text-foreground">Pilih Wilayah Terlebih Dahulu</h3>
				<p class="text-xs sm:text-sm text-foreground/60 max-w-md mx-auto mt-1 leading-relaxed">
					Silakan tentukan tingkat wilayah dan pilih {data.activeScope ? data.activeScope.toLowerCase() : 'wilayah'} pada menu di atas untuk membuka dashboard statistik jamaah, lokasi pengajian, dan rekening resmi.
				</p>
			</div>
		</div>
	{:else}
		<!-- 1. DASHBOARD STATISTIK JAMAAH & CAPAIAN ISRUN -->
		<section class="space-y-3">
			<div class="flex items-center justify-between px-1">
				<div class="flex items-center gap-2">
					<TrendingUp class="w-5 h-5 text-emerald-500" />
					<h2 class="text-base sm:text-lg font-bold text-foreground tracking-tight">
						Dashboard Statistik {data.activeScope}
					</h2>
				</div>
				<span class="text-xs text-foreground/50 font-medium">
					Bulan {data.dashboardStats.bulanIni} / {data.dashboardStats.tahunIni}
				</span>
			</div>

			<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
				<!-- Card 1: Total Jamaah -->
				<div class="bg-card border border-border rounded-2xl p-4 sm:p-4.5 shadow-xs flex items-center gap-3.5">
					<div class="w-12 h-12 rounded-2xl bg-sky-500/10 text-sky-500 flex items-center justify-center shrink-0">
						<Users class="w-6 h-6" />
					</div>
					<div class="min-w-0">
						<span class="text-xs text-foreground/60 font-semibold block">Total Jamaah Aktif</span>
						<h3 class="text-xl sm:text-2xl font-black text-foreground tracking-tight mt-0.5">
							{data.dashboardStats.totalJamaah} <span class="text-xs font-bold text-foreground/60">Jiwa</span>
						</h3>
						<p class="text-[11px] text-foreground/50 truncate mt-0.5">
							{data.dashboardStats.totalKk} KK • {data.dashboardStats.totalLaki} L / {data.dashboardStats.totalPerempuan} P
						</p>
					</div>
				</div>

				<!-- Card 2: Wajib Isrun -->
				<div class="bg-card border border-border rounded-2xl p-4 sm:p-4.5 shadow-xs flex items-center gap-3.5">
					<div class="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
						<HandCoins class="w-6 h-6" />
					</div>
					<div class="min-w-0">
						<span class="text-xs text-foreground/60 font-semibold block">Wajib Isrun (FR)</span>
						<h3 class="text-xl sm:text-2xl font-black text-amber-500 tracking-tight mt-0.5">
							{data.dashboardStats.totalWajibIsrun} <span class="text-xs font-bold text-foreground/60">Jamaah</span>
						</h3>
						<p class="text-[11px] text-foreground/50 truncate mt-0.5">
							Kewajiban setoran bulanan
						</p>
					</div>
				</div>

				<!-- Card 3: Persentase Capaian Isrun Bulan Ini -->
				<div class="bg-card border border-border rounded-2xl p-4 sm:p-4.5 shadow-xs space-y-2">
					<div class="flex items-center justify-between">
						<span class="text-xs text-foreground/60 font-semibold">Capaian Isrun Bulan Ini</span>
						<span class="text-xs font-bold {data.dashboardStats.persenBayarIsrun >= 80 ? 'text-emerald-500' : 'text-amber-500'}">
							{data.dashboardStats.persenBayarIsrun}%
						</span>
					</div>

					<div class="flex items-center gap-2">
						<div class="flex-1 bg-secondary rounded-full h-2.5 overflow-hidden">
							<div
								class="h-full rounded-full transition-all {data.dashboardStats.persenBayarIsrun >= 80 ? 'bg-emerald-500' : 'bg-amber-500'}"
								style={`width: ${Math.min(100, data.dashboardStats.persenBayarIsrun)}%`}
							></div>
						</div>
					</div>

					<div class="flex items-center justify-between text-[11px] text-foreground/50">
						<span>{data.dashboardStats.sudahBayarIsrunCount} dari {data.dashboardStats.totalWajibIsrun} setor</span>
						<span class="font-bold text-foreground">Rp{data.dashboardStats.totalNominalIsrunBulanIni.toLocaleString('id-ID')}</span>
					</div>
				</div>

				<!-- Card 4: Pengajian & Rekening -->
				<div class="bg-card border border-border rounded-2xl p-4 sm:p-4.5 shadow-xs flex items-center gap-3.5">
					<div class="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-500 flex items-center justify-center shrink-0">
						<CalendarClock class="w-6 h-6" />
					</div>
					<div class="min-w-0">
						<span class="text-xs text-foreground/60 font-semibold block">Sesi Pengajian & Rekening</span>
						<h3 class="text-lg sm:text-xl font-black text-foreground tracking-tight mt-0.5">
							{data.daftarJadwal.length} Sesi • {data.daftarRekening.length} Rek/QRIS
						</h3>
						<p class="text-[11px] text-foreground/50 truncate mt-0.5">
							Tersinkronisasi aktif
						</p>
					</div>
				</div>
			</div>
		</section>

		<!-- 2. BLOK INFORMASI LOKASI & TEMPAT PENGAJIAN -->
		<section class="bg-card border border-border rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
			<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
				<div class="flex items-center gap-3">
					<div class="w-11 h-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
						<Building2 class="w-6 h-6" />
					</div>
					<div>
						<div class="flex items-center gap-2 flex-wrap">
							<h2 class="text-base sm:text-lg font-bold text-foreground leading-tight">
								Lokasi Tempat Pengajian
							</h2>
							{#if data.activeScope === 'Desa' && data.profilData.lokasiKelompokId}
								<span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
									Mewarisi Kelompok
								</span>
							{/if}
						</div>
						<p class="text-xs text-foreground/50 mt-0.5">
							Titik pusat verifikasi GPS radius presensi mandiri jamaah {data.activeScope} {data.profilData.nama}.
						</p>
					</div>
				</div>

				<button
					type="button"
					onclick={openLocationModal}
					class="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs sm:text-sm font-bold hover:bg-primary/90 transition-all shadow-xs cursor-pointer active:scale-95"
				>
					<Pencil class="w-4 h-4" />
					<span>Ubah Titik Lokasi</span>
				</button>
			</div>

			<!-- Detail Lokasi Geotagging -->
			<div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
				<div class="p-4 rounded-2xl bg-secondary/40 border border-border/60 space-y-1">
					<span class="text-foreground/50 font-medium block">Nama Tempat / Masjid:</span>
					<p class="text-sm sm:text-base font-bold text-foreground">
						{data.profilData.lokasiNama || 'Belum diisi'}
					</p>
				</div>

				<div class="p-4 rounded-2xl bg-secondary/40 border border-border/60 space-y-1">
					<span class="text-foreground/50 font-medium block">Koordinat GPS & Radius:</span>
					{#if data.profilData.latitude && data.profilData.longitude}
						<div class="flex items-center gap-2 flex-wrap pt-0.5">
							<span class="font-mono font-bold text-foreground text-xs sm:text-sm">
								{data.profilData.latitude}, {data.profilData.longitude}
							</span>
							<span class="px-2 py-0.5 rounded-md bg-primary/10 text-primary font-bold text-xs">
								±{data.profilData.radiusMeter || 100}m
							</span>
						</div>
					{:else}
						<p class="text-foreground/50 italic pt-0.5">Belum disetel pin koordinat</p>
					{/if}
				</div>

				<div class="p-4 rounded-2xl bg-secondary/40 border border-border/60 space-y-1">
					<span class="text-foreground/50 font-medium block">Navigasi Peta Google:</span>
					<div class="pt-0.5">
						{#if data.profilData.gmapsUrl}
							<a
								href={data.profilData.gmapsUrl}
								target="_blank"
								rel="noopener noreferrer"
								class="inline-flex items-center gap-1.5 text-primary hover:underline font-bold text-xs sm:text-sm"
							>
								<span>Buka di Google Maps</span>
								<ExternalLink class="w-4 h-4" />
							</a>
						{:else if data.profilData.latitude && data.profilData.longitude}
							<a
								href={`https://www.google.com/maps?q=${data.profilData.latitude},${data.profilData.longitude}`}
								target="_blank"
								rel="noopener noreferrer"
								class="inline-flex items-center gap-1.5 text-primary hover:underline font-bold text-xs sm:text-sm"
							>
								<span>Buka Pin Koordinat</span>
								<ExternalLink class="w-4 h-4" />
							</a>
						{:else}
							<span class="text-foreground/50 italic">Tautan peta belum disetel</span>
						{/if}
					</div>
				</div>
			</div>
		</section>

		<!-- 3. DAFTAR JADWAL PENGAJIAN WILAYAH & SHORTCUT TAMBAH -->
		<section class="bg-card border border-border rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
			<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
				<div class="flex items-center gap-3">
					<div class="w-11 h-11 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
						<CalendarClock class="w-6 h-6" />
					</div>
					<div>
						<h2 class="text-base sm:text-lg font-bold text-foreground leading-tight">
							Jadwal Pengajian {data.activeScope}
						</h2>
						<p class="text-xs text-foreground/50 mt-0.5">
							Sesi kegiatan pengajian terdekat yang terjadwal untuk wilayah ini.
						</p>
					</div>
				</div>

				<div class="flex items-center gap-2">
					<a
						href={urlLihatSemuaJadwal}
						class="px-3.5 py-2 rounded-xl text-xs font-semibold text-foreground/70 hover:text-foreground hover:bg-secondary transition-colors"
					>
						Lihat Semua
					</a>
					<a
						href={urlTambahJadwal}
						class="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-xs sm:text-sm font-black transition-all shadow-xs cursor-pointer active:scale-95"
					>
						<Plus class="w-4 h-4 stroke-[3]" />
						<span>Tambah Jadwal</span>
					</a>
				</div>
			</div>

			<!-- List Sesi Pengajian -->
			{#if data.daftarJadwal.length === 0}
				<div class="p-8 text-center rounded-2xl border border-dashed border-border space-y-2">
					<p class="text-xs sm:text-sm text-foreground/50">
						Belum ada sesi pengajian terdekat untuk {data.activeScope} ini.
					</p>
					<div>
						<a
							href={urlTambahJadwal}
							class="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold transition-colors"
						>
							<Plus class="w-3.5 h-3.5" />
							<span>Buat Sesi Pengajian Sekarang</span>
						</a>
					</div>
				</div>
			{:else}
				<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
					{#each data.daftarJadwal as jadwal}
						<div class="p-4 rounded-2xl bg-secondary/30 border border-border/80 space-y-2 hover:border-emerald-500/40 transition-colors">
							<div class="flex items-center justify-between gap-2">
								<span class="text-xs font-bold text-foreground">
									{formatDateIndoFull(jadwal.tanggal)}
								</span>
								{#if jadwal.status === 'libur'}
									<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20">
										Libur
									</span>
								{:else if jadwal.templateId}
									<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
										Rutin
									</span>
								{:else}
									<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-secondary text-foreground/70 border border-border">
										Manual
									</span>
								{/if}
							</div>

							<h3 class="text-sm font-bold text-foreground leading-snug line-clamp-1">
								{jadwal.namaKegiatan}
							</h3>

							<div class="flex items-center gap-3 text-xs text-foreground/60 flex-wrap pt-0.5">
								<span class="flex items-center gap-1 font-mono text-[11px]">
									<Clock class="w-3.5 h-3.5" />
									<span>{jadwal.jamMulai}{jadwal.jamSelesai ? ` - ${jadwal.jamSelesai}` : ''} WIB</span>
								</span>
								{#if jadwal.lokasiNama}
									<span class="flex items-center gap-1 text-[11px] truncate">
										<MapPin class="w-3.5 h-3.5 shrink-0" />
										<span class="truncate">{jadwal.lokasiNama}</span>
									</span>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</section>

		<!-- 4. BLOK REKENING & QRIS SHODAQOH / INFAQ -->
		<section class="bg-card border border-border rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
			<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
				<div>
					<div class="flex items-center gap-2">
						<CreditCard class="w-5 h-5 text-primary" />
						<h2 class="text-base sm:text-lg font-bold text-foreground">Rekening & QRIS Shodaqoh</h2>
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
						Rekening resmi penerimaan infaq dan shodaqoh jamaah untuk {data.activeScope} {data.profilData.nama}.
					</p>
				</div>

				{#if data.canManageFinance}
					<button
						type="button"
						onclick={openAddRekeningModal}
						class="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs sm:text-sm font-bold hover:bg-primary/90 transition-all shadow-xs cursor-pointer active:scale-95"
					>
						<Plus class="w-4 h-4" />
						<span>Tambah Rekening / QRIS</span>
					</button>
				{/if}
			</div>

			<!-- Daftar Kartu Rekening -->
			{#if data.daftarRekening.length === 0}
				<div class="p-8 text-center text-foreground/50 text-xs sm:text-sm rounded-2xl border border-dashed border-border">
					Belum ada nomor rekening atau QRIS shodaqoh yang ditambahkan untuk wilayah ini.
				</div>
			{:else}
				<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
					{#each data.daftarRekening as rek}
						<div class="bg-card border border-border rounded-2xl p-4 shadow-xs space-y-3 relative overflow-hidden flex flex-col justify-between">
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

								<div class="bg-secondary/40 rounded-xl p-3 space-y-1">
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
		</section>

		<!-- 5. TAUTAN RUJUKAN MANAJEMEN STRUKTUR SUB-WILAYAH (Daftar SUB Dipindahkan ke /admin/wilayah) -->
		<section class="p-4 sm:p-5 rounded-2xl bg-secondary/30 border border-border flex items-center justify-between gap-3 flex-wrap">
			<div class="flex items-center gap-3">
				<div class="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
					<Layers class="w-5 h-5" />
				</div>
				<div>
					<h3 class="text-xs sm:text-sm font-bold text-foreground">
						Struktur Hirarki Unit Bawahan
					</h3>
					<p class="text-[11px] sm:text-xs text-foreground/50">
						Pengelolaan detail RT/Blok, penambahan kelompok baru, dan administrasi hierarki wilayah dapat diakses di menu Manajemen Wilayah.
					</p>
				</div>
			</div>
			<a
				href="/admin/wilayah"
				class="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-card hover:bg-secondary text-primary border border-border text-xs font-bold transition-all shadow-xs"
			>
				<span>Buka Manajemen Wilayah</span>
				<ChevronRight class="w-3.5 h-3.5" />
			</a>
		</section>
	{/if}
</div>

<!-- MODAL FORM EDIT LOKASI PENGAJIAN (DENGAN 2 OPSI UNTUK DESA) -->
{#if showLocationModal}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-150"
		role="dialog"
		aria-modal="true"
		onclick={(e) => {
			if (e.target === e.currentTarget) closeLocationModal();
		}}
	>
		<div class="bg-card border border-border rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
			<div class="flex items-center justify-between pb-3 border-b border-border">
				<div class="flex items-center gap-2.5">
					<div class="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
						<MapPin class="w-5 h-5" />
					</div>
					<div>
						<h3 class="font-bold text-base text-foreground">
							Ubah Lokasi Pengajian {data.activeScope}
						</h3>
						<p class="text-xs text-foreground/50">
							{data.profilData?.nama}
						</p>
					</div>
				</div>
				<button
					type="button"
					onclick={closeLocationModal}
					class="p-1 rounded-lg text-foreground/40 hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
				>
					<X class="w-5 h-5" />
				</button>
			</div>

			<form
				method="POST"
				action={`?/updateLokasi&scope=${data.activeScope}&id=${data.activeId}`}
				use:enhance={confirmSubmit(
					{
						title: 'Simpan Perubahan Lokasi?',
						message: 'Pastikan nama tempat dan koordinat lokasi sudah sesuai. Yakin ingin menyimpan perubahan lokasi ini?',
						confirmText: 'Ya, Simpan',
						cancelText: 'Batal',
						variant: 'primary'
					},
					keepScrollSubmit({
						onSuccess: () => {
							closeLocationModal();
						}
					})
				)}
				class="space-y-4"
			>
				<input type="hidden" name="scope" value={data.activeScope} />
				<input type="hidden" name="id" value={data.activeId} />
				<input
					type="hidden"
					name="lokasiKelompokId"
					value={data.activeScope === 'Desa' && desaLokasiMode === 'kelompok' ? selectedLokasiKelompokId : ''}
				/>

				<!-- 2 OPSI KHUSUS DESA: PILIH DARI KELOMPOK ATAU KUSTOM -->
				{#if data.activeScope === 'Desa'}
					<div class="p-3.5 bg-secondary/50 rounded-2xl border border-border space-y-2.5">
						<label class="block text-xs font-bold text-foreground">
							Sumber Penentuan Lokasi Pengajian Desa:
						</label>
						<div class="grid grid-cols-2 gap-2 p-1 bg-card rounded-xl border border-border text-xs">
							<button
								type="button"
								onclick={() => (desaLokasiMode = 'kelompok')}
								class="py-2 px-3 rounded-lg font-bold transition-all cursor-pointer {desaLokasiMode === 'kelompok'
									? 'bg-primary text-primary-foreground shadow-xs'
									: 'text-foreground/60 hover:text-foreground'}"
							>
								Pilih dari Kelompok Binaan
							</button>
							<button
								type="button"
								onclick={() => {
									desaLokasiMode = 'manual';
									selectedLokasiKelompokId = '';
								}}
								class="py-2 px-3 rounded-lg font-bold transition-all cursor-pointer {desaLokasiMode === 'manual'
									? 'bg-primary text-primary-foreground shadow-xs'
									: 'text-foreground/60 hover:text-foreground'}"
							>
								Kustom / Cari Peta
							</button>
						</div>

						{#if desaLokasiMode === 'kelompok'}
							<div class="space-y-1.5 pt-1">
								<label for="pilihKelompokDesa" class="block text-xs font-semibold text-foreground/80">
									Pilih Kelompok Acuan:
								</label>
								<select
									id="pilihKelompokDesa"
									bind:value={selectedLokasiKelompokId}
									onchange={handlePilihKelompokDesa}
									class="w-full bg-card border border-border rounded-xl px-3.5 py-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-semibold"
								>
									<option value="">-- Pilih Kelompok Binaan di Desa Ini --</option>
									{#each (data.kelompokInDesa || []) as k}
										<option value={k.id}>
											{k.nama} {k.lokasiNama ? `(${k.lokasiNama})` : ''}
										</option>
									{/each}
								</select>
								<p class="text-[11px] text-foreground/60 leading-relaxed">
									Nama tempat, titik koordinat GPS, dan radius akan otomatis disalin dari kelompok terpilih.
								</p>
							</div>
						{/if}
					</div>
				{/if}

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
						class="px-4 py-2 rounded-xl text-xs font-semibold text-foreground/70 hover:bg-secondary transition-colors cursor-pointer"
					>
						Batal
					</button>
					<button
						type="submit"
						class="px-5 py-2 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-xs cursor-pointer active:scale-95"
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
		class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-150"
		role="dialog"
		aria-modal="true"
		onclick={(e) => {
			if (e.target === e.currentTarget) closeRekeningModal();
		}}
	>
		<div class="bg-card border border-border rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
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
					class="p-1 rounded-lg text-foreground/40 hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
				>
					<X class="w-5 h-5" />
				</button>
			</div>

			<form
				method="POST"
				action={`${isEditingRekening ? '?/updateRekening' : '?/addRekening'}&scope=${data.activeScope}&id=${data.activeId}`}
				enctype="multipart/form-data"
				use:enhance={confirmSubmit(
					{
						title: isEditingRekening ? 'Simpan Perubahan Rekening?' : 'Simpan Rekening Shodaqoh?',
						message: isEditingRekening
							? 'Pastikan data rekening sudah sesuai. Yakin ingin menyimpan perubahan rekening ini?'
							: 'Pastikan data rekening baru sudah sesuai. Yakin ingin menyimpan rekening shodaqoh ini?',
						confirmText: 'Ya, Simpan',
						cancelText: 'Batal',
						variant: 'primary'
					},
					keepScrollSubmit({
						onSuccess: () => {
							closeRekeningModal();
						}
					})
				)}
				class="space-y-3.5"
			>
				<input type="hidden" name="scope" value={data.activeScope} />
				<input type="hidden" name="id" value={data.activeId} />
				<input type="hidden" name="metode" value={inputMetode} />
				{#if isEditingRekening}
					<input type="hidden" name="rekeningId" value={editRekeningId} />
				{/if}

				<!-- Pilihan Metode (Bank vs QRIS) -->
				<div>
					<span class="block text-xs font-semibold text-foreground mb-1.5">
						Metode Transaksi Shodaqoh *
					</span>
					<div class="grid grid-cols-2 gap-2 p-1 bg-secondary/50 rounded-xl border border-border">
						<button
							type="button"
							onclick={() => (inputMetode = 'bank')}
							class="flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer {inputMetode === 'bank' ? 'bg-card text-foreground shadow-xs border border-border' : 'text-foreground/60 hover:text-foreground'}"
						>
							<CreditCard class="w-4 h-4 {inputMetode === 'bank' ? 'text-primary' : ''}" />
							<span>Transfer Bank</span>
						</button>
						<button
							type="button"
							onclick={() => (inputMetode = 'qris')}
							class="flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer {inputMetode === 'qris' ? 'bg-card text-foreground shadow-xs border border-border' : 'text-foreground/60 hover:text-foreground'}"
						>
							<QrCode class="w-4 h-4 {inputMetode === 'qris' ? 'text-primary' : ''}" />
							<span>QRIS Digital</span>
						</button>
					</div>
				</div>

				<!-- Nama Bank / Layanan -->
				<div>
					<label for="inputNamaBank" class="block text-xs font-semibold text-foreground mb-1">
						{inputMetode === 'qris' ? 'Nama Layanan / Penyelenggara QRIS *' : 'Nama Bank *'}
					</label>
					<input
						type="text"
						id="inputNamaBank"
						name="namaBank"
						required
						bind:value={inputNamaBank}
						placeholder={inputMetode === 'qris' ? 'Contoh: QRIS BSI, QRIS ShopeePay, QRIS BCA' : 'Contoh: Bank Syariah Indonesia (BSI), BCA, Mandiri'}
						class="w-full bg-secondary/50 border border-border rounded-xl px-3.5 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
					/>
				</div>

				<!-- Nomor Rekening (Wajib untuk Bank, Opsional untuk QRIS) -->
				{#if inputMetode === 'bank'}
					<div>
						<label for="inputNomorRekening" class="block text-xs font-semibold text-foreground mb-1">
							Nomor Rekening *
						</label>
						<input
							type="text"
							id="inputNomorRekening"
							name="nomorRekening"
							required
							inputmode="numeric"
							bind:value={inputNomorRekening}
							placeholder="Nomor rekening bank tujuan transfer"
							class="w-full bg-secondary/50 border border-border rounded-xl px-3.5 py-2 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
						/>
					</div>
				{:else}
					<input type="hidden" name="nomorRekening" value="QRIS" />
				{/if}

				<!-- Atas Nama Pemilik Rekening / Merchant QRIS -->
				<div>
					<label for="inputAtasNama" class="block text-xs font-semibold text-foreground mb-1">
						Atas Nama Rekening / Merchant *
					</label>
					<input
						type="text"
						id="inputAtasNama"
						name="atasNama"
						required
						bind:value={inputAtasNama}
						placeholder="Contoh: DKM Masjid Al-Huda / Bendahara Kelompok"
						class="w-full bg-secondary/50 border border-border rounded-xl px-3.5 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
					/>
				</div>

				<!-- Tipe Alokasi Tujuan Shodaqoh -->
				<div>
					<label for="inputTipeTujuan" class="block text-xs font-semibold text-foreground mb-1">
						Pos Alokasi Tujuan Shodaqoh *
					</label>
					<input
						type="text"
						id="inputTipeTujuan"
						name="tipeTujuan"
						required
						bind:value={inputTipeTujuan}
						placeholder="Contoh: Infaq & Shodaqoh, Pembangunan, Kas Sosial"
						class="w-full bg-secondary/50 border border-border rounded-xl px-3.5 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
					/>
				</div>

				<!-- Khusus QRIS: Unggah Gambar atau URL -->
				{#if inputMetode === 'qris'}
					<div class="space-y-2 p-3 bg-secondary/30 rounded-xl border border-border">
						<span class="block text-xs font-semibold text-foreground">
							Gambar Barcode QRIS
						</span>
						<div class="flex gap-2">
							<button
								type="button"
								onclick={() => (inputQrisMode = 'upload')}
								class="px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all {inputQrisMode === 'upload' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground/60'}"
							>
								Unggah File
							</button>
							<button
								type="button"
								onclick={() => (inputQrisMode = 'url')}
								class="px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all {inputQrisMode === 'url' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground/60'}"
							>
								Tautan URL
							</button>
						</div>

						{#if inputQrisMode === 'upload'}
							<input
								type="file"
								name="qrisFile"
								accept="image/*"
								onchange={handleQrisFileChange}
								class="block w-full text-xs text-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
							/>
						{:else}
							<input
								type="url"
								name="qrisUrl"
								bind:value={inputQrisImageUrl}
								placeholder="https://.../qris.jpg"
								class="w-full bg-secondary/50 border border-border rounded-xl px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
							/>
						{/if}

						{#if qrisFilePreview || inputQrisImageUrl}
							<div class="mt-2 text-center p-2 bg-card rounded-lg border border-border">
								<img
									src={qrisFilePreview || inputQrisImageUrl}
									alt="Pratinjau QRIS"
									class="max-h-36 mx-auto rounded object-contain"
								/>
							</div>
						{/if}
						<input type="hidden" name="existingQrisUrl" value={inputQrisImageUrl} />
					</div>
				{/if}

				<!-- Catatan / Keterangan Tambahan -->
				<div>
					<label for="inputKeterangan" class="block text-xs font-semibold text-foreground mb-1">
						Catatan / Keterangan Transfer (Opsional)
					</label>
					<textarea
						id="inputKeterangan"
						name="keterangan"
						rows="2"
						bind:value={inputKeterangan}
						placeholder="Contoh: Sertakan kode unik 01 di akhir nominal..."
						class="w-full bg-secondary/50 border border-border rounded-xl px-3.5 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
					></textarea>
				</div>

				<div class="flex items-center justify-end gap-2 pt-3 border-t border-border">
					<button
						type="button"
						onclick={closeRekeningModal}
						class="px-4 py-2 rounded-xl text-xs font-semibold text-foreground/70 hover:bg-secondary transition-colors cursor-pointer"
					>
						Batal
					</button>
					<button
						type="submit"
						class="px-5 py-2 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-xs cursor-pointer active:scale-95"
					>
						{isEditingRekening ? 'Simpan Perubahan' : 'Tambahkan Rekening'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- MODAL PREVIEW QRIS DIGITAL -->
{#if previewQrisUrl}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-150"
		role="dialog"
		aria-modal="true"
		onclick={() => (previewQrisUrl = null)}
	>
		<div class="bg-card border border-border rounded-3xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl">
			<div class="flex items-center justify-between pb-2 border-b border-border">
				<h3 class="text-sm font-bold text-foreground truncate">{previewQrisTitle}</h3>
				<button
					type="button"
					onclick={() => (previewQrisUrl = null)}
					class="p-1 rounded-lg text-foreground/40 hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
				>
					<X class="w-4 h-4" />
				</button>
			</div>

			<div class="p-4 bg-white rounded-2xl flex items-center justify-center shadow-xs">
				<img src={previewQrisUrl} alt="Kode QRIS" class="max-w-full max-h-72 object-contain" />
			</div>

			<button
				type="button"
				onclick={() => (previewQrisUrl = null)}
				class="w-full py-2.5 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground text-xs font-bold transition-colors cursor-pointer"
			>
				Tutup Pratinjau
			</button>
		</div>
	</div>
{/if}
