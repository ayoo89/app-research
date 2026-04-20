import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient, BASE_URL } from './client';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export type UserRole = 'super_admin' | 'admin' | 'user';

export interface AppUser {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
}

export async function listUsers(): Promise<AppUser[]> {
  const { data } = await apiClient.get<AppUser[]>('/admin/users');
  return data;
}

export async function inviteUser(payload: {
  email: string;
  name: string;
  role: UserRole;
}): Promise<void> {
  await apiClient.post('/admin/users/invite', payload);
}

export async function resetUserPassword(id: string): Promise<void> {
  await apiClient.post(`/admin/users/${id}/reset-password`);
}

export async function deleteUser(id: string): Promise<void> {
  await apiClient.delete(`/admin/users/${id}`);
}

export async function updateUser(id: string, payload: { isActive?: boolean; role?: UserRole; name?: string }): Promise<AppUser> {
  const { data } = await apiClient.put<AppUser>(`/admin/users/${id}`, payload);
  return data;
}

export async function listProducts(
  page = 1,
  limit = 20,
  search?: string,
  family?: string,
  subcategory?: string,
  category?: string,
): Promise<{ data: import('./search').Product[]; total: number; page: number; limit: number }> {
  const { data } = await apiClient.get('/products', {
    params: {
      page, limit,
      ...(search     ? { search }     : {}),
      ...(family     ? { family }     : {}),
      ...(subcategory ? { subcategory } : {}),
      ...(category   ? { category }   : {}),
    },
  });
  return data;
}

export interface ProductPayload {
  name: string;
  codeGold?: string;
  brand?: string;
  barcode?: string;
  description?: string;
  category?: string;
  family?: string;
  subcategory?: string;
  price?: number;
  stock?: number;
}

export async function createProduct(payload: ProductPayload): Promise<import('./search').Product> {
  const { data } = await apiClient.post<import('./search').Product>('/products', payload);
  return data;
}

export async function updateProduct(id: string, payload: ProductPayload): Promise<import('./search').Product> {
  const { data } = await apiClient.put<import('./search').Product>(`/products/${id}`, payload);
  return data;
}

export async function deleteProduct(id: string): Promise<void> {
  await apiClient.delete(`/products/${id}`);
}

export async function getDistinctValues(field: 'category' | 'family' | 'subcategory'): Promise<string[]> {
  const { data } = await apiClient.get<string[]>(`/products/distinct/${field}`);
  return data;
}

// ── Taxonomy ──────────────────────────────────────────────────────

export type TaxonomyType = 'category' | 'family' | 'subcategory';

export interface TaxonomyEntry {
  id: string;
  type: TaxonomyType;
  name: string;
  parentName: string | null;
  createdAt: string;
}

export async function listTaxonomy(type?: TaxonomyType): Promise<TaxonomyEntry[]> {
  const { data } = await apiClient.get<TaxonomyEntry[]>('/admin/taxonomy', { params: type ? { type } : {} });
  return data;
}

export async function createTaxonomy(payload: { type: TaxonomyType; name: string; parentName?: string }): Promise<TaxonomyEntry> {
  const { data } = await apiClient.post<TaxonomyEntry>('/admin/taxonomy', payload);
  return data;
}

export async function updateTaxonomy(id: string, payload: { name?: string; parentName?: string }): Promise<TaxonomyEntry> {
  const { data } = await apiClient.put<TaxonomyEntry>(`/admin/taxonomy/${id}`, payload);
  return data;
}

export async function deleteTaxonomy(id: string): Promise<void> {
  await apiClient.delete(`/admin/taxonomy/${id}`);
}

export interface ImageUploadDetail {
  filename: string;
  matched: boolean;
  productName?: string;
  productId?: string;
  reason?: string;
}

export interface ProductImportRow {
  name: string;
  codeGold?: string | null;
  success: boolean;
  reason?: string;
}

export interface ImportResult {
  imported: number;
  imagesUploaded: number;
  imagesMatched: number;
  errors: string[];
  imageResults?: ImageUploadDetail[];
  productResults?: ProductImportRow[];
}

export interface ImageUploadResult {
  uploaded: number;
  matched: number;
  errors: string[];
  imageResults: ImageUploadDetail[];
}

export type ImageMatchStrategy = 'order' | 'codegold' | 'barcode';

export async function importProductsCsv(
  fileUri: string,
  imageUris: string[] = [],
  strategy: 'order' | 'codegold' = 'codegold',
  onProgress?: (pct: number, phase: 'upload' | 'processing') => void,
): Promise<ImportResult> {
  const filename = fileUri.split('/').pop() ?? 'products';
  const isXlsx = /\.xlsx?$/i.test(filename);

  const formData = new FormData();
  formData.append('file', {
    uri: fileUri,
    name: filename,
    type: isXlsx
      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      : 'text/csv',
  } as any);

  const BATCH_SIZE = 5;
  const batch = imageUris.slice(0, BATCH_SIZE * 10); // cap at 50 to prevent timeout
  for (const uri of batch) {
    const imgName = uri.split('/').pop() ?? 'image.jpg';
    const ext = imgName.split('.').pop()?.toLowerCase() ?? 'jpg';
    const mimeMap: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
    formData.append('images', {
      uri,
      name: imgName,
      type: mimeMap[ext] ?? 'image/jpeg',
    } as any);
  }

  formData.append('strategy', strategy);

  const { data } = await apiClient.post<ImportResult>(
    '/admin/products/import/csv',
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120_000,
      onUploadProgress: onProgress
        ? (e: any) => {
            const pct = e.total ? Math.round((e.loaded / e.total) * 100) : 0;
            if (pct < 100) {
              onProgress(pct, 'upload');
            } else {
              onProgress(100, 'processing');
            }
          }
        : undefined,
    },
  );
  return {
    imported: data.imported ?? 0,
    imagesUploaded: data.imagesUploaded ?? 0,
    imagesMatched: data.imagesMatched ?? 0,
    errors: data.errors ?? [],
    imageResults: data.imageResults ?? [],
    productResults: data.productResults ?? [],
  };
}

const MIME: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

function buildBatchFormData(uris: string[], strategy: string): FormData {
  const fd = new FormData();
  for (const uri of uris) {
    const name = uri.split('/').pop() ?? 'image.jpg';
    const ext  = name.split('.').pop()?.toLowerCase() ?? 'jpg';
    fd.append('images', { uri, name, type: MIME[ext] ?? 'image/jpeg' } as any);
  }
  fd.append('strategy', strategy);
  return fd;
}

export async function uploadProductImages(
  imageUris: string[],
  strategy: 'codegold' | 'barcode' = 'codegold',
  onProgress?: (done: number, total: number, phase: 'upload' | 'processing') => void,
): Promise<ImageUploadResult> {
  const BATCH = 10;
  const total = imageUris.length;
  const acc: ImageUploadResult = { uploaded: 0, matched: 0, errors: [], imageResults: [] };

  for (let i = 0; i < total; i += BATCH) {
    const slice = imageUris.slice(i, i + BATCH);
    onProgress?.(i, total, 'upload');
    const { data } = await apiClient.post<ImageUploadResult>(
      '/admin/products/upload-images',
      buildBatchFormData(slice, strategy),
      { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120_000 },
    );
    acc.uploaded    += data.uploaded    ?? 0;
    acc.matched     += data.matched     ?? 0;
    acc.errors.push(...(data.errors      ?? []));
    acc.imageResults.push(...(data.imageResults ?? []));
    onProgress?.(i + slice.length, total, 'upload');
  }

  onProgress?.(total, total, 'processing');
  return acc;
}

export async function exportProductsCsv(): Promise<void> {
  const token = await AsyncStorage.getItem('accessToken').catch(() => null);
  const dest = FileSystem.documentDirectory + 'products_export.csv';
  const result = await FileSystem.downloadAsync(
    `${BASE_URL}/admin/products/export/csv`,
    dest,
    { headers: token ? { Authorization: `Bearer ${token}` } : {} },
  );
  if (result.status !== 200) throw new Error(`Export failed (${result.status})`);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(result.uri, { mimeType: 'text/csv', dialogTitle: 'Exporter le catalogue' });
  }
}
