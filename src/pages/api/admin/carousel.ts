import type { APIRoute } from 'astro';
import { readManifest, writeManifest } from '../../../../lib/admin/manifest';

export const PUT: APIRoute = async ({ request }) => {
  const body = await request.json();
  const order: string[] = Array.isArray(body.order) ? body.order : [];
  const m = await readManifest();

  for (const img of m.images) {
    img.usedIn.carousel = false;
    img.carouselOrder = 0;
  }
  let i = 0;
  for (const id of order) {
    const img = m.images.find((im) => im.id === id);
    if (!img) continue;
    img.usedIn.carousel = true;
    img.carouselOrder = i++;
  }
  await writeManifest(m);
  return new Response(JSON.stringify({ ok: true, active: i }), { headers: { 'content-type': 'application/json' } });
};

export const GET: APIRoute = async () => {
  const m = await readManifest();
  const active = m.images
    .filter((i) => i.usedIn.carousel)
    .sort((a, b) => a.carouselOrder - b.carouselOrder);
  return new Response(JSON.stringify({ activeIds: active.map((i) => i.id) }), { headers: { 'content-type': 'application/json' } });
};
