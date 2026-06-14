import type { APIRoute } from 'astro';
import { readManifest, writeManifest } from '../../../../lib/admin/manifest';
import { processUpload } from '../../../../lib/admin/uploads';

export const GET: APIRoute = async ({ url }) => {
  const m = await readManifest();
  const q = url.searchParams.get('q')?.toLowerCase() ?? '';
  const section = url.searchParams.get('section');
  const tagParam = url.searchParams.get('tags') ?? '';
  const tags = tagParam ? tagParam.split(',').filter(Boolean) : [];
  const hidden = url.searchParams.get('hidden');
  const staging = url.searchParams.get('staging') === '1';

  let images = m.images;

  if (q) {
    images = images.filter((i) =>
      i.filename.toLowerCase().includes(q) ||
      i.alt.toLowerCase().includes(q) ||
      i.caption.toLowerCase().includes(q) ||
      i.tags.some((t) => t.toLowerCase().includes(q))
    );
  }

  if (tags.length > 0) {
    images = images.filter((i) => tags.every((t) => i.tags.includes(t)));
  }

  if (section === 'carousel') images = images.filter((i) => i.usedIn.carousel);
  else if (section === 'gallery') images = images.filter((i) => i.usedIn.gallery && !i.hidden);
  else if (section === 'pressOn') images = images.filter((i) => i.usedIn.pressOnPackages.length > 0);
  else if (section === 'unused') images = images.filter((i) => !i.usedIn.carousel && !i.usedIn.gallery && i.usedIn.pressOnPackages.length === 0);

  if (hidden === 'true') images = images.filter((i) => i.hidden);
  else if (hidden === 'false') images = images.filter((i) => !i.hidden);

  return new Response(JSON.stringify({ images }), {
    headers: { 'content-type': 'application/json' },
  });
};

export const POST: APIRoute = async ({ request }) => {
  if (request.headers.get('content-type')?.startsWith('multipart/form-data') !== true) {
    return new Response(JSON.stringify({ error: 'Expected multipart/form-data' }), { status: 400 });
  }

  const form = await request.formData();
  const files = form.getAll('files').filter((f): f is File => f instanceof File);

  if (files.length === 0) {
    return new Response(JSON.stringify({ error: 'No files provided' }), { status: 400 });
  }

  const results: any[] = [];
  for (const file of files) {
    const r = await processUpload(file);
    results.push(r);
  }

  const success = results.filter((r) => r.ok);
  const failed = results.filter((r) => !r.ok);

  return new Response(JSON.stringify({ uploaded: success.length, failed: failed.length, results }), {
    headers: { 'content-type': 'application/json' },
  });
};
