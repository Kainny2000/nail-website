import type { APIRoute } from "astro";
import { z } from "zod";
import { getManifest, appendManifestItem, uploadPath } from "../../../server/lib/storage";
import { validateAndProcess, ImageValidationError } from "../../../server/lib/image";
import { PATHS } from "../../../server/lib/paths";
import { audit } from "../../../server/lib/audit";
import { randomToken } from "../../../server/lib/crypto";
import fs from "node:fs/promises";

const AltBody = z.object({ alt: z.string().max(200).optional() });

export const GET: APIRoute = async () => {
  const manifest = await getManifest();
  return new Response(
    JSON.stringify({
      items: manifest.map((m) => ({
        id: m.id,
        filename: m.filename,
        alt: m.alt,
        addedAt: m.addedAt,
        url: `/api/uploads/${m.filename}`,
      })),
    }),
    { status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } }
  );
};

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.session) {
    return new Response(JSON.stringify({ error: "Authentication required" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  let form;
  try {
    form = await request.formData();
  } catch {
    return new Response(JSON.stringify({ error: "Expected multipart/form-data" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return new Response(JSON.stringify({ error: "Missing file field" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const altRaw = form.get("alt");
  const altParsed = AltBody.safeParse({ alt: typeof altRaw === "string" ? altRaw : undefined });
  if (!altParsed.success) {
    return new Response(JSON.stringify({ error: "Invalid alt" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  let processed;
  try {
    processed = await validateAndProcess(buf);
  } catch (err) {
    if (err instanceof ImageValidationError) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    throw err;
  }

  await fs.mkdir(PATHS.uploads, { recursive: true, mode: 0o700 });
  const target = uploadPath(processed.filename);
  await fs.writeFile(target, processed.buffer, { mode: 0o644 });
  await fs.chmod(target, 0o644);

  const item = {
    id: randomToken(12),
    filename: processed.filename,
    alt: altParsed.data.alt?.trim() || `Nail Art`,
    addedAt: new Date().toISOString(),
  };
  await appendManifestItem(item);
  await audit({
    kind: "image-upload",
    user: locals.session.login,
    ip: locals.ip,
    file: processed.filename,
  });
  return new Response(
    JSON.stringify({
      ok: true,
      item: { ...item, url: `/api/uploads/${item.filename}` },
    }),
    { status: 201, headers: { "Content-Type": "application/json" } }
  );
};
