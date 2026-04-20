import { apiClient } from './client';

export interface DashboardStats {
  database: {
    totalProducts: number;
    totalFamilies: number;
    totalSubFamilies: number;
    totalCategories: number;
    totalUsers: number;
    totalAdmins: number;
  };
  search: {
    totalSearchesAllTime: number;
    searchesToday: number;
    searchesThisWeek: number;
    byType: { barcode: number; text: number; image: number };
    searchesLast7Days: number[];
    avgLatencyMs: number;
    cacheHitRate: number;
  };
  topProducts: Array<{
    id: string;
    name: string;
    searchCount: number;
    image: string | null;
  }>;
  reindex: {
    lastFullReindexAt: string | null;
    pendingEmbeddings: number;
    totalIndexed: number;
  };
  imports: {
    totalImported: number;
    lastImportAt: string | null;
    lastImportRows: number;
    lastImportSuccessRate: number;
  };
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const { data } = await apiClient.get<DashboardStats>('/admin/dashboard/stats');
  return data;
}
