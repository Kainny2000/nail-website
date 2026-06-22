import bcrypt from "bcryptjs";
import { authenticator } from "otplib";
import fs from "node:fs/promises";
import path from "node:path";
import { PATHS } from "./paths";
import { getEnv } from "./env";
import { audit } from "./audit";

authenticator.options = { window: 1, step: 30 };

const DUMMY_HASH = bcrypt.hashSync("dummy-for-constant-time", 12);

export async function verifyCredentials(username, password) {
  const env = getEnv();
  if (typeof username !== "string" || typeof password !== "string") {
    // Still spend time to avoid timing oracle.
    await bcrypt.compare(password ?? "", DUMMY_HASH);
    return null;
  }
  if (username !== env.ADMIN_USERNAME) {
    await bcrypt.compare(password, DUMMY_HASH);
    return null;
  }
  const ok = await bcrypt.compare(password, env.ADMIN_PASSWORD_HASH);
  if (!ok) return null;
  return { uid: "admin", login: env.ADMIN_USERNAME };
}

export async function totpStatus() {
  try {
    const raw = await fs.readFile(PATHS.totp(), "utf8");
    return Boolean(JSON.parse(raw).enrolled);
  } catch {
    return false;
  }
}

export async function totpSecret() {
  try {
    const raw = await fs.readFile(PATHS.totp(), "utf8");
    return JSON.parse(raw).secret ?? null;
  } catch {
    return null;
  }
}

export async function totpEnroll(secret) {
  await fs.mkdir(PATHS.data, { recursive: true, mode: 0o700 });
  const file = PATHS.totp();
  await fs.writeFile(
    file,
    JSON.stringify({ enrolled: true, secret }, null, 2),
    { mode: 0o600 }
  );
  await fs.chmod(file, 0o600);
}

export async function totpReset() {
  try {
    await fs.unlink(PATHS.totp());
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
}

export function verifyTotpCode(secret, code) {
  if (typeof code !== "string") return false;
  const clean = code.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(clean)) return false;
  return authenticator.check(clean, secret);
}

export function newTotpSecret() {
  return authenticator.generateSecret();
}

export function otpauthUri(secret, login) {
  return authenticator.keyuri(login, "Bare Form Admin", secret);
}

export { bcrypt, audit };
