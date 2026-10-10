<!--
  @file DESIGN.md
  @purpose Pedoman desain arsitektur UI/UX, design tokens, palet warna Cool Midnight & Vibrant Jade, tata letak, dan standar interaksi Satu Generus
  @usedBy Developer tim, UI components, styling Tailwind/CSS
  @dependencies Tailwind CSS, Poppins Font, Svelte UI
  @publicSections Prinsip Desain Utama, Design Tokens (Tipografi & Palet Warna), Spesifikasi Tata Letak & Navigasi, Standar Interaksi (UX)
  @sideEffects Acuan standar styling frontend dan implementasi mode terang/gelap
-->

# DESIGN.md: Satu Generus

## 1. Prinsip Desain Utama

- **Client-Facing (Mobile-First):** UI/UX untuk _client_ difokuskan pada ukuran layar _smartphone_. Aksesibilitas menggunakan zona jempol (_thumb zone_).
- **Admin-Facing (Desktop-First):** UI/UX untuk admin difokuskan pada visualisasi data luas, tabel, dan analitik di layar besar.
- **Minimalis & High Legibility:** Penggunaan _whitespace_ yang longgar. Tidak ada elemen dekoratif yang tidak memiliki fungsi.
- **Responsive Navigation:** Seluruh aplikasi menggunakan **Bottom Navbar** saat diakses via _mobile_ (layar < 768px) dan otomatis berubah menjadi **Sidebar** saat diakses via desktop/tablet (layar >= 768px).
- **Single Source of Truth:** Tidak ada duplikasi fitur. Misalnya, detail profil dan form edit disatukan dalam satu layar dengan mode _toggle_, menghindari penumpukan tumpukan navigasi (_navigation stack_).
- **Dropdown Search:** Pada bagian dropdown yang berpotensi akan banyak data, seperti Daerah, Desa, Kelompok, maka buatkan Dropdown Search untuk memudahkan pencarian
- **Format Tanggal Baku (DD-MM-YYYY):** Seluruh hal yang berkaitan dengan tanggal pada UI (tabel, kartu ringkasan, rincian sensus, tanggal lahir, jadwal presensi, serta seluruh formulir input tanggal) **wajib disajikan dan diinput dalam format DD-MM-YYYY** (contoh: `10-10-2026`). Seluruh input form tanggal wajib menggunakan komponen terstandarisasi `DateInput` (`src/lib/components/DateInput.svelte`) yang mendukung auto-masking pengetikan dan pemilih kalender visual. Penyimpanan database SQLite dinormalisasi secara terpusat ke standar ISO `YYYY-MM-DD` via helper `normalizeDateToISO()`, dan diformat kembali ke UI via `formatDateDDMMYYYY()` di `src/lib/utils.ts`.

## 2. Design Tokens

### A. Tipografi (Poppins)

- **Font Family:** `Poppins`, _sans-serif_. Dipilih karena geometris, bulat, dan sangat mudah dibaca pada layar kecil.
- **Skala Ukuran:**
  - H1 (Judul Halaman): 24px, SemiBold (600).
  - H2 (Judul Kartu/Modal): 18px, Medium (500).
  - Body (Teks Utama): 14px, Regular (400), _Line-height_ 1.6.
  - Caption (Label/Bantuan): 12px, Regular (400).

### B. Palet Warna & Mode Tema (Cool Midnight Slate & Vibrant Jade)

Sistem wajib mendeteksi preferensi tema perangkat (_system default_) dengan opsi _toggle_ manual. 

Menghindari abu-abu kusam flat (`#1F2937`) atau hitam pekat mati (`#000000`) yang merusak vibransi warna hijau. Menggunakan basis **Cool Midnight / Slate-Obsidian** (hitam dengan sedikit undertone slate/teal dingin 2–3%) untuk background serta **Vibrant Jade / Mid Emerald (500–600)** agar visual tetap segar, berwibawa, dan estetik di kedua mode.

#### 1. Rekomendasi Surface & Background (Midnight Slate)

| Tipe Elemen | Mode Terang (Light) | Mode Gelap (Dark - Midnight Slate) | Karakteristik & Fungsi |
| :--- | :--- | :--- | :--- |
| **Main Background / Canvas** | `#F8FAFC` | `#0B0F19` | Hitam slate dingin modern. Ramah di mata dan membuat aksen hijau terasa *pop-up*. |
| **Card / Container Level 1** | `#FFFFFF` | `#121826` | Warna card utama. Memberikan efek kedalaman/elevasi yang bersih dan mewah. |
| **Surface Level 2 / Input / Table** | `#F1F5F9` | `#1A2338` | Background input form, dropdown select, baris tabel, atau hover card. |
| **Border / Divider** | `#E2E8F0` | `#26324D` | Halus dan tidak kasar, memisahkan konten dengan rapi tanpa garis tegas yang mengganggu. |

#### 2. Warna Utama: Hijau Brand Identity (Vibrant Jade / Mid Emerald)

Menjaga keseimbangan antara wibawa di mode terang dan vibransi segar di mode gelap tanpa menyilaukan:

* **Warna Universal (*Sweet-Spot* Light & Dark):**
  * `#05A875` (atau Tailwind **Emerald-500** `#10B981` / **Emerald-600** `#059669`).
  * *Di mode terang:* Cukup pekat untuk dibaca di atas putih, tetap berwibawa dan tidak pudar.
  * *Di mode gelap:* Bercahaya segar di atas background `#0B0F19` tanpa menusuk mata.
* **Hierarki Shade Hijau:**
  * **Brand Primary:** `#05A875` (Tombol utama, badge status sukses, icon aktif).
  * **Brand Hover / Active:** `#04875E`.
  * **Subtle Surface (Badge BG):**
    * Mode Gelap: `rgba(5, 168, 117, 0.15)` (Badge hijau transparan).
    * Mode Terang: `#E6F7F0`.

#### 3. Warna Aksen & Status (Mid-Tone Seimbang)

| Kegunaan / Status | Hex Code | Nama Shade | Sifat di Mode Terang & Gelap |
| :--- | :--- | :--- | :--- |
| **Secondary / Teal** | `#0D9488` | Teal Mid | Menjembatani hijau dan biru untuk menu pendukung. |
| **Warning / Perhatian** | `#F59E0B` | Warm Amber | Emas/Kuning hangat, jelas untuk status pending / izin. |
| **Info / Jamaah Mandiri** | `#0284C7` | Ocean Blue | Sejuk, kontras bagus di card hitam maupun putih. |
| **Danger / Ditolak** | `#EF4444` | Soft Coral Red | Merah terang bersih untuk aksi destruktif & status tolak. |

#### 4. Tipografi & Teks Kontras

* **Mode Gelap:**
  * Text Primary: `#F1F5F9` (Off-white, ramah di mata dibanding putih 100%).
  * Text Muted / Subtitle: `#94A3B8` (Abu-abu keperakan elegan).
* **Mode Terang:**
  * Text Primary: `#0F172A` (Charcoal gelap tajam).
  * Text Muted / Subtitle: `#64748B` (Slate abu-abu lembut).

#### 5. Contoh Penerapan CSS Variables / Tailwind

```css
:root {
  /* Brand Sweet Spot */
  --color-primary: #059669;
  --color-primary-hover: #047857;
  --color-primary-light: #ecfdf5;
}

.dark {
  /* Background Midnight Slate modern */
  --bg-canvas: #0b0f19;
  --bg-card: #121826;
  --bg-elevated: #1a2338;
  --border-muted: #26324d;

  /* Primary lebih cerah 1 tingkat agar menyala di dark mode */
  --color-primary: #10b981;
  --color-primary-hover: #05a875;
  --color-primary-light: rgba(16, 185, 129, 0.12);
}
```

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
