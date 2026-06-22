import "dotenv/config";

import { defineMiddleware } from "astro:middleware";
import { readSession, readPreAuth } from "./server/lib/session";
import { verifyCsrf } from "./server/lib/csrf";
import { check as checkRate, clientIp } from "./server/lib/rate-limit";
import { getEnv } from "./server/lib/env";
import { audit } from "./server/lib/audit";

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
  "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-site",
};

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function isMutatingApi(pathname, method) {
  if (!pathname.startsWith("/api/")) return false;
  if (pathname.startsWith("/api/auth/")) return true;
  if (pathname === "/api/images") return MUTATING_METHODS.has(method);
  if (pathname.startsWith("/api/images/")) return true;
  return false;
}

function jsonError(status, message) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { request, url, locals } = context;
  const pathname = url.pathname;
  const method = request.method.toUpperCase();
  const ip = clientIp(request.headers);

  // Static assets and the public site are unrestricted.
  const isApi = pathname.startsWith("/api/");
  const isAdmin = pathname.startsWith("/admin");

  // Rate limit auth attempts.
  if (isApi && pathname.startsWith("/api/auth/")) {
    const r = checkRate(`auth:${ip}`, 10, 15 * 60 * 1000);
    if (!r.ok) {
      await audit({ kind: "ratelimit", route: pathname, ip, retry: r.retryAfter });
      return new Response(JSON.stringify({ error: "Too many attempts. Try again later." }), {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(r.retryAfter),
        },
      });
    }
  }

  // Generic rate limit on mutating API routes.
  if (isApi && isMutatingApi(pathname, method) && !pathname.startsWith("/api/auth/")) {
    const r = checkRate(`mut:${ip}`, 60, 60 * 1000);
    if (!r.ok) {
      return new Response(JSON.stringify({ error: "Too many requests." }), {
        status: 429,
        headers: { "Content-Type": "application/json", "Retry-After": String(r.retryAfter) },
      });
    }
  }

  // Always read the session (and pre-auth) cookie.
  const cookieHeader = request.headers.get("cookie") ?? "";
  const session = readSession(cookieHeader);
  const pre = readPreAuth(cookieHeader);
  locals.session = session;
  locals.pre = pre;
  locals.ip = ip;

  // Auth gate.
  if (isAdmin || (isApi && pathname.startsWith("/api/auth/setup-totp"))) {
    if (!session) {
      if (isApi) return jsonError(401, "Authentication required");
      locals.needsLogin = true;
    }
  }

  // CSRF on mutating requests (only after auth so unauth'd 401 wins).
  if (isApi && isMutatingApi(pathname, method)) {
    if (session && !verifyCsrf(request, context)) {
      await audit({ kind: "csrf-fail", route: pathname, ip, user: session.login });
      return jsonError(403, "CSRF token missing or invalid");
    }
  }

  try {
    getEnv(); // surfaces config errors loudly on first request
  } catch (err) {
    return new Response(
      "Server is not configured. See application logs.",
      { status: 500 }
    );
  }

  const response = await next();

  for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(k, v);
  }
  // Content-Security-Policy — tailored for this site.
  response.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "img-src 'self' data:",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "script-src 'self' 'unsafe-inline'",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ")
  );

  return response;
});
