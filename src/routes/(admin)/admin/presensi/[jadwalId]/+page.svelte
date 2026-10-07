<!--
  @file src/routes/(admin)/admin/presensi/[jadwalId]/+page.svelte
  @purpose Halaman checklist absensi manual jamaah per jadwal kegiatan pengajian
  @usedBy Route admin '/admin/presensi/[jadwalId]'
  @dependencies @lucide/svelte (ArrowLeft, QrCode, CheckCircle2, AlertCircle, XCircle, Clock), Svelte 5 Runes
  @publicFunctions N/A (Svelte Component)
  @sideEffects Mengirim form updateStatus kehadiran per jamaah ke server action
-->
<script lang="ts">
	import {
		ArrowLeft,
		QrCode,
		CheckCircle2,
		AlertCircle,
		XCircle,
		Clock,
		Search,
		User
	} from '@lucide/svelte';
	import type { PageData } from './$types';

	let { data } = $props<{ data: PageData }>();

	let searchQuery = $state('');

	let filteredPeserta = $derived(
		data.pesertaList.filter((p: (typeof data.pesertaList)[number]) => {
			const q = searchQuery.toLowerCase();
			return p.namaLengkap.toLowerCase().includes(q) || (p.email || '').toLowerCase().includes(q);
		})
	);

	type PesertaType = (typeof data.pesertaList)[number];
	const stats = $derived({
		hadir: (data.pesertaList || []).filter((p: PesertaType) => p.status === 'Hadir').length,
		izin: (data.pesertaList || []).filter((p: PesertaType) => p.status === 'Izin').length,
		sakit: (data.pesertaList || []).filter((p: PesertaType) => p.status === 'Sakit').length,
		alpa: (data.pesertaList || []).filter((p: PesertaType) => p.status === 'Alpa').length,
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
				<p class="text-xs text-foreground/60 mt-0.5 font-mono">
					Tanggal: {data.jadwal.tanggal}
				</p>
			</div>
		</div>

		<a
			href={`/admin/presensi/${data.jadwal.id}/scan`}
			class="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-all shadow-sm active:scale-95 self-start sm:self-auto"
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
			<span class="text-[11px] text-foreground/60 font-medium">Belum Presensi</span>
			<p class="text-lg font-bold text-foreground/50 mt-0.5">{stats.belum}</p>
		</div>
	</div>

	<!-- Search Jamaah Toolbar -->
	<div class="bg-card border border-border rounded-xl p-3 shadow-sm flex items-center justify-between">
		<div class="relative w-full sm:w-80">
			<Search class="w-4 h-4 text-foreground/40 absolute left-3 top-1/2 -translate-y-1/2" />
			<input
				type="search"
				placeholder="Cari nama jamaah di kelompok ini..."
				bind:value={searchQuery}
				class="w-full bg-secondary/50 border border-border rounded-lg pl-9 pr-3 py-1.5 text-xs text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary focus:bg-background transition-all"
			/>
		</div>
	</div>

	<!-- Tabel Checklist Manual Jamaah -->
	<div class="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
		<div class="overflow-x-auto">
			<table class="w-full text-left text-xs">
				<thead class="bg-secondary/60 text-foreground/70 uppercase text-[10px] tracking-wider border-b border-border">
					<tr>
						<th class="py-3 px-4 font-semibold">Nama Jamaah</th>
						<th class="py-3 px-4 font-semibold">Status Saat Ini</th>
						<th class="py-3 px-4 font-semibold text-right">Tandai Kehadiran</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-border">
					{#if filteredPeserta.length === 0}
						<tr>
							<td colspan="3" class="py-10 text-center text-foreground/50">
								Tidak ada jamaah ditemukan di kelompok ini.
							</td>
						</tr>
					{:else}
						{#each filteredPeserta as peserta}
							<tr class="hover:bg-secondary/30 transition-colors">
								<td class="py-3.5 px-4">
									<div class="flex items-center gap-2.5">
										<div class="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-foreground/60">
											<User class="w-3.5 h-3.5" />
										</div>
										<div>
											<p class="font-semibold text-foreground">{peserta.namaLengkap}</p>
											<p class="text-[11px] text-foreground/50">{peserta.email || '-'}</p>
										</div>
									</div>
								</td>
								<td class="py-3.5 px-4">
									{#if peserta.status === 'Hadir'}
										<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary">
											<CheckCircle2 class="w-3 h-3" />
											Hadir
										</span>
									{:else if peserta.status === 'Izin' || peserta.status === 'Sakit'}
										<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-accent/20 text-accent">
											<AlertCircle class="w-3 h-3" />
											{peserta.status}
										</span>
									{:else if peserta.status === 'Alpa'}
										<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-destructive/10 text-destructive">
											<XCircle class="w-3 h-3" />
											Alpa
										</span>
									{:else}
										<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-secondary text-foreground/50">
											Belum Terdata
										</span>
									{/if}
								</td>
								<td class="py-3.5 px-4 text-right">
									<form method="POST" action="?/updateStatus" class="inline-flex items-center gap-1">
										<input type="hidden" name="userId" value={peserta.id} />

										<button
											type="submit"
											name="status"
											value="Hadir"
											class="px-2.5 py-1 rounded text-[11px] font-medium transition-all {peserta.status ===
											'Hadir'
												? 'bg-primary text-primary-foreground shadow-sm'
												: 'bg-secondary hover:bg-secondary/80 text-foreground/70'}"
										>
											Hadir
										</button>

										<button
											type="submit"
											name="status"
											value="Izin"
											class="px-2.5 py-1 rounded text-[11px] font-medium transition-all {peserta.status ===
											'Izin'
												? 'bg-accent text-accent-foreground shadow-sm'
												: 'bg-secondary hover:bg-secondary/80 text-foreground/70'}"
										>
											Izin
										</button>

										<button
											type="submit"
											name="status"
											value="Sakit"
											class="px-2.5 py-1 rounded text-[11px] font-medium transition-all {peserta.status ===
											'Sakit'
												? 'bg-accent text-accent-foreground shadow-sm'
												: 'bg-secondary hover:bg-secondary/80 text-foreground/70'}"
										>
											Sakit
										</button>

										<button
											type="submit"
											name="status"
											value="Alpa"
											class="px-2.5 py-1 rounded text-[11px] font-medium transition-all {peserta.status ===
											'Alpa'
												? 'bg-destructive text-destructive-foreground shadow-sm'
												: 'bg-secondary hover:bg-secondary/80 text-foreground/70'}"
										>
											Alpa
										</button>
									</form>
								</td>
							</tr>
						{/each}
					{/if}
				</tbody>
			</table>
		</div>
	</div>
</div>
