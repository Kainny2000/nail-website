import { mkdir, readFile, writeFile, rename, access, readdir, unlink, stat as statFn } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Manifest, AdminImage, PressOnPackage } from './types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');

export const ADMIN_DIR = path.join(PROJECT_ROOT, 'src', 'data', 'admin');
export const MANIFEST_PATH = path.join(ADMIN_DIR, 'manifest.json');
export const LOCK_PATH = path.join(ADMIN_DIR, '.lock');
export const GRID_GALLERY_DIR = path.join(PROJECT_ROOT, 'src', 'assets', 'grid_gallery');
export const OPTIMIZED_DIR = path.join(PROJECT_ROOT, 'public', 'optimized');

const LOCK_STALE_MS = 10_000;

export async function ensureDirs(): Promise<void> {
  await mkdir(ADMIN_DIR, { recursive: true });
  await mkdir(GRID_GALLERY_DIR, { recursive: true });
  await mkdir(OPTIMIZED_DIR, { recursive: true });
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function acquireLock(): Promise<() => Promise<void>> {
  const start = Date.now();
  const lockData = JSON.stringify({ pid: process.pid, at: Date.now() });

  while (true) {
    try {
      const fd = await import('node:fs/promises').then((m) => m.open(LOCK_PATH, 'wx'));
      await fd.writeFile(lockData, 'utf8');
      await fd.close();
      return async () => {
        try { await unlink(LOCK_PATH); } catch {}
      };
    } catch (err: any) {
      if (err?.code !== 'EEXIST') throw err;
      try {
        const lockStat = await statFn(LOCK_PATH);
        if (Date.now() - lockStat.mtimeMs > LOCK_STALE_MS) {
          await unlink(LOCK_PATH).catch(() => {});
        }
      } catch {}
      if (Date.now() - start > 5000) {
        throw new Error('Could not acquire manifest lock within 5s');
      }
      await new Promise((r) => setTimeout(r, 50 + Math.random() * 100));
    }
  }
}

export const DEFAULT_OPTIMIZATION: Manifest['optimization'] = {
  widths: [400, 800, 1200],
  formats: ['avif', 'webp'],
  quality: 78,
  fit: 'cover',
};

export function emptyManifest(): Manifest {
  return {
    version: 1,
    images: [],
    pressOnPackages: [],
    optimization: structuredClone(DEFAULT_OPTIMIZATION),
    updatedAt: new Date().toISOString(),
  };
}

export async function manifestExists(): Promise<boolean> {
  return fileExists(MANIFEST_PATH);
}

export async function readManifest(): Promise<Manifest> {
  const raw = await readFile(MANIFEST_PATH, 'utf8');
  const parsed = JSON.parse(raw) as Manifest;
  parsed.optimization = parsed.optimization ?? structuredClone(DEFAULT_OPTIMIZATION);
  parsed.images = parsed.images ?? [];
  parsed.pressOnPackages = parsed.pressOnPackages ?? [];
  return parsed;
}

export async function writeManifest(manifest: Manifest): Promise<void> {
  await ensureDirs();
  const release = await acquireLock();
  try {
    manifest.updatedAt = new Date().toISOString();
    const tmpPath = MANIFEST_PATH + '.tmp-' + process.pid + '-' + Date.now();
    await writeFile(tmpPath, JSON.stringify(manifest, null, 2), 'utf8');
    await rename(tmpPath, MANIFEST_PATH);
  } finally {
    await release();
  }
}

export async function updateManifest(mutator: (m: Manifest) => void | Promise<void>): Promise<Manifest> {
  const m = await readManifest();
  await mutator(m);
  await writeManifest(m);
  return m;
}

export async function readManifestIfExists(): Promise<Manifest | null> {
  if (!(await manifestExists())) return null;
  return readManifest();
}

export function getImageById(manifest: Manifest, id: string): AdminImage | undefined {
  return manifest.images.find((i) => i.id === id);
}

export function getPackageById(manifest: Manifest, id: string): PressOnPackage | undefined {
  return manifest.pressOnPackages.find((p) => p.id === id);
}

export function publicImagePath(image: AdminImage, variant: { width: number; format: string }): string {
  return `/optimized/${image.id}/${variant.width}.${variant.format}`;
}

export function bestVariant(image: AdminImage, formatPriority: string[], width: number): { width: number; format: string } | null {
  for (const format of formatPriority) {
    const found = image.variants.find((v) => v.width === width && v.format === format);
    if (found) return { width: found.width, format: found.format };
  }
  if (image.variants.length === 0) return null;
  const closest = image.variants.reduce((best, v) => {
    const d = Math.abs(v.width - width);
    const bd = Math.abs(best.width - width);
    return d < bd ? v : best;
  });
  return { width: closest.width, format: closest.format };
}

export async function listGridGallery(): Promise<string[]> {
  if (!(await fileExists(GRID_GALLERY_DIR))) return [];
  const entries = await readdir(GRID_GALLERY_DIR);
  return entries.filter((f) => /\.(jpe?g|png|webp)$/i.test(f));
}
