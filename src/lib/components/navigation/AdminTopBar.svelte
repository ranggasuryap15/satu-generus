<!--
  @file src/lib/components/navigation/AdminTopBar.svelte
  @purpose Komponen Header Top Bar untuk tampilan admin dengan dropdown menu profil, logout, dan notifikasi persetujuan izin/sakit
  @usedBy src/routes/(admin)/+layout.svelte
  @dependencies @lucide/svelte, src/lib/components/ThemeToggle.svelte, $app/state (page)
  @publicFunctions N/A (Svelte Component)
  @sideEffects Menampilkan navigasi admin, toggle drawer mobile, popover notifikasi approval izin, dan menu dropdown profil/logout
-->
<script lang="ts">
	import {
		Search,
		Bell,
		UserCheck,
		Menu,
		User,
		LogOut,
		ChevronDown,
		CalendarClock,
		ChevronRight,
		CheckCheck,
		AlertCircle
	} from '@lucide/svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import { page } from '$app/state';

	let { onToggleSidebar = () => {} } = $props<{ onToggleSidebar?: () => void }>();

	let isDropdownOpen = $state(false);
	let isNotifOpen = $state(false);

	const user = $derived(page.data.user);
	const userName = $derived(user?.namaLengkap || 'Admin Daerah');
	const userEmail = $derived(user?.email || '');
	const userRole = $derived(page.data.isAdmin ? 'Pengurus 4S' : 'Jamaah');

	const totalPending = $derived(Number(page.data.totalPendingApprovals) || 0);
	const pendingList = $derived(
		(page.data.pendingApprovalList as Array<{
			id: string;
			jadwalId: number;
			userId: string;
			status: string;
			keteranganIzin: string | null;
			fotoUrl: string | null;
			waktuScan: number | null;
			namaJamaah: string;
			namaKegiatan: string;
			tanggalJadwal: string;
			kelompokNama: string | null;
		}>) || []
	);

	function toggleDropdown() {
		isDropdownOpen = !isDropdownOpen;
		if (isDropdownOpen) isNotifOpen = false;
	}

	function closeDropdown() {
		isDropdownOpen = false;
	}

	function toggleNotif() {
		isNotifOpen = !isNotifOpen;
		if (isNotifOpen) isDropdownOpen = false;
	}

	function closeNotif() {
		isNotifOpen = false;
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

		<!-- Dropdown Notifikasi Approval -->
		<div class="relative">
			<button
				type="button"
				onclick={toggleNotif}
				class="p-2 text-foreground/70 hover:text-foreground rounded-lg hover:bg-secondary transition-colors relative cursor-pointer"
				aria-label="Notifikasi Admin"
				aria-expanded={isNotifOpen}
			>
				<Bell class="w-4 h-4" />
				{#if totalPending > 0}
					<span
						class="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-rose-500 text-white font-bold text-[9px] flex items-center justify-center shadow-xs"
					>
						{totalPending > 99 ? '99+' : totalPending}
					</span>
				{/if}
			</button>

			{#if isNotifOpen}
				<!-- Overlay click-outside -->
				<button
					type="button"
					tabindex="-1"
					onclick={closeNotif}
					class="fixed inset-0 z-40 bg-transparent cursor-default w-full h-full border-none outline-none"
					aria-label="Tutup notifikasi"
				></button>

				<!-- Popover Menu Notifikasi -->
				<div
					class="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-2xl bg-card border border-border shadow-2xl z-50 overflow-hidden divide-y divide-border animate-in fade-in zoom-in-95 duration-100"
				>
					<div class="px-4 py-3 bg-secondary/30 flex items-center justify-between">
						<div class="flex items-center gap-2">
							<span class="text-xs font-bold text-foreground">Notifikasi Permohonan</span>
							{#if totalPending > 0}
								<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400">
									{totalPending} Menunggu
								</span>
							{/if}
						</div>
						<span class="text-[10px] text-foreground/50">Presensi Jamaah</span>
					</div>

					<div class="max-h-80 overflow-y-auto divide-y divide-border/60">
						{#if pendingList.length === 0}
							<div class="py-8 px-4 text-center space-y-2">
								<div class="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-600 mx-auto flex items-center justify-center">
									<CheckCheck class="w-5 h-5" />
								</div>
								<p class="text-xs font-semibold text-foreground">Semua Beres!</p>
								<p class="text-[11px] text-foreground/60 max-w-xs mx-auto">
									Tidak ada permohonan izin atau sakit yang membutuhkan persetujuan saat ini.
								</p>
							</div>
						{:else}
							{#each pendingList as item}
								<a
									href="/admin/presensi/{item.jadwalId}?review=1"
									onclick={closeNotif}
									class="p-3.5 flex items-start gap-3 hover:bg-secondary/40 transition-colors group block text-left"
								>
									<div class="w-8 h-8 rounded-full shrink-0 flex items-center justify-center mt-0.5 {item.status === 'Sakit' ? 'bg-rose-500/10 text-rose-600' : 'bg-amber-500/10 text-amber-600'}">
										<AlertCircle class="w-4 h-4" />
									</div>

									<div class="flex-1 min-w-0 space-y-1">
										<div class="flex items-center justify-between gap-1">
											<span class="text-xs font-bold text-foreground group-hover:text-primary transition-colors truncate">
												{item.namaJamaah}
											</span>
											<span class="text-[10px] px-1.5 py-0.2 rounded font-semibold shrink-0 {item.status === 'Sakit' ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300' : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'}">
												{item.status}
											</span>
										</div>

										<p class="text-[11px] text-foreground/70 truncate">
											{item.namaKegiatan} &bull; <span class="text-foreground/50">{item.kelompokNama || 'Kelompok'}</span>
										</p>

										{#if item.keteranganIzin}
											<p class="text-[10.5px] italic text-foreground/60 line-clamp-1 bg-secondary/50 px-2 py-0.5 rounded">
												"{item.keteranganIzin}"
											</p>
										{/if}

										<div class="flex items-center justify-between pt-0.5 text-[10px] text-foreground/45">
											<span>Jadwal: {item.tanggalJadwal}</span>
											<span class="inline-flex items-center gap-0.5 text-primary font-semibold group-hover:underline">
												Tinjau <ChevronRight class="w-3 h-3" />
											</span>
										</div>
									</div>
								</a>
							{/each}
						{/if}
					</div>

					<div class="p-2 bg-secondary/20 text-center">
						<a
							href="/admin/presensi"
							onclick={closeNotif}
							class="text-[11px] font-semibold text-primary hover:underline block py-1"
						>
							Buka Semua Jadwal Presensi
						</a>
					</div>
				</div>
			{/if}
		</div>

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

