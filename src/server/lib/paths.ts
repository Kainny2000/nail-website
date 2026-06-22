import path from "node:path";
import os from "node:os";

function xdgOrFallback(envName, fallback) {
  const v = process.env[envName];
  if (v && v.length > 0) return v;
  return fallback;
}

const HOME = os.homedir();

export const PATHS = {
  uploads: xdgOrFallback(
    "UPLOAD_DIR",
    path.join(HOME, "nail-uploads")
  ),
  data: xdgOrFallback(
    "DATA_DIR",
    path.join(HOME, "nail-data")
  ),
  logs: xdgOrFallback(
    "LOG_DIR",
    path.join(HOME, "log")
  ),
  manifest: () =>
    path.join(xdgOrFallback("DATA_DIR", path.join(HOME, "nail-data")), "manifest.json"),
  totp: () =>
    path.join(xdgOrFallback("DATA_DIR", path.join(HOME, "nail-data")), "totp.json"),
  audit: () =>
    path.join(xdgOrFallback("LOG_DIR", path.join(HOME, "log")), "audit.log"),
};
