<!--
  @file src/routes/(admin)/admin/wilayah/+page.svelte
  @purpose Halaman manajemen Data Wilayah lengkap dengan dual presentation (compact cards mobile & table desktop) di tab Kelompok, Desa, & Sub-Kelompok, pagination di setiap tab, 1 tombol Tambah Wilayah cerdas (hierarki Daerah -> Desa -> Kelompok -> Sub-Kelompok), modal edit unit wilayah (Kelompok, Desa, Sub-Kelompok), modal detail desa & kelompok dengan Leaflet LocationPicker, fitur 'Hubungkan ke Lokasi', kontrol RBAC visual, checklist hapus massal & single delete, serta scroll retention (mencegah loncat ke atas saat edit/hapus)
  @usedBy Route admin '/admin/wilayah'
  @dependencies @lucide/svelte, Svelte 5 Runes, $lib/components/SearchableSelect.svelte, $lib/components/LocationPicker.svelte, $lib/components/Pagination.svelte, $app/forms (enhance), $lib/keepScroll.ts (keepScrollSubmit)
  @publicFunctions openUnifiedAddModal, closeUnifiedAddModal, openEditKelompok, closeEditKelompok, openEditDesa, closeEditDesa, openEditSubKelompok, closeEditSubKelompok, openKelompokDetail, closeKelompokDetail, openDesaDetail, closeDesaDetail, handleConnectToKelompok, handleDisconnectKelompok, resetFilter, toggleSelectKelompok, toggleSelectAllKelompok, openDeleteSingleKelompok, openDeleteBatchKelompok, closeDeleteModal
  @sideEffects Menampilkan data wilayah sesuai scope RBAC, menyaring data, mengelola lokasi kelompok & desa dengan Leaflet, dan mengirim update/create/delete ke server via enhance dengan retensi scroll
-->
<script lang="ts">
	import {
		Building,
		ChevronDown,
		ChevronUp,
		FileSpreadsheet,
		Filter,
		Home,
		Layers,
		MapPin,
		Plus,
		RotateCcw,
		Search,
		ShieldCheck,
		SlidersHorizontal,
		Users,
		X,
		ExternalLink,
		Compass,
		CheckCircle2,
		Navigation,
		Trash2,
		AlertTriangle,
		CheckSquare,
		Check,
		Link2,
		Link2Off,
		Pencil
	} from '@lucide/svelte';
	import type { ActionData, PageData } from './$types';
	import SearchableSelect from '$lib/components/SearchableSelect.svelte';
	import LocationPicker from '$lib/components/LocationPicker.svelte';
	import Pagination from '$lib/components/Pagination.svelte';
	import { enhance } from '$app/forms';
	import { keepScrollSubmit } from '$lib/keepScroll';

	let { data, form } = $props<{ data: PageData; form: ActionData }>();

	// State Tab Tampilan
	let activeTab = $state<'kelompok' | 'subKelompok' | 'desa'>('kelompok');

	// State Filter & Pencarian
	let searchQuery = $state('');
	let selectedFilterDaerahId = $state<string | number>('');
	let selectedFilterDesaId = $state<string | number>('');
	let showMobileFilter = $state(false);

	// State Modal Tambah Wilayah Cerdas & Bertingkat
	let showUnifiedAddModal = $state(false);
	let unifiedDaerahValue = $state<string | number>('');
	let unifiedDaerahProvinsi = $state('');
	let unifiedDaerahKotaKabupaten = $state('');

	let unifiedDesaValue = $state<string | number>('');
	let unifiedDesaKecamatan = $state('');

	let unifiedKelompokValue = $state<string | number>('');
	let unifiedKelompokKelurahan = $state('');

	let unifiedSubKelompokNama = $state('');
	let unifiedSubKelompokKeterangan = $state('');

	function openUnifiedAddModal() {
		// Auto-select jika daerahList hanya 1 dan admin tidak berhak create daerah
		if ((data.daerahList?.length ?? 0) === 1 && !data.permissions?.canCreateDaerah) {
			unifiedDaerahValue = data.daerahList[0].id;
		} else {
			unifiedDaerahValue = '';
		}
		// Auto-select desa jika desaList hanya 1 dan admin tidak berhak create desa
		if ((data.desaList?.length ?? 0) === 1 && !data.permissions?.canCreateDesa) {
			unifiedDesaValue = data.desaList[0].id;
		} else {
			unifiedDesaValue = '';
		}
		unifiedKelompokValue = '';
		unifiedSubKelompokNama = '';
		unifiedSubKelompokKeterangan = '';
		unifiedDaerahProvinsi = '';
		unifiedDaerahKotaKabupaten = '';
		unifiedDesaKecamatan = '';
		unifiedKelompokKelurahan = '';
		showUnifiedAddModal = true;
	}

	function closeUnifiedAddModal() {
		showUnifiedAddModal = false;
	}

	function resetUnifiedAddForm() {
		unifiedDaerahValue = '';
		unifiedDesaValue = '';
		unifiedKelompokValue = '';
		unifiedSubKelompokNama = '';
		unifiedSubKelompokKeterangan = '';
		unifiedDaerahProvinsi = '';
		unifiedDaerahKotaKabupaten = '';
		unifiedDesaKecamatan = '';
		unifiedKelompokKelurahan = '';
	}

	// State Modal Tambah Lama (Backward Compatibility)
	let showAddDaerahModal = $state(false);
	let showAddKelompokModal = $state(false);
	let showAddDesaModal = $state(false);
	let showAddSubKelompokModal = $state(false);

	// State Modal Detail & Lokasi Kelompok
	let showKelompokDetailModal = $state(false);
	let selectedKelompok = $state<(typeof data.kelompokList)[number] | null>(null);

	// State Form Edit Lokasi Kelompok
	let editLokasiNama = $state('');
	let editLatitude = $state('');
	let editLongitude = $state('');
	let editRadiusMeter = $state(100);
	let editGmapsUrl = $state('');

	function openKelompokDetail(k: (typeof data.kelompokList)[number]) {
		selectedKelompok = k;
		editLokasiNama = k.lokasiNama || '';
		editLatitude = k.latitude || '';
		editLongitude = k.longitude || '';
		editRadiusMeter = k.radiusMeter || 100;
		editGmapsUrl = k.gmapsUrl || '';
		showKelompokDetailModal = true;
	}

	function closeKelompokDetail() {
		showKelompokDetailModal = false;
		selectedKelompok = null;
	}

	// State Modal Edit Data Kelompok
	let showEditKelompokModal = $state(false);
	let selectedKelompokToEdit = $state<(typeof data.kelompokList)[number] | null>(null);
	let editKelompokNama = $state('');
	let editKelompokKelurahan = $state('');
	let editKelompokDesaId = $state<number>(0);

	function openEditKelompok(k: (typeof data.kelompokList)[number]) {
		selectedKelompokToEdit = k;
		editKelompokNama = k.nama;
		editKelompokKelurahan = k.kelurahan || '';
		editKelompokDesaId = k.desaId;
		showEditKelompokModal = true;
	}

	function closeEditKelompok() {
		showEditKelompokModal = false;
		selectedKelompokToEdit = null;
	}

	// State Modal Edit Data Desa
	let showEditDesaModal = $state(false);
	let selectedDesaToEdit = $state<(typeof data.desaList)[number] | null>(null);
	let editDesaNama = $state('');
	let editDesaKecamatan = $state('');
	let editDesaDaerahId = $state<number>(0);

	function openEditDesa(d: (typeof data.desaList)[number]) {
		selectedDesaToEdit = d;
		editDesaNama = d.nama;
		editDesaKecamatan = d.kecamatan || '';
		editDesaDaerahId = d.daerahId;
		showEditDesaModal = true;
	}

	function closeEditDesa() {
		showEditDesaModal = false;
		selectedDesaToEdit = null;
	}

	// State Modal Edit Data Sub-Kelompok
	let showEditSubKelompokModal = $state(false);
	let selectedSubKelompokToEdit = $state<(typeof data.subKelompokList)[number] | null>(null);
	let editSubKelompokNama = $state('');
	let editSubKelompokKeterangan = $state('');
	let editSubKelompokKelompokId = $state<number>(0);

	function openEditSubKelompok(sk: (typeof data.subKelompokList)[number]) {
		selectedSubKelompokToEdit = sk;
		editSubKelompokNama = sk.nama;
		editSubKelompokKeterangan = sk.keterangan || '';
		editSubKelompokKelompokId = sk.kelompokId;
		showEditSubKelompokModal = true;
	}

	function closeEditSubKelompok() {
		showEditSubKelompokModal = false;
		selectedSubKelompokToEdit = null;
	}

	// State Modal Detail & Lokasi Desa
	let showDesaDetailModal = $state(false);
	let selectedDesa = $state<(typeof data.desaList)[number] | null>(null);

	// State Form Edit Lokasi Desa
	let editDesaLokasiNama = $state('');
	let editDesaLatitude = $state('');
	let editDesaLongitude = $state('');
	let editDesaRadiusMeter = $state(100);
	let editDesaGmapsUrl = $state('');
	let editDesaLokasiKelompokId = $state<number | null>(null);

	const connectedKelompokObj = $derived(
		editDesaLokasiKelompokId
			? (data.kelompokList || []).find((k: any) => k.id === editDesaLokasiKelompokId)
			: null
	);

	const kelompokLinkOptions = $derived(
		(data.kelompokList || [])
			.map((k: any) => {
				const isUnderThisDesa = Boolean(selectedDesa && k.desaId === selectedDesa.id);
				const statusLoc = k.latitude && k.longitude ? 'GPS Tersedia' : 'Belum Ada GPS';
				const sublabel = isUnderThisDesa
					? `Basis Desa Ini • ${k.lokasiNama || statusLoc}`
					: `Desa ${k.desaNama || '-'} • ${k.lokasiNama || statusLoc}`;
				return {
					value: k.id,
					label: k.nama,
					sublabel,
					isUnderThisDesa
				};
			})
			.sort((a: any, b: any) => {
				if (a.isUnderThisDesa && !b.isUnderThisDesa) return -1;
				if (!a.isUnderThisDesa && b.isUnderThisDesa) return 1;
				return a.label.localeCompare(b.label);
			})
	);

	function openDesaDetail(d: (typeof data.desaList)[number]) {
		selectedDesa = d;
		editDesaLokasiNama = d.lokasiNama || '';
		editDesaLatitude = d.latitude || '';
		editDesaLongitude = d.longitude || '';
		editDesaRadiusMeter = d.radiusMeter || 100;
		editDesaGmapsUrl = d.gmapsUrl || '';
		editDesaLokasiKelompokId = (d as any).lokasiKelompokId || null;
		showDesaDetailModal = true;
	}

	function closeDesaDetail() {
		showDesaDetailModal = false;
		selectedDesa = null;
		editDesaLokasiKelompokId = null;
	}

	function handleConnectToKelompok(val: string | number) {
		if (!val) {
			editDesaLokasiKelompokId = null;
			return;
		}
		const kId = Number(val);
		const targetKelompok = (data.kelompokList || []).find((k: any) => k.id === kId);
		if (!targetKelompok) return;

		editDesaLokasiKelompokId = targetKelompok.id;
		if (targetKelompok.lokasiNama) {
			editDesaLokasiNama = targetKelompok.lokasiNama;
		} else {
			editDesaLokasiNama = `Masjid/Tempat ${targetKelompok.nama}`;
		}
		if (targetKelompok.latitude && targetKelompok.longitude) {
			editDesaLatitude = targetKelompok.latitude;
			editDesaLongitude = targetKelompok.longitude;
		}
		editDesaRadiusMeter = targetKelompok.radiusMeter || 100;
		if (targetKelompok.gmapsUrl) {
			editDesaGmapsUrl = targetKelompok.gmapsUrl;
		} else if (targetKelompok.latitude && targetKelompok.longitude) {
			editDesaGmapsUrl = `https://www.google.com/maps?q=${targetKelompok.latitude},${targetKelompok.longitude}`;
		}
	}

	function handleDisconnectKelompok() {
		editDesaLokasiKelompokId = null;
	}

	// Form Tambah Lama
	let inputNamaDaerah = $state('');
	let inputProvinsi = $state('');
	let inputKotaKabupaten = $state('');

	let inputNamaKelompok = $state('');
	let selectedDesaId = $state<string | number>('');
	let inputKelurahan = $state('');

	let inputNamaDesa = $state('');
	let selectedDaerahId = $state<string | number>('');
	let inputKecamatan = $state('');

	let inputNamaSubKelompok = $state('');
	let selectedKelompokId = $state<string | number>('');
	let inputKeteranganSubKelompok = $state('');

	// Opsi Select
	const daerahOptions = $derived(
		(data.daerahList || []).map((d: (typeof data.daerahList)[number]) => ({
			value: d.id,
			label: d.nama,
			sublabel: d.kotaKabupaten ? `${d.kotaKabupaten}, ${d.provinsi}` : d.provinsi
		}))
	);

	// Cek apakah Daerah input baru
	const isNewDaerah = $derived(
		Boolean(unifiedDaerahValue) &&
		!daerahOptions.some((opt: any) => String(opt.value) === String(unifiedDaerahValue))
	);

	// Opsi Desa terfilter berdasarkan Daerah terpilih
	const desaUnifiedOptions = $derived(
		isNewDaerah || !unifiedDaerahValue
			? []
			: (data.desaList || [])
					.filter((d: (typeof data.desaList)[number]) => String(d.daerahId) === String(unifiedDaerahValue))
					.map((d: (typeof data.desaList)[number]) => ({
						value: d.id,
						label: d.nama,
						sublabel: d.kecamatan ? `Kec. ${d.kecamatan}` : undefined
					}))
	);

	// Cek apakah Desa input baru
	const isNewDesa = $derived(
		Boolean(unifiedDesaValue) &&
		!desaUnifiedOptions.some((opt: any) => String(opt.value) === String(unifiedDesaValue))
	);

	// Opsi Kelompok terfilter berdasarkan Desa terpilih
	const kelompokUnifiedOptions = $derived(
		isNewDesa || !unifiedDesaValue
			? []
			: (data.kelompokList || [])
					.filter((k: (typeof data.kelompokList)[number]) => String(k.desaId) === String(unifiedDesaValue))
					.map((k: (typeof data.kelompokList)[number]) => ({
						value: k.id,
						label: k.nama,
						sublabel: k.kelurahan ? `Kel. ${k.kelurahan}` : undefined
					}))
	);

	// Cek apakah Kelompok input baru
	const isNewKelompok = $derived(
		Boolean(unifiedKelompokValue) &&
		!kelompokUnifiedOptions.some((opt: any) => String(opt.value) === String(unifiedKelompokValue))
	);

	function handleDaerahChange(val: string | number) {
		unifiedDaerahValue = val;
		unifiedDesaValue = '';
		unifiedKelompokValue = '';
	}

	function handleDesaChange(val: string | number) {
		unifiedDesaValue = val;
		unifiedKelompokValue = '';
	}

	const desaOptions = $derived(
		(data.desaList || []).map((d: (typeof data.desaList)[number]) => ({
			value: d.id,
			label: d.nama,
			sublabel: d.daerahNama ? `Daerah ${d.daerahNama}` : undefined
		}))
	);

	const kelompokOptions = $derived(
		(data.kelompokList || []).map((k: (typeof data.kelompokList)[number]) => ({
			value: k.id,
			label: k.nama,
			sublabel: k.desaNama ? `Desa ${k.desaNama}` : undefined
		}))
	);

	// Opsi Filter Desa (Disesuaikan jika Daerah dipilih)
	const filteredDesaFilterOptions = $derived(
		(data.desaList || []).filter((d: (typeof data.desaList)[number]) => {
			if (!selectedFilterDaerahId) return true;
			return String(d.daerahId) === String(selectedFilterDaerahId);
		})
	);

	// Hitung Filter Aktif
	const activeFilterCount = $derived(
		(selectedFilterDaerahId ? 1 : 0) +
			(selectedFilterDesaId ? 1 : 0) +
			(searchQuery.trim() ? 1 : 0)
	);

	function resetFilter() {
		searchQuery = '';
		selectedFilterDaerahId = '';
		selectedFilterDesaId = '';
	}

	// Filter Data Kelompok
	let filteredKelompok = $derived(
		(data.kelompokList || []).filter((k: (typeof data.kelompokList)[number]) => {
			if (selectedFilterDaerahId) {
				const matchDesa = (data.desaList || []).find((d: (typeof data.desaList)[number]) => d.id === k.desaId);
				if (!matchDesa || String(matchDesa.daerahId) !== String(selectedFilterDaerahId)) {
					return false;
				}
			}

			if (selectedFilterDesaId && String(k.desaId) !== String(selectedFilterDesaId)) {
				return false;
			}

			if (searchQuery.trim()) {
				const q = searchQuery.toLowerCase();
				return (
					k.nama.toLowerCase().includes(q) ||
					(k.desaNama || '').toLowerCase().includes(q) ||
					(k.daerahNama || '').toLowerCase().includes(q) ||
					(k.kelurahan || '').toLowerCase().includes(q)
				);
			}

			return true;
		})
	);

	// Filter Data Sub-Kelompok
	let filteredSubKelompok = $derived(
		(data.subKelompokList || []).filter((sk: (typeof data.subKelompokList)[number]) => {
			if (selectedFilterDaerahId) {
				const matchKelompok = (data.kelompokList || []).find((k: (typeof data.kelompokList)[number]) => k.id === sk.kelompokId);
				if (!matchKelompok) return false;
				const matchDesa = (data.desaList || []).find((d: (typeof data.desaList)[number]) => d.id === matchKelompok.desaId);
				if (!matchDesa || String(matchDesa.daerahId) !== String(selectedFilterDaerahId)) {
					return false;
				}
			}

			if (selectedFilterDesaId) {
				const matchKelompok = (data.kelompokList || []).find((k: (typeof data.kelompokList)[number]) => k.id === sk.kelompokId);
				if (!matchKelompok || String(matchKelompok.desaId) !== String(selectedFilterDesaId)) {
					return false;
				}
			}

			if (searchQuery.trim()) {
				const q = searchQuery.toLowerCase();
				return (
					sk.nama.toLowerCase().includes(q) ||
					(sk.kelompokNama || '').toLowerCase().includes(q) ||
					(sk.desaNama || '').toLowerCase().includes(q) ||
					(sk.daerahNama || '').toLowerCase().includes(q) ||
					(sk.keterangan || '').toLowerCase().includes(q)
				);
			}

			return true;
		})
	);

	// Filter Data Desa
	let filteredDesa = $derived(
		(data.desaList || []).filter((d: (typeof data.desaList)[number]) => {
			if (selectedFilterDaerahId && String(d.daerahId) !== String(selectedFilterDaerahId)) {
				return false;
			}

			if (selectedFilterDesaId && String(d.id) !== String(selectedFilterDesaId)) {
				return false;
			}

			if (searchQuery.trim()) {
				const q = searchQuery.toLowerCase();
				return (
					d.nama.toLowerCase().includes(q) ||
					(d.kecamatan || '').toLowerCase().includes(q) ||
					(d.daerahNama || '').toLowerCase().includes(q) ||
					(d.lokasiNama || '').toLowerCase().includes(q)
				);
			}

			return true;
		})
	);

	// State Pagination per Tab Wilayah
	let kelompokPage = $state(1);
	let kelompokPageSize = $state(10);

	let subKelompokPage = $state(1);
	let subKelompokPageSize = $state(10);

	let desaPage = $state(1);
	let desaPageSize = $state(10);

	$effect(() => {
		searchQuery;
		selectedFilterDaerahId;
		selectedFilterDesaId;
		kelompokPage = 1;
		subKelompokPage = 1;
		desaPage = 1;
	});

	let paginatedKelompok = $derived(
		filteredKelompok.slice((kelompokPage - 1) * kelompokPageSize, kelompokPage * kelompokPageSize)
	);

	let paginatedSubKelompok = $derived(
		filteredSubKelompok.slice((subKelompokPage - 1) * subKelompokPageSize, subKelompokPage * subKelompokPageSize)
	);

	let paginatedDesa = $derived(
		filteredDesa.slice((desaPage - 1) * desaPageSize, desaPage * desaPageSize)
	);

	// Reset forms
	function resetAddDaerahForm() {
		inputNamaDaerah = '';
		inputProvinsi = '';
		inputKotaKabupaten = '';
	}

	function resetAddKelompokForm() {
		inputNamaKelompok = '';
		selectedDesaId = '';
		inputKelurahan = '';
	}

	function resetAddDesaForm() {
		inputNamaDesa = '';
		selectedDaerahId = '';
		inputKecamatan = '';
	}

	function resetAddSubKelompokForm() {
		inputNamaSubKelompok = '';
		selectedKelompokId = '';
		inputKeteranganSubKelompok = '';
	}

	function closeAddDaerahModal() {
		showAddDaerahModal = false;
	}

	function closeAddKelompokModal() {
		showAddKelompokModal = false;
	}

	function closeAddDesaModal() {
		showAddDesaModal = false;
	}

	function closeAddSubKelompokModal() {
		showAddSubKelompokModal = false;
	}

	// State Checklist Seleksi Hapus Kelompok & Sub-Kelompok
	let selectedKelompokIds = $state<number[]>([]);
	let selectedSubKelompokIds = $state<number[]>([]);

	// State Modal Konfirmasi Hapus
	let showDeleteConfirmModal = $state(false);
	let deleteTarget = $state<{
		type: 'singleKelompok' | 'batchKelompok' | 'singleSubKelompok' | 'batchSubKelompok';
		id?: number;
		nama?: string;
		count?: number;
		totalJamaah?: number;
	} | null>(null);

	function toggleSelectKelompok(id: number) {
		if (selectedKelompokIds.includes(id)) {
			selectedKelompokIds = selectedKelompokIds.filter((kId) => kId !== id);
		} else {
			selectedKelompokIds = [...selectedKelompokIds, id];
		}
	}

	function toggleSelectAllKelompok() {
		const visibleIds = filteredKelompok.map((k: any) => k.id);
		const allSelected = visibleIds.length > 0 && visibleIds.every((id: number) => selectedKelompokIds.includes(id));
		if (allSelected) {
			selectedKelompokIds = selectedKelompokIds.filter((id: number) => !visibleIds.includes(id));
		} else {
			selectedKelompokIds = Array.from(new Set([...selectedKelompokIds, ...visibleIds]));
		}
	}

	const isAllKelompokSelected = $derived(
		filteredKelompok.length > 0 && filteredKelompok.every((k: any) => selectedKelompokIds.includes(k.id))
	);

	const isSomeKelompokSelected = $derived(
		filteredKelompok.some((k: any) => selectedKelompokIds.includes(k.id)) && !isAllKelompokSelected
	);

	function openDeleteSingleKelompok(k: (typeof data.kelompokList)[number]) {
		deleteTarget = {
			type: 'singleKelompok',
			id: k.id,
			nama: k.nama,
			totalJamaah: k.totalJamaah
		};
		showDeleteConfirmModal = true;
	}

	function openDeleteBatchKelompok() {
		if (selectedKelompokIds.length === 0) return;
		deleteTarget = {
			type: 'batchKelompok',
			count: selectedKelompokIds.length
		};
		showDeleteConfirmModal = true;
	}

	function toggleSelectSubKelompok(id: number) {
		if (selectedSubKelompokIds.includes(id)) {
			selectedSubKelompokIds = selectedSubKelompokIds.filter((skId) => skId !== id);
		} else {
			selectedSubKelompokIds = [...selectedSubKelompokIds, id];
		}
	}

	function toggleSelectAllSubKelompok() {
		const visibleIds = filteredSubKelompok.map((sk: any) => sk.id);
		const allSelected = visibleIds.length > 0 && visibleIds.every((id: number) => selectedSubKelompokIds.includes(id));
		if (allSelected) {
			selectedSubKelompokIds = selectedSubKelompokIds.filter((id: number) => !visibleIds.includes(id));
		} else {
			selectedSubKelompokIds = Array.from(new Set([...selectedSubKelompokIds, ...visibleIds]));
		}
	}

	const isAllSubKelompokSelected = $derived(
		filteredSubKelompok.length > 0 && filteredSubKelompok.every((sk: any) => selectedSubKelompokIds.includes(sk.id))
	);

	const isSomeSubKelompokSelected = $derived(
		filteredSubKelompok.some((sk: any) => selectedSubKelompokIds.includes(sk.id)) && !isAllSubKelompokSelected
	);

	function openDeleteSingleSubKelompok(sk: (typeof data.subKelompokList)[number]) {
		deleteTarget = {
			type: 'singleSubKelompok',
			id: sk.id,
			nama: sk.nama
		};
		showDeleteConfirmModal = true;
	}

	function openDeleteBatchSubKelompok() {
		if (selectedSubKelompokIds.length === 0) return;
		deleteTarget = {
			type: 'batchSubKelompok',
			count: selectedSubKelompokIds.length
		};
		showDeleteConfirmModal = true;
	}

	function closeDeleteModal() {
		showDeleteConfirmModal = false;
		deleteTarget = null;
	}

	$effect(() => {
		if (form?.success) {
			resetUnifiedAddForm();
			showUnifiedAddModal = false;
			resetAddDaerahForm();
			resetAddKelompokForm();
			resetAddDesaForm();
			resetAddSubKelompokForm();
			showAddDaerahModal = false;
			showAddKelompokModal = false;
			showAddDesaModal = false;
			showAddSubKelompokModal = false;
			showDeleteConfirmModal = false;
			deleteTarget = null;
			selectedKelompokIds = [];
			selectedSubKelompokIds = [];
			showKelompokDetailModal = false;
			showEditKelompokModal = false;
			selectedKelompokToEdit = null;
			showEditDesaModal = false;
			selectedDesaToEdit = null;
			showEditSubKelompokModal = false;
			selectedSubKelompokToEdit = null;
		}
	});
</script>

<svelte:head>
	<title>Data Wilayah - Admin Satu Generus</title>
</svelte:head>

<div class="space-y-5 max-w-[100vw] overflow-x-hidden p-2 sm:p-4">
	<!-- Page Header & Action Bar -->
	<div
		class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card border border-border p-4 rounded-xl shadow-xs"
	>
		<div>
			<h1 class="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
				<MapPin class="w-5 h-5 text-primary" />
				<span>Data Wilayah Jamaah</span>
			</h1>
			<p class="text-xs text-foreground/60 mt-0.5">
				Kelola struktur data wilayah berjenjang: Daerah &rarr; Desa &rarr; Kelompok &rarr; Sub-Kelompok.
			</p>
		</div>

		<div class="flex items-center gap-2 flex-wrap">
			<!-- Badge Scope Wewenang Admin -->
			{#if data.adminScope}
				<div
					class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium bg-muted/40 text-foreground/80 border-border"
				>
					<ShieldCheck class="w-3.5 h-3.5 text-primary" />
					<span>Scope: <strong class="text-foreground">{data.adminScope?.level ?? '-'}</strong></span>
					{#if data.adminScope?.level === 'Desa' && (data.desaList?.length ?? 0) > 0}
						<span class="text-foreground/50">({data.desaList.map((d: any) => d.nama).join(', ')})</span>
					{:else if data.adminScope?.level === 'Daerah' && (data.daerahList?.length ?? 0) > 0}
						<span class="text-foreground/50">({data.daerahList.map((d: any) => d.nama).join(', ')})</span>
					{:else if data.adminScope?.level === 'Kelompok' && (data.kelompokList?.length ?? 0) > 0}
						<span class="text-foreground/50">({data.kelompokList.map((k: any) => k.nama).join(', ')})</span>
					{:else if data.adminScope?.isPusat}
						<span class="text-foreground/50">(Seluruh Wilayah)</span>
					{/if}
				</div>
			{/if}

			{#if data.permissions?.canBatchInsert}
				<a
					href="/admin/wilayah/batch"
					class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary/40 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold transition-all shadow-xs"
				>
					<FileSpreadsheet class="w-3.5 h-3.5" />
					<span>Batch Insert Wilayah</span>
				</a>
			{/if}

			<button
				type="button"
				onclick={openUnifiedAddModal}
				class="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold transition-all shadow-xs cursor-pointer active:scale-95"
			>
				<Plus class="w-4 h-4" />
				<span>+ Tambah Wilayah</span>
			</button>
		</div>
	</div>

	<!-- Notifikasi Feedback Form -->
	{#if form?.error}
		<div
			class="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-xl flex items-center gap-2"
		>
			<span>{form.error}</span>
		</div>
	{/if}
	{#if form?.success}
		<div
			class="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs rounded-xl flex items-center gap-2 font-medium"
		>
			<span>{form.message || 'Data wilayah berhasil disimpan ke sistem.'}</span>
		</div>
	{/if}

	<!-- Dashboard Metrik Data Wilayah (Daerah, Desa, Kelompok, Sub-Kelompok) -->
	<div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
		<!-- 1. Daerah -->
		<div class="bg-card border border-border rounded-xl p-3.5 sm:p-4 shadow-xs flex items-center justify-between">
			<div>
				<p class="text-[11px] font-semibold text-foreground/60 uppercase tracking-wider">Daerah</p>
				<p class="text-xl sm:text-2xl font-bold text-foreground mt-0.5">{data.daerahList?.length ?? 0}</p>
				<p class="text-[10.5px] text-foreground/50 mt-0.5">Kota / Kabupaten</p>
			</div>
			<div class="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
				<MapPin class="w-5 h-5" />
			</div>
		</div>

		<!-- 2. Desa -->
		<button
			type="button"
			onclick={() => (activeTab = 'desa')}
			class="bg-card border border-border rounded-xl p-3.5 sm:p-4 shadow-xs flex items-center justify-between text-left hover:border-accent transition-all cursor-pointer {activeTab === 'desa' ? 'ring-2 ring-accent/40 bg-accent/5' : ''}"
		>
			<div>
				<p class="text-[11px] font-semibold text-foreground/60 uppercase tracking-wider">Desa</p>
				<p class="text-xl sm:text-2xl font-bold text-foreground mt-0.5">{data.desaList?.length ?? 0}</p>
				<p class="text-[10.5px] text-foreground/50 mt-0.5">Kecamatan</p>
			</div>
			<div class="w-10 h-10 rounded-xl bg-accent/20 text-accent flex items-center justify-center shrink-0">
				<Building class="w-5 h-5" />
			</div>
		</button>

		<!-- 3. Kelompok -->
		<button
			type="button"
			onclick={() => (activeTab = 'kelompok')}
			class="bg-card border border-border rounded-xl p-3.5 sm:p-4 shadow-xs flex items-center justify-between text-left hover:border-primary transition-all cursor-pointer {activeTab === 'kelompok' ? 'ring-2 ring-primary/40 bg-primary/5' : ''}"
		>
			<div>
				<p class="text-[11px] font-semibold text-foreground/60 uppercase tracking-wider">Kelompok</p>
				<p class="text-xl sm:text-2xl font-bold text-foreground mt-0.5">{data.kelompokList?.length ?? 0}</p>
				<p class="text-[10.5px] text-foreground/50 mt-0.5">Basis Jamaah</p>
			</div>
			<div class="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center text-foreground/70 shrink-0">
				<Home class="w-5 h-5" />
			</div>
		</button>

		<!-- 4. Sub-Kelompok -->
		<button
			type="button"
			onclick={() => (activeTab = 'subKelompok')}
			class="bg-card border border-border rounded-xl p-3.5 sm:p-4 shadow-xs flex items-center justify-between text-left hover:border-blue-500 transition-all cursor-pointer {activeTab === 'subKelompok' ? 'ring-2 ring-blue-500/40 bg-blue-500/5' : ''}"
		>
			<div>
				<p class="text-[11px] font-semibold text-foreground/60 uppercase tracking-wider">Sub-Kelompok</p>
				<p class="text-xl sm:text-2xl font-bold text-foreground mt-0.5">{data.subKelompokList?.length ?? 0}</p>
				<p class="text-[10.5px] text-foreground/50 mt-0.5">Rukun / Lingkungan</p>
			</div>
			<div class="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
				<Layers class="w-5 h-5" />
			</div>
		</button>
	</div>

	<!-- ============================================================== -->
	<!-- FILTER DATA WILAYAH: LENGKAP DI DESKTOP, COLLAPSE DI MOBILE -->
	<!-- ============================================================== -->
	<div class="bg-card border border-border rounded-xl shadow-xs overflow-hidden">
		<!-- Desktop Filter Bar & Mobile Header -->
		<div class="p-3.5 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
			<!-- Input Pencarian (Selalu Tampil) -->
			<div class="relative flex-1 max-w-md">
				<Search class="w-4 h-4 text-foreground/40 absolute left-3 top-1/2 -translate-y-1/2" />
				<input
					type="search"
					placeholder="Cari nama kelompok, sub-kelompok, desa, daerah..."
					bind:value={searchQuery}
					class="w-full bg-secondary/50 border border-border rounded-lg pl-9 pr-3 py-2 text-xs text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary focus:bg-background transition-all"
				/>
			</div>

			<!-- Mobile Filter Toggle Button (Hanya Muncul di Layar Mobile/Tablet) -->
			<div class="flex md:hidden items-center justify-between gap-2">
				<button
					type="button"
					onclick={() => (showMobileFilter = !showMobileFilter)}
					class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-secondary/50 text-xs font-semibold text-foreground transition-colors"
				>
					<SlidersHorizontal class="w-3.5 h-3.5 text-primary" />
					<span>Filter Data</span>
					{#if activeFilterCount > 0}
						<span class="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-bold">
							{activeFilterCount}
						</span>
					{/if}
					{#if showMobileFilter}
						<ChevronUp class="w-3.5 h-3.5 text-foreground/60" />
					{:else}
						<ChevronDown class="w-3.5 h-3.5 text-foreground/60" />
					{/if}
				</button>

				{#if activeFilterCount > 0}
					<button
						type="button"
						onclick={resetFilter}
						class="text-[11px] text-destructive hover:underline font-medium inline-flex items-center gap-1"
					>
						<RotateCcw class="w-3 h-3" />
						<span>Reset</span>
					</button>
				{/if}
			</div>

			<!-- Desktop Filter Options (Otomatis Tampil di Desktop, md:flex) -->
			<div class="hidden md:flex items-center gap-2.5 flex-wrap">
				<!-- Filter Daerah -->
				<div class="w-40">
					<select
						bind:value={selectedFilterDaerahId}
						class="w-full bg-secondary/50 border border-border rounded-lg px-2.5 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:bg-background transition-all"
					>
						<option value="">Semua Daerah</option>
						{#each (data.daerahList || []) as d}
							<option value={d.id}>{d.nama}</option>
						{/each}
					</select>
				</div>

				<!-- Filter Desa -->
				<div class="w-44">
					<select
						bind:value={selectedFilterDesaId}
						class="w-full bg-secondary/50 border border-border rounded-lg px-2.5 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:bg-background transition-all"
					>
						<option value="">Semua Desa</option>
						{#each filteredDesaFilterOptions as d}
							<option value={d.id}>{d.nama}</option>
						{/each}
					</select>
				</div>

				<!-- Tombol Reset Filter -->
				{#if activeFilterCount > 0}
					<button
						type="button"
						onclick={resetFilter}
						class="p-2 rounded-lg border border-border hover:bg-destructive/10 text-foreground/60 hover:text-destructive text-xs transition-colors"
						title="Reset Filter"
					>
						<RotateCcw class="w-3.5 h-3.5" />
					</button>
				{/if}
			</div>
		</div>

		<!-- Mobile Filter Accordion (Collapse di Layar Mobile) -->
		{#if showMobileFilter}
			<div class="block md:hidden border-t border-border p-3.5 bg-secondary/20 space-y-3">
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
					<div>
						<label class="block text-[10.5px] font-semibold text-foreground/70 mb-1">
							Saring Berdasarkan Daerah
						</label>
						<select
							bind:value={selectedFilterDaerahId}
							class="w-full bg-card border border-border rounded-lg px-2.5 py-2 text-xs text-foreground focus:ring-1 focus:ring-primary"
						>
							<option value="">Semua Daerah</option>
							{#each (data.daerahList || []) as d}
								<option value={d.id}>{d.nama}</option>
							{/each}
						</select>
					</div>

					<div>
						<label class="block text-[10.5px] font-semibold text-foreground/70 mb-1">
							Saring Berdasarkan Desa
						</label>
						<select
							bind:value={selectedFilterDesaId}
							class="w-full bg-card border border-border rounded-lg px-2.5 py-2 text-xs text-foreground focus:ring-1 focus:ring-primary"
						>
							<option value="">Semua Desa</option>
							{#each filteredDesaFilterOptions as d}
								<option value={d.id}>{d.nama}</option>
							{/each}
						</select>
					</div>
				</div>

				<div class="flex items-center justify-between pt-1">
					<button
						type="button"
						onclick={resetFilter}
						class="text-[11px] text-destructive hover:underline font-medium inline-flex items-center gap-1"
					>
						<RotateCcw class="w-3 h-3" />
						<span>Reset Semua Filter</span>
					</button>

					<button
						type="button"
						onclick={() => (showMobileFilter = false)}
						class="px-3 py-1 rounded-md bg-secondary text-foreground text-xs font-semibold"
					>
						Tutup
					</button>
				</div>
			</div>
		{/if}

		<!-- Tab Tampilan: Kelompok vs Desa vs Sub-Kelompok -->
		<div class="flex items-center gap-1 px-4 border-t border-border bg-secondary/30">
			<button
				type="button"
				onclick={() => (activeTab = 'kelompok')}
				class="py-2.5 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 {activeTab ===
				'kelompok'
					? 'border-primary text-primary'
					: 'border-transparent text-foreground/60 hover:text-foreground'}"
			>
				<Home class="w-3.5 h-3.5" />
				<span>Data Kelompok ({filteredKelompok.length})</span>
			</button>

			<button
				type="button"
				onclick={() => (activeTab = 'desa')}
				class="py-2.5 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 {activeTab ===
				'desa'
					? 'border-primary text-primary'
					: 'border-transparent text-foreground/60 hover:text-foreground'}"
			>
				<Building class="w-3.5 h-3.5" />
				<span>Data Desa ({filteredDesa.length})</span>
			</button>

			<button
				type="button"
				onclick={() => (activeTab = 'subKelompok')}
				class="py-2.5 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 {activeTab ===
				'subKelompok'
					? 'border-primary text-primary'
					: 'border-transparent text-foreground/60 hover:text-foreground'}"
			>
				<Layers class="w-3.5 h-3.5" />
				<span>Data Sub-Kelompok ({filteredSubKelompok.length})</span>
			</button>
		</div>
	</div>

	<!-- ============================================================== -->
	<!-- TABEL DATA: TAB KELOMPOK ATAU TAB SUB-KELOMPOK -->
	<!-- ============================================================== -->
	{#if activeTab === 'kelompok'}
		<!-- Toolbar Aksi Massal Hapus Kelompok -->
		{#if data.permissions?.canDeleteKelompok && selectedKelompokIds.length > 0}
			<div
				class="p-3 bg-destructive/10 border border-destructive/20 rounded-xl flex items-center justify-between gap-3 animate-in fade-in duration-150 shadow-xs"
			>
				<div class="flex items-center gap-2 text-xs font-semibold text-destructive">
					<CheckSquare class="w-4 h-4 shrink-0" />
					<span><strong>{selectedKelompokIds.length}</strong> kelompok dipilih untuk aksi massal</span>
				</div>
				<div class="flex items-center gap-2">
					<button
						type="button"
						onclick={() => (selectedKelompokIds = [])}
						class="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-foreground/70 hover:bg-secondary cursor-pointer transition-colors"
					>
						Batal Pilih
					</button>
					<button
						type="button"
						onclick={openDeleteBatchKelompok}
						class="px-3 py-1.5 rounded-lg bg-destructive text-destructive-foreground text-xs font-bold hover:bg-destructive/90 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
					>
						<Trash2 class="w-3.5 h-3.5" />
						<span>Hapus Terpilih ({selectedKelompokIds.length})</span>
					</button>
				</div>
			</div>
		{/if}

		<!-- Tampilan Data Kelompok (Dual Presentation: Mobile Compact Cards & Desktop Table) -->
		{#if filteredKelompok.length === 0}
			<div class="bg-card border border-border rounded-xl p-12 text-center text-foreground/50 text-xs">
				Belum ada unit kelompok yang cocok dengan filter atau pencarian.
			</div>
		{:else}
			<!-- 1. Tampilan Mobile (< md): Compact Cards -->
			<div class="md:hidden space-y-3">
				{#each paginatedKelompok as k}
					<div
						class="bg-card border border-border rounded-xl p-3.5 space-y-3 transition-all {selectedKelompokIds.includes(k.id) ? 'border-destructive/40 bg-destructive/5' : ''}"
					>
						<div class="flex items-start justify-between gap-2.5">
							<div class="flex items-center gap-2 min-w-0">
								{#if data.permissions?.canDeleteKelompok}
									<input
										type="checkbox"
										checked={selectedKelompokIds.includes(k.id)}
										onchange={() => toggleSelectKelompok(k.id)}
										class="w-4 h-4 rounded border-border text-primary focus:ring-primary cursor-pointer accent-primary shrink-0"
										aria-label="Pilih kelompok {k.nama}"
									/>
								{/if}
								<div class="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-mono text-[10px] font-bold shrink-0">
									KL
								</div>
								<div class="min-w-0">
									<button
										type="button"
										onclick={() => openKelompokDetail(k)}
										class="text-left font-bold text-foreground text-sm hover:text-primary transition-colors truncate block"
									>
										{k.nama}
									</button>
									<p class="text-[11px] text-foreground/60 truncate">
										{k.desaNama || '-'} &bull; {k.daerahNama || '-'}
									</p>
								</div>
							</div>
							<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-secondary text-foreground/80 shrink-0">
								<Users class="w-3 h-3 text-primary" />
								{k.totalJamaah}
							</span>
						</div>

						<div class="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-border/50">
							<div class="space-y-0.5">
								<span class="text-[10.5px] text-foreground/50 block">Lokasi Basis</span>
								{#if k.latitude && k.longitude}
									<div class="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
										<MapPin class="w-3 h-3 shrink-0" />
										<span class="truncate">{k.lokasiNama || 'Terdaftar'} (&plusmn;{k.radiusMeter || 100}m)</span>
									</div>
								{:else}
									<div class="flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400">
										<MapPin class="w-3 h-3 shrink-0" />
										<span>Belum Diset</span>
									</div>
								{/if}
							</div>

							<div class="space-y-0.5">
								<span class="text-[10.5px] text-foreground/50 block">Sub-Kelompok</span>
								{#if k.totalSubKelompok > 0}
									<button
										type="button"
										onclick={() => {
											searchQuery = k.nama;
											activeTab = 'subKelompok';
										}}
										class="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline"
									>
										<Layers class="w-3 h-3" />
										<span>{k.totalSubKelompok} Sub</span>
									</button>
								{:else}
									<span class="text-[11px] text-foreground/40">-</span>
								{/if}
							</div>
						</div>

						<div class="flex items-center gap-2 pt-2 border-t border-border/50">
							<button
								type="button"
								onclick={() => openEditKelompok(k)}
								class="py-1.5 px-2.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1"
								title="Ubah Data Kelompok"
							>
								<Pencil class="w-3.5 h-3.5" />
								<span>Edit</span>
							</button>
							<button
								type="button"
								onclick={() => openKelompokDetail(k)}
								class="flex-1 py-1.5 px-3 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold transition-colors cursor-pointer text-center"
							>
								Detail & Lokasi
							</button>
							{#if data.permissions?.canDeleteKelompok}
								<button
									type="button"
									onclick={() => openDeleteSingleKelompok(k)}
									class="p-2 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors cursor-pointer shrink-0"
									title="Hapus Kelompok"
								>
									<Trash2 class="w-3.5 h-3.5" />
								</button>
							{/if}
						</div>
					</div>
				{/each}

				<div class="rounded-xl border border-border overflow-hidden">
					<Pagination bind:currentPage={kelompokPage} bind:pageSize={kelompokPageSize} totalItems={filteredKelompok.length} />
				</div>
			</div>

			<!-- 2. Tampilan Desktop (>= md): Tabel Lengkap -->
			<div class="hidden md:block bg-card border border-border rounded-xl overflow-hidden shadow-xs">
				<div class="overflow-x-auto">
					<table class="w-full text-left text-xs">
						<thead class="bg-secondary/60 text-foreground/70 uppercase text-[10px] tracking-wider border-b border-border">
							<tr>
								{#if data.permissions?.canDeleteKelompok}
									<th class="py-3 px-3 w-10 text-center">
										<input
											type="checkbox"
											checked={isAllKelompokSelected}
											indeterminate={isSomeKelompokSelected}
											onchange={toggleSelectAllKelompok}
											class="w-4 h-4 rounded border-border text-primary focus:ring-primary cursor-pointer accent-primary"
											title="Pilih Semua Kelompok"
										/>
									</th>
								{/if}
								<th class="py-3 px-4 font-semibold">Nama Kelompok</th>
								<th class="py-3 px-4 font-semibold">Lokasi Basis</th>
								<th class="py-3 px-4 font-semibold">Sub-Kelompok</th>
								<th class="py-3 px-4 font-semibold">Kelurahan / Domisili</th>
								<th class="py-3 px-4 font-semibold">Desa Induk</th>
								<th class="py-3 px-4 font-semibold">Daerah Induk</th>
								<th class="py-3 px-4 font-semibold text-right">Populasi Jamaah</th>
								<th class="py-3 px-4 font-semibold text-center">Aksi</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-border">
							{#each paginatedKelompok as k}
								<tr
									onclick={() => openKelompokDetail(k)}
									class="hover:bg-secondary/40 transition-colors cursor-pointer group {selectedKelompokIds.includes(k.id) ? 'bg-destructive/5' : ''}"
								>
									{#if data.permissions?.canDeleteKelompok}
										<td class="py-3.5 px-3 text-center" onclick={(e) => e.stopPropagation()}>
											<input
												type="checkbox"
												checked={selectedKelompokIds.includes(k.id)}
												onchange={() => toggleSelectKelompok(k.id)}
												class="w-4 h-4 rounded border-border text-primary focus:ring-primary cursor-pointer accent-primary"
											/>
										</td>
									{/if}

									<td class="py-3.5 px-4 font-semibold text-foreground flex items-center gap-2">
										<div class="w-6 h-6 rounded bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors flex items-center justify-center font-mono text-[10px] shrink-0">
											KL
										</div>
										<span class="group-hover:text-primary transition-colors">{k.nama}</span>
									</td>

									<!-- Kolom Status Lokasi Basis Kelompok -->
									<td class="py-3.5 px-4">
										{#if k.latitude && k.longitude}
											<div class="space-y-0.5">
												<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
													<MapPin class="w-3 h-3 text-emerald-600 shrink-0" />
													<span class="truncate max-w-[130px]">{k.lokasiNama || 'Lokasi Terdaftar'}</span>
												</span>
												<span class="block text-[9.5px] text-foreground/50 font-mono pl-1">
													Radius: &plusmn;{k.radiusMeter || 100}m
												</span>
											</div>
										{:else}
											<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-medium bg-amber-500/10 text-amber-700 dark:text-amber-300">
												<MapPin class="w-3 h-3 text-amber-600/60 shrink-0" />
												<span>Belum Diset</span>
											</span>
										{/if}
									</td>

									<td class="py-3.5 px-4">
										{#if k.totalSubKelompok > 0}
											<button
												type="button"
												onclick={(e) => {
													e.stopPropagation();
													searchQuery = k.nama;
													activeTab = 'subKelompok';
												}}
												class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-blue-500/10 text-blue-700 dark:text-blue-300 hover:bg-blue-500/20 transition-colors"
											>
												<Layers class="w-3 h-3" />
												<span>{k.totalSubKelompok} Sub-Kelompok</span>
											</button>
										{:else}
											<span class="text-foreground/40 text-[11px]">-</span>
										{/if}
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
									<td class="py-3.5 px-4 text-center">
										<div class="flex items-center justify-center gap-1.5" onclick={(e) => e.stopPropagation()}>
											<button
												type="button"
												onclick={() => openEditKelompok(k)}
												class="px-2 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 text-[10.5px] font-bold transition-colors cursor-pointer flex items-center gap-1"
												title="Ubah Data Kelompok"
											>
												<Pencil class="w-3 h-3" />
												<span>Edit</span>
											</button>

											<button
												type="button"
												onclick={() => openKelompokDetail(k)}
												class="px-2.5 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-[10.5px] font-bold transition-colors cursor-pointer"
											>
												Detail & Lokasi
											</button>

											{#if data.permissions?.canDeleteKelompok}
												<button
													type="button"
													onclick={() => openDeleteSingleKelompok(k)}
													class="p-1 rounded-lg hover:bg-destructive/10 text-foreground/50 hover:text-destructive transition-colors cursor-pointer"
													title="Hapus Kelompok"
												>
													<Trash2 class="w-3.5 h-3.5" />
												</button>
											{/if}
										</div>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
				<Pagination bind:currentPage={kelompokPage} bind:pageSize={kelompokPageSize} totalItems={filteredKelompok.length} />
			</div>
		{/if}
	{:else if activeTab === 'subKelompok'}
		<!-- Toolbar Aksi Massal Hapus Sub-Kelompok -->
		{#if data.permissions?.canDeleteSubKelompok && selectedSubKelompokIds.length > 0}
			<div
				class="p-3 bg-destructive/10 border border-destructive/20 rounded-xl flex items-center justify-between gap-3 animate-in fade-in duration-150 shadow-xs"
			>
				<div class="flex items-center gap-2 text-xs font-semibold text-destructive">
					<CheckSquare class="w-4 h-4 shrink-0" />
					<span><strong>{selectedSubKelompokIds.length}</strong> sub-kelompok dipilih untuk aksi massal</span>
				</div>
				<div class="flex items-center gap-2">
					<button
						type="button"
						onclick={() => (selectedSubKelompokIds = [])}
						class="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-foreground/70 hover:bg-secondary cursor-pointer transition-colors"
					>
						Batal Pilih
					</button>
					<button
						type="button"
						onclick={openDeleteBatchSubKelompok}
						class="px-3 py-1.5 rounded-lg bg-destructive text-destructive-foreground text-xs font-bold hover:bg-destructive/90 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
					>
						<Trash2 class="w-3.5 h-3.5" />
						<span>Hapus Terpilih ({selectedSubKelompokIds.length})</span>
					</button>
				</div>
			</div>
		{/if}

		<!-- Tampilan Data Sub-Kelompok (Dual Presentation: Mobile Compact Cards & Desktop Table) -->
		{#if filteredSubKelompok.length === 0}
			<div class="bg-card border border-border rounded-xl p-12 text-center text-foreground/50 text-xs">
				Belum ada unit sub-kelompok yang cocok dengan filter atau pencarian.
			</div>
		{:else}
			<!-- 1. Tampilan Mobile (< md): Compact Cards -->
			<div class="md:hidden space-y-3">
				{#each paginatedSubKelompok as sk}
					<div
						class="bg-card border border-border rounded-xl p-3.5 space-y-2.5 transition-all {selectedSubKelompokIds.includes(sk.id) ? 'border-destructive/40 bg-destructive/5' : ''}"
					>
						<div class="flex items-start justify-between gap-2.5">
							<div class="flex items-center gap-2 min-w-0">
								{#if data.permissions?.canDeleteSubKelompok}
									<input
										type="checkbox"
										checked={selectedSubKelompokIds.includes(sk.id)}
										onchange={() => toggleSelectSubKelompok(sk.id)}
										class="w-4 h-4 rounded border-border text-primary focus:ring-primary cursor-pointer accent-primary shrink-0"
										aria-label="Pilih sub-kelompok {sk.nama}"
									/>
								{/if}
								<div class="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-mono text-[10px] font-bold shrink-0">
									SK
								</div>
								<div class="min-w-0">
									<span class="font-bold text-foreground text-sm truncate block">{sk.nama}</span>
									<p class="text-[11px] text-foreground/60 truncate">
										Kelompok: <span class="font-semibold text-foreground/80">{sk.kelompokNama || '-'}</span>
									</p>
								</div>
							</div>
							<div class="flex items-center gap-1 shrink-0">
								<button
									type="button"
									onclick={() => openEditSubKelompok(sk)}
									class="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-colors cursor-pointer"
									title="Ubah Sub-Kelompok"
								>
									<Pencil class="w-3.5 h-3.5" />
								</button>
								{#if data.permissions?.canDeleteSubKelompok}
									<button
										type="button"
										onclick={() => openDeleteSingleSubKelompok(sk)}
										class="p-2 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors cursor-pointer"
										title="Hapus Sub-Kelompok"
									>
										<Trash2 class="w-3.5 h-3.5" />
									</button>
								{/if}
							</div>
						</div>

						<div class="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-border/50">
							<div class="space-y-0.5">
								<span class="text-[10.5px] text-foreground/50 block">Keterangan / Rukun</span>
								<span class="text-[11.5px] text-foreground/80">{sk.keterangan || '-'}</span>
							</div>
							<div class="space-y-0.5">
								<span class="text-[10.5px] text-foreground/50 block">Desa & Daerah</span>
								<span class="text-[11px] text-foreground/60 truncate block">{sk.desaNama || '-'} &bull; {sk.daerahNama || '-'}</span>
							</div>
						</div>
					</div>
				{/each}

				<div class="rounded-xl border border-border overflow-hidden">
					<Pagination bind:currentPage={subKelompokPage} bind:pageSize={subKelompokPageSize} totalItems={filteredSubKelompok.length} />
				</div>
			</div>

			<!-- 2. Tampilan Desktop (>= md): Tabel Lengkap -->
			<div class="hidden md:block bg-card border border-border rounded-xl overflow-hidden shadow-xs">
				<div class="overflow-x-auto">
					<table class="w-full text-left text-xs">
						<thead class="bg-secondary/60 text-foreground/70 uppercase text-[10px] tracking-wider border-b border-border">
							<tr>
								{#if data.permissions?.canDeleteSubKelompok}
									<th class="py-3 px-3 w-10 text-center">
										<input
											type="checkbox"
											checked={isAllSubKelompokSelected}
											indeterminate={isSomeSubKelompokSelected}
											onchange={toggleSelectAllSubKelompok}
											class="w-4 h-4 rounded border-border text-primary focus:ring-primary cursor-pointer accent-primary"
											title="Pilih Semua Sub-Kelompok"
										/>
									</th>
								{/if}
								<th class="py-3 px-4 font-semibold">Nama Sub-Kelompok</th>
								<th class="py-3 px-4 font-semibold">Kelompok Induk</th>
								<th class="py-3 px-4 font-semibold">Keterangan / Rukun</th>
								<th class="py-3 px-4 font-semibold">Desa Induk</th>
								<th class="py-3 px-4 font-semibold">Daerah Induk</th>
								<th class="py-3 px-4 font-semibold text-center">Aksi</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-border">
							{#each paginatedSubKelompok as sk}
								<tr class="hover:bg-secondary/30 transition-colors {selectedSubKelompokIds.includes(sk.id) ? 'bg-destructive/5' : ''}">
									{#if data.permissions?.canDeleteSubKelompok}
										<td class="py-3.5 px-3 text-center" onclick={(e) => e.stopPropagation()}>
											<input
												type="checkbox"
												checked={selectedSubKelompokIds.includes(sk.id)}
												onchange={() => toggleSelectSubKelompok(sk.id)}
												class="w-4 h-4 rounded border-border text-primary focus:ring-primary cursor-pointer accent-primary"
											/>
										</td>
									{/if}

									<td class="py-3.5 px-4 font-semibold text-foreground flex items-center gap-2">
										<div class="w-6 h-6 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-mono text-[10px] shrink-0">
											SK
										</div>
										<span>{sk.nama}</span>
									</td>
									<td class="py-3.5 px-4 font-medium text-foreground">{sk.kelompokNama || '-'}</td>
									<td class="py-3.5 px-4 text-foreground/70">{sk.keterangan || '-'}</td>
									<td class="py-3.5 px-4 text-foreground/70">{sk.desaNama || '-'}</td>
									<td class="py-3.5 px-4 text-foreground/60">{sk.daerahNama || '-'}</td>

									<td class="py-3.5 px-4 text-center">
										<div class="flex items-center justify-center gap-1.5" onclick={(e) => e.stopPropagation()}>
											<button
												type="button"
												onclick={() => openEditSubKelompok(sk)}
												class="px-2 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 text-[10.5px] font-bold transition-colors cursor-pointer flex items-center gap-1"
												title="Ubah Sub-Kelompok"
											>
												<Pencil class="w-3 h-3" />
												<span>Edit</span>
											</button>

											{#if data.permissions?.canDeleteSubKelompok}
												<button
													type="button"
													onclick={() => openDeleteSingleSubKelompok(sk)}
													class="p-1 rounded-lg hover:bg-destructive/10 text-foreground/50 hover:text-destructive transition-colors cursor-pointer"
													title="Hapus Sub-Kelompok"
												>
													<Trash2 class="w-3.5 h-3.5" />
												</button>
											{/if}
										</div>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
				<Pagination bind:currentPage={subKelompokPage} bind:pageSize={subKelompokPageSize} totalItems={filteredSubKelompok.length} />
			</div>
		{/if}
	{:else if activeTab === 'desa'}
		<!-- Tampilan Data Desa (Dual Presentation: Mobile Compact Cards & Desktop Table) -->
		{#if filteredDesa.length === 0}
			<div class="bg-card border border-border rounded-xl p-12 text-center text-foreground/50 text-xs">
				Belum ada unit desa yang cocok dengan filter atau pencarian.
			</div>
		{:else}
			<!-- 1. Tampilan Mobile (< md): Compact Cards -->
			<div class="md:hidden space-y-3">
				{#each paginatedDesa as d}
					<div
						class="bg-card border border-border rounded-xl p-3.5 space-y-3 transition-all cursor-pointer hover:border-primary/40"
						onclick={() => openDesaDetail(d)}
					>
						<div class="flex items-start justify-between gap-2.5">
							<div class="flex items-center gap-2 min-w-0">
								<div class="w-7 h-7 rounded-lg bg-accent/20 text-accent flex items-center justify-center font-mono text-[10px] font-bold shrink-0">
									DS
								</div>
								<div class="min-w-0">
									<span class="font-bold text-foreground text-sm truncate block">{d.nama}</span>
									<p class="text-[11px] text-foreground/60 truncate">
										{d.kecamatan ? `Kec. ${d.kecamatan} • ` : ''}{d.daerahNama || '-'}
									</p>
								</div>
							</div>
							<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-secondary text-foreground/80 shrink-0">
								<Home class="w-3 h-3 text-primary" />
								{d.totalKelompok ?? 0}
							</span>
						</div>

						<div class="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-border/50">
							<div class="space-y-0.5">
								<span class="text-[10.5px] text-foreground/50 block">Lokasi Basis Desa</span>
								{#if d.latitude && d.longitude}
									<div class="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
										<MapPin class="w-3 h-3 shrink-0" />
										<span class="truncate">{d.lokasiNama || 'Terdaftar'} (&plusmn;{d.radiusMeter || 100}m)</span>
									</div>
								{:else}
									<div class="flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400">
										<MapPin class="w-3 h-3 shrink-0" />
										<span>Belum Diset</span>
									</div>
								{/if}
							</div>

							<div class="space-y-0.5">
								<span class="text-[10.5px] text-foreground/50 block">Daerah Induk</span>
								<span class="text-[11.5px] font-medium text-foreground">{d.daerahNama || '-'}</span>
							</div>
						</div>

						<div class="flex items-center gap-2 pt-2 border-t border-border/50">
							<button
								type="button"
								onclick={(e) => {
									e.stopPropagation();
									openEditDesa(d);
								}}
								class="py-1.5 px-3 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1"
								title="Ubah Data Desa"
							>
								<Pencil class="w-3.5 h-3.5" />
								<span>Edit</span>
							</button>
							<button
								type="button"
								onclick={(e) => {
									e.stopPropagation();
									openDesaDetail(d);
								}}
								class="flex-1 py-1.5 px-3 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold transition-colors cursor-pointer text-center"
							>
								Detail & Lokasi
							</button>
						</div>
					</div>
				{/each}

				<div class="rounded-xl border border-border overflow-hidden">
					<Pagination bind:currentPage={desaPage} bind:pageSize={desaPageSize} totalItems={filteredDesa.length} />
				</div>
			</div>

			<!-- 2. Tampilan Desktop (>= md): Tabel Lengkap -->
			<div class="hidden md:block bg-card border border-border rounded-xl overflow-hidden shadow-xs">
				<div class="overflow-x-auto">
					<table class="w-full text-left text-xs">
						<thead class="bg-secondary/60 text-foreground/70 uppercase text-[10px] tracking-wider border-b border-border">
							<tr>
								<th class="py-3 px-4 font-semibold">Nama Desa</th>
								<th class="py-3 px-4 font-semibold">Lokasi Basis Desa</th>
								<th class="py-3 px-4 font-semibold">Kecamatan</th>
								<th class="py-3 px-4 font-semibold">Daerah Induk</th>
								<th class="py-3 px-4 font-semibold text-center">Jumlah Kelompok</th>
								<th class="py-3 px-4 font-semibold text-right">Aksi</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-border">
							{#each paginatedDesa as d}
								<tr
									onclick={() => openDesaDetail(d)}
									class="hover:bg-secondary/30 transition-colors cursor-pointer group"
								>
									<td class="py-3.5 px-4 font-semibold text-foreground flex items-center gap-2">
										<div class="w-6 h-6 rounded bg-accent/20 text-accent group-hover:bg-accent group-hover:text-accent-foreground transition-colors flex items-center justify-center font-mono text-[10px] shrink-0">
											DS
										</div>
										<span class="group-hover:text-primary transition-colors">{d.nama}</span>
									</td>

									<!-- Kolom Status Lokasi Basis Desa -->
									<td class="py-3.5 px-4">
										{#if d.latitude && d.longitude}
											<div class="space-y-0.5">
												<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
													<MapPin class="w-3 h-3 text-emerald-600 shrink-0" />
													<span class="truncate max-w-[130px]">{d.lokasiNama || 'Lokasi Terdaftar'}</span>
												</span>
												<span class="block text-[9.5px] text-foreground/50 font-mono pl-1">
													Radius: &plusmn;{d.radiusMeter || 100}m
												</span>
											</div>
										{:else}
											<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-medium bg-amber-500/10 text-amber-700 dark:text-amber-300">
												<MapPin class="w-3 h-3 text-amber-600/60 shrink-0" />
												<span>Belum Diset</span>
											</span>
										{/if}
									</td>

									<td class="py-3.5 px-4 text-foreground/70">{d.kecamatan || '-'}</td>
									<td class="py-3.5 px-4 font-medium text-foreground">{d.daerahNama || '-'}</td>

									<td class="py-3.5 px-4 text-center">
										<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-secondary text-foreground/80">
											<Home class="w-3 h-3" />
											<span>{d.totalKelompok ?? 0} Kelompok</span>
										</span>
									</td>

									<td class="py-3.5 px-4 text-right">
										<div class="flex items-center justify-end gap-1.5" onclick={(e) => e.stopPropagation()}>
											<button
												type="button"
												onclick={(e) => {
													e.stopPropagation();
													openEditDesa(d);
												}}
												class="px-2 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 text-[10.5px] font-bold transition-colors cursor-pointer flex items-center gap-1"
												title="Ubah Data Desa"
											>
												<Pencil class="w-3 h-3" />
												<span>Edit</span>
											</button>
											<button
												type="button"
												onclick={(e) => {
													e.stopPropagation();
													openDesaDetail(d);
												}}
												class="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer"
											>
												Detail & Lokasi
											</button>
										</div>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
				<Pagination bind:currentPage={desaPage} bind:pageSize={desaPageSize} totalItems={filteredDesa.length} />
			</div>
		{/if}
	{/if}
</div>

<!-- Modal Tambah Data Wilayah Cerdas & Bertingkat (Unified Wilayah Creator) -->
{#if showUnifiedAddModal}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-background/80 backdrop-blur-sm overflow-y-auto"
		role="dialog"
		aria-modal="true"
		aria-labelledby="modal-unified-title"
	>
		<div class="bg-card border border-border rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-4 my-8 transition-all animate-in zoom-in-95 duration-150">
			<!-- Header Modal -->
			<div class="flex items-center justify-between pb-3 border-b border-border">
				<div class="flex items-center gap-2.5">
					<div class="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
						<Plus class="w-4 h-4" />
					</div>
					<div>
						<h3 id="modal-unified-title" class="text-sm font-bold text-foreground">
							Tambah Data Wilayah
						</h3>
						<p class="text-[11px] text-foreground/60">
							Pilih wilayah yang sudah ada atau ketik nama baru untuk membuat otomatis
						</p>
					</div>
				</div>
				<button
					type="button"
					onclick={closeUnifiedAddModal}
					class="p-1 rounded-lg hover:bg-secondary text-foreground/60 hover:text-foreground cursor-pointer transition-colors"
					aria-label="Tutup Modal"
				>
					<X class="w-5 h-5" />
				</button>
			</div>

			<!-- Form Submission -->
			<form
				method="POST"
				action="?/createWilayah"
				use:enhance={keepScrollSubmit({ onSuccess: () => closeUnifiedAddModal() })}
				class="space-y-3.5"
			>
				<!-- LEVEL 1: DAERAH -->
				<div class="space-y-1.5 p-3 rounded-xl bg-secondary/20 border border-border/60">
					<div class="flex items-center justify-between">
						<label for="unifiedDaerah" class="block text-xs font-bold text-foreground">
							1. Daerah (Kota / Kabupaten) *
						</label>
						{#if isNewDaerah}
							<span class="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
								✨ Buat Daerah Baru
							</span>
						{/if}
					</div>

					{#if (data.daerahList?.length ?? 0) === 1 && !data.permissions?.canCreateDaerah}
						<div class="px-3 py-2 bg-secondary/40 border border-border rounded-lg text-xs font-semibold text-foreground flex items-center justify-between">
							<span>{data.daerahList[0].nama}</span>
							<span class="text-[10.5px] text-foreground/50 font-normal">Daerah Binaan Anda</span>
						</div>
						<input type="hidden" name="daerahValue" value={data.daerahList[0].id} />
					{:else}
						<SearchableSelect
							id="unifiedDaerah"
							name="daerahValue"
							options={daerahOptions}
							bind:value={unifiedDaerahValue}
							onchange={handleDaerahChange}
							allowCustom={Boolean(data.permissions?.canCreateDaerah)}
							customLabel="Daerah Baru"
							required
							placeholder="-- Cari / Pilih Daerah atau ketik Daerah Baru --"
							searchPlaceholder="Cari atau ketik nama daerah baru..."
						/>
					{/if}

					<!-- Bidang Ekstra jika Daerah Baru -->
					{#if isNewDaerah}
						<div class="pt-2 grid grid-cols-2 gap-2 text-xs">
							<div>
								<label for="daerahKotaKabupaten" class="block text-[11px] text-foreground/70 mb-1">
									Kota / Kabupaten
								</label>
								<input
									id="daerahKotaKabupaten"
									name="daerahKotaKabupaten"
									type="text"
									bind:value={unifiedDaerahKotaKabupaten}
									placeholder={String(unifiedDaerahValue)}
									class="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
								/>
							</div>
							<div>
								<label for="daerahProvinsi" class="block text-[11px] text-foreground/70 mb-1">
									Provinsi
								</label>
								<input
									id="daerahProvinsi"
									name="daerahProvinsi"
									type="text"
									bind:value={unifiedDaerahProvinsi}
									placeholder="Contoh: Jawa Timur"
									class="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
								/>
							</div>
						</div>
					{/if}
				</div>

				<!-- LEVEL 2: DESA -->
				<div class="space-y-1.5 p-3 rounded-xl bg-secondary/20 border border-border/60">
					<div class="flex items-center justify-between">
						<label for="unifiedDesa" class="block text-xs font-bold text-foreground">
							2. Desa Induk (Kecamatan / Wilayah)
						</label>
						{#if isNewDesa}
							<span class="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
								✨ Buat Desa Baru
							</span>
						{/if}
					</div>

					<SearchableSelect
						id="unifiedDesa"
						name="desaValue"
						options={desaUnifiedOptions}
						bind:value={unifiedDesaValue}
						onchange={handleDesaChange}
						allowCustom={Boolean(data.permissions?.canCreateDesa)}
						customLabel="Desa Baru"
						disabled={!unifiedDaerahValue}
						placeholder={!unifiedDaerahValue ? '-- Pilih Daerah terlebih dahulu --' : '-- Cari / Pilih Desa atau ketik Desa Baru (Opsional) --'}
						searchPlaceholder="Cari atau ketik nama desa baru..."
					/>

					<!-- Bidang Ekstra jika Desa Baru -->
					{#if isNewDesa}
						<div class="pt-2 text-xs">
							<label for="desaKecamatan" class="block text-[11px] text-foreground/70 mb-1">
								Kecamatan Administratif (Opsional)
							</label>
							<input
								id="desaKecamatan"
								name="desaKecamatan"
								type="text"
								bind:value={unifiedDesaKecamatan}
								placeholder="Contoh: Kebayoran Baru"
								class="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
							/>
						</div>
					{/if}
				</div>

				<!-- LEVEL 3: KELOMPOK -->
				<div class="space-y-1.5 p-3 rounded-xl bg-secondary/20 border border-border/60">
					<div class="flex items-center justify-between">
						<label for="unifiedKelompok" class="block text-xs font-bold text-foreground">
							3. Kelompok (Unit Basis Jamaah)
						</label>
						{#if isNewKelompok}
							<span class="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
								✨ Buat Kelompok Baru
							</span>
						{/if}
					</div>

					<SearchableSelect
						id="unifiedKelompok"
						name="kelompokValue"
						options={kelompokUnifiedOptions}
						bind:value={unifiedKelompokValue}
						allowCustom={Boolean(data.permissions?.canCreateKelompok)}
						customLabel="Kelompok Baru"
						disabled={!unifiedDesaValue}
						placeholder={!unifiedDesaValue ? '-- Pilih Desa terlebih dahulu --' : '-- Cari / Pilih Kelompok atau ketik Kelompok Baru (Opsional) --'}
						searchPlaceholder="Cari atau ketik nama kelompok baru..."
					/>

					<!-- Bidang Ekstra jika Kelompok Baru -->
					{#if isNewKelompok}
						<div class="pt-2 text-xs">
							<label for="kelompokKelurahan" class="block text-[11px] text-foreground/70 mb-1">
								Kelurahan / Domisili (Opsional)
							</label>
							<input
								id="kelompokKelurahan"
								name="kelompokKelurahan"
								type="text"
								bind:value={unifiedKelompokKelurahan}
								placeholder="Contoh: Kelurahan Sawunggaling"
								class="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
							/>
						</div>
					{/if}
				</div>

				<!-- LEVEL 4: SUB-KELOMPOK (Opsional) -->
				<div class="space-y-1.5 p-3 rounded-xl bg-secondary/20 border border-border/60">
					<label for="unifiedSubKelompokNama" class="block text-xs font-bold text-foreground">
						4. Sub-Kelompok (Opsional)
					</label>
					<div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
						<div>
							<input
								id="unifiedSubKelompokNama"
								name="subKelompokNama"
								type="text"
								bind:value={unifiedSubKelompokNama}
								disabled={!unifiedKelompokValue}
								placeholder={!unifiedKelompokValue ? 'Pilih Kelompok dahulu...' : 'Nama Sub-Kelompok (misal: Pemuda)'}
								class="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
							/>
						</div>
						<div>
							<input
								id="unifiedSubKelompokKeterangan"
								name="subKelompokKeterangan"
								type="text"
								bind:value={unifiedSubKelompokKeterangan}
								disabled={!unifiedKelompokValue || !unifiedSubKelompokNama}
								placeholder="Keterangan rukun / wilayah"
								class="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
							/>
						</div>
					</div>
				</div>

				<!-- Ringkasan Rencana Pembuatan Data (Smart Preview) -->
				{#if isNewDaerah || isNewDesa || isNewKelompok || unifiedSubKelompokNama}
					<div class="p-3 rounded-xl bg-primary/5 border border-primary/20 text-xs space-y-1.5 animate-in fade-in duration-150">
						<p class="font-bold text-primary flex items-center gap-1.5">
							<CheckCircle2 class="w-3.5 h-3.5" />
							<span>Rencana Pembuatan Data Wilayah:</span>
						</p>
						<ul class="text-[11px] text-foreground/80 space-y-1 list-disc list-inside">
							{#if isNewDaerah}
								<li>Membuat Daerah baru: <strong class="text-foreground">{unifiedDaerahValue}</strong></li>
							{/if}
							{#if isNewDesa}
								<li>Membuat Desa baru: <strong class="text-foreground">{unifiedDesaValue}</strong></li>
							{/if}
							{#if isNewKelompok}
								<li>Membuat Kelompok baru: <strong class="text-foreground">{unifiedKelompokValue}</strong></li>
							{/if}
							{#if unifiedSubKelompokNama}
								<li>Membuat Sub-Kelompok baru: <strong class="text-foreground">{unifiedSubKelompokNama}</strong></li>
							{/if}
						</ul>
					</div>
				{/if}

				<!-- Tombol Footer -->
				<div class="flex items-center justify-end gap-2 pt-3 border-t border-border">
					<button
						type="button"
						onclick={closeUnifiedAddModal}
						class="px-4 py-2 rounded-lg border border-border text-xs font-semibold text-foreground/80 hover:bg-secondary cursor-pointer transition-colors"
					>
						Batal
					</button>
					<button
						type="submit"
						class="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 cursor-pointer shadow-xs transition-all active:scale-95"
					>
						Simpan Wilayah
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- Modal Detail & Pengaturan Lokasi Kelompok -->
{#if showKelompokDetailModal && selectedKelompok}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-background/80 backdrop-blur-sm"
		role="dialog"
		aria-modal="true"
		tabindex="-1"
		onclick={(e) => {
			if (e.target === e.currentTarget) closeKelompokDetail();
		}}
		onkeydown={(e) => {
			if (e.key === 'Escape') closeKelompokDetail();
		}}
	>
		<div
			class="bg-card border border-border rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
		>
			<!-- Modal Header -->
			<div class="px-5 py-4 border-b border-border flex items-center justify-between bg-secondary/30">
				<div class="flex items-center gap-2.5">
					<div class="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
						KL
					</div>
					<div>
						<h3 class="text-sm font-bold text-foreground flex items-center gap-1.5">
							<span>Detail {selectedKelompok.nama}</span>
						</h3>
						<p class="text-[11px] text-foreground/60">
							Desa {selectedKelompok.desaNama || '-'} &bull; Daerah {selectedKelompok.daerahNama || '-'}
						</p>
					</div>
				</div>

				<div class="flex items-center gap-1.5">
					<button
						type="button"
						onclick={() => {
							const target = selectedKelompok;
							closeKelompokDetail();
							if (target) openEditKelompok(target);
						}}
						class="px-2.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer"
						title="Ubah Data Kelompok"
					>
						<Pencil class="w-3.5 h-3.5" />
						<span>Edit Data</span>
					</button>

					<button
						type="button"
						onclick={closeKelompokDetail}
						class="p-1.5 rounded-lg hover:bg-secondary text-foreground/60 hover:text-foreground cursor-pointer transition-colors"
						aria-label="Tutup detail kelompok"
					>
						<X class="w-4 h-4" />
					</button>
				</div>
			</div>

			<!-- Modal Body (Scrollable) -->
			<div class="p-4 sm:p-6 overflow-y-auto space-y-5 text-xs">
				<!-- Ringkasan Informasi Kelompok -->
				<div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
					<div class="bg-secondary/40 border border-border/80 rounded-xl p-2.5 text-center">
						<span class="text-[10px] text-foreground/50 uppercase font-semibold">Kelurahan</span>
						<p class="font-bold text-foreground text-xs mt-0.5 truncate">{selectedKelompok.kelurahan || '-'}</p>
					</div>
					<div class="bg-secondary/40 border border-border/80 rounded-xl p-2.5 text-center">
						<span class="text-[10px] text-foreground/50 uppercase font-semibold">Desa Induk</span>
						<p class="font-bold text-foreground text-xs mt-0.5 truncate">{selectedKelompok.desaNama || '-'}</p>
					</div>
					<div class="bg-secondary/40 border border-border/80 rounded-xl p-2.5 text-center">
						<span class="text-[10px] text-foreground/50 uppercase font-semibold">Populasi</span>
						<p class="font-bold text-primary text-xs mt-0.5">{selectedKelompok.totalJamaah} Jamaah</p>
					</div>
					<div class="bg-secondary/40 border border-border/80 rounded-xl p-2.5 text-center">
						<span class="text-[10px] text-foreground/50 uppercase font-semibold">Sub-Kelompok</span>
						<p class="font-bold text-foreground text-xs mt-0.5">{selectedKelompok.totalSubKelompok} Rukun</p>
					</div>
				</div>

				<!-- Section Pengaturan Lokasi Basis Kelompok -->
				<div class="space-y-3 pt-2 border-t border-border/80">
					<div class="flex items-center justify-between gap-2">
						<div>
							<h4 class="text-xs font-bold text-foreground flex items-center gap-1.5">
								<MapPin class="w-4 h-4 text-primary" />
								<span>Titik Lokasi Basis Kelompok</span>
							</h4>
							<p class="text-[11px] text-foreground/60 mt-0.5 leading-relaxed">
								Titik koordinat & radius ini menjadi acuan validasi presensi jamaah kelompok. Jamaah hanya dapat presensi jika berada dalam radius lokasi ini.
							</p>
						</div>

						<!-- Quick Access Google Maps jika lokasi sudah ada -->
						{#if (editLatitude && editLongitude) || editGmapsUrl}
							<a
								href={editGmapsUrl || `https://www.google.com/maps?q=${editLatitude},${editLongitude}`}
								target="_blank"
								rel="noopener noreferrer"
								class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold text-[11px] shrink-0 transition-colors shadow-xs"
								title="Buka titik koordinat kelompok di Google Maps"
							>
								<span>Buka di Google Maps</span>
								<ExternalLink class="w-3.5 h-3.5" />
							</a>
						{/if}
					</div>

					<form
						method="POST"
						action="?/updateKelompokLocation"
						use:enhance={keepScrollSubmit({ onSuccess: () => closeKelompokDetail() })}
						class="space-y-4"
					>
						<input type="hidden" name="kelompokId" value={selectedKelompok.id} />
						<input type="hidden" name="lokasiNama" value={editLokasiNama} />
						<input type="hidden" name="latitude" value={editLatitude} />
						<input type="hidden" name="longitude" value={editLongitude} />
						<input type="hidden" name="radiusMeter" value={editRadiusMeter} />
						<input type="hidden" name="gmapsUrl" value={editGmapsUrl} />

						<!-- Komponen Peta Interaktif Leaflet + Draggable Pin + Pencarian + Link GMaps -->
						<LocationPicker
							bind:latitude={editLatitude}
							bind:longitude={editLongitude}
							bind:lokasiNama={editLokasiNama}
							bind:radiusMeter={editRadiusMeter}
							bind:gmapsUrl={editGmapsUrl}
						/>

						<div class="flex items-center justify-between gap-2 pt-2 border-t border-border">
							{#if editLatitude && editLongitude}
								<span class="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
									<CheckCircle2 class="w-3.5 h-3.5" />
									<span>Koordinat Terpilih: {editLatitude}, {editLongitude} (&plusmn;{editRadiusMeter}m)</span>
								</span>
							{:else}
								<span class="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
									Belum ada koordinat lokasi yang dipilih.
								</span>
							{/if}

							<div class="flex items-center gap-2">
								{#if data.permissions?.canDeleteKelompok}
									<button
										type="button"
										onclick={() => openDeleteSingleKelompok(selectedKelompok!)}
										class="px-3.5 py-2 rounded-lg bg-destructive/10 hover:bg-destructive text-destructive hover:text-destructive-foreground border border-destructive/20 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
										title="Hapus Kelompok Ini"
									>
										<Trash2 class="w-3.5 h-3.5" />
										<span>Hapus Kelompok</span>
									</button>
								{/if}

								<button
									type="button"
									onclick={closeKelompokDetail}
									class="px-4 py-2 rounded-lg border border-border text-xs font-semibold text-foreground/80 hover:bg-secondary cursor-pointer transition-colors"
								>
									Tutup
								</button>
								<button
									type="submit"
									class="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-all shadow-sm cursor-pointer"
								>
									Simpan Lokasi Kelompok
								</button>
							</div>
						</div>
					</form>
				</div>
			</div>
		</div>
	</div>
{/if}

<!-- Modal Detail & Lokasi Desa (LocationPicker Leaflet) -->
{#if showDesaDetailModal && selectedDesa}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-background/80 backdrop-blur-sm overflow-y-auto"
		role="dialog"
		aria-modal="true"
	>
		<div
			class="bg-card border border-border rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
		>
			<!-- Modal Header -->
			<div class="px-5 py-4 border-b border-border flex items-center justify-between bg-secondary/30">
				<div class="flex items-center gap-2.5">
					<div class="w-9 h-9 rounded-xl bg-accent/20 text-accent flex items-center justify-center font-bold text-xs shrink-0">
						DS
					</div>
					<div>
						<h3 class="text-sm font-bold text-foreground flex items-center gap-1.5">
							<span>Detail {selectedDesa.nama}</span>
						</h3>
						<p class="text-[11px] text-foreground/60">
							Kecamatan {selectedDesa.kecamatan || '-'} &bull; Daerah {selectedDesa.daerahNama || '-'}
						</p>
					</div>
				</div>

				<div class="flex items-center gap-1.5">
					<button
						type="button"
						onclick={() => {
							const target = selectedDesa;
							closeDesaDetail();
							if (target) openEditDesa(target);
						}}
						class="px-2.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer"
						title="Ubah Data Desa"
					>
						<Pencil class="w-3.5 h-3.5" />
						<span>Edit Data</span>
					</button>

					<button
						type="button"
						onclick={closeDesaDetail}
						class="p-1.5 rounded-lg hover:bg-secondary text-foreground/60 hover:text-foreground cursor-pointer transition-colors"
						aria-label="Tutup detail desa"
					>
						<X class="w-4 h-4" />
					</button>
				</div>
			</div>

			<!-- Modal Body (Scrollable) -->
			<div class="p-4 sm:p-6 overflow-y-auto space-y-5 text-xs">
				<!-- Ringkasan Informasi Desa -->
				<div class="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
					<div class="bg-secondary/40 border border-border/80 rounded-xl p-2.5 text-center">
						<span class="text-[10px] text-foreground/50 uppercase font-semibold">Kecamatan</span>
						<p class="font-bold text-foreground text-xs mt-0.5 truncate">{selectedDesa.kecamatan || '-'}</p>
					</div>
					<div class="bg-secondary/40 border border-border/80 rounded-xl p-2.5 text-center">
						<span class="text-[10px] text-foreground/50 uppercase font-semibold">Daerah Induk</span>
						<p class="font-bold text-foreground text-xs mt-0.5 truncate">{selectedDesa.daerahNama || '-'}</p>
					</div>
					<div class="bg-secondary/40 border border-border/80 rounded-xl p-2.5 text-center">
						<span class="text-[10px] text-foreground/50 uppercase font-semibold">Kelompok</span>
						<p class="font-bold text-primary text-xs mt-0.5">{selectedDesa.totalKelompok ?? 0} Basis Kelompok</p>
					</div>
				</div>

				<!-- Section Pengaturan Lokasi Basis Desa -->
				<div class="space-y-3 pt-2 border-t border-border/80">
					<div class="flex items-center justify-between gap-2">
						<div>
							<h4 class="text-xs font-bold text-foreground flex items-center gap-1.5">
								<MapPin class="w-4 h-4 text-primary" />
								<span>Titik Lokasi Basis Desa</span>
							</h4>
							<p class="text-[11px] text-foreground/60 mt-0.5 leading-relaxed">
								Titik koordinat & radius ini menjadi acuan default jadwal pengajian desa dan validasi presensi pengajian desa.
							</p>
						</div>

						<!-- Quick Access Google Maps jika lokasi sudah ada -->
						{#if (editDesaLatitude && editDesaLongitude) || editDesaGmapsUrl}
							<a
								href={editDesaGmapsUrl || `https://www.google.com/maps?q=${editDesaLatitude},${editDesaLongitude}`}
								target="_blank"
								rel="noopener noreferrer"
								class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold text-[11px] shrink-0 transition-colors shadow-xs"
								title="Buka titik koordinat desa di Google Maps"
							>
								<span>Buka di Google Maps</span>
								<ExternalLink class="w-3.5 h-3.5" />
							</a>
						{/if}
					</div>

					<form
						method="POST"
						action="?/updateDesaLocation"
						use:enhance={keepScrollSubmit({ onSuccess: () => closeDesaDetail() })}
						class="space-y-4"
					>
						<input type="hidden" name="desaId" value={selectedDesa.id} />
						<input type="hidden" name="lokasiNama" value={editDesaLokasiNama} />
						<input type="hidden" name="latitude" value={editDesaLatitude} />
						<input type="hidden" name="longitude" value={editDesaLongitude} />
						<input type="hidden" name="radiusMeter" value={editDesaRadiusMeter} />
						<input type="hidden" name="gmapsUrl" value={editDesaGmapsUrl} />
						<input type="hidden" name="lokasiKelompokId" value={editDesaLokasiKelompokId || ''} />

						<!-- Fitur: Hubungkan ke Lokasi Kelompok -->
						<div class="bg-secondary/40 border border-border/80 rounded-xl p-3 sm:p-3.5 space-y-2.5">
							<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
								<div class="flex items-center gap-2">
									<div class="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
										<Link2 class="w-4 h-4" />
									</div>
									<div>
										<span class="font-bold text-foreground text-xs flex items-center gap-1.5">
											Hubungkan ke Lokasi Kelompok
										</span>
										<p class="text-[11px] text-foreground/60 leading-tight">
											Pilih kelompok jika kegiatan desa bertempat di masjid atau lokasi yang sama dengan kelompok tertentu.
										</p>
									</div>
								</div>

								{#if editDesaLokasiKelompokId && connectedKelompokObj}
									<button
										type="button"
										onclick={handleDisconnectKelompok}
										class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border bg-card hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 text-[11px] font-semibold text-foreground/70 transition-colors cursor-pointer self-start sm:self-auto shrink-0"
										title="Putuskan hubungan lokasi kelompok dan atur manual"
									>
										<Link2Off class="w-3.5 h-3.5" />
										<span>Atur Mandiri / Lepas</span>
									</button>
								{/if}
							</div>

							<div class="max-w-md">
								<SearchableSelect
									id="linkKelompokSelect"
									name="linkKelompokSelect"
									options={kelompokLinkOptions}
									value={editDesaLokasiKelompokId || ''}
									onchange={(val) => handleConnectToKelompok(val)}
									placeholder="-- Cari / Pilih Kelompok untuk Dihubungkan --"
									searchPlaceholder="Ketik nama kelompok atau desa..."
								/>
							</div>

							{#if connectedKelompokObj}
								<div class="bg-primary/5 border border-primary/20 rounded-lg p-2.5 flex items-start gap-2 text-[11px] text-foreground/80">
									<CheckCircle2 class="w-4 h-4 text-primary shrink-0 mt-0.5" />
									<div class="space-y-0.5 leading-snug flex-1">
										<p class="font-semibold text-foreground">
											Terhubung dengan Kelompok: <span class="text-primary font-bold">{connectedKelompokObj.nama}</span>
										</p>
										<p class="text-foreground/60 text-[10.5px]">
											Lokasi: {connectedKelompokObj.lokasiNama || 'Masjid/Tempat Kelompok'}
											{#if connectedKelompokObj.latitude && connectedKelompokObj.longitude}
												• Titik GPS: {connectedKelompokObj.latitude}, {connectedKelompokObj.longitude} (&plusmn;{connectedKelompokObj.radiusMeter || 100}m)
											{:else}
												• <span class="text-amber-600 dark:text-amber-400 font-semibold">Kelompok ini belum memiliki koordinat GPS, silakan tentukan titiknya pada peta di bawah</span>
											{/if}
										</p>
									</div>
								</div>
							{/if}
						</div>

						<!-- Komponen Peta Interaktif Leaflet + Draggable Pin + Pencarian + Link GMaps -->
						<LocationPicker
							bind:latitude={editDesaLatitude}
							bind:longitude={editDesaLongitude}
							bind:lokasiNama={editDesaLokasiNama}
							bind:radiusMeter={editDesaRadiusMeter}
							bind:gmapsUrl={editDesaGmapsUrl}
						/>

						<div class="flex items-center justify-between gap-2 pt-2 border-t border-border">
							{#if editDesaLatitude && editDesaLongitude}
								<span class="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
									<CheckCircle2 class="w-3.5 h-3.5" />
									<span>Koordinat Terpilih: {editDesaLatitude}, {editDesaLongitude} (&plusmn;{editDesaRadiusMeter}m)</span>
								</span>
							{:else}
								<span class="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
									Belum ada koordinat lokasi yang dipilih.
								</span>
							{/if}

							<div class="flex items-center gap-2">
								<button
									type="button"
									onclick={closeDesaDetail}
									class="px-4 py-2 rounded-lg border border-border text-xs font-semibold text-foreground/80 hover:bg-secondary cursor-pointer transition-colors"
								>
									Tutup
								</button>
								{#if data.permissions?.canManageDesa}
									<button
										type="submit"
										class="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-all shadow-sm cursor-pointer"
									>
										Simpan Lokasi Desa
									</button>
								{/if}
							</div>
						</div>
					</form>
				</div>
			</div>
		</div>
	</div>
{/if}

<!-- Modal Konfirmasi Hapus Wilayah (Single / Batch) -->
{#if showDeleteConfirmModal && deleteTarget}
	<div
		class="fixed inset-0 z-60 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-150"
		role="dialog"
		aria-modal="true"
	>
		<div
			class="bg-card border border-destructive/30 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150"
		>
			<div class="flex items-start gap-3.5">
				<div class="w-10 h-10 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center shrink-0 mt-0.5">
					<AlertTriangle class="w-5 h-5" />
				</div>
				<div class="space-y-1">
					<h3 class="text-sm font-bold text-foreground">
						{#if deleteTarget.type === 'singleKelompok'}
							Hapus Kelompok "{deleteTarget.nama}"?
						{:else if deleteTarget.type === 'batchKelompok'}
							Hapus {deleteTarget.count} Kelompok Terpilih?
						{:else if deleteTarget.type === 'singleSubKelompok'}
							Hapus Sub-Kelompok "{deleteTarget.nama}"?
						{:else if deleteTarget.type === 'batchSubKelompok'}
							Hapus {deleteTarget.count} Sub-Kelompok Terpilih?
						{/if}
					</h3>
					<p class="text-xs text-foreground/60 leading-relaxed">
						{#if deleteTarget.type === 'singleKelompok'}
							Aksi ini akan menghapus kelompok secara permanen beserta seluruh data sub-kelompok dan jadwal kegiatan pengajian terkait.
							{#if (deleteTarget.totalJamaah ?? 0) > 0}
								<span class="block mt-1 font-semibold text-amber-600 dark:text-amber-400">
									Perhatian: Terdapat {deleteTarget.totalJamaah} jamaah di kelompok ini. Relasi kelompok pada jamaah akan diubah menjadi kosong.
								</span>
							{/if}
						{:else if deleteTarget.type === 'batchKelompok'}
							Aksi ini akan menghapus <strong>{deleteTarget.count} kelompok</strong> terpilih secara massal beserta sub-kelompok dan jadwal terkait dari database.
						{:else if deleteTarget.type === 'singleSubKelompok'}
							Aksi ini akan menghapus sub-kelompok "{deleteTarget.nama}" secara permanen.
						{:else if deleteTarget.type === 'batchSubKelompok'}
							Aksi ini akan menghapus <strong>{deleteTarget.count} sub-kelompok</strong> terpilih secara massal dari database.
						{/if}
					</p>
				</div>
			</div>

			<form
				method="POST"
				action={deleteTarget.type === 'singleKelompok'
					? '?/deleteKelompok'
					: deleteTarget.type === 'batchKelompok'
						? '?/batchDeleteKelompok'
						: deleteTarget.type === 'singleSubKelompok'
							? '?/deleteSubKelompok'
							: '?/batchDeleteSubKelompok'}
				use:enhance={keepScrollSubmit({ onSuccess: () => closeDeleteModal() })}
				class="flex items-center justify-end gap-2 pt-3 border-t border-border"
			>
				{#if deleteTarget.type === 'singleKelompok'}
					<input type="hidden" name="kelompokId" value={deleteTarget.id} />
				{:else if deleteTarget.type === 'batchKelompok'}
					<input type="hidden" name="kelompokIds" value={JSON.stringify(selectedKelompokIds)} />
				{:else if deleteTarget.type === 'singleSubKelompok'}
					<input type="hidden" name="subKelompokId" value={deleteTarget.id} />
				{:else if deleteTarget.type === 'batchSubKelompok'}
					<input type="hidden" name="subKelompokIds" value={JSON.stringify(selectedSubKelompokIds)} />
				{/if}

				<button
					type="button"
					onclick={closeDeleteModal}
					class="px-4 py-2 rounded-lg border border-border text-xs font-semibold text-foreground/80 hover:bg-secondary cursor-pointer transition-colors"
				>
					Batal
				</button>
				<button
					type="submit"
					class="px-4 py-2 rounded-lg bg-destructive hover:bg-destructive/90 text-destructive-foreground text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
				>
					<Trash2 class="w-3.5 h-3.5" />
					<span>Ya, Hapus Sekarang</span>
				</button>
			</form>
		</div>
	</div>
{/if}

<!-- Modal Edit Data Kelompok -->
{#if showEditKelompokModal && selectedKelompokToEdit}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-background/80 backdrop-blur-sm overflow-y-auto"
		role="dialog"
		aria-modal="true"
	>
		<div
			class="bg-card border border-border rounded-2xl max-w-lg w-full flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
		>
			<div class="p-4 sm:p-5 border-b border-border flex items-center justify-between">
				<div class="flex items-center gap-2.5">
					<div class="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
						<Pencil class="w-4 h-4" />
					</div>
					<div>
						<h3 class="font-bold text-foreground text-sm">Ubah Data Kelompok</h3>
						<p class="text-[11px] text-foreground/60">Perbarui nama kelompok, kelurahan, dan desa induk</p>
					</div>
				</div>
				<button
					type="button"
					onclick={closeEditKelompok}
					class="p-1.5 rounded-lg hover:bg-secondary text-foreground/60 hover:text-foreground cursor-pointer transition-colors"
					aria-label="Tutup modal edit kelompok"
				>
					<X class="w-4 h-4" />
				</button>
			</div>

			<form
				method="POST"
				action="?/updateKelompok"
				use:enhance={keepScrollSubmit({ onSuccess: () => closeEditKelompok() })}
				class="p-4 sm:p-6 space-y-4 text-xs"
			>
				<input type="hidden" name="kelompokId" value={selectedKelompokToEdit.id} />

				<div class="space-y-1.5">
					<label for="edit-nama-kelompok" class="font-semibold text-foreground flex items-center gap-1">
						<span>Nama Kelompok</span>
						<span class="text-destructive">*</span>
					</label>
					<input
						id="edit-nama-kelompok"
						type="text"
						name="nama"
						bind:value={editKelompokNama}
						required
						placeholder="Contoh: Kelompok 1, Tambun 4"
						class="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-xs text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary outline-hidden"
					/>
				</div>

				<div class="space-y-1.5">
					<label for="edit-kelurahan-kelompok" class="font-semibold text-foreground">
						Kelurahan / Domisili
					</label>
					<input
						id="edit-kelurahan-kelompok"
						type="text"
						name="kelurahan"
						bind:value={editKelompokKelurahan}
						placeholder="Contoh: Karang Rahayu, Mangunjaya"
						class="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-xs text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary outline-hidden"
					/>
				</div>

				<div class="space-y-1.5">
					<label for="edit-desa-kelompok" class="font-semibold text-foreground flex items-center gap-1">
						<span>Desa Induk</span>
						<span class="text-destructive">*</span>
					</label>
					<select
						id="edit-desa-kelompok"
						name="desaId"
						bind:value={editKelompokDesaId}
						required
						class="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-xs text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary outline-hidden cursor-pointer"
					>
						<option value="" disabled>-- Pilih Desa Induk --</option>
						{#each data.desaList as d}
							<option value={d.id}>{d.nama} ({d.daerahNama || 'Daerah'})</option>
						{/each}
					</select>
				</div>

				<div class="flex items-center justify-end gap-2 pt-3 border-t border-border">
					<button
						type="button"
						onclick={closeEditKelompok}
						class="px-4 py-2 rounded-lg border border-border text-xs font-semibold text-foreground/80 hover:bg-secondary cursor-pointer transition-colors"
					>
						Batal
					</button>
					<button
						type="submit"
						class="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition-all shadow-xs cursor-pointer"
					>
						Simpan Perubahan
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- Modal Edit Data Desa -->
{#if showEditDesaModal && selectedDesaToEdit}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-background/80 backdrop-blur-sm overflow-y-auto"
		role="dialog"
		aria-modal="true"
	>
		<div
			class="bg-card border border-border rounded-2xl max-w-lg w-full flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
		>
			<div class="p-4 sm:p-5 border-b border-border flex items-center justify-between">
				<div class="flex items-center gap-2.5">
					<div class="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
						<Pencil class="w-4 h-4" />
					</div>
					<div>
						<h3 class="font-bold text-foreground text-sm">Ubah Data Desa</h3>
						<p class="text-[11px] text-foreground/60">Perbarui nama desa, kecamatan, dan daerah induk</p>
					</div>
				</div>
				<button
					type="button"
					onclick={closeEditDesa}
					class="p-1.5 rounded-lg hover:bg-secondary text-foreground/60 hover:text-foreground cursor-pointer transition-colors"
					aria-label="Tutup modal edit desa"
				>
					<X class="w-4 h-4" />
				</button>
			</div>

			<form
				method="POST"
				action="?/updateDesa"
				use:enhance={keepScrollSubmit({ onSuccess: () => closeEditDesa() })}
				class="p-4 sm:p-6 space-y-4 text-xs"
			>
				<input type="hidden" name="desaId" value={selectedDesaToEdit.id} />

				<div class="space-y-1.5">
					<label for="edit-nama-desa" class="font-semibold text-foreground flex items-center gap-1">
						<span>Nama Desa</span>
						<span class="text-destructive">*</span>
					</label>
					<input
						id="edit-nama-desa"
						type="text"
						name="nama"
						bind:value={editDesaNama}
						required
						placeholder="Contoh: Karang Rahayu, Tambun"
						class="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-xs text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary outline-hidden"
					/>
				</div>

				<div class="space-y-1.5">
					<label for="edit-kecamatan-desa" class="font-semibold text-foreground">
						Kecamatan
					</label>
					<input
						id="edit-kecamatan-desa"
						type="text"
						name="kecamatan"
						bind:value={editDesaKecamatan}
						placeholder="Contoh: Tambun Selatan, Cikarang Utara"
						class="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-xs text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary outline-hidden"
					/>
				</div>

				<div class="space-y-1.5">
					<label for="edit-daerah-desa" class="font-semibold text-foreground flex items-center gap-1">
						<span>Daerah Induk</span>
						<span class="text-destructive">*</span>
					</label>
					<select
						id="edit-daerah-desa"
						name="daerahId"
						bind:value={editDesaDaerahId}
						required
						class="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-xs text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary outline-hidden cursor-pointer"
					>
						<option value="" disabled>-- Pilih Daerah Induk --</option>
						{#each data.daerahList as dr}
							<option value={dr.id}>{dr.nama} ({dr.kotaKabupaten}, {dr.provinsi})</option>
						{/each}
					</select>
				</div>

				<div class="flex items-center justify-end gap-2 pt-3 border-t border-border">
					<button
						type="button"
						onclick={closeEditDesa}
						class="px-4 py-2 rounded-lg border border-border text-xs font-semibold text-foreground/80 hover:bg-secondary cursor-pointer transition-colors"
					>
						Batal
					</button>
					<button
						type="submit"
						class="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition-all shadow-xs cursor-pointer"
					>
						Simpan Perubahan
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- Modal Edit Data Sub-Kelompok -->
{#if showEditSubKelompokModal && selectedSubKelompokToEdit}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-background/80 backdrop-blur-sm overflow-y-auto"
		role="dialog"
		aria-modal="true"
	>
		<div
			class="bg-card border border-border rounded-2xl max-w-lg w-full flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
		>
			<div class="p-4 sm:p-5 border-b border-border flex items-center justify-between">
				<div class="flex items-center gap-2.5">
					<div class="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
						<Pencil class="w-4 h-4" />
					</div>
					<div>
						<h3 class="font-bold text-foreground text-sm">Ubah Data Sub-Kelompok</h3>
						<p class="text-[11px] text-foreground/60">Perbarui nama sub-kelompok, keterangan/rukun, dan kelompok induk</p>
					</div>
				</div>
				<button
					type="button"
					onclick={closeEditSubKelompok}
					class="p-1.5 rounded-lg hover:bg-secondary text-foreground/60 hover:text-foreground cursor-pointer transition-colors"
					aria-label="Tutup modal edit sub-kelompok"
				>
					<X class="w-4 h-4" />
				</button>
			</div>

			<form
				method="POST"
				action="?/updateSubKelompok"
				use:enhance={keepScrollSubmit({ onSuccess: () => closeEditSubKelompok() })}
				class="p-4 sm:p-6 space-y-4 text-xs"
			>
				<input type="hidden" name="subKelompokId" value={selectedSubKelompokToEdit.id} />

				<div class="space-y-1.5">
					<label for="edit-nama-subkelompok" class="font-semibold text-foreground flex items-center gap-1">
						<span>Nama Sub-Kelompok</span>
						<span class="text-destructive">*</span>
					</label>
					<input
						id="edit-nama-subkelompok"
						type="text"
						name="nama"
						bind:value={editSubKelompokNama}
						required
						placeholder="Contoh: Rukun 1, RW 05"
						class="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-xs text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary outline-hidden"
					/>
				</div>

				<div class="space-y-1.5">
					<label for="edit-keterangan-subkelompok" class="font-semibold text-foreground">
						Keterangan / Rukun
					</label>
					<input
						id="edit-keterangan-subkelompok"
						type="text"
						name="keterangan"
						bind:value={editSubKelompokKeterangan}
						placeholder="Contoh: Wilayah Blok B, RT 01-04"
						class="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-xs text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary outline-hidden"
					/>
				</div>

				<div class="space-y-1.5">
					<label for="edit-kelompok-subkelompok" class="font-semibold text-foreground flex items-center gap-1">
						<span>Kelompok Induk</span>
						<span class="text-destructive">*</span>
					</label>
					<select
						id="edit-kelompok-subkelompok"
						name="kelompokId"
						bind:value={editSubKelompokKelompokId}
						required
						class="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-xs text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary outline-hidden cursor-pointer"
					>
						<option value="" disabled>-- Pilih Kelompok Induk --</option>
						{#each data.kelompokList as kl}
							<option value={kl.id}>{kl.nama} (Desa {kl.desaNama || '-'})</option>
						{/each}
					</select>
				</div>

				<div class="flex items-center justify-end gap-2 pt-3 border-t border-border">
					<button
						type="button"
						onclick={closeEditSubKelompok}
						class="px-4 py-2 rounded-lg border border-border text-xs font-semibold text-foreground/80 hover:bg-secondary cursor-pointer transition-colors"
					>
						Batal
					</button>
					<button
						type="submit"
						class="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition-all shadow-xs cursor-pointer"
					>
						Simpan Perubahan
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
