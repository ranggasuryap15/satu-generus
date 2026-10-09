/**
 * @file src/routes/(app)/profil/+page.server.ts
 * @purpose Memuat informasi profil pengguna dan server action untuk update profil (nama, email) serta ganti password
 * @usedBy src/routes/(app)/profil/+page.svelte
 * @dependencies src/lib/db, src/lib/db/schema, drizzle-orm, src/lib/server/auth
 * @publicFunctions load, actions.updateProfile, actions.updatePassword
 * @sideEffects Mengambil & memperbarui data pengguna di tabel SQLite users
 */

import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/db';
import { users, kelompok } from '$lib/db/schema';
import { eq, and, ne } from 'drizzle-orm';
import { hashPassword, verifyPassword } from '$lib/server/auth';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(303, '/login?redirectTo=/profil');
	}

	let kelompokNama = 'Belum terhubung';
	if (locals.user.kelompokId) {
		const kel = db.select().from(kelompok).where(eq(kelompok.id, locals.user.kelompokId)).get();
		if (kel) {
			kelompokNama = kel.nama;
		}
	}

	return {
		user: locals.user,
		isAdmin: locals.isAdmin,
		kelompokNama
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
		const existingUser = db
			.select({ id: users.id })
			.from(users)
			.where(and(eq(users.email, email), ne(users.id, locals.user.id)))
			.get();

		if (existingUser) {
			return fail(400, {
				profileError: 'Alamat email tersebut sudah digunakan oleh akun lain.'
			});
		}

		// Update data user
		try {
			db.update(users)
				.set({
					namaLengkap,
					email
				})
				.where(eq(users.id, locals.user.id))
				.run();
		} catch (error) {
			console.error('Gagal memperbarui profil pengguna:', error);
			return fail(500, {
				profileError: 'Terjadi kesalahan sistem saat memperbarui profil.'
			});
		}

		return {
			profileSuccess: 'Profil berhasil diperbarui.'
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
		const userRecord = db
			.select({ id: users.id, passwordHash: users.passwordHash })
			.from(users)
			.where(eq(users.id, locals.user.id))
			.get();

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
			db.update(users)
				.set({ passwordHash: newHash })
				.where(eq(users.id, locals.user.id))
				.run();
		} catch (error) {
			console.error('Gagal memperbarui kata sandi:', error);
			return fail(500, {
				passwordError: 'Terjadi kesalahan sistem saat memperbarui kata sandi.'
			});
		}

		return {
			passwordSuccess: 'Kata sandi berhasil diperbarui.'
		};
	}
};


