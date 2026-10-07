<!--
  @file src/routes/(app)/sensus/+page.svelte
  @purpose Tampilan status dan rincian Kartu Keluarga jamaah (Mobile-first, Card Layout)
  @usedBy Route client '/sensus'
  @dependencies @lucide/svelte (Users, Plus, Home, Shield, Calendar, ChevronRight)
  @publicFunctions N/A (Svelte Component)
  @sideEffects Menampilkan data sensus atau tombol CTA untuk pengisian sensus baru
-->
<script lang="ts">
	import { Users, Plus, Home, Shield, Calendar, UserCheck } from '@lucide/svelte';
	import type { PageData } from './$types';

	let { data } = $props<{ data: PageData }>();
</script>

<svelte:head>
	<title>Sensus Keluarga - Satu Generus</title>
</svelte:head>

<div class="space-y-5">
	<div class="flex items-center justify-between">
		<div>
			<h2 class="text-lg font-bold text-foreground tracking-tight">Sensus Keluarga</h2>
			<p class="text-xs text-foreground/60">Data kependudukan & keanggotaan jamaah</p>
		</div>

		{#if !data.hasKeluarga}
			<a
				href="/sensus/tambah"
				class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-all shadow-sm"
			>
				<Plus class="w-3.5 h-3.5" />
				<span>Isi KK</span>
			</a>
		{/if}
	</div>

	{#if !data.hasKeluarga}
		<!-- Empty State sesuai DESIGN.md -->
		<div class="bg-card border border-border rounded-2xl p-8 text-center shadow-sm space-y-4">
			<div class="w-16 h-16 rounded-2xl bg-secondary mx-auto flex items-center justify-center text-primary">
				<Users class="w-8 h-8" />
			</div>
			<div class="space-y-1">
				<h3 class="text-sm font-semibold text-foreground">Belum Ada Data Kartu Keluarga</h3>
				<p class="text-xs text-foreground/60 max-w-xs mx-auto leading-relaxed">
					Data sensus keluarga Anda belum terdaftar. Silakan lengkapi formulir sensus untuk validasi data jamaah.
				</p>
			</div>
			<div>
				<a
					href="/sensus/tambah"
					class="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-all shadow-sm active:scale-95"
				>
					<Plus class="w-4 h-4" />
					<span>Mulai Isi Sensus (Wizard)</span>
				</a>
			</div>
		</div>
	{:else}
		<!-- Kartu Informasi Kartu Keluarga -->
		<div class="bg-card border border-border rounded-xl p-4 shadow-sm space-y-3">
			<div class="flex items-start justify-between">
				<div class="flex items-center gap-2.5">
					<div class="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
						<Home class="w-5 h-5" />
					</div>
					<div>
						<p class="text-[11px] text-foreground/60 font-medium">Nomor Kartu Keluarga</p>
						<h3 class="text-sm font-semibold font-mono text-foreground tracking-wide">
							{data.keluarga.noKkMasked}
						</h3>
					</div>
				</div>
				<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary">
					<Shield class="w-3 h-3" />
					Terenkripsi
				</span>
			</div>

			<div class="pt-2 border-t border-border/60 text-xs text-foreground/70">
				<p class="font-medium text-[11px] text-foreground/50">Alamat:</p>
				<p class="mt-0.5">{data.keluarga.alamatLengkap || 'Belum ada alamat'}</p>
			</div>
		</div>

		<!-- Daftar Anggota Keluarga (Card Layout) -->
		<div class="space-y-3">
			<div class="flex items-center justify-between px-1">
				<h3 class="text-xs font-semibold uppercase tracking-wider text-foreground/70">
					Anggota Keluarga ({data.anggotaList.length})
				</h3>
			</div>

			<div class="space-y-2.5">
				{#each data.anggotaList as anggota}
					<div class="bg-card border border-border rounded-xl p-3.5 shadow-sm space-y-2">
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-2">
								<div class="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-xs font-medium text-foreground">
									<UserCheck class="w-3.5 h-3.5 text-primary" />
								</div>
								<div>
									<h4 class="text-xs font-semibold text-foreground">{anggota.statusHubungan}</h4>
									<p class="text-[11px] text-foreground/60 font-mono">NIK: {anggota.nikMasked}</p>
								</div>
							</div>
							<span class="text-[10px] bg-secondary px-2 py-0.5 rounded text-foreground/70 font-medium">
								{anggota.jenisKelamin === 'L' ? 'Laki-laki' : 'Perempuan'}
							</span>
						</div>

						<div class="flex items-center gap-1.5 text-[11px] text-foreground/50 pt-1 border-t border-border/40">
							<Calendar class="w-3 h-3" />
							<span>Tgl Lahir: {anggota.tanggalLahir}</span>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>

