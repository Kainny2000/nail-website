import { readManifest, manifestExists } from './manifest';
import { runMigration } from './migration';
import { bestVariant } from './manifest';
import type { AdminImage, OptimizationProfile } from './types';

async function ensureManifest() {
  if (!(await manifestExists())) {
    await runMigration();
  }
  return readManifest();
}

export interface PublicImage {
  id: string;
  filename: string;
  alt: string;
  caption: string;
  width: number;
  height: number;
  url: string;
  srcset: string;
}

export interface PublicPackage {
  id: string;
  name: string;
  description: string;
  basePrice: number;
  hero: PublicImage | null;
  gallery: PublicImage[];
}

function toPublicImage(img: AdminImage, profile: OptimizationProfile, formatPriority: string[] = ['avif', 'webp', 'jpeg']): PublicImage | null {
  if (img.variants.length === 0) return null;
  const targetWidth = profile.widths[0] ?? img.variants[0].width;
  const chosen = bestVariant(img, formatPriority, targetWidth);
  if (!chosen) return null;
  const variant = img.variants.find((v) => v.width === chosen.width && v.format === chosen.format)!;
  const url = `/optimized/${img.id}/${variant.filename}`;
  const srcset = profile.widths
    .map((w) => {
      const v = bestVariant(img, formatPriority, w);
      if (!v) return '';
      return `/optimized/${img.id}/${v.width}.${v.format} ${v.width}w`;
    })
    .filter(Boolean)
    .join(', ');
  return {
    id: img.id,
    filename: img.filename,
    alt: img.alt,
    caption: img.caption,
    width: img.width,
    height: img.height,
    url,
    srcset,
  };
}

export async function getCarouselImages(): Promise<PublicImage[]> {
  const m = await ensureManifest();
  const profile = m.optimization.carousel;
  return m.images
    .filter((i) => i.usedIn.carousel && !i.hidden)
    .sort((a, b) => a.carouselOrder - b.carouselOrder)
    .map((i) => toPublicImage(i, profile))
    .filter((x): x is PublicImage => x !== null);
}

export async function getGalleryImages(): Promise<PublicImage[]> {
  const m = await ensureManifest();
  const profile = m.optimization.gallery;
  return m.images
    .filter((i) => i.usedIn.gallery && !i.hidden)
    .sort((a, b) => a.galleryOrder - b.galleryOrder)
    .map((i) => toPublicImage(i, profile))
    .filter((x): x is PublicImage => x !== null);
}

export async function getPressOnPackagesWithImages(): Promise<PublicPackage[]> {
  const m = await ensureManifest();
  const profile = m.optimization.pressOn;
  const imgMap = new Map(m.images.map((i) => [i.id, i]));
  return m.pressOnPackages
    .filter((p) => !p.hidden)
    .sort((a, b) => a.order - b.order)
    .map<PublicPackage>((p) => {
      const imgs = p.imageIds
        .map((id) => imgMap.get(id))
        .filter((i): i is AdminImage => Boolean(i) && !i!.hidden)
        .map((i) => toPublicImage(i, profile))
        .filter((x): x is PublicImage => x !== null);
      const hero = p.heroImageId ? imgs.find((i) => i.id === p.heroImageId) ?? imgs[0] ?? null : imgs[0] ?? null;
      return {
        id: p.id,
        name: p.name,
        description: p.description,
        basePrice: p.basePrice,
        hero,
        gallery: imgs,
      };
    });
}

export async function getImagesForSection(section: 'carousel' | 'gallery' | 'pressOn'): Promise<PublicImage[]> {
  if (section === 'carousel') return getCarouselImages();
  if (section === 'gallery') return getGalleryImages();
  const m = await readManifest();
  const profile = m.optimization.pressOn;
  return m.images
    .filter((i) => i.usedIn.pressOnPackages.length > 0 && !i.hidden)
    .map((i) => toPublicImage(i, profile))
    .filter((x): x is PublicImage => x !== null);
}

export async function getImageRecord(id: string): Promise<AdminImage | null> {
  const m = await ensureManifest();
  return m.images.find((i) => i.id === id) ?? null;
}

export async function getPublicImageUrl(image: AdminImage, profileKey: 'carousel' | 'gallery' | 'pressOn' = 'gallery'): Promise<string> {
  const m = await ensureManifest();
  const profile = m.optimization[profileKey];
  const chosen = bestVariant(image, profile.formats, profile.widths[0] ?? image.variants[0]?.width ?? 800);
  if (!chosen) return `/optimized/${image.id}/${image.variants[0]?.filename ?? ''}`;
  return `/optimized/${image.id}/${chosen.width}.${chosen.format}`;
}

export async function getSrcset(image: AdminImage, profileKey: 'carousel' | 'gallery' | 'pressOn' = 'gallery'): Promise<string> {
  const m = await ensureManifest();
  const profile = m.optimization[profileKey];
  return profile.widths
    .map((w) => {
      const v = bestVariant(image, profile.formats, w);
      if (!v) return '';
      return `/optimized/${image.id}/${v.width}.${v.format} ${v.width}w`;
    })
    .filter(Boolean)
    .join(', ');
}

export function isAdminRequest(request: Request): boolean {
  return request.headers.get('cookie')?.includes('bf_admin=') ?? false;
}
