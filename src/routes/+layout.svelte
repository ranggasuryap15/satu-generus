<!--
  @file src/routes/+layout.svelte
  @purpose Root layout aplikasi Satu Generus, memuat stylesheet global dan metadata favicon
  @usedBy SvelteKit runtime untuk seluruh routes
  @dependencies ./layout.css, $lib/assets/favicon.svg
  @publicFunctions N/A (Svelte Component)
  @sideEffects Menginjeksikan global CSS ke halaman
-->
<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Satu Generus</title>
</svelte:head>

{@render children()}
