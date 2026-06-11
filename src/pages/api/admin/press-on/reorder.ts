import type { APIRoute } from 'astro';
import { readManifest, writeManifest } from '../../../../lib/admin/manifest';

export const PUT: APIRoute = async ({ request }) => {
  const body = await request.json();
  const order: string[] = Array.isArray(body.ids) ? body.ids : [];
  const m = await readManifest();
  const idToNewOrder = new Map(order.map((id, i) => [id, i]));
  for (const p of m.pressOnPackages) {
    if (idToNewOrder.has(p.id)) p.order = idToNewOrder.get(p.id)!;
  }
  m.pressOnPackages.sort((a, b) => a.order - b.order);
  await writeManifest(m);
  return new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json' } });
};
