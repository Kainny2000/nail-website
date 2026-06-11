import type { APIRoute } from 'astro';
import { readManifest, writeManifest } from '../../../../lib/admin/manifest';
import { deleteImageFiles } from '../../../../lib/admin/images';

export const GET: APIRoute = async ({ params }) => {
  const m = await readManifest();
  const img = m.images.find((i) => i.id === params.id);
  if (!img) return new Response(JSON.stringify({ error: 'not found' }), { status: 404 });
  return new Response(JSON.stringify({ image: img }), { headers: { 'content-type': 'application/json' } });
};

export const PATCH: APIRoute = async ({ params, request }) => {
  const m = await readManifest();
  const img = m.images.find((i) => i.id === params.id);
  if (!img) return new Response(JSON.stringify({ error: 'not found' }), { status: 404 });

  const body = await request.json();
  if (typeof body.alt === 'string') img.alt = body.alt.trim() || img.alt;
  if (typeof body.caption === 'string') img.caption = body.caption;
  if (Array.isArray(body.tags)) img.tags = body.tags.map((t: any) => String(t).trim()).filter(Boolean);
  if (typeof body.hidden === 'boolean') img.hidden = body.hidden;
  if (body.usedIn) {
    if (typeof body.usedIn.carousel === 'boolean') {
      img.usedIn.carousel = body.usedIn.carousel;
      if (img.usedIn.carousel && !m.images.some((i) => i.usedIn.carousel && i.carouselOrder < img.carouselOrder && i.id !== img.id)) {
        img.carouselOrder = 0;
      } else if (img.usedIn.carousel) {
        const max = Math.max(0, ...m.images.filter((i) => i.usedIn.carousel && i.id !== img.id).map((i) => i.carouselOrder));
        img.carouselOrder = max + 1;
      }
    }
    if (typeof body.usedIn.gallery === 'boolean') {
      img.usedIn.gallery = body.usedIn.gallery;
      if (img.usedIn.gallery) {
        const max = Math.max(0, ...m.images.filter((i) => i.usedIn.gallery && i.id !== img.id).map((i) => i.galleryOrder));
        img.galleryOrder = max + 1;
      }
    }
  }

  await writeManifest(m);
  return new Response(JSON.stringify({ image: img }), { headers: { 'content-type': 'application/json' } });
};

export const DELETE: APIRoute = async ({ params }) => {
  const m = await readManifest();
  const idx = m.images.findIndex((i) => i.id === params.id);
  if (idx < 0) return new Response(JSON.stringify({ error: 'not found' }), { status: 404 });
  const img = m.images[idx];

  for (const pkg of m.pressOnPackages) {
    pkg.imageIds = pkg.imageIds.filter((id) => id !== img.id);
    if (pkg.heroImageId === img.id) pkg.heroImageId = pkg.imageIds[0] ?? null;
  }

  await deleteImageFiles(img);
  m.images.splice(idx, 1);
  await writeManifest(m);
  return new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json' } });
};
