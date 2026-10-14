<!--
  @file MIGRATION.md
  @purpose Walkthrough migrasi database SQLite (better-sqlite3) ke PostgreSQL untuk Satu Generus: konversi schema Drizzle, konversi lapisan koneksi, konversi API sinkron ke asinkron, penyesuaian raw SQL, transfer data, serta penyiapan Docker (lokal) dan non-Docker (server produksi)
  @usedBy Developer, DevOps/Operator server, Onboarding Tim
  @dependencies SCHEMA.md, WALKTHROUGH.md, RULES.md, drizzle-orm, drizzle-kit, better-sqlite3, postgres-js, SvelteKit adapter-node
  @publicSections Ringkasan Dampak, Fase 0-9, Rollback, Checklist DoD
  @sideEffects Panduan perubahan konfigurasi koneksi DB, DDL schema, dan orkestrasi container
-->

# 🐘 Walkthrough Migrasi SQLite ➜ PostgreSQL — Satu Generus

Panduan **langkah-demi-langkah** memindahkan *database engine* dari **SQLite (`better-sqlite3`)** ke **PostgreSQL**, **tanpa mengubah struktur tabel dan relationship** — hanya **penempatan/implementasi** yang berpindah.

> **Prinsip utama:** Struktur tabel, nama kolom, foreign key, dan relationship **tetap identik**. Yang berubah hanya (1) *driver*, (2) *dialect Drizzle*, (3) *API query* (sinkron ➜ asinkron), dan (4) *cara koneksi/deploy*.

---

## 📊 Ringkasan Dampak (Baseline Terukur)

Angka di bawah adalah hasil audit repo saat dokumen ini dibuat. Gunakan sebagai *effort estimate*, bukan target.

| Area | Kondisi Sekarang | Jumlah | Dampak Migrasi |
| :--- | :--- | ---: | :--- |
| Definisi schema | `sqliteTable` di [src/lib/db/schema.ts](src/lib/db/schema.ts) | 23 tabel | Ubah ke `pgTable` |
| Primary key `autoIncrement` | `integer('id').primaryKey({ autoIncrement: true })` | 7 tabel | ➜ `serial('id').primaryKey()` |
| Primary key `cuid2` (text) | `text('id').primaryKey().$defaultFn(createId)` | 16 tabel | ➜ `text('id').primaryKey()` (tetap) |
| Kolom boolean | `integer(..., { mode: 'boolean' })` | 11 kolom | ➜ `boolean(...)` |
| Kolom timestamp ms | `integer('created_at')` + `Date.now()` | 17 kolom (10 tabel) | **WAJIB** ➜ `bigint({ mode: 'number' })` |
| Call site query sinkron | `.get()` / `.all()` / `.run()` | ± **332** | ➜ `.limit(1)` / `await` (lihat Fase 3) |
| Raw SQL SQLite-only | `julianday()`, `date('now','localtime')`, `INSERT OR IGNORE` | 6 titik di 4 file | ➜ sintaks PostgreSQL (lihat Fase 4) |
| File akses `sqlite` mentah | `sqlite.prepare/exec/transaction` | 4 file | ➜ `db.execute(sql\`...\`)` |
| Cast agregat | `sql<number>` untuk `count()`/`sum()` | 15 titik di 3 file | ➜ parser `types` int8/numeric di koneksi |
| File `+page.server.ts` | Memuat query via `.all()` | 27 file | Tambah `async`/`await` |
| `+page.server.ts` actions | Memakai `.run()` | 19 file | Tambah `await` |
| Auto-heal DDL | [src/lib/db/index.ts](src/lib/db/index.ts) (637 baris) | 1 file | **Diganti** migrasi Drizzle |

**Tidak terpengaruh (tidak perlu diubah):**
- ✅ Seluruh `+page.svelte`, komponen `src/lib/components/*` — **tidak ada** akses `#lib/db/index.js` dari sisi client (sudah diverifikasi).
- ✅ Enkripsi AES-256-GCM di [src/lib/server/crypto.ts](src/lib/server/crypto.ts) — tetap (`text`).
- ✅ Penyimpanan file upload di `./uploads` — tetap (bukan bagian database).
- ✅ Format tanggal `DD-MM-YYYY` di UI — tetap; kolom `tanggal` sudah `text` ISO.

---

## ⚠️ 5 Jebakan yang WAJIB Dibaca Dulu

Ini penyebab paling umum migrasi "berhasil tapi rusak":

1. **Integer Overflow `int4` (paling fatal).**
   Kolom `created_at`/`updated_at` diisi `Date.now()` = `1.761.000.000.000`. Batas `integer` PostgreSQL adalah `2.147.483.647`. **Data akan gagal di-insert / error `value out of range for type integer`.** Solusi: `bigint({ mode: 'number' })` (Fase 1.3).

2. **API Sinkron Hilang Total.**
   `drizzle-orm/postgres-js` mengembalikan `PostgresJsDatabase`, yang **tidak memiliki** `.get()`, `.all()`, `.run()`. Hanya SQLite (dan libsql sync) yang punya. Ada **±332 call site** yang harus disesuaikan (Fase 3).

3. **`count()` / `sum()` PostgreSQL Mengembalikan `string`.**
   `COUNT(*)` bertipe `int8` dan `SUM()` bertipe `numeric`; `postgres-js` mengembalikannya sebagai **string**, bukan number. Cast `sql<number>` di 15 titik menjadi **bohong tipe** dan merusak aritmetika (`"3" + 1 === "31"`). Solusi: override parser `types` di koneksi — **bukan** `::bigint` (Fase 4.3).

4. **`INSERT OR IGNORE` dan `julianday()` Tidak Ada di PostgreSQL.**
   `INSERT OR IGNORE` ➜ `ON CONFLICT DO NOTHING`; `julianday()` ➜ selisih `date`; `date('now','localtime')` ➜ `CURRENT_DATE` (perlu set `timezone` koneksi).

5. **Jangan Migrasi Data Mentah (dump) Tanpa Normalisasi.**
   Kalau `created_at` sudah `int4`-friendly di SQLite tapi di PG jadi `bigint`, urutan kolom & tipe harus **eksplisit**, bukan `INSERT INTO ... SELECT *`. Gunakan mapping eksplisit (Fase 5).

---

## 🗺️ Peta Jalan (Urutan Eksekusi)

```mermaid
flowchart TD
    F0["Fase 0<br/>Cabang + Backup"] --> F1["Fase 1<br/>Konversi Schema Drizzle"]
    F1 --> F2["Fase 2<br/>Lapisan Koneksi + Docker PG"]
    F2 --> F3["Fase 3<br/>Sinkron ke Asinkron (332 call site)"]
    F3 --> F4["Fase 4<br/>Raw SQL & Aggregate Cast"]
    F4 --> F5["Fase 5<br/>Generate Migrasi + Transfer Data"]
    F5 --> F6["Fase 6<br/>Hapus Auto-Heal DDL"]
    F6 --> F7["Fase 7<br/>Script npm & Seed"]
    F7 --> F8["Fase 8<br/>Docker Lokal"]
    F8 --> F9["Fase 9<br/>Deploy Server Tanpa Docker"]
```

> **Saran urutan kerja:** Kerjakan **per modul**, bukan per fase. Contoh: selesaikan `wilayah` (schema → query → test) baru lanjut `sensus`. Ini sesuai [RULES.md](RULES.md) butir 1.3 ("hindari modifikasi puluhan file serentak").

---

## 🔧 Fase 0: Persiapan

### 0.1 Buat cabang kerja & backup

```bash
cd /path/ke/satu-generus
git checkout -b feat/migrasi-postgresql

# Backup database SQLite yang berisi data nyata
cp data/sqlite.db  data/sqlite.db.bak-$(date +%Y%m%d)
cp data/sqlite.db-wal data/sqlite.db-wal.bak-$(date +%Y%m%d) 2>/dev/null || true
```

> ⚠️ File `-wal` **wajib** ikut di-backup. Data terbaru bisa masih berada di WAL dan belum ter-*checkpoint* ke `.db`.

### 0.2 Pastikan `pg` tersedia untuk verifikasi lokal

```bash
psql --version   # opsional, untuk inspeksi manual
```

### 0.3 Ganti dependensi

```bash
npm uninstall better-sqlite3 @types/better-sqlite3
npm install postgres drizzle-orm
```

- `postgres` = driver `postgres-js` (pilihan: `pg` juga bisa, tapi `postgres-js` lebih ringkas & punya API `sql` bertag template).
- `drizzle-orm` sudah ada; cukup naikkan bila perlu.

Tambahkan juga tipe Node untuk `postgres-js` bila diminta. Lalu update blok `allowScripts` di [package.json](package.json) — **hapus** entri `better-sqlite3`:

```diff
  "allowScripts": {
-   "better-sqlite3@13.0.3": true,
    "esbuild": true
  },
```

---

## 🧱 Fase 1: Konversi Schema Drizzle

File: [src/lib/db/schema.ts](src/lib/db/schema.ts)

**Struktur & relationship tidak berubah.** Hanya *dialect builder*-nya.

### 1.1 Ganti import builder

```diff
-import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
+import { pgTable, text, integer, bigint, boolean, serial, index, uniqueIndex } from 'drizzle-orm/pg-core';
```

### 1.2 Ganti `sqliteTable` ➜ `pgTable` (23 tabel)

Cari & ganti seluruh **24** deklarasi tabel. Karena semua tabel memakai *callback* index yang sama, pola ini bisa di-*search-replace* global:

```
sqliteTable(   ➜   pgTable(
```

Setelah itu **wajib** audit tiap tabel satu per satu (jangan hanya andalkan find-replace) untuk 3 hal di bawah.

### 1.3 Primary key: `autoIncrement` ➜ `serial` (7 tabel)

Tabel dengan `autoIncrement` (daerah, desa, kelompok, sub_kelompok, dapukan, jadwal_pengajian_template, presensi_jadwal):

```diff
-	id: integer('id').primaryKey({ autoIncrement: true }),
+	id: serial('id').primaryKey(),
```

`serial` di PostgreSQL otomatis membuat sequence + default `nextval()` — **semantiknya identik** dengan `AUTOINCREMENT` SQLite.

> 16 tabel lain memakai `text('id').primaryKey().$defaultFn(() => createId())` (cuid2). **Tidak perlu diubah.**

### 1.4 Kolom boolean: `integer({ mode: 'boolean' })` ➜ `boolean()` (11 kolom)

```diff
-	is4S: integer('is_4s', { mode: 'boolean' }).notNull().default(false)
+	is4S: boolean('is_4s').notNull().default(false)
```

Daftar lengkap kolom yang harus diubah: `is_4s`, `is_kk`, `is_libur`, `is_active` (baris 218, 307, 384, 551), `is_override`, `is_wajib`, `is_custom`, `is_default`.

> ✅ Keuntungan: query Drizzle `eq(dapukan.is4S, true)` di [src/routes/(admin)/admin/+page.server.ts](<src/routes/(admin)/admin/+page.server.ts>) **tetap bekerja tanpa perubahan** — Drizzle menerjemahkan `true` menjadi literal boolean PG.

### 1.5 🔴 Kolom timestamp ms: `integer` ➜ `bigint` (WAJIB)

Semua kolom `created_at`/`updated_at`/`waktu_scan` yang diisi `Date.now()`:

```diff
-	createdAt: integer('created_at').notNull(),
-	updatedAt: integer('updated_at').notNull()
+	createdAt: bigint('created_at', { mode: 'number' }).notNull(),
+	updatedAt: bigint('updated_at', { mode: 'number' }).notNull()
```

Alasan: `Date.now()` ≈ `1.76 × 10¹²` sedangkan `integer` PG maksimum `2.147.483.647`. **Tanpa ini, semua insert akan gagal.**

`{ mode: 'number' }` menjaga tipe TypeScript tetap `number` (bukan `bigint`), sehingga **logika aplikasi tidak perlu berubah sama sekali**.

Kolom terdampak (17 kolom di 10 tabel):

| Tabel | Kolom |
| :--- | :--- |
| `presensi_kehadiran` | `waktu_scan` (baris 277) |
| `rekening_wilayah` | `created_at` (baris 308) |
| `transaksi_fr` | `created_at`, `updated_at` (347-348) |
| `pos_anggaran_infaq` | `created_at`, `updated_at` (385-386) |
| `template_infaq_rutin` | `created_at`, `updated_at` (412-413) |
| `template_infaq_group` | `created_at`, `updated_at` (433-434) |
| `template_infaq_group_pos` | `created_at`, `updated_at` (457-458) |
| `template_infaq_jamaah` | `updated_at` (524) |
| `jenis_shodaqoh` | `created_at`, `updated_at` (552-553) |
| `transaksi_shodaqoh` | `created_at`, `updated_at` (594-595) |

> 📌 `template_infaq_bundle` dan `template_infaq_pos` **tidak punya** kolom timestamp — jangan ikut diubah.

> 💡 **Alternatif (lebih rapi jangka panjang):** `timestamp('created_at', { withTimezone: true, mode: 'date' })` ➜ kolom `timestamptz` + tipe `Date`. Lebih idiomatis PostgreSQL, tapi **mengubah tipe TypeScript** sehingga logika perbandingan/format di [src/lib/utils.ts](src/lib/utils.ts) dan tampilan UI ikut berubah. Karena brief menyatakan *"cukup memindahkan penempatannya saja"*, gunakan `bigint` agar **nol perubahan logika**.

### 1.6 Kolom `integer` nominal (nilai uang)

`nominal`, `nominal_target`, `nominal_jumlah`, dll. saat ini `integer` (maks 2,1 miliar). **Biarkan `integer`** agar struktur tidak berubah, tapi catat:

> 📌 Nilai uang > Rp 2.147.483.647 akan overflow. Untuk jangka panjang, konversi ke `bigint({ mode: 'number' })`. Ini **di luar scope** migrasi ini.

### 1.7 Perbarui header doc

Sesuai standar dokumentasi repo, update header di baris paling atas `schema.ts`:

```diff
- * @purpose Definisi schema tabel Drizzle ORM untuk SQLite sesuai SCHEMA.md ...
- * @dependencies drizzle-orm/sqlite-core, @paralleldrive/cuid2
+ * @purpose Definisi schema tabel Drizzle ORM untuk PostgreSQL sesuai SCHEMA.md ...
+ * @dependencies drizzle-orm/pg-core, @paralleldrive/cuid2
```

---

## 🔌 Fase 2: Lapisan Koneksi + PostgreSQL Lokal (Docker)

### 2.1 Tulis ulang [src/lib/db/index.ts](src/lib/db/index.ts)

File lama (637 baris) berisi koneksi `better-sqlite3` **dan** auto-heal DDL. Untuk sekarang, **ganti seluruh isinya** dengan versi ringkas berikut (auto-heal dihapus di Fase 6):

```ts
/**
 * @file src/lib/db/index.ts
 * @purpose Inisialisasi koneksi PostgreSQL (postgres-js) dan instance Drizzle ORM, termasuk normalisasi tipe int8/numeric menjadi number
 * @usedBy Backend server routes (+page.server.ts, +server.ts, hooks.server.ts, scripts migrasi/seed)
 * @dependencies postgres, drizzle-orm/postgres-js, src/lib/db/schema.ts
 * @publicFunctions db, client, first
 * @sideEffects Membuka connection pool PostgreSQL saat modul pertama kali di-import
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString =
	process.env.DATABASE_URL || 'postgres://satu_generus:satu_generus@localhost:5432/satu_generus';

// Pool dikonfigurasi untuk SvelteKit (adapter-node) yang berjalan single-process.
// max: 10 cukup untuk beban MVP; naikkan bila jumlah worker/CPU bertambah.
export const client = postgres(connectionString, {
	max: Number(process.env.DB_POOL_MAX ?? 10),
	idle_timeout: 20,
	connect_timeout: 10,
	// Penting: paksa timezone koneksi agar CURRENT_DATE PostgreSQL setara dengan date('now','localtime') SQLite
	connection: { timezone: 'Asia/Jakarta' },
	// WAJIB: postgres-js mengembalikan int8 (bigint) & numeric sebagai STRING.
	// Tanpa override ini, count()/sum() menjadi string dan merusak aritmetika
	// (contoh: "3" + 1 === "31") serta membuat cast sql<number> berbohong.
	types: {
		bigint: { to: 20, from: [20], serialize: (v: number | bigint) => String(v), parse: (v: string) => Number(v) },
		numeric: { to: 1700, from: [1700], serialize: (v: number) => String(v), parse: (v: string) => Number(v) }
	}
});

export const db = drizzle(client, { schema });

/**
 * Mengambil satu baris pertama dari query Drizzle PostgreSQL.
 * Pengganti langsung `.get()` milik SQLite.
 */
export async function first<T>(query: Promise<T[]>): Promise<T | undefined> {
	const rows = await query;
	return rows[0];
}
```

> 🔴 **Blok `types` di atas bukan opsional.** Terbukti secara empiris: tanpa override, `count(*)` mengembalikan `"3"` (string) dan `sum(n)` mengembalikan `"350000"` (string), sehingga seluruh cast `sql<number>` di modul Keuangan menjadi tipe palsu. Lihat Fase 4.3.
>
> 📌 Batas aman `parse: Number`: `int8`/`numeric` di atas 2⁵³ (`9.007.199.254.740.991`) kehilangan presisi. Untuk aplikasi ini tidak relevan (`Date.now()` ≈ 1,8 × 10¹², nominal uang jauh lebih kecil), tapi jangan pakai `Number` untuk kolom *snowflake ID* atau nilai kripto.

### 2.2 Hapus file migrasi SQLite

```bash
git rm src/lib/db/migrate.ts
```

Akan diganti perintah `drizzle-kit migrate` (Fase 5 & 7).

### 2.3 Perbarui [drizzle.config.ts](drizzle.config.ts)

```diff
  export default defineConfig({
    schema: './src/lib/db/schema.ts',
    out: './drizzle',
-   dialect: 'sqlite',
+   dialect: 'postgresql',
    dbCredentials: {
-     url: process.env.DATABASE_URL || './data/sqlite.db'
+     url: process.env.DATABASE_URL || 'postgres://satu_generus:satu_generus@localhost:5432/satu_generus'
    }
  });
```

### 2.4 Perbarui [.env.example](.env.example)

```diff
- # Database SQLite path
- DATABASE_URL=./data/sqlite.db
+ # Koneksi PostgreSQL
+ DATABASE_URL=postgres://satu_generus:satu_generus@localhost:5432/satu_generus
+ # Jumlah maksimum koneksi pool (opsional)
+ DB_POOL_MAX=10
```

### 2.5 PostgreSQL untuk development lokal

Buat file `docker-compose.dev.yml` (hanya PostgreSQL, dipakai saat `npm run dev` di host):

```yaml
# @file docker-compose.dev.yml
# @purpose Menjalankan PostgreSQL 16 khusus development lokal saat aplikasi dijalankan via `npm run dev` di host
# @usedBy Developer lokal (docker compose -f docker-compose.dev.yml up -d)
# @dependencies Docker Engine
# @publicFunctions service: postgres
# @sideEffects Mengekspos port 5432 ke host dan menyimpan data di named volume pgdata_dev
services:
  postgres:
    image: postgres:16-alpine
    container_name: satu-generus-pg-dev
    environment:
      POSTGRES_USER: satu_generus
      POSTGRES_PASSWORD: satu_generus
      POSTGRES_DB: satu_generus
      TZ: Asia/Jakarta
      PGTZ: Asia/Jakarta
    ports:
      - "5432:5432"
    volumes:
      - pgdata_dev:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U satu_generus -d satu_generus"]
      interval: 5s
      timeout: 5s
      retries: 10
    restart: unless-stopped

volumes:
  pgdata_dev:
```

```bash
docker compose -f docker-compose.dev.yml up -d
docker compose -f docker-compose.dev.yml ps      # pastikan "healthy"
```

---

## 🔄 Fase 3: Konversi API Sinkron ➜ Asinkron (Inti Migrasi)

`postgres-js` **hanya** menyediakan API asinkron. Berikut padanan 1:1-nya:

| SQLite (lama) | PostgreSQL (baru) | Catatan |
| :--- | :--- | :--- |
| `.get()` | `await ...limit(1)` lalu `rows[0]` | `postgres-js` selalu balikin array |
| `.all()` | `await ...` | Langsung array, `.all()` dihapus |
| `.run()` | `await ...` | Untuk insert/update/delete |
| `.returning().all()` | `await ...returning()` | `returning()` sudah mengembalikan array |
| `.values(...)` | `await db.insert(t).values(...)` | Sama, tambah `await` |
| `db.transaction(cb)` | `await db.transaction(async (tx) => {...})` | Callback **wajib async** |
| `sqlite.transaction(cb)` | `await db.transaction(async (tx) => {...})` | Ganti total (Fase 4.4) |

### 3.1 Helper `first()` untuk menggantikan `.get()` (DRY)

`.get()` dipakai **108 kali**. Daripada menulis `(await q)[0]` berulang, pakai helper `first()` yang sudah didefinisikan di Fase 2.1 (`src/lib/db/index.ts`):

```ts
export async function first<T>(query: Promise<T[]>): Promise<T | undefined> {
	const rows = await query;
	return rows[0];
}
```

> Ini mematuhi [RULES.md](RULES.md) butir 2 (DRY) — logika "ambil satu baris" tidak diduplikasi 108 kali.

### 3.2 Pola konversi per file (contoh nyata)

**Contoh A — `hooks.server.ts` (paling kritis, jalan di SETIAP request)**

```diff
-    const userRecord = db
-      .select({ id: users.id, namaLengkap: users.namaLengkap, ... })
-      .from(users)
-      .where(eq(users.id, userId))
-      .get();
+    const userRecord = await first(
+      db
+        .select({ id: users.id, namaLengkap: users.namaLengkap, ... })
+        .from(users)
+        .where(eq(users.id, userId))
+    );
```

**Contoh B — agregasi `count()` di [src/routes/(admin)/admin/+page.server.ts](<src/routes/(admin)/admin/+page.server.ts>)**

```diff
-    const [jamaahCountRes] = db.select({ val: count() }).from(users).all();
+    const [jamaahCountRes] = await db.select({ val: count() }).from(users);
```

**Contoh C — `load` function**

```diff
-export const load = ({ locals }) => {
-  const data = db.select().from(daerah).all();
+export const load = async ({ locals }) => {
+  const data = await db.select().from(daerah);
   return { data };
 };
```

**Contoh D — `seed.ts` (`returning().all()`)**

```diff
-      [rec] = db.insert(daerah).values(d).returning().all();
+      [rec] = await db.insert(daerah).values(d).returning();
```

### 3.3 Perbaiki fungsi helper sinkron (102 pemanggil)

Ini **titik paling berisiko**: 2 helper bersama masih sinkron dan dipanggil dari **102 tempat**.

**a. [src/lib/server/scope.ts](src/lib/server/scope.ts)**
`getAdminScope()` (baris 32) dan `getAccessibleWilayah()` (baris 90) menjalankan query sinkron:

```diff
-export function getAccessibleWilayah(scope?: AdminScope): AccessibleWilayah {
-  const desaRows = db.select().from(desa).where(inArray(desa.id, scope.desaIds)).all();
+export async function getAccessibleWilayah(scope?: AdminScope): Promise<AccessibleWilayah> {
+  const desaRows = await db.select().from(desa).where(inArray(desa.id, scope.desaIds));
```

> Fungsi murni tanpa DB (`isKelompokAllowed`, `canManageDapukan`, `canManageRekening`, `canAccessKeuangan`, `canManageFr`, `canManageShodaqoh`) **tidak perlu diubah** — hanya yang menyentuh `db`.

**b. [src/lib/server/sensus.ts](src/lib/server/sensus.ts)**
`getKeluargaForUser()` (baris 18) dan `isUserInKeluarga()` (baris 54):

```diff
-export function getKeluargaForUser(userId: string) {
-  return db.select().from(keluarga).where(...).get();
+export async function getKeluargaForUser(userId: string) {
+  return first(db.select().from(keluarga).where(...));
 }
```

**c. Update 102 pemanggil** — tambahkan `await`:

```diff
-const scope = getAdminScope(locals.roles);
-const wilayah = getAccessibleWilayah(scope);
+const scope = getAdminScope(locals.roles);
+const wilayah = await getAccessibleWilayah(scope);
```

> 💡 Verifikasi cepat setelah selesai: `grep -rn "getAccessibleWilayah(\|getKeluargaForUser(" src/` — pastikan **tidak ada** yang tanpa `await`.

### 3.4 Urutan kerja yang disarankan

Kerjakan berurutan agar tiap langkah bisa diuji:

1. [src/hooks.server.ts](src/hooks.server.ts) (2 call site) — **uji login dulu**
2. [src/lib/server/scope.ts](src/lib/server/scope.ts) + [src/lib/server/sensus.ts](src/lib/server/sensus.ts) (14 call site)
3. `src/routes/(admin)/admin/+page.server.ts`, `+layout.server.ts` (13 call site)
4. Modul **wilayah** (31 call site)
5. Modul **sensus** (50 call site)
6. Modul **presensi** (18 call site)
7. Modul **keuangan** (43 call site)
8. Modul **client**: `(app)/*` (29 call site)

---

## 🧮 Fase 4: Raw SQL & Aggregate Cast

### 4.1 `julianday()` ➜ selisih `date` (2 titik)

Di [src/routes/(admin)/admin/presensi/+page.server.ts](<src/routes/(admin)/admin/presensi/+page.server.ts>) baris 80-81:

```diff
  .orderBy(
-   sql`ABS(julianday(${presensiJadwal.tanggal}) - julianday(date('now', 'localtime'))) ASC`,
-   sql`CASE WHEN ${presensiJadwal.tanggal} >= date('now', 'localtime') THEN 0 ELSE 1 END ASC`,
+   sql`ABS(${presensiJadwal.tanggal}::date - CURRENT_DATE) ASC`,
+   sql`CASE WHEN ${presensiJadwal.tanggal}::date >= CURRENT_DATE THEN 0 ELSE 1 END ASC`,
    desc(presensiJadwal.tanggal)
  )
```

> `presensi_jadwal.tanggal` bertipe `text` ISO (`YYYY-MM-DD`). Cast `::date` mengubahnya ke `date` PostgreSQL, lalu pengurangan antar-`date` menghasilkan `integer` (jumlah hari) — **semantik sama** dengan `julianday()` yang menghasilkan selisih hari.
>
> `CURRENT_DATE` mengikuti `timezone` koneksi yang sudah di-set `Asia/Jakarta` di Fase 2.1, sehingga setara `date('now','localtime')`.

### 4.2 `lower(...) = lower(...)` (3 titik) — sudah aman

Di [src/routes/(admin)/admin/wilayah/+page.server.ts](<src/routes/(admin)/admin/wilayah/+page.server.ts>) baris 158, 216, 280:

```ts
.where(sql`lower(${daerah.nama}) = lower(${daerahValue})`)
```

✅ **Tidak perlu diubah** — `lower()` ada di PostgreSQL dengan semantik identik.

### 4.3 🔴 Cast agregat `sql<number>` — tangani lewat parser `types` (15 titik di 3 file)

**Akar masalah:** `COUNT(*)` bertipe `int8` dan `SUM()` bertipe `numeric`. `postgres-js` mengembalikan keduanya sebagai **string**, sehingga cast `sql<number>` menjadi **bohong tipe**.

**Solusi yang direkomendasikan (sudah diterapkan di Fase 2.1):** override parser di konfigurasi koneksi.

```ts
types: {
	bigint:  { to: 20,   from: [20],   serialize: (v) => String(v), parse: (v) => Number(v) },
	numeric: { to: 1700, from: [1700], serialize: (v) => String(v), parse: (v) => Number(v) }
}
```

Dengan ini, **seluruh 15 titik `sql<number>` tetap berfungsi apa adanya — tanpa perlu diubah.** ✅

> ⚠️ **Jangan pakai `::bigint` untuk memperbaiki ini.** Sudah diuji: `sum(n)::bigint` **tetap** kembali sebagai string karena `int8` di-parse sebagai string oleh `postgres-js`. Hanya `::int` (int4) dan `::float8` yang kembali sebagai number:
>
> | Ekspresi | Tipe hasil di JS |
> | :--- | :--- |
> | `count(*)` | `string` |
> | `count(*)::int` | `number` ✅ |
> | `count(*)::bigint` | `string` ❌ |
> | `sum(n)` | `string` |
> | `sum(n)::int` | `number` ✅ (tapi **overflow** bila > 2,1 miliar) |
> | `sum(n)::bigint` | `string` ❌ |
> | `sum(n)::float8` | `number` ✅ |
> | `coalesce(sum(n),0)::int` | `number` ✅ |
>
> Jadi ada 2 jalur sah: **(A)** override parser `types` di koneksi (dipilih di sini — DRY, 0 perubahan di 15 titik), atau **(B)** ubah tiap ekspresi menjadi `::int` untuk `count` dan `::float8` untuk `sum`.

**Bila memilih jalur B** (misal karena ada kolom `numeric` yang butuh presisi penuh), ubah seperti ini:

```diff
- totalNominal: sql<number>`sum(${transaksiFr.nominal})`,
+ totalNominal: sql<number>`coalesce(sum(${transaksiFr.nominal}), 0)::float8`,
- setorCount: sql<number>`count(case when ${transaksiFr.nominal} > 0 then 1 end)`
+ setorCount: sql<number>`count(case when ${transaksiFr.nominal} > 0 then 1 end)::int`
```

```diff
- .select({ count: sql<number>`count(distinct ${anggotaKeluarga.id})` })
+ .select({ count: sql<number>`count(distinct ${anggotaKeluarga.id})::int` })
```

Subquery di [src/routes/(admin)/admin/wilayah/+page.server.ts](<src/routes/(admin)/admin/wilayah/+page.server.ts>) baris 42-43 juga:

```diff
- totalJamaah: sql<number>`(SELECT count(*) FROM users WHERE users.kelompok_id = ${kelompok.id})`,
+ totalJamaah: sql<number>`(SELECT count(*) FROM users WHERE users.kelompok_id = ${kelompok.id})::int`,
```

File yang terdampak (15 titik): [src/routes/(admin)/admin/wilayah/+page.server.ts](<src/routes/(admin)/admin/wilayah/+page.server.ts>) (2), [src/routes/(admin)/admin/keuangan/+page.server.ts](<src/routes/(admin)/admin/keuangan/+page.server.ts>) (6), [src/routes/(admin)/admin/keuangan/laporan-fr/+page.server.ts](<src/routes/(admin)/admin/keuangan/laporan-fr/+page.server.ts>) (7).

> 📌 Jalur A (parser `types`): **tidak ada** perubahan di 15 titik ini. Jalur B: `count` ➜ `::int`, `sum` ➜ `::float8`.
>
> ⚠️ `count()` yang diimpor dari `drizzle-orm` (dipakai di [src/routes/(admin)/admin/+page.server.ts](<src/routes/(admin)/admin/+page.server.ts>) & [+layout.server.ts](<src/routes/(admin)/+layout.server.ts>)) juga mengembalikan **string** tanpa jalur A. Dengan parser `types` di Fase 2.1, ini otomatis menjadi `number`.

### 4.4 Ganti `sqlite.prepare/exec/transaction` (4 file)

**a. [src/routes/(app)/fr/+page.server.ts](<src/routes/(app)/fr/+page.server.ts>)** — pencarian kontak KU (baris ~331-350):

```diff
-    kuKontak = (sqlite.prepare(`SELECT u.nama_lengkap as nama, u.no_telepon as noTelepon ...`).get(userKelompokId)) ?? null;
+    const rows = await db.execute(sql`
+      SELECT u.nama_lengkap as nama, u.no_telepon as noTelepon
+      FROM users u
+      JOIN user_dapukan ud ON u.id = ud.user_id
+      JOIN dapukan d ON ud.dapukan_id = d.id
+      WHERE ud.kelompok_id = ${userKelompokId}
+        AND (d.nama_dapukan LIKE '%KU%' OR d.nama_dapukan LIKE '%Bendahara%' OR d.nama_dapukan LIKE '%Keuangan%')
+      ORDER BY u.id ASC LIMIT 1
+    `);
+    kuKontak = (rows[0] as { nama: string; noTelepon: string | null } | undefined) ?? null;
```

> ✅ `LIKE` di PostgreSQL tetap case-sensitive — sama dengan SQLite untuk pola ini. Tidak perlu `ILIKE`.

**b. [src/routes/(admin)/admin/keuangan/template-fr/+page.server.ts](<src/routes/(admin)/admin/keuangan/template-fr/+page.server.ts>)** — 15 pemakaian `sqlite` termasuk `sqlite.transaction`:

```diff
-    const upsertStmt = sqlite.prepare(`
-      INSERT INTO template_infaq_group_pos (...) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)
-      ON CONFLICT(group_id, pos_id) DO UPDATE SET
-        nominal_jumlah = excluded.nominal_jumlah, ...
-    `);
-    const transaction = sqlite.transaction((items) => { for (const item of items) { ... } });
-    transaction(cells);
+    await db.transaction(async (tx) => {
+      for (const item of cells) {
+        await tx.execute(sql`
+          INSERT INTO template_infaq_group_pos (id, group_id, pos_id, nominal_jumlah, nominal_keterangan, keterangan_teks, urutan, created_at, updated_at)
+          VALUES (${...}, ${...}, ${...}, ${...}, ${...}, ${...}, 0, ${now}, ${now})
+          ON CONFLICT (group_id, pos_id) DO UPDATE SET
+            nominal_jumlah = excluded.nominal_jumlah,
+            nominal_keterangan = excluded.nominal_keterangan,
+            keterangan_teks = excluded.keterangan_teks,
+            updated_at = excluded.updated_at
+        `);
+      }
+    });
```

> ✅ `ON CONFLICT (group_id, pos_id) DO UPDATE SET ... = excluded....` **sudah sintaks PostgreSQL asli** — tidak perlu diubah.

**c. [src/routes/(admin)/admin/keuangan/fr-jamaah/+page.server.ts](<src/routes/(admin)/admin/keuangan/fr-jamaah/+page.server.ts>)** — 2 pemakaian, pola upsert `transaksi_fr` yang sama.

**d. [src/lib/db/index.ts](src/lib/db/index.ts)** — seluruh blok auto-heal DDL **dihapus** (Fase 6).

### 4.5 `INSERT OR IGNORE` ➜ `ON CONFLICT DO NOTHING`

Di [src/lib/db/index.ts](src/lib/db/index.ts) baris 589 (blok seed 4 Hak Wajib):

```diff
-      INSERT OR IGNORE INTO pos_anggaran_infaq (id, kode, nama, ...) VALUES (?, ?, ?, ...)
+      INSERT INTO pos_anggaran_infaq (id, kode, nama, ...) VALUES (?, ?, ?, ...)
+      ON CONFLICT (id) DO NOTHING
```

---

## 🚚 Fase 5: Generate Migrasi & Transfer Data

### 5.1 Bersihkan artefak migrasi SQLite

Folder [drizzle/](drizzle) berisi SQL dialect SQLite (`AUTOINCREMENT`, backtick identifier) — **tidak valid** untuk PostgreSQL.

```bash
git rm -r drizzle
mkdir -p drizzle
```

### 5.2 Generate migrasi PostgreSQL

```bash
npm run db:generate
```

Drizzle akan membuat `drizzle/0000_*.sql` dengan DDL PostgreSQL (`serial`, `boolean`, `bigint`, `timestamptz` bila dipakai). **Periksa hasilnya** sebelum apply:

```bash
grep -n "serial\|boolean\|bigint\|CREATE TABLE" drizzle/0000_*.sql | head -30
```

Pastikan: (a) 23 `CREATE TABLE`, (b) 7 `serial`, (c) kolom timestamp jadi `bigint`.

### 5.3 Apply migrasi ke PostgreSQL

```bash
export DATABASE_URL=postgres://satu_generus:satu_generus@localhost:5432/satu_generus
npm run db:migrate
```

### 5.4 Reset sequence untuk kolom `serial`

> ⚠️ Kalau Anda meng-insert data **dengan `id` eksplisit** (seperti pada langkah 5.5), sequence PostgreSQL **tidak ikut maju**. Insert berikutnya dari aplikasi akan gagal `duplicate key value violates unique constraint`. Wajib di-reset setelah transfer.

Simpan sebagai [scripts/reset-sequences.sql](scripts/reset-sequences.sql) — **sudah tersedia di repo** — dan jalankan **setelah** transfer data:

```sql
-- @file scripts/reset-sequences.sql
-- @purpose Menyelaraskan sequence PostgreSQL dengan nilai id maksimum setelah transfer data eksplisit
-- @usedBy Operator setelah import data dari SQLite (psql -f scripts/reset-sequences.sql)
-- @dependencies PostgreSQL 10+ (pg_get_serial_sequence)
-- @sideEffects Menjalankan setval pada sequence tabel ber-PK serial
SELECT setval(pg_get_serial_sequence('daerah', 'id'),              COALESCE((SELECT MAX(id) FROM daerah), 1));
SELECT setval(pg_get_serial_sequence('desa', 'id'),                COALESCE((SELECT MAX(id) FROM desa), 1));
SELECT setval(pg_get_serial_sequence('kelompok', 'id'),            COALESCE((SELECT MAX(id) FROM kelompok), 1));
SELECT setval(pg_get_serial_sequence('sub_kelompok', 'id'),        COALESCE((SELECT MAX(id) FROM sub_kelompok), 1));
SELECT setval(pg_get_serial_sequence('dapukan', 'id'),             COALESCE((SELECT MAX(id) FROM dapukan), 1));
SELECT setval(pg_get_serial_sequence('jadwal_pengajian_template', 'id'), COALESCE((SELECT MAX(id) FROM jadwal_pengajian_template), 1));
SELECT setval(pg_get_serial_sequence('presensi_jadwal', 'id'),     COALESCE((SELECT MAX(id) FROM presensi_jadwal), 1));
```

```bash
psql "$DATABASE_URL" -f scripts/reset-sequences.sql
```

### 5.5 Pindahkan data (opsional, bila sudah ada data nyata)

**Jangan** pakai `SELECT *` mentah. Gunakan `pgloader` (paling aman, mapping tipe otomatis) atau jalur manual berikut.

**Opsi A — `pgloader` (direkomendasikan):**

```bash
docker run --rm --network host dimitri/pgloader:latest \
  pgloader sqlite:///home/user/Projects/satu-generus/data/sqlite.db \
           postgresql://satu_generus:satu_generus@localhost:5432/satu_generus
```

`pgloader` menangani konversi `0/1 ➜ boolean` dan `integer ➜ bigint` secara otomatis. **Tetap jalankan langkah 5.4** setelahnya.

**Opsi B — Manual (SQLite ➜ CSV ➜ PostgreSQL):**

```bash
# 1. Ekspor per tabel dari SQLite (contoh: users)
sqlite3 data/sqlite.db -header -csv \
  "SELECT id, kelompok_id, nama_lengkap, email, no_telepon, password_hash FROM users;" \
  > /tmp/users.csv

# 2. Import ke PostgreSQL dengan kolom EKSPLISIT
psql "$DATABASE_URL" -c "\copy users (id, kelompok_id, nama_lengkap, email, no_telepon, password_hash) FROM '/tmp/users.csv' WITH (FORMAT csv, HEADER true, NULL '')"
```

> Untuk kolom boolean (`is_4s`, `is_kk`, dst.), SQLite menyimpan `0`/`1`. Tambahkan transformasi eksplisit:
> ```sql
> \copy dapukan (id, nama_dapukan, is_4s) FROM PROGRAM 'sed "s/,0$/,false/; s/,1$/,true/" /tmp/dapukan.csv' WITH (FORMAT csv, HEADER true)
> ```
> Atau konversi di SQLite dulu: `SELECT id, nama_dapukan, CASE WHEN is_4s = 1 THEN 'true' ELSE 'false' END FROM dapukan;`

### 5.6 Verifikasi jumlah baris

```bash
# SQLite
sqlite3 data/sqlite.db "SELECT 'users', COUNT(*) FROM users UNION ALL SELECT 'keluarga', COUNT(*) FROM keluarga;"
# PostgreSQL
psql "$DATABASE_URL" -c "SELECT 'users', COUNT(*) FROM users UNION ALL SELECT 'keluarga', COUNT(*) FROM keluarga;"
```

---

## 🧹 Fase 6: Hapus Auto-Heal DDL (Wajib)

[src/lib/db/index.ts](src/lib/db/index.ts) lama berisi ±600 baris DDL auto-heal SQLite: `PRAGMA table_info`, `sqlite_master`, `ALTER TABLE ... ADD COLUMN`, `PRAGMA user_version`, dan auto-seed 4 Hak Wajib. **Semuanya tidak valid di PostgreSQL.**

Setelah Fase 2.1 (file sudah ditulis ulang) dan Fase 5 (migrasi Drizzle sudah menangani DDL), pastikan:

- ✅ Tidak ada lagi `PRAGMA`, `sqlite_master`, `sqlite.prepare`, `sqlite.exec` di seluruh `src/`.
- ✅ Perubahan skema ke depan **hanya** lewat `npm run db:generate` + `npm run db:migrate`.
- ✅ Seed 4 Hak Wajib dipindahkan ke [src/lib/db/seed.ts](src/lib/db/seed.ts) (bukan di jalur koneksi).

**Verifikasi:**

```bash
grep -rn "sqlite\|PRAGMA\|better-sqlite3" --include="*.ts" src/ && echo "❌ MASIH ADA" || echo "✅ BERSIH"
```

---

## 📜 Fase 7: Script npm & Seed

### 7.1 Perbarui [package.json](package.json)

```diff
  "scripts": {
    "dev": "svelte-kit sync && vite dev",
    "build": "vite build",
    "preview": "vite preview",
    "start": "node build",
    "prepare": "svelte-kit sync || echo ''",
    "check": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json",
-   "db:generate": "drizzle-kit generate",
-   "db:migrate": "drizzle-kit migrate",
-   "db:push": "drizzle-kit push",
-   "db:studio": "drizzle-kit studio",
-   "db:seed": "npx tsx src/lib/db/seed.ts"
+   "db:generate": "drizzle-kit generate",
+   "db:migrate": "tsx src/lib/db/run-migrate.ts",
+   "db:push": "drizzle-kit push",
+   "db:studio": "drizzle-kit studio",
+   "db:seed": "tsx src/lib/db/seed.ts",
+   "db:reset": "drizzle-kit drop && npm run db:migrate && npm run db:seed"
  },
```

> `drizzle-kit migrate` tetap bisa dipakai, tapi tidak ramah untuk *build pipeline* Docker multi-stage. Buat runner kecil agar konsisten dipakai di lokal & server:

```ts
/**
 * @file src/lib/db/run-migrate.ts
 * @purpose Runner migrasi Drizzle ke PostgreSQL yang dipakai lokal maupun build pipeline
 * @usedBy npm run db:migrate, entrypoint container, deploy.sh
 * @dependencies drizzle-orm/postgres-js/migrator, src/lib/db/index.ts
 * @publicFunctions runMigrations
 * @sideEffects Menjalankan file SQL di folder drizzle/ ke PostgreSQL lalu menutup pool
 */

import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db, client } from './index';
import path from 'node:path';

export async function runMigrations() {
	console.log('🔄 Menjalankan migrasi Drizzle ke PostgreSQL...');
	await migrate(db, { migrationsFolder: path.resolve(process.cwd(), 'drizzle') });
	console.log('✅ Migrasi database berhasil diterapkan.');
}

runMigrations()
	.then(() => client.end())
	.catch(async (err) => {
		console.error('❌ Gagal menjalankan migrasi:', err);
		await client.end();
		process.exit(1);
	});
```

### 7.2 Sesuaikan [src/lib/db/seed.ts](src/lib/db/seed.ts)

Ubah pola sinkron (20 call site) + hapus `sqlite.close()`:

```diff
-import { db, sqlite } from './index';
+import { db, client, first } from './index';
...
-    let rec = db.select().from(daerah).where(eq(daerah.nama, d.nama)).get();
+    let rec = await first(db.select().from(daerah).where(eq(daerah.nama, d.nama)));
     if (!rec) {
-      [rec] = db.insert(daerah).values(d).returning().all();
+      [rec] = await db.insert(daerah).values(d).returning();
     }
...
-  seed().then(() => { sqlite.close(); process.exit(0); })
+  seed().then(() => { client.end(); process.exit(0); })
```

Tambahkan blok seed 4 Hak Wajib yang sebelumnya ada di auto-heal:

```ts
// Seed 4 Hak Wajib default (dulu di auto-heal src/lib/db/index.ts)
const wajib = await first(
	db.select({ val: count() }).from(posAnggaranInfaq).where(eq(posAnggaranInfaq.isWajib, true))
);
if (!wajib || wajib.val === 0) {
	const now = Date.now();
	await db.insert(posAnggaranInfaq).values([
		{ id: 'hw_pusat',    kode: 'HW-PUSAT',    nama: 'Hak Pusat',    tingkatScope: 'Pusat',    isWajib: true, urutan: 1, createdAt: now, updatedAt: now },
		{ id: 'hw_daerah',   kode: 'HW-DAERAH',   nama: 'Hak Daerah',   tingkatScope: 'Daerah',   isWajib: true, urutan: 2, createdAt: now, updatedAt: now },
		{ id: 'hw_desa',     kode: 'HW-DESA',     nama: 'Hak Desa',     tingkatScope: 'Desa',     isWajib: true, urutan: 3, createdAt: now, updatedAt: now },
		{ id: 'hw_kelompok', kode: 'HW-KELOMPOK', nama: 'Hak Kelompok', tingkatScope: 'Kelompok', isWajib: true, urutan: 4, createdAt: now, updatedAt: now }
	]).onConflictDoNothing();
}
```

> `onConflictDoNothing()` = pengganti `INSERT OR IGNORE`.

---

## 🐳 Fase 8: Docker untuk Lokal (App + PostgreSQL)

Untuk lokal, pakai **satu compose** berisi app (dev) + PostgreSQL.

> 📦 **File sudah tersedia di repo:** [docker-compose.postgres.yml](docker-compose.postgres.yml) dan [Dockerfile.postgres](Dockerfile.postgres) sudah dibuat, sehingga **environment SQLite yang sedang berjalan tidak langsung rusak**. Aktifkan dengan menimpa file lama **setelah** migrasi kode selesai:
>
> ```bash
> mv docker-compose.postgres.yml docker-compose.yml
> mv Dockerfile.postgres Dockerfile
> ```

Isi [docker-compose.postgres.yml](docker-compose.postgres.yml):

```yaml
# @file docker-compose.yml
# @purpose Orkestrasi development lokal: SvelteKit dev server + PostgreSQL 16 dengan healthcheck & volume persisten
# @usedBy docker compose up -d (development lokal)
# @dependencies Dockerfile (target dev), volume ./uploads, named volume pgdata
# @publicFunctions service: postgres, app
# @sideEffects Mengekspos 5173 (app) & 5432 (db), menulis data DB ke named volume pgdata dan file upload ke ./uploads
services:
  postgres:
    image: postgres:16-alpine
    container_name: satu-generus-db
    environment:
      POSTGRES_USER: satu_generus
      POSTGRES_PASSWORD: satu_generus
      POSTGRES_DB: satu_generus
      TZ: Asia/Jakarta
      PGTZ: Asia/Jakarta
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      # Hanya untuk inspeksi lokal via GUI (DBeaver/dbx). Di produksi JANGAN diekspos.
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U satu_generus -d satu_generus"]
      interval: 5s
      timeout: 5s
      retries: 10
    restart: unless-stopped

  app:
    build:
      context: .
      dockerfile: Dockerfile
      target: dev
    container_name: satu-generus-dev
    depends_on:
      postgres:
        condition: service_healthy
    ports:
      - "5173:5173"
    environment:
      - NODE_ENV=development
      - HOST=0.0.0.0
      - PORT=5173
      # Nama host = nama service compose, bukan localhost
      - DATABASE_URL=postgres://satu_generus:satu_generus@postgres:5432/satu_generus
    volumes:
      - .:/app
      - /app/node_modules
      # File upload TIDAK lagi di ./data, tapi di ./uploads
      - ./uploads:/app/uploads
    restart: unless-stopped

volumes:
  pgdata:
```

> ⚠️ **Catatan penting:** `DATABASE_URL` harus memakai hostname `postgres` (nama service), **bukan** `localhost`. `localhost` di dalam container menunjuk ke container app itu sendiri.

Jalankan:

```bash
docker compose up -d
docker compose exec app npm run db:migrate
docker compose exec app npm run db:seed
docker compose logs -f app        # tunggu "Vite dev server running"
```

---

## 🖥️ Fase 9: Deploy Server TANPA Docker

Skenario: build di lokal/CI, jalankan di VPS dengan **systemd + PostgreSQL native**.

### 9.1 Dockerfile multi-stage (build artifact, bukan runtime)

Ganti [Dockerfile](Dockerfile) lama dengan multi-stage (tersedia di repo sebagai [Dockerfile.postgres](Dockerfile.postgres)) — stage `dev` untuk compose lokal, `builder` menghasilkan `build/` (adapter-node), lalu di server dijalankan via Node native:

```dockerfile
# @file Dockerfile
# @purpose Multi-stage build SvelteKit adapter-node: stage `dev` untuk docker compose lokal, stage `builder` menghasilkan artifact produksi, stage `prod` sebagai referensi runtime non-Docker
# @usedBy docker compose (target dev), CI/build lokal (target builder)
# @dependencies node:22-slim
# @publicFunctions N/A
# @sideEffects Menghasilkan folder /app/build berisi server adapter-node siap jalan
FROM node:22-slim AS base
WORKDIR /app
ENV NODE_ENV=development

# ---------- Stage 1: dependencies ----------
FROM base AS deps
COPY package*.json ./
RUN npm install --legacy-peer-deps

# ---------- Stage 2: development (dipakai docker compose lokal) ----------
FROM base AS dev
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN mkdir -p /app/uploads
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]

# ---------- Stage 3: builder (menghasilkan artifact produksi) ----------
FROM base AS builder
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---------- Stage 4: production (referensi runtime di dalam container) ----------
FROM node:22-slim AS prod
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
COPY --from=builder /app/build ./build
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/drizzle ./drizzle
RUN mkdir -p /app/uploads
EXPOSE 3000
CMD ["node", "build"]
```

> 💡 **Kunci deploy non-Docker:** artifact yang dibutuhkan server hanyalah **`build/`**, **`node_modules/`**, **`drizzle/`** (untuk migrasi), dan folder **`uploads/`**. Tidak butuh Docker di server.

### 9.2 Build & kirim artifact ke server

```bash
# Di lokal / CI
npm ci
npm run build
npm run db:generate          # pastikan migrasi terbaru ter-commit

# Kirim artifact (tanpa Docker)
rsync -avz --delete \
  build/ node_modules/ drizzle/ package.json \
  user@server:/var/www/satu-generus/
```

### 9.3 PostgreSQL di server (native, tanpa Docker)

```bash
sudo apt update && sudo apt install -y postgresql postgresql-contrib
sudo -u postgres psql <<'SQL'
CREATE USER satu_generus WITH PASSWORD 'GANTI_PASSWORD_KUAT';
CREATE DATABASE satu_generus OWNER satu_generus;
ALTER DATABASE satu_generus SET timezone TO 'Asia/Jakarta';
SQL
```

> ⚠️ `ALTER DATABASE ... SET timezone` memastikan `CURRENT_DATE` (dipakai Fase 4.1) konsisten dengan WIB, sesuai perilaku `date('now','localtime')` SQLite.

Batasi koneksi ke localhost saja (default sudah `listen_addresses = 'localhost'` di `postgresql.conf`). **Jangan** ekspos port 5432 ke publik.

### 9.4 Jalankan migrasi di server

```bash
cd /var/www/satu-generus
export DATABASE_URL='postgres://satu_generus:GANTI_PASSWORD_KUAT@127.0.0.1:5432/satu_generus'
export ORIGIN='https://domain-anda.com'
export ENCRYPTION_KEY='GANTI_DENGAN_KUNCI_32_KARAKTER'
node -e "import('./build/handler.js')"   # sanity check opsional
npx drizzle-kit migrate                   # atau: npm run db:migrate
```

> 🔐 `ENCRYPTION_KEY` **harus sama** dengan yang dipakai saat data NIK/No. KK dienkripsi. Menggantinya membuat data lama tidak terbaca (AES-256-GCM).

### 9.5 systemd service

Buat `/etc/systemd/system/satu-generus.service`:

```ini
# @file /etc/systemd/system/satu-generus.service
# @purpose Menjalankan SvelteKit adapter-node Satu Generus sebagai service systemd di server tanpa Docker
# @usedBy systemctl (enable/start/restart)
# @dependencies Node.js 22+, PostgreSQL lokal, folder /var/www/satu-generus
# @publicFunctions N/A
# @sideEffects Menjalankan proses Node persist di port 3000 dan menulis log ke journald
[Unit]
Description=Satu Generus (SvelteKit adapter-node)
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/satu-generus
EnvironmentFile=/var/www/satu-generus/.env
ExecStart=/usr/bin/node build
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

Buat `/var/www/satu-generus/.env` (jangan pernah commit):

```env
NODE_ENV=production
HOST=127.0.0.1
PORT=3000
ORIGIN=https://domain-anda.com
DATABASE_URL=postgres://satu_generus:GANTI_PASSWORD_KUAT@127.0.0.1:5432/satu_generus
DB_POOL_MAX=10
ENCRYPTION_KEY=GANTI_DENGAN_KUNCI_32_KARAKTER
```

```bash
sudo chown -R www-data:www-data /var/www/satu-generus
sudo chmod 600 /var/www/satu-generus/.env
sudo systemctl daemon-reload
sudo systemctl enable --now satu-generus
sudo systemctl status satu-generus
```

> `HOST=127.0.0.1` + reverse proxy (Nginx/Caddy) di depan — jangan bind ke `0.0.0.0` agar tidak langsung terekspos.

### 9.6 Perbarui [deploy.sh](deploy.sh)

```diff
  #!/bin/bash
  set -e

  echo "=== Menarik Update Terbaru ==="
  git pull

  echo "=== Memperbarui Dependensi ==="
- npm install
+ npm ci
+
+ echo "=== Menjalankan Migrasi PostgreSQL ==="
+ npm run db:migrate

  echo "=== Membangun Aplikasi ==="
  npm run build

  echo "=== Restart Service ==="
- # Sesuaikan dengan runner server Anda:
- # Jika menggunakan Docker:
- # docker compose restart app
- # Atau jika menggunakan PM2/Node langsung:
- pm2 restart satu-generus
+ sudo systemctl restart satu-generus

  echo "=== Deployment Selesai! ==="
```

### 9.7 Nginx reverse proxy (referensi)

```nginx
server {
    listen 443 ssl http2;
    server_name domain-anda.com;

    client_max_body_size 10M;   # agar upload foto/bukti transfer tidak ditolak

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## ↩️ Rollback

Bila migrasi gagal di tengah jalan:

```bash
# 1. Kembali ke kode SQLite
git checkout main

# 2. Pulihkan database SQLite dari backup
cp data/sqlite.db.bak-YYYYMMDD data/sqlite.db
cp data/sqlite.db-wal.bak-YYYYMMDD data/sqlite.db-wal   # bila ada

# 3. Kembalikan dependensi
npm install

# 4. Jalankan ulang dev
npm run dev
```

> PostgreSQL terpisah total dari SQLite — **tidak ada risiko** database lama rusak selama Anda hanya *membaca* SQLite (Opsi 5.5), bukan memodifikasinya.

---

## ✅ Checklist Definition of Done

- [ ] `grep -rn "better-sqlite3\|sqlite\|PRAGMA" --include="*.ts" src/` ➜ **0 hasil**
- [ ] `grep -rn "\.get()\|\.all()\|\.run()" --include="*.ts" src/` ➜ **0 hasil**
- [ ] `grep -rn "julianday\|INSERT OR IGNORE" --include="*.ts" src/` ➜ **0 hasil**
- [ ] Semua `getAccessibleWilayah(` & `getKeluargaForUser(` dipanggil dengan `await`
- [ ] `npm run check` ➜ **0 errors, 0 warnings**
- [ ] `npm run db:migrate` ➜ sukses, 23 tabel terbuat
- [ ] `npm run db:seed` ➜ sukses, 4 Hak Wajib tersedia
- [ ] Login `admin@satugenerus.id` berhasil (uji `hooks.server.ts`)
- [ ] Uji insert data dengan `created_at = Date.now()` (uji `bigint`, jangan sampai overflow)
- [ ] Total nominal di modul Keuangan tampil sebagai **angka**, bukan string tergabung
- [ ] Urutan jadwal presensi terdekat benar (uji `CURRENT_DATE`)
- [ ] Upload foto presensi/bukti transfer berhasil (uji volume `./uploads`)
- [ ] `docker compose up -d` lokal ➜ app + PostgreSQL sehat
- [ ] Server non-Docker: `systemctl status satu-generus` ➜ **active (running)**
- [ ] Header doc di `schema.ts`, `db/index.ts`, `drizzle.config.ts`, `Dockerfile`, `docker-compose.yml` sudah diperbarui
- [ ] `scripts/reset-sequences.sql` sudah dijalankan (bila ada transfer data)

---

## 📌 Perubahan File (Ringkasan)

| File | Aksi |
| :--- | :--- |
| [src/lib/db/schema.ts](src/lib/db/schema.ts) | ✏️ `sqliteTable`➜`pgTable`, `integer`➜`serial`/`boolean`/`bigint` |
| [src/lib/db/index.ts](src/lib/db/index.ts) | 🔄 Tulis ulang: `postgres-js` + `first()` helper; auto-heal dihapus |
| [src/lib/db/run-migrate.ts](src/lib/db/run-migrate.ts) | ➕ Baru: runner migrasi |
| [src/lib/db/migrate.ts](src/lib/db/migrate.ts) | ❌ Hapus |
| [src/lib/db/seed.ts](src/lib/db/seed.ts) | ✏️ `await` + `onConflictDoNothing` + seed Hak Wajib |
| [drizzle.config.ts](drizzle.config.ts) | ✏️ `dialect: 'postgresql'` |
| [drizzle/](drizzle) | 🔄 Regenerate (dialect SQLite dibuang) |
| [src/hooks.server.ts](src/hooks.server.ts) | ✏️ `await first(...)` |
| [src/lib/server/scope.ts](src/lib/server/scope.ts) | ✏️ 2 fungsi jadi `async` |
| [src/lib/server/sensus.ts](src/lib/server/sensus.ts) | ✏️ 2 fungsi jadi `async` |
| 27 × `+page.server.ts` | ✏️ `await` pada semua query |
| 4 file raw SQL | ✏️ `db.execute(sql\`...\`)` + sintaks PG |
| [package.json](package.json) | ✏️ Script + dependensi |
| [.env.example](.env.example) | ✏️ `DATABASE_URL` PostgreSQL |
| [Dockerfile.postgres](Dockerfile.postgres) | ➕ Baru: multi-stage (`dev`/`builder`/`prod`) — aktifkan via `mv` |
| [Dockerfile](Dockerfile) | ❌ Digantikan `Dockerfile.postgres` setelah migrasi |
| [docker-compose.postgres.yml](docker-compose.postgres.yml) | ➕ Baru: app + PostgreSQL + healthcheck — aktifkan via `mv` |
| [docker-compose.yml](docker-compose.yml) | ❌ Digantikan `docker-compose.postgres.yml` setelah migrasi |
| [docker-compose.dev.yml](docker-compose.dev.yml) | ➕ Baru: PostgreSQL saja untuk dev host |
| [scripts/reset-sequences.sql](scripts/reset-sequences.sql) | ➕ Baru |
| [deploy.sh](deploy.sh) | ✏️ Tambah langkah migrasi + systemd restart |
| [README.md](README.md) | ✏️ Update tech stack & panduan |

---

## 🔗 Referensi Terkait

- [SCHEMA.md](SCHEMA.md) — struktur tabel & relationship (tidak berubah)
- [WALKTHROUGH.md](WALKTHROUGH.md) — walkthrough implementasi awal
- [RULES.md](RULES.md) — standar penulisan kode (DRY, header doc, scoping)
- [Drizzle ORM — PostgreSQL](https://orm.drizzle.team/docs/get-started-postgresql)
- [postgres-js — Options](https://github.com/porsager/postgres#connection-details)
- [postgres-js — Custom Types](https://github.com/porsager/postgres#custom-types)
- [pgloader — SQLite to PostgreSQL](https://pgloader.readthedocs.io/en/latest/ref/sqlite.html)

---

## 🧪 Lampiran: Hasil Verifikasi Empiris

Seluruh klaim teknis di dokumen ini diuji langsung terhadap **PostgreSQL 16.15** memakai driver `postgres-js`. Hasilnya:

| # | Klaim | Status |
| :--- | :--- | :--- |
| 1 | `Date.now()` = `1791969863092` melebihi batas `int4` (`2147483647`) | ✅ Terbukti |
| 2 | Insert ms ke kolom `integer` gagal: *"out of range for type integer"* | ✅ Terbukti |
| 3 | `bigint({ mode: 'number' })` menyimpan ms dengan benar | ✅ Terbukti |
| 4 | `count(*)` dikembalikan sebagai **string** (`"3"`) | ✅ Terbukti |
| 5 | `sum(n)` dikembalikan sebagai **string** (`"350000"`) | ✅ Terbukti |
| 6 | `"3" + 1 === "31"` — bug konkatenasi nyata | ✅ Terbukti |
| 7 | `count(*)::int` ➜ **number** | ✅ Terbukti |
| 8 | `sum(n)::bigint` ➜ **masih string** (koreksi penting) | ✅ Terbukti |
| 9 | `sum(n)::float8` ➜ **number** | ✅ Terbukti |
| 10 | Override parser `types` int8+numeric ➜ semua agregat **number** | ✅ Terbukti |
| 11 | `sum(bigint)::int` **overflow** (`integer out of range`) | ✅ Terbukti |
| 12 | `julianday()` tidak ada di PostgreSQL | ✅ Terbukti |
| 13 | `ABS(tanggal::date - CURRENT_DATE)` mengurutkan by kedekatan | ✅ Terbukti |
| 14 | `CURRENT_DATE` benar setelah `SET timezone = 'Asia/Jakarta'` | ✅ Terbukti |
| 15 | `INSERT OR IGNORE` ➜ syntax error di PostgreSQL | ✅ Terbukti |
| 16 | `ON CONFLICT (id) DO NOTHING` bekerja | ✅ Terbukti |
| 17 | `is_4s = 1` ditolak: *"operator does not exist: boolean = integer"* | ✅ Terbukti |
| 18 | `LIKE '%KU%'` case-sensitive (sama seperti SQLite) | ✅ Terbukti |
| 19 | `ILIKE` case-insensitive (perlu hanya bila diinginkan) | ✅ Terbukti |
| 20 | `ON CONFLICT ... DO UPDATE SET n = excluded.n` bekerja | ✅ Terbukti |
| 21 | Sequence desync setelah insert id eksplisit ➜ *duplicate key* | ✅ Terbukti |
| 22 | `setval(pg_get_serial_sequence(...))` memperbaiki sequence | ✅ Terbukti |
| 23 | Transaction `sql.begin(async (tx) => ...)` bekerja | ✅ Terbukti |

**Snippet `docker-compose.yml` & `docker-compose.dev.yml`:** divalidasi dengan `docker compose config` ➜ **valid**.
**Snippet `Dockerfile`:** divalidasi dengan `docker buildx build --check` ➜ **no warnings found**.
