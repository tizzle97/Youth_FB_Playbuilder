// One-off script to rasterize public/brand-icon.svg into the PNG sizes
// needed for apple-touch-icon and the web app manifest (iOS doesn't support
// SVG favicons/home-screen icons; PWA manifests need PNG raster icons too).
// Run with: node scripts/render-icons.mjs
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const svg = readFileSync(path.join(root, 'public/brand-icon.svg'), 'utf8');

const sizes = [
  { file: 'apple-touch-icon.png', size: 180 },
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
];

const browser = await chromium.launch(
  process.env.PBP_CHROMIUM_PATH ? { executablePath: process.env.PBP_CHROMIUM_PATH } : {}
);
const page = await browser.newPage();

for (const { file, size } of sizes) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<!doctype html><html><body style="margin:0">${svg.replace(
      '<svg ',
      `<svg width="${size}" height="${size}" `
    )}</body></html>`
  );
  const el = await page.$('svg');
  const buf = await el.screenshot({ omitBackground: false });
  writeFileSync(path.join(root, 'public', file), buf);
  console.log(`wrote public/${file} (${size}x${size})`);
}

await browser.close();
