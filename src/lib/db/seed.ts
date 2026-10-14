/**
 * @file src/lib/db/seed.ts
 * @purpose Seeder data minimal untuk bootstrap awal: master dapukan baku (Superadmin, Admin Pusat & 4S), satu akun Superadmin, serta 4 Hak Wajib pos anggaran infaq. Data wilayah sengaja tidak di-seed agar operator mengisinya sendiri lewat menu Data Wilayah.
 * @usedBy npm run db:seed, setup lingkungan awal, deploy.sh
 * @dependencies src/lib/db, src/lib/db/schema, src/lib/server/auth, drizzle-orm
 * @publicFunctions seed
 * @sideEffects Insert idempoten (aman diulang) ke tabel PostgreSQL dapukan, users, user_dapukan, pos_anggaran_infaq
 */

import { eq } from "drizzle-orm";
import { hashPassword } from "../server/auth";
import { client, db, first } from "./index";
import { dapukan, posAnggaranInfaq, userDapukan, users } from "./schema";

/** Kredensial akun superadmin awal. WAJIB diganti setelah login pertama. */
const SUPERADMIN_EMAIL = "superadmin@satugenerus.id";
const SUPERADMIN_NAMA = "Superadmin Satu Generus";
const DEFAULT_PASSWORD = "password123";

/** Master dapukan baku. is4S = pengurus inti dengan hak elevated. */
const MASTER_DAPUKAN = [
  { namaDapukan: "Superadmin", is4S: true },
  { namaDapukan: "Admin Pusat", is4S: true },
  { namaDapukan: "Kyai", is4S: true },
  { namaDapukan: "Wakil Kyai", is4S: true },
  { namaDapukan: "Sekretaris / Penerobos", is4S: true },
  { namaDapukan: "KU/Bendahara", is4S: true },
  { namaDapukan: "Mubaligh/Ulama", is4S: true },
  { namaDapukan: "Aghnia", is4S: true },
];

/** Empat Hak Wajib pos anggaran infaq yang dipakai modul FR (tidak boleh dihapus). */
const HAK_WAJIB = [
  {
    id: "hw_pusat",
    kode: "HW-PUSAT",
    nama: "Hak Pusat",
    tingkatScope: "Pusat",
    urutan: 1,
  },
  {
    id: "hw_daerah",
    kode: "HW-DAERAH",
    nama: "Hak Daerah",
    tingkatScope: "Daerah",
    urutan: 2,
  },
  {
    id: "hw_desa",
    kode: "HW-DESA",
    nama: "Hak Desa",
    tingkatScope: "Desa",
    urutan: 3,
  },
  {
    id: "hw_kelompok",
    kode: "HW-KELOMPOK",
    nama: "Hak Kelompok",
    tingkatScope: "Kelompok",
    urutan: 4,
  },
];

/**
 * Mengisi master dapukan, akun superadmin, dan 4 Hak Wajib.
 * Idempoten: record yang sudah ada akan diperbarui, bukan diduplikasi.
 */
export async function seed() {
  console.log("🌱 Memulai seeding database Satu Generus...");

  // 1. Master Dapukan baku
  for (const d of MASTER_DAPUKAN) {
    const existing = await first(
      db.select().from(dapukan).where(eq(dapukan.namaDapukan, d.namaDapukan)),
    );
    if (existing) {
      await db
        .update(dapukan)
        .set({ is4S: d.is4S })
        .where(eq(dapukan.id, existing.id));
    } else {
      await db.insert(dapukan).values(d);
    }
  }
  console.log(
    `  👔 Master Dapukan baku siap (${MASTER_DAPUKAN.length} dapukan).`,
  );

  // 2. Akun Superadmin (kelompokId null karena wilayah dibuat sendiri oleh operator)
  const superadminDapukan = await first(
    db.select().from(dapukan).where(eq(dapukan.namaDapukan, "Superadmin")),
  );
  if (!superadminDapukan) {
    throw new Error("Dapukan Superadmin gagal dibuat. Seeding dihentikan.");
  }

  const passwordHash = await hashPassword(DEFAULT_PASSWORD);
  const existingSuperadmin = await first(
    db.select().from(users).where(eq(users.email, SUPERADMIN_EMAIL)),
  );

  let superadminId: string;
  if (existingSuperadmin) {
    await db
      .update(users)
      .set({ namaLengkap: SUPERADMIN_NAMA, passwordHash })
      .where(eq(users.id, existingSuperadmin.id));
    superadminId = existingSuperadmin.id;
    console.log(`  👤 Akun superadmin diperbarui: ${SUPERADMIN_EMAIL}`);
  } else {
    const [created] = await db
      .insert(users)
      .values({
        namaLengkap: SUPERADMIN_NAMA,
        email: SUPERADMIN_EMAIL,
        passwordHash,
      })
      .returning();
    superadminId = created.id;
    console.log(`  👤 Akun superadmin dibuat: ${SUPERADMIN_EMAIL}`);
  }

  // 3. Wewenang Superadmin (scope Pusat, tanpa wilayah)
  const existingRole = await first(
    db.select().from(userDapukan).where(eq(userDapukan.userId, superadminId)),
  );
  if (existingRole) {
    await db
      .update(userDapukan)
      .set({ dapukanId: superadminDapukan.id, tingkatScope: "Pusat" })
      .where(eq(userDapukan.id, existingRole.id));
  } else {
    await db.insert(userDapukan).values({
      userId: superadminId,
      dapukanId: superadminDapukan.id,
      tingkatScope: "Pusat",
    });
  }
  console.log("  🔑 Wewenang Superadmin (scope Pusat) siap.");

  // 4. Empat Hak Wajib pos anggaran infaq
  const now = Date.now();
  await db
    .insert(posAnggaranInfaq)
    .values(
      HAK_WAJIB.map((h) => ({
        id: h.id,
        kode: h.kode,
        nama: h.nama,
        deskripsi: `Alokasi wajib rutin untuk tingkat ${h.tingkatScope}`,
        tingkatScope: h.tingkatScope,
        isWajib: true,
        tipeAlokasi: "nominal",
        urutan: h.urutan,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      })),
    )
    .onConflictDoNothing();
  console.log(
    `  💰 ${HAK_WAJIB.length} Hak Wajib (Pusat, Daerah, Desa, Kelompok) siap.`,
  );

  console.log("✅ Seeding selesai.");
  console.log("   Login awal : %s", SUPERADMIN_EMAIL);
  console.log(
    "   Password   : %s (WAJIB diganti setelah login)",
    DEFAULT_PASSWORD,
  );
  console.log(
    "   Langkah    : buat Daerah/Desa/Kelompok lewat menu Data Wilayah.",
  );
}

// Eksekusi langsung jika dipanggil via tsx/node
if (
  process.argv[1]?.endsWith("seed.ts") ||
  process.argv[1]?.endsWith("seed.js")
) {
  seed()
    .then(async () => {
      await client.end();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error("❌ Gagal seeding:", err);
      await client.end();
      process.exit(1);
    });
}
