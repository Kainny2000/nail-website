import type { APIRoute } from 'astro';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

export const POST: APIRoute = async ({ request }) => {
  try {
    const formData = await request.formData();
    const file = formData.get('image') as File | null;

    if (!file) {
      return new Response(JSON.stringify({ error: 'No image file uploaded' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    
    // Naming directory and file path
    const galleryDir = path.join(process.cwd(), 'src', 'assets', 'grid_gallery');

    if (!fs.existsSync(galleryDir)) {
      fs.mkdirSync(galleryDir, { recursive: true });
    }

    // Determine the next index: "Image (N).jpeg"
    const files = fs.readdirSync(galleryDir);
    let maxNum = 0;
    for (const f of files) {
      const match = f.match(/Image\s*\((\d+)\)\.jpe?g/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) {
          maxNum = num;
        }
      }
    }

    const nextNum = maxNum + 1;
    const newFileName = `Image (${nextNum}).jpeg`;
    const targetPath = path.join(galleryDir, newFileName);

    // Convert to high-quality JPEG using sharp
    let processedBuffer: Buffer;
    try {
      processedBuffer = await sharp(buffer)
        .jpeg({ quality: 90, mozjpeg: true })
        .toBuffer();
    } catch (sharpError: any) {
      // Fallback: If sharp fails (e.g. unsupported format by sharp on this system), write the raw buffer
      // but warn about potential format issues
      console.warn("Sharp processing failed, writing raw file: ", sharpError.message);
      processedBuffer = buffer;
    }

    // Write file to assets
    fs.writeFileSync(targetPath, processedBuffer);

    // Auto-register in gallery-images.json
    const galleryPath = path.join(process.cwd(), 'src', 'data', 'gallery-images.json');
    let galleryList: string[] = [];

    if (fs.existsSync(galleryPath)) {
      try {
        galleryList = JSON.parse(fs.readFileSync(galleryPath, 'utf-8'));
      } catch (e) {
        // Fallback if json is corrupt
      }
    }

    if (!Array.isArray(galleryList)) {
      galleryList = [];
    }

    if (!galleryList.includes(newFileName)) {
      galleryList.push(newFileName);
      fs.writeFileSync(galleryPath, JSON.stringify(galleryList, null, 4), 'utf-8');
    }

    return new Response(JSON.stringify({
      success: true,
      fileName: newFileName,
      message: `Successfully uploaded and processed ${newFileName}`
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
