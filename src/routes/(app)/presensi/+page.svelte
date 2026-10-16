<!--
  @file src/routes/(app)/presensi/+page.svelte
  @purpose Halaman presensi mandiri jamaah (tingkat kelompok & desa; Hadir Offline/Online, Izin/Sakit, Riwayat, Kartu QR) sesuai konsep Flat Design Minimalist yang di-upsize: Header Hijau Melengkung terintegrasi, Switcher Mode Admin ⇄ Jamaah, Floating 4-Tab Bar, card dark slate, input dan tombol semantik
  @usedBy Route client '/presensi'
  @dependencies qrcode, @lucide/svelte, $app/forms, $app/state (page), #lib/utils (formatDateDDMMYYYY), #lib/components/ThemeToggle.svelte, Svelte 5 Runes
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
		ArrowLeft,
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
		SendHorizontal,
		ShieldAlert,
		Sparkles,
		Upload,
		UserCheck,
		X,
		XCircle
	} from '@lucide/svelte';
	import { page } from '$app/state';
	import ThemeToggle from '#lib/components/ThemeToggle.svelte';
	import type { ActionData, PageData } from './$types';
	import { formatDateDDMMYYYY } from '#lib/utils.js';

	let { data, form } = $props<{ data: PageData; form: ActionData }>();

	const isAdmin = $derived(Boolean(page.data.isAdmin));

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

	// State Bukti Foto Hadir
	let fotoDataUrl = $state<string>('');
	let fotoFileName = $state<string>('');

	// State Pengajuan Izin
	let izinJadwalId = $state<number | string>(data.defaultJadwalId || data.activeJadwalList[0]?.id || '');
	let izinStatus = $state<'Izin' | 'Sakit'>('Izin');
	let izinAlasan = $state('');
	let izinFotoDataUrl = $state('');
	let izinFotoFileName = $state('');

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
						locationError = 'Akses lokasi ditolak. Harap izinkan akses lokasi di browser ponsel Anda.';
						break;
					case err.POSITION_UNAVAILABLE:
						locationError = 'Informasi lokasi tidak tersedia. Pastikan GPS aktif.';
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

		if (targetType === 'hadir') {
			fotoFileName = file.name;
		} else {
			izinFotoFileName = file.name;
		}

		const reader = new FileReader();
		reader.onload = (event) => {
			const img = new Image();
			img.onload = () => {
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
					dark: '#166534',
					light: '#FFFFFF'
				}
			});
		} catch (err) {
			console.error('Gagal generate QR Code:', err);
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
			izinFotoFileName = '';
		}
	});
</script>

<svelte:head>
	<title>Presensi Pengajian - Satu Generus</title>
</svelte:head>

<div class="space-y-4">
	<!-- 1. Header Hijau Melengkung Terintegrasi (Top Bar, Judul, Subtitle, ThemeToggle, Switcher Mode) -->
	<header class="bg-[#166534] dark:bg-[#14532D] text-white px-5 pt-5 pb-14 rounded-b-[32px] shadow-sm">
		<div class="flex items-center justify-between mb-3.5">
			<a
				href="/"
				class="p-2 -ml-1 text-white/90 hover:text-white rounded-xl hover:bg-white/15 transition-colors cursor-pointer"
				title="Kembali ke Beranda"
			>
				<ArrowLeft class="w-6 h-6" />
			</a>

			<div class="flex items-center gap-2">
				{#if isAdmin}
					<a
						href="/admin"
						class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 hover:bg-white/30 text-white text-xs sm:text-sm font-bold border border-white/30 backdrop-blur-xs transition-all active:scale-95 shadow-xs"
						title="Beralih ke Panel Pengurus/Admin"
					>
						<span class="w-2 h-2 rounded-full bg-emerald-300 animate-pulse"></span>
						<span>⇄ Admin</span>
					</a>
				{/if}
				<ThemeToggle />
			</div>
		</div>

		<div class="space-y-1">
			<div class="flex items-center gap-2 flex-wrap">
				<h1 class="text-2xl sm:text-3xl font-black tracking-tight text-white">
					Presensi Pengajian
				</h1>
				<span class="px-3 py-0.5 rounded-full text-xs sm:text-sm font-bold bg-white/20 text-white backdrop-blur-xs">
					Jamaah
				</span>
			</div>
			<p class="text-xs sm:text-sm text-white/90 font-medium">
				{data.kelompokNama} · {data.user.namaLengkap}
			</p>
		</div>
	</header>

	<!-- 2. Floating 4-Tab Bar (Upsized & Overlapping Header) -->
	<div class="-mt-9 px-4">
		<div class="bg-[#1E293B] border border-slate-700/60 rounded-3xl p-2 shadow-lg grid grid-cols-4 gap-1.5 text-center">
			<button
				type="button"
				onclick={() => (activeTab = 'hadir')}
				class="py-2.5 rounded-2xl transition-all flex flex-col items-center gap-1 text-xs sm:text-sm cursor-pointer {activeTab === 'hadir'
					? 'border border-emerald-500 bg-emerald-500/15 text-emerald-400 font-bold shadow-xs'
					: 'text-slate-400 hover:text-slate-200 font-semibold'}"
			>
				<UserCheck class="w-5 h-5" />
				<span>Hadir</span>
			</button>

			<button
				type="button"
				onclick={() => (activeTab = 'izin')}
				class="py-2.5 rounded-2xl transition-all flex flex-col items-center gap-1 text-xs sm:text-sm cursor-pointer {activeTab === 'izin'
					? 'border border-emerald-500 bg-emerald-500/15 text-emerald-400 font-bold shadow-xs'
					: 'text-slate-400 hover:text-slate-200 font-semibold'}"
			>
				<FileText class="w-5 h-5" />
				<span>Izin/Sakit</span>
			</button>

			<button
				type="button"
				onclick={() => (activeTab = 'riwayat')}
				class="py-2.5 rounded-2xl transition-all flex flex-col items-center gap-1 text-xs sm:text-sm cursor-pointer {activeTab === 'riwayat'
					? 'border border-emerald-500 bg-emerald-500/15 text-emerald-400 font-bold shadow-xs'
					: 'text-slate-400 hover:text-slate-200 font-semibold'}"
			>
				<Clock class="w-5 h-5" />
				<span>Riwayat</span>
			</button>

			<button
				type="button"
				onclick={() => (activeTab = 'qr')}
				class="py-2.5 rounded-2xl transition-all flex flex-col items-center gap-1 text-xs sm:text-sm cursor-pointer {activeTab === 'qr'
					? 'border border-emerald-500 bg-emerald-500/15 text-emerald-400 font-bold shadow-xs'
					: 'text-slate-400 hover:text-slate-200 font-semibold'}"
			>
				<QrCode class="w-5 h-5" />
				<span>Kartu QR</span>
			</button>
		</div>
	</div>

	<!-- Notifikasi Pesan Feedback Server -->
	{#if form?.error || form?.success}
		<div class="px-4">
			{#if form?.error}
				<div class="p-3 bg-rose-950/40 border border-rose-800/40 text-rose-300 text-xs font-semibold rounded-xl flex items-center gap-2">
					<AlertCircle class="w-4 h-4 shrink-0" />
					<span>{form.error}</span>
				</div>
			{/if}
			{#if form?.success}
				<div class="p-3 bg-emerald-950/40 border border-emerald-800/40 text-emerald-300 text-xs font-semibold rounded-xl flex items-center gap-2">
					<CheckCircle2 class="w-4 h-4 shrink-0" />
					<span>{form.message || 'Presensi Berhasil'}</span>
				</div>
			{/if}
		</div>
	{/if}

	<!-- ============================================================== -->
	<!-- TAB 1: PRESENSI HADIR (Image 4) -->
	<!-- ============================================================== -->
	{#if activeTab === 'hadir'}
		<div class="px-4">
			<div class="bg-[#1E293B] border border-slate-700/60 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
				<h2 class="text-sm sm:text-base font-bold text-slate-100">
					Presensi Hadir
				</h2>

				<form
					method="POST"
					action="?/presensiMandiri"
					use:enhance={async ({ cancel }) => {
						if (!selectedJadwalId) {
							await confirmAction({
								title: 'Data Belum Lengkap',
								message: 'Pilih kegiatan pengajian terlebih dahulu.',
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
								message: 'Lokasi GPS belum terdeteksi. Silakan klik tombol "Ulang" terlebih dahulu.',
								confirmText: 'Mengerti',
								cancelText: '',
								variant: 'warning'
							});
							cancel();
							return;
						}
						if (metodeKehadiran === 'offline' && !effectiveVenue.hasLocation) {
							await confirmAction({
								title: 'Lokasi Belum Diset',
								message: 'Titik lokasi kegiatan belum didaftarkan oleh admin. Silakan beralih ke metode Online.',
								confirmText: 'Mengerti',
								cancelText: '',
								variant: 'warning'
							});
							cancel();
							return;
						}
						if (!fotoDataUrl) {
							await confirmAction({
								title: 'Foto Wajib Diambil',
								message: metodeKehadiran === 'offline'
									? 'Wajib mengambil foto kamera langsung di lokasi pengajian!'
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

					<!-- Pilihan Kegiatan Pengajian -->
					<div>
						<div class="flex items-center justify-between mb-1.5">
							<label for="jadwalSelect" class="block font-semibold text-slate-300">
								Kegiatan
							</label>
							<a
								href="/jadwal?from=presensi"
								class="text-[11px] font-semibold text-emerald-400 hover:underline inline-flex items-center gap-0.5"
							>
								<span>Jadwal Sebulan</span>
								<ChevronRight class="w-3 h-3" />
							</a>
						</div>

						{#if data.activeJadwalList.length === 0}
							<div class="p-3 rounded-xl bg-[#0F172A] border border-slate-700/60 text-center space-y-1.5">
								<p class="text-xs text-slate-400">
									Tidak ada kegiatan pengajian aktif hari ini (rentang kemarin - besok).
								</p>
								<a
									href="/jadwal?from=presensi"
									class="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 hover:underline"
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
								class="w-full bg-[#0F172A] border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
							>
								{#each data.activeJadwalList as j}
									<option value={j.id}>
										{j.isDesaScope ? '[Desa] ' : ''}{j.namaKegiatan} · {formatDateDDMMYYYY(j.tanggal)}{j.jamMulai ? ` · ${j.jamMulai}` : ''}{j.bisaPresensi === false ? ' (Ditutup)' : ''}
									</option>
								{/each}
							</select>
						{/if}
					</div>

					<!-- Status Waktu Jika Ditutup (Amber Banner with Clock Icon) -->
					{#if selectedJadwal && selectedJadwal.bisaPresensi === false}
						<div class="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-medium flex items-center gap-2">
							<Clock class="w-4 h-4 shrink-0 text-amber-400" />
							<span>{selectedJadwal.pesanStatusWaktu || 'Presensi ditutup'}</span>
						</div>
					{/if}

					<!-- Pilihan Metode Kehadiran -->
					<div>
						<label class="block font-semibold text-slate-300 mb-1.5">
							Metode
						</label>
						<div class="grid grid-cols-2 gap-2">
							<!-- Tombol Offline -->
							<button
								type="button"
								onclick={() => {
									metodeKehadiran = 'offline';
									if (!latitude) captureLocation();
								}}
								class="p-2.5 rounded-xl border text-center transition-all cursor-pointer flex items-center justify-center gap-1.5 {metodeKehadiran === 'offline'
									? 'border-emerald-500 bg-emerald-500/10 text-emerald-400 font-bold'
									: 'border-slate-700 bg-[#0F172A] text-slate-400 hover:text-slate-200 font-medium'}"
							>
								<MapPin class="w-4 h-4" />
								<span class="text-xs">Offline</span>
							</button>

							<!-- Tombol Online -->
							<button
								type="button"
								onclick={() => (metodeKehadiran = 'online')}
								class="p-2.5 rounded-xl border text-center transition-all cursor-pointer flex items-center justify-center gap-1.5 {metodeKehadiran === 'online'
									? 'border-emerald-500 bg-emerald-500/10 text-emerald-400 font-bold'
									: 'border-slate-700 bg-[#0F172A] text-slate-400 hover:text-slate-200 font-medium'}"
							>
								<Globe class="w-4 h-4" />
								<span class="text-xs">Online</span>
							</button>
						</div>
					</div>

					<!-- Bagian Deteksi Lokasi GPS (Khusus Hadir Offline) -->
					{#if metodeKehadiran === 'offline'}
						<div class="p-3 rounded-xl bg-[#0F172A] border border-slate-700/60 space-y-2">
							<div class="flex items-center justify-between">
								<span class="font-semibold text-slate-200 flex items-center gap-1.5 text-xs">
									<MapPin class="w-3.5 h-3.5 text-emerald-400" />
									<span>Lokasi Anda</span>
								</span>
								<button
									type="button"
									onclick={captureLocation}
									disabled={isLocating}
									class="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 hover:underline cursor-pointer"
								>
									{#if isLocating}
										<Loader2 class="w-3 h-3 animate-spin" />
										<span>Mencari...</span>
									{:else}
										<RefreshCw class="w-3 h-3" />
										<span>Ulang</span>
									{/if}
								</button>
							</div>

							{#if !effectiveVenue.hasLocation}
								<div class="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center justify-between gap-2">
									<span class="flex items-center gap-1.5 font-medium">
										<AlertCircle class="w-4 h-4 shrink-0" />
										Titik lokasi belum diset
									</span>
									<button
										type="button"
										onclick={() => (metodeKehadiran = 'online')}
										class="px-2.5 py-1 rounded-lg bg-sky-500 hover:bg-sky-600 text-white font-bold text-[11px] shrink-0 cursor-pointer"
									>
										Pindah Online
									</button>
								</div>
							{:else if latitude && longitude}
								{#if distanceToVenue !== null}
									{#if isWithinRadius}
										<div class="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-between text-xs font-semibold">
											<span class="flex items-center gap-1.5">
												<CheckCircle2 class="w-4 h-4 text-emerald-400 shrink-0" />
												<span>Lokasi Sesuai</span>
											</span>
											<span class="font-mono text-[11px] text-slate-400">~{distanceToVenue}m</span>
										</div>
									{:else}
										<div class="p-2.5 rounded-lg bg-rose-950/40 border border-rose-800/40 text-rose-300 flex items-center justify-between gap-2 text-xs font-semibold">
											<span class="flex items-center gap-1.5 min-w-0">
												<AlertCircle class="w-4 h-4 shrink-0" />
												<span class="truncate">Di Luar Jangkauan (~{distanceToVenue}m)</span>
											</span>
											<button
												type="button"
												onclick={() => (metodeKehadiran = 'online')}
												class="px-2.5 py-1 rounded-lg bg-sky-500 hover:bg-sky-600 text-white font-bold text-[11px] shrink-0 cursor-pointer"
											>
												Pindah Online
											</button>
										</div>
									{/if}
								{:else}
									<div class="p-2 rounded-lg bg-slate-800/60 text-slate-300 text-xs flex items-center gap-1.5 font-mono">
										<span>Lat: {latitude}, Lng: {longitude}</span>
									</div>
								{/if}
							{:else}
								<div class="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center gap-1.5 font-medium">
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
								<p class="text-[11px] text-rose-400 leading-tight font-medium">
									{locationError}
								</p>
							{/if}
						</div>
					{/if}

					<!-- Bagian Ambil Foto Kamera / Unggah Bukti -->
					<div>
						<label class="block border-2 border-dashed border-slate-700/80 hover:border-emerald-500/50 rounded-2xl p-6 text-center space-y-2 cursor-pointer transition-colors bg-[#0F172A]/40">
							<input
								type="file"
								accept="image/*"
								capture={metodeKehadiran === 'offline' ? 'environment' : undefined}
								class="hidden"
								onchange={(e) => handleFotoChange(e, 'hadir')}
							/>
							<div class="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-400 mx-auto flex items-center justify-center">
								<Camera class="w-5 h-5" />
							</div>
							<span class="text-xs font-bold text-emerald-400 block">
								{fotoFileName ? fotoFileName : 'Ambil Foto'}
							</span>
						</label>

						{#if fotoDataUrl}
							<div class="mt-2 flex items-center justify-between p-2 rounded-xl bg-[#0F172A] border border-slate-700/60">
								<button
									type="button"
									onclick={() => openPreviewFoto(fotoDataUrl, 'Foto Bukti Presensi')}
									class="flex items-center gap-2 text-xs text-emerald-400 hover:underline cursor-pointer"
								>
									<ImageIcon class="w-4 h-4" />
									<span>Lihat Foto ({fotoFileName})</span>
								</button>
								<button
									type="button"
									onclick={() => {
										fotoDataUrl = '';
										fotoFileName = '';
									}}
									class="p-1 rounded-lg text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
								>
									<X class="w-4 h-4" />
								</button>
							</div>
						{/if}
					</div>

					<!-- Tombol Submit Presensi -->
					{#if selectedJadwal && selectedJadwal.bisaPresensi === false}
						<button
							type="button"
							disabled
							class="w-full py-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-not-allowed select-none opacity-90"
						>
							<Clock class="w-4 h-4" />
							<span>Presensi Ditutup (Dibuka 1 Jam Sebelum Acara)</span>
						</button>
					{:else if !selectedJadwal}
						<button
							type="button"
							disabled
							class="w-full py-3 rounded-xl bg-slate-800 text-slate-500 border border-slate-700 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-not-allowed"
						>
							<span>Tidak Ada Jadwal Pengajian Aktif</span>
						</button>
					{:else}
						<button
							type="submit"
							disabled={isSubmitting || (metodeKehadiran === 'offline' && (!isWithinRadius || !latitude || !effectiveVenue.hasLocation))}
							class="w-full py-3 rounded-xl bg-[#05A875] hover:bg-emerald-500 text-slate-950 font-bold text-xs shadow-md transition-all active:scale-98 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
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
		</div>

	<!-- ============================================================== -->
	<!-- TAB 2: IZIN / SAKIT (Image 5) -->
	<!-- ============================================================== -->
	{:else if activeTab === 'izin'}
		<div class="px-4">
			<div class="bg-[#1E293B] border border-slate-700/60 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
				<h2 class="text-sm sm:text-base font-bold text-slate-100">
					Izin / Sakit
				</h2>

				<form
					method="POST"
					action="?/ajukanIzin"
					use:enhance={async ({ cancel }) => {
						if (!izinJadwalId) {
							await confirmAction({
								title: 'Data Belum Lengkap',
								message: 'Pilih kegiatan pengajian terlebih dahulu.',
								confirmText: 'Mengerti',
								cancelText: '',
								variant: 'warning'
							});
							cancel();
							return;
						}
						if (!izinAlasan.trim()) {
							await confirmAction({
								title: 'Alasan Wajib Diisi',
								message: 'Tuliskan alasan permohonan izin/sakit Anda.',
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

					<!-- Pilihan Kegiatan Pengajian -->
					<div>
						<label for="izinJadwalSelect" class="block font-semibold text-slate-300 mb-1.5">
							Kegiatan
						</label>
						{#if data.activeJadwalList.length === 0}
							<div class="p-3 rounded-xl bg-[#0F172A] border border-slate-700/60 text-center text-xs text-slate-400">
								Tidak ada kegiatan pengajian aktif (rentang kemarin - besok) saat ini.
							</div>
						{:else}
							<select
								id="izinJadwalSelect"
								name="jadwalId"
								bind:value={izinJadwalId}
								required
								class="w-full bg-[#0F172A] border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
							>
								{#each data.activeJadwalList as j}
									<option value={j.id}>
										{j.isDesaScope ? '[Desa] ' : ''}{j.namaKegiatan} · {formatDateDDMMYYYY(j.tanggal)}{j.jamMulai ? ` · ${j.jamMulai}` : ''}
									</option>
								{/each}
							</select>
						{/if}
					</div>

					<!-- Jenis: Izin vs Sakit -->
					<div>
						<label class="block font-semibold text-slate-300 mb-1.5">
							Jenis
						</label>
						<div class="grid grid-cols-2 gap-2">
							<button
								type="button"
								onclick={() => (izinStatus = 'Izin')}
								class="py-2.5 rounded-xl border text-center font-bold text-xs transition-all cursor-pointer {izinStatus === 'Izin'
									? 'border-amber-500/80 bg-amber-500/10 text-amber-400'
									: 'border-slate-700 bg-[#0F172A] text-slate-400 hover:text-slate-200 font-medium'}"
							>
								Izin
							</button>
							<button
								type="button"
								onclick={() => (izinStatus = 'Sakit')}
								class="py-2.5 rounded-xl border text-center font-bold text-xs transition-all cursor-pointer {izinStatus === 'Sakit'
									? 'border-amber-500/80 bg-amber-500/10 text-amber-400'
									: 'border-slate-700 bg-[#0F172A] text-slate-400 hover:text-slate-200 font-medium'}"
							>
								Sakit
							</button>
						</div>
					</div>

					<!-- Alasan Permohonan -->
					<div>
						<label for="izinAlasanInput" class="block font-semibold text-slate-300 mb-1.5">
							Alasan
						</label>
						<textarea
							id="izinAlasanInput"
							name="alasan"
							bind:value={izinAlasan}
							rows="3"
							required
							placeholder="Tugas luar kota"
							class="w-full bg-[#0F172A] border border-slate-700 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500 placeholder:text-slate-500"
						></textarea>
					</div>

					<!-- Unggah Bukti (Opsional) -->
					<div>
						<label class="w-full border border-dashed border-slate-700 hover:border-slate-600 bg-[#0F172A]/50 py-3 rounded-xl text-xs text-slate-400 flex items-center justify-center gap-2 cursor-pointer transition-colors block text-center">
							<input
								type="file"
								accept="image/*"
								class="hidden"
								onchange={(e) => handleFotoChange(e, 'izin')}
							/>
							<div class="flex items-center justify-center gap-2">
								<Upload class="w-4 h-4 text-slate-400" />
								<span>{izinFotoFileName || 'Bukti (opsional)'}</span>
							</div>
						</label>

						{#if izinFotoDataUrl}
							<div class="mt-2 flex items-center justify-between p-2 rounded-xl bg-[#0F172A] border border-slate-700/60">
								<button
									type="button"
									onclick={() => openPreviewFoto(izinFotoDataUrl, 'Foto Bukti Surat/Izin')}
									class="flex items-center gap-2 text-xs text-amber-400 hover:underline cursor-pointer"
								>
									<ImageIcon class="w-4 h-4" />
									<span>Lihat Bukti ({izinFotoFileName})</span>
								</button>
								<button
									type="button"
									onclick={() => {
										izinFotoDataUrl = '';
										izinFotoFileName = '';
									}}
									class="p-1 rounded-lg text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
								>
									<X class="w-4 h-4" />
								</button>
							</div>
						{/if}
					</div>

					<!-- Tombol Kirim Permohonan (Solid Amber) -->
					<button
						type="submit"
						disabled={isSubmitting || !izinJadwalId}
						class="w-full py-3 rounded-xl bg-[#F59E0B] hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md flex items-center justify-center gap-2 transition-all active:scale-98 disabled:opacity-50 cursor-pointer"
					>
						{#if isSubmitting}
							<Loader2 class="w-4 h-4 animate-spin" />
							<span>Mengirim...</span>
						{:else}
							<SendHorizontal class="w-4 h-4" />
							<span>Kirim Permohonan</span>
						{/if}
					</button>
				</form>
			</div>
		</div>

	<!-- ============================================================== -->
	<!-- TAB 3: RIWAYAT KEHADIRAN -->
	<!-- ============================================================== -->
	{:else if activeTab === 'riwayat'}
		<div class="px-4">
			<div class="bg-[#1E293B] border border-slate-700/60 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
				<h2 class="text-sm sm:text-base font-bold text-slate-100">
					Riwayat Presensi
				</h2>

				{#if data.jadwalList.length === 0}
					<div class="border border-dashed border-slate-700 rounded-2xl p-8 text-center text-xs text-slate-400 space-y-2">
						<Clock class="w-8 h-8 mx-auto text-slate-500" />
						<p>Belum ada riwayat kegiatan pengajian yang tercatat.</p>
					</div>
				{:else}
					<div class="space-y-2.5">
						{#each data.jadwalList as item}
							<div class="p-3.5 rounded-xl bg-[#0F172A] border border-slate-700/60 space-y-2">
								<div class="flex items-center justify-between gap-2">
									<span class="text-xs font-bold text-slate-100">
										{formatDateDDMMYYYY(item.tanggal)}
									</span>
									<span class="px-2 py-0.5 rounded-full text-[10px] font-bold {item.statusKehadiran === 'Hadir'
										? 'bg-emerald-500/15 text-emerald-400'
										: item.statusKehadiran === 'Izin' || item.statusKehadiran === 'Sakit'
											? 'bg-amber-500/15 text-amber-400'
											: 'bg-slate-800 text-slate-400'}">
										{item.statusKehadiran}
									</span>
								</div>

								<h4 class="text-xs font-semibold text-slate-200">
									{item.namaKegiatan}
								</h4>

								<div class="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
									<span>{item.jamMulai}{item.jamSelesai ? ` - ${item.jamSelesai}` : ''} WIB</span>
									{#if item.fotoUrl}
										<button
											type="button"
											onclick={() => openPreviewFoto(item.fotoUrl!, item.namaKegiatan)}
											class="text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
										>
											<ImageIcon class="w-3.5 h-3.5" />
											<span>Foto</span>
										</button>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>

	<!-- ============================================================== -->
	<!-- TAB 4: KARTU QR PRESENSI -->
	<!-- ============================================================== -->
	{:else if activeTab === 'qr'}
		<div class="px-4">
			<div class="bg-[#1E293B] border border-slate-700/60 rounded-2xl p-6 shadow-xs text-center space-y-4">
				<h2 class="text-sm sm:text-base font-bold text-slate-100">
					Kartu QR Presensi
				</h2>
				<p class="text-xs text-slate-400 max-w-xs mx-auto">
					Tunjukkan QR Code ini kepada panitia / penerima tamu untuk dicatat secara otomatis.
				</p>

				<!-- QR Code Container -->
				<div class="py-2">
					{#if qrCodeUrl}
						<div class="inline-block p-4 bg-white rounded-2xl shadow-lg border-2 border-slate-700">
							<img src={qrCodeUrl} alt="QR Code Presensi" class="w-56 h-56 mx-auto rounded-lg" />
						</div>
					{:else}
						<div class="w-56 h-56 mx-auto rounded-2xl bg-slate-800 flex items-center justify-center">
							<Loader2 class="w-8 h-8 animate-spin text-slate-400" />
						</div>
					{/if}
				</div>

				<div class="p-3 rounded-xl bg-[#0F172A] border border-slate-700/60 max-w-xs mx-auto text-center space-y-0.5">
					<h3 class="text-xs font-bold text-slate-100">{data.user.namaLengkap}</h3>
					<p class="text-[11px] text-slate-400">{data.kelompokNama}</p>
				</div>
			</div>
		</div>
	{/if}
</div>

<!-- Modal Popup Preview Foto Bukti Presensi -->
{#if previewFotoUrl}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs animate-in fade-in duration-200"
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
		<div class="bg-[#1E293B] border border-slate-700 rounded-2xl max-w-sm w-full p-4 space-y-3 shadow-xl">
			<div class="flex items-center justify-between pb-2 border-b border-slate-700/60">
				<h4 class="text-xs font-bold text-slate-100 truncate pr-2">
					{previewFotoTitle || 'Foto Bukti'}
				</h4>
				<button
					type="button"
					onclick={closePreviewFoto}
					class="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
				>
					<X class="w-4 h-4" />
				</button>
			</div>

			<div class="overflow-hidden rounded-xl border border-slate-700/60 bg-black flex items-center justify-center max-h-[70vh]">
				<img src={previewFotoUrl} alt="Preview Foto Bukti" class="w-full h-auto object-contain" />
			</div>

			<button
				type="button"
				onclick={closePreviewFoto}
				class="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
			>
				Tutup
			</button>
		</div>
	</div>
{/if}

