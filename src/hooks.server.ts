/**
 * @file src/hooks.server.ts
 * @purpose Middleware otorisasi, penanganan CORS, ekstraksi session cookie, dan route guard SvelteKit
 * @usedBy SvelteKit server runtime pada setiap HTTP request
 * @dependencies src/lib/db, src/lib/db/schema, src/lib/server/auth
 * @publicFunctions handle
 * @sideEffects Mengisi event.locals, menyematkan header CORS, menangani OPTIONS preflight, dan redirect route
 */

import { redirect } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';
import { db } from '$lib/db';
import { users, userDapukan, dapukan } from '$lib/db/schema';
import { eq } from 'drizzle-orm';
import { getSessionUserId } from '$lib/server/auth';

export const handle: Handle = async ({ event, resolve }) => {
	// Preflight request handling untuk CORS
	if (event.request.method === 'OPTIONS') {
		const requestOrigin = event.request.headers.get('origin');
		return new Response(null, {
			status: 204,
			headers: {
				'Access-Control-Allow-Origin': requestOrigin || '*',
				'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
				'Access-Control-Allow-Headers':
					event.request.headers.get('access-control-request-headers') ||
					'Content-Type, Authorization, X-Requested-With, Accept, Origin',
				'Access-Control-Allow-Credentials': 'true',
				'Access-Control-Max-Age': '86400'
			}
		});
	}

	const userId = getSessionUserId(event.cookies);

	event.locals.user = null;
	event.locals.roles = [];
	event.locals.isAdmin = false;

	if (userId) {
		const userRecord = db
			.select({
				id: users.id,
				namaLengkap: users.namaLengkap,
				email: users.email,
				kelompokId: users.kelompokId
			})
			.from(users)
			.where(eq(users.id, userId))
			.get();

		if (userRecord) {
			event.locals.user = userRecord;

			// Query role wewenang scope dan jabatan
			const roleRecords = db
				.select({
					tingkatScope: userDapukan.tingkatScope,
					is4S: dapukan.is4S,
					namaDapukan: dapukan.namaDapukan,
					namaDapukanCustom: userDapukan.namaDapukanCustom,
					daerahId: userDapukan.daerahId,
					desaId: userDapukan.desaId,
					kelompokId: userDapukan.kelompokId
				})
				.from(userDapukan)
				.leftJoin(dapukan, eq(userDapukan.dapukanId, dapukan.id))
				.where(eq(userDapukan.userId, userRecord.id))
				.all();

			event.locals.roles = roleRecords;
			// Admin jika memiliki jabatan dengan is4S = true atau scope Pusat
			event.locals.isAdmin = roleRecords.some(
				(r) => r.is4S === true || r.tingkatScope === 'Pusat'
			);
		}
	}

	const path = event.url.pathname;

	// Route Guard: Admin area (/admin/*)
	if (path.startsWith('/admin')) {
		if (!event.locals.user) {
			throw redirect(303, `/login?redirectTo=${encodeURIComponent(path)}`);
		}
		if (!event.locals.isAdmin) {
			throw redirect(303, '/');
		}
	}

	// Route Guard: Halaman login jika sudah login
	if (path === '/login' && event.locals.user) {
		if (event.locals.isAdmin) {
			throw redirect(303, '/admin');
		} else {
			throw redirect(303, '/');
		}
	}

	const response = await resolve(event);

	// Pasang header CORS jika ada Origin header
	const requestOrigin = event.request.headers.get('origin');
	if (requestOrigin) {
		response.headers.set('Access-Control-Allow-Origin', requestOrigin);
		response.headers.set('Access-Control-Allow-Credentials', 'true');
	}

	return response;
};

