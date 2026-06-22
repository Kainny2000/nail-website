import type { APIRoute } from "astro";
import { z } from "zod";
import { verifyTotpCode, totpSecret, totpStatus } from "../../../server/lib/auth";
import { issueSession, clearAll, clearPreAuth } from "../../../server/lib/session";
import { audit } from "../../../server/lib/audit";

const Body = z.object({ code: z.string().min(1).max(10) });

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.pre) {
    return new Response(JSON.stringify({ error: "No pending login" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (!(await totpStatus())) {
    return new Response(JSON.stringify({ error: "TOTP not enrolled" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  let body;
  try {
    body = Body.parse(await request.json());
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const secret = await totpSecret();
  if (!secret || !verifyTotpCode(secret, body.code)) {
    await audit({ kind: "totp-fail", user: locals.pre.login, ip: locals.ip });
    const res = new Response(JSON.stringify({ error: "Invalid code" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
    clearAll(res);
    return res;
  }
  const res = new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
  issueSession(res, { uid: locals.pre.uid, login: locals.pre.login });
  clearPreAuth(res);
  await audit({ kind: "login-ok", user: locals.pre.login, ip: locals.ip });
  return res;
};
