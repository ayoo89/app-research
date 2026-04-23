-- Assign product images directly in the database
-- Images are named 0.jpg to 80.jpg in public/products/
-- This script assigns 1-2 images per product in round-robin order
-- Run: psql $DATABASE_URL -f backend/scripts/assign-images-db.sql

DO $$
DECLARE
  r RECORD;
  img_base TEXT := 'https://productsearch-api.onrender.com';
  img_count INT := 81;  -- 0.jpg to 80.jpg
  idx INT := 0;
  img1 TEXT;
  img2 TEXT;
BEGIN
  FOR r IN SELECT id FROM products ORDER BY "createdAt" ASC LOOP
    img1 := img_base || '/uploads/products/' || (idx % img_count) || '.jpg';
    img2 := img_base || '/uploads/products/' || ((idx + 1) % img_count) || '.jpg';
    idx := idx + 2;

    UPDATE products
    SET images = jsonb_build_array(img1, img2)
    WHERE id = r.id AND (images = '[]'::jsonb OR images IS NULL);
  END LOOP;

  RAISE NOTICE 'Done — assigned images to % products', idx / 2;
END $$;
