<!--
  @file src/routes/(app)/transaksi/+page.svelte
  @purpose Halaman riwayat transaksi jamaah (Isrun/FR dan Infaq & Shodaqoh) dengan tautan langsung menuju formulir FR (/fr) dan shodaqoh (/shodaqoh) sesuai mockup Flat Design Minimalist
  @usedBy Route client '/transaksi'
  @dependencies @lucide/svelte, #lib/components/ThemeToggle.svelte, Svelte 5 Runes
  @publicFunctions N/A
  @sideEffects Menampilkan daftar transaksi jamaah dan navigasi ke formulir FR / shodaqoh
-->
<script lang="ts">
	import { ArrowLeft, ChevronRight, HandCoins, HeartHandshake, PlusCircle, Wallet } from '@lucide/svelte';
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

		<div class="flex items-end justify-between gap-3">
			<div class="space-y-1">
				<h1 class="text-xl sm:text-2xl font-bold tracking-tight text-white">
					Transaksi
				</h1>
				<p class="text-xs sm:text-sm text-white/80 font-medium">
					Total bulan ini {data.totalBulanIniText}
				</p>
			</div>

			<!-- Tombol Cepat Menuju Form FR -->
			<a
				href="/fr"
				class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-bold border border-white/30 backdrop-blur-xs transition-all active:scale-95 shadow-xs shrink-0"
			>
				<HandCoins class="w-4 h-4" />
				<span>Isi Form FR</span>
			</a>
		</div>
	</header>

	<!-- 2. Daftar Kartu Transaksi -->
	<div class="px-4 -mt-5 space-y-3">
		{#if data.transaksiList.length === 0}
			<div class="bg-[#1E293B] border border-slate-700/60 rounded-2xl p-8 text-center space-y-3 shadow-xs">
				<div class="w-12 h-12 rounded-2xl bg-slate-800 text-slate-400 mx-auto flex items-center justify-center">
					<Wallet class="w-6 h-6 stroke-[1.8]" />
				</div>
				<p class="text-xs sm:text-sm text-slate-300">
					Belum ada riwayat transaksi tercatat pada bulan ini.
				</p>
				<div class="flex items-center justify-center gap-2 pt-1">
					<a
						href="/fr"
						class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold shadow-xs transition-all"
					>
						<HandCoins class="w-4 h-4" />
						<span>Isi Form FR</span>
					</a>
					<a
						href="/shodaqoh"
						class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all"
					>
						<HeartHandshake class="w-4 h-4 text-emerald-400" />
						<span>Shodaqoh</span>
					</a>
				</div>
			</div>
		{:else}
			{#each data.transaksiList as item}
				<a
					href={item.type === 'isrun' ? '/fr' : '/shodaqoh'}
					class="bg-[#1E293B] border border-slate-700/60 hover:border-slate-600 rounded-2xl p-4 flex items-center justify-between shadow-xs transition-colors group block cursor-pointer"
				>
					<div class="flex items-center gap-3">
						<div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 {item.type === 'isrun' ? 'bg-teal-500/15 text-teal-400' : 'bg-emerald-500/15 text-emerald-400'}">
							{#if item.type === 'isrun'}
								<Wallet class="w-5 h-5" />
							{:else}
								<HeartHandshake class="w-5 h-5" />
							{/if}
						</div>
						<div>
							<h2 class="text-xs sm:text-sm font-bold text-slate-100 group-hover:text-emerald-400 transition-colors">
								{item.kategori}
							</h2>
							<p class="text-[11px] text-slate-400 font-medium">
								{item.tanggalStr}
							</p>
						</div>
					</div>

					<div class="text-right flex items-center gap-2">
						<span class="text-xs sm:text-sm font-bold text-slate-100 block">
							Rp{item.nominal.toLocaleString('id-ID')}
						</span>
						<ChevronRight class="w-4 h-4 text-slate-400 group-hover:text-slate-200 group-hover:translate-x-0.5 transition-all" />
					</div>
				</a>
			{/each}
		{/if}
	</div>
</div>

