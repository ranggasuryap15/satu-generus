/**
 * @file src/lib/server/upload.ts
 * @purpose Utility modul server untuk mengelola penyimpanan file upload user-generated (presensi, bukti transfer shodaqoh, QRIS) di direktori root './uploads' di luar static
 * @usedBy src/routes/(app)/presensi, src/routes/(app)/shodaqoh, src/routes/(admin)/admin/profil-wilayah, src/routes/(admin)/admin/keuangan/shodaqoh, src/routes/uploads/[...file]
 * @dependencies node:fs, node:path
 * @publicFunctions getUploadRootDir, getUploadSubdir, saveUploadedFile
 * @sideEffects Membuat folder uploads di filesystem jika belum ada dan menulis file biner foto/bukti transfer
 */

import fs from 'node:fs';
import path from 'node:path';

/**
 * Mendapatkan direktori absolut root untuk file uploads ('./uploads')
 */
export function getUploadRootDir(): string {
	const rootDir = path.resolve(process.cwd(), 'uploads');
	if (!fs.existsSync(rootDir)) {
		fs.mkdirSync(rootDir, { recursive: true });
	}
	return rootDir;
}

/**
 * Mendapatkan direktori absolut untuk subkategori uploads tertentu
 */
export function getUploadSubdir(subfolder: 'presensi' | 'bukti-transfer' | 'qris'): string {
	const targetDir = path.join(getUploadRootDir(), subfolder);
	if (!fs.existsSync(targetDir)) {
		fs.mkdirSync(targetDir, { recursive: true });
	}
	return targetDir;
}

/**
 * Menyimpan file yang diunggah (baik berupa File instance, Base64 data URL, atau URL string) ke disk
 * @returns Path URL publik (misal '/uploads/presensi/foto_123.jpg') atau null jika tidak ada input
 */
export async function saveUploadedFile(
	fileOrBase64OrUrl: any,
	subfolder: 'presensi' | 'bukti-transfer' | 'qris',
	prefix: string = 'file'
): Promise<string | null> {
	if (!fileOrBase64OrUrl) return null;

	const targetDir = getUploadSubdir(subfolder);

	// Kasus 1: Input berupa File instance dari FormData
	if (fileOrBase64OrUrl instanceof File && fileOrBase64OrUrl.size > 0) {
		const rawExt = fileOrBase64OrUrl.type.split('/')[1] || 'png';
		const ext = rawExt === 'jpeg' ? 'jpg' : rawExt.split(';')[0];
		const filename = `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`;
		const arrayBuffer = await fileOrBase64OrUrl.arrayBuffer();
		fs.writeFileSync(path.join(targetDir, filename), Buffer.from(arrayBuffer));
		return `/uploads/${subfolder}/${filename}`;
	}

	// Kasus 2: Input berupa Base64 Data URI string atau link URL
	if (typeof fileOrBase64OrUrl === 'string') {
		const trimmed = fileOrBase64OrUrl.trim();
		if (trimmed.startsWith('data:image/')) {
			const matches = trimmed.match(/^data:image\/([a-zA-Z0-9-+]+);base64,(.+)$/);
			if (matches) {
				const rawExt = matches[1] || 'jpg';
				const ext = rawExt === 'jpeg' ? 'jpg' : rawExt;
				const buffer = Buffer.from(matches[2], 'base64');
				const filename = `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`;
				fs.writeFileSync(path.join(targetDir, filename), buffer);
				return `/uploads/${subfolder}/${filename}`;
			}
		}
		// Jika sudah berupa URL publik atau path lokal
		return trimmed || null;
	}

	return null;
}

