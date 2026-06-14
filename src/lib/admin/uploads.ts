import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { GRID_GALLERY_DIR, ensureDirs } from './manifest';
import { sniffMime, sanitizeFilename, ensureUniqueFilename, probeImage, makeId, generateVariants, heicToJpeg } from './images';
import { readManifest, writeManifest } from './manifest';
import type { AdminImage, OptimizationProfile } from './types';

const MAX_BYTES = 20 * 1024 * 1024;

export interface UploadResult {
  ok: true;
  image: AdminImage;
}

export interface UploadError {
  ok: false;
  error: string;
}

export async function processUpload(file: File): Promise<UploadResult | UploadError> {
  if (file.size > MAX_BYTES) return { ok: false, error: `File exceeds ${MAX_BYTES / 1024 / 1024}MB limit` };
  if (file.size === 0) return { ok: false, error: 'Empty file' };

  let buf = Buffer.from(await file.arrayBuffer());
  let mime = await sniffMime(buf);
  if (!mime) return { ok: false, error: 'Unsupported file type (must be JPEG, PNG, WebP, or HEIC)' };

  if (mime === 'image/heic' || mime === 'image/heif') {
    try {
      buf = await heicToJpeg(buf);
      mime = 'image/jpeg';
    } catch (err: any) {
      return { ok: false, error: 'Failed to convert HEIC: ' + (err?.message ?? 'unknown error') };
    }
  }

  const ext = mime === 'image/jpeg' ? 'jpeg' : (mime.split('/')[1] || 'jpeg');
  const safeBase = sanitizeFilename(file.name.replace(/\.[^.]+$/, ''));
  const desired = `${safeBase}.${ext}`;

  await ensureDirs();
  const filename = await ensureUniqueFilename(GRID_GALLERY_DIR, desired);
  const destPath = path.join(GRID_GALLERY_DIR, filename);
  await writeFile(destPath, buf);

  const meta = await probeImage(destPath);

  const manifest = await readManifest();
  const id = makeId();
  const variants = await generateVariants(buf, id, manifest.optimization);

  const image: AdminImage = {
    id,
    filename,
    originalPath: 'src/assets/grid_gallery/' + filename,
    uploadedAt: new Date().toISOString(),
    size: meta.size,
    width: meta.width,
    height: meta.height,
    alt: safeBase.replace(/[_-]+/g, ' ').trim() || 'Nail art',
    tags: [],
    caption: '',
    hidden: false,
    usedIn: { carousel: false, gallery: false, pressOnPackages: [] },
    carouselOrder: manifest.images.length,
    galleryOrder: manifest.images.length,
    variants,
  };

  manifest.images.push(image);
  await writeManifest(manifest);

  return { ok: true, image };
}

export async function regenerateVariantsForImage(imageId: string): Promise<AdminImage> {
  const manifest = await readManifest();
  const image = manifest.images.find((i) => i.id === imageId);
  if (!image) throw new Error('Image not found: ' + imageId);

  const buf = await readFile(path.join(GRID_GALLERY_DIR, image.filename));
  image.variants = await generateVariants(buf, imageId, manifest.optimization);
  await writeManifest(manifest);
  return image;
}
