<!--
  @file src/routes/+layout.svelte
  @purpose Root layout aplikasi Satu Generus, memuat stylesheet global, metadata favicon & PWA, serta menginisialisasi service worker & prompt PWA
  @usedBy SvelteKit runtime untuk seluruh routes
  @dependencies ./layout.css, $lib/assets/favicon.svg, $lib/pwa.svelte
  @publicFunctions N/A (Svelte Component)
  @sideEffects Menginjeksikan global CSS ke halaman dan mendaftarkan service worker PWA
-->
<script lang="ts">
	import './layout.css';
	import { onMount } from 'svelte';
	import favicon from '$lib/assets/favicon.svg';
	import { pwaState } from '$lib/pwa.svelte';

	let { children } = $props();

	onMount(() => {
		pwaState.init();
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Satu Generus</title>
</svelte:head>

{@render children()}
