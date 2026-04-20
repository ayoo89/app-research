import { apiClient } from './client';
import * as ImageManipulator from 'expo-image-manipulator';

export type MatchMethod = 'barcode' | 'text' | 'vector';

export interface SearchFilters {
  category?: string;
  subcategory?: string;
  family?: string;
  codeGold?: string;
  designation?: string;
  ean?: string;
}

export interface SearchResult {
  id: string;
  name: string;
  brand: string | null;
  codeGold: string | null;
  barcode: string | null;
  category: string | null;
  subcategory: string | null;
  family: string | null;
  images: string[];
  score: number;
  matchedBy: MatchMethod[];
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
  price: number | null;
  stock: number | null;
  createdAt: string;
}

function filtersBody(filters?: SearchFilters): { filters?: Record<string, string> } {
  if (!filters) return {};
  const out: Record<string, string> = {};
  const entries: [string, string | undefined][] = [
    ['category',    filters.category],
    ['subcategory', filters.subcategory],
    ['family',      filters.family],
    ['codeGold',    filters.codeGold],
    ['designation', filters.designation],
    ['ean',         filters.ean],
  ];
  for (const [k, v] of entries) {
    const s = v?.trim();
    if (s) out[k] = s;
  }
  return Object.keys(out).length ? { filters: out } : {};
}

async function imageToBase64(imagePath: string): Promise<string> {
  // Resize to 512px wide, keeping aspect ratio — CLIP handles non-square internally
  const result = await ImageManipulator.manipulateAsync(
    imagePath,
    [{ resize: { width: 512 } }],
    { compress: 0.82, format: ImageManipulator.SaveFormat.JPEG, base64: true },
  );
  if (!result.base64) throw new Error('Image encoding failed');
  return result.base64;
}

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
  const imageBase64 = await imageToBase64(imagePath);
  const { data } = await apiClient.post<SearchResponse>('/search', {
    imageBase64,
    ...filtersBody(filters),
  });
  return normalise(data);
}

export async function searchHybrid(
  text: string,
  imagePath: string,
  filters?: SearchFilters,
): Promise<SearchResponse> {
  const imageBase64 = await imageToBase64(imagePath);
  const { data } = await apiClient.post<SearchResponse>('/search', {
    text,
    imageBase64,
    ...filtersBody(filters),
  });
  return normalise(data);
}

export async function getProduct(id: string): Promise<Product> {
  const { data } = await apiClient.get<Product>(`/products/${id}`);
  return data;
}

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
