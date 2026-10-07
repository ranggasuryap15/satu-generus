<!--
  @file src/routes/(admin)/admin/sensus/+page.svelte
  @purpose Data Table manajemen sensus Kartu Keluarga bagi admin dengan fitur unmasking data sensitif
  @usedBy Route admin '/admin/sensus'
  @dependencies @lucide/svelte (Search, Eye, Shield, Users, Download, X), Svelte 5 Runes
  @publicFunctions unmaskField, closeModal
  @sideEffects Melakukan pemanggilan HTTP POST ke /api/sensus/unmask untuk dekripsi teks asli
-->
<script lang="ts">
	import { Search, Eye, Shield, Users, Download, X, EyeOff } from '@lucide/svelte';
	import type { PageData } from './$types';

	let { data } = $props<{ data: PageData }>();

	let searchQuery = $state('');
	let selectedKeluarga = $state<(typeof data.daftarKeluarga)[0] | null>(null);

	// State Unmasking Modal
	let showUnmaskModal = $state(false);
	let unmaskLoading = $state(false);
	let unmaskedData = $state<{ label: string; value: string } | null>(null);

	let filteredKeluarga = $derived(
		(data.daftarKeluarga || []).filter((k: (typeof data.daftarKeluarga)[number]) => {
			const q = searchQuery.toLowerCase();
			return (
				k.noKkMasked.toLowerCase().includes(q) ||
				k.kepalaKeluargaNama.toLowerCase().includes(q) ||
				k.alamatLengkap.toLowerCase().includes(q)
			);
		})
	);

	async function requestUnmask(params: { keluargaId?: string; anggotaId?: string; label: string }) {
		unmaskLoading = true;
		showUnmaskModal = true;
		unmaskedData = null;

		try {
			const res = await fetch('/api/sensus/unmask', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(params)
			});
			const result = await res.json();
			if (res.ok) {
				unmaskedData = { label: params.label, value: result.original };
			} else {
				alert(result.error || 'Gagal unmask data');
				showUnmaskModal = false;
			}
		} catch (err) {
			alert('Terjadi kesalahan jaringan.');
			showUnmaskModal = false;
		} finally {
			unmaskLoading = false;
		}
	}
</script>

<svelte:head>
	<title>Sensus Kartu Keluarga - Admin Satu Generus</title>
</svelte:head>

<div class="space-y-6">
	<!-- Page Header -->
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
		<div>
			<h1 class="text-xl font-bold text-foreground tracking-tight">Rekapitulasi Sensus Kartu Keluarga</h1>
			<p class="text-xs text-foreground/60 mt-0.5">
				Kelola data sensus kependudukan jamaah dengan proteksi enkripsi AES-256-GCM.
			</p>
		</div>

		<div class="flex items-center gap-2">
			<button
				type="button"
				class="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card text-xs font-medium text-foreground/80 hover:bg-secondary transition-colors"
			>
				<Download class="w-3.5 h-3.5" />
				Export CSV
			</button>
		</div>
	</div>

	<!-- Filter & Search Toolbar -->
	<div class="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
		<div class="relative w-full sm:w-80">
			<Search class="w-4 h-4 text-foreground/40 absolute left-3 top-1/2 -translate-y-1/2" />
			<input
				type="search"
				placeholder="Cari No. KK, kepala keluarga, alamat..."
				bind:value={searchQuery}
				class="w-full bg-secondary/50 border border-border rounded-lg pl-9 pr-3 py-2 text-xs text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary focus:bg-background transition-all"
			/>
		</div>

		<div class="text-xs text-foreground/60">
			Menampilkan <span class="font-bold text-foreground">{filteredKeluarga.length}</span> kartu keluarga
		</div>
	</div>

	<!-- Data Table Section -->
	<div class="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
		<div class="overflow-x-auto">
			<table class="w-full text-left text-xs">
				<thead class="bg-secondary/60 text-foreground/70 uppercase text-[10px] tracking-wider border-b border-border">
					<tr>
						<th class="py-3 px-4 font-semibold">Nomor KK (Masked)</th>
						<th class="py-3 px-4 font-semibold">Kepala Keluarga</th>
						<th class="py-3 px-4 font-semibold">Alamat Lengkap</th>
						<th class="py-3 px-4 font-semibold">Anggota</th>
						<th class="py-3 px-4 font-semibold text-right">Aksi</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-border">
					{#if filteredKeluarga.length === 0}
						<tr>
							<td colspan="5" class="py-12 text-center text-foreground/50">
								Belum ada data kartu keluarga yang terdaftar.
							</td>
						</tr>
					{:else}
						{#each filteredKeluarga as k}
							<tr class="hover:bg-secondary/30 transition-colors">
								<td class="py-3.5 px-4 font-mono font-medium text-foreground">
									<div class="flex items-center gap-2">
										<span>{k.noKkMasked}</span>
										<button
											type="button"
											onclick={() => requestUnmask({ keluargaId: k.id, label: `No. KK (${k.kepalaKeluargaNama})` })}
											class="text-primary hover:text-primary/80 p-1 rounded hover:bg-primary/10 transition-colors"
											title="Buka Enkripsi No. KK"
										>
											<Eye class="w-3.5 h-3.5" />
										</button>
									</div>
								</td>
								<td class="py-3.5 px-4 text-foreground font-medium">{k.kepalaKeluargaNama}</td>
								<td class="py-3.5 px-4 text-foreground/70 max-w-xs truncate">{k.alamatLengkap}</td>
								<td class="py-3.5 px-4">
									<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-secondary text-foreground/80">
										<Users class="w-3 h-3" />
										{k.jumlahAnggota} Orang
									</span>
								</td>
								<td class="py-3.5 px-4 text-right">
									<button
										type="button"
										onclick={() => (selectedKeluarga = k)}
										class="px-2.5 py-1 rounded bg-secondary hover:bg-secondary/80 text-foreground font-medium text-xs transition-colors"
									>
										Lihat Detail
									</button>
								</td>
							</tr>
						{/each}
					{/if}
				</tbody>
			</table>
		</div>
	</div>
</div>

<!-- Modal Detail Anggota Keluarga -->
{#if selectedKeluarga}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
		role="dialog"
		aria-modal="true"
	>
		<div class="bg-card border border-border rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-5">
			<div class="flex items-center justify-between pb-3 border-b border-border">
				<div>
					<h3 class="text-sm font-bold text-foreground">Rincian Anggota Kartu Keluarga</h3>
					<p class="text-xs text-foreground/60 font-mono mt-0.5">{selectedKeluarga.noKkMasked}</p>
				</div>
				<button
					type="button"
					onclick={() => (selectedKeluarga = null)}
					class="p-1 rounded-lg hover:bg-secondary text-foreground/60 hover:text-foreground"
				>
					<X class="w-5 h-5" />
				</button>
			</div>

			<div class="space-y-3 max-h-80 overflow-y-auto pr-1">
				{#each selectedKeluarga.anggota as a}
					<div class="p-3 rounded-xl border border-border bg-secondary/30 flex items-center justify-between text-xs">
						<div>
							<div class="flex items-center gap-2">
								<span class="font-semibold text-foreground">{a.statusHubungan}</span>
								<span class="text-[10px] bg-secondary px-1.5 py-0.5 rounded text-foreground/70">
									{a.jenisKelamin === 'L' ? 'L' : 'P'}
								</span>
							</div>
							<div class="flex items-center gap-2 mt-1">
								<span class="font-mono text-[11px] text-foreground/70">NIK: {a.nikMasked}</span>
								<button
									type="button"
									onclick={() => requestUnmask({ anggotaId: a.id, label: `NIK ${a.statusHubungan}` })}
									class="text-primary hover:text-primary/80"
									title="Buka Enkripsi NIK"
								>
									<Eye class="w-3 h-3" />
								</button>
							</div>
						</div>
						<span class="text-[11px] text-foreground/60 font-medium">{a.tanggalLahir}</span>
					</div>
				{/each}
			</div>

			<div class="pt-2 flex justify-end">
				<button
					type="button"
					onclick={() => (selectedKeluarga = null)}
					class="px-4 py-2 rounded-lg bg-secondary text-xs font-semibold text-foreground hover:bg-secondary/80"
				>
					Tutup
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Modal Unmasking Plaintext Data Sensitif -->
{#if showUnmaskModal}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
		role="dialog"
		aria-modal="true"
	>
		<div class="bg-card border border-border rounded-2xl max-w-sm w-full p-6 shadow-xl space-y-4">
			<div class="w-12 h-12 rounded-xl bg-accent/20 text-accent mx-auto flex items-center justify-center">
				<Shield class="w-6 h-6" />
			</div>

			<div class="text-center space-y-1">
				<h3 class="text-sm font-bold text-foreground">Data Sensitif Didekripsi</h3>
				<p class="text-xs text-foreground/60">
					Akses audit tercatat di log wewenang admin 4S.
				</p>
			</div>

			{#if unmaskLoading}
				<div class="py-4 text-center text-xs text-foreground/60">
					Mendekripsi data aman...
				</div>
			{:else if unmaskedData}
				<div class="bg-secondary/60 p-4 rounded-xl text-center space-y-1 border border-border">
					<p class="text-[11px] font-medium text-foreground/60">{unmaskedData.label}</p>
					<p class="text-base font-mono font-bold text-primary tracking-wider select-all">
						{unmaskedData.value}
					</p>
				</div>
			{/if}

			<div class="pt-2">
				<button
					type="button"
					onclick={() => (showUnmaskModal = false)}
					class="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-all shadow-sm"
				>
					Tutup Tampilan
				</button>
			</div>
		</div>
	</div>
{/if}
