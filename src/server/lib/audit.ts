import fs from "node:fs/promises";
import { PATHS } from "./paths";

export async function audit(event) {
  try {
    await fs.mkdir(PATHS.logs, { recursive: true, mode: 0o700 });
    const line =
      JSON.stringify({
        ts: new Date().toISOString(),
        ...event,
      }) + "\n";
    await fs.appendFile(PATHS.audit(), line, { mode: 0o600 });
  } catch (err) {
    console.error("audit log failed", err);
  }
}
