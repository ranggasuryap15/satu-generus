/**
 * @file src/app.d.ts
 * @purpose Deklarasi tipe global SvelteKit untuk App.Locals, session user, dan wewenang RBAC
 * @usedBy TypeScript compiler di seluruh routes dan hooks
 * @dependencies N/A (Type declarations)
 * @publicFunctions App.Locals
 * @sideEffects Menyediakan type checking untuk server locals
 */

declare global {
	namespace App {
		interface UserSession {
			id: string;
			namaLengkap: string;
			email: string | null;
			kelompokId: number | null;
		}

		interface UserRole {
			tingkatScope: string;
			is4S: boolean | null;
			namaDapukan: string | null;
			namaDapukanCustom: string | null;
			daerahId: number | null;
			desaId: number | null;
			kelompokId: number | null;
		}

		interface Locals {
			user: UserSession | null;
			roles: UserRole[];
			isAdmin: boolean;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
