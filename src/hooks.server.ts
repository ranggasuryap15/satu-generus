import { db } from "$lib/db";
import { dapukan, userDapukan, users } from "$lib/db/schema";
import { getSessionUserId } from "$lib/server/auth";
import { redirect } from "@sveltejs/kit";
import type { Handle } from "@sveltejs/kit/hooks";
import { eq } from "drizzle-orm";

export const handle: Handle = async ({ event, resolve }) => {
  const requestOrigin = event.request.headers.get("origin");

  // 1. Preflight Request Handler (OPTIONS)
  if (event.request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": requestOrigin || "*",
        "Access-Control-Allow-Methods":
          "GET, POST, PUT, PATCH, DELETE, OPTIONS",
        "Access-Control-Allow-Headers":
          event.request.headers.get("access-control-request-headers") ||
          "Content-Type, Authorization, X-Requested-With, Accept, Origin",
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Max-Age": "86400",
        Vary: "Origin",
      },
    });
  }

  // 2. Ekstraksi Autentikasi & Database
  const userId = getSessionUserId(event.cookies);
  event.locals.user = null;
  event.locals.roles = [];
  event.locals.isAdmin = false;

  if (userId) {
    const userRecord = db
      .select({
        id: users.id,
        namaLengkap: users.namaLengkap,
        email: users.email,
        kelompokId: users.kelompokId,
      })
      .from(users)
      .where(eq(users.id, userId))
      .get();

    if (userRecord) {
      event.locals.user = userRecord;

      const roleRecords = db
        .select({
          tingkatScope: userDapukan.tingkatScope,
          is4S: dapukan.is4S,
          namaDapukan: dapukan.namaDapukan,
          namaDapukanCustom: userDapukan.namaDapukanCustom,
          daerahId: userDapukan.daerahId,
          desaId: userDapukan.desaId,
          kelompokId: userDapukan.kelompokId,
        })
        .from(userDapukan)
        .leftJoin(dapukan, eq(userDapukan.dapukanId, dapukan.id))
        .where(eq(userDapukan.userId, userRecord.id))
        .all();

      event.locals.roles = roleRecords;
      event.locals.isAdmin = roleRecords.some(
        (r) => r.is4S === true || r.tingkatScope === "Pusat",
      );
    }
  }

  const path = event.url.pathname;

  // Helper untuk merespons redirect dengan tetap membawa CORS jika dipanggil via fetch/CORS
  const handleProtectedRedirect = (location: string) => {
    if (
      requestOrigin &&
      (path.startsWith("/api") ||
        event.request.headers.get("accept")?.includes("application/json"))
    ) {
      // Untuk pemanggilan API eksternal, kembalikan 401 Unauthorized bukan redirect HTML
      return new Response(
        JSON.stringify({ error: "Unauthorized", redirectTo: location }),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": requestOrigin,
            "Access-Control-Allow-Credentials": "true",
            Vary: "Origin",
          },
        },
      );
    }
    throw redirect(303, location);
  };

  // 3. Route Guard
  if (path.startsWith("/admin")) {
    if (!event.locals.user) {
      const redirectTarget = `/login?redirectTo=${encodeURIComponent(path)}`;
      return handleProtectedRedirect(redirectTarget);
    }
    if (!event.locals.isAdmin) {
      return handleProtectedRedirect("/");
    }
  }

  if (path === "/login" && event.locals.user) {
    throw redirect(303, event.locals.isAdmin ? "/admin" : "/");
  }

  // 4. Resolve Response & Injeksi Header CORS
  const response = await resolve(event);

  if (requestOrigin) {
    response.headers.set("Access-Control-Allow-Origin", requestOrigin);
    response.headers.set("Access-Control-Allow-Credentials", "true");
    response.headers.append("Vary", "Origin");
  }

  return response;
};
