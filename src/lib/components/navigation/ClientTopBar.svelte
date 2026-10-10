<!--
  @file src/lib/components/navigation/ClientTopBar.svelte
  @purpose Komponen Top Bar mobile-first dengan popover/modal notifikasi interaktif (jadwal pengajian & presensi) dan navigasi admin
  @usedBy src/routes/(app)/+layout.svelte
  @dependencies @lucide/svelte, src/lib/components/ThemeToggle.svelte, $app/state (page)
  @publicFunctions toggleNotif, closeNotif
  @sideEffects Menampilkan modal drawer notifikasi interaktif jamaah, overlay backdrop, dan shortcut menuju /presensi
-->
<script lang="ts">
	import {
		Search,
		Bell,
		ShieldCheck,
		X,
		CalendarClock,
		AlertTriangle,
		CheckCircle2,
		Clock,
		ChevronRight,
		BellOff
	} from '@lucide/svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import { page } from '$app/state';

	let { title = 'Satu Generus' } = $props<{ title?: string }>();

	let isNotifOpen = $state(false);

	const isAdmin = $derived(page.data.isAdmin);

	// Data notifikasi dari layout server
	interface NotifItem {
		id: string;
		kategori: 'jadwal' | 'presensi' | 'info';
		judul: string;
		pesan: string;
		waktu: string;
		statusBadge: string;
		badgeVariant: 'primary' | 'warning' | 'emerald' | 'amber' | 'rose';
		link: string;
		isImportant: boolean;
		tanggalRaw?: string;
	}

	const notifikasiList = $derived((page.data.notifikasiList as NotifItem[]) || []);
	const unreadCount = $derived(Number(page.data.unreadNotifCount) || 0);

	function toggleNotif() {
		isNotifOpen = !isNotifOpen;
	}

	function closeNotif() {
		isNotifOpen = false;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && isNotifOpen) {
			closeNotif();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<header
	class="sticky top-0 z-30 w-full bg-card/90 backdrop-blur-md border-b border-border transition-colors"
>
	<div class="max-w-md mx-auto px-4 h-14 flex items-center justify-between">
		<div class="flex items-center gap-2">
			<div
				class="w-8 h-8 rounded-lg bg-primary text-primary-foreground font-semibold flex items-center justify-center text-sm shadow-sm"
			>
				SG
			</div>
			<h1 class="text-base font-semibold text-foreground tracking-tight line-clamp-1">{title}</h1>
		</div>

		<div class="flex items-center gap-1.5">
			{#if isAdmin}
				<a
					href="/admin"
					class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 text-xs font-semibold transition-colors"
					title="Kembali ke Panel Admin"
				>
					<ShieldCheck class="w-3.5 h-3.5" />
					<span class="text-[11px]">Admin</span>
				</a>
			{/if}

			<button
				type="button"
				class="p-2 text-foreground/70 hover:text-foreground rounded-lg hover:bg-secondary transition-colors"
				aria-label="Pencarian"
			>
				<Search class="w-5 h-5" />
			</button>

			<!-- Tombol Lonceng Notifikasi Mobile -->
			<button
				type="button"
				onclick={toggleNotif}
				class="p-2 text-foreground/70 hover:text-foreground rounded-lg hover:bg-secondary transition-colors relative cursor-pointer active:scale-95"
				aria-label="Buka Notifikasi Pengajian"
				aria-expanded={isNotifOpen}
				aria-haspopup="dialog"
			>
				<Bell class="w-5 h-5" />
				{#if unreadCount > 0}
					<span
						class="absolute top-1 right-1 min-w-4 h-4 px-1 rounded-full bg-rose-500 text-white font-bold text-[9px] flex items-center justify-center shadow-xs animate-pulse"
					>
						{unreadCount > 9 ? '9+' : unreadCount}
					</span>
				{:else if notifikasiList.length > 0}
					<span class="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary"></span>
				{/if}
			</button>

			<ThemeToggle />
		</div>
	</div>
</header>

<!-- Modal Popover Notifikasi Jamaah untuk Mode Mobile -->
{#if isNotifOpen}
	<!-- Backdrop Overlay -->
	<div
		class="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-start justify-center p-3 sm:p-4 pt-16 sm:pt-20 transition-opacity animate-in fade-in duration-150"
		role="presentation"
		onclick={closeNotif}
	>
		<!-- Dialog Container -->
		<div
			class="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] transition-all animate-in zoom-in-95 duration-150"
			role="dialog"
			aria-modal="true"
			aria-labelledby="notif-modal-title"
			tabindex="-1"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => { if (e.key === 'Escape') closeNotif(); }}
		>
			<!-- Modal Header -->
			<div class="px-4 py-3.5 border-b border-border bg-secondary/30 flex items-center justify-between shrink-0">
				<div class="flex items-center gap-2.5">
					<div class="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
						<Bell class="w-4 h-4" />
					</div>
					<div>
						<h2 id="notif-modal-title" class="text-sm font-bold text-foreground leading-tight">
							Pemberitahuan
						</h2>
						<p class="text-[11px] text-foreground/60 leading-tight">
							Jadwal pengajian & info presensi
						</p>
					</div>
				</div>

				<div class="flex items-center gap-2">
					{#if unreadCount > 0}
						<span
							class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
						>
							{unreadCount} Baru
						</span>
					{/if}
					<button
						type="button"
						onclick={closeNotif}
						class="w-8 h-8 rounded-lg text-foreground/60 hover:text-foreground hover:bg-secondary flex items-center justify-center transition-colors cursor-pointer"
						aria-label="Tutup Notifikasi"
					>
						<X class="w-4 h-4" />
					</button>
				</div>
			</div>

			<!-- Modal Body (Scrollable List) -->
			<div class="overflow-y-auto divide-y divide-border/60 p-1 flex-1">
				{#if notifikasiList.length === 0}
					<div class="py-12 px-4 text-center space-y-2.5">
						<div
							class="w-12 h-12 rounded-full bg-secondary/80 text-foreground/40 mx-auto flex items-center justify-center"
						>
							<BellOff class="w-6 h-6" />
						</div>
						<p class="text-xs font-semibold text-foreground">Tidak Ada Pemberitahuan Baru</p>
						<p class="text-[11px] text-foreground/60 max-w-xs mx-auto leading-relaxed">
							Semua jadwal pengajian kelompok dan riwayat presensi Anda saat ini sudah diperbarui.
						</p>
					</div>
				{:else}
					{#each notifikasiList as item (item.id)}
						<a
							href={item.link}
							onclick={closeNotif}
							class="p-3.5 rounded-xl flex items-start gap-3 hover:bg-secondary/40 transition-colors group block text-left"
						>
							<!-- Icon Indikator -->
							<div
								class="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center mt-0.5
								{item.badgeVariant === 'warning'
									? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
									: item.badgeVariant === 'emerald'
										? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
										: item.badgeVariant === 'rose'
											? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
											: 'bg-primary/10 text-primary'}"
							>
								{#if item.badgeVariant === 'warning'}
									<AlertTriangle class="w-4 h-4" />
								{:else if item.kategori === 'jadwal'}
									<CalendarClock class="w-4 h-4" />
								{:else if item.badgeVariant === 'emerald'}
									<CheckCircle2 class="w-4 h-4" />
								{:else}
									<Clock class="w-4 h-4" />
								{/if}
							</div>

							<!-- Konten Notifikasi -->
							<div class="flex-1 min-w-0 space-y-1">
								<div class="flex items-center justify-between gap-1.5">
									<span
										class="text-xs font-bold text-foreground group-hover:text-primary transition-colors truncate"
									>
										{item.judul}
									</span>
									<span
										class="text-[9.5px] px-1.5 py-0.5 rounded font-semibold shrink-0 tracking-tight
										{item.badgeVariant === 'warning'
											? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/20'
											: item.badgeVariant === 'emerald'
												? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
												: item.badgeVariant === 'rose'
													? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/20'
													: 'bg-primary/10 text-primary border border-primary/20'}"
									>
										{item.statusBadge}
									</span>
								</div>

								<p class="text-[11.5px] text-foreground/80 leading-snug line-clamp-2">
									{item.pesan}
								</p>

								<div class="flex items-center justify-between pt-1 text-[10px] text-foreground/50">
									<span>{item.waktu}</span>
									<span
										class="inline-flex items-center gap-0.5 text-primary font-semibold group-hover:underline"
									>
										Buka <ChevronRight class="w-3 h-3" />
									</span>
								</div>
							</div>
						</a>
					{/each}
				{/if}
			</div>

			<!-- Modal Footer -->
			<div class="p-2.5 border-t border-border bg-secondary/20 flex items-center justify-between gap-2 shrink-0">
				<a
					href="/presensi"
					onclick={closeNotif}
					class="text-xs font-semibold text-primary hover:underline px-2 py-1 inline-flex items-center gap-1"
				>
					Buka Halaman Presensi <ChevronRight class="w-3 h-3" />
				</a>

				<button
					type="button"
					onclick={closeNotif}
					class="px-3 py-1.5 text-xs font-medium bg-secondary hover:bg-secondary/80 text-foreground rounded-lg transition-colors cursor-pointer"
				>
					Tutup
				</button>
			</div>
		</div>
	</div>
{/if}
