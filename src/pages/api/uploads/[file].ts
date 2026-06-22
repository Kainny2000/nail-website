import type { APIRoute } from "astro";
import fs from "node:fs/promises";
import path from "node:path";
import { PATHS } from "../../../server/lib/paths";

const MIME_BY_EXT = {
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

const SAFE_NAME = /^[A-Za-z0-9._-]+$/;

export const GET: APIRoute = async ({ params }) => {
  const name = params.file;
  if (typeof name !== "string" || !SAFE_NAME.test(name)) {
    return new Response("Not found", { status: 404 });
  }
  const full = path.join(PATHS.uploads, name);
  // Defend against path traversal.
  const resolvedUploads = path.resolve(PATHS.uploads) + path.sep;
  const resolvedFull = path.resolve(full);
  if (!resolvedFull.startsWith(resolvedUploads)) {
    return new Response("Not found", { status: 404 });
  }
  let data;
  try {
    data = await fs.readFile(resolvedFull);
  } catch {
    return new Response("Not found", { status: 404 });
  }
  const ext = path.extname(resolvedFull).toLowerCase();
  const mime = MIME_BY_EXT[ext] ?? "application/octet-stream";
  return new Response(data, {
    status: 200,
    headers: {
      "Content-Type": mime,
      "Content-Length": String(data.byteLength),
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
};
