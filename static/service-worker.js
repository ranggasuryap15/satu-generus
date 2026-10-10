/**
 * @file static/service-worker.js
 * @purpose Service worker PWA untuk Satu Generus: caching aset statis inti dan navigasi offline agar web app dapat diinstall di Chrome, Safari, dan OS native
 * @usedBy Browser client via navigator.serviceWorker.register('/service-worker.js')
 * @dependencies CacheStorage API, Fetch API
 * @publicFunctions N/A (Event-driven service worker)
 * @sideEffects Caching aset aplikasi ke CacheStorage dan mengintercept fetch network
 */

const CACHE_NAME = 'satu-generus-v1';

const STATIC_ASSETS = [
	'/',
	'/manifest.webmanifest',
	'/favicon.png',
	'/icons/icon-192.png',
	'/icons/icon-512.png',
	'/icons/apple-touch-icon.png',
	'/icons/icon.svg'
];

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(CACHE_NAME)
			.then((cache) => cache.addAll(STATIC_ASSETS))
			.then(() => self.skipWaiting())
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys().then((keys) => {
			return Promise.all(
				keys.map((key) => {
					if (key !== CACHE_NAME) {
						return caches.delete(key);
					}
				})
			);
		}).then(() => self.clients.claim())
	);
});

self.addEventListener('fetch', (event) => {
	const url = new URL(event.request.url);

	// Jangan intercept requests non-GET atau request API dinamis / server actions
	if (event.request.method !== 'GET') return;
	if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/data/')) return;

	// Untuk aset statis gambar & manifest: Cache-First
	if (
		url.pathname.startsWith('/icons/') ||
		url.pathname === '/favicon.png' ||
		url.pathname === '/manifest.webmanifest'
	) {
		event.respondWith(
			caches.match(event.request).then((cached) => {
				if (cached) return cached;
				return fetch(event.request).then((res) => {
					if (res && res.status === 200) {
						const clone = res.clone();
						caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
					}
					return res;
				});
			})
		);
		return;
	}

	// Untuk navigasi halaman (HTML): Network-First dengan fallback Cache
	if (event.request.mode === 'navigate') {
		event.respondWith(
			fetch(event.request).catch(async () => {
				const cached = await caches.match(event.request);
				if (cached) return cached;
				return caches.match('/');
			})
		);
	}
});

