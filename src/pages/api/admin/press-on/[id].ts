import type { APIRoute } from 'astro';
import { readManifest, writeManifest } from '../../../../lib/admin/manifest';

export const GET: APIRoute = async ({ params }) => {
  const m = await readManifest();
  const pkg = m.pressOnPackages.find((p) => p.id === params.id);
  if (!pkg) return new Response(JSON.stringify({ error: 'not found' }), { status: 404 });
  return new Response(JSON.stringify({ package: pkg }), { headers: { 'content-type': 'application/json' } });
};

export const PATCH: APIRoute = async ({ params, request }) => {
  const m = await readManifest();
  const pkg = m.pressOnPackages.find((p) => p.id === params.id);
  if (!pkg) return new Response(JSON.stringify({ error: 'not found' }), { status: 404 });

  const body = await request.json();
  if (typeof body.name === 'string') pkg.name = body.name.trim() || pkg.name;
  if (typeof body.description === 'string') pkg.description = body.description;
  if (typeof body.basePrice === 'number') pkg.basePrice = body.basePrice;
  if (typeof body.hidden === 'boolean') pkg.hidden = body.hidden;
  if (Array.isArray(body.imageIds)) {
    pkg.imageIds = body.imageIds.filter((id: any) => m.images.some((i) => i.id === id));
    if (body.heroImageId !== undefined) {
      pkg.heroImageId = pkg.imageIds.includes(body.heroImageId) ? body.heroImageId : (pkg.imageIds[0] ?? null);
    } else if (pkg.heroImageId && !pkg.imageIds.includes(pkg.heroImageId)) {
      pkg.heroImageId = pkg.imageIds[0] ?? null;
    }
    for (const img of m.images) {
      const wasIn = img.usedIn.pressOnPackages.includes(pkg.id);
      const isIn = pkg.imageIds.includes(img.id);
      if (isIn && !wasIn) img.usedIn.pressOnPackages.push(pkg.id);
      else if (!isIn && wasIn) img.usedIn.pressOnPackages = img.usedIn.pressOnPackages.filter((x) => x !== pkg.id);
    }
  }
  await writeManifest(m);
  return new Response(JSON.stringify({ package: pkg }), { headers: { 'content-type': 'application/json' } });
};

export const DELETE: APIRoute = async ({ params }) => {
  const m = await readManifest();
  const idx = m.pressOnPackages.findIndex((p) => p.id === params.id);
  if (idx < 0) return new Response(JSON.stringify({ error: 'not found' }), { status: 404 });
  for (const img of m.images) {
    img.usedIn.pressOnPackages = img.usedIn.pressOnPackages.filter((x) => x !== params.id);
  }
  m.pressOnPackages.splice(idx, 1);
  await writeManifest(m);
  return new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json' } });
};
