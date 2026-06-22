import type { APIRoute } from "astro";
import { z } from "zod";
import { removeManifestItem, unlinkUpload, getManifestItem } from "../../../server/lib/storage";
import { audit } from "../../../server/lib/audit";

const IdParam = z.object({ id: z.string().min(1).max(64) });

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
