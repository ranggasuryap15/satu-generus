/**
 * @file src/lib/pwa.svelte.ts
 * @purpose State management dan logika PWA (Progressive Web App): registrasi Service Worker, penanganan event beforeinstallprompt, deteksi platform OS, dan trigger instalasi native
 * @usedBy src/routes/+layout.svelte, src/routes/(app)/profil/+page.svelte
 * @dependencies Svelte 5 Runes ($state), navigator.serviceWorker, window.matchMedia
 * @publicFunctions pwaState.init, pwaState.install, pwaState.detectPlatform
 * @sideEffects Mendaftarkan service worker ke browser, mendengarkan event window beforeinstallprompt & appinstalled
 */

class PwaState {
	deferredPrompt = $state<any>(null);
	isInstallable = $state(false);
	isInstalled = $state(false);
	platform = $state<'ios' | 'android' | 'desktop' | 'other'>('other');

	init() {
		if (typeof window === 'undefined') return;

		// 1. Deteksi apakah sudah terpasang sebagai aplikasi (standalone mode)
		const isStandalone =
			window.matchMedia('(display-mode: standalone)').matches ||
			(window.navigator as any).standalone === true ||
			document.referrer.includes('android-app://');
		this.isInstalled = isStandalone;

		// 2. Deteksi Platform / OS pengguna
		this.detectPlatform();

		// 3. Daftarkan Service Worker
		if ('serviceWorker' in navigator) {
			navigator.serviceWorker
				.register('/service-worker.js')
				.then((reg) => {
					// Pengecekan update berkala
					reg.onupdatefound = () => {
						const installingWorker = reg.installing;
						if (installingWorker) {
							installingWorker.onstatechange = () => {
								if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
									console.log('Versi baru Satu Generus tersedia.');
								}
							};
						}
					};
				})
				.catch((err) => {
					console.warn('Gagal registrasi Service Worker:', err);
				});
		}

		// 4. Tangkap event beforeinstallprompt (didukung Chromium: Chrome, Edge, Samsung Internet)
		window.addEventListener('beforeinstallprompt', (e: Event) => {
			e.preventDefault();
			this.deferredPrompt = e;
			this.isInstallable = true;
		});

		// 5. Tangkap saat aplikasi berhasil diinstall
		window.addEventListener('appinstalled', () => {
			this.deferredPrompt = null;
			this.isInstallable = false;
			this.isInstalled = true;
		});

		// 6. Listener perubahan display-mode jika pengguna membuka dari shortcut
		window.matchMedia('(display-mode: standalone)').addEventListener('change', (e) => {
			this.isInstalled = e.matches;
		});
	}

	detectPlatform() {
		if (typeof window === 'undefined') return;
		const ua = window.navigator.userAgent.toLowerCase();

		if (/iphone|ipad|ipod/.test(ua)) {
			this.platform = 'ios';
		} else if (/android/.test(ua)) {
			this.platform = 'android';
		} else if (/macintosh|windows|linux/.test(ua) && !/mobile/.test(ua)) {
			this.platform = 'desktop';
		} else {
			this.platform = 'other';
		}
	}

	async install(): Promise<boolean> {
		if (!this.deferredPrompt) {
			return false;
		}

		try {
			await this.deferredPrompt.prompt();
			const choiceResult = await this.deferredPrompt.userChoice;
			if (choiceResult.outcome === 'accepted') {
				this.isInstalled = true;
				this.isInstallable = false;
				this.deferredPrompt = null;
				return true;
			}
		} catch (err) {
			console.error('Error saat memicu prompt instalasi:', err);
		}
		return false;
	}
}

export const pwaState = new PwaState();

