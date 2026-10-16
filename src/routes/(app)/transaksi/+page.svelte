<!--
  @file src/routes/(app)/transaksi/+page.svelte
  @purpose Halaman riwayat transaksi jamaah (Isrun/FR dan Infaq & Shodaqoh) sesuai mockup Flat Design Minimalist
  @usedBy Route client '/transaksi'
  @dependencies @lucide/svelte, #lib/components/ThemeToggle.svelte, Svelte 5 Runes
  @publicFunctions N/A
  @sideEffects Menampilkan daftar transaksi jamaah dan navigasi kembali
-->
<script lang="ts">
	import { ArrowLeft, HandCoins, HeartHandshake, Wallet } from '@lucide/svelte';
	import ThemeToggle from '#lib/components/ThemeToggle.svelte';
	import type { PageData } from './$types';

	let { data } = $props<{ data: PageData }>();
</script>

<svelte:head>
	<title>Transaksi - Satu Generus</title>
</svelte:head>

<div class="space-y-4">
	<!-- 1. Header Hijau Melengkung Terintegrasi -->
	<header class="bg-[#166534] dark:bg-[#14532D] text-white px-5 pt-4 pb-10 rounded-b-[28px] shadow-sm">
		<div class="flex items-center justify-between mb-4">
			<a
				href="/"
				class="p-1.5 -ml-1.5 text-white/90 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
				title="Kembali ke Beranda"
			>
				<ArrowLeft class="w-5 h-5" />
			</a>
			<ThemeToggle />
		</div>

		<div class="space-y-1">
			<h1 class="text-xl sm:text-2xl font-bold tracking-tight text-white">
				Transaksi
			</h1>
			<p class="text-xs sm:text-sm text-white/80 font-medium">
				Total bulan ini {data.totalBulanIniText}
			</p>
		</div>
	</header>

	<!-- 2. Daftar Kartu Transaksi -->
	<div class="px-4 -mt-5 space-y-3">
		{#each data.transaksiList as item}
			<div class="bg-[#1E293B] border border-slate-700/60 rounded-2xl p-4 flex items-center justify-between shadow-xs">
				<div class="flex items-center gap-3">
					<div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 {item.type === 'isrun' ? 'bg-teal-500/15 text-teal-400' : 'bg-emerald-500/15 text-emerald-400'}">
						{#if item.type === 'isrun'}
							<Wallet class="w-5 h-5" />
						{:else}
							<HeartHandshake class="w-5 h-5" />
						{/if}
					</div>
					<div>
						<h2 class="text-xs sm:text-sm font-bold text-slate-100">
							{item.kategori}
						</h2>
						<p class="text-[11px] text-slate-400 font-medium">
							{item.tanggalStr}
						</p>
					</div>
				</div>

				<div class="text-right">
					<span class="text-xs sm:text-sm font-bold text-slate-100 block">
						Rp{item.nominal.toLocaleString('id-ID')}
					</span>
				</div>
			</div>
		{/each}
	</div>
</div>

