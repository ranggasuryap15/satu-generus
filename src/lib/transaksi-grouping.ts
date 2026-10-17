/**
 * @file src/lib/transaksi-grouping.ts
 * @purpose Utility modul untuk normalisasi, kalkulasi tanggal, filtering, dan pengelompokan riwayat transaksi per minggu serta per bulan
 * @usedBy src/routes/(app)/transaksi/+page.svelte, src/routes/(app)/transaksi/+page.server.ts
 * @dependencies Tidak ada (pure utility standard JS/TS)
 * @publicFunctions formatRupiah, getNamaBulanIndo, groupTransaksiByBulan, groupTransaksiByMinggu, filterTransaksi
 * @sideEffects Tidak ada (pure utility function)
 */

export interface TransaksiItem {
	id: string;
	kategori: string;
	tanggal: string; // ISO format YYYY-MM-DD
	tanggalStr: string; // e.g. "16 Okt 2026"
	nominal: number;
	type: 'isrun' | 'shodaqoh';
	status?: string;
	keterangan?: string | null;
	href: string;
}

export interface TransaksiGroup {
	key: string;
	title: string;
	subtitle?: string;
	totalNominal: number;
	count: number;
	items: TransaksiItem[];
}

const NAMA_BULAN = [
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
];

const NAMA_BULAN_PENDEK = [
	'Jan',
	'Feb',
	'Mar',
	'Apr',
	'Mei',
	'Jun',
	'Jul',
	'Agu',
	'Sep',
	'Okt',
	'Nov',
	'Des'
];

/**
 * Format angka ke mata uang Rupiah
 */
export function formatRupiah(nominal: number): string {
	return `Rp${(nominal || 0).toLocaleString('id-ID')}`;
}

/**
 * Mengubah index bulan (1-12) atau string YYYY-MM ke nama bulan Indonesia
 */
export function getNamaBulanIndo(monthNum: number, short = false): string {
	const idx = Math.max(0, Math.min(11, monthNum - 1));
	return short ? NAMA_BULAN_PENDEK[idx] : NAMA_BULAN[idx];
}

/**
 * Mengubah string YYYY-MM (misal "2026-10") ke "Oktober 2026"
 */
export function formatYearMonth(ymStr: string): string {
	if (!ymStr || ymStr.length < 7) return ymStr;
	const [year, month] = ymStr.split('-');
	const mNum = parseInt(month, 10);
	return `${getNamaBulanIndo(mNum)} ${year}`;
}

/**
 * Menghitung tanggal Senin & Minggu dari tanggal ISO YYYY-MM-DD
 */
function getWeekRange(dateStr: string): { startISO: string; endISO: string; label: string; weekNum: number } {
	const [y, m, d] = dateStr.split('-').map(Number);
	const targetDate = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));

	// Hari dalam seminggu (0: Minggu, 1: Senin, ..., 6: Sabtu)
	const day = targetDate.getUTCDay();
	const diffToMon = day === 0 ? -6 : 1 - day;

	const mon = new Date(targetDate.getTime() + diffToMon * 86400000);
	const sun = new Date(mon.getTime() + 6 * 86400000);

	const startISO = mon.toISOString().slice(0, 10);
	const endISO = sun.toISOString().slice(0, 10);

	const monDay = mon.getUTCDate();
	const monMonth = getNamaBulanIndo(mon.getUTCMonth() + 1, true);
	const sunDay = sun.getUTCDate();
	const sunMonth = getNamaBulanIndo(sun.getUTCMonth() + 1, true);
	const sunYear = sun.getUTCFullYear();

	let label = '';
	if (monMonth === sunMonth) {
		label = `${String(monDay).padStart(2, '0')} - ${String(sunDay).padStart(2, '0')} ${sunMonth} ${sunYear}`;
	} else {
		label = `${String(monDay).padStart(2, '0')} ${monMonth} - ${String(sunDay).padStart(2, '0')} ${sunMonth} ${sunYear}`;
	}

	// Perkiraan minggu ke berapa dalam bulan target
	const weekNum = Math.min(5, Math.floor((d - 1) / 7) + 1);

	return { startISO, endISO, label, weekNum };
}

/**
 * Mengelompokkan transaksi per bulan (terbaru di paling atas)
 */
export function groupTransaksiByBulan(items: TransaksiItem[]): TransaksiGroup[] {
	const map = new Map<string, TransaksiItem[]>();

	for (const item of items) {
		const monthKey = item.tanggal.slice(0, 7); // "YYYY-MM"
		if (!map.has(monthKey)) {
			map.set(monthKey, []);
		}
		map.get(monthKey)!.push(item);
	}

	const sortedKeys = Array.from(map.keys()).sort((a, b) => b.localeCompare(a));

	return sortedKeys.map((key) => {
		const groupItems = map.get(key)!.sort((a, b) => b.tanggal.localeCompare(a.tanggal));
		const totalNominal = groupItems.reduce((acc, curr) => acc + curr.nominal, 0);

		return {
			key,
			title: formatYearMonth(key),
			subtitle: `${groupItems.length} transaksi`,
			totalNominal,
			count: groupItems.length,
			items: groupItems
		};
	});
}

/**
 * Mengelompokkan transaksi per minggu (terbaru di paling atas)
 */
export function groupTransaksiByMinggu(items: TransaksiItem[]): TransaksiGroup[] {
	const map = new Map<string, { info: ReturnType<typeof getWeekRange>; items: TransaksiItem[] }>();

	for (const item of items) {
		const weekInfo = getWeekRange(item.tanggal);
		const weekKey = `${weekInfo.startISO}_${weekInfo.endISO}`;

		if (!map.has(weekKey)) {
			map.set(weekKey, { info: weekInfo, items: [] });
		}
		map.get(weekKey)!.items.push(item);
	}

	const sortedKeys = Array.from(map.keys()).sort((a, b) => b.localeCompare(a));

	return sortedKeys.map((key) => {
		const entry = map.get(key)!;
		const groupItems = entry.items.sort((a, b) => b.tanggal.localeCompare(a.tanggal));
		const totalNominal = groupItems.reduce((acc, curr) => acc + curr.nominal, 0);

		return {
			key,
			title: entry.info.label,
			subtitle: `Minggu Ke-${entry.info.weekNum} · ${groupItems.length} transaksi`,
			totalNominal,
			count: groupItems.length,
			items: groupItems
		};
	});
}

/**
 * Memfilter transaksi berdasarkan kategori, periode waktu, dan pencarian teks
 */
export function filterTransaksi(
	items: TransaksiItem[],
	filters: {
		kategori?: 'all' | 'isrun' | 'shodaqoh';
		periode?: 'all' | 'bulan-ini' | 'bulan-lalu' | string;
		search?: string;
	}
): TransaksiItem[] {
	const todayISO = new Date().toISOString().slice(0, 10);
	const currentMonthKey = todayISO.slice(0, 7);

	// Hitung bulan lalu
	const d = new Date();
	d.setMonth(d.getMonth() - 1);
	const lastMonthKey = d.toISOString().slice(0, 7);

	const searchLower = filters.search?.toLowerCase().trim() || '';

	return items.filter((item) => {
		// Filter Kategori
		if (filters.kategori && filters.kategori !== 'all') {
			if (item.type !== filters.kategori) return false;
		}

		// Filter Periode Waktu
		if (filters.periode && filters.periode !== 'all') {
			const itemMonth = item.tanggal.slice(0, 7);
			if (filters.periode === 'bulan-ini' && itemMonth !== currentMonthKey) return false;
			if (filters.periode === 'bulan-lalu' && itemMonth !== lastMonthKey) return false;
			if (filters.periode.length === 7 && itemMonth !== filters.periode) return false;
		}

		// Filter Pencarian Teks
		if (searchLower) {
			const matchKategori = item.kategori.toLowerCase().includes(searchLower);
			const matchKet = item.keterangan?.toLowerCase().includes(searchLower) || false;
			const matchDate = item.tanggalStr.toLowerCase().includes(searchLower);
			const matchNominal = String(item.nominal).includes(searchLower);
			if (!matchKategori && !matchKet && !matchDate && !matchNominal) return false;
		}

		return true;
	});
}

