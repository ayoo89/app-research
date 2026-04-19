import { Injectable, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Product } from './product.entity';
import { SearchService } from '../search/search.service';
import { TaxonomyService } from '../taxonomy/taxonomy.service';
import { TaxonomyType } from '../taxonomy/taxonomy.entity';

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(Product) private repo: Repository<Product>,
    @InjectQueue('embedding') private embeddingQueue: Queue,
    @Inject(forwardRef(() => SearchService)) private searchService: SearchService,
    private taxonomyService: TaxonomyService,
  ) {}

  findAll(page = 1, limit = 20) {
    return this.repo.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });
  }

  async getDistinctValues(field: 'category' | 'family' | 'subcategory'): Promise<string[]> {
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
    return merged;
  }

  findById(id: string) {
    return this.repo.findOne({ where: { id } });
  }

  findByBarcode(barcode: string) {
    return this.repo.findOne({ where: { barcode } });
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

  async create(data: Partial<Product>) {
    const product = this.repo.create(data);
    const saved = await this.repo.save(product);
    await this.embeddingQueue.add('generate', { productId: saved.id });
    return saved;
  }

  async update(id: string, data: Partial<Product>) {
    const product = await this.findById(id);
    if (!product) throw new NotFoundException('Product not found');
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
    const codeGolds = products.map((p) => p.codeGold).filter(Boolean) as string[];
    const existing = codeGolds.length > 0
      ? await this.repo.find({ where: { codeGold: In(codeGolds) }, select: ['id', 'codeGold'] })
      : [];
    const existingByCode = new Map(existing.map((p) => [p.codeGold, p.id]));

    const toCreate: Partial<Product>[] = [];
    const toUpdate: Array<{ id: string; data: Partial<Product> }> = [];

    for (const p of products) {
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
