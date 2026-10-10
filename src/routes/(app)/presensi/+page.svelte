<!--
  @file src/routes/(app)/presensi/+page.svelte
  @purpose Halaman presensi mandiri jamaah (Hadir Offline dengan GPS, verifikasi radius venue & foto kamera wajib, Hadir Online dengan foto/SS SDC, dan permohonan Izin/Sakit yang membutuhkan approval admin)
  @usedBy Route client '/presensi'
  @dependencies qrcode, @lucide/svelte, $app/forms, $lib/utils (formatDateDDMMYYYY), Svelte 5 Runes
  @publicFunctions captureLocation, calculateDistanceMeters, handleFotoChange, resetPresensiForm
  @sideEffects Mengakses HTML5 Geolocation API, input kamera/galeri, generate QR code personal, dan mengirim form presensi mandiri ke server action
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { enhance } from '$app/forms';
	import QRCode from 'qrcode';
	import {
		AlertCircle,
		Calendar,
		Camera,
		CheckCircle2,
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
	import { formatDateDDMMYYYY } from '$lib/utils';

	let { data, form } = $props<{ data: PageData; form: ActionData }>();

	type TabType = 'hadir' | 'izin' | 'riwayat' | 'qr';
	let activeTab = $state<TabType>('hadir');

	// State Presensi Hadir
	let selectedJadwalId = $state<number | string>(data.jadwalList[0]?.id || '');
	let metodeKehadiran = $state<'offline' | 'online'>('offline');
	let isSubmitting = $state(false);

	let selectedJadwal = $derived(
		data.jadwalList.find((j: (typeof data.jadwalList)[number]) => String(j.id) === String(selectedJadwalId))
	);

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
			!selectedJadwal?.latitudeVenue ||
			!selectedJadwal?.longitudeVenue
		) {
			return null;
		}
		const latUser = parseFloat(latitude);
		const lonUser = parseFloat(longitude);
		const latVenue = parseFloat(selectedJadwal.latitudeVenue);
		const lonVenue = parseFloat(selectedJadwal.longitudeVenue);
		if (isNaN(latUser) || isNaN(lonUser) || isNaN(latVenue) || isNaN(lonVenue)) {
			return null;
		}
		return calculateDistanceMeters(latUser, lonUser, latVenue, lonVenue);
	});

	let isWithinRadius = $derived.by(() => {
		if (distanceToVenue === null || !selectedJadwal?.radiusMeterVenue) return null;
		return distanceToVenue <= selectedJadwal.radiusMeterVenue;
	});

	// State Bukti Foto
	let fotoDataUrl = $state<string>('');
	let fotoFileName = $state<string>('');

	// State Pengajuan Izin
	let izinJadwalId = $state<number | string>(data.jadwalList[0]?.id || '');
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
	<div class="bg-card border border-border rounded-2xl p-4 shadow-xs">
		<div class="flex items-center justify-between">
			<div>
				<h1 class="text-base font-bold text-foreground flex items-center gap-2">
					<UserCheck class="w-5 h-5 text-primary" />
					<span>Presensi Pengajian</span>
				</h1>
				<p class="text-xs text-foreground/60 mt-0.5">
					{data.kelompokNama} • {data.user.namaLengkap}
				</p>
			</div>
			<span class="px-2.5 py-1 rounded-full text-[10.5px] font-bold bg-primary/10 text-primary">
				Jamaah
			</span>
		</div>
	</div>

	<!-- Tab Navigation -->
	<div class="grid grid-cols-4 p-1 bg-secondary rounded-xl text-center text-xs font-semibold">
		<button
			type="button"
			onclick={() => (activeTab = 'hadir')}
			class="py-2 rounded-lg transition-all flex flex-col items-center gap-1 {activeTab === 'hadir'
				? 'bg-card text-primary shadow-xs'
				: 'text-foreground/60 hover:text-foreground'}"
		>
			<UserCheck class="w-4 h-4" />
			<span class="text-[11px]">Hadir</span>
		</button>

		<button
			type="button"
			onclick={() => (activeTab = 'izin')}
			class="py-2 rounded-lg transition-all flex flex-col items-center gap-1 {activeTab === 'izin'
				? 'bg-card text-accent shadow-xs'
				: 'text-foreground/60 hover:text-foreground'}"
		>
			<FileText class="w-4 h-4" />
			<span class="text-[11px]">Izin/Sakit</span>
		</button>

		<button
			type="button"
			onclick={() => (activeTab = 'riwayat')}
			class="py-2 rounded-lg transition-all flex flex-col items-center gap-1 {activeTab === 'riwayat'
				? 'bg-card text-foreground shadow-xs'
				: 'text-foreground/60 hover:text-foreground'}"
		>
			<Clock class="w-4 h-4" />
			<span class="text-[11px]">Riwayat</span>
		</button>

		<button
			type="button"
			onclick={() => (activeTab = 'qr')}
			class="py-2 rounded-lg transition-all flex flex-col items-center gap-1 {activeTab === 'qr'
				? 'bg-card text-foreground shadow-xs'
				: 'text-foreground/60 hover:text-foreground'}"
		>
			<QrCode class="w-4 h-4" />
			<span class="text-[11px]">Kartu QR</span>
		</button>
	</div>

	<!-- Notifikasi Pesan Server -->
	{#if form?.error}
		<div
			class="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-xl flex items-center gap-2"
		>
			<AlertCircle class="w-4 h-4 shrink-0" />
			<span>{form.error}</span>
		</div>
	{/if}

	{#if form?.success}
		<div
			class="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs rounded-xl flex items-center gap-2 font-medium"
		>
			<CheckCircle2 class="w-4 h-4 shrink-0" />
			<span>{form.message || 'Presensi Anda berhasil dicatat!'}</span>
		</div>
	{/if}

	<!-- ============================================================== -->
	<!-- TAB 1: PRESENSI HADIR (OFFLINE GPS & FOTO KAMERA / ONLINE FOTO/SS) -->
	<!-- ============================================================== -->
	{#if activeTab === 'hadir'}
		<div class="bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
			<div>
				<h2 class="text-sm font-bold text-foreground">Form Presensi Hadir</h2>
				<p class="text-[11px] text-foreground/60 mt-0.5">
					Pilih kriteria kehadiran sesuai lokasi Anda mengikuti kegiatan.
				</p>
			</div>

			<form
				method="POST"
				action="?/presensiMandiri"
				use:enhance={({ cancel }) => {
					if (!selectedJadwalId) {
						alert('Pilih jadwal kegiatan terlebih dahulu.');
						cancel();
						return;
					}
					if (metodeKehadiran === 'offline' && (!latitude || !longitude)) {
						alert('Lokasi GPS belum terdeteksi. Silakan klik tombol "Deteksi Lokasi GPS" terlebih dahulu.');
						cancel();
						return;
					}
					if (!fotoDataUrl) {
						alert(
							metodeKehadiran === 'offline'
								? 'Wajib mengambil foto kamera di lokasi pengajian!'
								: 'Wajib mengunggah foto bukti / tangkapan layar (SS) Zoom / SDC!'
						);
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

				<!-- Pilihan Jadwal Pengajian -->
				<div>
					<label for="jadwalSelect" class="block font-semibold text-foreground/80 mb-1.5">
						Pilih Kegiatan Pengajian *
					</label>
					<select
						id="jadwalSelect"
						name="jadwalId"
						bind:value={selectedJadwalId}
						required
						class="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:bg-background"
					>
						{#each data.jadwalList as j}
							<option value={j.id}>
								{j.namaKegiatan} ({formatDateDDMMYYYY(j.tanggal)})
							</option>
						{/each}
					</select>

					{#if selectedJadwal?.lokasiNama || selectedJadwal?.latitudeVenue}
						<div class="mt-2.5 p-2.5 rounded-xl bg-secondary/40 border border-border/80 flex items-start justify-between gap-3 text-[11px]">
							<div class="space-y-0.5 min-w-0">
								<div class="flex items-center gap-1.5 font-semibold text-foreground truncate">
									<MapPin class="w-3.5 h-3.5 text-primary shrink-0" />
									<span class="truncate">{selectedJadwal.lokasiNama || 'Titik Lokasi Kegiatan'}</span>
								</div>
								{#if selectedJadwal.latitudeVenue && selectedJadwal.longitudeVenue}
									<p class="text-[10px] text-foreground/60 font-mono">
										Radius Absensi: &plusmn;{selectedJadwal.radiusMeterVenue || 100}m
									</p>
								{/if}
							</div>
							{#if selectedJadwal.gmapsUrlVenue || (selectedJadwal.latitudeVenue && selectedJadwal.longitudeVenue)}
								<a
									href={selectedJadwal.gmapsUrlVenue || `https://www.google.com/maps?q=${selectedJadwal.latitudeVenue},${selectedJadwal.longitudeVenue}`}
									target="_blank"
									rel="noopener noreferrer"
									class="inline-flex items-center gap-1 text-[10.5px] font-medium text-primary hover:underline shrink-0 px-2 py-1 bg-primary/10 rounded-lg"
								>
									<span>Buka Maps</span>
									<ExternalLink class="w-3 h-3" />
								</a>
							{/if}
						</div>
					{/if}
				</div>

				<!-- Pilihan Kriteria: Hadir Offline vs Hadir Online -->
				<div>
					<span class="block font-semibold text-foreground/80 mb-1.5">Metode Kehadiran *</span>
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
							<div class="flex items-center gap-1.5 font-bold text-xs text-foreground">
								<MapPin class="w-3.5 h-3.5 text-primary" />
								<span>Hadir Offline</span>
							</div>
							<p class="text-[10px] text-foreground/60 mt-1 leading-snug">
								Di lokasi pengajian. <strong>Wajib GPS & Foto Kamera</strong>.
							</p>
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
							<div class="flex items-center gap-1.5 font-bold text-xs text-foreground">
								<Globe class="w-3.5 h-3.5 text-blue-500" />
								<span>Hadir Online</span>
							</div>
							<p class="text-[10px] text-foreground/60 mt-1 leading-snug">
								Daring / Zoom / SDC. <strong>Foto Kamera atau Screenshot</strong>.
							</p>
						</button>
					</div>
				</div>

				<!-- Bagian Deteksi Lokasi GPS (Khusus Hadir Offline) -->
				{#if metodeKehadiran === 'offline'}
					<div class="p-3 rounded-xl bg-secondary/30 border border-border space-y-2">
						<div class="flex items-center justify-between">
							<span class="font-semibold text-foreground flex items-center gap-1.5 text-[11px]">
								<MapPin class="w-3.5 h-3.5 text-primary" />
								<span>Titik Koordinat Lokasi Anda (Wajib)</span>
							</span>
							<button
								type="button"
								onclick={captureLocation}
								disabled={isLocating}
								class="inline-flex items-center gap-1 text-[10.5px] font-semibold text-primary hover:underline cursor-pointer"
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

						{#if latitude && longitude}
							<div class="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[11px] space-y-2">
								<div class="flex items-center justify-between">
									<div class="font-mono text-[10.5px]">
										<span>Lat: {latitude}, Lng: {longitude}</span>
										{#if accuracy}
											<span class="block text-[10px] text-foreground/50">
												Akurasi GPS: &plusmn;{accuracy} meter
											</span>
										{/if}
									</div>
									<CheckCircle2 class="w-4 h-4 text-emerald-600 shrink-0" />
								</div>

								{#if distanceToVenue !== null}
									<div class="pt-2 border-t border-emerald-500/20 flex items-center gap-1.5 text-[10.5px]">
										{#if isWithinRadius}
											<CheckCircle2 class="w-3.5 h-3.5 text-emerald-600 shrink-0" />
											<span class="text-emerald-700 dark:text-emerald-300 font-medium">
												Dalam radius kegiatan (~{distanceToVenue} m dari lokasi, batas &plusmn;{selectedJadwal?.radiusMeterVenue || 100} m)
											</span>
										{:else}
											<AlertCircle class="w-3.5 h-3.5 text-amber-500 shrink-0" />
											<span class="text-amber-700 dark:text-amber-300 font-medium">
												Di luar radius kegiatan (~{distanceToVenue} m dari lokasi, batas &plusmn;{selectedJadwal?.radiusMeterVenue || 100} m)
											</span>
										{/if}
									</div>
								{/if}
							</div>
						{:else}
							<div class="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-200 text-[11px]">
								{#if isLocating}
									<p class="flex items-center gap-1.5">
										<Loader2 class="w-3.5 h-3.5 animate-spin" />
										<span>Sedang mengambil titik koordinat GPS ponsel...</span>
									</p>
								{:else}
									<p class="leading-relaxed">
										Lokasi belum terdeteksi. Pastikan GPS aktif dan tekan tombol <strong>Deteksi Ulang</strong>.
									</p>
								{/if}
							</div>
						{/if}

						{#if locationError}
							<p class="text-[10.5px] text-destructive leading-tight">
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
							class="border-2 border-dashed border-border rounded-xl p-4 text-center cursor-pointer hover:border-primary/60 transition-colors flex flex-col items-center justify-center gap-2 bg-card"
						>
							{#if metodeKehadiran === 'offline'}
								<input
									type="file"
									accept="image/*"
									capture="user"
									onchange={(e) => handleFotoChange(e, 'hadir')}
									class="hidden"
								/>
								<div class="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
									<Camera class="w-5 h-5" />
								</div>
								<div>
									<span class="text-xs font-bold text-primary">Buka Kamera & Ambil Foto</span>
									<p class="text-[10px] text-foreground/50 mt-0.5">
										Wajib foto langsung diri Anda di lokasi pengajian
									</p>
								</div>
							{:else}
								<input
									type="file"
									accept="image/*"
									onchange={(e) => handleFotoChange(e, 'hadir')}
									class="hidden"
								/>
								<div class="w-10 h-10 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center">
									<Upload class="w-5 h-5" />
								</div>
								<div>
									<span class="text-xs font-bold text-blue-600 dark:text-blue-400">
										Unggah Screenshot / Foto SDC
									</span>
									<p class="text-[10px] text-foreground/50 mt-0.5">
										Pilih dari galeri foto tangkapan layar Zoom/SDC Anda
									</p>
								</div>
							{/if}
						</label>
					{/if}
				</div>

				<!-- Tombol Submit Presensi -->
				<button
					type="submit"
					disabled={isSubmitting}
					class="w-full py-3 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition-all shadow-md active:scale-98 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
				>
					{#if isSubmitting}
						<Loader2 class="w-4 h-4 animate-spin" />
						<span>Mengirim Presensi...</span>
					{:else}
						<CheckCircle2 class="w-4 h-4" />
						<span>Kirim Presensi Hadir Sekarang</span>
					{/if}
				</button>
			</form>
		</div>

	<!-- ============================================================== -->
	<!-- TAB 2: AJUKAN IZIN / SAKIT (PERLU APPROVAL ADMIN) -->
	<!-- ============================================================== -->
	{:else if activeTab === 'izin'}
		<div class="bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
			<div>
				<h2 class="text-sm font-bold text-foreground">Form Permohonan Izin / Sakit</h2>
				<p class="text-[11px] text-foreground/60 mt-0.5">
					Permohonan izin akan diverifikasi dan membutuhkan <strong>persetujuan (approval)</strong> dari admin.
				</p>
			</div>

			<form
				method="POST"
				action="?/ajukanIzin"
				use:enhance={({ cancel }) => {
					if (!izinJadwalId) {
						alert('Pilih jadwal kegiatan terlebih dahulu.');
						cancel();
						return;
					}
					if (!izinAlasan.trim()) {
						alert('Alasan permohonan izin/sakit wajib diisi.');
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

				<!-- Pilihan Jadwal -->
				<div>
					<label for="izinJadwalSelect" class="block font-semibold text-foreground/80 mb-1.5">
						Pilih Jadwal Kegiatan *
					</label>
					<select
						id="izinJadwalSelect"
						name="jadwalId"
						bind:value={izinJadwalId}
						required
						class="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:bg-background"
					>
						{#each data.jadwalList as j}
							<option value={j.id}>
								{j.namaKegiatan} ({formatDateDDMMYYYY(j.tanggal)})
							</option>
						{/each}
					</select>
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

				<!-- Info Approval Admin -->
				<div class="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200 text-[11px] flex items-center gap-2">
					<ShieldAlert class="w-4 h-4 shrink-0 text-amber-600" />
					<span>
						Status akan berstatus <strong>Menunggu Persetujuan</strong> sampai disetujui oleh admin pengajian.
					</span>
				</div>

				<!-- Submit Button -->
				<button
					type="submit"
					disabled={isSubmitting}
					class="w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all shadow-md active:scale-98 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
				>
					{#if isSubmitting}
						<Loader2 class="w-4 h-4 animate-spin" />
						<span>Mengajukan Permohonan...</span>
					{:else}
						<FileText class="w-4 h-4" />
						<span>Ajukan Permohonan Izin</span>
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
				<div class="space-y-2.5">
					{#each data.jadwalList as item}
						<div class="bg-card border border-border rounded-xl p-3.5 shadow-xs space-y-2">
							<div class="flex items-start justify-between gap-2">
								<div>
									<h4 class="text-xs font-bold text-foreground">{item.namaKegiatan}</h4>
									<div class="flex items-center gap-1.5 text-[11px] text-foreground/50 mt-0.5">
										<Clock class="w-3.5 h-3.5" />
										<span>{formatDateDDMMYYYY(item.tanggal)}</span>
									</div>
								</div>

								<!-- Badge Status Kehadiran & Approval -->
								<div>
									{#if item.statusKehadiran === 'Hadir'}
										<span
											class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10.5px] font-bold bg-primary/10 text-primary"
										>
											<CheckCircle2 class="w-3.5 h-3.5" />
											<span>Hadir {item.metodeKehadiran === 'offline' ? 'Offline' : 'Online'}</span>
										</span>
									{:else if item.statusKehadiran === 'Izin' || item.statusKehadiran === 'Sakit'}
										<div class="text-right">
											<span
												class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10.5px] font-bold {item.statusApproval ===
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
											class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10.5px] font-semibold bg-destructive/10 text-destructive"
										>
											<XCircle class="w-3.5 h-3.5" />
											<span>Alpa</span>
										</span>
									{:else}
										<span class="inline-flex items-center px-2 py-0.5 rounded-lg text-[10.5px] font-medium bg-secondary text-foreground/60">
											Belum Hadir
										</span>
									{/if}
								</div>
							</div>

							<!-- Rincian Bukti (Jika Ada) -->
							{#if item.fotoUrl || item.latitude || item.keteranganIzin}
								<div class="pt-2 border-t border-border/50 text-[11px] text-foreground/70 flex items-center justify-between gap-2">
									<div class="space-y-0.5">
										{#if item.keteranganIzin}
											<p><strong class="text-foreground">Alasan:</strong> {item.keteranganIzin}</p>
										{/if}
										{#if item.latitude}
											<p class="font-mono text-[10px] text-foreground/50">
												Lokasi: {item.latitude}, {item.longitude}
											</p>
										{/if}
									</div>

									{#if item.fotoUrl}
										<a
											href={item.fotoUrl}
											target="_blank"
											rel="noopener noreferrer"
											class="px-2 py-1 rounded bg-secondary text-foreground hover:bg-secondary/80 text-[10.5px] font-medium shrink-0"
										>
											Lihat Foto
										</a>
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
				<h3 class="text-base font-bold text-foreground">{data.user.namaLengkap}</h3>
				<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-primary/10 text-primary">
					{data.kelompokNama}
				</span>
			</div>

			<div class="p-4 bg-white rounded-2xl inline-block shadow-inner border border-border/40 mx-auto">
				{#if qrCodeUrl}
					<img src={qrCodeUrl} alt="QR Code Jamaah" class="w-56 h-56 mx-auto rounded-lg" />
				{:else}
					<div class="w-56 h-56 flex items-center justify-center text-xs text-foreground/50">
						Memuat QR Code...
					</div>
				{/if}
			</div>

			<p class="text-[11px] text-foreground/60 max-w-xs mx-auto leading-relaxed">
				Tunjukkan kartu QR ini saat berada di tempat pengajian apabila pengurus kelompok menggunakan pemindai QR langsung.
			</p>
		</div>
	{/if}
</div>
