<!--
  @file src/lib/components/SearchableSelect.svelte
  @purpose Komponen dropdown pilihan dengan fitur pencarian real-time (searchable select) untuk dataset berjumlah besar serta opsi input custom/baru
  @usedBy Halaman admin dapukan, wilayah, presensi, batch insert sensus, batch insert wilayah, dan form penugasan/relasi
  @dependencies lucide-svelte (Search, ChevronDown, Check, X, Plus), Svelte 5 Runes ($state, $derived, $props, $bindable, $effect)
  @publicFunctions selectOption, selectCustom, toggleDropdown, clearSearch, handleKeyDown
  @sideEffects Mengontrol input form tersembunyi (name & value) untuk interoperabilitas native form POST
-->
<script lang="ts">
	import { Search, ChevronDown, Check, X, Plus } from '@lucide/svelte';
	import { tick } from 'svelte';

	export interface SearchableSelectOption {
		value: string | number;
		label: string;
		sublabel?: string;
	}

	interface Props {
		id?: string;
		name: string;
		options: SearchableSelectOption[];
		value?: string | number;
		placeholder?: string;
		searchPlaceholder?: string;
		required?: boolean;
		disabled?: boolean;
		class?: string;
		onchange?: (val: string | number) => void;
		allowCustom?: boolean;
		customLabel?: string;
	}

	let {
		id,
		name,
		options = [],
		value = $bindable(''),
		placeholder = '-- Pilih Opsi --',
		searchPlaceholder = 'Ketik untuk mencari...',
		required = false,
		disabled = false,
		class: className = '',
		onchange,
		allowCustom = false,
		customLabel = 'Item Baru'
	}: Props = $props();

	let isOpen = $state(false);
	let searchQuery = $state('');
	let highlightedIndex = $state(0);

	let containerRef: HTMLDivElement | null = $state(null);
	let searchInputRef: HTMLInputElement | null = $state(null);
	let listContainerRef: HTMLDivElement | null = $state(null);

	const selectedOption = $derived(
		options.find((opt) => String(opt.value) === String(value))
	);

	const filteredOptions = $derived(
		searchQuery.trim() === ''
			? options
			: options.filter((opt) => {
					const q = searchQuery.toLowerCase();
					const matchLabel = opt.label.toLowerCase().includes(q);
					const matchSub = opt.sublabel ? opt.sublabel.toLowerCase().includes(q) : false;
					return matchLabel || matchSub;
				})
	);

	async function toggleDropdown() {
		if (disabled) return;
		isOpen = !isOpen;
		if (isOpen) {
			searchQuery = '';
			highlightedIndex = Math.max(
				0,
				filteredOptions.findIndex((opt) => String(opt.value) === String(value))
			);
			await tick();
			searchInputRef?.focus();
		}
	}

	function closeDropdown() {
		isOpen = false;
	}

	const hasExactMatch = $derived(
		options.some(
			(opt) => opt.label.trim().toLowerCase() === searchQuery.trim().toLowerCase()
		)
	);

	function selectCustom(customVal: string) {
		value = customVal;
		closeDropdown();
		onchange?.(customVal);
	}

	function selectOption(opt: SearchableSelectOption) {
		value = opt.value;
		closeDropdown();
		onchange?.(opt.value);
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (!isOpen) {
			if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				toggleDropdown();
			}
			return;
		}

		if (e.key === 'ArrowDown') {
			e.preventDefault();
			if (filteredOptions.length > 0) {
				highlightedIndex = (highlightedIndex + 1) % filteredOptions.length;
				scrollHighlightedIntoView();
			}
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			if (filteredOptions.length > 0) {
				highlightedIndex = (highlightedIndex - 1 + filteredOptions.length) % filteredOptions.length;
				scrollHighlightedIntoView();
			}
		} else if (e.key === 'Enter') {
			e.preventDefault();
			if (filteredOptions.length > 0 && filteredOptions[highlightedIndex]) {
				selectOption(filteredOptions[highlightedIndex]);
			} else if (allowCustom && searchQuery.trim()) {
				selectCustom(searchQuery.trim());
			}
		} else if (e.key === 'Escape' || e.key === 'Tab') {
			closeDropdown();
		}
	}

	function scrollHighlightedIntoView() {
		if (!listContainerRef) return;
		const items = listContainerRef.querySelectorAll('[role="option"]');
		const el = items[highlightedIndex] as HTMLElement | undefined;
		if (el) {
			el.scrollIntoView({ block: 'nearest' });
		}
	}

	function handleDocumentClick(e: MouseEvent) {
		if (containerRef && !containerRef.contains(e.target as Node)) {
			closeDropdown();
		}
	}
</script>

<svelte:document onclick={handleDocumentClick} />

<div bind:this={containerRef} class="relative w-full text-xs {className} {isOpen ? 'z-30' : ''}">
	<!-- Input Tersembunyi untuk Native Form Submission & Validasi -->
	<input
		type="text"
		tabindex="-1"
		aria-hidden="true"
		{id}
		{name}
		value={value !== undefined && value !== null ? String(value) : ''}
		{required}
		style="position: absolute; opacity: 0; width: 1px; height: 1px; pointer-events: none; bottom: 0; left: 50%;"
		oninvalid={() => {
			isOpen = true;
			tick().then(() => searchInputRef?.focus());
		}}
	/>

	<!-- Tombol Pemicu Dropdown -->
	<button
		type="button"
		onclick={toggleDropdown}
		onkeydown={handleKeyDown}
		{disabled}
		aria-haspopup="listbox"
		aria-expanded={isOpen}
		class="w-full bg-secondary/50 border rounded-lg px-2.5 py-2 text-xs text-foreground flex items-center justify-between text-left transition-colors cursor-pointer {isOpen ? 'border-primary ring-1 ring-primary' : 'border-border hover:border-primary/50'} {disabled ? 'opacity-50 cursor-not-allowed' : ''}"
	>
		<div class="flex items-center gap-1.5 truncate min-w-0 pr-2">
			{#if selectedOption}
				<span class="font-medium text-foreground truncate">{selectedOption.label}</span>
				{#if selectedOption.sublabel}
					<span class="text-[11px] text-foreground/50 truncate font-normal">({selectedOption.sublabel})</span>
				{/if}
			{:else if value}
				<span class="font-medium text-foreground truncate">{value}</span>
				{#if allowCustom}
					<span class="text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded font-normal shrink-0">({customLabel})</span>
				{/if}
			{:else}
				<span class="text-foreground/40 truncate">{placeholder}</span>
			{/if}
		</div>
		<ChevronDown
			class="w-4 h-4 text-foreground/50 shrink-0 transition-transform duration-200 {isOpen ? 'rotate-180 text-primary' : ''}"
		/>
	</button>

	<!-- Dropdown Panel dengan Input Pencarian -->
	{#if isOpen}
		<div
			class="absolute left-0 right-0 top-full mt-1.5 z-50 bg-card border border-border rounded-xl shadow-2xl overflow-hidden"
			role="listbox"
		>
			<!-- Kotak Pencarian -->
			<div class="p-2 border-b border-border bg-card">
				<div class="relative">
					<Search class="w-3.5 h-3.5 text-foreground/40 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
					<input
						bind:this={searchInputRef}
						type="search"
						bind:value={searchQuery}
						onkeydown={handleKeyDown}
						placeholder={searchPlaceholder}
						class="w-full bg-secondary/70 border border-border rounded-lg pl-8 pr-7 py-1.5 text-xs text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary focus:bg-background transition-all"
					/>
					{#if searchQuery}
						<button
							type="button"
							onclick={() => {
								searchQuery = '';
								searchInputRef?.focus();
							}}
							class="absolute right-2 top-1/2 -translate-y-1/2 text-foreground/40 hover:text-foreground p-0.5"
						>
							<X class="w-3 h-3" />
						</button>
					{/if}
				</div>
			</div>

			<!-- Daftar Opsi Terfilter -->
			<div
				bind:this={listContainerRef}
				class="max-h-56 overflow-y-auto p-1 space-y-0.5 overscroll-contain"
			>
				{#if allowCustom && searchQuery.trim() && !hasExactMatch}
					<button
						type="button"
						onclick={() => selectCustom(searchQuery.trim())}
						class="w-full px-2.5 py-2 mb-1 rounded-lg text-xs text-left flex items-center gap-2 bg-primary/10 hover:bg-primary/20 text-primary font-semibold transition-colors cursor-pointer border border-primary/20"
					>
						<Plus class="w-3.5 h-3.5 shrink-0" />
						<span class="truncate">Gunakan "<strong>{searchQuery.trim()}</strong>" ({customLabel})</span>
					</button>
				{/if}

				{#if filteredOptions.length === 0}
					{#if !allowCustom || !searchQuery.trim()}
						<div class="py-6 px-3 text-center text-xs text-foreground/50 flex flex-col items-center justify-center gap-1">
							<span>Tidak ada hasil yang cocok</span>
							{#if searchQuery}
								<span class="text-[10px] text-foreground/40">"{searchQuery}"</span>
							{/if}
						</div>
					{/if}
				{:else}
					{#each filteredOptions as opt, idx}
						{@const isSelected = String(opt.value) === String(value)}
						{@const isHighlighted = idx === highlightedIndex}
						<button
							type="button"
							role="option"
							aria-selected={isSelected}
							onclick={() => selectOption(opt)}
							onmouseenter={() => (highlightedIndex = idx)}
							class="w-full px-2.5 py-2 rounded-lg text-xs text-left flex items-center justify-between gap-2 transition-colors cursor-pointer {isSelected
								? 'bg-primary/10 text-primary font-semibold'
								: isHighlighted
									? 'bg-secondary text-foreground'
									: 'text-foreground/80 hover:bg-secondary/60'}"
						>
							<div class="flex flex-col min-w-0 pr-1">
								<span class="truncate">{opt.label}</span>
								{#if opt.sublabel}
									<span class="text-[10px] text-foreground/50 truncate font-normal">
										{opt.sublabel}
									</span>
								{/if}
							</div>

							{#if isSelected}
								<Check class="w-3.5 h-3.5 text-primary shrink-0" />
							{/if}
						</button>
					{/each}
				{/if}
			</div>
		</div>
	{/if}
</div>

