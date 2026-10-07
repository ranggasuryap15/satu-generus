/**
 * @file src/routes/logout/+server.ts
 * @purpose Endpoint pembersihan cookie session pengguna dan redirect ke halaman login
 * @usedBy Link keluar akun pada Sidebar Admin dan Profil Jamaah
 * @dependencies src/lib/server/auth
 * @publicFunctions GET, POST
 * @sideEffects Menghapus cookie session pengguna dan redirect HTTP 303 ke /login
 */

import { redirect, type RequestHandler } from '@sveltejs/kit';
import { clearSession } from '$lib/server/auth';

export const GET: RequestHandler = ({ cookies }) => {
	clearSession(cookies);
	throw redirect(303, '/login');
};

export const POST: RequestHandler = ({ cookies }) => {
	clearSession(cookies);
	throw redirect(303, '/login');
};

