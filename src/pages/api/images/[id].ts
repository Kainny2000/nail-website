import type { APIRoute } from "astro";
import { z } from "zod";
import { removeManifestItem, unlinkUpload, getManifestItem, updateManifestItem } from "../../../server/lib/storage";
import { audit } from "../../../server/lib/audit";

const IdParam = z.object({ id: z.string().min(1).max(64) });

const PatchBody = z.object({
  alt: z.string().max(200).optional(),
  sections: z.array(z.string()).optional(),
});

export const DELETE: APIRoute = async ({ params, locals }) => {
  if (!locals.session) {
    return new Response(JSON.stringify({ error: "Authentication required" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  const parsed = IdParam.safeParse(params);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: "Invalid id" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const item = await getManifestItem(parsed.data.id);
  if (!item) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }
  await removeManifestItem(parsed.data.id);
  await unlinkUpload(item.filename);
  await audit({
    kind: "image-delete",
    user: locals.session.login,
    ip: locals.ip,
    file: item.filename,
  });
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  if (!locals.session) {
    return new Response(JSON.stringify({ error: "Authentication required" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  const parsed = IdParam.safeParse(params);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: "Invalid id" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const patchParsed = PatchBody.safeParse(body);
  if (!patchParsed.success) {
    return new Response(JSON.stringify({ error: "Invalid body", details: patchParsed.error.issues }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const patch: Record<string, unknown> = {};
  if (patchParsed.data.alt !== undefined) patch.alt = patchParsed.data.alt;
  if (patchParsed.data.sections !== undefined) {
    const valid = patchParsed.data.sections.filter((s) =>
      ["slideshow", "gallery", "presson"].includes(s)
    );
    patch.sections = valid;
  }
  if (Object.keys(patch).length === 0) {
    return new Response(JSON.stringify({ error: "No valid fields to update" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const updated = await updateManifestItem(parsed.data.id, patch as any);
  if (!updated) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }
  await audit({
    kind: "image-update",
    user: locals.session.login,
    ip: locals.ip,
    file: updated.filename,
    changes: Object.keys(patch),
  });
  return new Response(
    JSON.stringify({ ok: true, item: { ...updated, url: `/api/uploads/${updated.filename}` } }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
};