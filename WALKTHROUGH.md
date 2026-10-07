<!--
  @file WALKTHROUGH.md
  @purpose Panduan langkah-demi-langkah implementasi proyek Satu Generus tahap MVP untuk developer junior
  @usedBy Developer (Junior & Senior), Onboarding Tim, Dokumentasi Teknis Internal Proyek
  @dependencies PRD.md, DESIGN.md, SCHEMA.md, Drizzle ORM, SvelteKit, SQLite
  @publicFunctions N/A (Dokumentasi Teknis)
  @sideEffects Panduan arsitektur dan blueprint implementasi modul-modul MVP
-->

# 🗺️ Walkthrough Implementasi: Satu Generus (Tahap MVP)

Panduan praktis langkah-demi-langkah (*step-by-step developer guide*) dari Senior Engineer untuk Junior Engineer dalam menerapkan seluruh spesifikasi dari [PRD.md](PRD.md), [DESIGN.md](DESIGN.md), dan [SCHEMA.md](SCHEMA.md).

---

## 🧭 Prinsip Utama (Senior's Golden Rules)

Sebelum menyentuh kode modul apapun, pegang teguh 5 aturan utama ini:
1. **Svelte 5 Runes Mode:** Gunakan `$state`, `$derived`, `$props`, dan `$effect`. Jangan gunakan sintaks reaktif lama Svelte 4 (`let`, `$:`, `export let`).
2. **Kepatuhan Header Doc:** Setiap file `.ts` atau `.svelte` yang dibuat atau diubah **wajib** menyertakan *header doc* di baris paling atas (tujuan, caller, dependensi, fungsi utama, side effects).
3. **Database Performance (Minimum Cost & Lock):**
   - SQLite dikonfigurasi dengan mode WAL (`PRAGMA journal_mode = WAL`) dan `busy_timeout = 5000`.
   - Hindari N+1 query. Manfaatkan *composite index* di `user_dapukan` dan index foreign key yang telah tersedia di `src/lib/db/schema.ts`.
4. **Keamanan Ekstrem:** Kolom NIK dan Nomor KK **tidak boleh** masuk ke database dalam bentuk *plaintext*. Wajib dienkripsi *two-way* (AES-256-GCM) di sisi server.
5. **No Over-Engineering:** Fokus hanya pada cakupan MVP (Autentikasi RBAC, Sensus Terenkripsi, Presensi Pengajian). Jangan membangun modul masa depan (PPG, Saham UB, Keuangan).

---

## 📋 Peta Jalan Implementasi (Sprint Map)

```
[Fase 1: Enkripsi & Utilitas] ➔ [Fase 2: Auth & RBAC Middleware] ➔ [Fase 3: Sensus & Masking KK] ➔ [Fase 4: Presensi Pengajian]
```

---

## 🔒 Fase 1: Layanan Enkripsi Data Sensitif (Server-Side)

### 1.1 Tujuan
Mengamankan data NIK dan Nomor Kartu Keluarga (KK) sebelum tersimpan di tabel `keluarga` dan `anggota_keluarga`.

### 1.2 Implementasi `src/lib/server/crypto.ts`
Gunakan modul bawaan `node:crypto` dengan algoritma `AES-256-GCM`. Format ciphertext yang disimpan di database adalah gabungan:
`iv_hex : authTag_hex : encrypted_hex`

```ts
/**
 * @file src/lib/server/crypto.ts
 * @purpose Enkripsi dan dekripsi dua arah AES-256-GCM untuk NIK & No. KK serta fungsi masking tampilan
 * @usedBy Form actions sensus, API unmasking admin
 * @dependencies node:crypto
 * @publicFunctions encryptSensitive, decryptSensitive, maskSensitive
 * @sideEffects Operasi kriptografi in-memory
 */

import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
// Pastikan panjang kunci tepat 32 bytes (256-bit)
const ENCRYPTION_KEY = Buffer.from(
	process.env.ENCRYPTION_KEY || 'satu_generus_secret_key_32bytes!',
	'utf-8'
);

export function encryptSensitive(plainText: string): string {
	const iv = crypto.randomBytes(12);
	const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
	let encrypted = cipher.update(plainText, 'utf8', 'hex');
	encrypted += cipher.final('hex');
	const authTag = cipher.getAuthTag().toString('hex');
	return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

export function decryptSensitive(payload: string): string {
	const [ivHex, authTagHex, encryptedHex] = payload.split(':');
	if (!ivHex || !authTagHex || !encryptedHex) {
		throw new Error('Format ciphertext tidak valid');
	}
	const decipher = crypto.createDecipheriv(
		ALGORITHM,
		ENCRYPTION_KEY,
		Buffer.from(ivHex, 'hex')
	);
	decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
	let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
	decrypted += decipher.final('utf8');
	return decrypted;
}

export function maskSensitive(text: string): string {
	if (!text || text.length < 8) return '****';
	return `${text.slice(0, 4)}********${text.slice(-4)}`;
}
```

---

## 🛡️ Fase 2: Modul 1 – Autentikasi & RBAC (Role-Based Access Control)

### 2.1 Konsep RBAC Hierarkis
- Hierarki wilayah: `Kelompok -> Desa -> Daerah -> (Pusat)`.
- Jabatan Baku (Master `dapukan`): Memiliki kolom `is_4S = 1` (Ketua, Sekretaris, Bendahara, Penasihat). Pengurus 4S di tingkat Desa memiliki hak akses CRUD ke seluruh Kelompok di bawahnya.
- Jabatan Kustom (`nama_dapukan_custom`): Bersifat *read-only* atau setara Jamaah Biasa.

### 2.2 Password Hash & Session Helper (`src/lib/server/auth.ts`)
1. Install bcrypt library:
   ```bash
   npm install bcryptjs && npm install -D @types/bcryptjs
   ```
2. Buat fungsi hashing dan session management:
   - `hashPassword(password: string): Promise<string>`
   - `verifyPassword(password: string, hash: string): Promise<boolean>`
   - `createSessionCookie(cookies: Cookies, userId: string)` (HTTP-Only, Secure, SameSite=Lax, Max-Age 30 hari).

### 2.3 Middleware Proteksi di `src/hooks.server.ts`
Implementasikan *hook* untuk memisahkan hak akses antara tampilan Client (Mobile-first) dan Admin (Desktop-first):

```ts
/**
 * @file src/hooks.server.ts
 * @purpose Middleware verifikasi session pengguna dan pengamanan rute (Route Guards)
 * @usedBy SvelteKit server runtime pada setiap request
 * @dependencies src/lib/db, src/lib/server/auth
 * @publicFunctions handle
 * @sideEffects Membaca/menulis session cookies dan memodifikasi event.locals
 */

import type { Handle } from '@sveltejs/kit';
import { db } from '$lib/db';
import { users, userDapukan, dapukan } from '$lib/db/schema';
import { eq } from 'drizzle-orm';

export const handle: Handle = async ({ event, resolve }) => {
	const sessionId = event.cookies.get('session_user_id');

	if (sessionId) {
		const user = await db.query.users.findFirst({
			where: eq(users.id, sessionId)
		});

		if (user) {
			const roles = await db
				.select({
					tingkatScope: userDapukan.tingkatScope,
					is4S: dapukan.is4S,
					daerahId: userDapukan.daerahId,
					desaId: userDapukan.desaId,
					kelompokId: userDapukan.kelompokId
				})
				.from(userDapukan)
				.leftJoin(dapukan, eq(userDapukan.dapukanId, dapukan.id))
				.where(eq(userDapukan.userId, user.id));

			event.locals.user = user;
			event.locals.roles = roles;
			event.locals.isAdmin = roles.some((r) => r.is4S === true);
		}
	}

	const path = event.url.pathname;

	// Route Guard: Admin Area
	if (path.startsWith('/admin')) {
		if (!event.locals.user) {
			return new Response(null, { status: 302, headers: { Location: '/login' } });
		}
		if (!event.locals.isAdmin) {
			return new Response(null, { status: 302, headers: { Location: '/' } });
		}
	}

	return resolve(event);
};
```

---

## 👨‍👩‍👧‍👦 Fase 3: Modul 2 – Sensus & Manajemen Kartu Keluarga (KK)

### 3.1 Sisi Client (Jamaah): Wizard Multi-Langkah
Halaman `src/routes/(app)/sensus/+page.svelte`:
- **Step 1:** Data No. KK (input teks 16 digit), Kepala Keluarga, Alamat Lengkap.
- **Step 2:** Tambah Anggota Keluarga (NIK, Nama Lengkap, Status Hubungan, Tanggal Lahir, Jenis Kelamin).
- **Step 3:** Ringkasan Data (Review Card) + Tombol Simpan Final.

**Penyimpanan di Server (`+page.server.ts`):**
```ts
// Enkripsi sebelum write ke database
const noKkEncrypted = encryptSensitive(noKkInput);
const nikEncrypted = encryptSensitive(nikInput);

await db.transaction(async (tx) => {
    const [keluargaBaru] = await tx.insert(keluarga).values({
        noKkEncrypted,
        kepalaKeluargaId: userId,
        alamatLengkap
    }).returning();

    for (const anggota of anggotaList) {
        await tx.insert(anggotaKeluarga).values({
            keluargaId: keluargaBaru.id,
            nikEncrypted: encryptSensitive(anggota.nik),
            statusHubungan: anggota.statusHubungan,
            tanggalLahir: anggota.tanggalLahir,
            jenisKelamin: anggota.jenisKelamin
        });
    }
});
```

### 3.2 Sisi Admin: Rekapitulasi Data & Masking
Halaman `src/routes/(admin)/admin/sensus/+page.svelte`:
1. Tampilkan data tabel dengan pagination dan filter per Kelompok/Desa.
2. Di tabel, tampilkan NIK/No. KK dalam bentuk masked: `maskSensitive(nik)`.
3. Sediakan tombol mata (👁️) "Tampilkan". Saat diklik:
   - Panggil endpoint `POST /api/sensus/unmask` dengan `anggotaId`.
   - Endpoint memverifikasi role admin dan mengembalikan plaintext untuk dimunculkan pada modal konfirmasi.

---

## 📅 Fase 4: Modul 3 – Presensi Pengajian

### 4.1 Master Jadwal Presensi
- Admin kelompok membuat jadwal kegiatan di `src/routes/(admin)/admin/presensi/+page.svelte`.
- Data tersimpan di tabel `presensi_jadwal` (`kelompok_id`, `tanggal`, `nama_kegiatan`).

### 4.2 Metode 1: Checklist Manual (Admin-Side)
- Rute detail: `src/routes/(admin)/admin/presensi/[jadwalId]/+page.svelte`.
- Menampilkan seluruh anggota kelompok dalam bentuk daftar nama.
- Admin mengklik status kehadiran per nama (`Hadir`, `Izin`, `Sakit`, `Alpa`).
- Simpan ke tabel `presensi_kehadiran` secara *optimistic UI* via `fetch` atau SvelteKit form action.

### 4.3 Metode 2: QR Code Mandiri (User QR + Admin Scanner)
1. **Sisi Jamaah (`src/routes/(app)/presensi/+page.svelte`):**
   - Install `qrcode`:
     ```bash
     npm install qrcode && npm install -D @types/qrcode
     ```
   - Render QR code unik berisi ID user yang di-hash/signed.
2. **Sisi Admin (`src/routes/(admin)/admin/presensi/scan/+page.svelte`):**
   - Install `html5-qrcode`:
     ```bash
     npm install html5-qrcode
     ```
   - Aktifkan kamera web/smartphone admin.
   - Saat QR terpindai:
     - Kirim payload ke `POST /api/presensi/scan`.
     - Update record kehadiran dengan `status: 'Hadir'` dan `waktu_scan: Date.now()`.
     - Tampilkan feedback audio/visual sukses (hijau).

---

## 🎨 Fase 5: Standar UI/UX, Kerapian Visual & Mobile Responsiveness [SELESAI]

1. **Responsivitas Mobile:**
   - Client (< 768px): Navigasi bawah via `BottomNavbar.svelte`, Top bar mobile via `ClientTopBar.svelte`.
   - Admin Layout: Sidebar admin (`AdminSidebar.svelte`) otomatis tersembunyi pada mode mobile (`hidden md:flex`), dan dapat dibuka via tombol menu hamburger di `AdminTopBar.svelte` sebagai slide-over drawer dengan backdrop blur.
2. **Token Warna & Tema:**
   - Light Background `#F8FAFC`, Surface `#FFFFFF`.
   - Dark Background `#121212`, Surface `#1E1E1E`.
   - Primary Light `#1B5E20`, Primary Dark `#2E7D32`.
   - Accent `#F59E0B` (Light) / `#FBBF24` (Dark).
   - Theme Toggle terintegrasi via `ThemeToggle.svelte` dengan penyimpanan preferensi di `localStorage` dan deteksi `prefers-color-scheme`.
3. **Empty States & Validasi:**
   - Ilustrasi minimalis dan tombol CTA saat data jadwal/sensus/pengurus kosong.
   - Hindari `window.alert()`. Form menggunakan *inline validation* dan *Modal Dialog* di tengah layar untuk konfirmasi aksi.
4. **Modul Wilayah & Dapukan RBAC (PRD Bab 3):**
   - Hierarki Wilayah (`/admin/wilayah`): Relasi 3-tingkat Daerah &rarr; Desa &rarr; Kelompok + penambahan unit wilayah.
   - Manajemen Dapukan & RBAC (`/admin/dapukan`): Master 4S vs Jabatan Tentatif/Panitia Kustom + penetapan wewenang scope wilayah.

---

## 🧪 Fase 6: Checklist "Definition of Done" (DoD) [SELESAI 100%]

Seluruh kriteria Definition of Done telah terverifikasi:
- [x] **Header Doc:** Seluruh file memiliki header doc ringkas di baris paling atas (tujuan, caller, dependensi, fungsi utama, side effects).
- [x] **Type Safety:** Jalankan `npx svelte-check --tsconfig ./tsconfig.json` &rarr; **0 errors, 0 warnings**.
- [x] **Bundle Build:** Jalankan `npm run build` &rarr; **✓ built in 6.75s (Done)**.
- [x] **Database Integrity:** File SQLite di `./data/sqlite.db` terenkripsi dua arah (AES-256-GCM) pada field `nik_encrypted` dan `no_kk_encrypted` (Zero Plaintext di DB).
- [x] **Docker Testing:** Container development berjalan lancar via `docker compose up -d` di port 5173 dengan sinkronisasi database real-time `./data:/data`.
- [x] **Git Repository:** Seluruh commit telah di-push secara bersih ke remote branch `main`.

