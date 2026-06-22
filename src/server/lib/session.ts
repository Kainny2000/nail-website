import * as cookie from "cookie";
import { getEnv } from "./env";
import { hmacSign, randomToken } from "./crypto";

const COOKIE_NAME = "__nail_session";
const PRE_COOKIE_NAME = "__nail_pre";
const CSRF_COOKIE_NAME = "__nail_csrf";
const ONE_HOUR = 60 * 60;
const PRE_TTL = 5 * 60;

function signValue(value) {
  const env = getEnv();
  const sig = hmacSign(value, env.SESSION_SECRET);
  return `${value}.${sig}`;
}

function verifySigned(signed) {
  if (typeof signed !== "string") return null;
  const idx = signed.lastIndexOf(".");
  if (idx < 0) return null;
  const value = signed.slice(0, idx);
  const sig = signed.slice(idx + 1);
  const env = getEnv();
  const expected = hmacSign(value, env.SESSION_SECRET);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  if (diff !== 0) return null;
  return value;
}

export function readSession(cookieHeader) {
  if (!cookieHeader) return null;
  const cookies = cookie.parse(cookieHeader);
  const raw = cookies[COOKIE_NAME];
  if (!raw) return null;
  const value = verifySigned(raw);
  if (!value) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8")
    );
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof parsed.uid === "string" &&
      typeof parsed.login === "string" &&
      parsed.totpVerified === true
    ) {
      return parsed;
    }
  } catch {
    // ignore
  }
  return null;
}

export function issueSession(res, { uid, login }) {
  const payload = {
    uid,
    login,
    totpVerified: true,
    iat: Date.now(),
    nonce: randomToken(8),
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signed = signValue(encoded);
  res.headers.append(
    "Set-Cookie",
    cookie.serialize(COOKIE_NAME, signed, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: ONE_HOUR,
    })
  );
  res.headers.append(
    "Set-Cookie",
    cookie.serialize(CSRF_COOKIE_NAME, randomToken(24), {
      httpOnly: false,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: ONE_HOUR,
    })
  );
}

export function issuePreAuth(res, { uid, login }) {
  const payload = { uid, login, iat: Date.now() };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signed = signValue(encoded);
  res.headers.append(
    "Set-Cookie",
    cookie.serialize(PRE_COOKIE_NAME, signed, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: PRE_TTL,
    })
  );
}

export function readPreAuth(cookieHeader) {
  if (!cookieHeader) return null;
  const cookies = cookie.parse(cookieHeader);
  const raw = cookies[PRE_COOKIE_NAME];
  if (!raw) return null;
  const value = verifySigned(raw);
  if (!value) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8")
    );
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof parsed.uid === "string" &&
      typeof parsed.login === "string"
    ) {
      return parsed;
    }
  } catch {
    // ignore
  }
  return null;
}

export function clearAll(res) {
  const opts = {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  };
  res.headers.append("Set-Cookie", cookie.serialize(COOKIE_NAME, "", opts));
  res.headers.append(
    "Set-Cookie",
    cookie.serialize(PRE_COOKIE_NAME, "", opts)
  );
  res.headers.append(
    "Set-Cookie",
    cookie.serialize(CSRF_COOKIE_NAME, "", { ...opts, httpOnly: false })
  );
}

export function clearPreAuth(res) {
  const opts = {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  };
  res.headers.append(
    "Set-Cookie",
    cookie.serialize(PRE_COOKIE_NAME, "", opts)
  );
  res.headers.append(
    "Set-Cookie",
    cookie.serialize(CSRF_COOKIE_NAME, "", { ...opts, httpOnly: false })
  );
}

export function readCsrfToken(cookieHeader) {
  if (!cookieHeader) return null;
  const cookies = cookie.parse(cookieHeader);
  return cookies[CSRF_COOKIE_NAME] ?? null;
}

export function ensureCsrfCookie(response, request) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const existing = readCsrfToken(cookieHeader);
  if (existing) return existing;
  const token = randomToken(24);
  response.headers.append(
    "Set-Cookie",
    cookie.serialize(CSRF_COOKIE_NAME, token, {
      httpOnly: false,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: ONE_HOUR,
    })
  );
  return token;
}
