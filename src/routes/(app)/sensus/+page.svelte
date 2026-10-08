<!--
  @file src/routes/(app)/sensus/+page.svelte
  @purpose Tampilan status dan rincian Kartu Keluarga jamaah dengan fitur unmasking No. KK & NIK bagi pemilik
  @usedBy Route client '/sensus'
  @dependencies @lucide/svelte (Users, Plus, Home, Shield, Calendar, UserCheck, Eye, EyeOff, Copy, Check), Svelte 5 Runes
  @publicFunctions toggleKk, copyKk, toggleNik, copyNik
  @sideEffects Mengirim HTTP POST ke /api/sensus/unmask untuk menampilkan plaintext data sensitif pemilik
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
		Check
	} from '@lucide/svelte';
	import type { PageData } from './$types';

	let { data } = $props<{ data: PageData }>();

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

<div class="space-y-5">
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
		<!-- Kartu Informasi Kartu Keluarga -->
		<div class="bg-card border border-border rounded-xl p-4 shadow-sm space-y-3">
			<div class="flex items-start justify-between">
				<div class="flex items-center gap-2.5">
					<div class="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
						<Home class="w-5 h-5" />
					</div>
					<div>
						<div class="flex items-center gap-1.5">
							<p class="text-[11px] text-foreground/60 font-medium">Nomor Kartu Keluarga</p>
							{#if isKkRevealed}
								<span class="text-[9px] font-semibold bg-primary/10 text-primary px-1.5 py-0.2 rounded">Tampil</span>
							{/if}
						</div>
						<div class="flex items-center gap-1.5 mt-0.5">
							<h3 class="text-sm font-bold font-mono text-foreground tracking-wide select-all">
								{isKkRevealed && plainNoKk ? plainNoKk : data.keluarga.noKkMasked}
							</h3>

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
						</div>
					</div>
				</div>
				<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary">
					<Shield class="w-3 h-3" />
					{isKkRevealed ? 'Terverifikasi' : 'Terenkripsi'}
				</span>
			</div>

			<div class="pt-2 border-t border-border/60 text-xs text-foreground/70">
				<p class="font-medium text-[11px] text-foreground/50">Alamat Lengkap:</p>
				<p class="mt-0.5">{data.keluarga.alamatLengkap || 'Belum ada alamat'}</p>
			</div>
		</div>

		<!-- Daftar Anggota Keluarga (Card Layout) -->
		<div class="space-y-3">
			<div class="flex items-center justify-between px-1">
				<h3 class="text-xs font-semibold uppercase tracking-wider text-foreground/70">
					Anggota Keluarga ({data.anggotaList.length})
				</h3>
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
									<h4 class="text-xs font-semibold text-foreground">{anggota.statusHubungan}</h4>
									<div class="flex items-center gap-1.5 mt-0.5">
										<p class="text-[11px] text-foreground/60 font-mono select-all">
											NIK: {revealedNiks[anggota.id] || anggota.nikMasked}
										</p>

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
							<span class="text-[10px] bg-secondary px-2 py-0.5 rounded text-foreground/70 font-medium">
								{anggota.jenisKelamin === 'L' ? 'Laki-laki' : 'Perempuan'}
							</span>
						</div>

						<div class="flex items-center gap-1.5 text-[11px] text-foreground/50 pt-1 border-t border-border/40">
							<Calendar class="w-3 h-3" />
							<span>Tgl Lahir: {anggota.tanggalLahir}</span>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>
