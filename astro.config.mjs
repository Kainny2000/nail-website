import { defineConfig } from 'astro/config';
import node from '@astrojs/node'; // Import the Node adapter instead of Cloudflare

export default defineConfig({
  output: 'server',
  adapter: node({
    mode: 'standalone' // Set mode to standalone for Node.js production use
  }),
  server: { host: '127.0.0.1', port: 4321 }
});

