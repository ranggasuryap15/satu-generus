<!--
  @file src/routes/(app)/presensi/+page.svelte
  @purpose Tampilan presensi jamaah: Kartu QR Code unik dan riwayat jadwal pengajian (Mobile-First)
  @usedBy Route client '/presensi'
  @dependencies qrcode, @lucide/svelte, $lib/utils (formatDateDDMMYYYY), Svelte 5 Runes
  @publicFunctions N/A (Svelte Component)
  @sideEffects Men-generate gambar QR Code secara client-side pada kanvas/gambar
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import QRCode from 'qrcode';
	import { QrCode, Calendar, CheckCircle2, Clock, XCircle, AlertCircle } from '@lucide/svelte';
	import type { PageData } from './$types';
	import { formatDateDDMMYYYY } from '$lib/utils';

	let { data } = $props<{ data: PageData }>();

	let activeTab = $state<'qr' | 'jadwal'>('qr');
	let qrCodeUrl = $state('');

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
	});
</script>

<svelte:head>
	<title>Presensi Pengajian - Satu Generus</title>
</svelte:head>

<div class="space-y-5">
	<div>
		<h2 class="text-lg font-bold text-foreground tracking-tight">Presensi Pengajian</h2>
		<p class="text-xs text-foreground/60">{data.kelompokNama} • Tunjukkan QR ke Pengurus</p>
	</div>

	<!-- Tab Switcher -->
	<div class="flex p-1 bg-secondary rounded-xl">
		<button
			type="button"
			onclick={() => (activeTab = 'qr')}
			class="flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-2 {activeTab ===
			'qr'
				? 'bg-card text-foreground shadow-sm'
				: 'text-foreground/60 hover:text-foreground'}"
		>
			<QrCode class="w-4 h-4" />
			<span>Kartu QR Saya</span>
		</button>
		<button
			type="button"
			onclick={() => (activeTab = 'jadwal')}
			class="flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-2 {activeTab ===
			'jadwal'
				? 'bg-card text-foreground shadow-sm'
				: 'text-foreground/60 hover:text-foreground'}"
		>
			<Calendar class="w-4 h-4" />
			<span>Jadwal & Riwayat</span>
		</button>
	</div>

	{#if activeTab === 'qr'}
		<!-- Kartu QR Code Jamaah -->
		<div class="bg-card border border-border rounded-2xl p-6 text-center shadow-sm space-y-4">
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
				Tunjukkan kartu kode QR ini saat tiba di lokasi pengajian untuk dipindai oleh admin kelompok.
			</p>
		</div>
	{:else}
		<!-- Daftar Jadwal & Status Kehadiran -->
		<div class="space-y-3">
			<h3 class="text-xs font-semibold uppercase tracking-wider text-foreground/70 px-1">
				Aktivitas Pengajian ({data.jadwalList.length})
			</h3>

			{#if data.jadwalList.length === 0}
				<div class="bg-card border border-border rounded-xl p-8 text-center text-xs text-foreground/50">
					Belum ada jadwal kegiatan untuk kelompok ini.
				</div>
			{:else}
				<div class="space-y-2.5">
					{#each data.jadwalList as item}
						<div class="bg-card border border-border rounded-xl p-4 shadow-sm flex items-center justify-between">
							<div class="space-y-1">
								<h4 class="text-xs font-semibold text-foreground">{item.namaKegiatan}</h4>
								<div class="flex items-center gap-1.5 text-[11px] text-foreground/50">
									<Clock class="w-3.5 h-3.5" />
									<span>{formatDateDDMMYYYY(item.tanggal)}</span>
								</div>
							</div>

							<div>
								{#if item.statusKehadiran === 'Hadir'}
									<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-primary/10 text-primary">
										<CheckCircle2 class="w-3.5 h-3.5" />
										Hadir
									</span>
								{:else if item.statusKehadiran === 'Izin' || item.statusKehadiran === 'Sakit'}
									<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-accent/20 text-accent">
										<AlertCircle class="w-3.5 h-3.5" />
										{item.statusKehadiran}
									</span>
								{:else if item.statusKehadiran === 'Alpa'}
									<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-destructive/10 text-destructive">
										<XCircle class="w-3.5 h-3.5" />
										Alpa
									</span>
								{:else}
									<span class="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-medium bg-secondary text-foreground/60">
										Belum Presensi
									</span>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>

