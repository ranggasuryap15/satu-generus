# RULES.md: Standar Penulisan Kode & Perilaku AI

## 1. Fokus Modifikasi (Strict Scoping)

- **Dilarang** mengubah, merombak, atau memformat ulang kode (termasuk _styling_ dan komentar) yang tidak berkaitan langsung dengan instruksi tugas saat ini.
- Jika sebuah fungsi atau antarmuka sudah berjalan normal, biarkan apa adanya kecuali pengguna secara spesifik meminta _refactoring_ atau optimasi.
- Kerjakan instruksi secara bertahap. Hindari modifikasi puluhan file secara serentak yang menyulitkan pelacakan _bug_.

## 2. Prinsip DRY (Don't Repeat Yourself)

- Dilarang menyalin-tempel (_copy-paste_) logika yang sama di beberapa file berbeda.
- Jika sebuah blok logika (_query database_, enkripsi AES, format tanggal, atau validasi _string_) digunakan lebih dari satu kali, ekstrak segera menjadi _helper function_ di dalam `src/lib/utils/` (untuk global) atau `src/lib/server/` (khusus _backend_).
- Ekspor fungsi tersebut dan impor di setiap _route_ yang membutuhkannya menggunakan alias SvelteKit (`#lib/...`).

## 3. Komponen Antarmuka Reusable

- Ekstrak elemen UI yang berulang (contoh: _Card_ Jamaah, _Form Input_ kustom, Modal Konfirmasi, _Badge_ Status) menjadi komponen Svelte mandiri di `src/lib/components/`.
- Manfaatkan `<slot />` pada Svelte untuk membuat komponen kerangka (_wrapper_) yang dinamis.
- Untuk gaya Tailwind yang terlalu panjang dan diulang, gunakan _helper_ `cn` atau `twMerge` (bawaan shadcn-svelte) untuk menjaga keterbacaan kode.

## 4. Keamanan dan Pembagian Lingkungan

- Jangan pernah memuat kode yang berhubungan dengan _database_ (Drizzle) atau _crypto_ (Enkripsi) di dalam komponen `.svelte` atau file `.js` sisi _client_. Wajib letakkan di `+page.server.js` atau folder `src/lib/server/`.

## 5. Eksekusi Perintah Terminal & Auto-Git (PENTING)

- **DILARANG KERAS** menjalankan `npm run build` atau `npm run check` selama proses penulisan kode atau development lokal, kecuali diminta secara eksplisit.
- Proses development hanya menggunakan `npm run dev` (Vite HMR).
- **AUTO-COMMIT & PUSH:** Setelah perubahan kode selesai dan dipastikan tidak ada error sintaks/linter, langsung jalankan `git commit` dan `git push` secara otomatis tanpa perlu menunggu instruksi.
- **SELECTIVE STAGING (DILARANG `git add .`):** Saat melakukan auto-commit, wajib gunakan `git add <path_file_spesifik>` hanya pada file kode yang baru saja diubah/dibuat. Dilarang keras meng-commit file `.env`, database (`*.db`, `*.sqlite`), atau isi folder `uploads/`.
- **CONVENTIONAL COMMITS:** Buat pesan commit otomatis yang singkat, jelas, dan berformat standar dalam Bahasa Indonesia (contoh: `feat(presensi): ubah path penyimpanan foto ke luar static` atau `fix(shodaqoh): hapus auto-redirect setelah aksi CRUD`).
- **STOP ON GIT ERROR:** Jika perintah `git push` gagal karena alasan apa pun (seperti konflik), hentikan percobaan di terminal seketika dan laporkan ke pengguna (jangan mencoba melakukan _rebase_ atau _force push_ otomatis).

## 6. Hal yang harus diperhatikan

### SvelteKit Form Actions & State Management

- **NO AUTO-REDIRECT:** Jangan pernah menggunakan `throw redirect(...)` atau `goto(...)` setelah eksekusi aksi CRUD (Create, Read, Update, Delete) berhasil dilakukan, kecuali saya secara spesifik memintanya. Pengguna harus tetap berada di halaman aktif.
- **MANDATORY use:enhance:** Selalu pasang atribut `use:enhance` pada setiap tag `<form>` untuk mencegah _full page reload_ saat data dikirim.
- **RETURN DATA, NOT REDIRECT:** Setiap fungsi di `+page.server.js` harus mengembalikan objek status/pesan (contoh: `return { success: true, message: 'Sukses' }`), bukan melempar rute baru.
- **REACTIVE UPDATES:** Gunakan data kembalian (_ActionData_ atau _stores_) untuk memperbarui UI di halaman yang sama secara instan (contoh: menutup modal, me-reset _form_, atau memunculkan notifikasi).

### Mandatory Modal Confirmations (CRUD & Form Guards)

- **NO NATIVE DIALOGS:** Dilarang menggunakan `window.confirm()` atau `window.alert()` bawaan browser. Wajib menggunakan komponen UI Modal kustom untuk seluruh konfirmasi di aplikasi.
- **FORM CANCEL / CLOSE GUARD (DIRTY STATE):** Pada setiap form (Create/Update), lacak perubahan input (_dirty state_). Jika pengguna menekan tombol "Batal", "Tutup" (ikon X), atau klik area luar (_backdrop_) saat sedang mengisi atau mengubah _field_, tahan penutupan form dan tampilkan modal konfirmasi (contoh: _"Yakin meninggalkan? Perubahan belum disimpan"_). Jika form masih kosong/belum diubah, langsung tutup tanpa konfirmasi.
- **CREATE & UPDATE CONFIRMATION:** Setiap aksi klik tombol "Simpan" (Create) atau "Ubah/Update" (Edit) tidak boleh langsung mengeksekusi pengiriman form ke server. Tampilkan terlebih dahulu modal konfirmasi (contoh: _"Yakin untuk menambahkan data ini?"_ atau _"Yakin menyimpan perubahan?"_). Eksekusi pengiriman (`use:enhance` / `requestSubmit()`) hanya dijalankan setelah pengguna mengonfirmasi pada modal tersebut.
- **DELETE CONFIRMATION:** Setiap aksi "Hapus" dari tabel atau daftar wajib memunculkan modal konfirmasi destruktif berwarna merah (contoh: _"Yakin untuk menghapus data ini? Tindakan tidak dapat dibatalkan"_) sebelum memanggil _form action_ penghapusan.
- **REUSABLE COMPONENT:** Gunakan satu komponen `<ConfirmModal />` terpusat atau _global store_ agar tidak menduplikasi kode modal di setiap file `+page.svelte` yang memiliki fitur CRUD.

### Dynamic File Uploads (Production Adapter-Node)

- **NO STATIC UPLOADS:** Dilarang keras menyimpan file hasil unggahan dinamis pengguna (foto presensi, bukti transfer, QRIS, dll.) ke dalam direktori `static/`.
- **ROOT UPLOADS DIRECTORY:** Semua file unggahan wajib disimpan di luar folder build/static, yaitu pada direktori `path.resolve(process.cwd(), 'uploads/<nama_modul>')`.
- **URL PATH:** Simpan path relatif `/uploads/<nama_modul>/<nama_file>` di database agar dilayani oleh endpoint catch-all `src/routes/uploads/[...filepath]/+server.ts`.

## 🐳 Aturan Eksekusi Lingkungan (Fleksibel Berbasis Kontainer)

Proyek ini dikerjakan menggunakan Docker, namun penentuan lokasi eksekusi perintah (CLI) bersifat **fleksibel dan bergantung pada ketersediaan _environment_ atau _tools_ di dalam kontainer**.

- **Eksekusi Wajib di Dalam Kontainer (Docker-First):** Jika eksekusi berkaitan dengan ekosistem utama proyek yang sudah dibungkus di dalam Docker (seperti Node.js, `npm`, Drizzle ORM, atau SvelteKit), maka perintah **wajib** dijalankan di dalam kontainer. Hal ini mencegah _error_ versi, dependensi yang hilang, atau kegagalan resolusi DNS _database_ internal.
  - _Instalasi:_ `docker compose exec app npm install <paket>`
  - _Migrasi:_ `docker compose exec app npx drizzle-kit generate`
  - _Update DB:_ `docker compose exec app npm run db:migrate`

- **Eksekusi di Luar Kontainer (Terminal Host):** Jika eksekusi memerlukan bahasa pemrograman atau _tools_ yang **tidak diinstal** di dalam kontainer proyek (misalnya _script_ otomatisasi menggunakan Python, Git CLI, atau manajemen _file_ level OS host), maka eksekusi dilakukan langsung di terminal komputer lokal atau VPS.
  - _Contoh:_ `python3 automasi_data.py`
  - _Contoh:_ `git pull origin main`

**Aturan Jaringan Database Berdasarkan Konteks:**

- Jika _script_ berjalan **di dalam** kontainer SvelteKit: URL _database_ wajib menggunakan nama _service_ Docker (contoh: `postgres://user:pass@postgres:5432/...`).
- Jika _script_ berjalan **di luar** kontainer (Terminal Host/Python): URL _database_ wajib menunjuk ke _port forwarding_ lokal (contoh: `postgresql://user:pass@127.0.0.1:5432/...`).
