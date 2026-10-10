/**
 * @file src/routes/logout/+server.ts
 * @purpose Endpoint pembersihan cookie session pengguna dan redirect ke halaman login
 * @usedBy Dropdown profil pada AdminTopBar, ClientTopBar, dan halaman Profil
 * @dependencies src/lib/server/auth
 * @publicFunctions GET, POST
 * @sideEffects Menghapus cookie session pengguna dan redirect HTTP 303 ke /login
 */

import { clearSession } from "$lib/server/auth";
import { redirect, type RequestHandler } from "@sveltejs/kit";

export const GET: RequestHandler = ({ cookies, setHeaders }) => {
  clearSession(cookies);
  setHeaders({
    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    Pragma: "no-cache",
  });
  throw redirect(303, "/login");
};

export const POST: RequestHandler = ({ cookies, setHeaders }) => {
  clearSession(cookies);
  setHeaders({
    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    Pragma: "no-cache",
  });
  throw redirect(303, "/login");
};
