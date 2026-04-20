import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { SearchEvent } from './search-event.entity';

export interface SearchStats {
  totalAllTime: number;
  today: number;
  thisWeek: number;
  last7Days: number[];
  byType: { barcode: number; text: number; image: number };
  avgLatencyMs: number;
  cacheHitRate: number;
}

@Injectable()
export class SearchEventService {
  private readonly logger = new Logger(SearchEventService.name);

  constructor(
    @InjectRepository(SearchEvent) private repo: Repository<SearchEvent>,
    private dataSource: DataSource,
  ) {}

  async log(
    type: 'barcode' | 'text' | 'image',
    query: string | null,
    matchedProductId: string | null,
    latencyMs: number,
    cacheHit = false,
  ): Promise<void> {
    try {
      await this.repo.save(this.repo.create({ type, query, matchedProductId, latencyMs, cacheHit }));
    } catch (err: any) {
      this.logger.warn(`SearchEvent log failed: ${err.message}`);
    }
  }

  async getStats(): Promise<SearchStats> {
    try {
      const rows = await this.dataSource.query(`
        SELECT
          COUNT(*)::int AS "totalAllTime",
          SUM(CASE WHEN "createdAt" >= NOW() - INTERVAL '1 day' THEN 1 ELSE 0 END)::int AS today,
          SUM(CASE WHEN "createdAt" >= NOW() - INTERVAL '7 days' THEN 1 ELSE 0 END)::int AS "thisWeek",
          SUM(CASE WHEN type='barcode' THEN 1 ELSE 0 END)::int AS barcode,
          SUM(CASE WHEN type='text' THEN 1 ELSE 0 END)::int AS text,
          SUM(CASE WHEN type='image' THEN 1 ELSE 0 END)::int AS image,
          ROUND(AVG("latencyMs"))::int AS "avgLatencyMs",
          ROUND(AVG(CASE WHEN "cacheHit" THEN 1.0 ELSE 0.0 END), 4) AS "cacheHitRate"
        FROM search_events
      `);

      const day7Rows = await this.dataSource.query(`
        SELECT
          DATE_TRUNC('day', "createdAt") AS day,
          COUNT(*)::int AS cnt
        FROM search_events
        WHERE "createdAt" >= NOW() - INTERVAL '7 days'
        GROUP BY day
        ORDER BY day ASC
      `);

      const last7Days: number[] = Array(7).fill(0);
      const now = new Date();
      for (const r of day7Rows) {
        const dayAgo = Math.floor((now.getTime() - new Date(r.day).getTime()) / 86_400_000);
        const idx = 6 - Math.min(dayAgo, 6);
        last7Days[idx] = r.cnt;
      }

      const r = rows[0] ?? {};
      return {
        totalAllTime: r.totalAllTime ?? 0,
        today: r.today ?? 0,
        thisWeek: r.thisWeek ?? 0,
        last7Days,
        byType: { barcode: r.barcode ?? 0, text: r.text ?? 0, image: r.image ?? 0 },
        avgLatencyMs: r.avgLatencyMs ?? 0,
        cacheHitRate: parseFloat(r.cacheHitRate ?? '0'),
      };
    } catch (err: any) {
      this.logger.warn(`SearchEvent getStats failed: ${err.message}`);
      return {
        totalAllTime: 0, today: 0, thisWeek: 0, last7Days: Array(7).fill(0),
        byType: { barcode: 0, text: 0, image: 0 }, avgLatencyMs: 0, cacheHitRate: 0,
      };
    }
  }
}
