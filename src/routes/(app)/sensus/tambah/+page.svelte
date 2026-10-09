<!--
  @file src/routes/(app)/sensus/tambah/+page.svelte
  @purpose Form wizard interaktif 3-langkah pendaftaran sensus keluarga jamaah
  @usedBy Route client '/sensus/tambah'
  @dependencies @lucide/svelte, $lib/utils (formatDateDDMMYYYY), Svelte 5 Runes
  @publicFunctions nextStep, prevStep, addAnggota, removeAnggota
  @sideEffects Mengirim formulir sensus terenkripsi ke server action
-->
<script lang="ts">
	import {
		ArrowLeft,
		ArrowRight,
		Check,
		Plus,
		Trash2,
		Shield,
		AlertCircle,
		CheckCircle2
	} from '@lucide/svelte';
	import { formatDateDDMMYYYY } from '$lib/utils';
	import type { ActionData } from './$types';

	let { form } = $props<{ form: ActionData }>();

	// State Wizard
	let step = $state(1);
	let showConfirmModal = $state(false);

	let noKk = $state('');
	let alamatLengkap = $state('');

	$effect(() => {
		if (form?.noKk) noKk = form.noKk;
		if (form?.alamatLengkap) alamatLengkap = form.alamatLengkap;
	});

	// State Form Step 2: Anggota Keluarga
	interface AnggotaItem {
		id: string;
		namaLengkap: string;
		nik: string;
		statusHubungan: string;
		tanggalLahir: string;
		jenisKelamin: string;
	}

	let anggotaList = $state<AnggotaItem[]>([
		{
			id: '1',
			namaLengkap: '',
			nik: '',
			statusHubungan: 'Kepala Keluarga',
			tanggalLahir: '',
			jenisKelamin: 'L'
		}
	]);

	// Inline errors
	let errors = $state<{ noKk?: string; anggota?: string }>({});

	function validateStep1(): boolean {
		errors.noKk = undefined;
		if (!noKk || noKk.trim().length !== 16 || !/^\d+$/.test(noKk.trim())) {
			errors.noKk = 'Nomor KK harus 16 digit angka.';
			return false;
		}
		return true;
	}

	function validateStep2(): boolean {
		errors.anggota = undefined;
		for (let i = 0; i < anggotaList.length; i++) {
			const a = anggotaList[i];
			if (!a.namaLengkap || !a.namaLengkap.trim()) {
				errors.anggota = `Nama lengkap anggota ke-${i + 1} wajib diisi.`;
				return false;
			}
			if (!a.nik || a.nik.trim().length !== 16 || !/^\d+$/.test(a.nik.trim())) {
				errors.anggota = `NIK anggota ke-${i + 1} harus 16 digit angka.`;
				return false;
			}
			if (!a.tanggalLahir) {
				errors.anggota = `Tanggal lahir anggota ke-${i + 1} wajib diisi.`;
				return false;
			}
		}
		return true;
	}

	function nextStep() {
		if (step === 1 && validateStep1()) {
			step = 2;
		} else if (step === 2 && validateStep2()) {
			step = 3;
		}
	}

	function prevStep() {
		if (step > 1) step--;
	}

	function addAnggota() {
		anggotaList.push({
			id: Math.random().toString(36).substring(2, 9),
			namaLengkap: '',
			nik: '',
			statusHubungan: 'Anak',
			tanggalLahir: '',
			jenisKelamin: 'L'
		});
	}

	function removeAnggota(index: number) {
		if (anggotaList.length > 1) {
			anggotaList.splice(index, 1);
		}
	}
</script>

<svelte:head>
	<title>Isi Sensus Keluarga - Satu Generus</title>
</svelte:head>

<div class="space-y-5 pb-10">
	<!-- Top Bar Action Back -->
	<div class="flex items-center gap-3">
		<a
			href="/sensus"
			class="p-2 rounded-lg text-foreground/70 hover:bg-secondary hover:text-foreground transition-colors"
			aria-label="Kembali"
		>
			<ArrowLeft class="w-5 h-5" />
		</a>
		<div>
			<h2 class="text-base font-bold text-foreground tracking-tight">Formulir Sensus Keluarga</h2>
			<p class="text-xs text-foreground/60">Langkah {step} dari 3</p>
		</div>
	</div>

	<!-- Step Progress Indicator -->
	<div class="flex items-center justify-between gap-2 px-1">
		{#each [1, 2, 3] as s}
			<div class="flex-1 flex flex-col items-center gap-1">
				<div
					class="w-full h-1.5 rounded-full transition-colors duration-300 {step >= s
						? 'bg-primary'
						: 'bg-secondary'}"
				></div>
				<span class="text-[10px] font-medium {step >= s ? 'text-primary' : 'text-foreground/40'}">
					{s === 1 ? 'Data KK' : s === 2 ? 'Anggota' : 'Review'}
				</span>
			</div>
		{/each}
	</div>

	{#if form?.error}
		<div class="p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center gap-2 text-xs text-destructive">
			<AlertCircle class="w-4 h-4 shrink-0" />
			<span>{form.error}</span>
		</div>
	{/if}

	<!-- Form Wizard Body -->
	<div class="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-5">
		{#if step === 1}
			<!-- STEP 1: Data Kartu Keluarga -->
			<div class="space-y-4">
				<div class="flex items-center gap-2 text-xs text-primary font-medium bg-primary/10 p-2.5 rounded-lg">
					<Shield class="w-4 h-4 shrink-0" />
					<span>Nomor KK akan langsung dienkripsi dua arah (AES-256-GCM) di server.</span>
				</div>

				<div>
					<label for="noKk" class="block text-xs font-semibold text-foreground mb-1.5">
						Nomor Kartu Keluarga (16 Digit) *
					</label>
					<input
						id="noKk"
						type="text"
						maxlength="16"
						placeholder="Contoh: 3216012345670001"
						bind:value={noKk}
						class="w-full bg-secondary/50 border {errors.noKk
							? 'border-destructive'
							: 'border-border'} rounded-lg px-3 py-2 text-xs text-foreground font-mono placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary focus:bg-background transition-all"
					/>
					{#if errors.noKk}
						<p class="text-[11px] text-destructive mt-1">{errors.noKk}</p>
					{/if}
				</div>

				<div>
					<label for="alamatLengkap" class="block text-xs font-semibold text-foreground mb-1.5">
						Alamat Lengkap Domisili
					</label>
					<textarea
						id="alamatLengkap"
						rows="3"
						placeholder="Jl. Mawar No. 12, RT 02/RW 04..."
						bind:value={alamatLengkap}
						class="w-full bg-secondary/50 border border-border rounded-lg p-3 text-xs text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary focus:bg-background transition-all resize-none"
					></textarea>
				</div>
			</div>
		{:else if step === 2}
			<!-- STEP 2: Anggota Keluarga -->
			<div class="space-y-4">
				<div class="flex items-center justify-between">
					<p class="text-xs text-foreground/60 font-medium">Daftar Anggota Keluarga</p>
					<button
						type="button"
						onclick={addAnggota}
						class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-secondary text-primary hover:bg-secondary/80 text-xs font-medium transition-colors"
					>
						<Plus class="w-3.5 h-3.5" />
						<span>Tambah Anggota</span>
					</button>
				</div>

				{#if errors.anggota}
					<div class="p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive">
						{errors.anggota}
					</div>
				{/if}

				<div class="space-y-3">
					{#each anggotaList as anggota, idx}
						<div class="p-3.5 rounded-xl border border-border bg-secondary/30 space-y-3 relative">
							<div class="flex items-center justify-between">
								<span class="text-xs font-semibold text-foreground/80">Anggota #{idx + 1}</span>
								{#if anggotaList.length > 1}
									<button
										type="button"
										onclick={() => removeAnggota(idx)}
										class="text-destructive/70 hover:text-destructive p-1 rounded hover:bg-destructive/10 transition-colors"
										aria-label="Hapus anggota"
									>
										<Trash2 class="w-4 h-4" />
									</button>
								{/if}
							</div>

							<div>
								<label for={`nama-${idx}`} class="block text-[11px] font-medium text-foreground/70 mb-1">
									Nama Lengkap *
								</label>
								<input
									id={`nama-${idx}`}
									type="text"
									placeholder="Contoh: Budi Santoso"
									bind:value={anggota.namaLengkap}
									class="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
								/>
							</div>

							<div>
								<label for={`nik-${idx}`} class="block text-[11px] font-medium text-foreground/70 mb-1">
									NIK (16 Digit) *
								</label>
								<input
									id={`nik-${idx}`}
									type="text"
									maxlength="16"
									placeholder="3216012345670002"
									bind:value={anggota.nik}
									class="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary"
								/>
							</div>

							<div class="grid grid-cols-2 gap-2">
								<div>
									<label for={`hub-${idx}`} class="block text-[11px] font-medium text-foreground/70 mb-1">
										Status Hubungan *
									</label>
									<select
										id={`hub-${idx}`}
										bind:value={anggota.statusHubungan}
										class="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
									>
										<option value="Kepala Keluarga">Kepala Keluarga</option>
										<option value="Suami">Suami</option>
										<option value="Istri">Istri</option>
										<option value="Anak">Anak</option>
										<option value="Orang Tua">Orang Tua</option>
										<option value="Famili Lain">Famili Lain</option>
									</select>
								</div>

								<div>
									<label for={`jk-${idx}`} class="block text-[11px] font-medium text-foreground/70 mb-1">
										Jenis Kelamin *
									</label>
									<select
										id={`jk-${idx}`}
										bind:value={anggota.jenisKelamin}
										class="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
									>
										<option value="L">Laki-laki</option>
										<option value="P">Perempuan</option>
									</select>
								</div>
							</div>

							<div>
								<label for={`tgl-${idx}`} class="block text-[11px] font-medium text-foreground/70 mb-1">
									Tanggal Lahir *
								</label>
								<input
									id={`tgl-${idx}`}
									type="date"
									bind:value={anggota.tanggalLahir}
									class="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
								/>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{:else if step === 3}
			<!-- STEP 3: Review Ringkasan -->
			<div class="space-y-4">
				<div class="flex items-center gap-2 text-xs text-primary font-medium bg-primary/10 p-2.5 rounded-lg">
					<CheckCircle2 class="w-4 h-4 shrink-0" />
					<span>Periksa data sensus sebelum disimpan secara permanen.</span>
				</div>

				<div class="border border-border rounded-xl p-3.5 space-y-2 bg-secondary/20">
					<p class="text-[11px] text-foreground/50 font-medium">Nomor KK:</p>
					<p class="text-xs font-mono font-bold text-foreground">{noKk}</p>
					<p class="text-[11px] text-foreground/50 font-medium pt-1">Alamat:</p>
					<p class="text-xs text-foreground/80">{alamatLengkap || '-'}</p>
				</div>

				<div class="space-y-2">
					<p class="text-xs font-semibold text-foreground">Daftar Anggota ({anggotaList.length}):</p>
					{#each anggotaList as a, idx}
						<div class="flex items-center justify-between p-2.5 rounded-lg border border-border bg-card text-xs">
							<div>
								<span class="font-bold text-foreground">{a.namaLengkap}</span>
								<div class="flex items-center gap-1.5 mt-0.5">
									<span class="text-[10px] text-primary font-semibold">{a.statusHubungan}</span>
									<span class="text-[11px] text-foreground/60 font-mono">• NIK: {a.nik}</span>
								</div>
							</div>
							<span class="text-[10px] bg-secondary px-2 py-0.5 rounded text-foreground/70">
								{a.jenisKelamin === 'L' ? 'L' : 'P'} • {formatDateDDMMYYYY(a.tanggalLahir)}
							</span>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Wizard Navigation Buttons -->
		<div class="flex items-center justify-between pt-3 border-t border-border">
			{#if step > 1}
				<button
					type="button"
					onclick={prevStep}
					class="px-4 py-2 rounded-lg border border-border text-xs font-semibold text-foreground/80 hover:bg-secondary transition-colors"
				>
					Kembali
				</button>
			{:else}
				<div></div>
			{/if}

			{#if step < 3}
				<button
					type="button"
					onclick={nextStep}
					class="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-all shadow-sm active:scale-95"
				>
					<span>Lanjut</span>
					<ArrowRight class="w-3.5 h-3.5" />
				</button>
			{:else}
				<button
					type="button"
					onclick={() => (showConfirmModal = true)}
					class="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-all shadow-sm active:scale-95"
				>
					<Check class="w-4 h-4" />
					<span>Simpan Final Sensus</span>
				</button>
			{/if}
		</div>
	</div>
</div>

<!-- Modal Konfirmasi Eksekusi sesuai DESIGN.md (Tengah layar, blur tipis) -->
{#if showConfirmModal}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
		role="dialog"
		aria-modal="true"
		onclick={(e) => {
			if (e.target === e.currentTarget) showConfirmModal = false;
		}}
	>
		<div class="bg-card border border-border rounded-2xl max-w-sm w-full p-6 shadow-xl space-y-4">
			<div class="w-12 h-12 rounded-xl bg-primary/10 text-primary mx-auto flex items-center justify-center">
				<Shield class="w-6 h-6" />
			</div>

			<div class="text-center space-y-1">
				<h3 class="text-base font-bold text-foreground">Simpan Data Sensus?</h3>
				<p class="text-xs text-foreground/60 leading-relaxed">
					Nomor KK dan seluruh NIK akan dienkripsi secara aman sebelum disimpan ke database server.
				</p>
			</div>

			<form method="POST" class="space-y-3">
				<input type="hidden" name="noKk" value={noKk} />
				<input type="hidden" name="alamatLengkap" value={alamatLengkap} />
				<input type="hidden" name="anggotaData" value={JSON.stringify(anggotaList)} />

				<div class="grid grid-cols-2 gap-2 pt-2">
					<button
						type="button"
						onclick={() => (showConfirmModal = false)}
						class="w-full py-2.5 rounded-lg border border-border text-xs font-semibold text-foreground/80 hover:bg-secondary transition-colors"
					>
						Batal
					</button>
					<button
						type="submit"
						class="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-all shadow-sm"
					>
						Ya, Simpan
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
