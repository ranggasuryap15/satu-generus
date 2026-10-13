<!--
  @file src/routes/(app)/shodaqoh/+page.svelte
  @purpose Halaman shodaqoh & infaq mobile-first untuk jamaah: scan QRIS & salin rekening bank resmi (Kelompok & Desa), pelaporan konfirmasi transfer shodaqoh scoped, riwayat donasi dengan filter status & pencarian, dan struk digital resmi (e-receipt)
  @usedBy Route client '/shodaqoh'
  @dependencies @lucide/svelte, $app/forms, Svelte 5 Runes
  @publicFunctions printReceipt
  @sideEffects Mengirim laporan shodaqoh baru beserta file bukti transfer ke server via action ?/laporShodaqoh, membuka modal struk dan mencetak dokumen struk resmi
-->
<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import {
		AlertCircle,
		ArrowLeft,
		Banknote,
		Building2,
		Calendar,
		CheckCircle2,
		Clock,
		Coins,
		Copy,
		ExternalLink,
		FileText,
		Filter,
		HeartHandshake,
		Image as ImageIcon,
		MapPin,
		Printer,
		QrCode,
		Search,
		Send,
		ShieldCheck,
		UploadCloud,
		Users,
		X,
		XCircle
	} from '@lucide/svelte';
	import type { PageData, ActionData } from './$types';

	let { data, form } = $props<{ data: PageData; form: ActionData }>();

	function formatRupiah(val: number): string {
		return 'Rp ' + Number(val || 0).toLocaleString('id-ID');
	}

	let isFormOpen = $state(false);
	let copiedId = $state<string | null>(null);
	let selectedReceipt = $state<(typeof data.riwayatSaya)[number] | null>(null);

	// Tab Rekening Wilayah: 'Kelompok' | 'Desa'
	let activeTabRekening = $state<'Kelompok' | 'Desa'>('Kelompok');

	// Filter Riwayat Status & Search
	let filterRiwayatStatus = $state<'Semua' | 'Menunggu' | 'Disetujui' | 'Ditolak'>('Semua');
	let searchRiwayat = $state('');

	const filteredRiwayatSaya = $derived(
		(data.riwayatSaya || []).filter((r: (typeof data.riwayatSaya)[number]) => {
			if (filterRiwayatStatus === 'Menunggu' && r.statusApproval !== 'Menunggu Persetujuan') return false;
			if (filterRiwayatStatus === 'Disetujui' && r.statusApproval !== 'Disetujui') return false;
			if (filterRiwayatStatus === 'Ditolak' && r.statusApproval !== 'Ditolak') return false;
			if (searchRiwayat.trim()) {
				const q = searchRiwayat.toLowerCase();
				return (
					r.namaJenisShodaqoh.toLowerCase().includes(q) ||
					(r.catatan && r.catatan.toLowerCase().includes(q)) ||
					(r.metodePembayaran && r.metodePembayaran.toLowerCase().includes(q))
				);
			}
			return true;
		})
	);

	function printReceipt() {
		if (typeof window !== 'undefined') {
			window.print();
		}
	}

	// Form State
	let formTingkatScope = $state<'Kelompok' | 'Desa'>('Kelompok');
	let formNama = $state(data.user?.namaLengkap || '');
	let formNoHp = $state(data.user?.noTelepon || '');
	let formJenis = $state(data.jenisList[0]?.nama || 'Shodaqoh Kelompok');
	let formNominal = $state<number | string>('');
	let formMetode = $state<'Transfer Bank' | 'QRIS'>('QRIS');
	let formTanggal = $state(new Date().toISOString().substring(0, 10));
	let formCatatan = $state('');
	let previewBukti = $state<string | null>(null);
	let isSubmitting = $state(false);

	// Derived: Jenis shodaqoh yang sesuai dengan formTingkatScope
	const scopedJenisList = $derived(
		(data.jenisList || []).filter((j: any) => !j.tingkatScope || j.tingkatScope === formTingkatScope)
	);

	// Derived: Rekening dan label scope berdasarkan tab aktif (Kelompok vs Desa)
	const currentRekeningList = $derived(
		activeTabRekening === 'Kelompok' ? (data.rekeningKelompokList || []) : (data.rekeningDesaList || [])
	);

	const activeScopeLabel = $derived(
		activeTabRekening === 'Kelompok'
			? (data.selectedKelompok?.nama || 'Kelompok')
			: `Desa ${data.selectedKelompok?.desaNama || 'Desa'}`
	);

	function openFormForScope(scope: 'Kelompok' | 'Desa') {
		formTingkatScope = scope;
		activeTabRekening = scope;
		const matchingJenis = (data.jenisList || []).find((j: any) => j.tingkatScope === scope);
		if (matchingJenis) {
			formJenis = matchingJenis.nama;
		}
		isFormOpen = true;
	}

	// Modal QRIS Zoom
	let zoomedQris = $state<{ url: string; atasNama: string } | null>(null);

	function copyToClipboard(text: string, id: string) {
		navigator.clipboard.writeText(text);
		copiedId = id;
		setTimeout(() => {
			if (copiedId === id) copiedId = null;
		}, 2000);
	}

	function handleFileChange(e: Event) {
		const target = e.target as HTMLInputElement;
		const file = target.files?.[0];
		if (file) {
			const reader = new FileReader();
			reader.onload = (evt) => {
				previewBukti = evt.target?.result as string;
			};
			reader.readAsDataURL(file);
		}
	}
</script>

<svelte:head>
	<title>Infaq & Shodaqoh - Satu Generus</title>
</svelte:head>

<div class="max-w-md mx-auto space-y-5 pb-24 px-4 pt-3">
	<!-- Top Bar Navigasi -->
	<div class="flex items-center justify-between">
		<a
			href="/"
			class="p-2 -ml-2 rounded-xl text-foreground/70 hover:text-foreground hover:bg-secondary transition-colors"
			aria-label="Kembali ke Beranda"
		>
			<ArrowLeft class="w-5 h-5" />
		</a>
		<h1 class="text-base font-bold text-foreground">Infaq & Shodaqoh</h1>
		<div class="w-8"></div>
	</div>

	<!-- Banner Hero Informasi -->
	<div class="bg-gradient-to-br from-teal-500/15 via-emerald-500/10 to-teal-500/5 border border-teal-500/25 rounded-3xl p-5 shadow-xs relative overflow-hidden">
		<div class="relative z-10 space-y-2">
			<div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-teal-500/20 text-teal-700 dark:text-teal-300 text-[11px] font-bold">
				<HeartHandshake class="w-3.5 h-3.5" />
				<span>Amalan Jariyah</span>
			</div>
			<h2 class="text-lg font-bold text-foreground tracking-tight">
				Salurkan Shodaqoh Terbaik
			</h2>
			<p class="text-xs text-foreground/75 leading-relaxed">
				Dukung kelancaran kegiatan pengajian, operasional, dan pembangunan di wilayah
				<span class="font-bold text-foreground">{data.selectedKelompok?.nama || 'Kelompok'}</span>.
			</p>

			<div class="pt-2 flex items-center gap-2">
				<button
					type="button"
					onclick={() => (isFormOpen = true)}
					class="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-md active:scale-95 transition-all"
				>
					<Send class="w-3.5 h-3.5" />
					<span>Kirim Konfirmasi Transfer</span>
				</button>
			</div>
		</div>
	</div>

	<!-- Notifikasi Pesan Sukses / Error Form -->
	{#if form?.success}
		<div class="bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 p-4 rounded-2xl flex items-start gap-3 text-xs animate-in fade-in">
			<CheckCircle2 class="w-5 h-5 shrink-0 mt-0.5" />
			<div class="space-y-0.5">
				<p class="font-bold">Laporan Berhasil Terkirim!</p>
				<p class="text-foreground/70">{form.message}</p>
			</div>
		</div>
	{:else if form?.message}
		<div class="bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 p-4 rounded-2xl flex items-start gap-3 text-xs animate-in fade-in">
			<AlertCircle class="w-5 h-5 shrink-0 mt-0.5" />
			<div class="space-y-0.5">
				<p class="font-bold">Periksa Kembali Laporan</p>
				<p class="text-foreground/70">{form.message}</p>
			</div>
		</div>
	{/if}

	<!-- Pilihan Rekening & QRIS Wilayah: Tab Kelompok vs Desa -->
	<div class="space-y-3">
		<div class="flex items-center justify-between">
			<h3 class="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
				<Building2 class="w-3.5 h-3.5 text-primary" />
				<span>Rekening & QRIS Resmi</span>
			</h3>
			<span class="text-[11px] text-foreground/50">
				{activeTabRekening === 'Kelompok' ? (data.selectedKelompok?.nama || '-') : `Desa ${data.selectedKelompok?.desaNama || '-'}`}
			</span>
		</div>

		<!-- Switcher Tab Wilayah: Kelompok & Desa -->
		<div class="grid grid-cols-2 p-1 bg-secondary/60 rounded-2xl border border-border">
			<button
				type="button"
				onclick={() => (activeTabRekening = 'Kelompok')}
				class="py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-colors duration-150 cursor-pointer {activeTabRekening === 'Kelompok'
					? 'bg-card text-foreground shadow-xs border-border/80'
					: 'border-transparent text-foreground/60 hover:text-foreground hover:bg-secondary/40'}"
			>
				<Users class="w-3.5 h-3.5 {activeTabRekening === 'Kelompok' ? 'text-emerald-500' : 'text-foreground/40'}" />
				<span>{data.selectedKelompok?.nama || 'Kelompok'}</span>
				{#if (data.rekeningKelompokList || []).length > 0}
					<span class="w-2 h-2 rounded-full bg-emerald-500 ml-0.5"></span>
				{/if}
			</button>

			<button
				type="button"
				onclick={() => (activeTabRekening = 'Desa')}
				class="py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-colors duration-150 cursor-pointer {activeTabRekening === 'Desa'
					? 'bg-card text-foreground shadow-xs border-border/80'
					: 'border-transparent text-foreground/60 hover:text-foreground hover:bg-secondary/40'}"
			>
				<Building2 class="w-3.5 h-3.5 {activeTabRekening === 'Desa' ? 'text-teal-500' : 'text-foreground/40'}" />
				<span>Desa {data.selectedKelompok?.desaNama || 'Desa'}</span>
				{#if (data.rekeningDesaList || []).length > 0}
					<span class="w-2 h-2 rounded-full bg-teal-500 ml-0.5"></span>
				{/if}
			</button>
		</div>

		<!-- Container Rekening Berdasarkan Tab Aktif -->
		{#if currentRekeningList.length === 0}
			<div class="border border-border/80 rounded-2xl p-6 text-center space-y-2 bg-card">
				<div class="w-10 h-10 rounded-full bg-secondary text-foreground/40 mx-auto flex items-center justify-center">
					<Coins class="w-5 h-5" />
				</div>
				<p class="text-xs font-semibold text-foreground">Rekening Belum Ditambahkan</p>
				<p class="text-[11px] text-foreground/50 max-w-xs mx-auto">
					Pengurus {activeTabRekening === 'Kelompok' ? 'kelompok' : 'desa'} belum mengatur nomor rekening atau QRIS resmi untuk {activeScopeLabel}.
				</p>
			</div>
		{:else}
			<div class="space-y-3">
				{#each currentRekeningList as rek}
					<div class="border border-border bg-card rounded-2xl p-4 shadow-2xs space-y-3">
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-2">
								<span class="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
									{rek.namaBank}
								</span>
								<span class="text-xs font-bold text-foreground">{rek.tipeTujuan}</span>
								<span class="px-1.5 py-0.5 rounded-md text-[9px] font-semibold bg-secondary text-foreground/70">
									{rek.tingkatScope}
								</span>
							</div>
							<span class="text-[10px] text-foreground/50">a.n {rek.atasNama}</span>
						</div>

						{#if rek.qrisImageUrl}
							<div class="flex flex-col items-center justify-center p-3 bg-secondary/30 rounded-xl space-y-2">
								<button
									type="button"
									onclick={() => (zoomedQris = { url: rek.qrisImageUrl!, atasNama: rek.atasNama })}
									class="relative group rounded-xl overflow-hidden border border-border shadow-xs max-w-56"
									aria-label="Perbesar QRIS"
								>
									<img
										src={rek.qrisImageUrl}
										alt="QRIS {rek.atasNama}"
										class="w-full h-auto object-contain transition-transform group-hover:scale-105"
									/>
									<div class="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-bold">
										Klik untuk perbesar
									</div>
								</button>
								<p class="text-[10px] text-foreground/60 text-center">
									Scan langsung dengan aplikasi M-Banking atau E-Wallet apa saja
								</p>
							</div>
						{:else}
							<div class="flex items-center justify-between p-3 bg-secondary/40 rounded-xl">
								<div>
									<p class="text-[10px] text-foreground/50 uppercase font-semibold">Nomor Rekening</p>
									<p class="font-mono text-base font-bold text-foreground tracking-wider select-all">
										{rek.nomorRekening}
									</p>
								</div>
								<button
									type="button"
									onclick={() => copyToClipboard(rek.nomorRekening, rek.id)}
									class="px-3 py-2 rounded-xl bg-card border border-border hover:bg-secondary text-xs font-semibold text-foreground flex items-center gap-1.5 transition-all shadow-2xs active:scale-95"
								>
									{#if copiedId === rek.id}
										<CheckCircle2 class="w-3.5 h-3.5 text-emerald-500" />
										<span class="text-emerald-600 font-bold">Disalin</span>
									{:else}
										<Copy class="w-3.5 h-3.5 text-foreground/60" />
										<span>Salin</span>
									{/if}
								</button>
							</div>
						{/if}

						{#if rek.keterangan}
							<p class="text-[11px] text-foreground/60 italic px-1">
								{rek.keterangan}
							</p>
						{/if}

						<!-- Tombol Cepat Konfirmasi Transfer untuk Rekening Ini -->
						<div class="pt-1 flex justify-end">
							<button
								type="button"
								onclick={() => openFormForScope(rek.tingkatScope as 'Kelompok' | 'Desa')}
								class="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1"
							>
								<Send class="w-3 h-3" />
								<span>Konfirmasi transfer ke {rek.tingkatScope} ini</span>
							</button>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Riwayat Shodaqoh Saya (Jika Login) -->
	{#if data.user && data.riwayatSaya.length > 0}
		<div class="space-y-3 pt-2">
			<div class="flex items-center justify-between">
				<h3 class="text-xs font-bold text-foreground uppercase tracking-wider">
					Riwayat Konfirmasi Saya ({filteredRiwayatSaya.length})
				</h3>
			</div>

			<!-- Filter Status & Pencarian Riwayat -->
			<div class="space-y-2">
				<div class="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
					{#each ['Semua', 'Menunggu', 'Disetujui', 'Ditolak'] as st}
						<button
							type="button"
							onclick={() => (filterRiwayatStatus = st as any)}
							class="px-3 py-1 rounded-full text-xs font-semibold shrink-0 transition-all {filterRiwayatStatus === st
								? 'bg-primary text-primary-foreground shadow-xs'
								: 'bg-secondary/70 hover:bg-secondary text-foreground/70'}"
						>
							{st}
						</button>
					{/each}
				</div>

				<div class="relative">
					<Search class="w-3.5 h-3.5 text-foreground/40 absolute left-3 top-1/2 -translate-y-1/2" />
					<input
						type="search"
						bind:value={searchRiwayat}
						placeholder="Cari jenis, doa/niat, metode..."
						class="w-full bg-secondary/50 border border-border rounded-xl pl-8.5 pr-3 py-1.5 text-xs text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary"
					/>
				</div>
			</div>

			{#if filteredRiwayatSaya.length === 0}
				<div class="p-6 text-center rounded-2xl border border-dashed border-border bg-card/40 space-y-1">
					<p class="text-xs font-semibold text-foreground">Tidak Ada Riwayat</p>
					<p class="text-[11px] text-foreground/50">
						Tidak ditemukan data shodaqoh dengan filter status "{filterRiwayatStatus}" {searchRiwayat ? `atau kata kunci "${searchRiwayat}"` : ''}.
					</p>
				</div>
			{:else}
				<div class="space-y-2">
					{#each filteredRiwayatSaya as rw}
					<div class="border border-border bg-card rounded-2xl p-3.5 shadow-2xs space-y-2">
						<div class="flex items-center justify-between gap-3">
							<div class="space-y-0.5 min-w-0">
								<div class="flex items-center gap-2">
									<span class="font-bold text-xs text-foreground truncate">{rw.namaJenisShodaqoh}</span>
									<span class="font-mono text-xs font-bold text-primary">{formatRupiah(rw.nominal)}</span>
								</div>
								<p class="text-[10px] text-foreground/50">
									{rw.tanggalTransfer} • {rw.metodePembayaran}
								</p>
							</div>

							<div class="shrink-0">
								{#if rw.statusApproval === 'Disetujui'}
									<div class="flex items-center gap-1.5">
										<button
											type="button"
											onclick={() => (selectedReceipt = rw)}
											class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-secondary hover:bg-secondary/80 text-foreground border border-border transition-colors active:scale-95"
											title="Lihat tanda terima resmi"
										>
											<FileText class="w-3 h-3 text-primary" /> Struk
										</button>
										<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
											<CheckCircle2 class="w-3 h-3" /> Disetujui
										</span>
									</div>
								{:else if rw.statusApproval === 'Ditolak'}
									<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
										<XCircle class="w-3 h-3" /> Ditolak
									</span>
								{:else}
									<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
										<Clock class="w-3 h-3" /> Menunggu
									</span>
								{/if}
							</div>
						</div>

						{#if rw.statusApproval === 'Ditolak' && rw.alasanPenolakan}
							<div class="pt-2 border-t border-border/60 flex items-start gap-1.5 text-[10px] text-rose-600 dark:text-rose-400 bg-rose-500/5 -mx-3.5 -mb-3.5 p-2.5 rounded-b-2xl">
								<AlertCircle class="w-3.5 h-3.5 shrink-0 mt-0.5" />
								<div class="min-w-0 leading-tight">
									<span class="font-semibold">Alasan penolakan:</span> {rw.alasanPenolakan}
								</div>
							</div>
						{/if}
					</div>
				{/each}
			</div>
			{/if}
		</div>
	{/if}
</div>

<!-- MODAL FORM KONFIRMASI / LAPOR SHODAQOH -->
{#if isFormOpen}
	<div class="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
		<div class="bg-card border border-border rounded-3xl max-w-md w-full p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95">
			<div class="flex items-center justify-between pb-2 border-b border-border">
				<div>
					<h3 class="text-sm font-bold text-foreground">Form Laporan Shodaqoh</h3>
					<p class="text-[11px] text-foreground/60">{data.selectedKelompok?.nama || 'Kelompok'}</p>
				</div>
				<button
					type="button"
					onclick={() => (isFormOpen = false)}
					class="p-1.5 rounded-xl text-foreground/60 hover:text-foreground hover:bg-secondary"
				>
					<X class="w-4 h-4" />
				</button>
			</div>

			<form
				method="POST"
				action="?/laporShodaqoh"
				enctype="multipart/form-data"
				use:enhance={() => {
					isSubmitting = true;
					return async ({ update }) => {
						isSubmitting = false;
						isFormOpen = false;
						await update();
					};
				}}
				class="space-y-3.5 text-xs"
			>
				<input type="hidden" name="tingkatScope" value={formTingkatScope} />
				<input type="hidden" name="kelompokId" value={data.selectedKelompok?.id} />
				<input type="hidden" name="desaId" value={data.targetDesaId} />

				<!-- Pilihan Tingkat Scope Tujuan Shodaqoh -->
				<div class="space-y-1">
					<label class="font-semibold text-foreground">Tingkat Wilayah Tujuan *</label>
					<div class="grid grid-cols-2 gap-2 p-1 bg-secondary/50 rounded-xl border border-border">
						<button
							type="button"
							onclick={() => openFormForScope('Kelompok')}
							class="py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all {formTingkatScope === 'Kelompok'
								? 'bg-card text-foreground shadow-xs border border-border'
								: 'text-foreground/60 hover:text-foreground'}"
						>
							{data.selectedKelompok?.nama || 'Kelompok'}
						</button>
						<button
							type="button"
							onclick={() => openFormForScope('Desa')}
							class="py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all {formTingkatScope === 'Desa'
								? 'bg-card text-foreground shadow-xs border border-border'
								: 'text-foreground/60 hover:text-foreground'}"
						>
							Desa {data.selectedKelompok?.desaNama || 'Desa'}
						</button>
					</div>
				</div>

				<!-- Jenis Shodaqoh Sesuai Scope -->
				<div class="space-y-1">
					<label class="font-semibold text-foreground" for="jenisShodaqohSelect">
						Jenis Shodaqoh / Alokasi ({formTingkatScope}) *
					</label>
					<select
						id="jenisShodaqohSelect"
						name="namaJenisShodaqoh"
						bind:value={formJenis}
						class="w-full bg-secondary/60 border border-border rounded-xl px-3 py-2.5 text-foreground font-medium focus:ring-1 focus:ring-primary outline-none"
					>
						{#each scopedJenisList as j}
							<option value={j.nama}>{j.nama}</option>
						{/each}
					</select>
				</div>

				<!-- Nominal -->
				<div class="space-y-1">
					<label class="font-semibold text-foreground" for="nominalInput">Nominal Transfer (Rp)</label>
					<div class="relative">
						<span class="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/50 font-bold">Rp</span>
						<input
							id="nominalInput"
							type="number"
							name="nominal"
							bind:value={formNominal}
							placeholder="50.000"
							min="1000"
							step="1000"
							class="w-full bg-secondary/60 border border-border rounded-xl pl-10 pr-3 py-2.5 font-mono text-sm font-bold text-foreground focus:ring-1 focus:ring-primary outline-none"
							required
						/>
					</div>
				</div>

				<!-- Nama Pengirim & No Telepon -->
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
					<div class="space-y-1">
						<label class="font-semibold text-foreground" for="namaPengirimInput">Nama Pengirim</label>
						<input
							id="namaPengirimInput"
							type="text"
							name="namaPengirim"
							bind:value={formNama}
							placeholder="Nama Anda / Hamba Allah"
							class="w-full bg-secondary/60 border border-border rounded-xl px-3 py-2 text-foreground focus:ring-1 focus:ring-primary outline-none"
							required
						/>
					</div>

					<div class="space-y-1">
						<label class="font-semibold text-foreground" for="noTeleponInput">No. WhatsApp (Opsional)</label>
						<input
							id="noTeleponInput"
							type="tel"
							name="noTelepon"
							bind:value={formNoHp}
							placeholder="0812xxxx"
							class="w-full bg-secondary/60 border border-border rounded-xl px-3 py-2 text-foreground focus:ring-1 focus:ring-primary outline-none"
						/>
					</div>
				</div>

				<!-- Metode & Tanggal -->
				<div class="grid grid-cols-2 gap-2.5">
					<div class="space-y-1">
						<label class="font-semibold text-foreground" for="metodePembayaranSelect">Metode Pembayaran</label>
						<select
							id="metodePembayaranSelect"
							name="metodePembayaran"
							bind:value={formMetode}
							class="w-full bg-secondary/60 border border-border rounded-xl px-3 py-2 text-foreground focus:ring-1 focus:ring-primary outline-none"
						>
							<option value="QRIS">QRIS</option>
							<option value="Transfer Bank">Transfer Bank</option>
							<option value="Tunai">Tunai / Titip</option>
						</select>
					</div>

					<div class="space-y-1">
						<label class="font-semibold text-foreground" for="tanggalTransferInput">Tanggal Transfer</label>
						<input
							id="tanggalTransferInput"
							type="date"
							name="tanggalTransfer"
							bind:value={formTanggal}
							class="w-full bg-secondary/60 border border-border rounded-xl px-3 py-2 text-foreground focus:ring-1 focus:ring-primary outline-none"
							required
						/>
					</div>
				</div>

				<!-- Upload Bukti Transfer -->
				<div class="space-y-1.5">
					<label class="font-semibold text-foreground" for="buktiTransferFileInput">Unggah Bukti Transfer (Foto/Screenshot)</label>
					<input
						id="buktiTransferFileInput"
						type="file"
						name="buktiTransfer"
						accept="image/*"
						onchange={handleFileChange}
						class="w-full bg-secondary/50 border border-border rounded-xl p-2 text-foreground text-xs file:mr-2 file:py-1 file:px-2 file:rounded-lg file:border-0 file:bg-primary file:text-primary-foreground file:font-semibold"
					/>
					{#if previewBukti}
						<div class="mt-2 rounded-xl overflow-hidden border border-border max-h-40 flex items-center justify-center bg-black/10">
							<img src={previewBukti} alt="Pratinjau Bukti" class="max-h-36 object-contain" />
						</div>
					{/if}
				</div>

				<!-- Doa / Catatan -->
				<div class="space-y-1">
					<label class="font-semibold text-foreground" for="catatanInput">Niat / Doa Tambahan (Opsional)</label>
					<input
						id="catatanInput"
						type="text"
						name="catatan"
						bind:value={formCatatan}
						placeholder="Misal: Niat shodaqoh atas nama keluarga..."
						class="w-full bg-secondary/60 border border-border rounded-xl px-3 py-2 text-foreground focus:ring-1 focus:ring-primary outline-none"
					/>
				</div>

				<!-- Tombol Submit -->
				<div class="flex justify-end gap-2 pt-3">
					<button
						type="button"
						onclick={() => (isFormOpen = false)}
						class="px-3.5 py-2 rounded-xl text-xs font-semibold bg-secondary hover:bg-secondary/80 text-foreground"
					>
						Batal
					</button>
					<button
						type="submit"
						disabled={isSubmitting}
						class="px-5 py-2 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white shadow-md active:scale-95 transition-all flex items-center gap-1.5 disabled:opacity-50"
					>
						{#if isSubmitting}
							<span>Mengirim...</span>
						{:else}
							<Send class="w-3.5 h-3.5" />
							<span>Kirim Laporan</span>
						{/if}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- MODAL ZOOM QRIS -->
{#if zoomedQris}
	<div class="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
		<div class="bg-card border border-border rounded-3xl max-w-sm w-full p-5 shadow-2xl space-y-4 text-center animate-in fade-in zoom-in-95">
			<div class="flex items-center justify-between">
				<h4 class="text-xs font-bold text-foreground">QRIS Shodaqoh</h4>
				<button
					type="button"
					onclick={() => (zoomedQris = null)}
					class="p-1 rounded-lg text-foreground/60 hover:text-foreground"
				>
					<X class="w-4 h-4" />
				</button>
			</div>

			<div class="p-3 bg-white rounded-2xl inline-block shadow-md">
				<img src={zoomedQris.url} alt="QRIS" class="max-w-64 max-h-64 object-contain mx-auto" />
			</div>

			<p class="text-xs font-bold text-foreground">a.n {zoomedQris.atasNama}</p>
			<p class="text-[11px] text-foreground/60">
				Buka aplikasi mobile banking Anda, lalu scan QRIS di atas untuk melakukan transfer infaq.
			</p>
		</div>
	</div>
{/if}

<!-- MODAL STRUK DIGITAL / TANDA TERIMA RESMI (E-RECEIPT) -->
{#if selectedReceipt}
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
					onclick={() => (selectedReceipt = null)}
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
						{formatRupiah(selectedReceipt.nominal)}
					</div>
					<div class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 mt-1">
						<CheckCircle2 class="w-3 h-3" /> Berhasil Diverifikasi
					</div>
				</div>

				<!-- Detail Data Transaksi -->
				<div class="divide-y divide-border/60 text-[11px]">
					<div class="py-2 flex items-center justify-between">
						<span class="text-foreground/60">No. Referensi</span>
						<span class="font-mono font-bold text-foreground">SG-SHD-{selectedReceipt.id.substring(0, 8).toUpperCase()}</span>
					</div>
					<div class="py-2 flex items-center justify-between">
						<span class="text-foreground/60">Tanggal & Waktu</span>
						<span class="font-medium text-foreground">{selectedReceipt.tanggalTransfer || '-'}</span>
					</div>
					<div class="py-2 flex items-center justify-between">
						<span class="text-foreground/60">Nama Donatur</span>
						<span class="font-bold text-foreground">{selectedReceipt.namaPengirim}</span>
					</div>
					<div class="py-2 flex items-center justify-between">
						<span class="text-foreground/60">Alokasi / Jenis</span>
						<span class="font-semibold text-foreground">{selectedReceipt.namaJenisShodaqoh}</span>
					</div>
					<div class="py-2 flex items-center justify-between">
						<span class="text-foreground/60">Metode</span>
						<span class="font-medium text-foreground">{selectedReceipt.metodePembayaran}</span>
					</div>
					{#if selectedReceipt.catatan}
						<div class="py-2 flex items-start justify-between gap-3">
							<span class="text-foreground/60 shrink-0">Niat / Doa</span>
							<span class="text-right italic text-foreground/80">{selectedReceipt.catatan}</span>
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
					onclick={() => (selectedReceipt = null)}
					class="flex-1 py-2 rounded-xl text-xs font-semibold bg-secondary hover:bg-secondary/80 text-foreground transition-colors"
				>
					Tutup
				</button>
				<button
					type="button"
					onclick={printReceipt}
					class="flex-1 py-2 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-xs flex items-center justify-center gap-1.5 active:scale-95"
				>
					<Printer class="w-3.5 h-3.5" />
					<span>Cetak / PDF</span>
				</button>
			</div>
		</div>
	</div>
{/if}

