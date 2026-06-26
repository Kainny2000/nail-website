import type { APIRoute } from "astro";
import { z } from "zod";
import { getManifest, appendManifestItem, uploadPath } from "../../../server/lib/storage";
import { validateAndProcess, ImageValidationError } from "../../../server/lib/image";
import { PATHS } from "../../../server/lib/paths";
import { audit } from "../../../server/lib/audit";
import { randomToken } from "../../../server/lib/crypto";
import fs from "node:fs/promises";

const SECTIONS_KEY = "slideshow,gallery,presson";

const AltBody = z.object({
  alt: z.string().max(200).optional(),
  sections: z.string().optional(),
});

const UploadResult = {
  ok: true as boolean,
  item: {} as Record<string, unknown>,
  errors: [] as { filename: string; error: string }[],
};

export const GET: APIRoute = async () => {
  const manifest = await getManifest();
  return new Response(
    JSON.stringify({
      items: manifest.map((m) => ({
        id: m.id,
        filename: m.filename,
        alt: m.alt,
        addedAt: m.addedAt,
        sections: m.sections,
        url: `/api/uploads/${m.filename}`,
      })),
    }),
    { status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } }
  );
};

async function processFile(file: File, alt: string, sections: string[]) {
  const buf = Buffer.from(await file.arrayBuffer());
  const processed = await validateAndProcess(buf);
  await fs.mkdir(PATHS.uploads, { recursive: true, mode: 0o700 });
  const target = uploadPath(processed.filename);
  await fs.writeFile(target, processed.buffer, { mode: 0o644 });
  await fs.chmod(target, 0o644);
  const item = {
    id: randomToken(12),
    filename: processed.filename,
    alt: alt || file.name.replace(/\.[^.]+$/, "").slice(0, 200) || "Nail Art",
    addedAt: new Date().toISOString(),
    sections,
  };
  await appendManifestItem(item);
  return item;
}

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

  const altRaw = form.get("alt");
  const sectionsRaw = form.get("sections");
  const altParsed = AltBody.safeParse({
    alt: typeof altRaw === "string" ? altRaw : undefined,
    sections: typeof sectionsRaw === "string" ? sectionsRaw : undefined,
  });
  const alt = (altParsed.success && altParsed.data.alt?.trim()) || "";
  const sections = (() => {
    const raw = altParsed.success && altParsed.data.sections
      ? altParsed.data.sections
      : sectionsRaw && typeof sectionsRaw === "string"
        ? sectionsRaw
        : "slideshow";
    return raw
      .split(",")
      .map((s: string) => s.trim().toLowerCase())
      .filter((s: string) => SECTIONS_KEY.split(",").includes(s));
  })();

  const files = form.getAll("file").filter((f): f is File => f instanceof File);
  const batch = form.getAll("files[]").filter((f): f is File => f instanceof File);

  const allFiles = [...files, ...batch];

  if (allFiles.length === 0) {
    return new Response(JSON.stringify({ error: "Missing file field" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (allFiles.length === 1) {
    const file = allFiles[0];
    try {
      const item = await processFile(file, alt, sections);
      await audit({
        kind: "image-upload",
        user: locals.session.login,
        ip: locals.ip,
        file: item.filename,
      });
      return new Response(
        JSON.stringify({ ok: true, item: { ...item, url: `/api/uploads/${item.filename}` } }),
        { status: 201, headers: { "Content-Type": "application/json" } }
      );
    } catch (err) {
      if (err instanceof ImageValidationError) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      throw err;
    }
  }

  const results: Array<Record<string, unknown>> = [];
  const errors: Array<{ filename: string; error: string }> = [];

  for (const file of allFiles) {
    try {
      const item = await processFile(file, alt, sections);
      results.push({ ...item, url: `/api/uploads/${item.filename}` });
    } catch (err) {
      errors.push({
        filename: file.name,
        error: err instanceof ImageValidationError ? err.message : "Unexpected error",
      });
    }
  }

  if (results.length > 0) {
    await audit({
      kind: "image-upload-batch",
      user: locals.session.login,
      ip: locals.ip,
      count: results.length,
      errors: errors.length,
    });
  }

  const allErrors = errors.length > 0;
  return new Response(
    JSON.stringify({ ok: true, items: results, errors }),
    { status: allErrors && results.length === 0 ? 400 : results.length > 0 ? 201 : 200, headers: { "Content-Type": "application/json" } }
  );
};