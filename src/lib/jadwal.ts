/**
 * @file src/lib/jadwal.ts
 * @purpose Utility dan helper domain bisnis jadwal pengajian (Desa & Kelompok), kalkulasi siklus minggu ke-N, generator sesi tanggal dari template rutin, dan generator template pesan WhatsApp reminder
 * @usedBy src/routes/(admin)/admin/jadwal/+page.server.ts, src/routes/(admin)/admin/jadwal/+page.svelte, src/routes/(app)/+page.server.ts
 * @dependencies src/lib/utils (normalizeDateToISO)
 * @publicFunctions NAMA_HARI_INDO, NAMA_BULAN_INDO, getNamaHari, getMingguKe, formatDateIndoFull, formatWhatsAppReminder, generateWhatsAppLink, hitungTanggalSesiBulanan
 * @sideEffects Tidak ada (pure utility)
 */

export const NAMA_HARI_INDO = ['Ahad', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'] as const;

export const NAMA_BULAN_INDO = [
	'Januari',
	'Februari',
	'Maret',
	'April',
	'Mei',
	'Juni',
	'Juli',
	'Agustus',
	'September',
	'Oktober',
	'November',
	'Desember'
] as const;

/**
 * Mengambil nama hari bahasa Indonesia (0 = Ahad s/d 6 = Sabtu)
 */
export function getNamaHari(hariIndex: number): string {
	return NAMA_HARI_INDO[hariIndex % 7] || 'Ahad';
}

/**
 * Menghitung urutan minggu keberapa suatu hari dalam bulan kalender (1 s/d 5)
 * Formula: Math.floor((d.getDate() - 1) / 7) + 1
 */
export function getMingguKe(dateInput: string | Date): number {
	const d = typeof dateInput === 'string' ? new Date(`${dateInput}T00:00:00`) : dateInput;
	if (isNaN(d.getTime())) return 1;
	return Math.floor((d.getDate() - 1) / 7) + 1;
}

/**
 * Format tanggal Indonesia lengkap dengan nama hari
 * Contoh: "Ahad, 18 Oktober 2026"
 */
export function formatDateIndoFull(dateInput: string | Date | null | undefined): string {
	if (!dateInput) return '-';
	const cleanStr = typeof dateInput === 'string' ? dateInput.split('T')[0] : '';
	const d = cleanStr ? new Date(`${cleanStr}T00:00:00`) : new Date(dateInput);
	if (isNaN(d.getTime())) return String(dateInput);

	const namaHari = NAMA_HARI_INDO[d.getDay()];
	const tgl = d.getDate();
	const bln = NAMA_BULAN_INDO[d.getMonth()];
	const thn = d.getFullYear();
	return `${namaHari}, ${tgl} ${bln} ${thn}`;
}

export interface JadwalReminderInput {
	namaKegiatan: string;
	tingkatScope: 'Desa' | 'Kelompok' | string;
	lingkupNama?: string; // misal "Desa Kebayoran" atau "Kelompok 1"
	tanggal: string; // YYYY-MM-DD
	jamMulai: string; // HH:mm
	jamSelesai?: string | null;
	lokasiNama?: string | null;
	gmapsUrl?: string | null;
	detailMateri?: string | null;
	isOverride?: boolean;
	status?: 'aktif' | 'libur' | 'dibatalkan' | string;
	catatanTambahan?: string | null;
}

/**
 * Menghasilkan template teks pengingat WhatsApp yang siap dikirim ke Group atau Japri
 */
export function formatWhatsAppReminder(data: JadwalReminderInput): string {
	const tglFormatted = formatDateIndoFull(data.tanggal);
	const scopeLabel = data.tingkatScope === 'Desa' ? 'DESA' : 'KELOMPOK';
	const scopeNama = data.lingkupNama ? ` ${data.lingkupNama.toUpperCase()}` : '';

	const jamText = data.jamSelesai
		? `${data.jamMulai} - ${data.jamSelesai} WIB`
		: `${data.jamMulai} WIB s/d selesai`;

	let header = `*📢 PENGINGAT PENGAJIAN ${scopeLabel}${scopeNama}*`;
	if (data.status === 'libur') {
		header = `*⚠️ PEMBERITAHUAN LIBUR PENGAJIAN ${scopeLabel}${scopeNama}*`;
	} else if (data.status === 'dibatalkan') {
		header = `*❌ PEMBERITAHUAN PEMBATALAN PENGAJIAN ${scopeLabel}${scopeNama}*`;
	}

	let body = `${header}\n\n`;
	body += `Assalamu'alaikum Warahmatullahi Wabarakatuh.\n\n`;

	if (data.status === 'libur') {
		body += `Menginformasikan bahwa kegiatan pengajian pada:\n`;
		body += `📅 *Hari, Tanggal:* ${tglFormatted}\n`;
		body += `📌 *Agenda:* ${data.namaKegiatan}\n\n`;
		body += `*DILIBURKAN* sesuai jadwal rutin bulanan / permusyawaratan.\n`;
	} else if (data.status === 'dibatalkan') {
		body += `Menginformasikan bahwa kegiatan pengajian pada:\n`;
		body += `📅 *Hari, Tanggal:* ${tglFormatted}\n`;
		body += `📌 *Agenda:* ${data.namaKegiatan}\n\n`;
		body += `*DIBATALKAN* dikarenakan ada kendala atau udzur syar'i.\n`;
	} else {
		body += `Mengingatkan seluruh jamaah untuk hadir dalam pengajian insya Allah:\n\n`;
		body += `📌 *Kegiatan:* ${data.namaKegiatan}\n`;
		body += `📅 *Hari, Tanggal:* ${tglFormatted}\n`;
		body += `⏰ *Waktu:* ${jamText}\n`;
		body += `📍 *Tempat / Lokasi:* ${data.lokasiNama || 'Tempat Biasa / Masjid Kelompok'}\n`;

		if (data.gmapsUrl && data.gmapsUrl.trim()) {
			body += `🗺️ *Peta Lokasi:* ${data.gmapsUrl.trim()}\n`;
		}

		if (data.detailMateri && data.detailMateri.trim()) {
			body += `\n📖 *Rincian Materi Pengajian:*\n`;
			// Format multiline materi dengan bullet points jika belum ada
			const materiLines = data.detailMateri
				.split('\n')
				.map((line) => line.trim())
				.filter(Boolean);
			for (const line of materiLines) {
				if (line.startsWith('-') || line.startsWith('•') || line.startsWith('*')) {
					body += `${line}\n`;
				} else {
					body += `- ${line}\n`;
				}
			}
		}

		if (data.isOverride) {
			body += `\n💡 _Catatan: Terdapat penyesuaian/perubahan materi khusus untuk jadwal sesi ini._\n`;
		}
	}

	if (data.catatanTambahan && data.catatanTambahan.trim()) {
		body += `\n📝 *Catatan Khusus:*\n${data.catatanTambahan.trim()}\n`;
	}

	body += `\n_Diharapkan hadir tepat waktu dengan niat karena Allah ta'ala. Alhamdulillah jazakumullohu khoiro._\n`;
	body += `Wassalamu'alaikum Warahmatullahi Wabarakatuh.`;

	return body;
}

/**
 * Menghasilkan link tautan WhatsApp (wa.me)
 */
export function generateWhatsAppLink(pesan: string, noTelepon?: string | null): string {
	let cleanPhone = '';
	if (noTelepon) {
		cleanPhone = noTelepon.replace(/\D/g, '');
		if (cleanPhone.startsWith('0')) {
			cleanPhone = `62${cleanPhone.slice(1)}`;
		}
	}
	const textEncoded = encodeURIComponent(pesan);
	return cleanPhone ? `https://wa.me/${cleanPhone}?text=${textEncoded}` : `https://wa.me/?text=${textEncoded}`;
}

/**
 * Menghasilkan daftar tanggal YYYY-MM-DD dalam suatu bulan yang cocok dengan template pengajian
 */
export function hitungTanggalSesiBulanan(options: {
	year: number;
	month: number; // 1 s/d 12
	tipePola: 'mingguan_ke' | 'hari_rutin' | string;
	hari: number; // 0 = Ahad s/d 6 = Sabtu
	mingguKe?: number | null; // 1 s/d 5 (wajib jika mingguan_ke)
}): string[] {
	const hasilTanggal: string[] = [];
	const { year, month, tipePola, hari, mingguKe } = options;

	// Total hari dalam bulan tersebut
	const totalHari = new Date(year, month, 0).getDate();

	for (let tgl = 1; tgl <= totalHari; tgl++) {
		const current = new Date(year, month - 1, tgl);
		if (current.getDay() === hari) {
			if (tipePola === 'mingguan_ke') {
				const mKe = Math.floor((tgl - 1) / 7) + 1;
				if (mKe === mingguKe) {
					const yStr = String(year);
					const mStr = String(month).padStart(2, '0');
					const dStr = String(tgl).padStart(2, '0');
					hasilTanggal.push(`${yStr}-${mStr}-${dStr}`);
				}
			} else {
				// Pola hari rutin mingguan (tiap hari tersebut)
				const yStr = String(year);
				const mStr = String(month).padStart(2, '0');
				const dStr = String(tgl).padStart(2, '0');
				hasilTanggal.push(`${yStr}-${mStr}-${dStr}`);
			}
		}
	}

	return hasilTanggal;
}

