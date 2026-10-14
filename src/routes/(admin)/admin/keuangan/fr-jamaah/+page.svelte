<!--
  @file src/routes/(admin)/admin/keuangan/fr-jamaah/+page.svelte
  @purpose Halaman FR Jamaah: daftar kartu mobile & tabel desktop dengan informasi nama, kepala keluarga, peran, status konfirmasi setoran (Menunggu/Diterima/Belum), nominal readonly di list luar, modal detail interaktif dengan dukungan input manual offline/buku fisik per pos anggaran atau total langsung (format angka fleksibel pemisah ribuan tanpa konflik pattern), serta approval setoran mandiri khusus KU dan ekspor CSV
  @usedBy Route admin '/admin/keuangan/fr-jamaah'
  @dependencies @lucide/svelte, Svelte 5 Runes, #lib/components/SearchableSelect.svelte, $app/forms (enhance), #lib/keepScroll.ts (keepScrollSubmit)
  @publicFunctions openDetail, closeDetail, handleModalPosInput, handleModalTotalInput, handleNumberKeyDown, exportToCsv, formatRupiah
  @sideEffects Mengirim form input manual via ?/saveSetoranManual; approval/reject via ?/approveSetoran & ?/rejectSetoran; ekspor CSV di client
-->
<script lang="ts">
	import { enhance } from '$app/forms';
	import SearchableSelect from '#lib/components/SearchableSelect.svelte';
	import { keepScrollSubmit } from '#lib/keepScroll.js';
	import {
	  AlertCircle,
	  Building2,
	  Check,
	  CheckCircle2,
	  ChevronDown,
	  Clock,
	  Download,
	  Edit3,
	  ExternalLink,
	  Eye,
	  Filter,
	  HandCoins,
	  Image,
	  Layers,
	  Lock,
	  RotateCcw,
	  Save,
	  Search,
	  ShieldCheck,
	  Wallet,
	  X
	} from '@lucide/svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form } = $props<{ data: PageData; form: ActionData }>();

	// State Filter
	let selectedKelompok = $state<string | number>(data.selectedKelompokId ?? '');
	let selectedTahun = $state<number>(data.tahun);
	let selectedBulan = $state<number>(data.bulan);
	let searchQuery = $state('');
	let isFilterOpen = $state(false);

	$effect(() => {
		selectedKelompok = data.selectedKelompokId ?? '';
		selectedTahun = data.tahun;
		selectedBulan = data.bulan;
	});

	// State Modal Detail, Approval & Input Manual KU
	type BreakdownItem = {
		posId: string;
		nama: string;
		kode: string;
		nominal: number;
	};

	type JamaahItem = {
		id: string;
		namaLengkap: string;
		jenisKelamin: string;
		statusGenerus: string | null;
		statusHubungan: string;
		profesi: string | null;
		noTelepon: string | null;
		keluargaId: string;
		kepalaKeluargaNama: string | null;
		transaksiId: string | null;
		nominal: number;
		statusBayar: string;
		catatan: string;
		rawCatatan: string;
		buktiUrl: string | null;
		metode: string | null;
		tanggalLapor: string | null;
		diinputOleh: string | null;
		breakdownItems: BreakdownItem[];
		updatedAt: number | null;
		isPengurus: boolean;
		dapukanNama: string | null;
	};

	let selectedDetailJamaah = $state<JamaahItem | null>(null);
	let zoomedBuktiUrl = $state<string | null>(null);
	let isApproving = $state(false);
	let isRejecting = $state(false);
	let isSavingModal = $state(false);

	// Form State di dalam Modal Detail KU
	let modalNominal = $state(0);
	let modalNominalInputStr = $state('');
	let modalMetode = $state<'Tunai' | 'Transfer'>('Tunai');
	let modalStatusBayar = $state<string>('Diterima');
	let modalCatatan = $state('');
	let modalBreakdown = $state<Record<string, number>>({});
	let modalBreakdownStrings = $state<Record<string, string>>({});
	let activeInputMode = $state<'breakdown' | 'total'>('breakdown');

	function openDetail(j: JamaahItem) {
		selectedDetailJamaah = j;
		modalNominal = j.nominal || 0;
		modalNominalInputStr = j.nominal ? j.nominal.toLocaleString('id-ID') : '';
		modalMetode = (j.metode as any) || 'Tunai';
		modalStatusBayar = j.statusBayar === 'Belum' || !j.statusBayar ? 'Diterima' : j.statusBayar;
		modalCatatan = j.catatan || '';

		const bd: Record<string, number> = {};
		const bdStr: Record<string, string> = {};
		let hasBreakdown = false;

		if (j.breakdownItems && j.breakdownItems.length > 0) {
			for (const item of j.breakdownItems) {
				bd[item.posId] = item.nominal;
				bdStr[item.posId] = item.nominal ? item.nominal.toLocaleString('id-ID') : '';
				if (item.nominal > 0) hasBreakdown = true;
			}
		}

		modalBreakdown = bd;
		modalBreakdownStrings = bdStr;
		activeInputMode = hasBreakdown || (data.categoriesWithPos && data.categoriesWithPos.length > 0) ? 'breakdown' : 'total';
	}

	function closeDetail() {
		selectedDetailJamaah = null;
	}

	function formatTanggalLapor(isoString: string | null): string {
		if (!isoString) return '-';
		try {
			const d = new Date(isoString);
			return d.toLocaleDateString('id-ID', {
				day: 'numeric',
				month: 'short',
				year: 'numeric',
				hour: '2-digit',
				minute: '2-digit'
			});
		} catch {
			return isoString;
		}
	}

	// Opsi Bulan & Tahun
	const bulanNames = [
		'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
		'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
	];
	const bulanOptions = bulanNames.map((nama, idx) => ({
		value: idx + 1,
		label: nama
	}));

	const currentYear = new Date().getFullYear();
	const tahunOptions = [
		currentYear - 2,
		currentYear - 1,
		currentYear,
		currentYear + 1
	].map((y) => ({ value: y, label: String(y) }));

	// Opsi Kelompok (SearchableSelect)
	const kelompokOptions = $derived(
		(data.accessibleWilayah.kelompokList || []).map((k: any) => ({
			value: k.id,
			label: k.nama,
			sublabel: k.desaNama ? `Desa ${k.desaNama}` : undefined
		}))
	);

	function applyFilter() {
		if (!selectedKelompok) {
			window.location.href = `/admin/keuangan/fr-jamaah?tahun=${selectedTahun}&bulan=${selectedBulan}`;
			return;
		}
		window.location.href = `/admin/keuangan/fr-jamaah?kelompokId=${selectedKelompok}&tahun=${selectedTahun}&bulan=${selectedBulan}`;
	}

	function handleModalPosInput(posId: string, valueStr: string) {
		const rawDigits = valueStr.replace(/\D/g, '');
		const num = rawDigits ? parseInt(rawDigits, 10) : 0;
		modalBreakdown = { ...modalBreakdown, [posId]: num };
		modalBreakdownStrings = { ...modalBreakdownStrings, [posId]: num ? num.toLocaleString('id-ID') : '' };

		// Hitung ulang total penjumlahan seluruh pos breakdown
		const total = Object.values(modalBreakdown).reduce((acc, v) => acc + (v || 0), 0);
		modalNominal = total;
		modalNominalInputStr = total ? total.toLocaleString('id-ID') : '';
	}

	function handleModalTotalInput(valueStr: string) {
		const rawDigits = valueStr.replace(/\D/g, '');
		const num = rawDigits ? parseInt(rawDigits, 10) : 0;
		modalNominal = num;
		modalNominalInputStr = num ? num.toLocaleString('id-ID') : '';
	}

	function handleNumberKeyDown(e: KeyboardEvent) {
		if (
			[
				'Backspace',
				'Delete',
				'Tab',
				'Escape',
				'Enter',
				'ArrowLeft',
				'ArrowRight',
				'Home',
				'End'
			].includes(e.key) ||
			(e.ctrlKey && ['a', 'c', 'v', 'x'].includes(e.key.toLowerCase())) ||
			(e.metaKey && ['a', 'c', 'v', 'x'].includes(e.key.toLowerCase()))
		) {
			return;
		}
		if (!/^\d$/.test(e.key)) {
			e.preventDefault();
		}
	}

	// Filtering Jamaah di Tabel
	const filteredJamaah = $derived(
		data.jamaahList.filter((j: JamaahItem) => {
			if (!searchQuery.trim()) return true;
			const q = searchQuery.toLowerCase();
			return (
				j.namaLengkap.toLowerCase().includes(q) ||
				(j.kepalaKeluargaNama && j.kepalaKeluargaNama.toLowerCase().includes(q)) ||
				(j.isPengurus ? 'pengurus' : 'jamaah biasa').includes(q) ||
				(j.dapukanNama && j.dapukanNama.toLowerCase().includes(q))
			);
		})
	);

	// Perhitungan Agregat Real-time
	const totalWajib = $derived(data.jamaahList.length);
	const totalSudahSetor = $derived(
		data.jamaahList.filter((j: JamaahItem) => (j.nominal || 0) > 0).length
	);
	const totalNominal = $derived(
		data.jamaahList.reduce((acc: number, j: JamaahItem) => acc + (j.nominal || 0), 0)
	);

	function formatRupiah(num: number): string {
		return new Intl.NumberFormat('id-ID', {
			style: 'currency',
			currency: 'IDR',
			maximumFractionDigits: 0
		}).format(num);
	}

	function exportToCsv() {
		if (!data.jamaahList || data.jamaahList.length === 0) return;

		const namaBulan = bulanNames[data.bulan - 1] || `Bulan ${data.bulan}`;
		const rows: string[][] = [
			['No', 'Nama Jamaah', 'Kepala Keluarga', 'Peran / Dapukan', 'Periode', 'Nominal FR (Rp)', 'Status Bayar', 'Catatan']
		];

		filteredJamaah.forEach((j: JamaahItem, idx: number) => {
			const peranStr = j.isPengurus ? `Pengurus (${j.dapukanNama || '-'})` : 'Jamaah Biasa';
			rows.push([
				String(idx + 1),
				`"${(j.namaLengkap || '').replace(/"/g, '""')}"`,
				`"${(j.kepalaKeluargaNama || '-').replace(/"/g, '""')}"`,
				`"${peranStr.replace(/"/g, '""')}"`,
				`"${namaBulan} ${data.tahun}"`,
				String(j.nominal || 0),
				j.nominal > 0 ? (j.statusBayar || 'Lunas') : 'Belum',
				`"${(j.catatan || '').replace(/"/g, '""')}"`
			]);
		});

		const csvContent = '\uFEFF' + rows.map((r) => r.join(',')).join('\r\n');
		const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.setAttribute('download', `FR-Jamaah-${(data.selectedKelompokNama || 'Kelompok').replace(/\s+/g, '_')}-${namaBulan}-${data.tahun}.csv`);
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(url);
	}
</script>

<div class="space-y-6 pb-36 md:pb-24">
	<!-- HEADER HALAMAN -->
	<div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
		<div>
			<div class="flex items-center gap-2">
				<HandCoins class="w-6 h-6 text-primary" />
				<h1 class="text-xl md:text-2xl font-bold text-foreground">FR Jamaah (Wajib Isrun)</h1>
			</div>
		</div>

		<!-- Status Wewenang & Shortcut Template FR -->
		<div class="flex items-center gap-2 flex-wrap">
			<a
				href="/admin/keuangan/template-fr{data.selectedKelompokId ? `?kelompokId=${data.selectedKelompokId}` : ''}"
				class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-secondary hover:bg-secondary/80 border border-border text-foreground transition-all shadow-xs"
			>
				<Layers class="w-4 h-4 text-primary" />
				<span>Template & Pos FR</span>
			</a>
			{#if data.canEdit}
				<span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
					<ShieldCheck class="w-4 h-4" />
					<span>Akses Edit Aktif ({data.adminScope?.isPusat ? 'Superadmin' : 'KU'})</span>
				</span>
			{:else if data.isFinanceAdmin}
				<span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
					<ShieldCheck class="w-4 h-4" />
					<span>Pengurus {data.adminScope?.isPusat ? 'Superadmin' : 'KU'}</span>
				</span>
			{:else}
				<span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-secondary text-foreground/60 border border-border">
					<Lock class="w-4 h-4" />
					<span>Mode Read-Only (Kyai / Aghnia)</span>
				</span>
			{/if}
		</div>
	</div>

	<!-- FEEDBACK NOTIFIKASI -->
	{#if form?.success}
		<div class="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2 shadow-xs">
			<Check class="w-4 h-4 shrink-0 text-emerald-500" />
			<span class="font-bold">{form.message || 'Data FR Tersimpan'}</span>
		</div>
	{:else if form?.error}
		<div class="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2 shadow-xs">
			<AlertCircle class="w-4 h-4 shrink-0 text-rose-500" />
			<span class="font-semibold">{form.error}</span>
		</div>
	{/if}

	<!-- FILTER WILAYAH & PERIODE (COLLAPSIBLE DI MOBILE) -->
	<div class="bg-card border border-border rounded-2xl p-4 md:p-5 shadow-xs space-y-4">
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-2">
				<Filter class="w-4 h-4 text-primary" />
				<h2 class="text-sm font-bold text-foreground">Filter Wilayah & Periode Setoran</h2>
			</div>
			<button
				type="button"
				onclick={() => (isFilterOpen = !isFilterOpen)}
				class="md:hidden inline-flex items-center gap-1 text-xs font-medium text-foreground/60 hover:text-foreground"
			>
				<span>{isFilterOpen ? 'Tutup Filter' : 'Buka Filter'}</span>
				<ChevronDown class="w-4 h-4 transition-transform {isFilterOpen ? 'rotate-180' : ''}" />
			</button>
		</div>

		<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 {isFilterOpen ? 'block' : 'hidden md:grid'}">
			<!-- Pilihan Kelompok (SearchableSelect) -->
			<div class="sm:col-span-2">
				<label for="selectKelompok" class="block text-xs font-semibold text-foreground mb-1">
					Kelompok Binaan *
				</label>
				<SearchableSelect
					id="selectKelompok"
					name="kelompok"
					options={kelompokOptions}
					bind:value={selectedKelompok}
					placeholder="-- Pilih Kelompok Binaan --"
					searchPlaceholder="Cari nama kelompok..."
					onchange={applyFilter}
				/>
			</div>

			<!-- Pilihan Bulan -->
			<div>
				<label for="selectBulan" class="block text-xs font-semibold text-foreground mb-1">
					Bulan Setoran
				</label>
				<select
					id="selectBulan"
					bind:value={selectedBulan}
					onchange={applyFilter}
					class="w-full bg-secondary/50 border border-border rounded-xl px-3.5 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
				>
					{#each bulanOptions as b}
						<option value={b.value}>{b.label}</option>
					{/each}
				</select>
			</div>

			<!-- Pilihan Tahun -->
			<div>
				<label for="selectTahun" class="block text-xs font-semibold text-foreground mb-1">
					Tahun Setoran
				</label>
				<select
					id="selectTahun"
					bind:value={selectedTahun}
					onchange={applyFilter}
					class="w-full bg-secondary/50 border border-border rounded-xl px-3.5 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
				>
					{#each tahunOptions as t}
						<option value={t.value}>{t.label}</option>
					{/each}
				</select>
			</div>
		</div>
	</div>

	<!-- KONDISI JIKA KELOMPOK BELUM DIPILIH -->
	{#if !data.selectedKelompokId}
		<div class="bg-card border border-border rounded-2xl p-12 text-center shadow-xs space-y-3">
			<div class="w-14 h-14 rounded-2xl bg-secondary/70 mx-auto flex items-center justify-center text-foreground/40">
				<Building2 class="w-7 h-7" />
			</div>
			<div class="max-w-md mx-auto space-y-1">
				<h3 class="font-bold text-base text-foreground">Kelompok Belum Dipilih</h3>
				<p class="text-xs text-foreground/60 leading-relaxed">
					Silakan pilih salah satu kelompok binaan pada filter dropdown di atas untuk memuat daftar jamaah yang wajib isrun dan mengisi setoran shodaqoh FR.
				</p>
			</div>
		</div>
	{:else}
		<!-- RINGKASAN METRIK PERIODE KELOMPOK -->
		<div class="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
			<div class="bg-card border border-border rounded-xl p-4 shadow-xs space-y-1">
				<span class="text-xs text-foreground/60 font-medium">Total Wajib Isrun</span>
				<div class="flex items-baseline gap-2">
					<span class="text-2xl font-bold text-foreground">{totalWajib}</span>
					<span class="text-xs text-foreground/50">Jamaah Aktif</span>
				</div>
			</div>

			<div class="bg-card border border-border rounded-xl p-4 shadow-xs space-y-1">
				<span class="text-xs text-foreground/60 font-medium">Sudah Menyetor FR</span>
				<div class="flex items-baseline gap-2">
					<span class="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{totalSudahSetor}</span>
					<span class="text-xs text-foreground/50">dari {totalWajib} ({totalWajib ? Math.round((totalSudahSetor / totalWajib) * 100) : 0}%)</span>
				</div>
			</div>

			<div class="bg-card border border-border rounded-xl p-4 shadow-xs space-y-1">
				<span class="text-xs text-foreground/60 font-medium">Akumulasi Shodaqoh FR</span>
				<div class="text-2xl font-bold text-primary truncate">
					{formatRupiah(totalNominal)}
				</div>
			</div>
		</div>

		<!-- TABEL DATA JAMAAH FR -->
		<div class="bg-card border border-border rounded-2xl p-4 md:p-5 shadow-xs space-y-4">
			<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
				<div>
					<h3 class="font-bold text-base text-foreground">
						Daftar Jamaah Kelompok {data.selectedKelompokNama}
					</h3>
					<p class="text-xs text-foreground/50 mt-0.5">
						Periode {bulanNames[data.bulan - 1]} {data.tahun}
					</p>
				</div>

				<!-- Pencarian Cepat Nama Jamaah & Tombol Ekspor -->
				<div class="flex items-center gap-2 w-full sm:w-auto">
					<div class="relative flex-1 sm:w-60">
						<Search class="w-4 h-4 text-foreground/40 absolute left-3 top-1/2 -translate-y-1/2" />
						<input
							type="text"
							bind:value={searchQuery}
							placeholder="Cari nama jamaah / KK..."
							class="w-full bg-secondary/50 border border-border rounded-xl pl-9 pr-3.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
						/>
					</div>

					<button
						type="button"
						onclick={exportToCsv}
						class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-card hover:bg-secondary text-foreground text-xs font-semibold shrink-0 transition-colors shadow-xs"
						title="Unduh daftar FR Jamaah dalam format CSV / Excel"
					>
						<Download class="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
						<span class="hidden sm:inline">Ekspor CSV</span>
						<span class="sm:hidden">CSV</span>
					</button>
				</div>
			</div>

			{#if filteredJamaah.length === 0}
				<div class="p-8 text-center text-foreground/50 text-xs rounded-xl border border-dashed border-border">
					{#if searchQuery}
						Tidak ada nama jamaah yang cocok dengan kata kunci pencarian "{searchQuery}".
					{:else}
						Tidak ditemukan data jamaah dengan status wajib isrun di kelompok ini.
					{/if}
				</div>
			{:else}
				<!-- DAFTAR KARTU MOBILE (md:hidden): card simetris dengan nama & angka nominal yang jelas -->
				<div class="md:hidden space-y-2.5">
					{#each filteredJamaah as j, idx (j.id)}
						<div class="bg-card border border-border rounded-2xl p-3.5 space-y-3 shadow-xs transition-all hover:border-border/80">
							<!-- Header Kartu: No, Nama Jamaah & Status + Tombol Detail/Input -->
							<div class="flex items-start justify-between gap-3">
								<div class="flex items-start gap-2.5 min-w-0 flex-1">
									<span class="w-6 h-6 rounded-lg bg-secondary text-foreground/70 font-mono text-xs font-bold flex items-center justify-center shrink-0 mt-0.5 border border-border/60">
										{idx + 1}
									</span>
									<div class="min-w-0 flex-1">
										<h4 class="text-sm font-bold text-foreground tracking-tight leading-snug truncate">
											{j.namaLengkap}
										</h4>
										<div class="flex flex-wrap items-center gap-1.5 text-[11px] text-foreground/60 mt-0.5">
											{#if j.kepalaKeluargaNama}
												<span class="truncate">KK: {j.kepalaKeluargaNama}</span>
												<span>•</span>
											{/if}
											{#if j.isPengurus}
												<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20">
													Pengurus{j.dapukanNama ? ` (${j.dapukanNama})` : ''}
												</span>
											{:else}
												<span class="text-foreground/50 font-medium">Jamaah Biasa</span>
											{/if}
										</div>
									</div>
								</div>

								<!-- Status Pembayaran & Tombol Aksi Detail -->
								<div class="flex items-center gap-1.5 shrink-0">
									{#if j.statusBayar === 'Menunggu Konfirmasi' || j.statusBayar === 'Menunggu'}
										<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
											<Clock class="w-2.5 h-2.5 stroke-[2.5]" />
											<span>Menunggu</span>
										</span>
									{:else if j.statusBayar === 'Diterima'}
										<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
											<Check class="w-2.5 h-2.5 stroke-[2.5]" />
											<span>Diterima</span>
										</span>
									{:else if j.nominal > 0}
										<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
											<Check class="w-2.5 h-2.5 stroke-[2.5]" />
											<span>Lunas</span>
										</span>
									{:else}
										<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-secondary text-foreground/50 border border-border">
											Belum
										</span>
									{/if}

									<button
										type="button"
										onclick={() => openDetail(j)}
										class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-all {j.buktiUrl ? 'bg-primary/10 hover:bg-primary/20 text-primary border-primary/30 font-bold shadow-2xs' : data.canEdit && (j.nominal === 0 || j.statusBayar === 'Belum') ? 'bg-primary/10 hover:bg-primary/20 text-primary border-primary/30 font-bold' : 'bg-secondary hover:bg-secondary/80 text-foreground/80 border-border'}"
										title="Buka detail rincian, bukti transfer, atau input manual KU"
									>
										{#if j.buktiUrl}
											<Image class="w-3 h-3 text-primary" />
											<span>Bukti</span>
										{:else if data.canEdit && (j.nominal === 0 || j.statusBayar === 'Belum')}
											<Edit3 class="w-3 h-3 text-primary" />
											<span>Input KU</span>
										{:else}
											<Eye class="w-3 h-3" />
											<span>Detail</span>
										{/if}
									</button>
								</div>
							</div>

							<!-- Nominal & Catatan Bersih (Readonly di luar) -->
							<div class="pt-2.5 border-t border-border/50 flex items-center justify-between text-xs">
								<div class="flex items-center gap-2">
									<span class="text-[11px] text-foreground/50 font-medium">Nominal FR:</span>
									<span class="font-mono font-bold text-sm text-foreground">
										{j.nominal > 0 ? formatRupiah(j.nominal) : '-'}
									</span>
								</div>
								{#if j.catatan}
									<span class="text-xs text-foreground/60 italic truncate max-w-[50%]" title={j.catatan}>
										"{j.catatan}"
									</span>
								{/if}
							</div>
						</div>
					{/each}
				</div>

				<div class="hidden md:block border border-border rounded-xl overflow-x-auto shadow-xs">
					<table class="w-full text-left text-xs min-w-[760px]">
						<thead class="bg-secondary/60 text-foreground/70 uppercase text-[11px] tracking-wider border-b border-border">
							<tr>
								<th class="py-2.5 px-3.5 font-semibold w-12 text-center">No</th>
								<th class="py-2.5 px-4 font-semibold">Nama Jamaah</th>
								<th class="py-2.5 px-4 font-semibold">Kepala Keluarga</th>
								<th class="py-2.5 px-4 font-semibold w-40">Nominal FR (Rp)</th>
								<th class="py-2.5 px-3 font-semibold w-28 text-center">Status</th>
								<th class="py-2.5 px-3 font-semibold w-32 text-center">Aksi / Bukti</th>
								<th class="py-2.5 px-4 font-semibold">Catatan / Keterangan</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-border">
							{#each filteredJamaah as j, idx (j.id)}
								<tr class="hover:bg-secondary/30 transition-colors">
									<td class="py-3 px-3.5 text-center text-foreground/50 font-mono font-semibold">
										{idx + 1}
									</td>

									<!-- Nama & Status Peran Pengurus / Jamaah -->
									<td class="py-3 px-4">
										<div class="font-bold text-foreground text-sm tracking-tight">{j.namaLengkap}</div>
										<div class="flex items-center gap-1.5 text-[11px] text-foreground/60 mt-0.5">
											{#if j.isPengurus}
												<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20">
													Pengurus{j.dapukanNama ? ` (${j.dapukanNama})` : ''}
												</span>
											{:else}
												<span class="text-foreground/50">Jamaah Biasa</span>
											{/if}
										</div>
									</td>

									<!-- Kepala Keluarga -->
									<td class="py-3 px-4 text-foreground/80 text-xs">
										{j.kepalaKeluargaNama || '-'}
									</td>

									<!-- Nominal FR (Readonly display, diedit di dalam modal detail) -->
									<td class="py-3 px-4">
										{#if j.nominal > 0}
											<span class="font-mono font-bold text-sm text-foreground">
												{formatRupiah(j.nominal)}
											</span>
										{:else}
											<span class="font-mono text-sm text-foreground/40 font-medium">-</span>
										{/if}
									</td>

									<!-- Status Pembayaran -->
									<td class="py-2.5 px-3 text-center">
										{#if j.statusBayar === 'Menunggu Konfirmasi' || j.statusBayar === 'Menunggu'}
											<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
												<Clock class="w-3 h-3 stroke-[2.5]" />
												<span>Menunggu</span>
											</span>
										{:else if j.statusBayar === 'Diterima'}
											<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
												<Check class="w-3 h-3 stroke-[2.5]" />
												<span>Diterima</span>
											</span>
										{:else if j.nominal > 0}
											<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
												<Check class="w-3 h-3 stroke-[2.5]" />
												<span>Lunas</span>
											</span>
										{:else}
											<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-secondary text-foreground/50 border border-border">
												Belum
											</span>
										{/if}
									</td>

									<!-- Tombol Aksi & Bukti Transfer -->
									<td class="py-2.5 px-3 text-center">
										<button
											type="button"
											onclick={() => openDetail(j)}
											class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all {j.buktiUrl ? 'bg-primary/10 hover:bg-primary/20 text-primary border-primary/30 ring-1 ring-primary/20 font-bold shadow-2xs' : data.canEdit && (j.nominal === 0 || j.statusBayar === 'Belum') ? 'bg-primary/10 hover:bg-primary/20 text-primary border-primary/30 font-bold' : 'bg-secondary/60 hover:bg-secondary text-foreground/80 border-border'}"
											title={j.buktiUrl ? 'Lihat bukti transfer & detail setoran' : data.canEdit ? 'Input manual setoran / detail' : 'Lihat detail setoran'}
										>
											{#if j.buktiUrl}
												<div class="w-4 h-4 rounded overflow-hidden shrink-0 border border-primary/40 bg-card">
													<img src={j.buktiUrl} alt="Bukti" class="w-full h-full object-cover" />
												</div>
												<span class="text-[11px]">Bukti</span>
											{:else if data.canEdit && (j.nominal === 0 || j.statusBayar === 'Belum')}
												<Edit3 class="w-3.5 h-3.5 text-primary" />
												<span class="text-[11px]">Input KU</span>
											{:else}
												<Eye class="w-3.5 h-3.5" />
												<span class="text-[11px]">Detail</span>
											{/if}
										</button>
									</td>

									<!-- Catatan -->
									<td class="py-3 px-4">
										<span class="text-xs text-foreground/70 italic truncate block max-w-xs" title={j.catatan}>
											{j.catatan || '-'}
										</span>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>
	{/if}

	<!-- MODAL DETAIL SETORAN & APPROVAL (SYARAT BUKA DETAIL SEBELUM BISA APPROVE) -->
	{#if selectedDetailJamaah}
		<div class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
			<div
				class="bg-card border border-border rounded-2xl w-full max-w-xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
				role="dialog"
				aria-modal="true"
				aria-labelledby="modalDetailTitle"
			>
				<!-- Modal Header -->
				<div class="p-4 sm:p-5 border-b border-border flex items-start justify-between gap-3 bg-secondary/30">
					<div>
						<div class="flex items-center gap-2">
							<HandCoins class="w-5 h-5 text-primary" />
							<h3 id="modalDetailTitle" class="text-base sm:text-lg font-bold text-foreground">
								Detail Setoran FR Jamaah
							</h3>
						</div>
						<p class="text-xs text-foreground/60 mt-0.5">
							Periode {bulanNames[data.bulan - 1]} {data.tahun} • {data.selectedKelompokNama}
						</p>
					</div>
					<button
						type="button"
						onclick={closeDetail}
						class="w-8 h-8 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground/70 hover:text-foreground flex items-center justify-center transition-colors border border-border shrink-0"
						aria-label="Tutup modal"
					>
						<X class="w-4 h-4" />
					</button>
				</div>

				<!-- Modal Body (Scrollable) -->
				<div class="p-4 sm:p-5 space-y-4 overflow-y-auto max-h-[calc(92vh-140px)] text-xs">
					<!-- Profil Singkat Jamaah -->
					<div class="p-3.5 rounded-xl bg-secondary/40 border border-border/70 space-y-2">
						<div class="flex items-start justify-between gap-2">
							<div>
								<div class="text-sm font-bold text-foreground">{selectedDetailJamaah.namaLengkap}</div>
								<div class="text-foreground/60 text-[11px] mt-0.5">
									Kepala Keluarga: <span class="text-foreground font-semibold">{selectedDetailJamaah.kepalaKeluargaNama || '-'}</span>
									{#if selectedDetailJamaah.statusHubungan}
										<span> • {selectedDetailJamaah.statusHubungan}</span>
									{/if}
								</div>
							</div>
							{#if selectedDetailJamaah.isPengurus}
								<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 shrink-0">
									Pengurus ({selectedDetailJamaah.dapukanNama || 'Dapukan'})
								</span>
							{:else}
								<span class="px-2 py-0.5 rounded text-[10px] font-medium bg-secondary text-foreground/60 border border-border shrink-0">
									Jamaah Biasa
								</span>
							{/if}
						</div>

						{#if selectedDetailJamaah.noTelepon}
							<div class="text-[11px] text-foreground/60">
								No. Telepon / WA: <span class="font-mono text-foreground">{selectedDetailJamaah.noTelepon}</span>
							</div>
						{/if}
					</div>

					<!-- BUKTI TRANSFER (GAMBAR DAPAT DIKLIK & DIPERBESAR) -->
					<div class="space-y-2">
						<div class="flex items-center justify-between">
							<span class="font-bold text-foreground flex items-center gap-1.5">
								<Image class="w-4 h-4 text-primary" />
								<span>Bukti Transfer / Pembayaran</span>
							</span>
							{#if selectedDetailJamaah.buktiUrl}
								<span class="text-[10px] text-primary font-medium">Klik gambar untuk memperbesar</span>
							{/if}
						</div>

						{#if selectedDetailJamaah.buktiUrl}
							<div class="relative group rounded-xl border border-border overflow-hidden bg-secondary/30 flex items-center justify-center p-2">
								<button
									type="button"
									onclick={() => (zoomedBuktiUrl = selectedDetailJamaah?.buktiUrl || null)}
									class="relative block w-full focus:outline-none cursor-pointer"
									title="Klik untuk memperbesar gambar bukti transfer"
								>
									<img
										src={selectedDetailJamaah.buktiUrl}
										alt="Bukti Transfer {selectedDetailJamaah.namaLengkap}"
										class="max-h-56 mx-auto rounded-lg object-contain transition-transform group-hover:scale-[1.02] duration-200"
									/>
									<div class="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg">
										<span class="px-3 py-1.5 rounded-lg bg-black/75 text-white text-[11px] font-semibold flex items-center gap-1.5 shadow-md">
											<Search class="w-3.5 h-3.5" />
											<span>Perbesar Gambar</span>
										</span>
									</div>
								</button>
							</div>
						{:else}
							<div class="p-3.5 rounded-xl border border-dashed border-border text-center text-foreground/50 bg-secondary/20">
								<Wallet class="w-5 h-5 mx-auto mb-1 opacity-40" />
								<p class="font-medium text-[11px]">Tidak ada lampiran bukti transfer gambar.</p>
								<p class="text-[10px] mt-0.5 text-foreground/40">Setoran tunai via buku fisik langsung ke KU atau dicatat offline.</p>
							</div>
						{/if}
					</div>

					<!-- FORM INPUT & EDIT SETORAN MANUAL FLEKSIBEL KHUSUS KU -->
					{#if data.canEdit}
						<form
							id="formManualKu"
							method="POST"
							action={`?/saveSetoranManual&kelompokId=${data.selectedKelompokId || ''}&tahun=${data.tahun}&bulan=${data.bulan}`}
							use:enhance={keepScrollSubmit({
								beforeSubmit: () => {
									isSavingModal = true;
								},
								onSuccess: () => {
									isSavingModal = false;
									if (selectedDetailJamaah) {
										selectedDetailJamaah.nominal = modalNominal;
										selectedDetailJamaah.statusBayar = modalStatusBayar;
										selectedDetailJamaah.metode = modalMetode;
										selectedDetailJamaah.catatan = modalCatatan;

										// Update breakdown items untuk display lokal
										const newItems: BreakdownItem[] = [];
										for (const [posId, nom] of Object.entries(modalBreakdown)) {
											if (nom > 0) {
												let pNama = 'Pos Anggaran';
												let pKode = '';
												for (const cat of (data.categoriesWithPos || [])) {
													const found = (cat.subPos || []).find((p: any) => p.posId === posId);
													if (found) {
														pNama = found.nama;
														pKode = found.kode;
														break;
													}
												}
												newItems.push({ posId, nama: pNama, kode: pKode, nominal: nom });
											}
										}
										selectedDetailJamaah.breakdownItems = newItems;

										const found = (data.jamaahList as JamaahItem[]).find((x) => x.id === selectedDetailJamaah?.id);
										if (found) {
											found.nominal = modalNominal;
											found.statusBayar = modalStatusBayar;
											found.metode = modalMetode;
											found.catatan = modalCatatan;
											found.breakdownItems = newItems;
										}
									}
									closeDetail();
								},
								onError: (result) => {
									isSavingModal = false;
									alert(
										(result as any)?.data?.error ||
											'Gagal menyimpan setoran manual. Silakan coba lagi.'
									);
								},
								onFinally: () => {
									isSavingModal = false;
								}
							})}
							class="border border-primary/20 bg-primary/5 rounded-2xl p-4 space-y-4"
						>
							<input type="hidden" name="kelompokId" value={data.selectedKelompokId} />
							<input type="hidden" name="anggotaId" value={selectedDetailJamaah.id} />
							<input type="hidden" name="tahun" value={data.tahun} />
							<input type="hidden" name="bulan" value={data.bulan} />
							<input type="hidden" name="nominal" value={modalNominal} />
							<input type="hidden" name="metode" value={modalMetode} />
							<input type="hidden" name="statusBayar" value={modalStatusBayar} />
							<input type="hidden" name="catatan" value={modalCatatan} />
							<input type="hidden" name="breakdownJson" value={JSON.stringify(modalBreakdown)} />

							<!-- Header Form KU -->
							<div class="flex flex-wrap items-center justify-between gap-2 border-b border-primary/10 pb-3">
								<div class="flex items-center gap-2">
									<div class="w-7 h-7 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">
										<Edit3 class="w-4 h-4" />
									</div>
									<div>
										<h5 class="text-xs font-bold text-foreground">Input / Koreksi Setoran oleh KU</h5>
										<p class="text-[10px] text-foreground/60">Input buku fisik tradisional atau koreksi rincian setoran</p>
									</div>
								</div>

								<!-- Mode Switcher: Pos vs Total -->
								<div class="inline-flex p-0.5 bg-card rounded-xl border border-border text-[11px] shadow-2xs">
									<button
										type="button"
										onclick={() => (activeInputMode = 'breakdown')}
										class="px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer {activeInputMode === 'breakdown' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-foreground/60 hover:text-foreground'}"
									>
										Rincian Pos
									</button>
									<button
										type="button"
										onclick={() => (activeInputMode = 'total')}
										class="px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer {activeInputMode === 'total' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-foreground/60 hover:text-foreground'}"
									>
										Total Saja
									</button>
								</div>
							</div>

							<!-- Pilihan Metode & Status -->
							<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
								<div class="space-y-1.5">
									<label class="text-[11px] font-semibold text-foreground/70">Metode Penyetoran:</label>
									<div class="grid grid-cols-2 gap-2">
										<button
											type="button"
											onclick={() => (modalMetode = 'Tunai')}
											class="px-3 py-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer {modalMetode === 'Tunai' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 ring-1 ring-emerald-500/20' : 'bg-card border-border text-foreground/60 hover:text-foreground'}"
										>
											<Wallet class="w-3.5 h-3.5" />
											<span>Tunai (Buku)</span>
										</button>
										<button
											type="button"
											onclick={() => (modalMetode = 'Transfer')}
											class="px-3 py-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer {modalMetode === 'Transfer' ? 'bg-primary/15 text-primary border-primary/30 ring-1 ring-primary/20' : 'bg-card border-border text-foreground/60 hover:text-foreground'}"
										>
											<Building2 class="w-3.5 h-3.5" />
											<span>Transfer</span>
										</button>
									</div>
								</div>

								<div class="space-y-1.5">
									<label class="text-[11px] font-semibold text-foreground/70">Status Penyetoran:</label>
									<div class="grid grid-cols-2 gap-2">
										<button
											type="button"
											onclick={() => (modalStatusBayar = 'Diterima')}
											class="px-3 py-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer {modalStatusBayar === 'Diterima' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 ring-1 ring-emerald-500/20' : 'bg-card border-border text-foreground/60 hover:text-foreground'}"
										>
											<CheckCircle2 class="w-3.5 h-3.5" />
											<span>Diterima</span>
										</button>
										<button
											type="button"
											onclick={() => (modalStatusBayar = 'Menunggu Konfirmasi')}
											class="px-3 py-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer {modalStatusBayar === 'Menunggu Konfirmasi' ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 ring-1 ring-amber-500/20' : 'bg-card border-border text-foreground/60 hover:text-foreground'}"
										>
											<Clock class="w-3.5 h-3.5" />
											<span>Menunggu</span>
										</button>
									</div>
								</div>
							</div>

							{#if activeInputMode === 'breakdown'}
								<!-- INPUT PER POS ANGGARAN (A. Hak Pusat s/d D. Hak Kelompok) -->
								<div class="space-y-2.5 pt-1">
									<div class="flex items-center justify-between">
										<label class="text-[11px] font-semibold text-foreground/80 flex items-center gap-1.5">
											<Layers class="w-3.5 h-3.5 text-primary" />
											<span>Nominal per Pos Sesuai Buku Setoran:</span>
										</label>
										<span class="text-[10px] text-foreground/50">Otomatis dijumlah ke Total</span>
									</div>

									{#if data.categoriesWithPos && data.categoriesWithPos.length > 0}
										<div class="border border-border/80 rounded-xl overflow-hidden bg-card divide-y divide-border/60">
											{#each data.categoriesWithPos as cat}
												<div class="bg-secondary/60 px-3 py-1.5 text-[11px] font-bold text-foreground">
													{cat.labelKategori}
												</div>
												<div class="divide-y divide-border/40">
													{#each cat.subPos as pos}
														<div class="p-2 sm:px-3 flex items-center justify-between gap-3 hover:bg-secondary/20 transition-colors">
															<div class="min-w-0 flex-1">
																<div class="text-xs font-medium text-foreground truncate">
																	{pos.nama}
																</div>
																{#if pos.kode}
																	<span class="text-[10px] text-foreground/50 font-mono">({pos.kode})</span>
																{/if}
															</div>
															<div class="relative w-36 sm:w-44 shrink-0">
																<span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold font-mono text-foreground/50">
																	Rp
																</span>
																<input
																	type="text"
																	inputmode="numeric"
																	placeholder="0"
																	value={modalBreakdownStrings[pos.posId] || ''}
																	onkeydown={handleNumberKeyDown}
																	oninput={(e) => handleModalPosInput(pos.posId, (e.target as HTMLInputElement).value)}
																	class="w-full pl-8 pr-2.5 py-1.5 rounded-lg border border-border bg-card text-foreground font-mono text-xs font-bold text-right focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
																/>
															</div>
														</div>
													{/each}
												</div>
											{/each}
										</div>
									{:else}
										<div class="p-3 bg-secondary/40 rounded-xl text-center text-xs text-foreground/60">
											Belum ada pos anggaran infaq yang dikonfigurasikan. Gunakan mode "Total Saja".
										</div>
									{/if}
								</div>
							{:else}
								<!-- INPUT TOTAL NOMINAL LANGSUNG -->
								<div class="space-y-1.5 pt-1">
									<label class="text-[11px] font-semibold text-foreground/80">Total Nominal Setoran Langsung:</label>
									<div class="relative">
										<span class="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold font-mono text-primary">
											Rp
										</span>
										<input
											type="text"
											inputmode="numeric"
											placeholder="0"
											value={modalNominalInputStr}
											onkeydown={handleNumberKeyDown}
											oninput={(e) => handleModalTotalInput((e.target as HTMLInputElement).value)}
											class="w-full pl-10 pr-3 py-2.5 rounded-xl border border-border bg-card text-foreground font-mono text-base font-bold tracking-wide focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
										/>
									</div>
								</div>
							{/if}

							<!-- Total Nominal Kalkulasi Realtime -->
							<div class="p-3 rounded-xl bg-card border border-border/80 flex items-center justify-between shadow-2xs">
								<div>
									<p class="text-[10px] text-foreground/50 uppercase font-semibold">Total Terhitung</p>
									<p class="text-[11px] text-foreground/70 font-medium">Nominal yang akan tercatat di sistem</p>
								</div>
								<div class="text-base sm:text-lg font-bold font-mono text-primary">
									{formatRupiah(modalNominal)}
								</div>
							</div>

							<!-- Catatan KU -->
							<div class="space-y-1.5">
								<label class="text-[11px] font-semibold text-foreground/80">Catatan / Keterangan KU:</label>
								<input
									type="text"
									bind:value={modalCatatan}
									placeholder="Contoh: Disetor via buku fisik tradisional ke KU"
									class="w-full px-3 py-2 rounded-xl border border-border bg-card text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
								/>
							</div>
						</form>
					{:else}
						<!-- Mode Read-only untuk Non-KU (Kyai / Aghnia) -->
						<div class="p-3.5 rounded-xl bg-secondary/40 border border-border space-y-2">
							<div class="flex items-center justify-between">
								<span class="text-xs font-bold text-foreground">Total Nominal:</span>
								<span class="font-mono font-bold text-base text-primary">{formatRupiah(selectedDetailJamaah.nominal)}</span>
							</div>
							<div class="flex items-center justify-between text-xs text-foreground/70">
								<span>Metode:</span>
								<span class="font-semibold text-foreground">{selectedDetailJamaah.metode || 'Tunai'}</span>
							</div>
							<div class="flex items-center justify-between text-xs text-foreground/70">
								<span>Status:</span>
								<span class="font-semibold text-foreground">{selectedDetailJamaah.statusBayar}</span>
							</div>
							{#if selectedDetailJamaah.catatan}
								<div class="pt-1 text-xs text-foreground/70 italic border-t border-border/50">
									"{selectedDetailJamaah.catatan}"
								</div>
							{/if}
						</div>
					{/if}
				</div>

				<!-- Modal Footer: Tombol Approval / Simpan KU -->
				<div class="p-4 sm:p-5 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3 bg-secondary/20">
					<button
						type="button"
						onclick={closeDetail}
						class="w-full sm:w-auto px-4 py-2 rounded-xl border border-border bg-card hover:bg-secondary text-foreground text-xs font-semibold transition-colors cursor-pointer"
					>
						Tutup
					</button>

					{#if data.canEdit}
						<div class="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
							<!-- Jika status Menunggu Konfirmasi: Beri opsi 1-klik Approve langsung -->
							{#if selectedDetailJamaah.statusBayar === 'Menunggu Konfirmasi' || selectedDetailJamaah.statusBayar === 'Menunggu'}
								<form
									method="POST"
									action={`?/approveSetoran&kelompokId=${data.selectedKelompokId || ''}&tahun=${data.tahun}&bulan=${data.bulan}`}
									use:enhance={keepScrollSubmit({
										beforeSubmit: () => {
											isApproving = true;
										},
										onSuccess: () => {
											isApproving = false;
											if (selectedDetailJamaah) {
												selectedDetailJamaah.statusBayar = 'Diterima';
												const found = (data.jamaahList as JamaahItem[]).find((x) => x.id === selectedDetailJamaah?.id);
												if (found) found.statusBayar = 'Diterima';
											}
											closeDetail();
										},
										onError: (result) => {
											isApproving = false;
											alert(
												(result as any)?.data?.error ||
													'Gagal menyetujui setoran. Silakan coba lagi.'
											);
										},
										onFinally: () => {
											isApproving = false;
										}
									})}
								>
									<input type="hidden" name="kelompokId" value={data.selectedKelompokId || ''} />
									<input type="hidden" name="tahun" value={data.tahun} />
									<input type="hidden" name="bulan" value={data.bulan} />
									<input type="hidden" name="anggotaId" value={selectedDetailJamaah.id} />
									{#if selectedDetailJamaah.transaksiId}
										<input type="hidden" name="transaksiId" value={selectedDetailJamaah.transaksiId} />
									{/if}

									<button
										type="submit"
										disabled={isApproving || isSavingModal}
										class="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all disabled:opacity-50 cursor-pointer"
										title="Setujui langsung tanpa mengubah nominal"
									>
										<CheckCircle2 class="w-3.5 h-3.5" />
										<span>{isApproving ? 'Memproses...' : 'Terima Langsung'}</span>
									</button>
								</form>
							{/if}

							<!-- Jika status sudah Diterima: Opsi Kembalikan ke Belum -->
							{#if selectedDetailJamaah.statusBayar === 'Diterima' || selectedDetailJamaah.statusBayar === 'Lunas'}
								<form
									method="POST"
									action={`?/rejectSetoran&kelompokId=${data.selectedKelompokId || ''}&tahun=${data.tahun}&bulan=${data.bulan}`}
									use:enhance={keepScrollSubmit({
										beforeSubmit: () => {
											isRejecting = true;
										},
										onSuccess: () => {
											isRejecting = false;
											if (selectedDetailJamaah) {
												selectedDetailJamaah.statusBayar = 'Belum';
												selectedDetailJamaah.nominal = 0;
												const found = (data.jamaahList as JamaahItem[]).find((x) => x.id === selectedDetailJamaah?.id);
												if (found) {
													found.statusBayar = 'Belum';
													found.nominal = 0;
												}
											}
											closeDetail();
										},
										onError: (result) => {
											isRejecting = false;
											alert(
												(result as any)?.data?.error ||
													'Gagal mengembalikan status setoran. Silakan coba lagi.'
											);
										},
										onFinally: () => {
											isRejecting = false;
										}
									})}
								>
									<input type="hidden" name="kelompokId" value={data.selectedKelompokId || ''} />
									<input type="hidden" name="tahun" value={data.tahun} />
									<input type="hidden" name="bulan" value={data.bulan} />
									<input type="hidden" name="anggotaId" value={selectedDetailJamaah.id} />
									{#if selectedDetailJamaah.transaksiId}
										<input type="hidden" name="transaksiId" value={selectedDetailJamaah.transaksiId} />
									{/if}

									<button
										type="submit"
										disabled={isRejecting || isSavingModal}
										class="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold text-destructive hover:bg-destructive/10 border border-destructive/20 transition-all disabled:opacity-50 cursor-pointer"
										title="Kembalikan status setoran menjadi belum bayar"
									>
										<RotateCcw class="w-3.5 h-3.5" />
										<span>{isRejecting ? 'Batal...' : 'Kembalikan ke Belum'}</span>
									</button>
								</form>
							{/if}

							<!-- Tombol Simpan Form Manual KU -->
							<button
								type="submit"
								form="formManualKu"
								disabled={isSavingModal || isApproving || isRejecting}
								class="inline-flex items-center justify-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm transition-all disabled:opacity-50 cursor-pointer"
							>
								<Save class="w-3.5 h-3.5" />
								<span>
									{isSavingModal
										? 'Menyimpan...'
										: selectedDetailJamaah.statusBayar === 'Diterima' || selectedDetailJamaah.statusBayar === 'Lunas'
											? 'Simpan Perubahan'
											: 'Simpan & Terima Setoran'}
								</span>
							</button>
						</div>
					{/if}
				</div>
			</div>
		</div>
	{/if}

	<!-- MODAL ZOOM GAMBAR BUKTI (LIGHTBOX FULLSCREEN) -->
	{#if zoomedBuktiUrl}
		<div
			class="fixed inset-0 z-70 flex items-center justify-center p-3 sm:p-6 bg-black/90 backdrop-blur-md animate-in fade-in duration-200"
			role="dialog"
			aria-modal="true"
			tabindex="-1"
			onclick={() => (zoomedBuktiUrl = null)}
			onkeydown={(e) => {
				if (e.key === 'Escape') zoomedBuktiUrl = null;
			}}
		>
			<div
				class="relative max-w-4xl max-h-[90vh] flex flex-col items-center justify-center"
				onclick={(e) => e.stopPropagation()}
				role="presentation"
			>
				<button
					type="button"
					onclick={() => (zoomedBuktiUrl = null)}
					class="absolute -top-10 right-0 sm:-right-10 w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors"
					aria-label="Tutup pratinjau zoom"
				>
					<X class="w-5 h-5" />
				</button>
				<img
					src={zoomedBuktiUrl}
					alt="Bukti Transfer Diperbesar"
					class="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl border border-white/10"
				/>
				<div class="mt-3 flex items-center gap-2">
					<a
						href={zoomedBuktiUrl}
						target="_blank"
						rel="noopener noreferrer"
						class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-semibold backdrop-blur-xs transition-colors"
					>
						<ExternalLink class="w-3.5 h-3.5" />
						<span>Buka Gambar Asli</span>
					</a>
				</div>
			</div>
		</div>
	{/if}
</div>

