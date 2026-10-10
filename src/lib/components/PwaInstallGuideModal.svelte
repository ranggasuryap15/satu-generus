<!--
  @file src/lib/components/PwaInstallGuideModal.svelte
  @purpose Modal panduan instalasi web app Satu Generus (PWA) langkah demi langkah untuk Google Chrome (Android/Desktop) dan Safari (iPhone/iPad iOS)
  @usedBy src/routes/(app)/profil/+page.svelte
  @dependencies @lucide/svelte, $lib/pwa.svelte, Svelte 5 Runes ($state, $props)
  @publicFunctions handleDirectInstall, selectTab
  @sideEffects Memicu prompt instalasi PWA native peramban
-->
<script lang="ts">
	import {
		AppWindow,
		CheckCircle2,
		ChevronRight,
		Download,
		Laptop,
		Share2,
		Smartphone,
		Sparkles,
		X
	} from '@lucide/svelte';
	import { pwaState } from '$lib/pwa.svelte';

	let { open = $bindable(false) } = $props<{ open: boolean }>();

	type GuideTab = 'android' | 'ios' | 'desktop';

	// Default tab berdasarkan deteksi otomatis perangkat pengguna
	let activeTab = $state<GuideTab>(
		pwaState.platform === 'ios'
			? 'ios'
			: pwaState.platform === 'desktop'
				? 'desktop'
				: 'android'
	);

	let isInstalling = $state(false);
	let installSuccess = $state(false);

	async function handleDirectInstall() {
		isInstalling = true;
		const success = await pwaState.install();
		isInstalling = false;
		if (success) {
			installSuccess = true;
			setTimeout(() => {
				open = false;
				installSuccess = false;
			}, 2000);
		}
	}
</script>

{#if open}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-150"
		role="dialog"
		aria-modal="true"
		tabindex="-1"
		onclick={(e) => {
			if (e.target === e.currentTarget) open = false;
		}}
		onkeydown={(e) => {
			if (e.key === 'Escape') open = false;
		}}
	>
		<div
			class="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-xs"
		>
			<!-- Header Modal -->
			<div class="p-4 sm:p-5 border-b border-border flex items-center justify-between bg-secondary/30">
				<div class="flex items-center gap-2.5">
					<div class="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
						<Download class="w-5 h-5" />
					</div>
					<div>
						<h3 class="text-sm font-bold text-foreground">Pasang Satu Generus</h3>
						<p class="text-[11px] text-foreground/60">Panduan instalasi aplikasi di perangkat Anda</p>
					</div>
				</div>
				<button
					type="button"
					onclick={() => (open = false)}
					class="p-1.5 rounded-lg text-foreground/50 hover:text-foreground hover:bg-secondary cursor-pointer transition-colors"
					aria-label="Tutup panduan"
				>
					<X class="w-4 h-4" />
				</button>
			</div>

			<!-- Quick Action Button jika browser mendukung native prompt -->
			{#if pwaState.isInstallable}
				<div class="p-4 bg-primary/5 border-b border-primary/20 flex items-center justify-between gap-3">
					<div class="space-y-0.5 min-w-0">
						<p class="font-bold text-foreground text-xs flex items-center gap-1.5 text-primary">
							<Sparkles class="w-3.5 h-3.5" />
							<span>Dukungan Instalasi Langsung</span>
						</p>
						<p class="text-[11px] text-foreground/60 leading-tight">
							Browser Anda mendukung pemasangan otomatis dalam 1 klik.
						</p>
					</div>
					<button
						type="button"
						onclick={handleDirectInstall}
						disabled={isInstalling || installSuccess}
						class="px-3.5 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs shrink-0 flex items-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50"
					>
						{#if installSuccess}
							<CheckCircle2 class="w-3.5 h-3.5" />
							<span>Terpasang!</span>
						{:else}
							<Download class="w-3.5 h-3.5" />
							<span>{isInstalling ? 'Memasang...' : 'Pasang Sekarang'}</span>
						{/if}
					</button>
				</div>
			{/if}

			<!-- Tab Bar Perangkat -->
			<div class="px-4 pt-3 pb-1 border-b border-border bg-card">
				<div class="grid grid-cols-3 gap-1.5 p-1 bg-secondary/50 rounded-xl">
					<button
						type="button"
						onclick={() => (activeTab = 'android')}
						class="py-1.5 px-2 rounded-lg font-semibold text-[11px] transition-all flex items-center justify-center gap-1 cursor-pointer {activeTab ===
						'android'
							? 'bg-card text-foreground shadow-xs'
							: 'text-foreground/60 hover:text-foreground'}"
					>
						<Smartphone class="w-3.5 h-3.5" />
						<span>Android</span>
					</button>

					<button
						type="button"
						onclick={() => (activeTab = 'ios')}
						class="py-1.5 px-2 rounded-lg font-semibold text-[11px] transition-all flex items-center justify-center gap-1 cursor-pointer {activeTab ===
						'ios'
							? 'bg-card text-foreground shadow-xs'
							: 'text-foreground/60 hover:text-foreground'}"
					>
						<Share2 class="w-3.5 h-3.5" />
						<span>iPhone/iPad</span>
					</button>

					<button
						type="button"
						onclick={() => (activeTab = 'desktop')}
						class="py-1.5 px-2 rounded-lg font-semibold text-[11px] transition-all flex items-center justify-center gap-1 cursor-pointer {activeTab ===
						'desktop'
							? 'bg-card text-foreground shadow-xs'
							: 'text-foreground/60 hover:text-foreground'}"
					>
						<Laptop class="w-3.5 h-3.5" />
						<span>Komputer</span>
					</button>
				</div>
			</div>

			<!-- Isi Panduan Langkah demi Langkah (Scrollable) -->
			<div class="p-4 sm:p-5 overflow-y-auto space-y-4">
				{#if activeTab === 'android'}
					<!-- PANDUAN ANDROID (CHROME) -->
					<div class="space-y-3">
						<div class="flex items-center gap-2 text-foreground font-semibold">
							<span class="w-2 h-2 rounded-full bg-emerald-500"></span>
							<span>Google Chrome di HP Android:</span>
						</div>

						<ol class="space-y-2.5">
							<li class="p-3 rounded-xl bg-secondary/30 border border-border flex items-start gap-3">
								<span class="w-5 h-5 rounded-full bg-primary/10 text-primary font-bold text-[10.5px] flex items-center justify-center shrink-0 mt-0.5">
									1
								</span>
								<div class="space-y-0.5">
									<p class="font-semibold text-foreground">Buka Menu Peramban Chrome</p>
									<p class="text-[11px] text-foreground/60 leading-relaxed">
										Tekan ikon titik tiga vertikal (<strong>⋮</strong>) di pojok kanan atas layar peramban.
									</p>
								</div>
							</li>

							<li class="p-3 rounded-xl bg-secondary/30 border border-border flex items-start gap-3">
								<span class="w-5 h-5 rounded-full bg-primary/10 text-primary font-bold text-[10.5px] flex items-center justify-center shrink-0 mt-0.5">
									2
								</span>
								<div class="space-y-0.5">
									<p class="font-semibold text-foreground">Pilih "Tambahkan ke Layar Utama"</p>
									<p class="text-[11px] text-foreground/60 leading-relaxed">
										Cari dan pilih menu <strong>"Tambahkan ke Layar Utama"</strong> atau <strong>"Pasang Aplikasi" / "Install App"</strong>.
									</p>
								</div>
							</li>

							<li class="p-3 rounded-xl bg-secondary/30 border border-border flex items-start gap-3">
								<span class="w-5 h-5 rounded-full bg-primary/10 text-primary font-bold text-[10.5px] flex items-center justify-center shrink-0 mt-0.5">
									3
								</span>
								<div class="space-y-0.5">
									<p class="font-semibold text-foreground">Konfirmasi Pemasangan</p>
									<p class="text-[11px] text-foreground/60 leading-relaxed">
										Tekan tombol <strong>"Pasang"</strong> atau <strong>"Install"</strong>. Ikon Satu Generus akan langsung muncul di beranda ponsel Anda dan dapat dibuka tanpa bilah URL browser.
									</p>
								</div>
							</li>
						</ol>
					</div>
				{:else if activeTab === 'ios'}
					<!-- PANDUAN IPHONE & IPAD (SAFARI) -->
					<div class="space-y-3">
						<div class="flex items-center gap-2 text-foreground font-semibold">
							<span class="w-2 h-2 rounded-full bg-blue-500"></span>
							<span>Safari di iPhone / iPad (iOS):</span>
						</div>

						<ol class="space-y-2.5">
							<li class="p-3 rounded-xl bg-secondary/30 border border-border flex items-start gap-3">
								<span class="w-5 h-5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold text-[10.5px] flex items-center justify-center shrink-0 mt-0.5">
									1
								</span>
								<div class="space-y-0.5">
									<p class="font-semibold text-foreground">Gunakan Peramban Safari</p>
									<p class="text-[11px] text-foreground/60 leading-relaxed">
										Pastikan Anda membuka website ini menggunakan peramban <strong>Safari</strong> (bukan di dalam browser in-app WhatsApp / Instagram).
									</p>
								</div>
							</li>

							<li class="p-3 rounded-xl bg-secondary/30 border border-border flex items-start gap-3">
								<span class="w-5 h-5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold text-[10.5px] flex items-center justify-center shrink-0 mt-0.5">
									2
								</span>
								<div class="space-y-0.5">
									<p class="font-semibold text-foreground">Tekan Tombol "Share" (Bagikan)</p>
									<p class="text-[11px] text-foreground/60 leading-relaxed">
										Ketuk ikon <strong>Bagikan / Share</strong> di bilah bawah layar (ikon kotak persegi dengan panah mengarah ke atas <span class="inline-block px-1 bg-secondary rounded border font-mono">⎋ / ↥</span>).
									</p>
								</div>
							</li>

							<li class="p-3 rounded-xl bg-secondary/30 border border-border flex items-start gap-3">
								<span class="w-5 h-5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold text-[10.5px] flex items-center justify-center shrink-0 mt-0.5">
									3
								</span>
								<div class="space-y-0.5">
									<p class="font-semibold text-foreground">Pilih "Add to Home Screen"</p>
									<p class="text-[11px] text-foreground/60 leading-relaxed">
										Gulir ke bawah pada menu pop-up lalu ketuk <strong>"Tambah ke Layar Utama"</strong> (<strong>Add to Home Screen</strong> dengan ikon kotak tanda tambah <strong>[+]</strong>).
									</p>
								</div>
							</li>

							<li class="p-3 rounded-xl bg-secondary/30 border border-border flex items-start gap-3">
								<span class="w-5 h-5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold text-[10.5px] flex items-center justify-center shrink-0 mt-0.5">
									4
								</span>
								<div class="space-y-0.5">
									<p class="font-semibold text-foreground">Tekan "Tambah / Add"</p>
									<p class="text-[11px] text-foreground/60 leading-relaxed">
										Ketuk tombol <strong>Tambah (Add)</strong> di pojok kanan atas. Satu Generus akan terpasang di Home Screen iPhone Anda seperti aplikasi App Store.
									</p>
								</div>
							</li>
						</ol>
					</div>
				{:else}
					<!-- PANDUAN DESKTOP / LAPTOP (CHROME & EDGE) -->
					<div class="space-y-3">
						<div class="flex items-center gap-2 text-foreground font-semibold">
							<span class="w-2 h-2 rounded-full bg-purple-500"></span>
							<span>Komputer / Laptop (Chrome & Edge):</span>
						</div>

						<ol class="space-y-2.5">
							<li class="p-3 rounded-xl bg-secondary/30 border border-border flex items-start gap-3">
								<span class="w-5 h-5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold text-[10.5px] flex items-center justify-center shrink-0 mt-0.5">
									1
								</span>
								<div class="space-y-0.5">
									<p class="font-semibold text-foreground">Klik Ikon Pasang di Kolom URL</p>
									<p class="text-[11px] text-foreground/60 leading-relaxed">
										Di bilah alamat (URL bar) sebelah kanan, cari ikon monitor kecil dengan tanda panah ke bawah (<strong>Install Satu Generus</strong>).
									</p>
								</div>
							</li>

							<li class="p-3 rounded-xl bg-secondary/30 border border-border flex items-start gap-3">
								<span class="w-5 h-5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold text-[10.5px] flex items-center justify-center shrink-0 mt-0.5">
									2
								</span>
								<div class="space-y-0.5">
									<p class="font-semibold text-foreground">Atau Lewat Menu Titik Tiga</p>
									<p class="text-[11px] text-foreground/60 leading-relaxed">
										Klik menu titik tiga (<strong>⋮</strong>) di pojok kanan atas peramban -> pilih menu <strong>"Simpan dan Bagikan" / "Pasang Satu Generus"</strong>.
									</p>
								</div>
							</li>

							<li class="p-3 rounded-xl bg-secondary/30 border border-border flex items-start gap-3">
								<span class="w-5 h-5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold text-[10.5px] flex items-center justify-center shrink-0 mt-0.5">
									3
								</span>
								<div class="space-y-0.5">
									<p class="font-semibold text-foreground">Klik "Install"</p>
									<p class="text-[11px] text-foreground/60 leading-relaxed">
										Aplikasi akan terbuka di jendela tersendiri tanpa bilah browser dan ikon shortcut otomatis ditambahkan ke Desktop & Taskbar.
									</p>
								</div>
							</li>
						</ol>
					</div>
				{/if}

				<!-- Keuntungan Memasang Web App -->
				<div class="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 space-y-1">
					<p class="font-bold text-[11px] flex items-center gap-1.5">
						<CheckCircle2 class="w-3.5 h-3.5 text-emerald-600" />
						<span>Keuntungan Memasang Aplikasi:</span>
					</p>
					<ul class="text-[10.5px] space-y-0.5 pl-5 list-disc leading-relaxed text-emerald-700 dark:text-emerald-300/90">
						<li>Akses cepat 1-klik langsung dari Layar Utama HP / Desktop.</li>
						<li>Tampilan layar penuh (*fullscreen standalone*) tanpa terganggu bilah peramban.</li>
						<li>Lebih ringan, hemat memori, dan loading lebih cepat dengan sistem caching lokal.</li>
					</ul>
				</div>
			</div>

			<!-- Footer Modal -->
			<div class="p-3 sm:p-4 border-t border-border bg-secondary/20 flex items-center justify-end">
				<button
					type="button"
					onclick={() => (open = false)}
					class="px-4 py-2 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground font-semibold text-xs transition-colors cursor-pointer"
				>
					Mengerti & Tutup
				</button>
			</div>
		</div>
	</div>
{/if}

