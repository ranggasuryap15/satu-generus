# Product Requirements Document (PRD): Satu Generus (MVP)

## 1. Ringkasan Proyek

**Satu Generus** adalah _super app_ berbasis web untuk manajemen operasional dan demografi jamaah. Fase MVP (Minimum Viable Product) berfokus pada pembangunan fondasi data yang solid, sistem sensus terenkripsi, manajemen wilayah hierarkis, dan fitur presensi pengajian.

- **Fokus AI:** Jangan membangun fitur di luar MVP (seperti Modul PPG, Keuangan, atau Saham UB). Fokuskan arsitektur agar _scalable_ untuk modul tersebut di masa depan.

## 2. Tech Stack (Mutlak & Tidak Boleh Diubah)

AI wajib menggunakan _stack_ berikut tanpa _over-engineering_:

- **Framework:** SvelteKit (Fullstack Mode: Frontend UI dan Backend API menggunakan `+page.server.js` atau `+server.js`).
- **Database Engine:** SQLite (Untuk optimalisasi RAM VPS kecil).
- **ORM:** Drizzle ORM.
- **Styling:** Tailwind CSS + shadcn-svelte.
- **Font:** Poppins.
- **Deployment Target:** VPS Ubuntu (Caddy Server + PM2).

## 3. Arsitektur Wilayah & RBAC (Role-Based Access Control)

Sistem menggunakan _Scope-based Role_ untuk menghindari redundansi _database_.

### A. Hierarki Wilayah

Struktur relasi searah dari bawah ke atas: `Kelompok -> Desa -> Daerah -> (Pusat)`.

- Jamaah secara _default_ ditautkan hanya ke `Kelompok`.
- Data `Daerah` terhubung dengan wilayah administratif negara (Provinsi, Kota/Kabupaten).

### B. Dapukan (Jabatan Tetap vs Tentatif)

Sistem mengakomodasi dua jenis jabatan untuk menyeimbangkan standardisasi akses dan fleksibilitas organisasi lokal.

- **Jabatan Tetap (Master Data):** Disimpan secara global (Tabel `dapukan`). Khusus untuk struktur baku seperti 4S (Ketua, Sekretaris, Bendahara, Penasihat). Memiliki parameter `is_4S` (Boolean) untuk menentukan hak akses admin (Elevated Privileges).
- **Jabatan Tentatif/Kustom:** Jabatan yang bersifat lokal, dinamis, atau kepanitiaan sementara (contoh: "Seksi Konsumsi Acara X", "Pendamping PPG"). Disimpan langsung sebagai teks (_free text_) di kolom `nama_dapukan_custom` pada tabel relasi tanpa mengotori Master Data.
- **Logika Akses:** Jika seorang _user_ memiliki relasi ke Master Data 4S di tingkat 'Desa', maka ia memiliki akses CRUD ke seluruh data 'Kelompok' di bawah 'Desa' tersebut. Pengguna yang hanya memiliki jabatan tentatif (`nama_dapukan_custom`) tetap dihitung sebagai pengurus, namun tidak mendapatkan hak akses modifikasi data (_Read-Only_ atau setara Jamaah Biasa).

## 4. Spesifikasi Fitur MVP

### Modul 1: Autentikasi & Otorisasi

- Sistem _login_ menggunakan Nomor HP/Email dan _Password_ (di-_hash_ dengan `bcrypt`).
- Validasi _role/dapukan_ dilakukan di _middleware_ SvelteKit (`hooks.server.js`) untuk memisahkan akses tampilan Admin (Desktop-first) dan Client/Jamaah (Mobile-first).

### Modul 2: Sensus & Manajemen Kartu Keluarga (KK)

- **Input Data:** Form multi-langkah (_wizard_) untuk Kepala Keluarga dan Anggota Keluarga.
- **Keamanan Ekstrem (Enkripsi):**
  - Data NIK dan No. KK **wajib** dienkripsi secara _two-way_ menggunakan `crypto` (Algoritma `AES-256-GCM`) bawaan Node.js di sisi _server_.
  - Tabel database hanya menyimpan `nik_encrypted` dan `no_kk_encrypted` (Ciphertext).
  - Di antarmuka Admin, data ini ditampilkan dengan _masking_ (contoh: `3216**********12`) dan hanya teks aslinya bisa dilihat setelah Admin melakukan verifikasi ulang (klik tombol "Tampilkan").

### Modul 3: Presensi Pengajian

- **Dashboard Kehadiran:** Menampilkan jadwal pengajian per kelompok.
- **Metode Input:**
  1. _Manual Checklist:_ Admin Kelompok memanggil nama dan menandai kehadiran di UI Tabel.
  2. _Mandiri (QR Code):_ Sistem _generate_ QR unik per jamaah. Admin memindai QR tersebut menggunakan kamera _smartphone_ (menggunakan _library_ scanner ringan di _client-side_).

## 5. UI/UX & Design Guidelines (Merujuk pada DESIGN.md)

- **Responsivitas:** Wajib menggunakan _Bottom Navbar_ di _mobile_ (< 768px) dan _Sidebar_ vertikal di _desktop_ (>= 768px).
- **Tema Warna:**
  - Primary: `#1B5E20` (Light) / `#2E7D32` (Dark)
  - Background: `#F8FAFC` (Light) / `#121212` (Dark)
- **Mode Tema:** Deteksi sistem otomatis dengan _toggle switch_ manual (Light/Dark Mode).
- **Interaksi:** Hindari _alert pop-up_ bawaan _browser_. Gunakan _Toast_ untuk sukses/error, dan _Modal/Dialog_ di tengah layar untuk konfirmasi aksi destruktif (Hapus/Simpan Final).

## 6. Ruang Lingkup Masa Depan (Non-MVP)

Siapkan struktur kode agar mudah di-ekspansi untuk:

1. Modul Pembinaan Penggerak Penerus (PPG).
2. Sistem Informasi Keuangan & Iuran.
3. Manajemen Saham Usaha Bersama (UB).
