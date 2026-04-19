/**
 * Assigns product images randomly from /public/products/ to all products in the DB.
 * Run: npx ts-node -e "require('./scripts/seed-images')"
 * Or:  npx ts-node scripts/seed-images.ts
 *
 * Env vars (all optional, fall back to local defaults):
 *   DB_HOST / DB_PORT / DB_USERNAME / DB_PASSWORD / DB_NAME
 *   IMAGE_BASE_URL  – base URL images are served from
 *                     defaults to https://productsearch-api.onrender.com
 */

import * as fs from 'fs';
import * as path from 'path';
import { Client } from 'pg';

const DB_HOST     = process.env.DB_HOST     ?? 'localhost';
const DB_PORT     = parseInt(process.env.DB_PORT ?? '5432', 10);
const DB_USER     = process.env.DB_USERNAME ?? 'postgres';
const DB_PASS     = process.env.DB_PASSWORD ?? 'postgres';
const DB_NAME     = process.env.DB_NAME     ?? 'product_search';
const IMAGE_BASE  = (process.env.IMAGE_BASE_URL ?? 'https://productsearch-api.onrender.com').replace(/\/$/, '');

async function main() {
  // ── Collect available image filenames ───────────────────────────
  const imgDir   = path.join(__dirname, '..', 'public', 'products');
  const filenames = fs.readdirSync(imgDir).filter((f) => /\.(jpg|jpeg|png|webp)$/i.test(f));

  if (!filenames.length) {
    console.error('No images found in', imgDir);
    process.exit(1);
  }
  console.log(`Found ${filenames.length} images in ${imgDir}`);

  // ── Connect to PostgreSQL ────────────────────────────────────────
  const client = new Client({
    host: DB_HOST, port: DB_PORT,
    user: DB_USER, password: DB_PASS,
    database: DB_NAME,
  });
  await client.connect();
  console.log(`Connected to ${DB_HOST}:${DB_PORT}/${DB_NAME}`);

  // ── Fetch all product IDs ────────────────────────────────────────
  const { rows: products } = await client.query<{ id: string }>(
    'SELECT id FROM products ORDER BY "createdAt" ASC',
  );
  console.log(`Found ${products.length} products`);

  if (!products.length) {
    console.error('No products to update');
    await client.end();
    process.exit(0);
  }

  // ── Shuffle the image list (Fisher-Yates) ───────────────────────
  const shuffled = [...filenames];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // ── Assign 1–2 images per product ───────────────────────────────
  let imgIdx = 0;
  let updated = 0;

  for (const { id } of products) {
    // Wrap around if we run out of images
    const img1 = shuffled[imgIdx % shuffled.length];
    imgIdx++;
    const img2 = Math.random() > 0.5 ? shuffled[imgIdx % shuffled.length] : null;
    if (img2) imgIdx++;

    const images = [
      `${IMAGE_BASE}/uploads/products/${encodeURIComponent(img1)}`,
      ...(img2 ? [`${IMAGE_BASE}/uploads/products/${encodeURIComponent(img2)}`] : []),
    ];

    await client.query(
      'UPDATE products SET images = $1 WHERE id = $2',
      [JSON.stringify(images), id],
    );
    updated++;
  }

  await client.end();
  console.log(`Done — ${updated} products updated with image URLs from ${IMAGE_BASE}/uploads/products/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
