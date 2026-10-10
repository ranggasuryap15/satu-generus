<!--
  @file src/lib/components/LocationPicker.svelte
  @purpose Komponen pemilih lokasi presensi interaktif dengan pinpoint draggable (geser-geser), pencarian tempat via geocoding, dan parser link Google Maps
  @usedBy Halaman admin presensi ('/admin/presensi') saat membuat jadwal kegiatan pengajian
  @dependencies leaflet, @lucide/svelte, Svelte 5 Runes ($state, $props, $bindable, $effect)
  @publicFunctions searchPlace, applyGmapsUrl, setCoords, useCurrentLocation
  @sideEffects Menginisialisasi Leaflet map di DOM, fetch API Nominatim OSM, fetch /api/parse-maps, HTML5 Geolocation API
-->
<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import {
		Compass,
		ExternalLink,
		Link as LinkIcon,
		Loader2,
		MapPin,
		Navigation,
		RotateCcw,
		Search,
		Sliders,
		X
	} from '@lucide/svelte';

	interface Props {
		latitude?: string;
		longitude?: string;
		lokasiNama?: string;
		radiusMeter?: number;
		gmapsUrl?: string;
		class?: string;
	}

	let {
		latitude = $bindable(''),
		longitude = $bindable(''),
		lokasiNama = $bindable(''),
		radiusMeter = $bindable(100),
		gmapsUrl = $bindable(''),
		class: className = ''
	}: Props = $props();

	// Default center: Indonesia (Jakarta Pusat) jika belum ada koordinat
	const DEFAULT_LAT = -6.2088;
	const DEFAULT_LNG = 106.8456;

	let mapContainer: HTMLDivElement | null = $state(null);
	let mapInstance: any = null;
	let markerInstance: any = null;
	let circleInstance: any = null;
	let L: any = null;

	// State Tab Mode Input Lokasi
	let activeInputMode = $state<'search' | 'gmaps' | 'coords'>('search');

	// State Pencarian Tempat
	let searchQuery = $state('');
	let isSearching = $state(false);
	let searchResults = $state<Array<{ display_name: string; lat: string; lon: string }>>([]);
	let searchError = $state('');

	// State Link Google Maps
	let inputGmapsUrl = $state('');
	let isParsingGmaps = $state(false);
	let gmapsError = $state('');
	let gmapsSuccess = $state('');

	// State Geolocation
	let isLocating = $state(false);
	let locationStatus = $state('');

	onMount(async () => {
		if (typeof window === 'undefined' || !mapContainer) return;

		try {
			// Dynamic import Leaflet agar aman dari SSR error
			const leafletModule = await import('leaflet');
			L = leafletModule.default || leafletModule;
			await import('leaflet/dist/leaflet.css');

			const initialLat = latitude ? parseFloat(latitude) : DEFAULT_LAT;
			const initialLng = longitude ? parseFloat(longitude) : DEFAULT_LNG;
			const hasInitialCoords = Boolean(latitude && longitude);

			mapInstance = L.map(mapContainer, {
				center: [initialLat, initialLng],
				zoom: hasInitialCoords ? 17 : 13,
				zoomControl: true
			});

			// Tile OpenStreetMap
			L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
				maxZoom: 19,
				attribution: '&copy; OpenStreetMap'
			}).addTo(mapInstance);

			// Custom Pin Icon SVG yang modern & jelas di dark mode (tidak ada 404 image Leaflet)
			const customIcon = L.divIcon({
				className: 'custom-pin-marker',
				html: `
					<div style="transform: translate(-50%, -100%); display: flex; flex-direction: column; align-items: center; cursor: grab;">
						<div style="background: #05A875; color: white; width: 34px; height: 34px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 14px rgba(0,0,0,0.35); border: 2.5px solid white;">
							<div style="width: 10px; height: 10px; background: white; border-radius: 50%;"></div>
						</div>
						<div style="width: 12px; height: 4px; background: rgba(0,0,0,0.3); border-radius: 50%; filter: blur(1.5px); margin-top: 2px;"></div>
					</div>
				`,
				iconSize: [34, 42],
				iconAnchor: [17, 42]
			});

			// Inisialisasi Marker Draggable (Bisa digeser-geser langsung oleh admin)
			markerInstance = L.marker([initialLat, initialLng], {
				draggable: true,
				icon: customIcon
			}).addTo(mapInstance);

			// Lingkaran Toleransi Radius Presensi
			circleInstance = L.circle([initialLat, initialLng], {
				radius: radiusMeter || 100,
				color: '#05A875',
				fillColor: '#05A875',
				fillOpacity: 0.15,
				weight: 1.5
			}).addTo(mapInstance);

			// Event saat marker digeser (dragend)
			markerInstance.on('dragend', () => {
				const pos = markerInstance.getLatLng();
				updateCoordinates(pos.lat, pos.lng);
				circleInstance.setLatLng(pos);
			});

			// Event saat area peta diklik
			mapInstance.on('click', (e: any) => {
				markerInstance.setLatLng(e.latlng);
				circleInstance.setLatLng(e.latlng);
				updateCoordinates(e.latlng.lat, e.latlng.lng);
			});

			// Fix rendering tile saat modal terbuka
			setTimeout(() => {
				mapInstance?.invalidateSize();
			}, 300);
		} catch (err) {
			console.error('Error saat inisialisasi peta Leaflet:', err);
		}
	});

	onDestroy(() => {
		if (mapInstance) {
			mapInstance.remove();
			mapInstance = null;
		}
	});

	function updateCoordinates(latNum: number, lngNum: number) {
		latitude = latNum.toFixed(6);
		longitude = lngNum.toFixed(6);
		locationStatus = `Titik terpilih: ${latitude}, ${longitude}`;
	}

	function moveMapTo(latNum: number, lngNum: number, zoomLevel = 17) {
		if (!mapInstance || !markerInstance || !circleInstance) return;
		mapInstance.flyTo([latNum, lngNum], zoomLevel, { duration: 1.2 });
		markerInstance.setLatLng([latNum, lngNum]);
		circleInstance.setLatLng([latNum, lngNum]);
		circleInstance.setRadius(radiusMeter || 100);
		updateCoordinates(latNum, lngNum);
	}

	// Update radius visual saat nilai radiusMeter berubah
	$effect(() => {
		if (circleInstance && radiusMeter) {
			circleInstance.setRadius(radiusMeter);
		}
	});

	// 1. Pencarian Tempat (Geocoding via Nominatim OpenStreetMap)
	async function searchPlace() {
		const q = searchQuery.trim();
		if (!q) return;

		isSearching = true;
		searchError = '';
		searchResults = [];

		try {
			const res = await fetch(
				`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5&addressdetails=1`,
				{
					headers: {
						'Accept-Language': 'id,en;q=0.9'
					}
				}
			);
			if (!res.ok) throw new Error('Gagal menghubungi layanan pencarian tempat.');
			const data = await res.json();
			if (Array.isArray(data) && data.length > 0) {
				searchResults = data;
			} else {
				searchError = 'Tidak ditemukan lokasi yang cocok. Coba kata kunci lain atau masukkan link Google Maps.';
			}
		} catch (err: any) {
			searchError = err?.message || 'Terjadi kesalahan saat mencari lokasi.';
		} finally {
			isSearching = false;
		}
	}

	function selectSearchResult(item: { display_name: string; lat: string; lon: string }) {
		const lat = parseFloat(item.lat);
		const lng = parseFloat(item.lon);
		moveMapTo(lat, lng, 17);

		// Jika nama lokasi belum diisi admin, gunakan nama pertama dari hasil pencarian
		if (!lokasiNama) {
			lokasiNama = item.display_name.split(',')[0].trim();
		}

		searchResults = [];
		searchQuery = item.display_name.split(',')[0].trim();
	}

	// 2. Parser Link Google Maps
	async function applyGmapsUrl() {
		const link = inputGmapsUrl.trim();
		if (!link) {
			gmapsError = 'Silakan masukkan link atau koordinat Google Maps.';
			return;
		}

		isParsingGmaps = true;
		gmapsError = '';
		gmapsSuccess = '';

		try {
			const res = await fetch('/api/parse-maps', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ url: link })
			});
			const result = await res.json();

			if (!res.ok || !result.success) {
				gmapsError = result.error || 'Gagal mengekstrak koordinat dari link tersebut.';
				return;
			}

			moveMapTo(result.lat, result.lng, 17);
			gmapsUrl = link;
			gmapsSuccess = `Berhasil diarahkan ke koordinat: ${result.lat.toFixed(6)}, ${result.lng.toFixed(6)}`;
		} catch (err: any) {
			gmapsError = err?.message || 'Terjadi gangguan jaringan saat memproses link Google Maps.';
		} finally {
			isParsingGmaps = false;
		}
	}

	// 3. Gunakan Lokasi Saat Ini (GPS Browser)
	function useCurrentLocation() {
		if (!navigator.geolocation) {
			locationStatus = 'Peramban tidak mendukung GPS.';
			return;
		}

		isLocating = true;
		locationStatus = 'Mendeteksi koordinat GPS perangkat Anda...';

		navigator.geolocation.getCurrentPosition(
			(pos) => {
				isLocating = false;
				moveMapTo(pos.coords.latitude, pos.coords.longitude, 18);
				locationStatus = `GPS terdeteksi (akurasi ±${Math.round(pos.coords.accuracy)}m). Pin bisa digeser.`;
			},
			(err) => {
				isLocating = false;
				locationStatus = 'Gagal mengakses GPS: ' + err.message;
			},
			{ enableHighAccuracy: true, timeout: 10000 }
		);
	}

	// Buka Google Maps titik saat ini di tab baru
	const currentGmapsExternalLink = $derived(
		latitude && longitude
			? `https://www.google.com/maps?q=${latitude},${longitude}`
			: ''
	);
</script>

<div class="space-y-3.5 {className}">
	<!-- Input Tersembunyi untuk Native Form Submission -->
	<input type="hidden" name="latitude" value={latitude} />
	<input type="hidden" name="longitude" value={longitude} />
	<input type="hidden" name="gmapsUrl" value={gmapsUrl} />

	<!-- Bagian 1: Nama Tempat & Alamat Acara -->
	<div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
		<div class="sm:col-span-2">
			<label for="lokasiNama" class="block text-xs font-semibold text-foreground mb-1">
				Nama Lokasi / Tempat Kegiatan *
			</label>
			<div class="relative">
				<MapPin class="w-3.5 h-3.5 text-primary absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
				<input
					id="lokasiNama"
					name="lokasiNama"
					type="text"
					bind:value={lokasiNama}
					required
					placeholder="Contoh: Masjid Baitul Makmur / Rumah Bpk. H. Ahmad"
					class="w-full bg-secondary/50 border border-border rounded-lg pl-8 pr-3 py-2 text-xs text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary focus:bg-background"
				/>
			</div>
		</div>

		<div>
			<label for="radiusMeter" class="block text-xs font-semibold text-foreground mb-1">
				Radius Toleransi Presensi *
			</label>
			<div class="relative">
				<input
					id="radiusMeter"
					name="radiusMeter"
					type="number"
					min="20"
					max="5000"
					step="10"
					bind:value={radiusMeter}
					required
					class="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:bg-background"
				/>
				<span class="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-foreground/50 pointer-events-none">
					meter
				</span>
			</div>
		</div>
	</div>

	<!-- Bagian 2: Tab Alat Penentuan Lokasi (Cari Tempat, Link Google Maps, atau Koordinat Langsung) -->
	<div class="bg-card border border-border rounded-xl p-3 shadow-xs space-y-3">
		<div class="flex items-center justify-between gap-2 border-b border-border/70 pb-2.5">
			<span class="text-xs font-bold text-foreground flex items-center gap-1.5">
				<Compass class="w-4 h-4 text-primary" />
				<span>Tentukan Titik Koordinat:</span>
			</span>

			<div class="flex items-center gap-1 text-[11px]">
				<button
					type="button"
					onclick={() => (activeInputMode = 'search')}
					class="px-2.5 py-1 rounded-md font-semibold transition-colors {activeInputMode === 'search'
						? 'bg-primary text-primary-foreground'
						: 'bg-secondary/60 text-foreground/70 hover:bg-secondary'}"
				>
					Cari Tempat
				</button>
				<button
					type="button"
					onclick={() => (activeInputMode = 'gmaps')}
					class="px-2.5 py-1 rounded-md font-semibold transition-colors {activeInputMode === 'gmaps'
						? 'bg-primary text-primary-foreground'
						: 'bg-secondary/60 text-foreground/70 hover:bg-secondary'}"
				>
					Link Google Maps
				</button>
				<button
					type="button"
					onclick={useCurrentLocation}
					disabled={isLocating}
					class="px-2.5 py-1 rounded-md font-semibold bg-secondary/60 hover:bg-secondary text-primary transition-colors inline-flex items-center gap-1"
					title="Gunakan posisi GPS admin saat ini"
				>
					{#if isLocating}
						<Loader2 class="w-3 h-3 animate-spin" />
					{:else}
						<Navigation class="w-3 h-3" />
					{/if}
					<span>GPS Saya</span>
				</button>
			</div>
		</div>

		<!-- Panel 1: Cari Nama Tempat (Geocoding) -->
		{#if activeInputMode === 'search'}
			<div class="space-y-2">
				<form
					onsubmit={(e) => {
						e.preventDefault();
						searchPlace();
					}}
					class="flex items-center gap-2"
				>
					<div class="relative flex-1">
						<Search class="w-3.5 h-3.5 text-foreground/40 absolute left-3 top-1/2 -translate-y-1/2" />
						<input
							type="search"
							bind:value={searchQuery}
							placeholder="Ketik nama masjid, jalan, gedung, atau kelurahan..."
							class="w-full bg-secondary/50 border border-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary focus:bg-background"
						/>
					</div>
					<button
						type="submit"
						disabled={isSearching || !searchQuery.trim()}
						class="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 inline-flex items-center gap-1"
					>
						{#if isSearching}
							<Loader2 class="w-3 h-3 animate-spin" />
						{:else}
							<Search class="w-3 h-3" />
						{/if}
						<span>Cari</span>
					</button>
				</form>

				{#if searchError}
					<p class="text-[11px] text-destructive">{searchError}</p>
				{/if}

				{#if searchResults.length > 0}
					<div class="max-h-40 overflow-y-auto rounded-lg border border-border bg-secondary/30 p-1 divide-y divide-border/50 text-xs">
						{#each searchResults as res}
							<button
								type="button"
								onclick={() => selectSearchResult(res)}
								class="w-full text-left p-2 hover:bg-primary/10 hover:text-primary transition-colors rounded-md text-[11.5px] flex items-start gap-2"
							>
								<MapPin class="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
								<span class="line-clamp-2">{res.display_name}</span>
							</button>
						{/each}
					</div>
				{/if}
			</div>
		{/if}

		<!-- Panel 2: Paste Link Google Maps -->
		{#if activeInputMode === 'gmaps'}
			<div class="space-y-2">
				<form
					onsubmit={(e) => {
						e.preventDefault();
						applyGmapsUrl();
					}}
					class="flex items-center gap-2"
				>
					<div class="relative flex-1">
						<LinkIcon class="w-3.5 h-3.5 text-foreground/40 absolute left-3 top-1/2 -translate-y-1/2" />
						<input
							type="text"
							bind:value={inputGmapsUrl}
							placeholder="Paste link: https://maps.app.goo.gl/... atau koordinat: -6.2088, 106.8456"
							class="w-full bg-secondary/50 border border-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary focus:bg-background"
						/>
					</div>
					<button
						type="submit"
						disabled={isParsingGmaps || !inputGmapsUrl.trim()}
						class="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 inline-flex items-center gap-1 shrink-0"
					>
						{#if isParsingGmaps}
							<Loader2 class="w-3 h-3 animate-spin" />
						{/if}
						<span>Terapkan</span>
					</button>
				</form>

				{#if gmapsError}
					<p class="text-[11px] text-destructive">{gmapsError}</p>
				{/if}
				{#if gmapsSuccess}
					<p class="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">{gmapsSuccess}</p>
				{/if}
			</div>
		{/if}

		<!-- Petunjuk Geser Pinpoint di Peta -->
		<div class="flex items-center justify-between text-[11px] text-foreground/60 bg-secondary/30 p-2 rounded-lg">
			<div class="flex items-center gap-1.5">
				<span class="inline-block w-2 h-2 rounded-full bg-primary animate-pulse"></span>
				<span>
					<strong>Tips:</strong> Klik peta atau <strong>geser-geser pin hijau</strong> untuk mengatur titik presisi.
				</span>
			</div>

			{#if latitude && longitude}
				<div class="font-mono text-foreground/80 font-medium">
					{latitude}, {longitude}
				</div>
			{/if}
		</div>

		<!-- Kontainer Peta Interaktif Leaflet -->
		<div class="relative rounded-xl overflow-hidden border border-border shadow-inner">
			<div
				bind:this={mapContainer}
				class="w-full h-56 sm:h-64 z-10 bg-secondary/40"
			></div>

			<!-- Status Bar Koordinat Terpilih di Bawah Peta -->
			<div class="absolute bottom-2 left-2 right-2 z-20 pointer-events-none flex items-center justify-between gap-2">
				<div class="bg-card/90 backdrop-blur-md border border-border/80 px-2.5 py-1 rounded-lg shadow-md text-[10.5px] font-mono text-foreground flex items-center gap-1.5">
					<MapPin class="w-3 h-3 text-primary" />
					{#if latitude && longitude}
						<span>Lat: {latitude} | Lng: {longitude} (Radius {radiusMeter}m)</span>
					{:else}
						<span class="text-foreground/50">Geser pin untuk menentukan titik</span>
					{/if}
				</div>

				{#if currentGmapsExternalLink}
					<a
						href={currentGmapsExternalLink}
						target="_blank"
						rel="noopener noreferrer"
						class="pointer-events-auto bg-card/90 backdrop-blur-md border border-border/80 hover:bg-card px-2.5 py-1 rounded-lg shadow-md text-[10.5px] font-medium text-primary inline-flex items-center gap-1 transition-colors"
					>
						<span>Buka Google Maps</span>
						<ExternalLink class="w-3 h-3" />
					</a>
				{/if}
			</div>
		</div>
	</div>
</div>
