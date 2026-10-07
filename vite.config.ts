/**
 * @file vite.config.ts
 * @purpose Konfigurasi build Vite, Tailwind CSS v4 Vite plugin, dan adapter SvelteKit
 * @usedBy Vite dev server, build pipeline (npm run dev, npm run build)
 * @dependencies @tailwindcss/vite, @sveltejs/adapter-auto, @sveltejs/kit/vite, vite
 * @publicFunctions defineConfig
 * @sideEffects Mengatur plugin bundling, alias path ($lib), dan adapter target deploy
 */

import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-auto';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			alias: {
				$lib: './src/lib'
			},
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter()
		})
	]
});
