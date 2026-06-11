import crypto from 'node:crypto';
import cookie from 'cookie';
import type { SessionData } from './types';

const COOKIE_NAME = 'bf_admin';
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

function getSecret(): string {
  const secret = (process.env.SESSION_SECRET ?? (import.meta as any).env?.SESSION_SECRET) as string | undefined;
  if (!secret || secret.length < 16) {
    throw new Error('SESSION_SECRET env var must be set to a string of at least 16 characters');
  }
  return secret;
}

function getPassword(): string {
  const pw = (process.env.ADMIN_PASSWORD ?? (import.meta as any).env?.ADMIN_PASSWORD) as string | undefined;
  if (!pw || pw.length < 4) {
    throw new Error('ADMIN_PASSWORD env var must be set');
  }
  return pw;
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', getSecret()).update(payload).digest('base64url');
}

function timingSafeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

export function verifyPassword(input: string): boolean {
  const expected = getPassword();
  const a = Buffer.from(input, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) {
    timingSafeEqual(a.toString('base64'), b.toString('base64'));
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

export function buildSessionCookie(session: SessionData): string {
  const payload = Buffer.from(JSON.stringify(session)).toString('base64url');
  const sig = sign(payload);
  const value = payload + '.' + sig;
  return cookie.serialize(COOKIE_NAME, value, {
    httpOnly: true,
    secure: ((import.meta as any).env?.PROD ?? false) === true,
    sameSite: 'strict',
    path: '/',
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
}

export function clearSessionCookie(): string {
  return cookie.serialize(COOKIE_NAME, '', {
    httpOnly: true,
    secure: ((import.meta as any).env?.PROD ?? false) === true,
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  });
}

export function verifySessionCookie(cookieHeader: string): SessionData | null {
  if (!cookieHeader) return null;
  const parsed = cookie.parse(cookieHeader);
  const raw = parsed[COOKIE_NAME];
  if (!raw) return null;
  const [payload, sig] = raw.split('.');
  if (!payload || !sig) return null;
  const expected = sign(payload);
  if (!timingSafeEqual(sig, expected)) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as SessionData;
    if (typeof session.expiresAt !== 'number' || session.expiresAt < Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

export function newSession(): SessionData {
  const now = Date.now();
  return { issuedAt: now, expiresAt: now + SESSION_TTL_MS };
}

export function buildCsrfCookie(token: string): string {
  return cookie.serialize('bf_csrf', token, {
    httpOnly: false,
    secure: ((import.meta as any).env?.PROD ?? false) === true,
    sameSite: 'strict',
    path: '/',
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
}

export function getCsrfFromCookieHeader(cookieHeader: string): string | null {
  const parsed = cookie.parse(cookieHeader ?? '');
  return parsed['bf_csrf'] ?? null;
}

export function newCsrfToken(): string {
  return crypto.randomBytes(24).toString('base64url');
}
