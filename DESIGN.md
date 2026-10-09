# DESIGN.md: Satu Generus

## 1. Prinsip Desain Utama

- **Client-Facing (Mobile-First):** UI/UX untuk _client_ difokuskan pada ukuran layar _smartphone_. Aksesibilitas menggunakan zona jempol (_thumb zone_).
- **Admin-Facing (Desktop-First):** UI/UX untuk admin difokuskan pada visualisasi data luas, tabel, dan analitik di layar besar.
- **Minimalis & High Legibility:** Penggunaan _whitespace_ yang longgar. Tidak ada elemen dekoratif yang tidak memiliki fungsi.
- **Responsive Navigation:** Seluruh aplikasi menggunakan **Bottom Navbar** saat diakses via _mobile_ (layar < 768px) dan otomatis berubah menjadi **Sidebar** saat diakses via desktop/tablet (layar >= 768px).
- **Single Source of Truth:** Tidak ada duplikasi fitur. Misalnya, detail profil dan form edit disatukan dalam satu layar dengan mode _toggle_, menghindari penumpukan tumpukan navigasi (_navigation stack_).
- **Dropdown Search:** Pada bagian dropdown yang berpotensi akan banyak data, seperti Daerah, Desa, Kelompok, maka buatkan Dropdown Search untuk memudahkan pencarian

## 2. Design Tokens

### A. Tipografi (Poppins)

- **Font Family:** `Poppins`, _sans-serif_. Dipilih karena geometris, bulat, dan sangat mudah dibaca pada layar kecil.
- **Skala Ukuran:**
  - H1 (Judul Halaman): 24px, SemiBold (600).
  - H2 (Judul Kartu/Modal): 18px, Medium (500).
  - Body (Teks Utama): 14px, Regular (400), _Line-height_ 1.6.
  - Caption (Label/Bantuan): 12px, Regular (400).

### B. Mode Tema (Light & Dark Mode)

Sistem wajib mendeteksi preferensi tema perangkat (_system default_) dengan opsi _toggle_ manual.

- **Light Mode:**
  - Background: `#F8FAFC` | Surface (Card): `#FFFFFF`
  - Text: `#0F172A` | Border: `#E2E8F0`
- **Dark Mode:**
  - Background: `#121212` | Surface (Card): `#1E1E1E`
  - Text: `#F1F5F9` | Border: `#334155`
- **Warna Aksi (Sama untuk kedua mode, tingkat kecerahan disesuaikan):**
  - Primary (Hijau): `#1B5E20` (Light) / `#2E7D32` (Dark)
  - Accent (Emas): `#F59E0B` (Light) / `#FBBF24` (Dark)
  - Danger (Merah): `#EF4444`

## 3. Spesifikasi Tata Letak & Navigasi

### A. Navigasi Responsif

- **Mobile Mode (Lebar < 768px):**
  - **Top Bar:** Hanya menampilkan judul halaman, ikon pencarian, dan ikon notifikasi/profil.
  - **Bottom Navbar:** Menampilkan 4-5 menu utama (Beranda, Direktori, [FAB Tambah], Pesan, Profil). Menempel persisten di bawah.
- **Desktop Mode (Lebar >= 768px):**
  - **Sidebar (Kiri):** Bottom Navbar berpindah menjadi Sidebar vertikal yang bisa di-_collapse_. Lebar standar 250px.
  - **Main Content (Kanan):** Area konten memakan sisa ruang layar.

### B. Pemisahan Tampilan Client vs Admin

- **Tampilan Client (Aplikasi Utama):**
  - Berorientasi pada _task_ (mengisi sensus, melihat jadwal, cek status, presensi, d).
  - Menggunakan _Card Layout_ untuk menampilkan data (bukan tabel).
  - Input form menggunakan pendekatan _step-by-step_ (wizard) agar tidak mengintimidasi.
- **Tampilan Admin (Dashboard):**
  - Berorientasi pada rekapitulasi dan manajemen akses.
  - Menggunakan _Data Table_ yang mendukung _sorting_, _filtering_, dan _export/import_.
  - Memiliki halaman visualisasi _chart_ (grafik demografi).

## 4. Standar Interaksi (UX)

- **Kondisi Data Kosong (Empty States):** Selalu tampilkan ilustrasi minimalis dengan satu baris teks penjelasan dan tombol _Call to Action_ (misal: "Belum ada data jamaah. [Tambah Data]").
- **Validasi Form:** Error muncul secara _inline_ di bawah input teks secara _real-time_, bukan menggunakan _alert pop-up_ di akhir.
- **Modal Eksekusi:** Aksi Hapus, Simpan Final, atau _Log Out_ menggunakan modal di tengah layar untuk kedua _device_ (Mobile/Desktop) dengan latar belakang di-blur tipis.
