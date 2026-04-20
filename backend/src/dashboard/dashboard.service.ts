import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import Redis from 'ioredis';
import { Product } from '../product/product.entity';
import { User } from '../user/user.entity';
import { SearchEventService } from './search-event.service';
import { REDIS_CLIENT } from '../search/cache.module';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    @InjectRepository(Product) private productRepo: Repository<Product>,
    @InjectRepository(User) private userRepo: Repository<User>,
    private searchEventService: SearchEventService,
    private dataSource: DataSource,
    @Inject(REDIS_CLIENT) private redis: Redis,
  ) {}

  async getStats() {
    const [dbStats, searchStats, topProducts, reindexStats] = await Promise.all([
      this.getDatabaseStats(),
      this.searchEventService.getStats(),
      this.getTopProducts(),
      this.getReindexStats(),
    ]);

    return {
      database: dbStats,
      search: {
        totalSearchesAllTime: searchStats.totalAllTime,
        searchesToday: searchStats.today,
        searchesThisWeek: searchStats.thisWeek,
        byType: searchStats.byType,
        searchesLast7Days: searchStats.last7Days,
        avgLatencyMs: searchStats.avgLatencyMs,
        cacheHitRate: searchStats.cacheHitRate,
      },
      topProducts,
      reindex: reindexStats,
      imports: await this.getImportStats(),
    };
  }

  private async getDatabaseStats() {
    try {
      const rows = await this.dataSource.query(`
        SELECT
          (SELECT COUNT(*)::int FROM products) AS "totalProducts",
          (SELECT COUNT(*)::int FROM families) AS "totalFamilies",
          (SELECT COUNT(*)::int FROM sub_families) AS "totalSubFamilies",
          (SELECT COUNT(*)::int FROM product_categories) AS "totalCategories",
          (SELECT COUNT(*)::int FROM users) AS "totalUsers",
          (SELECT COUNT(*)::int FROM users WHERE role IN ('admin','super_admin')) AS "totalAdmins"
      `);
      return rows[0] ?? {};
    } catch {
      const [totalProducts, totalUsers] = await Promise.all([
        this.productRepo.count(),
        this.userRepo.count(),
      ]);
      return {
        totalProducts, totalFamilies: 0, totalSubFamilies: 0,
        totalCategories: 0, totalUsers, totalAdmins: 0,
      };
    }
  }

  private async getTopProducts(): Promise<Array<{ id: string; name: string; searchCount: number; image: string | null }>> {
    try {
      const raw = await this.redis.zrevrange('top_products', 0, 9, 'WITHSCORES');
      if (!raw.length) return [];
      const pairs: Array<{ id: string; score: number }> = [];
      for (let i = 0; i < raw.length; i += 2) {
        pairs.push({ id: raw[i], score: parseInt(raw[i + 1]) });
      }
      const products = await this.productRepo.find({ where: { id: In(pairs.map((p) => p.id)) } });
      return pairs.map(({ id, score }) => {
        const p = products.find((pr) => pr.id === id);
        return { id, name: p?.name ?? 'Unknown', searchCount: score, image: p?.images?.[0] ?? null };
      });
    } catch (err: any) {
      this.logger.warn(`getTopProducts Redis error: ${err.message}`);
      return [];
    }
  }

  private async getReindexStats() {
    try {
      const pendingCount = await this.productRepo.count({ where: { embeddingGenerated: false } });
      const totalIndexed = await this.productRepo.count({ where: { embeddingGenerated: true } });
      const lastReindex = await this.redis.get('reindex:last_full_at').catch(() => null);
      return {
        lastFullReindexAt: lastReindex ?? null,
        pendingEmbeddings: pendingCount,
        totalIndexed,
      };
    } catch {
      return { lastFullReindexAt: null, pendingEmbeddings: 0, totalIndexed: 0 };
    }
  }

  private async getImportStats() {
    try {
      const importStats = await this.redis.hgetall('import:last').catch(() => null);
      return {
        totalImported: importStats?.totalImported ? parseInt(importStats.totalImported) : 0,
        lastImportAt: importStats?.lastImportAt ?? null,
        lastImportRows: importStats?.lastImportRows ? parseInt(importStats.lastImportRows) : 0,
        lastImportSuccessRate: importStats?.lastImportSuccessRate ? parseFloat(importStats.lastImportSuccessRate) : 0,
      };
    } catch {
      return { totalImported: 0, lastImportAt: null, lastImportRows: 0, lastImportSuccessRate: 0 };
    }
  }
}
