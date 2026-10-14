/**
 * @file src/lib/server/sensus.ts
 * @purpose Helper resolusi kepemilikan dan keterkaitan akun user jamaah ke kartu keluarga (KK) sendiri
 * @usedBy src/routes/(app)/sensus/+page.server.ts, src/routes/(app)/sensus/tambah/+page.server.ts, src/routes/api/sensus/unmask/+server.ts, src/routes/(app)/+page.server.ts
 * @dependencies src/lib/db, src/lib/db/schema, drizzle-orm
 * @publicFunctions getKeluargaForUser, isUserInKeluarga
 * @sideEffects Menjalankan query indexed read ke tabel keluarga dan anggota_keluarga di PostgreSQL
 */

import { db, first } from '$lib/db';
import { keluarga, anggotaKeluarga } from '$lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Mencari data kartu keluarga (KK) milik user sendiri, baik sebagai kepala keluarga
 * maupun sebagai anggota keluarga yang terdaftar dengan user_id.
 */
export async function getKeluargaForUser(userId: string) {
	if (!userId) return null;

	// 1. Cek langsung sebagai kepala keluarga
	const asKepala = await first(
		db.select().from(keluarga).where(eq(keluarga.kepalaKeluargaId, userId))
);
	if (asKepala) return asKepala;

	// 2. Cek sebagai anggota keluarga yang terhubung via userId
	const asAnggota = await first(
		db
		.select({
			keluargaId: anggotaKeluarga.keluargaId
		})
		.from(anggotaKeluarga)
		.where(eq(anggotaKeluarga.userId, userId))
);
	if (asAnggota?.keluargaId) {
		const k = await first(db.select().from(keluarga).where(eq(keluarga.id, asAnggota.keluargaId)));
		if (k) return k;
	}

	return null;
}

/**
 * Memverifikasi apakah user memiliki hak akses / tergabung dalam keluarga tertentu
 */
export async function isUserInKeluarga(userId: string, keluargaId: string): Promise<boolean> {
	if (!userId || !keluargaId) return false;

	const k = await getKeluargaForUser(userId);
	return k !== null && k.id === keluargaId;
}

