/**
 * @file src/routes/(app)/profil/+page.server.ts
 * @purpose Memuat informasi profil pengguna dan server action untuk update profil, ganti password, serta pemindahan kelompok mandiri khusus Superadmin/Admin Pusat
 * @usedBy src/routes/(app)/profil/+page.svelte
 * @dependencies src/lib/db, src/lib/db/schema, drizzle-orm, src/lib/server/auth, src/lib/server/scope
 * @publicFunctions load, actions.updateProfile, actions.updatePassword, actions.pindahKelompokSaya
 * @sideEffects Mengambil & memperbarui data pengguna pada tabel PostgreSQL users
 */

import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db, first } from '#lib/db/index.js';
import { users, kelompok, desa, daerah } from '#lib/db/schema.js';
import { eq, and, ne } from 'drizzle-orm';
import { hashPassword, verifyPassword } from '#lib/server/auth.js';
import { getAdminScope } from '#lib/server/scope.js';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(303, '/login?redirectTo=/profil');
	}

	let kelompokNama = 'Belum terhubung';
	if (locals.user.kelompokId) {
		const kel = await first(
			db.select().from(kelompok).where(eq(kelompok.id, locals.user.kelompokId))
		);
		if (kel) {
			kelompokNama = kel.nama;
		}
	}

	// Hanya Superadmin / Admin Pusat yang boleh memindahkan kelompok sendiri.
	// Admin daerah/desa/kelompok terikat pada wilayahnya sehingga tidak diberi hak ini.
	const adminScope = getAdminScope(locals.roles ?? []);
	const canMoveKelompok = adminScope.isPusat;
	if (!canMoveKelompok) {
		return { user: locals.user, isAdmin: locals.isAdmin, kelompokNama, canMoveKelompok: false, daftarKelompok: [] };
	}

	const daftarKelompok = await db
		.select({
			id: kelompok.id,
			nama: kelompok.nama,
			desaNama: desa.nama,
			daerahNama: daerah.nama
		})
		.from(kelompok)
		.leftJoin(desa, eq(kelompok.desaId, desa.id))
		.leftJoin(daerah, eq(desa.daerahId, daerah.id))
		.orderBy(daerah.nama, desa.nama, kelompok.nama);

	return {
		user: locals.user,
		isAdmin: locals.isAdmin,
		kelompokNama,
		canMoveKelompok: true,
		daftarKelompok
	};
};

export const actions: Actions = {
	updateProfile: async ({ request, locals }) => {
		if (!locals.user) {
			throw redirect(303, '/login');
		}

		const formData = await request.formData();
		const namaLengkap = formData.get('namaLengkap')?.toString()?.trim() || '';
		const email = formData.get('email')?.toString()?.trim()?.toLowerCase() || '';

		if (!namaLengkap) {
			return fail(400, {
				profileError: 'Nama lengkap wajib diisi.'
			});
		}

		if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
			return fail(400, {
				profileError: 'Alamat email tidak valid.'
			});
		}

		// Cek apakah email sudah digunakan oleh user lain
		const existingUser = (await first(db
			.select({ id: users.id })
			.from(users)
			.where(and(eq(users.email, email), ne(users.id, locals.user.id)))
			));

		if (existingUser) {
			return fail(400, {
				profileError: 'Alamat email tersebut sudah digunakan oleh akun lain.'
			});
		}

		// Update data user
		try {
(await db.update(users)
				.set({
					namaLengkap,
					email
				})
				.where(eq(users.id, locals.user.id))
);
		} catch (error) {
			console.error('Gagal memperbarui profil pengguna:', error);
			return fail(500, {
				profileError: 'Terjadi kesalahan sistem saat memperbarui profil.'
			});
		}

		return {
			profileSuccess: 'Profil Tersimpan'
		};
	},

	updatePassword: async ({ request, locals }) => {
		if (!locals.user) {
			throw redirect(303, '/login');
		}

		const formData = await request.formData();
		const currentPassword = formData.get('currentPassword')?.toString() || '';
		const newPassword = formData.get('newPassword')?.toString() || '';
		const confirmPassword = formData.get('confirmPassword')?.toString() || '';

		if (!currentPassword || !newPassword || !confirmPassword) {
			return fail(400, {
				passwordError: 'Semua kolom kata sandi wajib diisi.'
			});
		}

		if (newPassword.length < 6) {
			return fail(400, {
				passwordError: 'Kata sandi baru minimal 6 karakter.'
			});
		}

		if (newPassword !== confirmPassword) {
			return fail(400, {
				passwordError: 'Konfirmasi kata sandi baru tidak cocok.'
			});
		}

		// Ambil user record untuk verifikasi hash password saat ini
		const userRecord = (await first(db
			.select({ id: users.id, passwordHash: users.passwordHash })
			.from(users)
			.where(eq(users.id, locals.user.id))
			));

		if (!userRecord) {
			return fail(404, {
				passwordError: 'Pengguna tidak ditemukan.'
			});
		}

		const isCurrentValid = await verifyPassword(currentPassword, userRecord.passwordHash);
		if (!isCurrentValid) {
			return fail(400, {
				passwordError: 'Kata sandi saat ini salah.'
			});
		}

		// Hash password baru dan simpan
		try {
			const newHash = await hashPassword(newPassword);
(await db.update(users)
				.set({ passwordHash: newHash })
				.where(eq(users.id, locals.user.id))
);
		} catch (error) {
			console.error('Gagal memperbarui kata sandi:', error);
			return fail(500, {
				passwordError: 'Terjadi kesalahan sistem saat memperbarui kata sandi.'
			});
		}

		return {
			passwordSuccess: 'Kata Sandi Diperbarui'
		};
	},

	/**
	 * Memindahkan kelompok akun sendiri. HANYA untuk Superadmin / Admin Pusat.
	 * Admin Daerah/Desa/Kelompok terikat wilayah sehingga tidak berhak memakai aksi ini.
	 */
	pindahKelompokSaya: async ({ request, locals }) => {
		if (!locals.user) {
			throw redirect(303, '/login');
		}

		const adminScope = getAdminScope(locals.roles ?? []);
		if (!adminScope.isPusat) {
			return fail(403, {
				moveError: 'Hanya Superadmin yang dapat memindahkan kelompok akun sendiri.'
			});
		}

		const formData = await request.formData();
		const kelompokIdStr = formData.get('kelompokId')?.toString()?.trim() || '';
		const kelompokId = parseInt(kelompokIdStr, 10);

		if (!kelompokIdStr || Number.isNaN(kelompokId)) {
			return fail(400, { moveError: 'Kelompok tujuan wajib dipilih.' });
		}

		// Pastikan kelompok tujuan benar-benar ada
		const target = await first(
			db.select({ id: kelompok.id, nama: kelompok.nama }).from(kelompok).where(eq(kelompok.id, kelompokId))
		);
		if (!target) {
			return fail(404, { moveError: 'Kelompok tujuan tidak ditemukan.' });
		}

		try {
			await db.update(users).set({ kelompokId }).where(eq(users.id, locals.user.id));
		} catch (error) {
			console.error('Gagal memindahkan kelompok akun sendiri:', error);
			return fail(500, { moveError: 'Terjadi kesalahan sistem saat memindahkan kelompok.' });
		}

		return { moveSuccess: `Berhasil dipindahkan ke ${target.nama}.` };
	}
};


