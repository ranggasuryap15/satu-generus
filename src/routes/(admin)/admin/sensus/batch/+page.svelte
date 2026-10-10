<!--
  @file src/routes/(admin)/admin/sensus/batch/+page.svelte
  @purpose Antarmuka grid batch insert sensus massal dengan auto-kalkulasi generus, otomatisasi jenis kelamin, penanda perantau tanpa KK, paste spreadsheet, dan opsi pembuatan akun
  @usedBy Route admin '/admin/sensus/batch'
  @dependencies @lucide/svelte, $app/forms, $lib/generus (hitungUmur, hitungStatusGenerus, daftar konstanta), Svelte 5 Runes
  @publicFunctions addRow, removeRow, clearRows, onStatusKeluargaChange, onPerantauToggle, onTanggalLahirOrMenikahChange, processPastedSpreadsheet, toggleAllBuatAkun
  @sideEffects Mengirim payload JSON batchRowsData ke server action untuk eksekusi transaksi database
-->
<script lang="ts">
	import { enhance } from '$app/forms';
	import {
	  DAFTAR_GOLONGAN_DARAH,
	  DAFTAR_ISRUN,
	  DAFTAR_STATUS_GENERUS,
	  DAFTAR_STATUS_JAMAAH,
	  DAFTAR_STATUS_KELUARGA,
	  DAFTAR_STATUS_PERNIKAHAN,
	  hitungStatusGenerus,
	  hitungUmur
	} from '$lib/generus';
	import {
	  AlertCircle,
	  ArrowLeft,
	  CheckCircle2,
	  Clipboard,
	  KeyRound,
	  Plus,
	  Save,
	  Sparkles,
	  Trash2,
	  Users
	} from '@lucide/svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form } = $props<{ data: PageData; form: ActionData }>();

	interface RowData {
		id: string;
		kelompokId: number | string;
		namaLengkap: string;
		jenisKelamin: 'L' | 'P';
		tempatLahir: string;
		tanggalLahir: string;
		umur: number;
		alamat: string;
		profesi: string;
		noTelepon: string;
		statusGenerus: string;
		statusMenikah: 'Belum Menikah' | 'Sudah Menikah';
		statusKeluarga: string;
		noKk: string;
		nik: string;
		statusJamaah: 'Aktif' | 'Tidak Aktif';
		isrun: 'Ya' | 'Tidak';
		golonganDarah: string;
		isPerantau: boolean;
		buatAkun: boolean;
		email: string;
		password: string;
	}

	function createEmptyRow(): RowData {
		return {
			id: Math.random().toString(36).substring(2, 9),
			kelompokId: data.wilayahOptions.kelompokList[0]?.id || '',
			namaLengkap: '',
			jenisKelamin: 'L',
			tempatLahir: '',
			tanggalLahir: '',
			umur: 0,
			alamat: '',
			profesi: '',
			noTelepon: '',
			statusGenerus: 'Usia Nikah',
			statusMenikah: 'Belum Menikah',
			statusKeluarga: 'Kepala Keluarga',
			noKk: '',
			nik: '',
			statusJamaah: 'Aktif',
			isrun: 'Tidak',
			golonganDarah: '-',
			isPerantau: false,
			buatAkun: false,
			email: '',
			password: ''
		};
	}

	let rows = $state<RowData[]>([createEmptyRow()]);
	let defaultPassword = $state('12345678');
	let defaultKelompokId = $state<number | string>(data.wilayahOptions.kelompokList[0]?.id || '');
	let isSubmitting = $state(false);

	// Modal Paste Spreadsheet
	let showPasteModal = $state(false);
	let pasteText = $state('');

	function addRow() {
		const newRow = createEmptyRow();
		newRow.kelompokId = defaultKelompokId;
		rows.push(newRow);
	}

	function removeRow(index: number) {
		if (rows.length === 1) {
			rows = [createEmptyRow()];
			return;
		}
		rows.splice(index, 1);
	}

	function clearRows() {
		if (confirm('Apakah Anda yakin ingin mengosongkan seluruh baris data?')) {
			rows = [createEmptyRow()];
		}
	}

	function toggleAllBuatAkun(checked: boolean) {
		for (const r of rows) {
			r.buatAkun = checked;
		}
	}

	function onTanggalLahirOrMenikahChange(row: RowData) {
		row.umur = hitungUmur(row.tanggalLahir);
		row.statusGenerus = hitungStatusGenerus(row.umur, row.statusMenikah);
	}

	function onStatusKeluargaChange(row: RowData) {
		// Otomatisasi jenis kelamin berdasarkan status keluarga
		if (row.statusKeluarga === 'Bapak') {
			row.jenisKelamin = 'L';
			row.isPerantau = false;
		} else if (row.statusKeluarga === 'Ibu' || row.statusKeluarga === 'Istri') {
			row.jenisKelamin = 'P';
			row.isPerantau = false;
		} else if (row.statusKeluarga === 'Remaja Perantau' || row.statusKeluarga === 'Mandiri') {
			row.isPerantau = true;
			row.noKk = '';
		}
	}

	function onPerantauToggle(row: RowData) {
		if (row.isPerantau) {
			row.noKk = '';
			row.statusKeluarga = 'Remaja Perantau';
		} else {
			if (row.statusKeluarga === 'Remaja Perantau' || row.statusKeluarga === 'Mandiri') {
				row.statusKeluarga = 'Anak';
			}
		}
	}

	// Parsing Text Clipboard dari Google Sheets / Excel
	function processPastedSpreadsheet() {
		if (!pasteText.trim()) return;

		const lines = pasteText.trim().split(/\r?\n/);
		const newParsedRows: RowData[] = [];

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			const cols = line.split('\t').map((c) => c.trim());

			// Lewati baris header jika kolom pertama bernama 'No' atau 'Kelompok'
			if (i === 0 && (cols[0]?.toLowerCase() === 'no' || cols[1]?.toLowerCase() === 'kelompok')) {
				continue;
			}

			// Deteksi layout spreadsheet sesuai screenshot pengguna
			// Layout A (17 kolom):
			// 0: No, 1: Kelompok, 2: Nama Lengkap, 3: Jenis Kelamin, 4: Tempat Lahir, 5: Tanggal Lahir,
			// 6: Umur, 7: Alamat, 8: Profesi, 9: No Telepon, 10: Status Generus, 11: Status Menikah,
			// 12: Status Keluarga, 13: KK (No KK), 14: Status Jama'ah, 15: Isrun, 16: Gol. Darah
			let rNama = '';
			let rJk: 'L' | 'P' = 'L';
			let rTempat = '';
			let rTgl = '';
			let rAlamat = '';
			let rProfesi = '';
			let rTelp = '';
			let rGenerus = '';
			let rMenikah: 'Belum Menikah' | 'Sudah Menikah' = 'Belum Menikah';
			let rKeluarga = 'Anak';
			let rKk = '';
			let rStatusJam: 'Aktif' | 'Tidak Aktif' = 'Aktif';
			let rIsrun: 'Ya' | 'Tidak' = 'Tidak';
			let rGoldar = '-';

			if (cols.length >= 14) {
				// Format Lengkap Spreadsheet
				rNama = cols[2] || '';
				const jkRaw = (cols[3] || '').trim().toUpperCase();
				rJk = (jkRaw === 'P' || jkRaw.startsWith('PEREMPUAN') || jkRaw.startsWith('WANITA')) ? 'P' : 'L';
				rTempat = cols[4] || '';
				rTgl = cols[5] || '';
				rAlamat = cols[7] || '';
				rProfesi = cols[8] || '';
				rTelp = cols[9] || '';
				rGenerus = cols[10] || '';
				rMenikah = cols[11]?.toLowerCase().includes('sudah') ? 'Sudah Menikah' : 'Belum Menikah';
				rKeluarga = cols[12] || 'Anak';
				rKk = cols[13] || '';
				rStatusJam = cols[14]?.toLowerCase().includes('tidak') ? 'Tidak Aktif' : 'Aktif';
				rIsrun = cols[15]?.toLowerCase().includes('ya') ? 'Ya' : 'Tidak';
				rGoldar = cols[16] || '-';
			} else if (cols.length >= 4) {
				// Format Ringkas (Nama, JK, Tgl Lahir, No KK, dst)
				rNama = cols[0] || '';
				const jkRaw = (cols[1] || '').trim().toUpperCase();
				rJk = (jkRaw === 'P' || jkRaw.startsWith('PEREMPUAN') || jkRaw.startsWith('WANITA')) ? 'P' : 'L';
				rTgl = cols[2] || '';
				rKk = cols[3] || '';
				if (cols[4]) rKeluarga = cols[4];
				if (cols[5]) rTelp = cols[5];
				if (cols[6]) rAlamat = cols[6];
			}

			if (!rNama) continue;

			// Otomatisasi jenis kelamin berdasarkan status keluarga jika terdeteksi Bapak / Ibu
			if (rKeluarga.toLowerCase() === 'bapak') {
				rJk = 'L';
			} else if (rKeluarga.toLowerCase() === 'ibu' || rKeluarga.toLowerCase() === 'istri') {
				rJk = 'P';
			}

			// Deteksi perantau
			const isPerantauDetected =
				rKeluarga.toLowerCase().includes('perantau') ||
				rKeluarga.toLowerCase() === 'mandiri' ||
				!rKk;

			// Normalisasi tanggal lahir jika format DD-MM-YYYY atau YYYY-MM-DD
			let umurCalc = hitungUmur(rTgl);
			let finalGenerus = rGenerus || hitungStatusGenerus(umurCalc, rMenikah);

			newParsedRows.push({
				id: Math.random().toString(36).substring(2, 9),
				kelompokId: defaultKelompokId,
				namaLengkap: rNama,
				jenisKelamin: rJk,
				tempatLahir: rTempat,
				tanggalLahir: rTgl,
				umur: umurCalc,
				alamat: rAlamat,
				profesi: rProfesi,
				noTelepon: rTelp,
				statusGenerus: finalGenerus,
				statusMenikah: rMenikah,
				statusKeluarga: isPerantauDetected && (rKeluarga === 'Anak' || !rKeluarga) ? 'Remaja Perantau' : rKeluarga,
				noKk: isPerantauDetected ? '' : rKk,
				nik: '',
				statusJamaah: rStatusJam,
				isrun: rIsrun,
				golonganDarah: rGoldar,
				isPerantau: isPerantauDetected,
				buatAkun: false,
				email: '',
				password: ''
			});
		}

		if (newParsedRows.length > 0) {
			if (rows.length === 1 && !rows[0].namaLengkap) {
				rows = newParsedRows;
			} else {
				rows = [...rows, ...newParsedRows];
			}
			pasteText = '';
			showPasteModal = false;
		} else {
			alert('Tidak ada data baris yang berhasil dikenali. Pastikan Anda menyalin kolom dari Excel / Google Sheets.');
		}
	}

	const totalAkunDipilih = $derived(rows.filter((r) => r.buatAkun).length);
	const totalPerantau = $derived(rows.filter((r) => r.isPerantau).length);
	const estimasiKeluarga = $derived(
		new Set(rows.filter((r) => !r.isPerantau && r.noKk?.trim()).map((r) => r.noKk.trim())).size
	);
</script>

<svelte:head>
	<title>Batch Insert Sensus - Satu Generus</title>
</svelte:head>

<div class="space-y-4 max-w-[100vw] overflow-x-hidden p-2 sm:p-4">
	<!-- Top Navigation & Action Header -->
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card border border-border p-4 rounded-xl shadow-sm">
		<div class="flex items-center gap-3">
			<a
				href="/admin/sensus"
				class="p-2 rounded-lg border border-border bg-secondary/40 hover:bg-secondary text-foreground/80 hover:text-foreground transition-colors"
				title="Kembali ke Daftar Sensus"
			>
				<ArrowLeft class="w-4 h-4" />
			</a>
			<div>
				<h1 class="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
					<Users class="w-5 h-5 text-primary" />
					<span>Batch Insert Sensus Jamaah</span>
				</h1>
				<p class="text-xs text-foreground/60">
					Impor atau input data sensus massal lengkap dengan kalkulasi otomatis generus dan pembuatan akun.
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
				onclick={addRow}
				class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-secondary/50 hover:bg-secondary text-foreground text-xs font-semibold transition-colors"
			>
				<Plus class="w-3.5 h-3.5" />
				<span>Tambah Baris</span>
			</button>

			<button
				type="button"
				onclick={clearRows}
				class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-destructive/30 hover:bg-destructive/10 text-destructive text-xs font-medium transition-colors"
			>
				<Trash2 class="w-3.5 h-3.5" />
				<span>Kosongkan</span>
			</button>
		</div>
	</div>

	<!-- Global Batch Defaults Bar -->
	<div class="grid grid-cols-1 md:grid-cols-4 gap-3 bg-secondary/30 border border-border p-3.5 rounded-xl text-xs">
		<div>
			<label for="defaultKelompokSelect" class="block font-semibold text-foreground/80 mb-1">
				Kelompok Default
			</label>
			<select
				id="defaultKelompokSelect"
				bind:value={defaultKelompokId}
				class="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:ring-1 focus:ring-primary"
			>
				{#each data.wilayahOptions.kelompokList as k}
					<option value={k.id}>{k.nama} (Desa {k.desaNama || '-'})</option>
				{/each}
			</select>
		</div>

		<div>
			<label for="defaultPasswordInput" class="block font-semibold text-foreground/80 mb-1 flex items-center gap-1">
				<KeyRound class="w-3.5 h-3.5 text-primary" />
				<span>Password Default Akun</span>
			</label>
			<input
				id="defaultPasswordInput"
				type="text"
				bind:value={defaultPassword}
				placeholder="12345678"
				class="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs font-mono text-foreground focus:ring-1 focus:ring-primary"
			/>
		</div>

		<div class="flex items-center gap-2 pt-4">
			<label class="inline-flex items-center gap-2 cursor-pointer font-medium text-foreground select-none">
				<input
					type="checkbox"
					onchange={(e) => toggleAllBuatAkun(e.currentTarget.checked)}
					class="w-4 h-4 rounded border-border text-primary focus:ring-primary accent-primary"
				/>
				<span>Buatkan Akun Semua Baris</span>
			</label>
		</div>

		<div class="flex items-center justify-end gap-3 text-right pt-2 md:pt-4">
			<div class="text-[11px] text-foreground/70">
				<span class="font-bold text-foreground">{rows.length}</span> jiwa •
				<span class="font-bold text-foreground">{estimasiKeluarga}</span> KK •
				<span class="font-bold text-blue-600 dark:text-blue-400">{totalPerantau}</span> perantau •
				<span class="font-bold text-primary">{totalAkunDipilih}</span> akun baru
			</div>
		</div>
	</div>

	<!-- Notifikasi Feedback Server -->
	{#if form?.error}
		<div class="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-xl">
			<AlertCircle class="w-4 h-4 shrink-0" />
			<span>{form.error}</span>
		</div>
	{/if}

	{#if form?.success}
		<div class="flex items-center justify-between p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs rounded-xl">
			<div class="flex items-center gap-2">
				<CheckCircle2 class="w-4 h-4 shrink-0" />
				<span>
					Berhasil menyimpan <strong>{form.summary?.totalJiwa}</strong> jiwa ke dalam <strong>{form.summary?.totalKeluarga}</strong> keluarga (dan <strong>{form.summary?.totalAkun}</strong> akun login)!
				</span>
			</div>
			<a
				href="/admin/sensus"
				class="px-3 py-1 rounded bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition-colors"
			>
				Lihat di Rekap Sensus
			</a>
		</div>
	{/if}

	<!-- Spreadsheet Grid Form -->
	<form
		method="POST"
		use:enhance={() => {
			isSubmitting = true;
			return async ({ update }) => {
				isSubmitting = false;
				await update();
			};
		}}
		class="space-y-4"
	>
		<input type="hidden" name="batchData" value={JSON.stringify(rows)} />
		<input type="hidden" name="defaultPassword" value={defaultPassword} />
		<input type="hidden" name="defaultKelompokId" value={String(defaultKelompokId)} />

		<!-- Table Container with Horizontal Scroll -->
		<div class="border border-border rounded-xl bg-card overflow-hidden shadow-sm">
			<div class="overflow-x-auto max-h-[68vh] relative">
				<table class="w-full text-left text-xs border-collapse min-w-[1950px]">
					<thead class="bg-secondary/80 backdrop-blur sticky top-0 z-10 border-b border-border text-[11px] text-foreground/80 font-bold uppercase tracking-wider">
						<tr>
							<th class="p-2 w-10 text-center">#</th>
							<th class="p-2 w-24 text-center bg-blue-500/10 text-blue-700 dark:text-blue-300">Perantau?</th>
							<th class="p-2 w-28">No. KK / Kode</th>
							<th class="p-2 w-44">Nama Lengkap *</th>
							<th class="p-2 w-28">Jenis Kelamin</th>
							<th class="p-2 w-28">Tempat Lahir</th>
							<th class="p-2 w-32">Tgl Lahir *</th>
							<th class="p-2 w-16 text-center">Umur</th>
							<th class="p-2 w-36">Status Generus</th>
							<th class="p-2 w-32">Status Nikah</th>
							<th class="p-2 w-36">Hub. Keluarga</th>
							<th class="p-2 w-32">No. HP / WA</th>
							<th class="p-2 w-32">Profesi</th>
							<th class="p-2 w-44">Alamat Domisili</th>
							<th class="p-2 w-20">Gol. Darah</th>
							<th class="p-2 w-28 bg-primary/5">Status Jamaah</th>
							<th class="p-2 w-20 bg-primary/5">Isrun</th>
							<th class="p-2 w-28 text-center bg-amber-500/5">Buat Akun</th>
							<th class="p-2 w-36 bg-amber-500/5">Email Login</th>
							<th class="p-2 w-10 text-center">Aksi</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-border/60">
						{#each rows as row, idx (row.id)}
							<tr class="hover:bg-secondary/20 transition-colors">
								<!-- # Index -->
								<td class="p-2 text-center text-foreground/50 font-mono text-[11px]">
									{idx + 1}
								</td>

								<!-- Perantau Checklist -->
								<td class="p-1.5 text-center bg-blue-500/5">
									<label class="inline-flex items-center justify-center cursor-pointer">
										<input
											type="checkbox"
											bind:checked={row.isPerantau}
											onchange={() => onPerantauToggle(row)}
											class="w-4 h-4 rounded border-border text-blue-600 focus:ring-blue-500"
											title="Centang jika Remaja Perantauan (tanpa KK)"
										/>
									</label>
								</td>

								<!-- No KK / Kode KK -->
								<td class="p-1.5">
									<input
										type="text"
										bind:value={row.noKk}
										disabled={row.isPerantau}
										placeholder={row.isPerantau ? 'Tanpa KK' : 'No KK'}
										class="w-full bg-background border border-border rounded px-2 py-1 text-xs font-mono text-foreground focus:ring-1 focus:ring-primary disabled:opacity-50 disabled:bg-secondary/40"
									/>
								</td>

								<!-- Nama Lengkap -->
								<td class="p-1.5">
									<input
										type="text"
										required
										bind:value={row.namaLengkap}
										placeholder="Nama Lengkap"
										class="w-full bg-background border border-border rounded px-2 py-1 text-xs text-foreground font-medium focus:ring-1 focus:ring-primary"
									/>
								</td>

								<!-- Jenis Kelamin -->
								<td class="p-1.5">
									<select
										bind:value={row.jenisKelamin}
										class="w-full bg-background border border-border rounded px-1.5 py-1 text-xs text-foreground focus:ring-1 focus:ring-primary"
									>
										<option value="L">L (Laki-laki)</option>
										<option value="P">P (Perempuan)</option>
									</select>
								</td>

								<!-- Tempat Lahir -->
								<td class="p-1.5">
									<input
										type="text"
										bind:value={row.tempatLahir}
										placeholder="Contoh: Bekasi"
										class="w-full bg-background border border-border rounded px-2 py-1 text-xs text-foreground focus:ring-1 focus:ring-primary"
									/>
								</td>

								<!-- Tanggal Lahir -->
								<td class="p-1.5">
									<input
										type="text"
										required
										bind:value={row.tanggalLahir}
										onblur={() => onTanggalLahirOrMenikahChange(row)}
										placeholder="YYYY-MM-DD"
										class="w-full bg-background border border-border rounded px-2 py-1 text-xs font-mono text-foreground focus:ring-1 focus:ring-primary"
									/>
								</td>

								<!-- Umur (Calculated) -->
								<td class="p-1.5 text-center">
									<span class="inline-block px-2 py-0.5 rounded font-mono font-bold text-xs bg-secondary text-foreground">
										{row.umur || 0}
									</span>
								</td>

								<!-- Status Generus (Auto & Selectable) -->
								<td class="p-1.5">
									<select
										bind:value={row.statusGenerus}
										class="w-full bg-background border border-border rounded px-2 py-1 text-xs font-semibold text-primary focus:ring-1 focus:ring-primary"
									>
										{#each DAFTAR_STATUS_GENERUS as g}
											<option value={g}>{g}</option>
										{/each}
									</select>
								</td>

								<!-- Status Menikah -->
								<td class="p-1.5">
									<select
										bind:value={row.statusMenikah}
										onchange={() => onTanggalLahirOrMenikahChange(row)}
										class="w-full bg-background border border-border rounded px-1.5 py-1 text-xs text-foreground focus:ring-1 focus:ring-primary"
									>
										{#each DAFTAR_STATUS_PERNIKAHAN as sm}
											<option value={sm}>{sm}</option>
										{/each}
									</select>
								</td>

								<!-- Status Keluarga (Bapak, Ibu, Anak, dll) -->
								<td class="p-1.5">
									<select
										bind:value={row.statusKeluarga}
										onchange={() => onStatusKeluargaChange(row)}
										class="w-full bg-background border border-border rounded px-1.5 py-1 text-xs text-foreground focus:ring-1 focus:ring-primary"
									>
										{#each DAFTAR_STATUS_KELUARGA as sk}
											<option value={sk}>{sk}</option>
										{/each}
									</select>
								</td>

								<!-- No Telepon -->
								<td class="p-1.5">
									<input
										type="text"
										bind:value={row.noTelepon}
										placeholder="0812xxxx"
										class="w-full bg-background border border-border rounded px-2 py-1 text-xs font-mono text-foreground focus:ring-1 focus:ring-primary"
									/>
								</td>

								<!-- Profesi -->
								<td class="p-1.5">
									<input
										type="text"
										bind:value={row.profesi}
										placeholder="Contoh: Karyawan"
										class="w-full bg-background border border-border rounded px-2 py-1 text-xs text-foreground focus:ring-1 focus:ring-primary"
									/>
								</td>

								<!-- Alamat -->
								<td class="p-1.5">
									<input
										type="text"
										bind:value={row.alamat}
										placeholder="Alamat domisili"
										class="w-full bg-background border border-border rounded px-2 py-1 text-xs text-foreground focus:ring-1 focus:ring-primary"
									/>
								</td>

								<!-- Golongan Darah -->
								<td class="p-1.5">
									<select
										bind:value={row.golonganDarah}
										class="w-full bg-background border border-border rounded px-1.5 py-1 text-xs text-foreground focus:ring-1 focus:ring-primary"
									>
										{#each DAFTAR_GOLONGAN_DARAH as gd}
											<option value={gd}>{gd}</option>
										{/each}
									</select>
								</td>

								<!-- Status Jamaah (Admin Only) -->
								<td class="p-1.5 bg-primary/5">
									<select
										bind:value={row.statusJamaah}
										class="w-full bg-background border border-border rounded px-1.5 py-1 text-xs text-foreground focus:ring-1 focus:ring-primary"
									>
										{#each DAFTAR_STATUS_JAMAAH as sj}
											<option value={sj}>{sj}</option>
										{/each}
									</select>
								</td>

								<!-- Isrun (Admin Only) -->
								<td class="p-1.5 bg-primary/5">
									<select
										bind:value={row.isrun}
										class="w-full bg-background border border-border rounded px-1.5 py-1 text-xs text-foreground focus:ring-1 focus:ring-primary"
									>
										{#each DAFTAR_ISRUN as isr}
											<option value={isr}>{isr}</option>
										{/each}
									</select>
								</td>

								<!-- Buat Akun? -->
								<td class="p-1.5 text-center bg-amber-500/5">
									<input
										type="checkbox"
										bind:checked={row.buatAkun}
										class="w-4 h-4 rounded border-border text-primary focus:ring-primary accent-primary"
									/>
								</td>

								<!-- Email Login (Opsional) -->
								<td class="p-1.5 bg-amber-500/5">
									<input
										type="email"
										disabled={!row.buatAkun}
										bind:value={row.email}
										placeholder={row.buatAkun ? 'Email (opsional)' : '-'}
										class="w-full bg-background border border-border rounded px-2 py-1 text-xs text-foreground focus:ring-1 focus:ring-primary disabled:opacity-40"
									/>
								</td>

								<!-- Hapus Baris -->
								<td class="p-1.5 text-center">
									<button
										type="button"
										onclick={() => removeRow(idx)}
										class="p-1 text-foreground/40 hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
										title="Hapus Baris Ini"
									>
										<Trash2 class="w-3.5 h-3.5" />
									</button>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>

		<!-- Submit Action Floating Bar -->
		<div class="flex items-center justify-between p-4 bg-card border border-border rounded-xl shadow-lg">
			<div class="flex items-center gap-2 text-xs text-foreground/70">
				<Sparkles class="w-4 h-4 text-primary" />
				<span>
					Pastikan data tanggal lahir terisi dengan format YYYY-MM-DD agar status generus terhitung akurat.
				</span>
			</div>

			<div class="flex items-center gap-2">
				<a
					href="/admin/sensus"
					class="px-4 py-2 rounded-lg border border-border text-xs font-semibold text-foreground/80 hover:bg-secondary transition-colors"
				>
					Batal
				</a>
				<button
					type="submit"
					disabled={isSubmitting}
					class="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition-all shadow-md active:scale-95 disabled:opacity-50"
				>
					{#if isSubmitting}
						<span class="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
						<span>Menyimpan Batch...</span>
					{:else}
						<Save class="w-4 h-4" />
						<span>Simpan {rows.length} Baris Sensus</span>
					{/if}
				</button>
			</div>
		</div>
	</form>
</div>

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
						Salin (Ctrl+C) rentang kolom dari Google Sheets, lalu tempel (Ctrl+V) ke dalam kotak di bawah ini.
					</p>
				</div>
				<button
					type="button"
					onclick={() => (showPasteModal = false)}
					class="text-foreground/50 hover:text-foreground text-sm font-semibold"
				>
					✕
				</button>
			</div>

			<div class="space-y-2">
				<div class="text-[11px] text-foreground/70 bg-secondary/50 p-2.5 rounded-lg border border-border space-y-1">
					<p class="font-semibold text-foreground">💡 Tips Urutan Kolom Sesuai Spreadsheet:</p>
					<p class="font-mono text-[10px] text-foreground/60 overflow-x-auto">
						No | Kelompok | Nama Lengkap | JK | Tempat Lahir | Tgl Lahir | Umur | Alamat | Profesi | No HP | Status Generus | Status Menikah | Status Keluarga | No KK | Status Jamaah | Isrun | Gol. Darah
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
					Proses & Masukkan ke Tabel
				</button>
			</div>
		</div>
	</div>
{/if}

