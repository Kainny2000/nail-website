import type { APIRoute } from "astro";
import QRCode from "qrcode";
import { z } from "zod";
import {
  totpStatus,
  newTotpSecret,
  otpauthUri,
  totpEnroll,
  verifyTotpCode,
} from "../../../server/lib/auth";
import { audit } from "../../../server/lib/audit";
import { getEnv } from "../../../server/lib/env";

const Body = z.object({ secret: z.string().min(16), code: z.string().min(1).max(10) });

export const GET: APIRoute = async ({ locals }) => {
  if (!locals.session) {
    return new Response(JSON.stringify({ error: "Authentication required" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  const enrolled = await totpStatus();
  if (enrolled) {
    return new Response(
      JSON.stringify({ error: "TOTP is already enrolled. To re-enroll, reset first." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  const env = getEnv();
  const secret = newTotpSecret();
  const uri = otpauthUri(secret, env.ADMIN_USERNAME);
  const qrDataUrl = await QRCode.toDataURL(uri, { margin: 1, width: 256 });
  return new Response(
    JSON.stringify({ secret, uri, qr: qrDataUrl }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
};

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.session) {
    return new Response(JSON.stringify({ error: "Authentication required" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  let body;
  try {
    body = Body.parse(await request.json());
  } catch {
    return new Response(JSON.stringify({ error: "Invalid body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (!verifyTotpCode(body.secret, body.code)) {
    await audit({ kind: "totp-enroll-fail", user: locals.session.login, ip: locals.ip });
    return new Response(JSON.stringify({ error: "Code did not match" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  await totpEnroll(body.secret);
  await audit({ kind: "totp-enroll-ok", user: locals.session.login, ip: locals.ip });
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
