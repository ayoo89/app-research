import { apiClient } from './client';

export interface FamilyItem {
  id: string;
  name: string;
  subFamilyCount: number;
  createdAt: string;
}

export interface SubFamilyItem {
  id: string;
  name: string;
  familyId: string;
  familyName: string;
  categoryCount: number;
  createdAt: string;
}

export interface CategoryItem {
  id: string;
  name: string;
  subFamilyId: string;
  subFamilyName: string;
  familyName: string;
  productCount: number;
  createdAt: string;
}

// ── Families ──────────────────────────────────────────────────────

export async function listFamilies(): Promise<FamilyItem[]> {
  const { data } = await apiClient.get<FamilyItem[]>('/families');
  return data;
}

export async function createFamily(name: string): Promise<FamilyItem> {
  const { data } = await apiClient.post<FamilyItem>('/families', { name });
  return data;
}

export async function updateFamily(id: string, name: string): Promise<FamilyItem> {
  const { data } = await apiClient.put<FamilyItem>(`/families/${id}`, { name });
  return data;
}

export async function deleteFamily(id: string): Promise<void> {
  await apiClient.delete(`/families/${id}`);
}

// ── Sub-Families ──────────────────────────────────────────────────

export async function listSubFamilies(familyId?: string): Promise<SubFamilyItem[]> {
  const params = familyId ? { familyId } : {};
  const { data } = await apiClient.get<SubFamilyItem[]>('/sub-families', { params });
  return data;
}

export async function createSubFamily(name: string, familyId: string): Promise<SubFamilyItem> {
  const { data } = await apiClient.post<SubFamilyItem>('/sub-families', { name, familyId });
  return data;
}

export async function updateSubFamily(id: string, payload: { name?: string; familyId?: string }): Promise<SubFamilyItem> {
  const { data } = await apiClient.put<SubFamilyItem>(`/sub-families/${id}`, payload);
  return data;
}

export async function deleteSubFamily(id: string): Promise<void> {
  await apiClient.delete(`/sub-families/${id}`);
}

// ── Categories ────────────────────────────────────────────────────

export async function listCategories(subFamilyId?: string): Promise<CategoryItem[]> {
  const params = subFamilyId ? { subFamilyId } : {};
  const { data } = await apiClient.get<CategoryItem[]>('/categories', { params });
  return data;
}

export async function createCategory(name: string, subFamilyId: string): Promise<CategoryItem> {
  const { data } = await apiClient.post<CategoryItem>('/categories', { name, subFamilyId });
  return data;
}

export async function updateCategory(id: string, payload: { name?: string; subFamilyId?: string }): Promise<CategoryItem> {
  const { data } = await apiClient.put<CategoryItem>(`/categories/${id}`, payload);
  return data;
}

export async function deleteCategory(id: string): Promise<void> {
  await apiClient.delete(`/categories/${id}`);
}
