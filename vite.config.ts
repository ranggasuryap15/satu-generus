/**
 * @file vite.config.ts
 * @purpose Konfigurasi build Vite, Tailwind CSS v4 Vite plugin, dan adapter SvelteKit
 * @usedBy Vite dev server, build pipeline (npm run dev, npm run build)
 * @dependencies @tailwindcss/vite, @sveltejs/adapter-auto, @sveltejs/kit/vite, vite
 * @publicFunctions defineConfig
 * @sideEffects Mengatur plugin bundling untuk Tailwind v4 dan SvelteKit adapter
 */

import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-auto';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			adapter: adapter(),
			alias: {
				$lib: './src/lib'
			}
		})
	]
});
