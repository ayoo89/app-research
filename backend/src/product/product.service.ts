import { Injectable, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Product } from './product.entity';
import { SearchService } from '../search/search.service';
import { TaxonomyService } from '../taxonomy/taxonomy.service';
import { TaxonomyType } from '../taxonomy/taxonomy.entity';
import { HierarchyService } from '../hierarchy/hierarchy.service';
import { REDIS_CLIENT } from '../search/cache.module';

const CATALOGUE_TTL = 300; // 5 min

@Injectable()
export class ProductService {
  private readonly distinctCache = new Map<string, { values: string[]; ts: number }>();
  private readonly DISTINCT_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(
    @InjectRepository(Product) private repo: Repository<Product>,
    @InjectQueue('embedding') private embeddingQueue: Queue,
    @Inject(forwardRef(() => SearchService)) private searchService: SearchService,
    private taxonomyService: TaxonomyService,
    private hierarchyService: HierarchyService,
    @Inject(REDIS_CLIENT) private redis: any,
  ) {}

  /** Look up the CategoryEntity id matching the given category/subcategory/family strings. */
  private async resolveCategoryId(
    category?: string,
    subcategory?: string,
    family?: string,
  ): Promise<string | null> {
    if (!category?.trim()) return null;
    try {
      const cats = await this.hierarchyService.listCategories();
      const match = cats.find((c) => {
        const nameMatch = c.name.toLowerCase() === category.trim().toLowerCase();
        const sfMatch = !subcategory?.trim() || c.subFamilyName?.toLowerCase() === subcategory.trim().toLowerCase();
        const famMatch = !family?.trim() || c.familyName?.toLowerCase() === family.trim().toLowerCase();
        return nameMatch && sfMatch && famMatch;
      });
      return match?.id ?? null;
    } catch {
      return null;
    }
  }

  /** Resolve relative image paths to absolute URLs using IMAGE_BASE_URL env var. */
  private resolveImageUrls(images: string[]): string[] {
    if (!images || images.length === 0) return images;
    const base = (process.env.IMAGE_BASE_URL ?? 'https://productsearch-api.onrender.com').replace(/\/$/, '');
    return images.map((img) => {
      if (!img) return img;
      if (img.startsWith('http')) return img;
      // Strip leading slash before prepending base
      const path = img.startsWith('/') ? img.slice(1) : img;
      return `${base}/${path}`;
    });
  }

  private resolveProductImages<T extends { images?: string[] | null }>(product: T): T {
    if (product && product.images) {
      product.images = this.resolveImageUrls(product.images);
    }
    return product;
  }

  async findAll(page = 1, limit = 20, search?: string, family?: string, subcategory?: string, category?: string) {
    // Redis cache for unfiltered pages (search/filter queries are not cached)
    const isFiltered = !!(search?.trim() || family?.trim() || subcategory?.trim() || category?.trim());
    const cacheKey = `catalogue:page:${page}:${limit}`;
    if (!isFiltered) {
      try {
        const cached = await this.redis.get(cacheKey);
        if (cached) return JSON.parse(cached) as [Product[], number];
      } catch { /* ignore cache errors */ }
    }

    const qb = this.repo.createQueryBuilder('p')
      .orderBy('p.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const conditions: string[] = [];
    const params: Record<string, string> = {};

    if (search?.trim()) {
      const q = `%${search.trim().toLowerCase()}%`;
      conditions.push(
        `(LOWER(p.name) LIKE :q OR LOWER(COALESCE(p.codeGold,'')) LIKE :q OR LOWER(COALESCE(p.brand,'')) LIKE :q OR LOWER(COALESCE(p.barcode,'')) LIKE :q)`,
      );
      params.q = q;
    }
    if (family?.trim()) {
      conditions.push(`LOWER(COALESCE(p.family,'')) = LOWER(:family)`);
      params.family = family.trim();
    }
    if (subcategory?.trim()) {
      conditions.push(`LOWER(COALESCE(p.subcategory,'')) = LOWER(:subcategory)`);
      params.subcategory = subcategory.trim();
    }
    if (category?.trim()) {
      conditions.push(`LOWER(COALESCE(p.category,'')) = LOWER(:category)`);
      params.category = category.trim();
    }

    if (conditions.length > 0) {
      qb.where(conditions.join(' AND '), params);
    }

    const [products, count] = await qb.getManyAndCount();
    const result = [products.map((p) => this.resolveProductImages(p)), count] as [Product[], number];

    // Cache unfiltered pages
    if (!isFiltered) {
      this.redis.setex(cacheKey, CATALOGUE_TTL, JSON.stringify(result)).catch(() => {});
    }
    return result;
  }

  async getDistinctValues(field: 'category' | 'family' | 'subcategory'): Promise<string[]> {
    const hit = this.distinctCache.get(field);
    if (hit && Date.now() - hit.ts < this.DISTINCT_TTL) return hit.values;

    const typeMap: Record<string, TaxonomyType> = {
      category: 'category', family: 'family', subcategory: 'subcategory',
    };
    const [rows, taxonomyNames] = await Promise.all([
      this.repo.createQueryBuilder('p')
        .select(`DISTINCT p.${field}`, 'value')
        .where(`p.${field} IS NOT NULL AND p.${field} != ''`)
        .orderBy('value', 'ASC')
        .getRawMany(),
      this.taxonomyService.getNames(typeMap[field]),
    ]);
    const fromProducts = rows.map((r: any) => r.value).filter(Boolean) as string[];
    const merged = Array.from(new Set([...fromProducts, ...taxonomyNames])).sort();
    this.distinctCache.set(field, { values: merged, ts: Date.now() });
    return merged;
  }

  invalidateDistinctCache() {
    this.distinctCache.clear();
  }

  async findById(id: string) {
    const product = await this.repo.findOne({ where: { id } });
    return product ? this.resolveProductImages(product) : null;
  }

  async findByBarcode(barcode: string) {
    const product = await this.repo.findOne({ where: { barcode } });
    return product ? this.resolveProductImages(product) : null;
  }

  /**
   * Full-text + trigram search.
   * Moved to raw SQL in SearchService for full control over ranking.
   * Kept here as a lightweight fallback for internal use.
   */
  textSearch(query: string, limit = 20) {
    return this.repo.query(
      `
      SELECT p.*,
        ts_rank_cd(
          to_tsvector('english', p.name || ' ' || COALESCE(p.brand,'') || ' ' || COALESCE(p.description,'')),
          websearch_to_tsquery('english', $1), 32
        ) AS fts_rank
      FROM products p
      WHERE
        to_tsvector('english', p.name || ' ' || COALESCE(p.brand,'') || ' ' || COALESCE(p.description,''))
          @@ websearch_to_tsquery('english', $1)
        OR similarity(p.name, $1) > 0.2
      ORDER BY fts_rank DESC, similarity(p.name, $1) DESC
      LIMIT $2
      `,
      [query, limit],
    );
  }

  private async invalidateCatalogueCache(): Promise<void> {
    try {
      const keys = await this.redis.keys('catalogue:*');
      if (keys.length > 0) await this.redis.del(...keys);
    } catch { /* ignore */ }
  }

  async create(data: Partial<Product>) {
    const categoryId = await this.resolveCategoryId(data.category, data.subcategory, data.family);
    const product = this.repo.create({ ...data, ...(categoryId ? { categoryId } : {}) });
    const saved = await this.repo.save(product);
    await this.embeddingQueue.add('generate', { productId: saved.id });
    this.invalidateDistinctCache();
    await this.invalidateCatalogueCache();
    return saved;
  }

  async update(id: string, data: Partial<Product>) {
    const product = await this.findById(id);
    if (!product) throw new NotFoundException('Product not found');
    if (data.category !== undefined || data.subcategory !== undefined || data.family !== undefined) {
      const categoryId = await this.resolveCategoryId(
        data.category ?? product.category,
        data.subcategory ?? product.subcategory,
        data.family ?? product.family,
      );
      if (categoryId !== null) data = { ...data, categoryId };
    }
    Object.assign(product, data);
    const saved = await this.repo.save(product);
    if (data.name || data.description || data.images) {
      await this.embeddingQueue.add('generate', { productId: saved.id });
    }
    // Invalidate search cache for this product's barcode
    await this.searchService.invalidateProductCache(saved.barcode ?? undefined);
    return saved;
  }

  async remove(id: string) {
    const product = await this.findById(id);
    if (!product) throw new NotFoundException('Product not found');
    await this.searchService.invalidateProductCache(product.barcode ?? undefined);
    await this.repo.remove(product);
    this.invalidateDistinctCache();
  }

  async saveEmbedding(id: string, vector: number[]) {
    await this.repo.update(id, { embeddingVector: vector, embeddingGenerated: true });
  }

  async triggerEmbedding(id: string) {
    await this.embeddingQueue.add('generate', { productId: id });
  }

  async bulkCreate(products: Partial<Product>[]) {
    const saved = await this.repo.save(this.repo.create(products as Product[]));
    for (const p of saved) {
      await this.embeddingQueue.add('generate', { productId: p.id });
    }
    return saved;
  }

  /** Upsert by codeGold: update if exists, create if not. Returns all affected rows. */
  async bulkUpsert(products: Partial<Product>[]): Promise<Array<{ id: string; codeGold: string | null; name: string }>> {
    // Resolve any relative image paths to absolute URLs before persisting
    const resolvedProducts = products.map((p) =>
      p.images ? { ...p, images: this.resolveImageUrls(p.images) } : p,
    );

    // Resolve categoryId for each product
    const withCategoryIds = await Promise.all(
      resolvedProducts.map(async (p) => {
        const categoryId = await this.resolveCategoryId(p.category, p.subcategory, p.family);
        return categoryId ? { ...p, categoryId } : p;
      }),
    );

    const codeGolds = withCategoryIds.map((p) => p.codeGold).filter(Boolean) as string[];
    const existing = codeGolds.length > 0
      ? await this.repo.find({ where: { codeGold: In(codeGolds) }, select: ['id', 'codeGold'] })
      : [];
    const existingByCode = new Map(existing.map((p) => [p.codeGold, p.id]));

    const toCreate: Partial<Product>[] = [];
    const toUpdate: Array<{ id: string; data: Partial<Product> }> = [];

    for (const p of withCategoryIds) {
      const existingId = p.codeGold ? existingByCode.get(p.codeGold) : undefined;
      if (existingId) {
        toUpdate.push({ id: existingId, data: p });
      } else {
        toCreate.push(p);
      }
    }

    const results: Array<{ id: string; codeGold: string | null; name: string }> = [];

    if (toCreate.length > 0) {
      const created = await this.repo.save(this.repo.create(toCreate as Product[]));
      for (const p of created) {
        await this.embeddingQueue.add('generate', { productId: p.id });
        results.push({ id: p.id, codeGold: p.codeGold ?? null, name: p.name });
      }
    }

    for (const { id, data } of toUpdate) {
      await this.repo.update(id, data);
      await this.embeddingQueue.add('generate', { productId: id });
      results.push({ id, codeGold: data.codeGold ?? null, name: data.name ?? '' });
    }

    return results;
  }
}
