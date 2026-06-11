import sharp from 'sharp';
import { mkdir, rm, writeFile, stat, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { nanoid } from 'nanoid';
import { OPTIMIZED_DIR, GRID_GALLERY_DIR } from './manifest';
import type { AdminImage, ImageFormat, ImageVariant, OptimizationProfile } from './types';

const VALID_FORMATS: ImageFormat[] = ['avif', 'webp', 'jpeg'];
const VALID_FITS = ['cover', 'contain'] as const;

export async function fileExists(p: string): Promise<boolean> {
  try { await access(p, constants.F_OK); return true; } catch { return false; }
}

const MIME_SIGNATURES: Record<string, number[][]> = {
  'image/jpeg': [[0xff, 0xd8, 0xff]],
  'image/png': [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  'image/webp': [[0x52, 0x49, 0x46, 0x46]],
};

export async function sniffMime(buf: Buffer): Promise<string | null> {
  for (const [mime, sigs] of Object.entries(MIME_SIGNATURES)) {
    for (const sig of sigs) {
      if (buf.length < sig.length) continue;
      let ok = true;
      for (let i = 0; i < sig.length; i++) {
        if (buf[i] !== sig[i]) { ok = false; break; }
      }
      if (ok) return mime;
    }
  }
  return null;
}

export function sanitizeFilename(name: string): string {
  return name
    .replace(/[/\\]/g, '_')
    .replace(/[\x00-\x1f\x7f]/g, '')
    .replace(/[^\w.\-() ]+/g, '_')
    .replace(/^\.+/, '')
    .trim()
    .slice(0, 200) || 'image';
}

export async function ensureUniqueFilename(dir: string, desired: string): Promise<string> {
  const ext = path.extname(desired);
  const base = path.basename(desired, ext);
  let candidate = desired;
  let i = 1;
  while (await fileExists(path.join(dir, candidate))) {
    candidate = `${base} (${i})${ext}`;
    i++;
    if (i > 9999) {
      candidate = `${base}-${Date.now()}${ext}`;
      break;
    }
  }
  return candidate;
}

export async function probeImage(filePath: string): Promise<{ width: number; height: number; size: number }> {
  const [meta, st] = await Promise.all([
    sharp(filePath).metadata(),
    stat(filePath),
  ]);
  if (!meta.width || !meta.height) throw new Error('Image has no dimensions');
  return { width: meta.width, height: meta.height, size: st.size };
}

export function makeId(): string {
  return 'img_' + nanoid(12);
}

export function makePackageId(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32) || 'pkg';
  return 'pkg_' + slug + '_' + nanoid(6);
}

async function buildVariant(
  source: Buffer,
  imageId: string,
  width: number,
  format: ImageFormat,
  quality: number,
  fit: 'cover' | 'contain',
): Promise<{ variant: ImageVariant; buffer: Buffer; path: string }> {
  const variantDir = path.join(OPTIMIZED_DIR, imageId);
  await mkdir(variantDir, { recursive: true });
  const filename = `${width}.${format}`;
  const filepath = path.join(variantDir, filename);

  const pipeline = sharp(source).rotate();
  const withoutAnimation = pipeline;

  let buf: Buffer;
  if (format === 'avif') {
    buf = await withoutAnimation.resize({ width, fit, withoutEnlargement: true }).avif({ quality }).toBuffer();
  } else if (format === 'webp') {
    buf = await withoutAnimation.resize({ width, fit, withoutEnlargement: true }).webp({ quality }).toBuffer();
  } else {
    buf = await withoutAnimation.resize({ width, fit, withoutEnlargement: true }).jpeg({ quality, mozjpeg: true }).toBuffer();
  }

  await writeFile(filepath, buf);

  return {
    variant: { width, format, filename, size: buf.length },
    buffer: buf,
    path: filepath,
  };
}

export async function generateVariants(
  source: Buffer,
  imageId: string,
  profile: OptimizationProfile,
): Promise<ImageVariant[]> {
  const widths = [...new Set(profile.widths)].sort((a, b) => b - a);
  const formats = profile.formats.filter((f) => VALID_FORMATS.includes(f));
  const variants: ImageVariant[] = [];

  for (const width of widths) {
    for (const format of formats) {
      const { variant } = await buildVariant(source, imageId, width, format, profile.quality, profile.fit);
      variants.push(variant);
    }
  }

  return variants;
}

export async function deleteImageFiles(image: AdminImage): Promise<void> {
  const dir = path.join(OPTIMIZED_DIR, image.id);
  await rm(dir, { recursive: true, force: true });
  const original = path.join(GRID_GALLERY_DIR, image.filename);
  await rm(original, { force: true });
}

export { VALID_FORMATS, VALID_FITS };
