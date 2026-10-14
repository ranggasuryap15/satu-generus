<!--
  @file src/routes/(app)/fr/+page.svelte
  @purpose Halaman antarmuka client jamaah untuk pengisian dan pelaporan Isrun/FR bulanan: tabel spreadsheet 4 kolom terstruktur per kategori induk (A. Hak Pusat, B. Hak Daerah, C. Hak Desa, D. Hak Kelompok) mirip template KU, validasi input angka murni aktif & auto-format ribuan id-ID dengan nilai default kosong, pemisahan struktur kartu rekening bank & kartu QRIS dengan tab switcher rapi (zoomable QRIS & 1-klik salin no rekening), switcher anggota & periode, serta form upload bukti setor
  @usedBy Route client '/fr' (diakses via Quick Access Beranda 'Isrun/FR')
  @dependencies @lucide/svelte, $app/forms (enhance), Svelte 5 Runes
  @publicFunctions handleInputRiil, handleNumberKeyDown, handleCopySaranKeRiil, handleResetRiil, formatRp, copyToClipboard
  @sideEffects Mengirim form data setoran FR mandiri ke server action simpanSetoran di SQLite
-->
<script lang="ts">
	import {
		AlertCircle,
		ArrowLeft,
		Banknote,
		Calendar,
		CheckCircle2,
		ChevronDown,
		ChevronRight,
		Clock,
		Copy,
		CreditCard,
		FileText,
		HandCoins,
		Info,
		Layers,
		QrCode,
		RefreshCw,
		Send,
		ShieldCheck,
		UploadCloud,
		UserCheck,
		Users,
		Wallet,
		X
	} from '@lucide/svelte';
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';

	let { data, form } = $props<{ data: PageData; form: ActionData }>();

	// State interaktif
	let isSubmitting = $state(false);
	let selectedBulan = $state(data.bulan);
	let selectedTahun = $state(data.tahun);
	let selectedAnggotaId = $state(data.activeAnggota?.id || '');
	let metodeBayar = $state<'Tunai' | 'Transfer'>((data.transaksiExisting?.metode as any) || 'Tunai');
	let catatanTambahan = $state(data.transaksiExisting?.catatan || '');
	let showSuccessToast = $state(false);
	let errorMessageToast = $state<string | null>(null);
	let copiedRekeningText = $state<string | null>(null);
	let zoomedQris = $state<{ url: string; atasNama: string } | null>(null);
	let previewBukti = $state<string | null>(null);

	// Pemisahan saluran Rekening Bank & QRIS Resmi
	const rekeningBankList = $derived(
		(data.rekeningList || []).filter((r: any) => !r.qrisImageUrl && !r.namaBank?.toLowerCase().includes('qris'))
	);
	const qrisList = $derived(
		(data.rekeningList || []).filter((r: any) => Boolean(r.qrisImageUrl) || r.namaBank?.toLowerCase().includes('qris'))
	);
	let transferChannel = $state<'bank' | 'qris'>('bank');

	$effect(() => {
		if (rekeningBankList.length === 0 && qrisList.length > 0) {
			transferChannel = 'qris';
		} else if (qrisList.length === 0 && rekeningBankList.length > 0) {
			transferChannel = 'bank';
		}
	});

	function handleFileChange(e: Event) {
		const target = e.target as HTMLInputElement;
		const file = target.files?.[0];
		if (file) {
			const reader = new FileReader();
			reader.onload = (evt) => {
				previewBukti = evt.target?.result as string;
			};
			reader.readAsDataURL(file);
		} else {
			previewBukti = null;
		}
	}

	function handleClearFile() {
		previewBukti = null;
		const input = document.getElementById('buktiFile') as HTMLInputElement | null;
		if (input) input.value = '';
	}

	// Struktur data baris pos & kategori hierarkis
	interface PosRow {
		posId: string;
		kode: string;
		nama: string;
		isWajib?: boolean | number;
		nominalJumlah: number; // Saran KU
		nominalRiil: number; // Nilai angka riil
		riilInputString: string; // Teks yang terformat di input
	}

	interface CategoryWithPos {
		id: string;
		nama: string;
		labelKategori: string;
		subPos: PosRow[];
	}

	let categories = $state<CategoryWithPos[]>([]);

	// Inisialisasi struktur kategori & sub-pos dari server
	$effect(() => {
		if (data.categoriesWithPos) {
			categories = data.categoriesWithPos.map((cat: any) => ({
				id: cat.id,
				nama: cat.nama,
				labelKategori: cat.labelKategori,
				subPos: (cat.subPos || []).map((p: any) => {
					// Jika sudah ada riwayat setoran riil tersimpan (> 0), format ke string ribuan
					// Jika belum ada / 0, field default KOSONG ("") bukan 0
					const riilNum = Number(p.nominalRiilBayar) || 0;
					return {
						posId: p.posId,
						kode: p.kode,
						nama: p.nama,
						isWajib: p.isWajib,
						nominalJumlah: Number(p.nominalJumlah) || 0,
						nominalRiil: riilNum,
						riilInputString: riilNum > 0 ? riilNum.toLocaleString('id-ID') : ''
					};
				})
			}));
		} else {
			categories = [];
		}
	});

	// Blokir tombol keyboard non-angka
	function handleNumberKeyDown(e: KeyboardEvent) {
		if (
			['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key) ||
			e.ctrlKey ||
			e.metaKey
		) {
			return;
		}
		if (!/^[0-9]$/.test(e.key)) {
			e.preventDefault();
		}
	}

	// Handler input angka realtime terformat ribuan id-ID (field kosong saat 0)
	function handleInputRiil(posId: string, inputEl: HTMLInputElement) {
		const digitsOnly = inputEl.value.replace(/\D/g, '');
		const num = parseInt(digitsOnly, 10) || 0;
		inputEl.value = num > 0 ? num.toLocaleString('id-ID') : '';

		for (const cat of categories) {
			const target = cat.subPos.find((p) => p.posId === posId);
			if (target) {
				target.nominalRiil = num;
				// Format angka ribuan jika num > 0, jika 0 kembalikan string kosong
				target.riilInputString = inputEl.value;
				break;
			}
		}
	}

	// Helper format Rupiah tampilan
	function formatRp(val: number): string {
		return 'Rp ' + Number(val || 0).toLocaleString('id-ID');
	}

	// Action tombol cepat: Samakan semua Riil Bayar dengan Jumlah Saran KU
	function handleCopySaranKeRiil() {
		for (const cat of categories) {
			for (const row of cat.subPos) {
				row.nominalRiil = row.nominalJumlah;
				row.riilInputString = row.nominalJumlah > 0 ? row.nominalJumlah.toLocaleString('id-ID') : '';
			}
		}
	}

	// Action tombol cepat: Kosongkan isian
	function handleResetRiil() {
		for (const cat of categories) {
			for (const row of cat.subPos) {
				row.nominalRiil = 0;
				row.riilInputString = '';
			}
		}
	}

	// Derived Total Jumlah Saran & Total Riil Bayar
	const totalJumlahSaran = $derived.by(() => {
		let sum = 0;
		for (const cat of categories) {
			for (const row of cat.subPos) {
				sum += Number(row.nominalJumlah || 0);
			}
		}
		return sum;
	});

	const totalRiilBayar = $derived.by(() => {
		let sum = 0;
		for (const cat of categories) {
			for (const row of cat.subPos) {
				sum += Number(row.nominalRiil || 0);
			}
		}
		return sum;
	});

	const selisihNominal = $derived(totalRiilBayar - totalJumlahSaran);

	// Salin nomor rekening ke clipboard
	async function copyToClipboard(text: string) {
		try {
			await navigator.clipboard.writeText(text);
			copiedRekeningText = text;
			setTimeout(() => {
				copiedRekeningText = null;
			}, 2500);
		} catch (_) {}
	}

	// Daftar nama bulan
	const bulanOptions = [
		{ val: 1, label: 'Januari' },
		{ val: 2, label: 'Februari' },
		{ val: 3, label: 'Maret' },
		{ val: 4, label: 'April' },
		{ val: 5, label: 'Mei' },
		{ val: 6, label: 'Juni' },
		{ val: 7, label: 'Juli' },
		{ val: 8, label: 'Agustus' },
		{ val: 9, label: 'September' },
		{ val: 10, label: 'Oktober' },
		{ val: 11, label: 'November' },
		{ val: 12, label: 'Desember' }
	];

	// Payload JSON untuk dikirim ke server action
	const rincianJsonPayload = $derived.by(() => {
		const list: Array<{ posId: string; nama: string; kode: string; saran: number; riil: number }> = [];
		for (const cat of categories) {
			for (const r of cat.subPos) {
				list.push({
					posId: r.posId,
					nama: r.nama,
					kode: r.kode,
					saran: r.nominalJumlah,
					riil: r.nominalRiil
				});
			}
		}
		return JSON.stringify(list);
	});
</script>

<svelte:head>
	<title>Isrun / FR Jamaah - Satu Generus</title>
</svelte:head>

<div class="space-y-4 sm:space-y-6 max-w-4xl mx-auto pb-12">
	<!-- Top Header Navigasi -->
	<div class="flex items-center justify-between gap-3 bg-card border border-border p-3.5 sm:p-4 rounded-2xl shadow-sm">
		<div class="flex items-center gap-3">
			<a
				href="/"
				class="w-9 h-9 rounded-xl bg-secondary/80 hover:bg-secondary flex items-center justify-center text-foreground/70 hover:text-foreground transition-colors shrink-0"
				aria-label="Kembali ke Beranda"
			>
				<ArrowLeft class="w-5 h-5" />
			</a>
			<div>
				<div class="flex items-center gap-2">
					<h1 class="text-base sm:text-lg font-bold text-foreground tracking-tight">Lembar Isrun / FR</h1>
					<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">
						{data.kelompokNama}
					</span>
				</div>
				<p class="text-xs text-foreground/60">
					Rincian pos kewajiban shodaqoh bulanan jamaah
				</p>
			</div>
		</div>

		<div class="hidden sm:flex items-center gap-2 text-xs font-semibold text-foreground/70 bg-secondary/50 px-3 py-1.5 rounded-xl border border-border">
			<Layers class="w-4 h-4 text-primary" />
			<span>Group: {data.groupNama}</span>
		</div>
	</div>

	<!-- Filter Jamaah & Periode Bulan/Tahun -->
	<section class="bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
		<div class="grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-4 items-end">
			<!-- Switcher Anggota Jamaah (jika ada lebih dari 1 anggota wajib dalam KK) -->
			{#if data.anggotaWajibList.length > 1}
				<div class="sm:col-span-5 space-y-1.5">
					<label for="pilih-anggota" class="text-xs font-bold text-foreground/80 flex items-center gap-1.5">
						<Users class="w-3.5 h-3.5 text-primary" />
						Anggota Keluarga
					</label>
					<form method="GET" class="relative">
						<input type="hidden" name="tahun" value={selectedTahun} />
						<input type="hidden" name="bulan" value={selectedBulan} />
						<select
							id="pilih-anggota"
							name="anggotaId"
							bind:value={selectedAnggotaId}
							onchange={(e) => (e.currentTarget.form?.submit())}
							class="w-full h-10 px-3 py-2 rounded-xl bg-background border border-border text-xs sm:text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none pr-8 cursor-pointer"
						>
							{#each data.anggotaWajibList as a}
								<option value={a.id}>
									{a.namaLengkap} ({a.statusHubungan}) {a.isCurrentUser ? '— Saya' : ''}
								</option>
							{/each}
						</select>
						<ChevronDown class="w-4 h-4 absolute right-2.5 top-3 text-foreground/40 pointer-events-none" />
					</form>
				</div>
			{:else}
				<div class="sm:col-span-5 flex items-center gap-2.5 p-2 rounded-xl bg-secondary/30 border border-border">
					<div class="w-9 h-9 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
						<UserCheck class="w-5 h-5" />
					</div>
					<div class="min-w-0 flex-1">
						<p class="text-[11px] text-foreground/60 font-medium leading-none">Nama Jamaah</p>
						<p class="text-xs sm:text-sm font-bold text-foreground truncate mt-0.5">
							{data.activeAnggota?.namaLengkap || 'Jamaah'}
						</p>
					</div>
				</div>
			{/if}

			<!-- Selector Bulan & Tahun -->
			<div class="sm:col-span-7">
				<form method="GET" class="grid grid-cols-2 gap-2">
					{#if data.activeAnggota}
						<input type="hidden" name="anggotaId" value={data.activeAnggota.id} />
					{/if}
					<div>
						<label for="pilih-bulan" class="text-xs font-bold text-foreground/80 flex items-center gap-1.5 mb-1.5">
							<Calendar class="w-3.5 h-3.5 text-primary" />
							Bulan Setoran
						</label>
						<div class="relative">
							<select
								id="pilih-bulan"
								name="bulan"
								bind:value={selectedBulan}
								onchange={(e) => (e.currentTarget.form?.submit())}
								class="w-full h-10 px-3 py-2 rounded-xl bg-background border border-border text-xs sm:text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none pr-8 cursor-pointer"
							>
								{#each bulanOptions as b}
									<option value={b.val}>{b.label}</option>
								{/each}
							</select>
							<ChevronDown class="w-4 h-4 absolute right-2.5 top-3 text-foreground/40 pointer-events-none" />
						</div>
					</div>

					<div>
						<label for="pilih-tahun" class="text-xs font-bold text-foreground/80 flex items-center gap-1.5 mb-1.5">
							<Clock class="w-3.5 h-3.5 text-primary" />
							Tahun
						</label>
						<div class="relative">
							<select
								id="pilih-tahun"
								name="tahun"
								bind:value={selectedTahun}
								onchange={(e) => (e.currentTarget.form?.submit())}
								class="w-full h-10 px-3 py-2 rounded-xl bg-background border border-border text-xs sm:text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none pr-8 cursor-pointer"
							>
								{#each [selectedTahun - 1, selectedTahun, selectedTahun + 1] as yr}
									<option value={yr}>{yr}</option>
								{/each}
							</select>
							<ChevronDown class="w-4 h-4 absolute right-2.5 top-3 text-foreground/40 pointer-events-none" />
						</div>
					</div>
				</form>
			</div>
		</div>

		<!-- Status Transaksi Bulan Ini -->
		<div class="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/60">
			<div class="flex items-center gap-2">
				<span class="text-xs text-foreground/60 font-medium">Status Setoran:</span>
				{#if data.transaksiExisting}
					{#if data.transaksiExisting.statusBayar === 'Lunas'}
						<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
							<CheckCircle2 class="w-3.5 h-3.5" /> Lunas
						</span>
					{:else if data.transaksiExisting.statusBayar === 'Menunggu Konfirmasi'}
						<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
							<Clock class="w-3.5 h-3.5" /> Menunggu Konfirmasi KU
						</span>
					{:else}
						<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
							<AlertCircle class="w-3.5 h-3.5" /> {data.transaksiExisting.statusBayar}
						</span>
					{/if}
				{:else}
					<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-secondary text-foreground/60 border border-border">
						Belum Disetor
					</span>
				{/if}
			</div>

			<div class="text-xs text-foreground/60">
				Group Tarif: <strong class="text-foreground">{data.groupNama}</strong>
			</div>
		</div>
	</section>

	<!-- Feedback Alert Berhasil / Gagal -->
	{#if form?.success}
		<div class="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 flex items-start gap-3">
			<CheckCircle2 class="w-5 h-5 shrink-0 mt-0.5" />
			<div class="text-xs sm:text-sm">
				<p class="font-bold">Setoran Berhasil Disimpan</p>
				<p class="mt-0.5 opacity-90">{form.message}</p>
			</div>
		</div>
	{:else if form?.message}
		<div class="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 flex items-start gap-3">
			<AlertCircle class="w-5 h-5 shrink-0 mt-0.5" />
			<div class="text-xs sm:text-sm">
				<p class="font-bold">Gagal Menyimpan</p>
				<p class="mt-0.5 opacity-90">{form.message}</p>
			</div>
		</div>
	{/if}

	<!-- Form Utama Setoran Isrun/FR -->
	<form
		method="POST"
		action="?/simpanSetoran"
		enctype="multipart/form-data"
		use:enhance={({ cancel }) => {
			if (totalRiilBayar <= 0) {
				errorMessageToast = 'Silakan isi nominal pada kolom Riil Bayar (minimal Rp 1) terlebih dahulu sebelum menyimpan.';
				cancel();
				return;
			}
			isSubmitting = true;
			errorMessageToast = null;
			return async ({ update, result }) => {
				await update();
				isSubmitting = false;
				if (result.type === 'success') {
					showSuccessToast = true;
					previewBukti = null;
					window.scrollTo({ top: 0, behavior: 'smooth' });
					setTimeout(() => {
						showSuccessToast = false;
					}, 5000);
				}
			};
		}}
		class="space-y-4 sm:space-y-6"
	>
		<input type="hidden" name="anggotaId" value={data.activeAnggota?.id || ''} />
		<input type="hidden" name="tahun" value={selectedTahun} />
		<input type="hidden" name="bulan" value={selectedBulan} />
		<input type="hidden" name="templateId" value={data.template?.id || ''} />
		<input type="hidden" name="rincian" value={rincianJsonPayload} />
		<input type="hidden" name="metode" value={metodeBayar} />

		<!-- Tabel Lembar 4 Kolom Spreadsheet (Compact di Mobile) -->
		<section class="bg-card border border-border rounded-2xl shadow-xs overflow-hidden">
			<!-- Header Toolbar -->
			<div class="p-3 sm:p-4 bg-secondary/30 border-b border-border flex flex-wrap items-center justify-between gap-2.5">
				<div>
					<h3 class="text-xs sm:text-sm font-bold text-foreground flex items-center gap-2">
						<span>Lembar 4 Kolom Isrun/FR</span>
						<span class="text-[10px] px-2 py-0.5 rounded-full font-bold bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/20">
							{data.groupNama}
						</span>
					</h3>
					<p class="text-[11px] text-foreground/60 mt-0.5">
						Isi nominal yang Anda setorkan pada kolom <strong>Riil Bayar</strong>
					</p>
				</div>

				<div class="flex items-center gap-2">
					<button
						type="button"
						onclick={handleCopySaranKeRiil}
						class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-500/10 hover:bg-teal-500/20 text-teal-700 dark:text-teal-300 border border-teal-500/25 text-xs font-bold transition-all active:scale-95 shadow-2xs"
						title="Isi Riil Bayar sama persis dengan Jumlah Saran KU"
					>
						<Copy class="w-3.5 h-3.5" />
						<span>Samakan dgn Saran</span>
					</button>

					<button
						type="button"
						onclick={handleResetRiil}
						class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground/70 border border-border text-xs font-semibold transition-all active:scale-95"
						title="Kosongkan nilai riil bayar"
					>
						<RefreshCw class="w-3.5 h-3.5" />
						<span class="hidden sm:inline">Reset</span>
					</button>
				</div>
			</div>

			<!-- Tabel Spreadsheet 4 Kolom (Compact di Mobile) -->
			<div class="overflow-x-auto">
				<table class="w-full text-left border-collapse text-xs">
					<thead>
						<tr class="bg-secondary/70 text-foreground/80 border-b border-border font-bold">
							<th class="py-2.5 px-2.5 sm:px-3 text-center w-10 sm:w-12 border-r border-border">No</th>
							<th class="py-2.5 px-3 sm:px-4 border-r border-border min-w-36">Uraian Pos Anggaran</th>
							<th class="py-2.5 px-3 sm:px-4 border-r border-border w-28 sm:w-44 text-right">
								<span>Jumlah (Saran KU)</span>
							</th>
							<th class="py-2.5 px-3 sm:px-4 text-right w-36 sm:w-48 bg-teal-500/5 text-teal-800 dark:text-teal-200">
								<span>Riil Bayar</span>
								<span class="block text-[10px] font-normal text-foreground/50">Diisi Jamaah</span>
							</th>
						</tr>
					</thead>
					<tbody>
						{#if categories.length === 0}
							<tr>
								<td colspan="4" class="py-8 text-center text-foreground/60 text-xs italic">
									Belum ada konfigurasi pos anggaran aktif di kelompok ini. Hubungi KU kelompok Anda.
								</td>
							</tr>
						{:else}
							{#each categories as cat, catIdx}
								<!-- BARIS KATEGORI INDUK (A. Hak Pusat, B. Hak Daerah, C. Hak Desa, D. Hak Kelompok) -->
								<tr class="bg-secondary/40 border-b border-border font-bold text-foreground">
									<td class="py-2 px-2.5 sm:px-3 border-r border-border text-center font-mono text-[11px] text-foreground/60">
										{String.fromCharCode(65 + catIdx)}
									</td>
									<td class="py-2 px-3 sm:px-4 border-r border-border tracking-wide text-xs" colspan="3">
										{cat.labelKategori}
									</td>
								</tr>

								<!-- SUB-POS DI BAWAH KATEGORI INDUK -->
								{#if cat.subPos.length === 0}
									<tr class="border-b border-border/60 text-foreground/40 italic">
										<td class="py-2 px-2.5 text-center border-r border-border font-mono text-[11px]">-</td>
										<td class="py-2 px-3 sm:px-4 border-r border-border text-[11px]" colspan="3">
											Tidak ada uraian di kategori ini.
										</td>
									</tr>
								{:else}
									{#each cat.subPos as pos, posIdx}
										<tr class="border-b border-border/60 hover:bg-secondary/20 transition-colors">
											<!-- KOLOM 1: NO -->
											<td class="py-2 px-2.5 sm:px-3 text-center border-r border-border font-mono text-foreground/70 text-xs">
												{posIdx + 1}
											</td>

											<!-- KOLOM 2: URAIAN -->
											<td class="py-2 px-3 sm:px-4 border-r border-border font-medium text-foreground text-xs">
												<div class="flex items-center gap-1.5">
													<span>{pos.nama}</span>
													{#if pos.isWajib}
														<span class="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-600 font-semibold uppercase">
															Wajib
														</span>
													{/if}
												</div>
											</td>

											<!-- KOLOM 3: JUMLAH (SARAN KU) -->
											<td class="py-2 px-3 sm:px-4 border-r border-border text-right font-mono text-xs font-semibold text-foreground/80 whitespace-nowrap">
												{formatRp(pos.nominalJumlah)}
											</td>

											<!-- KOLOM 4: RIIL BAYAR (FORMAT ANGKA AKTIF & DEFAULT KOSONG) -->
											<td class="py-1.5 px-2 sm:px-3 bg-teal-500/5 text-right border-l border-border/60">
												<div class="relative flex items-center justify-end">
													<span class="absolute left-2.5 text-foreground/40 font-mono text-[11px] select-none">Rp</span>
													<input
														type="text"
														inputmode="numeric"
														pattern="[0-9]*"
														value={pos.riilInputString}
														onkeydown={handleNumberKeyDown}
														oninput={(e) => handleInputRiil(pos.posId, e.currentTarget)}
														placeholder="0"
														class="w-full text-right font-mono font-bold py-1.5 pl-8 pr-2.5 bg-background hover:bg-background/90 focus:bg-background border border-border focus:border-teal-500 rounded-lg text-xs text-foreground focus:outline-none transition-all placeholder:text-foreground/30 shadow-2xs"
													/>
												</div>
											</td>
										</tr>
									{/each}
								{/if}
							{/each}
						{/if}
					</tbody>

					<!-- BARIS TOTAL PALING BAWAH (PERSIS SEPERTI TEMPLATE KU) -->
					<tfoot>
						<tr class="bg-secondary/70 border-t-2 border-border font-bold text-foreground">
							<td class="py-2.5 px-2.5 text-center border-r border-border"></td>
							<td class="py-2.5 px-3 sm:px-4 border-r border-border tracking-wider uppercase font-extrabold text-xs">
								TOTAL SETORAN
							</td>
							<td class="py-2.5 px-3 sm:px-4 border-r border-border text-right font-mono font-extrabold text-xs text-foreground/90 whitespace-nowrap">
								{formatRp(totalJumlahSaran)}
							</td>
							<td class="py-2.5 px-3 sm:px-4 text-right font-mono font-extrabold text-sm text-teal-600 dark:text-teal-400 bg-teal-500/10 whitespace-nowrap">
								{formatRp(totalRiilBayar)}
							</td>
						</tr>
					</tfoot>
				</table>
			</div>

			<!-- Notice Evaluasi Selisih -->
			<div class="p-3 bg-secondary/20 border-t border-border/60 flex flex-wrap items-center justify-between gap-2 text-xs">
				<div class="flex items-center gap-2 text-foreground/70">
					<Info class="w-4 h-4 text-primary shrink-0" />
					<span>
						Jumlah saran adalah patokan dari KU. Jamaah mengisi angka riil yang disetorkan.
					</span>
				</div>
				{#if totalRiilBayar > 0}
					<div class="font-semibold {selisihNominal >= 0 ? 'text-teal-600 dark:text-teal-400' : 'text-amber-600 dark:text-amber-400'}">
						{selisihNominal >= 0 ? `✓ Sesuai / Di atas anjuran saran (+${formatRp(selisihNominal)})` : `Selisih -${formatRp(Math.abs(selisihNominal))} dari saran`}
					</div>
				{/if}
			</div>
		</section>

		<!-- Metode Pembayaran & Bukti Transfer -->
		<section class="bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
			<div class="flex items-center gap-2">
				<Wallet class="w-5 h-5 text-primary" />
				<h3 class="text-sm sm:text-base font-bold text-foreground">Metode Penyetoran</h3>
			</div>

			<!-- Selector Metode: Tunai vs Transfer -->
			<div class="grid grid-cols-2 gap-3">
				<button
					type="button"
					onclick={() => (metodeBayar = 'Tunai')}
					class="p-3 rounded-2xl border text-left transition-all flex items-center gap-3 {metodeBayar === 'Tunai'
						? 'border-primary bg-primary/10 shadow-xs'
						: 'border-border bg-secondary/30 hover:bg-secondary/60'}"
				>
					<div class="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
						<Banknote class="w-5 h-5" />
					</div>
					<div>
						<h4 class="text-xs sm:text-sm font-bold text-foreground">Tunai / Cash</h4>
						<p class="text-[11px] text-foreground/60">Diserahkan langsung ke KU</p>
					</div>
				</button>

				<button
					type="button"
					onclick={() => (metodeBayar = 'Transfer')}
					class="p-3 rounded-2xl border text-left transition-all flex items-center gap-3 {metodeBayar === 'Transfer'
						? 'border-primary bg-primary/10 shadow-xs'
						: 'border-border bg-secondary/30 hover:bg-secondary/60'}"
				>
					<div class="w-9 h-9 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
						<CreditCard class="w-5 h-5" />
					</div>
					<div>
						<h4 class="text-xs sm:text-sm font-bold text-foreground">Transfer / QRIS</h4>
						<p class="text-[11px] text-foreground/60">Kirim rekening bank resmi</p>
					</div>
				</button>
			</div>

			<!-- Rincian Rekening Resmi jika memilih Transfer -->
			{#if metodeBayar === 'Transfer'}
				<div class="space-y-3 pt-2">
					<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
						<h4 class="text-xs font-bold text-foreground/80 flex items-center gap-1.5">
							<ShieldCheck class="w-4 h-4 text-teal-600" />
							{#if rekeningBankList.length > 0 && qrisList.length > 0}
								Rekening & QRIS Resmi Kelompok ({data.kelompokNama})
							{:else if qrisList.length > 0}
								QRIS Resmi Kelompok ({data.kelompokNama})
							{:else}
								Rekening Bank Resmi Kelompok ({data.kelompokNama})
							{/if}
						</h4>

						<!-- Switcher Tab jika kelompok menyediakan kedua metode (Bank & QRIS) -->
						{#if rekeningBankList.length > 0 && qrisList.length > 0}
							<div class="inline-flex items-center p-1 bg-secondary/60 rounded-xl border border-border/80 text-xs self-start sm:self-auto shadow-2xs">
								<button
									type="button"
									onclick={() => (transferChannel = 'bank')}
									class="px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer {transferChannel === 'bank' ? 'bg-card text-foreground shadow-2xs border border-border/60' : 'text-foreground/60 hover:text-foreground'}"
								>
									<CreditCard class="w-3.5 h-3.5 text-primary" />
									<span>Rekening Bank</span>
									<span class="px-1.5 py-0.2 rounded-full text-[10px] bg-secondary text-foreground/70 font-semibold">{rekeningBankList.length}</span>
								</button>
								<button
									type="button"
									onclick={() => (transferChannel = 'qris')}
									class="px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer {transferChannel === 'qris' ? 'bg-card text-foreground shadow-2xs border border-border/60' : 'text-foreground/60 hover:text-foreground'}"
								>
									<QrCode class="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
									<span>Scan QRIS</span>
									<span class="px-1.5 py-0.2 rounded-full text-[10px] bg-secondary text-foreground/70 font-semibold">{qrisList.length}</span>
								</button>
							</div>
						{/if}
					</div>

					{#if !data.rekeningList || data.rekeningList.length === 0}
						<div class="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300">
							Belum ada rekening atau QRIS resmi yang dikonfigurasikan di kelompok ini. Anda dapat menanyakan langsung ke KU kelompok.
						</div>
					{:else if transferChannel === 'bank' && rekeningBankList.length > 0}
						<!-- DAFTAR REKENING BANK RESMI (Kompak, tidak melar vertikal, anti-tabrakan teks) -->
						<div class="grid grid-cols-1 {rekeningBankList.length > 1 ? 'sm:grid-cols-2' : ''} gap-3.5">
							{#each rekeningBankList as rek}
								<div class="border border-border bg-card rounded-2xl p-4 shadow-2xs space-y-3">
									<div class="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-2.5">
										<div class="flex items-center gap-2 min-w-0">
											<span class="px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 flex items-center gap-1 shrink-0">
												<CreditCard class="w-3 h-3" />
												<span>{rek.namaBank}</span>
											</span>
											<span class="text-xs font-bold text-foreground truncate">
												{rek.tipeTujuan || 'Infaq / Shodaqoh'}
											</span>
										</div>
										<span class="text-[11px] font-medium text-foreground/70 shrink-0">a.n {rek.atasNama}</span>
									</div>

									<div class="flex items-center justify-between p-3 bg-secondary/40 rounded-xl border border-border/60 gap-3">
										<div class="min-w-0 flex-1">
											<p class="text-[10px] text-foreground/50 uppercase font-semibold">Nomor Rekening</p>
											<p class="font-mono text-sm sm:text-base font-bold text-foreground tracking-wider select-all truncate">
												{rek.nomorRekening}
											</p>
										</div>
										<button
											type="button"
											onclick={() => copyToClipboard(rek.nomorRekening)}
											class="px-3 py-2 rounded-xl bg-card border border-border hover:bg-secondary text-xs font-semibold text-foreground flex items-center gap-1.5 transition-all shadow-2xs active:scale-95 shrink-0 cursor-pointer"
										>
											{#if copiedRekeningText === rek.nomorRekening}
												<CheckCircle2 class="w-3.5 h-3.5 text-emerald-500" />
												<span class="text-emerald-600 font-bold">Disalin</span>
											{:else}
												<Copy class="w-3.5 h-3.5 text-foreground/60" />
												<span>Salin</span>
											{/if}
										</button>
									</div>

									{#if rek.keterangan}
										<p class="text-[11px] text-foreground/60 italic px-0.5">
											{rek.keterangan}
										</p>
									{/if}
								</div>
							{/each}
						</div>
					{:else if transferChannel === 'qris' && qrisList.length > 0}
						<!-- DAFTAR SCAN QRIS RESMI (Tampilan barcode terpusat & bersih) -->
						<div class="grid grid-cols-1 {qrisList.length > 1 ? 'sm:grid-cols-2' : ''} gap-3.5">
							{#each qrisList as rek}
								<div class="border border-border bg-card rounded-2xl p-4 shadow-2xs space-y-3">
									<div class="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-2.5">
										<div class="flex items-center gap-2 min-w-0">
											<span class="px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/20 flex items-center gap-1 shrink-0">
												<QrCode class="w-3 h-3" />
												<span>QRIS</span>
											</span>
											<span class="text-xs font-bold text-foreground truncate">
												{rek.tipeTujuan || 'Infaq / Shodaqoh'}
											</span>
										</div>
										<span class="text-[11px] font-medium text-foreground/70 shrink-0">a.n {rek.atasNama}</span>
									</div>

									{#if rek.qrisImageUrl}
										<div class="flex flex-col items-center justify-center p-3.5 bg-secondary/30 rounded-xl space-y-2.5">
											<button
												type="button"
												onclick={() => (zoomedQris = { url: rek.qrisImageUrl!, atasNama: rek.atasNama })}
												class="relative group rounded-xl overflow-hidden border border-border shadow-xs max-w-48 bg-white p-2.5 cursor-pointer transition-transform hover:scale-[1.02]"
												aria-label="Perbesar QRIS"
											>
												<img
													src={rek.qrisImageUrl}
													alt="QRIS {rek.atasNama}"
													class="w-full h-auto object-contain max-h-48 mx-auto"
												/>
												<div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[11px] font-bold rounded-xl">
													Klik untuk perbesar
												</div>
											</button>
											<p class="text-[11px] text-foreground/60 text-center max-w-xs">
												Scan dengan aplikasi M-Banking atau E-Wallet apa saja (BCA, Mandiri, BSI, GoPay, OVO, Dana, ShopeePay)
											</p>
										</div>
									{:else}
										<div class="p-3 bg-secondary/30 rounded-xl text-center text-xs text-foreground/60">
											Gambar barcode QRIS belum diunggah oleh pengurus kelompok.
										</div>
									{/if}

									{#if rek.keterangan}
										<p class="text-[11px] text-foreground/60 italic px-0.5 text-center">
											{rek.keterangan}
										</p>
									{/if}
								</div>
							{/each}
						</div>
					{/if}

					<!-- Upload Bukti Transfer Interaktif -->
					<div class="space-y-2 pt-1">
						<label for="buktiFile" class="text-xs font-bold text-foreground/80 flex items-center gap-1.5">
							<UploadCloud class="w-3.5 h-3.5 text-primary" />
							Unggah Bukti Transfer (Foto / Screenshot / PDF)
						</label>
						<div class="flex flex-col gap-2">
							<input
								type="file"
								id="buktiFile"
								name="buktiFile"
								accept="image/*,application/pdf"
								onchange={handleFileChange}
								class="w-full text-xs text-foreground/70 file:mr-3 file:py-2 file:px-3.5 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer border border-border rounded-xl p-1.5 bg-background shadow-2xs"
							/>

							{#if previewBukti}
								<div class="p-2.5 bg-secondary/40 rounded-xl border border-border flex items-center justify-between gap-3 animate-in fade-in">
									<div class="flex items-center gap-2.5 min-w-0">
										<img src={previewBukti} alt="Pratinjau Bukti" class="w-12 h-12 object-cover rounded-lg border border-border shrink-0 bg-black/10" />
										<div class="min-w-0">
											<p class="text-xs font-bold text-foreground truncate">File Bukti Terpilih</p>
											<p class="text-[10px] text-teal-600 dark:text-teal-400 font-semibold">Siap diunggah saat simpan</p>
										</div>
									</div>
									<button
										type="button"
										onclick={handleClearFile}
										class="px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-500/10 rounded-lg transition-colors shrink-0"
									>
										Hapus
									</button>
								</div>
							{/if}

							{#if data.transaksiExisting?.buktiUrl && !previewBukti}
								<div class="flex items-center justify-between p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-700 dark:text-emerald-300">
									<div class="flex items-center gap-2">
										<CheckCircle2 class="w-4 h-4 text-emerald-600 shrink-0" />
										<span>Bukti transfer bulan ini sudah tersimpan</span>
									</div>
									<a
										href={data.transaksiExisting.buktiUrl}
										target="_blank"
										rel="noreferrer"
										class="font-bold underline hover:opacity-80 shrink-0"
									>
										Lihat Bukti
									</a>
								</div>
							{/if}
						</div>
					</div>
				</div>
			{/if}

			<!-- Catatan Tambahan -->
			<div class="space-y-1.5">
				<label for="catatan" class="text-xs font-bold text-foreground/80 flex items-center gap-1.5">
					<FileText class="w-3.5 h-3.5 text-primary" />
					Catatan Tambahan untuk KU (Opsional)
				</label>
				<textarea
					id="catatan"
					name="catatan"
					bind:value={catatanTambahan}
					rows="2"
					placeholder="Contoh: Titip lewat mas Andi / Ditransfer via rekening BCA istri..."
					class="w-full px-3 py-2 text-xs sm:text-sm bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
				></textarea>
			</div>
		</section>

		<!-- Sticky Bottom Action Footer -->
		<div class="sticky bottom-4 z-20 space-y-2">
			{#if errorMessageToast}
				<div class="p-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-center justify-between gap-2 shadow-lg backdrop-blur-md animate-in fade-in slide-in-from-bottom-2">
					<div class="flex items-center gap-2">
						<AlertCircle class="w-4 h-4 text-rose-600 shrink-0" />
						<span class="font-semibold">{errorMessageToast}</span>
					</div>
					<button type="button" onclick={() => (errorMessageToast = null)} class="text-rose-600 hover:text-rose-800 p-0.5">
						<X class="w-3.5 h-3.5" />
					</button>
				</div>
			{/if}

			{#if showSuccessToast}
				<div class="p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs flex items-center justify-between gap-2 shadow-lg backdrop-blur-md animate-in fade-in slide-in-from-bottom-2">
					<div class="flex items-center gap-2">
						<CheckCircle2 class="w-4 h-4 text-emerald-600 shrink-0" />
						<span class="font-bold">Laporan setoran Isrun/FR berhasil dikirim dan tersimpan!</span>
					</div>
					<button type="button" onclick={() => (showSuccessToast = false)} class="text-emerald-600 hover:text-emerald-800 p-0.5">
						<X class="w-3.5 h-3.5" />
					</button>
				</div>
			{/if}

			<div class="bg-card/95 backdrop-blur-md border border-border p-3.5 sm:p-4 rounded-2xl shadow-xl flex items-center justify-between gap-3">
				<div>
					<p class="text-[11px] text-foreground/60 font-medium leading-none">Total yang Disetorkan</p>
					<p class="text-base sm:text-xl font-bold font-mono text-teal-600 dark:text-teal-400 mt-0.5">
						{formatRp(totalRiilBayar)}
					</p>
				</div>

				<button
					type="submit"
					disabled={isSubmitting}
					class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs sm:text-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-teal-600/20 cursor-pointer"
				>
					{#if isSubmitting}
						<RefreshCw class="w-4 h-4 animate-spin" />
						<span>Menyimpan & Melaporkan...</span>
					{:else}
						<Send class="w-4 h-4" />
						<span>Simpan & Lapor Setoran</span>
					{/if}
				</button>
			</div>
		</div>
	</form>
</div>

<!-- MODAL ZOOM QRIS -->
{#if zoomedQris}
	<div
		class="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
		role="dialog"
		aria-modal="true"
		tabindex="-1"
		onclick={(e) => {
			if (e.target === e.currentTarget) zoomedQris = null;
		}}
		onkeydown={(e) => {
			if (e.key === 'Escape') zoomedQris = null;
		}}
	>
		<div class="bg-card border border-border rounded-3xl max-w-sm w-full p-5 shadow-2xl space-y-4 text-center animate-in fade-in zoom-in-95">
			<div class="flex items-center justify-between pb-2 border-b border-border">
				<h4 class="text-xs font-bold text-foreground">QRIS Resmi {data.kelompokNama}</h4>
				<button
					type="button"
					onclick={() => (zoomedQris = null)}
					class="p-1 rounded-lg text-foreground/60 hover:text-foreground cursor-pointer"
					aria-label="Tutup QRIS"
				>
					<X class="w-4 h-4" />
				</button>
			</div>

			<div class="p-3 bg-white rounded-2xl inline-block shadow-md">
				<img src={zoomedQris.url} alt="QRIS {zoomedQris.atasNama}" class="max-w-64 max-h-64 object-contain mx-auto" />
			</div>

			<div class="space-y-1">
				<p class="text-xs font-bold text-foreground">a.n {zoomedQris.atasNama}</p>
				<p class="text-[11px] text-foreground/60 leading-relaxed">
					Buka aplikasi mobile banking atau e-wallet Anda, lalu scan QRIS di atas untuk melakukan transfer setoran.
				</p>
			</div>
		</div>
	</div>
{/if}

