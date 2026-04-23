/**
 * Assigns product images directly via the database.
 * Run: node backend/scripts/assign-images-node.js
 * Requires: npm install pg (already in backend/node_modules)
 */

const { Client } = require('pg');

const IMG_BASE  = process.env.IMAGE_BASE_URL ?? 'https://productsearch-api.onrender.com';
const IMG_COUNT = 81; // 0.jpg to 80.jpg

const client = new Client({
  host:     process.env.DB_HOST     ?? 'localhost',
  port:     parseInt(process.env.DB_PORT ?? '5432'),
  user:     process.env.DB_USERNAME ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
  database: process.env.DB_NAME     ?? 'product_search',
  ssl:      process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

async function main() {
  await client.connect();
  console.log('Connected to database');

  const { rows: products } = await client.query(
    'SELECT id FROM products ORDER BY "createdAt" ASC'
  );
  console.log(`Found ${products.length} products`);

  let updated = 0;
  for (let i = 0; i < products.length; i++) {
    const img1 = `${IMG_BASE}/uploads/products/${(i * 2) % IMG_COUNT}.jpg`;
    const img2 = `${IMG_BASE}/uploads/products/${(i * 2 + 1) % IMG_COUNT}.jpg`;
    await client.query(
      `UPDATE products SET images = $1::jsonb WHERE id = $2`,
      [JSON.stringify([img1, img2]), products[i].id]
    );
    updated++;
    process.stdout.write(`\r  Updated ${updated}/${products.length}...`);
  }

  console.log(`\nDone — ${updated} products updated with images`);
  console.log(`Sample URL: ${IMG_BASE}/uploads/products/0.jpg`);

  await client.end();
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
