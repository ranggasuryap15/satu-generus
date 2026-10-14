<!--
  @file src/routes/(admin)/admin/sensus/batch/+page.svelte
  @purpose Antarmuka batch insert sensus massal terstruktur: grouping keluarga hierarkis untuk KK dan kartu baris tunggal datar untuk Jamaah Mandiri/Perantau, DateInput dengan manual typing & kalender, auto-kalkulasi generus, validasi noTelepon numerik (wajib jika buat akun), layout form responsif desktop & mobile, paste spreadsheet otomatis, dan opsi pembuatan akun
  @usedBy Route admin '/admin/sensus/batch'
  @dependencies @lucide/svelte, $app/forms, $lib/components/SearchableSelect.svelte, $lib/components/DateInput.svelte, $lib/generus (hitungUmur, hitungStatusGenerus, getDaftarStatusKeluargaByGender, daftar konstanta), Svelte 5 Runes
  @publicFunctions addFamily, addPerantauFamily, removeFamily, addMemberToFamily, removeMember, clearFamilies, convertToPerantau, convertToFamily, onGlobalKelompokChange, onJenisKelaminChange, onStatusKeluargaChange, onTanggalLahirOrMenikahChange, processPastedSpreadsheet, toggleAllBuatAkun
  @sideEffects Mengirim payload JSON batchData (FamilyBatchGroup[]) ke server action untuk transaksi database atomik
-->
<script lang="ts">
	import { enhance } from '$app/forms';
	import SearchableSelect from '$lib/components/SearchableSelect.svelte';
	import DateInput from '$lib/components/DateInput.svelte';
	import { confirmAction } from '$lib/confirm.svelte';
	import {
		DAFTAR_GOLONGAN_DARAH,
		DAFTAR_ISRUN,
		DAFTAR_STATUS_GENERUS,
		DAFTAR_STATUS_JAMAAH,
		DAFTAR_STATUS_PERNIKAHAN,
		getDaftarStatusKeluargaByGender,
		hitungStatusGenerus,
		hitungUmur,
		isStatusHubunganMenikah
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
		UserCheck,
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
	let defaultKelompokId = $state<number | string>(
		data.wilayahOptions.kelompokList[0]?.id || 'ALL'
	);
	let isSubmitting = $state(false);

	interface KelompokOptionItem {
		id: number;
		nama: string;
		desaNama?: string | null;
		daerahNama?: string | null;
	}

	const globalKelompokOptions = $derived([
		{
			value: 'ALL',
			label: '🌐 Semua Kelompok (Beda-beda per Keluarga)',
			sublabel: 'Pilih manual kelompok di masing-masing KK / Mandiri'
		},
		...(data.wilayahOptions?.kelompokList || []).map((k: KelompokOptionItem) => ({
			value: k.id,
			label: `${k.nama} (Desa ${k.desaNama || '-'})`,
			sublabel: k.daerahNama ? `Daerah ${k.daerahNama}` : undefined
		}))
	]);

	const perKeluargaKelompokOptions = $derived(
		(data.wilayahOptions?.kelompokList || []).map((k: KelompokOptionItem) => ({
			value: k.id,
			label: `${k.nama} (Desa ${k.desaNama || '-'})`,
			sublabel: k.daerahNama ? `Daerah ${k.daerahNama}` : undefined
		}))
	);

	const selectedGlobalKelompokLabel = $derived.by(() => {
		const k = (data.wilayahOptions?.kelompokList || []).find(
			(item: KelompokOptionItem) => String(item.id) === String(defaultKelompokId)
		);
		return k ? `${k.nama} (Desa ${k.desaNama || '-'})` : '-';
	});

	function onGlobalKelompokChange(val: string | number) {
		defaultKelompokId = val;
		if (val !== 'ALL' && val !== '') {
			for (const fam of families) {
				fam.kelompokId = val;
			}
		}
	}

	function getInitialFamilyKelompokId(): number | string {
		if (defaultKelompokId !== 'ALL' && defaultKelompokId !== '') {
			return defaultKelompokId;
		}
		return data.wilayahOptions.kelompokList[0]?.id || '';
	}

	// Modal Paste Spreadsheet
	let showPasteModal = $state(false);
	let pasteText = $state('');

	function createEmptyMember(
		statusKeluargaDefault = 'Kepala Keluarga',
		jenisKelaminDefault: 'L' | 'P' = 'L'
	): MemberRowData {
		const isMenikah = isStatusHubunganMenikah(statusKeluargaDefault);
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
			statusGenerus: isMenikah ? 'Dewasa Menikah' : 'Usia Nikah',
			statusMenikah: isMenikah ? 'Sudah Menikah' : 'Belum Menikah',
			statusKeluarga: statusKeluargaDefault,
			nik: '',
			statusJamaah: 'Aktif',
			isrun: statusKeluargaDefault === 'Kepala Keluarga' ? 'Ya' : 'Tidak',
			golonganDarah: '',
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
			kelompokId: getInitialFamilyKelompokId(),
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
		if (family.alamat.trim()) {
			newMember.alamat = family.alamat.trim();
		}

		family.members.push(newMember);
	}

	async function removeMember(family: FamilyGroupData, memberIndex: number) {
		if (family.members.length === 1) {
			const ok = await confirmAction({
				title: 'Hapus Kartu Keluarga?',
				message: 'Keluarga ini hanya memiliki 1 anggota. Hapus seluruh kartu keluarga ini?',
				confirmText: 'Ya, Hapus KK',
				variant: 'danger'
			});
			if (ok) {
				const famIdx = families.indexOf(family);
				if (famIdx !== -1) {
					removeFamily(famIdx);
				}
			}
			return;
		}
		family.members.splice(memberIndex, 1);
	}

	async function convertToPerantau(family: FamilyGroupData) {
		if (family.members.length > 1) {
			const ok = await confirmAction({
				title: 'Ubah ke Jamaah Mandiri?',
				message:
					'Mengubah ke Jamaah Mandiri akan melepas anggota tambahan dan hanya mempertahankan data pertama. Lanjutkan?',
				confirmText: 'Ya, Ubah',
				variant: 'warning'
			});
			if (!ok) {
				return;
			}
			family.members = [family.members[0]];
		}
		family.isPerantau = true;
		family.noKk = '';
		family.members[0].statusKeluarga = 'Mandiri / Perantau';
	}

	function convertToFamily(family: FamilyGroupData) {
		family.isPerantau = false;
		family.members[0].statusKeluarga = 'Kepala Keluarga';
	}

	async function clearFamilies() {
		const ok = await confirmAction({
			title: 'Kosongkan Seluruh Data?',
			message: 'Apakah Anda yakin ingin mengosongkan seluruh formulir data keluarga & sensus?',
			confirmText: 'Ya, Kosongkan',
			variant: 'danger'
		});
		if (ok) {
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

	// Auto-kalkulasi umur dan status generus secara reaktif saat tanggal lahir berubah
	$effect(() => {
		for (const fam of families) {
			for (const m of fam.members) {
				const umur = hitungUmur(m.tanggalLahir);
				if (m.umur !== umur) {
					m.umur = umur;
					m.statusGenerus = hitungStatusGenerus(m.umur, m.statusMenikah);
				}
			}
		}
	});

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

		if (isStatusHubunganMenikah(member.statusKeluarga)) {
			member.statusMenikah = 'Sudah Menikah';
			member.statusGenerus = hitungStatusGenerus(member.umur, member.statusMenikah);
		}
	}

	// Parsing Text Clipboard dari Google Sheets / Excel
	function processPastedSpreadsheet() {
		if (!pasteText.trim()) return;

		const lines = pasteText.trim().split(/\r?\n/);
		const parsedFamilies: FamilyGroupData[] = [];
		let currentFamily: FamilyGroupData | null = null;
		const kkMap = new Map<string, FamilyGroupData>();

		// Deteksi header kolom jika baris pertama adalah judul kolom
		const headerMap: Record<string, number> = {};
		let hasHeader = false;

		if (lines.length > 0) {
			const firstLine = lines[0];
			const firstCols = firstLine.split('\t').map((c) => c.trim().toLowerCase());
			if (
				firstCols.some(
					(c) =>
						c === 'no' ||
						c.includes('nama') ||
						c.includes('kelompok') ||
						c.includes('lahir') ||
						c.includes('kk')
				)
			) {
				hasHeader = true;
				firstCols.forEach((c, idx) => {
					if (c.includes('nama') && !c.includes('keluarga')) headerMap['nama'] = idx;
					else if (c === 'jk' || c.includes('kelamin') || c.includes('gender')) headerMap['jk'] = idx;
					else if (c.includes('tempat')) headerMap['tempat'] = idx;
					else if (c.includes('tgl') || c.includes('tanggal') || (c.includes('lahir') && !c.includes('tempat')))
						headerMap['tgl'] = idx;
					else if (c.includes('alamat') || c.includes('domisili')) headerMap['alamat'] = idx;
					else if (c.includes('profesi') || c.includes('pekerjaan')) headerMap['profesi'] = idx;
					else if (c.includes('hp') || c.includes('telp') || c.includes('wa') || c.includes('telepon'))
						headerMap['telp'] = idx;
					else if (c.includes('menikah') || c.includes('nikah') || c.includes('perkawinan'))
						headerMap['menikah'] = idx;
					else if (c.includes('keluarga') || c.includes('hubungan')) headerMap['keluarga'] = idx;
					else if (c.includes('kk')) headerMap['kk'] = idx;
					else if (c.includes('isrun')) headerMap['isrun'] = idx;
					else if (c.includes('jamaah')) headerMap['statusJam'] = idx;
					else if (c.includes('darah') || c.includes('gol')) headerMap['goldar'] = idx;
				});
			}
		}

		const startIndex = hasHeader ? 1 : 0;

		for (let i = startIndex; i < lines.length; i++) {
			const line = lines[i];
			if (!line.trim()) continue;
			const cols = line.split('\t').map((c) => c.trim());

			let rNama = '';
			let rJk: 'L' | 'P' = 'L';
			let rTempat = '';
			let rTgl = '';
			let rAlamat = '';
			let rProfesi = '';
			let rTelp = '';
			let rMenikah: 'Belum Menikah' | 'Sudah Menikah' = 'Belum Menikah';
			let rKeluarga = '';
			let rKk = '';
			let rStatusJam: 'Aktif' | 'Tidak Aktif' = 'Aktif';
			let rIsrun: 'Ya' | 'Tidak' = 'Tidak';
			let rGoldar = '';

			if (hasHeader && headerMap['nama'] !== undefined) {
				// 1. Parsing otomatis berbasis nama header spreadsheet
				rNama = cols[headerMap['nama']] || '';
				const jkRaw = (headerMap['jk'] !== undefined ? cols[headerMap['jk']] || '' : '').trim().toUpperCase();
				rJk = jkRaw === 'P' || jkRaw.startsWith('PEREMPUAN') || jkRaw.startsWith('WANITA') ? 'P' : 'L';
				rTempat = headerMap['tempat'] !== undefined ? cols[headerMap['tempat']] || '' : '';
				rTgl = headerMap['tgl'] !== undefined ? cols[headerMap['tgl']] || '' : '';
				rAlamat = headerMap['alamat'] !== undefined ? cols[headerMap['alamat']] || '' : '';
				rProfesi = headerMap['profesi'] !== undefined ? cols[headerMap['profesi']] || '' : '';
				rTelp = headerMap['telp'] !== undefined ? cols[headerMap['telp']] || '' : '';
				rMenikah =
					headerMap['menikah'] !== undefined && cols[headerMap['menikah']]?.toLowerCase().includes('sudah')
						? 'Sudah Menikah'
						: 'Belum Menikah';
				rKeluarga = headerMap['keluarga'] !== undefined ? cols[headerMap['keluarga']]?.trim() || '' : '';
				rKk =
					headerMap['kk'] !== undefined ? (cols[headerMap['kk']] || '').replace(/\D/g, '').slice(0, 16) : '';
				rStatusJam =
					headerMap['statusJam'] !== undefined && cols[headerMap['statusJam']]?.toLowerCase().includes('tidak')
						? 'Tidak Aktif'
						: 'Aktif';
				rIsrun =
					headerMap['isrun'] !== undefined && cols[headerMap['isrun']]?.toLowerCase().includes('ya')
						? 'Ya'
						: 'Tidak';
				rGoldar =
					headerMap['goldar'] !== undefined && cols[headerMap['goldar']] && cols[headerMap['goldar']] !== '-'
						? cols[headerMap['goldar']]
						: '';
			} else if (cols.length >= 15) {
				// 2. Format 16-17 kolom lama (dengan kolom Umur di col 6 & Generus di col 10)
				rNama = cols[2] || '';
				const jkRaw = (cols[3] || '').trim().toUpperCase();
				rJk = jkRaw === 'P' || jkRaw.startsWith('PEREMPUAN') || jkRaw.startsWith('WANITA') ? 'P' : 'L';
				rTempat = cols[4] || '';
				rTgl = cols[5] || '';
				rAlamat = cols[7] || '';
				rProfesi = cols[8] || '';
				rTelp = cols[9] || '';
				rMenikah = cols[11]?.toLowerCase().includes('sudah') ? 'Sudah Menikah' : 'Belum Menikah';
				rKeluarga = cols[12]?.trim() || '';
				rKk = (cols[13] || '').replace(/\D/g, '').slice(0, 16);
				rStatusJam = cols[14]?.toLowerCase().includes('tidak') ? 'Tidak Aktif' : 'Aktif';
				rIsrun = cols[15]?.toLowerCase().includes('ya') ? 'Ya' : 'Tidak';
				rGoldar = cols[16] && cols[16] !== '-' ? cols[16] : '';
			} else if (cols.length >= 10) {
				// 3. Format Ringkas Praktis: No | Kelompok | Nama | JK | Tempat | Tgl | Alamat | Profesi | HP | Menikah | Keluarga | KK | Isrun
				rNama = cols[2] || '';
				const jkRaw = (cols[3] || '').trim().toUpperCase();
				rJk = jkRaw === 'P' || jkRaw.startsWith('PEREMPUAN') || jkRaw.startsWith('WANITA') ? 'P' : 'L';
				rTempat = cols[4] || '';
				rTgl = cols[5] || '';
				rAlamat = cols[6] || '';
				rProfesi = cols[7] || '';
				rTelp = cols[8] || '';
				rMenikah = cols[9]?.toLowerCase().includes('sudah') ? 'Sudah Menikah' : 'Belum Menikah';
				rKeluarga = cols[10]?.trim() || '';
				rKk = (cols[11] || '').replace(/\D/g, '').slice(0, 16);
				rIsrun = cols[12]?.toLowerCase().includes('ya') ? 'Ya' : 'Tidak';
				rStatusJam = 'Aktif';
				rGoldar = '';
			} else if (cols.length >= 4) {
				// 4. Format Minimal
				rNama = cols[0] || '';
				const jkRaw = (cols[1] || '').trim().toUpperCase();
				rJk = jkRaw === 'P' || jkRaw.startsWith('PEREMPUAN') || jkRaw.startsWith('WANITA') ? 'P' : 'L';
				rTgl = cols[2] || '';
				rKk = (cols[3] || '').replace(/\D/g, '').slice(0, 16);
				if (cols[4]) rKeluarga = cols[4].trim();
				if (cols[5]) rTelp = cols[5];
				if (cols[6]) rAlamat = cols[6];
			}

			if (!rNama) continue;

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
				finalKeluarga = rKeluarga || 'Anak';
			}

			const isPerantauDetected =
				rKeluarga.toLowerCase().includes('perantau') ||
				rKeluarga.toLowerCase().includes('mandiri');

			if (isPerantauDetected) {
				finalKeluarga = 'Mandiri / Perantau';
			}

			if (isStatusHubunganMenikah(finalKeluarga)) {
				rMenikah = 'Sudah Menikah';
			}

			// Umur otomatis dihitung dari Tanggal Lahir
			const umurCalc = hitungUmur(rTgl);
			// Status Generus selalu otomatis mengikuti Umur & Status Menikah
			const finalGenerus = hitungStatusGenerus(umurCalc, rMenikah);

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
				isrun: (!isPerantauDetected && finalKeluarga === 'Kepala Keluarga' && (rIsrun === 'Tidak' || !rIsrun))
					? 'Ya'
					: rIsrun,
				golonganDarah: rGoldar,
				buatAkun: false,
				email: '',
				password: ''
			};

			if (isPerantauDetected) {
				const perantauFam: FamilyGroupData = {
					id: Math.random().toString(36).substring(2, 9),
					noKk: '',
					alamat: rAlamat,
					isPerantau: true,
					kelompokId: getInitialFamilyKelompokId(),
					members: [newMemberData]
				};
				parsedFamilies.push(perantauFam);
				currentFamily = null;
			} else if (rKk && rKk.trim()) {
				const cleanKk = rKk.trim();
				let existingFam = kkMap.get(cleanKk);
				if (!existingFam) {
					existingFam = {
						id: Math.random().toString(36).substring(2, 9),
						noKk: cleanKk,
						alamat: rAlamat,
						isPerantau: false,
						kelompokId: getInitialFamilyKelompokId(),
						members: []
					};
					kkMap.set(cleanKk, existingFam);
					parsedFamilies.push(existingFam);
				}
				existingFam.members.push(newMemberData);
				currentFamily = existingFam;
			} else {
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
						kelompokId: getInitialFamilyKelompokId(),
						members: [newMemberData]
					};
					parsedFamilies.push(currentFamily);
				} else {
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
					<span>Batch Insert Sensus Jamaah</span>
				</h1>
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
				class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary/40 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold transition-colors shadow-xs"
			>
				<Home class="w-3.5 h-3.5" />
				<span>+ Tambah KK Baru</span>
			</button>

			<button
				type="button"
				onclick={addPerantauFamily}
				class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-blue-300 text-xs font-semibold transition-colors"
			>
				<UserCheck class="w-3.5 h-3.5" />
				<span>+ Jamaah Mandiri (1 Baris)</span>
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
			<SearchableSelect
				id="defaultKelompokSelect"
				name="defaultKelompokSelect"
				options={globalKelompokOptions}
				bind:value={defaultKelompokId}
				onchange={onGlobalKelompokChange}
				placeholder="-- Pilih Kelompok / Semua --"
				searchPlaceholder="Cari kelompok..."
			/>
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
				<CheckCircle2 class="w-4 h-4 shrink-0 text-emerald-500" />
				<span class="font-bold">
					{form.summary?.totalJiwa} Jiwa Tersimpan
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
					alert(
						fam.isPerantau
							? `Baris Mandiri #${fIdx + 1} tidak memiliki data. Silakan isi atau hapus baris tersebut.`
							: `Keluarga #${fIdx + 1} tidak memiliki anggota. Silakan tambahkan minimal 1 anggota atau hapus kartu keluarga tersebut.`
					);
					cancel();
					return;
				}

				for (let mIdx = 0; mIdx < fam.members.length; mIdx++) {
					const m = fam.members[mIdx];
					if (!m.namaLengkap.trim()) {
						alert(
							fam.isPerantau
								? `Baris Mandiri #${fIdx + 1}: Nama lengkap wajib diisi!`
								: `Keluarga #${fIdx + 1}, Anggota #${mIdx + 1}: Nama lengkap wajib diisi!`
						);
						cancel();
						return;
					}
					if (!m.tanggalLahir.trim()) {
						alert(
							fam.isPerantau
								? `Baris Mandiri #${fIdx + 1} (${m.namaLengkap}): Tanggal lahir wajib diisi!`
								: `Keluarga #${fIdx + 1} (${m.namaLengkap}): Tanggal lahir wajib diisi!`
						);
						cancel();
						return;
					}
					if (!m.statusKeluarga.trim()) {
						alert(
							fam.isPerantau
								? `Baris Mandiri #${fIdx + 1} (${m.namaLengkap}): Hubungan keluarga wajib dipilih!`
								: `Keluarga #${fIdx + 1} (${m.namaLengkap}): Hubungan keluarga wajib dipilih!`
						);
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

		<!-- Daftar Entri Sensus (Kartu Keluarga atau Baris Mandiri) -->
		<div class="space-y-4">
			{#each families as fam, fIdx (fam.id)}
				{#if fam.isPerantau}
					<!-- ============================================================== -->
					<!-- TAMPILAN MANDIRI / PERANTAU (Cukup satu baris/kartu datar tanpa grouping KK) -->
					<!-- ============================================================== -->
					{@const row = fam.members[0]}
					<div
						class="rounded-xl border border-blue-500/30 bg-card p-3.5 sm:p-4 shadow-xs space-y-3 hover:border-blue-500/60 transition-all"
					>
						<!-- Header Baris Mandiri -->
						<div
							class="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-border/60"
						>
							<div class="flex flex-wrap items-center gap-2">
								<span
									class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-blue-500/10 text-blue-700 dark:text-blue-300 font-bold text-xs"
								>
									<UserCheck class="w-3.5 h-3.5" />
									<span>Mandiri / Perantau #{fIdx + 1}</span>
								</span>
								<span class="text-xs font-bold text-foreground">
									{row.namaLengkap || 'Jamaah Mandiri (Tanpa KK)'}
								</span>
								{#if row.umur > 0}
									<span
										class="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-primary/10 text-primary"
									>
										{row.umur} Thn • {row.statusGenerus}
									</span>
								{/if}
							</div>

							<div class="flex items-center gap-2 ml-auto">
								<!-- Toggle Buat Akun -->
								<label
									class="inline-flex items-center gap-1.5 cursor-pointer text-xs font-medium text-amber-700 dark:text-amber-300 bg-amber-500/10 px-2.5 py-1 rounded-lg hover:bg-amber-500/20 transition-colors select-none"
								>
									<input
										type="checkbox"
										bind:checked={row.buatAkun}
										class="w-3.5 h-3.5 rounded border-border text-primary focus:ring-primary accent-primary"
									/>
									<span>Buatkan Akun</span>
								</label>

								<!-- Tombol Opsi: Jadikan KK -->
								<button
									type="button"
									onclick={() => convertToFamily(fam)}
									class="px-2 py-1 text-[11px] rounded-lg border border-border text-foreground/60 hover:text-foreground hover:bg-secondary transition-colors"
									title="Ubah menjadi format Kartu Keluarga (KK)"
								>
									Jadikan KK
								</button>

								<!-- Tombol Hapus Baris Mandiri -->
								<button
									type="button"
									onclick={() => removeFamily(fIdx)}
									class="p-1.5 text-foreground/50 hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
									title="Hapus Baris Mandiri Ini"
								>
									<Trash2 class="w-4 h-4" />
								</button>
							</div>
						</div>

						<!-- Field-field Input Baris Mandiri (Langsung Datar, Wrap Dinamis di Desktop & Mobile) -->
						<div class="flex flex-wrap items-end gap-2 sm:gap-2.5">
							<!-- Nama Lengkap * -->
							<div class="w-full sm:w-56 flex-1 min-w-[170px]">
								<label
									for="nama-mandiri-{row.id}"
									class="block text-[10px] font-semibold text-foreground/75 mb-1"
								>
									Nama Lengkap <span class="text-destructive">*</span>
								</label>
								<input
									id="nama-mandiri-{row.id}"
									type="text"
									required
									bind:value={row.namaLengkap}
									placeholder="Nama lengkap jamaah mandiri"
									class="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs font-medium text-foreground focus:ring-1 focus:ring-primary"
								/>
							</div>

							<!-- Kelompok -->
							{#if defaultKelompokId === 'ALL'}
								<div class="w-full sm:w-52 shrink-0">
									<label
										for="kelompok-mandiri-{row.id}"
										class="block text-[10px] font-semibold text-foreground/75 mb-1"
									>
										Kelompok <span class="text-destructive">*</span>
									</label>
									<SearchableSelect
										id="kelompok-mandiri-{row.id}"
										name="kelompok-mandiri-{row.id}"
										options={perKeluargaKelompokOptions}
										bind:value={fam.kelompokId}
										placeholder="-- Pilih Kelompok --"
										searchPlaceholder="Cari kelompok..."
										required
									/>
								</div>
							{:else}
								<div class="w-[calc(50%-4px)] sm:w-44 shrink-0">
									<span class="block text-[10px] font-semibold text-foreground/75 mb-1">
										Kelompok
									</span>
									<div
										class="w-full bg-secondary/50 border border-border/80 rounded-lg px-2.5 py-2 text-xs text-foreground font-medium flex items-center justify-between"
										title="Terkunci mengikuti pengaturan kelompok di bagian atas"
									>
										<span class="truncate">{selectedGlobalKelompokLabel}</span>
										<span class="text-[9.5px] text-foreground/50 shrink-0 ml-1">Terkunci</span>
									</div>
								</div>
							{/if}

							<!-- Jenis Kelamin -->
							<div class="w-[calc(50%-4px)] sm:w-28 shrink-0">
								<label
									for="jk-mandiri-{row.id}"
									class="block text-[10px] font-semibold text-foreground/75 mb-1"
								>
									Jenis Kelamin
								</label>
								<select
									id="jk-mandiri-{row.id}"
									bind:value={row.jenisKelamin}
									class="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:ring-1 focus:ring-primary"
								>
									<option value="L">L (Laki-laki)</option>
									<option value="P">P (Perempuan)</option>
								</select>
							</div>

							<!-- Status Hubungan (Otomatis Mandiri / Perantau) -->
							<div class="w-[calc(50%-4px)] sm:w-36 shrink-0">
								<label
									for="hub-mandiri-{row.id}"
									class="block text-[10px] font-semibold text-foreground/75 mb-1"
								>
									Hub. Keluarga
								</label>
								<select
									id="hub-mandiri-{row.id}"
									bind:value={row.statusKeluarga}
									class="w-full bg-secondary/50 border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:ring-1 focus:ring-primary font-medium"
								>
									<option value="Mandiri / Perantau">Mandiri / Perantau</option>
									<option value="Famili Lain">Famili Lain</option>
								</select>
							</div>

							<!-- Tempat Lahir -->
							<div class="w-[calc(50%-4px)] sm:w-32 shrink-0">
								<label
									for="tempat-mandiri-{row.id}"
									class="block text-[10px] font-semibold text-foreground/75 mb-1"
								>
									Tempat Lahir
								</label>
								<input
									id="tempat-mandiri-{row.id}"
									type="text"
									bind:value={row.tempatLahir}
									placeholder="Kota lahir"
									class="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:ring-1 focus:ring-primary"
								/>
							</div>

							<!-- Tanggal Lahir (Dengan Auto Umur & Generus Badge) -->
							<div class="w-[calc(50%-4px)] sm:w-44 shrink-0">
								<div class="flex items-center justify-between mb-1">
									<label
										for="tgl-mandiri-{row.id}"
										class="block text-[10px] font-semibold text-foreground/75"
									>
										Tgl Lahir <span class="text-destructive">*</span>
									</label>
									{#if row.umur > 0}
										<span class="text-[9.5px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
											{row.umur} Thn • {row.statusGenerus}
										</span>
									{/if}
								</div>
								<DateInput
									id="tgl-mandiri-{row.id}"
									required
									bind:value={row.tanggalLahir}
									placeholder="DD-MM-YYYY"
									class="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs font-mono text-foreground focus:ring-1 focus:ring-primary"
								/>
							</div>

							<!-- Status Pernikahan -->
							<div class="w-[calc(50%-4px)] sm:w-32 shrink-0">
								<label
									for="nikah-mandiri-{row.id}"
									class="block text-[10px] font-semibold text-foreground/75 mb-1"
								>
									Status Nikah
								</label>
								<select
									id="nikah-mandiri-{row.id}"
									bind:value={row.statusMenikah}
									onchange={() => onTanggalLahirOrMenikahChange(row)}
									class="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:ring-1 focus:ring-primary"
								>
									{#each DAFTAR_STATUS_PERNIKAHAN as sm}
										<option value={sm}>{sm}</option>
									{/each}
								</select>
							</div>

							<!-- No HP / WA -->
							<div class="w-[calc(50%-4px)] sm:w-32 shrink-0">
								<label
									for="telp-mandiri-{row.id}"
									class="block text-[10px] font-semibold text-foreground/75 mb-1"
								>
									No. HP / WA {#if row.buatAkun}<span class="text-destructive">*</span>{/if}
								</label>
								<input
									id="telp-mandiri-{row.id}"
									type="tel"
									inputmode="numeric"
									pattern="[0-9]*"
									required={row.buatAkun}
									bind:value={row.noTelepon}
									oninput={(e) => {
										row.noTelepon = e.currentTarget.value.replace(/\D/g, '');
									}}
									placeholder="0812xxxx"
									class="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs font-mono text-foreground focus:ring-1 focus:ring-primary"
								/>
							</div>

							<!-- Profesi -->
							<div class="w-[calc(50%-4px)] sm:w-32 shrink-0">
								<label
									for="profesi-mandiri-{row.id}"
									class="block text-[10px] font-semibold text-foreground/75 mb-1"
								>
									Profesi
								</label>
								<input
									id="profesi-mandiri-{row.id}"
									type="text"
									bind:value={row.profesi}
									placeholder="Pekerjaan"
									class="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:ring-1 focus:ring-primary"
								/>
							</div>

							<!-- Alamat Domisili -->
							<div class="w-full sm:w-48 flex-1 min-w-[170px]">
								<label
									for="alamat-mandiri-{row.id}"
									class="block text-[10px] font-semibold text-foreground/75 mb-1"
								>
									Alamat Domisili
								</label>
								<input
									id="alamat-mandiri-{row.id}"
									type="text"
									bind:value={row.alamat}
									oninput={() => {
										fam.alamat = row.alamat;
									}}
									placeholder="Alamat tempat tinggal / kost"
									class="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:ring-1 focus:ring-primary"
								/>
							</div>


							<!-- Isrun (Admin Only) -->
							<div class="w-[calc(50%-4px)] sm:w-20 shrink-0">
								<label
									for="isrun-mandiri-{row.id}"
									class="block text-[10px] font-semibold text-foreground/75 mb-1"
								>
									Isrun
								</label>
								<select
									id="isrun-mandiri-{row.id}"
									bind:value={row.isrun}
									class="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-xs text-foreground focus:ring-1 focus:ring-primary"
								>
									{#each DAFTAR_ISRUN as isr}
										<option value={isr}>{isr}</option>
									{/each}
								</select>
							</div>

							<!-- Email Login (Muncul jika Buat Akun aktif) -->
							{#if row.buatAkun}
								<div
									class="w-full sm:w-56 shrink-0 bg-amber-500/10 p-1.5 rounded-lg border border-amber-500/20"
								>
									<label
										for="email-mandiri-{row.id}"
										class="block text-[10px] font-semibold text-amber-900 dark:text-amber-200 mb-1"
									>
										Email Login (Opsional)
									</label>
									<input
										id="email-mandiri-{row.id}"
										type="email"
										bind:value={row.email}
										placeholder="nama@email.com"
										class="w-full bg-background border border-border rounded-md px-2 py-1 text-xs text-foreground focus:ring-1 focus:ring-primary"
									/>
								</div>
							{/if}
						</div>
					</div>
				{:else}
					<!-- ============================================================== -->
					<!-- TAMPILAN KARTU KELUARGA (KK) DENGAN GROUPING & DAFTAR ANGGOTA -->
					<!-- ============================================================== -->
					<div
						class="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-sm space-y-4 transition-all"
					>
						<!-- Header Kartu Keluarga -->
						<div
							class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/70"
						>
							<div class="flex flex-wrap items-center gap-2 sm:gap-3">
								<div class="p-2 rounded-xl bg-primary/10 text-primary">
									<Home class="w-4 h-4" />
								</div>
								<div>
									<div class="flex items-center gap-2">
										<h2 class="text-sm font-bold text-foreground">
											Kartu Keluarga #{fIdx + 1}
										</h2>
										<span
											class="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-primary/10 text-primary"
										>
											{fam.members.length} Jiwa
										</span>
									</div>
									<p class="text-[11px] text-foreground/60">
										Semua anggota di bawah ini otomatis terikat ke satu KK yang sama.
									</p>
								</div>
							</div>

							<div class="flex items-center gap-2 sm:gap-3">
								<!-- Opsi ubah ke Mandiri -->
								<button
									type="button"
									onclick={() => convertToPerantau(fam)}
									class="px-2.5 py-1.5 text-xs font-medium text-foreground/70 hover:text-foreground bg-secondary/50 hover:bg-secondary rounded-lg border border-border transition-colors"
									title="Ubah kartu ini menjadi jamaah mandiri (1 baris)"
								>
									Jadikan Mandiri
								</button>

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
									No. KK <span class="text-foreground/50 font-normal">(Boleh kosong / tanpa No KK)</span>
								</label>
								<input
									id="noKk-{fam.id}"
									type="text"
									inputmode="numeric"
									pattern="[0-9]*"
									maxlength="16"
									bind:value={fam.noKk}
									oninput={(e) => {
										fam.noKk = e.currentTarget.value.replace(/\D/g, '');
									}}
									placeholder="Nomor KK (Opsional)"
									class="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs font-mono text-foreground focus:ring-1 focus:ring-primary"
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
							{#if defaultKelompokId === 'ALL'}
								<div>
									<label for="kelompok-{fam.id}" class="block text-[11px] font-semibold text-foreground/80 mb-1">
										Kelompok <span class="text-destructive">*</span>
									</label>
									<SearchableSelect
										id="kelompok-{fam.id}"
										name="kelompok-{fam.id}"
										options={perKeluargaKelompokOptions}
										bind:value={fam.kelompokId}
										placeholder="-- Pilih Kelompok --"
										searchPlaceholder="Cari nama kelompok..."
										required
									/>
								</div>
							{:else}
								<div>
									<span class="block text-[11px] font-semibold text-foreground/80 mb-1">
										Kelompok
									</span>
									<div
										class="w-full bg-secondary/50 border border-border/80 rounded-lg px-2.5 py-2 text-xs text-foreground font-medium flex items-center justify-between"
										title="Terkunci mengikuti pengaturan kelompok di bagian atas"
									>
										<span class="truncate">{selectedGlobalKelompokLabel}</span>
										<span class="text-[10px] text-foreground/50 font-normal shrink-0 ml-1.5">Terkunci</span>
									</div>
								</div>
							{/if}
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
												{#if mIdx === 0}
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
													class="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:ring-1 focus:ring-primary"
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

											<!-- Tanggal Lahir (Dengan Auto Umur & Generus Badge) -->
											<div class="w-[calc(50%-4px)] sm:w-44 shrink-0">
												<div class="flex items-center justify-between mb-1">
													<label for="tgl-{row.id}" class="block text-[10px] font-semibold text-foreground/75">
														Tgl Lahir <span class="text-destructive">*</span>
													</label>
													{#if row.umur > 0}
														<span class="text-[9.5px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
															{row.umur} Thn • {row.statusGenerus}
														</span>
													{/if}
												</div>
												<DateInput
													id="tgl-{row.id}"
													required
													bind:value={row.tanggalLahir}
													placeholder="DD-MM-YYYY"
													class="w-full bg-card border border-border rounded-lg px-2 py-1.5 text-xs font-mono text-foreground focus:ring-1 focus:ring-primary"
												/>
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
													No. HP / WA {#if row.buatAkun}<span class="text-destructive">*</span>{/if}
												</label>
												<input
													id="telp-{row.id}"
													type="tel"
													inputmode="numeric"
													pattern="[0-9]*"
													required={row.buatAkun}
													bind:value={row.noTelepon}
													oninput={(e) => {
														row.noTelepon = e.currentTarget.value.replace(/\D/g, '');
													}}
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
												<label
													for="alamat-anggota-{row.id}"
													class="block text-[10px] font-semibold text-foreground/75 mb-1"
												>
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


											<!-- Isrun (Admin Only) -->
											<div class="w-[calc(50%-4px)] sm:w-20 shrink-0">
												<label
													for="isrun-{row.id}"
													class="block text-[10px] font-semibold text-foreground/75 mb-1"
												>
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
												<div
													class="w-full sm:w-56 shrink-0 bg-amber-500/10 p-1.5 rounded-lg border border-amber-500/20"
												>
													<label
														for="email-{row.id}"
														class="block text-[10px] font-semibold text-amber-900 dark:text-amber-200 mb-1"
													>
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

							<!-- Tombol Khusus: Tambah Anggota ke KK Ini -->
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
				{/if}
			{/each}
		</div>

		<!-- Tombol Tambah KK / Mandiri di Bawah Seluruh List -->
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
				class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-blue-500/30 bg-card hover:bg-secondary text-xs font-semibold text-blue-700 dark:text-blue-300 transition-all shadow-sm"
			>
				<UserCheck class="w-4 h-4 text-blue-500" />
				<span>+ Tambah Jamaah Mandiri (1 Baris)</span>
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
						<span>Simpan {totalJiwa} Jiwa ({families.length} Entri Sensus)</span>
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
					class="text-[11px] text-foreground/70 bg-secondary/50 p-3 rounded-xl border border-border space-y-1.5"
				>
					<p class="font-bold text-foreground">💡 Tips Urutan Kolom Spreadsheet Praktis:</p>
					<p class="font-mono text-[10.5px] bg-card p-2 rounded-lg border border-border/60 text-primary font-semibold overflow-x-auto select-all">
						No | Kelompok | Nama Lengkap | JK | Tempat Lahir | Tgl Lahir | Alamat | Profesi | No HP | Status Menikah | Status Keluarga | No KK | Isrun
					</p>
					<div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[10.5px] text-foreground/70 pt-1 border-t border-border/40">
						<div>✨ <strong>Umur:</strong> Otomatis dihitung dari Tanggal Lahir</div>
						<div>✨ <strong>Status Generus:</strong> Otomatis mengikuti Umur & Pernikahan</div>
						<div>✨ <strong>Status Jamaah:</strong> Default otomatis <strong>Aktif</strong></div>
						<div>✨ <strong>Golongan Darah:</strong> Default kosong / null (opsional)</div>
					</div>
					<p class="text-[10px] text-foreground/50 pt-0.5">
						Baris Mandiri otomatis dibuatkan kartu tunggal, sedangkan baris keluarga otomatis dikelompokkan ke KK yang sama.
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
