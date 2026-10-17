/**
 * @file src/hooks.client.ts
 * @purpose Client error handler untuk menangkap dan menampilkan error runtime di browser
 */
import type { HandleClientError } from '@sveltejs/kit/hooks';

export const handleError: HandleClientError = ({ error, event }) => {
	console.error('[CLIENT_ERROR]:', {
		url: event?.url?.href,
		error,
		stack: error instanceof Error ? error.stack : undefined
	});
	return {
		message: (error instanceof Error ? error.message : String(error)) || 'Terjadi kesalahan pada aplikasi.'
	};
};

