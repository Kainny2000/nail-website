const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

interface Attempt {
  count: number;
  lockoutUntil: number;
  firstAt: number;
}

const store = new Map<string, Attempt>();

export function recordFailedLogin(key: string): { locked: boolean; remaining: number; retryAfterSec: number } {
  const now = Date.now();
  const existing = store.get(key);

  if (existing && existing.lockoutUntil > now) {
    return { locked: true, remaining: 0, retryAfterSec: Math.ceil((existing.lockoutUntil - now) / 1000) };
  }

  const fresh: Attempt = existing && now - existing.firstAt < WINDOW_MS
    ? { ...existing, count: existing.count + 1, lockoutUntil: 0 }
    : { count: 1, lockoutUntil: 0, firstAt: now };

  if (fresh.count >= MAX_ATTEMPTS) {
    fresh.lockoutUntil = now + LOCKOUT_MS;
  }

  store.set(key, fresh);

  return {
    locked: fresh.lockoutUntil > now,
    remaining: Math.max(0, MAX_ATTEMPTS - fresh.count),
    retryAfterSec: fresh.lockoutUntil > now ? Math.ceil((fresh.lockoutUntil - now) / 1000) : 0,
  };
}

export function recordSuccessfulLogin(key: string): void {
  store.delete(key);
}

export function getClientKey(request: Request): string {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp;
  return 'local';
}
