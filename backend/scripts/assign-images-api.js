/**
 * Assigns product images via the REST API.
 * Run: node scripts/assign-images-api.js
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const API_BASE   = process.env.API_BASE   ?? 'https://productsearch-api.onrender.com/api/v1';
const IMAGE_BASE = process.env.IMAGE_BASE ?? 'https://productsearch-api.onrender.com';
const TOKEN      = process.env.TOKEN;

if (!TOKEN) {
  console.error('Set TOKEN env var to a valid super_admin JWT.\nExample: TOKEN=eyJ... node scripts/assign-images-api.js');
  process.exit(1);
}

// Collect image filenames
const imgDir = path.join(__dirname, '..', 'public', 'products');
const filenames = fs.readdirSync(imgDir).filter((f) => /\.(jpg|jpeg|png|webp)$/i.test(f));
console.log(`Found ${filenames.length} image files`);

// Fisher-Yates shuffle
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_BASE + path);
    const data = body ? JSON.stringify(body) : undefined;
    const req = https.request({
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`,
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    }, (res) => {
      let raw = '';
      res.on('data', (c) => (raw += c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  // Fetch all products (paginate)
  const allProducts = [];
  let page = 1;
  while (true) {
    const res = await request('GET', `/products?page=${page}&limit=100`);
    const items = res.body.data ?? res.body;
    if (!items.length) break;
    allProducts.push(...items);
    if (items.length < 100) break;
    page++;
  }
  console.log(`Fetched ${allProducts.length} products`);

  const shuffled = shuffle(filenames);
  let imgIdx = 0;
  let updated = 0;
  let failed = 0;

  for (const product of allProducts) {
    const img1 = shuffled[imgIdx % shuffled.length];
    imgIdx++;
    const img2 = Math.random() > 0.5 ? shuffled[imgIdx % shuffled.length] : null;
    if (img2) imgIdx++;

    const images = [
      `${IMAGE_BASE}/uploads/products/${encodeURIComponent(img1)}`,
      ...(img2 ? [`${IMAGE_BASE}/uploads/products/${encodeURIComponent(img2)}`] : []),
    ];

    const res = await request('PUT', `/products/${product.id}`, { images });
    if (res.status === 200 || res.status === 201) {
      updated++;
      process.stdout.write(`\r  Updated ${updated}/${allProducts.length} ...`);
    } else {
      failed++;
      console.error(`\nFailed product ${product.id}: ${res.status}`, res.body);
    }
  }

  console.log(`\nDone — ${updated} updated, ${failed} failed`);
  console.log(`Image URLs point to: ${IMAGE_BASE}/uploads/products/`);
}

main().catch((err) => { console.error(err); process.exit(1); });
