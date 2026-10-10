/**
 * @file src/lib/server/auth.ts
 * @purpose Layanan autentikasi, hashing password bcrypt, dan manajemen cookie session
 * @usedBy src/routes/login/+page.server.ts, src/hooks.server.ts, dan script seed
 * @dependencies bcryptjs, @sveltejs/kit (Cookies)
 * @publicFunctions hashPassword, verifyPassword, createSession, clearSession, getSessionUserId
 * @sideEffects Mengatur dan menghapus HTTP-only cookie pada browser klien
 */

import bcrypt from 'bcryptjs';
import type { Cookies } from '@sveltejs/kit';

const COOKIE_NAME = 'sg_session_user_id';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 hari

/**
 * Melakukan hash pada plaintext password menggunakan bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
	const salt = await bcrypt.genSalt(10);
	return bcrypt.hash(password, salt);
}

/**
 * Memverifikasi kecocokan antara password plaintext dan hash di database
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
	if (!password || !hash) return false;
	return bcrypt.compare(password, hash);
}

/**
 * Menyimpan ID user ke dalam HTTP-Only secure cookie
 */
export function createSession(cookies: Cookies, userId: string): void {
	cookies.set(COOKIE_NAME, userId, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: process.env.NODE_ENV === 'production',
		maxAge: COOKIE_MAX_AGE
	});
}

/**
 * Menghapus cookie session (logout)
 */
export function clearSession(cookies: Cookies): void {
	// Hapus cookie dengan opsi yang identik saat dibuat (termasuk Secure di production)
	cookies.delete(COOKIE_NAME, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: process.env.NODE_ENV === 'production'
	});

	// Hapus juga varian non-secure sebagai fallback kompatibilitas server proxy/HTTP
	cookies.delete(COOKIE_NAME, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: false
	});
}

/**
 * Mengambil ID user dari cookie session
 */
export function getSessionUserId(cookies: Cookies): string | null {
	return cookies.get(COOKIE_NAME) || null;
}

