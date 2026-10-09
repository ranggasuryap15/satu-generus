/**
 * @file src/routes/+layout.server.ts
 * @purpose Root layout server load untuk menyediakan data user session dan status admin ke seluruh halaman
 * @usedBy src/routes/+layout.svelte dan seluruh komponen anak SvelteKit
 * @dependencies SvelteKit locals
 * @publicFunctions load
 * @sideEffects Mengembalikan data event.locals.user, roles, dan isAdmin ke client page data
 */

import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	return {
		user: locals.user,
		roles: locals.roles,
		isAdmin: locals.isAdmin
	};
};
