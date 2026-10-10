<!--
  @file src/routes/(admin)/admin/wilayah/batch/+page.svelte
  @purpose Antarmuka batch insert data wilayah hierarkis (Daerah -> Desa -> Kelompok -> Sub-Kelompok) dengan paste spreadsheet, dynamic group cards, dan transaksi database atomik
  @usedBy Route admin '/admin/wilayah/batch'
  @dependencies @lucide/svelte, $app/forms, Svelte 5 Runes
  @publicFunctions addGroup, removeGroup, addKelompokToGroup, removeKelompok, addSubKelompok, removeSubKelompok, clearGroups, processPastedSpreadsheet
  @sideEffects Mengirim payload JSON batchData ke server action untuk dieksekusi dalam transaksi SQLite atomik
-->
<script lang="ts">
	import { enhance } from '$app/forms';
	import {
		AlertCircle,
		ArrowLeft,
		Building,
		CheckCircle2,
		Clipboard,
		Home,
		Layers,
		MapPin,
		Plus,
		Save,
		Sparkles,
		Trash2
	} from '@lucide/svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form } = $props<{ data: PageData; form: ActionData }>();

	export interface SubKelompokRow {
		id: string;
		nama: string;
		keterangan: string;
	}

	export interface KelompokRow {
		id: string;
		nama: string;
		kelurahan: string;
		subKelompoks: SubKelompokRow[];
	}

	export interface DesaBatchGroup {
		id: string;
		daerahNama: string;
		desaNama: string;
		kecamatan: string;
		kelompoks: KelompokRow[];
	}

	function createEmptySubKelompok(): SubKelompokRow {
		return {
			id: Math.random().toString(36).substring(2, 9),
			nama: '',
			keterangan: ''
		};
	}

	function createEmptyKelompok(defaultNama = ''): KelompokRow {
		return {
			id: Math.random().toString(36).substring(2, 9),
			nama: defaultNama,
			kelurahan: '',
			subKelompoks: []
		};
	}

	function createEmptyGroup(): DesaBatchGroup {
		const firstDaerah = data.daerahList[0]?.nama || '';
		return {
			id: Math.random().toString(36).substring(2, 9),
			daerahNama: firstDaerah,
			desaNama: '',
			kecamatan: '',
			kelompoks: [createEmptyKelompok('Kelompok 1')]
		};
	}

	let groups = $state<DesaBatchGroup[]>([createEmptyGroup()]);
	let isSubmitting = $state(false);

	// Modal Paste Spreadsheet
	let showPasteModal = $state(false);
	let pasteText = $state('');

	function addGroup() {
		groups.push(createEmptyGroup());
	}

	function removeGroup(index: number) {
		if (groups.length === 1) {
			groups = [createEmptyGroup()];
			return;
		}
		groups.splice(index, 1);
	}

	function addKelompokToGroup(group: DesaBatchGroup) {
		const nextNum = group.kelompoks.length + 1;
		group.kelompoks.push(createEmptyKelompok(`Kelompok ${nextNum}`));
	}

	function removeKelompok(group: DesaBatchGroup, kIndex: number) {
		if (group.kelompoks.length === 1) {
			if (confirm('Grup ini hanya memiliki 1 kelompok. Hapus seluruh grup desa/daerah ini?')) {
				const gIdx = groups.indexOf(group);
				if (gIdx !== -1) removeGroup(gIdx);
			}
			return;
		}
		group.kelompoks.splice(kIndex, 1);
	}

	function addSubKelompok(kelompok: KelompokRow) {
		kelompok.subKelompoks.push(createEmptySubKelompok());
	}

	function removeSubKelompok(kelompok: KelompokRow, skIndex: number) {
		kelompok.subKelompoks.splice(skIndex, 1);
	}

	function clearGroups() {
		if (confirm('Apakah Anda yakin ingin mengosongkan seluruh formulir batch wilayah?')) {
			groups = [createEmptyGroup()];
		}
	}

	// Parsing Spreadsheet Text dari Excel / Google Sheets
	function processPastedSpreadsheet() {
		if (!pasteText.trim()) return;

		const lines = pasteText.trim().split(/\r?\n/);
		const parsedGroups: DesaBatchGroup[] = [];
		const groupMap = new Map<string, DesaBatchGroup>(); // key: `${daerah}:${desa}`

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			const cols = line.split('\t').map((c) => c.trim());

			// Skip header jika ada nama kolom
			if (
				i === 0 &&
				(cols[0]?.toLowerCase().includes('daerah') || cols[1]?.toLowerCase().includes('desa'))
			) {
				continue;
			}

			// Format Standar: Daerah | Desa | Kelompok | Sub-Kelompok (opsional) | Kelurahan / Keterangan
			const rDaerah = cols[0] || '';
			const rDesa = cols[1] || '';
			const rKelompok = cols[2] || '';
			const rSub = cols[3] || '';
			const rKet = cols[4] || '';

			if (!rDaerah || !rDesa || !rKelompok) continue;

			const key = `${rDaerah.toLowerCase()}:${rDesa.toLowerCase()}`;
			let g = groupMap.get(key);
			if (!g) {
				g = {
					id: Math.random().toString(36).substring(2, 9),
					daerahNama: rDaerah,
					desaNama: rDesa,
					kecamatan: rDesa,
					kelompoks: []
				};
				groupMap.set(key, g);
				parsedGroups.push(g);
			}

			// Cari apakah kelompok sudah ada di grup ini
			let k = g.kelompoks.find((item) => item.nama.toLowerCase() === rKelompok.toLowerCase());
			if (!k) {
				k = {
					id: Math.random().toString(36).substring(2, 9),
					nama: rKelompok,
					kelurahan: rKet || '',
					subKelompoks: []
				};
				g.kelompoks.push(k);
			}

			// Tambah sub-kelompok jika terisi
			if (rSub) {
				k.subKelompoks.push({
					id: Math.random().toString(36).substring(2, 9),
					nama: rSub,
					keterangan: rKet || ''
				});
			}
		}

		if (parsedGroups.length > 0) {
			if (
				groups.length === 1 &&
				!groups[0].desaNama &&
				groups[0].kelompoks.length === 1 &&
				!groups[0].kelompoks[0].nama
			) {
				groups = parsedGroups;
			} else {
				groups = [...groups, ...parsedGroups];
			}
			pasteText = '';
			showPasteModal = false;
		} else {
			alert('Tidak ada baris data yang berhasil dikenali. Pastikan minimal kolom Daerah, Desa, dan Kelompok terisi.');
		}
	}

	// Metrik Live Stats
	const totalDaerahUnique = $derived(
		new Set(groups.map((g) => g.daerahNama.trim()).filter(Boolean)).size
	);
	const totalDesaUnique = $derived(
		new Set(groups.map((g) => `${g.daerahNama}:${g.desaNama}`.toLowerCase())).size
	);
	const totalKelompok = $derived(groups.reduce((acc, g) => acc + g.kelompoks.length, 0));
	const totalSubKelompok = $derived(
		groups.reduce(
			(acc, g) =>
				acc +
				g.kelompoks.reduce((kAcc, k) => kAcc + k.subKelompoks.filter((sk) => sk.nama.trim()).length, 0),
			0
		)
	);
</script>

<svelte:head>
	<title>Batch Insert Data Wilayah - Satu Generus</title>
</svelte:head>

<div class="space-y-4 max-w-[100vw] overflow-x-hidden p-2 sm:p-4">
	<!-- Top Navigation & Action Header -->
	<div
		class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card border border-border p-4 rounded-xl shadow-xs"
	>
		<div class="flex items-center gap-3">
			<a
				href="/admin/wilayah"
				class="p-2 rounded-lg border border-border bg-secondary/40 hover:bg-secondary text-foreground/80 hover:text-foreground transition-colors"
				title="Kembali ke Data Wilayah"
			>
				<ArrowLeft class="w-4 h-4" />
			</a>
			<div>
				<h1 class="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
					<Layers class="w-5 h-5 text-primary" />
					<span>Batch Insert Data Wilayah</span>
				</h1>
				<p class="text-xs text-foreground/60">
					Impor atau input data wilayah berjenjang secara massal: Daerah &rarr; Desa &rarr; Kelompok &rarr; Sub-Kelompok.
				</p>
			</div>
		</div>

		<div class="flex items-center gap-2 flex-wrap">
			<button
				type="button"
				onclick={() => (showPasteModal = true)}
				class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold transition-colors"
			>
				<Clipboard class="w-3.5 h-3.5" />
				<span>Paste Spreadsheet</span>
			</button>

			<button
				type="button"
				onclick={addGroup}
				class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold transition-colors shadow-xs"
			>
				<Plus class="w-3.5 h-3.5" />
				<span>+ Tambah Grup Wilayah</span>
			</button>

			<button
				type="button"
				onclick={clearGroups}
				class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-destructive/30 hover:bg-destructive/10 text-destructive text-xs font-medium transition-colors"
			>
				<Trash2 class="w-3.5 h-3.5" />
				<span>Kosongkan</span>
			</button>
		</div>
	</div>

	<!-- Live Summary Stats Bar -->
	<div class="flex flex-wrap items-center justify-between gap-3 bg-secondary/30 border border-border p-3.5 rounded-xl text-xs">
		<div class="flex items-center gap-2 text-foreground/75">
			<Sparkles class="w-4 h-4 text-primary" />
			<span>
				Data yang sama akan otomatis di-lookup dan digabungkan sehingga tidak ada duplikasi wilayah di database.
			</span>
		</div>

		<div class="text-[11px] text-foreground/70 text-right">
			<span class="font-bold text-foreground text-xs">{totalDaerahUnique}</span> Daerah •
			<span class="font-bold text-foreground text-xs">{totalDesaUnique}</span> Desa •
			<span class="font-bold text-primary text-xs">{totalKelompok}</span> Kelompok •
			<span class="font-bold text-blue-600 dark:text-blue-400 text-xs">{totalSubKelompok}</span> Sub-Kelompok
		</div>
	</div>

	<!-- Feedback Notifikasi Server -->
	{#if form?.error}
		<div
			class="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-xl"
		>
			<AlertCircle class="w-4 h-4 shrink-0" />
			<span>{form.error}</span>
		</div>
	{/if}

	{#if form?.success}
		<div
			class="flex items-center justify-between p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs rounded-xl"
		>
			<div class="flex items-center gap-2">
				<CheckCircle2 class="w-4 h-4 shrink-0" />
				<span>
					Berhasil menyimpan <strong>{form.summary?.totalKelompok}</strong> kelompok,
					<strong>{form.summary?.totalSubKelompok}</strong> sub-kelompok (dan <strong>{form.summary?.totalDesa}</strong> desa baru)!
				</span>
			</div>
			<a
				href="/admin/wilayah"
				class="px-3 py-1 rounded bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition-colors"
			>
				Lihat Data Wilayah
			</a>
		</div>
	{/if}

	<!-- Form Batch Groups Wilayah -->
	<form
		method="POST"
		use:enhance={({ cancel }) => {
			for (let i = 0; i < groups.length; i++) {
				const g = groups[i];
				if (!g.daerahNama.trim()) {
					alert(`Grup #${i + 1}: Nama Daerah wajib diisi!`);
					cancel();
					return;
				}
				if (!g.desaNama.trim()) {
					alert(`Grup #${i + 1}: Nama Desa wajib diisi!`);
					cancel();
					return;
				}
				for (let k = 0; k < g.kelompoks.length; k++) {
					const kl = g.kelompoks[k];
					if (!kl.nama.trim()) {
						alert(`Grup #${i + 1} (${g.desaNama}), Kelompok #${k + 1}: Nama kelompok wajib diisi!`);
						cancel();
						return;
					}
				}
			}

			isSubmitting = true;
			return async ({ update }) => {
				isSubmitting = false;
				await update();
			};
		}}
		class="space-y-4"
	>
		<input type="hidden" name="batchData" value={JSON.stringify(groups)} />

		<!-- Loop Grup Wilayah (Daerah & Desa Induk -> Kelompok & Sub-Kelompok) -->
		<div class="space-y-4">
			{#each groups as group, gIdx (group.id)}
				<div class="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs space-y-4 transition-all">
					<!-- Header Grup: Daerah & Desa Induk -->
					<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/70">
						<div class="flex items-center gap-2">
							<span class="inline-flex items-center justify-center px-2 py-0.5 rounded bg-primary/10 text-primary font-mono font-bold text-xs">
								#{gIdx + 1}
							</span>
							<h2 class="text-sm font-bold text-foreground flex items-center gap-1.5">
								<Building class="w-4 h-4 text-primary" />
								<span>{group.desaNama ? `Desa ${group.desaNama}` : 'Grup Desa Baru'}</span>
								{#if group.daerahNama}
									<span class="text-foreground/50 font-normal">({group.daerahNama})</span>
								{/if}
							</h2>
						</div>

						<button
							type="button"
							onclick={() => removeGroup(gIdx)}
							class="p-1.5 text-foreground/50 hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors ml-auto sm:ml-0"
							title="Hapus Grup Wilayah Ini"
						>
							<Trash2 class="w-4 h-4" />
						</button>
					</div>

					<!-- Input Induk Daerah & Desa -->
					<div class="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-secondary/20 rounded-xl border border-border/50 text-xs">
						<div>
							<label for="daerah-{group.id}" class="block text-[11px] font-semibold text-foreground/80 mb-1">
								Nama Daerah *
							</label>
							<input
								id="daerah-{group.id}"
								type="text"
								required
								bind:value={group.daerahNama}
								placeholder="Contoh: Jakarta Selatan"
								list="daerahSuggestions"
								class="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:ring-1 focus:ring-primary"
							/>
						</div>

						<div>
							<label for="desa-{group.id}" class="block text-[11px] font-semibold text-foreground/80 mb-1">
								Nama Desa Induk *
							</label>
							<input
								id="desa-{group.id}"
								type="text"
								required
								bind:value={group.desaNama}
								placeholder="Contoh: Kebayoran Baru"
								class="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs font-semibold text-foreground focus:ring-1 focus:ring-primary"
							/>
						</div>

						<div>
							<label for="kecamatan-{group.id}" class="block text-[11px] font-semibold text-foreground/80 mb-1">
								Kecamatan Administratif (Opsional)
							</label>
							<input
								id="kecamatan-{group.id}"
								type="text"
								bind:value={group.kecamatan}
								placeholder="Contoh: Kebayoran Baru"
								class="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:ring-1 focus:ring-primary"
							/>
						</div>
					</div>

					<!-- Bagian Kelompok-Kelompok di Bawah Desa Ini -->
					<div class="space-y-3 pt-1">
						<span class="text-xs font-bold text-foreground/80 block">
							Kelompok & Sub-Kelompok di Bawah Desa Ini:
						</span>

						<div class="space-y-3">
							{#each group.kelompoks as kl, kIdx (kl.id)}
								<div class="p-3 sm:p-3.5 rounded-xl border border-border/70 bg-background shadow-xs space-y-2.5">
									<div class="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-border/40">
										<div class="flex items-center gap-2">
											<span class="inline-flex items-center justify-center px-1.5 py-0.5 rounded bg-secondary font-mono text-[10px] text-foreground font-semibold">
												KL #{kIdx + 1}
											</span>
											<span class="text-xs font-bold text-foreground">
												{kl.nama || 'Kelompok Baru'}
											</span>
										</div>

										<div class="flex items-center gap-2 ml-auto">
											<button
												type="button"
												onclick={() => addSubKelompok(kl)}
												class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-500/10 text-blue-700 dark:text-blue-300 hover:bg-blue-500/20 transition-colors"
											>
												<Plus class="w-3 h-3" />
												<span>Sub-Kelompok</span>
											</button>

											<button
												type="button"
												onclick={() => removeKelompok(group, kIdx)}
												class="p-1 text-foreground/40 hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
												title="Hapus Kelompok Ini"
											>
												<Trash2 class="w-3.5 h-3.5" />
											</button>
										</div>
									</div>

									<div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
										<div>
											<label for="kl-nama-{kl.id}" class="block text-[10px] font-semibold text-foreground/75 mb-1">
												Nama Kelompok *
											</label>
											<input
												id="kl-nama-{kl.id}"
												type="text"
												required
												bind:value={kl.nama}
												placeholder="Contoh: Kelompok 1"
												class="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs font-medium text-foreground focus:ring-1 focus:ring-primary"
											/>
										</div>

										<div>
											<label for="kl-kelurahan-{kl.id}" class="block text-[10px] font-semibold text-foreground/75 mb-1">
												Kelurahan / Keterangan Domisili
											</label>
											<input
												id="kl-kelurahan-{kl.id}"
												type="text"
												bind:value={kl.kelurahan}
												placeholder="Contoh: Senayan"
												class="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:ring-1 focus:ring-primary"
											/>
										</div>
									</div>

									<!-- Daftar Sub-Kelompok di Bawah Kelompok Ini (Jika Ada) -->
									{#if kl.subKelompoks.length > 0}
										<div class="pt-2 border-t border-border/40 space-y-2">
											<span class="text-[10.5px] font-semibold text-blue-700 dark:text-blue-300 block">
												Sub-Kelompok / Rukun di Kelompok Ini:
											</span>
											{#each kl.subKelompoks as sk, skIdx (sk.id)}
												<div class="flex items-center gap-2 bg-secondary/30 p-2 rounded-lg border border-border/40 text-xs">
													<span class="font-mono text-[10px] text-foreground/60 w-5 text-center">
														{skIdx + 1}.
													</span>
													<input
														type="text"
														bind:value={sk.nama}
														placeholder="Nama Sub-Kelompok (misal: Rukun 1)"
														class="flex-1 bg-card border border-border rounded px-2 py-1 text-xs text-foreground focus:ring-1 focus:ring-primary"
													/>
													<input
														type="text"
														bind:value={sk.keterangan}
														placeholder="Keterangan / RT-RW (opsional)"
														class="flex-1 bg-card border border-border rounded px-2 py-1 text-xs text-foreground focus:ring-1 focus:ring-primary"
													/>
													<button
														type="button"
														onclick={() => removeSubKelompok(kl, skIdx)}
														class="p-1 text-foreground/40 hover:text-destructive rounded"
														title="Hapus Sub-Kelompok"
													>
														<Trash2 class="w-3 h-3" />
													</button>
												</div>
											{/each}
										</div>
									{/if}
								</div>
							{/each}
						</div>

						<!-- Tombol Tambah Kelompok ke Desa Ini -->
						<div class="pt-1">
							<button
								type="button"
								onclick={() => addKelompokToGroup(group)}
								class="w-full py-2 px-3 rounded-xl border border-dashed border-primary/40 bg-primary/[0.04] hover:bg-primary/[0.08] text-primary text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
							>
								<Home class="w-3.5 h-3.5" />
								<span>+ Tambah Kelompok ke Desa Ini</span>
							</button>
						</div>
					</div>
				</div>
			{/each}
		</div>

		<!-- Tombol Tambah Grup Baru di Bawah -->
		<div class="flex justify-center pt-2 pb-1">
			<button
				type="button"
				onclick={addGroup}
				class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-dashed border-border bg-card/60 hover:bg-card hover:border-primary text-xs font-semibold text-foreground/80 hover:text-primary transition-all shadow-xs"
			>
				<Building class="w-4 h-4 text-primary" />
				<span>+ Tambah Grup Desa / Wilayah Baru</span>
			</button>
		</div>

		<!-- Floating / Sticky Action Bar Simpan Batch -->
		<div
			class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-card border border-border rounded-2xl shadow-lg sticky bottom-2 z-20 backdrop-blur-md"
		>
			<div class="flex items-center gap-2 text-xs text-foreground/75">
				<Sparkles class="w-4 h-4 text-primary shrink-0" />
				<span>
					Pastikan nama desa dan kelompok telah terisi lengkap sebelum menyimpan ke database.
				</span>
			</div>

			<div class="flex items-center gap-2.5 justify-end">
				<a
					href="/admin/wilayah"
					class="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-foreground/80 hover:bg-secondary transition-colors"
				>
					Batal
				</a>
				<button
					type="submit"
					disabled={isSubmitting}
					class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition-all shadow-md active:scale-95 disabled:opacity-50"
				>
					{#if isSubmitting}
						<span
							class="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"
						></span>
						<span>Menyimpan Batch Wilayah...</span>
					{:else}
						<Save class="w-4 h-4" />
						<span>Simpan {totalKelompok} Kelompok ({groups.length} Grup Wilayah)</span>
					{/if}
				</button>
			</div>
		</div>
	</form>
</div>

<!-- Datalist Autocomplete Daerah -->
<datalist id="daerahSuggestions">
	{#each data.daerahList as d}
		<option value={d.nama}>{d.kotaKabupaten}</option>
	{/each}
</datalist>

<!-- Modal Paste Spreadsheet -->
{#if showPasteModal}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
		role="dialog"
		aria-modal="true"
	>
		<div class="bg-card border border-border rounded-2xl max-w-2xl w-full p-5 shadow-2xl space-y-4">
			<div class="flex items-center justify-between border-b border-border pb-3">
				<div>
					<h3 class="text-sm font-bold text-foreground flex items-center gap-2">
						<Clipboard class="w-4 h-4 text-primary" />
						<span>Paste dari Excel / Google Sheets</span>
					</h3>
					<p class="text-xs text-foreground/60 mt-0.5">
						Salin (Ctrl+C) kolom dari spreadsheet, lalu tempel (Ctrl+V) ke dalam kotak di bawah ini.
					</p>
				</div>
				<button
					type="button"
					onclick={() => (showPasteModal = false)}
					class="text-foreground/50 hover:text-foreground text-sm font-semibold p-1"
				>
					✕
				</button>
			</div>

			<div class="space-y-2">
				<div
					class="text-[11px] text-foreground/70 bg-secondary/50 p-2.5 rounded-lg border border-border space-y-1"
				>
					<p class="font-semibold text-foreground">💡 Tips Urutan Kolom Sesuai Spreadsheet:</p>
					<p class="font-mono text-[10px] text-foreground/60 overflow-x-auto">
						Daerah | Desa | Kelompok | Sub-Kelompok (opsional) | Kelurahan / Keterangan (opsional)
					</p>
				</div>

				<textarea
					rows="8"
					bind:value={pasteText}
					placeholder="Tempel data di sini (Ctrl+V)..."
					class="w-full bg-background border border-border rounded-xl p-3 text-xs font-mono text-foreground focus:ring-2 focus:ring-primary focus:outline-none resize-none"
				></textarea>
			</div>

			<div class="flex items-center justify-end gap-2 pt-2 border-t border-border">
				<button
					type="button"
					onclick={() => (showPasteModal = false)}
					class="px-4 py-2 rounded-lg border border-border text-xs font-semibold text-foreground/80 hover:bg-secondary transition-colors"
				>
					Batal
				</button>
				<button
					type="button"
					onclick={processPastedSpreadsheet}
					class="px-5 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition-all shadow-sm"
				>
					Proses & Masukkan ke Form
				</button>
			</div>
		</div>
	</div>
{/if}

