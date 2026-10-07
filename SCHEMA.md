# SCHEMA.md (SvelteKit + Drizzle ORM + SQLite)

## 1. Struktur Wilayah (Hierarki Berjenjang)

Data direlasikan dari tingkat terkecil ke tingkat terbesar.

### Tabel: `daerah`

| Kolom            | Tipe Data (SQLite) | Constraint                 | Deskripsi                                               |
| :--------------- | :----------------- | :------------------------- | :------------------------------------------------------ |
| `id`             | Integer            | PRIMARY KEY, AUTOINCREMENT |                                                         |
| `nama`           | Text               | NOT NULL                   | Nama daerah internal (Contoh: "Daerah Jakarta Selatan") |
| `provinsi`       | Text               | NOT NULL                   | Wilayah resmi negara (Contoh: "DKI Jakarta")            |
| `kota_kabupaten` | Text               | NOT NULL                   | Wilayah resmi negara (Contoh: "Kota Jakarta Selatan")   |

### Tabel: `desa`

| Kolom       | Tipe Data (SQLite) | Constraint                 | Deskripsi                                     |
| :---------- | :----------------- | :------------------------- | :-------------------------------------------- |
| `id`        | Integer            | PRIMARY KEY, AUTOINCREMENT |                                               |
| `daerah_id` | Integer            | FOREIGN KEY (daerah.id)    | Merujuk ke tabel daerah                       |
| `nama`      | Text               | NOT NULL                   | Nama desa internal (Contoh: "Desa Kebayoran") |
| `kecamatan` | Text               |                            | (Opsional) Wilayah kecamatan resmi            |

### Tabel: `kelompok`

| Kolom       | Tipe Data (SQLite) | Constraint                 | Deskripsi                            |
| :---------- | :----------------- | :------------------------- | :----------------------------------- |
| `id`        | Integer            | PRIMARY KEY, AUTOINCREMENT |                                      |
| `desa_id`   | Integer            | FOREIGN KEY (desa.id)      | Merujuk ke tabel desa                |
| `nama`      | Text               | NOT NULL                   | Nama kelompok (Contoh: "Kelompok 1") |
| `kelurahan` | Text               |                            | (Opsional) Wilayah kelurahan resmi   |

## 2. Autentikasi & RBAC (Role-Based Access Control)

Sistem menggunakan pendekatan _Scope-based Role_. Satu pengguna bisa memiliki banyak dapukan di tingkatan yang berbeda (Misal: Sebagai Ketua di Kelompok, tapi sebagai Anggota Tim 7 di Daerah).

### Tabel: `users` (Entitas Utama Jamaah)

| Kolom           | Tipe Data (SQLite) | Constraint  | Deskripsi                             |
| :-------------- | :----------------- | :---------- | :------------------------------------ |
| `id`            | Text               | PRIMARY KEY | Menggunakan CUID (String Unik)        |
| `kelompok_id`   | Integer            | FOREIGN KEY | Penanda asal kelompok domisili jamaah |
| `nama_lengkap`  | Text               | NOT NULL    |                                       |
| `email`         | Text               | UNIQUE      | Opsional untuk*login* alternatif      |
| `password_hash` | Text               | NOT NULL    |                                       |

### Tabel: `dapukan` (Master Data Jabatan Tetap/Global)

| Kolom          | Tipe Data (SQLite) | Constraint        | Deskripsi                                                  |
| :------------- | :----------------- | :---------------- | :--------------------------------------------------------- |
| `id`           | Integer            | PRIMARY KEY, AUTO |                                                            |
| `nama_dapukan` | Text               | NOT NULL          | Khusus jabatan baku/global (Contoh: "Ketua", "Sekretaris") |
| `is_4S`        | Integer(Boolean)   | DEFAULT 0         | `1` (True) = Punya hak akses sebagai Admin Utama           |

### Tabel: `user_dapukan` (Relasi Jabatan & Wilayah Kekuasaan)

| Kolom                 | Tipe Data (SQLite) | Constraint    | Deskripsi                                                                   |
| :-------------------- | :----------------- | :------------ | :-------------------------------------------------------------------------- |
| `id`                  | Text               | PRIMARY KEY   | CUID untuk*record* ini                                                      |
| `user_id`             | Text               | FOREIGN KEY   | Merujuk ke jamaah yang diberi jabatan                                       |
| `dapukan_id`          | Integer            | FK (Nullable) | Diisi jika jabatannya adalah standar baku/global (merujuk tabel`dapukan`)   |
| `nama_dapukan_custom` | Text               | Nullable      | Diisi teks manual jika jabatan bersifat tentatif/lokal (kepanitiaan khusus) |
| `tingkat_scope`       | Text               | NOT NULL      | Enum: 'Pusat', 'Daerah', 'Desa', 'Kelompok'                                 |
| `daerah_id`           | Integer            | FK (Nullable) | Diisi jika`tingkat_scope` = 'Daerah'                                        |
| `desa_id`             | Integer            | FK (Nullable) | Diisi jika`tingkat_scope` = 'Desa'                                          |
| `kelompok_id`         | Integer            | FK (Nullable) | Diisi jika`tingkat_scope` = 'Kelompok'                                      |

_(Catatan: Jika seorang jamaah ditunjuk sebagai Pengurus Pusat, maka kolom `tingkat_scope` diisi 'Pusat', dan kolom `daerah_id`, `desa_id`, serta `kelompok_id` dibiarkan bernilai NULL, yang berarti aksesnya mencakup seluruh data (Global).)_

## 3. Data Sensus Keluarga (Enkripsi Aktif)

Drizzle ORM akan menyimpan data NIK dan No. KK dalam bentuk _Ciphertext_ menggunakan fungsi enkripsi `crypto` (AES-256-GCM) di level server SvelteKit.

### Tabel: `keluarga`

| Kolom                | Tipe Data (SQLite) | Constraint  | Deskripsi               |
| :------------------- | :----------------- | :---------- | :---------------------- |
| `id`                 | Text               | PRIMARY KEY | CUID                    |
| `no_kk_encrypted`    | Text               | NOT NULL    | Hasil enkripsi nomor KK |
| `kepala_keluarga_id` | Text               | FOREIGN KEY | Merujuk ke`users.id`    |
| `alamat_lengkap`     | Text               |             |                         |

### Tabel: `anggota_keluarga`

| Kolom             | Tipe Data (SQLite) | Constraint  | Deskripsi                                   |
| :---------------- | :----------------- | :---------- | :------------------------------------------ |
| `id`              | Text               | PRIMARY KEY | CUID                                        |
| `keluarga_id`     | Text               | FOREIGN KEY | Merujuk ke`keluarga.id`                     |
| `user_id`         | Text               | FOREIGN KEY | Merujuk ke`users.id` (Opsional jika balita) |
| `nik_encrypted`   | Text               | NOT NULL    | Hasil enkripsi NIK                          |
| `status_hubungan` | Text               | NOT NULL    | Enum: 'Suami', 'Istri', 'Anak', dll         |
| `tanggal_lahir`   | Text               | NOT NULL    | Format ISO8601 YYYY-MM-DD                   |
| `jenis_kelamin`   | Text               | NOT NULL    | Enum: 'L', 'P'                              |

## 4. Modul Presensi Pengajian

Disiapkan untuk mengakomodasi pemindaian QR Code (User-Side) atau panggil nama manual (Admin-Side).

### Tabel: `presensi_jadwal`

| Kolom           | Tipe Data (SQLite) | Constraint  | Deskripsi                        |
| :-------------- | :----------------- | :---------- | :------------------------------- |
| `id`            | Integer            | PRIMARY KEY |                                  |
| `kelompok_id`   | Integer            | FOREIGN KEY | Jadwal spesifik per kelompok     |
| `tanggal`       | Text               | NOT NULL    | Format ISO8601 YYYY-MM-DD        |
| `nama_kegiatan` | Text               | NOT NULL    | Contoh: "Pengajian Rutin Muda/i" |

### Tabel: `presensi_kehadiran`

| Kolom        | Tipe Data (SQLite) | Constraint  | Deskripsi                                 |
| :----------- | :----------------- | :---------- | :---------------------------------------- |
| `id`         | Text               | PRIMARY KEY | CUID                                      |
| `jadwal_id`  | Integer            | FOREIGN KEY |                                           |
| `user_id`    | Text               | FOREIGN KEY |                                           |
| `status`     | Text               | NOT NULL    | Enum: 'Hadir', 'Izin', 'Sakit', 'Alpa'    |
| `waktu_scan` | Integer            |             | Timestamp kehadiran (jika menggunakan QR) |
