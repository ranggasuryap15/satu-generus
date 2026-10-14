<!--
  @file src/routes/(admin)/admin/keuangan/shodaqoh/+page.svelte
  @purpose Halaman manajemen shodaqoh wilayah untuk admin (KU & Kyai): rekapitulasi metrik, ekspor CSV transaksi, tanda terima/struk digital resmi, visualisasi grafik donasi bulanan, verifikasi & approval bukti transfer, manajemen rekening & QRIS bergaya profil wilayah (kartu modern, salin no rek, preview popup QRIS, tambah/edit modal, hapus dengan modal konfirmasi), serta isolasi alokasi jenis shodaqoh dengan preservasi tab & URL wilayah
  @usedBy Route admin '/admin/keuangan/shodaqoh'
  @dependencies @lucide/svelte, $app/navigation, $app/forms (enhance), $app/state, Svelte 5 Runes, formatRupiah, #lib/components/SearchableSelect.svelte, #lib/keepScroll.ts (keepScrollSubmit), #lib/confirm.svelte (confirmAction)
  @publicFunctions exportToCsv, switchTab, changeWilayah, changeStatusFilter, printReceiptAdmin, copyToClipboard, openAddRekeningModal, openEditRekeningModal, closeRekeningModal, handleQrisFileChange
  @sideEffects Melakukan approval/penolakan transaksi shodaqoh, mutasi jenis shodaqoh, pembuatan & pembaruan & penghapusan rekening/QRIS via form actions dengan menjaga scroll position dan URL tab/scope/id, ekspor CSV, cetak tanda terima/struk resmi, serta penyalinan teks clipboard
-->
<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { keepScrollSubmit } from '#lib/keepScroll.js';
	import { confirmAction } from '#lib/confirm.svelte.ts';
	import SearchableSelect from '#lib/components/SearchableSelect.svelte';
	import {
		AlertCircle,
		ArrowRight,
		Banknote,
		Building2,
		Calendar,
		Check,
		CheckCircle2,
		ChevronRight,
		Clock,
		Coins,
		Copy,
		CreditCard,
		Download,
		ExternalLink,
		Eye,
		FileSpreadsheet,
		FileText,
		Filter,
		HandCoins,
		HeartHandshake,
		Image as ImageIcon,
		Landmark,
		Layers,
		Lock,
		Pencil,
		Plus,
		Printer,
		QrCode,
		Search,
		ShieldAlert,
		ShieldCheck,
		Trash2,
		TrendingUp,
		Users,
		Wallet,
		X,
		XCircle
	} from '@lucide/svelte';
	import type { PageData, ActionData } from './$types';

	let { data, form } = $props<{ data: PageData; form: ActionData }>();

	function formatRupiah(val: number): string {
		return 'Rp ' + Number(val || 0).toLocaleString('id-ID');
	}

	// State interaktif
	let activeTab = $state<'transaksi' | 'jenis' | 'rekening'>(
		(page.url.searchParams.get('tab') as 'transaksi' | 'jenis' | 'rekening') || 'transaksi'
	);
	let filterStatus = $state(data.filterStatus || 'Semua');
	let searchQuery = $state('');

	// Modal Bukti Transfer Preview & Modal Struk Resmi
	let previewBuktiUrl = $state<string | null>(null);
	let selectedReceiptAdmin = $state<(typeof data.transaksiList)[number] | null>(null);

	function printReceiptAdmin() {
		if (typeof window !== 'undefined') {
			window.print();
		}
	}

	// Modal Form Tambah Jenis
	let isAddJenisOpen = $state(false);
	let jenisNama = $state('');
	let jenisDeskripsi = $state('');

	// State Modal Preview QRIS
	let previewQrisUrl = $state<string | null>(null);
	let previewQrisTitle = $state<string>('');

	// State Feedback Salin Rekening
	let copiedRekeningId = $state<string | null>(null);

	// State Modal Tambah / Edit Rekening & QRIS
	let isAddRekeningOpen = $state(false);
	let isEditingRekening = $state(false);
	let editRekeningId = $state('');
	let rekeningMetodeTipe = $state<'bank' | 'qris'>('bank');
	let rekeningNamaBank = $state('Bank Syariah Indonesia (BSI)');
	let rekeningNomor = $state('');
	let rekeningAtasNama = $state('');
	let rekeningTujuan = $state('Infaq & Shodaqoh');
	let rekeningKeterangan = $state('');
	let rekeningIsActive = $state(true);
	let inputQrisMode = $state<'upload' | 'url'>('upload');
	let qrisFilePreview = $state<string | null>(null);
	let rekeningQrisUrl = $state('');

	function openAddRekeningModal() {
		isEditingRekening = false;
		editRekeningId = '';
		rekeningMetodeTipe = 'bank';
		rekeningNamaBank = 'Bank Syariah Indonesia (BSI)';
		rekeningNomor = '';
		rekeningAtasNama = '';
		rekeningTujuan = 'Infaq & Shodaqoh';
		rekeningKeterangan = '';
		rekeningIsActive = true;
		inputQrisMode = 'upload';
		qrisFilePreview = null;
		rekeningQrisUrl = '';
		isAddRekeningOpen = true;
	}

	function openEditRekeningModal(rek: (typeof data.listRekening)[number]) {
		isEditingRekening = true;
		editRekeningId = rek.id;
		if (rek.qrisImageUrl || rek.namaBank?.toUpperCase() === 'QRIS') {
			rekeningMetodeTipe = 'qris';
			rekeningNamaBank = rek.namaBank || 'QRIS';
			rekeningNomor = rek.nomorRekening === '-' ? '' : rek.nomorRekening;
			rekeningQrisUrl = rek.qrisImageUrl || '';
			qrisFilePreview = rek.qrisImageUrl || null;
			inputQrisMode = rek.qrisImageUrl ? 'url' : 'upload';
		} else {
			rekeningMetodeTipe = 'bank';
			rekeningNamaBank = rek.namaBank;
			rekeningNomor = rek.nomorRekening;
			rekeningQrisUrl = '';
			qrisFilePreview = null;
			inputQrisMode = 'upload';
		}
		rekeningAtasNama = rek.atasNama;
		rekeningTujuan = rek.tipeTujuan || 'Infaq & Shodaqoh';
		rekeningKeterangan = rek.keterangan || '';
		rekeningIsActive = rek.isActive ?? true;
		isAddRekeningOpen = true;
	}

	function closeRekeningModal() {
		isAddRekeningOpen = false;
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

	const standardAlokasi = ['Infaq & Shodaqoh', 'Pembangunan', 'Kas Sosial', 'Lainnya'];
	const alokasiOptions = $derived([
		...standardAlokasi.map((a) => ({ value: a, label: a })),
		...((data.listJenisShodaqoh || [])
			.map((j: any) => ({ value: j.nama, label: j.nama }))
			.filter((opt: any) => !standardAlokasi.includes(opt.value)))
	]);

	// Modal Penolakan Transaksi
	let rejectModalOpen = $state(false);
	let rejectTargetId = $state<string | null>(null);
	let rejectAlasan = $state('Bukti transfer tidak sesuai atau tidak terbaca');

	// Filter transaksi sesuai pencarian
	const filteredTransaksi = $derived(
		(data.transaksiList || []).filter((t: (typeof data.transaksiList)[number]) => {
			const q = searchQuery.toLowerCase();
			if (!q) return true;
			return (
				t.namaPengirim.toLowerCase().includes(q) ||
				t.namaJenisShodaqoh.toLowerCase().includes(q) ||
				(t.noTelepon && t.noTelepon.toLowerCase().includes(q)) ||
				(t.catatan && t.catatan.toLowerCase().includes(q))
			);
		})
	);

	function switchTab(tab: 'transaksi' | 'jenis' | 'rekening') {
		activeTab = tab;
		if (typeof window !== 'undefined') {
			const url = new URL(window.location.href);
			if (tab === 'transaksi') {
				url.searchParams.delete('tab');
			} else {
				url.searchParams.set('tab', tab);
			}
			window.history.replaceState({}, '', url.toString());
		}
	}

	function changeWilayah(scope: string, id: number | null | undefined) {
		const url = new URL(page.url.href);
		url.searchParams.set('scope', scope);
		if (id && Number(id) > 0) {
			url.searchParams.set('id', String(id));
		} else {
			url.searchParams.delete('id');
		}
		if (activeTab !== 'transaksi') {
			url.searchParams.set('tab', activeTab);
		}
		goto(url.toString());
	}

	function changeStatusFilter(status: string) {
		filterStatus = status;
		const url = new URL(page.url.href);
		if (status === 'Semua') {
			url.searchParams.delete('status');
		} else {
			url.searchParams.set('status', status);
		}
		if (activeTab !== 'transaksi') {
			url.searchParams.set('tab', activeTab);
		}
		goto(url.toString());
	}

	function exportToCsv() {
		if (!data.transaksiList || data.transaksiList.length === 0) return;

		const rows: string[][] = [
			['No', 'Tanggal Transfer', 'Nama Pengirim', 'No Telepon', 'Jenis Shodaqoh', 'Nominal (Rp)', 'Status', 'Catatan']
		];

		filteredTransaksi.forEach((t: (typeof data.transaksiList)[number], idx: number) => {
			rows.push([
				String(idx + 1),
				`"${t.tanggalTransfer || '-'}"`,
				`"${(t.namaPengirim || '').replace(/"/g, '""')}"`,
				`"${(t.noTelepon || '-').replace(/"/g, '""')}"`,
				`"${(t.namaJenisShodaqoh || '').replace(/"/g, '""')}"`,
				String(t.nominal || 0),
				t.statusApproval,
				`"${(t.catatan || '').replace(/"/g, '""')}"`
			]);
		});

		const csvContent = '\uFEFF' + rows.map((r) => r.join(',')).join('\r\n');
		const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.setAttribute('download', `Mutasi-Shodaqoh-${data.activeScope}-${(data.activeWilayahName || 'Wilayah').replace(/\s+/g, '_')}-${new Date().toISOString().slice(0, 10)}.csv`);
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(url);
	}

	$effect(() => {
		const urlTab = page.url.searchParams.get('tab') as 'transaksi' | 'jenis' | 'rekening' | null;
		if (urlTab && (urlTab === 'transaksi' || urlTab === 'jenis' || urlTab === 'rekening') && activeTab !== urlTab) {
			activeTab = urlTab;
		}
	});

	// Pastikan URL tetap menunjuk wilayah dan tab aktif setelah action sukses, sehingga tidak
	// ter-reset ke wilayah atau tab default ketika result.location menghapus query scope & id.
	$effect(() => {
		if (form?.success && typeof window !== 'undefined') {
			const currentUrl = new URL(window.location.href);
			let changed = false;
			if (form.scope && currentUrl.searchParams.get('scope') !== String(form.scope)) {
				currentUrl.searchParams.set('scope', String(form.scope));
				changed = true;
			}
			if (form.id && currentUrl.searchParams.get('id') !== String(form.id)) {
				currentUrl.searchParams.set('id', String(form.id));
				changed = true;
			}
			if (form.tab) {
				if (form.tab === 'transaksi' && currentUrl.searchParams.has('tab')) {
					currentUrl.searchParams.delete('tab');
					changed = true;
				} else if (form.tab !== 'transaksi' && currentUrl.searchParams.get('tab') !== String(form.tab)) {
					currentUrl.searchParams.set('tab', String(form.tab));
					changed = true;
				}
				activeTab = form.tab;
			}
			if (changed) {
				window.history.replaceState({}, '', currentUrl.toString());
			}
		}
	});

	// Hitung max value untuk grafik bulanan
	const maxMonthlyTotal = $derived(
		Math.max(...(data.monthlyTrend || []).map((m: { bulan: string; total: number }) => m.total), 1)
	);
	// Opsi Dropdown Searchable Wilayah
	const kelompokOptions = $derived(
		(data.accessibleWilayah?.kelompokList || []).map((k: any) => ({
			value: k.id,
			label: `${k.nama}${k.desaNama ? ` (${k.desaNama})` : ""}`
		}))
	);

	const desaOptions = $derived(
		(data.accessibleWilayah?.desaList || []).map((d: any) => ({
			value: d.id,
			label: `${d.nama}${d.daerahNama ? ` (${d.daerahNama})` : ""}`
		}))
	);

	const daerahOptions = $derived(
		(data.accessibleWilayah?.daerahList || []).map((dr: any) => ({
			value: dr.id,
			label: dr.nama
		}))
	);
</script>

<svelte:head>
	<title>Shodaqoh Wilayah ({data.activeWilayahInfo.nama}) - Satu Generus</title>
</svelte:head>

<div class="space-y-6 pb-12">
	<!-- Top Header & Scope Selector -->
	<div class="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card border border-border p-4 md:p-6 rounded-2xl shadow-xs">
		<div class="space-y-1">
			<div class="flex items-center gap-2">
				<div class="w-9 h-9 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center border border-teal-500/20">
					<HeartHandshake class="w-5 h-5" />
				</div>
				<div>
					<h1 class="text-lg md:text-xl font-bold text-foreground tracking-tight flex items-center gap-2">
						<span>Shodaqoh & Infaq Wilayah</span>
						<span class="text-xs px-2 py-0.5 rounded-full font-semibold bg-primary/10 text-primary border border-primary/20">
							{data.activeScope}
						</span>
					</h1>
					<p class="text-xs text-foreground/60">
						{#if data.activeId}
							{data.activeWilayahInfo.nama} {data.activeWilayahInfo.indukNama ? `• ${data.activeWilayahInfo.indukNama}` : ''}
						{:else}
							Belum ada {data.activeScope.toLowerCase()} yang dipilih
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
						class="px-3 py-1.5 rounded-lg font-medium transition-all {data.activeScope === 'Kelompok'
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
						class="px-3 py-1.5 rounded-lg font-medium transition-all {data.activeScope === 'Desa'
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
						class="px-3 py-1.5 rounded-lg font-medium transition-all {data.activeScope === 'Daerah'
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

			<!-- Badge Otoritas -->
			{#if data.canManage}
				<span class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[11px] font-bold">
					<ShieldCheck class="w-3.5 h-3.5" />
					<span>KU & Kyai (Full Akses)</span>
				</span>
			{:else}
				<span class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[11px] font-semibold">
					<ShieldAlert class="w-3.5 h-3.5" />
					<span>Lihat Saja (Read-Only)</span>
				</span>
			{/if}
		</div>
	</div>

	{#if !data.activeId}
		<div class="p-12 text-center bg-card border border-border rounded-2xl shadow-xs space-y-3">
			<div class="w-12 h-12 rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center mx-auto shadow-2xs">
				<Filter class="w-6 h-6" />
			</div>
			<div>
				<h3 class="text-sm sm:text-base font-bold text-foreground">Pilih Wilayah Terlebih Dahulu</h3>
				<p class="text-xs text-foreground/60 max-w-md mx-auto mt-1 leading-relaxed">
					Silakan tentukan tingkat wilayah dan pilih {data.activeScope.toLowerCase()} pada menu dropdown di atas untuk membuka laporan transaksi, jenis shodaqoh, dan rekening penerima.
				</p>
			</div>
		</div>
	{:else}
		<!-- Ringkasan Statistik Donasi -->
		<div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
		<div class="bg-card border border-border p-4 rounded-2xl shadow-xs space-y-1">
			<div class="flex items-center justify-between text-xs text-foreground/60">
				<span>Total Shodaqoh</span>
				<div class="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
					<Coins class="w-4 h-4" />
				</div>
			</div>
			<p class="text-lg sm:text-xl font-bold text-foreground">
				{formatRupiah(data.stats.totalTerkumpul)}
			</p>
			<p class="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
				{data.stats.totalApproved} transaksi disetujui
			</p>
		</div>

		<div class="bg-card border border-border p-4 rounded-2xl shadow-xs space-y-1">
			<div class="flex items-center justify-between text-xs text-foreground/60">
				<span>Menunggu Approval</span>
				<div class="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
					<Clock class="w-4 h-4" />
				</div>
			</div>
			<p class="text-lg sm:text-xl font-bold text-amber-600 dark:text-amber-400">
				{data.stats.totalPending}
			</p>
			<p class="text-[11px] text-foreground/50">
				Perlu verifikasi bukti transfer
			</p>
		</div>

		<div class="bg-card border border-border p-4 rounded-2xl shadow-xs space-y-1">
			<div class="flex items-center justify-between text-xs text-foreground/60">
				<span>Total Transaksi</span>
				<div class="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
					<FileSpreadsheet class="w-4 h-4" />
				</div>
			</div>
			<p class="text-lg sm:text-xl font-bold text-foreground">
				{data.stats.totalTransaksi}
			</p>
			<p class="text-[11px] text-foreground/50">
				Semua status pelaporan
			</p>
		</div>

		<div class="bg-card border border-border p-4 rounded-2xl shadow-xs space-y-1">
			<div class="flex items-center justify-between text-xs text-foreground/60">
				<span>Alokasi / Jenis</span>
				<div class="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-600 flex items-center justify-center">
					<Layers class="w-4 h-4" />
				</div>
			</div>
			<p class="text-lg sm:text-xl font-bold text-foreground">
				{data.listJenis.length}
			</p>
			<p class="text-[11px] text-foreground/50">
				Kategori shodaqoh aktif
			</p>
		</div>
	</div>

	<!-- Visualisasi Dashboard Grafik Tren & Distribusi -->
	<div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
		<!-- Grafik Tren Shodaqoh Bulanan -->
		<div class="lg:col-span-2 bg-card border border-border rounded-2xl p-5 shadow-xs space-y-4">
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-2">
					<div class="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
						<TrendingUp class="w-4 h-4" />
					</div>
					<div>
						<h2 class="text-xs sm:text-sm font-bold text-foreground">Tren Penerimaan Shodaqoh</h2>
						<p class="text-[11px] text-foreground/60">Perkembangan realisasi shodaqoh per bulan</p>
					</div>
				</div>
			</div>

			{#if data.monthlyTrend.length === 0}
				<div class="py-12 text-center text-foreground/40 text-xs">
					Belum ada data transaksi shodaqoh yang disetujui.
				</div>
			{:else}
				<div class="h-44 flex items-end gap-3 sm:gap-6 pt-6 pb-2 px-2 border-b border-border">
					{#each data.monthlyTrend as item}
						{@const heightPct = Math.max(12, Math.round((item.total / maxMonthlyTotal) * 100))}
						<div class="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
							<span class="text-[10px] font-bold text-foreground/70 opacity-0 group-hover:opacity-100 transition-opacity">
								{formatRupiah(item.total)}
							</span>
							<div
								class="w-full max-w-10 rounded-t-lg bg-primary/80 group-hover:bg-primary transition-all duration-300 relative"
								style="height: {heightPct}%"
							></div>
							<span class="text-[10px] font-medium text-foreground/60 truncate max-w-14">
								{item.bulan}
							</span>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Distribusi per Jenis Shodaqoh -->
		<div class="bg-card border border-border rounded-2xl p-5 shadow-xs space-y-4">
			<div class="flex items-center gap-2">
				<div class="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-600 flex items-center justify-center">
					<Coins class="w-4 h-4" />
				</div>
				<div>
					<h2 class="text-xs sm:text-sm font-bold text-foreground">Distribusi Alokasi</h2>
					<p class="text-[11px] text-foreground/60">Penerimaan per jenis shodaqoh</p>
				</div>
			</div>

			<div class="space-y-3 pt-1">
				{#if data.jenisBreakdown.length === 0}
					<div class="py-10 text-center text-foreground/40 text-xs">
						Belum ada alokasi dana terkumpul.
					</div>
				{:else}
					{#each data.jenisBreakdown as jb}
						{@const pct = data.stats.totalTerkumpul > 0 ? Math.round((jb.total / data.stats.totalTerkumpul) * 100) : 0}
						<div class="space-y-1">
							<div class="flex items-center justify-between text-xs">
								<span class="font-medium text-foreground truncate max-w-40">{jb.jenis}</span>
								<span class="font-bold text-foreground">{formatRupiah(jb.total)}</span>
							</div>
							<div class="w-full h-2 rounded-full bg-secondary overflow-hidden">
								<div class="h-full bg-teal-500 rounded-full transition-all" style="width: {pct}%"></div>
							</div>
							<p class="text-[10px] text-foreground/50 text-right">{pct}% dari total</p>
						</div>
					{/each}
				{/if}
			</div>
		</div>
	</div>

	<!-- Segmentasi Tab Menu -->
	<div class="flex items-center gap-2 border-b border-border pb-2 text-xs overflow-x-auto">
		<button
			type="button"
			onclick={() => switchTab('transaksi')}
			class="px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 {activeTab === 'transaksi'
				? 'bg-primary text-primary-foreground shadow-xs'
				: 'text-foreground/60 hover:text-foreground hover:bg-secondary'}"
		>
			<Banknote class="w-4 h-4" />
			<span>Laporan Transaksi & Bukti ({data.transaksiList.length})</span>
			{#if data.stats.totalPending > 0}
				<span class="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-rose-500 text-white">
					{data.stats.totalPending}
				</span>
			{/if}
		</button>

		<button
			type="button"
			onclick={() => switchTab('jenis')}
			class="px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 {activeTab === 'jenis'
				? 'bg-primary text-primary-foreground shadow-xs'
				: 'text-foreground/60 hover:text-foreground hover:bg-secondary'}"
		>
			<Layers class="w-4 h-4" />
			<span>Kelola Jenis Shodaqoh ({data.listJenis.length})</span>
		</button>

		<button
			type="button"
			onclick={() => switchTab('rekening')}
			class="px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 {activeTab === 'rekening'
				? 'bg-primary text-primary-foreground shadow-xs'
				: 'text-foreground/60 hover:text-foreground hover:bg-secondary'}"
		>
			<Landmark class="w-4 h-4" />
			<span>Rekening & QRIS Wilayah ({data.listRekening.length})</span>
		</button>
	</div>

	<!-- TAB 1: TRANSAKSI & APPROVAL -->
	{#if activeTab === 'transaksi'}
		<div class="bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
			<!-- Header & Filter Bar -->
			<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
				<div class="flex flex-wrap items-center gap-2">
					<span class="text-xs font-semibold text-foreground/70">Status:</span>
					{#each ['Semua', 'Menunggu Persetujuan', 'Disetujui', 'Ditolak'] as st}
						<button
							type="button"
							onclick={() => changeStatusFilter(st)}
							class="px-2.5 py-1 rounded-lg text-xs font-medium transition-all {filterStatus === st
								? 'bg-secondary text-foreground font-bold border border-border'
								: 'text-foreground/50 hover:text-foreground'}"
						>
							{st}
						</button>
					{/each}
				</div>

				<div class="flex items-center gap-2 w-full sm:w-auto">
					<div class="relative flex-1 sm:w-60">
						<Search class="w-4 h-4 text-foreground/40 absolute left-3 top-1/2 -translate-y-1/2" />
						<input
							type="search"
							bind:value={searchQuery}
							placeholder="Cari pengirim, jenis..."
							class="w-full bg-secondary/60 border border-border rounded-xl pl-9 pr-3 py-1.5 text-xs text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary"
						/>
					</div>

					<button
						type="button"
						onclick={exportToCsv}
						class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-card hover:bg-secondary text-foreground text-xs font-semibold shrink-0 transition-colors shadow-xs"
						title="Unduh data transaksi shodaqoh dalam format CSV / Excel"
					>
						<Download class="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
						<span class="hidden sm:inline">Ekspor CSV</span>
						<span class="sm:hidden">CSV</span>
					</button>
				</div>
			</div>

			{#if filteredTransaksi.length === 0}
				<div class="py-12 text-center space-y-2">
					<div class="w-12 h-12 rounded-full bg-secondary text-foreground/40 mx-auto flex items-center justify-center">
						<Banknote class="w-6 h-6" />
					</div>
					<p class="text-xs font-semibold text-foreground">Tidak Ada Transaksi Shodaqoh</p>
					<p class="text-[11px] text-foreground/50">
						Belum ada laporan transfer shodaqoh dengan filter ini.
					</p>
				</div>
			{:else}
				<!-- Tabel Transaksi Desktop & Mobile Card -->
				<div class="overflow-x-auto rounded-xl border border-border">
					<table class="w-full text-xs text-left">
						<thead class="bg-secondary/40 text-foreground/60 border-b border-border uppercase font-semibold text-[10px]">
							<tr>
								<th class="px-4 py-3">Tanggal & Pengirim</th>
								<th class="px-4 py-3">Jenis Shodaqoh</th>
								<th class="px-4 py-3">Metode & Bukti</th>
								<th class="px-4 py-3">Nominal</th>
								<th class="px-4 py-3">Status</th>
								<th class="px-4 py-3 text-right">Aksi Approval</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-border">
							{#each filteredTransaksi as t}
								<tr class="hover:bg-secondary/20 transition-colors">
									<td class="px-4 py-3">
										<p class="font-bold text-foreground text-xs">{t.namaPengirim}</p>
										<div class="flex items-center gap-2 text-[10px] text-foreground/50 mt-0.5">
											<span>{t.tanggalTransfer}</span>
											{#if t.noTelepon}
												<span>• {t.noTelepon}</span>
											{/if}
										</div>
										{#if t.catatan}
											<p class="text-[10px] text-foreground/60 italic mt-0.5 max-w-xs">"{t.catatan}"</p>
										{/if}
									</td>
									<td class="px-4 py-3">
										<span class="inline-flex px-2 py-0.5 rounded-md font-semibold bg-primary/10 text-primary border border-primary/20 text-[11px]">
											{t.namaJenisShodaqoh}
										</span>
									</td>
									<td class="px-4 py-3">
										<div class="flex items-center gap-2">
											<span class="text-foreground/70 font-medium">{t.metodePembayaran}</span>
											{#if t.buktiTransferUrl}
												<button
													type="button"
													onclick={() => (previewBuktiUrl = t.buktiTransferUrl)}
													class="p-1 rounded-lg bg-secondary hover:bg-secondary/80 text-primary hover:text-primary/80 transition-colors"
													title="Lihat Bukti Transfer"
												>
													<Eye class="w-3.5 h-3.5" />
												</button>
											{/if}
										</div>
									</td>
									<td class="px-4 py-3 font-mono font-bold text-foreground text-xs">
										{formatRupiah(t.nominal)}
									</td>
									<td class="px-4 py-3">
										{#if t.statusApproval === 'Disetujui'}
											<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
												<CheckCircle2 class="w-3 h-3" /> Disetujui
											</span>
										{:else if t.statusApproval === 'Ditolak'}
											<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20" title={t.alasanPenolakan || ''}>
												<XCircle class="w-3 h-3" /> Ditolak
											</span>
										{:else}
											<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
												<Clock class="w-3 h-3" /> Menunggu
											</span>
										{/if}
									</td>
									<td class="px-4 py-3 text-right">
										{#if t.statusApproval === 'Menunggu Persetujuan'}
											{#if data.canManage}
												<div class="flex items-center justify-end gap-1.5">
													<form method="POST" action={`?scope=${data.activeScope}&id=${data.activeId}&tab=${activeTab}&/approve`} use:enhance={keepScrollSubmit()}>
														<input type="hidden" name="id" value={t.id} />
														<input type="hidden" name="scope" value={data.activeScope} />
														<input type="hidden" name="targetId" value={data.activeId} />
														<input type="hidden" name="tab" value={activeTab} />
														<button
															type="submit"
															class="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shadow-xs active:scale-95 transition-all"
														>
															Setujui
														</button>
													</form>
													<button
														type="button"
														onclick={() => {
															rejectTargetId = t.id;
															rejectModalOpen = true;
														}}
														class="px-2.5 py-1 rounded-lg bg-rose-600/10 hover:bg-rose-600 text-rose-600 hover:text-white font-bold text-[11px] transition-all"
													>
														Tolak
													</button>
												</div>
											{:else}
												<span class="text-[10px] text-foreground/40 italic">Hanya KU/Kyai</span>
											{/if}
										{:else}
											<div class="flex items-center justify-end gap-1.5">
												{#if t.statusApproval === 'Disetujui'}
													<button
														type="button"
														onclick={() => (selectedReceiptAdmin = t)}
														class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-secondary hover:bg-secondary/80 text-foreground border border-border transition-colors active:scale-95"
														title="Cetak Tanda Terima Resmi"
													>
														<FileText class="w-3.5 h-3.5 text-primary" />
														<span>Struk</span>
													</button>
												{:else}
													<span class="text-[10px] text-foreground/40">Ditolak</span>
												{/if}
											</div>
										{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>
	{/if}

	<!-- TAB 2: KELOLA JENIS SHODAQOH -->
	{#if activeTab === 'jenis'}
		<div class="bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
			<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
				<div>
					<h3 class="text-sm font-bold text-foreground">Jenis Shodaqoh Wilayah ({data.activeWilayahInfo.nama})</h3>
					<p class="text-xs text-foreground/60">
						Setiap jenis terikat khusus untuk wilayah ini dan tidak bocor ke wilayah lain.
					</p>
				</div>

				{#if data.canManage}
					<button
						type="button"
						onclick={() => (isAddJenisOpen = true)}
						class="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90 transition-all shadow-xs active:scale-95 self-start"
					>
						<Plus class="w-4 h-4" />
						<span>Tambah Jenis Shodaqoh</span>
					</button>
				{/if}
			</div>

			<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
				{#each data.listJenis as j}
					<div class="border border-border rounded-xl p-4 bg-card/60 hover:bg-card transition-all shadow-2xs space-y-2 flex flex-col justify-between">
						<div>
							<div class="flex items-center justify-between gap-2">
								<h4 class="text-xs font-bold text-foreground">{j.nama}</h4>
								{#if j.isDefault}
									<span class="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-secondary text-foreground/70 border border-border">
										Default
									</span>
								{:else}
									<span class="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-teal-500/10 text-teal-600 border border-teal-500/20">
										Custom
									</span>
								{/if}
							</div>
							<p class="text-[11px] text-foreground/60 mt-1">
								{j.deskripsi || 'Tidak ada keterangan tambahan.'}
							</p>
						</div>

						<div class="flex items-center justify-between pt-2 border-t border-border/60 text-[10px] text-foreground/50">
							<span>Scope: {j.tingkatScope}</span>
							{#if !j.isDefault && data.canManage}
								<form method="POST" action={`?scope=${data.activeScope}&id=${data.activeId}&tab=${activeTab}&/deleteJenis`} use:enhance={keepScrollSubmit()}>
									<input type="hidden" name="id" value={j.id} />
									<input type="hidden" name="scope" value={data.activeScope} />
									<input type="hidden" name="targetId" value={data.activeId} />
									<input type="hidden" name="tab" value={activeTab} />
									<button
										type="button"
										class="text-rose-500 hover:text-rose-700 font-semibold transition-colors flex items-center gap-1 cursor-pointer"
										onclick={async (e) => {
											const formEl = (e.currentTarget as HTMLButtonElement).closest('form');
											const ok = await confirmAction({
												title: 'Hapus Jenis Shodaqoh?',
												message: `Yakin ingin menghapus jenis shodaqoh "${j.nama}"?`,
												confirmText: 'Ya, Hapus',
												variant: 'danger'
											});
											if (ok && formEl) {
												formEl.requestSubmit();
											}
										}}
									>
										<Trash2 class="w-3 h-3" /> Hapus
									</button>
								</form>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- TAB 3: REKENING & QRIS WILAYAH -->
	{#if activeTab === 'rekening'}
		<div class="bg-card border border-border rounded-2xl p-5 shadow-xs space-y-4">
			<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
				<div>
					<div class="flex items-center gap-2">
						<CreditCard class="w-5 h-5 text-primary" />
						<h2 class="text-base font-bold text-foreground">Rekening & QRIS Shodaqoh</h2>
						{#if data.canManage}
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
						Rekening resmi penerimaan infaq/shodaqoh jamaah untuk {data.activeScope} {data.activeWilayahInfo.nama}.
					</p>
				</div>

				{#if data.canManage}
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
			{#if data.listRekening.length === 0}
				<div class="p-8 text-center text-foreground/50 text-xs rounded-xl border border-dashed border-border">
					Belum ada nomor rekening atau QRIS shodaqoh yang ditambahkan untuk wilayah ini.
				</div>
			{:else}
				<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
					{#each data.listRekening as rek}
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
							{#if data.canManage}
								<div class="pt-2 border-t border-border/50 flex items-center justify-end gap-1.5">
									<button
										type="button"
										onclick={() => openEditRekeningModal(rek)}
										class="p-1.5 rounded-lg text-primary hover:bg-primary/10 transition-colors cursor-pointer"
										title="Ubah Rekening"
									>
										<Pencil class="w-3.5 h-3.5" />
									</button>

									<form method="POST" action={`?scope=${data.activeScope}&id=${data.activeId}&tab=${activeTab}&/deleteRekening`} use:enhance={keepScrollSubmit()}>
										<input type="hidden" name="id" value={rek.id} />
										<input type="hidden" name="scope" value={data.activeScope} />
										<input type="hidden" name="targetId" value={data.activeId} />
										<input type="hidden" name="tab" value={activeTab} />
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
	{/if}
	{/if}
</div>

<!-- MODAL PREVIEW BUKTI TRANSFER -->
{#if previewBuktiUrl}
	<div class="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
		<div class="bg-card border border-border rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl space-y-4 p-4 animate-in fade-in zoom-in-95">
			<div class="flex items-center justify-between">
				<h3 class="text-sm font-bold text-foreground">Pratinjau Bukti Transfer</h3>
				<button
					type="button"
					onclick={() => (previewBuktiUrl = null)}
					class="p-1.5 rounded-lg text-foreground/60 hover:text-foreground hover:bg-secondary"
				>
					<X class="w-4 h-4" />
				</button>
			</div>

			<div class="max-h-[70vh] overflow-auto flex items-center justify-center bg-black/5 rounded-xl p-2">
				<img src={previewBuktiUrl} alt="Bukti Transfer" class="max-w-full max-h-[60vh] object-contain rounded-lg" />
			</div>

			<div class="flex justify-end">
				<a
					href={previewBuktiUrl}
					target="_blank"
					rel="noreferrer"
					class="inline-flex items-center gap-1 text-xs text-primary font-bold hover:underline"
				>
					<span>Buka Tab Baru</span>
					<ExternalLink class="w-3.5 h-3.5" />
				</a>
			</div>
		</div>
	</div>
{/if}

<!-- MODAL REJECT TRANSAKSI -->
{#if rejectModalOpen}
	<div class="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
		<div class="bg-card border border-border rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
			<div class="flex items-center justify-between">
				<h3 class="text-sm font-bold text-foreground">Tolak Laporan Shodaqoh</h3>
				<button
					type="button"
					onclick={() => (rejectModalOpen = false)}
					class="p-1.5 rounded-lg text-foreground/60 hover:text-foreground hover:bg-secondary"
				>
					<X class="w-4 h-4" />
				</button>
			</div>

			<form method="POST" action={`?scope=${data.activeScope}&id=${data.activeId}&tab=${activeTab}&/reject`} use:enhance={keepScrollSubmit({
				onSuccess: () => {
					rejectModalOpen = false;
				}
			})}>
				<input type="hidden" name="id" value={rejectTargetId} />
				<input type="hidden" name="scope" value={data.activeScope} />
				<input type="hidden" name="targetId" value={data.activeId} />
				<input type="hidden" name="tab" value={activeTab} />

				<div class="space-y-2">
					<label class="text-xs font-semibold text-foreground" for="alasanPenolakanInput">Alasan Penolakan</label>
					<textarea
						id="alasanPenolakanInput"
						name="alasanPenolakan"
						bind:value={rejectAlasan}
						rows="3"
						class="w-full bg-secondary/50 border border-border rounded-xl p-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-rose-500"
						placeholder="Misal: Bukti transfer tidak valid atau dana belum masuk rekening..."
						required
					></textarea>
				</div>

				<div class="flex justify-end gap-2 pt-4">
					<button
						type="button"
						onclick={() => (rejectModalOpen = false)}
						class="px-3 py-2 rounded-xl text-xs font-semibold bg-secondary hover:bg-secondary/80 text-foreground"
					>
						Batal
					</button>
					<button
						type="submit"
						class="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs"
					>
						Tolak Laporan
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- MODAL TAMBAH JENIS SHODAQOH -->
{#if isAddJenisOpen}
	<div class="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
		<div class="bg-card border border-border rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
			<div class="flex items-center justify-between">
				<h3 class="text-sm font-bold text-foreground">Tambah Jenis Shodaqoh ({data.activeWilayahInfo.nama})</h3>
				<button
					type="button"
					onclick={() => (isAddJenisOpen = false)}
					class="p-1.5 rounded-lg text-foreground/60 hover:text-foreground hover:bg-secondary"
				>
					<X class="w-4 h-4" />
				</button>
			</div>

			<form method="POST" action={`?scope=${data.activeScope}&id=${data.activeId}&tab=${activeTab}&/addJenis`} use:enhance={keepScrollSubmit({
				onSuccess: () => {
					isAddJenisOpen = false;
					jenisNama = '';
					jenisDeskripsi = '';
				}
			})}>
				<input type="hidden" name="scope" value={data.activeScope} />
				<input type="hidden" name="targetId" value={data.activeId} />
				<input type="hidden" name="tab" value={activeTab} />

				<div class="space-y-3 text-xs">
					<div class="space-y-1">
						<label class="font-semibold text-foreground" for="namaJenisInput">Nama Jenis Shodaqoh</label>
						<input
							id="namaJenisInput"
							type="text"
							name="nama"
							bind:value={jenisNama}
							placeholder="Contoh: Pembangunan, Forsgi, Asad, Santunan"
							class="w-full bg-secondary/60 border border-border rounded-xl px-3 py-2 text-foreground focus:ring-1 focus:ring-primary outline-none"
							required
						/>
					</div>

					<div class="space-y-1">
						<label class="font-semibold text-foreground" for="deskripsiJenisInput">Keterangan / Alokasi</label>
						<textarea
							id="deskripsiJenisInput"
							name="deskripsi"
							bind:value={jenisDeskripsi}
							rows="2"
							placeholder="Penjelasan tujuan shodaqoh ini..."
							class="w-full bg-secondary/60 border border-border rounded-xl p-3 text-foreground focus:ring-1 focus:ring-primary outline-none"
						></textarea>
					</div>
				</div>

				<div class="flex justify-end gap-2 pt-4">
					<button
						type="button"
						onclick={() => (isAddJenisOpen = false)}
						class="px-3 py-2 rounded-xl text-xs font-semibold bg-secondary hover:bg-secondary/80 text-foreground"
					>
						Batal
					</button>
					<button
						type="submit"
						class="px-4 py-2 rounded-xl text-xs font-bold bg-primary text-primary-foreground shadow-xs hover:bg-primary/90"
					>
						Simpan Jenis
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- MODAL TAMBAH / UBAH REKENING ATAU QRIS -->
{#if isAddRekeningOpen}
	<div class="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
		<div class="bg-card border border-border rounded-2xl max-w-lg w-full p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
			<div class="flex items-center justify-between pb-2 border-b border-border">
				<div>
					<h3 class="text-sm font-bold text-foreground">
						{isEditingRekening ? 'Ubah' : 'Tambah'} Rekening / QRIS ({data.activeWilayahInfo.nama})
					</h3>
					<p class="text-[11px] text-foreground/50">
						{isEditingRekening ? 'Perbarui data nomor rekening atau QRIS shodaqoh.' : 'Tambahkan nomor rekening transfer atau QRIS penerima infaq/shodaqoh.'}
					</p>
				</div>
				<button
					type="button"
					onclick={closeRekeningModal}
					class="p-1.5 rounded-lg text-foreground/60 hover:text-foreground hover:bg-secondary cursor-pointer"
					aria-label="Tutup Modal"
				>
					<X class="w-4 h-4" />
				</button>
			</div>

			<form
				method="POST"
				action={`?scope=${data.activeScope}&id=${data.activeId}&tab=${activeTab}&/saveRekening`}
				enctype="multipart/form-data"
				use:enhance={keepScrollSubmit({
					onSuccess: () => {
						closeRekeningModal();
					}
				})}
				class="space-y-3.5 text-xs"
			>
				<input type="hidden" name="scope" value={data.activeScope} />
				<input type="hidden" name="targetId" value={data.activeId} />
				<input type="hidden" name="tab" value={activeTab} />
				<input type="hidden" name="metodeTipe" value={rekeningMetodeTipe} />
				{#if isEditingRekening}
					<input type="hidden" name="rekeningId" value={editRekeningId} />
				{/if}

				<!-- Switcher Tipe: Transfer Bank vs QRIS -->
				<div class="grid grid-cols-2 gap-2 p-1 bg-secondary/60 rounded-xl text-xs">
					<button
						type="button"
						onclick={() => (rekeningMetodeTipe = 'bank')}
						class="py-2 rounded-lg font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer {rekeningMetodeTipe === 'bank'
							? 'bg-card text-foreground shadow-xs'
							: 'text-foreground/60'}"
					>
						<Building2 class="w-4 h-4" /> Transfer Bank
					</button>
					<button
						type="button"
						onclick={() => (rekeningMetodeTipe = 'qris')}
						class="py-2 rounded-lg font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer {rekeningMetodeTipe === 'qris'
							? 'bg-card text-foreground shadow-xs'
							: 'text-foreground/60'}"
					>
						<QrCode class="w-4 h-4" /> QRIS Shodaqoh
					</button>
				</div>

				{#if rekeningMetodeTipe === 'bank'}
					<div class="space-y-1">
						<label class="font-semibold text-foreground" for="namaBankInput">Nama Bank *</label>
						<input
							id="namaBankInput"
							type="text"
							name="namaBank"
							bind:value={rekeningNamaBank}
							placeholder="Contoh: Bank Syariah Indonesia (BSI), BCA, Mandiri"
							class="w-full bg-secondary/50 border border-border rounded-xl px-3.5 py-2 text-foreground focus:ring-1 focus:ring-primary outline-none"
							required
						/>
					</div>

					<div class="space-y-1">
						<label class="font-semibold text-foreground" for="nomorRekeningInput">Nomor Rekening *</label>
						<input
							id="nomorRekeningInput"
							type="text"
							name="nomorRekening"
							bind:value={rekeningNomor}
							placeholder="Contoh: 1234567890"
							class="w-full bg-secondary/50 border border-border rounded-xl px-3.5 py-2 font-mono text-foreground focus:ring-1 focus:ring-primary outline-none"
							required
						/>
					</div>
				{:else}
					<!-- Bagian QRIS -->
					<div class="space-y-1">
						<label class="font-semibold text-foreground" for="namaBankInputQris">Label QRIS / Penyedia</label>
						<input
							id="namaBankInputQris"
							type="text"
							name="namaBank"
							bind:value={rekeningNamaBank}
							placeholder="Contoh: QRIS, Gopay Merchant, Nobu"
							class="w-full bg-secondary/50 border border-border rounded-xl px-3.5 py-2 text-foreground focus:ring-1 focus:ring-primary outline-none"
						/>
					</div>

					<div class="space-y-2 p-3 bg-secondary/30 border border-border rounded-xl">
						<div class="flex items-center justify-between">
							<span class="block text-xs font-semibold text-foreground">
								Gambar QRIS Shodaqoh *
							</span>
							<div class="flex items-center gap-1 text-[11px]">
								<button
									type="button"
									onclick={() => (inputQrisMode = 'upload')}
									class="px-2 py-0.5 rounded font-medium transition-colors cursor-pointer {inputQrisMode === 'upload' ? 'bg-primary text-primary-foreground' : 'text-foreground/60 hover:text-foreground'}"
								>
									Unggah Berkas
								</button>
								<button
									type="button"
									onclick={() => (inputQrisMode = 'url')}
									class="px-2 py-0.5 rounded font-medium transition-colors cursor-pointer {inputQrisMode === 'url' ? 'bg-primary text-primary-foreground' : 'text-foreground/60 hover:text-foreground'}"
								>
									Tautan URL
								</button>
							</div>
						</div>

						{#if inputQrisMode === 'upload'}
							<input
								type="file"
								id="qrisFileInput"
								name="qrisFile"
								accept="image/*"
								onchange={handleQrisFileChange}
								class="w-full text-xs text-foreground/80 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
								required={!isEditingRekening && !qrisFilePreview && !rekeningQrisUrl}
							/>
							<p class="text-[11px] text-foreground/50">
								Format: PNG, JPG, JPEG, WEBP.
							</p>
						{:else}
							<input
								type="text"
								id="rekeningQrisUrlInput"
								name="qrisImageUrl"
								bind:value={rekeningQrisUrl}
								oninput={() => (qrisFilePreview = rekeningQrisUrl)}
								placeholder="https://... atau /uploads/qris/..."
								class="w-full bg-secondary/50 border border-border rounded-xl px-3.5 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
								required={!isEditingRekening && !qrisFilePreview}
							/>
						{/if}

						{#if qrisFilePreview || rekeningQrisUrl}
							<div class="pt-2 flex items-center gap-3">
								<div class="w-16 h-16 bg-white rounded-lg p-1 border border-border shrink-0 flex items-center justify-center overflow-hidden">
									<img
										src={qrisFilePreview || rekeningQrisUrl}
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

				<div class="space-y-1">
					<label class="font-semibold text-foreground" for="atasNamaInput">Atas Nama (Pemilik Rekening / QRIS) *</label>
					<input
						id="atasNamaInput"
						type="text"
						name="atasNama"
						bind:value={rekeningAtasNama}
						placeholder="Nama pemilik rekening atau nama kelompok"
						class="w-full bg-secondary/50 border border-border rounded-xl px-3.5 py-2 text-foreground focus:ring-1 focus:ring-primary outline-none"
						required
					/>
				</div>

				<div class="space-y-1">
					<label class="font-semibold text-foreground" for="tipeTujuanInput">Tipe Alokasi / Tujuan Shodaqoh *</label>
					<SearchableSelect
						id="tipeTujuanInput"
						name="tipeTujuan"
						options={alokasiOptions}
						bind:value={rekeningTujuan}
						allowCustom={true}
						customLabel="Gunakan alokasi baru"
						searchPlaceholder="Cari alokasi atau ketik nama alokasi baru..."
						placeholder="-- Pilih Alokasi Shodaqoh --"
						required={true}
					/>
					<p class="text-[11px] text-foreground/50">
						Pilih alokasi standar atau ketik langsung nama alokasi baru.
					</p>
				</div>

				<div class="space-y-1">
					<label class="font-semibold text-foreground" for="keteranganRekeningInput">Catatan / Pesan Shodaqoh (Opsional)</label>
					<input
						id="keteranganRekeningInput"
						type="text"
						name="keterangan"
						bind:value={rekeningKeterangan}
						placeholder="Misal: Mohon sertakan berita transfer atau konfirmasi ke bendahara."
						class="w-full bg-secondary/50 border border-border rounded-xl px-3.5 py-2 text-foreground focus:ring-1 focus:ring-primary outline-none"
					/>
				</div>

				{#if isEditingRekening}
					<div class="flex items-center gap-2 pt-1">
						<input
							type="checkbox"
							id="rekeningIsActiveInput"
							name="isActive"
							value="1"
							bind:checked={rekeningIsActive}
							class="rounded border-border text-primary focus:ring-primary"
						/>
						<label for="rekeningIsActiveInput" class="text-xs font-medium text-foreground cursor-pointer">
							Rekening aktif (Dapat dilihat jamaah saat berinfaq)
						</label>
					</div>
				{/if}

				<div class="flex justify-end gap-2 pt-3 border-t border-border">
					<button
						type="button"
						onclick={closeRekeningModal}
						class="px-3.5 py-2 rounded-xl text-xs font-semibold bg-secondary hover:bg-secondary/80 text-foreground cursor-pointer transition-colors"
					>
						Batal
					</button>
					<button
						type="submit"
						class="px-4 py-2 rounded-xl text-xs font-bold bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 cursor-pointer transition-colors"
					>
						{isEditingRekening
							? rekeningMetodeTipe === 'qris'
								? 'Simpan QRIS'
								: 'Simpan Rekening'
							: rekeningMetodeTipe === 'qris'
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
		<div class="bg-card border border-border rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4 text-center animate-in fade-in zoom-in-95">
			<div class="flex items-center justify-between pb-2 border-b border-border">
				<h3 class="font-bold text-sm text-foreground">{previewQrisTitle || 'Kode QRIS Shodaqoh'}</h3>
				<button
					type="button"
					onclick={() => (previewQrisUrl = null)}
					class="p-1 rounded-lg text-foreground/40 hover:text-foreground transition-colors cursor-pointer"
					aria-label="Tutup Preview QRIS"
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

<!-- MODAL STRUK DIGITAL / TANDA TERIMA RESMI ADMIN (E-RECEIPT) -->
{#if selectedReceiptAdmin}
	<div class="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
		<div class="bg-card border border-border rounded-3xl max-w-sm w-full p-5 sm:p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 relative print:shadow-none print:border-none print:m-0 print:p-4">
			<!-- Header Struk & Tombol Tutup -->
			<div class="flex items-center justify-between pb-3 border-b border-border print:border-gray-200">
				<div class="flex items-center gap-2">
					<div class="w-8 h-8 rounded-xl bg-primary text-primary-foreground font-bold flex items-center justify-center text-xs shadow-xs">
						SG
					</div>
					<div>
						<h3 class="text-xs font-bold text-foreground leading-tight">Satu Generus</h3>
						<p class="text-[10px] text-foreground/60">Tanda Terima Shodaqoh Resmi</p>
					</div>
				</div>

				<button
					type="button"
					onclick={() => (selectedReceiptAdmin = null)}
					class="p-1.5 rounded-xl text-foreground/50 hover:text-foreground hover:bg-secondary print:hidden"
					aria-label="Tutup Struk"
				>
					<X class="w-4 h-4" />
				</button>
			</div>

			<!-- Badan Struk / Invoice Card -->
			<div class="space-y-3.5 text-xs">
				<!-- Nominal Besar -->
				<div class="bg-secondary/60 rounded-2xl p-4 text-center space-y-1 border border-border/80">
					<span class="text-[10px] font-semibold text-foreground/60 uppercase tracking-wider">Total Shodaqoh</span>
					<div class="text-2xl font-extrabold text-primary font-mono tracking-tight">
						{formatRupiah(selectedReceiptAdmin.nominal)}
					</div>
					<div class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 mt-1">
						<CheckCircle2 class="w-3 h-3" /> Berhasil Diverifikasi
					</div>
				</div>

				<!-- Detail Data Transaksi -->
				<div class="divide-y divide-border/60 text-[11px]">
					<div class="py-2 flex items-center justify-between">
						<span class="text-foreground/60">No. Referensi</span>
						<span class="font-mono font-bold text-foreground">SG-SHD-{selectedReceiptAdmin.id.substring(0, 8).toUpperCase()}</span>
					</div>
					<div class="py-2 flex items-center justify-between">
						<span class="text-foreground/60">Tanggal & Waktu</span>
						<span class="font-medium text-foreground">{selectedReceiptAdmin.tanggalTransfer || '-'}</span>
					</div>
					<div class="py-2 flex items-center justify-between">
						<span class="text-foreground/60">Nama Donatur</span>
						<span class="font-bold text-foreground">{selectedReceiptAdmin.namaPengirim}</span>
					</div>
					<div class="py-2 flex items-center justify-between">
						<span class="text-foreground/60">Alokasi / Jenis</span>
						<span class="font-semibold text-foreground">{selectedReceiptAdmin.namaJenisShodaqoh}</span>
					</div>
					<div class="py-2 flex items-center justify-between">
						<span class="text-foreground/60">Metode</span>
						<span class="font-medium text-foreground">{selectedReceiptAdmin.metodePembayaran}</span>
					</div>
					{#if selectedReceiptAdmin.catatan}
						<div class="py-2 flex items-start justify-between gap-3">
							<span class="text-foreground/60 shrink-0">Niat / Doa</span>
							<span class="text-right italic text-foreground/80">{selectedReceiptAdmin.catatan}</span>
						</div>
					{/if}
				</div>

				<!-- Pesan Doa / Footer Struk -->
				<div class="p-3 rounded-xl bg-primary/5 border border-primary/15 text-center text-[10.5px] text-foreground/70 leading-relaxed italic">
					"Alhamdulillah Jazakumullahu Khoiro atas shodaqoh dan infaq yang telah disalurkan. Semoga menjadi amal jariyah yang barokah."
				</div>
			</div>

			<!-- Tombol Aksi Struk -->
			<div class="flex items-center gap-2 pt-2 print:hidden">
				<button
					type="button"
					onclick={() => (selectedReceiptAdmin = null)}
					class="flex-1 py-2 rounded-xl text-xs font-semibold bg-secondary hover:bg-secondary/80 text-foreground transition-colors"
				>
					Tutup
				</button>
				<button
					type="button"
					onclick={printReceiptAdmin}
					class="flex-1 py-2 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-xs flex items-center justify-center gap-1.5 active:scale-95"
				>
					<Printer class="w-3.5 h-3.5" />
					<span>Cetak / PDF</span>
				</button>
			</div>
		</div>
	</div>
{/if}

