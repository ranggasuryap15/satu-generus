<!--
  @file src/routes/login/+page.svelte
  @purpose Halaman autentikasi login pengguna Satu Generus (Jamaah & Admin)
  @usedBy Route '/login'
  @dependencies lucide-svelte (Lock, Mail, ArrowRight, ShieldCheck, AlertCircle), src/lib/components/ThemeToggle.svelte, $app/forms (enhance)
  @publicFunctions N/A (Svelte Component)
  @sideEffects Mengirim formulir login kredensial pengguna dan menampilkan pesan validasi
-->
<script lang="ts">
	import { enhance } from '$app/forms';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import { AlertCircle, ArrowRight, Lock, Mail, ShieldCheck } from '@lucide/svelte';
	import type { ActionData } from './$types';

	let { form } = $props<{ form: ActionData }>();

	let identifier = $state('');
	let password = $state('');
	let rememberMe = $state(false);

	$effect(() => {
		if (form?.identifier) {
			identifier = form.identifier;
		}
	});
</script>

<svelte:head>
	<title>Masuk - Satu Generus</title>
</svelte:head>

<div class="min-h-screen bg-background text-foreground flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative transition-colors selection:bg-primary/20">
	<!-- Top Right Action: Theme Switcher -->
	<div class="absolute top-4 right-4 sm:top-6 sm:right-6">
		<ThemeToggle />
	</div>

	<div class="sm:mx-auto sm:w-full sm:max-w-md px-4">
		<!-- Brand Logo & Header -->
		<div class="text-center">
			<div class="w-12 h-12 rounded-2xl bg-primary text-primary-foreground font-bold flex items-center justify-center text-lg mx-auto shadow-md">
				SG
			</div>
			<h1 class="mt-4 text-2xl font-bold tracking-tight text-foreground">Satu Generus</h1>
			<p class="mt-1 text-xs text-foreground/60">
				Sistem Operasional Jamaah, Sensus & Presensi Terpadu
			</p>
		</div>

		<!-- Card Form Login -->
		<div class="mt-8 bg-card py-8 px-6 shadow-sm border border-border sm:rounded-2xl sm:px-10">
			{#if form?.error}
				<div class="mb-5 p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center gap-2 text-xs text-destructive">
					<AlertCircle class="w-4 h-4 shrink-0" />
					<span>{form.error}</span>
				</div>
			{/if}

			<form class="space-y-5" method="POST" use:enhance>
				<div>
					<label for="identifier" class="block text-xs font-medium text-foreground/80 mb-1.5">
						Email atau Nomor HP
					</label>
					<div class="relative">
						<Mail class="w-4 h-4 text-foreground/40 absolute left-3 top-1/2 -translate-y-1/2" />
						<input
							id="identifier"
							name="identifier"
							type="text"
							required
							bind:value={identifier}
							placeholder="nama@email.com atau 0812xxxx"
							class="w-full bg-secondary/50 border border-border rounded-lg pl-9 pr-3 py-2 text-xs text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary focus:bg-background transition-all"
						/>
					</div>
				</div>

				<div>
					<div class="flex items-center justify-between mb-1.5">
						<label for="password" class="block text-xs font-medium text-foreground/80">
							Kata Sandi
						</label>
					</div>
					<div class="relative">
						<Lock class="w-4 h-4 text-foreground/40 absolute left-3 top-1/2 -translate-y-1/2" />
						<input
							id="password"
							name="password"
							type="password"
							required
							bind:value={password}
							placeholder="••••••••"
							class="w-full bg-secondary/50 border border-border rounded-lg pl-9 pr-3 py-2 text-xs text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary focus:bg-background transition-all"
						/>
					</div>
					<div>
						<a href="#lupa-password" class="text-[11px] font-medium text-primary hover:underline">
							Lupa sandi?
						</a>
					</div>
				</div>

				<div class="flex items-center justify-between">
					<label class="flex items-center gap-2 cursor-pointer">
						<input
							type="checkbox"
							bind:checked={rememberMe}
							class="rounded border-border text-primary focus:ring-primary h-4 w-4"
						/>
						<span class="text-xs text-foreground/70">Ingat saya di perangkat ini</span>
					</label>
				</div>

				<div>
					<button
						type="submit"
						class="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-all shadow-sm active:scale-[0.99]"
					>
						<span>Masuk ke Akun</span>
						<ArrowRight class="w-4 h-4" />
					</button>
				</div>
			</form>

			<div class="mt-6 pt-5 border-t border-border flex items-center justify-center gap-2 text-[11px] text-foreground/50">
				<ShieldCheck class="w-4 h-4 text-primary" />
				<span>Data sensus & login dienkripsi dengan standar keamanan tinggi</span>
			</div>
		</div>

		<!-- Link ke Halaman Depan -->
		<div class="mt-4 text-center">
			<a href="/" class="text-xs text-foreground/60 hover:text-primary transition-colors">
				← Kembali ke Beranda Jamaah
			</a>
		</div>
	</div>
</div>
