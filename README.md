# Satu Generus (Super App - Tahap MVP)

**Satu Generus** adalah platform web aplikasi manajemen operasional dan demografi jamaah berkinerja tinggi. Dibangun dengan pendekatan *Mobile-First* untuk antarmuka jamaah dan *Desktop-First* untuk dashboard pengurus, proyek ini menerapkan standar keamanan ketat melalui enkripsi dua arah pada data kependudukan sensitif.

---

## 🚀 Tech Stack

- **Framework:** SvelteKit (Fullstack mode dengan Svelte 5 Runes: `$state`, `$derived`, `$props`)
- **Styling:** Tailwind CSS v4 + token warna tema adaptif (*Dark/Light Mode*)
- **Database Engine:** SQLite (`better-sqlite3` dalam mode Write-Ahead Logging / WAL)
- **ORM & Migrasi:** Drizzle ORM + Drizzle Kit
- **Kriptografi:** Node.js Native `crypto` (AES-256-GCM) dengan *Zero Plaintext Policy*
- **Lingkungan Dev:** Docker & Docker Compose (Volume persisten `./data:/data`)
- **Tipografi:** Google Fonts Poppins

---

## 🏛️ Arsitektur & Fitur Utama MVP

### 1. Autentikasi & RBAC Middleware
- Login terpusat via Email atau Nomor HP dengan hashing kata sandi `bcrypt`.
- Cookie session terenkripsi `httpOnly`, `sameSite=lax`, `secure`.
- Route protection guard di `src/hooks.server.ts` membatasi akses zona `/admin/*` hanya untuk pengguna dengan wewenang pengurus 4S (Ketua, Sekretaris, Bendahara, Penasihat) atau tingkat Pusat.

### 2. Sensus & Manajemen Kartu Keluarga (KK) Terenkripsi
- Form multi-langkah (*wizard*) untuk input Kepala Keluarga dan Anggota Keluarga.
- **Enkripsi AES-256-GCM:** NIK dan No. KK dienkripsi di sisi server sebelum disimpan ke database SQLite.
- **Masking & Akses Terkontrol:** NIK/KK ditampilkan dalam bentuk masked (`3216**********12`). Plaintext hanya dapat dibuka oleh Admin melalui endpoint terproteksi `POST /api/sensus/unmask`.

### 3. Presensi Pengajian (QR Code & Checklist Manual)
- **Sisi Jamaah (`/presensi`):** Render QR code unik berbasis token `SGQR:<userId>:<kelompokId>` serta log riwayat kehadiran.
- **Sisi Admin (`/admin/presensi`):**
  - Pembuatan agenda jadwal pengajian per kelompok.
  - Pilihan verifikasi: **Checklist Manual** atau **Pemindai Kamera QR** (`html5-qrcode`) dengan audio-visual feedback.

### 4. Hierarki Wilayah & Manajemen Dapukan (RBAC)
- **Hierarki Wilayah (`/admin/wilayah`):** Relasi terstruktur 3-tingkat: `Daerah -> Desa -> Kelompok` dengan agregasi jumlah populasi jamaah.
- **Dapukan & RBAC (`/admin/dapukan`):** Mendukung dua tipe jabatan:
  - *Jabatan Baku Master (4S):* Memiliki parameter elevated privileges untuk hak modifikasi CRUD.
  - *Jabatan Tentatif/Panitia Kustom:* Jabatan dinamis lokal tanpa mengotori master data global.

### 5. UI/UX & Desain Responsif
- **Client (Jamaah):** Tampilan mobile dengan Bottom Navbar, Card Layout, dan Quick Action.
- **Admin (Pengurus):** Sidebar vertikal desktop yang otomatis disembunyikan pada layar mobile (`< 768px`) dan dapat dibuka melalui *slide-over drawer* dengan tombol menu hamburger.
- **Tema:** Dukungan tema terang (*Light*) dan gelap (*Dark*) terintegrasi dengan tombol toggle di header.

---

## 💻 Panduan Menjalankan Aplikasi

### Menjalankan dengan Docker (Direkomendasikan)

Pastikan Docker telah terpasang, lalu jalankan:

```bash
docker compose up -d
```

Aplikasi akan otomatis berjalan di port `5173`.
Buka peramban di: **[http://localhost:5173](http://localhost:5173)**

### Menjalankan secara Lokal di Host

```bash
# 1. Install dependencies
npm install

# 2. Jalankan migrasi dan seeder awal
npm run db:migrate
npm run db:seed

# 3. Mulai server development
npm run dev
```

---

## 🔑 Kredensial Akun Pengujian Bawaan

Database telah diisi data *seed* awal untuk kebutuhan pengujian:

| Role / Wewenang | Email / No HP | Kata Sandi | Halaman Utama |
| :--- | :--- | :--- | :--- |
| **Admin Pengurus (4S Desa)** | `admin@satugenerus.id` | `password123` | [Panel Admin](http://localhost:5173/admin) |
| **Jamaah Biasa** | `jamaah@satugenerus.id` | `password123` | [Beranda Jamaah](http://localhost:5173/) |

---

## 🔌 Koneksi Database GUI (dbx / DBeaver / Drizzle Studio)

File SQLite disimpan pada folder `./data/sqlite.db` (di-mount ke `/data/sqlite.db` di container):

1. **Menggunakan dbx / SQLite Client di VS Code / IDE:**
   - Driver: `SQLite`
   - File Path: `/absolute/path/to/satu-generus/data/sqlite.db` (atau `./data/sqlite.db`)
   - Host/User/Port/Pass: *Kosongkan*
2. **Menggunakan Drizzle Studio:**
   ```bash
   npm run db:studio
   ```
   Akses antarmuka web di [https://local.drizzle.studio](https://local.drizzle.studio).

---

## 🧪 Validasi & Kualitas Kode

- **Type Check:** `npm run check` (0 errors, 0 warnings)
- **Production Build:** `npm run build` (lulus build produksi Vite)
- **Dokumentasi Kode:** Seluruh modul dan komponen dilengkapi dengan standard header documentation.
