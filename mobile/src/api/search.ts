import { apiClient } from './client';
import ImageResizer from 'react-native-image-resizer';
import RNFS from 'react-native-fs';

export type MatchMethod = 'barcode' | 'text' | 'vector';

/**
 * Filtres optionnels — alignés ERP :
 * `category` (CATEGORIE), `family` (Famille), `subcategory` (Sous-Famille).
 */
export interface SearchFilters {
  category?: string;
  subcategory?: string;
  family?: string;
}

export interface SearchResult {
  id: string;
  name: string;
  brand: string | null;
  codeGold: string | null;
  barcode: string | null;
  category: string | null;
  /** Sous-famille ERP (ex. Sous-Famille) */
  subcategory: string | null;
  /** Famille ERP */
  family: string | null;
  images: string[];
  score: number;
  matchedBy: MatchMethod[];
  // legacy compat
  matchType?: MatchMethod;
}

export interface SearchMeta {
  totalMs: number;
  cacheHit: boolean;
  methods: MatchMethod[];
}

export interface SearchResponse {
  results: SearchResult[];
  meta: SearchMeta;
}

export interface Product {
  id: string;
  name: string;
  brand: string | null;
  codeGold: string | null;
  barcode: string | null;
  description: string | null;
  category: string | null;
  subcategory: string | null;
  family: string | null;
  images: string[];
  createdAt: string;
}

function filtersBody(filters?: SearchFilters): { filters?: Record<string, string> } {
  if (!filters) return {};
  const out: Record<string, string> = {};
  const c = filters.category?.trim();
  const s = filters.subcategory?.trim();
  const f = filters.family?.trim();
  if (c) out.category = c;
  if (s) out.subcategory = s;
  if (f) out.family = f;
  return Object.keys(out).length ? { filters: out } : {};
}

// ── Search ────────────────────────────────────────────────────────────────────

export async function searchByBarcode(
  barcode: string,
  filters?: SearchFilters,
): Promise<SearchResponse> {
  const { data } = await apiClient.post<SearchResponse>('/search', {
    barcode,
    ...filtersBody(filters),
  });
  return normalise(data);
}

export async function searchByText(
  text: string,
  limit = 20,
  filters?: SearchFilters,
): Promise<SearchResponse> {
  const { data } = await apiClient.post<SearchResponse>('/search', {
    text,
    limit,
    ...filtersBody(filters),
  });
  return normalise(data);
}

export async function searchByImage(
  imagePath: string,
  filters?: SearchFilters,
): Promise<SearchResponse> {
  const resized = await ImageResizer.createResizedImage(imagePath, 512, 512, 'JPEG', 75, 0);
  const base64 = await RNFS.readFile(resized.uri, 'base64');
  const { data } = await apiClient.post<SearchResponse>('/search', {
    imageBase64: base64,
    ...filtersBody(filters),
  });
  return normalise(data);
}

export async function searchHybrid(
  text: string,
  imagePath: string,
  filters?: SearchFilters,
): Promise<SearchResponse> {
  const resized = await ImageResizer.createResizedImage(imagePath, 512, 512, 'JPEG', 75, 0);
  const base64 = await RNFS.readFile(resized.uri, 'base64');
  const { data } = await apiClient.post<SearchResponse>('/search', {
    text,
    imageBase64: base64,
    ...filtersBody(filters),
  });
  return normalise(data);
}

export async function getProduct(id: string): Promise<Product> {
  const { data } = await apiClient.get<Product>(`/products/${id}`);
  return data;
}

// ── Normalise legacy shape ────────────────────────────────────────────────────
function normaliseRow(r: any): SearchResult {
  return {
    ...r,
    codeGold: r.codeGold ?? null,
    subcategory: r.subcategory ?? null,
    family: r.family ?? null,
    matchedBy: r.matchedBy ?? (r.matchType ? [r.matchType] : []),
  };
}

function normalise(data: any): SearchResponse {
  if (Array.isArray(data)) {
    return {
      results: data.map(normaliseRow),
      meta: { totalMs: 0, cacheHit: false, methods: [] },
    };
  }
  return {
    ...data,
    results: (data.results ?? []).map(normaliseRow),
  };
}
