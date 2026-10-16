<!--
  @file src/routes/(app)/sensus/+page.svelte
  @purpose Tampilan status dan rincian Kartu Keluarga/Jamaah Mandiri dengan standar Zero Over-Information: retensi NIK/KK asli pada modal edit, field anggota lengkap (profesi, status pernikahan, generus, gol. darah), navigasi ke halaman mandiri tambah anggota multi-member, visual unmasking, dan retensi scroll
  @usedBy Route client '/sensus'
  @dependencies @lucide/svelte, $app/forms (enhance), $app/state (page), #lib/components/DateInput.svelte, #lib/utils (formatDateDDMMYYYY), #lib/generus, #lib/keepScroll.ts (keepScrollSubmit), Svelte 5 Runes
  @publicFunctions toggleKk, copyKk, toggleNik, copyNik, openEditKk, closeEditKkModal, openEditAnggota, closeEditAnggotaModal, onEditAnggotaStatusChange, onEditAnggotaTglChange
  @sideEffects Mengirim HTTP POST ke /api/sensus/unmask serta server actions updateKeluarga/updateAnggota/hapusAnggota via enhance dengan posisi scroll terjaga
-->
<script lang="ts">
	import {
		Users,
		Plus,
		Home,
		Shield,
		Calendar,
		UserCheck,
		Eye,
		EyeOff,
		Copy,
		Check,
		Pencil,
		Trash2,
		X,
		AlertCircle,
		CheckCircle,
		Phone,
		Briefcase,
		Droplet
	} from '@lucide/svelte';
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import type { PageData, ActionData } from './$types';
	import DateInput from '#lib/components/DateInput.svelte';
	import { formatDateDDMMYYYY } from '#lib/utils.js';
	import {
		DAFTAR_STATUS_GENERUS,
		hitungUmur,
		hitungStatusGenerus,
		resolveStatusPernikahan
	} from '#lib/generus.js';
	import { confirmAction } from '#lib/confirm.svelte.ts';
	import { keepScrollSubmit } from '#lib/keepScroll.js';
	import { confirmSubmit } from '#lib/confirmSubmit.ts';

	let { data, form } = $props<{ data: PageData; form: ActionData }>();

	// Redirect ke halaman mandiri tambah anggota jika ada query ?tambah=1
	$effect(() => {
		if (page.url.searchParams.get('tambah') === '1' && data.hasKeluarga) {
			goto('/sensus/anggota/tambah');
		}
	});

	// State Unmasking No KK
	let isKkRevealed = $state(false);
	let plainNoKk = $state('');
	let isKkLoading = $state(false);
	let copiedKk = $state(false);

	// State Unmasking NIK Anggota
	let revealedNiks = $state<Record<string, string>>({});
	let loadingNiks = $state<Record<string, boolean>>({});
	let copiedNiks = $state<Record<string, boolean>>({});

	let errorMessage = $state('');

	// State Modal Edit Data
	let activeModal = $state<'none' | 'editKk' | 'editAnggota'>('none');
	let selectedAnggota = $state<(typeof data.anggotaList)[number] | null>(null);
	let isSubmitting = $state(false);

	let editKkNoKk = $state('');
	let editKkAlamat = $state('');

	let editAnggotaNama = $state('');
	let editAnggotaNik = $state('');
	let editAnggotaStatus = $state('');
	let editAnggotaTgl = $state('');
	let editAnggotaJk = $state('');
	let editAnggotaNoTelepon = $state('');
	let editAnggotaTempatLahir = $state('');
	let editAnggotaStatusGenerus = $state('');
	let editAnggotaStatusPernikahan = $state('');
	let editAnggotaProfesi = $state('');
	let editAnggotaGolonganDarah = $state('');

	let editAnggotaUmur = $derived.by(() => {
		if (!editAnggotaTgl) return null;
		try {
			const parts = editAnggotaTgl.split('-');
			let iso = '';
			if (parts.length === 3) {
				if (parts[0].length === 4) iso = editAnggotaTgl;
				else iso = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
			}
			return iso ? hitungUmur(iso) : null;
		} catch (_) {
			return null;
		}
	});

	function onEditAnggotaStatusChange() {
		if (editAnggotaStatus === 'Istri') {
			editAnggotaJk = 'Perempuan';
			if (!editAnggotaStatusPernikahan || editAnggotaStatusPernikahan === 'Belum Menikah') {
				editAnggotaStatusPernikahan = 'Sudah Menikah';
			}
		} else if (editAnggotaStatus === 'Kepala Keluarga' || editAnggotaStatus === 'Suami') {
			editAnggotaJk = 'Laki-laki';
			if (!editAnggotaStatusPernikahan || editAnggotaStatusPernikahan === 'Belum Menikah') {
				editAnggotaStatusPernikahan = 'Sudah Menikah';
			}
		} else if (editAnggotaStatus === 'Anak') {
			if (!editAnggotaStatusPernikahan) {
				editAnggotaStatusPernikahan = 'Belum Menikah';
			}
		}
		if (editAnggotaUmur !== null) {
			editAnggotaStatusGenerus = hitungStatusGenerus(
				editAnggotaUmur,
				editAnggotaStatusPernikahan || resolveStatusPernikahan(editAnggotaStatus)
			);
		}
	}

	$effect(() => {
		if (activeModal === 'editAnggota' && editAnggotaUmur !== null && !editAnggotaStatusGenerus) {
			editAnggotaStatusGenerus = hitungStatusGenerus(
				editAnggotaUmur,
				editAnggotaStatusPernikahan || resolveStatusPernikahan(editAnggotaStatus)
			);
		}
	});

	$effect(() => {
		if (editAnggotaStatus === 'Istri' && editAnggotaJk !== 'Perempuan') {
			editAnggotaJk = 'Perempuan';
		} else if ((editAnggotaStatus === 'Kepala Keluarga' || editAnggotaStatus === 'Suami') && editAnggotaJk !== 'Laki-laki') {
			editAnggotaJk = 'Laki-laki';
		}
	});

	function openEditKk() {
		editKkNoKk = (data.keluarga as any)?.noKkRaw || (isKkRevealed && plainNoKk ? plainNoKk : '');
		editKkAlamat = data.keluarga?.alamatLengkap || '';
		activeModal = 'editKk';
	}

	async function closeEditKkModal(force = false) {
		if (!force) {
			const initialNoKk = (data.keluarga as any)?.noKkRaw || (isKkRevealed && plainNoKk ? plainNoKk : '');
			const initialAlamat = data.keluarga?.alamatLengkap || '';
			const isDirty = editKkNoKk !== initialNoKk || editKkAlamat !== initialAlamat;
			if (isDirty) {
				const ok = await confirmAction({
					title: 'Tutup Ubah KK?',
					message: 'Ada perubahan data Kartu Keluarga yang belum disimpan. Yakin ingin menutup modal?',
					confirmText: 'Ya, Tutup',
					cancelText: 'Batal',
					variant: 'warning'
				});
				if (!ok) {
					return;
				}
			}
		}
		activeModal = 'none';
	}

	function openEditAnggota(anggota: (typeof data.anggotaList)[number]) {
		selectedAnggota = anggota;
		editAnggotaNama = anggota.namaLengkap || '';
		editAnggotaNik = (anggota as any).nikRaw || revealedNiks[anggota.id] || '';
		editAnggotaStatus = anggota.statusHubungan;
		editAnggotaTgl = anggota.tanggalLahir;
		editAnggotaJk = anggota.jenisKelamin === 'L' ? 'Laki-laki' : (anggota.jenisKelamin === 'P' ? 'Perempuan' : anggota.jenisKelamin);
		editAnggotaNoTelepon = anggota.noTelepon || '';
		editAnggotaTempatLahir = (anggota as any).tempatLahir || '';
		editAnggotaStatusGenerus = (anggota as any).statusGenerus || '';
		editAnggotaStatusPernikahan = (anggota as any).statusPernikahan || '';
		editAnggotaProfesi = (anggota as any).profesi || '';
		editAnggotaGolonganDarah = (anggota as any).golonganDarah || '';
		activeModal = 'editAnggota';
	}

	async function closeEditAnggotaModal(force = false) {
		if (!force) {
			if (selectedAnggota) {
				const isDirty = (
					editAnggotaNama !== (selectedAnggota.namaLengkap || '') ||
					editAnggotaNik !== ((selectedAnggota as any).nikRaw || revealedNiks[selectedAnggota.id] || '') ||
					editAnggotaStatus !== selectedAnggota.statusHubungan ||
					editAnggotaTgl !== selectedAnggota.tanggalLahir ||
					editAnggotaJk !== (selectedAnggota.jenisKelamin === 'L' ? 'Laki-laki' : (selectedAnggota.jenisKelamin === 'P' ? 'Perempuan' : selectedAnggota.jenisKelamin)) ||
					editAnggotaNoTelepon !== (selectedAnggota.noTelepon || '') ||
					editAnggotaTempatLahir !== ((selectedAnggota as any).tempatLahir || '') ||
					editAnggotaStatusGenerus !== ((selectedAnggota as any).statusGenerus || '') ||
					editAnggotaStatusPernikahan !== ((selectedAnggota as any).statusPernikahan || '') ||
					editAnggotaProfesi !== ((selectedAnggota as any).profesi || '') ||
					editAnggotaGolonganDarah !== ((selectedAnggota as any).golonganDarah || '')
				);
				if (isDirty) {
					const ok = await confirmAction({
						title: 'Tutup Ubah Anggota?',
						message: 'Ada perubahan data anggota yang belum disimpan. Yakin ingin menutup modal?',
						confirmText: 'Ya, Tutup',
						cancelText: 'Batal',
						variant: 'warning'
					});
					if (!ok) {
						return;
					}
				}
			}
		}
		activeModal = 'none';
		selectedAnggota = null;
	}

	$effect(() => {
		if (
			form?.successKeluarga ||
			form?.successAnggota ||
			form?.successHapusAnggota
		) {
			activeModal = 'none';
			selectedAnggota = null;
		}
	});

	async function toggleKk() {
		errorMessage = '';
		if (isKkRevealed) {
			isKkRevealed = false;
			return;
		}

		if (plainNoKk) {
			isKkRevealed = true;
			return;
		}

		if (!data.keluarga?.id) return;

		isKkLoading = true;
		try {
			const res = await fetch('/api/sensus/unmask', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ keluargaId: data.keluarga.id })
			});
			const result = await res.json();
			if (res.ok && result.original) {
				plainNoKk = result.original;
				isKkRevealed = true;
			} else {
				errorMessage = result.error || 'Gagal menampilkan nomor KK.';
			}
		} catch (_) {
			errorMessage = 'Terjadi kesalahan jaringan saat mengambil nomor KK.';
		} finally {
			isKkLoading = false;
		}
	}

	async function copyKk() {
		if (!plainNoKk) return;
		try {
			await navigator.clipboard.writeText(plainNoKk);
			copiedKk = true;
			setTimeout(() => {
				copiedKk = false;
			}, 2000);
		} catch (_) {}
	}

	async function toggleNik(anggotaId: string) {
		errorMessage = '';
		if (revealedNiks[anggotaId]) {
			const copy = { ...revealedNiks };
			delete copy[anggotaId];
			revealedNiks = copy;
			return;
		}

		loadingNiks = { ...loadingNiks, [anggotaId]: true };
		try {
			const res = await fetch('/api/sensus/unmask', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ anggotaId })
			});
			const result = await res.json();
			if (res.ok && result.original) {
				revealedNiks = { ...revealedNiks, [anggotaId]: result.original };
			} else {
				errorMessage = result.error || 'Gagal menampilkan NIK.';
			}
		} catch (_) {
			errorMessage = 'Terjadi kesalahan jaringan.';
		} finally {
			const copyLoading = { ...loadingNiks };
			delete copyLoading[anggotaId];
			loadingNiks = copyLoading;
		}
	}

	async function copyNik(anggotaId: string) {
		const val = revealedNiks[anggotaId];
		if (!val) return;
		try {
			await navigator.clipboard.writeText(val);
			copiedNiks = { ...copiedNiks, [anggotaId]: true };
			setTimeout(() => {
				const copy = { ...copiedNiks };
				delete copy[anggotaId];
				copiedNiks = copy;
			}, 2000);
		} catch (_) {}
	}
</script>

<svelte:head>
	<title>Sensus Keluarga - Satu Generus</title>
</svelte:head>

<div class="space-y-4 pb-8">
	<div class="flex items-center justify-between">
		<div>
			<h2 class="text-base sm:text-lg font-bold text-foreground tracking-tight">Sensus Keluarga</h2>
		</div>

		{#if data.hasKeluarga}
			<a
				href="/sensus/anggota/tambah"
				class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-all shadow-sm cursor-pointer"
			>
				<Plus class="w-3.5 h-3.5" />
				<span>Tambah Anggota</span>
			</a>
		{:else}
			<a
				href="/sensus/tambah"
				class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-all shadow-sm cursor-pointer"
			>
				<Plus class="w-3.5 h-3.5" />
				<span>Isi KK</span>
			</a>
		{/if}
	</div>

	<!-- Notifikasi Feedback Server Actions Ringkas -->
	{#if form?.successKeluarga || form?.successAnggota || form?.successHapusAnggota}
		<div class="p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold rounded-xl flex items-center gap-2">
			<CheckCircle class="w-4 h-4 shrink-0" />
			<span>{form.successKeluarga || form.successAnggota || form.successHapusAnggota}</span>
		</div>
	{/if}
	{#if form?.errorKeluarga || form?.errorAnggota || form?.errorTambahAnggota || form?.errorHapusAnggota}
		<div class="p-2.5 bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold rounded-xl flex items-center gap-2">
			<AlertCircle class="w-4 h-4 shrink-0" />
			<span>{form.errorKeluarga || form.errorAnggota || form.errorTambahAnggota || form.errorHapusAnggota}</span>
		</div>
	{/if}

	<!-- Notifikasi Error jika unmasking gagal -->
	{#if errorMessage}
		<div class="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-xl flex items-center justify-between">
			<span>{errorMessage}</span>
			<button type="button" onclick={() => (errorMessage = '')} class="font-bold ml-2">&times;</button>
		</div>
	{/if}

	{#if !data.hasKeluarga || !data.keluarga}
		<!-- Empty State sesuai DESIGN.md -->
		<div class="bg-card border border-border rounded-2xl p-8 text-center shadow-sm space-y-4">
			<div class="w-16 h-16 rounded-2xl bg-secondary mx-auto flex items-center justify-center text-primary">
				<Users class="w-8 h-8" />
			</div>
			<div class="space-y-1">
				<h3 class="text-sm font-semibold text-foreground">Belum Ada Data Kartu Keluarga</h3>
				<p class="text-xs text-foreground/60 max-w-xs mx-auto leading-relaxed">
					Data sensus keluarga Anda belum terdaftar. Silakan lengkapi formulir sensus untuk validasi data jamaah.
				</p>
			</div>
			<div>
				<a
					href="/sensus/tambah"
					class="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-all shadow-sm active:scale-95"
				>
					<Plus class="w-4 h-4" />
					<span>Mulai Isi Sensus (Wizard)</span>
				</a>
			</div>
		</div>
	{:else}
		<!-- Kartu Informasi Kartu Keluarga / Status Mandiri -->
		<div class="bg-card border border-border rounded-xl p-4 shadow-sm space-y-3">
			<div class="flex items-start justify-between">
				<div class="flex items-center gap-2.5">
					<div class="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
						{#if data.keluarga.isKk}
							<Home class="w-5 h-5" />
						{:else}
							<UserCheck class="w-5 h-5" />
						{/if}
					</div>
					<div>
						<div class="flex items-center gap-1.5">
							<p class="text-xs text-foreground/60 font-medium">
								{data.keluarga.isKk ? 'Nomor Kartu Keluarga' : 'Status Sensus Jamaah'}
							</p>
							{#if data.keluarga.isKk && isKkRevealed}
								<span class="text-xs font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-full">Tampil</span>
							{/if}
						</div>
						<div class="flex items-center gap-1.5 mt-0.5">
							{#if data.keluarga.isKk}
								<h3 class="text-base font-bold font-mono text-foreground tracking-wide select-all">
									{isKkRevealed && plainNoKk ? plainNoKk : data.keluarga.noKkMasked}
								</h3>

								{#if data.keluarga.noKkMasked !== 'Belum Ada No. KK'}
									<!-- Tombol Lihat / Sembunyikan Nomor KK -->
									<button
										type="button"
										onclick={toggleKk}
										disabled={isKkLoading}
										class="p-1.5 rounded-lg text-foreground/60 hover:text-foreground hover:bg-secondary transition-colors inline-flex items-center justify-center"
										title={isKkRevealed ? "Sembunyikan Nomor KK" : "Lihat Nomor KK Asli"}
										aria-label={isKkRevealed ? "Sembunyikan Nomor KK" : "Lihat Nomor KK Asli"}
									>
										{#if isKkLoading}
											<span class="inline-block w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></span>
										{:else if isKkRevealed}
											<EyeOff class="w-4 h-4 text-primary" />
										{:else}
											<Eye class="w-4 h-4" />
										{/if}
									</button>
								{/if}

								<!-- Tombol Salin jika nomor KK sedang tampil -->
								{#if isKkRevealed && plainNoKk}
									<button
										type="button"
										onclick={copyKk}
										class="p-1.5 rounded-lg text-foreground/60 hover:text-foreground hover:bg-secondary transition-colors inline-flex items-center justify-center"
										title="Salin Nomor KK"
										aria-label="Salin Nomor KK"
									>
										{#if copiedKk}
											<Check class="w-4 h-4 text-primary" />
										{:else}
											<Copy class="w-4 h-4" />
										{/if}
									</button>
								{/if}
							{:else}
								<span class="text-xs font-bold text-purple-600 dark:text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-md">
									Perorangan / Perantau Mandiri (Tanpa KK)
								</span>
							{/if}
						</div>
					</div>
				</div>

				<div class="flex items-center gap-1.5">
					<button
						type="button"
						onclick={openEditKk}
						class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold border border-border transition-colors cursor-pointer"
						title={data.keluarga.isKk ? "Ubah No. KK atau Alamat" : "Ubah Alamat Domisili"}
					>
						<Pencil class="w-3 h-3 text-primary" />
						<span>{data.keluarga.isKk ? 'Ubah KK' : 'Ubah Alamat'}</span>
					</button>

					<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary">
						<Shield class="w-3 h-3" />
						{data.keluarga.isKk ? (isKkRevealed ? 'Terverifikasi' : 'Terenkripsi') : 'Terdaftar'}
					</span>
				</div>
			</div>

			<div class="pt-2 border-t border-border/60 text-xs text-foreground/70">
				<p class="font-medium text-[11px] text-foreground/50">
					{data.keluarga.isKk ? 'Alamat Lengkap Domisili:' : 'Alamat Tempat Tinggal Saat Ini:'}
				</p>
				<p class="mt-0.5">{data.keluarga.alamatLengkap || 'Belum ada alamat'}</p>
			</div>
		</div>

		<!-- Daftar Anggota Keluarga / Data Diri Jamaah -->
		<div class="space-y-3">
			<div class="flex items-center justify-between px-1">
				<h3 class="text-xs font-semibold uppercase tracking-wider text-foreground/70">
					{data.keluarga.isKk ? `Anggota Keluarga (${data.anggotaList.length})` : 'Data Diri Jamaah'}
				</h3>

				<a
					href="/sensus/anggota/tambah"
					class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold transition-colors cursor-pointer"
				>
					<Plus class="w-3 h-3" />
					<span>Tambah Anggota</span>
				</a>
			</div>

			<div class="space-y-2.5">
				{#each data.anggotaList as anggota}
					<div class="bg-card border border-border rounded-xl p-3.5 shadow-sm space-y-2">
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-2">
								<div class="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-medium text-foreground">
									<UserCheck class="w-4 h-4 text-primary" />
								</div>
								<div>
									<div class="flex items-center gap-2 flex-wrap">
										<h4 class="text-sm font-semibold text-foreground">{anggota.namaLengkap}</h4>
										<span class="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
											{anggota.statusHubungan}
										</span>
										{#if anggota.statusGenerus}
											<span class="text-[10px] bg-secondary px-2 py-0.5 rounded-md text-foreground/70 font-semibold border border-border/60">
												{anggota.statusGenerus}
											</span>
										{/if}
										{#if anggota.statusPernikahan}
											<span class="text-[10px] bg-secondary/80 px-2 py-0.5 rounded-md text-foreground/80 font-medium border border-border/60">
												{anggota.statusPernikahan}
											</span>
										{/if}
									</div>
									<div class="flex items-center gap-1.5 mt-0.5">
										<p class="text-xs text-foreground/60 font-mono select-all">
											NIK: {revealedNiks[anggota.id] || anggota.nikMasked}
										</p>

										{#if anggota.hasNik}
											<!-- Tombol Lihat / Sembunyikan NIK -->
											<button
												type="button"
												onclick={() => toggleNik(anggota.id)}
												disabled={loadingNiks[anggota.id]}
												class="p-1 rounded text-foreground/50 hover:text-foreground hover:bg-secondary transition-colors inline-flex items-center justify-center"
												title={revealedNiks[anggota.id] ? "Sembunyikan NIK" : "Lihat NIK Asli"}
												aria-label={revealedNiks[anggota.id] ? "Sembunyikan NIK" : "Lihat NIK Asli"}
											>
												{#if loadingNiks[anggota.id]}
													<span class="inline-block w-3.5 h-3.5 border border-primary border-t-transparent rounded-full animate-spin"></span>
												{:else if revealedNiks[anggota.id]}
													<EyeOff class="w-3.5 h-3.5 text-primary" />
												{:else}
													<Eye class="w-3.5 h-3.5" />
												{/if}
											</button>
										{/if}

										<!-- Tombol Salin NIK jika sedang tampil -->
										{#if revealedNiks[anggota.id]}
											<button
												type="button"
												onclick={() => copyNik(anggota.id)}
												class="p-1 rounded text-foreground/50 hover:text-foreground hover:bg-secondary transition-colors inline-flex items-center justify-center"
												title="Salin NIK"
												aria-label="Salin NIK"
											>
												{#if copiedNiks[anggota.id]}
													<Check class="w-3.5 h-3.5 text-primary" />
												{:else}
													<Copy class="w-3.5 h-3.5" />
												{/if}
											</button>
										{/if}
									</div>
								</div>
							</div>

							<div class="flex items-center gap-2">
								<span class="text-xs bg-secondary px-2.5 py-1 rounded-md text-foreground/70 font-medium">
									{anggota.jenisKelamin === 'L' || anggota.jenisKelamin === 'Laki-laki' ? 'Laki-laki' : 'Perempuan'}
								</span>

								<!-- Tombol Edit Anggota -->
								<button
									type="button"
									onclick={() => openEditAnggota(anggota)}
									class="p-1.5 rounded-lg text-foreground/60 hover:text-foreground hover:bg-secondary transition-colors inline-flex items-center justify-center cursor-pointer"
									title="Ubah Data Anggota"
									aria-label="Ubah Data Anggota"
								>
									<Pencil class="w-3.5 h-3.5 text-primary" />
								</button>

								<!-- Tombol Hapus Anggota (jika > 1) -->
								{#if data.anggotaList.length > 1}
									<form
										method="POST"
										action="?/hapusAnggota"
										use:enhance={keepScrollSubmit()}
									>
										<input type="hidden" name="anggotaId" value={anggota.id} />
										<button
											type="button"
											onclick={async (e) => {
												const formEl = (e.currentTarget as HTMLButtonElement).closest('form');
												const ok = await confirmAction({
													title: 'Hapus Anggota Keluarga?',
													message: `Apakah Anda yakin ingin menghapus data anggota ${anggota.namaLengkap || 'ini'}?`,
													confirmText: 'Ya, Hapus',
													variant: 'danger'
												});
												if (ok && formEl) {
													formEl.requestSubmit();
												}
											}}
											class="p-1.5 rounded-lg text-destructive/60 hover:text-destructive hover:bg-destructive/10 transition-colors inline-flex items-center justify-center cursor-pointer"
											title="Hapus Anggota"
											aria-label="Hapus Anggota"
										>
											<Trash2 class="w-3.5 h-3.5" />
										</button>
									</form>
								{/if}
							</div>
						</div>

						<!-- Rincian Data Demografi Jiwa Lengkap -->
						<div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-foreground/70 bg-card/60 p-2.5 rounded-lg border border-border/40">
							<div>
								<span class="text-foreground/40 block text-[10px]">Tempat, Tgl Lahir:</span>
								<span class="font-medium text-foreground">
									{anggota.tempatLahir ? `${anggota.tempatLahir}, ` : ''}{formatDateDDMMYYYY(anggota.tanggalLahir)}
									{#if anggota.tanggalLahir}
										<span class="text-foreground/60 text-[10px]">({hitungUmur(anggota.tanggalLahir)} Thn)</span>
									{/if}
								</span>
							</div>
							<div>
								<span class="text-foreground/40 block text-[10px]">Status Pernikahan:</span>
								<span class="font-medium text-foreground">{anggota.statusPernikahan || '-'}</span>
							</div>
							<div>
								<span class="text-foreground/40 block text-[10px]">Profesi / Pekerjaan:</span>
								<span class="text-foreground">{anggota.profesi || '-'}</span>
							</div>
							<div>
								<span class="text-foreground/40 block text-[10px]">No. HP / WA & Goldar:</span>
								<span class="font-mono text-foreground">{anggota.noTelepon || '-'}</span>
								{#if anggota.golonganDarah}
									<span class="ml-1 text-[10px] font-bold text-primary">({anggota.golonganDarah})</span>
								{/if}
							</div>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>

<!-- Modal 1: Ubah Data Kartu Keluarga -->
{#if activeModal === 'editKk'}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-150"
		onclick={(e) => {
			if (e.target === e.currentTarget) closeEditKkModal();
		}}
	>
		<div class="w-full max-w-sm bg-card border border-border rounded-2xl shadow-xl overflow-hidden p-6 space-y-4">
			<div class="flex items-center justify-between border-b border-border pb-3">
				<h3 class="text-sm font-bold text-foreground">
					{data.keluarga?.isKk ? 'Ubah Kartu Keluarga' : 'Ubah Alamat Tempat Tinggal'}
				</h3>
				<button
					type="button"
					onclick={() => closeEditKkModal()}
					class="text-foreground/50 hover:text-foreground text-sm font-semibold"
				>
					✕
				</button>
			</div>

			<form
				method="POST"
				action="?/updateKeluarga"
				use:enhance={confirmSubmit(
					{
						title: 'Simpan Perubahan Kartu Keluarga?',
						message: 'Pastikan nomor KK dan alamat sudah sesuai. Yakin ingin menyimpan perubahan data keluarga ini?',
						confirmText: 'Ya, Simpan',
						cancelText: 'Batal',
						variant: 'primary'
					},
					keepScrollSubmit({
						beforeSubmit: () => { isSubmitting = true; },
						onFinally: () => { isSubmitting = false; },
						onSuccess: () => { closeEditKkModal(true); }
					})
				)}
				class="space-y-4 text-xs"
			>
				<input type="hidden" name="keluargaId" value={data.keluarga?.id} />

				{#if data.keluarga?.isKk}
					<div>
						<label for="noKk" class="block font-medium text-foreground/80 mb-1.5">
							Nomor Kartu Keluarga
						</label>
						<input
							id="noKk"
							name="noKk"
							type="text"
							inputmode="numeric"
							pattern="[0-9]*"
							maxlength="16"
							bind:value={editKkNoKk}
							oninput={(e) => {
								editKkNoKk = e.currentTarget.value.replace(/\D/g, '');
							}}
							placeholder="16 digit No. Kartu Keluarga"
							class="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:bg-background transition-all"
						/>
						<p class="text-[10px] text-foreground/50 mt-1">16 digit angka. Dikosongkan jika ingin menghapus.</p>
					</div>
				{/if}

				<div>
					<label for="alamatLengkap" class="block font-medium text-foreground/80 mb-1.5">
						{data.keluarga?.isKk ? 'Alamat Lengkap Domisili' : 'Alamat Tempat Tinggal Saat Ini'}
					</label>
					<textarea
						id="alamatLengkap"
						name="alamatLengkap"
						rows="3"
						required
						bind:value={editKkAlamat}
						placeholder={data.keluarga?.isKk ? 'Alamat lengkap domisili keluarga...' : 'Alamat kos/kontrakan/tempat tinggal saat ini...'}
						class="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:bg-background transition-all"
					></textarea>
				</div>

				<div class="flex gap-2 pt-2">
					<button
						type="button"
						onclick={() => closeEditKkModal()}
						class="flex-1 py-2 rounded-lg border border-border bg-secondary/60 hover:bg-secondary text-foreground font-semibold transition-colors"
					>
						Batal
					</button>
					<button
						type="submit"
						disabled={isSubmitting}
						class="flex-1 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold transition-colors disabled:opacity-50"
					>
						{isSubmitting ? 'Menyimpan...' : 'Simpan'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- Modal 2: Ubah Data Anggota Keluarga (Lengkap Sesuai Standar Data Jiwa) -->
{#if activeModal === 'editAnggota' && selectedAnggota}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-150"
		role="dialog"
		aria-modal="true"
		onclick={(e) => {
			if (e.target === e.currentTarget) closeEditAnggotaModal();
		}}
	>
		<div class="bg-card border border-border rounded-2xl max-w-xl w-full p-4 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
			<div class="flex items-center justify-between pb-3 border-b border-border">
				<div>
					<h3 class="text-sm font-bold text-foreground flex items-center gap-2">
						<Pencil class="w-4 h-4 text-primary" />
						<span>Ubah Data Anggota Keluarga</span>
					</h3>
					<p class="text-[11px] text-foreground/60 mt-0.5">
						Perbarui data demografi dan identitas anggota keluarga Anda.
					</p>
				</div>
				<button
					type="button"
					onclick={() => closeEditAnggotaModal()}
					class="p-1 rounded-lg hover:bg-secondary text-foreground/60 hover:text-foreground cursor-pointer"
				>
					<X class="w-5 h-5" />
				</button>
			</div>

			<form
				method="POST"
				action="?/updateAnggota"
				use:enhance={confirmSubmit(
					{
						title: 'Simpan Perubahan Anggota?',
						message: 'Pastikan data anggota sudah sesuai. Yakin ingin menyimpan perubahan anggota ini?',
						confirmText: 'Ya, Simpan',
						cancelText: 'Batal',
						variant: 'primary'
					},
					keepScrollSubmit({
						beforeSubmit: () => { isSubmitting = true; },
						onFinally: () => { isSubmitting = false; },
						onSuccess: () => { closeEditAnggotaModal(true); }
					})
				)}
				class="space-y-4 text-xs"
			>
				<input type="hidden" name="anggotaId" value={selectedAnggota.id} />

				<div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
					<div class="sm:col-span-2">
						<label for="editNama" class="block font-semibold text-foreground mb-1">
							Nama Lengkap *
						</label>
						<input
							id="editNama"
							name="namaLengkap"
							type="text"
							required
							bind:value={editAnggotaNama}
							placeholder="Nama Lengkap Anggota"
							class="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
						/>
					</div>

					<div>
						<label for="editNik" class="block font-semibold text-foreground mb-1">
							Nomor Induk Kependudukan (NIK - Opsional)
						</label>
						<input
							id="editNik"
							name="nik"
							type="text"
							inputmode="numeric"
							pattern="[0-9]*"
							maxlength="16"
							bind:value={editAnggotaNik}
							oninput={(e) => {
								editAnggotaNik = e.currentTarget.value.replace(/\D/g, '');
							}}
							placeholder="16 digit NIK (opsional, bisa kosong)"
							class="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
						/>
						<p class="text-[10px] text-foreground/50 mt-0.5">
							{selectedAnggota.hasNik ? '16 digit angka. Dikosongkan jika ingin menghapus NIK.' : '16 digit angka (opsional)'}
						</p>
					</div>

					<div>
						<label for="editStatus" class="block font-semibold text-foreground mb-1">
							Hubungan dalam Keluarga *
						</label>
						<select
							id="editStatus"
							name="statusHubungan"
							required
							bind:value={editAnggotaStatus}
							onchange={onEditAnggotaStatusChange}
							class="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
						>
							<option value="Kepala Keluarga">Kepala Keluarga</option>
							<option value="Istri">Istri</option>
							<option value="Anak">Anak</option>
							<option value="Suami">Suami</option>
							<option value="Orang Tua">Orang Tua</option>
							<option value="Mertua">Mertua</option>
							<option value="Famili Lain">Famili Lain</option>
						</select>
					</div>

					<div>
						<label for="editJk" class="block font-semibold text-foreground mb-1">
							Jenis Kelamin *
						</label>
						<select
							id="editJk"
							name="jenisKelamin"
							required
							bind:value={editAnggotaJk}
							class="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
						>
							<option value="Laki-laki">Laki-laki (L)</option>
							<option value="Perempuan">Perempuan (P)</option>
						</select>
					</div>

					<div>
						<label for="editTgl" class="block font-semibold text-foreground mb-1">
							Tanggal Lahir *
						</label>
						<DateInput
							id="editTgl"
							name="tanggalLahir"
							required
							bind:value={editAnggotaTgl}
							class="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
						/>
					</div>

					<div>
						<label for="editUmur" class="block font-semibold text-foreground mb-1">
							Umur (Otomatis)
						</label>
						<input
							id="editUmur"
							type="text"
							disabled
							value={editAnggotaUmur !== null ? `${editAnggotaUmur} Tahun` : '-'}
							class="w-full bg-secondary/70 border border-border/80 rounded-lg px-3 py-2 text-xs text-foreground/70 font-semibold cursor-not-allowed select-none"
						/>
					</div>

					<div>
						<label for="editTempatLahir" class="block font-semibold text-foreground mb-1">
							Tempat Lahir
						</label>
						<input
							id="editTempatLahir"
							name="tempatLahir"
							type="text"
							bind:value={editAnggotaTempatLahir}
							placeholder="Kota / Kabupaten Lahir"
							class="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
						/>
					</div>

					<div>
						<label for="editStatusGenerus" class="block font-semibold text-foreground mb-1">
							Status Generus
						</label>
						<select
							id="editStatusGenerus"
							name="statusGenerus"
							bind:value={editAnggotaStatusGenerus}
							class="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
						>
							<option value="">-- Otomatis Mengikuti Umur --</option>
							{#each DAFTAR_STATUS_GENERUS as g}
								<option value={g}>{g}</option>
							{/each}
						</select>
					</div>

					<div>
						<label for="editStatusPernikahan" class="block font-semibold text-foreground mb-1">
							Status Pernikahan
						</label>
						<select
							id="editStatusPernikahan"
							name="statusPernikahan"
							bind:value={editAnggotaStatusPernikahan}
							onchange={onEditAnggotaStatusChange}
							class="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
						>
							<option value="">-- Pilih Status Pernikahan --</option>
							<option value="Belum Menikah">Belum Menikah</option>
							<option value="Sudah Menikah">Sudah Menikah</option>
							<option value="Duda">Duda</option>
							<option value="Janda">Janda</option>
						</select>
					</div>

					<div>
						<label for="editProfesi" class="block font-semibold text-foreground mb-1">
							Profesi / Pekerjaan
						</label>
						<input
							id="editProfesi"
							name="profesi"
							type="text"
							bind:value={editAnggotaProfesi}
							placeholder="Pekerjaan / Pelajar / Wiraswasta"
							class="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
						/>
					</div>

					<div>
						<label for="editGolonganDarah" class="block font-semibold text-foreground mb-1">
							Golongan Darah
						</label>
						<select
							id="editGolonganDarah"
							name="golonganDarah"
							bind:value={editAnggotaGolonganDarah}
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

					<div class="sm:col-span-2">
						<label for="editNoTelepon" class="block font-semibold text-foreground mb-1">
							No. HP / WhatsApp {#if selectedAnggota?.userId}<span class="text-destructive">* (Wajib memiliki akun)</span>{:else}<span class="text-foreground/50 text-[11px] font-normal">(Opsional)</span>{/if}
						</label>
						<input
							id="editNoTelepon"
							name="noTelepon"
							type="tel"
							inputmode="numeric"
							pattern="[0-9]*"
							required={!!selectedAnggota?.userId}
							bind:value={editAnggotaNoTelepon}
							oninput={(e) => { editAnggotaNoTelepon = e.currentTarget.value.replace(/\D/g, ''); }}
							placeholder="Contoh: 08123456789"
							class="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
						/>
					</div>
				</div>

				<div class="flex items-center justify-end gap-2 pt-3 border-t border-border">
					<button
						type="button"
						onclick={() => closeEditAnggotaModal()}
						class="px-4 py-2 rounded-lg border border-border text-foreground hover:bg-secondary font-semibold transition-colors cursor-pointer"
					>
						Batal
					</button>
					<button
						type="submit"
						disabled={isSubmitting}
						class="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
					>
						<span>Simpan Perubahan</span>
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

