<!--
  @file src/routes/+layout.svelte
  @purpose Root layout aplikasi Satu Generus, memuat stylesheet global, metadata favicon & PWA, serta host modal konfirmasi global
  @usedBy SvelteKit runtime untuk seluruh routes
  @dependencies ./layout.css, #lib/assets/favicon.svg, #lib/pwa.svelte, #lib/components/ConfirmModalHost.svelte
  @publicFunctions N/A (Svelte Component)
  @sideEffects Menginjeksikan global CSS ke halaman, mendaftarkan service worker PWA, dan merender host modal konfirmasi
-->
<script lang="ts">
	import './layout.css';
	import { onMount } from 'svelte';
	import { pwaState } from '#lib/pwa.svelte.ts';
	import ConfirmModalHost from '#lib/components/ConfirmModalHost.svelte';

	let { children } = $props();

	onMount(() => {
		pwaState.init();
	});
</script>

<svelte:head>
	<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
	<title>Satu Generus</title>
</svelte:head>

{@render children()}

<ConfirmModalHost />

