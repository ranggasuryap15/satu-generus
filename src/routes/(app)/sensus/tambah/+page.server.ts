/**
 * @file src/routes/(app)/sensus/tambah/+page.server.ts
 * @purpose Form action pendaftaran sensus KK/anggota keluarga dengan enkripsi AES-256-GCM, validasi noTelepon numerik (wajib untuk kepala keluarga yang memiliki akun, opsional untuk anggota lain)
 * @usedBy Wizard form sensus pada src/routes/(app)/sensus/tambah/+page.svelte
 * @dependencies src/lib/db, src/lib/db/schema, src/lib/server/crypto, src/lib/server/sensus (getKeluargaForUser), src/lib/utils (normalizeDateToISO), src/lib/generus, drizzle-orm
 * @publicFunctions load, actions.default
 * @sideEffects Menulis record terenkripsi ke tabel keluarga, anggota_keluarga, dan sinkronisasi users.no_telepon dalam satu transaksi SQLite atomik
 */

import { db } from "$lib/db";
import { anggotaKeluarga, keluarga, users } from "$lib/db/schema";
import { encryptSensitive } from "$lib/server/crypto";
import { getKeluargaForUser } from "$lib/server/sensus";
import { normalizeDateToISO } from "$lib/utils";
import { hitungStatusGenerus, hitungUmur, resolveStatusPernikahan } from "$lib/generus";
import { fail, redirect } from "@sveltejs/kit";
import { eq } from "drizzle-orm";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) {
    throw redirect(303, "/login?redirectTo=/sensus/tambah");
  }

  // Jika user sudah memiliki KK sendiri, arahkan langsung ke halaman sensus KK miliknya dengan modal tambah anggota aktif
  const userKeluarga = await getKeluargaForUser(locals.user.id);
  if (userKeluarga) {
    throw redirect(303, "/sensus?tambah=1");
  }

  return {
    user: locals.user,
  };
};

export const actions: Actions = {
  default: async ({ request, locals }) => {
    if (!locals.user) {
      throw redirect(303, "/login");
    }

    const formData = await request.formData();
    const noKk = formData.get("noKk")?.toString()?.trim() || "";
    const alamatLengkap =
      formData.get("alamatLengkap")?.toString()?.trim() || "";
    const anggotaJson = formData.get("anggotaData")?.toString() || "[]";

    // Validasi Nomor KK (opsional, jika diisi wajib 16 digit angka)
    if (noKk) {
      if (noKk.length !== 16 || !/^\d+$/.test(noKk)) {
        return fail(400, {
          error: "Nomor Kartu Keluarga harus 16 digit angka.",
          noKk,
          alamatLengkap,
        });
      }
    }

    let anggotaList: Array<{
      namaLengkap?: string;
      nik?: string;
      statusHubungan: string;
      tanggalLahir: string;
      jenisKelamin: string;
      noTelepon?: string;
    }> = [];

    try {
      anggotaList = JSON.parse(anggotaJson);
    } catch (_) {
      return fail(400, {
        error: "Format data anggota keluarga tidak valid.",
        noKk,
        alamatLengkap,
      });
    }

    if (!Array.isArray(anggotaList) || anggotaList.length === 0) {
      return fail(400, {
        error: "Minimal 1 anggota keluarga wajib didaftarkan.",
        noKk,
        alamatLengkap,
      });
    }

    // Validasi setiap anggota
    for (let i = 0; i < anggotaList.length; i++) {
      const a = anggotaList[i];
      const nikVal = a.nik ? a.nik.trim() : "";
      if (nikVal) {
        if (nikVal.length !== 16 || !/^\d+$/.test(nikVal)) {
          return fail(400, {
            error: `NIK anggota ke-${i + 1} harus 16 digit angka.`,
            noKk,
            alamatLengkap,
          });
        }
      }
      if (!a.statusHubungan || !a.tanggalLahir || !a.jenisKelamin) {
        return fail(400, {
          error: `Data anggota ke-${i + 1} belum lengkap.`,
          noKk,
          alamatLengkap,
        });
      }

      const isKepala = a.statusHubungan === "Kepala Keluarga" || i === 0;
      const cleanHp = a.noTelepon ? a.noTelepon.trim().replace(/\D/g, "") : "";

      if (isKepala) {
        if (!cleanHp) {
          return fail(400, {
            error: "Nomor HP Kepala Keluarga (pemilik akun) wajib diisi.",
            noKk,
            alamatLengkap,
          });
        }
        if (!/^\d{8,16}$/.test(cleanHp)) {
          return fail(400, {
            error: "Nomor HP Kepala Keluarga harus berupa angka valid (8-16 digit).",
            noKk,
            alamatLengkap,
          });
        }
      } else if (cleanHp) {
        if (!/^\d{8,16}$/.test(cleanHp)) {
          return fail(400, {
            error: `Nomor HP anggota ke-${i + 1} (${a.namaLengkap || a.statusHubungan}) tidak valid (harus 8-16 digit angka).`,
            noKk,
            alamatLengkap,
          });
        }
      }
    }

    // Eksekusi enkripsi data sensitif (Zero Plaintext di DB)
    const noKkEncrypted = noKk ? encryptSensitive(noKk) : null;

    // Cek apakah user sudah memiliki KK (agar masuk ke KK dia sendiri, bukan buat KK baru ganda)
    const existingKeluarga = await getKeluargaForUser(locals.user.id);

    // Transaksi database: Minimum Lock & Atomicity
    try {
      await db.transaction(async (tx) => {
        let targetKeluargaId: string;

        if (!existingKeluarga) {
          // Jika user belum punya KK, buat kartu keluarga baru
          const [newKeluarga] = (await tx
            .insert(keluarga)
            .values({
              noKkEncrypted,
              kepalaKeluargaId: locals.user?.id,
              alamatLengkap,
            })
            .returning()
);
          targetKeluargaId = newKeluarga.id;
        } else {
          targetKeluargaId = existingKeluarga.id;
          // Jika sudah punya KK, perbarui No KK / alamat jika sebelumnya belum terisi
          const updates: {
            noKkEncrypted?: string | null;
            alamatLengkap?: string;
          } = {};
          if (noKkEncrypted && !existingKeluarga.noKkEncrypted) {
            updates.noKkEncrypted = noKkEncrypted;
          }
          if (
            alamatLengkap &&
            (!existingKeluarga.alamatLengkap ||
              existingKeluarga.alamatLengkap === "-")
          ) {
            updates.alamatLengkap = alamatLengkap;
          }
          if (Object.keys(updates).length > 0) {
(await tx.update(keluarga)
              .set(updates)
              .where(eq(keluarga.id, targetKeluargaId))
);
          }
        }

        for (let i = 0; i < anggotaList.length; i++) {
          const a = anggotaList[i];
          const isKepala = a.statusHubungan === "Kepala Keluarga" || i === 0;
          const cleanHp = a.noTelepon ? a.noTelepon.trim().replace(/\D/g, "") : null;
          const nikVal = a.nik ? a.nik.trim() : "";
          const isoTgl = normalizeDateToISO(a.tanggalLahir);
          const statusPernikahan = resolveStatusPernikahan(a.statusHubungan);
          const umur = isoTgl ? hitungUmur(isoTgl) : 0;
          const statusGenerus = isoTgl ? hitungStatusGenerus(umur, statusPernikahan) : null;

          if (isKepala && cleanHp && locals.user?.id) {
(await tx.update(users)
              .set({ noTelepon: cleanHp })
              .where(eq(users.id, locals.user.id))
);
          }

(await tx.insert(anggotaKeluarga)
            .values({
              keluargaId: targetKeluargaId,
              userId: isKepala ? locals.user?.id : null,
              namaLengkap:
                a.namaLengkap?.trim() || locals.user?.namaLengkap || "Anggota",
              nikEncrypted: nikVal ? encryptSensitive(nikVal) : null,
              statusHubungan: a.statusHubungan,
              tanggalLahir: isoTgl,
              jenisKelamin: a.jenisKelamin,
              noTelepon: cleanHp || null,
              statusPernikahan,
              statusGenerus,
              statusJamaah: "Aktif",
              isrun: isKepala ? "Ya" : "Tidak"
            })
);
        }
      });
    } catch (error) {
      console.error("Gagal menyimpan sensus keluarga:", error);
      return fail(500, {
        error: "Terjadi kesalahan sistem saat menyimpan data sensus.",
        noKk,
        alamatLengkap,
      });
    }

    throw redirect(303, "/sensus");
  },
};
