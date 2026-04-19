import { Processor, Process, OnQueueFailed, OnQueueStalled } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './product.entity';
import { EmbeddingService } from './embedding.service';
import { MetricsService } from '../common/metrics.service';
import { EMBEDDING_VERSION } from '../reindex/reindex.service';

@Processor('embedding')
export class EmbeddingProcessor {
  private readonly logger = new Logger(EmbeddingProcessor.name);

  constructor(
    @InjectRepository(Product) private productRepo: Repository<Product>,
    private embeddingService: EmbeddingService,
    private metrics: MetricsService,
  ) {}

  @Process({ name: 'generate', concurrency: 4 })
  async handleGenerate(job: Job<{ productId: string; embeddingVersion?: number }>) {
    const { productId, embeddingVersion = EMBEDDING_VERSION } = job.data;
    const t0 = Date.now();

    const product = await this.productRepo.findOne({ where: { id: productId } });
    if (!product) {
      this.logger.warn(`Product ${productId} not found — skipping`);
      return { skipped: true };
    }

    const text = [
      product.name,
      product.brand,
      product.description,
      product.category,
      product.family,
      product.subcategory,
      product.barcode,
      product.codeGold,
    ].filter(Boolean).join(' ');

    const firstImage = product.images?.[0];
    let embedding: number[];

    // Only use image embedding for inline base64 data URIs — not remote URLs
    if (firstImage && firstImage.startsWith('data:image/') && firstImage.includes(',')) {
      const base64 = firstImage.split(',')[1];
      if (base64) {
        embedding = await this.embeddingService.generateHybridEmbedding({
          text,
          imageBase64: base64,
          textWeight: 0.6,
        });
      } else {
        embedding = await this.embeddingService.generateTextEmbedding(text);
      }
    } else {
      embedding = await this.embeddingService.generateTextEmbedding(text);
    }

    await this.productRepo.update(productId, {
      embeddingVector: embedding,
      embeddingGenerated: true,
      metadata: {
        ...(typeof product.metadata === 'object' && product.metadata !== null ? product.metadata as object : {}),
        embeddingVersion,
        embeddingGeneratedAt: new Date().toISOString(),
      } as any,
    });

    const ms = Date.now() - t0;
    this.metrics.observe('embedding_generation_ms', ms);
    this.metrics.increment('embedding_generated_total');
    this.logger.log(`Embedding v${embeddingVersion} for ${productId} in ${ms}ms`);

    return { productId, ms, embeddingVersion };
  }

  @OnQueueFailed()
  onFailed(job: Job, err: Error) {
    this.metrics.increment('embedding_failed_total');
    this.logger.error(
      JSON.stringify({
        event:        'embedding_failed',
        productId:    job.data.productId,
        attempt:      job.attemptsMade,
        maxAttempts:  job.opts.attempts,
        error:        err.message,
        // After max attempts, job stays in failed state (dead-letter)
        deadLettered: job.attemptsMade >= (job.opts.attempts ?? 5),
      }),
    );
  }

  @OnQueueStalled()
  onStalled(job: Job) {
    this.logger.warn(`Stalled job: ${job.id} product=${job.data.productId}`);
    this.metrics.increment('embedding_stalled_total');
  }
}
