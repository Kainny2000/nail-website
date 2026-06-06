import type { APIRoute } from 'astro';
import fs from 'node:fs';
import path from 'node:path';

export const POST: APIRoute = async ({ request }) => {
  try {
    const text = await request.text();
    fs.writeFileSync(path.join(process.cwd(), 'debug-save-body.txt'), `Body length: ${text.length}\nContent: [${text}]`);
    
    const { favoriteSlideshow, galleryImages } = JSON.parse(text);

    if (!Array.isArray(favoriteSlideshow) || !Array.isArray(galleryImages)) {
      return new Response(JSON.stringify({ error: 'Invalid payload: lists must be arrays' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const dataDir = path.join(process.cwd(), 'src', 'data');
    const favoritesPath = path.join(dataDir, 'favorite-slideshow.json');
    const galleryPath = path.join(dataDir, 'gallery-images.json');

    // Create src/data directory if it doesn't exist
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    fs.writeFileSync(favoritesPath, JSON.stringify(favoriteSlideshow, null, 4), 'utf-8');
    fs.writeFileSync(galleryPath, JSON.stringify(galleryImages, null, 4), 'utf-8');

    return new Response(JSON.stringify({ success: true, message: 'Settings saved successfully' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    fs.writeFileSync(path.join(process.cwd(), 'debug-save-error.txt'), (error.stack || error.message) + '\nJSON payload context: ' + JSON.stringify(error));
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
