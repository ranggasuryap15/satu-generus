<!--
  @file src/routes/(app)/transaksi/+page.svelte
  @purpose Halaman riwayat transaksi jamaah dengan filter kategori & periode serta fitur grouping per minggu dan per bulan sesuai konsep Flat Design Minimalist
  @usedBy Route client '/transaksi'
  @dependencies @lucide/svelte, #lib/components/ThemeToggle.svelte, #lib/transaksi-grouping, Svelte 5 Runes
  @publicFunctions toggleGroupCollapse, resetFilters
  @sideEffects Menampilkan daftar transaksi jamaah terfilter & terkelompok, navigasi ke /fr dan /shodaqoh
-->
<script lang="ts">
	import {
		ArrowLeft,
		Calendar,
		CalendarDays,
		ChevronDown,
		ChevronRight,
		ChevronUp,
		Filter,
		HandCoins,
		HeartHandshake,
		RotateCcw,
		Search,
		SlidersHorizontal,
		Wallet,
		X
	} from '@lucide/svelte';
	import ThemeToggle from '#lib/components/ThemeToggle.svelte';
	import type { PageData } from './$types';
	import {
		formatRupiah,
		formatYearMonth,
		groupTransaksiByBulan,
		groupTransaksiByMinggu,
		filterTransaksi,
		type TransaksiItem
	} from '#lib/transaksi-grouping.js';

	let { data } = $props<{ data: PageData }>();

	// Mode Grouping: 'bulan' atau 'minggu'
	let modeGrouping = $state<'bulan' | 'minggu'>('bulan');

	// State Filter
	let kategoriFilter = $state<'all' | 'isrun' | 'shodaqoh'>('all');
	let periodeFilter = $state<string>('all');
	let searchQuery = $state<string>('');
	let showSearchInput = $state(false);

	// State Collapse / Expand per grup (key grup -> boolean collapsed)
	let collapsedGroups = $state<Record<string, boolean>>({});

	function toggleGroupCollapse(key: string) {
		collapsedGroups[key] = !collapsedGroups[key];
	}

	function resetFilters() {
		kategoriFilter = 'all';
		periodeFilter = 'all';
		searchQuery = '';
		showSearchInput = false;
	}

	// Daftar bulan unik dari data transaksi untuk opsi filter periode
	const availableMonths = $derived.by(() => {
		const set = new Set<string>();
		for (const item of data.transaksiList) {
			if (item.tanggal) {
				set.add(item.tanggal.slice(0, 7));
			}
		}
		return Array.from(set).sort((a, b) => b.localeCompare(a));
	});

	// Transaksi yang sudah terfilter
	const filteredTransaksi = $derived.by(() => {
		return filterTransaksi(data.transaksiList, {
			kategori: kategoriFilter,
			periode: periodeFilter,
			search: searchQuery
		});
	});

	// Total nominal dari transaksi yang sedang tampil
	const totalFilteredNominal = $derived.by(() => {
		return filteredTransaksi.reduce((acc, curr) => acc + curr.nominal, 0);
	});

	// Transaksi yang dikelompokkan sesuai mode grouping aktif
	const groupedList = $derived.by(() => {
		if (modeGrouping === 'minggu') {
			return groupTransaksiByMinggu(filteredTransaksi);
		}
		return groupTransaksiByBulan(filteredTransaksi);
	});

	// Hitung jumlah transaksi per kategori untuk badge counter filter
	const countAll = $derived(data.transaksiList.length);
	const countIsrun = $derived(data.transaksiList.filter((t: TransaksiItem) => t.type === 'isrun').length);
	const countShodaqoh = $derived(data.transaksiList.filter((t: TransaksiItem) => t.type === 'shodaqoh').length);
</script>

<svelte:head>
	<title>Riwayat Transaksi - Satu Generus</title>
</svelte:head>

<div class="space-y-4 pb-12">
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
					Riwayat Transaksi
				</h1>
				<p class="text-xs sm:text-sm text-white/80 font-medium">
					Total bulan ini: <span class="font-bold text-white">{data.totalBulanIniText}</span>
				</p>
			</div>

			<!-- Tombol Cepat Menuju Formulir Setoran -->
			<div class="flex items-center gap-2 shrink-0">
				<a
					href="/fr"
					class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-bold border border-white/30 backdrop-blur-xs transition-all active:scale-95 shadow-xs"
					title="Buka Formulir Isrun / FR"
				>
					<HandCoins class="w-3.5 h-3.5" />
					<span>Form FR</span>
				</a>
				<a
					href="/shodaqoh"
					class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/30 hover:bg-emerald-500/40 text-emerald-100 text-xs font-bold border border-emerald-400/40 backdrop-blur-xs transition-all active:scale-95 shadow-xs"
					title="Buka Formulir Shodaqoh"
				>
					<HeartHandshake class="w-3.5 h-3.5" />
					<span>Shodaqoh</span>
				</a>
			</div>
		</div>
	</header>

	<!-- 2. Kontrol Grouping & Filter Card -->
	<div class="px-4 -mt-5 space-y-3">
		<div class="bg-[#1E293B] border border-slate-700/60 rounded-2xl p-3.5 shadow-sm space-y-3">
			<!-- Baris 1: Grouping Switcher (Per Bulan vs Per Minggu) -->
			<div class="flex items-center justify-between gap-2">
				<span class="text-xs font-bold text-slate-300 flex items-center gap-1.5">
					<SlidersHorizontal class="w-3.5 h-3.5 text-emerald-400" />
					<span>Kelompokkan:</span>
				</span>

				<!-- Segmented Switcher -->
				<div class="inline-flex p-1 bg-[#0F172A] border border-slate-700/80 rounded-xl gap-1">
					<button
						type="button"
						onclick={() => (modeGrouping = 'bulan')}
						class="px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer {modeGrouping === 'bulan'
							? 'bg-emerald-500 text-slate-950 shadow-xs'
							: 'text-slate-400 hover:text-slate-200'}"
					>
						<Calendar class="w-3.5 h-3.5" />
						<span>Per Bulan</span>
					</button>

					<button
						type="button"
						onclick={() => (modeGrouping = 'minggu')}
						class="px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer {modeGrouping === 'minggu'
							? 'bg-emerald-500 text-slate-950 shadow-xs'
							: 'text-slate-400 hover:text-slate-200'}"
					>
						<CalendarDays class="w-3.5 h-3.5" />
						<span>Per Minggu</span>
					</button>
				</div>
			</div>

			<!-- Baris 2: Filter Kategori Pills (Semua / Isrun / Shodaqoh) -->
			<div class="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
				<button
					type="button"
					onclick={() => (kategoriFilter = 'all')}
					class="px-3 py-1 rounded-xl text-xs font-semibold shrink-0 transition-colors cursor-pointer border flex items-center gap-1.5 {kategoriFilter === 'all'
						? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400 font-bold'
						: 'bg-[#0F172A] border-slate-700/80 text-slate-400 hover:text-slate-200'}"
				>
					<span>Semua</span>
					<span class="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-slate-300 font-mono">
						{countAll}
					</span>
				</button>

				<button
					type="button"
					onclick={() => (kategoriFilter = 'isrun')}
					class="px-3 py-1 rounded-xl text-xs font-semibold shrink-0 transition-colors cursor-pointer border flex items-center gap-1.5 {kategoriFilter === 'isrun'
						? 'bg-teal-500/15 border-teal-500/40 text-teal-400 font-bold'
						: 'bg-[#0F172A] border-slate-700/80 text-slate-400 hover:text-slate-200'}"
				>
					<Wallet class="w-3.5 h-3.5 text-teal-400" />
					<span>Isrun / FR</span>
					<span class="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-slate-300 font-mono">
						{countIsrun}
					</span>
				</button>

				<button
					type="button"
					onclick={() => (kategoriFilter = 'shodaqoh')}
					class="px-3 py-1 rounded-xl text-xs font-semibold shrink-0 transition-colors cursor-pointer border flex items-center gap-1.5 {kategoriFilter === 'shodaqoh'
						? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400 font-bold'
						: 'bg-[#0F172A] border-slate-700/80 text-slate-400 hover:text-slate-200'}"
				>
					<HeartHandshake class="w-3.5 h-3.5 text-emerald-400" />
					<span>Infaq & Shodaqoh</span>
					<span class="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-slate-300 font-mono">
						{countShodaqoh}
					</span>
				</button>
			</div>

			<!-- Baris 3: Dropdown Periode & Pencarian Teks -->
			<div class="pt-2 border-t border-slate-700/60 flex items-center justify-between gap-2">
				<!-- Dropdown Periode -->
				<div class="flex items-center gap-1.5 min-w-0 flex-1">
					<Filter class="w-3.5 h-3.5 text-slate-400 shrink-0" />
					<select
						bind:value={periodeFilter}
						class="w-full bg-[#0F172A] border border-slate-700 text-slate-200 text-xs rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer truncate"
					>
						<option value="all">Semua Periode</option>
						<option value="bulan-ini">Bulan Ini</option>
						<option value="bulan-lalu">Bulan Lalu</option>
						{#each availableMonths as m}
							<option value={m}>{formatYearMonth(m)}</option>
						{/each}
					</select>
				</div>

				<!-- Tombol Toggle Search Bar -->
				<button
					type="button"
					onclick={() => (showSearchInput = !showSearchInput)}
					class="p-2 rounded-xl border border-slate-700 bg-[#0F172A] text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
					title="Cari transaksi"
				>
					<Search class="w-3.5 h-3.5" />
				</button>

				<!-- Tombol Reset Filter jika aktif -->
				{#if kategoriFilter !== 'all' || periodeFilter !== 'all' || searchQuery}
					<button
						type="button"
						onclick={resetFilters}
						class="p-2 rounded-xl border border-rose-800/40 bg-rose-950/30 text-rose-300 hover:bg-rose-900/40 transition-colors cursor-pointer shrink-0"
						title="Reset filter"
					>
						<RotateCcw class="w-3.5 h-3.5" />
					</button>
				{/if}
			</div>

			<!-- Input Pencarian (Muncul saat tombol search diklik) -->
			{#if showSearchInput}
				<div class="relative pt-1">
					<input
						type="text"
						bind:value={searchQuery}
						placeholder="Cari kategori, keterangan, atau nominal..."
						class="w-full bg-[#0F172A] border border-slate-700 text-slate-100 text-xs rounded-xl pl-8 pr-8 py-2 focus:outline-none focus:ring-1 focus:ring-emerald-500"
					/>
					<Search class="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-3.5" />
					{#if searchQuery}
						<button
							type="button"
							onclick={() => (searchQuery = '')}
							class="absolute right-2.5 top-3 text-slate-400 hover:text-slate-200 cursor-pointer"
						>
							<X class="w-3.5 h-3.5" />
						</button>
					{/if}
				</div>
			{/if}
		</div>

		<!-- Baris Ringkasan Hasil Filter -->
		<div class="flex items-center justify-between text-xs px-1 text-slate-400">
			<span>
				Menampilkan <strong class="text-slate-200">{filteredTransaksi.length}</strong> transaksi
			</span>
			<span>
				Total: <strong class="text-emerald-400 font-mono">{formatRupiah(totalFilteredNominal)}</strong>
			</span>
		</div>

		<!-- 3. Daftar Transaksi Terkelompok (Grouped List) -->
		{#if groupedList.length === 0}
			<div class="bg-[#1E293B] border border-slate-700/60 rounded-2xl p-8 text-center space-y-3 shadow-xs">
				<div class="w-12 h-12 rounded-2xl bg-slate-800 text-slate-400 mx-auto flex items-center justify-center">
					<Wallet class="w-6 h-6 stroke-[1.8]" />
				</div>
				<div class="space-y-1">
					<p class="text-xs sm:text-sm font-semibold text-slate-200">
						Tidak ada transaksi yang cocok
					</p>
					<p class="text-[11px] text-slate-400">
						Silakan sesuaikan filter kategori atau periode waktu di atas.
					</p>
				</div>
				<button
					type="button"
					onclick={resetFilters}
					class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors cursor-pointer"
				>
					<RotateCcw class="w-3.5 h-3.5 text-emerald-400" />
					<span>Reset Semua Filter</span>
				</button>
			</div>
		{:else}
			{#each groupedList as group (group.key)}
				{@const isCollapsed = Boolean(collapsedGroups[group.key])}
				<div class="bg-[#1E293B] border border-slate-700/60 rounded-2xl overflow-hidden shadow-xs">
					<!-- Header Grup (Bulan atau Minggu) -->
					<button
						type="button"
						onclick={() => toggleGroupCollapse(group.key)}
						class="w-full px-4 py-3 bg-[#1E293B] hover:bg-slate-800/60 transition-colors flex items-center justify-between text-left border-b border-slate-700/40 cursor-pointer"
					>
						<div class="flex items-center gap-2.5 min-w-0">
							<div class="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
								{#if modeGrouping === 'minggu'}
									<CalendarDays class="w-4 h-4" />
								{:else}
									<Calendar class="w-4 h-4" />
								{/if}
							</div>
							<div class="min-w-0">
								<h2 class="text-xs sm:text-sm font-bold text-slate-100 truncate">
									{group.title}
								</h2>
								{#if group.subtitle}
									<p class="text-[11px] text-slate-400">
										{group.subtitle}
									</p>
								{/if}
							</div>
						</div>

						<div class="flex items-center gap-2 shrink-0">
							<span class="text-xs sm:text-sm font-bold text-emerald-400 font-mono">
								{formatRupiah(group.totalNominal)}
							</span>
							<div class="text-slate-400">
								{#if isCollapsed}
									<ChevronDown class="w-4 h-4" />
								{:else}
									<ChevronUp class="w-4 h-4" />
								{/if}
							</div>
						</div>
					</button>

					<!-- Item Transaksi di dalam Grup -->
					{#if !isCollapsed}
						<div class="divide-y divide-slate-700/40">
							{#each group.items as item (item.id)}
								<a
									href={item.href}
									class="px-4 py-3 flex items-center justify-between hover:bg-slate-800/40 transition-colors group block cursor-pointer"
								>
									<div class="flex items-center gap-3 min-w-0 pr-2">
										<div
											class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 {item.type === 'isrun'
												? 'bg-teal-500/15 text-teal-400'
												: 'bg-emerald-500/15 text-emerald-400'}"
										>
											{#if item.type === 'isrun'}
												<Wallet class="w-4 h-4" />
											{:else}
												<HeartHandshake class="w-4 h-4" />
											{/if}
										</div>

										<div class="min-w-0">
											<div class="flex items-center gap-1.5 flex-wrap">
												<span class="text-xs font-bold text-slate-100 group-hover:text-emerald-400 transition-colors truncate">
													{item.kategori}
												</span>
												{#if item.status}
													<span class="px-1.5 py-0.5 rounded-md text-[10px] font-semibold {item.status.toLowerCase().includes('lunas') || item.status.toLowerCase().includes('setuju')
														? 'bg-emerald-500/15 text-emerald-400'
														: 'bg-amber-500/15 text-amber-300'}">
														{item.status}
													</span>
												{/if}
											</div>

											<div class="flex items-center gap-2 text-[11px] text-slate-400 font-medium pt-0.5">
												<span>{item.tanggalStr}</span>
												{#if item.keterangan}
													<span class="truncate max-w-[150px] sm:max-w-xs text-slate-500">
														· {item.keterangan}
													</span>
												{/if}
											</div>
										</div>
									</div>

									<div class="text-right flex items-center gap-2 shrink-0">
										<span class="text-xs sm:text-sm font-bold text-slate-100 font-mono block">
											{formatRupiah(item.nominal)}
										</span>
										<ChevronRight class="w-4 h-4 text-slate-400 group-hover:text-slate-200 group-hover:translate-x-0.5 transition-all" />
									</div>
								</a>
							{/each}
						</div>
					{/if}
				</div>
			{/each}
		{/if}
	</div>
</div>

