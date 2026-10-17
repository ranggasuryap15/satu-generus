<!--
  @file src/lib/components/Pagination.svelte
  @purpose Komponen reusable kontrol pagination modern, fleksibel, responsif mobile/desktop dengan tombol navigasi, ellipsis pintar, info range data, dan pilihan items per page
  @usedBy Tabel admin sensus, wilayah, presensi, dapukan, dan halaman bertabel lainnya
  @dependencies @lucide/svelte (ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight), Svelte 5 Runes
  @publicFunctions changePage, changePageSize
  @sideEffects Mengubah nilai reaktif currentPage dan pageSize via $bindable
-->
<script lang="ts">
	import { untrack } from 'svelte';
	import {
		ChevronLeft,
		ChevronRight,
		ChevronsLeft,
		ChevronsRight
	} from '@lucide/svelte';

	let {
		currentPage = $bindable(1),
		pageSize = $bindable(10),
		totalItems = 0,
		pageSizeOptions = [10, 25, 50, 100, -1],
		showPageSizeSelector = true,
		showInfo = true,
		class: className = ''
	} = $props<{
		currentPage?: number;
		pageSize?: number;
		totalItems: number;
		pageSizeOptions?: number[];
		showPageSizeSelector?: boolean;
		showInfo?: boolean;
		class?: string;
	}>();

	let isAll = $derived(pageSize !== undefined && pageSize <= 0);
	let totalPages = $derived(isAll ? 1 : Math.max(1, Math.ceil(totalItems / (pageSize || 10))));

	// Koreksi otomatis jika currentPage melampaui totalPages
	$effect(() => {
		const max = totalPages;
		untrack(() => {
			if (currentPage > max) {
				currentPage = max;
			} else if (currentPage < 1) {
				currentPage = 1;
			}
		});
	});

	let startIndex = $derived(totalItems === 0 ? 0 : isAll ? 1 : (currentPage - 1) * pageSize + 1);
	let endIndex = $derived(isAll ? totalItems : Math.min(totalItems, currentPage * pageSize));

	// Logika halaman yang ditampilkan dengan ellipsis
	let visiblePages = $derived.by(() => {
		const pages: (number | '...')[] = [];
		const maxVisible = 5;

		if (totalPages <= maxVisible + 2) {
			for (let i = 1; i <= totalPages; i++) {
				pages.push(i);
			}
		} else {
			// Selalu tampilkan halaman 1
			pages.push(1);

			let start = Math.max(2, currentPage - 1);
			let end = Math.min(totalPages - 1, currentPage + 1);

			if (currentPage <= 3) {
				start = 2;
				end = 4;
			} else if (currentPage >= totalPages - 2) {
				start = totalPages - 3;
				end = totalPages - 1;
			}

			if (start > 2) {
				pages.push('...');
			}

			for (let i = start; i <= end; i++) {
				pages.push(i);
			}

			if (end < totalPages - 1) {
				pages.push('...');
			}

			// Selalu tampilkan halaman terakhir
			pages.push(totalPages);
		}

		return pages;
	});

	function goToPage(page: number) {
		if (page >= 1 && page <= totalPages && page !== currentPage) {
			currentPage = page;
		}
	}
</script>

{#if totalItems > 0}
	<div class="flex flex-col sm:flex-row items-center justify-between gap-3 px-3 py-3 border-t border-border bg-card/40 text-xs text-foreground/80 {className}">
		<!-- Info Data & Page Size Selector -->
		<div class="flex flex-wrap items-center gap-2 sm:gap-3 text-foreground/70 w-full sm:w-auto justify-between sm:justify-start">
			{#if showInfo}
				<span class="text-xs">
					{#if isAll}
						Menampilkan seluruh <strong class="text-foreground">{totalItems}</strong> data
					{:else}
						Menampilkan <strong class="text-foreground">{startIndex}</strong> - <strong class="text-foreground">{endIndex}</strong> dari <strong class="text-foreground">{totalItems}</strong> data
					{/if}
				</span>
			{/if}

			{#if showPageSizeSelector}
				<div class="flex items-center gap-1.5 ml-auto sm:ml-2">
					<label for="pageSizeSelect" class="text-[11px] text-foreground/60">Per hal:</label>
					<select
						id="pageSizeSelect"
						bind:value={pageSize}
						class="bg-background border border-border rounded-lg px-2 py-1 text-xs text-foreground focus:ring-1 focus:ring-primary focus:border-primary outline-hidden cursor-pointer"
					>
						{#each pageSizeOptions as opt}
							<option value={opt}>{opt <= 0 ? 'Semua' : opt}</option>
						{/each}
					</select>
				</div>
			{/if}
		</div>

		<!-- Tombol Navigasi Halaman -->
		<div class="flex items-center gap-1 w-full sm:w-auto justify-center sm:justify-end">
			<!-- First Page -->
			<button
				type="button"
				onclick={() => goToPage(1)}
				disabled={currentPage === 1}
				class="p-1.5 rounded-lg border border-border text-foreground/70 hover:text-foreground hover:bg-secondary disabled:opacity-30 disabled:pointer-events-none transition-colors"
				title="Halaman Pertama"
				aria-label="Halaman Pertama"
			>
				<ChevronsLeft class="w-4 h-4" />
			</button>

			<!-- Previous Page -->
			<button
				type="button"
				onclick={() => goToPage(currentPage - 1)}
				disabled={currentPage === 1}
				class="p-1.5 rounded-lg border border-border text-foreground/70 hover:text-foreground hover:bg-secondary disabled:opacity-30 disabled:pointer-events-none transition-colors"
				title="Halaman Sebelumnya"
				aria-label="Halaman Sebelumnya"
			>
				<ChevronLeft class="w-4 h-4" />
			</button>

			<!-- Page Numbers -->
			<div class="flex items-center gap-1">
				{#each visiblePages as p}
					{#if p === '...'}
						<span class="px-1.5 py-1 text-foreground/40 font-mono select-none">...</span>
					{:else}
						<button
							type="button"
							onclick={() => goToPage(p)}
							class="min-w-7 h-7 px-2 rounded-lg text-xs font-semibold transition-all {currentPage === p
								? 'bg-primary text-primary-foreground shadow-xs'
								: 'border border-border hover:bg-secondary text-foreground/80 hover:text-foreground'}"
						>
							{p}
						</button>
					{/if}
				{/each}
			</div>

			<!-- Next Page -->
			<button
				type="button"
				onclick={() => goToPage(currentPage + 1)}
				disabled={currentPage === totalPages}
				class="p-1.5 rounded-lg border border-border text-foreground/70 hover:text-foreground hover:bg-secondary disabled:opacity-30 disabled:pointer-events-none transition-colors"
				title="Halaman Berikutnya"
				aria-label="Halaman Berikutnya"
			>
				<ChevronRight class="w-4 h-4" />
			</button>

			<!-- Last Page -->
			<button
				type="button"
				onclick={() => goToPage(totalPages)}
				disabled={currentPage === totalPages}
				class="p-1.5 rounded-lg border border-border text-foreground/70 hover:text-foreground hover:bg-secondary disabled:opacity-30 disabled:pointer-events-none transition-colors"
				title="Halaman Terakhir"
				aria-label="Halaman Terakhir"
			>
				<ChevronsRight class="w-4 h-4" />
			</button>
		</div>
	</div>
{/if}

