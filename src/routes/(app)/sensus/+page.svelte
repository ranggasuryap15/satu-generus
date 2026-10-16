<!--
  @file src/routes/(app)/sensus/+page.svelte
  @purpose Tampilan status dan rincian Sensus Keluarga sesuai mockup Flat Design Minimalist: Integrated Curved Green Header, Floating Card KK (Nomor KK terenkripsi & Alamat), Daftar Anggota Keluarga dengan badge demografi & detail nested box, serta modal edit KK & anggota
  @usedBy Route client '/sensus'
  @dependencies @lucide/svelte, $app/forms (enhance), $app/state (page), #lib/components/ThemeToggle.svelte, #lib/components/DateInput.svelte, #lib/utils (formatDateDDMMYYYY), #lib/generus, #lib/keepScroll.ts (keepScrollSubmit), Svelte 5 Runes
  @publicFunctions toggleKk, copyKk, toggleNik, copyNik, openEditKk, closeEditKkModal, openEditAnggota, closeEditAnggotaModal, onEditAnggotaStatusChange, onEditAnggotaTglChange
  @sideEffects Mengirim HTTP POST ke /api/sensus/unmask serta server actions updateKeluarga/updateAnggota/hapusAnggota via enhance dengan posisi scroll terjaga
-->
<script lang="ts">
	import {
		AlertCircle,
		ArrowLeft,
		Briefcase,
		Calendar,
		Check,
		CheckCircle,
		Copy,
		Droplet,
		Eye,
		EyeOff,
		Home,
		Pencil,
		Phone,
		Plus,
		Shield,
		Trash2,
		UserCheck,
		Users,
		X
	} from '@lucide/svelte';
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import ThemeToggle from '#lib/components/ThemeToggle.svelte';
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

	const isAdmin = $derived(Boolean(page.data.isAdmin));

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

	function openEditKk() {
		editKkNoKk = data.keluarga?.noKkPlain || '';
		editKkAlamat = data.keluarga?.alamatLengkap || '';
		activeModal = 'editKk';
	}

	function closeEditKkModal(refreshPlainKk = false) {
		activeModal = 'none';
		if (refreshPlainKk && editKkNoKk) {
			plainNoKk = editKkNoKk;
		}
	}

	function openEditAnggota(anggota: (typeof data.anggotaList)[number]) {
		selectedAnggota = anggota;
		editAnggotaNama = anggota.namaLengkap;
		editAnggotaNik = anggota.nikRaw || revealedNiks[anggota.id] || '';
		editAnggotaStatus = anggota.statusHubungan;
		editAnggotaTgl = anggota.tanggalLahir || '';
		editAnggotaJk = anggota.jenisKelamin || 'L';
		editAnggotaNoTelepon = anggota.noTelepon || '';
		editAnggotaTempatLahir = anggota.tempatLahir || '';
		editAnggotaStatusGenerus = anggota.statusGenerus || '';
		editAnggotaStatusPernikahan = anggota.statusPernikahan || '';
		editAnggotaProfesi = anggota.profesi || '';
		editAnggotaGolonganDarah = anggota.golonganDarah || '';
		activeModal = 'editAnggota';
	}

	function closeEditAnggotaModal(refreshPlainNik = false) {
		if (refreshPlainNik && selectedAnggota && editAnggotaNik) {
			revealedNiks[selectedAnggota.id] = editAnggotaNik;
		}
		activeModal = 'none';
		selectedAnggota = null;
	}

	function onEditAnggotaStatusChange(newStatus: string) {
		editAnggotaStatus = newStatus;
		if (newStatus === 'Istri') {
			editAnggotaJk = 'P';
			editAnggotaStatusPernikahan = 'Menikah';
		} else if (newStatus === 'Kepala Keluarga') {
			editAnggotaJk = 'L';
		}
	}

	function onEditAnggotaTglChange(newTgl: string) {
		editAnggotaTgl = newTgl;
		if (newTgl) {
			const parts = newTgl.split('-');
			let iso = '';
			if (parts.length === 3) {
				if (parts[0].length === 4) iso = newTgl;
				else iso = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
			}
			if (iso) {
				const umur = hitungUmur(iso);
				editAnggotaStatusPernikahan = resolveStatusPernikahan(editAnggotaStatus, editAnggotaStatusPernikahan);
				editAnggotaStatusGenerus = hitungStatusGenerus(umur, editAnggotaStatusPernikahan);
			}
		}
	}

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
	<!-- 1. Header Hijau Melengkung Terintegrasi (Sesuai Mockup) -->
	<header class="bg-[#166534] dark:bg-[#14532D] text-white px-5 pt-5 pb-14 rounded-b-[32px] shadow-sm">
		<div class="flex items-center justify-between mb-3.5">
			<a
				href="/"
				class="p-2 -ml-1 text-white/90 hover:text-white rounded-xl hover:bg-white/15 transition-colors cursor-pointer"
				title="Kembali ke Beranda"
			>
				<ArrowLeft class="w-6 h-6" />
			</a>

			<div class="flex items-center gap-2">
				{#if isAdmin}
					<a
						href="/admin"
						class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 hover:bg-white/30 text-white text-xs sm:text-sm font-bold border border-white/30 backdrop-blur-xs transition-all active:scale-95 shadow-xs"
						title="Beralih ke Panel Admin"
					>
						<span class="w-2 h-2 rounded-full bg-emerald-300 animate-pulse"></span>
						<span>⇄ Admin</span>
					</a>
				{/if}
				<ThemeToggle />
			</div>
		</div>

		<div class="space-y-1">
			<h1 class="text-2xl sm:text-3xl font-black tracking-tight text-white">
				Sensus Keluarga
			</h1>
			<p class="text-xs sm:text-sm text-white/80 font-medium">
				Data keluarga tersimpan aman & terenkripsi
			</p>
		</div>
	</header>

	<!-- Notifikasi Feedback Server Actions Ringkas -->
	{#if form?.successKeluarga || form?.successAnggota || form?.successHapusAnggota}
		<div class="px-4">
			<div class="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs sm:text-sm font-semibold rounded-2xl flex items-center gap-2">
				<CheckCircle class="w-4 h-4 shrink-0" />
				<span>{form.successKeluarga || form.successAnggota || form.successHapusAnggota}</span>
			</div>
		</div>
	{/if}
	{#if form?.errorKeluarga || form?.errorAnggota || form?.errorTambahAnggota || form?.errorHapusAnggota}
		<div class="px-4">
			<div class="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs sm:text-sm font-semibold rounded-2xl flex items-center gap-2">
				<AlertCircle class="w-4 h-4 shrink-0" />
				<span>{form.errorKeluarga || form.errorAnggota || form.errorTambahAnggota || form.errorHapusAnggota}</span>
			</div>
		</div>
	{/if}
	{#if errorMessage}
		<div class="px-4">
			<div class="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs sm:text-sm rounded-2xl flex items-center justify-between">
				<span>{errorMessage}</span>
				<button type="button" onclick={() => (errorMessage = '')} class="font-bold ml-2 text-base">&times;</button>
			</div>
		</div>
	{/if}

	{#if !data.hasKeluarga || !data.keluarga}
		<!-- Empty State Jika Belum Ada Data Keluarga -->
		<div class="-mt-9 px-4">
			<div class="bg-[#1E293B] border border-slate-700/60 rounded-3xl p-8 text-center shadow-lg space-y-4">
				<div class="w-16 h-16 rounded-2xl bg-slate-800 text-slate-400 mx-auto flex items-center justify-center">
					<Users class="w-8 h-8" />
				</div>
				<div class="space-y-1">
					<h3 class="text-base sm:text-lg font-bold text-slate-100">Belum Ada Data Kartu Keluarga</h3>
					<p class="text-xs sm:text-sm text-slate-300 max-w-xs mx-auto leading-relaxed">
						Data sensus keluarga Anda belum terdaftar. Silakan lengkapi formulir sensus untuk validasi data jamaah.
					</p>
				</div>
				<div class="pt-2">
					<a
						href="/sensus/tambah"
						class="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-xs sm:text-sm font-black transition-all shadow-sm active:scale-95"
					>
						<Plus class="w-4 h-4" />
						<span>Mulai Isi Sensus (Wizard)</span>
					</a>
				</div>
			</div>
		</div>
	{:else}
		<!-- 2. Floating Card: Nomor Kartu Keluarga & Alamat Domisili (Overlapping Header) -->
		<div class="-mt-9 px-4">
			<div class="bg-[#1E293B] border border-slate-700/60 rounded-3xl p-4 sm:p-5 shadow-lg space-y-3.5">
				<!-- Baris Atas: Ikon Rumah, Nomor KK, & Tombol Ubah -->
				<div class="flex items-start justify-between gap-3">
					<div class="flex items-center gap-3 min-w-0">
						<div class="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-emerald-950/80 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
							{#if data.keluarga.isKk}
								<Home class="w-6 h-6" />
							{:else}
								<UserCheck class="w-6 h-6" />
							{/if}
						</div>
						<div class="min-w-0">
							<p class="text-xs text-slate-400 font-medium">
								{data.keluarga.isKk ? 'Nomor Kartu Keluarga' : 'Status Sensus Jamaah'}
							</p>
							<div class="flex items-center gap-2 mt-0.5">
								{#if data.keluarga.isKk}
									<h3 class="text-base sm:text-lg font-bold font-mono text-slate-100 tracking-wider truncate">
										{isKkRevealed && plainNoKk ? plainNoKk : data.keluarga.noKkMasked}
									</h3>

									{#if data.keluarga.noKkMasked !== 'Belum Ada No. KK'}
										<button
											type="button"
											onclick={toggleKk}
											disabled={isKkLoading}
											class="text-slate-400 hover:text-slate-200 transition-colors p-1"
											title={isKkRevealed ? "Sembunyikan Nomor KK" : "Lihat Nomor KK Asli"}
											aria-label={isKkRevealed ? "Sembunyikan Nomor KK" : "Lihat Nomor KK Asli"}
										>
											{#if isKkLoading}
												<span class="inline-block w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin"></span>
											{:else if isKkRevealed}
												<EyeOff class="w-4 h-4 text-emerald-400" />
											{:else}
												<Eye class="w-4 h-4" />
											{/if}
										</button>
									{/if}

									{#if isKkRevealed && plainNoKk}
										<button
											type="button"
											onclick={copyKk}
											class="text-slate-400 hover:text-slate-200 p-1"
											title="Salin Nomor KK"
											aria-label="Salin Nomor KK"
										>
											{#if copiedKk}
												<Check class="w-4 h-4 text-emerald-400" />
											{:else}
												<Copy class="w-4 h-4" />
											{/if}
										</button>
									{/if}
								{:else}
									<span class="text-xs font-bold text-purple-300 bg-purple-950/60 border border-purple-800/40 px-2.5 py-0.5 rounded-full">
										Perorangan / Perantau Mandiri (Tanpa KK)
									</span>
								{/if}
							</div>
						</div>
					</div>

					<!-- Tombol Ubah di Kanan Atas Kartu KK -->
					<button
						type="button"
						onclick={openEditKk}
						class="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs sm:text-sm font-bold border border-slate-700/80 transition-all shrink-0 cursor-pointer active:scale-95"
						title={data.keluarga.isKk ? "Ubah No. KK atau Alamat" : "Ubah Alamat Domisili"}
					>
						<Pencil class="w-3.5 h-3.5" />
						<span>Ubah</span>
					</button>
				</div>

				<!-- Divider Halus & Rincian Alamat Domisili -->
				<div class="pt-3 border-t border-slate-700/60 space-y-1.5">
					<p class="text-xs text-slate-400 font-medium">
						{data.keluarga.isKk ? 'Alamat Lengkap Domisili' : 'Alamat Tempat Tinggal Saat Ini'}
					</p>
					<p class="text-sm sm:text-base font-semibold text-slate-200 leading-snug">
						{data.keluarga.alamatLengkap || 'Belum ada alamat'}
					</p>
					<div class="pt-1">
						<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-950/80 border border-emerald-500/30 text-emerald-400">
							<Shield class="w-3.5 h-3.5" />
							<span>Terenkripsi</span>
						</span>
					</div>
				</div>
			</div>
		</div>

		<!-- 3. Daftar Anggota Keluarga (Sesuai Mockup) -->
		<section class="px-4 space-y-3 pt-2">
			<!-- Header Seksi: Judul & Tombol Hijau + Tambah -->
			<div class="flex items-center justify-between px-1">
				<h2 class="text-base sm:text-lg font-bold text-slate-100 tracking-tight">
					{data.keluarga.isKk ? `Anggota Keluarga (${data.anggotaList.length})` : 'Data Diri Jamaah'}
				</h2>

				<a
					href="/sensus/anggota/tambah"
					class="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-xs sm:text-sm font-black transition-all active:scale-95 shadow-xs cursor-pointer"
				>
					<Plus class="w-4 h-4 stroke-[3]" />
					<span>Tambah</span>
				</a>
			</div>

			<!-- Kartu Per Anggota Keluarga -->
			<div class="space-y-3.5">
				{#each data.anggotaList as anggota (anggota.id)}
					<div class="bg-[#1E293B] border border-slate-700/60 rounded-3xl p-4 sm:p-5 shadow-md space-y-3.5">
						<!-- Baris Atas: Avatar, Nama, Badges, & Tombol Edit -->
						<div class="flex items-start justify-between gap-3">
							<div class="flex items-center gap-3 min-w-0">
								<div class="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-emerald-950/80 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
									<Users class="w-6 h-6" />
								</div>
								<div class="min-w-0">
									<h4 class="text-base sm:text-lg font-bold text-slate-100 truncate">
										{anggota.namaLengkap}
									</h4>
									<!-- Badges Status -->
									<div class="flex items-center gap-1.5 flex-wrap mt-1">
										<span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950/80 border border-emerald-500/30 text-emerald-300">
											{anggota.statusHubungan}
										</span>
										{#if anggota.statusGenerus}
											<span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700/60">
												{anggota.statusGenerus}
											</span>
										{/if}
										<span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800/80 text-slate-300 border border-slate-700/60">
											{anggota.jenisKelamin === 'L' || anggota.jenisKelamin === 'Laki-laki' ? 'Laki-laki' : 'Perempuan'}
										</span>
									</div>
								</div>
							</div>

							<!-- Tombol Edit Pensil di Kanan Atas -->
							<button
								type="button"
								onclick={() => openEditAnggota(anggota)}
								class="p-2 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded-xl transition-colors shrink-0 cursor-pointer active:scale-95"
								title="Ubah Data Anggota"
								aria-label="Ubah Data Anggota"
							>
								<Pencil class="w-5 h-5" />
							</button>
						</div>

						<!-- Baris NIK & Unmask Mata -->
						<div class="flex items-center gap-2 text-xs sm:text-sm font-mono text-slate-300">
							<span>NIK: {revealedNiks[anggota.id] || anggota.nikMasked}</span>

							{#if anggota.hasNik}
								<button
									type="button"
									onclick={() => toggleNik(anggota.id)}
									disabled={loadingNiks[anggota.id]}
									class="text-slate-400 hover:text-slate-200 transition-colors p-1"
									title={revealedNiks[anggota.id] ? "Sembunyikan NIK" : "Lihat NIK Asli"}
									aria-label={revealedNiks[anggota.id] ? "Sembunyikan NIK" : "Lihat NIK Asli"}
								>
									{#if loadingNiks[anggota.id]}
										<span class="inline-block w-3.5 h-3.5 border border-emerald-400 border-t-transparent rounded-full animate-spin"></span>
									{:else if revealedNiks[anggota.id]}
										<EyeOff class="w-4 h-4 text-emerald-400" />
									{:else}
										<Eye class="w-4 h-4" />
									{/if}
								</button>
							{/if}

							{#if revealedNiks[anggota.id]}
								<button
									type="button"
									onclick={() => copyNik(anggota.id)}
									class="text-slate-400 hover:text-slate-200 p-1"
									title="Salin NIK"
									aria-label="Salin NIK"
								>
									{#if copiedNiks[anggota.id]}
										<Check class="w-4 h-4 text-emerald-400" />
									{:else}
										<Copy class="w-4 h-4" />
									{/if}
								</button>
							{/if}
						</div>

						<!-- Nested Container Rincian Data Demografi Jiwa (Sesuai Mockup) -->
						<div class="bg-[#0F172A] rounded-2xl p-3.5 sm:p-4 border border-slate-800/80">
							<div class="grid grid-cols-2 gap-3 sm:gap-4">
								<!-- Kolom Kiri: Tempat, Tgl Lahir & Profesi -->
								<div class="space-y-3">
									<div>
										<span class="text-xs text-slate-400 block font-medium">Tempat, Tgl Lahir</span>
										<span class="text-xs sm:text-sm font-bold text-slate-100 block mt-0.5 leading-snug">
											{anggota.tempatLahir ? `${anggota.tempatLahir}, ` : ''}{formatDateDDMMYYYY(anggota.tanggalLahir)}
											{#if anggota.tanggalLahir}
												<span class="text-slate-400 text-xs font-normal">({hitungUmur(anggota.tanggalLahir)} th)</span>
											{/if}
										</span>
									</div>
									<div>
										<span class="text-xs text-slate-400 block font-medium">Profesi</span>
										<span class="text-xs sm:text-sm font-bold text-slate-200 block mt-0.5 truncate">
											{anggota.profesi || '-'}
										</span>
									</div>
								</div>

								<!-- Kolom Kanan: Status Pernikahan & No. HP / Goldar -->
								<div class="space-y-3">
									<div>
										<span class="text-xs text-slate-400 block font-medium">Status Pernikahan</span>
										<span class="text-xs sm:text-sm font-bold text-slate-100 block mt-0.5 truncate">
											{anggota.statusPernikahan || '-'}
										</span>
									</div>
									<div>
										<span class="text-xs text-slate-400 block font-medium">No. HP / Goldar</span>
										<span class="text-xs sm:text-sm font-bold text-slate-200 font-mono block mt-0.5 truncate">
											{anggota.noTelepon || '-'}{anggota.golonganDarah ? ` (${anggota.golonganDarah})` : ''}
										</span>
									</div>
								</div>
							</div>
						</div>
					</div>
				{/each}
			</div>
		</section>
	{/if}
</div>

<!-- Modal 1: Ubah Data Kartu Keluarga -->
{#if activeModal === 'editKk'}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150"
		role="dialog"
		aria-modal="true"
		tabindex="-1"
		onclick={(e) => {
			if (e.target === e.currentTarget) closeEditKkModal();
		}}
	>
		<div class="w-full max-w-sm bg-[#1E293B] border border-slate-700 rounded-3xl shadow-2xl overflow-hidden p-6 space-y-4">
			<div class="flex items-center justify-between border-b border-slate-700/60 pb-3">
				<h3 class="text-base font-bold text-slate-100">
					{data.keluarga?.isKk ? 'Ubah Kartu Keluarga' : 'Ubah Alamat Tempat Tinggal'}
				</h3>
				<button
					type="button"
					onclick={() => closeEditKkModal()}
					class="p-1 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
				>
					<X class="w-5 h-5" />
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
				class="space-y-4 text-xs sm:text-sm"
			>
				<input type="hidden" name="keluargaId" value={data.keluarga?.id} />

				{#if data.keluarga?.isKk}
					<div>
						<label for="noKk" class="block font-semibold text-slate-200 mb-1.5">
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
							class="w-full bg-[#0F172A] border border-slate-700 rounded-xl px-3.5 py-2.5 font-mono text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
						/>
						<p class="text-[11px] text-slate-400 mt-1">16 digit angka. Dikosongkan jika ingin menghapus.</p>
					</div>
				{/if}

				<div>
					<label for="alamatLengkap" class="block font-semibold text-slate-200 mb-1.5">
						{data.keluarga?.isKk ? 'Alamat Lengkap Domisili' : 'Alamat Tempat Tinggal Saat Ini'}
					</label>
					<textarea
						id="alamatLengkap"
						name="alamatLengkap"
						rows="3"
						required
						bind:value={editKkAlamat}
						placeholder={data.keluarga?.isKk ? 'Alamat lengkap domisili keluarga...' : 'Alamat kos/kontrakan/tempat tinggal saat ini...'}
						class="w-full bg-[#0F172A] border border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
					></textarea>
				</div>

				<div class="flex gap-2.5 pt-2">
					<button
						type="button"
						onclick={() => closeEditKkModal()}
						class="flex-1 py-2.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition-colors cursor-pointer"
					>
						Batal
					</button>
					<button
						type="submit"
						disabled={isSubmitting}
						class="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black transition-colors disabled:opacity-50 cursor-pointer"
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
		class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150"
		role="dialog"
		aria-modal="true"
		tabindex="-1"
		onclick={(e) => {
			if (e.target === e.currentTarget) closeEditAnggotaModal();
		}}
	>
		<div class="bg-[#1E293B] border border-slate-700 rounded-3xl max-w-xl w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
			<div class="flex items-center justify-between pb-3 border-b border-slate-700/60">
				<div>
					<h3 class="text-base font-bold text-slate-100 flex items-center gap-2">
						<Pencil class="w-4 h-4 text-emerald-400" />
						<span>Ubah Data Anggota Keluarga</span>
					</h3>
					<p class="text-xs text-slate-400 mt-0.5">
						Perbarui data demografi dan identitas anggota keluarga Anda.
					</p>
				</div>
				<button
					type="button"
					onclick={() => closeEditAnggotaModal()}
					class="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
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
				class="space-y-4 text-xs sm:text-sm"
			>
				<input type="hidden" name="anggotaId" value={selectedAnggota.id} />

				<div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
					<div class="sm:col-span-2">
						<label for="editNama" class="block font-semibold text-slate-200 mb-1">
							Nama Lengkap *
						</label>
						<input
							id="editNama"
							name="namaLengkap"
							type="text"
							required
							bind:value={editAnggotaNama}
							placeholder="Nama Lengkap Anggota"
							class="w-full bg-[#0F172A] border border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
						/>
					</div>

					<div>
						<label for="editNik" class="block font-semibold text-slate-200 mb-1">
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
							class="w-full bg-[#0F172A] border border-slate-700 rounded-xl px-3.5 py-2.5 font-mono text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
						/>
					</div>

					<div>
						<label for="editStatus" class="block font-semibold text-slate-200 mb-1">
							Status Hubungan Keluarga *
						</label>
						<select
							id="editStatus"
							name="statusHubungan"
							required
							bind:value={editAnggotaStatus}
							onchange={(e) => onEditAnggotaStatusChange(e.currentTarget.value)}
							class="w-full bg-[#0F172A] border border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
						>
							<option value="Kepala Keluarga">Kepala Keluarga</option>
							<option value="Istri">Istri</option>
							<option value="Anak">Anak</option>
							<option value="Orang Tua">Orang Tua</option>
							<option value="Mertua">Mertua</option>
							<option value="Famili Lain">Famili Lain</option>
						</select>
					</div>

					<div>
						<label for="editTempatLahir" class="block font-semibold text-slate-200 mb-1">
							Tempat Lahir *
						</label>
						<input
							id="editTempatLahir"
							name="tempatLahir"
							type="text"
							required
							bind:value={editAnggotaTempatLahir}
							placeholder="Kota / Kabupaten Kelahiran"
							class="w-full bg-[#0F172A] border border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
						/>
					</div>

					<div>
						<label for="editTglLahir" class="block font-semibold text-slate-200 mb-1">
							Tanggal Lahir *
						</label>
						<DateInput
							id="editTglLahir"
							name="tanggalLahir"
							required={true}
							bind:value={editAnggotaTgl}
						/>
						{#if editAnggotaUmur !== null}
							<p class="text-[11px] text-emerald-400 mt-1 font-semibold">
								Umur: {editAnggotaUmur} tahun
							</p>
						{/if}
					</div>

					<div>
						<label for="editJk" class="block font-semibold text-slate-200 mb-1">
							Jenis Kelamin *
						</label>
						<select
							id="editJk"
							name="jenisKelamin"
							required
							bind:value={editAnggotaJk}
							class="w-full bg-[#0F172A] border border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
						>
							<option value="L">Laki-laki</option>
							<option value="P">Perempuan</option>
						</select>
					</div>

					<div>
						<label for="editStatusPernikahan" class="block font-semibold text-slate-200 mb-1">
							Status Pernikahan *
						</label>
						<select
							id="editStatusPernikahan"
							name="statusPernikahan"
							required
							bind:value={editAnggotaStatusPernikahan}
							class="w-full bg-[#0F172A] border border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
						>
							<option value="Belum Menikah">Belum Menikah</option>
							<option value="Menikah">Menikah</option>
							<option value="Pernah Menikah">Pernah Menikah (Duda/Janda)</option>
						</select>
					</div>

					<div>
						<label for="editStatusGenerus" class="block font-semibold text-slate-200 mb-1">
							Kategori Generus *
						</label>
						<select
							id="editStatusGenerus"
							name="statusGenerus"
							required
							bind:value={editAnggotaStatusGenerus}
							class="w-full bg-[#0F172A] border border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
						>
							{#each DAFTAR_STATUS_GENERUS as status}
								<option value={status}>{status}</option>
							{/each}
						</select>
					</div>

					<div>
						<label for="editProfesi" class="block font-semibold text-slate-200 mb-1">
							Profesi / Pekerjaan *
						</label>
						<input
							id="editProfesi"
							name="profesi"
							type="text"
							required
							bind:value={editAnggotaProfesi}
							placeholder="Contoh: Pegawai Swasta, Wiraswasta, Pelajar"
							class="w-full bg-[#0F172A] border border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
						/>
					</div>

					<div>
						<label for="editGoldar" class="block font-semibold text-slate-200 mb-1">
							Golongan Darah
						</label>
						<select
							id="editGoldar"
							name="golonganDarah"
							bind:value={editAnggotaGolonganDarah}
							class="w-full bg-[#0F172A] border border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
						>
							<option value="">- Belum Tahu -</option>
							<option value="A">A</option>
							<option value="B">B</option>
							<option value="AB">AB</option>
							<option value="O">O</option>
							<option value="-">-</option>
						</select>
					</div>

					<div class="sm:col-span-2">
						<label for="editNoTelepon" class="block font-semibold text-slate-200 mb-1">
							No. HP / WhatsApp {#if selectedAnggota?.userId}<span class="text-rose-400">* (Wajib memiliki akun)</span>{:else}<span class="text-slate-400 text-xs font-normal">(Opsional)</span>{/if}
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
							class="w-full bg-[#0F172A] border border-slate-700 rounded-xl px-3.5 py-2.5 font-mono text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
						/>
					</div>
				</div>

				<div class="flex items-center justify-between pt-3 border-t border-slate-700/60">
					<!-- Tombol Hapus Anggota jika anggota keluarga > 1 -->
					{#if data.anggotaList.length > 1}
						<form
							method="POST"
							action="?/hapusAnggota"
							use:enhance={keepScrollSubmit({
								onSuccess: () => { closeEditAnggotaModal(); }
							})}
						>
							<input type="hidden" name="anggotaId" value={selectedAnggota.id} />
							<button
								type="button"
								onclick={async (e) => {
									const formEl = (e.currentTarget as HTMLButtonElement).closest('form');
									const ok = await confirmAction({
										title: 'Hapus Anggota Keluarga?',
										message: `Apakah Anda yakin ingin menghapus data anggota ${selectedAnggota?.namaLengkap || 'ini'}?`,
										confirmText: 'Ya, Hapus',
										variant: 'danger'
									});
									if (ok && formEl) {
										formEl.requestSubmit();
									}
								}}
								class="px-3.5 py-2 rounded-xl text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 font-bold transition-colors cursor-pointer flex items-center gap-1.5"
							>
								<Trash2 class="w-4 h-4" />
								<span>Hapus</span>
							</button>
						</form>
					{:else}
						<div></div>
					{/if}

					<div class="flex items-center gap-2">
						<button
							type="button"
							onclick={() => closeEditAnggotaModal()}
							class="px-4 py-2 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition-colors cursor-pointer"
						>
							Batal
						</button>
						<button
							type="submit"
							disabled={isSubmitting}
							class="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
						>
							<span>Simpan Perubahan</span>
						</button>
					</div>
				</div>
			</form>
		</div>
	</div>
{/if}
