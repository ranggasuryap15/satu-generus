<!--
  @file src/lib/components/ThemeToggle.svelte
  @purpose Komponen tombol toggle switch untuk berpindah antara Light Mode dan Dark Mode
  @usedBy Top Bar Client, Top Bar Admin, Halaman Login, atau Menu Profil
  @dependencies lucide-svelte / @lucide/svelte (Sun, Moon)
  @publicFunctions toggleTheme
  @sideEffects Mengubah class 'dark' pada documentElement dan menyimpan nilai di localStorage
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { Sun, Moon } from 'lucide-svelte';

	let isDark = $state(false);

	onMount(() => {
		isDark = document.documentElement.classList.contains('dark');
	});

	function toggleTheme() {
		isDark = !isDark;
		if (isDark) {
			document.documentElement.classList.add('dark');
			localStorage.setItem('theme', 'dark');
		} else {
			document.documentElement.classList.remove('dark');
			localStorage.setItem('theme', 'light');
		}
	}
</script>

<button
	type="button"
	onclick={toggleTheme}
	class="inline-flex items-center justify-center rounded-lg p-2 text-foreground/80 hover:bg-secondary hover:text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
	aria-label="Toggle tema gelap atau terang"
>
	{#if isDark}
		<Sun class="h-5 w-5 text-accent" />
	{:else}
		<Moon class="h-5 w-5 text-foreground/70" />
	{/if}
</button>

