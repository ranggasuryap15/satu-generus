<!--
  @file src/routes/(admin)/admin/keuangan/fr-jamaah/+page.svelte
  @purpose Halaman FR Jamaah: daftar kartu simetris mobile & tabel desktop dengan informasi nama, kepala keluarga, peran, status konfirmasi setoran (Menunggu/Diterima/Belum), modal detail rincian pos & pratinjau bukti transfer interaktif, approval setoran mandiri khusus KU, inline editing nominal, dan ekspor data CSV
  @usedBy Route admin '/admin/keuangan/fr-jamaah'
  @dependencies @lucide/svelte, Svelte 5 Runes, $lib/components/SearchableSelect.svelte, $app/forms (enhance), $lib/keepScroll.ts (keepScrollSubmit)
  @publicFunctions handleNominalChange, handleCatatanChange, resetChanges, submitSave, exportToCsv, openDetail, closeDetail
  @sideEffects Mengirim form batch upsert transaksi FR via action ?/saveFr; action ?/approveSetoran & ?/rejectSetoran di dalam modal detail dengan menjaga scroll; ekspor CSV di client
-->
<script lang="ts">
	import { enhance } from '$app/forms';
	import SearchableSelect from '$lib/components/SearchableSelect.svelte';
	import { keepScrollSubmit } from '$lib/keepScroll';
	import {
	  AlertCircle,
	  Building2,
	  Check,
	  CheckCircle2,
	  ChevronDown,
	  Clock,
	  Download,
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

	// Tracking Perubahan Data (Inline Edit)
	let editedValues = $state<Record<string, { nominal: number; catatan: string }>>({});
	let isSaving = $state(false);

	// State Modal Detail & Approval
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

	function openDetail(j: JamaahItem) {
		selectedDetailJamaah = j;
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

	function handleNominalInput(anggotaId: string, valueStr: string) {
		const rawDigits = valueStr.replace(/\D/g, '');
		const num = rawDigits ? parseInt(rawDigits, 10) : 0;
		const curCatatan = editedValues[anggotaId]?.catatan ?? (data.jamaahList.find((j: JamaahItem) => j.id === anggotaId)?.catatan || '');
		editedValues = {
			...editedValues,
			[anggotaId]: {
				nominal: num,
				catatan: curCatatan
			}
		};
	}

	function handleCatatanInput(anggotaId: string, val: string) {
		const curNominal = editedValues[anggotaId]?.nominal ?? (data.jamaahList.find((j: JamaahItem) => j.id === anggotaId)?.nominal || 0);
		editedValues = {
			...editedValues,
			[anggotaId]: {
				nominal: curNominal,
				catatan: val
			}
		};
	}

	function getEffectiveNominal(j: JamaahItem): number {
		return editedValues[j.id]?.nominal !== undefined ? editedValues[j.id].nominal : j.nominal;
	}

	function getEffectiveCatatan(j: JamaahItem): string {
		return editedValues[j.id]?.catatan !== undefined ? editedValues[j.id].catatan : j.catatan;
	}

	const dirtyCount = $derived(
		Object.keys(editedValues).filter((id) => {
			const original = data.jamaahList.find((j: JamaahItem) => j.id === id);
			if (!original) return false;
			return (
				editedValues[id].nominal !== original.nominal ||
				editedValues[id].catatan !== original.catatan
			);
		}).length
	);

	function resetChanges() {
		editedValues = {};
	}

	// Payload JSON untuk dikirim ke action saveFr
	const dirtyPayloadJson = $derived(
		JSON.stringify(
			Object.entries(editedValues)
				.filter(([id, val]) => {
					const orig = data.jamaahList.find((j: JamaahItem) => j.id === id);
					if (!orig) return false;
					return val.nominal !== orig.nominal || val.catatan !== orig.catatan;
				})
				.map(([id, val]) => ({
					anggotaId: id,
					nominal: val.nominal,
					statusBayar: val.nominal > 0 ? 'Lunas' : 'Belum',
					catatan: val.catatan
				}))
		)
	);

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
		data.jamaahList.filter((j: JamaahItem) => getEffectiveNominal(j) > 0).length
	);
	const totalNominal = $derived(
		data.jamaahList.reduce((acc: number, j: JamaahItem) => acc + getEffectiveNominal(j), 0)
	);

	function formatRupiah(num: number): string {
		return new Intl.NumberFormat('id-ID', {
			style: 'currency',
			currency: 'IDR',
			maximumFractionDigits: 0
		}).format(num);
	}

	$effect(() => {
		if (form?.success) {
			editedValues = {};
			isSaving = false;
		} else if (form?.error) {
			isSaving = false;
		}
	});

	function exportToCsv() {
		if (!data.jamaahList || data.jamaahList.length === 0) return;

		const namaBulan = bulanNames[data.bulan - 1] || `Bulan ${data.bulan}`;
		const rows: string[][] = [
			['No', 'Nama Jamaah', 'Kepala Keluarga', 'Peran / Dapukan', 'Periode', 'Nominal FR (Rp)', 'Status Bayar', 'Catatan']
		];

		filteredJamaah.forEach((j: JamaahItem, idx: number) => {
			const effNominal = getEffectiveNominal(j);
			const effCatatan = getEffectiveCatatan(j);
			const peranStr = j.isPengurus ? `Pengurus (${j.dapukanNama || '-'})` : 'Jamaah Biasa';
			rows.push([
				String(idx + 1),
				`"${(j.namaLengkap || '').replace(/"/g, '""')}"`,
				`"${(j.kepalaKeluargaNama || '-').replace(/"/g, '""')}"`,
				`"${peranStr.replace(/"/g, '""')}"`,
				`"${namaBulan} ${data.tahun}"`,
				String(effNominal || 0),
				effNominal > 0 ? 'Lunas' : 'Belum',
				`"${(effCatatan || '').replace(/"/g, '""')}"`
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
			<p class="text-xs md:text-sm text-foreground/60 mt-1">
				Input dan kelola setoran shodaqoh FR bulanan jamaah wajib isrun sesuai data sensus wilayah.
			</p>
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
		<div class="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2 shadow-xs">
			<Check class="w-4 h-4 shrink-0" />
			<span>{form.message || 'Perubahan data FR berhasil disimpan ke database.'}</span>
		</div>
	{:else if form?.error}
		<div class="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2 shadow-xs">
			<AlertCircle class="w-4 h-4 shrink-0" />
			<span>{form.error}</span>
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
						{@const effNominal = getEffectiveNominal(j)}
						{@const effCatatan = getEffectiveCatatan(j)}
						{@const isRowDirty = editedValues[j.id] !== undefined && (editedValues[j.id].nominal !== j.nominal || editedValues[j.id].catatan !== j.catatan)}
						<div class="bg-card border border-border rounded-2xl p-3.5 space-y-3 shadow-xs transition-all {isRowDirty ? 'border-primary/60 bg-primary/5 ring-1 ring-primary/20' : 'hover:border-border/80'}">
							<!-- Header Kartu: No, Nama Jamaah & Status + Tombol Detail -->
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
									{:else if effNominal > 0}
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
										class="inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-semibold transition-all {j.buktiUrl ? 'bg-primary/10 hover:bg-primary/20 text-primary border-primary/30 font-bold shadow-2xs' : 'bg-secondary hover:bg-secondary/80 text-foreground/80 border-border'}"
										title="Buka detail rincian dan bukti transfer"
									>
										{#if j.buktiUrl}
											<Image class="w-3 h-3 text-primary" />
											<span>Bukti</span>
										{:else}
											<Eye class="w-3 h-3" />
											<span>Detail</span>
										{/if}
									</button>
								</div>
							</div>

							<!-- Form Input Simetris: Nominal (Kiri) & Catatan (Kanan) -->
							<div class="pt-2.5 border-t border-border/50">
								{#if data.canEdit}
									<div class="grid grid-cols-12 gap-2">
										<!-- Input Nominal Angka Jelas & Tegas -->
										<div class="col-span-6 relative">
											<span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold font-mono text-primary">
												Rp
											</span>
											<input
												type="text"
												inputmode="numeric"
												pattern="[0-9]*"
												autocomplete="off"
												value={effNominal ? effNominal.toLocaleString('id-ID') : ''}
												oninput={(e) => handleNominalInput(j.id, (e.target as HTMLInputElement).value)}
												placeholder="0"
												aria-label="Nominal FR {j.namaLengkap}"
												class="w-full pl-8 pr-2.5 py-2 rounded-xl border text-sm font-mono font-bold tracking-wide transition-all focus:outline-none focus:ring-1 {isRowDirty ? 'border-primary bg-primary/10 text-primary focus:ring-primary ring-1 ring-primary/30' : 'border-border bg-secondary/40 text-foreground focus:ring-primary'}"
											/>
										</div>

										<!-- Input Catatan Seimbang & Simetris -->
										<div class="col-span-6">
											<input
												type="text"
												value={effCatatan}
												oninput={(e) => handleCatatanInput(j.id, (e.target as HTMLInputElement).value)}
												placeholder="Catatan..."
												aria-label="Catatan {j.namaLengkap}"
												class="w-full px-3 py-2 rounded-xl border text-xs transition-all focus:outline-none focus:ring-1 {isRowDirty ? 'border-primary/50 bg-primary/5' : 'border-border bg-secondary/40 text-foreground focus:ring-primary'}"
											/>
										</div>
									</div>
								{:else}
									<div class="flex items-center justify-between text-xs py-0.5">
										<div class="flex items-center gap-1.5">
											<span class="text-[11px] text-foreground/50">Nominal:</span>
											<span class="font-mono font-bold text-sm text-foreground">
												{formatRupiah(effNominal)}
											</span>
										</div>
										{#if effCatatan}
											<span class="text-xs text-foreground/60 italic truncate max-w-[50%]">
												{effCatatan}
											</span>
										{/if}
									</div>
								{/if}
							</div>
						</div>
					{/each}
				</div>

				<div class="hidden md:block border border-border rounded-xl overflow-x-auto shadow-xs">
					<table class="w-full text-left text-xs min-w-[760px]">
						<thead class="bg-secondary/60 text-foreground/70 uppercase text-[11px] tracking-wider border-b border-border">
							<tr>
								<th class="py-2 px-3.5 font-semibold w-12 text-center">No</th>
								<th class="py-2 px-4 font-semibold">Nama Jamaah</th>
								<th class="py-2 px-4 font-semibold">Kepala Keluarga</th>
								<th class="py-2 px-4 font-semibold w-44">Nominal FR (Rp)</th>
								<th class="py-2 px-3 font-semibold w-28 text-center">Status</th>
								<th class="py-2 px-3 font-semibold w-28 text-center">Aksi / Bukti</th>
								<th class="py-2 px-4 font-semibold">Catatan / Keterangan</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-border">
							{#each filteredJamaah as j, idx (j.id)}
								{@const effNominal = getEffectiveNominal(j)}
								{@const effCatatan = getEffectiveCatatan(j)}
								{@const isRowDirty = editedValues[j.id] !== undefined && (editedValues[j.id].nominal !== j.nominal || editedValues[j.id].catatan !== j.catatan)}
								<tr class="hover:bg-secondary/30 transition-colors {isRowDirty ? 'bg-primary/5' : ''}">
									<td class="py-2.5 px-3.5 text-center text-foreground/50 font-mono font-semibold">
										{idx + 1}
									</td>

									<!-- Nama & Status Peran Pengurus / Jamaah -->
									<td class="py-2.5 px-4">
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
									<td class="py-2.5 px-4 text-foreground/80 text-xs">
										{j.kepalaKeluargaNama || '-'}
									</td>

									<!-- Input Nominal (Inline Editable) -->
									<td class="py-2.5 px-4">
										{#if data.canEdit}
											<div class="relative">
												<span class="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/50 font-mono text-xs font-bold">
													Rp
												</span>
												<input
													type="text"
													inputmode="numeric"
													pattern="[0-9]*"
													autocomplete="off"
													value={effNominal ? effNominal.toLocaleString('id-ID') : ''}
													oninput={(e) => handleNominalInput(j.id, (e.target as HTMLInputElement).value)}
													placeholder="0"
													class="w-full pl-9 pr-3 py-2 rounded-lg border text-sm font-mono font-bold tracking-wide transition-all focus:outline-none focus:ring-1 {isRowDirty ? 'border-primary bg-primary/10 text-primary focus:ring-primary' : 'border-border bg-secondary/50 text-foreground focus:ring-primary'}"
												/>
											</div>
										{:else}
											<span class="font-mono font-bold text-sm text-foreground">
												{formatRupiah(effNominal)}
											</span>
										{/if}
									</td>

									<!-- Status Pembayaran -->
									<td class="py-2 px-3 text-center">
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
										{:else if effNominal > 0}
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
									<td class="py-2 px-3 text-center">
										<button
											type="button"
											onclick={() => openDetail(j)}
											class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all {j.buktiUrl ? 'bg-primary/10 hover:bg-primary/20 text-primary border-primary/30 ring-1 ring-primary/20 font-bold' : 'bg-secondary/60 hover:bg-secondary text-foreground/80 border-border'}"
											title="Buka rincian setoran dan bukti transfer"
										>
											{#if j.buktiUrl}
												<div class="w-4 h-4 rounded overflow-hidden shrink-0 border border-primary/40 bg-card">
													<img src={j.buktiUrl} alt="Bukti" class="w-full h-full object-cover" />
												</div>
												<span class="text-[11px]">Bukti</span>
											{:else}
												<Eye class="w-3.5 h-3.5" />
												<span class="text-[11px]">Detail</span>
											{/if}
										</button>
									</td>

									<!-- Catatan -->
									<td class="py-2 px-4">
										{#if data.canEdit}
											<input
												type="text"
												value={effCatatan}
												oninput={(e) => handleCatatanInput(j.id, (e.target as HTMLInputElement).value)}
												placeholder="Opsional..."
												class="w-full px-2.5 py-1.5 rounded-lg border text-xs transition-all focus:outline-none focus:ring-1 {isRowDirty ? 'border-primary/50 bg-primary/5' : 'border-border bg-secondary/50 text-foreground focus:ring-primary'}"
											/>
										{:else}
											<span class="text-xs text-foreground/60 italic">
												{effCatatan || '-'}
											</span>
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

					<!-- Ringkasan Status & Nominal -->
					<div class="grid grid-cols-2 gap-3">
						<div class="p-3.5 rounded-xl bg-card border border-border space-y-1">
							<span class="text-[11px] text-foreground/50 font-medium">Total Nominal Setoran</span>
							<div class="text-base sm:text-lg font-bold font-mono text-primary">
								{formatRupiah(selectedDetailJamaah.nominal)}
							</div>
							<div class="text-[10px] text-foreground/50">
								Metode: <span class="font-semibold text-foreground">{selectedDetailJamaah.metode || 'Tunai'}</span>
							</div>
						</div>

						<div class="p-3.5 rounded-xl bg-card border border-border space-y-1">
							<span class="text-[11px] text-foreground/50 font-medium">Status Konfirmasi</span>
							<div>
								{#if selectedDetailJamaah.statusBayar === 'Menunggu Konfirmasi' || selectedDetailJamaah.statusBayar === 'Menunggu'}
									<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
										<Clock class="w-3 h-3 stroke-[2.5]" />
										<span>Menunggu</span>
									</span>
								{:else if selectedDetailJamaah.statusBayar === 'Diterima' || selectedDetailJamaah.statusBayar === 'Lunas'}
									<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
										<Check class="w-3 h-3 stroke-[2.5]" />
										<span>Diterima / Lunas</span>
									</span>
								{:else}
									<span class="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-secondary text-foreground/50 border border-border">
										Belum Setor
									</span>
								{/if}
							</div>
							{#if selectedDetailJamaah.tanggalLapor}
								<div class="text-[10px] text-foreground/50 truncate">
									Lapor: {formatTanggalLapor(selectedDetailJamaah.tanggalLapor)}
								</div>
							{/if}
						</div>
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
							<div class="p-4 rounded-xl border border-dashed border-border text-center text-foreground/50 bg-secondary/20">
								<Wallet class="w-6 h-6 mx-auto mb-1.5 opacity-40" />
								<p class="font-medium text-[11px]">Tidak ada lampiran bukti transfer gambar.</p>
								<p class="text-[10px] mt-0.5">Setoran tunai langsung ke KU atau dicatat secara offline.</p>
							</div>
						{/if}
					</div>

					<!-- Rincian Pos Anggaran (Breakdown) -->
					{#if selectedDetailJamaah.breakdownItems && selectedDetailJamaah.breakdownItems.length > 0}
						<div class="space-y-2">
							<span class="font-bold text-foreground flex items-center gap-1.5">
								<Layers class="w-4 h-4 text-primary" />
								<span>Rincian Pos Anggaran</span>
							</span>
							<div class="border border-border rounded-xl overflow-hidden">
								<table class="w-full text-left text-[11px]">
									<thead class="bg-secondary/60 text-foreground/70 uppercase text-[10px] tracking-wider border-b border-border">
										<tr>
											<th class="py-1.5 px-3 font-semibold">Pos Anggaran</th>
											<th class="py-1.5 px-3 font-semibold text-right">Nominal</th>
										</tr>
									</thead>
									<tbody class="divide-y divide-border/60">
										{#each selectedDetailJamaah.breakdownItems as item}
											<tr class="hover:bg-secondary/20">
												<td class="py-2 px-3 text-foreground font-medium">
													{item.nama}
													{#if item.kode}
														<span class="text-foreground/40 text-[10px] ml-1">({item.kode})</span>
													{/if}
												</td>
												<td class="py-2 px-3 text-right font-mono font-bold text-foreground">
													{formatRupiah(item.nominal)}
												</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						</div>
					{/if}

					<!-- Catatan Jamaah -->
					{#if selectedDetailJamaah.catatan}
						<div class="p-3 rounded-xl bg-secondary/30 border border-border space-y-1">
							<span class="font-bold text-foreground/70 text-[11px]">Catatan dari Jamaah:</span>
							<p class="text-foreground italic whitespace-pre-wrap leading-relaxed">
								"{selectedDetailJamaah.catatan}"
							</p>
						</div>
					{/if}
				</div>

				<!-- Modal Footer: Tombol Approval KU -->
				<div class="p-4 sm:p-5 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3 bg-secondary/20">
					<button
						type="button"
						onclick={closeDetail}
						class="w-full sm:w-auto px-4 py-2 rounded-xl border border-border bg-card hover:bg-secondary text-foreground text-xs font-semibold transition-colors"
					>
						Tutup
					</button>

					{#if data.canEdit}
						<div class="flex items-center gap-2 w-full sm:w-auto justify-end">
							{#if selectedDetailJamaah.statusBayar === 'Menunggu Konfirmasi' || selectedDetailJamaah.statusBayar === 'Menunggu' || selectedDetailJamaah.statusBayar === 'Belum'}
								<!-- Form Approve Setoran Khusus di dalam Modal Detail -->
								<form
									method="POST"
									action={`?kelompokId=${data.selectedKelompokId}&tahun=${data.tahun}&bulan=${data.bulan}&/approveSetoran`}
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
										},
										onError: () => {
											isApproving = false;
										},
										onFinally: () => {
											isApproving = false;
										}
									})}
								>
									<input type="hidden" name="kelompokId" value={data.selectedKelompokId} />
									<input type="hidden" name="tahun" value={data.tahun} />
									<input type="hidden" name="bulan" value={data.bulan} />
									<input type="hidden" name="anggotaId" value={selectedDetailJamaah.id} />
									{#if selectedDetailJamaah.transaksiId}
										<input type="hidden" name="transaksiId" value={selectedDetailJamaah.transaksiId} />
									{/if}

									<button
										type="submit"
										disabled={isApproving}
										class="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all disabled:opacity-50"
									>
										<CheckCircle2 class="w-4 h-4" />
										<span>{isApproving ? 'Memproses...' : 'Terima Setoran'}</span>
									</button>
								</form>
							{:else}
								<!-- Status sudah Diterima / Lunas -->
								<div class="flex items-center gap-2">
									<span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
										<Check class="w-4 h-4 stroke-[2.5]" />
										<span>Setoran Telah Diterima</span>
									</span>

									<!-- Opsi pembatalan/reset jika salah approve -->
									<form
										method="POST"
										action={`?kelompokId=${data.selectedKelompokId}&tahun=${data.tahun}&bulan=${data.bulan}&/rejectSetoran`}
										use:enhance={keepScrollSubmit({
											beforeSubmit: () => {
												isRejecting = true;
											},
											onSuccess: () => {
												isRejecting = false;
												if (selectedDetailJamaah) {
													selectedDetailJamaah.statusBayar = 'Belum';
													const found = (data.jamaahList as JamaahItem[]).find((x) => x.id === selectedDetailJamaah?.id);
													if (found) found.statusBayar = 'Belum';
												}
											},
											onError: () => {
												isRejecting = false;
											},
											onFinally: () => {
												isRejecting = false;
											}
										})}
									>
										<input type="hidden" name="kelompokId" value={data.selectedKelompokId} />
										<input type="hidden" name="tahun" value={data.tahun} />
										<input type="hidden" name="bulan" value={data.bulan} />
										<input type="hidden" name="anggotaId" value={selectedDetailJamaah.id} />
										{#if selectedDetailJamaah.transaksiId}
											<input type="hidden" name="transaksiId" value={selectedDetailJamaah.transaksiId} />
										{/if}

										<button
											type="submit"
											disabled={isRejecting}
											class="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-[11px] font-semibold text-destructive hover:bg-destructive/10 border border-destructive/20 transition-all disabled:opacity-50"
											title="Batalkan penerimaan setoran"
										>
											<RotateCcw class="w-3 h-3" />
											<span>{isRejecting ? 'Batal...' : 'Kembalikan ke Belum'}</span>
										</button>
									</form>
								</div>
							{/if}
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

	<!-- STICKY FLOATING ACTION BAR (MENGIKUTI SCROLL SAAT ADA PERUBAHAN) -->
	{#if dirtyCount > 0 && data.canEdit}
		<div class="fixed left-3 right-3 bottom-20 md:bottom-6 md:left-72 z-50 bg-card/95 backdrop-blur-md border border-primary/30 rounded-2xl p-3 shadow-2xl flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-3 duration-200">
			<div class="flex items-center gap-2 pl-2">
				<span class="w-2.5 h-2.5 rounded-full bg-primary animate-pulse"></span>
				<div class="text-xs font-semibold text-foreground">
					<span>{dirtyCount} data jamaah diubah</span>
					<span class="text-foreground/50 font-normal hidden sm:inline">• Belum disimpan</span>
				</div>
			</div>

			<div class="flex items-center gap-2">
				<button
					type="button"
					onclick={resetChanges}
					class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-foreground/70 hover:bg-secondary transition-colors"
				>
					<RotateCcw class="w-3.5 h-3.5" />
					<span class="hidden sm:inline">Batal</span>
				</button>

				<form
					method="POST"
					action={`?kelompokId=${data.selectedKelompokId}&tahun=${data.tahun}&bulan=${data.bulan}&/saveFr`}
					use:enhance={keepScrollSubmit({
						beforeSubmit: () => {
							isSaving = true;
						},
						onSuccess: () => {
							editedValues = {};
							isSaving = false;
						},
						onError: () => {
							isSaving = false;
						},
						onFinally: () => {
							isSaving = false;
						}
					})}
				>
					<input type="hidden" name="kelompokId" value={data.selectedKelompokId} />
					<input type="hidden" name="tahun" value={data.tahun} />
					<input type="hidden" name="bulan" value={data.bulan} />
					<input type="hidden" name="desaId" value={data.desaId ?? ''} />
					<input type="hidden" name="daerahId" value={data.daerahId ?? ''} />
					<input type="hidden" name="itemsJson" value={dirtyPayloadJson} />

					<button
						type="submit"
						disabled={isSaving}
						class="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50"
					>
						<Save class="w-4 h-4" />
						<span class="sm:hidden">{isSaving ? 'Menyimpan...' : 'Simpan'}</span>
						<span class="hidden sm:inline">{isSaving ? 'Menyimpan...' : 'Simpan Semua Perubahan'}</span>
					</button>
				</form>
			</div>
		</div>
	{/if}
</div>

