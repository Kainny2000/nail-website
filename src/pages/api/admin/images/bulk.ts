import type { APIRoute } from 'astro';
import { readManifest, writeManifest } from '../../../../lib/admin/manifest';

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();
  const ids: string[] = Array.isArray(body.ids) ? body.ids : [];
  const patch = body.patch ?? {};

  if (ids.length === 0) return new Response(JSON.stringify({ error: 'no ids' }), { status: 400 });

  const m = await readManifest();
  let changed = 0;
  for (const img of m.images) {
    if (!ids.includes(img.id)) continue;
    if (typeof patch.hidden === 'boolean') img.hidden = patch.hidden;
    if (typeof patch.alt === 'string') img.alt = patch.alt;
    if (typeof patch.caption === 'string') img.caption = patch.caption;
    if (Array.isArray(patch.tags)) img.tags = patch.tags.map((t: any) => String(t).trim()).filter(Boolean);
    if (patch.usedIn) {
      if (typeof patch.usedIn.carousel === 'boolean') {
        if (patch.usedIn.carousel && !img.usedIn.carousel) {
          const max = Math.max(0, ...m.images.filter((i) => i.usedIn.carousel).map((i) => i.carouselOrder));
          img.carouselOrder = max + 1;
        }
        img.usedIn.carousel = patch.usedIn.carousel;
      }
      if (typeof patch.usedIn.gallery === 'boolean') {
        if (patch.usedIn.gallery && !img.usedIn.gallery) {
          const max = Math.max(0, ...m.images.filter((i) => i.usedIn.gallery).map((i) => i.galleryOrder));
          img.galleryOrder = max + 1;
        }
        img.usedIn.gallery = patch.usedIn.gallery;
      }
    }
    changed++;
  }

  await writeManifest(m);
  return new Response(JSON.stringify({ ok: true, changed }), { headers: { 'content-type': 'application/json' } });
};
