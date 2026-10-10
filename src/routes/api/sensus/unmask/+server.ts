/**
 * @file src/routes/api/sensus/unmask/+server.ts
 * @purpose Endpoint API untuk mendekripsi data sensitif (Unmask NIK / No. KK) bagi Admin 4S atau Pemilik KK (mendukung penanganan data kosong/null)
 * @usedBy Modal verifikasi admin dan halaman sensus jamaah (src/routes/(app)/sensus/+page.svelte)
 * @dependencies src/lib/db, src/lib/db/schema, src/lib/server/crypto
 * @publicFunctions POST
 * @sideEffects Mendekripsi ciphertext NIK/KK dengan verifikasi wewenang admin 4S atau pemilik KK yang sah
 */

import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/db';
import { keluarga, anggotaKeluarga } from '$lib/db/schema';
import { eq } from 'drizzle-orm';
import { decryptSensitive } from '$lib/server/crypto';

export const POST: RequestHandler = async ({ request, locals }) => {
	// Wajib login
	if (!locals.user) {
		return json({ error: 'Akses ditolak: Silakan masuk/login terlebih dahulu.' }, { status: 401 });
	}

	const body = await request.json();
	const { keluargaId, anggotaId } = body;

	if (keluargaId) {
		const k = db.select().from(keluarga).where(eq(keluarga.id, keluargaId)).get();
		if (!k) {
			return json({ error: 'Data keluarga tidak ditemukan.' }, { status: 404 });
		}

		// Verifikasi wewenang: Admin 4S ATAU Kepala/Pemilik Keluarga sah
		const isOwner = k.kepalaKeluargaId === locals.user.id;
		if (!locals.isAdmin && !isOwner) {
			return json(
				{ error: 'Akses ditolak: Anda bukan pemilik kartu keluarga ini dan tidak memiliki hak akses admin.' },
				{ status: 403 }
			);
		}

		if (!k.noKkEncrypted) {
			return json({ type: 'KK', id: keluargaId, original: 'Belum diisi' });
		}

		try {
			const plainNoKk = decryptSensitive(k.noKkEncrypted);
			return json({ type: 'KK', id: keluargaId, original: plainNoKk });
		} catch (e) {
			return json({ error: 'Gagal mendekripsi data nomor KK.' }, { status: 500 });
		}
	}

	if (anggotaId) {
		const a = db.select().from(anggotaKeluarga).where(eq(anggotaKeluarga.id, anggotaId)).get();
		if (!a) {
			return json({ error: 'Data anggota keluarga tidak ditemukan.' }, { status: 404 });
		}

		// Cari keluarga terkait untuk verifikasi pemilik
		const k = db.select().from(keluarga).where(eq(keluarga.id, a.keluargaId)).get();
		const isOwner = k && k.kepalaKeluargaId === locals.user.id;
		if (!locals.isAdmin && !isOwner) {
			return json(
				{ error: 'Akses ditolak: Anda bukan pemilik kartu keluarga ini dan tidak memiliki hak akses admin.' },
				{ status: 403 }
			);
		}

		if (!a.nikEncrypted) {
			return json({ type: 'NIK', id: anggotaId, original: 'Belum diisi' });
		}

		try {
			const plainNik = decryptSensitive(a.nikEncrypted);
			return json({ type: 'NIK', id: anggotaId, original: plainNik });
		} catch (e) {
			return json({ error: 'Gagal mendekripsi data NIK.' }, { status: 500 });
		}
	}

	return json({ error: 'Parameter keluargaId atau anggotaId wajib disediakan.' }, { status: 400 });
};
