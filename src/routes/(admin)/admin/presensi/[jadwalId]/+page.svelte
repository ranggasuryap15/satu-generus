<!--
  @file src/routes/(admin)/admin/presensi/[jadwalId]/+page.svelte
  @purpose Halaman checklist absensi jamaah per jadwal: verifikasi presensi mandiri (offline GPS + foto kamera, online SS SDC) dan modal peninjauan approval izin/sakit jamaah
  @usedBy Route admin '/admin/presensi/[jadwalId]'
  @dependencies @lucide/svelte, Svelte 5 Runes, $lib/utils (formatDateDDMMYYYY), $app/state (page)
  @publicFunctions N/A (Svelte Component)
  @sideEffects Mengirim form update status, approve izin, dan reject izin ke server actions
-->
<script lang="ts">
	import {
		AlertCircle,
		ArrowLeft,
		CheckCircle2,
		Clock,
		ExternalLink,
		Eye,
		FileText,
		Globe,
		MapPin,
		QrCode,
		Search,
		ShieldAlert,
		ShieldCheck,
		User,
		X,
		XCircle
	} from '@lucide/svelte';
	import { formatDateDDMMYYYY } from '$lib/utils';
	import { page } from '$app/state';
	import type { PageData } from './$types';

	let { data } = $props<{ data: PageData }>();

	let searchQuery = $state('');

	// State Modal Preview Foto Bukti
	let selectedPreviewFoto = $state<string | null>(null);
	let selectedPreviewTitle = $state<string>('');

	// State Modal Dialog Approval Izin / Sakit
	let isApprovalModalOpen = $state(false);

	// Buka modal otomatis jika datang dari notifikasi (?review=1)
	$effect(() => {
		if (page.url.searchParams.get('review') === '1' && pendingIzinList.length > 0) {
			isApprovalModalOpen = true;
		}
	});

	type PesertaType = (typeof data.pesertaList)[number];

	let filteredPeserta = $derived(
		data.pesertaList.filter((p: PesertaType) => {
			const q = searchQuery.toLowerCase();
			return p.namaLengkap.toLowerCase().includes(q) || (p.email || '').toLowerCase().includes(q);
		})
	);

	// Daftar Izin Menunggu Approval
	let pendingIzinList = $derived(
		data.pesertaList.filter(
			(p: PesertaType) =>
				(p.status === 'Izin' || p.status === 'Sakit') &&
				p.statusApproval === 'Menunggu Persetujuan'
		)
	);

	const stats = $derived({
		hadir: (data.pesertaList || []).filter((p: PesertaType) => p.status === 'Hadir').length,
		hadirOffline: (data.pesertaList || []).filter(
			(p: PesertaType) => p.status === 'Hadir' && p.metodeKehadiran === 'offline'
		).length,
		hadirOnline: (data.pesertaList || []).filter(
			(p: PesertaType) => p.status === 'Hadir' && p.metodeKehadiran === 'online'
		).length,
		izin: (data.pesertaList || []).filter((p: PesertaType) => p.status === 'Izin').length,
		sakit: (data.pesertaList || []).filter((p: PesertaType) => p.status === 'Sakit').length,
		alpa: (data.pesertaList || []).filter((p: PesertaType) => p.status === 'Alpa').length,
		pendingApproval: (data.pesertaList || []).filter(
			(p: PesertaType) => p.statusApproval === 'Menunggu Persetujuan'
		).length,
		belum: (data.pesertaList || []).filter((p: PesertaType) => p.status === 'Belum Terdata').length
	});
</script>

<svelte:head>
	<title>Checklist Presensi - {data.jadwal.namaKegiatan}</title>
</svelte:head>

<div class="space-y-6">
	<!-- Top Bar Header -->
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
		<div class="flex items-center gap-3">
			<a
				href="/admin/presensi"
				class="p-2 rounded-lg border border-border bg-card hover:bg-secondary text-foreground/70 hover:text-foreground transition-colors"
				aria-label="Kembali ke daftar jadwal"
			>
				<ArrowLeft class="w-4 h-4" />
			</a>
			<div>
				<div class="flex items-center gap-2">
					<h1 class="text-lg font-bold text-foreground tracking-tight">
						{data.jadwal.namaKegiatan}
					</h1>
					<span class="text-xs bg-primary/10 text-primary px-2.5 py-0.5 rounded-full font-medium">
						{data.kelompokNama}
					</span>
				</div>
				<div class="flex items-center gap-2.5 text-xs text-foreground/60 mt-1 flex-wrap">
					<span class="font-mono">Tanggal: {formatDateDDMMYYYY(data.jadwal.tanggal)}</span>
					{#if data.jadwal.lokasiNama}
						<span class="inline-flex items-center gap-1 text-primary font-medium">
							<MapPin class="w-3.5 h-3.5" />
							<span>{data.jadwal.lokasiNama}</span>
							{#if data.jadwal.radiusMeter}
								<span class="text-[10px] text-foreground/50">({data.jadwal.radiusMeter}m)</span>
							{/if}
						</span>
					{/if}
					{#if data.jadwal.latitude && data.jadwal.longitude}
						<a
							href={data.jadwal.gmapsUrl || `https://www.google.com/maps?q=${data.jadwal.latitude},${data.jadwal.longitude}`}
							target="_blank"
							rel="noopener noreferrer"
							class="text-[11px] text-blue-500 hover:underline inline-flex items-center gap-0.5"
						>
							<span>Peta Titik Acara</span>
							<ExternalLink class="w-3 h-3" />
						</a>
					{/if}
				</div>
			</div>
		</div>

		<a
			href={`/admin/presensi/${data.jadwal.id}/scan`}
			class="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-all shadow-xs active:scale-95 self-start sm:self-auto"
		>
			<QrCode class="w-4 h-4" />
			<span>Buka Scanner Kamera QR</span>
		</a>
	</div>

	<!-- Ringkasan Statistik Kehadiran -->
	<div class="grid grid-cols-2 sm:grid-cols-5 gap-3">
		<div class="bg-card border border-border rounded-xl p-3 text-center">
			<span class="text-[11px] text-foreground/60 font-medium">Hadir</span>
			<p class="text-lg font-bold text-primary mt-0.5">{stats.hadir}</p>
			<span class="text-[10px] text-foreground/50">
				{stats.hadirOffline} Offline • {stats.hadirOnline} Online
			</span>
		</div>
		<div class="bg-card border border-border rounded-xl p-3 text-center">
			<span class="text-[11px] text-foreground/60 font-medium">Izin</span>
			<p class="text-lg font-bold text-accent mt-0.5">{stats.izin}</p>
		</div>
		<div class="bg-card border border-border rounded-xl p-3 text-center">
			<span class="text-[11px] text-foreground/60 font-medium">Sakit</span>
			<p class="text-lg font-bold text-accent mt-0.5">{stats.sakit}</p>
		</div>
		<div class="bg-card border border-border rounded-xl p-3 text-center">
			<span class="text-[11px] text-foreground/60 font-medium">Alpa</span>
			<p class="text-lg font-bold text-destructive mt-0.5">{stats.alpa}</p>
		</div>
		<div class="bg-card border border-border rounded-xl p-3 text-center col-span-2 sm:col-span-1">
			<span class="text-[11px] text-foreground/60 font-medium">Belum Terdata</span>
			<p class="text-lg font-bold text-foreground/50 mt-0.5">{stats.belum}</p>
		</div>
	</div>

	<!-- ============================================================== -->
	<!-- ALERT COMPACT APPROVAL PERMOHONAN IZIN (JIKA ADA PENDING) -->
	<!-- ============================================================== -->
	{#if pendingIzinList.length > 0}
		<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 sm:px-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200">
			<div class="flex items-center gap-2.5 min-w-0">
				<div class="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
					<ShieldAlert class="w-4 h-4" />
				</div>
				<div class="min-w-0">
					<p class="text-xs font-bold text-foreground">
						Ada {pendingIzinList.length} Permohonan Izin / Sakit Menunggu Persetujuan
					</p>
					<p class="text-[11px] text-foreground/60 truncate">
						Jamaah mengajukan izin/sakit mandiri yang memerlukan verifikasi pengurus.
					</p>
				</div>
			</div>
			<button
				type="button"
				onclick={() => (isApprovalModalOpen = true)}
				class="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shrink-0 cursor-pointer shadow-xs transition-colors flex items-center justify-center gap-1.5"
			>
				<span>Tinjau Permohonan</span>
				<span class="px-1.5 py-0.2 rounded-full bg-black/20 text-[10px]">{pendingIzinList.length}</span>
			</button>
		</div>
	{/if}

	<!-- Search Bar Jamaah -->
	<div class="relative w-full sm:w-80">
		<Search class="w-4 h-4 text-foreground/40 absolute left-3 top-1/2 -translate-y-1/2" />
		<input
			type="search"
			placeholder="Cari nama atau email jamaah..."
			bind:value={searchQuery}
			class="w-full bg-secondary/50 border border-border rounded-lg pl-9 pr-3 py-2 text-xs text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary focus:bg-background transition-all"
		/>
	</div>

	<!-- Tabel Checklist Kehadiran -->
	<div class="bg-card border border-border rounded-xl overflow-hidden shadow-xs">
		<div class="overflow-x-auto">
			<table class="w-full text-left text-xs">
				<thead class="bg-secondary/60 text-foreground/70 uppercase text-[10px] tracking-wider border-b border-border">
					<tr>
						<th class="py-3 px-4 font-semibold">Nama Jamaah</th>
						<th class="py-3 px-4 font-semibold">Status Kehadiran</th>
						<th class="py-3 px-4 font-semibold">Metode & Bukti</th>
						<th class="py-3 px-4 font-semibold">Lokasi / Keterangan</th>
						<th class="py-3 px-4 font-semibold text-right">Ubah Status</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-border">
					{#if filteredPeserta.length === 0}
						<tr>
							<td colspan="5" class="py-12 text-center text-foreground/50">
								Tidak ada jamaah yang cocok dengan pencarian.
							</td>
						</tr>
					{:else}
						{#each filteredPeserta as peserta}
							<tr class="hover:bg-secondary/30 transition-colors">
								<!-- Kolom Nama -->
								<td class="py-3 px-4 font-semibold text-foreground">
									<div class="flex items-center gap-2">
										<div class="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-foreground/60 shrink-0">
											<User class="w-3.5 h-3.5" />
										</div>
										<div>
											<span>{peserta.namaLengkap}</span>
											<span class="block text-[10px] font-normal text-foreground/50">
												{peserta.email || peserta.noTelepon || '-'}
											</span>
										</div>
									</div>
								</td>

								<!-- Kolom Status & Approval -->
								<td class="py-3 px-4">
									{#if peserta.status === 'Hadir'}
										<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-primary/10 text-primary">
											<CheckCircle2 class="w-3.5 h-3.5" />
											<span>Hadir</span>
										</span>
									{:else if peserta.status === 'Izin' || peserta.status === 'Sakit'}
										<div class="space-y-0.5">
											<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-accent/20 text-accent">
												<AlertCircle class="w-3 h-3" />
												<span>{peserta.status}</span>
											</span>
											{#if peserta.statusApproval === 'Menunggu Persetujuan'}
												<button
													type="button"
													onclick={() => (isApprovalModalOpen = true)}
													class="text-[9.5px] text-amber-600 dark:text-amber-400 hover:underline font-semibold block cursor-pointer"
												>
													(Perlu Approval &rarr;)
												</button>
											{:else if peserta.statusApproval}
												<span class="block text-[9.5px] {peserta.statusApproval === 'Disetujui' ? 'text-emerald-600' : 'text-destructive'}">
													({peserta.statusApproval})
												</span>
											{/if}
										</div>
									{:else if peserta.status === 'Alpa'}
										<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-destructive/10 text-destructive">
											<XCircle class="w-3.5 h-3.5" />
											<span>Alpa</span>
										</span>
									{:else}
										<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-medium bg-secondary text-foreground/60">
											Belum Terdata
										</span>
									{/if}
								</td>

								<!-- Kolom Metode & Bukti Foto -->
								<td class="py-3 px-4">
									<div class="flex items-center gap-2">
										{#if peserta.metodeKehadiran === 'offline'}
											<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
												<MapPin class="w-3 h-3" />
												<span>Offline (GPS)</span>
											</span>
										{:else if peserta.metodeKehadiran === 'online'}
											<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-700 dark:text-blue-300">
												<Globe class="w-3 h-3" />
												<span>Online (SDC)</span>
											</span>
										{:else if peserta.metodeKehadiran === 'izin'}
											<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-secondary text-foreground/70">
												<FileText class="w-3 h-3" />
												<span>Izin</span>
											</span>
										{:else}
											<span class="text-foreground/40 text-[11px]">-</span>
										{/if}

										{#if peserta.fotoUrl}
											<button
												type="button"
												onclick={() => {
													selectedPreviewFoto = peserta.fotoUrl;
													selectedPreviewTitle = `Bukti Kehadiran - ${peserta.namaLengkap}`;
												}}
												class="p-1 rounded bg-secondary hover:bg-secondary/80 text-foreground/70 hover:text-foreground text-[10.5px] font-medium flex items-center gap-1 cursor-pointer transition-colors"
												title="Lihat foto bukti"
											>
												<Eye class="w-3 h-3 text-primary" />
												<span>Foto</span>
											</button>
										{/if}
									</div>
								</td>

								<!-- Kolom Lokasi / Keterangan -->
								<td class="py-3 px-4">
									{#if peserta.latitude && peserta.longitude}
										<a
											href={`https://www.google.com/maps?q=${peserta.latitude},${peserta.longitude}`}
											target="_blank"
											rel="noopener noreferrer"
											class="inline-flex items-center gap-1 text-[10.5px] text-primary hover:underline font-mono"
											title="Buka titik koordinat di Google Maps"
										>
											<MapPin class="w-3 h-3" />
											<span>{peserta.latitude}, {peserta.longitude}</span>
											<ExternalLink class="w-2.5 h-2.5" />
										</a>
									{:else if peserta.keteranganIzin}
										<span class="text-[11px] text-foreground/70 italic line-clamp-1" title={peserta.keteranganIzin}>
											{peserta.keteranganIzin}
										</span>
									{:else}
										<span class="text-foreground/40 text-[11px]">-</span>
									{/if}
								</td>

								<!-- Kolom Tombol Ubah Status Manual -->
								<td class="py-3 px-4 text-right">
									<div class="inline-flex items-center gap-1">
										<form method="POST" action="?/updateStatus" class="inline">
											<input type="hidden" name="userId" value={peserta.id} />
											<input type="hidden" name="status" value="Hadir" />
											<button
												type="submit"
												class="px-2 py-1 rounded text-[10px] font-semibold transition-colors cursor-pointer {peserta.status ===
												'Hadir'
													? 'bg-primary text-primary-foreground'
													: 'bg-secondary text-foreground/70 hover:bg-secondary/80'}"
											>
												Hadir
											</button>
										</form>

										<form method="POST" action="?/updateStatus" class="inline">
											<input type="hidden" name="userId" value={peserta.id} />
											<input type="hidden" name="status" value="Izin" />
											<button
												type="submit"
												class="px-2 py-1 rounded text-[10px] font-semibold transition-colors cursor-pointer {peserta.status ===
												'Izin'
													? 'bg-accent text-accent-foreground'
													: 'bg-secondary text-foreground/70 hover:bg-secondary/80'}"
											>
												Izin
											</button>
										</form>

										<form method="POST" action="?/updateStatus" class="inline">
											<input type="hidden" name="userId" value={peserta.id} />
											<input type="hidden" name="status" value="Sakit" />
											<button
												type="submit"
												class="px-2 py-1 rounded text-[10px] font-semibold transition-colors cursor-pointer {peserta.status ===
												'Sakit'
													? 'bg-accent text-accent-foreground'
													: 'bg-secondary text-foreground/70 hover:bg-secondary/80'}"
											>
												Sakit
											</button>
										</form>

										<form method="POST" action="?/updateStatus" class="inline">
											<input type="hidden" name="userId" value={peserta.id} />
											<input type="hidden" name="status" value="Alpa" />
											<button
												type="submit"
												class="px-2 py-1 rounded text-[10px] font-semibold transition-colors cursor-pointer {peserta.status ===
												'Alpa'
													? 'bg-destructive text-destructive-foreground'
													: 'bg-secondary text-foreground/70 hover:bg-secondary/80'}"
											>
												Alpa
											</button>
										</form>
									</div>
								</td>
							</tr>
						{/each}
					{/if}
				</tbody>
			</table>
		</div>
	</div>
</div>

<!-- Modal Preview Foto Bukti Presensi -->
{#if selectedPreviewFoto}
	<div
		class="fixed inset-0 z-60 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
		role="dialog"
		aria-modal="true"
		tabindex="-1"
		onclick={(e) => {
			if (e.target === e.currentTarget) selectedPreviewFoto = null;
		}}
		onkeydown={(e) => {
			if (e.key === 'Escape') selectedPreviewFoto = null;
		}}
	>
		<div class="bg-card border border-border rounded-2xl max-w-lg w-full p-4 shadow-2xl space-y-3">
			<div class="flex items-center justify-between pb-2 border-b border-border">
				<h3 class="text-xs font-bold text-foreground">{selectedPreviewTitle || 'Foto Bukti Kehadiran'}</h3>
				<button
					type="button"
					onclick={() => (selectedPreviewFoto = null)}
					class="p-1 rounded-lg hover:bg-secondary text-foreground/60 hover:text-foreground cursor-pointer"
				>
					<X class="w-4 h-4" />
				</button>
			</div>

			<div class="rounded-xl overflow-hidden bg-black/5 flex items-center justify-center max-h-[70vh]">
				<img
					src={selectedPreviewFoto}
					alt="Preview Bukti"
					class="max-w-full max-h-[70vh] object-contain rounded-xl"
				/>
			</div>

			<div class="flex items-center justify-between pt-1">
				<a
					href={selectedPreviewFoto}
					target="_blank"
					rel="noopener noreferrer"
					class="text-[11px] text-primary hover:underline font-semibold flex items-center gap-1"
				>
					<ExternalLink class="w-3 h-3" />
					<span>Buka Gambar Penuh</span>
				</a>

				<button
					type="button"
					onclick={() => (selectedPreviewFoto = null)}
					class="px-4 py-1.5 rounded-lg bg-secondary text-foreground text-xs font-semibold hover:bg-secondary/80 cursor-pointer"
				>
					Tutup
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Modal Dialog Peninjauan Approval Permohonan Izin / Sakit -->
{#if isApprovalModalOpen}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
		role="dialog"
		aria-modal="true"
		tabindex="-1"
		onclick={(e) => {
			if (e.target === e.currentTarget) isApprovalModalOpen = false;
		}}
		onkeydown={(e) => {
			if (e.key === 'Escape') isApprovalModalOpen = false;
		}}
	>
		<div
			class="bg-card border border-border rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
		>
			<!-- Modal Header -->
			<div class="px-5 py-4 border-b border-border flex items-center justify-between bg-secondary/30">
				<div class="flex items-center gap-2.5">
					<div class="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
						<ShieldAlert class="w-4 h-4" />
					</div>
					<div>
						<h3 class="text-sm font-bold text-foreground">Persetujuan Permohonan Izin & Sakit</h3>
						<p class="text-[11px] text-foreground/60">
							{data.jadwal.namaKegiatan} &bull; {data.kelompokNama}
						</p>
					</div>
				</div>

				<button
					type="button"
					onclick={() => (isApprovalModalOpen = false)}
					class="p-1.5 rounded-lg hover:bg-secondary text-foreground/60 hover:text-foreground cursor-pointer transition-colors"
					aria-label="Tutup dialog permohonan"
				>
					<X class="w-4 h-4" />
				</button>
			</div>

			<!-- Modal Body (List Permohonan) -->
			<div class="p-4 sm:p-5 overflow-y-auto space-y-4 divide-y divide-border/60">
				{#if pendingIzinList.length === 0}
					<div class="py-12 text-center space-y-2">
						<div class="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-600 mx-auto flex items-center justify-center">
							<ShieldCheck class="w-5 h-5" />
						</div>
						<p class="text-xs font-bold text-foreground">Semua Permohonan Telah Ditinjau</p>
						<p class="text-[11px] text-foreground/60">
							Tidak ada permohonan yang menunggu persetujuan pada jadwal kegiatan ini.
						</p>
					</div>
				{:else}
					{#each pendingIzinList as p}
						<div class="pt-4 first:pt-0 space-y-3">
							<div class="flex items-start justify-between gap-2">
								<div class="flex items-center gap-2.5">
									<div class="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-foreground/60 shrink-0">
										<User class="w-4 h-4" />
									</div>
									<div>
										<span class="font-bold text-xs text-foreground block">{p.namaLengkap}</span>
										<span class="text-[11px] text-foreground/60">{p.email || p.noTelepon || 'Jamaah'}</span>
									</div>
								</div>

								<span
									class="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold {p.status === 'Sakit'
										? 'bg-rose-500/10 text-rose-700 dark:text-rose-300'
										: 'bg-amber-500/10 text-amber-700 dark:text-amber-300'}"
								>
									{p.status}
								</span>
							</div>

							<!-- Alasan Izin -->
							<div class="p-3 rounded-xl bg-secondary/40 text-xs text-foreground/80 space-y-1">
								<span class="text-[10px] font-semibold text-foreground/60 block">Keterangan / Alasan:</span>
								<p class="italic">{p.keteranganIzin || 'Tidak ada keterangan tambahan.'}</p>
							</div>

							<!-- Lampiran & Tombol Aksi -->
							<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
								{#if p.fotoUrl}
									<button
										type="button"
										onclick={() => {
											selectedPreviewFoto = p.fotoUrl;
											selectedPreviewTitle = `Bukti Izin - ${p.namaLengkap}`;
										}}
										class="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-semibold cursor-pointer"
									>
										<Eye class="w-3.5 h-3.5" />
										<span>Lihat Foto Bukti Surat / Resep</span>
									</button>
								{:else}
									<span class="text-[11px] text-foreground/40 italic">Tanpa lampiran foto bukti</span>
								{/if}

								<div class="flex items-center gap-2 self-end sm:self-auto">
									<form method="POST" action="?/rejectIzin">
										<input type="hidden" name="userId" value={p.id} />
										<button
											type="submit"
											class="px-3 py-1.5 rounded-lg border border-destructive/30 hover:bg-destructive/10 text-destructive text-xs font-semibold transition-colors cursor-pointer"
										>
											Tolak
										</button>
									</form>

									<form method="POST" action="?/approveIzin">
										<input type="hidden" name="userId" value={p.id} />
										<button
											type="submit"
											class="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs"
										>
											Setujui (Approve)
										</button>
									</form>
								</div>
							</div>
						</div>
					{/each}
				{/if}
			</div>

			<!-- Modal Footer -->
			<div class="px-5 py-3 border-t border-border bg-secondary/20 flex justify-end">
				<button
					type="button"
					onclick={() => (isApprovalModalOpen = false)}
					class="px-4 py-1.5 rounded-lg bg-secondary text-foreground text-xs font-semibold hover:bg-secondary/80 cursor-pointer"
				>
					Tutup
				</button>
			</div>
		</div>
	</div>
{/if}
