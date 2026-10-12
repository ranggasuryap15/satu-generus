<!--
  @file src/routes/(app)/shodaqoh/+page.svelte
  @purpose Halaman shodaqoh & infaq mobile-first untuk jamaah: scan QRIS, salin nomor rekening bank, pengiriman konfirmasi transfer beserta bukti transfer, dan pemantauan riwayat status verifikasi
  @usedBy Route client '/shodaqoh'
  @dependencies @lucide/svelte, $app/forms, Svelte 5 Runes
  @publicFunctions N/A (Svelte Component)
  @sideEffects Mengirim laporan shodaqoh baru beserta file bukti transfer ke server
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
		HeartHandshake,
		Image as ImageIcon,
		QrCode,
		Send,
		ShieldCheck,
		UploadCloud,
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

	// Form State
	let formNama = $state(data.user?.namaLengkap || '');
	let formNoHp = $state(data.user?.noTelepon || '');
	let formJenis = $state(data.jenisList[0]?.nama || 'Shodaqoh Kelompok');
	let formNominal = $state<number | string>('');
	let formMetode = $state<'Transfer Bank' | 'QRIS'>('QRIS');
	let formTanggal = $state(new Date().toISOString().substring(0, 10));
	let formCatatan = $state('');
	let previewBukti = $state<string | null>(null);
	let isSubmitting = $state(false);

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

	<!-- Pilihan Rekening & QRIS Wilayah -->
	<div class="space-y-3">
		<div class="flex items-center justify-between">
			<h3 class="text-xs font-bold text-foreground uppercase tracking-wider">
				Rekening & QRIS Resmi
			</h3>
			<span class="text-[11px] text-foreground/50">
				{data.selectedKelompok?.nama || '-'}
			</span>
		</div>

		{#if data.rekeningList.length === 0}
			<div class="border border-border/80 rounded-2xl p-6 text-center space-y-2 bg-card">
				<div class="w-10 h-10 rounded-full bg-secondary text-foreground/40 mx-auto flex items-center justify-center">
					<Coins class="w-5 h-5" />
				</div>
				<p class="text-xs font-semibold text-foreground">Rekening Belum Ditambahkan</p>
				<p class="text-[11px] text-foreground/50 max-w-xs mx-auto">
					Pengurus kelompok belum mengatur nomor rekening atau QRIS resmi.
				</p>
			</div>
		{:else}
			<div class="space-y-3">
				{#each data.rekeningList as rek}
					<div class="border border-border bg-card rounded-2xl p-4 shadow-2xs space-y-3">
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-2">
								<span class="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
									{rek.namaBank}
								</span>
								<span class="text-xs font-bold text-foreground">{rek.tipeTujuan}</span>
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
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Riwayat Shodaqoh Saya (Jika Login) -->
	{#if data.user && data.riwayatSaya.length > 0}
		<div class="space-y-3 pt-2">
			<h3 class="text-xs font-bold text-foreground uppercase tracking-wider">
				Riwayat Konfirmasi Saya
			</h3>

			<div class="space-y-2">
				{#each data.riwayatSaya as rw}
					<div class="border border-border bg-card rounded-2xl p-3.5 flex items-center justify-between gap-3 shadow-2xs">
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
								<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
									<CheckCircle2 class="w-3 h-3" /> Disetujui
								</span>
							{:else if rw.statusApproval === 'Ditolak'}
								<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20" title={rw.alasanPenolakan || ''}>
									<XCircle class="w-3 h-3" /> Ditolak
								</span>
							{:else}
								<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
									<Clock class="w-3 h-3" /> Menunggu
								</span>
							{/if}
						</div>
					</div>
				{/each}
			</div>
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
				<input type="hidden" name="kelompokId" value={data.selectedKelompok?.id} />

				<!-- Jenis Shodaqoh -->
				<div class="space-y-1">
					<label class="font-semibold text-foreground" for="jenisShodaqohSelect">Jenis Shodaqoh / Alokasi</label>
					<select
						id="jenisShodaqohSelect"
						name="namaJenisShodaqoh"
						bind:value={formJenis}
						class="w-full bg-secondary/60 border border-border rounded-xl px-3 py-2.5 text-foreground font-medium focus:ring-1 focus:ring-primary outline-none"
					>
						{#each data.jenisList as j}
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

