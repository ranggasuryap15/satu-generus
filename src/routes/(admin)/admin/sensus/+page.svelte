<!--
  @file src/routes/(admin)/admin/sensus/+page.svelte
  @purpose Rekapitulasi sensus Kartu Keluarga & Jamaah Mandiri/Perantau, dashboard statistik, modal detail lengkap, modal ubah data manual versi admin (anggota, isrun, keaktifan, KK), dan pembuatan akun login mandiri
  @usedBy Route admin '/admin/sensus'
  @dependencies @lucide/svelte, Svelte 5 Runes, $lib/components/SearchableSelect.svelte, $lib/components/DateInput.svelte, $lib/utils (formatDateDDMMYYYY)
  @publicFunctions requestUnmask, openCreateModal, closeCreateModal, openAddMemberModal, closeAddMemberModal, openCreateAccountModal, openEditAnggotaModal, closeEditAnggotaModal, openEditKeluargaModal, closeEditKeluargaModal, resetFilters, toggleMobileFilter
  @sideEffects Menampilkan metrik, unmask data sensitif via /api/sensus/unmask, submit createSensus, addAnggotaKeluarga, updateAnggota, updateKeluarga, createMemberAccount
-->
<script lang="ts">
	import DateInput from '$lib/components/DateInput.svelte';
	import SearchableSelect from '$lib/components/SearchableSelect.svelte';
	import { formatDateDDMMYYYY } from '$lib/utils';
	import {
	  AlertCircle,
	  CheckCircle2,
	  ChevronDown,
	  ChevronUp,
	  Download,
	  Eye,
	  Filter,
	  Home,
	  KeyRound,
	  MapPin,
	  Pencil,
	  Plus,
	  RotateCcw,
	  Search,
	  ShieldCheck,
	  TableProperties,
	  Trash2,
	  UserCheck,
	  UserPlus,
	  Users,
	  X
	} from '@lucide/svelte';
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form } = $props<{ data: PageData; form: ActionData }>();

	// State Pencarian & Filter
	let searchQuery = $state('');
	let filterDaerahId = $state<string | number>('ALL');
	let filterDesaId = $state<string | number>('ALL');
	let filterKelompokId = $state<string | number>('ALL');
	let filterPeran = $state<'ALL' | '4S' | 'PENGURUS' | 'JAMAAH'>('ALL');
	let filterTipeSensus = $state<'ALL' | 'KK' | 'MANDIRI'>('ALL');
	let isFilterMobileOpen = $state(false);

	const activeFilterCount = $derived(
		(filterDaerahId !== 'ALL' ? 1 : 0) +
		(filterDesaId !== 'ALL' ? 1 : 0) +
		(filterKelompokId !== 'ALL' ? 1 : 0) +
		(filterPeran !== 'ALL' ? 1 : 0) +
		(filterTipeSensus !== 'ALL' ? 1 : 0)
	);

	// State Modal Detail & Unmasking
	let selectedKeluarga = $state<(typeof data.daftarKeluarga)[0] | null>(null);
	let showUnmaskModal = $state(false);
	let unmaskLoading = $state(false);
	let unmaskedData = $state<{ label: string; value: string } | null>(null);

	// State Modal Buat Akun Mandiri untuk Anggota
	let memberForAccount = $state<(typeof data.daftarKeluarga)[0]['anggota'][0] | null>(null);
	let newAccountEmail = $state('');
	let newAccountPhone = $state('');
	let newAccountPassword = $state('');
	let isAccountSubmitting = $state(false);

	function openCreateAccountModal(member: (typeof data.daftarKeluarga)[0]['anggota'][0]) {
		memberForAccount = member;
		newAccountEmail = '';
		newAccountPhone = member.noTelepon !== '-' ? member.noTelepon : '';
		newAccountPassword = '12345678';
	}

	// State Modal Edit Anggota Keluarga (Manual Versi Admin)
	let editingAnggota = $state<(typeof data.daftarKeluarga)[0]['anggota'][0] | null>(null);
	let editAnggotaNama = $state('');
	let editAnggotaNik = $state('');
	let editAnggotaHubungan = $state('');
	let editAnggotaJenisKelamin = $state('');
	let editAnggotaTanggalLahir = $state('');
	let editAnggotaTempatLahir = $state('');
	let editAnggotaProfesi = $state('');
	let editAnggotaNoTelepon = $state('');
	let editAnggotaStatusGenerus = $state('');
	let editAnggotaStatusPernikahan = $state('');
	let editAnggotaStatusJamaah = $state('Aktif');
	let editAnggotaIsrun = $state(false);
	let editAnggotaGolonganDarah = $state('');
	let isEditAnggotaSubmitting = $state(false);

	function openEditAnggotaModal(a: (typeof data.daftarKeluarga)[0]['anggota'][0]) {
		editingAnggota = a;
		editAnggotaNama = a.namaLengkap;
		editAnggotaNik = '';
		editAnggotaHubungan = a.statusHubungan;
		editAnggotaJenisKelamin = a.jenisKelamin === 'P' || a.jenisKelamin === 'Perempuan' ? 'P' : 'L';
		editAnggotaTanggalLahir = a.tanggalLahir;
		editAnggotaTempatLahir = (a as any).tempatLahirRaw || (a.tempatLahir !== '-' ? a.tempatLahir : '');
		editAnggotaProfesi = (a as any).profesiRaw || (a.profesi !== '-' ? a.profesi : '');
		editAnggotaNoTelepon = (a as any).noTeleponRaw || (a.noTelepon !== '-' ? a.noTelepon : '');
		editAnggotaStatusGenerus = (a as any).statusGenerusRaw || (a.statusGenerus !== '-' ? a.statusGenerus : '');
		editAnggotaStatusPernikahan = (a as any).statusPernikahanRaw || (a.statusPernikahan !== '-' ? a.statusPernikahan : '');
		editAnggotaStatusJamaah = a.statusJamaah || 'Aktif';
		editAnggotaIsrun = a.isrun === 'Ya';
		editAnggotaGolonganDarah = (a as any).golonganDarahRaw || (a.golonganDarah !== '-' ? a.golonganDarah : '');
	}

	function closeEditAnggotaModal() {
		editingAnggota = null;
	}

	// State Modal Edit Data KK & Domisili
	let editingKeluarga = $state<(typeof data.daftarKeluarga)[0] | null>(null);
	let editKeluargaNoKk = $state('');
	let editKeluargaAlamat = $state('');
	let editKeluargaKelompokId = $state<string | number>('');
	let isEditKeluargaSubmitting = $state(false);

	function openEditKeluargaModal(k: (typeof data.daftarKeluarga)[0]) {
		editingKeluarga = k;
		editKeluargaNoKk = '';
		editKeluargaAlamat = (k as any).alamatLengkapRaw || (k.alamatLengkap !== '-' ? k.alamatLengkap : '');
		editKeluargaKelompokId = k.kelompokId || '';
	}

	function closeEditKeluargaModal() {
		editingKeluarga = null;
	}

	// Sinkronisasi reaktif selectedKeluarga ketika data mutasi berhasil
	$effect(() => {
		if (selectedKeluarga) {
			const fresh = data.daftarKeluarga.find((item) => item.id === selectedKeluarga?.id);
			if (fresh) {
				selectedKeluarga = fresh;
			}
		}
	});

	// State Modal Tambah Sensus Baru (Akun + KK/Mandiri + Anggota)
	let showCreateModal = $state(false);
	let newTipeSensus = $state<'keluarga' | 'mandiri'>('keluarga');
	let newNamaLengkap = $state('');
	let newEmail = $state('');
	let newKelompokId = $state<string | number>('');
	let newNoKk = $state('');
	let newAlamatLengkap = $state('');

	// Field Khusus Jamaah Mandiri / Perantau (Tanpa KK)
	let newNikMandiri = $state('');
	let newTanggalLahirMandiri = $state('');
	let newJenisKelaminMandiri = $state('Laki-laki');

	interface NewAnggotaRow {
		namaLengkap: string;
		nik: string;
		statusHubungan: string;
		tanggalLahir: string;
		jenisKelamin: string;
	}
	let newAnggotaList = $state<NewAnggotaRow[]>([
		{ namaLengkap: '', nik: '', statusHubungan: 'Kepala Keluarga', tanggalLahir: '', jenisKelamin: 'Laki-laki' }
	]);

	// State Modal Tambah Anggota ke KK yang Ada
	let showAddMemberModal = $state(false);
	let targetKeluargaForMember = $state<(typeof data.daftarKeluarga)[0] | null>(null);
	let memberNamaLengkap = $state('');
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

	// Opsi Filter Tipe Sensus (KK vs Mandiri)
	const tipeSensusFilterOptions = [
		{ value: 'ALL', label: 'Semua Tipe Sensus (All)' },
		{ value: 'KK', label: 'Kartu Keluarga Saja' },
		{ value: 'MANDIRI', label: 'Perorangan / Perantau Saja' }
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
				const matchAnggota = (k.anggota || []).some((a: any) =>
					(a.namaLengkap || '').toLowerCase().includes(q) ||
					formatDateDDMMYYYY(a.tanggalLahir).includes(q) ||
					(a.tanggalLahir || '').includes(q)
				);
				if (!matchKk && !matchNama && !matchEmail && !matchAlamat && !matchKelompok && !matchDesa && !matchDaerah && !matchAnggota) {
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

			// 6. Filter Tipe Sensus (KK vs Mandiri)
			if (filterTipeSensus === 'KK' && !k.isKk) return false;
			if (filterTipeSensus === 'MANDIRI' && k.isKk) return false;

			return true;
		})
	);

	function resetFilters() {
		searchQuery = '';
		filterDaerahId = 'ALL';
		filterDesaId = 'ALL';
		filterKelompokId = 'ALL';
		filterPeran = 'ALL';
		filterTipeSensus = 'ALL';
	}

	function toggleMobileFilter() {
		isFilterMobileOpen = !isFilterMobileOpen;
	}

	function isCreateFormDirty(): boolean {
		if (newTipeSensus === 'mandiri') {
			return !!(
				newNamaLengkap.trim() ||
				newEmail.trim() ||
				newKelompokId ||
				newAlamatLengkap.trim() ||
				newNikMandiri.trim() ||
				newTanggalLahirMandiri
			);
		}
		return !!(
			newNamaLengkap.trim() ||
			newEmail.trim() ||
			newKelompokId ||
			newNoKk.trim() ||
			newAlamatLengkap.trim() ||
			newAnggotaList.length > 1 ||
			newAnggotaList[0]?.namaLengkap?.trim() ||
			newAnggotaList[0]?.nik?.trim() ||
			newAnggotaList[0]?.tanggalLahir
		);
	}

	function resetCreateForm() {
		newTipeSensus = 'keluarga';
		newNamaLengkap = '';
		newEmail = '';
		newKelompokId = '';
		newNoKk = '';
		newAlamatLengkap = '';
		newNikMandiri = '';
		newTanggalLahirMandiri = '';
		newJenisKelaminMandiri = 'Laki-laki';
		newAnggotaList = [
			{ namaLengkap: '', nik: '', statusHubungan: 'Kepala Keluarga', tanggalLahir: '', jenisKelamin: 'Laki-laki' }
		];
	}

	function openCreateModal() {
		// Buka modal tanpa menghapus draf isian yang sedang diketik
		showCreateModal = true;
	}

	function closeCreateModal() {
		if (isCreateFormDirty()) {
			if (!confirm('Ada data sensus yang sudah Anda isi. Yakin ingin menutup modal? Isian Anda akan tetap tersimpan sebagai draf.')) {
				return;
			}
		}
		showCreateModal = false;
	}

	function addAnggotaRow() {
		newAnggotaList = [
			...newAnggotaList,
			{ namaLengkap: '', nik: '', statusHubungan: 'Anak', tanggalLahir: '', jenisKelamin: 'Laki-laki' }
		];
	}

	function removeAnggotaRow(index: number) {
		if (newAnggotaList.length <= 1) return;
		newAnggotaList = newAnggotaList.filter((_, idx) => idx !== index);
	}

	function isAddMemberFormDirty(): boolean {
		return !!(
			memberNamaLengkap.trim() ||
			memberNik.trim() ||
			memberTanggalLahir
		);
	}

	function resetAddMemberForm() {
		memberNamaLengkap = '';
		memberNik = '';
		memberStatus = 'Anak';
		memberTanggalLahir = '';
		memberJenisKelamin = 'Laki-laki';
	}

	function openAddMemberModal(k: (typeof data.daftarKeluarga)[number]) {
		if (targetKeluargaForMember?.id !== k.id) {
			resetAddMemberForm();
		}
		targetKeluargaForMember = k;
		showAddMemberModal = true;
	}

	function closeAddMemberModal() {
		if (isAddMemberFormDirty()) {
			if (!confirm('Ada data anggota yang sudah Anda isi. Yakin ingin menutup modal? Isian Anda akan tetap tersimpan sebagai draf.')) {
				return;
			}
		}
		showAddMemberModal = false;
	}

	$effect(() => {
		if (form?.success) {
			resetCreateForm();
			resetAddMemberForm();
			showCreateModal = false;
			showAddMemberModal = false;
		}
	});

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
			<a
				href="/admin/sensus/batch"
				class="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-primary/30 bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-all shadow-sm"
			>
				<TableProperties class="w-3.5 h-3.5" />
				<span>Batch Insert</span>
			</a>

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

	<!-- 1. DASHBOARD STATISTIK DI BAGIAN ATAS -->
	<div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
		<!-- Total Kartu Keluarga -->
		<div class="bg-card border border-border rounded-xl p-3.5 sm:p-4 shadow-xs flex items-start gap-2.5 sm:gap-3">
			<div class="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
				<Home class="w-4 h-4 sm:w-5 sm:h-5" />
			</div>
			<div class="min-w-0 flex-1">
				<p class="text-[10px] sm:text-[11px] font-medium text-foreground/60 leading-tight">Total Kartu Keluarga</p>
				<p class="text-lg sm:text-2xl font-bold text-foreground mt-0.5 tracking-tight">
					{data.dashboardStats.totalKeluarga}
					<span class="text-[11px] sm:text-xs font-normal text-muted-foreground">KK</span>
				</p>
				<p class="text-[10px] text-muted-foreground/80 mt-0.5 leading-tight truncate">
					{#if data.dashboardStats.totalMandiri > 0}
						+{data.dashboardStats.totalMandiri} Jiwa Mandiri
					{:else}
						Terdata di sensus
					{/if}
				</p>
			</div>
		</div>

		<!-- Total Jiwa / Anggota -->
		<div class="bg-card border border-border rounded-xl p-3.5 sm:p-4 shadow-xs flex items-start gap-2.5 sm:gap-3">
			<div class="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0 mt-0.5">
				<Users class="w-4 h-4 sm:w-5 sm:h-5" />
			</div>
			<div class="min-w-0 flex-1">
				<p class="text-[10px] sm:text-[11px] font-medium text-foreground/60 leading-tight">Total Jiwa / Anggota</p>
				<p class="text-lg sm:text-2xl font-bold text-foreground mt-0.5 tracking-tight">
					{data.dashboardStats.totalJiwa}
					<span class="text-[11px] sm:text-xs font-normal text-muted-foreground">Jiwa</span>
				</p>
				<p class="text-[10px] text-muted-foreground/80 mt-0.5 leading-tight truncate">
					{data.dashboardStats.totalKeluarga > 0 ? `~${Math.round(data.dashboardStats.totalJiwa / data.dashboardStats.totalKeluarga)} jiwa per KK` : 'Seluruh anggota keluarga'}
				</p>
			</div>
		</div>

		<!-- Pengurus & 4S -->
		<div class="bg-card border border-border rounded-xl p-3.5 sm:p-4 shadow-xs flex items-start gap-2.5 sm:gap-3">
			<div class="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0 mt-0.5">
				<ShieldCheck class="w-4 h-4 sm:w-5 sm:h-5" />
			</div>
			<div class="min-w-0 flex-1">
				<p class="text-[10px] sm:text-[11px] font-medium text-foreground/60 leading-tight">Pengurus & 4S</p>
				<p class="text-lg sm:text-2xl font-bold text-foreground mt-0.5 tracking-tight">
					{data.dashboardStats.totalPengurus}
					<span class="text-[11px] sm:text-xs font-normal text-muted-foreground">Orang</span>
				</p>
				<p class="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5 leading-tight truncate font-medium">
					{data.dashboardStats.totalPengurus4S} Pejabat 4S
				</p>
			</div>
		</div>

		<!-- Cakupan Wilayah -->
		<div class="bg-card border border-border rounded-xl p-3.5 sm:p-4 shadow-xs flex items-start gap-2.5 sm:gap-3">
			<div class="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center shrink-0 mt-0.5">
				<MapPin class="w-4 h-4 sm:w-5 sm:h-5" />
			</div>
			<div class="min-w-0 flex-1">
				<p class="text-[10px] sm:text-[11px] font-medium text-foreground/60 leading-tight">Cakupan Wilayah</p>
				<p class="text-lg sm:text-2xl font-bold text-foreground mt-0.5 tracking-tight">
					{data.dashboardStats.totalKelompok}
					<span class="text-[11px] sm:text-xs font-normal text-muted-foreground">Kelompok</span>
				</p>
				<p class="text-[10px] text-muted-foreground/80 mt-0.5 leading-tight truncate" title={`${data.dashboardStats.totalDaerah} Daerah • ${data.dashboardStats.totalDesa} Desa`}>
					{data.dashboardStats.totalDaerah} Daerah • {data.dashboardStats.totalDesa} Desa
				</p>
			</div>
		</div>
	</div>

	<!-- 2. FILTER TOOLBAR LENGKAP (Daerah, Desa, Kelompok, Pengurus/4S/Jamaah, Tipe Sensus, Pencarian) -->
	<div class="bg-card border border-border rounded-2xl p-4 shadow-sm space-y-3">
		<div class="flex items-center justify-between pb-2 border-b border-border text-xs gap-2">
			<button
				type="button"
				onclick={toggleMobileFilter}
				class="flex items-center gap-2 font-semibold text-foreground hover:text-primary transition-colors cursor-pointer text-left flex-1"
				aria-expanded={isFilterMobileOpen}
				aria-controls="filter-dropdown-container"
			>
				<Filter class="w-3.5 h-3.5 text-primary shrink-0" />
				<span>Filter Data Sensus</span>
				{#if activeFilterCount > 0}
					<span class="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
						{activeFilterCount} Aktif
					</span>
				{:else}
					<span class="text-[11px] text-foreground/50 font-normal hidden sm:inline">(Default: All)</span>
				{/if}

				<!-- Toggle Button Pill di Mobile -->
				<span class="sm:hidden text-foreground/60 flex items-center gap-1 text-[11px] font-medium ml-auto bg-secondary/80 px-2 py-0.5 rounded-md">
					{#if isFilterMobileOpen}
						<ChevronUp class="w-3.5 h-3.5" />
						<span>Tutup</span>
					{:else}
						<ChevronDown class="w-3.5 h-3.5" />
						<span>Filter</span>
					{/if}
				</span>
			</button>

			{#if searchQuery || filterDaerahId !== 'ALL' || filterDesaId !== 'ALL' || filterKelompokId !== 'ALL' || filterPeran !== 'ALL' || filterTipeSensus !== 'ALL'}
				<button
					type="button"
					onclick={resetFilters}
					class="inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-medium cursor-pointer shrink-0"
				>
					<RotateCcw class="w-3 h-3" />
					<span>Reset Filter</span>
				</button>
			{/if}
		</div>

		<!-- Baris Filter Dropdown Search (Collapsible di Mobile < 640px, Terbuka di Desktop >= 640px) -->
		<div
			id="filter-dropdown-container"
			class="{isFilterMobileOpen ? 'grid' : 'hidden'} sm:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-1"
		>
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

			<!-- Filter Tipe Sensus (KK vs Mandiri) -->
			<div>
				<span class="block text-[11px] font-medium text-foreground/70 mb-1">Tipe Sensus</span>
				<SearchableSelect
					name="filterTipeSensus"
					options={tipeSensusFilterOptions}
					bind:value={filterTipeSensus}
					placeholder="Semua Tipe (All)"
					searchPlaceholder="Cari tipe..."
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

	<!-- 3. TABEL DATA SENSUS KARTU KELUARGA & JAMAAH MANDIRI -->
	<div class="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
		<div class="overflow-x-auto">
			<table class="w-full text-left text-xs text-foreground/80">
				<thead class="bg-secondary/40 text-foreground/60 uppercase text-[10px] tracking-wider border-b border-border">
					<tr>
						<th class="py-3 px-4 font-semibold">No. KK / Tipe Sensus</th>
						<th class="py-3 px-4 font-semibold">Kepala Keluarga / Jamaah</th>
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
									<span class="text-xs">Tidak ada data sensus yang sesuai filter.</span>
								</div>
							</td>
						</tr>
					{:else}
						{#each filteredKeluarga as k}
							<tr class="hover:bg-secondary/20 transition-colors">
								<!-- No. KK / Tipe Sensus dengan Unmask Eye -->
								<td class="py-3.5 px-4 font-mono font-medium text-foreground">
									<div class="flex items-center gap-1.5 flex-wrap">
										{#if k.isKk}
											<span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
												KK
											</span>
											<span>{k.noKkMasked}</span>
											{#if k.noKkMasked !== 'Belum Ada No. KK'}
												<button
													type="button"
													onclick={() => requestUnmask({ keluargaId: k.id, label: `No. KK (${k.kepalaKeluargaNama})` })}
													class="text-primary hover:text-primary/80 p-1 rounded hover:bg-primary/10 transition-colors"
													title="Buka Enkripsi No. KK"
												>
													<Eye class="w-3.5 h-3.5" />
												</button>
											{/if}
										{:else}
											<span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
												Perorangan / Perantau
											</span>
										{/if}
									</div>
								</td>

								<!-- Kepala Keluarga & Role Badge -->
								<td class="py-3.5 px-4">
									<div class="flex flex-col">
										<div class="flex items-center gap-1.5">
											<span class="font-semibold text-foreground">{k.kepalaKeluargaNama}</span>
											{#if !k.isKk}
												<span class="px-1.5 py-0.2 rounded text-[9px] font-medium bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
													Mandiri
												</span>
											{/if}
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
										{#if k.isKk}
											<button
												type="button"
												onclick={() => openAddMemberModal(k)}
												class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border hover:bg-secondary text-foreground/80 text-xs font-medium transition-colors"
												title="Tambah Anggota Keluarga"
											>
												<UserPlus class="w-3.5 h-3.5 text-primary" />
												<span class="hidden sm:inline">+ Anggota</span>
											</button>
										{/if}

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
			if (e.target === e.currentTarget) closeCreateModal();
		}}
	>
		<div class="bg-card border border-border rounded-2xl max-w-3xl w-full p-4 sm:p-6 shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto">
			<div class="flex items-center justify-between pb-3 border-b border-border">
				<div>
					<h3 class="text-sm font-bold text-foreground">Tambah Sensus & Akun Jamaah Baru</h3>
					<p class="text-[11px] text-foreground/60 mt-0.5">
						Mendaftarkan akun jamaah baru sekaligus membuat Kartu Keluarga dan anggota.
					</p>
				</div>
				<button
					type="button"
					onclick={closeCreateModal}
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
				<!-- Tipe Sensus Selector (KK vs Mandiri) -->
				<div class="space-y-1.5">
					<span class="block text-xs font-semibold text-foreground">Kategori Sensus *</span>
					<div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
						<label class="p-3 border rounded-xl flex items-start gap-2.5 cursor-pointer transition-all {newTipeSensus === 'keluarga' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border bg-secondary/30 hover:bg-secondary/50'}">
							<input
								type="radio"
								name="tipeSensusRadio"
								value="keluarga"
								bind:group={newTipeSensus}
								class="mt-0.5 text-primary focus:ring-primary"
							/>
							<div>
								<span class="text-xs font-bold text-foreground block">Kepala Keluarga (Dengan KK)</span>
								<span class="text-[10px] text-foreground/60 block leading-tight mt-0.5">
									Memiliki Nomor KK utuh dan dapat memiliki tanggungan anggota keluarga. Dihitung dalam total KK.
								</span>
							</div>
						</label>

						<label class="p-3 border rounded-xl flex items-start gap-2.5 cursor-pointer transition-all {newTipeSensus === 'mandiri' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border bg-secondary/30 hover:bg-secondary/50'}">
							<input
								type="radio"
								name="tipeSensusRadio"
								value="mandiri"
								bind:group={newTipeSensus}
								class="mt-0.5 text-primary focus:ring-primary"
							/>
							<div>
								<span class="text-xs font-bold text-foreground block">Perorangan / Perantau (Tanpa KK)</span>
								<span class="text-[10px] text-foreground/60 block leading-tight mt-0.5">
									Remaja/i atau perantau mandiri tanpa keluarga di sini. Terdata di sensus jiwa, tidak dihitung kuota KK.
								</span>
							</div>
						</label>
					</div>
				</div>

				<input type="hidden" name="tipeSensus" value={newTipeSensus} />

				<!-- BAGIAN 1: DATA AKUN JAMAAH -->
				<div class="p-4 rounded-xl border border-border bg-secondary/20 space-y-3">
					<h4 class="text-xs font-bold text-foreground flex items-center gap-1.5">
						<UserCheck class="w-3.5 h-3.5 text-primary" />
						1. Data Akun Jamaah {newTipeSensus === 'keluarga' ? '(Kepala Keluarga)' : '(Mandiri / Perantau)'}
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
								placeholder={newTipeSensus === 'keluarga' ? 'Contoh: Ahmad Dahlan' : 'Contoh: Rian Pratama'}
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

				{#if newTipeSensus === 'keluarga'}
					<!-- Input Tersembunyi JSON Anggota Data untuk Tipe Keluarga -->
					<input type="hidden" name="anggotaData" value={JSON.stringify(newAnggotaList)} />

					<!-- BAGIAN 2: DATA KARTU KELUARGA -->
					<div class="p-4 rounded-xl border border-border bg-secondary/20 space-y-3">
						<h4 class="text-xs font-bold text-foreground flex items-center gap-1.5">
							<Home class="w-3.5 h-3.5 text-primary" />
							2. Data Kartu Keluarga
						</h4>

						<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
							<div>
								<label for="noKk" class="block text-[11px] font-semibold text-foreground mb-1">
									Nomor Kartu Keluarga (16 Digit, Opsional)
								</label>
								<input
									id="noKk"
									name="noKk"
									type="text"
									inputmode="numeric"
									pattern="[0-9]*"
									maxlength="16"
									bind:value={newNoKk}
									oninput={(e) => {
										newNoKk = e.currentTarget.value.replace(/\D/g, '');
									}}
									placeholder="3216xxxxxxxxxxxx (opsional)"
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

						<div class="space-y-3">
							{#each newAnggotaList as anggota, idx}
								<div class="p-3.5 rounded-lg border border-border bg-card space-y-3 shadow-xs">
									<div class="flex items-center justify-between text-xs font-semibold text-foreground border-b border-border/50 pb-2">
										<span class="flex items-center gap-1.5">
											<span class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-[11px] font-bold">
												{idx + 1}
											</span>
											<span>Anggota #{idx + 1}</span>
											<span class="text-[11px] font-normal text-muted-foreground">({anggota.statusHubungan})</span>
										</span>
										{#if idx > 0}
											<button
												type="button"
												onclick={() => removeAnggotaRow(idx)}
												class="inline-flex items-center gap-1 text-[11px] text-destructive hover:text-destructive/80 font-medium px-2 py-0.5 rounded hover:bg-destructive/10 transition-colors"
												title="Hapus baris anggota"
											>
												<Trash2 class="w-3.5 h-3.5" />
												<span>Hapus</span>
											</button>
										{/if}
									</div>

									<div class="grid grid-cols-1 sm:grid-cols-12 gap-3 text-xs">
										<!-- Baris 1: Nama Lengkap & Status Hubungan -->
										<div class="sm:col-span-7">
											<label for={`new-nama-${idx}`} class="block text-[11px] font-semibold text-foreground mb-1">
												Nama Lengkap *
											</label>
											<input
												id={`new-nama-${idx}`}
												type="text"
												required
												bind:value={anggota.namaLengkap}
												placeholder={idx === 0 ? "Nama Kepala Keluarga" : "Nama Lengkap Anggota"}
												class="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
											/>
										</div>

										<div class="sm:col-span-5">
											<label for={`new-status-${idx}`} class="block text-[11px] font-semibold text-foreground mb-1">
												Status Hubungan *
											</label>
											<select
												id={`new-status-${idx}`}
												bind:value={anggota.statusHubungan}
												required
												class="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
											>
												<option value="Kepala Keluarga">Kepala Keluarga</option>
												<option value="Suami">Suami</option>
												<option value="Istri">Istri</option>
												<option value="Anak">Anak</option>
												<option value="Orang Tua">Orang Tua</option>
												<option value="Famili Lain">Famili Lain</option>
											</select>
										</div>

										<!-- Baris 2: NIK, Tgl Lahir, Jenis Kelamin -->
										<div class="sm:col-span-5">
											<label for={`new-nik-${idx}`} class="block text-[11px] font-semibold text-foreground mb-1">
												NIK (16 Digit, Opsional)
											</label>
											<input
												id={`new-nik-${idx}`}
												type="text"
												inputmode="numeric"
												pattern="[0-9]*"
												maxlength="16"
												bind:value={anggota.nik}
												oninput={(e) => {
													anggota.nik = e.currentTarget.value.replace(/\D/g, '');
												}}
												placeholder="3216xxxxxxxxxxxx (opsional)"
												class="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
											/>
										</div>

										<div class="sm:col-span-4">
											<label for={`new-tgl-${idx}`} class="block text-[11px] font-semibold text-foreground mb-1">
												Tgl Lahir (DD-MM-YYYY) *
											</label>
											<DateInput
												id={`new-tgl-${idx}`}
												required
												bind:value={anggota.tanggalLahir}
												class="bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
											/>
										</div>

										<div class="sm:col-span-3">
											<label for={`new-jk-${idx}`} class="block text-[11px] font-semibold text-foreground mb-1">
												Jenis Kelamin *
											</label>
											<select
												id={`new-jk-${idx}`}
												bind:value={anggota.jenisKelamin}
												required
												class="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
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
				{:else}
					<!-- FORM KHUSUS JAMAAH MANDIRI / PERANTAU -->
					<!-- BAGIAN 2: ALAMAT TINGGAL DOMISILI -->
					<div class="p-4 rounded-xl border border-border bg-secondary/20 space-y-3">
						<h4 class="text-xs font-bold text-foreground flex items-center gap-1.5">
							<Home class="w-3.5 h-3.5 text-primary" />
							2. Tempat Tinggal Domisili Saat Ini
						</h4>

						<div>
							<label for="alamatLengkap" class="block text-[11px] font-semibold text-foreground mb-1">
								Alamat Lengkap Domisili / Kos / Kontrakan / Asrama *
							</label>
							<input
								id="alamatLengkap"
								name="alamatLengkap"
								type="text"
								required
								bind:value={newAlamatLengkap}
								placeholder="Contoh: Kost Griya Putri No. 4, RT 02/RW 03"
								class="w-full bg-secondary/60 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
							/>
						</div>
					</div>

					<!-- BAGIAN 3: DATA DIRI JAMAAH MANDIRI (1 JIWA) -->
					<div class="p-4 rounded-xl border border-border bg-secondary/20 space-y-3">
						<div class="flex items-center justify-between">
							<h4 class="text-xs font-bold text-foreground flex items-center gap-1.5">
								<Users class="w-3.5 h-3.5 text-primary" />
								3. Data Diri Jamaah Mandiri (1 Jiwa Sensus)
							</h4>
							<span class="text-[10px] bg-purple-500/10 text-purple-600 dark:text-purple-400 font-semibold px-2 py-0.5 rounded-full border border-purple-500/20">
								Tidak dihitung KK
							</span>
						</div>

						<div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
							<div>
								<label for="nikMandiri" class="block text-[11px] font-semibold text-foreground mb-1">
									NIK (16 Digit, Opsional)
								</label>
								<input
									id="nikMandiri"
									name="nik"
									type="text"
									inputmode="numeric"
									pattern="[0-9]*"
									maxlength="16"
									bind:value={newNikMandiri}
									oninput={(e) => {
										newNikMandiri = e.currentTarget.value.replace(/\D/g, '');
									}}
									placeholder="3216xxxxxxxxxxxx (opsional)"
									class="w-full bg-secondary/60 border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
								/>
							</div>

							<div>
								<label for="tanggalLahirMandiri" class="block text-[11px] font-semibold text-foreground mb-1">
									Tanggal Lahir (DD-MM-YYYY) *
								</label>
								<DateInput
									id="tanggalLahirMandiri"
									name="tanggalLahir"
									required
									bind:value={newTanggalLahirMandiri}
									class="bg-secondary/60 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
								/>
							</div>

							<div>
								<label for="jenisKelaminMandiri" class="block text-[11px] font-semibold text-foreground mb-1">
									Jenis Kelamin *
								</label>
								<select
									id="jenisKelaminMandiri"
									name="jenisKelamin"
									bind:value={newJenisKelaminMandiri}
									required
									class="w-full bg-secondary/60 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
								>
									<option value="Laki-laki">Laki-laki</option>
									<option value="Perempuan">Perempuan</option>
								</select>
							</div>
						</div>

						<div class="p-2.5 rounded-lg bg-background/60 border border-border text-[11px] text-foreground/70 flex items-center gap-2">
							<ShieldCheck class="w-4 h-4 text-primary shrink-0" />
							<span>Jamaah ini otomatis terdata sebagai sensus jiwa di kelompok basis, namun kuota kartu keluarga (KK) tidak akan bertambah.</span>
						</div>
					</div>
				{/if}

				<div class="flex items-center justify-between gap-2 pt-3 border-t border-border">
					{#if isCreateFormDirty()}
						<button
							type="button"
							onclick={() => {
								if (confirm('Kosongkan semua isian formulir sensus?')) resetCreateForm();
							}}
							class="text-xs font-medium text-destructive hover:text-destructive/80 transition-colors"
						>
							Kosongkan Isian
						</button>
					{:else}
						<div></div>
					{/if}

					<div class="flex items-center gap-2">
						<button
							type="button"
							onclick={closeCreateModal}
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
			if (e.target === e.currentTarget) closeAddMemberModal();
		}}
	>
		<div class="bg-card border border-border rounded-2xl max-w-md w-full p-4 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
			<div class="flex items-center justify-between pb-3 border-b border-border">
				<div>
					<h3 class="text-sm font-bold text-foreground">Tambah Anggota Keluarga</h3>
					<p class="text-[11px] text-foreground/60 font-mono mt-0.5">
						KK: {targetKeluargaForMember.noKkMasked} ({targetKeluargaForMember.kepalaKeluargaNama})
					</p>
				</div>
				<button
					type="button"
					onclick={closeAddMemberModal}
					class="p-1 rounded-lg hover:bg-secondary text-foreground/60 hover:text-foreground"
				>
					<X class="w-5 h-5" />
				</button>
			</div>

			<form method="POST" action="?/addAnggotaKeluarga" class="space-y-3 text-xs">
				<input type="hidden" name="keluargaId" value={targetKeluargaForMember.id} />

				<div>
					<label for="memberNama" class="block font-semibold text-foreground mb-1">
						Nama Lengkap *
					</label>
					<input
						id="memberNama"
						name="namaLengkap"
						type="text"
						required
						bind:value={memberNamaLengkap}
						placeholder="Contoh: Siti Rahayu"
						class="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
					/>
				</div>

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
						NIK (16 Digit Angka, Opsional)
					</label>
					<input
						id="memberNik"
						name="nik"
						type="text"
						inputmode="numeric"
						pattern="[0-9]*"
						maxlength="16"
						bind:value={memberNik}
						oninput={(e) => {
							memberNik = e.currentTarget.value.replace(/\D/g, '');
						}}
						placeholder="3216xxxxxxxxxxxx (opsional)"
						class="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
					/>
				</div>

				<div>
					<label for="memberTgl" class="block font-semibold text-foreground mb-1">
						Tanggal Lahir (DD-MM-YYYY) *
					</label>
					<DateInput
						id="memberTgl"
						name="tanggalLahir"
						required
						bind:value={memberTanggalLahir}
						class="bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
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
						onclick={closeAddMemberModal}
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
		<div class="bg-card border border-border rounded-2xl max-w-2xl w-full p-4 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
			<div class="flex items-center justify-between pb-3 border-b border-border">
				<div>
					<div class="flex items-center gap-2">
						<h3 class="text-sm font-bold text-foreground">
							{selectedKeluarga.isKk ? 'Rincian Lengkap Kartu Keluarga' : 'Rincian Sensus Jamaah Mandiri / Perantau'}
						</h3>
						<span class="text-[10px] bg-secondary px-2 py-0.5 rounded-full text-foreground/70 font-semibold">
							{selectedKeluarga.anggota.length} Jiwa
						</span>
					</div>
					<p class="text-xs text-foreground/60 font-mono mt-0.5">
						{selectedKeluarga.isKk ? `${selectedKeluarga.noKkMasked} • ${selectedKeluarga.kepalaKeluargaNama}` : `Jamaah Mandiri / Perantau (Tanpa KK) • ${selectedKeluarga.kepalaKeluargaNama}`}
					</p>
				</div>
				<button
					type="button"
					onclick={() => (selectedKeluarga = null)}
					class="p-1 rounded-lg hover:bg-secondary text-foreground/60 hover:text-foreground cursor-pointer"
				>
					<X class="w-5 h-5" />
				</button>
			</div>

			<!-- Box Informasi Domisili & Tombol Edit KK -->
			<div class="p-3 bg-secondary/40 border border-border rounded-xl space-y-2 text-xs">
				<div class="flex items-center justify-between flex-wrap gap-2">
					<div class="flex items-center gap-2">
						<Home class="w-4 h-4 text-primary" />
						<span class="font-bold text-foreground">
							{selectedKeluarga.isKk ? 'Kepala Keluarga: ' : 'Nama Jamaah: '}
							<span class="text-primary">{selectedKeluarga.kepalaKeluargaNama}</span>
						</span>
						{#if selectedKeluarga.isKk}
							<span class="font-mono text-[11px] text-foreground/70 bg-card px-2 py-0.5 rounded border border-border">
								No. KK: {selectedKeluarga.noKkMasked}
							</span>
						{/if}
					</div>
					<button
						type="button"
						onclick={() => {
							const target = selectedKeluarga;
							if (target) openEditKeluargaModal(target);
						}}
						class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary font-semibold text-[11px] border border-primary/30 transition-colors cursor-pointer"
					>
						<Pencil class="w-3 h-3" />
						<span>Edit KK & Domisili</span>
					</button>
				</div>
				<div class="flex items-center gap-4 text-[11px] text-foreground/70 flex-wrap">
					<div class="flex items-center gap-1">
						<MapPin class="w-3.5 h-3.5 text-muted-foreground" />
						<span>{selectedKeluarga.kelompokNama} ({selectedKeluarga.desaNama}, {selectedKeluarga.daerahNama})</span>
					</div>
					{#if selectedKeluarga.alamatLengkap && selectedKeluarga.alamatLengkap !== '-'}
						<div>
							<span class="text-foreground/50">Alamat:</span> {selectedKeluarga.alamatLengkap}
						</div>
					{/if}
				</div>
			</div>

			<!-- Daftar Anggota Lengkap -->
			<div class="space-y-3 max-h-96 overflow-y-auto pr-1">
				{#each selectedKeluarga.anggota as a}
					<div class="p-3.5 rounded-xl border border-border bg-secondary/20 hover:bg-secondary/30 transition-colors space-y-2.5 text-xs">
						<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/50 pb-2">
							<div class="space-y-1">
								<div class="flex items-center gap-1.5 flex-wrap">
									<span class="font-bold text-foreground text-sm">{a.namaLengkap}</span>
									<span class="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-semibold">
										{a.statusHubungan}
									</span>
									<span class="text-[10px] bg-secondary px-1.5 py-0.5 rounded text-foreground/70 font-mono font-bold">
										{a.jenisKelamin === 'P' || a.jenisKelamin === 'Perempuan' ? 'Perempuan' : 'Laki-laki'}
									</span>
									{#if a.statusJamaah}
										<span class="text-[10px] {a.statusJamaah === 'Aktif' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' : 'bg-destructive/10 text-destructive border border-destructive/20'} px-2 py-0.5 rounded-full font-semibold">
											{a.statusJamaah === 'Aktif' ? '● Aktif' : '○ Tidak Aktif'}
										</span>
									{/if}
									<span class="text-[10px] {a.isrun === 'Ya' ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 font-bold' : 'bg-secondary text-foreground/50'} px-2 py-0.5 rounded-full">
										Isrun: {a.isrun || 'Tidak'}
									</span>
									{#if a.statusGenerus && a.statusGenerus !== '-'}
										<span class="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full font-semibold">
											{a.statusGenerus}
										</span>
									{/if}
									{#if a.statusPernikahan && a.statusPernikahan !== '-'}
										<span class="text-[10px] bg-blue-500/10 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded font-medium">
											{a.statusPernikahan}
										</span>
									{/if}
								</div>
								<div class="flex items-center gap-2">
									<span class="font-mono text-[11px] text-foreground/70">NIK: {a.nikMasked}</span>
									{#if a.hasNik}
										<button
											type="button"
											onclick={() => requestUnmask({ anggotaId: a.id, label: `NIK (${a.namaLengkap} - ${a.statusHubungan})` })}
											class="text-primary hover:text-primary/80 p-0.5 rounded hover:bg-primary/10 transition-colors cursor-pointer"
											title="Buka Enkripsi NIK"
										>
											<Eye class="w-3.5 h-3.5" />
										</button>
									{/if}
								</div>
							</div>

							<!-- Aksi per Anggota -->
							<div class="shrink-0 flex items-center gap-1.5 flex-wrap">
								<button
									type="button"
									onclick={() => openEditAnggotaModal(a)}
									class="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg border border-border bg-card hover:bg-secondary text-foreground font-semibold transition-colors cursor-pointer shadow-xs"
									title="Ubah data anggota secara manual versi admin"
								>
									<Pencil class="w-3 h-3 text-primary" />
									<span>Edit Data</span>
								</button>

								{#if a.userId}
									<span class="inline-flex items-center gap-1 text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-1 rounded-lg font-semibold border border-emerald-500/20">
										<CheckCircle2 class="w-3 h-3" />
										<span>Punya Akun</span>
									</span>
								{:else}
									<button
										type="button"
										onclick={() => openCreateAccountModal(a)}
										class="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg border border-primary/40 bg-primary/10 hover:bg-primary/20 text-primary font-semibold transition-colors cursor-pointer"
										title="Buatkan akun mandiri agar anggota ini bisa login sendiri"
									>
										<KeyRound class="w-3 h-3" />
										<span>Buatkan Akun</span>
									</button>
								{/if}
							</div>
						</div>

						<!-- Detail Rinci Jiwa -->
						<div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-foreground/70 bg-card/60 p-2 rounded-lg border border-border/40">
							<div>
								<span class="text-foreground/40 block text-[10px]">Tempat, Tgl Lahir:</span>
								<span class="font-medium text-foreground">{a.tempatLahir !== '-' ? `${a.tempatLahir}, ` : ''}{formatDateDDMMYYYY(a.tanggalLahir)}</span>
							</div>
							<div>
								<span class="text-foreground/40 block text-[10px]">No. HP / WA:</span>
								<span class="font-mono text-foreground">{a.noTelepon && a.noTelepon !== '-' ? a.noTelepon : '-'}</span>
							</div>
							<div>
								<span class="text-foreground/40 block text-[10px]">Profesi / Pekerjaan:</span>
								<span class="text-foreground">{a.profesi && a.profesi !== '-' ? a.profesi : '-'}</span>
							</div>
							<div>
								<span class="text-foreground/40 block text-[10px]">Golongan Darah:</span>
								<span class="font-semibold text-foreground">{a.golonganDarah && a.golonganDarah !== '-' ? a.golonganDarah : '-'}</span>
							</div>
						</div>
					</div>
				{/each}
			</div>

			<!-- Footer Modal Detail -->
			<div class="flex items-center justify-between pt-3 border-t border-border">
				{#if selectedKeluarga.isKk}
					<button
						type="button"
						onclick={() => {
							const target = selectedKeluarga;
							selectedKeluarga = null;
							if (target) openAddMemberModal(target);
						}}
						class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-foreground hover:bg-secondary cursor-pointer"
					>
						<UserPlus class="w-3.5 h-3.5 text-primary" />
						<span>+ Tambah Anggota</span>
					</button>
				{:else}
					<div></div>
				{/if}

				<button
					type="button"
					onclick={() => (selectedKeluarga = null)}
					class="px-4 py-1.5 rounded-lg bg-secondary text-foreground text-xs font-semibold hover:bg-secondary/80 cursor-pointer"
				>
					Tutup
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- MODAL EDIT DATA ANGGOTA SECARA MANUAL VERSI ADMIN -->
{#if editingAnggota}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-150"
		role="dialog"
		aria-modal="true"
		onclick={(e) => {
			if (e.target === e.currentTarget) closeEditAnggotaModal();
		}}
	>
		<div class="bg-card border border-border rounded-2xl max-w-xl w-full p-4 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
			<div class="flex items-center justify-between pb-3 border-b border-border">
				<div>
					<h3 class="text-sm font-bold text-foreground flex items-center gap-2">
						<Pencil class="w-4 h-4 text-primary" />
						<span>Ubah Data Anggota Sensus (Manual Versi Admin)</span>
					</h3>
					<p class="text-[11px] text-foreground/60 mt-0.5">
						Perbarui data demografi, keaktifan jamaah, checklist isrun, dan identitas.
					</p>
				</div>
				<button
					type="button"
					onclick={closeEditAnggotaModal}
					class="p-1 rounded-lg hover:bg-secondary text-foreground/60 hover:text-foreground cursor-pointer"
				>
					<X class="w-5 h-5" />
				</button>
			</div>

			<form
				method="POST"
				action="?/updateAnggota"
				use:enhance={() => {
					isEditAnggotaSubmitting = true;
					return async ({ update }) => {
						await update();
						isEditAnggotaSubmitting = false;
						closeEditAnggotaModal();
					};
				}}
				class="space-y-4 text-xs"
			>
				<input type="hidden" name="anggotaId" value={editingAnggota.id} />

				<!-- Status Khusus Admin: Isrun & Keaktifan Jamaah -->
				<div class="p-3 bg-primary/5 border border-primary/20 rounded-xl space-y-3">
					<p class="font-bold text-foreground text-[11px] uppercase tracking-wider text-primary">
						Status Khusus Wewenang Admin
					</p>
					<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
						<!-- Keaktifan Jamaah -->
						<div>
							<label for="edit-statusJamaah" class="block font-semibold text-foreground mb-1">
								Status Keaktifan Jamaah *
							</label>
							<select
								id="edit-statusJamaah"
								name="statusJamaah"
								bind:value={editAnggotaStatusJamaah}
								class="w-full bg-card border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:ring-1 focus:ring-primary"
							>
								<option value="Aktif">🟢 Aktif</option>
								<option value="Tidak Aktif">🔴 Tidak Aktif</option>
							</select>
						</div>

						<!-- Checklist Isrun -->
						<div>
							<label class="block font-semibold text-foreground mb-1">
								Checklist Isrun *
							</label>
							<label class="flex items-center gap-2.5 p-2 rounded-lg bg-card border border-border cursor-pointer hover:bg-secondary/50 transition-colors">
								<input
									type="checkbox"
									bind:checked={editAnggotaIsrun}
									class="w-4 h-4 rounded text-primary focus:ring-primary border-border cursor-pointer"
								/>
								<span class="text-xs font-medium text-foreground">
									{editAnggotaIsrun ? 'Jamaah Isrun (Ya)' : 'Bukan Isrun (Tidak)'}
								</span>
							</label>
							<input type="hidden" name="isrun" value={editAnggotaIsrun ? 'Ya' : 'Tidak'} />
						</div>
					</div>
				</div>

				<!-- Data Demografi Utama -->
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
					<div class="sm:col-span-2">
						<label for="edit-namaLengkap" class="block font-semibold text-foreground mb-1">
							Nama Lengkap *
						</label>
						<input
							type="text"
							id="edit-namaLengkap"
							name="namaLengkap"
							bind:value={editAnggotaNama}
							required
							class="w-full bg-secondary/60 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:ring-1 focus:ring-primary"
						/>
					</div>

					<div>
						<label for="edit-nik" class="block font-semibold text-foreground mb-1">
							Nomor Induk Kependudukan (NIK)
						</label>
						<input
							type="text"
							id="edit-nik"
							name="nik"
							bind:value={editAnggotaNik}
							maxlength="16"
							placeholder={editingAnggota.hasNik ? 'Biarkan kosong jika tidak ubah' : '16 digit angka NIK'}
							class="w-full bg-secondary/60 border border-border rounded-lg px-3 py-2 text-xs text-foreground font-mono focus:ring-1 focus:ring-primary"
						/>
						<p class="text-[10px] text-foreground/50 mt-0.5">
							{editingAnggota.hasNik ? `NIK saat ini: ${editingAnggota.nikMasked}` : 'Belum memiliki NIK'}
						</p>
					</div>

					<div>
						<label for="edit-statusHubungan" class="block font-semibold text-foreground mb-1">
							Hubungan dalam Keluarga *
						</label>
						<select
							id="edit-statusHubungan"
							name="statusHubungan"
							bind:value={editAnggotaHubungan}
							required
							class="w-full bg-secondary/60 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:ring-1 focus:ring-primary"
						>
							<option value="Kepala Keluarga">Kepala Keluarga</option>
							<option value="Suami">Suami</option>
							<option value="Istri">Istri</option>
							<option value="Anak">Anak</option>
							<option value="Orang Tua">Orang Tua</option>
							<option value="Mertua">Mertua</option>
							<option value="Famili Lain">Famili Lain</option>
						</select>
					</div>

					<div>
						<label for="edit-jenisKelamin" class="block font-semibold text-foreground mb-1">
							Jenis Kelamin *
						</label>
						<select
							id="edit-jenisKelamin"
							name="jenisKelamin"
							bind:value={editAnggotaJenisKelamin}
							required
							class="w-full bg-secondary/60 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:ring-1 focus:ring-primary"
						>
							<option value="L">Laki-laki (L)</option>
							<option value="P">Perempuan (P)</option>
						</select>
					</div>

					<div>
						<label for="edit-tanggalLahir" class="block font-semibold text-foreground mb-1">
							Tanggal Lahir *
						</label>
						<input
							type="date"
							id="edit-tanggalLahir"
							name="tanggalLahir"
							bind:value={editAnggotaTanggalLahir}
							required
							class="w-full bg-secondary/60 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:ring-1 focus:ring-primary"
						/>
					</div>

					<div>
						<label for="edit-tempatLahir" class="block font-semibold text-foreground mb-1">
							Tempat Lahir
						</label>
						<input
							type="text"
							id="edit-tempatLahir"
							name="tempatLahir"
							bind:value={editAnggotaTempatLahir}
							placeholder="Kota / Kabupaten Lahir"
							class="w-full bg-secondary/60 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:ring-1 focus:ring-primary"
						/>
					</div>

					<div>
						<label for="edit-statusGenerus" class="block font-semibold text-foreground mb-1">
							Status Generus
						</label>
						<select
							id="edit-statusGenerus"
							name="statusGenerus"
							bind:value={editAnggotaStatusGenerus}
							class="w-full bg-secondary/60 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:ring-1 focus:ring-primary"
						>
							<option value="">-- Pilih Status Generus --</option>
							<option value="Paud">Paud</option>
							<option value="Caberawit">Caberawit</option>
							<option value="Pra Remaja">Pra Remaja</option>
							<option value="Remaja">Remaja</option>
							<option value="Pra Nikah">Pra Nikah</option>
							<option value="Usia Nikah">Usia Nikah</option>
							<option value="Dewasa Menikah">Dewasa Menikah</option>
							<option value="Lansia">Lansia</option>
						</select>
					</div>

					<div>
						<label for="edit-statusPernikahan" class="block font-semibold text-foreground mb-1">
							Status Pernikahan
						</label>
						<select
							id="edit-statusPernikahan"
							name="statusPernikahan"
							bind:value={editAnggotaStatusPernikahan}
							class="w-full bg-secondary/60 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:ring-1 focus:ring-primary"
						>
							<option value="">-- Pilih Status Pernikahan --</option>
							<option value="Belum Menikah">Belum Menikah</option>
							<option value="Sudah Menikah">Sudah Menikah</option>
							<option value="Duda">Duda</option>
							<option value="Janda">Janda</option>
						</select>
					</div>

					<div>
						<label for="edit-noTelepon" class="block font-semibold text-foreground mb-1">
							No. HP / WhatsApp
						</label>
						<input
							type="tel"
							id="edit-noTelepon"
							name="noTelepon"
							bind:value={editAnggotaNoTelepon}
							placeholder="Contoh: 08123456789"
							class="w-full bg-secondary/60 border border-border rounded-lg px-3 py-2 text-xs text-foreground font-mono focus:ring-1 focus:ring-primary"
						/>
					</div>

					<div>
						<label for="edit-profesi" class="block font-semibold text-foreground mb-1">
							Profesi / Pekerjaan
						</label>
						<input
							type="text"
							id="edit-profesi"
							name="profesi"
							bind:value={editAnggotaProfesi}
							placeholder="Pekerjaan / Mahasiswa / Wiraswasta"
							class="w-full bg-secondary/60 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:ring-1 focus:ring-primary"
						/>
					</div>

					<div>
						<label for="edit-golonganDarah" class="block font-semibold text-foreground mb-1">
							Golongan Darah
						</label>
						<select
							id="edit-golonganDarah"
							name="golonganDarah"
							bind:value={editAnggotaGolonganDarah}
							class="w-full bg-secondary/60 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:ring-1 focus:ring-primary"
						>
							<option value="">-- Pilih Gol. Darah --</option>
							<option value="A">A</option>
							<option value="B">B</option>
							<option value="AB">AB</option>
							<option value="O">O</option>
							<option value="-">-</option>
						</select>
					</div>
				</div>

				<!-- Tombol Simpan -->
				<div class="flex items-center justify-end gap-2 pt-3 border-t border-border">
					<button
						type="button"
						onclick={closeEditAnggotaModal}
						class="px-4 py-2 rounded-lg border border-border text-foreground hover:bg-secondary font-semibold transition-colors cursor-pointer"
					>
						Batal
					</button>
					<button
						type="submit"
						disabled={isEditAnggotaSubmitting}
						class="px-5 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer disabled:opacity-50"
					>
						{#if isEditAnggotaSubmitting}
							<div class="w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin"></div>
							<span>Menyimpan...</span>
						{:else}
							<CheckCircle2 class="w-3.5 h-3.5" />
							<span>Simpan Perubahan Anggota</span>
						{/if}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- MODAL EDIT DATA KK & DOMISILI -->
{#if editingKeluarga}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-150"
		role="dialog"
		aria-modal="true"
		onclick={(e) => {
			if (e.target === e.currentTarget) closeEditKeluargaModal();
		}}
	>
		<div class="bg-card border border-border rounded-2xl max-w-md w-full p-4 sm:p-6 shadow-2xl space-y-4">
			<div class="flex items-center justify-between pb-3 border-b border-border">
				<div>
					<h3 class="text-sm font-bold text-foreground flex items-center gap-2">
						<Home class="w-4 h-4 text-primary" />
						<span>Ubah Info KK & Domisili</span>
					</h3>
					<p class="text-[11px] text-foreground/60 mt-0.5">
						Perbarui nomor KK, alamat domisili, atau kelompok basis keluarga.
					</p>
				</div>
				<button
					type="button"
					onclick={closeEditKeluargaModal}
					class="p-1 rounded-lg hover:bg-secondary text-foreground/60 hover:text-foreground cursor-pointer"
				>
					<X class="w-5 h-5" />
				</button>
			</div>

			<form
				method="POST"
				action="?/updateKeluarga"
				use:enhance={() => {
					isEditKeluargaSubmitting = true;
					return async ({ update }) => {
						await update();
						isEditKeluargaSubmitting = false;
						closeEditKeluargaModal();
					};
				}}
				class="space-y-3.5 text-xs"
			>
				<input type="hidden" name="keluargaId" value={editingKeluarga.id} />

				{#if editingKeluarga.isKk}
					<div>
						<label for="edit-noKk" class="block font-semibold text-foreground mb-1">
							Nomor Kartu Keluarga (16 Digit)
						</label>
						<input
							type="text"
							id="edit-noKk"
							name="noKk"
							bind:value={editKeluargaNoKk}
							maxlength="16"
							placeholder="Biarkan kosong jika tidak ingin ubah"
							class="w-full bg-secondary/60 border border-border rounded-lg px-3 py-2 text-xs text-foreground font-mono focus:ring-1 focus:ring-primary"
						/>
						<p class="text-[10px] text-foreground/50 mt-0.5">
							Nomor KK saat ini: {editingKeluarga.noKkMasked}
						</p>
					</div>
				{/if}

				<div>
					<label for="edit-alamatLengkap" class="block font-semibold text-foreground mb-1">
						Alamat Lengkap Domisili
					</label>
					<textarea
						id="edit-alamatLengkap"
						name="alamatLengkap"
						bind:value={editKeluargaAlamat}
						rows="3"
						placeholder="Jl. Mawar No. 12, RT 01/RW 02..."
						class="w-full bg-secondary/60 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:ring-1 focus:ring-primary"
					></textarea>
				</div>

				<div>
					<label for="edit-kelompokId" class="block font-semibold text-foreground mb-1">
						Kelompok Basis Wilayah
					</label>
					<select
						id="edit-kelompokId"
						name="kelompokId"
						bind:value={editKeluargaKelompokId}
						class="w-full bg-secondary/60 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:ring-1 focus:ring-primary"
					>
						{#each (data.wilayahOptions.kelompokList || []) as k}
							<option value={k.id}>
								{k.nama} ({k.desaNama} - {k.daerahNama})
							</option>
						{/each}
					</select>
				</div>

				<div class="flex items-center justify-end gap-2 pt-3 border-t border-border">
					<button
						type="button"
						onclick={closeEditKeluargaModal}
						class="px-4 py-2 rounded-lg border border-border text-foreground hover:bg-secondary font-semibold transition-colors cursor-pointer"
					>
						Batal
					</button>
					<button
						type="submit"
						disabled={isEditKeluargaSubmitting}
						class="px-5 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer disabled:opacity-50"
					>
						{#if isEditKeluargaSubmitting}
							<div class="w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin"></div>
							<span>Menyimpan...</span>
						{:else}
							<CheckCircle2 class="w-3.5 h-3.5" />
							<span>Simpan Perubahan KK</span>
						{/if}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- MODAL BUAT AKUN MANDIRI UNTUK ANGGOTA -->
{#if memberForAccount}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
		role="dialog"
		aria-modal="true"
	>
		<div class="bg-card border border-border rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4">
			<div class="flex items-center justify-between border-b border-border pb-3">
				<div>
					<h3 class="text-sm font-bold text-foreground">Buat Akun Login Mandiri</h3>
					<p class="text-[11px] text-foreground/60 mt-0.5">
						Anggota tetap terikat pada KK, namun kini bisa login sendiri.
					</p>
				</div>
				<button
					type="button"
					onclick={() => (memberForAccount = null)}
					class="text-foreground/50 hover:text-foreground text-sm font-semibold"
				>
					✕
				</button>
			</div>

			<form
				method="POST"
				action="?/createMemberAccount"
				use:enhance={() => {
					isAccountSubmitting = true;
					return async ({ update }) => {
						isAccountSubmitting = false;
						await update();
						memberForAccount = null;
					};
				}}
				class="space-y-3 text-xs"
			>
				<input type="hidden" name="anggotaId" value={memberForAccount.id} />

				<div class="p-2.5 rounded-lg bg-secondary/40 border border-border space-y-0.5">
					<span class="block text-[10px] text-foreground/50 font-medium uppercase">Nama Anggota:</span>
					<span class="font-bold text-foreground text-xs">{memberForAccount.namaLengkap}</span>
					<span class="text-[11px] text-primary block">({memberForAccount.statusHubungan})</span>
				</div>

				<div>
					<label for="accEmail" class="block font-medium text-foreground/80 mb-1">
						Email Login (Opsional)
					</label>
					<input
						id="accEmail"
						name="email"
						type="email"
						bind:value={newAccountEmail}
						placeholder="contoh@domain.com"
						class="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:ring-1 focus:ring-primary"
					/>
				</div>

				<div>
					<label for="accPhone" class="block font-medium text-foreground/80 mb-1">
						Nomor HP / WhatsApp (Bisa untuk Login)
					</label>
					<input
						id="accPhone"
						name="noTelepon"
						type="text"
						bind:value={newAccountPhone}
						placeholder="0812xxxx"
						class="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground focus:ring-1 focus:ring-primary"
					/>
				</div>

				<div>
					<label for="accPass" class="block font-medium text-foreground/80 mb-1">
						Kata Sandi Akun *
					</label>
					<input
						id="accPass"
						name="password"
						type="text"
						required
						minlength="6"
						bind:value={newAccountPassword}
						placeholder="Minimal 6 karakter"
						class="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground focus:ring-1 focus:ring-primary"
					/>
				</div>

				<div class="flex gap-2 pt-2">
					<button
						type="button"
						onclick={() => (memberForAccount = null)}
						class="flex-1 py-2 rounded-lg border border-border bg-secondary/60 hover:bg-secondary text-foreground font-semibold"
					>
						Batal
					</button>
					<button
						type="submit"
						disabled={isAccountSubmitting}
						class="flex-1 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold disabled:opacity-50"
					>
						{isAccountSubmitting ? 'Memproses...' : 'Buat Akun'}
					</button>
				</div>
			</form>
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
