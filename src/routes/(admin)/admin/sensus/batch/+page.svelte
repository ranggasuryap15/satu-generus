<!--
  @file src/routes/(admin)/admin/sensus/batch/+page.svelte
  @purpose Antarmuka batch insert sensus massal terstruktur berbasis grouping keluarga hierarkis (Kepala Keluarga & Anggota otomatis terikat ke KK yang sama dengan atau tanpa No KK), auto-kalkulasi generus, layout form dinamis yang otomatis wrap di desktop & mobile, paste spreadsheet otomatis grouping, dan opsi pembuatan akun
  @usedBy Route admin '/admin/sensus/batch'
  @dependencies @lucide/svelte, $app/forms, $lib/generus (hitungUmur, hitungStatusGenerus, getDaftarStatusKeluargaByGender, daftar konstanta), Svelte 5 Runes
  @publicFunctions addFamily, addPerantauFamily, removeFamily, addMemberToFamily, removeMember, clearFamilies, onJenisKelaminChange, onStatusKeluargaChange, onTanggalLahirOrMenikahChange, processPastedSpreadsheet, toggleAllBuatAkun
  @sideEffects Mengirim payload JSON batchData (FamilyBatchGroup[]) ke server action untuk transaksi database atomik
-->
<script lang="ts">
	import { enhance } from '$app/forms';
	import {
		DAFTAR_GOLONGAN_DARAH,
		DAFTAR_ISRUN,
		DAFTAR_STATUS_GENERUS,
		DAFTAR_STATUS_JAMAAH,
		DAFTAR_STATUS_PERNIKAHAN,
		getDaftarStatusKeluargaByGender,
		hitungStatusGenerus,
		hitungUmur
	} from '$lib/generus';
	import {
		AlertCircle,
		ArrowLeft,
		CheckCircle2,
		Clipboard,
		Home,
		KeyRound,
		Plus,
		Save,
		Sparkles,
		Trash2,
		UserPlus,
		Users
	} from '@lucide/svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form } = $props<{ data: PageData; form: ActionData }>();

	export interface MemberRowData {
		id: string;
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
		nik: string;
		statusJamaah: 'Aktif' | 'Tidak Aktif';
		isrun: 'Ya' | 'Tidak';
		golonganDarah: string;
		buatAkun: boolean;
		email: string;
		password: string;
	}

	export interface FamilyGroupData {
		id: string;
		noKk: string;
		alamat: string;
		isPerantau: boolean;
		kelompokId: number | string;
		members: MemberRowData[];
	}

	let defaultPassword = $state('jokam354');
	let defaultKelompokId = $state<number | string>(data.wilayahOptions.kelompokList[0]?.id || '');
	let isSubmitting = $state(false);

	// Modal Paste Spreadsheet
	let showPasteModal = $state(false);
	let pasteText = $state('');

	function createEmptyMember(
		statusKeluargaDefault = 'Kepala Keluarga',
		jenisKelaminDefault: 'L' | 'P' = 'L'
	): MemberRowData {
		return {
			id: Math.random().toString(36).substring(2, 9),
			namaLengkap: '',
			jenisKelamin: jenisKelaminDefault,
			tempatLahir: '',
			tanggalLahir: '',
			umur: 0,
			alamat: '',
			profesi: '',
			noTelepon: '',
			statusGenerus: 'Usia Nikah',
			statusMenikah: 'Belum Menikah',
			statusKeluarga: statusKeluargaDefault,
			nik: '',
			statusJamaah: 'Aktif',
			isrun: 'Tidak',
			golonganDarah: '-',
			buatAkun: false,
			email: '',
			password: ''
		};
	}

	function createEmptyFamily(isPerantau = false): FamilyGroupData {
		const status = isPerantau ? 'Mandiri / Perantau' : 'Kepala Keluarga';
		const jk: 'L' | 'P' = 'L';
		return {
			id: Math.random().toString(36).substring(2, 9),
			noKk: '',
			alamat: '',
			isPerantau,
			kelompokId: defaultKelompokId,
			members: [createEmptyMember(status, jk)]
		};
	}

	let families = $state<FamilyGroupData[]>([createEmptyFamily(false)]);

	function addFamily() {
		families.push(createEmptyFamily(false));
	}

	function addPerantauFamily() {
		families.push(createEmptyFamily(true));
	}

	function removeFamily(index: number) {
		if (families.length === 1) {
			families = [createEmptyFamily(false)];
			return;
		}
		families.splice(index, 1);
	}

	function addMemberToFamily(family: FamilyGroupData) {
		// Tentukan default status hubungan berdasarkan struktur anggota yang sudah ada
		let defaultStatus = 'Anak';
		let defaultJk: 'L' | 'P' = 'L';

		const hasIstri = family.members.some(
			(m) => m.statusKeluarga === 'Istri' || m.statusKeluarga === 'Ibu'
		);
		if (!hasIstri && family.members.length === 1 && !family.isPerantau) {
			defaultStatus = 'Istri';
			defaultJk = 'P';
		} else if (family.isPerantau) {
			defaultStatus = 'Mandiri / Perantau';
		}

		const newMember = createEmptyMember(defaultStatus, defaultJk);
		// Wariskan alamat keluarga jika sudah diisi
		if (family.alamat.trim()) {
			newMember.alamat = family.alamat.trim();
		}

		family.members.push(newMember);
	}

	function removeMember(family: FamilyGroupData, memberIndex: number) {
		if (family.members.length === 1) {
			if (confirm('Keluarga ini hanya memiliki 1 anggota. Hapus seluruh kartu keluarga ini?')) {
				const famIdx = families.indexOf(family);
				if (famIdx !== -1) {
					removeFamily(famIdx);
				}
			}
			return;
		}
		family.members.splice(memberIndex, 1);
	}

	function clearFamilies() {
		if (confirm('Apakah Anda yakin ingin mengosongkan seluruh data keluarga & sensus?')) {
			families = [createEmptyFamily(false)];
		}
	}

	function toggleAllBuatAkun(checked: boolean) {
		for (const fam of families) {
			for (const m of fam.members) {
				m.buatAkun = checked;
			}
		}
	}

	function onTanggalLahirOrMenikahChange(member: MemberRowData) {
		member.umur = hitungUmur(member.tanggalLahir);
		member.statusGenerus = hitungStatusGenerus(member.umur, member.statusMenikah);
	}

	function onJenisKelaminChange(member: MemberRowData) {
		const allowed = getDaftarStatusKeluargaByGender(member.jenisKelamin);
		if (member.statusKeluarga && !allowed.includes(member.statusKeluarga as any)) {
			member.statusKeluarga = '';
		}
	}

	function onStatusKeluargaChange(member: MemberRowData) {
		if (member.statusKeluarga === 'Bapak' || member.statusKeluarga === 'Kepala Keluarga') {
			member.jenisKelamin = 'L';
		} else if (member.statusKeluarga === 'Ibu' || member.statusKeluarga === 'Istri') {
			member.jenisKelamin = 'P';
		}
	}

	function onFamilyPerantauToggle(family: FamilyGroupData) {
		if (family.isPerantau) {
			family.noKk = '';
			for (const m of family.members) {
				m.statusKeluarga = 'Mandiri / Perantau';
			}
		} else {
			if (family.members[0] && family.members[0].statusKeluarga === 'Mandiri / Perantau') {
				family.members[0].statusKeluarga = 'Kepala Keluarga';
			}
		}
	}

	// Parsing Text Clipboard dari Google Sheets / Excel dengan grouping keluarga otomatis
	function processPastedSpreadsheet() {
		if (!pasteText.trim()) return;

		const lines = pasteText.trim().split(/\r?\n/);
		const parsedFamilies: FamilyGroupData[] = [];
		let currentFamily: FamilyGroupData | null = null;
		const kkMap = new Map<string, FamilyGroupData>();

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			const cols = line.split('\t').map((c) => c.trim());

			// Lewati baris header jika kolom pertama bernama 'No' atau 'Kelompok'
			if (i === 0 && (cols[0]?.toLowerCase() === 'no' || cols[1]?.toLowerCase() === 'kelompok')) {
				continue;
			}

			let rNama = '';
			let rJk: 'L' | 'P' = 'L';
			let rTempat = '';
			let rTgl = '';
			let rAlamat = '';
			let rProfesi = '';
			let rTelp = '';
			let rGenerus = '';
			let rMenikah: 'Belum Menikah' | 'Sudah Menikah' = 'Belum Menikah';
			let rKeluarga = '';
			let rKk = '';
			let rStatusJam: 'Aktif' | 'Tidak Aktif' = 'Aktif';
			let rIsrun: 'Ya' | 'Tidak' = 'Tidak';
			let rGoldar = '-';

			if (cols.length >= 14) {
				// Format Lengkap Spreadsheet
				rNama = cols[2] || '';
				const jkRaw = (cols[3] || '').trim().toUpperCase();
				rJk = jkRaw === 'P' || jkRaw.startsWith('PEREMPUAN') || jkRaw.startsWith('WANITA') ? 'P' : 'L';
				rTempat = cols[4] || '';
				rTgl = cols[5] || '';
				rAlamat = cols[7] || '';
				rProfesi = cols[8] || '';
				rTelp = cols[9] || '';
				rGenerus = cols[10] || '';
				rMenikah = cols[11]?.toLowerCase().includes('sudah') ? 'Sudah Menikah' : 'Belum Menikah';
				rKeluarga = cols[12]?.trim() || '';
				rKk = cols[13] || '';
				rStatusJam = cols[14]?.toLowerCase().includes('tidak') ? 'Tidak Aktif' : 'Aktif';
				rIsrun = cols[15]?.toLowerCase().includes('ya') ? 'Ya' : 'Tidak';
				rGoldar = cols[16] || '-';
			} else if (cols.length >= 4) {
				// Format Ringkas (Nama, JK, Tgl Lahir, No KK, dst)
				rNama = cols[0] || '';
				const jkRaw = (cols[1] || '').trim().toUpperCase();
				rJk = jkRaw === 'P' || jkRaw.startsWith('PEREMPUAN') || jkRaw.startsWith('WANITA') ? 'P' : 'L';
				rTgl = cols[2] || '';
				rKk = cols[3] || '';
				if (cols[4]) rKeluarga = cols[4].trim();
				if (cols[5]) rTelp = cols[5];
				if (cols[6]) rAlamat = cols[6];
			}

			if (!rNama) continue;

			// Normalisasi hubungan keluarga & jenis kelamin
			if (rKeluarga.toLowerCase() === 'bapak' || rKeluarga.toLowerCase() === 'kepala keluarga') {
				rJk = 'L';
			} else if (rKeluarga.toLowerCase() === 'ibu' || rKeluarga.toLowerCase() === 'istri') {
				rJk = 'P';
			}

			const allowedStatuses = getDaftarStatusKeluargaByGender(rJk);
			let finalKeluarga = '';
			const matched = allowedStatuses.find((s) => s.toLowerCase() === rKeluarga.toLowerCase());
			if (matched) {
				finalKeluarga = matched;
			} else {
				finalKeluarga = rKeluarga || (rJk === 'L' ? 'Anak' : 'Anak');
			}

			const isPerantauDetected =
				rKeluarga.toLowerCase().includes('perantau') ||
				rKeluarga.toLowerCase().includes('mandiri');

			if (isPerantauDetected) {
				finalKeluarga = 'Mandiri / Perantau';
			}

			const umurCalc = hitungUmur(rTgl);
			const finalGenerus = rGenerus || hitungStatusGenerus(umurCalc, rMenikah);

			const newMemberData: MemberRowData = {
				id: Math.random().toString(36).substring(2, 9),
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
				statusKeluarga: finalKeluarga,
				nik: '',
				statusJamaah: rStatusJam,
				isrun: rIsrun,
				golonganDarah: rGoldar,
				buatAkun: false,
				email: '',
				password: ''
			};

			// Grouping ke dalam keluarga:
			if (isPerantauDetected) {
				// Perantau / Mandiri dibuatkan kartu terpisah
				const perantauFam: FamilyGroupData = {
					id: Math.random().toString(36).substring(2, 9),
					noKk: '',
					alamat: rAlamat,
					isPerantau: true,
					kelompokId: defaultKelompokId,
					members: [newMemberData]
				};
				parsedFamilies.push(perantauFam);
				currentFamily = null;
			} else if (rKk && rKk.trim()) {
				// Ada No KK: gabungkan baris dengan No KK yang sama
				const cleanKk = rKk.trim();
				let existingFam = kkMap.get(cleanKk);
				if (!existingFam) {
					existingFam = {
						id: Math.random().toString(36).substring(2, 9),
						noKk: cleanKk,
						alamat: rAlamat,
						isPerantau: false,
						kelompokId: defaultKelompokId,
						members: []
					};
					kkMap.set(cleanKk, existingFam);
					parsedFamilies.push(existingFam);
				}
				existingFam.members.push(newMemberData);
				currentFamily = existingFam;
			} else {
				// Tidak ada No KK:
				// Jika status adalah Kepala Keluarga / Bapak, atau belum ada currentFamily
				if (
					!currentFamily ||
					currentFamily.isPerantau ||
					finalKeluarga === 'Kepala Keluarga' ||
					finalKeluarga === 'Bapak'
				) {
					currentFamily = {
						id: Math.random().toString(36).substring(2, 9),
						noKk: '',
						alamat: rAlamat,
						isPerantau: false,
						kelompokId: defaultKelompokId,
						members: [newMemberData]
					};
					parsedFamilies.push(currentFamily);
				} else {
					// Anggota di bawah kepala keluarga otomatis masuk ke KK yang sedang aktif
					currentFamily.members.push(newMemberData);
				}
			}
		}

		if (parsedFamilies.length > 0) {
			if (
				families.length === 1 &&
				families[0].members.length === 1 &&
				!families[0].members[0].namaLengkap
			) {
				families = parsedFamilies;
			} else {
				families = [...families, ...parsedFamilies];
			}
			pasteText = '';
			showPasteModal = false;
		} else {
			alert(
				'Tidak ada data baris yang berhasil dikenali. Pastikan Anda menyalin kolom dari Excel / Google Sheets.'
			);
		}
	}

	// Metrik Ringkasan Terhitung Real-time
	const totalJiwa = $derived(families.reduce((acc, f) => acc + f.members.length, 0));
	const totalKeluargaKK = $derived(families.filter((f) => !f.isPerantau).length);
	const totalMandiriPerantau = $derived(families.filter((f) => f.isPerantau).length);
	const totalAkunDipilih = $derived(
		families.reduce((acc, f) => acc + f.members.filter((m) => m.buatAkun).length, 0)
	);
</script>

<svelte:head>
	<title>Batch Insert Sensus Jamaah - Satu Generus</title>
</svelte:head>

<div class="space-y-4 max-w-[100vw] overflow-x-hidden p-2 sm:p-4">
	<!-- Top Navigation & Action Header -->
	<div
		class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card border border-border p-4 rounded-xl shadow-sm"
	>
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
					<span>Batch Insert Sensus Terikat Keluarga</span>
				</h1>
				<p class="text-xs text-foreground/60">
					Kelompokkan jamaah dalam satu Kartu Keluarga (KK). Anggota di bawah Kepala Keluarga otomatis
					terikat ke KK yang sama, dengan atau tanpa No. KK.
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
				onclick={addFamily}
				class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold transition-colors shadow-sm"
			>
				<Plus class="w-3.5 h-3.5" />
				<span>+ Tambah KK Baru</span>
			</button>

			<button
				type="button"
				onclick={addPerantauFamily}
				class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-secondary/50 hover:bg-secondary text-foreground text-xs font-semibold transition-colors"
			>
				<Users class="w-3.5 h-3.5 text-blue-500" />
				<span>+ Mandiri / Perantau</span>
			</button>

			<button
				type="button"
				onclick={clearFamilies}
				class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-destructive/30 hover:bg-destructive/10 text-destructive text-xs font-medium transition-colors"
			>
				<Trash2 class="w-3.5 h-3.5" />
				<span>Kosongkan</span>
			</button>
		</div>
	</div>

	<!-- Global Batch Defaults Bar & Live Stats -->
	<div
		class="grid grid-cols-1 md:grid-cols-4 gap-3 bg-secondary/30 border border-border p-3.5 rounded-xl text-xs"
	>
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
			<label
				for="defaultPasswordInput"
				class="block font-semibold text-foreground/80 mb-1 flex items-center gap-1"
			>
				<KeyRound class="w-3.5 h-3.5 text-primary" />
				<span>Password Default Akun</span>
			</label>
			<input
				id="defaultPasswordInput"
				type="text"
				bind:value={defaultPassword}
				placeholder="password"
				class="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs font-mono text-foreground focus:ring-1 focus:ring-primary"
			/>
		</div>

		<div class="flex items-center gap-2 pt-2 md:pt-4">
			<label
				class="inline-flex items-center gap-2 cursor-pointer font-medium text-foreground select-none"
			>
				<input
				type="checkbox"
				onchange={(e) => toggleAllBuatAkun(e.currentTarget.checked)}
				class="w-4 h-4 rounded border-border text-primary focus:ring-primary accent-primary"
			/>
				<span>Buatkan Akun Semua Jiwa</span>
			</label>
		</div>

		<div class="flex items-center justify-end gap-3 text-right pt-2 md:pt-4">
			<div class="text-[11px] text-foreground/70">
				<span class="font-bold text-foreground text-xs">{totalJiwa}</span> jiwa •
				<span class="font-bold text-foreground text-xs">{totalKeluargaKK}</span> KK •
				<span class="font-bold text-blue-600 dark:text-blue-400 text-xs">{totalMandiriPerantau}</span> mandiri •
				<span class="font-bold text-primary text-xs">{totalAkunDipilih}</span> akun
			</div>
		</div>
	</div>

	<!-- Notifikasi Feedback Server -->
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
					Berhasil menyimpan <strong>{form.summary?.totalJiwa}</strong> jiwa ke dalam
					<strong>{form.summary?.totalKeluarga}</strong> keluarga (dan
					<strong>{form.summary?.totalAkun}</strong> akun login)!
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

	<!-- Form Batch Groups Sensus -->
	<form
		method="POST"
		use:enhance={({ cancel }) => {
			if (families.length === 0) {
				alert('Silakan tambahkan minimal 1 keluarga atau jamaah.');
				cancel();
				return;
			}

			let totalValidMember = 0;
			for (let fIdx = 0; fIdx < families.length; fIdx++) {
				const fam = families[fIdx];
				if (!fam.members || fam.members.length === 0) {
					alert(`Keluarga #${fIdx + 1} tidak memiliki anggota. Silakan tambahkan minimal 1 anggota atau hapus kartu keluarga tersebut.`);
					cancel();
					return;
				}

				for (let mIdx = 0; mIdx < fam.members.length; mIdx++) {
					const m = fam.members[mIdx];
					if (!m.namaLengkap.trim()) {
						alert(`Keluarga #${fIdx + 1}, Anggota #${mIdx + 1}: Nama lengkap wajib diisi!`);
						cancel();
						return;
					}
					if (!m.tanggalLahir.trim()) {
						alert(`Keluarga #${fIdx + 1} (${m.namaLengkap}): Tanggal lahir wajib diisi (YYYY-MM-DD)!`);
						cancel();
						return;
					}
					if (!m.statusKeluarga.trim()) {
						alert(`Keluarga #${fIdx + 1} (${m.namaLengkap}): Hubungan keluarga wajib dipilih!`);
						cancel();
						return;
					}
					totalValidMember++;
				}
			}

			if (totalValidMember === 0) {
				alert('Tidak ada data anggota yang dapat disimpan.');
				cancel();
				return;
			}

			isSubmitting = true;
			return async ({ update }) => {
				isSubmitting = false;
				await update();
			};
		}}
		class="space-y-5"
	>
		<!-- Hidden payload mengirim seluruh hierarki families -->
		<input type="hidden" name="batchData" value={JSON.stringify(families)} />
		<input type="hidden" name="defaultPassword" value={defaultPassword} />
		<input type="hidden" name="defaultKelompokId" value={String(defaultKelompokId)} />

		<!-- Daftar Kartu Keluarga (Hierarkis) -->
		<div class="space-y-5">
			{#each families as fam, fIdx (fam.id)}
				<div
					class="rounded-2xl border {fam.isPerantau
						? 'border-blue-500/30 bg-blue-500/[0.02]'
						: 'border-border bg-card'} p-4 sm:p-5 shadow-sm space-y-4 transition-all"
				>
					<!-- Header Kartu Keluarga -->
					<div
						class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/70"
					>
						<div class="flex flex-wrap items-center gap-2 sm:gap-3">
							<div
								class="p-2 rounded-xl {fam.isPerantau
									? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
									: 'bg-primary/10 text-primary'}"
							>
								{#if fam.isPerantau}
									<Users class="w-4 h-4" />
								{:else}
									<Home class="w-4 h-4" />
								{/if}
							</div>
							<div>
								<div class="flex items-center gap-2">
									<h2 class="text-sm font-bold text-foreground">
										{#if fam.isPerantau}
											Jamaah Mandiri / Perantau #{fIdx + 1}
										{:else}
											Kartu Keluarga #{fIdx + 1}
										{/if}
									</h2>
									<span
										class="px-2 py-0.5 rounded-full text-[10.5px] font-bold {fam.isPerantau
											? 'bg-blue-500/10 text-blue-700 dark:text-blue-300'
											: 'bg-primary/10 text-primary'}"
									>
										{fam.members.length} Jiwa
									</span>
								</div>
								<p class="text-[11px] text-foreground/60">
									{#if fam.isPerantau}
										Data jamaah tanpa keterikatan KK (tinggal mandiri, santri, atau mahasiswa perantauan)
									{:else}
										Semua anggota di bawah ini otomatis terikat ke satu KK yang sama.
									{/if}
								</p>
							</div>
						</div>

						<div class="flex items-center gap-2 sm:gap-3">
							<!-- Checklist Toggle Mandiri / Perantau -->
							<label
								class="inline-flex items-center gap-1.5 cursor-pointer text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-500/10 px-2.5 py-1.5 rounded-lg hover:bg-blue-500/20 transition-colors select-none"
							>
								<input
									type="checkbox"
									bind:checked={fam.isPerantau}
									onchange={() => onFamilyPerantauToggle(fam)}
									class="w-3.5 h-3.5 rounded border-border text-blue-600 focus:ring-blue-500"
								/>
								<span>Mandiri / Perantau</span>
							</label>

							<!-- Tombol Hapus Seluruh Keluarga -->
							<button
								type="button"
								onclick={() => removeFamily(fIdx)}
								class="p-1.5 text-foreground/50 hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
								title="Hapus Kartu Keluarga Ini"
							>
								<Trash2 class="w-4 h-4" />
							</button>
						</div>
					</div>

					<!-- Atribut Identitas Kartu Keluarga (No KK, Alamat Domisili, Kelompok) -->
					<div
						class="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-secondary/20 rounded-xl border border-border/50 text-xs"
					>
						<!-- Nomor KK (Opsional / Boleh Kosong) -->
						<div>
							<label for="noKk-{fam.id}" class="block text-[11px] font-semibold text-foreground/80 mb-1">
								No. KK <span class="text-foreground/50 font-normal">(Boleh kosong / tanpa KK)</span>
							</label>
							<input
								id="noKk-{fam.id}"
								type="text"
								bind:value={fam.noKk}
								disabled={fam.isPerantau}
								placeholder={fam.isPerantau ? 'Tanpa KK' : 'Nomor KK (Opsional)'}
								class="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs font-mono text-foreground focus:ring-1 focus:ring-primary disabled:opacity-50 disabled:bg-secondary/40"
							/>
						</div>

						<!-- Alamat Domisili Keluarga Bersama -->
						<div>
							<label for="alamat-{fam.id}" class="block text-[11px] font-semibold text-foreground/80 mb-1">
								Alamat Domisili Keluarga
							</label>
							<input
								id="alamat-{fam.id}"
								type="text"
								bind:value={fam.alamat}
								placeholder="Contoh: Jl. Melati No. 12 RT 01/RW 02"
								class="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:ring-1 focus:ring-primary"
							/>
						</div>

						<!-- Kelompok Wilayah Keluarga -->
						<div>
							<label for="kelompok-{fam.id}" class="block text-[11px] font-semibold text-foreground/80 mb-1">
								Kelompok
							</label>
							<select
								id="kelompok-{fam.id}"
								bind:value={fam.kelompokId}
								class="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:ring-1 focus:ring-primary"
							>
								{#each data.wilayahOptions.kelompokList as k}
									<option value={k.id}>{k.nama} (Desa {k.desaNama || '-'})</option>
								{/each}
							</select>
						</div>
					</div>

					<!-- Bagian Anggota Keluarga di Bawah Kepala Keluarga -->
					<div class="space-y-3 pt-1">
						<div class="flex items-center justify-between">
							<span class="text-xs font-bold text-foreground/80 flex items-center gap-1.5">
								<span>Daftar Anggota dalam KK Ini</span>
								<span class="text-[11px] text-foreground/50 font-normal">
									(Anggota di bawah otomatis terikat ke KK orang ini)
								</span>
							</span>
						</div>

						<!-- Loop Anggota Keluarga -->
						<div class="space-y-3">
							{#each fam.members as row, mIdx (row.id)}
								<div
									class="p-3 sm:p-3.5 rounded-xl border border-border/80 bg-background shadow-xs hover:border-primary/40 transition-all space-y-2.5"
								>
									<!-- Header Kecil Baris Anggota -->
									<div
										class="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-border/40"
									>
										<div class="flex flex-wrap items-center gap-2">
											<span
												class="inline-flex items-center justify-center px-2 py-0.5 rounded {mIdx === 0
													? 'bg-primary/20 text-primary font-bold'
													: 'bg-secondary text-foreground/80'} font-mono text-[11px]"
											>
												#{mIdx + 1}
											</span>
											<span class="text-xs font-bold text-foreground">
												{row.namaLengkap || (mIdx === 0 ? 'Kepala Keluarga / Jamaah Utama' : 'Anggota Keluarga Baru')}
											</span>
											{#if mIdx === 0 && !fam.isPerantau}
												<span
													class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-800 dark:text-amber-200"
												>
													Kepala Keluarga
												</span>
											{/if}
											{#if row.umur > 0}
												<span
													class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary"
												>
													{row.umur} Thn • {row.statusGenerus}
												</span>
											{/if}
										</div>

										<div class="flex items-center gap-2 ml-auto">
											<!-- Toggle Buatkan Akun -->
											<label
												class="inline-flex items-center gap-1.5 cursor-pointer text-[11px] font-medium text-amber-700 dark:text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-md hover:bg-amber-500/20 transition-colors select-none"
											>
												<input
													type="checkbox"
													bind:checked={row.buatAkun}
													class="w-3.5 h-3.5 rounded border-border text-primary focus:ring-primary accent-primary"
												/>
												<span>Buatkan Akun</span>
											</label>

											<!-- Tombol Hapus Anggota -->
											<button
												type="button"
												onclick={() => removeMember(fam, mIdx)}
												class="p-1 text-foreground/40 hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
												title="Hapus Anggota Ini"
											>
												<Trash2 class="w-3.5 h-3.5" />
											</button>
										</div>
									</div>

									<!-- Input Fields Anggota (Wrap Responsif Menyesuaikan Layar Desktop & Mobile) -->
									<div class="flex flex-wrap items-end gap-2 sm:gap-2.5">
										<!-- Nama Lengkap * -->
										<div class="w-full sm:w-56 flex-1 min-w-[170px]">
											<label for="nama-{row.id}" class="block text-[10px] font-semibold text-foreground/75 mb-1">
												Nama Lengkap <span class="text-destructive">*</span>
											</label>
											<input
												id="nama-{row.id}"
												type="text"
												required
												bind:value={row.namaLengkap}
												placeholder="Nama lengkap jamaah"
												class="w-full bg-card border border-border rounded-lg px-2 py-1.5 text-xs font-medium text-foreground focus:ring-1 focus:ring-primary"
											/>
										</div>

										<!-- Jenis Kelamin -->
										<div class="w-[calc(50%-4px)] sm:w-28 shrink-0">
											<label for="jk-{row.id}" class="block text-[10px] font-semibold text-foreground/75 mb-1">
												Jenis Kelamin
											</label>
											<select
												id="jk-{row.id}"
												bind:value={row.jenisKelamin}
												onchange={() => onJenisKelaminChange(row)}
												class="w-full bg-card border border-border rounded-lg px-2 py-1.5 text-xs text-foreground focus:ring-1 focus:ring-primary"
											>
												<option value="L">L (Laki-laki)</option>
												<option value="P">P (Perempuan)</option>
											</select>
										</div>

										<!-- Hubungan Keluarga * (Disesuaikan Jenis Kelamin) -->
										<div class="w-[calc(50%-4px)] sm:w-44 flex-1 min-w-[150px]">
											<label for="hub-{row.id}" class="block text-[10px] font-semibold text-foreground/75 mb-1">
												Hub. Keluarga <span class="text-destructive">*</span>
											</label>
											<select
												id="hub-{row.id}"
												required
												bind:value={row.statusKeluarga}
												onchange={() => onStatusKeluargaChange(row)}
												class="w-full bg-card border {row.statusKeluarga
													? 'border-border font-medium'
													: 'border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300 font-semibold ring-1 ring-amber-500/40'} rounded-lg px-2 py-1.5 text-xs text-foreground focus:ring-1 focus:ring-primary"
											>
												<option value="" disabled selected>-- Pilih Hubungan --</option>
												{#each getDaftarStatusKeluargaByGender(row.jenisKelamin) as sk}
													<option value={sk}>{sk}</option>
												{/each}
											</select>
										</div>

										<!-- Tempat Lahir -->
										<div class="w-[calc(50%-4px)] sm:w-32 shrink-0">
											<label for="tempat-{row.id}" class="block text-[10px] font-semibold text-foreground/75 mb-1">
												Tempat Lahir
											</label>
											<input
												id="tempat-{row.id}"
												type="text"
												bind:value={row.tempatLahir}
												placeholder="Kota lahir"
												class="w-full bg-card border border-border rounded-lg px-2 py-1.5 text-xs text-foreground focus:ring-1 focus:ring-primary"
											/>
										</div>

										<!-- Tanggal Lahir * -->
										<div class="w-[calc(50%-4px)] sm:w-32 shrink-0">
											<label for="tgl-{row.id}" class="block text-[10px] font-semibold text-foreground/75 mb-1">
												Tgl Lahir <span class="text-destructive">*</span>
											</label>
											<input
												id="tgl-{row.id}"
												type="text"
												required
												bind:value={row.tanggalLahir}
												onblur={() => onTanggalLahirOrMenikahChange(row)}
												placeholder="YYYY-MM-DD"
												class="w-full bg-card border border-border rounded-lg px-2 py-1.5 text-xs font-mono text-foreground focus:ring-1 focus:ring-primary"
											/>
										</div>

										<!-- Umur (Calculated) -->
										<div class="w-14 shrink-0 text-center">
											<span class="block text-[10px] font-semibold text-foreground/75 mb-1">Umur</span>
											<div
												class="w-full py-1.5 bg-secondary/80 text-foreground rounded-lg font-mono font-bold text-xs flex items-center justify-center border border-border/50"
											>
												{row.umur || 0}
											</div>
										</div>

										<!-- Status Generus (Auto & Editable) -->
										<div class="w-[calc(50%-4px)] sm:w-32 shrink-0">
											<label for="generus-{row.id}" class="block text-[10px] font-semibold text-foreground/75 mb-1">
												Status Generus
											</label>
											<select
												id="generus-{row.id}"
												bind:value={row.statusGenerus}
												class="w-full bg-card border border-border rounded-lg px-2 py-1.5 text-xs font-semibold text-primary focus:ring-1 focus:ring-primary"
											>
												{#each DAFTAR_STATUS_GENERUS as g}
													<option value={g}>{g}</option>
												{/each}
											</select>
										</div>

										<!-- Status Pernikahan -->
										<div class="w-[calc(50%-4px)] sm:w-32 shrink-0">
											<label for="nikah-{row.id}" class="block text-[10px] font-semibold text-foreground/75 mb-1">
												Status Nikah
											</label>
											<select
												id="nikah-{row.id}"
												bind:value={row.statusMenikah}
												onchange={() => onTanggalLahirOrMenikahChange(row)}
												class="w-full bg-card border border-border rounded-lg px-2 py-1.5 text-xs text-foreground focus:ring-1 focus:ring-primary"
											>
												{#each DAFTAR_STATUS_PERNIKAHAN as sm}
													<option value={sm}>{sm}</option>
												{/each}
											</select>
										</div>

										<!-- No HP / WA -->
										<div class="w-[calc(50%-4px)] sm:w-32 shrink-0">
											<label for="telp-{row.id}" class="block text-[10px] font-semibold text-foreground/75 mb-1">
												No. HP / WA
											</label>
											<input
												id="telp-{row.id}"
												type="text"
												bind:value={row.noTelepon}
												placeholder="0812xxxx"
												class="w-full bg-card border border-border rounded-lg px-2 py-1.5 text-xs font-mono text-foreground focus:ring-1 focus:ring-primary"
											/>
										</div>

										<!-- Profesi -->
										<div class="w-[calc(50%-4px)] sm:w-32 shrink-0">
											<label for="profesi-{row.id}" class="block text-[10px] font-semibold text-foreground/75 mb-1">
												Profesi
											</label>
											<input
												id="profesi-{row.id}"
												type="text"
												bind:value={row.profesi}
												placeholder="Pekerjaan"
												class="w-full bg-card border border-border rounded-lg px-2 py-1.5 text-xs text-foreground focus:ring-1 focus:ring-primary"
											/>
										</div>

										<!-- Alamat Spesifik (Jika beda dari domisili keluarga) -->
										<div class="w-full sm:w-48 flex-1 min-w-[150px]">
											<label for="alamat-anggota-{row.id}" class="block text-[10px] font-semibold text-foreground/75 mb-1">
												Alamat Anggota (Opsional)
											</label>
											<input
												id="alamat-anggota-{row.id}"
												type="text"
												bind:value={row.alamat}
												placeholder={fam.alamat ? 'Sama dgn alamat keluarga' : 'Alamat jika berbeda'}
												class="w-full bg-card border border-border rounded-lg px-2 py-1.5 text-xs text-foreground focus:ring-1 focus:ring-primary"
											/>
										</div>

										<!-- Golongan Darah -->
										<div class="w-16 shrink-0">
											<label for="goldar-{row.id}" class="block text-[10px] font-semibold text-foreground/75 mb-1 text-center">
												Gol. Darah
											</label>
											<select
												id="goldar-{row.id}"
												bind:value={row.golonganDarah}
												class="w-full bg-card border border-border rounded-lg px-1.5 py-1.5 text-xs text-foreground focus:ring-1 focus:ring-primary text-center"
											>
												{#each DAFTAR_GOLONGAN_DARAH as gd}
													<option value={gd}>{gd}</option>
												{/each}
											</select>
										</div>

										<!-- Status Jamaah (Admin Only) -->
										<div class="w-[calc(50%-4px)] sm:w-24 shrink-0">
											<label for="statusjam-{row.id}" class="block text-[10px] font-semibold text-foreground/75 mb-1">
												Status
											</label>
											<select
												id="statusjam-{row.id}"
												bind:value={row.statusJamaah}
												class="w-full bg-card border border-border rounded-lg px-2 py-1.5 text-xs text-foreground focus:ring-1 focus:ring-primary"
											>
												{#each DAFTAR_STATUS_JAMAAH as sj}
													<option value={sj}>{sj}</option>
												{/each}
											</select>
										</div>

										<!-- Isrun (Admin Only) -->
										<div class="w-[calc(50%-4px)] sm:w-20 shrink-0">
											<label for="isrun-{row.id}" class="block text-[10px] font-semibold text-foreground/75 mb-1">
												Isrun
											</label>
											<select
												id="isrun-{row.id}"
												bind:value={row.isrun}
												class="w-full bg-card border border-border rounded-lg px-2 py-1.5 text-xs text-foreground focus:ring-1 focus:ring-primary"
											>
												{#each DAFTAR_ISRUN as isr}
													<option value={isr}>{isr}</option>
												{/each}
											</select>
										</div>

										<!-- Email Login (Muncul jika Buat Akun aktif) -->
										{#if row.buatAkun}
											<div class="w-full sm:w-56 shrink-0 bg-amber-500/10 p-1.5 rounded-lg border border-amber-500/20">
												<label for="email-{row.id}" class="block text-[10px] font-semibold text-amber-900 dark:text-amber-200 mb-1">
													Email Login (Opsional)
												</label>
												<input
													id="email-{row.id}"
													type="email"
													bind:value={row.email}
													placeholder="nama@email.com"
													class="w-full bg-card border border-border rounded-md px-2 py-1 text-xs text-foreground focus:ring-1 focus:ring-primary"
												/>
											</div>
										{/if}
									</div>
								</div>
							{/each}
						</div>

						<!-- Tombol Khusus: Tambah Anggota ke Keluarga Ini -->
						<div class="pt-1">
							<button
								type="button"
								onclick={() => addMemberToFamily(fam)}
								class="w-full py-2.5 px-3 rounded-xl border border-dashed border-primary/40 bg-primary/[0.04] hover:bg-primary/[0.08] text-primary text-xs font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
							>
								<UserPlus class="w-4 h-4" />
								<span>+ Tambah Anggota ke KK Ini (Otomatis Menjadi Bagian dari KK Ini)</span>
							</button>
						</div>
					</div>
				</div>
			{/each}
		</div>

		<!-- Tombol Tambah KK Baru di Bawah Seluruh List -->
		<div class="flex flex-wrap items-center justify-center gap-3 pt-3 pb-2">
			<button
				type="button"
				onclick={addFamily}
				class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-primary/40 bg-card hover:bg-secondary text-xs font-bold text-primary transition-all shadow-sm hover:shadow"
			>
				<Home class="w-4 h-4" />
				<span>+ Tambah Kartu Keluarga Baru</span>
			</button>

			<button
				type="button"
				onclick={addPerantauFamily}
				class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-border bg-card hover:bg-secondary text-xs font-semibold text-foreground/80 hover:text-foreground transition-all shadow-sm"
			>
				<Users class="w-4 h-4 text-blue-500" />
				<span>+ Tambah Jamaah Mandiri / Perantau</span>
			</button>
		</div>

		<!-- Floating / Sticky Action Bar Simpan Batch -->
		<div
			class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-card border border-border rounded-2xl shadow-lg sticky bottom-2 z-20 backdrop-blur-md"
		>
			<div class="flex items-center gap-2 text-xs text-foreground/75">
				<Sparkles class="w-4 h-4 text-primary shrink-0" />
				<span>
					Format tanggal lahir: <strong>YYYY-MM-DD</strong>. Status generus terhitung otomatis
					berdasarkan umur.
				</span>
			</div>

			<div class="flex items-center gap-2.5 justify-end">
				<a
					href="/admin/sensus"
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
						<span>Menyimpan Batch Transaksi...</span>
					{:else}
						<Save class="w-4 h-4" />
						<span>Simpan {totalJiwa} Jiwa ({families.length} Keluarga)</span>
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
		<div
			class="bg-card border border-border rounded-2xl max-w-2xl w-full p-5 shadow-2xl space-y-4"
		>
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
						No | Kelompok | Nama Lengkap | JK | Tempat Lahir | Tgl Lahir | Umur | Alamat | Profesi | No HP | Status Generus | Status Menikah | Status Keluarga | No KK | Status Jamaah | Isrun | Gol. Darah
					</p>
					<p class="text-[10.5px] text-primary pt-0.5">
						Baris anggota di bawah Kepala Keluarga otomatis masuk ke KK yang sama walau No KK tidak diisi ulang.
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
					Proses & Kelompokkan ke KK
				</button>
			</div>
		</div>
	</div>
{/if}
