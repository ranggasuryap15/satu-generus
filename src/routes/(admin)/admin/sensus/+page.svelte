<!--
  @file src/routes/(admin)/admin/sensus/+page.svelte
  @purpose Rekapitulasi sensus Kartu Keluarga & Jamaah Mandiri, pagination tabel/kartu data, dashboard statistik, penugasan dapukan pengurus KK, modal detail lengkap (hapus sensus, pindah kelompok, toggle status jamaah), modal edit anggota/KK, dan pembuatan akun dengan retensi scroll (mencegah loncat ke atas)
  @usedBy Route admin '/admin/sensus'
  @dependencies @lucide/svelte, Svelte 5 Runes, $lib/components/SearchableSelect.svelte, $lib/components/DateInput.svelte, $lib/components/Pagination.svelte, $lib/confirm.svelte, $lib/keepScroll.ts (keepScrollSubmit), $lib/utils (formatDateDDMMYYYY), $lib/generus (isStatusHubunganMenikah, hitungUmur, hitungStatusGenerus, resolveStatusPernikahan, isStatusGenerusBelumMenikah, resolvePernikahanFromGenerus, DAFTAR_STATUS_GENERUS)
  @publicFunctions openDetailModal, closeDetailModal, requestUnmask, openCreateModal, closeCreateModal, openAddMemberModal, closeAddMemberModal, openCreateAccountModal, openEditAnggotaModal, closeEditAnggotaModal, openEditKeluargaModal, closeEditKeluargaModal, openPindahKelompokModal, closePindahKelompokModal, openAssignDapukanModal, closeAssignDapukanModal, handleHapusSensus, handleToggleStatusJamaah, resetFilters, toggleMobileFilter
  @sideEffects Menampilkan metrik, unmask data sensitif, submit actions (createSensus, addAnggotaKeluarga, updateAnggota, updateKeluarga, deleteSensus, pindahKelompok, toggleStatusJamaah, createMemberAccount, assignDapukan) dengan retensi posisi scroll
-->
<script lang="ts">
	import DateInput from '$lib/components/DateInput.svelte';
	import SearchableSelect from '$lib/components/SearchableSelect.svelte';
	import Pagination from '$lib/components/Pagination.svelte';
	import { formatDateDDMMYYYY } from '$lib/utils';
	import { keepScrollSubmit } from '$lib/keepScroll';
	import {
		isStatusHubunganMenikah,
		hitungUmur,
		hitungStatusGenerus,
		resolveStatusPernikahan,
		isStatusGenerusBelumMenikah,
		resolvePernikahanFromGenerus,
		DAFTAR_STATUS_GENERUS
	} from '$lib/generus';
	import {
	  AlertCircle,
	  ArrowRightLeft,
	  Award,
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
	  UserX,
	  X
	} from '@lucide/svelte';
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';
	import { confirmAction } from '$lib/confirm.svelte';

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
	let selectedKeluargaId = $state<string | null>(null);
	const selectedKeluarga = $derived(
		selectedKeluargaId
			? (data.daftarKeluarga || []).find((item: (typeof data.daftarKeluarga)[number]) => item.id === selectedKeluargaId) || null
			: null
	);

	function openDetailModal(k: (typeof data.daftarKeluarga)[number]) {
		selectedKeluargaId = k.id;
	}

	function closeDetailModal() {
		selectedKeluargaId = null;
	}

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
		editAnggotaStatusPernikahan = (a as any).statusPernikahanRaw || (a.statusPernikahan !== '-' ? a.statusPernikahan : '');
		if (!editAnggotaStatusPernikahan && isStatusHubunganMenikah(editAnggotaHubungan)) {
			editAnggotaStatusPernikahan = 'Sudah Menikah';
		}
		editAnggotaStatusGenerus = (a as any).statusGenerusRaw || (a.statusGenerus !== '-' ? a.statusGenerus : '');
		if (!editAnggotaStatusGenerus && editAnggotaTanggalLahir) {
			editAnggotaStatusGenerus = hitungStatusGenerus(
				hitungUmur(editAnggotaTanggalLahir),
				editAnggotaStatusPernikahan || 'Belum Menikah'
			);
		}
		editAnggotaStatusJamaah = a.statusJamaah || 'Aktif';
		editAnggotaIsrun = a.isrun === 'Ya';
		editAnggotaGolonganDarah = (a as any).golonganDarahRaw || (a.golonganDarah !== '-' ? a.golonganDarah : '');
	}

	function onEditAnggotaHubunganChange() {
		if (isStatusHubunganMenikah(editAnggotaHubungan)) {
			if (!editAnggotaStatusPernikahan || editAnggotaStatusPernikahan === 'Belum Menikah') {
				editAnggotaStatusPernikahan = 'Sudah Menikah';
			}
			if (editAnggotaHubungan === 'Kepala Keluarga' || editAnggotaHubungan === 'Suami') {
				editAnggotaJenisKelamin = 'L';
			} else if (editAnggotaHubungan === 'Istri') {
				editAnggotaJenisKelamin = 'P';
			}
		}
		if (editAnggotaHubungan === 'Kepala Keluarga' && (selectedKeluarga?.isKk ?? true)) {
			editAnggotaIsrun = true;
		}
		if (editAnggotaTanggalLahir) {
			editAnggotaStatusGenerus = hitungStatusGenerus(
				hitungUmur(editAnggotaTanggalLahir),
				editAnggotaStatusPernikahan || 'Belum Menikah'
			);
		}
	}

	function onEditAnggotaStatusGenerusChange() {
		if (isStatusGenerusBelumMenikah(editAnggotaStatusGenerus)) {
			editAnggotaStatusPernikahan = 'Belum Menikah';
			const s = editAnggotaStatusGenerus.trim().toLowerCase();
			if (s === 'paud' || s === 'caberawit' || s === 'pra remaja' || s === 'remaja') {
				if (isStatusHubunganMenikah(editAnggotaHubungan)) {
					editAnggotaHubungan = 'Anak';
				}
			}
		} else if (editAnggotaStatusGenerus === 'Dewasa Menikah') {
			editAnggotaStatusPernikahan = 'Sudah Menikah';
		}
	}

	function onEditAnggotaStatusPernikahanChange() {
		if (editAnggotaStatusPernikahan === 'Sudah Menikah') {
			if (isStatusGenerusBelumMenikah(editAnggotaStatusGenerus)) {
				const umur = editAnggotaTanggalLahir ? hitungUmur(editAnggotaTanggalLahir) : 0;
				editAnggotaStatusGenerus = hitungStatusGenerus(umur, 'Sudah Menikah');
			}
		} else if (editAnggotaStatusPernikahan === 'Belum Menikah') {
			if (editAnggotaStatusGenerus === 'Dewasa Menikah') {
				const umur = editAnggotaTanggalLahir ? hitungUmur(editAnggotaTanggalLahir) : 0;
				editAnggotaStatusGenerus = hitungStatusGenerus(umur, 'Belum Menikah');
			}
		}
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

	// State Modal Pindah Kelompok Sensus
	let pindahKelompokTarget = $state<(typeof data.daftarKeluarga)[number] | null>(null);
	let pindahTargetKelompokId = $state<number | string>('');
	let isPindahKelompokSubmitting = $state(false);

	function openPindahKelompokModal(k: (typeof data.daftarKeluarga)[number]) {
		pindahKelompokTarget = k;
		pindahTargetKelompokId = k.kelompokId || (data.wilayahOptions.kelompokList[0]?.id ?? '');
	}

	function closePindahKelompokModal() {
		pindahKelompokTarget = null;
	}

	// Form References untuk Aksi Admin Cepat
	let deleteSensusForm: HTMLFormElement | null = $state(null);
	let deleteTargetKeluargaId = $state('');

	async function handleHapusSensus(k: (typeof data.daftarKeluarga)[number]) {
		const label = k.isKk
			? `Kartu Keluarga (${k.noKkMasked}) atas nama "${k.kepalaKeluargaNama}"`
			: `Sensus Mandiri atas nama "${k.kepalaKeluargaNama}"`;

		const ok = await confirmAction({
			title: 'Hapus Data Sensus?',
			message: `Apakah Anda yakin ingin menghapus data ${label} beserta seluruh ${k.anggota.length} jiwa di dalamnya? Tindakan ini permanen dan menghapus data dari seluruh riwayat sensus.`,
			confirmText: 'Ya, Hapus Sensus',
			cancelText: 'Batal',
			variant: 'danger'
		});

		if (ok) {
			deleteTargetKeluargaId = k.id;
			if (selectedKeluargaId === k.id) {
				closeDetailModal();
			}
			setTimeout(() => {
				deleteSensusForm?.requestSubmit();
			}, 30);
		}
	}

	let toggleStatusForm: HTMLFormElement | null = $state(null);
	let toggleTargetAnggotaId = $state('');
	let toggleTargetStatus = $state<'Aktif' | 'Tidak Aktif'>('Aktif');

	async function handleToggleStatusJamaah(
		a: (typeof data.daftarKeluarga)[0]['anggota'][0],
		newStatus: 'Aktif' | 'Tidak Aktif'
	) {
		const isDeactivating = newStatus === 'Tidak Aktif';
		const ok = await confirmAction({
			title: isDeactivating ? 'Nonaktifkan Jamaah?' : 'Aktifkan Kembali Jamaah?',
			message: isDeactivating
				? `Apakah Anda yakin ingin menonaktifkan status jamaah "${a.namaLengkap}" (${a.statusHubungan}) dari KK ini?`
				: `Apakah Anda yakin ingin mengaktifkan kembali status jamaah "${a.namaLengkap}" (${a.statusHubungan})?`,
			confirmText: isDeactivating ? 'Ya, Nonaktifkan' : 'Ya, Aktifkan',
			cancelText: 'Batal',
			variant: isDeactivating ? 'warning' : 'primary'
		});

		if (ok) {
			toggleTargetAnggotaId = a.id;
			toggleTargetStatus = newStatus;
			setTimeout(() => {
				toggleStatusForm?.requestSubmit();
			}, 30);
		}
	}

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
	let newTempatLahirMandiri = $state('');
	let newTanggalLahirMandiri = $state('');
	let newJenisKelaminMandiri = $state('Laki-laki');
	let newStatusPernikahanMandiri = $state('Belum Menikah');
	let newStatusGenerusMandiri = $state('');
	let lastCalculatedMandiriTgl = '';
	let lastCalculatedMandiriPernikahan = '';

	$effect(() => {
		if (
			newTanggalLahirMandiri !== lastCalculatedMandiriTgl ||
			newStatusPernikahanMandiri !== lastCalculatedMandiriPernikahan
		) {
			lastCalculatedMandiriTgl = newTanggalLahirMandiri;
			lastCalculatedMandiriPernikahan = newStatusPernikahanMandiri;
			if (newTanggalLahirMandiri) {
				const umur = hitungUmur(newTanggalLahirMandiri);
				newStatusGenerusMandiri = hitungStatusGenerus(umur, newStatusPernikahanMandiri);
			} else {
				newStatusGenerusMandiri = '';
			}
		}
	});

	interface NewAnggotaRow {
		_rowId?: string;
		namaLengkap: string;
		nik: string;
		statusHubungan: string;
		tempatLahir: string;
		tanggalLahir: string;
		jenisKelamin: string;
		statusPernikahan: string;
		statusGenerus: string;
		isrun?: string;
		_lastTglLahir?: string;
		_lastStatusHubungan?: string;
		_lastStatusPernikahan?: string;
	}
	let rowCounter = 0;
	function createEmptyAnggotaRow(statusHubungan: string = 'Anak'): NewAnggotaRow {
		rowCounter += 1;
		const jenisKelamin = statusHubungan === 'Istri' ? 'Perempuan' : 'Laki-laki';
		const statusPernikahan = isStatusHubunganMenikah(statusHubungan) ? 'Sudah Menikah' : 'Belum Menikah';
		return {
			_rowId: `row-${Date.now()}-${rowCounter}`,
			namaLengkap: '',
			nik: '',
			statusHubungan,
			tempatLahir: '',
			tanggalLahir: '',
			jenisKelamin,
			statusPernikahan,
			statusGenerus: '',
			isrun: statusHubungan === 'Kepala Keluarga' ? 'Ya' : 'Tidak',
			_lastTglLahir: '',
			_lastStatusHubungan: statusHubungan,
			_lastStatusPernikahan: statusPernikahan
		};
	}
	let newAnggotaList = $state<NewAnggotaRow[]>([
		createEmptyAnggotaRow('Kepala Keluarga')
	]);

	function updateAnggotaGenerus(row: NewAnggotaRow) {
		if (row.tanggalLahir) {
			const umur = hitungUmur(row.tanggalLahir);
			const pernikahan = resolveStatusPernikahan(row.statusHubungan, row.statusPernikahan);
			row.statusGenerus = hitungStatusGenerus(umur, pernikahan);
		} else {
			row.statusGenerus = '';
		}
	}

	// Sinkronisasi otomatis Kepala Keluarga (Anggota #1) dengan Akun Jamaah di Bagian 1
	$effect(() => {
		if (newTipeSensus === 'keluarga' && newAnggotaList.length > 0) {
			if (newAnggotaList[0].namaLengkap !== newNamaLengkap) {
				newAnggotaList[0].namaLengkap = newNamaLengkap;
			}
			if (newAnggotaList[0].statusHubungan !== 'Kepala Keluarga') {
				newAnggotaList[0].statusHubungan = 'Kepala Keluarga';
			}
			if (newAnggotaList[0].jenisKelamin !== 'Laki-laki') {
				newAnggotaList[0].jenisKelamin = 'Laki-laki';
			}
			if (!newAnggotaList[0].statusPernikahan) {
				newAnggotaList[0].statusPernikahan = 'Sudah Menikah';
			}
		}
	});

	// Sinkronisasi otomatis Umur & Status Generus setiap anggota keluarga
	$effect(() => {
		for (const row of newAnggotaList) {
			if (
				row.tanggalLahir !== row._lastTglLahir ||
				row.statusHubungan !== row._lastStatusHubungan ||
				row.statusPernikahan !== row._lastStatusPernikahan
			) {
				row._lastTglLahir = row.tanggalLahir;
				row._lastStatusHubungan = row.statusHubungan;
				row._lastStatusPernikahan = row.statusPernikahan;
				updateAnggotaGenerus(row);
			}
		}
	});

	// State Modal Tambah Anggota ke KK yang Ada
	let showAddMemberModal = $state(false);
	let targetKeluargaForMember = $state<(typeof data.daftarKeluarga)[0] | null>(null);
	let memberNamaLengkap = $state('');
	let memberNik = $state('');
	let memberStatus = $state('Anak');
	let memberTempatLahir = $state('');
	let memberTanggalLahir = $state('');
	let memberJenisKelamin = $state('Laki-laki');
	let memberStatusGenerus = $state('');
	let lastCalculatedTanggalLahir = '';

	const memberUmur = $derived(memberTanggalLahir ? hitungUmur(memberTanggalLahir) : 0);

	function onMemberStatusChange() {
		if (memberStatus === 'Kepala Keluarga' || memberStatus === 'Suami') {
			memberJenisKelamin = 'Laki-laki';
		} else if (memberStatus === 'Istri') {
			memberJenisKelamin = 'Perempuan';
		}
		if (memberTanggalLahir) {
			const umur = hitungUmur(memberTanggalLahir);
			const pernikahan = resolveStatusPernikahan(memberStatus);
			memberStatusGenerus = hitungStatusGenerus(umur, pernikahan);
		}
	}

	$effect(() => {
		if (memberTanggalLahir !== lastCalculatedTanggalLahir) {
			lastCalculatedTanggalLahir = memberTanggalLahir;
			if (memberTanggalLahir) {
				const umur = hitungUmur(memberTanggalLahir);
				const pernikahan = resolveStatusPernikahan(memberStatus);
				memberStatusGenerus = hitungStatusGenerus(umur, pernikahan);
			} else {
				memberStatusGenerus = '';
			}
		}
	});

	function onNewAnggotaStatusChange(idx: number) {
		const row = newAnggotaList[idx];
		if (!row) return;
		if (row.statusHubungan === 'Kepala Keluarga' || row.statusHubungan === 'Suami') {
			row.jenisKelamin = 'Laki-laki';
			row.statusPernikahan = 'Sudah Menikah';
		} else if (row.statusHubungan === 'Istri') {
			row.jenisKelamin = 'Perempuan';
			row.statusPernikahan = 'Sudah Menikah';
		}
		updateAnggotaGenerus(row);
	}

	function onMemberStatusGenerusChange() {
		if (isStatusGenerusBelumMenikah(memberStatusGenerus)) {
			const s = memberStatusGenerus.trim().toLowerCase();
			if (s === 'paud' || s === 'caberawit' || s === 'pra remaja' || s === 'remaja') {
				if (isStatusHubunganMenikah(memberStatus)) {
					memberStatus = 'Anak';
					memberJenisKelamin = 'Laki-laki';
				}
			}
		}
	}

	function onNewAnggotaGenerusChange(idx: number) {
		const row = newAnggotaList[idx];
		if (!row) return;
		if (isStatusGenerusBelumMenikah(row.statusGenerus)) {
			row.statusPernikahan = 'Belum Menikah';
			const s = row.statusGenerus.trim().toLowerCase();
			if (s === 'paud' || s === 'caberawit' || s === 'pra remaja' || s === 'remaja') {
				if (idx > 0 && isStatusHubunganMenikah(row.statusHubungan)) {
					row.statusHubungan = 'Anak';
					row.jenisKelamin = 'Laki-laki';
				}
			}
		} else if (row.statusGenerus === 'Dewasa Menikah') {
			row.statusPernikahan = 'Sudah Menikah';
		}
	}

	function onNewMandiriGenerusChange() {
		if (isStatusGenerusBelumMenikah(newStatusGenerusMandiri)) {
			newStatusPernikahanMandiri = 'Belum Menikah';
		} else if (newStatusGenerusMandiri === 'Dewasa Menikah') {
			newStatusPernikahanMandiri = 'Sudah Menikah';
		}
	}

	// State Modal Tugaskan Pengurus / Beri Dapukan
	let showAssignDapukanModal = $state(false);
	let targetKeluargaForDapukan = $state<(typeof data.daftarKeluarga)[0] | null>(null);
	let assignUserId = $state<string>('');
	let assignTipeDapukan = $state<'tetap' | 'custom'>('tetap');
	let assignDapukanId = $state<string | number>('');
	let assignNamaDapukanCustom = $state('');
	let assignScope = $state<'Pusat' | 'Daerah' | 'Desa' | 'Kelompok'>('Kelompok');
	let assignKelompokId = $state<string | number>('');
	let assignDesaId = $state<string | number>('');
	let assignDaerahId = $state<string | number>('');

	const masterDapukanOptions = $derived(
		(data.masterDapukan || [])
			.filter((m: any) => {
				if (assignScope === 'Pusat') {
					return !m.is4S || m.namaDapukan === 'Superadmin';
				}
				return m.namaDapukan !== 'Admin Pusat';
			})
			.map((m: any) => ({
				value: m.id,
				label: m.namaDapukan,
				sublabel: m.is4S ? '4S' : undefined
			}))
	);

	const assignKelompokOptions = $derived.by(() => {
		if (targetKeluargaForDapukan?.kelompokId) {
			return [
				{
					value: targetKeluargaForDapukan.kelompokId,
					label: targetKeluargaForDapukan.kelompokNama,
					sublabel: 'Terkunci: Basis KK'
				}
			];
		}
		return (data.wilayahOptions.kelompokList || []).map((k: any) => ({ value: k.id, label: k.nama }));
	});

	const assignDesaOptions = $derived.by(() => {
		if (targetKeluargaForDapukan?.desaId) {
			return [
				{
					value: targetKeluargaForDapukan.desaId,
					label: targetKeluargaForDapukan.desaNama,
					sublabel: 'Terkunci: Basis KK'
				}
			];
		}
		return (data.wilayahOptions.desaList || []).map((d: any) => ({ value: d.id, label: d.nama }));
	});

	const assignDaerahOptions = $derived.by(() => {
		if (targetKeluargaForDapukan?.daerahId) {
			return [
				{
					value: targetKeluargaForDapukan.daerahId,
					label: targetKeluargaForDapukan.daerahNama,
					sublabel: 'Terkunci: Basis KK'
				}
			];
		}
		return (data.wilayahOptions.daerahList || []).map((dr: any) => ({ value: dr.id, label: dr.nama }));
	});

	function openAssignDapukanModal(k: (typeof data.daftarKeluarga)[number], preselectedUserId?: string) {
		if (!data.canManageDapukan) return;
		targetKeluargaForDapukan = k;
		const accounts = k.akunList || [];
		if (preselectedUserId) {
			assignUserId = preselectedUserId;
		} else if (accounts.length > 0) {
			assignUserId = accounts[0].userId;
		} else {
			assignUserId = '';
		}

		assignTipeDapukan = 'tetap';
		assignDapukanId = '';
		assignNamaDapukanCustom = '';
		assignScope = 'Kelompok';
		assignKelompokId = k.kelompokId || '';
		assignDesaId = k.desaId || '';
		assignDaerahId = k.daerahId || '';
		showAssignDapukanModal = true;
	}

	function closeAssignDapukanModal() {
		showAssignDapukanModal = false;
		targetKeluargaForDapukan = null;
		assignUserId = '';
	}

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

	// Opsi Pilihan Kelompok saat Pindah Kelompok Sensus
	const pindahKelompokOptions = $derived(
		(data.wilayahOptions.kelompokList || []).map((k: (typeof data.wilayahOptions.kelompokList)[number]) => ({
			value: k.id,
			label: k.nama,
			sublabel: `${k.desaNama ? `Desa ${k.desaNama}` : ''}${k.daerahNama ? ` • ${k.daerahNama}` : ''}`
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

	// Pagination State
	let currentPage = $state(1);
	let pageSize = $state(10);

	$effect(() => {
		// Reset halaman ke 1 saat filter atau pencarian berubah
		searchQuery;
		filterDaerahId;
		filterDesaId;
		filterKelompokId;
		filterPeran;
		filterTipeSensus;
		currentPage = 1;
	});

	let paginatedKeluarga = $derived(
		filteredKeluarga.slice((currentPage - 1) * pageSize, currentPage * pageSize)
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
				newTempatLahirMandiri.trim() ||
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
			newAnggotaList[0]?.tempatLahir?.trim() ||
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
		newTempatLahirMandiri = '';
		newTanggalLahirMandiri = '';
		newJenisKelaminMandiri = 'Laki-laki';
		newStatusPernikahanMandiri = 'Belum Menikah';
		newStatusGenerusMandiri = '';
		newAnggotaList = [
			createEmptyAnggotaRow('Kepala Keluarga')
		];
	}

	function openCreateModal() {
		// Buka modal tanpa menghapus draf isian yang sedang diketik
		showCreateModal = true;
	}

	async function closeCreateModal() {
		if (isCreateFormDirty()) {
			const ok = await confirmAction({
				title: 'Tutup Formulir Sensus?',
				message:
					'Ada data sensus yang sudah Anda isi. Yakin ingin menutup modal? Isian Anda akan tetap tersimpan sebagai draf.',
				confirmText: 'Ya, Tutup Modal',
				cancelText: 'Lanjut Mengisi',
				variant: 'warning'
			});
			if (!ok) {
				return;
			}
		}
		showCreateModal = false;
	}

	function addAnggotaRow() {
		// Jika baru ada Kepala Keluarga (1 anggota), baris baru otomatis defaultnya adalah 'Istri'
		const defaultHubungan = newAnggotaList.length === 1 ? 'Istri' : 'Anak';
		newAnggotaList = [
			...newAnggotaList,
			createEmptyAnggotaRow(defaultHubungan)
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
			memberTempatLahir.trim() ||
			memberTanggalLahir
		);
	}

	function resetAddMemberForm() {
		memberNamaLengkap = '';
		memberNik = '';
		memberStatus = 'Anak';
		memberTempatLahir = '';
		memberTanggalLahir = '';
		memberJenisKelamin = 'Laki-laki';
		memberStatusGenerus = '';
		lastCalculatedTanggalLahir = '';
	}

	function openAddMemberModal(k: (typeof data.daftarKeluarga)[number]) {
		if (targetKeluargaForMember?.id !== k.id) {
			resetAddMemberForm();
		}
		targetKeluargaForMember = k;
		showAddMemberModal = true;
	}

	async function closeAddMemberModal() {
		if (isAddMemberFormDirty()) {
			const ok = await confirmAction({
				title: 'Tutup Formulir Anggota?',
				message:
					'Ada data anggota yang sudah Anda isi. Yakin ingin menutup modal? Isian Anda akan tetap tersimpan sebagai draf.',
				confirmText: 'Ya, Tutup Modal',
				cancelText: 'Lanjut Mengisi',
				variant: 'warning'
			});
			if (!ok) {
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
			showAssignDapukanModal = false;
			targetKeluargaForDapukan = null;
			assignUserId = '';
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
				{#if data.adminScope}
					<span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20">
						Scope {data.adminScope?.level ?? ''}
					</span>
				{/if}
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

	<!-- 3. PRESENTASI DATA SENSUS: COMPACT CARDS DI MOBILE (< md), TABEL LENGKAP DI DESKTOP (>= md) -->
	{#if filteredKeluarga.length === 0}
		<div class="bg-card border border-border rounded-2xl p-12 text-center text-foreground/40">
			<div class="flex flex-col items-center justify-center gap-2">
				<Users class="w-8 h-8 opacity-40" />
				<span class="text-sm">Tidak ada data sensus yang sesuai filter.</span>
			</div>
		</div>
	{:else}
		<!-- 1. Tampilan Mobile: Compact Cards -->
		<div class="md:hidden space-y-3">
			{#each paginatedKeluarga as k}
				<div class="bg-card border border-border rounded-xl p-3.5 shadow-xs space-y-3">
					<!-- Header Kartu: Nama & Badge -->
					<div class="flex items-start justify-between gap-2">
						<div class="min-w-0">
							<div class="flex items-center gap-1.5 flex-wrap">
								<h3 class="text-sm font-semibold text-foreground truncate">{k.kepalaKeluargaNama}</h3>
								{#if !k.isKk}
									<span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
										Mandiri
									</span>
								{/if}
								{#if k.is4S}
									<span class="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
										4S{k.dapukanNama ? ` • ${k.dapukanNama}` : ''}
									</span>
								{:else if k.isPengurus}
									<span class="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
										Pengurus{k.dapukanNama ? ` • ${k.dapukanNama}` : ''}
									</span>
								{/if}
							</div>
							{#if k.kepalaKeluargaEmail}
								<p class="text-xs text-foreground/50 truncate mt-0.5">{k.kepalaKeluargaEmail}</p>
							{/if}
						</div>

						<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-secondary text-foreground/80 shrink-0">
							<Users class="w-3.5 h-3.5" />
							{k.jumlahAnggota} Jiwa
						</span>
					</div>

					<!-- No. KK & Unmask -->
					<div class="pt-1 border-t border-border/50 text-xs flex items-center justify-between gap-2">
						<div class="flex items-center gap-1.5 min-w-0 font-mono">
							{#if k.isKk}
								<span class="px-1.5 py-0.5 rounded text-xs font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400">
									KK
								</span>
								<span class="truncate">{k.noKkMasked}</span>
								{#if k.noKkMasked !== 'Belum Ada No. KK'}
									<button
										type="button"
										onclick={() => requestUnmask({ keluargaId: k.id, label: `No. KK (${k.kepalaKeluargaNama})` })}
										class="text-primary hover:text-primary/80 p-1 rounded hover:bg-primary/10 transition-colors shrink-0"
										title="Buka Enkripsi No. KK"
									>
										<Eye class="w-3.5 h-3.5" />
									</button>
								{/if}
							{:else}
								<span class="text-xs font-medium text-foreground/60">Perorangan / Perantau</span>
							{/if}
						</div>

						<div class="text-xs text-foreground/70 truncate text-right">
							{k.kelompokNama}
						</div>
					</div>

					<!-- Alamat Domisili -->
					{#if k.alamatLengkap}
						<p class="text-xs text-foreground/60 truncate">
							{k.alamatLengkap}
						</p>
					{/if}

					<!-- Tombol Aksi Thumb-Friendly -->
					<div class="flex items-center gap-1.5 pt-1 border-t border-border/50">
						{#if k.isKk}
							<button
								type="button"
								onclick={() => openAddMemberModal(k)}
								class="flex-1 inline-flex items-center justify-center gap-1 py-2 px-2.5 rounded-xl border border-border hover:bg-secondary text-foreground text-xs font-semibold transition-colors cursor-pointer"
							>
								<UserPlus class="w-3.5 h-3.5 text-primary" />
								<span>+ Anggota</span>
							</button>
						{/if}

						<button
							type="button"
							onclick={() => openDetailModal(k)}
							class="flex-1 py-2 px-2.5 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground font-semibold text-xs transition-colors border border-border/60 text-center cursor-pointer"
						>
							Detail
						</button>

						{#if k.akunList && k.akunList.length > 0 && data.canManageDapukan}
							<button
								type="button"
								onclick={() => openAssignDapukanModal(k)}
								class="p-2 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-colors cursor-pointer"
								title={k.akunList.length > 1 ? `Tugaskan Dapukan (${k.akunList.length} Akun)` : "Tugaskan Pengurus / Beri Dapukan"}
							>
								<Award class="w-4 h-4" />
							</button>
						{/if}

						<button
							type="button"
							onclick={() => openPindahKelompokModal(k)}
							class="p-2 rounded-xl border border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 transition-colors cursor-pointer"
							title="Pindahkan Sensus ke Kelompok Lain"
						>
							<ArrowRightLeft class="w-4 h-4" />
						</button>

						<button
							type="button"
							onclick={() => handleHapusSensus(k)}
							class="p-2 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors cursor-pointer"
							title="Hapus Data Sensus"
						>
							<Trash2 class="w-4 h-4" />
						</button>
					</div>
				</div>
			{/each}

			<div class="rounded-xl border border-border overflow-hidden">
				<Pagination bind:currentPage bind:pageSize totalItems={filteredKeluarga.length} />
			</div>
		</div>

		<!-- 2. Tampilan Desktop: Tabel Lengkap -->
		<div class="hidden md:block bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
			<div class="overflow-x-auto">
				<table class="w-full text-left text-sm text-foreground/80">
					<thead class="bg-secondary/40 text-foreground/60 uppercase text-xs tracking-wider border-b border-border">
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
						{#each paginatedKeluarga as k}
							<tr class="hover:bg-secondary/20 transition-colors">
								<!-- No. KK / Tipe Sensus dengan Unmask Eye -->
								<td class="py-3.5 px-4 font-mono font-medium text-foreground">
									<div class="flex items-center gap-1.5 flex-wrap">
										{#if k.isKk}
											<span class="px-2 py-0.5 rounded text-xs font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
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
											<span class="px-2 py-0.5 rounded text-xs font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
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
												<span class="px-2 py-0.5 rounded text-xs font-medium bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
													Mandiri
												</span>
											{/if}
											{#if k.is4S}
												<span class="px-2 py-0.5 rounded text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
													4S{k.dapukanNama ? ` • ${k.dapukanNama}` : ''}
												</span>
											{:else if k.isPengurus}
												<span class="px-2 py-0.5 rounded text-xs font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
													Pengurus{k.dapukanNama ? ` • ${k.dapukanNama}` : ''}
												</span>
											{/if}
										</div>
										<span class="text-xs text-foreground/50">{k.kepalaKeluargaEmail}</span>
									</div>
								</td>

								<!-- Wilayah Basis -->
								<td class="py-3.5 px-4">
									<div class="flex flex-col text-xs">
										<span class="font-medium text-foreground">{k.kelompokNama}</span>
										<span class="text-foreground/50">Desa {k.desaNama} • {k.daerahNama}</span>
									</div>
								</td>

								<!-- Alamat -->
								<td class="py-3.5 px-4 text-foreground/70 max-w-xs truncate">{k.alamatLengkap}</td>

								<!-- Jumlah Jiwa -->
								<td class="py-3.5 px-4">
									<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-secondary text-foreground/80">
										<Users class="w-3.5 h-3.5" />
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
												class="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border hover:bg-secondary text-foreground/80 text-xs font-semibold transition-colors"
												title="Tambah Anggota Keluarga"
											>
												<UserPlus class="w-3.5 h-3.5 text-primary" />
												<span class="hidden sm:inline">+ Anggota</span>
											</button>
										{/if}

										<button
											type="button"
											onclick={() => openDetailModal(k)}
											class="px-3 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground font-semibold text-xs transition-colors cursor-pointer"
										>
											Detail
										</button>

										{#if k.akunList && k.akunList.length > 0 && data.canManageDapukan}
											<button
												type="button"
												onclick={() => openAssignDapukanModal(k)}
												class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 font-semibold text-xs transition-colors cursor-pointer"
												title={k.akunList.length > 1 ? `Tugaskan Dapukan (${k.akunList.length} Akun)` : "Tugaskan Pengurus / Beri Dapukan"}
											>
												<Award class="w-3.5 h-3.5" />
												<span class="hidden xl:inline">{k.isPengurus ? 'Dapukan' : '+ Dapukan'}</span>
											</button>
										{/if}

										<button
											type="button"
											onclick={() => openPindahKelompokModal(k)}
											class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 font-semibold text-xs transition-colors cursor-pointer"
											title="Pindahkan Sensus ke Kelompok Lain"
										>
											<ArrowRightLeft class="w-3.5 h-3.5" />
											<span class="hidden lg:inline">Pindah</span>
										</button>

										<button
											type="button"
											onclick={() => handleHapusSensus(k)}
											class="inline-flex items-center p-1.5 rounded-lg border border-destructive/30 bg-destructive/10 hover:bg-destructive/20 text-destructive font-semibold text-xs transition-colors cursor-pointer"
											title="Hapus Data Sensus"
										>
											<Trash2 class="w-3.5 h-3.5" />
										</button>
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<Pagination bind:currentPage bind:pageSize totalItems={filteredKeluarga.length} />
		</div>
	{/if}
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
		<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
		<div
			class="bg-card border border-border rounded-2xl max-w-3xl w-full p-4 sm:p-6 shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto"
			onclick={(e) => e.stopPropagation()}
		>
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
							Kelompok Basis (Sesuai Scope Anda: {data.adminScope?.level ?? '-'}) *
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
									Nomor Kartu Keluarga (Opsional, Bisa Kosong)
								</label>
								<input
									id="noKk"
									name="noKk"
									type="text"
									inputmode="numeric"
									pattern="[0-9]*"
									maxlength="16"
									autocomplete="off"
									bind:value={newNoKk}
									oninput={(e) => {
										newNoKk = e.currentTarget.value.replace(/\D/g, '');
									}}
									placeholder="3216xxxxxxxxxxxx (opsional, bisa kosong)"
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
								class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 text-xs font-semibold transition-colors cursor-pointer"
							>
								<Plus class="w-3.5 h-3.5" />
								<span>Tambah Anggota</span>
							</button>
						</div>

						<div class="space-y-3">
							{#each newAnggotaList as anggota, idx (anggota._rowId || idx)}
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
												onclick={(e) => {
													e.preventDefault();
													e.stopPropagation();
													removeAnggotaRow(idx);
												}}
												class="inline-flex items-center gap-1 text-[11px] text-destructive hover:text-destructive/80 font-medium px-2 py-0.5 rounded hover:bg-destructive/10 transition-colors cursor-pointer"
												title="Hapus baris anggota"
											>
												<Trash2 class="w-3.5 h-3.5 pointer-events-none" />
												<span class="pointer-events-none">Hapus</span>
											</button>
										{/if}
									</div>

									<div class="grid grid-cols-1 sm:grid-cols-12 gap-3 text-xs">
										<!-- Baris 1: Nama Lengkap & Status Hubungan -->
										<div class="sm:col-span-7">
											<label for={`new-nama-${idx}`} class="block text-[11px] font-semibold text-foreground mb-1">
												Nama Lengkap *
												{#if idx === 0}
													<span class="text-[10px] font-normal text-primary ml-1">(Otomatis mengikuti Nama Akun Jamaah)</span>
												{/if}
											</label>
											{#if idx === 0}
												<input
													id={`new-nama-${idx}`}
													type="text"
													required
													readonly
													value={anggota.namaLengkap}
													placeholder="Nama Kepala Keluarga (mengikuti akun)"
													class="w-full bg-secondary/30 border border-border rounded-lg px-3 py-2 text-xs text-foreground/80 cursor-not-allowed focus:outline-none"
												/>
											{:else}
												<input
													id={`new-nama-${idx}`}
													type="text"
													required
													bind:value={anggota.namaLengkap}
													placeholder="Nama Lengkap Anggota"
													class="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
												/>
											{/if}
										</div>

										<div class="sm:col-span-5">
											<label for={`new-status-${idx}`} class="block text-[11px] font-semibold text-foreground mb-1">
												Status Hubungan *
												{#if idx === 0}
													<span class="text-[10px] font-normal text-primary ml-1">(Wajib Kepala Keluarga)</span>
												{/if}
											</label>
											{#if idx === 0}
												<select
													id={`new-status-${idx}`}
													disabled
													class="w-full bg-secondary/30 border border-border rounded-lg px-3 py-2 text-xs text-foreground/80 cursor-not-allowed focus:outline-none"
												>
													<option value="Kepala Keluarga">Kepala Keluarga</option>
												</select>
											{:else}
												<select
													id={`new-status-${idx}`}
													bind:value={anggota.statusHubungan}
													onchange={() => onNewAnggotaStatusChange(idx)}
													required
													class="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
												>
													<option value="Suami">Suami</option>
													<option value="Istri">Istri</option>
													<option value="Anak">Anak</option>
													<option value="Orang Tua">Orang Tua</option>
													<option value="Famili Lain">Famili Lain</option>
												</select>
											{/if}
										</div>

										<!-- Baris 2: NIK & Tempat Lahir -->
										<div class="sm:col-span-6">
											<label for={`new-nik-${idx}`} class="block text-[11px] font-semibold text-foreground mb-1">
												NIK (Opsional, Bisa Kosong)
											</label>
											<input
												id={`new-nik-${idx}`}
												type="text"
												inputmode="numeric"
												pattern="[0-9]*"
												maxlength="16"
												autocomplete="off"
												bind:value={anggota.nik}
												oninput={(e) => {
													anggota.nik = e.currentTarget.value.replace(/\D/g, '');
												}}
												placeholder="3216xxxxxxxxxxxx (opsional, bisa kosong)"
												class="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
											/>
										</div>

										<div class="sm:col-span-6">
											<label for={`new-tempat-${idx}`} class="block text-[11px] font-semibold text-foreground mb-1">
												Tempat Lahir *
											</label>
											<input
												id={`new-tempat-${idx}`}
												type="text"
												required
												bind:value={anggota.tempatLahir}
												placeholder="Kota/Kabupaten kelahiran"
												class="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
											/>
										</div>

										<!-- Baris 3: Tanggal Lahir, Umur, Status Pernikahan, Status Generus, Jenis Kelamin -->
										<div class="sm:col-span-3">
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

										<div class="sm:col-span-2">
											<label for={`new-umur-${idx}`} class="block text-[11px] font-semibold text-foreground mb-1">
												Umur
											</label>
											<input
												id={`new-umur-${idx}`}
												type="text"
												disabled
												value={anggota.tanggalLahir ? `${hitungUmur(anggota.tanggalLahir)} Thn` : '-'}
												class="w-full bg-secondary/30 border border-border rounded-lg px-3 py-2 text-xs text-foreground/80 font-medium cursor-not-allowed"
											/>
										</div>

										<div class="sm:col-span-2">
											<label for={`new-pernikahan-${idx}`} class="block text-[11px] font-semibold text-foreground mb-1">
												Pernikahan *
											</label>
											{#if idx === 0}
												<select
													id={`new-pernikahan-${idx}`}
													bind:value={anggota.statusPernikahan}
													onchange={() => updateAnggotaGenerus(anggota)}
													class="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
												>
													<option value="Sudah Menikah">Sudah Menikah</option>
													<option value="Belum Menikah">Belum Menikah</option>
												</select>
											{:else}
												<select
													id={`new-pernikahan-${idx}`}
													bind:value={anggota.statusPernikahan}
													onchange={() => updateAnggotaGenerus(anggota)}
													class="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
												>
													<option value="Belum Menikah">Belum Menikah</option>
													<option value="Sudah Menikah">Sudah Menikah</option>
												</select>
											{/if}
										</div>

										<div class="sm:col-span-3">
											<label for={`new-generus-${idx}`} class="block text-[11px] font-semibold text-foreground mb-1">
												Status Generus
											</label>
											<select
												id={`new-generus-${idx}`}
												bind:value={anggota.statusGenerus}
												onchange={() => onNewAnggotaGenerusChange(idx)}
												class="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
											>
												<option value="">-- Otomatis --</option>
												{#each DAFTAR_STATUS_GENERUS as gen}
													<option value={gen}>{gen}</option>
												{/each}
											</select>
										</div>

										<div class="sm:col-span-2">
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

						<div class="grid grid-cols-1 sm:grid-cols-12 gap-3 text-xs">
							<div class="sm:col-span-6">
								<label for="nikMandiri" class="block text-[11px] font-semibold text-foreground mb-1">
									NIK (Opsional, Bisa Kosong)
								</label>
								<input
									id="nikMandiri"
									name="nik"
									type="text"
									inputmode="numeric"
									pattern="[0-9]*"
									maxlength="16"
									autocomplete="off"
									bind:value={newNikMandiri}
									oninput={(e) => {
										newNikMandiri = e.currentTarget.value.replace(/\D/g, '');
									}}
									placeholder="3216xxxxxxxxxxxx (opsional, bisa kosong)"
									class="w-full bg-secondary/60 border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
								/>
							</div>

							<div class="sm:col-span-6">
								<label for="tempatLahirMandiri" class="block text-[11px] font-semibold text-foreground mb-1">
									Tempat Lahir *
								</label>
								<input
									id="tempatLahirMandiri"
									name="tempatLahir"
									type="text"
									required
									bind:value={newTempatLahirMandiri}
									placeholder="Kota/Kabupaten kelahiran"
									class="w-full bg-secondary/60 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
								/>
							</div>

							<div class="sm:col-span-3">
								<label for="tanggalLahirMandiri" class="block text-[11px] font-semibold text-foreground mb-1">
									Tgl Lahir (DD-MM-YYYY) *
								</label>
								<DateInput
									id="tanggalLahirMandiri"
									name="tanggalLahir"
									required
									bind:value={newTanggalLahirMandiri}
									class="bg-secondary/60 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
								/>
							</div>

							<div class="sm:col-span-2">
								<label for="umurMandiri" class="block text-[11px] font-semibold text-foreground mb-1">
									Umur
								</label>
								<input
									id="umurMandiri"
									type="text"
									disabled
									value={newTanggalLahirMandiri ? `${hitungUmur(newTanggalLahirMandiri)} Thn` : '-'}
									class="w-full bg-secondary/30 border border-border rounded-lg px-3 py-2 text-xs text-foreground/80 font-medium cursor-not-allowed"
								/>
							</div>

							<div class="sm:col-span-2">
								<label for="pernikahanMandiri" class="block text-[11px] font-semibold text-foreground mb-1">
									Pernikahan *
								</label>
								<select
									id="pernikahanMandiri"
									name="statusPernikahan"
									bind:value={newStatusPernikahanMandiri}
									class="w-full bg-secondary/60 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
								>
									<option value="Belum Menikah">Belum Menikah</option>
									<option value="Sudah Menikah">Sudah Menikah</option>
								</select>
							</div>

							<div class="sm:col-span-3">
								<label for="generusMandiri" class="block text-[11px] font-semibold text-foreground mb-1">
									Status Generus
								</label>
								<select
									id="generusMandiri"
									name="statusGenerus"
									bind:value={newStatusGenerusMandiri}
									onchange={onNewMandiriGenerusChange}
									class="w-full bg-secondary/60 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
								>
									<option value="">-- Otomatis --</option>
									{#each DAFTAR_STATUS_GENERUS as gen}
										<option value={gen}>{gen}</option>
									{/each}
								</select>
							</div>

							<div class="sm:col-span-2">
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
							onclick={async () => {
								const ok = await confirmAction({
									title: 'Kosongkan Formulir Sensus?',
									message: 'Apakah Anda yakin ingin mengosongkan semua isian formulir sensus ini?',
									confirmText: 'Ya, Kosongkan',
									variant: 'danger'
								});
								if (ok) resetCreateForm();
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

			<form
				method="POST"
				action="?/addAnggotaKeluarga"
				use:enhance={keepScrollSubmit({ onSuccess: () => closeAddMemberModal() })}
				class="space-y-3 text-xs"
			>
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
						onchange={onMemberStatusChange}
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
						NIK (Opsional, Bisa Kosong)
					</label>
					<input
						id="memberNik"
						name="nik"
						type="text"
						inputmode="numeric"
						pattern="[0-9]*"
						maxlength="16"
						autocomplete="off"
						bind:value={memberNik}
						oninput={(e) => {
							memberNik = e.currentTarget.value.replace(/\D/g, '');
						}}
						placeholder="3216xxxxxxxxxxxx (opsional, bisa kosong)"
						class="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
					/>
				</div>

				<div>
					<label for="memberTempatLahir" class="block font-semibold text-foreground mb-1">
						Tempat Lahir
					</label>
					<input
						id="memberTempatLahir"
						name="tempatLahir"
						type="text"
						bind:value={memberTempatLahir}
						placeholder="Kota / Kabupaten Lahir"
						class="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
					/>
				</div>

				<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
						<label for="memberUmur" class="block font-semibold text-foreground mb-1">
							Umur (Otomatis)
						</label>
						<input
							id="memberUmur"
							type="text"
							disabled
							value={memberTanggalLahir ? `${memberUmur} Tahun` : '-'}
							class="w-full bg-secondary/70 border border-border/80 rounded-lg px-3 py-2 text-xs text-foreground/70 font-semibold cursor-not-allowed select-none"
						/>
					</div>
				</div>

				<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
					<div>
						<label for="memberGenerus" class="block font-semibold text-foreground mb-1">
							Status Generus
						</label>
						<select
							id="memberGenerus"
							name="statusGenerus"
							bind:value={memberStatusGenerus}
							onchange={onMemberStatusGenerusChange}
							class="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
						>
							<option value="">-- Otomatis Mengikuti Umur --</option>
							{#each DAFTAR_STATUS_GENERUS as g}
								<option value={g}>{g}</option>
							{/each}
						</select>
						<p class="text-[10px] text-foreground/50 mt-0.5">
							Otomatis sesuai umur, bisa disesuaikan manual
						</p>
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
			if (e.target === e.currentTarget) closeDetailModal();
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
					onclick={closeDetailModal}
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
					<div class="flex items-center gap-1.5 flex-wrap">
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

						<button
							type="button"
							onclick={() => {
								const target = selectedKeluarga;
								if (target) openPindahKelompokModal(target);
							}}
							class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 font-semibold text-[11px] border border-blue-500/30 transition-colors cursor-pointer"
						>
							<ArrowRightLeft class="w-3 h-3" />
							<span>Pindah Kelompok</span>
						</button>

						<button
							type="button"
							onclick={() => {
								const target = selectedKeluarga;
								if (target) handleHapusSensus(target);
							}}
							class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive font-semibold text-[11px] border border-destructive/30 transition-colors cursor-pointer"
						>
							<Trash2 class="w-3 h-3" />
							<span>Hapus Sensus</span>
						</button>
					</div>
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

								{#if a.statusJamaah === 'Aktif'}
									<button
										type="button"
										onclick={() => handleToggleStatusJamaah(a, 'Tidak Aktif')}
										class="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 font-semibold transition-colors cursor-pointer shadow-xs"
										title="Nonaktifkan status jamaah ini dari KK"
									>
										<UserX class="w-3 h-3" />
										<span>Nonaktifkan</span>
									</button>
								{:else}
									<button
										type="button"
										onclick={() => handleToggleStatusJamaah(a, 'Aktif')}
										class="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-semibold transition-colors cursor-pointer shadow-xs"
										title="Aktifkan kembali status jamaah ini"
									>
										<UserCheck class="w-3 h-3" />
										<span>Aktifkan</span>
									</button>
								{/if}

								{#if a.userId}
									{#if a.is4S}
										<span class="inline-flex items-center gap-1 text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-1 rounded-lg font-bold border border-amber-500/20">
											<ShieldCheck class="w-3 h-3" />
											<span>4S • {a.dapukanNama || 'Pengurus 4S'}</span>
										</span>
									{:else if a.isPengurus}
										<span class="inline-flex items-center gap-1 text-[10px] bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-1 rounded-lg font-semibold border border-blue-500/20">
											<Award class="w-3 h-3" />
											<span>Pengurus • {a.dapukanNama || 'Pengurus'}</span>
										</span>
									{:else}
										<span class="inline-flex items-center gap-1 text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-1 rounded-lg font-semibold border border-emerald-500/20">
											<CheckCircle2 class="w-3 h-3" />
											<span>Punya Akun</span>
										</span>
									{/if}

									{#if data.canManageDapukan}
										<button
											type="button"
											onclick={() => {
												if (selectedKeluarga) openAssignDapukanModal(selectedKeluarga, a.userId);
											}}
											class="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 font-semibold transition-colors cursor-pointer shadow-xs"
											title="Tugaskan Dapukan Pengurus"
										>
											<Award class="w-3 h-3" />
											<span>{a.isPengurus ? 'Ubah Dapukan' : 'Beri Dapukan'}</span>
										</button>
									{/if}
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
							closeDetailModal();
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
					onclick={closeDetailModal}
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
				use:enhance={keepScrollSubmit({
					beforeSubmit: () => { isEditAnggotaSubmitting = true; },
					onFinally: () => { isEditAnggotaSubmitting = false; },
					onSuccess: () => { closeEditAnggotaModal(); }
				})}
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
							Nomor Induk Kependudukan (NIK - Opsional)
						</label>
						<input
							type="text"
							id="edit-nik"
							name="nik"
							bind:value={editAnggotaNik}
							maxlength="16"
							autocomplete="off"
							placeholder={editingAnggota.hasNik ? 'Biarkan kosong jika tidak diubah' : '3216xxxxxxxxxxxx (opsional)'}
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
							onchange={onEditAnggotaHubunganChange}
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
						<DateInput
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
							onchange={onEditAnggotaStatusGenerusChange}
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
							onchange={onEditAnggotaStatusPernikahanChange}
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
				use:enhance={keepScrollSubmit({
					beforeSubmit: () => { isEditKeluargaSubmitting = true; },
					onFinally: () => { isEditKeluargaSubmitting = false; },
					onSuccess: () => { closeEditKeluargaModal(); }
				})}
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
						Kelompok Basis Wilayah *
					</label>
					<SearchableSelect
						id="edit-kelompokId"
						name="kelompokId"
						options={pindahKelompokOptions}
						bind:value={editKeluargaKelompokId}
						required
						placeholder="-- Pilih Kelompok Basis Wilayah --"
						searchPlaceholder="Cari kelompok, desa, atau daerah..."
					/>
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
				use:enhance={keepScrollSubmit({
					beforeSubmit: () => { isAccountSubmitting = true; },
					onFinally: () => { isAccountSubmitting = false; },
					onSuccess: () => { memberForAccount = null; }
				})}
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

<!-- MODAL PINDAH KELOMPOK SENSUS -->
{#if pindahKelompokTarget}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-150"
		role="dialog"
		aria-modal="true"
		onclick={(e) => {
			if (e.target === e.currentTarget) closePindahKelompokModal();
		}}
	>
		<div class="bg-card border border-border rounded-2xl max-w-md w-full p-4 sm:p-6 shadow-2xl space-y-4">
			<div class="flex items-center justify-between pb-3 border-b border-border">
				<div>
					<h3 class="text-sm font-bold text-foreground flex items-center gap-2">
						<ArrowRightLeft class="w-4 h-4 text-blue-500" />
						<span>Pindahkan Sensus ke Kelompok Lain</span>
					</h3>
					<p class="text-[11px] text-foreground/60 mt-0.5">
						Alihkan basis wilayah KK dan seluruh anggota keluarga yang terdaftar.
					</p>
				</div>
				<button
					type="button"
					onclick={closePindahKelompokModal}
					class="p-1 rounded-lg hover:bg-secondary text-foreground/60 hover:text-foreground cursor-pointer"
				>
					<X class="w-5 h-5" />
				</button>
			</div>

			<!-- Ringkasan Info Sensus -->
			<div class="p-3 bg-secondary/40 border border-border rounded-xl space-y-1.5 text-xs">
				<div class="flex justify-between items-center">
					<span class="text-foreground/60 font-medium">Kepala Keluarga:</span>
					<span class="font-bold text-foreground">{pindahKelompokTarget.kepalaKeluargaNama}</span>
				</div>
				{#if pindahKelompokTarget.isKk}
					<div class="flex justify-between items-center font-mono text-[11px]">
						<span class="text-foreground/60 font-sans">No. KK:</span>
						<span class="text-foreground/80">{pindahKelompokTarget.noKkMasked}</span>
					</div>
				{/if}
				<div class="flex justify-between items-center">
					<span class="text-foreground/60 font-medium">Kelompok Saat Ini:</span>
					<span class="font-semibold text-primary">{pindahKelompokTarget.kelompokNama}</span>
				</div>
				<div class="flex justify-between items-center text-[11px] text-foreground/50">
					<span>Wilayah:</span>
					<span>Desa {pindahKelompokTarget.desaNama} • {pindahKelompokTarget.daerahNama}</span>
				</div>
			</div>

			<form
				method="POST"
				action="?/pindahKelompok"
				use:enhance={keepScrollSubmit({
					beforeSubmit: () => { isPindahKelompokSubmitting = true; },
					onFinally: () => { isPindahKelompokSubmitting = false; },
					onSuccess: () => { closePindahKelompokModal(); }
				})}
				class="space-y-3.5 text-xs"
			>
				<input type="hidden" name="keluargaId" value={pindahKelompokTarget.id} />

				<div>
					<label for="pindah-kelompokId" class="block font-semibold text-foreground mb-1.5">
						Pilih Kelompok Tujuan *
					</label>
					<SearchableSelect
						id="pindah-kelompokId"
						name="kelompokId"
						options={pindahKelompokOptions}
						bind:value={pindahTargetKelompokId}
						required
						placeholder="-- Pilih Kelompok Tujuan --"
						searchPlaceholder="Cari kelompok, desa, atau daerah..."
					/>
					<p class="text-[10.5px] text-foreground/50 mt-1.5 leading-relaxed">
						Seluruh akun login anggota keluarga yang terdaftar dalam KK ini akan otomatis dimutasi ke kelompok yang dipilih.
					</p>
				</div>

				<div class="flex items-center justify-end gap-2 pt-3 border-t border-border">
					<button
						type="button"
						onclick={closePindahKelompokModal}
						class="px-4 py-2 rounded-lg border border-border text-foreground hover:bg-secondary font-semibold transition-colors cursor-pointer"
					>
						Batal
					</button>
					<button
						type="submit"
						disabled={isPindahKelompokSubmitting}
						class="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer disabled:opacity-50"
					>
						{#if isPindahKelompokSubmitting}
							<div class="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
							<span>Memindahkan...</span>
						{:else}
							<ArrowRightLeft class="w-3.5 h-3.5" />
							<span>Pindahkan Sensus</span>
						{/if}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- MODAL TUGASKAN PENGURUS (BERI DAPUKAN) DARI SENSUS -->
{#if showAssignDapukanModal && targetKeluargaForDapukan}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-150"
		role="dialog"
		aria-modal="true"
		onclick={(e) => {
			if (e.target === e.currentTarget) closeAssignDapukanModal();
		}}
	>
		<div class="bg-card border border-border rounded-2xl max-w-lg w-full p-4 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
			<div class="flex items-center justify-between pb-3 border-b border-border">
				<div class="flex items-center gap-2">
					<div class="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
						<Award class="w-4 h-4" />
					</div>
					<div>
						<h3 class="text-sm font-bold text-foreground">Tugaskan Pengurus (Beri Dapukan)</h3>
						<p class="text-[11px] text-foreground/60">
							{targetKeluargaForDapukan.isKk ? `KK: ${targetKeluargaForDapukan.kepalaKeluargaNama}` : `Mandiri: ${targetKeluargaForDapukan.kepalaKeluargaNama}`}
						</p>
					</div>
				</div>
				<button
					type="button"
					onclick={closeAssignDapukanModal}
					class="p-1.5 rounded-lg hover:bg-secondary text-foreground/60 hover:text-foreground transition-colors cursor-pointer"
				>
					<X class="w-4 h-4" />
				</button>
			</div>

			<form
				method="POST"
				action="?/assignDapukan"
				use:enhance={keepScrollSubmit({ onSuccess: () => closeAssignDapukanModal() })}
				class="space-y-4"
			>
				<!-- Pilih Akun dalam KK (Jika > 1 Akun, tampilkan pilihan kartu/radio) -->
				{#if targetKeluargaForDapukan.akunList && targetKeluargaForDapukan.akunList.length > 1}
					<div>
						<span class="block text-xs font-semibold text-foreground mb-1">
							Pilih Akun Jamaah dalam KK Ini ({targetKeluargaForDapukan.akunList.length} Akun Terdaftar) *
						</span>
						<p class="text-[11px] text-foreground/50 mb-2">
							Terdapat lebih dari satu akun di KK ini. Pilih salah satu akun yang ingin diberikan penugasan dapukan:
						</p>
						<div class="space-y-2">
							{#each targetKeluargaForDapukan.akunList as acc}
								<label
									class="p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-colors {assignUserId === acc.userId ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border bg-secondary/30 hover:bg-secondary/50'}"
								>
									<div class="flex items-center gap-2.5 min-w-0">
										<input
											type="radio"
											name="userId"
											value={acc.userId}
											bind:group={assignUserId}
											required
											class="text-primary focus:ring-primary"
										/>
										<div class="min-w-0">
											<p class="text-xs font-bold text-foreground truncate">
												{acc.nama}
												<span class="font-normal text-foreground/60 text-[11px]">({acc.statusHubungan})</span>
											</p>
											<p class="text-[11px] text-foreground/50 truncate font-mono">{acc.email}</p>
										</div>
									</div>
									<div class="shrink-0 text-right">
										{#if acc.is4S}
											<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
												4S • {acc.dapukanNama}
											</span>
										{:else if acc.isPengurus}
											<span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
												Pengurus • {acc.dapukanNama}
											</span>
										{:else}
											<span class="text-[10px] text-foreground/40 font-medium">Jamaah Biasa</span>
										{/if}
									</div>
								</label>
							{/each}
						</div>
					</div>
				{:else if targetKeluargaForDapukan.akunList && targetKeluargaForDapukan.akunList.length === 1}
					{@const singleAcc = targetKeluargaForDapukan.akunList[0]}
					<input type="hidden" name="userId" value={singleAcc.userId} />
					<div class="p-3 bg-secondary/40 border border-border rounded-xl space-y-1">
						<div class="flex items-center justify-between">
							<span class="text-xs font-semibold text-foreground">{singleAcc.nama} ({singleAcc.statusHubungan})</span>
							{#if singleAcc.is4S}
								<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
									4S • {singleAcc.dapukanNama}
								</span>
							{:else if singleAcc.isPengurus}
								<span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
									Pengurus • {singleAcc.dapukanNama}
								</span>
							{:else}
								<span class="text-[10px] text-foreground/40 font-medium">Jamaah Biasa</span>
							{/if}
						</div>
						<p class="text-[11px] text-foreground/50 font-mono">{singleAcc.email}</p>
					</div>
				{:else}
					<div class="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs rounded-xl">
						Belum ada akun terdaftar pada keluarga ini. Silakan buatkan akun terlebih dahulu melalui modal Detail Anggota.
					</div>
				{/if}

				<!-- Basis Wilayah KK -->
				<div class="text-[11px] text-foreground/70 flex items-center gap-1.5 px-1">
					<MapPin class="w-3.5 h-3.5 text-primary shrink-0" />
					<span>Basis Wilayah:</span>
					<span class="font-medium text-foreground">
						{targetKeluargaForDapukan.kelompokNama} • Desa {targetKeluargaForDapukan.desaNama} • {targetKeluargaForDapukan.daerahNama}
					</span>
				</div>

				<!-- Tipe Dapukan: 4S vs Tentatif -->
				<div>
					<span class="block text-xs font-semibold text-foreground mb-2">Tipe Dapukan *</span>
					<div class="grid grid-cols-2 gap-3">
						<label class="p-3 border rounded-xl flex items-center gap-2.5 cursor-pointer transition-colors {assignTipeDapukan === 'tetap' ? 'border-primary bg-primary/5' : 'border-border bg-secondary/30'}">
							<input
								type="radio"
								name="tipeDapukan"
								value="tetap"
								bind:group={assignTipeDapukan}
								class="text-primary focus:ring-primary"
							/>
							<div>
								<span class="text-xs font-bold text-foreground block">Dapukan 4S</span>
								<span class="text-[10px] text-foreground/60 block">Hak Admin Elevated</span>
							</div>
						</label>

						<label class="p-3 border rounded-xl flex items-center gap-2.5 cursor-pointer transition-colors {assignTipeDapukan === 'custom' ? 'border-primary bg-primary/5' : 'border-border bg-secondary/30'}">
							<input
								type="radio"
								name="tipeDapukan"
								value="custom"
								bind:group={assignTipeDapukan}
								class="text-primary focus:ring-primary"
							/>
							<div>
								<span class="text-xs font-bold text-foreground block">Tentatif / Panitia</span>
								<span class="text-[10px] text-foreground/60 block">Dapukan Khusus Lokal</span>
							</div>
						</label>
					</div>
				</div>

				{#if assignTipeDapukan === 'tetap'}
					<div>
						<label for="assignDapukanId" class="block text-xs font-semibold text-foreground mb-1.5">
							Pilih Dapukan 4S *
						</label>
						<SearchableSelect
							id="assignDapukanId"
							name="dapukanId"
							options={masterDapukanOptions}
							bind:value={assignDapukanId}
							required
							placeholder="-- Pilih Dapukan 4S --"
							searchPlaceholder="Cari nama dapukan..."
						/>
					</div>
				{:else}
					<div>
						<label for="assignNamaDapukanCustom" class="block text-xs font-semibold text-foreground mb-1.5">
							Nama Dapukan Tentatif / Panitia *
						</label>
						<input
							id="assignNamaDapukanCustom"
							name="namaDapukanCustom"
							type="text"
							bind:value={assignNamaDapukanCustom}
							required
							placeholder="Contoh: Panitia Qurban, Seksi Konsumsi"
							class="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
						/>
					</div>
				{/if}

				<!-- Tingkat Scope Wewenang -->
				<div>
					<label for="assignTingkatScope" class="block text-xs font-semibold text-foreground mb-1.5">
						Tingkat Scope Wewenang *
					</label>
					<select
						id="assignTingkatScope"
						name="tingkatScope"
						bind:value={assignScope}
						required
						class="w-full bg-secondary/50 border border-border rounded-lg px-2.5 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
					>
						<option value="Kelompok">Kelompok (Tingkat Basis)</option>
						{#if data.adminScope?.isPusat || data.adminScope?.level === 'Daerah' || data.adminScope?.level === 'Desa'}
							<option value="Desa">Desa (Mengawasi Semua Kelompok)</option>
						{/if}
						{#if data.adminScope?.isPusat || data.adminScope?.level === 'Daerah'}
							<option value="Daerah">Daerah (Mengawasi Semua Desa)</option>
						{/if}
						{#if data.adminScope?.isPusat}
							<option value="Pusat">Pusat (Akses Nasional)</option>
						{/if}
					</select>
				</div>

				<!-- Cakupan Wilayah (Terkunci ke Basis KK) -->
				{#if assignScope === 'Kelompok'}
					<div>
						<div class="flex items-center justify-between mb-1.5">
							<label for="assignKelompokId" class="block text-xs font-semibold text-foreground">
								Kelompok Cakupan *
							</label>
							<span class="text-[10px] text-primary font-semibold">Terkunci ke Basis KK</span>
						</div>
						<SearchableSelect
							id="assignKelompokId"
							name="kelompokId"
							options={assignKelompokOptions}
							bind:value={assignKelompokId}
							disabled={Boolean(targetKeluargaForDapukan.kelompokId)}
							required
							placeholder="-- Pilih Kelompok Cakupan --"
							searchPlaceholder="Cari kelompok..."
						/>
					</div>
				{:else if assignScope === 'Desa'}
					<div>
						<div class="flex items-center justify-between mb-1.5">
							<label for="assignDesaId" class="block text-xs font-semibold text-foreground">
								Desa Cakupan *
							</label>
							<span class="text-[10px] text-primary font-semibold">Terkunci ke Basis KK</span>
						</div>
						<SearchableSelect
							id="assignDesaId"
							name="desaId"
							options={assignDesaOptions}
							bind:value={assignDesaId}
							disabled={Boolean(targetKeluargaForDapukan.desaId)}
							required
							placeholder="-- Pilih Desa Cakupan --"
							searchPlaceholder="Cari desa..."
						/>
					</div>
				{:else if assignScope === 'Daerah'}
					<div>
						<div class="flex items-center justify-between mb-1.5">
							<label for="assignDaerahId" class="block text-xs font-semibold text-foreground">
								Daerah Cakupan *
							</label>
							<span class="text-[10px] text-primary font-semibold">Terkunci ke Basis KK</span>
						</div>
						<SearchableSelect
							id="assignDaerahId"
							name="daerahId"
							options={assignDaerahOptions}
							bind:value={assignDaerahId}
							disabled={Boolean(targetKeluargaForDapukan.daerahId)}
							required
							placeholder="-- Pilih Daerah Cakupan --"
							searchPlaceholder="Cari daerah..."
						/>
					</div>
				{/if}

				<div class="flex items-center justify-end gap-2 pt-3 border-t border-border">
					<button
						type="button"
						onclick={closeAssignDapukanModal}
						class="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-foreground/80 hover:bg-secondary cursor-pointer"
					>
						Batal
					</button>
					<button
						type="submit"
						disabled={!assignUserId}
						class="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors cursor-pointer"
					>
						Simpan Penugasan Pengurus
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- Form Tersembunyi untuk Eksekusi Hapus Sensus -->
<form
	bind:this={deleteSensusForm}
	method="POST"
	action="?/deleteSensus"
	use:enhance={keepScrollSubmit()}
	class="hidden"
>
	<input type="hidden" name="keluargaId" value={deleteTargetKeluargaId} />
</form>

<!-- Form Tersembunyi untuk Eksekusi Toggle Status Keaktifan Jamaah -->
<form
	bind:this={toggleStatusForm}
	method="POST"
	action="?/toggleStatusJamaah"
	use:enhance={keepScrollSubmit()}
	class="hidden"
>
	<input type="hidden" name="anggotaId" value={toggleTargetAnggotaId} />
	<input type="hidden" name="statusJamaah" value={toggleTargetStatus} />
</form>
