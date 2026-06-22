import type { APIRoute } from "astro";
import { z } from "zod";
import { verifyCredentials, totpStatus } from "../../../server/lib/auth";
import { issuePreAuth, issueSession } from "../../../server/lib/session";
import { audit } from "../../../server/lib/audit";

const Body = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(1).max(256),
});

export const POST: APIRoute = async ({ request, locals, site }) => {
  let body;
  try {
    body = Body.parse(await request.json());
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const user = await verifyCredentials(body.username, body.password);
  if (!user) {
    await audit({ kind: "login-fail", user: body.username, ip: locals.ip });
    return new Response(JSON.stringify({ error: "Invalid credentials" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const enrolled = await totpStatus();
  const res = new Response(null, { status: 204 });
  if (!enrolled) {
    issueSession(res, user);
    res.headers.set("Content-Type", "application/json");
    res.headers.set("X-Login-Step", "totp-setup-required");
    await audit({ kind: "login-ok-no-totp", user: user.login, ip: locals.ip });
    return new Response(JSON.stringify({ step: "totp-setup-required" }), {
      status: 200,
      headers: res.headers,
    });
  }

  issuePreAuth(res, user);
  await audit({ kind: "login-step1-ok", user: user.login, ip: locals.ip });
  return new Response(JSON.stringify({ step: "totp" }), {
    status: 200,
    headers: res.headers,
  });
};
