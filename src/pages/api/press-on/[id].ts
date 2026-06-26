import type { APIRoute } from "astro";
import { z } from "zod";
import { getPressOnCard, updatePressOnCard, deletePressOnCard } from "../../../server/lib/press-on-store";
import { audit } from "../../../server/lib/audit";

const IdParam = z.object({ id: z.string().min(1).max(64) });

const PatchBody = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  price: z.string().max(50).optional(),
  imageId: z.string().max(64).optional(),
  active: z.boolean().optional(),
  order: z.number().int().min(0).optional(),
});

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
  const updated = await updatePressOnCard(parsed.data.id, patchParsed.data);
  if (!updated) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }
  await audit({
    kind: "presson-update",
    user: locals.session.login,
    ip: locals.ip,
    cardId: updated.id,
  });
  return new Response(JSON.stringify({ ok: true, item: updated }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

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
  const card = await getPressOnCard(parsed.data.id);
  if (!card) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }
  await deletePressOnCard(parsed.data.id);
  await audit({
    kind: "presson-delete",
    user: locals.session.login,
    ip: locals.ip,
    cardId: card.id,
  });
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};