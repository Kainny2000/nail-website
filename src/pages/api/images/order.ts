import type { APIRoute } from "astro";
import { z } from "zod";
import { reorderManifest } from "../../../server/lib/storage";
import { audit } from "../../../server/lib/audit";

const Body = z.object({ order: z.array(z.string().min(1).max(64)).max(200) });

export const PUT: APIRoute = async ({ request, locals }) => {
  if (!locals.session) {
    return new Response(JSON.stringify({ error: "Authentication required" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  let body;
  try {
    body = Body.parse(await request.json());
  } catch {
    return new Response(JSON.stringify({ error: "Invalid body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const next = await reorderManifest(body.order);
  await audit({
    kind: "image-reorder",
    user: locals.session.login,
    ip: locals.ip,
    count: body.order.length,
  });
  return new Response(
    JSON.stringify({
      ok: true,
      items: next.map((m) => ({ id: m.id, filename: m.filename })),
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
};
