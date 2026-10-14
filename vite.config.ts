/**
 * @file vite.config.ts
 * @purpose Konfigurasi build Vite, Tailwind CSS v4, SvelteKit Node adapter, dan pengaturan CORS/CSRF
 * @usedBy Vite dev server, build pipeline (npm run dev, npm run build)
 * @dependencies @tailwindcss/vite, @sveltejs/adapter-node, @sveltejs/kit/vite, vite
 * @publicFunctions defineConfig
 * @sideEffects Mengatur plugin bundling, menonaktifkan origin mismatch CSRF untuk remote server, mengizinkan akses host eksternal
 *
 * Catatan: alias `$lib` TIDAK didefinisikan manual di sini karena SvelteKit sudah
 * menyediakannya secara bawaan. Mendefinisikannya ulang memicu peringatan
 * `config_option_deprecated_alias`.
 */

import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			adapter: adapter(),
			csrf: {
				trustedOrigins: ['*']
			}
		})
	],
	server: {
		host: '0.0.0.0',
		port: 5173,
		allowedHosts: true,
		cors: {
			preflightContinue: true
		},
		// Bind mount Docker di Linux tidak meneruskan event inotify, sehingga
		// HMR tidak mendeteksi perubahan file. Polling dipakai bila
		// CHOKIDAR_USEPOLLING=true (di-set pada service app di docker-compose.yml).
		watch:
			process.env.CHOKIDAR_USEPOLLING === 'true'
				? { usePolling: true, interval: Number(process.env.CHOKIDAR_INTERVAL ?? 300) }
				: undefined
	},
	preview: {
		host: '0.0.0.0',
		port: 5173,
		allowedHosts: true,
		cors: {
			preflightContinue: true
		}
	}
});
