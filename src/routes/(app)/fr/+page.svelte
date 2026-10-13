<!--
  @file src/routes/(app)/fr/+page.svelte
  @purpose Halaman antarmuka client jamaah untuk pengisian dan pelaporan Isrun/FR bulanan: tabel 4 kolom (No, Uraian, Jumlah Saran [Read-Only], Riil Bayar [Diisi Jamaah]), switcher anggota & periode, info QRIS/rekening kelompok, serta form upload bukti setor
  @usedBy Route client '/fr' (diakses via Quick Access Beranda 'Isrun/FR')
  @dependencies @lucide/svelte, $app/forms (enhance), $lib/utils (formatDateDDMMYYYY), Svelte 5 Runes
  @publicFunctions handleCopySaranKeRiil, handleResetRiil, formatRupiah, submitForm
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
		Wallet
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
	let copiedRekeningText = $state<string | null>(null);

	// Inisialisasi rincian pos
	interface PosRow {
		posId: string;
		kode: string;
		nama: string;
		nominalJumlah: number;
		nominalRiil: number;
	}

	let rows = $state<PosRow[]>([]);

	$effect(() => {
		// Sinkronkan data saat data.posList berganti
		rows = (data.posList || []).map((p: any) => ({
			posId: p.posId,
			kode: p.kode,
			nama: p.nama,
			nominalJumlah: p.nominalJumlah,
			nominalRiil: p.nominalRiilBayar
		}));
	});

	// Derived total
	const totalJumlahSaran = $derived(
		rows.reduce((sum, r) => sum + (Number(r.nominalJumlah) || 0), 0)
	);

	const totalRiilBayar = $derived(
		rows.reduce((sum, r) => sum + (Number(r.nominalRiil) || 0), 0)
	);

	const selisihNominal = $derived(totalRiilBayar - totalJumlahSaran);

	// Helper format Rupiah
	function formatRp(val: number): string {
		return 'Rp ' + Number(val || 0).toLocaleString('id-ID');
	}

	// Action tombol cepat: Samakan semua Riil Bayar dengan Jumlah Saran KU
	function handleCopySaranKeRiil() {
		rows = rows.map((r) => ({
			...r,
			nominalRiil: r.nominalJumlah
		}));
	}

	// Action tombol cepat: Kosongkan isian
	function handleResetRiil() {
		rows = rows.map((r) => ({
			...r,
			nominalRiil: 0
		}));
	}

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
	const rincianJsonPayload = $derived(
		JSON.stringify(
			rows.map((r) => ({
				posId: r.posId,
				nama: r.nama,
				kode: r.kode,
				saran: r.nominalJumlah,
				riil: r.nominalRiil
			}))
		)
	);
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
		use:enhance={() => {
			isSubmitting = true;
			return async ({ update }) => {
				await update();
				isSubmitting = false;
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

		<!-- Tabel Lembar 4 Kolom (Spreadsheet-like) -->
		<section class="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
			<!-- Header Toolbar -->
			<div class="p-3.5 sm:p-4 bg-secondary/30 border-b border-border flex flex-wrap items-center justify-between gap-2.5">
				<div>
					<h3 class="text-sm sm:text-base font-bold text-foreground">Lembar 4 Kolom Isrun/FR</h3>
					<p class="text-[11px] text-foreground/60">
						Isi nominal yang Anda setorkan pada kolom <strong>Riil Bayar</strong>
					</p>
				</div>

				<div class="flex items-center gap-2">
					<button
						type="button"
						onclick={handleCopySaranKeRiil}
						class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-500/10 hover:bg-teal-500/20 text-teal-700 dark:text-teal-300 border border-teal-500/25 text-xs font-bold transition-all active:scale-95 shadow-2xs"
						title="Isi Riil Bayar sama persis dengan Jumlah Saran"
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

			<!-- Tabel 4 Kolom -->
			<div class="overflow-x-auto">
				<table class="w-full text-left text-xs sm:text-sm border-collapse">
					<thead>
						<tr class="bg-secondary/40 border-b border-border text-foreground/70 text-[11px] font-bold uppercase tracking-wider">
							<th class="py-2.5 px-3 w-12 text-center">No</th>
							<th class="py-2.5 px-3">Uraian Pos Anggaran</th>
							<th class="py-2.5 px-3 w-36 sm:w-44 text-right">
								Jumlah (Saran KU)
							</th>
							<th class="py-2.5 px-3 w-40 sm:w-52 text-right bg-teal-500/5 text-teal-800 dark:text-teal-200">
								Riil Bayar (Diisi Jamaah)
							</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-border/60">
						{#if rows.length === 0}
							<tr>
								<td colspan="4" class="py-8 text-center text-foreground/60 text-xs">
									Belum ada pos anggaran aktif di kelompok ini. Hubungi KU kelompok untuk konfigurasi template.
								</td>
							</tr>
						{:else}
							{#each rows as row, idx}
								<tr class="hover:bg-secondary/20 transition-colors">
									<!-- 1. No -->
									<td class="py-3 px-3 text-center font-bold text-foreground/60">
										{idx + 1}
									</td>

									<!-- 2. Uraian -->
									<td class="py-3 px-3">
										<div class="font-bold text-foreground">{row.nama}</div>
										<div class="text-[10px] text-foreground/50 font-mono mt-0.5">
											{row.kode}
										</div>
									</td>

									<!-- 3. Jumlah (Angka saran KU - Read Only) -->
									<td class="py-3 px-3 text-right">
										<div class="font-bold text-foreground font-mono">
											{formatRp(row.nominalJumlah)}
										</div>
										<span class="text-[10px] text-foreground/50">Min. disarankan</span>
									</td>

									<!-- 4. Riil Bayar (Diisi oleh jamaah) -->
									<td class="py-2 px-3 text-right bg-teal-500/5">
										<div class="flex items-center justify-end gap-1.5">
											<span class="text-xs text-foreground/50 font-semibold select-none">Rp</span>
											<input
												type="number"
												min="0"
												step="1000"
												bind:value={row.nominalRiil}
												class="w-32 sm:w-36 h-9 px-2.5 text-right font-mono font-bold text-sm bg-background border border-teal-500/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 transition-all text-foreground"
												placeholder="0"
											/>
										</div>
									</td>
								</tr>
							{/each}
						{/if}
					</tbody>

					<!-- Baris Ringkasan TOTAL -->
					<tfoot>
						<tr class="bg-secondary/50 border-t-2 border-border font-bold">
							<td colspan="2" class="py-3 px-3 text-right text-xs uppercase tracking-wider text-foreground">
								TOTAL SETORAN
							</td>
							<td class="py-3 px-3 text-right font-mono text-sm text-foreground">
								{formatRp(totalJumlahSaran)}
							</td>
							<td class="py-3 px-3 text-right font-mono text-base text-teal-600 dark:text-teal-400 bg-teal-500/10">
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
						{selisihNominal >= 0 ? '✓ Sesuai / Di atas anjuran saran' : `Selisih -${formatRp(Math.abs(selisihNominal))} dari saran`}
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
					<h4 class="text-xs font-bold text-foreground/80 flex items-center gap-1.5">
						<ShieldCheck class="w-4 h-4 text-teal-600" />
						Rekening & QRIS Resmi Kelompok ({data.kelompokNama})
					</h4>

					{#if data.rekeningList && data.rekeningList.length > 0}
						<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
							{#each data.rekeningList as rek}
								<div class="p-3 rounded-xl border border-border bg-secondary/30 space-y-1.5">
									<div class="flex items-center justify-between">
										<span class="text-xs font-bold text-foreground">{rek.namaBank}</span>
										<span class="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
											{rek.tipeTujuan || 'Kas Kelompok'}
										</span>
									</div>
									<div class="flex items-center justify-between gap-2 bg-background p-2 rounded-lg border border-border">
										<div>
											<p class="font-mono text-xs sm:text-sm font-bold text-foreground select-all">
												{rek.nomorRekening}
											</p>
											<p class="text-[10px] text-foreground/60">a.n {rek.atasNama}</p>
										</div>
										<button
											type="button"
											onclick={() => copyToClipboard(rek.nomorRekening)}
											class="p-1.5 rounded-md hover:bg-secondary text-foreground/60 hover:text-foreground transition-colors shrink-0"
											title="Salin No Rekening"
										>
											{#if copiedRekeningText === rek.nomorRekening}
												<CheckCircle2 class="w-4 h-4 text-emerald-600" />
											{:else}
												<Copy class="w-4 h-4" />
											{/if}
										</button>
									</div>
								</div>
							{/each}
						</div>
					{:else}
						<div class="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300">
							Belum ada rekening/QRIS resmi yang dikonfigurasikan di kelompok ini. Anda dapat menanyakan langsung ke KU kelompok.
						</div>
					{/if}

					<!-- Upload Bukti Transfer -->
					<div class="space-y-1.5 pt-1">
						<label for="buktiFile" class="text-xs font-bold text-foreground/80 flex items-center gap-1.5">
							<UploadCloud class="w-3.5 h-3.5 text-primary" />
							Upload Bukti Transfer (Opsional)
						</label>
						<input
							type="file"
							id="buktiFile"
							name="buktiFile"
							accept="image/*,application/pdf"
							class="w-full text-xs text-foreground/70 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer border border-border rounded-xl p-1 bg-background"
						/>
						{#if data.transaksiExisting?.buktiUrl}
							<div class="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 mt-1">
								<CheckCircle2 class="w-3.5 h-3.5" />
								<span>Bukti transfer sebelumnya telah terlampir</span>
								<a
									href={data.transaksiExisting.buktiUrl}
									target="_blank"
									rel="noreferrer"
									class="underline font-semibold ml-1"
								>
									Lihat Bukti
								</a>
							</div>
						{/if}
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

		<!-- Tombol Submit Simpan -->
		<div class="sticky bottom-4 z-20 bg-card/95 backdrop-blur-md border border-border p-3.5 sm:p-4 rounded-2xl shadow-xl flex items-center justify-between gap-3">
			<div>
				<p class="text-[11px] text-foreground/60 font-medium leading-none">Total yang Disetorkan</p>
				<p class="text-base sm:text-xl font-bold font-mono text-teal-600 dark:text-teal-400 mt-0.5">
					{formatRp(totalRiilBayar)}
				</p>
			</div>

			<button
				type="submit"
				disabled={isSubmitting || totalRiilBayar <= 0}
				class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs sm:text-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-teal-600/20"
			>
				{#if isSubmitting}
					<RefreshCw class="w-4 h-4 animate-spin" />
					<span>Menyimpan...</span>
				{:else}
					<Send class="w-4 h-4" />
					<span>Simpan & Lapor Setoran</span>
				{/if}
			</button>
		</div>
	</form>
</div>

