import path from 'node:path';
import { GRID_GALLERY_DIR, ADMIN_DIR, MANIFEST_PATH, readManifest, writeManifest, ensureDirs, listGridGallery, emptyManifest } from './manifest';
import { readFile } from 'node:fs/promises';
import { probeImage, generateVariants, makeId, fileExists } from './images';
import type { AdminImage, PressOnPackage, Manifest } from './types';

export async function runMigration(): Promise<Manifest> {
  await ensureDirs();
  if (await fileExists(MANIFEST_PATH)) {
    return readManifest();
  }

  const manifest = emptyManifest();
  const gridFiles = await listGridGallery();

  const carouselFiles: string[] = await readLegacyCarousel();
  const legacyPackages = await readLegacyPressOnPackages();

  const fallbackCarousel = [
    'Image (1).jpeg',
    'Image (2).jpeg',
    'Image (3).jpeg',
    'Image (4).jpeg',
    'Image (5).jpeg',
    'Image (22).jpeg',
  ];
  const carouselSet = new Set(carouselFiles.length > 0 ? carouselFiles : fallbackCarousel);

  let carouselOrder = 0;
  let galleryOrder = 0;

  for (const filename of gridFiles) {
    const fullPath = path.join(GRID_GALLERY_DIR, filename);
    const meta = await probeImage(fullPath);
    const buf = await readFile(fullPath);

    const inCarousel = carouselSet.has(filename);
    const safeBase = filename.replace(/\.[^.]+$/, '');
    const alt = safeBase
      .replace(/\(\d+\)/g, '')
      .replace(/[_-]+/g, ' ')
      .trim() || 'Nail art';

    const id = makeId();
    const seen = new Set<string>();
    const variants: AdminImage['variants'] = [];
    for (const profile of [manifest.optimization.carousel, manifest.optimization.gallery, manifest.optimization.pressOn]) {
      const v = await generateVariants(buf, id, profile);
      for (const variant of v) {
        const k = variant.width + '.' + variant.format;
        if (!seen.has(k)) { seen.add(k); variants.push(variant); }
      }
    }

    const image: AdminImage = {
      id,
      filename,
      originalPath: 'src/assets/grid_gallery/' + filename,
      uploadedAt: new Date().toISOString(),
      size: meta.size,
      width: meta.width,
      height: meta.height,
      alt,
      tags: [],
      caption: '',
      hidden: false,
      usedIn: {
        carousel: inCarousel,
        gallery: !inCarousel,
        pressOnPackages: [],
      },
      carouselOrder: inCarousel ? carouselOrder++ : 0,
      galleryOrder: inCarousel ? 0 : galleryOrder++,
      variants,
    };
    manifest.images.push(image);
  }

  const tagMap: Record<string, string[]> = Object.fromEntries(
    DEFAULT_PRESS_ON_PACKAGES.map((p) => [p.id, p.tags])
  );

  const packagesToCreate = legacyPackages.length > 0
    ? legacyPackages
    : DEFAULT_PRESS_ON_PACKAGES.map((p) => ({ id: p.id, name: p.name, description: p.description, basePrice: p.basePrice }));

  for (const legacy of packagesToCreate) {
    const wantedTags = tagMap[legacy.id] ?? [legacy.id];
    const matchingImages = manifest.images.filter((img) =>
      wantedTags.some((tag) => img.alt.toLowerCase().includes(tag) || img.filename.toLowerCase().includes(tag))
    );

    let imageIds: string[];
    let heroImageId: string | null = null;
    if (matchingImages.length > 0) {
      imageIds = matchingImages.slice(0, 4).map((i) => i.id);
      heroImageId = imageIds[0] ?? null;
    } else {
      const pkgIndex = manifest.pressOnPackages.length;
      const fallbackImages = manifest.images
        .filter((i) => !i.hidden && i.usedIn.gallery)
        .slice(pkgIndex * 2, pkgIndex * 2 + 3);
      imageIds = fallbackImages.map((i) => i.id);
      heroImageId = imageIds[0] ?? null;
    }

    const pkg: PressOnPackage = {
      id: legacy.id,
      name: legacy.name,
      description: legacy.description,
      basePrice: legacy.basePrice ?? 0,
      heroImageId,
      imageIds,
      order: manifest.pressOnPackages.length,
      hidden: false,
    };
    manifest.pressOnPackages.push(pkg);
    for (const id of imageIds) {
      const img = manifest.images.find((i) => i.id === id);
      if (img && !img.usedIn.pressOnPackages.includes(pkg.id)) img.usedIn.pressOnPackages.push(pkg.id);
    }
  }

  await writeManifest(manifest);
  return manifest;
}

async function readLegacyCarousel(): Promise<string[]> {
  const legacyPath = path.join(path.dirname(ADMIN_DIR), 'favorite-slideshow.json');
  if (!(await fileExists(legacyPath))) return [];
  try {
    const raw = await readFile(legacyPath, 'utf8');
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return arr.filter((s) => typeof s === 'string');
  } catch {}
  return [];
}

async function readLegacyPressOnPackages(): Promise<Array<{ id: string; name: string; description: string; basePrice?: number }>> {
  const legacyPath = path.join(path.dirname(ADMIN_DIR), 'press-on.ts');
  if (!(await fileExists(legacyPath))) return [];
  try {
    const raw = await readFile(legacyPath, 'utf8');
    const match = raw.match(/export const pressOnPackages[^=]*=\s*(\[[\s\S]*?\]);/);
    if (!match) return [];
    const arr = JSON.parse(match[1].replace(/'/g, '"').replace(/,(\s*[}\]])/g, '$1'));
    if (Array.isArray(arr)) {
      return arr.map((p: any) => ({
        id: String(p.id),
        name: String(p.name),
        description: String(p.description),
        basePrice: typeof p.basePrice === 'number' ? p.basePrice : undefined,
      }));
    }
  } catch (err) {
    console.error('Failed to parse legacy press-on.ts:', err);
  }
  return [];
}

const DEFAULT_PRESS_ON_PACKAGES: Array<{ id: string; name: string; description: string; basePrice: number; tags: string[] }> = [
  { id: 'french-tip', name: 'French Tip', description: 'Clásico y elegante diseño con punta blanca.', basePrice: 35, tags: ['french', 'tip', 'classic'] },
  { id: 'marmol', name: 'Mármol', description: 'Elegante efecto mármol en tonos neutros.', basePrice: 40, tags: ['marmol', 'marble', 'neutral'] },
  { id: 'glitter', name: 'Glitter', description: 'Brillo y glamour con glitter iridiscente.', basePrice: 35, tags: ['glitter', 'sparkle'] },
  { id: 'floral', name: 'Floral', description: 'Decoración floral delicada y femenina.', basePrice: 38, tags: ['floral', 'flower', 'delicate'] },
  { id: 'geometrico', name: 'Geométrico', description: 'Líneas y formas geométricas modernas.', basePrice: 38, tags: ['geometric', 'modern', 'line'] },
  { id: 'baby-boomer', name: 'Baby Boomer', description: 'Degradado suave de blanco a nude natural.', basePrice: 40, tags: ['baby', 'boomer', 'ombre', 'nude'] },
];
