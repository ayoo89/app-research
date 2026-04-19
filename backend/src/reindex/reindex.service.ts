import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Product } from '../product/product.entity';

// Bump this when the embedding model changes — triggers automatic re-indexing
export const EMBEDDING_VERSION = 4; // v4: switched to CLIP text embeddings for image search compatibility

@Injectable()
export class ReindexService {
  private readonly logger = new Logger(ReindexService.name);

  constructor(
    @InjectRepository(Product) private productRepo: Repository<Product>,
    @InjectQueue('embedding') private embeddingQueue: Queue,
  ) {}

  /**
   * Full reindex: queue every product that doesn't have the current embedding version.
   * Safe to run while the system is live — jobs are idempotent.
   */
  async fullReindex(): Promise<{ queued: number }> {
    this.logger.log(`Starting full reindex (embedding v${EMBEDDING_VERSION})`);

    // Process in batches to avoid loading millions of rows into memory
    const BATCH = 500;
    let offset  = 0;
    let queued  = 0;

    while (true) {
      const products = await this.productRepo.find({
        select: ['id'],
        skip: offset,
        take: BATCH,
        order: { createdAt: 'ASC' },
      });

      if (!products.length) break;

      const jobs = products.map((p) => ({
        name: 'generate',
        data: { productId: p.id, embeddingVersion: EMBEDDING_VERSION },
      }));

      await this.embeddingQueue.addBulk(jobs);
      queued  += products.length;
      offset  += BATCH;

      this.logger.log(`Reindex progress: ${queued} queued`);
    }

    this.logger.log(`Full reindex complete: ${queued} products queued`);
    return { queued };
  }

  /**
   * Partial reindex: only products with missing or stale embeddings.
   */
  async partialReindex(): Promise<{ queued: number }> {
    const products = await this.productRepo.find({
      select: ['id'],
      where: { embeddingGenerated: false },
    });

    if (!products.length) {
      this.logger.log('Partial reindex: nothing to do');
      return { queued: 0 };
    }

    const jobs = products.map((p) => ({
      name: 'generate',
      data: { productId: p.id, embeddingVersion: EMBEDDING_VERSION },
    }));

    await this.embeddingQueue.addBulk(jobs);
    this.logger.log(`Partial reindex: ${products.length} products queued`);
    return { queued: products.length };
  }

  /**
   * Reindex a specific category.
   */
  async reindexCategory(category: string): Promise<{ queued: number }> {
    const products = await this.productRepo.find({
      select: ['id'],
      where: { category },
    });

    const jobs = products.map((p) => ({
      name: 'generate',
      data: { productId: p.id, embeddingVersion: EMBEDDING_VERSION },
    }));

    if (jobs.length) await this.embeddingQueue.addBulk(jobs);
    this.logger.log(`Category reindex [${category}]: ${jobs.length} queued`);
    return { queued: jobs.length };
  }

  async queueStatus() {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.embeddingQueue.getWaitingCount(),
      this.embeddingQueue.getActiveCount(),
      this.embeddingQueue.getCompletedCount(),
      this.embeddingQueue.getFailedCount(),
      this.embeddingQueue.getDelayedCount(),
    ]);
    return { waiting, active, completed, failed, delayed };
  }

  async getFailedJobs(limit = 50) {
    const jobs = await this.embeddingQueue.getFailed(0, limit - 1);
    return jobs.map((j) => ({
      id:          j.id,
      productId:   j.data.productId,
      failedReason: j.failedReason,
      attemptsMade: j.attemptsMade,
      timestamp:   j.timestamp,
    }));
  }

  async retryFailed() {
    const failed = await this.embeddingQueue.getFailed(0, 999);
    await Promise.all(failed.map((j) => j.retry()));
    return { retried: failed.length };
  }
}
