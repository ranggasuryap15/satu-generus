<!--
  @file src/lib/components/DateInput.svelte
  @purpose Komponen input tanggal fleksibel: auto-formatting mask tanda strip instan saat pengetikan angka (DD-MM-YYYY), pemilih pop-up kalender, dan normalisasi DD-MM-YYYY / ISO
  @usedBy Form sensus kartu keluarga, sensus mandiri, presensi, jadwal, dan modal tambah/edit anggota
  @dependencies @lucide/svelte (Calendar), Svelte 5 Runes ($state, $props, $bindable, $effect, $derived), #lib/utils (formatDateDDMMYYYY, normalizeDateToISO)
  @publicFunctions handleInput, handleBlur, handlePickerChange, openPicker
  @sideEffects Mengontrol input teks dan hidden input untuk sinkronisasi nilai tanggal DD-MM-YYYY / ISO form POST
-->
<script lang="ts">
	import { Calendar } from '@lucide/svelte';
	import { formatDateDDMMYYYY, normalizeDateToISO } from '#lib/utils.js';

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
		const inputEvent = e as InputEvent;
		const target = e.target as HTMLInputElement;
		const raw = target.value;

		// Cek apakah aksi berupa penghapusan (backspace / delete)
		const isDeleting =
			inputEvent.inputType === 'deleteContentBackward' ||
			inputEvent.inputType === 'deleteContentForward' ||
			inputEvent.inputType?.startsWith('delete');

		// Ambil hanya digit angka (maksimal 8 digit: DDMMYYYY)
		const digits = raw.replace(/\D/g, '').slice(0, 8);

		let formatted = '';
		if (isDeleting) {
			// Saat user menghapus, susun format tanpa memaksakan tanda strip trailing
			if (digits.length <= 2) {
				formatted = digits;
			} else if (digits.length <= 4) {
				formatted = `${digits.slice(0, 2)}-${digits.slice(2)}`;
			} else {
				formatted = `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`;
			}
		} else {
			// Saat user mengetik angka:
			if (digits.length === 0) {
				formatted = '';
			} else if (digits.length === 1) {
				formatted = digits;
			} else if (digits.length === 2) {
				// Selesai 2 digit hari -> otomatis langsung muncul tanda strip: "01-"
				formatted = `${digits}-`;
			} else if (digits.length === 3) {
				formatted = `${digits.slice(0, 2)}-${digits.slice(2)}`;
			} else if (digits.length === 4) {
				// Selesai 2 digit bulan (total 4 digit) -> otomatis langsung muncul tanda strip kedua: "01-05-"
				formatted = `${digits.slice(0, 2)}-${digits.slice(2, 4)}-`;
			} else {
				// 5 sampai 8 digit tahun: "01-05-2002"
				formatted = `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`;
			}
		}

		displayValue = formatted;
		target.value = formatted;
		value = formatted;
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
