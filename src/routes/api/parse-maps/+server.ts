/**
 * @file src/routes/api/parse-maps/+server.ts
 * @purpose Endpoint API untuk mem-parsing koordinat dan nama tempat dari link Google Maps (termasuk shortlink maps.app.goo.gl)
 * @usedBy src/lib/components/LocationPicker.svelte
 * @dependencies @sveltejs/kit
 * @publicFunctions POST
 * @sideEffects Melakukan HTTP fetch ke Google Maps untuk mengikuti redirect shortlink dan mengekstrak koordinat
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

function extractCoordinatesFromText(text: string): { lat: number; lng: number } | null {
	// 1. Koordinat langsung: "-6.2088, 106.8456"
	const directMatch = text.trim().match(/^(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)$/);
	if (directMatch) {
		return { lat: parseFloat(directMatch[1]), lng: parseFloat(directMatch[2]) };
	}

	// 2. Format @lat,lng (Google Maps Place URL)
	const atMatch = text.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
	if (atMatch) {
		return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) };
	}

	// 3. Format query parameter: q=lat,lng / query=lat,lng / ll=lat,lng / destination=lat,lng
	const queryMatch = text.match(/[?&](?:q|ll|query|destination)=(-?\d+\.\d+)[,%20,]+(-?\d+\.\d+)/);
	if (queryMatch) {
		return { lat: parseFloat(queryMatch[1]), lng: parseFloat(queryMatch[2]) };
	}

	// 4. Format data parameter internal google maps: !3d-6.2088!4d106.8456
	const dataMatch = text.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
	if (dataMatch) {
		return { lat: parseFloat(dataMatch[1]), lng: parseFloat(dataMatch[2]) };
	}

	return null;
}

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		return json({ error: 'Akses ditolak.' }, { status: 401 });
	}

	const body = await request.json().catch(() => ({}));
	const inputUrl = (body.url || '').toString().trim();

	if (!inputUrl) {
		return json({ error: 'Link atau koordinat Google Maps wajib diisi.' }, { status: 400 });
	}

	// Cek apakah koordinat langsung dapat diekstrak dari teks URL tanpa HTTP fetch
	const directCoords = extractCoordinatesFromText(inputUrl);
	if (directCoords) {
		return json({
			success: true,
			lat: directCoords.lat,
			lng: directCoords.lng,
			gmapsUrl: inputUrl
		});
	}

	// Jika berupa link web yang memerlukan resolving redirect (misal: maps.app.goo.gl atau goo.gl/maps)
	if (inputUrl.startsWith('http://') || inputUrl.startsWith('https://')) {
		try {
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 6000);

			const response = await fetch(inputUrl, {
				method: 'GET',
				redirect: 'follow',
				headers: {
					'User-Agent':
						'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
				},
				signal: controller.signal
			});
			clearTimeout(timeoutId);

			const finalUrl = response.url;
			const finalCoords = extractCoordinatesFromText(finalUrl);

			if (finalCoords) {
				return json({
					success: true,
					lat: finalCoords.lat,
					lng: finalCoords.lng,
					gmapsUrl: finalUrl
				});
			}

			// Coba cari koordinat di dalam isi HTML (meta tags atau script content)
			const htmlText = await response.text();
			const htmlCoords = extractCoordinatesFromText(htmlText);

			if (htmlCoords) {
				return json({
					success: true,
					lat: htmlCoords.lat,
					lng: htmlCoords.lng,
					gmapsUrl: finalUrl
				});
			}
		} catch (fetchErr) {
			console.error('Error saat follow redirect Google Maps:', fetchErr);
		}
	}

	return json(
		{
			error:
				'Format link Google Maps tidak dikenali atau koordinat tidak ditemukan. Anda dapat memasukkan titik koordinat langsung (contoh: -6.2088, 106.8456) atau menggunakan pencarian tempat.'
		},
		{ status: 400 }
	);
};

