/**
 * @file src/routes/(app)/profil/+page.server.ts
 * @purpose Memuat informasi profil pengguna, status keanggotaan kelompok, dan role wewenang
 * @usedBy src/routes/(app)/profil/+page.svelte
 * @dependencies src/lib/db, src/lib/db/schema, drizzle-orm
 * @publicFunctions load
 * @sideEffects Mengambil data pengguna dan kelompok dari database SQLite
 */

import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/db';
import { kelompok } from '$lib/db/schema';
import { eq } from 'drizzle-orm';

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

