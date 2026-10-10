# RULES.md: Standar Penulisan Kode & Perilaku AI

## 1. Fokus Modifikasi (Strict Scoping)

- **Dilarang** mengubah, merombak, atau memformat ulang kode (termasuk _styling_ dan komentar) yang tidak berkaitan langsung dengan instruksi tugas saat ini.
- Jika sebuah fungsi atau antarmuka sudah berjalan normal, biarkan apa adanya kecuali pengguna secara spesifik meminta _refactoring_ atau optimasi.
- Kerjakan instruksi secara bertahap. Hindari modifikasi puluhan file secara serentak yang menyulitkan pelacakan _bug_.

## 2. Prinsip DRY (Don't Repeat Yourself)

- Dilarang menyalin-tempel (_copy-paste_) logika yang sama di beberapa file berbeda.
- Jika sebuah blok logika (_query database_, enkripsi AES, format tanggal, atau validasi _string_) digunakan lebih dari satu kali, ekstrak segera menjadi _helper function_ di dalam `src/lib/utils/` (untuk global) atau `src/lib/server/` (khusus _backend_).
- Ekspor fungsi tersebut dan impor di setiap _route_ yang membutuhkannya menggunakan alias SvelteKit (`$lib/...`).

## 3. Komponen Antarmuka Reusable

- Ekstrak elemen UI yang berulang (contoh: _Card_ Jamaah, _Form Input_ kustom, Modal Konfirmasi, _Badge_ Status) menjadi komponen Svelte mandiri di `src/lib/components/`.
- Manfaatkan `<slot />` pada Svelte untuk membuat komponen kerangka (_wrapper_) yang dinamis.
- Untuk gaya Tailwind yang terlalu panjang dan diulang, gunakan _helper_ `cn` atau `twMerge` (bawaan shadcn-svelte) untuk menjaga keterbacaan kode.

## 4. Keamanan dan Pembagian Lingkungan

- Jangan pernah memuat kode yang berhubungan dengan _database_ (Drizzle) atau _crypto_ (Enkripsi) di dalam komponen `.svelte` atau file `.js` sisi _client_. Wajib letakkan di `+page.server.js` atau folder `src/lib/server/`.

## 5. Eksekusi Perintah Terminal (PENTING)

- DILARANG KERAS menjalankan `npm run build` atau `npm run check` selama proses penulisan kode atau development lokal, kecuali diminta secara eksplisit.
- Proses development hanya menggunakan `npm run dev` (Vite HMR).
- Evaluasi kode cukup dilakukan dengan melihat perubahan langsung di browser atau melalui linter bawaan IDE, bukan dengan memicu proses kompilasi penuh.
