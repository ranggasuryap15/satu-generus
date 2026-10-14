<!--
  @file DESIGN.md
  @purpose Pedoman desain arsitektur UI/UX, prinsip Zero Over-Information / Visual-First, design tokens, palet warna Cool Midnight & Vibrant Jade, tata letak, dan standar interaksi Satu Generus
  @usedBy Developer tim, UI components, styling Tailwind/CSS
  @dependencies Tailwind CSS, Poppins Font, Svelte UI
  @publicSections Prinsip Desain Utama, Standar Zero Over-Information, Design Tokens, Spesifikasi Tata Letak & Navigasi, Standar Interaksi (UX)
  @sideEffects Acuan standar styling frontend dan implementasi mode terang/gelap
-->

# DESIGN.md: Satu Generus

## 1. Prinsip Desain Utama

- **"Show, Don't Tell" (Visual-First & Zero Over-Information):**
  - **Hilangkan Teks Sia-sia:** Hindari paragraf panjang, kalimat pembuka yang tidak penting, helper text yang hanya mengulang label, atau instruksi teknis bertele-tele di layar.
  - **Keberhasilan (Success State):** Saat suatu aksi atau kondisi berhasil, **JANGAN** sertakan rincian panjang kenapa bisa berhasil. Cukup tandai dengan indikator visual (warna hijau Vibrant Jade, ikon centang, badge singkat "Sesuai" / "Tersimpan"). Pengguna hanya perlu tahu bahwa aksinya beres.
  - **Kegagalan (Failure State):** Saat terjadi kegagalan atau error, cukup beritahu **inti apa yang gagal** secara ringkas, to-the-point, dengan warna peringatan (merah/amber) dan ikon penanda. Berikan tombol aksi penyelesaian instan bila ada (misal: "Pindah Online" saat di luar radius), tanpa instruksi bertumpuk.
- **Client-Facing (Mobile-First):** UI/UX untuk _client_ difokuskan pada ukuran layar _smartphone_. Aksesibilitas menggunakan zona jempol (_thumb zone_).
- **Admin-Facing (Desktop-First):** UI/UX untuk admin difokuskan pada visualisasi data luas, tabel, dan analitik di layar besar.
- **Minimalis & High Legibility:** Penggunaan _whitespace_ yang longgar. Tidak ada elemen dekoratif yang tidak memiliki fungsi. Arahkan mata pengguna ke aksi utama menggunakan warna dan kontras, bukan teks.
- **Responsive Navigation:** Seluruh aplikasi menggunakan **Bottom Navbar** saat diakses via _mobile_ (layar < 768px) dan otomatis berubah menjadi **Sidebar** saat diakses via desktop/tablet (layar >= 768px).
- **Single Source of Truth:** Tidak ada duplikasi fitur. Misalnya, detail profil dan form edit disatukan dalam satu layar dengan mode _toggle_, menghindari penumpukan tumpukan navigasi (_navigation stack_).
- **Dropdown Search:** Pada bagian dropdown yang berpotensi akan banyak data, seperti Daerah, Desa, Kelompok, maka buatkan Dropdown Search untuk memudahkan pencarian.
- **Format Tanggal Baku (DD-MM-YYYY):** Seluruh hal yang berkaitan dengan tanggal pada UI (tabel, kartu ringkasan, rincian sensus, tanggal lahir, jadwal presensi, serta seluruh formulir input tanggal) **wajib disajikan dan diinput dalam format DD-MM-YYYY** (contoh: `10-10-2026`). Seluruh input form tanggal wajib menggunakan komponen terstandarisasi `DateInput` (`src/lib/components/DateInput.svelte`) yang mendukung auto-masking pengetikan dan pemilih kalender visual. Penyimpanan database SQLite dinormalisasi secara terpusat ke standar ISO `YYYY-MM-DD`.

## 2. Design Tokens

### A. Tipografi (Poppins)

- **Font Family:** `Poppins`, _sans-serif_. Dipilih karena bentuknya geometris, bulat, bersahabat, dan nyaman di mata.
- **Skala Ukuran Responsif (Mobile-First vs Desktop):**
  Untuk mencegah teks terasa kerdil di smartphone, menghindari bug _auto-zoom_ pada iOS Safari (< 16px pada form input), serta memastikan kenyamanan baca optimal (_high legibility_):
  | Hierarki | Mobile (< 768px) | Desktop (>= 768px) | Penggunaan & Keterangan |
  | :--------------------------------------- | :------------------------------------------------------------------ | :-------------------------------------------------------- | :------------------------------------------------------------ |
  | **H1 (Judul Halaman)** | `22px – 24px` (SemiBold 600 / Bold 700) | `28px – 32px` (Bold 700) | Header utama halaman aplikasi |
  | **H2 (Judul Kartu / Modal)** | `18px – 20px` (SemiBold 600) | `20px – 22px` (SemiBold 600) | Header kartu utama, judul modal pop-up |
  | **H3 (Sub-judul / Label Utama)** | `15px – 16px` (SemiBold 600) | `14px – 15px` (SemiBold 600) | Label form input, sub-header section |
  | **Body (Teks Utama & Input Form)** | **`16px`** (Regular 400 / Medium 500, Line-height 1.5–1.6) | **`14px – 15px`** (Regular 400, Line-height 1.6) | **Wajib 16px di mobile** agar bebas auto-zoom di iOS |
  | **Body Small / Sub-text** | `14px` (Regular 400, Line-height 1.5) | `13px` (Regular 400, Line-height 1.5) | Teks pendukung, deskripsi, sublabel list |
  | **Caption / Badge / Helper** | `12px – 13px` (Medium 500) | `12px` (Regular 400 / Medium 500) | Badge status, tooltip, catatan bantuan (hindari < 12px di HP) |

### B. Semantik Warna & Palet (Cool Midnight Slate & Vibrant Jade)

Warna digunakan sebagai alat komunikasi utama untuk status, meminimalisir penggunaan teks penjelas. Sistem wajib mendeteksi preferensi tema perangkat dengan opsi _toggle_ manual.

#### 1. Rekomendasi Surface & Background (Midnight Slate)

Menghindari abu-abu kusam flat (`#1F2937`) atau hitam pekat mati (`#000000`). Menggunakan basis Hitam Slate Dingin.

| Tipe Elemen                         | Mode Terang (Light) | Mode Gelap (Dark) | Karakteristik & Fungsi                                                                  |
| :---------------------------------- | :------------------ | :---------------- | :-------------------------------------------------------------------------------------- |
| **Main Background / Canvas**        | `#F8FAFC`           | `#0B0F19`         | Hitam slate modern. Ramah di mata dan membuat aksen warna terasa*pop-up*.               |
| **Card / Container Level 1**        | `#FFFFFF`           | `#121826`         | Warna card utama. Memberikan efek kedalaman/elevasi yang bersih dan mewah.              |
| **Surface Level 2 / Input / Table** | `#F1F5F9`           | `#1A2338`         | Background input form, dropdown select, baris tabel, atau hover card.                   |
| **Border / Divider**                | `#E2E8F0`           | `#26324D`         | Halus dan tidak kasar, memisahkan konten dengan rapi tanpa garis tegas yang mengganggu. |

#### 2. Warna Aksen & Indikator Status (Visual Feedback)

Gantikan teks status yang panjang dengan warna yang merepresentasikan maknanya secara universal.

| Kegunaan / Status                    | Hex Code  | Nama Shade     | Penerapan "Show, Don't Tell"                                                                                         |
| :----------------------------------- | :-------- | :------------- | :------------------------------------------------------------------------------------------------------------------- |
| **Brand / Success (Valid/Berhasil)** | `#05A875` | Vibrant Jade   | Segala yang berjalan lancar (Lokasi GPS Valid, Data Tersimpan, Bukti Terverifikasi, Disetujui). Ikon centang/gembok. |
| **Warning (Pending/Perhatian)**      | `#F59E0B` | Warm Amber     | Menunggu persetujuan, proses sedang berjalan, peringatan. Badge status "Pending", Ikon tanda seru.                   |
| **Danger (Gagal/Ditolak/Error)**     | `#EF4444` | Soft Coral Red | Gagal presensi, di luar jangkauan, butuh perbaikan segera, data ditolak. Ikon silang.                                |
| **Info / Jamaah Mandiri**            | `#0284C7` | Ocean Blue     | Informasi netral, panduan, atau label grup khusus.                                                                   |
| **Neutral / Disabled**               | `#94A3B8` | Slate Muted    | Elemen yang belum bisa diakses, form*disabled*, informasi sekunder.                                                  |

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
  - Berorientasi pada _task_ (mengisi sensus, melihat jadwal, cek status, presensi).
  - Menggunakan _Card Layout_ untuk menampilkan data (bukan tabel).
  - Input form menggunakan pendekatan _step-by-step_ (wizard) agar tidak mengintimidasi.
- **Tampilan Admin (Dashboard):**
  - Berorientasi pada rekapitulasi dan manajemen akses.
  - Menggunakan _Data Table_ yang mendukung _sorting_, _filtering_, dan _export/import_.
  - Memiliki halaman visualisasi _chart_ (grafik demografi).

## 4. Standar Interaksi (UX) & Validasi Visual

- **Validasi Visual (Ganti Teks dengan UI):**
  - **DILARANG:** Menulis deskripsi teknis panjang, terutama pada kondisi sukses. (Contoh Buruk: _"Lokasi kamu valid karena berada di jarak 45 meter, sedangkan batas toleransinya adalah 100 meter."_ atau _"Presensi Anda berhasil dicatat karena memenuhi seluruh kriteria kehadiran pengajian."_).
  - **DIWAJIBKAN:** Gunakan indikator visual singkat. (Contoh Baik: Ikon _Checkmark_ hijau dengan teks **"Lokasi Sesuai"** atau notifikasi **"Presensi Berhasil"**).
  - **Kondisi Gagal / Error:** Cukup sebutkan apa inti yang gagal (misal: **"Di Luar Jangkauan (~450m)"**, **"Lokasi GPS Belum Aktif"**, atau **"Foto Wajib Diunggah"**). Sertakan tombol jalan keluar langsung (contoh: tombol **[Pindah Online]**) daripada paragraf instruksi.
  - **Tabel/Data Display:** Ganti teks status panjang dengan _Pill/Badge_ berwarna (Kuning untuk "Pending", Hijau untuk "Disetujui"). Sembunyikan detail log waktu/admin di balik interaksi klik/hover.
- **Feedback Sukses & Error (Toasts vs Alerts):**
  - Setelah aksi CRUD (tambah/edit/hapus/presensi), gunakan _Toast notification_ atau banner tipis yang menghilang otomatis (contoh: **"Data Tersimpan"**), tanpa rincian bertele-tele.
  - Validasi error input form harus muncul secara _inline_ di bawah input teks secara _real-time_ (teks merah kecil + border merah), bukan melalui pop-up di akhir pengisian.
- **Form & Input Guidance (Eliminasi Teks Sia-sia):**
  - Dilarang meletakkan paragraf instruksi di bawah judul kartu/form jika fungsi form sudah jelas dari label input.
  - Gunakan _placeholder_ yang jelas atau ikon _tooltip_ ( ℹ️ ) jika butuh penjelasan ekstra.
- **Upload File:** Setelah gambar/file dipilih, cukup tampilkan _thumbnail_ gambar (_preview_) dengan border hijau tipis dan ikon centang. Tidak perlu teks "Gambar berhasil dipilih dan siap diunggah".
- **Kondisi Data Kosong (Empty States):** Selalu tampilkan ilustrasi minimalis dengan satu baris teks penjelasan dan tombol _Call to Action_ (misal: "Belum ada data jamaah. [Tambah Data]").
- **Modal Konfirmasi Destruktif:** Aksi Hapus, Simpan Final, atau _Log Out_ menggunakan modal di tengah layar untuk kedua _device_ (Mobile/Desktop) dengan latar belakang di-blur tipis. Jangan gunakan `window.confirm()`.
