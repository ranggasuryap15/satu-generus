/**
 * @file src/lib/server/crypto.ts
 * @purpose Layanan enkripsi dan dekripsi dua arah AES-256-GCM untuk data sensitif (NIK & No. KK) serta masking string
 * @usedBy Form actions sensus, API unmasking admin, dan layanan server-side
 * @dependencies node:crypto
 * @publicFunctions encryptSensitive, decryptSensitive, maskSensitive
 * @sideEffects Operasi kriptografi in-memory
 */

import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const DEFAULT_DEV_KEY = 'satu_generus_secret_key_32bytes!'; // Tepat 32 bytes untuk fallback dev

function getEncryptionKey(): Buffer {
	const rawKey = process.env.ENCRYPTION_KEY || DEFAULT_DEV_KEY;
	if (rawKey.length === 64 && /^[0-9a-fA-F]+$/.test(rawKey)) {
		return Buffer.from(rawKey, 'hex');
	}
	const buf = Buffer.from(rawKey, 'utf-8');
	if (buf.length >= 32) {
		return buf.subarray(0, 32);
	}
	// Pad jika kurang dari 32 bytes
	return Buffer.concat([buf, Buffer.alloc(32 - buf.length, 0)]);
}

/**
 * Mengenkripsi teks sensitif (NIK / No. KK) menjadi format 'iv:authTag:encryptedHex'
 */
export function encryptSensitive(plainText: string): string {
	if (!plainText) return '';
	const key = getEncryptionKey();
	const iv = crypto.randomBytes(12); // Standar 96-bit IV untuk GCM
	const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

	let encrypted = cipher.update(plainText, 'utf8', 'hex');
	encrypted += cipher.final('hex');
	const authTag = cipher.getAuthTag().toString('hex');

	return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Mendekripsi payload ciphertext 'iv:authTag:encryptedHex' kembali ke plaintext asli
 */
export function decryptSensitive(payload: string): string {
	if (!payload) return '';
	const parts = payload.split(':');
	if (parts.length !== 3) {
		throw new Error('Format ciphertext tidak valid (ekspektasi iv:authTag:ciphertext)');
	}

	const [ivHex, authTagHex, encryptedHex] = parts;
	const key = getEncryptionKey();
	const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
	decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));

	let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
	decrypted += decipher.final('utf8');

	return decrypted;
}

/**
 * Menyembunyikan bagian tengah teks sensitif untuk tampilan aman (misal: 3216**********12)
 */
export function maskSensitive(text: string): string {
	if (!text) return '-';
	const cleaned = text.trim();
	if (cleaned.length <= 6) return '******';
	const prefix = cleaned.slice(0, 4);
	const suffix = cleaned.slice(-2);
	const maskLength = Math.max(cleaned.length - 6, 6);
	return `${prefix}${'*'.repeat(maskLength)}${suffix}`;
}

