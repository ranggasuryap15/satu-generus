<!--
  @file src/lib/components/AppFooter.svelte
  @purpose Komponen Footer global aplikasi yang menampilkan identitas pembuat (Created by Generus Koding © 2026)
  @usedBy Layout client src/routes/(app)/+layout.svelte, layout admin src/routes/(admin)/+layout.svelte, dan halaman login
  @dependencies Svelte 5 Runes
  @publicFunctions N/A (Svelte Component)
  @sideEffects Menampilkan teks footer pembuat aplikasi
-->
<script lang="ts">
	let { class: className = '' } = $props<{ class?: string }>();
</script>

<footer class="pt-6 pb-2 text-center select-none {className}">
	<p class="text-[11px] text-foreground/40 font-medium tracking-wide">
		&bull; Created by Generus Koding &copy; 2026
	</p>
</footer>

