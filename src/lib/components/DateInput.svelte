<!--
  @file src/lib/components/DateInput.svelte
  @purpose Komponen input tanggal terstandarisasi format baku DD-MM-YYYY dengan auto-masking dan kalender pemilih
  @usedBy Form sensus kartu keluarga, sensus mandiri, presensi, dan modal tambah/edit anggota
  @dependencies @lucide/svelte (Calendar), Svelte 5 Runes ($state, $props, $bindable, $effect), $lib/utils (formatDateDDMMYYYY, normalizeDateToISO)
  @publicFunctions handleInput, openCalendarPicker
  @sideEffects Mengontrol input teks dan hidden input untuk sinkronisasi nilai tanggal DD-MM-YYYY / ISO
-->
<script lang="ts">
	import { Calendar } from '@lucide/svelte';
	import { formatDateDDMMYYYY, normalizeDateToISO } from '$lib/utils';

	interface Props {
		id?: string;
		name?: string;
		value?: string;
		required?: boolean;
		disabled?: boolean;
		placeholder?: string;
		class?: string;
	}

	let {
		id,
		name,
		value = $bindable(''),
		required = false,
		disabled = false,
		placeholder = 'DD-MM-YYYY',
		class: className = ''
	}: Props = $props();

	let displayValue = $state('');
	let pickerRef: HTMLInputElement | null = $state(null);

	// Sinkronisasi nilai awal atau perubahan dari luar ke tampilan DD-MM-YYYY
	$effect(() => {
		if (value) {
			const formatted = formatDateDDMMYYYY(value);
			if (formatted !== '-' && formatted !== displayValue) {
				displayValue = formatted;
			}
		} else if (value === '' && displayValue !== '') {
			displayValue = '';
		}
	});

	// Nilai ISO untuk input form tersembunyi
	const isoValue = $derived(normalizeDateToISO(displayValue || value));

	function handleInput(e: Event) {
		const target = e.target as HTMLInputElement;
		// Hanya ambil karakter angka
		let digits = target.value.replace(/\D/g, '');
		if (digits.length > 8) digits = digits.slice(0, 8);

		let formatted = '';
		if (digits.length > 4) {
			formatted = `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`;
		} else if (digits.length > 2) {
			formatted = `${digits.slice(0, 2)}-${digits.slice(2)}`;
		} else {
			formatted = digits;
		}

		displayValue = formatted;
		value = formatted;
	}

	function handlePickerChange(e: Event) {
		const target = e.target as HTMLInputElement;
		if (target.value) {
			const formatted = formatDateDDMMYYYY(target.value);
			displayValue = formatted;
			value = formatted;
		}
	}

	function openPicker() {
		if (disabled) return;
		if (pickerRef) {
			try {
				if (typeof pickerRef.showPicker === 'function') {
					pickerRef.showPicker();
				} else {
					pickerRef.click();
				}
			} catch (_) {
				pickerRef.click();
			}
		}
	}
</script>

<div class="relative w-full">
	<!-- Hidden input untuk native form POST bila prop 'name' diberikan -->
	{#if name}
		<input type="hidden" {name} value={isoValue} />
	{/if}

	<!-- Hidden native date picker untuk trigger kalender -->
	<input
		bind:this={pickerRef}
		type="date"
		tabindex="-1"
		aria-hidden="true"
		class="sr-only absolute pointer-events-none opacity-0"
		value={isoValue}
		onchange={handlePickerChange}
	/>

	<!-- Tampilan Input Teks Baku DD-MM-YYYY -->
	<input
		{id}
		type="text"
		inputmode="numeric"
		maxlength="10"
		{disabled}
		{required}
		{placeholder}
		value={displayValue}
		oninput={handleInput}
		class="w-full pr-9 {className}"
	/>

	<!-- Tombol Kalender -->
	<button
		type="button"
		tabindex="-1"
		onclick={openPicker}
		{disabled}
		class="absolute right-2.5 top-1/2 -translate-y-1/2 text-foreground/40 hover:text-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
		title="Buka Kalender Pemilih Tanggal"
		aria-label="Buka Kalender Pemilih Tanggal"
	>
		<Calendar class="w-4 h-4" />
	</button>
</div>

