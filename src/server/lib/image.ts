import sharp from "sharp";
import { randomToken } from "./crypto";

const MAX_BYTES = 8 * 1024 * 1024;
const TARGET_WIDTH = 1600;
const WEBP_QUALITY = 82;

const SIG_JPEG = Buffer.from([0xff, 0xd8, 0xff]);
const SIG_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const SIG_WEBP = Buffer.from("RIFF", "ascii");
const SIG_GIF = Buffer.from("GIF8", "ascii");

function detectFormat(buf) {
  if (buf.length < 12) return null;
  if (buf.subarray(0, 3).equals(SIG_JPEG)) return "jpeg";
  if (buf.subarray(0, 8).equals(SIG_PNG)) return "png";
  if (
    buf.subarray(0, 4).equals(SIG_WEBP) &&
    buf.subarray(8, 12).equals(Buffer.from("WEBP", "ascii"))
  ) {
    return "webp";
  }
  if (buf.subarray(0, 4).equals(SIG_GIF)) return "gif";
  return null;
}

export class ImageValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ImageValidationError";
  }
}

export async function validateAndProcess(buffer) {
  if (!Buffer.isBuffer(buffer)) {
    throw new ImageValidationError("Upload must be a binary file");
  }
  if (buffer.length === 0) {
    throw new ImageValidationError("Empty file");
  }
  if (buffer.length > MAX_BYTES) {
    throw new ImageValidationError(
      `File too large (${(buffer.length / 1024 / 1024).toFixed(1)} MB > 8 MB)`
    );
  }
  const fmt = detectFormat(buffer);
  if (!fmt) {
    throw new ImageValidationError("Unsupported image format");
  }
  if (fmt === "gif") {
    throw new ImageValidationError(
      "GIF is not supported (animated images cannot be safely re-encoded)"
    );
  }

  let pipeline;
  try {
    pipeline = sharp(buffer, { failOn: "error", limitInputPixels: 50_000_000 });
  } catch (err) {
    throw new ImageValidationError(
      `Image could not be decoded: ${(err as Error).message}`
    );
  }

  let metadata;
  try {
    metadata = await pipeline.metadata();
  } catch (err) {
    throw new ImageValidationError(
      `Image metadata unreadable: ${(err as Error).message}`
    );
  }
  if (!metadata.width || !metadata.height) {
    throw new ImageValidationError("Image has no dimensions");
  }
  if (metadata.width > 10000 || metadata.height > 10000) {
    throw new ImageValidationError("Image dimensions too large");
  }

  const webp = await pipeline
    .rotate()
    .resize({ width: TARGET_WIDTH, withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY, effort: 4 })
    .toBuffer();

  const filename = `${randomToken(16)}.webp`;
  return { buffer: webp, filename, width: metadata.width, height: metadata.height };
}
