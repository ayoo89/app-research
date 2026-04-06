import { apiClient } from './client';
import ImageResizer from 'react-native-image-resizer';
import RNFS from 'react-native-fs';

export type MatchMethod = 'barcode' | 'text' | 'vector';

export interface SearchResult {
  id: string;
  name: string;
  brand: string | null;
  barcode: string | null;
  category: string | null;
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
  barcode: string | null;
  description: string | null;
  category: string | null;
  images: string[];
  createdAt: string;
}

// ── Search ────────────────────────────────────────────────────────────────────

export async function searchByBarcode(barcode: string): Promise<SearchResponse> {
  const { data } = await apiClient.post<SearchResponse>('/search', { barcode });
  return normalise(data);
}

export async function searchByText(text: string, limit = 20): Promise<SearchResponse> {
  const { data } = await apiClient.post<SearchResponse>('/search', { text, limit });
  return normalise(data);
}

export async function searchByImage(imagePath: string): Promise<SearchResponse> {
  // Compress to 512×512 JPEG at 75% quality before sending
  const resized = await ImageResizer.createResizedImage(imagePath, 512, 512, 'JPEG', 75, 0);
  const base64  = await RNFS.readFile(resized.uri, 'base64');
  const { data } = await apiClient.post<SearchResponse>('/search', { imageBase64: base64 });
  return normalise(data);
}

export async function searchHybrid(text: string, imagePath: string): Promise<SearchResponse> {
  const resized = await ImageResizer.createResizedImage(imagePath, 512, 512, 'JPEG', 75, 0);
  const base64  = await RNFS.readFile(resized.uri, 'base64');
  const { data } = await apiClient.post<SearchResponse>('/search', { text, imageBase64: base64 });
  return normalise(data);
}

export async function getProduct(id: string): Promise<Product> {
  const { data } = await apiClient.get<Product>(`/products/${id}`);
  return data;
}

// ── Normalise legacy shape ────────────────────────────────────────────────────
// Backend v1 returned { results: [], matchType } — v2 returns { results, meta }
function normalise(data: any): SearchResponse {
  if (Array.isArray(data)) {
    // Old shape — wrap it
    return {
      results: data.map((r: any) => ({
        ...r,
        matchedBy: r.matchedBy ?? (r.matchType ? [r.matchType] : []),
      })),
      meta: { totalMs: 0, cacheHit: false, methods: [] },
    };
  }
  return {
    ...data,
    results: (data.results ?? []).map((r: any) => ({
      ...r,
      matchedBy: r.matchedBy ?? (r.matchType ? [r.matchType] : []),
    })),
  };
}
