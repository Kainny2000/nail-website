import type { APIRoute } from 'astro';
import { readManifest, writeManifest } from '../../../../lib/admin/manifest';
import { regenerateVariantsForImage } from '../../../../lib/admin/uploads';
import { generateAllVariants } from '../../../../lib/admin/images';
import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { GRID_GALLERY_DIR, OPTIMIZED_DIR } from '../../../../lib/admin/manifest';

export const PUT: APIRoute = async ({ request }) => {
  const body = await request.json();
  const m = await readManifest();
  for (const key of ['carousel', 'gallery', 'pressOn'] as const) {
    if (body[key]) {
      const p = body[key];
      if (Array.isArray(p.widths)) m.optimization[key].widths = p.widths.map(Number).filter((n: number) => !isNaN(n) && n > 0);
      if (Array.isArray(p.formats)) m.optimization[key].formats = p.formats.filter((f: string) => ['avif', 'webp', 'jpeg'].includes(f));
      if (typeof p.quality === 'number') m.optimization[key].quality = Math.max(40, Math.min(95, p.quality));
      if (p.fit === 'cover' || p.fit === 'contain') m.optimization[key].fit = p.fit;
    }
  }
  await writeManifest(m);
  return new Response(JSON.stringify({ optimization: m.optimization }), { headers: { 'content-type': 'application/json' } });
};

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => ({}));
  const m = await readManifest();
  const targets: string[] = Array.isArray(body.imageIds) && body.imageIds.length > 0
    ? body.imageIds
    : m.images.map((i) => i.id);

  await rm(OPTIMIZED_DIR, { recursive: true, force: true });
  const { mkdir } = await import('node:fs/promises');
  await mkdir(OPTIMIZED_DIR, { recursive: true });

  let processed = 0;
  for (const id of targets) {
    const img = m.images.find((i) => i.id === id);
    if (!img) continue;
    const buf = await readFile(path.join(GRID_GALLERY_DIR, img.filename));
    const seen = new Set<string>();
    const allVariants = [];
    for (const key of ['carousel', 'gallery', 'pressOn'] as const) {
      const profile = m.optimization[key];
      const { generateVariants } = await import('../../../../lib/admin/images');
      const variants = await generateVariants(buf, id, profile);
      for (const v of variants) {
        const k = v.width + '.' + v.format;
        if (!seen.has(k)) { seen.add(k); allVariants.push(v); }
      }
    }
    img.variants = allVariants;
    processed++;
  }
  await writeManifest(m);
  return new Response(JSON.stringify({ ok: true, processed }), { headers: { 'content-type': 'application/json' } });
};
