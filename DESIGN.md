# 🎨 DESIGN.md: Pedoman UI/UX (Satu Generus)

Dokumen ini berisi panduan rancangan antarmuka (UI) dan pengalaman pengguna (UX) untuk aplikasi Satu Generus. Pendekatan desain yang digunakan adalah penggabungan antara **Modern Clean UI (Fintech/POS Style)** dan prinsip **Zero Over-Information / Visual-First**, yang mengedepankan kebersihan visual, keterbacaan tinggi, navigasi yang intuitif, serta komunikasi berbasis warna dan ikon alih-alih teks yang bertele-tele.

## 1. Prinsip Desain Utama

* **"Show, Don't Tell" (Visual-First & Zero Over-Information):**
  * **Hilangkan Teks Sia-sia:** Hindari paragraf panjang, kalimat pembuka yang tidak penting, helper text yang hanya mengulang label, atau instruksi teknis bertele-tele di layar.
  * **Keberhasilan (Success State):** Saat suatu aksi atau kondisi berhasil, **JANGAN** sertakan rincian panjang kenapa bisa berhasil. Cukup tandai dengan indikator visual (warna hijau Vibrant Jade, ikon centang, badge singkat "Sesuai" / "Tersimpan"). Pengguna hanya perlu tahu bahwa aksinya beres.
  * **Kegagalan (Failure State):** Saat terjadi kegagalan atau error, cukup beritahu **inti apa yang gagal** secara ringkas, to-the-point, dengan warna peringatan (merah/amber) dan ikon penanda. Berikan tombol aksi penyelesaian instan bila ada (misal: "Pindah Online" saat di luar radius), tanpa instruksi bertumpuk.
* **Modern, Minimalis & Flat:** Mengurangi penggunaan gradasi atau efek 3D yang berlebihan. Fokus pada warna solid, ruang kosong (*white space*) yang longgar, dan elemen yang murni fungsional.
* **Single Source of Truth:** Tidak ada duplikasi fitur. Misalnya, detail profil dan form edit disatukan dalam satu layar dengan mode *toggle*, menghindari penumpukan tumpukan navigasi (*navigation stack*).
* **Format Tanggal Baku (DD-MM-YYYY):** Seluruh hal yang berkaitan dengan tanggal pada UI (tabel, kartu ringkasan, rincian sensus, tanggal lahir, jadwal presensi, serta seluruh formulir input tanggal) **wajib disajikan dan diinput dalam format DD-MM-YYYY** (contoh: `10-10-2026`). Seluruh input form tanggal wajib menggunakan komponen terstandarisasi `DateInput` (`src/lib/components/DateInput.svelte`) yang mendukung auto-masking pengetikan dan pemilih kalender visual. Penyimpanan database SQLite dinormalisasi secara terpusat ke standar ISO `YYYY-MM-DD`.

---

## 2. Pemisahan Tampilan (Client vs Admin)

* **Client-Facing (Mobile-First):** UI/UX untuk *client* difokuskan pada ukuran layar *smartphone*.
  * Aksesibilitas menggunakan zona jempol (*thumb zone*).
  * Berorientasi pada *task* (mengisi sensus, melihat jadwal, cek status, presensi).
  * Menggunakan **Card Layout** untuk menampilkan data (bukan tabel).
  * Input form menggunakan pendekatan *step-by-step* (wizard) agar tidak mengintimidasi.
* **Admin-Facing (Desktop-First):** UI/UX untuk admin difokuskan pada visualisasi data luas di layar besar.
  * Berorientasi pada rekapitulasi dan manajemen akses.
  * Menggunakan **Data Table** yang mendukung *sorting*, *filtering*, dan *export/import*.
  * Memiliki halaman visualisasi *chart* (grafik demografi).

---

## 3. Struktur Layout & Navigasi Responsif

Antarmuka aplikasi mengadopsi struktur utama penyusun halaman berdasarkan perangkat:

### A. Curved Header (Header Melengkung) - Mobile

Bagian atas layar yang memuat profil pengguna, salam, atau ringkasan nominal utama (saldo/total sensus).

* **Karakteristik:** Memiliki warna latar *Primary* (Hijau Tua) dengan potongan bawah yang melengkung.
* **Implementasi Tailwind:**
  ```html
  <header class="bg-primary text-white rounded-b-[2.5rem] pt-8 pb-16 px-6">
    <!-- Konten header (Salam, Notifikasi) -->
  </header>
  ```

### B. Card-Based Content (Konten Kartu)

Daftar riwayat (seperti presensi, shodaqoh) dan menu aksi dibungkus dalam kartu yang "mengambang".

* **Karakteristik:** Sudut sangat membulat (*rounded-2xl* atau *rounded-3xl*), warna latar solid (*white* / *dark surface*), dan bayangan sangat tipis.
* **Implementasi Tailwind (Light Mode):**
  ```html
  <div class="bg-white rounded-2xl p-5 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-slate-100">
     <!-- Angka saldo, list transaksi, form input -->
  </div>
  ```

### C. Navigasi Berubah Bentuk (Bottom Nav ke Sidebar)

* **Mobile Mode (< 768px):** Menggunakan **Floating Bottom Navigation** berbentuk pil (*pill*) yang mengambang.
  * **Implementasi Tailwind:**
    ```html
    <nav class="fixed bottom-4 left-4 right-4 bg-white rounded-full shadow-lg border border-slate-100 px-6 py-4 flex justify-between items-center z-50">
      <!-- Ikon Menu -->
    </nav>
    ```
* **Desktop Mode (>= 768px):** Otomatis berubah menjadi **Sidebar** vertikal di kiri (lebar standar 250px) yang bisa di-*collapse*, dengan *Main Content* memakan sisa ruang di kanan.

---

## 4. Design Tokens: Tipografi (Poppins)

* **Font Family:** `Poppins`, *sans-serif*. Dipilih karena geometris, bersahabat, dan nyaman di mata.
* **Skala Ukuran Responsif:** Wajib **16px** untuk body teks dan input form di mobile agar terhindar dari bug *auto-zoom* iOS Safari.

| Hierarki                                 | Mobile (< 768px)                                                    | Desktop (>= 768px)                                        | Penggunaan & Keterangan                                       |
| :--------------------------------------- | :------------------------------------------------------------------ | :-------------------------------------------------------- | :------------------------------------------------------------ |
| **H1 (Judul Halaman)**             | `22px – 24px` (SemiBold 600 / Bold 700)                          | `28px – 32px` (Bold 700)                               | Header utama halaman aplikasi                                 |
| **H2 (Judul Kartu / Modal)**       | `18px – 20px` (SemiBold 600)                                     | `20px – 22px` (SemiBold 600)                           | Header kartu utama, judul modal pop-up                        |
| **H3 (Sub-judul / Label Utama)**   | `15px – 16px` (SemiBold 600)                                     | `14px – 15px` (SemiBold 600)                           | Label form input, sub-header section                          |
| **Body (Teks Utama & Input Form)** | **`16px`** (Regular 400 / Medium 500, Line-height 1.5–1.6) | **`14px – 15px`** (Regular 400, Line-height 1.6) | **Wajib 16px di mobile** agar bebas auto-zoom di iOS    |
| **Body Small / Sub-text**          | `14px` (Regular 400, Line-height 1.5)                             | `13px` (Regular 400, Line-height 1.5)                   | Teks pendukung, deskripsi, sublabel list                      |
| **Caption / Badge / Helper**       | `12px – 13px` (Medium 500)                                       | `12px` (Regular 400 / Medium 500)                       | Badge status, tooltip, catatan bantuan (hindari < 12px di HP) |

---

## 5. Design Tokens: Semantik Warna & Palet

Aplikasi menggunakan palet **Hijau** sebagai identitas utama, dipadukan dengan **Hitam Slate Dingin (Midnight Slate)** untuk latar belakang (terutama mode gelap), dan menghindari abu-abu kusam atau hitam pekat mati. Sistem wajib mendeteksi preferensi tema perangkat dengan opsi *toggle* manual.

### A. Palet Utama (Tema & Identitas)

| Peran                   | Hex Code                | Tailwind Variable | Penggunaan                                                       |
| :---------------------- | :---------------------- | :---------------- | :--------------------------------------------------------------- |
| **Primary**       | `#009B60` (Fresh Emerald / Vibrant Jade) | `bg-primary`    | Kartu sambutan, tombol utama, ikon aktif, teks *highlight*. Tidak tua/gelap dan tidak pudar. |
| **Primary Light** | `#10B981` (Emerald-500) | `bg-primary/80` | State *hover* pada tombol utama dan aksen dark mode.           |
| **Accent**        | `#F59E0B` (Amber-500)   | `bg-accent`     | Kartu infaq/shodaqoh, tombol CTA penting, notifikasi.           |

### B. Palet Pastel Launcher Akses Cepat (Minimalist & Flat)

| Menu Launcher     | Background Pastel (Light) | Background (Dark)     | Warna Ikon & Label                    |
| :---------------- | :------------------------ | :-------------------- | :------------------------------------ |
| **Presensi**      | `#D7F5E9` (Mint Pastel)   | `#064E3B`/60          | `#009B60` / `#10B981` (Fresh Emerald) |
| **Isrun/FR**      | `#FEF0D6` (Warm Cream)    | `#78350F`/40          | `#D97706` / `#F59E0B` (Warm Amber)    |
| **Keluarga**      | `#E0F2FE` (Soft Sky Blue) | `#0C4A6E`/40          | `#0284C7` / `#38BDF8` (Sky Blue)      |
| **SI-PPG**        | `#F3E8FF` (Soft Lilac)    | `#581C87`/40          | `#9333EA` / `#C084FC` (Purple)        |
| **Lainnya**       | `#F1F5F9` (Slate Neutral) | `#1E293B`/80          | `#52525B` / `#94A3B8` (Slate Neutral) |

### C. Surface & Background (Midnight Slate Base)

| Tipe Elemen                               | Mode Terang (Light)    | Mode Gelap (Dark) | Karakteristik & Fungsi                                                    |
| :---------------------------------------- | :--------------------- | :---------------- | :------------------------------------------------------------------------ |
| **Main Background / Canvas**        | `#F8FAFC` (Slate-50) | `#0B0F19`       | Hitam slate modern di dark mode. Ramah di mata (off-white di light mode). |
| **Card / Container Level 1**        | `#FFFFFF` (White)    | `#121826`       | Warna card utama. Memberikan efek elevasi yang bersih dan mewah.          |
| **Surface Level 2 / Input / Table** | `#F1F5F9`            | `#1A2338`       | Background input form, dropdown select, baris tabel, atau hover card.     |
| **Border / Divider**                | `#E2E8F0`            | `#26324D`       | Halus memisahkan konten tanpa garis tegas yang mengganggu.                |
| **Text Main**                       | `#1F2937` (Gray-800) | `#F8FAFC`       | Teks utama, judul, angka saldo/statistik.                                 |
| **Text Muted**                      | `#6B7280` (Gray-500) | `#94A3B8`       | Label kecil, teks sekunder, deskripsi tambahan, *placeholder*.          |

### C. Warna Aksen & Indikator Status (Show, Don't Tell)

Gantikan teks status yang panjang dengan warna yang merepresentasikan maknanya secara universal.

| Kegunaan / Status                          | Hex Code    | Nama Shade     | Penerapan "Show, Don't Tell"                                                                                             |
| :----------------------------------------- | :---------- | :------------- | :----------------------------------------------------------------------------------------------------------------------- |
| **Brand / Success (Valid/Berhasil)** | `#05A875` | Vibrant Jade   | Segala yang berjalan lancar (Lokasi GPS Valid, Data Tersimpan, Bukti Terverifikasi). Ikon centang. Lencana status aktif. |
| **Warning (Pending/Perhatian)**      | `#F59E0B` | Warm Amber     | Menunggu persetujuan, proses sedang berjalan, peringatan. Badge status "Pending", Ikon tanda seru.                       |
| **Danger (Gagal/Ditolak/Error)**     | `#EF4444` | Soft Coral Red | Gagal presensi, di luar jangkauan, data ditolak. Ikon silang.                                                            |
| **Info / Jamaah Mandiri**            | `#0284C7` | Ocean Blue     | Informasi netral, panduan, atau label grup khusus.                                                                       |
| **Neutral / Disabled**               | `#94A3B8` | Slate Muted    | Elemen yang belum bisa diakses, form*disabled*, informasi sekunder.                                                    |

---

## 6. Standar Interaksi (UX) & Validasi Visual

* **Dropdown Search:** Pada bagian dropdown yang berpotensi akan banyak data (Daerah, Desa, Kelompok), gunakan Dropdown Search.
* **Tabel/Data Display:** Ganti teks status panjang dengan *Pill/Badge* berwarna (Kuning untuk "Pending", Hijau untuk "Disetujui"). Sembunyikan detail log waktu/admin di balik interaksi klik/hover.
* **Feedback Sukses & Error (Toasts vs Alerts):**
  * Setelah aksi CRUD, gunakan *Toast notification* atau banner tipis yang menghilang otomatis (contoh: **"Data Tersimpan"**), tanpa rincian bertele-tele.
  * Validasi error input form harus muncul secara *inline* di bawah input teks secara *real-time* (teks merah kecil + border merah).
* **Form & Input Guidance:**
  * Dilarang meletakkan paragraf instruksi di bawah judul form jika fungsi sudah jelas.
  * Gunakan *placeholder* yang jelas atau ikon *tooltip* ( ℹ️ ) untuk penjelasan ekstra.
* **Upload File:** Setelah file dipilih, tampilkan *thumbnail preview* dengan border hijau tipis dan ikon centang.
* **Kondisi Data Kosong (Empty States):** Selalu tampilkan ilustrasi minimalis dengan satu baris teks penjelasan dan tombol *Call to Action* (misal: "Belum ada data jamaah. [Tambah Data]").

## 7. Standar Modal, Dialog & Aksesibilitas (Svelte 5)

* **Modal & Dialog:**
  * **Backdrop:** Gelap transparan dengan efek *blur* tipis (`bg-slate-900/40 backdrop-blur-sm`).
  * **Panel Dialog:** Muncul di tengah layar untuk aksi destruktif atau form singkat.
  * **Animasi:** Masuk dengan halus (`animate-in fade-in zoom-in-95 duration-200`). Jangan gunakan `window.confirm()`.
* **Aksesibilitas SvelteKit (a11y):**
  * Setiap elemen interaktif (bisa diklik) harus berupa `<button type="button">` atau `<a>`.
  * Jika harus menggunakan `<div>` (misal untuk backdrop), sematkan *ignore comment*:
    ```html
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    ```
  * Sertakan `tabindex="-1"` atau `tabindex="0"` pada elemen `role="dialog"`.
* **State Management (Svelte 5):**
  * Gunakan `$state(untrack(() => data.value))` untuk menginisialisasi nilai *form input* yang akan diedit oleh pengguna, agar terhindar dari *warning* reaktivitas.
  * Gunakan `$derived(data.value)` untuk data baca-saja yang harus selalu sinkron mutlak dengan perubahan data server.
