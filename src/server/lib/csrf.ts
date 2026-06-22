import { readCsrfToken } from "./session";
import { constantTimeEqual } from "./crypto";

export function verifyCsrf(req, context) {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
    return true;
  }
  const cookieHeader = req.headers.get("cookie");
  const cookieToken = readCsrfToken(cookieHeader);
  const headerToken = req.headers.get("x-csrf-token");
  if (!cookieToken || !headerToken) return false;
  return constantTimeEqual(cookieToken, headerToken);
}

export function csrfMismatchResponse() {
  return new Response(
    JSON.stringify({ error: "CSRF token missing or invalid" }),
    { status: 403, headers: { "Content-Type": "application/json" } }
  );
}
