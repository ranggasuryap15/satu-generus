# Satu Generus (Super App - Tahap MVP)

**Satu Generus** adalah platform web aplikasi manajemen operasional dan demografi jamaah berkinerja tinggi. Dibangun dengan pendekatan *Mobile-First* untuk antarmuka jamaah dan *Desktop-First* untuk dashboard pengurus, proyek ini menerapkan standar keamanan ketat melalui enkripsi dua arah pada data kependudukan sensitif.

---

## 🚀 Tech Stack

- **Framework:** SvelteKit (Fullstack mode dengan Svelte 5 Runes: `$state`, `$derived`, `$props`)
- **Styling:** Tailwind CSS v4 + token warna tema adaptif (*Dark/Light Mode*)
- **Database Engine:** PostgreSQL 16 (driver `postgres-js` dengan connection pool)
- **ORM & Migrasi:** Drizzle ORM (`drizzle-orm/pg-core`) + Drizzle Kit
- **Kriptografi:** Node.js Native `crypto` (AES-256-GCM) dengan *Zero Plaintext Policy*
- **Lingkungan Dev:** Docker & Docker Compose (service `postgres` + `app`, volume persisten `pgdata` dan `./uploads`)
- **Tipografi:** Google Fonts Poppins

---

## 🏛️ Arsitektur & Fitur Utama MVP

### 1. Autentikasi & RBAC Middleware
- Login terpusat via Email atau Nomor HP dengan hashing kata sandi `bcrypt`.
- Cookie session terenkripsi `httpOnly`, `sameSite=lax`, `secure`.
- Route protection guard di `src/hooks.server.ts` membatasi akses zona `/admin/*` hanya untuk pengguna dengan wewenang pengurus 4S (Ketua, Sekretaris, Bendahara, Penasihat) atau tingkat Pusat.

### 2. Sensus & Manajemen Kartu Keluarga (KK) Terenkripsi
- Form multi-langkah (*wizard*) untuk input Kepala Keluarga dan Anggota Keluarga.
- **Enkripsi AES-256-GCM:** NIK dan No. KK dienkripsi di sisi server sebelum disimpan ke database PostgreSQL.
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
# Build image + jalankan app (dev) dan PostgreSQL
docker compose up -d --build

# Jalankan migrasi & seeder (sekali saja / saat ada migrasi baru)
docker exec satu-generus-dev npm run db:migrate
docker exec satu-generus-dev npm run db:seed
```

Aplikasi akan otomatis berjalan di port `5173`.
Buka peramban di: **[http://localhost:5173](http://localhost:5173)**

> ⚠️ **Jangan jalankan `npm run build` di dalam folder project saat dev
> container sedang hidup.** Perintah `npm run build` menulis ulang folder
> `.svelte-kit/generated` (dari `dev/` menjadi `build/`). Folder `.svelte-kit`
> sudah diisolasi sebagai anonymous volume sehingga aman, tetapi bila Anda
> mengubah volume di `docker-compose.yml`, hapus volume runtime lama agar
> tidak basi:
>
> ```bash
> docker compose down
> docker volume ls | grep -E "satu-generus.*(node_modules|svelte)"   # cek
> docker compose up -d --build
> ```
>
> **Jika `node_modules` container basi** (mis. setelah ganti dependency
> seperti SQLite ke PostgreSQL), muncul error
> `Cannot find package '...' imported from ...`. Perbaiki dengan menghapus
> container + volume node_modules-nya:
>
> ```bash
> docker compose down
> docker rm -f satu-generus-dev
> docker volume rm $(docker volume ls -q --filter name=satu-generus | grep -v pgdata)
> docker compose up -d --build
> ```
>
> Data PostgreSQL pada volume `satu-generus_pgdata` **tidak terpengaruh**.

### Menjalankan secara Lokal di Host

```bash
# 1. Install dependencies
npm install

# 2. Nyalakan PostgreSQL (Docker)
docker compose -f docker-compose.dev.yml up -d

# 3. Jalankan migrasi dan seeder awal
npm run db:migrate
npm run db:seed

# 4. Mulai server development
npm run dev
```

---

## 🔑 Kredensial Awal

Seeder hanya membuat **satu akun** (tidak ada data demo):

| Role / Wewenang | Email | Kata Sandi | Halaman Utama |
| :--- | :--- | :--- | :--- |
| **Superadmin** | `superadmin@satugenerus.id` | `password123` | [Panel Admin](http://localhost:5173/admin) |

> ⚠️ **Wajib ganti kata sandi** setelah login pertama (menu Profil → Ganti Sandi).
>
> Seeder **tidak** mengisi data wilayah. Setelah login, buat **Daerah → Desa → Kelompok** sendiri
> lewat menu **Data Wilayah**, lalu daftarkan pengurus lewat **Dapukan & RBAC**.
>
> Superadmin juga dapat memindahkan kelompok akunnya sendiri dari halaman **Profil → Lingkup Kelompok → Pindah**.
> Admin Daerah/Desa/Kelompok tidak memiliki hak ini karena terikat pada wilayahnya.

---

## 🔌 Koneksi Database GUI (dbx / DBeaver / Drizzle Studio)

Database PostgreSQL berjalan sebagai service `postgres` pada Docker Compose (default `localhost:5432`):

1. **Menggunakan dbx / DBeaver / PostgreSQL Client di VS Code / IDE:**
   - Driver: `PostgreSQL`
   - Host: `localhost` | Port: `5432`
   - Database: `satu_generus` | User: `satu_generus` | Password: `satu_generus`
2. **Menggunakan `psql` (via container):**
   ```bash
   docker compose exec postgres psql -U satu_generus -d satu_generus
   ```
3. **Menggunakan Drizzle Studio:**
   ```bash
   npm run db:studio
   ```
   Akses antarmuka web di [https://local.drizzle.studio](https://local.drizzle.studio).

---

## 🧪 Validasi & Kualitas Kode

- **Type Check:** `npm run check` (0 errors, 0 warnings)
- **Production Build:** `npm run build` (lulus build produksi Vite)
- **Dokumentasi Kode:** Seluruh modul dan komponen dilengkapi dengan standard header documentation.
