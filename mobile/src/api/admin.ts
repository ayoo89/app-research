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

export async function listProducts(page = 1, limit = 20): Promise<{
  data: import('./search').Product[];
  total: number;
  page: number;
  limit: number;
}> {
  const { data } = await apiClient.get('/products', { params: { page, limit } });
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
}

export async function createProduct(payload: ProductPayload): Promise<import('./search').Product> {
  const { data } = await apiClient.post<import('./search').Product>('/products', payload);
  return data;
}

export async function updateProduct(id: string, payload: ProductPayload): Promise<import('./search').Product> {
  const { data } = await apiClient.put<import('./search').Product>(`/products/${id}`, payload);
  return data;
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

export interface ImportResult {
  imported: number;
  imagesUploaded: number;
  imagesMatched: number;
  errors: string[];
}

export async function importProductsCsv(
  fileUri: string,
  imageUris: string[] = [],
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

  for (const uri of imageUris) {
    const imgName = uri.split('/').pop() ?? 'image.jpg';
    const ext = imgName.split('.').pop()?.toLowerCase() ?? 'jpg';
    const mimeMap: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
    formData.append('images', {
      uri,
      name: imgName,
      type: mimeMap[ext] ?? 'image/jpeg',
    } as any);
  }

  const { data } = await apiClient.post<ImportResult>(
    '/admin/products/import/csv',
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120_000 },
  );
  return { imported: data.imported ?? 0, imagesUploaded: data.imagesUploaded ?? 0, imagesMatched: data.imagesMatched ?? 0, errors: data.errors ?? [] };
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
