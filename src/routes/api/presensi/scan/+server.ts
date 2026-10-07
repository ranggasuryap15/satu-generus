/**
 * @file src/routes/api/presensi/scan/+server.ts
 * @purpose API verifikasi scan QR Code jamaah dari scanner kamera smartphone admin
 * @usedBy Komponen scanner pada src/routes/(admin)/admin/presensi/[jadwalId]/scan/+page.svelte
 * @dependencies src/lib/db, src/lib/db/schema, drizzle-orm
 * @publicFunctions POST
 * @sideEffects Validasi wewenang admin, upsert status Hadir dan waktuScan ke presensi_kehadiran
 */

import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/db';
import { presensiJadwal, presensiKehadiran, users } from '$lib/db/schema';
import { eq, and } from 'drizzle-orm';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user || !locals.isAdmin) {
		return json({ error: 'Akses ditolak: Hanya pengurus admin yang dapat memindai kehadiran.' }, { status: 403 });
	}

	const body = await request.json();
	const { jadwalId, qrPayload } = body;

	if (!jadwalId || !qrPayload) {
		return json({ error: 'Data scan tidak lengkap.' }, { status: 400 });
	}

	// Parsing format payload: SGQR:<userId>:<kelompokId>
	if (!qrPayload.startsWith('SGQR:')) {
		return json({ error: 'Format QR Code tidak valid untuk aplikasi Satu Generus.' }, { status: 400 });
	}

	const parts = qrPayload.split(':');
	const userId = parts[1];

	if (!userId) {
		return json({ error: 'User ID tidak valid dalam kode QR.' }, { status: 400 });
	}

	// Validasi user di database
	const jamaah = db.select().from(users).where(eq(users.id, userId)).get();
	if (!jamaah) {
		return json({ error: 'Data jamaah tidak terdaftar dalam sistem.' }, { status: 404 });
	}

	// Validasi jadwal
	const jadwal = db.select().from(presensiJadwal).where(eq(presensiJadwal.id, Number(jadwalId))).get();
	if (!jadwal) {
		return json({ error: 'Jadwal kegiatan tidak ditemukan.' }, { status: 404 });
	}

	const nowSeconds = Math.floor(Date.now() / 1000);

	// Upsert kehadiran: jika sudah ada, update status Hadir dan waktuScan
	const existing = db
		.select()
		.from(presensiKehadiran)
		.where(
			and(
				eq(presensiKehadiran.jadwalId, Number(jadwalId)),
				eq(presensiKehadiran.userId, userId)
			)
		)
		.get();

	if (existing) {
		db.update(presensiKehadiran)
			.set({
				status: 'Hadir',
				waktuScan: nowSeconds
			})
			.where(eq(presensiKehadiran.id, existing.id))
			.run();
	} else {
		db.insert(presensiKehadiran)
			.values({
				jadwalId: Number(jadwalId),
				userId,
				status: 'Hadir',
				waktuScan: nowSeconds
			})
			.run();
	}

	return json({
		success: true,
		namaLengkap: jamaah.namaLengkap,
		status: 'Hadir',
		waktu: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
	});
};

