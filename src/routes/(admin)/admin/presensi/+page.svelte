<!--
  @file src/routes/(admin)/admin/presensi/+page.svelte
  @purpose Halaman rekapitulasi jadwal pengajian dan pembuat jadwal baru bagi admin dengan perlindungan draf modal
  @usedBy Route admin '/admin/presensi'
  @dependencies @lucide/svelte, Svelte 5 Runes, $lib/components/SearchableSelect.svelte, $lib/utils (formatDateDDMMYYYY)
  @publicFunctions openAddModal, closeAddModal, resetAddForm, isAddFormDirty
  @sideEffects Menampilkan data jadwal dan mengirim form pembuatan jadwal ke server
-->
<script lang="ts">
	import { Calendar, Plus, QrCode, SquareCheck, Search, X, Users } from '@lucide/svelte';
	import type { PageData, ActionData } from './$types';
	import SearchableSelect from '$lib/components/SearchableSelect.svelte';
	import { formatDateDDMMYYYY } from '$lib/utils';

	let { data, form } = $props<{ data: PageData; form: ActionData }>();

	let showAddModal = $state(false);
	let searchQuery = $state('');
	let newNamaKegiatan = $state('');
	let newTanggal = $state('');
	let selectedKelompokId = $state<string | number>('');

	const kelompokOptions = $derived(
		(data.kelompokList || []).map((k: (typeof data.kelompokList)[number]) => ({
			value: k.id,
			label: k.nama
		}))
	);

	function isAddFormDirty() {
		return newNamaKegiatan.trim() !== '' || newTanggal !== '' || String(selectedKelompokId).trim() !== '';
	}

	function resetAddForm() {
		newNamaKegiatan = '';
		newTanggal = '';
		selectedKelompokId = '';
	}

	function openAddModal() {
		showAddModal = true;
	}

	function closeAddModal() {
		if (isAddFormDirty()) {
			if (confirm('Ada isian jadwal yang belum disimpan. Tetap tutup modal? (Isian Anda akan tetap tersimpan sebagai draf)')) {
				showAddModal = false;
			}
		} else {
			showAddModal = false;
		}
	}

	$effect(() => {
		if (form?.success) {
			resetAddForm();
			showAddModal = false;
		}
	});

	let filteredJadwal = $derived(
		(data.daftarJadwal || []).filter((j: (typeof data.daftarJadwal)[number]) => {
			const q = searchQuery.toLowerCase();
			return (
				j.namaKegiatan.toLowerCase().includes(q) ||
				(j.kelompokNama || '').toLowerCase().includes(q) ||
				j.tanggal.includes(q) ||
				formatDateDDMMYYYY(j.tanggal).includes(q)
			);
		})
	);
</script>

<svelte:head>
	<title>Presensi Pengajian - Admin Satu Generus</title>
</svelte:head>

<div class="space-y-6">
	<!-- Page Header -->
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
		<div>
			<h1 class="text-xl font-bold text-foreground tracking-tight">Presensi Kegiatan Pengajian</h1>
			<p class="text-xs text-foreground/60 mt-0.5">
				Kelola jadwal kegiatan rutin dan verifikasi kehadiran jamaah via QR scanner atau checklist manual.
			</p>
		</div>

		<button
			type="button"
			onclick={openAddModal}
			class="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-all shadow-sm active:scale-95"
		>
			<Plus class="w-4 h-4" />
			<span>Buat Jadwal Baru</span>
		</button>
	</div>

	<!-- Search Bar -->
	<div class="bg-card border border-border rounded-xl p-4 shadow-sm flex items-center justify-between">
		<div class="relative w-full sm:w-80">
			<Search class="w-4 h-4 text-foreground/40 absolute left-3 top-1/2 -translate-y-1/2" />
			<input
				type="search"
				placeholder="Cari nama pengajian, tanggal, kelompok..."
				bind:value={searchQuery}
				class="w-full bg-secondary/50 border border-border rounded-lg pl-9 pr-3 py-2 text-xs text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary focus:bg-background transition-all"
			/>
		</div>

		<span class="text-xs text-foreground/60">
			Total <span class="font-bold text-foreground">{filteredJadwal.length}</span> kegiatan
		</span>
	</div>

	<!-- Data Table Section -->
	<div class="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
		<div class="overflow-x-auto">
			<table class="w-full text-left text-xs">
				<thead class="bg-secondary/60 text-foreground/70 uppercase text-[10px] tracking-wider border-b border-border">
					<tr>
						<th class="py-3 px-4 font-semibold">Tanggal</th>
						<th class="py-3 px-4 font-semibold">Nama Kegiatan</th>
						<th class="py-3 px-4 font-semibold">Kelompok</th>
						<th class="py-3 px-4 font-semibold">Kehadiran</th>
						<th class="py-3 px-4 font-semibold text-right">Aksi Input Presensi</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-border">
					{#if filteredJadwal.length === 0}
						<tr>
							<td colspan="5" class="py-12 text-center text-foreground/50">
								Belum ada jadwal kegiatan pengajian. Buat jadwal baru untuk memulai presensi.
							</td>
						</tr>
					{:else}
						{#each filteredJadwal as item}
							<tr class="hover:bg-secondary/30 transition-colors">
								<td class="py-3.5 px-4 font-mono font-medium text-foreground">{formatDateDDMMYYYY(item.tanggal)}</td>
								<td class="py-3.5 px-4 font-semibold text-foreground">{item.namaKegiatan}</td>
								<td class="py-3.5 px-4 text-foreground/70">{item.kelompokNama || '-'}</td>
								<td class="py-3.5 px-4">
									<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary">
										<Users class="w-3 h-3" />
										{item.totalHadir} Hadir
									</span>
								</td>
								<td class="py-3.5 px-4 text-right space-x-1.5">
									<a
										href={`/admin/presensi/${item.id}`}
										class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground font-medium text-xs transition-colors"
										title="Checklist Manual"
									>
										<SquareCheck class="w-3.5 h-3.5 text-primary" />
										<span>Checklist</span>
									</a>

									<a
										href={`/admin/presensi/${item.id}/scan`}
										class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary font-medium text-xs transition-colors"
										title="Pindai QR Code"
									>
										<QrCode class="w-3.5 h-3.5" />
										<span>Scan QR</span>
									</a>
								</td>
							</tr>
						{/each}
					{/if}
				</tbody>
			</table>
		</div>
	</div>
</div>

<!-- Modal Buat Jadwal Baru -->
{#if showAddModal}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
		role="dialog"
		aria-modal="true"
		onclick={(e) => {
			if (e.target === e.currentTarget) closeAddModal();
		}}
	>
		<div class="bg-card border border-border rounded-2xl max-w-md w-full p-6 shadow-xl space-y-5">
			<div class="flex items-center justify-between pb-3 border-b border-border">
				<div class="flex items-center gap-2">
					<div class="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
						<Calendar class="w-4 h-4" />
					</div>
					<h3 class="text-sm font-bold text-foreground">Buat Jadwal Pengajian Baru</h3>
				</div>
				<button
					type="button"
					onclick={closeAddModal}
					class="p-1 rounded-lg hover:bg-secondary text-foreground/60 hover:text-foreground"
				>
					<X class="w-5 h-5" />
				</button>
			</div>

			<form method="POST" action="?/createJadwal" class="space-y-4">
				<div>
					<label for="namaKegiatan" class="block text-xs font-semibold text-foreground mb-1.5">
						Nama Kegiatan Pengajian *
					</label>
					<input
						id="namaKegiatan"
						name="namaKegiatan"
						type="text"
						bind:value={newNamaKegiatan}
						required
						placeholder="Contoh: Pengajian Rutin Muda/i"
						class="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
					/>
				</div>

				<div class="grid grid-cols-2 gap-3">
					<div>
						<label for="tanggal" class="block text-xs font-semibold text-foreground mb-1.5">
							Tanggal Pelaksanaan *
						</label>
						<input
							id="tanggal"
							name="tanggal"
							type="date"
							bind:value={newTanggal}
							required
							class="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
						/>
					</div>

					<div>
						<label for="kelompokId" class="block text-xs font-semibold text-foreground mb-1.5">
							Pilih Kelompok *
						</label>
						<SearchableSelect
							id="kelompokId"
							name="kelompokId"
							options={kelompokOptions}
							bind:value={selectedKelompokId}
							required
							placeholder="-- Pilih Kelompok --"
							searchPlaceholder="Cari nama kelompok..."
						/>
					</div>
				</div>

				<div class="flex items-center justify-between gap-2 pt-3 border-t border-border">
					{#if isAddFormDirty()}
						<button
							type="button"
							onclick={resetAddForm}
							class="text-[11px] text-destructive hover:underline font-medium"
						>
							Kosongkan Isian
						</button>
					{:else}
						<div></div>
					{/if}
					<div class="flex items-center gap-2">
						<button
							type="button"
							onclick={closeAddModal}
							class="px-4 py-2 rounded-lg border border-border text-xs font-semibold text-foreground/80 hover:bg-secondary"
						>
							Batal
						</button>
						<button
							type="submit"
							class="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90"
						>
							Simpan Jadwal
						</button>
					</div>
				</div>
			</form>
		</div>
	</div>
{/if}

