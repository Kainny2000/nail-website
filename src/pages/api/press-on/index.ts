import type { APIRoute } from "astro";
import { z } from "zod";
import { getPressOnCards, createPressOnCard } from "../../../server/lib/press-on-store";
import { audit } from "../../../server/lib/audit";

const CreateBody = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).default(""),
  price: z.string().max(50).default(""),
  imageId: z.string().max(64).default(""),
  active: z.boolean().default(true),
  order: z.number().int().min(0).default(0),
});

export const GET: APIRoute = async () => {
  const cards = await getPressOnCards();
  const sorted = [...cards].sort((a, b) => a.order - b.order);
  return new Response(
    JSON.stringify({ items: sorted }),
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
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const parsed = CreateBody.safeParse(body);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: "Invalid body", details: parsed.error.issues }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const card = await createPressOnCard(parsed.data);
  await audit({
    kind: "presson-create",
    user: locals.session.login,
    ip: locals.ip,
    cardId: card.id,
  });
  return new Response(JSON.stringify({ ok: true, item: card }), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
};