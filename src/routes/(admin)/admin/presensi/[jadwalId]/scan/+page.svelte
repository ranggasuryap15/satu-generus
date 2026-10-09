<!--
  @file src/routes/(admin)/admin/presensi/[jadwalId]/scan/+page.svelte
  @purpose Halaman pemindai QR Code kamera smartphone untuk pencatatan kehadiran pengajian
  @usedBy Route admin '/admin/presensi/[jadwalId]/scan'
  @dependencies html5-qrcode, @lucide/svelte (ArrowLeft, Camera, CheckCircle2, AlertCircle, RefreshCw), $lib/utils (formatDateDDMMYYYY)
  @publicFunctions startScanner, stopScanner, handleScanSuccess
  @sideEffects Mengakses media kamera perangkat dan memanggil API POST /api/presensi/scan
-->
<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { ArrowLeft, Camera, CheckCircle2, AlertCircle, RefreshCw } from '@lucide/svelte';
	import type { PageData } from './$types';
	import { formatDateDDMMYYYY } from '$lib/utils';

	let { data } = $props<{ data: PageData }>();

	let html5QrCode: any = null;
	let isScanning = $state(false);
	let scanMessage = $state<{ text: string; isError?: boolean } | null>(null);
	let lastScannedJamaah = $state<{ nama: string; waktu: string } | null>(null);

	onMount(async () => {
		// Dinamic import html5-qrcode agar aman dari SSR Node
		const { Html5Qrcode } = await import('html5-qrcode');
		html5QrCode = new Html5Qrcode('qr-reader');
		startScanner();
	});

	onDestroy(() => {
		stopScanner();
	});

	async function startScanner() {
		if (!html5QrCode) return;
		scanMessage = null;
		try {
			isScanning = true;
			await html5QrCode.start(
				{ facingMode: 'environment' },
				{
					fps: 10,
					qrbox: { width: 250, height: 250 }
				},
				onScanSuccess,
				() => {} // Abaikan frame tanpa QR
			);
		} catch (err: any) {
			isScanning = false;
			scanMessage = { text: err?.message || 'Gagal mengakses kamera.', isError: true };
		}
	}

	async function stopScanner() {
		if (html5QrCode && isScanning) {
			try {
				await html5QrCode.stop();
			} catch (_) {}
			isScanning = false;
		}
	}

	async function onScanSuccess(decodedText: string) {
		// Jeda pemindaian sejenak untuk mencegah spamming
		try {
			const res = await fetch('/api/presensi/scan', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					jadwalId: data.jadwal.id,
					qrPayload: decodedText
				})
			});

			const result = await res.json();
			if (res.ok) {
				lastScannedJamaah = {
					nama: result.namaLengkap,
					waktu: result.waktu
				};
				scanMessage = {
					text: `Presensi Berhasil: ${result.namaLengkap} tercatat Hadir (${result.waktu})`
				};
			} else {
				scanMessage = { text: result.error || 'Gagal memproses QR Code', isError: true };
			}
		} catch (err) {
			scanMessage = { text: 'Terjadi kesalahan jaringan saat mengirim data scan.', isError: true };
		}
	}
</script>

<svelte:head>
	<title>Scan Kamera QR - {data.jadwal.namaKegiatan}</title>
</svelte:head>

<div class="space-y-5 max-w-xl mx-auto">
	<!-- Top Bar Header -->
	<div class="flex items-center gap-3">
		<a
			href={`/admin/presensi/${data.jadwal.id}`}
			class="p-2 rounded-lg border border-border bg-card hover:bg-secondary text-foreground/70 hover:text-foreground transition-colors"
			aria-label="Kembali ke checklist"
		>
			<ArrowLeft class="w-4 h-4" />
		</a>
		<div>
			<h1 class="text-base font-bold text-foreground tracking-tight">Scanner Kamera Presensi</h1>
			<p class="text-xs text-foreground/60">
				{data.jadwal.namaKegiatan} • {formatDateDDMMYYYY(data.jadwal.tanggal)} • {data.kelompokNama}
			</p>
		</div>
	</div>

	<!-- Scanner Container Card -->
	<div class="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
		<!-- Box Kamera HTML5 QR -->
		<div
			id="qr-reader"
			class="w-full aspect-square max-w-xs mx-auto overflow-hidden rounded-xl border-2 border-dashed border-primary/40 bg-secondary/30 flex items-center justify-center relative"
		></div>

		<!-- Status / Feedback Banner -->
		{#if scanMessage}
			<div
				class="p-3.5 rounded-xl text-xs flex items-center gap-2.5 {scanMessage.isError
					? 'bg-destructive/10 border border-destructive/20 text-destructive'
					: 'bg-primary/10 border border-primary/20 text-primary font-medium'}"
			>
				{#if scanMessage.isError}
					<AlertCircle class="w-4 h-4 shrink-0" />
				{:else}
					<CheckCircle2 class="w-4 h-4 shrink-0" />
				{/if}
				<span class="leading-relaxed">{scanMessage.text}</span>
			</div>
		{/if}

		{#if lastScannedJamaah}
			<div class="bg-secondary/40 border border-border rounded-xl p-3 flex items-center justify-between text-xs">
				<div>
					<p class="text-[10px] text-foreground/50 font-medium">Jamaah Terakhir Dipindai:</p>
					<h4 class="font-bold text-foreground text-sm mt-0.5">{lastScannedJamaah.nama}</h4>
				</div>
				<span class="text-[11px] font-mono text-primary bg-primary/10 px-2 py-1 rounded">
					{lastScannedJamaah.waktu}
				</span>
			</div>
		{/if}

		<!-- Controls -->
		<div class="flex items-center justify-center gap-3 pt-2">
			{#if isScanning}
				<button
					type="button"
					onclick={stopScanner}
					class="px-4 py-2 rounded-lg border border-border text-xs font-semibold text-foreground/70 hover:bg-secondary"
				>
					Jeda Kamera
				</button>
			{:else}
				<button
					type="button"
					onclick={startScanner}
					class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90"
				>
					<Camera class="w-4 h-4" />
					<span>Mulai Pemindaian</span>
				</button>
			{/if}

			<a
				href={`/admin/presensi/${data.jadwal.id}`}
				class="px-4 py-2 rounded-lg bg-secondary text-xs font-semibold text-foreground hover:bg-secondary/80"
			>
				Buka Tabel Checklist
			</a>
		</div>
	</div>
</div>

