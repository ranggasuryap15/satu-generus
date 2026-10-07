/**
 * @file src/routes/login/+page.server.ts
 * @purpose Server action untuk memproses autentikasi login pengguna dan membuat session cookie
 * @usedBy Form login pada src/routes/login/+page.svelte
 * @dependencies src/lib/db, src/lib/db/schema, src/lib/server/auth
 * @publicFunctions load, actions.default
 * @sideEffects Membaca data pengguna dari SQLite, menulis cookie session, dan redirect pengguna
 */

import { fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/db';
import { users, userDapukan, dapukan } from '$lib/db/schema';
import { eq } from 'drizzle-orm';
import { createSession, verifyPassword } from '$lib/server/auth';

export const load: PageServerLoad = async ({ locals }) => {
	// Jika sudah login, redirect
	if (locals.user) {
		if (locals.isAdmin) {
			throw redirect(303, '/admin');
		}
		throw redirect(303, '/');
	}
	return {};
};

export const actions: Actions = {
	default: async ({ request, cookies, url }) => {
		const formData = await request.formData();
		const identifier = formData.get('identifier')?.toString()?.trim() || '';
		const password = formData.get('password')?.toString() || '';

		if (!identifier || !password) {
			return fail(400, {
				identifier,
				error: 'Email/Nomor HP dan kata sandi wajib diisi.'
			});
		}

		// Cari akun pengguna berdasarkan email
		const user = db
			.select()
			.from(users)
			.where(eq(users.email, identifier.toLowerCase()))
			.get();

		if (!user) {
			return fail(400, {
				identifier,
				error: 'Kredensial tidak ditemukan atau kata sandi salah.'
			});
		}

		const isPasswordValid = await verifyPassword(password, user.passwordHash);
		if (!isPasswordValid) {
			return fail(400, {
				identifier,
				error: 'Kredensial tidak ditemukan atau kata sandi salah.'
			});
		}

		// Buat session cookie
		createSession(cookies, user.id);

		// Periksa hak akses untuk mengarahkan pengguna ke dashboard yang tepat
		const roles = db
			.select({
				tingkatScope: userDapukan.tingkatScope,
				is4S: dapukan.is4S
			})
			.from(userDapukan)
			.leftJoin(dapukan, eq(userDapukan.dapukanId, dapukan.id))
			.where(eq(userDapukan.userId, user.id))
			.all();

		const isAdmin = roles.some((r) => r.is4S === true || r.tingkatScope === 'Pusat');
		const redirectTo = url.searchParams.get('redirectTo');

		if (redirectTo && redirectTo.startsWith('/')) {
			throw redirect(303, redirectTo);
		}

		if (isAdmin) {
			throw redirect(303, '/admin');
		}

		throw redirect(303, '/');
	}
};
