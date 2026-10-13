<!--
  @file src/routes/(admin)/admin/keuangan/template-fr/+page.svelte
  @purpose Halaman Spreadsheet Template FR: lembar kerja 4 kolom fleksibel (No, Uraian, Jumlah, Keterangan), pengelolaan Group Tarif (Group A, Group B, dst), duplikasi group cepat, paste dari spreadsheet (Excel/Google Sheets), serta penetapan jamaah secara massal
  @usedBy Route admin '/admin/keuangan/template-fr'
  @dependencies @lucide/svelte, $app/forms, Svelte 5 Runes, $lib/components/SearchableSelect.svelte, $lib/confirm.svelte, $lib/keepScroll.ts
  @publicFunctions formatRupiah, saveSpreadsheet, handleCellPaste, copyJumlahToKeterangan, openDuplicateModal, openAddJamaahModal, openAddPosModal
  @sideEffects Mengirim batch data nilai spreadsheet via ?/saveSpreadsheet, mutasi group via ?/createGroup & ?/duplicateGroup, mutasi pos anggaran via ?/addPos, dan memasukkan jamaah secara massal via ?/assignJamaahToGroup
-->
<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { keepScrollSubmit } from '$lib/keepScroll';
	import SearchableSelect from '$lib/components/SearchableSelect.svelte';
	import {
		AlertCircle,
		ArrowLeft,
		Check,
		ChevronRight,
		Copy,
		CornerDownRight,
		FileSpreadsheet,
		Filter,
		Layers,
		Plus,
		Save,
		Search,
		Trash2,
		Users,
		UserCheck,
		UserPlus,
		X
	} from '@lucide/svelte';
	import type { PageData, ActionData } from './$types';

	let { data, form } = $props<{ data: PageData; form: ActionData }>();

	function formatRupiah(val: number): string {
		return 'Rp ' + Number(val || 0).toLocaleString('id-ID');
	}

	// State Lokal Spreadsheet Cell Values: { [posId]: { nominalJumlah: number, nominalKeterangan: number, keteranganTeks: string } }
	let spreadsheetCells = $state<Record<string, { nominalJumlah: number; nominalKeterangan: number; keteranganTeks: string }>>({});
	let isDirty = $state(false);
	let isSaving = $state(false);

	// Inisialisasi sel spreadsheet saat data group berubah
	$effect(() => {
		const initial: Record<string, { nominalJumlah: number; nominalKeterangan: number; keteranganTeks: string }> = {};
		if (data.categoriesWithPos) {
			for (const cat of data.categoriesWithPos) {
				for (const pos of cat.subPos) {
					const existing = data.groupPosValues?.[pos.id];
					initial[pos.id] = {
						nominalJumlah: existing?.nominalJumlah ?? 0,
						nominalKeterangan: existing?.nominalKeterangan ?? 0,
						keteranganTeks: existing?.keteranganTeks ?? ''
					};
				}
			}
		}
		spreadsheetCells = initial;
		isDirty = false;
	});

	// Hitung Total Jumlah & Total Keterangan Real-time
	const totalJumlah = $derived.by(() => {
		let sum = 0;
		for (const val of Object.values(spreadsheetCells)) {
			sum += Number(val.nominalJumlah || 0);
		}
		return sum;
	});

	const totalKeterangan = $derived.by(() => {
		let sum = 0;
		for (const val of Object.values(spreadsheetCells)) {
			sum += Number(val.nominalKeterangan || 0);
		}
		return sum;
	});

	// Urutan seluruh subPos untuk navigasi & paste multi-baris
	const flatSubPosList = $derived.by(() => {
		const list: Array<any> = [];
		if (data.categoriesWithPos) {
			for (const cat of data.categoriesWithPos) {
				for (const pos of cat.subPos) {
					list.push({ ...pos, categoryLabel: cat.labelKategori });
				}
			}
		}
		return list;
	});

	// Handler Input Sel
	function updateCell(posId: string, field: 'nominalJumlah' | 'nominalKeterangan', rawValue: string) {
		const numeric = parseInt(rawValue.replace(/\D/g, ''), 10) || 0;
		if (!spreadsheetCells[posId]) {
			spreadsheetCells[posId] = { nominalJumlah: 0, nominalKeterangan: 0, keteranganTeks: '' };
		}
		spreadsheetCells[posId][field] = numeric;
		isDirty = true;
	}

	// Fitur 1: Salin Seluruh Kolom Jumlah ke Kolom Keterangan
	function copyJumlahToKeterangan() {
		for (const posId of Object.keys(spreadsheetCells)) {
			spreadsheetCells[posId].nominalKeterangan = spreadsheetCells[posId].nominalJumlah;
		}
		isDirty = true;
	}

	// Fitur 2: Paste dari Clipboard Excel/Google Sheets
	function handleCellPaste(e: ClipboardEvent, startPosIndex: number, field: 'nominalJumlah' | 'nominalKeterangan') {
		const clipboardData = e.clipboardData?.getData('text');
		if (!clipboardData) return;

		// Jika data clipboard mengandung baris baru (\n) atau tab (\t)
		if (clipboardData.includes('\n') || clipboardData.includes('\t')) {
			e.preventDefault();
			const rows = clipboardData.split(/\r?\n/).filter((r) => r.trim().length > 0);

			rows.forEach((rowText, rowOffset) => {
				const targetIndex = startPosIndex + rowOffset;
				if (targetIndex >= flatSubPosList.length) return;

				const targetPos = flatSubPosList[targetIndex];
				const cols = rowText.split('\t');

				if (cols.length >= 2) {
					// Format paste 2 kolom: Jumlah & Keterangan
					const num1 = parseInt(cols[0].replace(/\D/g, ''), 10) || 0;
					const num2 = parseInt(cols[1].replace(/\D/g, ''), 10) || 0;
					if (!spreadsheetCells[targetPos.id]) {
						spreadsheetCells[targetPos.id] = { nominalJumlah: 0, nominalKeterangan: 0, keteranganTeks: '' };
					}
					spreadsheetCells[targetPos.id].nominalJumlah = num1;
					spreadsheetCells[targetPos.id].nominalKeterangan = num2;
				} else if (cols.length === 1) {
					// Format paste 1 kolom ke field yang ditargetkan
					const num = parseInt(cols[0].replace(/\D/g, ''), 10) || 0;
					if (!spreadsheetCells[targetPos.id]) {
						spreadsheetCells[targetPos.id] = { nominalJumlah: 0, nominalKeterangan: 0, keteranganTeks: '' };
					}
					spreadsheetCells[targetPos.id][field] = num;
				}
			});

			isDirty = true;
		}
	}

	// Filter Kelompok & Tahun
	function handleFilterChange(kId: number, yr: number) {
		const url = new URL(page.url.href);
		url.searchParams.set('kelompokId', String(kId));
		url.searchParams.set('tahun', String(yr));
		url.searchParams.delete('groupId');
		goto(url.toString());
	}

	function handleGroupSwitch(gId: string) {
		if (isDirty) {
			if (!confirm('Ada perubahan yang belum disimpan. Tetap berpindah group?')) {
				return;
			}
		}
		const url = new URL(page.url.href);
		url.searchParams.set('groupId', gId);
		goto(url.toString());
	}

	// Modal States
	let showCreateGroupModal = $state(false);
	let newGroupName = $state('');

	let showDuplicateModal = $state(false);
	let duplicateNewName = $state('');

	let showAddPosModal = $state(false);
	let addPosParentId = $state<string | null>(null);
	let addPosParentName = $state('');
	let addPosNama = $state('');

	let showAddJamaahModal = $state(false);
	let searchJamaah = $state('');
	let selectedAnggotaIds = $state<string[]>([]);

	// Jamaah yang belum ada di group terpilih untuk modal assignment
	const availableJamaahForAdd = $derived.by(() => {
		const q = searchJamaah.toLowerCase();
		return (data.allKelompokJamaah || []).filter((j: any) => {
			const matchName = j.namaLengkap.toLowerCase().includes(q) || j.kepalaKeluargaNama.toLowerCase().includes(q);
			return matchName;
		});
	});

	function toggleSelectAllAvailable() {
		if (selectedAnggotaIds.length === availableJamaahForAdd.length) {
			selectedAnggotaIds = [];
		} else {
			selectedAnggotaIds = availableJamaahForAdd.map((j: any) => j.anggotaId);
		}
	}

	function toggleSelectJamaah(id: string) {
		if (selectedAnggotaIds.includes(id)) {
			selectedAnggotaIds = selectedAnggotaIds.filter((item) => item !== id);
		} else {
			selectedAnggotaIds = [...selectedAnggotaIds, id];
		}
	}

	// Serialize Spreadsheet Cells ke JSON string untuk Form Submit
	const serializedCellsData = $derived.by(() => {
		const result = Object.entries(spreadsheetCells).map(([posId, val]) => ({
			posId,
			nominalJumlah: val.nominalJumlah,
			nominalKeterangan: val.nominalKeterangan,
			keteranganTeks: val.keteranganTeks
		}));
		return JSON.stringify(result);
	});
</script>

<svelte:window
	onkeydown={(e) => {
		// Shortcut Ctrl+S atau Cmd+S untuk simpan spreadsheet cepat
		if ((e.ctrlKey || e.metaKey) && e.key === 's') {
			e.preventDefault();
			const saveBtn = document.getElementById('btn-save-spreadsheet');
			if (saveBtn) saveBtn.click();
		}
	}}
/>

<div class="space-y-6 max-w-7xl mx-auto pb-20">
	<!-- HEADER & BREADCRUMB -->
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
		<div>
			<div class="flex items-center gap-2 text-xs text-foreground/60 mb-1">
				<a href="/admin/keuangan" class="hover:text-primary transition-colors flex items-center gap-1">
					<ArrowLeft class="w-3.5 h-3.5" />
					Keuangan
				</a>
				<ChevronRight class="w-3 h-3" />
				<span class="text-foreground font-medium">Template & Pos FR</span>
			</div>
			<div class="flex items-center gap-3">
				<div class="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shadow-xs">
					<FileSpreadsheet class="w-5 h-5" />
				</div>
				<div>
					<h1 class="text-xl font-bold tracking-tight text-foreground">
						Spreadsheet Template FR
					</h1>
					<p class="text-xs text-foreground/60 mt-0.5">
						Lembar kerja 4 kolom fleksibel untuk pengaturan tarif minimum dan riil bayar per kelompok
					</p>
				</div>
			</div>
		</div>

		<!-- FILTER WILAYAH & TAHUN -->
		<div class="flex flex-wrap items-center gap-2 bg-card p-2 rounded-xl border border-border shadow-xs">
			{#if data.accessibleWilayah.kelompokList.length > 1}
				<div class="min-w-44">
					<select
						class="w-full bg-secondary/50 border border-border text-foreground text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
						value={data.selectedKelompokId}
						onchange={(e) => handleFilterChange(Number(e.currentTarget.value), data.tahun)}
					>
						{#each data.accessibleWilayah.kelompokList as k}
							<option value={k.id}>{k.nama}</option>
						{/each}
					</select>
				</div>
			{/if}

			<div class="w-24">
				<select
					class="w-full bg-secondary/50 border border-border text-foreground text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary font-mono font-semibold"
					value={data.tahun}
					onchange={(e) => handleFilterChange(data.selectedKelompokId || 0, Number(e.currentTarget.value))}
				>
					{#each [data.tahun - 1, data.tahun, data.tahun + 1] as yr}
						<option value={yr}>{yr}</option>
					{/each}
				</select>
			</div>
		</div>
	</div>

	<!-- ALERT FEEDBACK -->
	{#if form?.error}
		<div class="bg-destructive/10 border border-destructive/20 text-destructive text-xs p-3.5 rounded-xl flex items-center gap-2.5">
			<AlertCircle class="w-4 h-4 shrink-0" />
			<span>{form.error}</span>
		</div>
	{/if}
	{#if form?.message}
		<div class="bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs p-3.5 rounded-xl flex items-center gap-2.5">
			<Check class="w-4 h-4 shrink-0" />
			<span>{form.message}</span>
		</div>
	{/if}

	{#if !data.selectedKelompokId}
		<div class="p-12 text-center bg-card border border-border rounded-2xl">
			<AlertCircle class="w-10 h-10 text-foreground/40 mx-auto mb-3" />
			<h3 class="text-sm font-semibold text-foreground">Pilih Kelompok Terlebih Dahulu</h3>
			<p class="text-xs text-foreground/60 mt-1">Silakan tentukan kelompok binaan di filter atas untuk membuka lembar kerja.</p>
		</div>
	{:else}
		<!-- BARIS TABS GROUP TARIF (GROUP A, GROUP B, DST) -->
		<div class="bg-card border border-border rounded-2xl p-4 shadow-xs space-y-4">
			<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-border/80">
				<div>
					<span class="text-xs font-bold text-foreground flex items-center gap-1.5">
						<Layers class="w-4 h-4 text-primary" />
						Daftar Group Lembar Kerja
					</span>
					<p class="text-[11px] text-foreground/60 mt-0.5">
						KU bisa membuat beberapa lembar tarif berbeda (misal Group A, Group B) dan menduplikatnya dengan cepat.
					</p>
				</div>

				<div class="flex items-center gap-2">
					<button
						type="button"
						onclick={() => {
							newGroupName = `Group ${String.fromCharCode(65 + data.groups.length)}`;
							showCreateGroupModal = true;
						}}
						class="px-3 py-1.5 rounded-lg border border-border bg-secondary/60 hover:bg-secondary text-foreground text-xs font-semibold flex items-center gap-1.5 transition-colors"
					>
						<Plus class="w-3.5 h-3.5 text-primary" />
						+ Group Baru
					</button>

					{#if data.selectedGroup}
						<button
							type="button"
							onclick={() => {
								duplicateNewName = `${data.selectedGroup.nama} (Salinan)`;
								showDuplicateModal = true;
							}}
							class="px-3 py-1.5 rounded-lg border border-border bg-secondary/60 hover:bg-secondary text-foreground text-xs font-semibold flex items-center gap-1.5 transition-colors"
						>
							<Copy class="w-3.5 h-3.5 text-sky-500" />
							Duplikat Group Ini
						</button>
					{/if}
				</div>
			</div>

			<!-- TAB BUTTONS -->
			<div class="flex items-center gap-2 overflow-x-auto pb-1">
				{#each data.groups as g}
					<button
						type="button"
						onclick={() => handleGroupSwitch(g.id)}
						class="px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap {data.selectedGroupId === g.id
							? 'bg-primary text-primary-foreground shadow-sm'
							: 'bg-secondary/40 hover:bg-secondary text-foreground/70 border border-border/60'}"
					>
						<span>{g.nama}</span>
						{#if data.selectedGroupId === g.id && data.groups.length > 1}
							<form
								method="POST"
								action="?/deleteGroup"
								use:enhance={keepScrollSubmit()}
								class="inline-block"
								onclick={(e) => e.stopPropagation()}
							>
								<input type="hidden" name="kelompokId" value={data.selectedKelompokId} />
								<input type="hidden" name="groupId" value={g.id} />
								<button
									type="submit"
									class="hover:text-destructive transition-colors ml-1"
									title="Hapus group ini"
									onclick={(e) => {
										if (!confirm(`Hapus ${g.nama}? Jamaah di group ini akan dilepas.`)) {
											e.preventDefault();
										}
									}}
								>
									<X class="w-3.5 h-3.5" />
								</button>
							</form>
						{/if}
					</button>
				{/each}
			</div>
		</div>

		<!-- SPREADSHEET TOOLBAR & STATUS -->
		<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-secondary/30 p-3 rounded-xl border border-border">
			<div class="flex items-center gap-2 text-xs">
				<span class="font-bold text-foreground">
					{data.selectedGroup?.nama || 'Group A'}
				</span>
				<span class="text-foreground/40">•</span>
				<span class="text-foreground/60">
					{flatSubPosList.length} Baris Uraian
				</span>
				{#if isDirty}
					<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-600 border border-amber-500/20">
						Belum Disimpan
					</span>
				{:else}
					<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
						Tersimpan
					</span>
				{/if}
			</div>

			<div class="flex items-center gap-2">
				<!-- Tombol Salin Kolom -->
				<button
					type="button"
					onclick={copyJumlahToKeterangan}
					class="px-2.5 py-1.5 rounded-lg border border-border bg-card hover:bg-secondary text-foreground text-xs font-semibold flex items-center gap-1.5 transition-colors"
					title="Salin seluruh angka kolom Jumlah ke kolom Keterangan"
				>
					<CornerDownRight class="w-3.5 h-3.5 text-primary" />
					Salin Jumlah ke Keterangan
				</button>

				<!-- FORM SIMPAN SPREADSHEET -->
				<form
					method="POST"
					action="?/saveSpreadsheet"
					use:enhance={keepScrollSubmit({
						beforeSubmit: () => { isSaving = true; },
						onSuccess: () => { isDirty = false; },
						onFinally: () => { isSaving = false; }
					})}
				>
					<input type="hidden" name="kelompokId" value={data.selectedKelompokId} />
					<input type="hidden" name="groupId" value={data.selectedGroupId} />
					<input type="hidden" name="cellsData" value={serializedCellsData} />
					<button
						id="btn-save-spreadsheet"
						type="submit"
						disabled={isSaving || !data.canEdit}
						class="px-4 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs disabled:opacity-50"
					>
						<Save class="w-3.5 h-3.5" />
						<span>{isSaving ? 'Menyimpan...' : 'Simpan Spreadsheet'}</span>
					</button>
				</form>
			</div>
		</div>

		<!-- TABEL SPREADSHEET 4 KOLOM UTAMA -->
		<div class="bg-card border border-border rounded-2xl shadow-xs overflow-hidden">
			<div class="overflow-x-auto">
				<table class="w-full text-left border-collapse text-xs">
					<thead>
						<tr class="bg-secondary/70 text-foreground/80 border-b border-border font-bold">
							<th class="py-3 px-3 text-center w-14 border-r border-border">No</th>
							<th class="py-3 px-4 border-r border-border min-w-64">Uraian</th>
							<th class="py-3 px-4 border-r border-border w-52 text-right">Jumlah (Min. Disarankan)</th>
							<th class="py-3 px-4 border-r border-border w-52 text-right">Keterangan (Riil Bayar)</th>
							<th class="py-3 px-3 text-center w-16">Aksi</th>
						</tr>
					</thead>
					<tbody>
						{#each data.categoriesWithPos as cat, catIdx}
							<!-- BARIS KATEGORI INDUK (A. Hak Pusat, B. Hak Daerah, dst) -->
							<tr class="bg-secondary/40 border-b border-border font-bold text-foreground">
								<td class="py-2.5 px-3 border-r border-border text-center font-mono text-[11px] text-foreground/60">
									{String.fromCharCode(65 + catIdx)}
								</td>
								<td class="py-2.5 px-4 border-r border-border flex items-center justify-between" colspan="3">
									<span class="tracking-wide">{cat.labelKategori}</span>
									<button
										type="button"
										onclick={() => {
											addPosParentId = cat.id;
											addPosParentName = cat.nama;
											addPosNama = '';
											showAddPosModal = true;
										}}
										class="px-2 py-0.5 rounded-md border border-border/80 bg-card hover:bg-secondary text-[11px] font-semibold text-primary flex items-center gap-1 transition-colors"
									>
										<Plus class="w-3 h-3" />
										+ Tambah Uraian
									</button>
								</td>
								<td class="py-2.5 px-3 text-center border-l border-border"></td>
							</tr>

							<!-- SUB-POS ANAK (1. Isrun/FR, 2. Tenaga SB, dst) -->
							{#if cat.subPos.length === 0}
								<tr class="border-b border-border/60 text-foreground/40 italic">
									<td class="py-2 px-3 text-center border-r border-border">-</td>
									<td class="py-2 px-4 border-r border-border" colspan="3">
										Belum ada uraian di kategori ini. Klik "+ Tambah Uraian".
									</td>
									<td class="py-2 px-3 text-center"></td>
								</tr>
							{:else}
								{#each cat.subPos as pos, posIdx}
									{@const globalIndex = flatSubPosList.findIndex((p) => p.id === pos.id)}
									{@const cell = spreadsheetCells[pos.id] || { nominalJumlah: 0, nominalKeterangan: 0, keteranganTeks: '' }}
									<tr class="border-b border-border/60 hover:bg-secondary/20 transition-colors">
										<!-- KOLOM 1: NO -->
										<td class="py-2 px-3 text-center border-r border-border font-mono text-foreground/70">
											{posIdx + 1}
										</td>

										<!-- KOLOM 2: URAIAN -->
										<td class="py-2 px-4 border-r border-border font-medium text-foreground">
											<div class="flex items-center justify-between gap-2">
												<span>{pos.nama}</span>
												{#if pos.isWajib}
													<span class="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 font-semibold uppercase">
														Wajib
													</span>
												{/if}
											</div>
										</td>

										<!-- KOLOM 3: JUMLAH (INPUT NUMBER FORMATED) -->
										<td class="py-1 px-2 border-r border-border bg-card">
											<div class="relative flex items-center">
												<span class="absolute left-2.5 text-foreground/40 font-mono text-[11px] select-none">Rp</span>
												<input
													type="text"
													inputmode="numeric"
													class="w-full text-right font-mono font-semibold py-1.5 pl-8 pr-2.5 bg-secondary/30 hover:bg-secondary/50 focus:bg-background border border-transparent focus:border-primary rounded-lg text-xs text-foreground focus:outline-none transition-all"
													value={Number(cell.nominalJumlah || 0).toLocaleString('id-ID')}
													oninput={(e) => updateCell(pos.id, 'nominalJumlah', e.currentTarget.value)}
													onpaste={(e) => handleCellPaste(e, globalIndex, 'nominalJumlah')}
													placeholder="0"
												/>
											</div>
										</td>

										<!-- KOLOM 4: KETERANGAN (RIIL BAYAR) -->
										<td class="py-1 px-2 border-r border-border bg-card">
											<div class="relative flex items-center">
												<span class="absolute left-2.5 text-foreground/40 font-mono text-[11px] select-none">Rp</span>
												<input
													type="text"
													inputmode="numeric"
													class="w-full text-right font-mono font-semibold py-1.5 pl-8 pr-2.5 bg-secondary/30 hover:bg-secondary/50 focus:bg-background border border-transparent focus:border-primary rounded-lg text-xs text-foreground focus:outline-none transition-all"
													value={Number(cell.nominalKeterangan || 0).toLocaleString('id-ID')}
													oninput={(e) => updateCell(pos.id, 'nominalKeterangan', e.currentTarget.value)}
													onpaste={(e) => handleCellPaste(e, globalIndex, 'nominalKeterangan')}
													placeholder="0"
												/>
											</div>
										</td>

										<!-- KOLOM 5: AKSI (HAPUS URAIAN) -->
										<td class="py-2 px-3 text-center">
											{#if !pos.isWajib}
												<form
													method="POST"
													action="?/deletePos"
													use:enhance={keepScrollSubmit()}
													class="inline-block"
												>
													<input type="hidden" name="kelompokId" value={data.selectedKelompokId} />
													<input type="hidden" name="posId" value={pos.id} />
													<button
														type="submit"
														class="p-1 rounded text-foreground/40 hover:text-destructive transition-colors"
														title="Hapus baris uraian ini"
														onclick={(e) => {
															if (!confirm(`Hapus uraian "${pos.nama}"?`)) {
																e.preventDefault();
															}
														}}
													>
														<Trash2 class="w-3.5 h-3.5" />
													</button>
												</form>
											{/if}
										</td>
									</tr>
								{/each}
							{/if}
						{/each}

						<!-- BARIS TOTAL PALING BAWAH (PERSIS SEPERTI GAMBAR) -->
						<tr class="bg-secondary/70 border-t-2 border-border font-bold text-foreground">
							<td class="py-3 px-3 text-center border-r border-border"></td>
							<td class="py-3 px-4 border-r border-border tracking-wider uppercase font-extrabold text-sm text-center">
								TOTAL
							</td>
							<td class="py-3 px-4 border-r border-border text-right font-mono font-extrabold text-sm text-primary">
								{formatRupiah(totalJumlah)}
							</td>
							<td class="py-3 px-4 border-r border-border text-right font-mono font-extrabold text-sm text-teal-600 dark:text-teal-400">
								{formatRupiah(totalKeterangan)}
							</td>
							<td class="py-3 px-3"></td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>

		<!-- PANEL PENETAPAN JAMAAH MASSAL (ANGGOTA GROUP INI) -->
		<div class="bg-card border border-border rounded-2xl p-5 shadow-xs space-y-4">
			<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-border">
				<div>
					<div class="flex items-center gap-2">
						<Users class="w-4 h-4 text-primary" />
						<h3 class="text-sm font-bold text-foreground">
							Jamaah di {data.selectedGroup?.nama || 'Group Ini'}
						</h3>
						<span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-primary/10 text-primary">
							{data.jamaahInSelectedGroup.length} Jamaah
						</span>
					</div>
					<p class="text-xs text-foreground/60 mt-0.5">
						Jamaah yang dimasukkan ke group ini akan memiliki target setoran sesuai rincian lembar kerja di atas.
					</p>
				</div>

				<button
					type="button"
					onclick={() => {
						selectedAnggotaIds = [];
						searchJamaah = '';
						showAddJamaahModal = true;
					}}
					class="px-3.5 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold flex items-center gap-2 transition-all shadow-xs"
				>
					<UserPlus class="w-4 h-4" />
					+ Masukkan Jamaah Secara Bersamaan
				</button>
			</div>

			{#if data.jamaahInSelectedGroup.length === 0}
				<div class="p-8 text-center bg-secondary/20 rounded-xl border border-dashed border-border text-foreground/60 text-xs">
					Belum ada jamaah yang dimasukkan ke group ini. Klik tombol <strong>"+ Masukkan Jamaah Secara Bersamaan"</strong> untuk menambahkan beberapa jamaah sekaligus.
				</div>
			{:else}
				<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
					{#each data.jamaahInSelectedGroup as j}
						<div class="p-3 rounded-xl border border-border bg-secondary/30 flex items-center justify-between gap-2">
							<div class="min-w-0">
								<p class="text-xs font-bold text-foreground truncate">{j.namaLengkap}</p>
								<p class="text-[11px] text-foreground/60 truncate">
									KK: {j.kepalaKeluargaNama} • {j.statusHubungan}
								</p>
							</div>

							<form
								method="POST"
								action="?/removeJamaahFromGroup"
								use:enhance={keepScrollSubmit()}
							>
								<input type="hidden" name="kelompokId" value={data.selectedKelompokId} />
								<input type="hidden" name="templateId" value={data.template?.id} />
								<input type="hidden" name="anggotaId" value={j.anggotaId} />
								<button
									type="submit"
									class="p-1 rounded-md text-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors"
									title="Keluarkan dari group ini"
								>
									<X class="w-3.5 h-3.5" />
								</button>
							</form>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>

<!-- MODAL 1: BUAT GROUP BARU -->
{#if showCreateGroupModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
		<div class="bg-card border border-border rounded-2xl max-w-sm w-full p-5 shadow-xl space-y-4">
			<div class="flex items-center justify-between pb-2 border-b border-border">
				<h3 class="text-sm font-bold text-foreground">Buat Group Tarif Baru</h3>
				<button type="button" onclick={() => (showCreateGroupModal = false)} class="text-foreground/50 hover:text-foreground">
					<X class="w-4 h-4" />
				</button>
			</div>

			<form
				method="POST"
				action="?/createGroup"
				use:enhance={keepScrollSubmit({
					onSuccess: () => { showCreateGroupModal = false; }
				})}
				class="space-y-3 text-xs"
			>
				<input type="hidden" name="kelompokId" value={data.selectedKelompokId} />
				<input type="hidden" name="templateId" value={data.template?.id} />

				<div>
					<label for="newGroupNameInput" class="block font-semibold text-foreground mb-1">Nama Group *</label>
					<input
						id="newGroupNameInput"
						type="text"
						name="nama"
						bind:value={newGroupName}
						required
						placeholder="Contoh: Group B, Group Khusus"
						class="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-foreground text-xs focus:ring-1 focus:ring-primary"
					/>
				</div>

				<div class="grid grid-cols-2 gap-2 pt-2">
					<button
						type="button"
						onclick={() => (showCreateGroupModal = false)}
						class="py-2 rounded-lg border border-border font-semibold text-foreground/70 hover:bg-secondary"
					>
						Batal
					</button>
					<button
						type="submit"
						class="py-2 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90"
					>
						Buat Group
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- MODAL 2: DUPLIKAT GROUP INI -->
{#if showDuplicateModal && data.selectedGroup}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
		<div class="bg-card border border-border rounded-2xl max-w-sm w-full p-5 shadow-xl space-y-4">
			<div class="flex items-center justify-between pb-2 border-b border-border">
				<div>
					<h3 class="text-sm font-bold text-foreground">Duplikat Group</h3>
					<p class="text-[11px] text-foreground/60 mt-0.5">Menyalin seluruh angka dari {data.selectedGroup.nama}</p>
				</div>
				<button type="button" onclick={() => (showDuplicateModal = false)} class="text-foreground/50 hover:text-foreground">
					<X class="w-4 h-4" />
				</button>
			</div>

			<form
				method="POST"
				action="?/duplicateGroup"
				use:enhance={keepScrollSubmit({
					onSuccess: () => { showDuplicateModal = false; }
				})}
				class="space-y-3 text-xs"
			>
				<input type="hidden" name="kelompokId" value={data.selectedKelompokId} />
				<input type="hidden" name="templateId" value={data.template?.id} />
				<input type="hidden" name="sourceGroupId" value={data.selectedGroupId} />

				<div>
					<label for="duplicateNewNameInput" class="block font-semibold text-foreground mb-1">Nama Group Baru *</label>
					<input
						id="duplicateNewNameInput"
						type="text"
						name="namaBaru"
						bind:value={duplicateNewName}
						required
						class="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-foreground text-xs focus:ring-1 focus:ring-primary"
					/>
				</div>

				<div class="grid grid-cols-2 gap-2 pt-2">
					<button
						type="button"
						onclick={() => (showDuplicateModal = false)}
						class="py-2 rounded-lg border border-border font-semibold text-foreground/70 hover:bg-secondary"
					>
						Batal
					</button>
					<button
						type="submit"
						class="py-2 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90"
					>
						Duplikat
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- MODAL 3: TAMBAH POS URAIAN BARU DI KATEGORI -->
{#if showAddPosModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
		<div class="bg-card border border-border rounded-2xl max-w-sm w-full p-5 shadow-xl space-y-4">
			<div class="flex items-center justify-between pb-2 border-b border-border">
				<div>
					<h3 class="text-sm font-bold text-foreground">Tambah Baris Uraian</h3>
					<p class="text-[11px] text-foreground/60 mt-0.5">Kategori: {addPosParentName}</p>
				</div>
				<button type="button" onclick={() => (showAddPosModal = false)} class="text-foreground/50 hover:text-foreground">
					<X class="w-4 h-4" />
				</button>
			</div>

			<form
				method="POST"
				action="?/addPos"
				use:enhance={keepScrollSubmit({
					onSuccess: () => { showAddPosModal = false; }
				})}
				class="space-y-3 text-xs"
			>
				<input type="hidden" name="kelompokId" value={data.selectedKelompokId} />
				<input type="hidden" name="parentId" value={addPosParentId} />

				<div>
					<label for="addPosNamaInput" class="block font-semibold text-foreground mb-1">Nama Uraian *</label>
					<input
						id="addPosNamaInput"
						type="text"
						name="nama"
						bind:value={addPosNama}
						required
						placeholder="Contoh: Kas Kegiatan Remaja"
						class="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-foreground text-xs focus:ring-1 focus:ring-primary"
					/>
				</div>

				<div class="grid grid-cols-2 gap-2 pt-2">
					<button
						type="button"
						onclick={() => (showAddPosModal = false)}
						class="py-2 rounded-lg border border-border font-semibold text-foreground/70 hover:bg-secondary"
					>
						Batal
					</button>
					<button
						type="submit"
						class="py-2 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90"
					>
						Tambah Baris
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- MODAL 4: MASUKKAN JAMAAH SECARA BERSAMAAN KE GROUP TERPILIH -->
{#if showAddJamaahModal && data.selectedGroup}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
		<div class="bg-card border border-border rounded-2xl max-w-lg w-full p-5 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
			<div class="flex items-center justify-between pb-2 border-b border-border shrink-0">
				<div>
					<h3 class="text-sm font-bold text-foreground">
						Masukkan Jamaah ke {data.selectedGroup.nama}
					</h3>
					<p class="text-[11px] text-foreground/60 mt-0.5">
						Pilih satu atau banyak jamaah sekaligus untuk dimasukkan ke group ini.
					</p>
				</div>
				<button type="button" onclick={() => (showAddJamaahModal = false)} class="text-foreground/50 hover:text-foreground">
					<X class="w-4 h-4" />
				</button>
			</div>

			<!-- SEARCH & SELECT ALL -->
			<div class="flex items-center gap-2 shrink-0">
				<div class="relative flex-1">
					<Search class="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40" />
					<input
						type="text"
						bind:value={searchJamaah}
						placeholder="Cari nama jamaah atau KK..."
						class="w-full pl-8 pr-3 py-1.5 bg-secondary/50 border border-border rounded-lg text-xs text-foreground focus:ring-1 focus:ring-primary"
					/>
				</div>
				<button
					type="button"
					onclick={toggleSelectAllAvailable}
					class="px-2.5 py-1.5 rounded-lg border border-border bg-secondary/40 hover:bg-secondary text-xs font-semibold text-foreground whitespace-nowrap"
				>
					{selectedAnggotaIds.length === availableJamaahForAdd.length && availableJamaahForAdd.length > 0
						? 'Batal Pilih Semua'
						: 'Pilih Semua'}
				</button>
			</div>

			<!-- LIST CHECKBOX JAMAAH -->
			<div class="flex-1 overflow-y-auto space-y-1.5 pr-1 max-h-72">
				{#if availableJamaahForAdd.length === 0}
					<div class="p-6 text-center text-foreground/40 text-xs">
						Tidak ada jamaah yang cocok dengan pencarian.
					</div>
				{:else}
					{#each availableJamaahForAdd as j}
						{@const isSelected = selectedAnggotaIds.includes(j.anggotaId)}
						<label
							class="flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer {isSelected
								? 'bg-primary/10 border-primary text-foreground'
								: 'bg-secondary/20 hover:bg-secondary/40 border-border text-foreground/80'}"
						>
							<div class="flex items-center gap-2.5 min-w-0">
								<input
									type="checkbox"
									checked={isSelected}
									onchange={() => toggleSelectJamaah(j.anggotaId)}
									class="rounded border-border text-primary focus:ring-primary w-4 h-4"
								/>
								<div class="min-w-0">
									<p class="text-xs font-bold truncate">{j.namaLengkap}</p>
									<p class="text-[11px] text-foreground/60 truncate">
										KK: {j.kepalaKeluargaNama} • {j.statusHubungan}
									</p>
								</div>
							</div>

							{#if j.assignedGroupName}
								<span class="text-[10px] px-2 py-0.5 rounded-md font-semibold whitespace-nowrap {j.isInSelectedGroup
									? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
									: 'bg-secondary text-foreground/60 border border-border'}">
									{j.assignedGroupName}
								</span>
							{:else}
								<span class="text-[10px] px-1.5 py-0.5 rounded text-foreground/40 italic">
									Belum Ada Group
								</span>
							{/if}
						</label>
					{/each}
				{/if}
			</div>

			<!-- FOOTER SUBMIT -->
			<div class="pt-3 border-t border-border flex items-center justify-between shrink-0">
				<span class="text-xs text-foreground/60 font-medium">
					{selectedAnggotaIds.length} jamaah dipilih
				</span>

				<form
					method="POST"
					action="?/assignJamaahToGroup"
					use:enhance={keepScrollSubmit({
						onSuccess: () => {
							showAddJamaahModal = false;
							selectedAnggotaIds = [];
						}
					})}
				>
					<input type="hidden" name="kelompokId" value={data.selectedKelompokId} />
					<input type="hidden" name="templateId" value={data.template?.id} />
					<input type="hidden" name="groupId" value={data.selectedGroupId} />
					<input type="hidden" name="anggotaIds" value={JSON.stringify(selectedAnggotaIds)} />
					<div class="flex gap-2">
						<button
							type="button"
							onclick={() => (showAddJamaahModal = false)}
							class="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-foreground/70 hover:bg-secondary"
						>
							Batal
						</button>
						<button
							type="submit"
							disabled={selectedAnggotaIds.length === 0}
							class="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 disabled:opacity-50 transition-all shadow-xs"
						>
							Masukkan ke Group
						</button>
					</div>
				</form>
			</div>
		</div>
	</div>
{/if}
