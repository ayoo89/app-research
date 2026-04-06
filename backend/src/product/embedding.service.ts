import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

export interface VectorHit {
  id: string;
  score: number;
}

export interface HybridEmbedRequest {
  text?: string;
  imageBase64?: string;
  /** Weight for text embedding in hybrid fusion (0–1, default 0.5) */
  textWeight?: number;
}

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly http: AxiosInstance;

  constructor(private config: ConfigService) {
    const baseURL = config.get('EMBEDDING_SERVICE_URL', 'http://localhost:8000');
    this.http = axios.create({ baseURL, timeout: 8000 });
  }

  /** Text embedding via MiniLM */
  async generateTextEmbedding(text: string): Promise<number[]> {
    const { data } = await this.http.post('/embed/text', { text });
    return data.embedding;
  }

  /** Image embedding via CLIP */
  async generateImageEmbedding(imageBase64: string): Promise<number[]> {
    const { data } = await this.http.post('/embed/image', { image: imageBase64 }, { timeout: 12000 });
    return data.embedding;
  }

  /**
   * Hybrid embedding: fuse text + image embeddings when both are available.
   * Uses weighted average in the shared CLIP embedding space.
   */
  async generateHybridEmbedding(req: HybridEmbedRequest): Promise<number[]> {
    const textWeight = req.textWeight ?? 0.5;
    const imageWeight = 1 - textWeight;

    if (req.text && req.imageBase64) {
      const [textEmbed, imageEmbed] = await Promise.all([
        this.generateTextEmbedding(req.text),
        this.generateImageEmbedding(req.imageBase64),
      ]);
      return this.fuseEmbeddings(textEmbed, imageEmbed, textWeight, imageWeight);
    }

    if (req.imageBase64) return this.generateImageEmbedding(req.imageBase64);
    if (req.text) return this.generateTextEmbedding(req.text);
    throw new Error('HybridEmbedRequest requires at least text or imageBase64');
  }

  /**
   * KNN vector search via Elasticsearch.
   * Returns hits sorted by cosine similarity (highest first).
   */
  async vectorSearch(
    embedding: number[],
    limit = 20,
    minScore = 0.5,
  ): Promise<VectorHit[]> {
    try {
      const { data } = await this.http.post(
        '/search/vector',
        { embedding, limit, min_score: minScore },
        { timeout: 3000 },
      );
      return data.results;
    } catch (err) {
      this.logger.warn(`Vector search failed: ${err.message}`);
      return [];
    }
  }

  /** Index a product's embedding in Elasticsearch */
  async indexProduct(
    productId: string,
    embedding: number[],
    metadata: Record<string, any>,
  ): Promise<void> {
    try {
      await this.http.post('/index', { id: productId, embedding, metadata });
    } catch (err) {
      this.logger.error(`Index failed for ${productId}: ${err.message}`);
      throw err;
    }
  }

  /** Remove a product from the vector index */
  async deleteFromIndex(productId: string): Promise<void> {
    try {
      await this.http.delete(`/index/${productId}`);
    } catch (err) {
      this.logger.warn(`Delete from index failed for ${productId}: ${err.message}`);
    }
  }

  // ── Weighted average fusion ──────────────────────────────────────
  private fuseEmbeddings(
    a: number[],
    b: number[],
    wA: number,
    wB: number,
  ): number[] {
    const fused = a.map((v, i) => v * wA + b[i] * wB);
    return this.l2Normalize(fused);
  }

  private l2Normalize(vec: number[]): number[] {
    const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
    return norm === 0 ? vec : vec.map((v) => v / norm);
  }
}
