import type { APIRoute } from 'astro';
import { readManifest, writeManifest } from '../../../../lib/admin/manifest';
import { makePackageId } from '../../../../lib/admin/images';

export const GET: APIRoute = async () => {
  const m = await readManifest();
  return new Response(JSON.stringify({ packages: m.pressOnPackages }), { headers: { 'content-type': 'application/json' } });
};

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();
  if (!body.name) return new Response(JSON.stringify({ error: 'name required' }), { status: 400 });
  const m = await readManifest();

  const id = makePackageId(String(body.name));
  const pkg = {
    id,
    name: String(body.name).trim(),
    description: String(body.description ?? '').trim(),
    basePrice: Number(body.basePrice) || 0,
    heroImageId: null,
    imageIds: [],
    order: m.pressOnPackages.length,
    hidden: false,
  };
  m.pressOnPackages.push(pkg);
  await writeManifest(m);
  return new Response(JSON.stringify({ package: pkg }), { headers: { 'content-type': 'application/json' } });
};
