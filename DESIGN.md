# 🎨 DESIGN.md: Pedoman UI/UX (Satu Generus)

Dokumen ini berisi panduan rancangan antarmuka (UI) dan pengalaman pengguna (UX) untuk aplikasi Satu Generus. Pendekatan desain yang diterapkan adalah **Flat Design Minimalist (Mobile-First)** yang mengedepankan kebersihan visual, hierarki informasi yang jernih, navigasi intuitif berbasis zona jempol (*thumb zone*), serta komunikasi status berbasis warna dan ikon fungsional (*Show, Don't Tell*).

---

## 1. Prinsip Desain Utama

1. **"Show, Don't Tell" (Visual-First & Zero Over-Information):**
   - **Hilangkan Teks Sia-sia:** Hindari paragraf instruksi panjang yang hanya mengulang fungsi form, kalimat sambutan bertele-tele, atau deskripsi teknis jarak GPS yang membingungkan.
   - **Status Berhasil (Success State):** Tandai langsung dengan warna hijau *Vibrant Jade / Emerald*, lencana *"Lokasi Sesuai"*, atau notifikasi *"Data Tersimpan"*.
   - **Status Peringatan / Kendala (Warning & Error State):** Langsung tunjukkan inti kendala (misal: *"Titik lokasi belum diset"*, *"Di Luar Jangkauan (~450m)"*) disertai tombol tindakan langsung (misal: tombol biru **[Pindah Online]**).
2. **Integrated Curved Header & Role Switcher:**
   - Bagian atas aplikasi mobile menggunakan blok solid warna hijau *Deep Lush Green* (`#166534` / dark: `#14532D`) yang menempel langsung ke tepi atas dan samping layar, dengan lengkungan bawah yang halus dan luas (`rounded-b-[32px]`).
   - Kontrol navigasi atas (logo SG berukuran mantap `w-11 h-11`, judul aplikasi `text-xl font-black`, tombol tema, dan lonceng notifikasi interaktif) terintegrasi langsung di baris pertama header.
   - **Mode Switcher (Admin ⇄ Jamaah):** Jika pengguna memiliki peran kepengurusan/admin, ditampilkan pill switcher interaktif yang jelas di header (`[Mode: Jamaah ⇄ Ke Admin]`), memungkinkan perpindahan instan antar mode aplikasi.
3. **Overlapping Floating Cards & Upsized Scale:**
   - Kontrol utama (5-launcher shortcut pada Beranda, atau 4-tab switcher pada Presensi) diletakkan pada kartu mengambang (*floating card*) yang bertumpuk halus di batas bawah header hijau menggunakan margin negatif (`-mt-9`).
   - Menggunakan warna dasar kartu *Dark Slate Navy* (`#1E293B`) dengan border halus (`border-slate-700/60`), sudut membulat lebar (`rounded-3xl`), padding lega (`p-4 sm:p-5`), dan bayangan lembut (*shadow-lg*).
   - Seluruh elemen penting (lingkaran ikon launcher `w-14 h-14`, nilai ringkasan `text-2xl font-black`, teks label `text-sm font-bold`) diskalakan agar nyaman disentuh jari (*fat-finger friendly*) dan mudah terbaca.
4. **Jadwal Pengajian (Aksi Presensi & Semua):**
   - Header bagian Jadwal Pengajian menyediakan tombol navigasi **[Semua]** yang mengarah ke riwayat sebulan penuh (`/jadwal?from=beranda`).
   - Setiap kartu pengajian terdekat yang aktif dilengkapi tombol aksi cepat **[Presensi]** (`bg-emerald-500 font-black`) yang langsung mengarahkan jamaah ke form presensi dengan sesi tersebut terpilih otomatis.
5. **Format Tanggal Baku (DD-MM-YYYY):**
   - Seluruh tampilan tanggal pada UI client dan admin disajikan dalam format **DD-MM-YYYY** atau penanggalan bahasa Indonesia penuh.

---

## 2. Struktur Navigasi & Tata Letak

### A. Mobile-First Container
- Seluruh antarmuka client dioptimalkan untuk ukuran layar ponsel dengan lebar maksimal terpusat `max-w-md` (`~448px`).
- Pada layar desktop, antarmuka tetap tampil konsisten di tengah layar sebagai *frame phone app* yang elegan.

### B. Floating Bottom Navigation Bar (5 Kolom + Center FAB)
Navigasi bawah berbentuk floating bar modern dengan 5 item:
1. **Beranda:** Ikon `Home`, menuju `/`
2. **Keluarga:** Ikon `Users`, menuju `/sensus`
3. **Presensi (Center Elevated FAB):** Tombol bulat elevated di tengah (`w-12 h-12 rounded-full bg-[#05A875] text-slate-950 -mt-6 border-[3px] border-[#131927] shadow-lg`), ikon `QrCode`, label *"Presensi"*
4. **Transaksi:** Ikon `Wallet`, menuju `/transaksi`
5. **Profil:** Ikon `User`, menuju `/profil`

---

## 3. Palet Warna & Token Desain

### A. Warna Utama (Brand & Surface)
| Peran                                | Hex Code       | Deskripsi / Penggunaan                                                                  |
| :----------------------------------- | :------------- | :-------------------------------------------------------------------------------------- |
| **Top Green Banner (Light/Dark)**    | `#166534` / `#14532D` | Warna header melengkung utama di bagian atas layar Beranda, Presensi, dan Transaksi.    |
| **Brand Primary (Accent & FAB)**     | `#05A875` / `#10B981` | Tombol elevated presensi, tombol aksi kirim presensi, badge aktif, dan highlight hijau. |
| **Canvas Background (Dark)**         | `#0F172A` / `#131927` | Latar belakang kanvas aplikasi gelap ramah mata (Midnight Slate).                       |
| **Card Surface Level 1**             | `#1E293B`      | Kontainer kartu utama, floating launcher, card ringkasan, dan formulir utama.          |
| **Surface Level 2 (Input & Select)** | `#0F172A`      | Kotak input form, select dropdown, textarea alasan, dan nested container lokasi.       |
| **Border / Divider**                 | `#334155` / `slate-700/60` | Garis batas tipis pemisah antar seksi tanpa kontras yang tajam.                         |

### B. Ikon Launcher Akses Cepat (5 Lingkaran Melayang)
| Menu         | Lingkaran Background Dark   | Aksen Border & Ikon          | Route Tujuan  |
| :----------- | :-------------------------- | :--------------------------- | :------------ |
| **Presensi** | `bg-emerald-950/80`         | `border-emerald-500/30 text-emerald-400` | `/presensi`   |
| **Isrun/FR** | `bg-amber-950/80`           | `border-amber-500/30 text-amber-400`     | `/transaksi`  |
| **Keluarga** | `bg-sky-950/80`             | `border-sky-500/30 text-sky-400`         | `/sensus`     |
| **SI-PPG**   | `bg-purple-950/80`          | `border-purple-500/30 text-purple-400`   | Modal SI-PPG  |
| **Lainnya**  | `bg-slate-800`              | `border-slate-600/50 text-slate-300`     | Modal Apps    |

### C. Ringkasan Statistik Bulan Ini (3 Kolom Kartu)
- **Kehadiran:** Nilai nominal teks tebal warna hijau *Emerald* (`#10B981` / `text-emerald-400`), misal: `8/10`.
- **Izin:** Nilai nominal teks tebal warna biru langit *Sky* (`#38BDF8` / `text-sky-400`), misal: `2`.
- **Shodaqoh:** Nilai nominal teks tebal warna kuning amber (`#F59E0B` / `text-amber-400`), misal: `Rp150rb`.

### D. Warna Semantik Status Transaksi & Presensi
- **Berhasil / Hadir:** Badge hijau emerald (`bg-emerald-500/15 text-emerald-400`).
- **Menunggu / Izin:** Badge kuning amber (`bg-amber-500/15 text-amber-400`).
- **Ditolak / Sakit / Di Luar Jangkauan:** Badge merah koral (`bg-rose-500/15 text-rose-400`).
- **Pindah Online:** Tombol biru cerah (`bg-sky-500 hover:bg-sky-600 text-white font-bold`).

---

## 4. Standar Tampilan Modul Presensi (4 Tab)

Halaman `/presensi` terdiri atas header hijau melengkung dan 4 tab segmented control mengambang:
1. **Tab Hadir:**
   - Dropdown pilihan kegiatan pengajian (`<select>` gaya dark slate).
   - Banner status waktu jika presensi belum dibuka (jam mulai acara belum masuk rentang 1 jam).
   - Switcher metode kehadiran: `Offline` (GPS & Kamera langsung) vs `Online` (Daring & Bukti SS).
   - Kotak status GPS terikat kelompok jamaah dengan tombol `[Ulang]`. Menampilkan *"Lokasi Sesuai"* atau *"Di Luar Jangkauan [Pindah Online]"*.
   - Kotak unggah foto/kamera berbingkai putus-putus (*dashed border*) dengan ikon kamera melingkar.
   - Tombol kirim presensi berwarna hijau emerald solid (`bg-[#05A875] text-slate-950 font-bold`).
2. **Tab Izin / Sakit:**
   - Pilihan kegiatan pengajian aktif.
   - Tombol toggle jenis izin: `Izin` (warna amber) vs `Sakit`.
   - Textarea alasan yang ringkas.
   - Tombol upload bukti surat keterangan/foto (opsional).
   - Tombol kirim permohonan berwarna amber solid (`bg-[#F59E0B] text-slate-950 font-bold`) dengan ikon kirim.
3. **Tab Riwayat:**
   - Kartu riwayat kehadiran per sesi pengajian lengkap dengan tanggal, nama kegiatan, pill badge kehadiran, dan tautan pratinjau foto.
4. **Tab Kartu QR:**
   - Kartu putih elegan di tengah layar yang menampilkan kode QR unik jamaah (`SGQR:userId:kelompokId`) untuk pemindaian cepat oleh penerima tamu.

---

## 5. Standar Aksesibilitas & Responsivitas (Svelte 5)

- **Elemen Interaktif:** Seluruh tombol dan tab interaktif wajib berupa elemen `<button type="button">` atau `<a>` dengan penanda kursor yang jelas (`cursor-pointer`).
- **State Management:** Menggunakan Runes Svelte 5 (`$state`, `$derived`, `$props`) secara konsisten.
- **Transisi Halus:** Animasi modal dan pergantian tab menggunakan transisi halus (`animate-in fade-in duration-200`) tanpa *layout shift* yang mengganggu.
