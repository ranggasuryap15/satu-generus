<!--
  @file src/routes/(app)/profil/+page.svelte
  @purpose Halaman profil pengguna dengan fitur update nama, email, ganti kata sandi, pengaturan tema, tombol Quick Install PWA Satu Generus, panduan manual instalasi, dan logout dengan proteksi draf modal
  @usedBy Route client '/profil'
  @dependencies @lucide/svelte, ThemeToggle, PwaInstallGuideModal, $lib/pwa.svelte, $app/forms (enhance)
  @publicFunctions closeProfileModal, closePasswordModal, resetProfileDraft, resetPasswordDraft, isProfileDirty, isPasswordDirty, handleQuickInstall
  @sideEffects Mengirim form updateProfile dan updatePassword ke server actions, memicu instalasi PWA native
-->
<script lang="ts">
	import {
		User,
		ShieldCheck,
		MapPin,
		Mail,
		LogOut,
		ArrowRight,
		Moon,
		KeyRound,
		CheckCircle,
		CheckCircle2,
		AlertCircle,
		Pencil,
		Download,
		Smartphone,
		HelpCircle,
		X
	} from '@lucide/svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import PwaInstallGuideModal from '$lib/components/PwaInstallGuideModal.svelte';
	import { pwaState } from '$lib/pwa.svelte';
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';

	let { data, form } = $props<{ data: PageData; form: ActionData }>();

	let activeModal = $state<'none' | 'profile' | 'password'>('none');
	let showPwaGuide = $state(false);
	let isSubmitting = $state(false);
	let isInstallingPwa = $state(false);
	let pwaMessage = $state<string | null>(null);

	async function handleQuickInstall() {
		if (pwaState.isInstalled) return;

		isInstallingPwa = true;
		pwaMessage = null;

		try {
			const success = await pwaState.install();
			if (success) {
				pwaMessage = 'Aplikasi Satu Generus berhasil dipasang!';
				isInstallingPwa = false;
				return;
			}

			if (pwaState.platform === 'ios') {
				pwaMessage = 'Safari iOS: Ketuk tombol Bagikan (Share ⎋) di bawah layar, lalu pilih "Tambahkan ke Layar Utama (+)".';
			} else if (!pwaState.isInstallable) {
				pwaMessage = 'Buka menu titik tiga (⋮) di browser Anda, lalu pilih "Pasang Satu Generus" atau "Tambahkan ke Layar Utama".';
			}
		} catch (err) {
			console.error('Error saat quick install:', err);
		} finally {
			isInstallingPwa = false;
		}
	}

	let inputNama = $state(data.user.namaLengkap);
	let inputEmail = $state(data.user.email || '');

	let currentPassword = $state('');
	let newPassword = $state('');
	let confirmPassword = $state('');

	const userInitials = $derived(
		(data.user.namaLengkap || 'User')
			.split(' ')
			.map((n: string) => n[0])
			.slice(0, 2)
			.join('')
			.toUpperCase()
	);

	function isProfileDirty() {
		return (
			inputNama.trim() !== (data.user.namaLengkap || '').trim() ||
			inputEmail.trim() !== (data.user.email || '').trim()
		);
	}

	function resetProfileDraft() {
		inputNama = data.user.namaLengkap;
		inputEmail = data.user.email || '';
	}

	function closeProfileModal() {
		if (isProfileDirty()) {
			if (
				confirm(
					'Ada perubahan profil yang belum disimpan. Tetap tutup modal? (Isian Anda akan tetap tersimpan sebagai draf)'
				)
			) {
				activeModal = 'none';
			}
		} else {
			activeModal = 'none';
		}
	}

	function isPasswordDirty() {
		return currentPassword !== '' || newPassword !== '' || confirmPassword !== '';
	}

	function resetPasswordDraft() {
		currentPassword = '';
		newPassword = '';
		confirmPassword = '';
	}

	function closePasswordModal() {
		if (isPasswordDirty()) {
			if (
				confirm(
					'Ada isian kata sandi yang belum disimpan. Tetap tutup modal? (Isian Anda akan tetap tersimpan sebagai draf)'
				)
			) {
				activeModal = 'none';
			}
		} else {
			activeModal = 'none';
		}
	}

	$effect(() => {
		if (form?.profileSuccess) {
			activeModal = 'none';
		}
		if (form?.passwordSuccess) {
			resetPasswordDraft();
			activeModal = 'none';
		}
	});
</script>

<svelte:head>
	<title>Profil Saya - Satu Generus</title>
</svelte:head>

<div class="space-y-5 pb-8">
	<!-- Pesan Feedback Global -->
	{#if form?.profileSuccess}
		<div class="p-3.5 rounded-xl bg-primary/10 border border-primary/20 flex items-center gap-2.5 text-xs text-primary font-medium">
			<CheckCircle class="w-4 h-4 shrink-0" />
			<span>{form.profileSuccess}</span>
		</div>
	{/if}

	{#if form?.passwordSuccess}
		<div class="p-3.5 rounded-xl bg-primary/10 border border-primary/20 flex items-center gap-2.5 text-xs text-primary font-medium">
			<CheckCircle class="w-4 h-4 shrink-0" />
			<span>{form.passwordSuccess}</span>
		</div>
	{/if}

	<!-- Card Identitas Pengguna -->
	<section class="bg-card border border-border rounded-2xl p-5 shadow-sm text-center relative overflow-hidden">
		<div class="w-20 h-20 rounded-full bg-primary/10 text-primary font-bold text-2xl flex items-center justify-center mx-auto mb-3 border-2 border-primary/20 shadow-inner">
			{userInitials}
		</div>

		<h1 class="text-base font-bold text-foreground tracking-tight">{data.user.namaLengkap}</h1>
		<p class="text-xs text-foreground/60 mt-0.5">{data.user.email || 'Email belum ditautkan'}</p>

		<div class="flex items-center justify-center gap-2 mt-3">
			<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary">
				<MapPin class="w-3 h-3" />
				{data.kelompokNama}
			</span>

			{#if data.isAdmin}
				<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-accent/20 text-accent">
					<ShieldCheck class="w-3 h-3" />
					Pengurus 4S
				</span>
			{/if}
		</div>

		<!-- Tombol Aksi Cepat Akun -->
		<div class="grid grid-cols-2 gap-2 mt-5 pt-4 border-t border-border">
			<button
				type="button"
				onclick={() => { activeModal = 'profile'; }}
				class="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-secondary/80 hover:bg-secondary text-foreground text-xs font-semibold transition-colors border border-border/60"
			>
				<Pencil class="w-3.5 h-3.5 text-primary" />
				<span>Ubah Profil</span>
			</button>

			<button
				type="button"
				onclick={() => { activeModal = 'password'; }}
				class="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-secondary/80 hover:bg-secondary text-foreground text-xs font-semibold transition-colors border border-border/60"
			>
				<KeyRound class="w-3.5 h-3.5 text-primary" />
				<span>Ganti Kata Sandi</span>
			</button>
		</div>
	</section>

	<!-- Navigasi Cepat Pengurus (Jika Admin) -->
	{#if data.isAdmin}
		<section class="bg-primary/5 border border-primary/20 rounded-xl p-4 shadow-sm">
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-2.5">
					<div class="w-9 h-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
						<ShieldCheck class="w-5 h-5" />
					</div>
					<div>
						<h2 class="text-xs font-bold text-foreground">Panel Dashboard Admin</h2>
						<p class="text-[11px] text-foreground/60">Kelola sensus wilayah dan jadwal presensi</p>
					</div>
				</div>

				<a
					href="/admin"
					class="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-all shadow-sm"
				>
					<span>Buka</span>
					<ArrowRight class="w-3.5 h-3.5" />
				</a>
			</div>
		</section>
	{/if}

	<!-- Pengaturan Akun & Preferensi -->
	<section class="bg-card border border-border rounded-xl divide-y divide-border shadow-sm overflow-hidden text-xs">
		<!-- Toggle Mode Tampilan -->
		<div class="p-4 flex items-center justify-between">
			<div class="flex items-center gap-3">
				<div class="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center text-foreground/70">
					<Moon class="w-4 h-4" />
				</div>
				<div>
					<p class="font-semibold text-foreground">Tema Tampilan</p>
					<p class="text-[11px] text-foreground/50">Sesuaikan mode terang atau gelap</p>
				</div>
			</div>
			<ThemeToggle />
		</div>

		<!-- Informasi Email / Kontak -->
		<div class="p-4 flex items-center justify-between">
			<div class="flex items-center gap-3">
				<div class="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center text-foreground/70">
					<Mail class="w-4 h-4" />
				</div>
				<div>
					<p class="font-semibold text-foreground">Email Akun</p>
					<p class="text-[11px] text-foreground/50">{data.user.email || 'Belum diisi'}</p>
				</div>
			</div>
			<button
				type="button"
				onclick={() => { activeModal = 'profile'; }}
				class="text-xs text-primary font-semibold hover:underline"
			>
				Ubah
			</button>
		</div>

		<!-- Status Kelompok -->
		<div class="p-4 flex items-center justify-between">
			<div class="flex items-center gap-3">
				<div class="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center text-foreground/70">
					<MapPin class="w-4 h-4" />
				</div>
				<div>
					<p class="font-semibold text-foreground">Lingkup Kelompok</p>
					<p class="text-[11px] text-foreground/50">{data.kelompokNama}</p>
				</div>
			</div>
		</div>
	</section>

	<!-- Section PWA: Pasang Satu Generus (Quick Install) -->
	<section class="bg-card border border-border rounded-xl p-4 shadow-sm space-y-3 text-xs">
		<div class="flex items-start justify-between gap-3">
			<div class="flex items-start gap-3">
				<div class="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
					<Smartphone class="w-5 h-5" />
				</div>
				<div class="space-y-0.5">
					<div class="flex items-center gap-2 flex-wrap">
						<p class="font-bold text-foreground text-xs">Pasang Satu Generus</p>
						{#if pwaState.isInstalled}
							<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
								<CheckCircle2 class="w-3 h-3" />
								<span>Sudah Terpasang</span>
							</span>
						{/if}
					</div>
					<p class="text-[11px] text-foreground/60 leading-relaxed">
						{pwaState.isInstalled
							? 'Aplikasi telah terpasang di perangkat Anda. Anda dapat membukanya langsung dari layar utama kapan saja.'
							: 'Pasang ke layar utama untuk akses cepat 1-klik, tampilan layar penuh tanpa browser, dan hemat kuota.'}
					</p>
				</div>
			</div>
		</div>

		{#if pwaMessage}
			<div class="p-2.5 rounded-lg bg-primary/10 border border-primary/20 text-primary text-[11px] flex items-start justify-between gap-2">
				<div class="flex items-start gap-2">
					<CheckCircle2 class="w-3.5 h-3.5 shrink-0 mt-0.5" />
					<span class="leading-relaxed">{pwaMessage}</span>
				</div>
				<button type="button" onclick={() => (pwaMessage = null)} class="text-primary/70 hover:text-primary cursor-pointer shrink-0">
					<X class="w-3.5 h-3.5" />
				</button>
			</div>
		{/if}

		<div class="pt-1 border-t border-border/60">
			{#if !pwaState.isInstalled}
				<div class="flex flex-col sm:flex-row gap-2">
					<button
						type="button"
						onclick={handleQuickInstall}
						disabled={isInstallingPwa}
						class="w-full py-2.5 px-4 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50"
					>
						{#if isInstallingPwa}
							<div class="w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin"></div>
							<span>Memproses Pemasangan...</span>
						{:else}
							<Download class="w-3.5 h-3.5" />
							<span>Pasang Satu Generus (Quick Install)</span>
						{/if}
					</button>

					<button
						type="button"
						onclick={() => (showPwaGuide = true)}
						class="w-full sm:w-auto shrink-0 py-2.5 px-3 rounded-lg border border-border bg-secondary/60 hover:bg-secondary text-foreground/70 hover:text-foreground font-medium text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
					>
						<HelpCircle class="w-3.5 h-3.5 text-foreground/50" />
						<span>Panduan Manual</span>
					</button>
				</div>
			{:else}
				<button
					type="button"
					onclick={() => (showPwaGuide = true)}
					class="w-full py-2.5 px-3 rounded-lg border border-border bg-secondary/60 hover:bg-secondary text-foreground font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
				>
					<HelpCircle class="w-3.5 h-3.5 text-primary" />
					<span>Panduan & Info Aplikasi</span>
				</button>
			{/if}
		</div>
	</section>

	<!-- Tombol Keluar Akun -->
	<section class="pt-2">
		<a
			href="/logout"
			data-sveltekit-reload
			class="w-full py-3 px-4 rounded-xl border border-destructive/20 bg-destructive/5 hover:bg-destructive/10 text-destructive font-semibold text-xs flex items-center justify-center gap-2 transition-colors"
		>
			<LogOut class="w-4 h-4" />
			<span>Keluar dari Akun</span>
		</a>
	</section>
</div>

<!-- Modal 1: Ubah Profil (Nama & Email) -->
{#if activeModal === 'profile'}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-150"
		onclick={(e) => {
			if (e.target === e.currentTarget) closeProfileModal();
		}}
	>
		<div class="w-full max-w-sm bg-card border border-border rounded-2xl shadow-xl overflow-hidden p-6 space-y-4">
			<div class="flex items-center justify-between border-b border-border pb-3">
				<h3 class="text-sm font-bold text-foreground">Ubah Profil Akun</h3>
				<button
					type="button"
					onclick={closeProfileModal}
					class="text-foreground/50 hover:text-foreground text-sm font-semibold"
				>
					✕
				</button>
			</div>

			{#if form?.profileError}
				<div class="p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center gap-2 text-xs text-destructive">
					<AlertCircle class="w-4 h-4 shrink-0" />
					<span>{form.profileError}</span>
				</div>
			{/if}

			<form
				method="POST"
				action="?/updateProfile"
				use:enhance={() => {
					isSubmitting = true;
					return async ({ update }) => {
						isSubmitting = false;
						await update();
					};
				}}
				class="space-y-4 text-xs"
			>
				<div>
					<label for="namaLengkap" class="block font-medium text-foreground/80 mb-1.5">
						Nama Lengkap
					</label>
					<input
						id="namaLengkap"
						name="namaLengkap"
						type="text"
						required
						bind:value={inputNama}
						class="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:bg-background transition-all"
					/>
				</div>

				<div>
					<label for="email" class="block font-medium text-foreground/80 mb-1.5">
						Alamat Email
					</label>
					<input
						id="email"
						name="email"
						type="email"
						required
						bind:value={inputEmail}
						class="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:bg-background transition-all"
					/>
				</div>

				{#if isProfileDirty()}
					<div class="flex justify-end">
						<button
							type="button"
							onclick={resetProfileDraft}
							class="text-[11px] text-destructive hover:underline font-medium"
						>
							Reset ke Data Awal
						</button>
					</div>
				{/if}

				<div class="flex gap-2 pt-2">
					<button
						type="button"
						onclick={closeProfileModal}
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

<!-- Modal 2: Ganti Kata Sandi -->
{#if activeModal === 'password'}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-150"
		onclick={(e) => {
			if (e.target === e.currentTarget) closePasswordModal();
		}}
	>
		<div class="w-full max-w-sm bg-card border border-border rounded-2xl shadow-xl overflow-hidden p-6 space-y-4">
			<div class="flex items-center justify-between border-b border-border pb-3">
				<h3 class="text-sm font-bold text-foreground">Ganti Kata Sandi</h3>
				<button
					type="button"
					onclick={closePasswordModal}
					class="text-foreground/50 hover:text-foreground text-sm font-semibold"
				>
					✕
				</button>
			</div>

			{#if form?.passwordError}
				<div class="p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center gap-2 text-xs text-destructive">
					<AlertCircle class="w-4 h-4 shrink-0" />
					<span>{form.passwordError}</span>
				</div>
			{/if}

			<form
				method="POST"
				action="?/updatePassword"
				use:enhance={() => {
					isSubmitting = true;
					return async ({ update }) => {
						isSubmitting = false;
						await update();
					};
				}}
				class="space-y-4 text-xs"
			>
				<div>
					<label for="currentPassword" class="block font-medium text-foreground/80 mb-1.5">
						Kata Sandi Saat Ini
					</label>
					<input
						id="currentPassword"
						name="currentPassword"
						type="password"
						required
						bind:value={currentPassword}
						class="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:bg-background transition-all"
					/>
				</div>

				<div>
					<label for="newPassword" class="block font-medium text-foreground/80 mb-1.5">
						Kata Sandi Baru
					</label>
					<input
						id="newPassword"
						name="newPassword"
						type="password"
						required
						minlength="6"
						placeholder="Minimal 6 karakter"
						bind:value={newPassword}
						class="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:bg-background transition-all"
					/>
				</div>

				<div>
					<label for="confirmPassword" class="block font-medium text-foreground/80 mb-1.5">
						Konfirmasi Kata Sandi Baru
					</label>
					<input
						id="confirmPassword"
						name="confirmPassword"
						type="password"
						required
						minlength="6"
						bind:value={confirmPassword}
						class="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:bg-background transition-all"
					/>
				</div>

				{#if isPasswordDirty()}
					<div class="flex justify-end">
						<button
							type="button"
							onclick={resetPasswordDraft}
							class="text-[11px] text-destructive hover:underline font-medium"
						>
							Kosongkan Isian
						</button>
					</div>
				{/if}

				<div class="flex gap-2 pt-2">
					<button
						type="button"
						onclick={closePasswordModal}
						class="flex-1 py-2 rounded-lg border border-border bg-secondary/60 hover:bg-secondary text-foreground font-semibold transition-colors"
					>
						Batal
					</button>
					<button
						type="submit"
						disabled={isSubmitting}
						class="flex-1 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold transition-colors disabled:opacity-50"
					>
						{isSubmitting ? 'Memperbarui...' : 'Simpan Sandi'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- Modal Panduan Instalasi PWA (Chrome, Safari, Desktop) -->
<PwaInstallGuideModal bind:open={showPwaGuide} />
