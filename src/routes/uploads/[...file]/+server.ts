/**
 * @file src/routes/uploads/[...file]/+server.ts
 * @purpose Endpoint server GET untuk menyajikan file-file upload (presensi, bukti transfer, QRIS) langsung dari folder root './uploads' di luar static
 * @usedBy Klien browser / tag <img> / link preview yang mengakses '/uploads/[...file]'
 * @dependencies node:fs, node:path, src/lib/server/upload.ts
 * @publicFunctions GET
 * @sideEffects Membaca file biner dari disk './uploads' dan menyajikannya via HTTP Response dengan MIME type & cache header yang tepat
 */

import type { RequestHandler } from './$types';
import { getUploadRootDir } from '$lib/server/upload';
import fs from 'node:fs';
import path from 'node:path';

const MIME_MAP: Record<string, string> = {
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.png': 'image/png',
	'.webp': 'image/webp',
	'.gif': 'image/gif',
	'.svg': 'image/svg+xml',
	'.pdf': 'application/pdf',
	'.txt': 'text/plain; charset=utf-8'
};

export const GET: RequestHandler = async ({ params }) => {
	const subpath = params.file;
	if (!subpath) {
		return new Response('Not Found', { status: 404 });
	}

	const rootDir = getUploadRootDir();
	// Sanitasi path untuk mencegah directory traversal vulnerability (../)
	const safePath = path.normalize(subpath).replace(/^(\.\.[\/\\])+/, '');
	const fullPath = path.resolve(rootDir, safePath);

	// Pastikan file target berada di dalam folder uploads
	if (!fullPath.startsWith(rootDir)) {
		return new Response('Forbidden', { status: 403 });
	}

	if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
		return new Response('File Not Found', { status: 404 });
	}

	const ext = path.extname(fullPath).toLowerCase();
	const contentType = MIME_MAP[ext] || 'application/octet-stream';
	const fileBuffer = fs.readFileSync(fullPath);

	return new Response(fileBuffer, {
		status: 200,
		headers: {
			'Content-Type': contentType,
			'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
			'Content-Length': String(fileBuffer.length)
		}
	});
};
