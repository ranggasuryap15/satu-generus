<!--
  @file src/routes/(admin)/admin/jadwal/+page.svelte
  @purpose Antarmuka manajemen jadwal pengajian bertingkat (Desa & Kelompok), siklus pola rutin bulanan, override perubahan mendadak, generator sesi bulanan, dan generator pengingat WhatsApp
  @usedBy Route admin '/admin/jadwal'
  @dependencies @lucide/svelte, $app/forms, $lib/components/SearchableSelect.svelte, $lib/jadwal (getNamaHari, getMingguKe, formatDateIndoFull, formatWhatsAppReminder, generateWhatsAppLink, NAMA_HARI_INDO, NAMA_BULAN_INDO), Svelte 5 Runes
  @publicFunctions openCreateTemplateModal, openEditTemplateModal, openOverrideModal, openWaModal, openGenerateModal, copyWaText
  @sideEffects Mengirim server action POST untuk template & sesi jadwal, dan menyalin format teks ke clipboard pengguna
-->
<script lang="ts">
	import { enhance } from '$app/forms';
	import SearchableSelect from '$lib/components/SearchableSelect.svelte';
	import {
		formatDateIndoFull,
		formatWhatsAppReminder,
		generateWhatsAppLink,
		getNamaHari,
		NAMA_BULAN_INDO,
		NAMA_HARI_INDO,
		type JadwalReminderInput
	} from '$lib/jadwal';
	import {
		AlertCircle,
		Calendar,
		CalendarClock,
		CalendarDays,
		Check,
		CheckCircle2,
		Clock,
		Copy,
		Edit3,
		ExternalLink,
		Home,
		Layers,
		MapPin,
		MessageSquare,
		Plus,
		Send,
		Share2,
		Sparkles,
		Trash2,
		Users,
		X
	} from '@lucide/svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form } = $props<{ data: PageData; form: ActionData }>();

	// Mode Tab Aktif: 'desa' atau 'kelompok'
	let activeTab = $state<'desa' | 'kelompok'>(data.canManageDesa ? 'desa' : 'kelompok');

	// State Modal Tambah/Edit Template
	let showTemplateModal = $state(false);
	let editingTemplate = $state<any>(null);

	// State Modal Override / Perubahan Jadwal Sesi
	let showOverrideModal = $state(false);
	let editingSesi = $state<any>(null);

	// State Modal Buat Sesi Manual
	let showCreateSesiModal = $state(false);

	// State Modal Generate Sesi Bulanan
	let showGenerateModal = $state(false);
	let generateYear = $state(new Date().getFullYear());
	let generateMonth = $state(new Date().getMonth() + 1);

	// State Modal WhatsApp Reminder
	let showWaModal = $state(false);
	let waModalData = $state<JadwalReminderInput | null>(null);
	let waTargetPhone = $state('');
	let copiedWa = $state(false);

	// Notifikasi feedback aksi
	let isSubmitting = $state(false);

	// Opsi Kelompok untuk SearchableSelect di Tab Kelompok (Bagi Admin Desa / Superadmin)
	interface KelompokSelectOption {
		value: number;
		label: string;
		sublabel?: string;
	}

	interface KelompokListItem {
		id: number;
		nama: string;
		desaNama?: string;
		daerahNama?: string;
	}

	interface DesaListItem {
		id: number;
		nama: string;
		daerahNama?: string;
	}

	const kelompokOptions = $derived<KelompokSelectOption[]>(
		(data.kelompokList || []).map((k: KelompokListItem) => ({
			value: k.id,
			label: k.nama,
			sublabel: `Desa ${k.desaNama || '-'} • ${k.daerahNama || '-'}`
		}))
	);

	// Active Desa & Kelompok Nama
	const activeDesaObj = $derived(
		(data.desaList || []).find((d: DesaListItem) => d.id === data.selectedDesaId) || data.desaList[0]
	);
	const activeKelompokObj = $derived(
		(data.kelompokList || []).find((k: KelompokListItem) => k.id === data.selectedKelompokId) || data.kelompokList[0]
	);

	function openCreateTemplateModal(scope: 'Desa' | 'Kelompok') {
		editingTemplate = {
			id: null,
			tingkatScope: scope,
			desaId: data.selectedDesaId,
			kelompokId: data.selectedKelompokId,
			tipePola: scope === 'Desa' ? 'mingguan_ke' : 'hari_rutin',
			mingguKe: 1,
			hari: 0,
			jamMulai: '08:30',
			jamSelesai: '10:30',
			namaKegiatan: scope === 'Desa' ? 'Pengajian Rutin Desa' : 'Pengajian Rutin Kelompok',
			detailMateri: scope === 'Desa' ? "Qur'an Makna + Hadits + Nasehat" : "Qur'an Makna + Hadits",
			isLibur: false,
			lokasiNama: '',
			gmapsUrl: ''
		};
		showTemplateModal = true;
	}

	function openEditTemplateModal(tmpl: any) {
		editingTemplate = { ...tmpl };
		showTemplateModal = true;
	}

	function openOverrideModal(sesi: any) {
		editingSesi = { ...sesi };
		showOverrideModal = true;
	}

	function openCreateSesiModal(scope: 'Desa' | 'Kelompok') {
		showCreateSesiModal = true;
	}

	function openWaModal(sesi: any, scope: 'Desa' | 'Kelompok') {
		const lingkupNama =
			scope === 'Desa'
				? activeDesaObj?.nama || 'Desa'
				: activeKelompokObj?.nama || 'Kelompok';

		waModalData = {
			namaKegiatan: sesi.namaKegiatan,
			tingkatScope: scope,
			lingkupNama,
			tanggal: sesi.tanggal,
			jamMulai: sesi.jamMulai || '08:00',
			jamSelesai: sesi.jamSelesai,
			lokasiNama: sesi.lokasiNama,
			gmapsUrl: sesi.gmapsUrl,
			detailMateri: sesi.detailMateri,
			isOverride: sesi.isOverride,
			status: sesi.status
		};
		waTargetPhone = '';
		copiedWa = false;
		showWaModal = true;
	}

	const waMessageText = $derived(waModalData ? formatWhatsAppReminder(waModalData) : '');

	async function copyWaText() {
		if (!waMessageText) return;
		try {
			await navigator.clipboard.writeText(waMessageText);
			copiedWa = true;
			setTimeout(() => {
				copiedWa = false;
			}, 3000);
		} catch (err) {
			console.error('Gagal copy WA text:', err);
		}
	}
</script>

<svelte:head>
	<title>Jadwal Pengajian - Panel Pengurus</title>
</svelte:head>

<div class="space-y-5 p-2 sm:p-4 max-w-7xl mx-auto">
	<!-- Header & Scope Switcher -->
	<div class="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-card border border-border p-4 sm:p-5 rounded-2xl shadow-xs">
		<div class="space-y-1">
			<div class="flex items-center gap-2">
				<div class="p-2 rounded-xl bg-primary/10 text-primary">
					<CalendarDays class="w-5 h-5" />
				</div>
				<h1 class="text-base sm:text-lg font-bold text-foreground tracking-tight">
					Jadwal Pengajian
				</h1>
			</div>
			<p class="text-xs text-foreground/60 leading-relaxed">
				Kelola jadwal rutin pengajian, rincian materi, jam pelaksanaan wajib, override mendadak, serta broadcast pengingat WhatsApp.
			</p>
		</div>

		<!-- Scope Role Badge -->
		<div class="flex items-center gap-2">
			<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-secondary border border-border text-foreground">
				{#if data.isKelompokOnly}
					<Users class="w-3.5 h-3.5 text-primary" />
					<span>Admin Kelompok: {activeKelompokObj?.nama || '-'}</span>
				{:else if data.canManageDesa}
					<Home class="w-3.5 h-3.5 text-primary" />
					<span>Scope: {data.adminScope?.level ?? 'Desa'} ({activeDesaObj?.nama || 'Desa'})</span>
				{/if}
			</span>
		</div>
	</div>

	<!-- Flash Feedback / Alert Message -->
	{#if form?.error}
		<div class="flex items-start gap-2.5 p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs">
			<AlertCircle class="w-4 h-4 shrink-0 mt-0.5" />
			<span>{form.error}</span>
		</div>
	{/if}
	{#if form?.message}
		<div class="flex items-start gap-2.5 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-medium">
			<CheckCircle2 class="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
			<span>{form.message}</span>
		</div>
	{/if}

	<!-- Tab Navigasi: Khusus jika Admin memiliki wewenang Desa / Daerah / Pusat -->
	{#if data.canManageDesa}
		<div class="flex items-center gap-2 border-b border-border pb-2">
			<button
				type="button"
				onclick={() => (activeTab = 'desa')}
				class="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all {activeTab === 'desa'
					? 'bg-primary text-primary-foreground shadow-xs'
					: 'bg-card border border-border text-foreground/70 hover:text-foreground hover:bg-secondary'}"
			>
				<Home class="w-4 h-4" />
				<span>Pengajian Tingkat Desa</span>
			</button>

			<button
				type="button"
				onclick={() => (activeTab = 'kelompok')}
				class="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all {activeTab === 'kelompok'
					? 'bg-primary text-primary-foreground shadow-xs'
					: 'bg-card border border-border text-foreground/70 hover:text-foreground hover:bg-secondary'}"
			>
				<Users class="w-4 h-4" />
				<span>Pengajian Tingkat Kelompok ({data.kelompokList.length} Kelompok)</span>
			</button>
		</div>
	{/if}

	<!-- ============================================================== -->
	<!-- KONTEN TAB 1: PENGAJIAN TINGKAT DESA (Hanya untuk Admin Desa+) -->
	<!-- ============================================================== -->
	{#if activeTab === 'desa' && data.canManageDesa}
		<div class="space-y-6">
			<!-- Bar Pemilihan Desa jika memiliki multi desa -->
			{#if data.desaList.length > 1}
				<div class="flex items-center gap-2 bg-secondary/30 border border-border p-3 rounded-xl text-xs">
					<label for="desaSelect" class="font-semibold text-foreground/80 shrink-0">Pilih Desa:</label>
					<select
						id="desaSelect"
						value={data.selectedDesaId}
						onchange={(e) => {
							const val = e.currentTarget.value;
							window.location.href = `/admin/jadwal?tab=desa&desaId=${val}`;
						}}
						class="bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:ring-1 focus:ring-primary"
					>
						{#each data.desaList as d}
							<option value={d.id}>{d.nama} ({d.daerahNama || 'Daerah'})</option>
						{/each}
					</select>
				</div>
			{/if}

			<!-- Bagian 1.A: Template Rutin Mingguan Desa (Minggu 1, 2, 3, 4, 5) -->
			<section class="bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
				<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/70 pb-3">
					<div>
						<h2 class="text-sm font-bold text-foreground flex items-center gap-2">
							<span>Pola Rutin Pengajian Desa</span>
							<span class="text-[10.5px] px-2 py-0.5 rounded-full font-bold bg-primary/10 text-primary">
								Siklus Bulanan
							</span>
						</h2>
						<p class="text-xs text-foreground/60 mt-0.5">
							Jadwal rutin mingguan bulanan (Minggu ke-1: Qur'an+Hadits+Nasehat, Minggu ke-2: Organisasi, Minggu ke-3: Terobosan, Minggu ke-4: Libur, dll).
						</p>
					</div>

					<div class="flex items-center gap-2">
						<button
							type="button"
							onclick={() => openCreateTemplateModal('Desa')}
							class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-xs transition-all"
						>
							<Plus class="w-3.5 h-3.5" />
							<span>Tambah Pola Rutin</span>
						</button>

						<button
							type="button"
							onclick={() => {
								generateYear = new Date().getFullYear();
								generateMonth = new Date().getMonth() + 1;
								showGenerateModal = true;
							}}
							class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 border border-border text-foreground text-xs font-semibold transition-all"
						>
							<Sparkles class="w-3.5 h-3.5 text-primary" />
							<span>Generate Sesi</span>
						</button>
					</div>
				</div>

				<!-- Grid Template Rutin Desa -->
				{#if data.desaTemplates.length === 0}
					<div class="text-center py-8 text-xs text-foreground/50 border border-dashed border-border rounded-xl space-y-2">
						<CalendarClock class="w-8 h-8 text-foreground/30 mx-auto" />
						<p>Belum ada pola rutin pengajian Desa yang diatur.</p>
						<button
							type="button"
							onclick={() => openCreateTemplateModal('Desa')}
							class="text-primary font-semibold hover:underline"
						>
							+ Buat Pola Rutin Pertama
						</button>
					</div>
				{:else}
					<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
						{#each data.desaTemplates as tmpl}
							<div class="border border-border/80 bg-background rounded-xl p-3.5 space-y-2.5 relative hover:border-primary/50 transition-all flex flex-col justify-between">
								<div class="space-y-1.5">
									<div class="flex items-center justify-between gap-1">
										<span class="inline-flex items-center px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-primary/10 text-primary">
											Minggu ke-{tmpl.mingguKe || 1} • {getNamaHari(tmpl.hari)}
										</span>
										{#if tmpl.isLibur}
											<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400">
												Libur Rutin
											</span>
										{/if}
									</div>

									<h3 class="text-xs font-bold text-foreground">{tmpl.namaKegiatan}</h3>

									<div class="flex items-center gap-1.5 text-[11px] text-foreground/70 font-mono">
										<Clock class="w-3 h-3 text-primary" />
										<span>{tmpl.jamMulai}{tmpl.jamSelesai ? ` - ${tmpl.jamSelesai}` : ''} WIB</span>
									</div>

									{#if tmpl.detailMateri}
										<div class="text-[11px] text-foreground/75 bg-secondary/40 p-2 rounded-lg leading-relaxed whitespace-pre-line">
											{tmpl.detailMateri}
										</div>
									{/if}

									{#if tmpl.lokasiNama}
										<div class="flex items-center gap-1 text-[10.5px] text-foreground/60 truncate">
											<MapPin class="w-3 h-3 text-foreground/40 shrink-0" />
											<span class="truncate">{tmpl.lokasiNama}</span>
										</div>
									{/if}
								</div>

								<!-- Tombol Aksi Template -->
								<div class="flex items-center justify-end gap-1.5 pt-2 border-t border-border/50">
									<button
										type="button"
										onclick={() => openEditTemplateModal(tmpl)}
										class="p-1.5 text-foreground/60 hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
										title="Edit Pola Ini"
									>
										<Edit3 class="w-3.5 h-3.5" />
									</button>

									<form method="POST" action="?/deleteTemplate" use:enhance>
										<input type="hidden" name="id" value={tmpl.id} />
										<button
											type="submit"
											onclick={(e) => {
												if (!confirm('Hapus pola jadwal rutin ini?')) e.preventDefault();
											}}
											class="p-1.5 text-foreground/50 hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
											title="Hapus Pola"
										>
											<Trash2 class="w-3.5 h-3.5" />
										</button>
									</form>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</section>

			<!-- Bagian 1.B: Sesi Jadwal Konkret Pengajian Desa (Bisa Override Tanggal Tertentu) -->
			<section class="bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
				<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/70 pb-3">
					<div>
						<h2 class="text-sm font-bold text-foreground flex items-center gap-2">
							<span>Daftar Sesi Jadwal Pengajian Desa (Per Tanggal)</span>
							<span class="text-[10.5px] px-2 py-0.5 rounded-full font-bold bg-secondary text-foreground/80">
								{data.desaSesiList.length} Sesi
							</span>
						</h2>
						<p class="text-xs text-foreground/60 mt-0.5">
							Jadwal konkret yang tampil di aplikasi jamaah. Jika ada perubahan mendadak, Anda bisa mengubah materi/jam sesi tersebut saja.
						</p>
					</div>

					<button
						type="button"
						onclick={() => openCreateSesiModal('Desa')}
						class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 border border-border text-foreground text-xs font-semibold transition-all self-start sm:self-auto"
					>
						<Plus class="w-3.5 h-3.5" />
						<span>Tambah Sesi Manual</span>
					</button>
				</div>

				{#if data.desaSesiList.length === 0}
					<div class="text-center py-8 text-xs text-foreground/50 border border-dashed border-border rounded-xl">
						Belum ada sesi pengajian Desa yang digenerate atau dibuat. Klik "Generate Sesi" di atas untuk membuat jadwal otomatis.
					</div>
				{:else}
					<div class="space-y-3">
						{#each data.desaSesiList as sesi}
							<div class="border border-border/80 bg-background rounded-xl p-3.5 sm:p-4 hover:border-primary/40 transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 {sesi.isOverride ? 'border-amber-500/40 bg-amber-500/5' : ''}">
								<div class="space-y-1.5 flex-1 min-w-0">
									<div class="flex flex-wrap items-center gap-2">
										<span class="font-bold text-xs text-foreground font-mono">
											{formatDateIndoFull(sesi.tanggal)}
										</span>

										<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-primary/10 text-primary">
											<Clock class="w-3 h-3" />
											<span>{sesi.jamMulai}{sesi.jamSelesai ? ` - ${sesi.jamSelesai}` : ''} WIB</span>
										</span>

										{#if sesi.status === 'libur'}
											<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400">
												Libur
											</span>
										{:else if sesi.status === 'dibatalkan'}
											<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400">
												Dibatalkan
											</span>
										{/if}

										{#if sesi.isOverride}
											<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300">
												<AlertCircle class="w-2.5 h-2.5" />
												<span>Perubahan Khusus</span>
											</span>
										{/if}
									</div>

									<h3 class="text-sm font-bold text-foreground tracking-tight">
										{sesi.namaKegiatan}
									</h3>

									{#if sesi.detailMateri}
										<p class="text-xs text-foreground/75 leading-relaxed bg-secondary/30 p-2 rounded-lg whitespace-pre-line max-w-3xl">
											{sesi.detailMateri}
										</p>
									{/if}

									<div class="flex flex-wrap items-center gap-3 text-[11px] text-foreground/60">
										{#if sesi.lokasiNama}
											<span class="flex items-center gap-1">
												<MapPin class="w-3 h-3 text-foreground/40" />
												<span>{sesi.lokasiNama}</span>
											</span>
										{/if}
										{#if sesi.gmapsUrl}
											<a
												href={sesi.gmapsUrl}
												target="_blank"
												rel="noopener noreferrer"
												class="text-primary hover:underline flex items-center gap-0.5"
											>
												Buka Maps <ExternalLink class="w-2.5 h-2.5" />
											</a>
										{/if}
									</div>
								</div>

								<!-- Tombol Aksi per Sesi -->
								<div class="flex items-center gap-1.5 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-border/60">
									<!-- Tombol Remind WhatsApp -->
									<button
										type="button"
										onclick={() => openWaModal(sesi, 'Desa')}
										class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-all"
										title="Kirim Pengingat WhatsApp"
									>
										<Share2 class="w-3.5 h-3.5" />
										<span>Remind WA</span>
									</button>

									<!-- Tombol Ubah Sesi Mendadak (Override) -->
									<button
										type="button"
										onclick={() => openOverrideModal(sesi)}
										class="p-2 text-foreground/70 hover:text-foreground bg-secondary hover:bg-secondary/80 border border-border rounded-lg transition-colors text-xs font-medium"
										title="Ubah Jadwal Khusus Sesi Ini Saja"
									>
										<Edit3 class="w-3.5 h-3.5" />
									</button>

									<!-- Tombol Hapus Sesi -->
									<form method="POST" action="?/deleteSesi" use:enhance>
										<input type="hidden" name="id" value={sesi.id} />
										<button
											type="submit"
											onclick={(e) => {
												if (!confirm('Hapus sesi pengajian tanggal ini?')) e.preventDefault();
											}}
											class="p-2 text-foreground/50 hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
											title="Hapus Sesi"
										>
											<Trash2 class="w-3.5 h-3.5" />
										</button>
									</form>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</section>
		</div>
	{/if}

	<!-- ============================================================== -->
	<!-- KONTEN TAB 2: PENGAJIAN TINGKAT KELOMPOK                       -->
	<!-- (Admin Kelompok langsung ke sini; Admin Desa+ bisa pilih kelompok) -->
	<!-- ============================================================== -->
	{#if activeTab === 'kelompok' || !data.canManageDesa}
		<div class="space-y-6">
			<!-- Selector Kelompok khusus bagi Admin yang lebih tinggi dari kelompok -->
			{#if data.canManageDesa && data.kelompokList.length > 1}
				<div class="bg-card border border-border p-3.5 sm:p-4 rounded-xl shadow-xs space-y-2">
					<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
						<label for="kelompokSelector" class="text-xs font-bold text-foreground">
							Pilih Kelompok yang Dikelola:
						</label>
						<span class="text-[11px] text-foreground/60">
							Sebagai admin {data.adminScope?.level ?? ''}, Anda dapat melihat dan mengubah seluruh jadwal kelompok di scope Anda.
						</span>
					</div>

					<div class="max-w-md">
						<SearchableSelect
							id="kelompokSelector"
							name="kelompokSelect"
							options={kelompokOptions}
							value={data.selectedKelompokId || ''}
							onchange={(val) => {
								window.location.href = `/admin/jadwal?tab=kelompok&kelompokId=${val}`;
							}}
							placeholder="-- Cari / Pilih Kelompok --"
							searchPlaceholder="Ketik nama kelompok atau desa..."
						/>
					</div>
				</div>
			{/if}

			<!-- Bagian 2.A: Pola Rutin Kelompok (2x atau 3x Seminggu) -->
			<section class="bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
				<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/70 pb-3">
					<div>
						<h2 class="text-sm font-bold text-foreground flex items-center gap-2">
							<span>Pola Rutin Pengajian Kelompok: {activeKelompokObj?.nama || '-'}</span>
							<span class="text-[10.5px] px-2 py-0.5 rounded-full font-bold bg-primary/10 text-primary">
								{data.kelompokTemplates.length} Hari Rutin
							</span>
						</h2>
						<p class="text-xs text-foreground/60 mt-0.5">
							Jadwal rutin mingguan kelompok (misal 2x atau 3x dalam seminggu: Selasa malam, Jumat malam, Ahad pagi, dll).
						</p>
					</div>

					<div class="flex items-center gap-2">
						<button
							type="button"
							onclick={() => openCreateTemplateModal('Kelompok')}
							class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-xs transition-all"
						>
							<Plus class="w-3.5 h-3.5" />
							<span>Tambah Hari Rutin</span>
						</button>

						<button
							type="button"
							onclick={() => {
								generateYear = new Date().getFullYear();
								generateMonth = new Date().getMonth() + 1;
								showGenerateModal = true;
							}}
							class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 border border-border text-foreground text-xs font-semibold transition-all"
						>
							<Sparkles class="w-3.5 h-3.5 text-primary" />
							<span>Generate Sesi</span>
						</button>
					</div>
				</div>

				<!-- Grid Template Rutin Kelompok -->
				{#if data.kelompokTemplates.length === 0}
					<div class="text-center py-8 text-xs text-foreground/50 border border-dashed border-border rounded-xl space-y-2">
						<CalendarClock class="w-8 h-8 text-foreground/30 mx-auto" />
						<p>Belum ada pola rutin mingguan untuk kelompok ini.</p>
						<button
							type="button"
							onclick={() => openCreateTemplateModal('Kelompok')}
							class="text-primary font-semibold hover:underline"
						>
							+ Buat Jadwal Rutin Pertama (misal Tiap Selasa / Jumat)
						</button>
					</div>
				{:else}
					<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
						{#each data.kelompokTemplates as tmpl}
							<div class="border border-border/80 bg-background rounded-xl p-3.5 space-y-2.5 relative hover:border-primary/50 transition-all flex flex-col justify-between">
								<div class="space-y-1.5">
									<div class="flex items-center justify-between gap-1">
										<span class="inline-flex items-center px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-primary/10 text-primary">
											Tiap {getNamaHari(tmpl.hari)}
										</span>
										{#if tmpl.isLibur}
											<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400">
												Libur Rutin
											</span>
										{/if}
									</div>

									<h3 class="text-xs font-bold text-foreground">{tmpl.namaKegiatan}</h3>

									<div class="flex items-center gap-1.5 text-[11px] text-foreground/70 font-mono">
										<Clock class="w-3 h-3 text-primary" />
										<span>{tmpl.jamMulai}{tmpl.jamSelesai ? ` - ${tmpl.jamSelesai}` : ''} WIB</span>
									</div>

									{#if tmpl.detailMateri}
										<div class="text-[11px] text-foreground/75 bg-secondary/40 p-2 rounded-lg leading-relaxed whitespace-pre-line">
											{tmpl.detailMateri}
										</div>
									{/if}

									{#if tmpl.lokasiNama}
										<div class="flex items-center gap-1 text-[10.5px] text-foreground/60 truncate">
											<MapPin class="w-3 h-3 text-foreground/40 shrink-0" />
											<span class="truncate">{tmpl.lokasiNama}</span>
										</div>
									{/if}
								</div>

								<!-- Tombol Aksi Template -->
								<div class="flex items-center justify-end gap-1.5 pt-2 border-t border-border/50">
									<button
										type="button"
										onclick={() => openEditTemplateModal(tmpl)}
										class="p-1.5 text-foreground/60 hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
										title="Edit Pola Ini"
									>
										<Edit3 class="w-3.5 h-3.5" />
									</button>

									<form method="POST" action="?/deleteTemplate" use:enhance>
										<input type="hidden" name="id" value={tmpl.id} />
										<button
											type="submit"
											onclick={(e) => {
												if (!confirm('Hapus pola jadwal rutin ini?')) e.preventDefault();
											}}
											class="p-1.5 text-foreground/50 hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
											title="Hapus Pola"
										>
											<Trash2 class="w-3.5 h-3.5" />
										</button>
									</form>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</section>

			<!-- Bagian 2.B: Sesi Jadwal Konkret Kelompok (Bisa Override Tanggal Tertentu) -->
			<section class="bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
				<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/70 pb-3">
					<div>
						<h2 class="text-sm font-bold text-foreground flex items-center gap-2">
							<span>Sesi Jadwal Pengajian Kelompok: {activeKelompokObj?.nama || '-'}</span>
							<span class="text-[10.5px] px-2 py-0.5 rounded-full font-bold bg-secondary text-foreground/80">
								{data.kelompokSesiList.length} Sesi
							</span>
						</h2>
						<p class="text-xs text-foreground/60 mt-0.5">
							Jadwal pengajian kelompok per tanggal yang dapat dilihat jamaah di aplikasi. Jika ada materi yang mendadak berubah, gunakan tombol ubah.
						</p>
					</div>

					<button
						type="button"
						onclick={() => openCreateSesiModal('Kelompok')}
						class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 border border-border text-foreground text-xs font-semibold transition-all self-start sm:self-auto"
					>
						<Plus class="w-3.5 h-3.5" />
						<span>Tambah Sesi Manual</span>
					</button>
				</div>

				{#if data.kelompokSesiList.length === 0}
					<div class="text-center py-8 text-xs text-foreground/50 border border-dashed border-border rounded-xl">
						Belum ada sesi pengajian kelompok yang dibuat. Klik "Generate Sesi" untuk membuat jadwal otomatis dari template rutin.
					</div>
				{:else}
					<div class="space-y-3">
						{#each data.kelompokSesiList as sesi}
							<div class="border border-border/80 bg-background rounded-xl p-3.5 sm:p-4 hover:border-primary/40 transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 {sesi.isOverride ? 'border-amber-500/40 bg-amber-500/5' : ''}">
								<div class="space-y-1.5 flex-1 min-w-0">
									<div class="flex flex-wrap items-center gap-2">
										<span class="font-bold text-xs text-foreground font-mono">
											{formatDateIndoFull(sesi.tanggal)}
										</span>

										<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-primary/10 text-primary">
											<Clock class="w-3 h-3" />
											<span>{sesi.jamMulai}{sesi.jamSelesai ? ` - ${sesi.jamSelesai}` : ''} WIB</span>
										</span>

										{#if sesi.status === 'libur'}
											<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400">
												Libur
											</span>
										{:else if sesi.status === 'dibatalkan'}
											<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400">
												Dibatalkan
											</span>
										{/if}

										{#if sesi.isOverride}
											<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300">
												<AlertCircle class="w-2.5 h-2.5" />
												<span>Perubahan Khusus</span>
											</span>
										{/if}
									</div>

									<h3 class="text-sm font-bold text-foreground tracking-tight">
										{sesi.namaKegiatan}
									</h3>

									{#if sesi.detailMateri}
										<p class="text-xs text-foreground/75 leading-relaxed bg-secondary/30 p-2 rounded-lg whitespace-pre-line max-w-3xl">
											{sesi.detailMateri}
										</p>
									{/if}

									<div class="flex flex-wrap items-center gap-3 text-[11px] text-foreground/60">
										{#if sesi.lokasiNama}
											<span class="flex items-center gap-1">
												<MapPin class="w-3 h-3 text-foreground/40" />
												<span>{sesi.lokasiNama}</span>
											</span>
										{/if}
										{#if sesi.gmapsUrl}
											<a
												href={sesi.gmapsUrl}
												target="_blank"
												rel="noopener noreferrer"
												class="text-primary hover:underline flex items-center gap-0.5"
											>
												Buka Maps <ExternalLink class="w-2.5 h-2.5" />
											</a>
										{/if}
									</div>
								</div>

								<!-- Tombol Aksi per Sesi -->
								<div class="flex items-center gap-1.5 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-border/60">
									<!-- Tombol Remind WhatsApp -->
									<button
										type="button"
										onclick={() => openWaModal(sesi, 'Kelompok')}
										class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-all"
										title="Kirim Pengingat WhatsApp"
									>
										<Share2 class="w-3.5 h-3.5" />
										<span>Remind WA</span>
									</button>

									<!-- Tombol Ubah Sesi Mendadak (Override) -->
									<button
										type="button"
										onclick={() => openOverrideModal(sesi)}
										class="p-2 text-foreground/70 hover:text-foreground bg-secondary hover:bg-secondary/80 border border-border rounded-lg transition-colors text-xs font-medium"
										title="Ubah Jadwal Khusus Sesi Ini Saja"
									>
										<Edit3 class="w-3.5 h-3.5" />
									</button>

									<!-- Tombol Hapus Sesi -->
									<form method="POST" action="?/deleteSesi" use:enhance>
										<input type="hidden" name="id" value={sesi.id} />
										<button
											type="submit"
											onclick={(e) => {
												if (!confirm('Hapus sesi pengajian tanggal ini?')) e.preventDefault();
											}}
											class="p-2 text-foreground/50 hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
											title="Hapus Sesi"
										>
											<Trash2 class="w-3.5 h-3.5" />
										</button>
									</form>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</section>
		</div>
	{/if}
</div>

<!-- ============================================================== -->
<!-- MODAL 1: FORM TAMBAH / EDIT TEMPLATE RUTIN                     -->
<!-- ============================================================== -->
{#if showTemplateModal && editingTemplate}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
		<div class="bg-card border border-border rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
			<div class="flex items-center justify-between border-b border-border pb-3">
				<div>
					<h3 class="text-sm font-bold text-foreground">
						{editingTemplate.id ? 'Edit Pola Jadwal Rutin' : 'Tambah Pola Jadwal Rutin'}
					</h3>
					<span class="text-[11px] text-foreground/60">
						Tingkat: {editingTemplate.tingkatScope} ({editingTemplate.tingkatScope === 'Desa' ? activeDesaObj?.nama : activeKelompokObj?.nama})
					</span>
				</div>
				<button
					type="button"
					onclick={() => (showTemplateModal = false)}
					class="p-1 rounded-lg text-foreground/50 hover:text-foreground hover:bg-secondary"
				>
					<X class="w-4 h-4" />
				</button>
			</div>

			<form
				method="POST"
				action="?/saveTemplate"
				use:enhance={() => {
					isSubmitting = true;
					return async ({ update }) => {
						isSubmitting = false;
						showTemplateModal = false;
						await update();
					};
				}}
				class="space-y-3.5 text-xs"
			>
				{#if editingTemplate.id}
					<input type="hidden" name="id" value={editingTemplate.id} />
				{/if}
				<input type="hidden" name="tingkatScope" value={editingTemplate.tingkatScope} />
				<input type="hidden" name="desaId" value={editingTemplate.desaId || data.selectedDesaId || ''} />
				<input type="hidden" name="kelompokId" value={editingTemplate.kelompokId || data.selectedKelompokId || ''} />
				<input type="hidden" name="tipePola" value={editingTemplate.tipePola} />

				<!-- Nama Kegiatan -->
				<div>
					<label for="tmplNama" class="block font-semibold text-foreground/80 mb-1">
						Nama Kegiatan Pengajian <span class="text-destructive">*</span>
					</label>
					<input
						id="tmplNama"
						name="namaKegiatan"
						type="text"
						required
						bind:value={editingTemplate.namaKegiatan}
						placeholder="Contoh: Pengajian Rutin Ahad Pagi"
						class="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:ring-1 focus:ring-primary"
					/>
				</div>

				<div class="grid grid-cols-2 gap-3">
					<!-- Jika Pola Mingguan Bulanan (Desa): Minggu ke-berapa -->
					{#if editingTemplate.tipePola === 'mingguan_ke'}
						<div>
							<label for="tmplMingguKe" class="block font-semibold text-foreground/80 mb-1">
								Siklus Minggu Ke- <span class="text-destructive">*</span>
							</label>
							<select
								id="tmplMingguKe"
								name="mingguKe"
								bind:value={editingTemplate.mingguKe}
								class="w-full bg-secondary/50 border border-border rounded-lg px-2.5 py-2 text-xs text-foreground focus:ring-1 focus:ring-primary"
							>
								<option value={1}>Minggu ke-1</option>
								<option value={2}>Minggu ke-2</option>
								<option value={3}>Minggu ke-3</option>
								<option value={4}>Minggu ke-4</option>
								<option value={5}>Minggu ke-5</option>
							</select>
						</div>
					{/if}

					<!-- Hari Pelaksanaan -->
					<div class={editingTemplate.tipePola !== 'mingguan_ke' ? 'col-span-2' : ''}>
						<label for="tmplHari" class="block font-semibold text-foreground/80 mb-1">
							Hari Pelaksanaan <span class="text-destructive">*</span>
						</label>
						<select
							id="tmplHari"
							name="hari"
							bind:value={editingTemplate.hari}
							class="w-full bg-secondary/50 border border-border rounded-lg px-2.5 py-2 text-xs text-foreground focus:ring-1 focus:ring-primary"
						>
							{#each NAMA_HARI_INDO as hName, hIdx}
								<option value={hIdx}>{hName}</option>
							{/each}
						</select>
					</div>
				</div>

				<!-- Jam Pelaksanaan (Wajib diisi) -->
				<div class="grid grid-cols-2 gap-3">
					<div>
						<label for="tmplJamMulai" class="block font-semibold text-foreground/80 mb-1">
							Jam Mulai <span class="text-destructive">*</span>
						</label>
						<input
							id="tmplJamMulai"
							name="jamMulai"
							type="time"
							required
							bind:value={editingTemplate.jamMulai}
							class="w-full bg-secondary/50 border border-border rounded-lg px-2.5 py-2 text-xs text-foreground font-mono focus:ring-1 focus:ring-primary"
						/>
					</div>
					<div>
						<label for="tmplJamSelesai" class="block font-semibold text-foreground/80 mb-1">
							Jam Selesai (Opsional)
						</label>
						<input
							id="tmplJamSelesai"
							name="jamSelesai"
							type="time"
							bind:value={editingTemplate.jamSelesai}
							class="w-full bg-secondary/50 border border-border rounded-lg px-2.5 py-2 text-xs text-foreground font-mono focus:ring-1 focus:ring-primary"
						/>
					</div>
				</div>

				<!-- Detail Materi Default -->
				<div>
					<label for="tmplMateri" class="block font-semibold text-foreground/80 mb-1">
						Detail Materi Pengajian Default
					</label>
					<textarea
						id="tmplMateri"
						name="detailMateri"
						rows="3"
						bind:value={editingTemplate.detailMateri}
						placeholder="Contoh:&#10;- Al-Qur'an Makna (Surat Al-Baqarah)&#10;- Hadits Kitabush Sholah&#10;- Nasehat Agama"
						class="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:ring-1 focus:ring-primary leading-relaxed"
					></textarea>
				</div>

				<!-- Lokasi & Link Google Maps -->
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
					<div>
						<label for="tmplLokasi" class="block font-semibold text-foreground/80 mb-1">
							Nama Tempat / Masjid
						</label>
						<input
							id="tmplLokasi"
							name="lokasiNama"
							type="text"
							bind:value={editingTemplate.lokasiNama}
							placeholder="Contoh: Masjid Baitul Makmur"
							class="w-full bg-secondary/50 border border-border rounded-lg px-2.5 py-2 text-xs text-foreground focus:ring-1 focus:ring-primary"
						/>
					</div>
					<div>
						<label for="tmplMaps" class="block font-semibold text-foreground/80 mb-1">
							Link Google Maps (Opsional)
						</label>
						<input
							id="tmplMaps"
							name="gmapsUrl"
							type="url"
							bind:value={editingTemplate.gmapsUrl}
							placeholder="https://maps.app.goo.gl/..."
							class="w-full bg-secondary/50 border border-border rounded-lg px-2.5 py-2 text-xs text-foreground focus:ring-1 focus:ring-primary"
						/>
					</div>
				</div>

				<!-- Toggle Libur Rutin -->
				<label class="flex items-center gap-2 cursor-pointer pt-1 select-none">
					<input
						type="checkbox"
						name="isLibur"
						value="true"
						bind:checked={editingTemplate.isLibur}
						class="w-4 h-4 rounded border-border text-primary focus:ring-primary accent-primary"
					/>
					<span class="text-xs text-foreground font-medium">
						Tandai sebagai Libur Rutin (misal Minggu ke-4 libur)
					</span>
				</label>

				<div class="flex items-center justify-end gap-2 pt-3 border-t border-border">
					<button
						type="button"
						onclick={() => (showTemplateModal = false)}
						class="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-foreground/70 hover:bg-secondary"
					>
						Batal
					</button>
					<button
						type="submit"
						disabled={isSubmitting}
						class="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-xs disabled:opacity-50"
					>
						{isSubmitting ? 'Menyimpan...' : 'Simpan Template'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- ============================================================== -->
<!-- MODAL 2: UBAH PERUBAHAN JADWAL KHUSUS (OVERRIDE 1 SESI)        -->
<!-- ============================================================== -->
{#if showOverrideModal && editingSesi}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
		<div class="bg-card border border-border rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
			<div class="flex items-center justify-between border-b border-border pb-3">
				<div>
					<h3 class="text-sm font-bold text-foreground">
						Ubah Jadwal Khusus (Sesi Ini Saja)
					</h3>
					<span class="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
						💡 Perubahan ini hanya berlaku untuk tanggal {formatDateIndoFull(editingSesi.tanggal)} tanpa merusak jadwal lain.
					</span>
				</div>
				<button
					type="button"
					onclick={() => (showOverrideModal = false)}
					class="p-1 rounded-lg text-foreground/50 hover:text-foreground hover:bg-secondary"
				>
					<X class="w-4 h-4" />
				</button>
			</div>

			<form
				method="POST"
				action="?/updateSesiOverride"
				use:enhance={() => {
					isSubmitting = true;
					return async ({ update }) => {
						isSubmitting = false;
						showOverrideModal = false;
						await update();
					};
				}}
				class="space-y-3.5 text-xs"
			>
				<input type="hidden" name="id" value={editingSesi.id} />

				<!-- Tanggal Sesi (Readonly) -->
				<div>
					<span class="block font-semibold text-foreground/80 mb-1">Tanggal Sesi</span>
					<div class="bg-secondary/40 border border-border rounded-lg px-3 py-2 text-xs font-mono font-bold text-foreground">
						{formatDateIndoFull(editingSesi.tanggal)}
					</div>
				</div>

				<!-- Nama Kegiatan -->
				<div>
					<label for="sesiNama" class="block font-semibold text-foreground/80 mb-1">
						Nama Kegiatan <span class="text-destructive">*</span>
					</label>
					<input
						id="sesiNama"
						name="namaKegiatan"
						type="text"
						required
						bind:value={editingSesi.namaKegiatan}
						class="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:ring-1 focus:ring-primary"
					/>
				</div>

				<!-- Jam Pelaksanaan (Wajib diisi) -->
				<div class="grid grid-cols-2 gap-3">
					<div>
						<label for="sesiJamMulai" class="block font-semibold text-foreground/80 mb-1">
							Jam Mulai <span class="text-destructive">*</span>
						</label>
						<input
							id="sesiJamMulai"
							name="jamMulai"
							type="time"
							required
							bind:value={editingSesi.jamMulai}
							class="w-full bg-secondary/50 border border-border rounded-lg px-2.5 py-2 text-xs text-foreground font-mono focus:ring-1 focus:ring-primary"
						/>
					</div>
					<div>
						<label for="sesiJamSelesai" class="block font-semibold text-foreground/80 mb-1">
							Jam Selesai
						</label>
						<input
							id="sesiJamSelesai"
							name="jamSelesai"
							type="time"
							bind:value={editingSesi.jamSelesai}
							class="w-full bg-secondary/50 border border-border rounded-lg px-2.5 py-2 text-xs text-foreground font-mono focus:ring-1 focus:ring-primary"
						/>
					</div>
				</div>

				<!-- Status Sesi (Aktif / Libur / Dibatalkan) -->
				<div>
					<label for="sesiStatus" class="block font-semibold text-foreground/80 mb-1">
						Status Pelaksanaan
					</label>
					<select
						id="sesiStatus"
						name="status"
						bind:value={editingSesi.status}
						class="w-full bg-secondary/50 border border-border rounded-lg px-2.5 py-2 text-xs text-foreground focus:ring-1 focus:ring-primary"
					>
						<option value="aktif">Aktif (Berjalan Sesuai Rencana)</option>
						<option value="libur">Libur</option>
						<option value="dibatalkan">Dibatalkan</option>
					</select>
				</div>

				<!-- Detail Materi (Perubahan Khusus, misal Makna Hadits + Asad) -->
				<div>
					<label for="sesiMateri" class="block font-semibold text-foreground/80 mb-1">
						Rincian Materi (Bisa Diubah Khusus untuk Sesi Ini)
					</label>
					<textarea
						id="sesiMateri"
						name="detailMateri"
						rows="3"
						bind:value={editingSesi.detailMateri}
						placeholder="Contoh: Makna Hadits + Asad"
						class="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:ring-1 focus:ring-primary leading-relaxed"
					></textarea>
				</div>

				<!-- Lokasi & GMaps -->
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
					<div>
						<label for="sesiLokasi" class="block font-semibold text-foreground/80 mb-1">
							Tempat / Lokasi
						</label>
						<input
							id="sesiLokasi"
							name="lokasiNama"
							type="text"
							bind:value={editingSesi.lokasiNama}
							class="w-full bg-secondary/50 border border-border rounded-lg px-2.5 py-2 text-xs text-foreground focus:ring-1 focus:ring-primary"
						/>
					</div>
					<div>
						<label for="sesiMaps" class="block font-semibold text-foreground/80 mb-1">
							Link Google Maps
						</label>
						<input
							id="sesiMaps"
							name="gmapsUrl"
							type="url"
							bind:value={editingSesi.gmapsUrl}
							class="w-full bg-secondary/50 border border-border rounded-lg px-2.5 py-2 text-xs text-foreground focus:ring-1 focus:ring-primary"
						/>
					</div>
				</div>

				<div class="flex items-center justify-end gap-2 pt-3 border-t border-border">
					<button
						type="button"
						onclick={() => (showOverrideModal = false)}
						class="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-foreground/70 hover:bg-secondary"
					>
						Batal
					</button>
					<button
						type="submit"
						disabled={isSubmitting}
						class="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-xs disabled:opacity-50"
					>
						{isSubmitting ? 'Menyimpan...' : 'Simpan Perubahan Sesi'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- ============================================================== -->
<!-- MODAL 3: BUAT SESI MANUAL / INSIDENTAL                         -->
<!-- ============================================================== -->
{#if showCreateSesiModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
		<div class="bg-card border border-border rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
			<div class="flex items-center justify-between border-b border-border pb-3">
				<div>
					<h3 class="text-sm font-bold text-foreground">
						Tambah Sesi Jadwal Pengajian Manual
					</h3>
					<span class="text-[11px] text-foreground/60">
						Tingkat: {activeTab === 'desa' ? 'Desa' : 'Kelompok'}
					</span>
				</div>
				<button
					type="button"
					onclick={() => (showCreateSesiModal = false)}
					class="p-1 rounded-lg text-foreground/50 hover:text-foreground hover:bg-secondary"
				>
					<X class="w-4 h-4" />
				</button>
			</div>

			<form
				method="POST"
				action="?/createSesiManual"
				use:enhance={() => {
					isSubmitting = true;
					return async ({ update }) => {
						isSubmitting = false;
						showCreateSesiModal = false;
						await update();
					};
				}}
				class="space-y-3.5 text-xs"
			>
				<input type="hidden" name="tingkatScope" value={activeTab === 'desa' ? 'Desa' : 'Kelompok'} />
				<input type="hidden" name="desaId" value={data.selectedDesaId || ''} />
				<input type="hidden" name="kelompokId" value={data.selectedKelompokId || ''} />

				<!-- Tanggal Sesi -->
				<div>
					<label for="manualTgl" class="block font-semibold text-foreground/80 mb-1">
						Tanggal Kegiatan <span class="text-destructive">*</span>
					</label>
					<input
						id="manualTgl"
						name="tanggal"
						type="date"
						required
						class="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground focus:ring-1 focus:ring-primary"
					/>
				</div>

				<!-- Nama Kegiatan -->
				<div>
					<label for="manualNama" class="block font-semibold text-foreground/80 mb-1">
						Nama Kegiatan <span class="text-destructive">*</span>
					</label>
					<input
						id="manualNama"
						name="namaKegiatan"
						type="text"
						required
						placeholder="Contoh: Pengajian Pembukaan / Terobosan"
						class="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:ring-1 focus:ring-primary"
					/>
				</div>

				<!-- Jam Pelaksanaan -->
				<div class="grid grid-cols-2 gap-3">
					<div>
						<label for="manualJamMulai" class="block font-semibold text-foreground/80 mb-1">
							Jam Mulai <span class="text-destructive">*</span>
						</label>
						<input
							id="manualJamMulai"
							name="jamMulai"
							type="time"
							required
							value="08:30"
							class="w-full bg-secondary/50 border border-border rounded-lg px-2.5 py-2 text-xs text-foreground font-mono focus:ring-1 focus:ring-primary"
						/>
					</div>
					<div>
						<label for="manualJamSelesai" class="block font-semibold text-foreground/80 mb-1">
							Jam Selesai
						</label>
						<input
							id="manualJamSelesai"
							name="jamSelesai"
							type="time"
							value="10:30"
							class="w-full bg-secondary/50 border border-border rounded-lg px-2.5 py-2 text-xs text-foreground font-mono focus:ring-1 focus:ring-primary"
						/>
					</div>
				</div>

				<!-- Detail Materi -->
				<div>
					<label for="manualMateri" class="block font-semibold text-foreground/80 mb-1">
						Detail Materi Pengajian
					</label>
					<textarea
						id="manualMateri"
						name="detailMateri"
						rows="3"
						placeholder="Contoh: Makna Hadits + Asad"
						class="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:ring-1 focus:ring-primary leading-relaxed"
					></textarea>
				</div>

				<!-- Lokasi & GMaps -->
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
					<div>
						<label for="manualLokasi" class="block font-semibold text-foreground/80 mb-1">
							Tempat / Lokasi
						</label>
						<input
							id="manualLokasi"
							name="lokasiNama"
							type="text"
							placeholder="Masjid / Rumah Jamaah"
							class="w-full bg-secondary/50 border border-border rounded-lg px-2.5 py-2 text-xs text-foreground focus:ring-1 focus:ring-primary"
						/>
					</div>
					<div>
						<label for="manualMaps" class="block font-semibold text-foreground/80 mb-1">
							Link Google Maps
						</label>
						<input
							id="manualMaps"
							name="gmapsUrl"
							type="url"
							placeholder="https://maps.app.goo.gl/..."
							class="w-full bg-secondary/50 border border-border rounded-lg px-2.5 py-2 text-xs text-foreground focus:ring-1 focus:ring-primary"
						/>
					</div>
				</div>

				<div class="flex items-center justify-end gap-2 pt-3 border-t border-border">
					<button
						type="button"
						onclick={() => (showCreateSesiModal = false)}
						class="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-foreground/70 hover:bg-secondary"
					>
						Batal
					</button>
					<button
						type="submit"
						disabled={isSubmitting}
						class="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-xs disabled:opacity-50"
					>
						{isSubmitting ? 'Menyimpan...' : 'Buat Sesi Jadwal'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- ============================================================== -->
<!-- MODAL 4: GENERATE SESI BULANAN DARI TEMPLATE RUTIN            -->
<!-- ============================================================== -->
{#if showGenerateModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
		<div class="bg-card border border-border rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4">
			<div class="flex items-center justify-between border-b border-border pb-3">
				<div class="flex items-center gap-2">
					<Sparkles class="w-4 h-4 text-primary" />
					<h3 class="text-sm font-bold text-foreground">Generate Sesi Bulanan</h3>
				</div>
				<button
					type="button"
					onclick={() => (showGenerateModal = false)}
					class="p-1 rounded-lg text-foreground/50 hover:text-foreground hover:bg-secondary"
				>
					<X class="w-4 h-4" />
				</button>
			</div>

			<p class="text-xs text-foreground/70 leading-relaxed">
				Sistem akan membuat seluruh tanggal sesi pengajian untuk bulan yang dipilih berdasarkan pola rutin yang telah diatur. Sesi yang sudah pernah dibuat tidak akan ditimpa.
			</p>

			<form
				method="POST"
				action="?/generateSesiBulanan"
				use:enhance={() => {
					isSubmitting = true;
					return async ({ update }) => {
						isSubmitting = false;
						showGenerateModal = false;
						await update();
					};
				}}
				class="space-y-3.5 text-xs"
			>
				<input type="hidden" name="tingkatScope" value={activeTab === 'desa' ? 'Desa' : 'Kelompok'} />
				<input type="hidden" name="desaId" value={data.selectedDesaId || ''} />
				<input type="hidden" name="kelompokId" value={data.selectedKelompokId || ''} />

				<div class="grid grid-cols-2 gap-2.5">
					<div>
						<label for="genBulan" class="block font-semibold text-foreground/80 mb-1">Bulan</label>
						<select
							id="genBulan"
							name="month"
							bind:value={generateMonth}
							class="w-full bg-secondary/50 border border-border rounded-lg px-2.5 py-2 text-xs text-foreground focus:ring-1 focus:ring-primary"
						>
							{#each NAMA_BULAN_INDO as bName, bIdx}
								<option value={bIdx + 1}>{bName}</option>
							{/each}
						</select>
					</div>

					<div>
						<label for="genTahun" class="block font-semibold text-foreground/80 mb-1">Tahun</label>
						<input
							id="genTahun"
							name="year"
							type="number"
							bind:value={generateYear}
							class="w-full bg-secondary/50 border border-border rounded-lg px-2.5 py-2 text-xs text-foreground font-mono focus:ring-1 focus:ring-primary"
						/>
					</div>
				</div>

				<div class="flex items-center justify-end gap-2 pt-3 border-t border-border">
					<button
						type="button"
						onclick={() => (showGenerateModal = false)}
						class="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-foreground/70 hover:bg-secondary"
					>
						Batal
					</button>
					<button
						type="submit"
						disabled={isSubmitting}
						class="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-xs disabled:opacity-50"
					>
						{isSubmitting ? 'Memproses...' : 'Generate Sesi Sekarang'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- ============================================================== -->
<!-- MODAL 5: KIRIM PENGINGAT WHATSAPP (GROUP & JAPRI)              -->
<!-- ============================================================== -->
{#if showWaModal && waModalData}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
		<div class="bg-card border border-border rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
			<div class="flex items-center justify-between border-b border-border pb-3">
				<div class="flex items-center gap-2">
					<div class="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
						<MessageSquare class="w-4 h-4" />
					</div>
					<div>
						<h3 class="text-sm font-bold text-foreground">Pengingat WhatsApp</h3>
						<span class="text-[11px] text-foreground/60">{formatDateIndoFull(waModalData.tanggal)}</span>
					</div>
				</div>
				<button
					type="button"
					onclick={() => (showWaModal = false)}
					class="p-1 rounded-lg text-foreground/50 hover:text-foreground hover:bg-secondary"
				>
					<X class="w-4 h-4" />
				</button>
			</div>

			<!-- Live Preview Format Teks WhatsApp -->
			<div>
				<div class="flex items-center justify-between mb-1.5">
					<span class="text-xs font-semibold text-foreground/80">Format Pesan WhatsApp:</span>
					<button
						type="button"
						onclick={copyWaText}
						class="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
					>
						{#if copiedWa}
							<Check class="w-3 h-3 text-emerald-600" />
							<span class="text-emerald-600 font-bold">Tersalin ke Clipboard!</span>
						{:else}
							<Copy class="w-3 h-3" />
							<span>Salin Pesan</span>
						{/if}
					</button>
				</div>

				<div class="p-3.5 rounded-xl bg-secondary/50 border border-border text-xs text-foreground font-mono leading-relaxed whitespace-pre-line max-h-56 overflow-y-auto select-all">
					{waMessageText}
				</div>
			</div>

			<!-- Aksi Kirim Broadcast WhatsApp -->
			<div class="space-y-3 pt-1">
				<!-- Opsi 1: Kirim ke WA Group / Status (Buka WA dengan teks terisi) -->
				<div class="p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 space-y-2">
					<div class="flex items-center justify-between">
						<div>
							<h4 class="text-xs font-bold text-emerald-800 dark:text-emerald-300">
								Kirim ke WhatsApp Group / Umum
							</h4>
							<p class="text-[11px] text-foreground/60">
								Langsung membuka WhatsApp dan memilih grup yang dituju.
							</p>
						</div>
						<a
							href={generateWhatsAppLink(waMessageText)}
							target="_blank"
							rel="noopener noreferrer"
							class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-all"
						>
							<Share2 class="w-3.5 h-3.5" />
							<span>Kirim ke Group</span>
						</a>
					</div>
				</div>

				<!-- Opsi 2: Kirim Japri ke Nomor Tertentu -->
				<div class="p-3 rounded-xl border border-border bg-secondary/30 space-y-2">
					<h4 class="text-xs font-bold text-foreground">
						Kirim Japri (Chat Pribadi)
					</h4>
					<div class="flex items-center gap-2">
						<input
							type="tel"
							bind:value={waTargetPhone}
							placeholder="Nomor WA (contoh: 08123456789)"
							class="flex-1 bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground font-mono focus:ring-1 focus:ring-primary"
						/>
						<a
							href={generateWhatsAppLink(waMessageText, waTargetPhone)}
							target="_blank"
							rel="noopener noreferrer"
							class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-xs transition-all {waTargetPhone.trim() ? '' : 'pointer-events-none opacity-50'}"
						>
							<Send class="w-3.5 h-3.5" />
							<span>Kirim Japri</span>
						</a>
					</div>
				</div>
			</div>

			<div class="flex justify-end pt-2 border-t border-border">
				<button
					type="button"
					onclick={() => (showWaModal = false)}
					class="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-foreground/70 hover:bg-secondary"
				>
					Tutup
				</button>
			</div>
		</div>
	</div>
{/if}

