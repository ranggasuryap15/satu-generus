<!--
  @file src/routes/(app)/sensus/anggota/tambah/+page.svelte
  @purpose Halaman mandiri tambah anggota keluarga jamaah dengan dukungan multi-member dinamis, struktur urutan field hierarkis (Nama, Hubungan/JK, Tempat/Tanggal Lahir, Umur/Pernikahan, Generus, NIK & No HP, Profesi & Gol Darah), kalkulasi umur & generus otomatis, sinkronisasi hubungan keluarga, dan dialog konfirmasi batal saat formulir terisi
  @usedBy Route client '/sensus/anggota/tambah'
  @dependencies @lucide/svelte, $app/forms, $app/navigation (goto, beforeNavigate), #lib/confirm.svelte.ts (confirmAction), #lib/components/DateInput.svelte, #lib/generus, #lib/confirmSubmit.ts, #lib/keepScroll.js, Svelte 5 Runes
  @publicFunctions addMemberCard, removeMemberCard, onStatusHubunganChange, onTanggalLahirChange, handleBatal
  @sideEffects Mengirim batch data anggota keluarga ke server action via enhance serta menampilkan modal konfirmasi pembatalan/navigasi saat formulir telah terisi
-->
<script lang="ts">
	import {
		ArrowLeft,
		Plus,
		Trash2,
		Users,
		Home,
		AlertCircle,
		Loader2,
		CheckCircle2,
		Calendar
	} from '@lucide/svelte';
	import { enhance } from '$app/forms';
	import { goto, beforeNavigate } from '$app/navigation';
	import type { ActionData, PageData } from './$types';
	import DateInput from '#lib/components/DateInput.svelte';
	import {
		DAFTAR_STATUS_GENERUS,
		hitungUmur,
		hitungStatusGenerus,
		resolveStatusPernikahan
	} from '#lib/generus.js';
	import { confirmSubmit } from '#lib/confirmSubmit.ts';
	import { keepScrollSubmit } from '#lib/keepScroll.js';
	import { confirmAction } from '#lib/confirm.svelte.ts';

	let { data, form } = $props<{ data: PageData; form: ActionData }>();

	interface MemberItem {
		id: string;
		namaLengkap: string;
		nik: string;
		statusHubungan: string;
		jenisKelamin: string;
		tanggalLahir: string;
		tempatLahir: string;
		statusGenerus: string;
		statusPernikahan: string;
		profesi: string;
		golonganDarah: string;
		noTelepon: string;
		umur: number | null;
	}

	function createDefaultMember(index: number, existingHasIstri: boolean): MemberItem {
		// Jika belum ada istri di KK dan kartu pertama yang ditambah, set default Istri
		const isFirstAndNoIstri = index === 0 && !existingHasIstri;
		const defaultStatus = isFirstAndNoIstri ? 'Istri' : 'Anak';
		const defaultJk = isFirstAndNoIstri ? 'P' : 'L';
		const defaultNikah = isFirstAndNoIstri ? 'Sudah Menikah' : 'Belum Menikah';

		return {
			id: Math.random().toString(36).substring(2, 9),
			namaLengkap: '',
			nik: '',
			statusHubungan: defaultStatus,
			jenisKelamin: defaultJk,
			tanggalLahir: '',
			tempatLahir: '',
			statusGenerus: '',
			statusPernikahan: defaultNikah,
			profesi: '',
			golonganDarah: '',
			noTelepon: '',
			umur: null
		};
	}

	let members = $state<MemberItem[]>([]);
	let isInitialized = false;

	$effect(() => {
		if (!isInitialized) {
			members = [createDefaultMember(0, data.hasIstri)];
			isInitialized = true;
		}
	});

	let isSubmitting = $state(false);
	let localError = $state<string | null>(null);

	function addMemberCard() {
		// Anggota berikutnya default sebagai Anak
		const nextIndex = members.length;
		const newMember = createDefaultMember(nextIndex, true);
		members = [...members, newMember];
	}

	function removeMemberCard(index: number) {
		if (members.length <= 1) return;
		members = members.filter((_, i) => i !== index);
	}

	function onStatusHubunganChange(member: MemberItem) {
		if (member.statusHubungan === 'Istri') {
			member.jenisKelamin = 'P';
			if (!member.statusPernikahan || member.statusPernikahan === 'Belum Menikah') {
				member.statusPernikahan = 'Sudah Menikah';
			}
		} else if (member.statusHubungan === 'Suami' || member.statusHubungan === 'Kepala Keluarga') {
			member.jenisKelamin = 'L';
			if (!member.statusPernikahan || member.statusPernikahan === 'Belum Menikah') {
				member.statusPernikahan = 'Sudah Menikah';
			}
		} else if (member.statusHubungan === 'Anak') {
			if (!member.statusPernikahan) {
				member.statusPernikahan = 'Belum Menikah';
			}
		}
		if (member.umur !== null) {
			const statusNikah = member.statusPernikahan || resolveStatusPernikahan(member.statusHubungan);
			member.statusGenerus = hitungStatusGenerus(member.umur, statusNikah);
		}
	}

	function onStatusPernikahanChange(member: MemberItem) {
		if (member.umur !== null) {
			const statusNikah = member.statusPernikahan || resolveStatusPernikahan(member.statusHubungan);
			member.statusGenerus = hitungStatusGenerus(member.umur, statusNikah);
		}
	}

	// Sinkronisasi umur & status generus otomatis ketika tanggal lahir diubah
	$effect(() => {
		for (const member of members) {
			if (member.tanggalLahir) {
				try {
					const parts = member.tanggalLahir.split('-');
					let iso = '';
					if (parts.length === 3) {
						if (parts[0].length === 4) {
							iso = member.tanggalLahir;
						} else {
							iso = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
						}
					}
					if (iso) {
						const u = hitungUmur(iso);
						if (member.umur !== u) {
							member.umur = u;
							if (!member.statusGenerus) {
								const statusNikah = member.statusPernikahan || resolveStatusPernikahan(member.statusHubungan);
								member.statusGenerus = hitungStatusGenerus(u, statusNikah);
							}
						}
					}
				} catch (_) {
					member.umur = null;
				}
			} else {
				member.umur = null;
			}
		}
	});

	let serializedMembers = $derived(JSON.stringify(members));

	let bypassConfirm = $state(false);

	// Deteksi apakah formulir telah terisi atau diubah dari kondisi default awal
	const isFormDirty = $derived.by(() => {
		if (members.length > 1) return true;
		if (members.length === 0) return false;
		const m = members[0];
		const isTextFilled =
			Boolean(m.namaLengkap?.trim()) ||
			Boolean(m.nik?.trim()) ||
			Boolean(m.tanggalLahir?.trim()) ||
			Boolean(m.tempatLahir?.trim()) ||
			Boolean(m.profesi?.trim()) ||
			Boolean(m.golonganDarah?.trim()) ||
			Boolean(m.noTelepon?.trim());

		if (isTextFilled) return true;

		const defaultStatus0 = !data.hasIstri ? 'Istri' : 'Anak';
		const defaultJk0 = !data.hasIstri ? 'P' : 'L';
		const defaultNikah0 = !data.hasIstri ? 'Sudah Menikah' : 'Belum Menikah';

		if (
			m.statusHubungan !== defaultStatus0 ||
			m.jenisKelamin !== defaultJk0 ||
			m.statusPernikahan !== defaultNikah0 ||
			Boolean(m.statusGenerus)
		) {
			return true;
		}

		return false;
	});

	async function handleBatal(e?: Event) {
		if (e) e.preventDefault();
		if (isFormDirty && !bypassConfirm) {
			const ok = await confirmAction({
				title: 'Batalkan Pengisian?',
				message:
					'Ada formulir yang sudah terisi. Jika dibatalkan sekarang, isian yang belum disimpan akan hilang. Yakin ingin membatalkan?',
				confirmText: 'Ya, Batalkan',
				cancelText: 'Lanjut Mengisi',
				variant: 'warning'
			});
			if (ok) {
				bypassConfirm = true;
				goto('/sensus');
			}
		} else {
			bypassConfirm = true;
			goto('/sensus');
		}
	}

	// Cegah navigasi internal SPA saat ada isian formulir yang belum tersimpan
	beforeNavigate((navigation) => {
		if (isFormDirty && !bypassConfirm && !isSubmitting) {
			navigation.cancel();
			void confirmAction({
				title: 'Batalkan Pengisian?',
				message:
					'Ada formulir yang sudah terisi. Jika keluar sekarang, data yang belum disimpan akan hilang. Yakin ingin membatalkan?',
				confirmText: 'Ya, Tinggalkan',
				cancelText: 'Lanjut Mengisi',
				variant: 'warning'
			}).then((ok) => {
				if (ok && navigation.to) {
					bypassConfirm = true;
					goto(navigation.to.url.href);
				}
			});
		}
	});

	// Peringatan konfirmasi saat reload atau menutup tab peramban jika form terisi
	$effect(() => {
		const handleBeforeUnload = (e: BeforeUnloadEvent) => {
			if (isFormDirty && !bypassConfirm && !isSubmitting) {
				e.preventDefault();
				e.returnValue = '';
				return '';
			}
		};

		window.addEventListener('beforeunload', handleBeforeUnload);
		return () => {
			window.removeEventListener('beforeunload', handleBeforeUnload);
		};
	});
</script>

<svelte:head>
	<title>Tambah Anggota Keluarga - Satu Generus</title>
</svelte:head>

<div class="max-w-3xl mx-auto space-y-5 pb-16">
	<!-- Header Bar & Navigasi Kembali -->
	<div class="flex items-center justify-between border-b border-border/70 pb-3">
		<div class="flex items-center gap-3">
			<button
				type="button"
				onclick={handleBatal}
				class="p-2 rounded-xl border border-border bg-card hover:bg-secondary text-foreground/70 hover:text-foreground transition-all cursor-pointer shadow-2xs"
				title="Kembali ke Halaman Sensus"
			>
				<ArrowLeft class="w-4 h-4" />
			</button>
			<div>
				<h1 class="text-base sm:text-lg font-bold text-foreground tracking-tight">
					Tambah Anggota Keluarga
				</h1>
				<p class="text-xs text-foreground/60">
					Isi formulir anggota baru untuk Kartu Keluarga Anda
				</p>
			</div>
		</div>

		<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
			<Users class="w-3.5 h-3.5" />
			<span>{members.length} Jiwa Baru</span>
		</span>
	</div>

	<!-- Box Informasi KK Target -->
	<div class="p-3.5 bg-card border border-border rounded-xl flex items-start gap-3 shadow-2xs">
		<div class="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
			<Home class="w-4 h-4" />
		</div>
		<div class="min-w-0 flex-1 text-xs">
			<div class="flex items-center gap-2 flex-wrap">
				<span class="font-bold text-foreground">KK: {data.keluarga.noKkMasked}</span>
				<span class="text-foreground/40">•</span>
				<span class="text-foreground/60">Sudah terdaftar {data.totalExistingMembers} anggota</span>
			</div>
			<p class="text-foreground/60 truncate mt-0.5">
				{data.keluarga.alamatLengkap || 'Belum ada alamat'}
			</p>
		</div>
	</div>

	<!-- Alert Error jika ada kegagalan -->
	{#if form?.error || localError}
		<div class="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 dark:bg-rose-950/40 dark:border-rose-900/60 dark:text-rose-300 text-xs flex items-start gap-2.5 shadow-xs animate-in fade-in duration-150">
			<AlertCircle class="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
			<div class="flex-1 min-w-0">
				<span class="font-bold block">Gagal Menyimpan Data:</span>
				<span class="leading-relaxed">{form?.error || localError}</span>
			</div>
		</div>
	{/if}

	<form
		method="POST"
		use:enhance={confirmSubmit(
			{
				title: 'Simpan Semua Anggota Keluarga?',
				message: `Anda akan menambahkan ${members.length} anggota keluarga baru. Pastikan seluruh nama, tanggal lahir, dan status hubungan sudah benar. Lanjutkan?`,
				confirmText: 'Ya, Simpan Anggota',
				cancelText: 'Periksa Lagi',
				variant: 'primary'
			},
			keepScrollSubmit({
				beforeSubmit: () => {
					isSubmitting = true;
					bypassConfirm = true;
					localError = null;
				},
				onFinally: () => {
					isSubmitting = false;
				},
				onError: (result) => {
					isSubmitting = false;
					bypassConfirm = false;
					if (result.type === 'failure' && result.data) {
						localError = (result.data as any)?.error || 'Gagal menyimpan anggota keluarga.';
					}
				}
			}),
			() => {
				localError = null;
				for (let i = 0; i < members.length; i++) {
					const m = members[i];
					if (!m.namaLengkap.trim()) {
						localError = `Nama lengkap anggota #${i + 1} wajib diisi.`;
						return false;
					}
					if (!m.tanggalLahir) {
						localError = `Tanggal lahir anggota #${i + 1} wajib diisi.`;
						return false;
					}
					if (m.nik.trim() && m.nik.trim().length !== 16) {
						localError = `NIK anggota #${i + 1} harus 16 digit angka jika diisi.`;
						return false;
					}
				}
				return true;
			}
		)}
		class="space-y-4"
	>
		<input type="hidden" name="keluargaId" value={data.keluarga.id} />
		<input type="hidden" name="anggotaJson" value={serializedMembers} />

		<!-- Daftar Kartu Anggota Dinamis -->
		<div class="space-y-4">
			{#each members as member, idx (member.id)}
				<div class="bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-sm space-y-4 relative transition-all">
					<!-- Header Kartu Anggota -->
					<div class="flex items-center justify-between pb-3 border-b border-border/60">
						<div class="flex items-center gap-2">
							<span class="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
								{idx + 1}
							</span>
							<h3 class="text-sm font-bold text-foreground">
								Anggota Keluarga #{idx + 1}
								{#if member.namaLengkap}
									<span class="text-foreground/50 font-normal">({member.namaLengkap})</span>
								{/if}
							</h3>
						</div>

						{#if members.length > 1}
							<button
								type="button"
								onclick={() => removeMemberCard(idx)}
								class="inline-flex items-center gap-1 text-xs text-destructive hover:text-destructive/80 p-1.5 rounded-lg hover:bg-destructive/10 transition-colors cursor-pointer"
								title="Hapus baris anggota ini"
							>
								<Trash2 class="w-4 h-4" />
								<span class="hidden sm:inline">Hapus</span>
							</button>
						{/if}
					</div>

					<!-- Grid Form Field Lengkap -->
					<div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
						<!-- 1. Nama Lengkap (Wajib) -->
						<div class="sm:col-span-2">
							<label for={`nama-${member.id}`} class="block font-semibold text-foreground mb-1">
								Nama Lengkap *
							</label>
							<input
								id={`nama-${member.id}`}
								type="text"
								required
								bind:value={member.namaLengkap}
								placeholder="Contoh: Siti Rahayu"
								class="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
							/>
						</div>

						<!-- 2. Hubungan Keluarga & Jenis Kelamin (Wajib di atas) -->
						<div>
							<label for={`status-${member.id}`} class="block font-semibold text-foreground mb-1">
								Hubungan dalam Keluarga *
							</label>
							<select
								id={`status-${member.id}`}
								required
								bind:value={member.statusHubungan}
								onchange={() => onStatusHubunganChange(member)}
								class="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
							>
								<option value="Istri">Istri</option>
								<option value="Anak">Anak</option>
								<option value="Suami">Suami</option>
								<option value="Orang Tua">Orang Tua</option>
								<option value="Mertua">Mertua</option>
								<option value="Famili Lain">Famili Lain</option>
							</select>
						</div>

						<div>
							<label for={`jk-${member.id}`} class="block font-semibold text-foreground mb-1">
								Jenis Kelamin *
							</label>
							<select
								id={`jk-${member.id}`}
								required
								bind:value={member.jenisKelamin}
								class="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
							>
								<option value="L">Laki-laki (L)</option>
								<option value="P">Perempuan (P)</option>
							</select>
						</div>

						<!-- 3. Tempat Lahir & Tanggal Lahir (Setelah tempat lahir langsung tanggal lahir) -->
						<div>
							<label for={`tempatLahir-${member.id}`} class="block font-semibold text-foreground mb-1">
								Tempat Lahir
							</label>
							<input
								id={`tempatLahir-${member.id}`}
								type="text"
								bind:value={member.tempatLahir}
								placeholder="Kota / Kabupaten Lahir"
								class="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
							/>
						</div>

						<div>
							<label for={`tgl-${member.id}`} class="block font-semibold text-foreground mb-1">
								Tanggal Lahir *
							</label>
							<DateInput
								id={`tgl-${member.id}`}
								required
								bind:value={member.tanggalLahir}
								class="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
							/>
						</div>

						<!-- 4. Umur & Status Pernikahan -->
						<div>
							<label for={`umur-${member.id}`} class="block font-semibold text-foreground mb-1">
								Umur (Otomatis)
							</label>
							<input
								id={`umur-${member.id}`}
								type="text"
								disabled
								value={member.umur !== null ? `${member.umur} Tahun` : '-'}
								class="w-full bg-secondary/70 border border-border/80 rounded-lg px-3 py-2 text-xs text-foreground/70 font-semibold cursor-not-allowed select-none"
							/>
						</div>

						<div>
							<label for={`pernikahan-${member.id}`} class="block font-semibold text-foreground mb-1">
								Status Pernikahan
							</label>
							<select
								id={`pernikahan-${member.id}`}
								bind:value={member.statusPernikahan}
								onchange={() => onStatusPernikahanChange(member)}
								class="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
							>
								<option value="Belum Menikah">Belum Menikah</option>
								<option value="Sudah Menikah">Sudah Menikah</option>
								<option value="Duda">Duda</option>
								<option value="Janda">Janda</option>
							</select>
						</div>

						<!-- 5. Status Generus -->
						<div class="sm:col-span-2">
							<label for={`generus-${member.id}`} class="block font-semibold text-foreground mb-1">
								Status Generus
							</label>
							<select
								id={`generus-${member.id}`}
								bind:value={member.statusGenerus}
								class="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
							>
								<option value="">-- Otomatis Mengikuti Umur --</option>
								{#each DAFTAR_STATUS_GENERUS as g}
									<option value={g}>{g}</option>
								{/each}
							</select>
						</div>

						<!-- 6. NIK di bawahnya Tanggal Lahir & No. HP setelah NIK -->
						<div>
							<label for={`nik-${member.id}`} class="block font-semibold text-foreground mb-1">
								Nomor Induk Kependudukan (NIK - Opsional)
							</label>
							<input
								id={`nik-${member.id}`}
								type="text"
								inputmode="numeric"
								pattern="[0-9]*"
								maxlength="16"
								autocomplete="off"
								bind:value={member.nik}
								oninput={(e) => {
									member.nik = e.currentTarget.value.replace(/\D/g, '');
								}}
								placeholder="16 digit NIK (opsional, bisa kosong)"
								class="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
							/>
							<p class="text-[10px] text-foreground/50 mt-0.5">
								16 digit angka (opsional, bisa kosong)
							</p>
						</div>

						<div>
							<label for={`hp-${member.id}`} class="block font-semibold text-foreground mb-1">
								No. HP / WhatsApp (Opsional)
							</label>
							<input
								id={`hp-${member.id}`}
								type="tel"
								inputmode="numeric"
								pattern="[0-9]*"
								bind:value={member.noTelepon}
								oninput={(e) => {
									member.noTelepon = e.currentTarget.value.replace(/\D/g, '');
								}}
								placeholder="0812xxxxxxxx (opsional)"
								class="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
							/>
						</div>

						<!-- 7. Profesi & Golongan Darah (Opsional) -->
						<div>
							<label for={`profesi-${member.id}`} class="block font-semibold text-foreground mb-1">
								Profesi / Pekerjaan
							</label>
							<input
								id={`profesi-${member.id}`}
								type="text"
								bind:value={member.profesi}
								placeholder="Pekerjaan / Pelajar / Wiraswasta"
								class="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
							/>
						</div>

						<div>
							<label for={`golDarah-${member.id}`} class="block font-semibold text-foreground mb-1">
								Golongan Darah
							</label>
							<select
								id={`golDarah-${member.id}`}
								bind:value={member.golonganDarah}
								class="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
							>
								<option value="">-- Pilih Gol. Darah --</option>
								<option value="A">A</option>
								<option value="B">B</option>
								<option value="AB">AB</option>
								<option value="O">O</option>
								<option value="-">-</option>
							</select>
						</div>
					</div>
				</div>
			{/each}
		</div>

		<!-- Tombol Tambah Anggota Lainnya -->
		<button
			type="button"
			onclick={addMemberCard}
			class="w-full py-3 rounded-2xl border-2 border-dashed border-border hover:border-primary/50 bg-secondary/30 hover:bg-secondary/60 text-foreground font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs"
		>
			<Plus class="w-4 h-4 text-primary" />
			<span>+ Tambah Anggota Keluarga Lain</span>
		</button>

		<!-- Tombol Aksi Simpan & Batal -->
		<div class="flex items-center justify-end gap-3 pt-4 border-t border-border">
			<button
				type="button"
				onclick={handleBatal}
				class="px-5 py-2.5 rounded-xl border border-border text-foreground hover:bg-secondary text-xs font-semibold transition-colors cursor-pointer"
			>
				Batal
			</button>
			<button
				type="submit"
				disabled={isSubmitting}
				class="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2 transition-all cursor-pointer shadow-sm"
			>
				{#if isSubmitting}
					<Loader2 class="w-4 h-4 animate-spin" />
					<span>Menyimpan Semua Anggota...</span>
				{:else}
					<CheckCircle2 class="w-4 h-4" />
					<span>Simpan {members.length} Anggota</span>
				{/if}
			</button>
		</div>
	</form>
</div>

