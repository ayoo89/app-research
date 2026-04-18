/**
 * Filtres optionnels (alignés export ERP) :
 * - category    ≈ CATEGORIE
 * - family      ≈ Famille
 * - subcategory ≈ Sous-Famille
 * - codeGold    ≈ CODE GOLD
 * - designation ≈ DESIGNATION (nom produit)
 * - ean         ≈ EAN / code-barres
 */
export interface ProductSearchFilters {
  category?: string;
  subcategory?: string;
  family?: string;
  codeGold?: string;
  designation?: string;
  ean?: string;
}

export interface SearchRequest {
  barcode?: string;
  text?: string;
  imageBase64?: string;
  /** Max results to return (default 20) */
  limit?: number;
  /** Override default scoring weights */
  weights?: Partial<ScoringWeights>;
  /** Taxonomy + ERP field filters */
  filters?: ProductSearchFilters;
}

export interface ScoringWeights {
  barcode: number;          // default 1.0
  text: number;             // default 0.75
  vector: number;           // default 0.60
  multiMatchBoost: number;  // bonus when same product matches multiple methods, default 0.15
}

export const DEFAULT_WEIGHTS: ScoringWeights = {
  barcode: 1.0,
  text: 0.75,
  vector: 0.60,
  multiMatchBoost: 0.15,
};

export interface SearchResult {
  id: string;
  name: string;
  brand: string | null;
  /** CODE GOLD ou équivalent ERP */
  codeGold: string | null;
  barcode: string | null;
  category: string | null;
  /** Sous-famille ERP */
  subcategory: string | null;
  /** Famille ERP */
  family: string | null;
  images: string[];
  score: number;           // normalised 0–1
  matchedBy: MatchMethod[];
  debug?: DebugInfo;
}

export type MatchMethod = 'barcode' | 'text' | 'vector';

export interface DebugInfo {
  textScore?: number;
  vectorScore?: number;
  rawTextRank?: number;
}

export interface SearchMeta {
  totalMs: number;
  cacheHit: boolean;
  methods: MatchMethod[];
  correlationId?: string;
}

export interface SearchResponse {
  results: SearchResult[];
  meta: SearchMeta;
}
