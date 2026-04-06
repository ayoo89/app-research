-- Product Search DB Schema — Production Optimised
-- PostgreSQL 15+

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";      -- trigram similarity (fuzzy search)
CREATE EXTENSION IF NOT EXISTS "unaccent";     -- accent-insensitive search

-- ── Custom text search configuration with synonym support ─────────────────────
-- Thesaurus file: $SHAREDIR/tsearch_data/product_synonyms.ths
-- Example content:
--   phone, smartphone, mobile
--   tv, television, screen
-- Create with: CREATE TEXT SEARCH DICTIONARY product_syn (TEMPLATE=thesaurus, DictFile=product_synonyms, Dictionary=english_stem);
-- Then: CREATE TEXT SEARCH CONFIGURATION product_search (COPY=english);
--       ALTER TEXT SEARCH CONFIGURATION product_search ALTER MAPPING FOR asciiword, word WITH product_syn, english_stem;
-- For now we use 'english' config; swap to 'product_search' once thesaurus is configured.

-- ── Users ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email        VARCHAR(255) UNIQUE NOT NULL,
  name         VARCHAR(255),
  password     VARCHAR(255),
  role         VARCHAR(50) DEFAULT 'user' CHECK (role IN ('super_admin', 'admin', 'user')),
  is_active    BOOLEAN DEFAULT FALSE,
  invite_token VARCHAR(255),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── Products ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS products (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                VARCHAR(500) NOT NULL,
  brand               VARCHAR(255),
  barcode             VARCHAR(100),
  description         TEXT,
  category            VARCHAR(255),
  images              JSONB DEFAULT '[]',
  embedding_vector    FLOAT[],          -- stored for reference; KNN via Elasticsearch
  embedding_generated BOOLEAN DEFAULT FALSE,
  metadata            JSONB,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

-- Barcode: unique partial index (NULL barcodes excluded)
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_barcode
  ON products(barcode) WHERE barcode IS NOT NULL;

-- Full-text search: pre-computed tsvector column for best performance at scale
ALTER TABLE products ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english',
      name || ' ' ||
      COALESCE(brand, '') || ' ' ||
      COALESCE(description, '') || ' ' ||
      COALESCE(category, '')
    )
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_products_fts
  ON products USING GIN (search_vector);

-- Trigram indexes for fuzzy / partial matching
CREATE INDEX IF NOT EXISTS idx_products_name_trgm
  ON products USING GIN (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_products_brand_trgm
  ON products USING GIN (brand gin_trgm_ops);

-- Category filter (used in filtered vector search)
CREATE INDEX IF NOT EXISTS idx_products_category
  ON products(category);

-- Embedding status (for re-indexing jobs)
CREATE INDEX IF NOT EXISTS idx_products_embedding_status
  ON products(embedding_generated) WHERE embedding_generated = FALSE;

-- ── Optimised search query (reference) ───────────────────────────────────────
-- Uses the stored search_vector column — no runtime tsvector computation:
--
-- SELECT p.*,
--   ts_rank_cd(p.search_vector, websearch_to_tsquery('english', $1), 32) AS fts_rank,
--   GREATEST(similarity(p.name, $1), similarity(COALESCE(p.brand,''), $1)) AS trgm_score
-- FROM products p
-- WHERE p.search_vector @@ websearch_to_tsquery('english', $1)
--    OR similarity(p.name, $1) > 0.2
-- ORDER BY (fts_rank * 0.7 + trgm_score * 0.3) DESC
-- LIMIT 20;

-- ── Elasticsearch index mapping (reference) ───────────────────────────────────
-- See embedding-service/main.py _ensure_index()
-- Key settings:
--   dense_vector dims=512, similarity=cosine
--   HNSW: m=16, ef_construction=100
--   Query: knn.num_candidates = max(limit*5, 150)
