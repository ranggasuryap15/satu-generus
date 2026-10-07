/**
 * @file src/routes/api/sensus/unmask/+server.ts
 * @purpose Endpoint API khusus admin 4S untuk mendekripsi data sensitif (Unmask NIK / No. KK)
 * @usedBy Modal verifikasi admin pada src/routes/(admin)/admin/sensus/+page.svelte
 * @dependencies src/lib/db, src/lib/db/schema, src/lib/server/crypto
 * @publicFunctions POST
 * @sideEffects Mendekripsi ciphertext NIK/KK secara terkontrol dengan verifikasi wewenang admin
 */

import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/db';
import { keluarga, anggotaKeluarga } from '$lib/db/schema';
import { eq } from 'drizzle-orm';
import { decryptSensitive } from '$lib/server/crypto';

export const POST: RequestHandler = async ({ request, locals }) => {
	// Wajib login dan memiliki wewenang Admin 4S
	if (!locals.user || !locals.isAdmin) {
		return json({ error: 'Akses ditolak: Anda tidak memiliki wewenang admin 4S.' }, { status: 403 });
	}

	const body = await request.json();
	const { keluargaId, anggotaId } = body;

	if (keluargaId) {
		const k = db.select().from(keluarga).where(eq(keluarga.id, keluargaId)).get();
		if (!k) {
			return json({ error: 'Data keluarga tidak ditemukan.' }, { status: 404 });
		}
		try {
			const plainNoKk = decryptSensitive(k.noKkEncrypted);
			return json({ type: 'KK', id: keluargaId, original: plainNoKk });
		} catch (e) {
			return json({ error: 'Gagal mendekripsi data.' }, { status: 500 });
		}
	}

	if (anggotaId) {
		const a = db.select().from(anggotaKeluarga).where(eq(anggotaKeluarga.id, anggotaId)).get();
		if (!a) {
			return json({ error: 'Data anggota keluarga tidak ditemukan.' }, { status: 404 });
		}
		try {
			const plainNik = decryptSensitive(a.nikEncrypted);
			return json({ type: 'NIK', id: anggotaId, original: plainNik });
		} catch (e) {
			return json({ error: 'Gagal mendekripsi data.' }, { status: 500 });
		}
	}

	return json({ error: 'Parameter keluargaId atau anggotaId wajib disediakan.' }, { status: 400 });
};

