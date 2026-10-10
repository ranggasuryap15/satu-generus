<!--
  @file src/lib/components/navigation/AdminTopBar.svelte
  @purpose Komponen Header Top Bar untuk tampilan admin dengan dropdown menu profil & logout
  @usedBy src/routes/(admin)/+layout.svelte
  @dependencies @lucide/svelte (Search, Bell, UserCheck, Menu, User, LogOut, ChevronDown), src/lib/components/ThemeToggle.svelte, $app/state (page)
  @publicFunctions N/A (Svelte Component)
  @sideEffects Menampilkan navigasi admin, toggle sidebar mobile, dan menu dropdown aksi profil/logout
-->
<script lang="ts">
	import { Search, Bell, UserCheck, Menu, User, LogOut, ChevronDown } from '@lucide/svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import { page } from '$app/state';

	let { onToggleSidebar = () => {} } = $props<{ onToggleSidebar?: () => void }>();

	let isDropdownOpen = $state(false);

	const user = $derived(page.data.user);
	const userName = $derived(user?.namaLengkap || 'Admin Daerah');
	const userEmail = $derived(user?.email || '');
	const userRole = $derived(page.data.isAdmin ? 'Pengurus 4S' : 'Jamaah');

	function toggleDropdown() {
		isDropdownOpen = !isDropdownOpen;
	}

	function closeDropdown() {
		isDropdownOpen = false;
	}
</script>

<header class="h-16 border-b border-border bg-card px-4 md:px-6 flex items-center justify-between transition-colors relative z-30">
	<div class="flex items-center gap-3">
		<!-- Tombol Hamburger Menu (Hanya muncul di mobile < 768px) -->
		<button
			type="button"
			onclick={onToggleSidebar}
			class="p-2 text-foreground/70 hover:text-foreground rounded-lg hover:bg-secondary md:hidden transition-colors"
			aria-label="Buka Menu Navigasi Sidebar"
		>
			<Menu class="w-5 h-5" />
		</button>

		<div class="relative w-full max-w-xs md:w-96 hidden sm:block">
			<Search class="w-4 h-4 text-foreground/40 absolute left-3 top-1/2 -translate-y-1/2" />
			<input
				type="search"
				placeholder="Cari jamaah, KK, kelompok, kegiatan..."
				class="w-full bg-secondary/60 border border-border rounded-lg pl-9 pr-3 py-1.5 text-xs text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary focus:bg-background transition-all"
			/>
		</div>
	</div>

	<div class="flex items-center gap-2 sm:gap-3">
		<ThemeToggle />

		<button
			type="button"
			class="p-2 text-foreground/70 hover:text-foreground rounded-lg hover:bg-secondary transition-colors relative"
			aria-label="Notifikasi Admin"
		>
			<Bell class="w-4 h-4" />
			<span class="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-accent"></span>
		</button>

		<div class="h-6 w-px bg-border"></div>

		<!-- Container Menu Profil Pengguna -->
		<div class="relative">
			<button
				type="button"
				onclick={toggleDropdown}
				class="flex items-center gap-2 pl-1.5 pr-2 py-1 rounded-xl hover:bg-secondary/70 transition-colors border border-transparent hover:border-border cursor-pointer text-left"
				aria-expanded={isDropdownOpen}
				aria-haspopup="true"
				aria-label="Menu Pengguna"
			>
				<div class="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-medium text-xs">
					<UserCheck class="w-4 h-4" />
				</div>
				<div class="hidden sm:block">
					<p class="text-xs font-semibold text-foreground leading-tight">{userName}</p>
					<p class="text-[10px] text-foreground/60 leading-tight">{userRole}</p>
				</div>
				<ChevronDown class="w-3.5 h-3.5 text-foreground/50 transition-transform {isDropdownOpen ? 'rotate-180' : ''}" />
			</button>

			{#if isDropdownOpen}
				<!-- Overlay click-outside -->
				<button
					type="button"
					tabindex="-1"
					onclick={closeDropdown}
					class="fixed inset-0 z-40 bg-transparent cursor-default w-full h-full border-none outline-none"
					aria-label="Tutup menu pengguna"
				></button>

				<!-- Dropdown Menu Card -->
				<div
					class="absolute right-0 top-full mt-2 w-56 rounded-2xl bg-card border border-border shadow-xl z-50 py-2 divide-y divide-border animate-in fade-in zoom-in-95 duration-100"
				>
					<div class="px-4 py-2.5">
						<p class="text-xs font-bold text-foreground truncate">{userName}</p>
						{#if userEmail}
							<p class="text-[11px] text-foreground/60 truncate">{userEmail}</p>
						{/if}
						<span class="inline-block mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary">
							{userRole}
						</span>
					</div>

					<div class="py-1">
						<a
							href="/profil"
							onclick={closeDropdown}
							class="flex items-center gap-2.5 px-4 py-2 text-xs text-foreground/80 hover:text-foreground hover:bg-secondary transition-colors"
						>
							<User class="w-4 h-4 text-primary" />
							<span>Lihat Profil & Akun</span>
						</a>
					</div>

					<div class="py-1">
						<a
							href="/logout"
							data-sveltekit-reload
							onclick={closeDropdown}
							class="flex items-center gap-2.5 px-4 py-2 text-xs text-destructive hover:bg-destructive/10 transition-colors font-medium"
						>
							<LogOut class="w-4 h-4" />
							<span>Keluar dari Akun</span>
						</a>
					</div>
				</div>
			{/if}
		</div>
	</div>
</header>

