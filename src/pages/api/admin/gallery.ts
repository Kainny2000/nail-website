import type { APIRoute } from 'astro';
import { readManifest, writeManifest } from '../../../../lib/admin/manifest';

export const PUT: APIRoute = async ({ request }) => {
  const body = await request.json();
  const visible: string[] = Array.isArray(body.visible) ? body.visible : [];
  const m = await readManifest();

  const visibleSet = new Set(visible);

  for (const img of m.images) {
    const wasVisible = img.usedIn.gallery;
    img.usedIn.gallery = visibleSet.has(img.id);
    if (img.usedIn.gallery && !wasVisible) {
      const max = Math.max(0, ...m.images.filter((i) => i.usedIn.gallery && i.id !== img.id).map((i) => i.galleryOrder));
      img.galleryOrder = max + 1;
    }
  }

  const visibleList = m.images
    .filter((i) => i.usedIn.gallery)
    .sort((a, b) => a.galleryOrder - b.galleryOrder);
  visibleList.forEach((img, i) => { img.galleryOrder = i; });

  await writeManifest(m);
  return new Response(JSON.stringify({ ok: true, visible: visibleList.length }), { headers: { 'content-type': 'application/json' } });
};
