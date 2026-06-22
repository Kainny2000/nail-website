import type { APIRoute } from "astro";
import { clearAll } from "../../../server/lib/session";
import { audit } from "../../../server/lib/audit";

export const POST: APIRoute = async ({ locals }) => {
  if (locals.session) {
    await audit({ kind: "logout", user: locals.session.login, ip: locals.ip });
  }
  const res = new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
  clearAll(res);
  return res;
};
