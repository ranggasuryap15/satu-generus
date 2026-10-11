<!--
  @file src/lib/components/DateInput.svelte
  @purpose Komponen input tanggal fleksibel: mendukung pengetikan manual bebas tanpa interupsi, pemilih pop-up kalender instan saat diklik, dan normalisasi DD-MM-YYYY / ISO
  @usedBy Form sensus kartu keluarga, sensus mandiri, presensi, jadwal, dan modal tambah/edit anggota
  @dependencies @lucide/svelte (Calendar), Svelte 5 Runes ($state, $props, $bindable, $effect, $derived), $lib/utils (formatDateDDMMYYYY, normalizeDateToISO)
  @publicFunctions handleInput, handleBlur, handlePickerChange, openPicker
  @sideEffects Mengontrol input teks dan hidden input untuk sinkronisasi nilai tanggal DD-MM-YYYY / ISO form POST
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
	let isUserTyping = $state(false);

	// Sinkronisasi hanya saat TIDAK sedang diketik aktif oleh user
	$effect(() => {
		if (isUserTyping) return;

		if (value) {
			const formatted = formatDateDDMMYYYY(value);
			if (formatted !== '-' && formatted !== displayValue) {
				displayValue = formatted;
			}
		} else if (value === '' && displayValue !== '') {
			displayValue = '';
		}
	});

	// Nilai ISO standar (YYYY-MM-DD) untuk payload form server
	const isoValue = $derived(normalizeDateToISO(displayValue || value));

	function handleInput(e: Event) {
		isUserTyping = true;
		const target = e.target as HTMLInputElement;
		const raw = target.value;

		// Izinkan angka dan pemisah strip (-) atau slash (/)
		let clean = raw.replace(/[^\d\-/]/g, '');

		// Jika user mengetik 8 digit angka murni berturut-turut, bantu beri pemisah DD-MM-YYYY
		const digits = clean.replace(/\D/g, '');
		if (digits.length === 8 && !clean.includes('-') && !clean.includes('/')) {
			clean = `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`;
		}

		displayValue = clean;
		value = clean;
	}

	function handleBlur() {
		isUserTyping = false;
		if (displayValue.trim()) {
			const formatted = formatDateDDMMYYYY(displayValue);
			if (formatted !== '-') {
				displayValue = formatted;
				value = formatted;
			}
		}
	}

	function handlePickerChange(e: Event) {
		const target = e.target as HTMLInputElement;
		if (target.value) {
			const formatted = formatDateDDMMYYYY(target.value);
			displayValue = formatted;
			value = formatted;
			isUserTyping = false;
		}
	}

	function openPicker() {
		if (disabled) return;
		if (pickerRef) {
			try {
				if (typeof pickerRef.showPicker === 'function') {
					pickerRef.showPicker();
				} else {
					pickerRef.focus();
					pickerRef.click();
				}
			} catch (_) {
				pickerRef.click();
			}
		}
	}
</script>

<div class="relative w-full group">
	<!-- Hidden input untuk native form POST bila prop 'name' diberikan -->
	{#if name}
		<input type="hidden" {name} value={isoValue} />
	{/if}

	<!-- Tampilan Input Teks: Bebas diketik manual atau dblclick untuk kalender -->
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
		onblur={handleBlur}
		ondblclick={openPicker}
		class="w-full pr-10 {className}"
	/>

	<!-- Overlay Native Date Picker & Icon Kalender (Bisa diklik langsung untuk memunculkan kalender) -->
	<div class="absolute right-0 top-0 h-full w-9 flex items-center justify-center">
		<input
			bind:this={pickerRef}
			type="date"
			tabindex="-1"
			value={isoValue}
			onchange={handlePickerChange}
			class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed"
			title="Pilih tanggal dari kalender"
			aria-label="Pilih tanggal dari kalender"
			{disabled}
		/>
		<button
			type="button"
			tabindex="-1"
			onclick={openPicker}
			{disabled}
			class="pointer-events-none text-foreground/40 group-hover:text-primary transition-colors disabled:opacity-40"
			aria-hidden="true"
		>
			<Calendar class="w-4 h-4" />
		</button>
	</div>
</div>
