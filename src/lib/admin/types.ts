export type ImageFormat = 'avif' | 'webp' | 'jpeg';
export type ImageFit = 'cover' | 'contain';

export interface ImageVariant {
  width: number;
  format: ImageFormat;
  filename: string;
  size: number;
}

export interface AdminImage {
  id: string;
  filename: string;
  originalPath: string;
  uploadedAt: string;
  size: number;
  width: number;
  height: number;
  alt: string;
  tags: string[];
  caption: string;
  hidden: boolean;
  usedIn: {
    carousel: boolean;
    gallery: boolean;
    pressOnPackages: string[];
  };
  carouselOrder: number;
  galleryOrder: number;
  variants: ImageVariant[];
}

export interface PressOnPackage {
  id: string;
  name: string;
  description: string;
  basePrice: number;
  heroImageId: string | null;
  imageIds: string[];
  order: number;
  hidden: boolean;
}

export interface OptimizationProfile {
  widths: number[];
  formats: ImageFormat[];
  quality: number;
  fit: ImageFit;
}

export interface Manifest {
  version: 1;
  images: AdminImage[];
  pressOnPackages: PressOnPackage[];
  optimization: {
    carousel: OptimizationProfile;
    gallery: OptimizationProfile;
    pressOn: OptimizationProfile;
  };
  updatedAt: string;
}

export type SectionKey = 'carousel' | 'gallery' | 'pressOn';

export interface SessionData {
  issuedAt: number;
  expiresAt: number;
}
