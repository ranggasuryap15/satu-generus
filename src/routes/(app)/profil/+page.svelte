<!--
  @file src/routes/(app)/profil/+page.svelte
  @purpose Halaman profil pengguna/jamaah dengan pengaturan tema dan navigasi wewenang
  @usedBy Route client '/profil'
  @dependencies @lucide/svelte (User, Shield, MapPin, Mail, LogOut, ArrowRight), ThemeToggle
  @publicFunctions N/A (Svelte Component)
  @sideEffects Menampilkan data profil dan navigasi logout / admin panel
-->
<script lang="ts">
	import {
		User,
		ShieldCheck,
		MapPin,
		Mail,
		LogOut,
		ArrowRight,
		Moon
	} from '@lucide/svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import type { PageData } from './$types';

	let { data } = $props<{ data: PageData }>();

	const userInitials = $derived(
		(data.user.namaLengkap || 'User')
			.split(' ')
			.map((n: string) => n[0])
			.slice(0, 2)
			.join('')
			.toUpperCase()
	);
</script>

<svelte:head>
	<title>Profil Saya - Satu Generus</title>
</svelte:head>

<div class="space-y-5">
	<!-- Card Identitas Pengguna -->
	<section class="bg-card border border-border rounded-2xl p-5 shadow-sm text-center relative overflow-hidden">
		<div class="w-20 h-20 rounded-full bg-primary/10 text-primary font-bold text-2xl flex items-center justify-center mx-auto mb-3 border-2 border-primary/20 shadow-inner">
			{userInitials}
		</div>

		<h1 class="text-base font-bold text-foreground tracking-tight">{data.user.namaLengkap}</h1>
		<p class="text-xs text-foreground/60 mt-0.5">{data.user.email || 'Email belum ditautkan'}</p>

		<div class="flex items-center justify-center gap-2 mt-3">
			<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary">
				<MapPin class="w-3 h-3" />
				{data.kelompokNama}
			</span>

			{#if data.isAdmin}
				<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-accent/20 text-accent">
					<ShieldCheck class="w-3 h-3" />
					Pengurus 4S
				</span>
			{/if}
		</div>
	</section>

	<!-- Navigasi Cepat Pengurus (Jika Admin) -->
	{#if data.isAdmin}
		<section class="bg-primary/5 border border-primary/20 rounded-xl p-4 shadow-sm">
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-2.5">
					<div class="w-9 h-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
						<ShieldCheck class="w-5 h-5" />
					</div>
					<div>
						<h2 class="text-xs font-bold text-foreground">Panel Dashboard Admin</h2>
						<p class="text-[11px] text-foreground/60">Kelola sensus wilayah dan jadwal presensi</p>
					</div>
				</div>

				<a
					href="/admin"
					class="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-all shadow-sm"
				>
					<span>Buka</span>
					<ArrowRight class="w-3.5 h-3.5" />
				</a>
			</div>
		</section>
	{/if}

	<!-- Pengaturan Akun & Preferensi -->
	<section class="bg-card border border-border rounded-xl divide-y divide-border shadow-sm overflow-hidden text-xs">
		<!-- Toggle Mode Tampilan -->
		<div class="p-4 flex items-center justify-between">
			<div class="flex items-center gap-3">
				<div class="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center text-foreground/70">
					<Moon class="w-4 h-4" />
				</div>
				<div>
					<p class="font-semibold text-foreground">Tema Tampilan</p>
					<p class="text-[11px] text-foreground/50">Sesuaikan mode terang atau gelap</p>
				</div>
			</div>
			<ThemeToggle />
		</div>

		<!-- Informasi Email / Kontak -->
		<div class="p-4 flex items-center justify-between">
			<div class="flex items-center gap-3">
				<div class="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center text-foreground/70">
					<Mail class="w-4 h-4" />
				</div>
				<div>
					<p class="font-semibold text-foreground">Kontak Akun</p>
					<p class="text-[11px] text-foreground/50">{data.user.email || 'Belum diisi'}</p>
				</div>
			</div>
		</div>

		<!-- Status Kelompok -->
		<div class="p-4 flex items-center justify-between">
			<div class="flex items-center gap-3">
				<div class="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center text-foreground/70">
					<MapPin class="w-4 h-4" />
				</div>
				<div>
					<p class="font-semibold text-foreground">Lingkup Kelompok</p>
					<p class="text-[11px] text-foreground/50">{data.kelompokNama}</p>
				</div>
			</div>
		</div>
	</section>

	<!-- Tombol Keluar Akun -->
	<section class="pt-2">
		<a
			href="/logout"
			class="w-full py-3 px-4 rounded-xl border border-destructive/20 bg-destructive/5 hover:bg-destructive/10 text-destructive font-semibold text-xs flex items-center justify-center gap-2 transition-colors"
		>
			<LogOut class="w-4 h-4" />
			<span>Keluar dari Akun</span>
		</a>
	</section>
</div>

