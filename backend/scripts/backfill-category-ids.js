const { Client } = require('pg');

const client = new Client({
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432'),
  user: process.env.DB_USERNAME ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
  database: process.env.DB_NAME ?? 'product_search',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

async function main() {
  await client.connect();
  console.log('Connected');

  const { rows: categories } = await client.query(
    'SELECT id, name FROM product_categories'
  );
  const catMap = new Map(categories.map(c => [c.name.toLowerCase(), c.id]));
  console.log(`Loaded ${categories.length} categories`);

  const { rows: products } = await client.query(
    `SELECT id, category FROM products WHERE category IS NOT NULL AND category != '' AND "categoryId" IS NULL`
  );
  console.log(`Found ${products.length} products to backfill`);

  let updated = 0;
  for (const p of products) {
    const catId = catMap.get(p.category.toLowerCase());
    if (catId) {
      await client.query('UPDATE products SET "categoryId" = $1 WHERE id = $2', [catId, p.id]);
      updated++;
    }
  }

  console.log(`Done — ${updated}/${products.length} products linked to categories`);
  await client.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
