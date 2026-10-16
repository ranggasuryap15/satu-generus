<!--
  @file src/routes/(app)/presensi/+page.svelte
  @purpose Halaman presensi mandiri jamaah (Hadir Offline / Online / Izin / QR) dengan seleksi jadwal aktif kemarin s/d besok (H-1 s/d H+1), titik lokasi venue persisten terikat ke basis kelompok jamaah (tetap terdeteksi walau belum ada sesi pengajian aktif), tautan jadwal sebulan dengan return origin 'presensi', dan standar Modern Flat
  @usedBy Route client '/presensi'
  @dependencies qrcode, @lucide/svelte, $app/forms, #lib/utils (formatDateDDMMYYYY), Svelte 5 Runes
  @publicFunctions captureLocation, calculateDistanceMeters, handleFotoChange, resetPresensiForm, openPreviewFoto, closePreviewFoto
  @sideEffects Mengakses HTML5 Geolocation API, input kamera/galeri, generate QR code personal, dan mengirim form presensi ke server
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { enhance } from '$app/forms';
	import { confirmAction } from '#lib/confirm.svelte.ts';
	import QRCode from 'qrcode';
	import {
		AlertCircle,
		Calendar,
		Camera,
		CheckCircle2,
		ChevronRight,
		Clock,
		ExternalLink,
		FileText,
		Globe,
		ImageIcon,
		Loader2,
		MapPin,
		QrCode,
		RefreshCw,
		ShieldAlert,
		Sparkles,
		Upload,
		UserCheck,
		X,
		XCircle
	} from '@lucide/svelte';
	import type { ActionData, PageData } from './$types';
	import { formatDateDDMMYYYY } from '#lib/utils.js';

	let { data, form } = $props<{ data: PageData; form: ActionData }>();

	type TabType = 'hadir' | 'izin' | 'riwayat' | 'qr';
	let activeTab = $state<TabType>('hadir');

	// State Presensi Hadir (Gunakan activeJadwalList untuk rentang kemarin s/d besok)
	let selectedJadwalId = $state<number | string>(data.defaultJadwalId || data.activeJadwalList[0]?.id || '');
	let metodeKehadiran = $state<'offline' | 'online'>('offline');
	let isSubmitting = $state(false);

	let selectedJadwal = $derived(
		data.activeJadwalList.find((j: (typeof data.activeJadwalList)[number]) => String(j.id) === String(selectedJadwalId)) ||
		data.jadwalList.find((j: (typeof data.jadwalList)[number]) => String(j.id) === String(selectedJadwalId))
	);

	// Titik venue acuan: terikat dengan kelompok jamaah sebagai basis,
	// atau menggunakan lokasi khusus kegiatan jika pengajian terpilih memiliki lokasi khusus
	const effectiveVenue = $derived.by(() => {
		const venueLat = selectedJadwal?.latitudeVenue || data.kelompokData?.latitude || null;
		const venueLng = selectedJadwal?.longitudeVenue || data.kelompokData?.longitude || null;
		const venueRadius = selectedJadwal?.radiusMeterVenue || data.kelompokData?.radiusMeter || 100;
		const venueNama = selectedJadwal?.lokasiNama || data.kelompokData?.lokasiNama || data.kelompokData?.nama || data.kelompokNama || 'Lokasi Kelompok';
		const venueGmaps = selectedJadwal?.gmapsUrlVenue || data.kelompokData?.gmapsUrl || null;
		const hasLocation = Boolean(venueLat && venueLng);

		return {
			latitude: venueLat,
			longitude: venueLng,
			radiusMeter: venueRadius,
			lokasiNama: venueNama,
			gmapsUrl: venueGmaps,
			hasLocation
		};
	});

	// State Geolocation (Untuk Hadir Offline)
	let latitude = $state<string>('');
	let longitude = $state<string>('');
	let accuracy = $state<number | null>(null);
	let isLocating = $state(false);
	let locationError = $state<string>('');

	// Formula Haversine untuk kalkulasi jarak (dalam meter) antara koordinat jamaah dan titik venue kegiatan
	function calculateDistanceMeters(
		lat1: number,
		lon1: number,
		lat2: number,
		lon2: number
	): number {
		const R = 6371e3; // Radius bumi dalam meter
		const dLat = ((lat2 - lat1) * Math.PI) / 180;
		const dLon = ((lon2 - lon1) * Math.PI) / 180;
		const a =
			Math.sin(dLat / 2) * Math.sin(dLat / 2) +
			Math.cos((lat1 * Math.PI) / 180) *
				Math.cos((lat2 * Math.PI) / 180) *
				Math.sin(dLon / 2) *
				Math.sin(dLon / 2);
		const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
		return Math.round(R * c);
	}

	let distanceToVenue = $derived.by(() => {
		if (
			!latitude ||
			!longitude ||
			!effectiveVenue.latitude ||
			!effectiveVenue.longitude
		) {
			return null;
		}
		const latUser = parseFloat(latitude);
		const lonUser = parseFloat(longitude);
		const latVenue = parseFloat(effectiveVenue.latitude);
		const lonVenue = parseFloat(effectiveVenue.longitude);
		if (isNaN(latUser) || isNaN(lonUser) || isNaN(latVenue) || isNaN(lonVenue)) {
			return null;
		}
		return calculateDistanceMeters(latUser, lonUser, latVenue, lonVenue);
	});

	let isWithinRadius = $derived.by(() => {
		if (distanceToVenue === null || !effectiveVenue.radiusMeter) return null;
		return distanceToVenue <= effectiveVenue.radiusMeter;
	});

	// State Bukti Foto
	let fotoDataUrl = $state<string>('');
	let fotoFileName = $state<string>('');

	// State Modal Popup Preview Foto Bukti Presensi
	let previewFotoUrl = $state<string | null>(null);
	let previewFotoTitle = $state<string>('');

	function openPreviewFoto(url: string, title: string) {
		previewFotoUrl = url;
		previewFotoTitle = title;
	}

	function closePreviewFoto() {
		previewFotoUrl = null;
		previewFotoTitle = '';
	}

	// State Pengajuan Izin
	let izinJadwalId = $state<number | string>(data.defaultJadwalId || data.activeJadwalList[0]?.id || '');
	let izinStatus = $state<'Izin' | 'Sakit'>('Izin');
	let izinAlasan = $state('');
	let izinFotoDataUrl = $state('');

	// State QR Code
	let qrCodeUrl = $state('');

	// Fungsi Deteksi Lokasi GPS
	function captureLocation() {
		if (!navigator.geolocation) {
			locationError = 'Peramban Anda tidak mendukung deteksi lokasi (Geolocation).';
			return;
		}

		isLocating = true;
		locationError = '';

		navigator.geolocation.getCurrentPosition(
			(pos) => {
				latitude = pos.coords.latitude.toFixed(6);
				longitude = pos.coords.longitude.toFixed(6);
				accuracy = Math.round(pos.coords.accuracy);
				isLocating = false;
			},
			(err) => {
				isLocating = false;
				switch (err.code) {
					case err.PERMISSION_DENIED:
						locationError = 'Akses lokasi ditolak. Harap izinkan akses lokasi di pengaturan browser ponsel Anda.';
						break;
					case err.POSITION_UNAVAILABLE:
						locationError = 'Informasi lokasi tidak tersedia. Pastikan GPS ponsel aktif.';
						break;
					case err.TIMEOUT:
						locationError = 'Waktu permintaan lokasi habis. Coba lagi.';
						break;
					default:
						locationError = 'Gagal mendeteksi lokasi GPS.';
				}
			},
			{
				enableHighAccuracy: true,
				timeout: 12000,
				maximumAge: 0
			}
		);
	}

	// Kompresi dan baca gambar client-side
	function handleFotoChange(e: Event, targetType: 'hadir' | 'izin') {
		const target = e.target as HTMLInputElement;
		const file = target.files?.[0];
		if (!file) return;

		fotoFileName = file.name;
		const reader = new FileReader();

		reader.onload = (event) => {
			const img = new Image();
			img.onload = () => {
				// Kompresi gambar via canvas agar ukuran file ringan (< 300KB)
				const canvas = document.createElement('canvas');
				const maxDimension = 1000;
				let width = img.width;
				let height = img.height;

				if (width > height) {
					if (width > maxDimension) {
						height = Math.round((height * maxDimension) / width);
						width = maxDimension;
					}
				} else {
					if (height > maxDimension) {
						width = Math.round((width * maxDimension) / height);
						height = maxDimension;
					}
				}

				canvas.width = width;
				canvas.height = height;
				const ctx = canvas.getContext('2d');
				if (ctx) {
					ctx.drawImage(img, 0, 0, width, height);
					const compressedBase64 = canvas.toDataURL('image/jpeg', 0.8);
					if (targetType === 'hadir') {
						fotoDataUrl = compressedBase64;
					} else {
						izinFotoDataUrl = compressedBase64;
					}
				}
			};
			img.src = event.target?.result as string;
		};

		reader.readAsDataURL(file);
	}

	onMount(async () => {
		try {
			qrCodeUrl = await QRCode.toDataURL(data.qrPayload, {
				width: 280,
				margin: 2,
				color: {
					dark: '#1B5E20',
					light: '#FFFFFF'
				}
			});
		} catch (err) {
			console.error('Gagal membuat QR Code:', err);
		}

		// Otomatis deteksi lokasi jika di tab hadir dan metode offline
		if (metodeKehadiran === 'offline') {
			captureLocation();
		}
	});

	$effect(() => {
		if (form?.success) {
			fotoDataUrl = '';
			fotoFileName = '';
			izinAlasan = '';
			izinFotoDataUrl = '';
		}
	});
</script>

<svelte:head>
	<title>Presensi Pengajian Jamaah - Satu Generus</title>
</svelte:head>

<div class="space-y-4 max-w-lg mx-auto">
	<!-- Page Header -->
	<div class="bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-xs">
		<div class="flex items-center justify-between">
			<div>
				<h1 class="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
					<UserCheck class="w-6 h-6 text-primary" />
					<span>Presensi Pengajian</span>
				</h1>
				<p class="text-sm text-foreground/60 mt-1">
					{data.kelompokNama} • {data.user.namaLengkap}
				</p>
			</div>
			<span class="px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary">
				Jamaah
			</span>
		</div>
	</div>

	<!-- Tab Navigation -->
	<div class="grid grid-cols-4 p-1.5 bg-secondary rounded-xl text-center text-xs font-semibold">
		<button
			type="button"
			onclick={() => (activeTab = 'hadir')}
			class="py-2.5 rounded-lg transition-all flex flex-col items-center gap-1.5 {activeTab === 'hadir'
				? 'bg-card text-primary shadow-xs'
				: 'text-foreground/60 hover:text-foreground'}"
		>
			<UserCheck class="w-4 h-4" />
			<span class="text-xs font-semibold">Hadir</span>
		</button>

		<button
			type="button"
			onclick={() => (activeTab = 'izin')}
			class="py-2.5 rounded-lg transition-all flex flex-col items-center gap-1.5 {activeTab === 'izin'
				? 'bg-card text-accent shadow-xs'
				: 'text-foreground/60 hover:text-foreground'}"
		>
			<FileText class="w-4 h-4" />
			<span class="text-xs font-semibold">Izin/Sakit</span>
		</button>

		<button
			type="button"
			onclick={() => (activeTab = 'riwayat')}
			class="py-2.5 rounded-lg transition-all flex flex-col items-center gap-1.5 {activeTab === 'riwayat'
				? 'bg-card text-foreground shadow-xs'
				: 'text-foreground/60 hover:text-foreground'}"
		>
			<Clock class="w-4 h-4" />
			<span class="text-xs font-semibold">Riwayat</span>
		</button>

		<button
			type="button"
			onclick={() => (activeTab = 'qr')}
			class="py-2.5 rounded-lg transition-all flex flex-col items-center gap-1.5 {activeTab === 'qr'
				? 'bg-card text-foreground shadow-xs'
				: 'text-foreground/60 hover:text-foreground'}"
		>
			<QrCode class="w-4 h-4" />
			<span class="text-xs font-semibold">Kartu QR</span>
		</button>
	</div>

	<!-- Notifikasi Pesan Server -->
	{#if form?.error}
		<div
			class="p-2.5 bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold rounded-xl flex items-center gap-2"
		>
			<AlertCircle class="w-4 h-4 shrink-0" />
			<span>{form.error}</span>
		</div>
	{/if}

	{#if form?.success}
		<div
			class="p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold rounded-xl flex items-center gap-2"
		>
			<CheckCircle2 class="w-4 h-4 shrink-0" />
			<span>{form.message || 'Presensi Berhasil'}</span>
		</div>
	{/if}

	<!-- ============================================================== -->
	<!-- TAB 1: PRESENSI HADIR (OFFLINE GPS & FOTO KAMERA / ONLINE FOTO/SS) -->
	<!-- ============================================================== -->
	{#if activeTab === 'hadir'}
		<div class="bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
			<div>
				<h2 class="text-sm font-bold text-foreground">Form Presensi Hadir</h2>
			</div>

			<form
				method="POST"
				action="?/presensiMandiri"
				use:enhance={async ({ cancel }) => {
					if (!selectedJadwalId) {
						await confirmAction({
							title: 'Data Belum Lengkap',
							message: 'Pilih jadwal kegiatan terlebih dahulu.',
							confirmText: 'Mengerti',
							cancelText: '',
							variant: 'warning'
						});
						cancel();
						return;
					}
					if (selectedJadwal && selectedJadwal.bisaPresensi === false) {
						await confirmAction({
							title: 'Presensi Belum Dibuka',
							message: selectedJadwal.pesanStatusWaktu || 'Presensi belum dibuka untuk kegiatan ini.',
							confirmText: 'Mengerti',
							cancelText: '',
							variant: 'warning'
						});
						cancel();
						return;
					}
					if (metodeKehadiran === 'offline' && (!latitude || !longitude)) {
						await confirmAction({
							title: 'Lokasi Belum Terdeteksi',
							message: 'Lokasi GPS belum terdeteksi. Silakan klik tombol "Deteksi Lokasi GPS" terlebih dahulu.',
							confirmText: 'Mengerti',
							cancelText: '',
							variant: 'warning'
						});
						cancel();
						return;
					}
					if (!fotoDataUrl) {
						await confirmAction({
							title: 'Foto Wajib Diunggah',
							message: metodeKehadiran === 'offline'
								? 'Wajib mengambil foto kamera di lokasi pengajian!'
								: 'Wajib mengunggah foto bukti / tangkapan layar (SS) Zoom / SDC!',
							confirmText: 'Mengerti',
							cancelText: '',
							variant: 'warning'
						});
						cancel();
						return;
					}
					isSubmitting = true;
					return async ({ update }) => {
						isSubmitting = false;
						await update();
					};
				}}
				class="space-y-4 text-xs"
			>
				<input type="hidden" name="metode" value={metodeKehadiran} />
				<input type="hidden" name="latitude" value={latitude} />
				<input type="hidden" name="longitude" value={longitude} />
				<input type="hidden" name="fotoBase64" value={fotoDataUrl} />

				<!-- Pilihan Jadwal Pengajian (Rentang Kemarin s/d Besok) -->
				<div>
					<div class="flex items-center justify-between mb-1.5">
						<label for="jadwalSelect" class="block font-semibold text-foreground/80">
							Pilih Kegiatan Pengajian *
						</label>
						<a
							href="/jadwal?from=presensi"
							class="text-[11px] font-semibold text-primary hover:underline inline-flex items-center gap-0.5"
						>
							<span>Jadwal Sebulan</span>
							<ChevronRight class="w-3 h-3" />
						</a>
					</div>

					{#if data.activeJadwalList.length === 0}
						<div class="p-3.5 rounded-xl bg-secondary/50 border border-border text-center space-y-2">
							<p class="text-xs text-foreground/70">
								Tidak ada kegiatan pengajian aktif hari ini (rentang kemarin - besok).
							</p>
							<a
								href="/jadwal?from=presensi"
								class="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
							>
								<span>Lihat Jadwal Pengajian Sebulan</span>
								<ChevronRight class="w-3.5 h-3.5" />
							</a>
						</div>
					{:else}
						<select
							id="jadwalSelect"
							name="jadwalId"
							bind:value={selectedJadwalId}
							required
							class="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:bg-background"
						>
							{#each data.activeJadwalList as j}
								<option value={j.id}>
									{j.namaKegiatan} ({formatDateDDMMYYYY(j.tanggal)}{j.jamMulai ? ` • ${j.jamMulai} WIB` : ''}){j.bisaPresensi === false ? ' [Presensi Belum Dibuka]' : ''}
								</option>
							{/each}
						</select>
					{/if}

					{#if selectedJadwal && selectedJadwal.bisaPresensi === false}
						<div class="mt-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 flex items-start gap-2.5 text-xs">
							<Clock class="w-4 h-4 shrink-0 mt-0.5" />
							<div class="space-y-0.5">
								<p class="font-bold">Presensi Belum / Tidak Tersedia</p>
								<p class="text-[11px] opacity-90">{selectedJadwal.pesanStatusWaktu}</p>
							</div>
						</div>
					{/if}

					{#if selectedJadwal?.lokasiNama || selectedJadwal?.latitudeVenue}
						<div class="mt-2.5 p-3 rounded-xl bg-secondary/40 border border-border/80 flex items-start justify-between gap-3 text-xs">
							<div class="space-y-0.5 min-w-0">
								<div class="flex items-center gap-1.5 font-semibold text-foreground truncate">
									<MapPin class="w-4 h-4 text-primary shrink-0" />
									<span class="truncate">{selectedJadwal.lokasiNama || 'Titik Lokasi Kegiatan'}</span>
								</div>
								{#if selectedJadwal.latitudeVenue && selectedJadwal.longitudeVenue}
									<p class="text-xs text-foreground/60 font-mono">
										Radius Absensi: &plusmn;{selectedJadwal.radiusMeterVenue || 100}m
									</p>
								{/if}
							</div>
							{#if selectedJadwal.gmapsUrlVenue || (selectedJadwal.latitudeVenue && selectedJadwal.longitudeVenue)}
								<a
									href={selectedJadwal.gmapsUrlVenue || `https://www.google.com/maps?q=${selectedJadwal.latitudeVenue},${selectedJadwal.longitudeVenue}`}
									target="_blank"
									rel="noopener noreferrer"
									class="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline shrink-0 px-2.5 py-1 bg-primary/10 rounded-lg"
								>
									<span>Buka Maps</span>
									<ExternalLink class="w-3.5 h-3.5" />
								</a>
							{/if}
						</div>
					{/if}
				</div>

				<!-- Pilihan Kriteria: Hadir Offline vs Hadir Online -->
				<div>
					<span class="block font-semibold text-xs text-foreground/80 mb-2">Metode Kehadiran *</span>
					<div class="grid grid-cols-2 gap-2.5">
						<!-- Kartu Opsi Hadir Offline -->
						<button
							type="button"
							onclick={() => {
								metodeKehadiran = 'offline';
								if (!latitude) captureLocation();
							}}
							class="p-3 rounded-xl border text-left transition-all cursor-pointer {metodeKehadiran ===
							'offline'
								? 'border-primary bg-primary/10 ring-1 ring-primary'
								: 'border-border bg-card hover:bg-secondary/40'}"
						>
							<div class="flex items-center justify-between gap-1">
								<div class="flex items-center gap-1.5 font-bold text-xs text-foreground">
									<MapPin class="w-4 h-4 text-primary shrink-0" />
									<span>Offline (Lokasi)</span>
								</div>
								{#if !effectiveVenue.hasLocation}
									<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400">
										Belum Diset
									</span>
								{:else if isWithinRadius === false}
									<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-destructive/10 text-destructive">
										Luar
									</span>
								{:else if isWithinRadius === true}
									<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
										Sesuai
									</span>
								{/if}
							</div>
						</button>

						<!-- Kartu Opsi Hadir Online -->
						<button
							type="button"
							onclick={() => (metodeKehadiran = 'online')}
							class="p-3 rounded-xl border text-left transition-all cursor-pointer {metodeKehadiran ===
							'online'
								? 'border-blue-500 bg-blue-500/10 ring-1 ring-blue-500'
								: 'border-border bg-card hover:bg-secondary/40'}"
						>
							<div class="flex items-center justify-between gap-1">
								<div class="flex items-center gap-1.5 font-bold text-xs text-foreground">
									<Globe class="w-4 h-4 text-blue-500 shrink-0" />
									<span>Online (Daring)</span>
								</div>
								<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400">
									Bukti SS
								</span>
							</div>
						</button>
					</div>
				</div>

				<!-- Bagian Deteksi Lokasi GPS (Khusus Hadir Offline) -->
				{#if metodeKehadiran === 'offline'}
					<div class="p-3 rounded-xl bg-secondary/30 border border-border space-y-2">
						<div class="flex items-center justify-between">
							<span class="font-semibold text-foreground flex items-center gap-1.5 text-xs">
								<MapPin class="w-3.5 h-3.5 text-primary" />
								<span>Lokasi Anda</span>
								{#if effectiveVenue.lokasiNama}
									<span class="font-normal text-[11px] text-foreground/50 truncate max-w-[140px] sm:max-w-[200px]" title={effectiveVenue.lokasiNama}>
										({effectiveVenue.lokasiNama})
									</span>
								{/if}
							</span>
							<button
								type="button"
								onclick={captureLocation}
								disabled={isLocating}
								class="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline cursor-pointer"
							>
								{#if isLocating}
									<Loader2 class="w-3 h-3 animate-spin" />
									<span>Mencari...</span>
								{:else}
									<RefreshCw class="w-3 h-3" />
									<span>Deteksi Ulang</span>
								{/if}
							</button>
						</div>

						{#if !effectiveVenue.hasLocation}
							<div class="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs flex items-center justify-between gap-2">
								<span class="flex items-center gap-1.5 font-medium">
									<AlertCircle class="w-4 h-4 shrink-0" />
									Titik lokasi kelompok belum diset
								</span>
								<button
									type="button"
									onclick={() => (metodeKehadiran = 'online')}
									class="px-2 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[11px] shrink-0 cursor-pointer"
								>
									Pindah Online
								</button>
							</div>
						{:else if latitude && longitude}
							{#if distanceToVenue !== null}
								{#if isWithinRadius}
									<div class="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 flex items-center justify-between text-xs font-semibold">
										<span class="flex items-center gap-1.5">
											<CheckCircle2 class="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
											Lokasi Sesuai
										</span>
										<span class="font-mono text-[11px] text-foreground/60">~{distanceToVenue}m</span>
									</div>
								{:else}
									<div class="p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive flex items-center justify-between gap-2 text-xs font-semibold">
										<span class="flex items-center gap-1.5 min-w-0">
											<AlertCircle class="w-4 h-4 shrink-0" />
											<span class="truncate">Di Luar Jangkauan (~{distanceToVenue}m)</span>
										</span>
										<button
											type="button"
											onclick={() => (metodeKehadiran = 'online')}
											class="px-2.5 py-1 rounded bg-destructive text-destructive-foreground hover:bg-destructive/90 text-[11px] font-bold shrink-0 cursor-pointer"
										>
											Pindah Online
										</button>
									</div>
								{/if}
							{:else}
								<div class="p-2 rounded-lg bg-secondary text-foreground/70 text-xs flex items-center gap-1.5 font-mono">
									<span>Lat: {latitude}, Lng: {longitude}</span>
								</div>
							{/if}
						{:else}
							<div class="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs flex items-center gap-1.5 font-medium">
								{#if isLocating}
									<Loader2 class="w-4 h-4 animate-spin shrink-0" />
									<span>Mendeteksi GPS ponsel...</span>
								{:else}
									<AlertCircle class="w-4 h-4 shrink-0" />
									<span>Lokasi GPS belum terdeteksi</span>
								{/if}
							</div>
						{/if}

						{#if locationError}
							<p class="text-[11px] text-destructive leading-tight font-medium">
								{locationError}
							</p>
						{/if}
					</div>
				{/if}

				<!-- Bagian Foto Bukti Kehadiran -->
				<div class="p-3 rounded-xl bg-secondary/30 border border-border space-y-2.5">
					<div class="flex items-center justify-between">
						<span class="font-semibold text-foreground flex items-center gap-1.5 text-[11px]">
							<Camera class="w-3.5 h-3.5 text-primary" />
							{#if metodeKehadiran === 'offline'}
								<span>Foto Wajib dari Kamera Langsung</span>
							{:else}
								<span>Foto Bukti (Kamera atau Tangkapan Layar / SS SDC)</span>
							{/if}
						</span>
					</div>

					{#if fotoDataUrl}
						<!-- Preview Foto yang Diambil -->
						<div class="relative rounded-xl overflow-hidden border border-border max-w-xs mx-auto">
							<img src={fotoDataUrl} alt="Bukti Presensi" class="w-full h-48 object-cover rounded-xl" />
							<button
								type="button"
								onclick={() => {
									fotoDataUrl = '';
									fotoFileName = '';
								}}
								class="absolute top-2 right-2 p-1 rounded-full bg-background/80 text-foreground hover:bg-background shadow-xs transition-colors"
								title="Hapus foto"
							>
								<X class="w-4 h-4" />
							</button>
						</div>
					{:else}
						<!-- Input Ambil Foto -->
						<label
							class="border-2 border-dashed border-border rounded-xl p-3.5 text-center cursor-pointer hover:border-primary/60 transition-colors flex flex-col items-center justify-center gap-1.5 bg-card"
						>
							{#if metodeKehadiran === 'offline'}
								<input
									type="file"
									accept="image/*"
									capture="user"
									onchange={(e) => handleFotoChange(e, 'hadir')}
									class="hidden"
								/>
								<div class="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center">
									<Camera class="w-4 h-4" />
								</div>
								<span class="text-xs font-bold text-primary">Ambil Foto Kamera</span>
							{:else}
								<input
									type="file"
									accept="image/*"
									onchange={(e) => handleFotoChange(e, 'hadir')}
									class="hidden"
								/>
								<div class="w-9 h-9 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center">
									<Upload class="w-4 h-4" />
								</div>
								<span class="text-xs font-bold text-blue-600 dark:text-blue-400">
									Unggah Bukti / Screenshot
								</span>
							{/if}
						</label>
					{/if}
				</div>

				<!-- Tombol Submit Presensi -->
				{#if selectedJadwal && selectedJadwal.bisaPresensi === false}
					<div
						class="w-full py-2.5 px-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs font-semibold text-center flex items-center justify-center gap-2"
					>
						<Clock class="w-4 h-4 shrink-0" />
						<span>{selectedJadwal.pesanStatusWaktu || 'Presensi belum dibuka'}</span>
					</div>
				{:else if metodeKehadiran === 'offline' && isWithinRadius === false}
					<button
						type="button"
						onclick={() => (metodeKehadiran = 'online')}
						class="w-full py-2.5 rounded-xl bg-destructive hover:bg-destructive/90 text-destructive-foreground text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
					>
						<Globe class="w-4 h-4" />
						<span>Di Luar Jangkauan — Beralih ke Online</span>
					</button>
				{:else if selectedJadwal && selectedJadwal.bisaPresensi === false}
					<button
						type="button"
						disabled
						class="w-full py-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-not-allowed select-none opacity-90"
					>
						<Clock class="w-4 h-4" />
						<span>Presensi Belum Dibuka (1 Jam Sebelum Acara)</span>
					</button>
				{:else if !selectedJadwal}
					<button
						type="button"
						disabled
						class="w-full py-2.5 rounded-xl bg-secondary text-foreground/40 border border-border text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-not-allowed"
					>
						<span>Tidak Ada Jadwal Pengajian Aktif</span>
					</button>
				{:else}
					<button
						type="submit"
						disabled={isSubmitting || (metodeKehadiran === 'offline' && (!isWithinRadius || !latitude || !effectiveVenue.hasLocation))}
						class="w-full py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition-all shadow-xs active:scale-98 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
					>
						{#if isSubmitting}
							<Loader2 class="w-4 h-4 animate-spin" />
							<span>Mengirim...</span>
						{:else}
							<CheckCircle2 class="w-4 h-4" />
							<span>Kirim Presensi</span>
						{/if}
					</button>
				{/if}
			</form>
		</div>

	<!-- ============================================================== -->
	<!-- TAB 2: AJUKAN IZIN / SAKIT (PERLU APPROVAL ADMIN) -->
	<!-- ============================================================== -->
	{:else if activeTab === 'izin'}
		<div class="bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
			<div>
				<h2 class="text-sm font-bold text-foreground">Form Permohonan Izin / Sakit</h2>
			</div>

			<form
				method="POST"
				action="?/ajukanIzin"
				use:enhance={async ({ cancel }) => {
					if (!izinJadwalId) {
						await confirmAction({
							title: 'Data Belum Lengkap',
							message: 'Pilih jadwal kegiatan terlebih dahulu.',
							confirmText: 'Mengerti',
							cancelText: '',
							variant: 'warning'
						});
						cancel();
						return;
					}
					if (!izinAlasan.trim()) {
						await confirmAction({
							title: 'Data Belum Lengkap',
							message: 'Alasan permohonan izin/sakit wajib diisi.',
							confirmText: 'Mengerti',
							cancelText: '',
							variant: 'warning'
						});
						cancel();
						return;
					}
					isSubmitting = true;
					return async ({ update }) => {
						isSubmitting = false;
						await update();
					};
				}}
				class="space-y-4 text-xs"
			>
				<input type="hidden" name="status" value={izinStatus} />
				<input type="hidden" name="fotoBase64" value={izinFotoDataUrl} />

				<!-- Pilihan Jadwal (Rentang Kemarin s/d Besok) -->
				<div>
					<div class="flex items-center justify-between mb-1.5">
						<label for="izinJadwalSelect" class="block font-semibold text-foreground/80">
							Pilih Jadwal Kegiatan *
						</label>
						<a
							href="/jadwal?from=presensi"
							class="text-[11px] font-semibold text-primary hover:underline inline-flex items-center gap-0.5"
						>
							<span>Jadwal Sebulan</span>
							<ChevronRight class="w-3 h-3" />
						</a>
					</div>
					{#if data.activeJadwalList.length === 0}
						<div class="p-3.5 rounded-xl bg-secondary/50 border border-border text-center space-y-2">
							<p class="text-xs text-foreground/70">
								Tidak ada jadwal kegiatan aktif (rentang kemarin - besok) untuk permohonan izin saat ini.
							</p>
							<a
								href="/jadwal?from=presensi"
								class="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
							>
								<span>Lihat Jadwal Pengajian Sebulan</span>
								<ChevronRight class="w-3.5 h-3.5" />
							</a>
						</div>
					{:else}
						<select
							id="izinJadwalSelect"
							name="jadwalId"
							bind:value={izinJadwalId}
							required
							class="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:bg-background"
						>
							{#each data.activeJadwalList as j}
								<option value={j.id}>
									{j.namaKegiatan} ({formatDateDDMMYYYY(j.tanggal)}{j.jamMulai ? ` • ${j.jamMulai} WIB` : ''})
								</option>
							{/each}
						</select>
					{/if}
				</div>

				<!-- Jenis Izin: Izin atau Sakit -->
				<div>
					<span class="block font-semibold text-foreground/80 mb-1.5">Jenis Keterangan *</span>
					<div class="grid grid-cols-2 gap-2.5">
						<button
							type="button"
							onclick={() => (izinStatus = 'Izin')}
							class="p-2.5 rounded-xl border text-center transition-all cursor-pointer font-bold text-xs {izinStatus ===
							'Izin'
								? 'border-amber-500 bg-amber-500/10 text-amber-800 dark:text-amber-200 ring-1 ring-amber-500'
								: 'border-border bg-card text-foreground/70 hover:bg-secondary/40'}"
						>
							Izin Berhalangan
						</button>

						<button
							type="button"
							onclick={() => (izinStatus = 'Sakit')}
							class="p-2.5 rounded-xl border text-center transition-all cursor-pointer font-bold text-xs {izinStatus ===
							'Sakit'
								? 'border-rose-500 bg-rose-500/10 text-rose-800 dark:text-rose-200 ring-1 ring-rose-500'
								: 'border-border bg-card text-foreground/70 hover:bg-secondary/40'}"
						>
							Sakit
						</button>
					</div>
				</div>

				<!-- Alasan / Keterangan Izin -->
				<div>
					<label for="alasanInput" class="block font-semibold text-foreground/80 mb-1.5">
						Alasan / Keterangan Lengkap *
					</label>
					<textarea
						id="alasanInput"
						name="alasan"
						rows="3"
						required
						bind:value={izinAlasan}
						placeholder="Contoh: Sedang tugas dinas luar kota / Demam dan sedang istirahat"
						class="w-full bg-secondary/50 border border-border rounded-xl p-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:bg-background resize-none"
					></textarea>
				</div>

				<!-- Foto Bukti Surat / Resep (Opsional) -->
				<div>
					<label class="block font-semibold text-foreground/80 mb-1.5">
						Foto Surat Dokter / Bukti Pendukung (Opsional)
					</label>
					{#if izinFotoDataUrl}
						<div class="relative rounded-xl overflow-hidden border border-border max-w-xs mx-auto">
							<img src={izinFotoDataUrl} alt="Bukti Izin" class="w-full h-40 object-cover rounded-xl" />
							<button
								type="button"
								onclick={() => (izinFotoDataUrl = '')}
								class="absolute top-2 right-2 p-1 rounded-full bg-background/80 text-foreground hover:bg-background"
							>
								<X class="w-4 h-4" />
							</button>
						</div>
					{:else}
						<label
							class="border border-dashed border-border rounded-xl p-3 text-center cursor-pointer hover:bg-secondary/30 transition-colors flex items-center justify-center gap-2 bg-card text-foreground/70"
						>
							<input
								type="file"
								accept="image/*"
								onchange={(e) => handleFotoChange(e, 'izin')}
								class="hidden"
							/>
							<Upload class="w-4 h-4 text-foreground/50" />
							<span class="text-[11px] font-medium">Unggah Foto Dokumen / Surat</span>
						</label>
					{/if}
				</div>

				<!-- Submit Button -->
				<button
					type="submit"
					disabled={isSubmitting}
					class="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all shadow-xs active:scale-98 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
				>
					{#if isSubmitting}
						<Loader2 class="w-4 h-4 animate-spin" />
						<span>Mengirim...</span>
					{:else}
						<FileText class="w-4 h-4" />
						<span>Kirim Permohonan</span>
					{/if}
				</button>
			</form>
		</div>

	<!-- ============================================================== -->
	<!-- TAB 3: RIWAYAT KEHADIRAN JAMAAH -->
	<!-- ============================================================== -->
	{:else if activeTab === 'riwayat'}
		<div class="space-y-3">
			<h3 class="text-xs font-semibold uppercase tracking-wider text-foreground/70 px-1">
				Riwayat Kehadiran Pengajian ({data.jadwalList.length})
			</h3>

			{#if data.jadwalList.length === 0}
				<div class="bg-card border border-border rounded-xl p-8 text-center text-xs text-foreground/50">
					Belum ada jadwal kegiatan untuk kelompok ini.
				</div>
			{:else}
				<div class="space-y-3">
					{#each data.jadwalList as item}
						<div class="bg-card border border-border rounded-xl p-3.5 sm:p-4 shadow-xs space-y-2.5">
							<div class="flex items-start justify-between gap-2">
								<div>
									<h4 class="text-sm font-semibold text-foreground">{item.namaKegiatan}</h4>
									<div class="flex items-center gap-1.5 text-xs text-foreground/60 mt-0.5">
										<Clock class="w-3.5 h-3.5" />
										<span>{formatDateDDMMYYYY(item.tanggal)}{item.jamMulai ? ` • ${item.jamMulai} WIB` : ''}</span>
									</div>
								</div>

								<!-- Badge Status Kehadiran & Approval -->
								<div>
									{#if item.statusKehadiran === 'Hadir'}
										<span
											class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-primary/10 text-primary"
										>
											<CheckCircle2 class="w-3.5 h-3.5" />
											<span>Hadir {item.metodeKehadiran === 'offline' ? 'Offline' : 'Online'}</span>
										</span>
									{:else if item.statusKehadiran === 'Izin' || item.statusKehadiran === 'Sakit'}
										<div class="text-right">
											<span
												class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold {item.statusApproval ===
												'Disetujui'
													? 'bg-emerald-500/10 text-emerald-600'
													: item.statusApproval === 'Ditolak'
														? 'bg-destructive/10 text-destructive'
														: 'bg-amber-500/10 text-amber-700 dark:text-amber-300'}"
											>
												<AlertCircle class="w-3.5 h-3.5" />
												<span>{item.statusKehadiran} ({item.statusApproval || 'Menunggu'})</span>
											</span>
										</div>
									{:else if item.statusKehadiran === 'Alpa'}
										<span
											class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-destructive/10 text-destructive"
										>
											<XCircle class="w-3.5 h-3.5" />
											<span>Alpa</span>
										</span>
									{:else}
										<span class="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-secondary text-foreground/60">
											Belum Hadir
										</span>
									{/if}
								</div>
							</div>

							<!-- Rincian Bukti (Jika Ada) -->
							{#if item.fotoUrl || item.latitude || item.keteranganIzin}
								<div class="pt-2 border-t border-border/50 text-xs text-foreground/75 flex items-center justify-between gap-2">
									<div class="space-y-0.5">
										{#if item.keteranganIzin}
											<p><strong class="text-foreground">Alasan:</strong> {item.keteranganIzin}</p>
										{/if}
										{#if item.latitude}
											<p class="font-mono text-xs text-foreground/50">
												Lokasi: {item.latitude}, {item.longitude}
											</p>
										{/if}
									</div>

									{#if item.fotoUrl}
										<button
											type="button"
											onclick={() => openPreviewFoto(item.fotoUrl || '', `${item.namaKegiatan} (${formatDateDDMMYYYY(item.tanggal)})`)}
											class="px-3 py-1.5 rounded-lg bg-secondary text-foreground hover:bg-secondary/80 text-xs font-semibold shrink-0 cursor-pointer border border-border/50 transition-colors"
										>
											Lihat Foto
										</button>
									{/if}
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</div>

	<!-- ============================================================== -->
	<!-- TAB 4: KARTU QR PERSONAL (FALLBACK SCAN) -->
	<!-- ============================================================== -->
	{:else if activeTab === 'qr'}
		<div class="bg-card border border-border rounded-2xl p-6 text-center shadow-xs space-y-4">
			<div class="space-y-1">
				<h3 class="text-lg font-bold text-foreground">{data.user.namaLengkap}</h3>
				<span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary">
					{data.kelompokNama}
				</span>
			</div>

			<div class="p-4 bg-white rounded-2xl inline-block shadow-inner border border-border/40 mx-auto">
				{#if qrCodeUrl}
					<img src={qrCodeUrl} alt="QR Code Jamaah" class="w-56 h-56 mx-auto rounded-lg" />
				{:else}
					<div class="w-56 h-56 flex items-center justify-center text-sm text-foreground/50">
						Memuat QR Code...
					</div>
				{/if}
			</div>

			<p class="text-xs text-foreground/50 max-w-xs mx-auto">
				Tunjukkan ke pengurus untuk dipindai.
			</p>
		</div>
	{/if}
</div>

<!-- Modal Pop-up Preview Foto Bukti Presensi -->
{#if previewFotoUrl}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
		role="dialog"
		aria-modal="true"
		tabindex="-1"
		onclick={(e) => {
			if (e.target === e.currentTarget) closePreviewFoto();
		}}
		onkeydown={(e) => {
			if (e.key === 'Escape') closePreviewFoto();
		}}
	>
		<div class="bg-card border border-border rounded-2xl max-w-lg w-full p-4 shadow-2xl space-y-3">
			<div class="flex items-center justify-between pb-2 border-b border-border">
				<h3 class="text-xs font-bold text-foreground truncate mr-2">
					{previewFotoTitle || 'Foto Bukti Presensi'}
				</h3>
				<button
					type="button"
					onclick={closePreviewFoto}
					class="p-1 rounded-lg hover:bg-secondary text-foreground/60 hover:text-foreground cursor-pointer transition-colors"
					aria-label="Tutup foto"
				>
					<X class="w-4 h-4" />
				</button>
			</div>

			<div class="rounded-xl overflow-hidden bg-black/10 flex items-center justify-center max-h-[70vh]">
				<img
					src={previewFotoUrl}
					alt="Bukti Kehadiran"
					class="max-w-full max-h-[70vh] object-contain rounded-xl"
				/>
			</div>

			<div class="flex items-center justify-between pt-1">
				<span class="text-[10.5px] text-foreground/50">Klik di luar gambar atau tombol Tutup untuk menutup</span>
				<button
					type="button"
					onclick={closePreviewFoto}
					class="px-4 py-1.5 rounded-lg bg-secondary text-foreground text-xs font-semibold hover:bg-secondary/80 cursor-pointer transition-colors"
				>
					Tutup
				</button>
			</div>
		</div>
	</div>
{/if}
