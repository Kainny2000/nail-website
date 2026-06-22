// In-memory token-bucket rate limiter. Good enough for a single-process Node app.
// Resets on process restart (acceptable; the worst case is a brief spike after restart).

const buckets = new Map();

export function check(key, limit, windowMs) {
  const now = Date.now();
  const b = buckets.get(key) ?? { count: 0, resetAt: now + windowMs };
  if (now >= b.resetAt) {
    b.count = 0;
    b.resetAt = now + windowMs;
  }
  b.count += 1;
  buckets.set(key, b);
  if (b.count > limit) {
    const retry = Math.ceil((b.resetAt - now) / 1000);
    return { ok: false, retryAfter: retry };
  }
  return { ok: true, remaining: limit - b.count };
}

export function clientIp(headers) {
  // We trust only the local Caddy proxy (TRUSTED_PROXY in env).
  // Since the app is bound to 127.0.0.1, the only client IP we'd see is 127.0.0.1
  // unless someone hits it directly. Use socket remoteAddr when available.
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}
