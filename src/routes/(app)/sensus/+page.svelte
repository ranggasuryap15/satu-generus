<!--
  @file src/routes/(app)/sensus/+page.svelte
  @purpose Tampilan status dan rincian Kartu Keluarga serta Jamaah Mandiri/Perantau dengan fitur unmasking, ubah data domisili, NIK (opsional), dan data anggota dengan proteksi draf input
  @usedBy Route client '/sensus'
  @dependencies @lucide/svelte, $app/forms (enhance), $lib/components/DateInput.svelte, $lib/utils (formatDateDDMMYYYY), Svelte 5 Runes
  @publicFunctions toggleKk, copyKk, toggleNik, copyNik, openEditKk, closeEditKkModal, openEditAnggota, closeEditAnggotaModal, openTambahAnggota, closeTambahAnggotaModal
  @sideEffects Mengirim HTTP POST ke /api/sensus/unmask serta server actions updateKeluarga/updateAnggota/tambahAnggota/hapusAnggota
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
		CheckCircle
	} from '@lucide/svelte';
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';
	import DateInput from '$lib/components/DateInput.svelte';
	import { formatDateDDMMYYYY } from '$lib/utils';

	let { data, form } = $props<{ data: PageData; form: ActionData }>();

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
	let activeModal = $state<'none' | 'editKk' | 'editAnggota' | 'tambahAnggota'>('none');
	let selectedAnggota = $state<(typeof data.anggotaList)[number] | null>(null);
	let isSubmitting = $state(false);

	let editKkNoKk = $state('');
	let editKkAlamat = $state('');

	let editAnggotaNama = $state('');
	let editAnggotaNik = $state('');
	let editAnggotaStatus = $state('');
	let editAnggotaTgl = $state('');
	let editAnggotaJk = $state('');

	// State Tambah Anggota (Persisten agar tidak hilang saat modal tertutup)
	let newAnggotaNama = $state('');
	let newAnggotaNik = $state('');
	let newAnggotaStatus = $state('Anak');
	let newAnggotaTgl = $state('');
	let newAnggotaJk = $state('Laki-laki');

	function resetTambahAnggota() {
		newAnggotaNama = '';
		newAnggotaNik = '';
		newAnggotaStatus = 'Anak';
		newAnggotaTgl = '';
		newAnggotaJk = 'Laki-laki';
	}

	function openEditKk() {
		editKkNoKk = isKkRevealed && plainNoKk ? plainNoKk : '';
		editKkAlamat = data.keluarga?.alamatLengkap || '';
		activeModal = 'editKk';
	}

	function closeEditKkModal() {
		const initialNoKk = isKkRevealed && plainNoKk ? plainNoKk : '';
		const initialAlamat = data.keluarga?.alamatLengkap || '';
		const isDirty = editKkNoKk !== initialNoKk || editKkAlamat !== initialAlamat;
		if (isDirty) {
			if (!confirm('Ada perubahan data Kartu Keluarga yang belum disimpan. Yakin ingin menutup modal?')) {
				return;
			}
		}
		activeModal = 'none';
	}

	function openEditAnggota(anggota: (typeof data.anggotaList)[number]) {
		selectedAnggota = anggota;
		editAnggotaNama = anggota.namaLengkap || '';
		editAnggotaNik = revealedNiks[anggota.id] || '';
		editAnggotaStatus = anggota.statusHubungan;
		editAnggotaTgl = anggota.tanggalLahir;
		editAnggotaJk = anggota.jenisKelamin;
		activeModal = 'editAnggota';
	}

	function closeEditAnggotaModal() {
		if (selectedAnggota) {
			const isDirty = (
				editAnggotaNama !== (selectedAnggota.namaLengkap || '') ||
				editAnggotaNik !== (revealedNiks[selectedAnggota.id] || '') ||
				editAnggotaStatus !== selectedAnggota.statusHubungan ||
				editAnggotaTgl !== selectedAnggota.tanggalLahir ||
				editAnggotaJk !== selectedAnggota.jenisKelamin
			);
			if (isDirty) {
				if (!confirm('Ada perubahan data anggota yang belum disimpan. Yakin ingin menutup modal?')) {
					return;
				}
			}
		}
		activeModal = 'none';
		selectedAnggota = null;
	}

	function openTambahAnggota() {
		activeModal = 'tambahAnggota';
	}

	function closeTambahAnggotaModal() {
		const isDirty = !!(newAnggotaNama.trim() || newAnggotaNik.trim() || newAnggotaTgl);
		if (isDirty) {
			if (!confirm('Ada data anggota yang sudah Anda isi. Yakin ingin menutup modal? Isian Anda akan tetap tersimpan sebagai draf.')) {
				return;
			}
		}
		activeModal = 'none';
	}

	$effect(() => {
		if (
			form?.successKeluarga ||
			form?.successAnggota ||
			form?.successTambahAnggota ||
			form?.successHapusAnggota
		) {
			if (form?.successTambahAnggota) {
				resetTambahAnggota();
			}
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

<div class="space-y-5 pb-8">
	<div class="flex items-center justify-between">
		<div>
			<h2 class="text-lg font-bold text-foreground tracking-tight">Sensus Keluarga</h2>
			<p class="text-xs text-foreground/60">Data kependudukan & keanggotaan jamaah</p>
		</div>

		{#if !data.hasKeluarga}
			<a
				href="/sensus/tambah"
				class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-all shadow-sm"
			>
				<Plus class="w-3.5 h-3.5" />
				<span>Isi KK</span>
			</a>
		{/if}
	</div>

	<!-- Notifikasi Feedback Server Actions -->
	{#if form?.successKeluarga}
		<div class="p-3.5 bg-primary/10 border border-primary/20 text-primary text-xs rounded-xl flex items-center gap-2">
			<CheckCircle class="w-4 h-4 shrink-0" />
			<span>{form.successKeluarga}</span>
		</div>
	{/if}
	{#if form?.errorKeluarga}
		<div class="p-3.5 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-xl flex items-center gap-2">
			<AlertCircle class="w-4 h-4 shrink-0" />
			<span>{form.errorKeluarga}</span>
		</div>
	{/if}
	{#if form?.successAnggota}
		<div class="p-3.5 bg-primary/10 border border-primary/20 text-primary text-xs rounded-xl flex items-center gap-2">
			<CheckCircle class="w-4 h-4 shrink-0" />
			<span>{form.successAnggota}</span>
		</div>
	{/if}
	{#if form?.errorAnggota}
		<div class="p-3.5 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-xl flex items-center gap-2">
			<AlertCircle class="w-4 h-4 shrink-0" />
			<span>{form.errorAnggota}</span>
		</div>
	{/if}
	{#if form?.successTambahAnggota}
		<div class="p-3.5 bg-primary/10 border border-primary/20 text-primary text-xs rounded-xl flex items-center gap-2">
			<CheckCircle class="w-4 h-4 shrink-0" />
			<span>{form.successTambahAnggota}</span>
		</div>
	{/if}
	{#if form?.errorTambahAnggota}
		<div class="p-3.5 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-xl flex items-center gap-2">
			<AlertCircle class="w-4 h-4 shrink-0" />
			<span>{form.errorTambahAnggota}</span>
		</div>
	{/if}
	{#if form?.successHapusAnggota}
		<div class="p-3.5 bg-primary/10 border border-primary/20 text-primary text-xs rounded-xl flex items-center gap-2">
			<CheckCircle class="w-4 h-4 shrink-0" />
			<span>{form.successHapusAnggota}</span>
		</div>
	{/if}
	{#if form?.errorHapusAnggota}
		<div class="p-3.5 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-xl flex items-center gap-2">
			<AlertCircle class="w-4 h-4 shrink-0" />
			<span>{form.errorHapusAnggota}</span>
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
							<p class="text-[11px] text-foreground/60 font-medium">
								{data.keluarga.isKk ? 'Nomor Kartu Keluarga' : 'Status Sensus Jamaah'}
							</p>
							{#if data.keluarga.isKk && isKkRevealed}
								<span class="text-[9px] font-semibold bg-primary/10 text-primary px-1.5 py-0.2 rounded">Tampil</span>
							{/if}
						</div>
						<div class="flex items-center gap-1.5 mt-0.5">
							{#if data.keluarga.isKk}
								<h3 class="text-sm font-bold font-mono text-foreground tracking-wide select-all">
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

				{#if data.keluarga.isKk}
					<button
						type="button"
						onclick={openTambahAnggota}
						class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold transition-colors cursor-pointer"
					>
						<Plus class="w-3 h-3" />
						<span>Tambah Anggota</span>
					</button>
				{/if}
			</div>

			<div class="space-y-2.5">
				{#each data.anggotaList as anggota}
					<div class="bg-card border border-border rounded-xl p-3.5 shadow-sm space-y-2">
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-2">
								<div class="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-xs font-medium text-foreground">
									<UserCheck class="w-3.5 h-3.5 text-primary" />
								</div>
								<div>
									<div class="flex items-center gap-1.5 flex-wrap">
										<h4 class="text-xs font-bold text-foreground">{anggota.namaLengkap}</h4>
										<span class="text-[10px] bg-primary/10 text-primary px-1.5 py-0.2 rounded font-medium">
											{anggota.statusHubungan}
										</span>
									</div>
									<div class="flex items-center gap-1.5 mt-0.5">
										<p class="text-[11px] text-foreground/60 font-mono select-all">
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
													<span class="inline-block w-3 h-3 border border-primary border-t-transparent rounded-full animate-spin"></span>
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

							<div class="flex items-center gap-1.5">
								<span class="text-[10px] bg-secondary px-2 py-0.5 rounded text-foreground/70 font-medium">
									{anggota.jenisKelamin === 'L' || anggota.jenisKelamin === 'Laki-laki' ? 'Laki-laki' : 'Perempuan'}
								</span>

								<!-- Tombol Edit Anggota -->
								<button
									type="button"
									onclick={() => openEditAnggota(anggota)}
									class="p-1.5 rounded-lg text-foreground/60 hover:text-foreground hover:bg-secondary transition-colors inline-flex items-center justify-center"
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
										use:enhance
										onsubmit={(e) => {
											if (!confirm('Yakin ingin menghapus anggota keluarga ini?')) {
												e.preventDefault();
											}
										}}
									>
										<input type="hidden" name="anggotaId" value={anggota.id} />
										<button
											type="submit"
											class="p-1.5 rounded-lg text-destructive/60 hover:text-destructive hover:bg-destructive/10 transition-colors inline-flex items-center justify-center"
											title="Hapus Anggota"
											aria-label="Hapus Anggota"
										>
											<Trash2 class="w-3.5 h-3.5" />
										</button>
									</form>
								{/if}
							</div>
						</div>

						<div class="flex items-center gap-1.5 text-[11px] text-foreground/50 pt-1 border-t border-border/40">
							<Calendar class="w-3 h-3" />
							<span>Tgl Lahir: {formatDateDDMMYYYY(anggota.tanggalLahir)}</span>
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
					onclick={closeEditKkModal}
					class="text-foreground/50 hover:text-foreground text-sm font-semibold"
				>
					✕
				</button>
			</div>

			<form
				method="POST"
				action="?/updateKeluarga"
				use:enhance={() => {
					isSubmitting = true;
					return async ({ update }) => {
						isSubmitting = false;
						await update();
					};
				}}
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
							maxlength="16"
							bind:value={editKkNoKk}
							placeholder="Biarkan kosong jika tidak ingin mengubah"
							class="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:bg-background transition-all"
						/>
						<p class="text-[10px] text-foreground/50 mt-1">16 digit angka. Terenkripsi otomatis dengan AES-256-GCM.</p>
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
						onclick={closeEditKkModal}
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

<!-- Modal 2: Ubah Data Anggota Keluarga -->
{#if activeModal === 'editAnggota' && selectedAnggota}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-150"
		onclick={(e) => {
			if (e.target === e.currentTarget) closeEditAnggotaModal();
		}}
	>
		<div class="w-full max-w-sm bg-card border border-border rounded-2xl shadow-xl overflow-hidden p-6 space-y-4">
			<div class="flex items-center justify-between border-b border-border pb-3">
				<h3 class="text-sm font-bold text-foreground">Ubah Anggota Keluarga</h3>
				<button
					type="button"
					onclick={closeEditAnggotaModal}
					class="text-foreground/50 hover:text-foreground text-sm font-semibold"
				>
					✕
				</button>
			</div>

			<form
				method="POST"
				action="?/updateAnggota"
				use:enhance={() => {
					isSubmitting = true;
					return async ({ update }) => {
						isSubmitting = false;
						await update();
					};
				}}
				class="space-y-4 text-xs"
			>
				<input type="hidden" name="anggotaId" value={selectedAnggota.id} />

				<div>
					<label for="editNama" class="block font-medium text-foreground/80 mb-1.5">
						Nama Lengkap
					</label>
					<input
						id="editNama"
						name="namaLengkap"
						type="text"
						required
						bind:value={editAnggotaNama}
						placeholder="Nama Lengkap Anggota"
						class="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:bg-background transition-all"
					/>
				</div>

				<div>
					<label for="editNik" class="block font-medium text-foreground/80 mb-1.5">
						NIK (Nomor Induk Kependudukan)
					</label>
					<input
						id="editNik"
						name="nik"
						type="text"
						maxlength="16"
						bind:value={editAnggotaNik}
						placeholder="Biarkan kosong jika tidak ingin mengubah NIK"
						class="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:bg-background transition-all"
					/>
					<p class="text-[10px] text-foreground/50 mt-1">16 digit angka. Terenkripsi dengan AES-256-GCM.</p>
				</div>

				<div>
					<label for="editStatus" class="block font-medium text-foreground/80 mb-1.5">
						Status Hubungan
					</label>
					<select
						id="editStatus"
						name="statusHubungan"
						required
						bind:value={editAnggotaStatus}
						class="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:bg-background transition-all"
					>
						<option value="Kepala Keluarga">Kepala Keluarga</option>
						<option value="Istri">Istri</option>
						<option value="Anak">Anak</option>
						<option value="Famili Lain">Famili Lain</option>
					</select>
				</div>

				<div>
					<label for="editTgl" class="block font-medium text-foreground/80 mb-1.5">
						Tanggal Lahir (DD-MM-YYYY)
					</label>
					<DateInput
						id="editTgl"
						name="tanggalLahir"
						required
						bind:value={editAnggotaTgl}
						class="bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:bg-background transition-all"
					/>
				</div>

				<div>
					<label for="editJk" class="block font-medium text-foreground/80 mb-1.5">
						Jenis Kelamin
					</label>
					<select
						id="editJk"
						name="jenisKelamin"
						required
						bind:value={editAnggotaJk}
						class="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:bg-background transition-all"
					>
						<option value="Laki-laki">Laki-laki</option>
						<option value="Perempuan">Perempuan</option>
					</select>
				</div>

				<div class="flex gap-2 pt-2">
					<button
						type="button"
						onclick={closeEditAnggotaModal}
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

<!-- Modal 3: Tambah Anggota Keluarga Baru -->
{#if activeModal === 'tambahAnggota'}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-150"
		onclick={(e) => {
			if (e.target === e.currentTarget) closeTambahAnggotaModal();
		}}
	>
		<div class="w-full max-w-sm bg-card border border-border rounded-2xl shadow-xl overflow-hidden p-6 space-y-4">
			<div class="flex items-center justify-between border-b border-border pb-3">
				<h3 class="text-sm font-bold text-foreground">Tambah Anggota Keluarga</h3>
				<button
					type="button"
					onclick={closeTambahAnggotaModal}
					class="text-foreground/50 hover:text-foreground text-sm font-semibold"
				>
					✕
				</button>
			</div>

			<form
				method="POST"
				action="?/tambahAnggota"
				use:enhance={() => {
					isSubmitting = true;
					return async ({ update }) => {
						isSubmitting = false;
						await update();
					};
				}}
				class="space-y-4 text-xs"
			>
				<input type="hidden" name="keluargaId" value={data.keluarga?.id} />

				<div>
					<label for="newNamaLengkap" class="block font-medium text-foreground/80 mb-1.5">
						Nama Lengkap
					</label>
					<input
						id="newNamaLengkap"
						name="namaLengkap"
						type="text"
						required
						bind:value={newAnggotaNama}
						placeholder="Contoh: Siti Rahayu"
						class="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:bg-background transition-all"
					/>
				</div>

				<div>
					<label for="newNik" class="block font-medium text-foreground/80 mb-1.5">
						NIK (Nomor Induk Kependudukan) <span class="text-foreground/50 text-[11px] font-normal">(16 Digit, Opsional)</span>
					</label>
					<input
						id="newNik"
						name="nik"
						type="text"
						maxlength="16"
						bind:value={newAnggotaNik}
						placeholder="16 digit angka (opsional)"
						class="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:bg-background transition-all"
					/>
				</div>

				<div>
					<label for="newStatus" class="block font-medium text-foreground/80 mb-1.5">
						Status Hubungan
					</label>
					<select
						id="newStatus"
						name="statusHubungan"
						required
						bind:value={newAnggotaStatus}
						class="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:bg-background transition-all"
					>
						<option value="Istri">Istri</option>
						<option value="Anak">Anak</option>
						<option value="Kepala Keluarga">Kepala Keluarga</option>
						<option value="Famili Lain">Famili Lain</option>
					</select>
				</div>

				<div>
					<label for="newTgl" class="block font-medium text-foreground/80 mb-1.5">
						Tanggal Lahir (DD-MM-YYYY)
					</label>
					<DateInput
						id="newTgl"
						name="tanggalLahir"
						required
						bind:value={newAnggotaTgl}
						class="bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:bg-background transition-all"
					/>
				</div>

				<div>
					<label for="newJk" class="block font-medium text-foreground/80 mb-1.5">
						Jenis Kelamin
					</label>
					<select
						id="newJk"
						name="jenisKelamin"
						required
						bind:value={newAnggotaJk}
						class="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:bg-background transition-all"
					>
						<option value="Laki-laki">Laki-laki</option>
						<option value="Perempuan">Perempuan</option>
					</select>
				</div>

				<div class="flex gap-2 pt-2">
					<button
						type="button"
						onclick={closeTambahAnggotaModal}
						class="flex-1 py-2 rounded-lg border border-border bg-secondary/60 hover:bg-secondary text-foreground font-semibold transition-colors"
					>
						Batal
					</button>
					<button
						type="submit"
						disabled={isSubmitting}
						class="flex-1 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold transition-colors disabled:opacity-50"
					>
						{isSubmitting ? 'Menambahkan...' : 'Tambah'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

