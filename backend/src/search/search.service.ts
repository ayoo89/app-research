import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import Redis from 'ioredis';
import * as crypto from 'crypto';

import { Product } from '../product/product.entity';
import { EmbeddingService } from '../product/embedding.service';
import { MetricsService } from '../common/metrics.service';
import { REDIS_CLIENT } from './cache.module';
import {
  SearchRequest, SearchResponse, SearchResult,
  MatchMethod, ScoringWeights, DEFAULT_WEIGHTS,
  ProductSearchFilters,
} from './search.types';

const CACHE_TTL_TEXT    = 300;   // 5 min
const CACHE_TTL_BARCODE = 60;    // 60s — barcode hits are deterministic
const CACHE_TTL_EMBED   = 3600;  // 1 hr
const TOP_N           = 50;
const MAX_SCAN_PAYLOAD = 2048;

// Circuit breaker state for embedding service
interface CircuitState {
  failures: number;
  openUntil: number;  // epoch ms; 0 = closed
}

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);
  private readonly circuit: CircuitState = { failures: 0, openUntil: 0 };
  private readonly CIRCUIT_THRESHOLD = 5;   // open after 5 consecutive failures
  private readonly CIRCUIT_RESET_MS  = 30_000; // try again after 30s

  constructor(
    @InjectRepository(Product) private productRepo: Repository<Product>,
    private embeddingService: EmbeddingService,
    private metrics: MetricsService,
    @Inject(REDIS_CLIENT) private redis: Redis,
  ) {}

  // ─────────────────────────────────────────────────────────────────
  // Public entry point
  // ─────────────────────────────────────────────────────────────────

  async search(req: SearchRequest, correlationId?: string): Promise<SearchResponse> {
    const start   = Date.now();
    const weights = { ...DEFAULT_WEIGHTS, ...req.weights };
    const limit   = Math.min(req.limit ?? 20, 50);

    // ── Cache check ───────────────────────────────────────────────
    const cacheKey = this.buildCacheKey(req);
    const cached   = await this.tryCache(cacheKey, req);
    if (cached) {
      this.metrics.increment('search_cache_hits_total');
      this.metrics.observe('search_latency_ms', Date.now() - start, { cache: 'hit' });
      return { ...cached, meta: { ...cached.meta, totalMs: Date.now() - start, cacheHit: true } };
    }
    this.metrics.increment('search_cache_misses_total');

    // ── Pipeline ──────────────────────────────────────────────────
    let results: SearchResult[] = [];
    let methods: MatchMethod[]  = [];

    try {
      ({ results, methods } = await this.runPipeline(req, weights, limit));
    } catch (err: any) {
      this.logger.error(`Pipeline error [${correlationId}]: ${err.message}`);
      this.metrics.increment('search_errors_total', { stage: 'pipeline' });
      // Return empty rather than 500 — search should degrade gracefully
      results = [];
      methods = [];
    }

    const totalMs = Date.now() - start;
    const response: SearchResponse = {
      results,
      meta: { totalMs, cacheHit: false, methods, correlationId },
    };

    // ── Cache write ───────────────────────────────────────────────
    if (!req.imageBase64 && results.length > 0) {
      this.redis.setex(cacheKey, CACHE_TTL_TEXT, JSON.stringify(response))
        .catch((err) => this.logger.warn(`Cache write failed: ${err.message}`));
    }

    // ── Metrics ───────────────────────────────────────────────────
    this.metrics.observe('search_latency_ms', totalMs, { cache: 'miss' });
    this.metrics.increment('search_requests_total', { methods: methods.join('+') || 'none' });
    if (totalMs > 1000) {
      this.metrics.increment('search_slow_queries_total');
      this.logger.warn(`Slow search ${totalMs}ms [${correlationId}] methods=${methods.join('+')}`);
    }

    this.logger.log(JSON.stringify({
      event: 'search',
      correlationId,
      methods,
      resultCount: results.length,
      totalMs,
      cacheHit: false,
    }));

    return response;
  }

  // ─────────────────────────────────────────────────────────────────
  // Pipeline — barcode → (text ∥ vector) → merge
  // ─────────────────────────────────────────────────────────────────

  private async runPipeline(
    req: SearchRequest,
    weights: ScoringWeights,
    limit: number,
  ): Promise<{ results: SearchResult[]; methods: MatchMethod[] }> {
    const methods: MatchMethod[] = [];

    // Step 1: Code-barres, QR (URL / GTIN), ou UUID produit — match prioritaire
    if (req.barcode?.trim()) {
      const t0        = Date.now();
      const bcCacheKey = `search:bc:${crypto.createHash('sha256').update(req.barcode.trim() + JSON.stringify(req.filters ?? {})).digest('hex')}`;
      const cached     = await this.redis.get(bcCacheKey).catch(() => null);
      if (cached) {
        const product = JSON.parse(cached) as Product;
        this.metrics.increment('search_cache_hits_total');
        return { results: [this.toResult(product, weights.barcode, ['barcode'])], methods: ['barcode'] };
      }
      const product = await this.resolveScanProduct(req.barcode.trim(), req.filters);
      this.metrics.observe('search_barcode_latency_ms', Date.now() - t0);
      if (product) {
        methods.push('barcode');
        this.metrics.increment('search_barcode_hits_total');
        this.redis.setex(bcCacheKey, CACHE_TTL_BARCODE, JSON.stringify(product)).catch(() => {});
        return { results: [this.toResult(product, weights.barcode, ['barcode'])], methods };
      }
      this.metrics.increment('search_barcode_misses_total');
    }

    // Steps 2 & 3: text + vector in parallel with independent timeouts
    const [textResults, vectorResults] = await Promise.all([
      req.text?.trim()
        ? this.runTextSearch(req.text.trim(), limit, weights, req.filters)
        : Promise.resolve([]),
      req.imageBase64
        ? this.runVectorSearchWithFallback(req.imageBase64, req.text, limit, weights, req.filters)
        : Promise.resolve([]),
    ]);

    if (textResults.length)   methods.push('text');
    if (vectorResults.length) methods.push('vector');

    return { results: this.mergeAndRank([...textResults, ...vectorResults], weights, limit), methods };
  }

  // ─────────────────────────────────────────────────────────────────
  // Text Search
  // ─────────────────────────────────────────────────────────────────

  private async runTextSearch(
    query: string,
    limit: number,
    weights: ScoringWeights,
    filters?: ProductSearchFilters,
  ): Promise<SearchResult[]> {
    const t0 = Date.now();
    const fc  = filters?.category?.trim().toLowerCase() ?? null;
    const fs  = filters?.subcategory?.trim().toLowerCase() ?? null;
    const ff  = filters?.family?.trim().toLowerCase() ?? null;
    const fcg = filters?.codeGold?.trim().toLowerCase() ?? null;
    const fde = filters?.designation?.trim().toLowerCase() ?? null;
    const fe  = filters?.ean?.trim() ?? null;
    try {
      const rows = await Promise.race([
        this.productRepo.query(
          `
          WITH fts AS (
            SELECT
              p.id,
              ts_rank_cd(
                to_tsvector('simple',
                  p.name || ' ' || COALESCE(p.brand,'') || ' ' ||
                  COALESCE(p.description,'') || ' ' || COALESCE(p.category,'') || ' ' ||
                  COALESCE(p.family,'') || ' ' || COALESCE(p.subcategory,'') || ' ' ||
                  COALESCE(p.barcode,'') || ' ' || COALESCE(p."codeGold",'')
                ),
                websearch_to_tsquery('simple', $1), 32
              ) AS fts_rank,
              GREATEST(
                similarity(lower(p.name), lower($1)),
                similarity(lower(COALESCE(p.brand,'')), lower($1)),
                similarity(lower(COALESCE(p.barcode,'')), lower($1)),
                similarity(lower(COALESCE(p."codeGold",'')), lower($1))
              ) AS trgm_score
            FROM products p
            WHERE
              (
                to_tsvector('simple',
                  p.name || ' ' || COALESCE(p.brand,'') || ' ' ||
                  COALESCE(p.description,'') || ' ' || COALESCE(p.category,'') || ' ' ||
                  COALESCE(p.family,'') || ' ' || COALESCE(p.subcategory,'') || ' ' ||
                  COALESCE(p.barcode,'') || ' ' || COALESCE(p."codeGold",'')
                ) @@ websearch_to_tsquery('simple', $1)
                OR lower(p.name) LIKE '%' || lower($1) || '%'
                OR lower(COALESCE(p.category,'')) LIKE '%' || lower($1) || '%'
                OR lower(COALESCE(p.family,'')) LIKE '%' || lower($1) || '%'
                OR lower(COALESCE(p.subcategory,'')) LIKE '%' || lower($1) || '%'
                OR similarity(lower(p.name), lower($1)) > 0.2
                OR similarity(lower(COALESCE(p.brand,'')), lower($1)) > 0.25
                OR similarity(lower(COALESCE(p.barcode,'')), lower($1)) > 0.3
                OR similarity(lower(COALESCE(p."codeGold",'')), lower($1)) > 0.35
              )
              AND ($3::text IS NULL OR strpos(lower(coalesce(p.category,'')), $3) > 0)
              AND ($4::text IS NULL OR strpos(lower(coalesce(p.subcategory,'')), $4) > 0)
              AND ($5::text IS NULL OR strpos(lower(coalesce(p.family,'')), $5) > 0)
              AND ($6::text IS NULL OR strpos(lower(coalesce(p."codeGold",'')), $6) > 0)
              AND ($7::text IS NULL OR strpos(lower(coalesce(p.name,'')), $7) > 0)
              AND ($8::text IS NULL OR strpos(lower(coalesce(p.barcode,'')), $8) > 0)
          )
          SELECT
            p.id, p.name, p.brand, p."codeGold", p.barcode, p.category, p.subcategory, p.family, p.images,
            COALESCE(f.fts_rank, 0) * 0.7 + COALESCE(f.trgm_score, 0) * 0.3 AS combined_text_score
          FROM products p
          JOIN fts f ON f.id = p.id
          ORDER BY combined_text_score DESC
          LIMIT $2
          `,
          [query, limit, fc, fs, ff, fcg, fde, fe],
        ),
        this.timeout(800, 'text-search'),
      ]);

      const ms = Date.now() - t0;
      this.metrics.observe('search_text_latency_ms', ms);

      return (rows as any[]).map((row) => {
        const raw = Math.min(parseFloat(row.combined_text_score) || 0, 1);
        return this.toResult(row, raw * weights.text, ['text'], { textScore: raw * weights.text, rawTextRank: raw });
      });
    } catch (err: any) {
      this.logger.warn(`Text search failed (${Date.now() - t0}ms): ${err.message}`);
      this.metrics.increment('search_errors_total', { stage: 'text' });
      return [];
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // Vector Search with circuit breaker + text fallback
  // ─────────────────────────────────────────────────────────────────

  private async runVectorSearchWithFallback(
    imageBase64: string,
    fallbackText: string | undefined,
    limit: number,
    weights: ScoringWeights,
    filters?: ProductSearchFilters,
  ): Promise<SearchResult[]> {
    // Circuit breaker — open?
    if (this.circuit.openUntil > Date.now()) {
      this.logger.warn('Embedding circuit open — skipping vector search');
      this.metrics.increment('search_circuit_open_total');
      if (fallbackText?.trim()) {
        this.logger.log('Circuit fallback → text search');
        return this.runTextSearch(fallbackText.trim(), limit, weights, filters);
      }
      return [];
    }

    const t0 = Date.now();
    try {
      // Embedding cache
      const imgHash       = crypto.createHash('sha256').update(imageBase64.slice(0, 2000)).digest('hex');
      const embedCacheKey = `embed:img:${imgHash}`;
      let embedding: number[];

      let cachedEmbed: Buffer | null = null;
      try {
        cachedEmbed = await this.redis.getBuffer(embedCacheKey);
      } catch (redisErr: any) {
        this.logger.warn(`Redis getBuffer failed: ${redisErr.message}`);
      }

      if (cachedEmbed) {
        const floats = new Float32Array(cachedEmbed.buffer, cachedEmbed.byteOffset, cachedEmbed.byteLength / 4);
        embedding = Array.from(floats);
        this.metrics.increment('embed_cache_hits_total');
      } else {
        embedding = await Promise.race([
          this.embeddingService.generateImageEmbedding(imageBase64),
          this.timeout<number[]>(5000, 'embedding-generation'),
        ]);
        // Store as raw float32 bytes — 4× smaller than JSON
        const buf = Buffer.from(new Float32Array(embedding).buffer);
        this.redis.setex(embedCacheKey, CACHE_TTL_EMBED, buf).catch(() => {});
        this.metrics.increment('embed_cache_misses_total');
      }

      // Cosine similarity via dot product of L2-normalised vectors (no pgvector extension needed).
      // Embed the query vector inline to avoid parameter type-inference issues with float arrays.
      // Safe: embedding values are always finite floats produced by our own CLIP service.
      const safeVec = embedding.map((v) => (Number.isFinite(v) ? v : 0));
      const vecLiteral = `ARRAY[${safeVec.join(',')}]::float8[]`;
      const rows = await Promise.race([
        this.productRepo.query(
          `SELECT p.id, p.name, p.brand, p."codeGold", p.barcode,
                  p.category, p.subcategory, p.family, p.images,
                  (SELECT COALESCE(SUM(pv * qv), 0)
                   FROM UNNEST(p."embeddingVector", ${vecLiteral}) AS t(pv, qv)) AS vector_score
           FROM products p
           WHERE p."embeddingVector" IS NOT NULL
             AND array_length(p."embeddingVector", 1) = 512
           ORDER BY (SELECT COALESCE(SUM(pv * qv), 0)
                     FROM UNNEST(p."embeddingVector", ${vecLiteral}) AS t(pv, qv)) DESC NULLS LAST
           LIMIT $1`,
          [limit * 3],
        ),
        this.timeout<any[]>(4000, 'vector-search'),
      ]);

      this.metrics.observe('search_vector_latency_ms', Date.now() - t0);
      this.circuit.failures = 0;

      // CLIP image↔text cosine similarity is typically 0.15–0.35 for semantically related pairs
      const MIN_VECTOR_SCORE = 0.15;
      const scored = (rows as any[]).map((row) => ({ ...row, _score: parseFloat(row.vector_score) }));
      this.logger.log(`Vector scores top-5: ${scored.slice(0, 5).map(r => `${r.codeGold}=${r._score.toFixed(4)}`).join(', ')}`);
      return scored
        .filter((row) => row._score >= MIN_VECTOR_SCORE)
        .filter((row) => this.productMatchesFilters(row, filters))
        .slice(0, limit)
        .map((row) => this.toResult(
          row,
          row._score * weights.vector,
          ['vector'],
          { vectorScore: row._score },
        ));

    } catch (err) {
      const ms = Date.now() - t0;
      this.logger.warn(`Vector search failed (${ms}ms): ${err.message}`);
      this.metrics.increment('search_errors_total', { stage: 'vector' });

      this.circuit.failures++;
      if (this.circuit.failures >= this.CIRCUIT_THRESHOLD) {
        this.circuit.openUntil = Date.now() + this.CIRCUIT_RESET_MS;
        this.logger.error(`Embedding circuit OPENED — will retry in ${this.CIRCUIT_RESET_MS / 1000}s`);
        this.metrics.increment('search_circuit_tripped_total');
      }

      if (fallbackText?.trim()) {
        this.logger.log('Vector failure fallback → text search');
        return this.runTextSearch(fallbackText.trim(), limit, weights, filters);
      }
      return [];
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // Merge + Rank
  // ─────────────────────────────────────────────────────────────────

  private mergeAndRank(
    results: SearchResult[],
    weights: ScoringWeights,
    limit: number,
  ): SearchResult[] {
    const seen = new Map<string, SearchResult>();

    for (const r of results) {
      if (!seen.has(r.id)) {
        seen.set(r.id, { ...r });
      } else {
        const ex = seen.get(r.id)!;
        ex.score     = Math.min(1.0, Math.max(ex.score, r.score) + weights.multiMatchBoost);
        ex.matchedBy = [...new Set([...ex.matchedBy, ...r.matchedBy])];
        if (r.debug) ex.debug = { ...ex.debug, ...r.debug };
      }
    }

    return Array.from(seen.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.min(limit, TOP_N));
  }

  // ─────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────

  /** Sous-chaîne insensible à la casse sur les champs produit. */
  private productMatchesFilters(p: Product | Record<string, any>, filters?: ProductSearchFilters): boolean {
    if (!filters) return true;
    const need = (v?: string | null) => v != null && String(v).trim().length > 0;
    const hay  = (v?: string | null) => String(v ?? '').toLowerCase();
    if (need(filters.category)    && !hay(p.category).includes(filters.category!.trim().toLowerCase()))           return false;
    if (need(filters.subcategory) && !hay((p as any).subcategory).includes(filters.subcategory!.trim().toLowerCase())) return false;
    if (need(filters.family)      && !hay((p as any).family).includes(filters.family!.trim().toLowerCase()))      return false;
    if (need(filters.codeGold)    && !hay((p as any).codeGold).includes(filters.codeGold!.trim().toLowerCase()))  return false;
    if (need(filters.designation) && !hay((p as any).name).includes(filters.designation!.trim().toLowerCase()))   return false;
    if (need(filters.ean)         && !hay((p as any).barcode).includes(filters.ean!.trim()))                      return false;
    return true;
  }

  /** Candidats à tester pour un scan (EAN, URL produit, QR avec paramètres, etc.). */
  private barcodeLookupCandidates(raw: string): string[] {
    const out = new Set<string>();
    const trimmed = raw.trim();
    if (trimmed) out.add(trimmed);

    const digitRuns = trimmed.match(/\d{8,20}/g) ?? [];
    digitRuns.forEach((d) => out.add(d));

    try {
      const u = new URL(trimmed);
      for (const key of ['id', 'sku', 'barcode', 'gtin', 'ean', 'codeGold', 'code_gold', 'code']) {
        const v = u.searchParams.get(key)?.trim();
        if (v) out.add(v);
      }
      const parts = u.pathname.split('/').filter(Boolean);
      const last = parts[parts.length - 1];
      if (last) {
        out.add(last);
        try {
          const dec = decodeURIComponent(last);
          if (dec !== last) out.add(dec);
        } catch { /* ignore */ }
      }
    } catch {
      /* not a parseable URL */
    }

    return [...out].filter((s) => s.length > 0 && s.length <= MAX_SCAN_PAYLOAD).slice(0, 32);
  }

  private readonly uuidRe =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  private async resolveScanProduct(raw: string, filters?: ProductSearchFilters): Promise<Product | null> {
    const candidates = this.barcodeLookupCandidates(raw);
    for (const c of candidates) {
      if (this.uuidRe.test(c)) {
        const p = await this.productRepo.findOne({ where: { id: c } });
        if (p && this.productMatchesFilters(p, filters)) return p;
      }
    }
    const nonUuid = candidates.filter((c) => !this.uuidRe.test(c));
    if (!nonUuid.length) return null;
    const byBarcode = await this.productRepo.find({ where: { barcode: In(nonUuid) } });
    const hitBc = byBarcode.find((p) => this.productMatchesFilters(p, filters));
    if (hitBc) return hitBc;
    const byCodeGold = await this.productRepo.find({ where: { codeGold: In(nonUuid) } });
    return byCodeGold.find((p) => this.productMatchesFilters(p, filters)) ?? null;
  }

  private toResult(
    product: any,
    score: number,
    matchedBy: MatchMethod[],
    debug?: SearchResult['debug'],
  ): SearchResult {
    return {
      id:            product.id,
      name:          product.name,
      brand:         product.brand         ?? null,
      codeGold:      product.codeGold      ?? null,
      barcode:       product.barcode       ?? null,
      category:      product.category      ?? null,
      subcategory:   product.subcategory   ?? null,
      family:        product.family        ?? null,
      images:        product.images        ?? [],
      score:         Math.round(score * 10000) / 10000,
      matchedBy,
      debug,
    };
  }

  private async tryCache(key: string, req: SearchRequest): Promise<SearchResponse | null> {
    if (req.imageBase64) return null;
    try {
      const raw = await this.redis.get(key);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  private buildCacheKey(req: SearchRequest): string {
    const filterPart = req.filters
      ? JSON.stringify({
          c: req.filters.category ?? '',
          s: req.filters.subcategory ?? '',
          f: req.filters.family ?? '',
        })
      : '';
    const parts = [
      req.barcode?.trim() ?? '',
      req.text?.trim().toLowerCase() ?? '',
      String(req.limit ?? 20),
      filterPart,
    ].join(':');
    return `search:v4:${crypto.createHash('md5').update(parts).digest('hex')}`;
  }

  private timeout<T>(ms: number, label: string): Promise<T> {
    return new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout: ${label} exceeded ${ms}ms`)), ms),
    );
  }

  async invalidateProductCache(barcode?: string) {
    if (barcode) {
      await this.redis.del(this.buildCacheKey({ barcode })).catch(() => {});
    }
  }
}
