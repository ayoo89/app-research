# Design — Product Search Full Stack

## Overview

This document covers the technical design for the complete implementation and fix plan of the Product Search application — a React Native (bare workflow) + NestJS full-stack hybrid search platform. The scope spans 15 sequential steps: from codebase audit through bug fixes, feature additions, optimization, and final APK build.

---

## High-Level Design

### System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        MOBILE APP                               │
│  React Native (bare) · TypeScript · Expo SDK                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐  │
│  │  Search  │ │ Catalog  │ │  Admin   │ │    Dashboard     │  │
│  │  Screen  │ │  Screen  │ │  Screens │ │    (super_admin) │  │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────────┬─────────┘  │
│       └────────────┴────────────┴─────────────────┘            │
│                    Axios Client (JWT interceptors)              │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTPS
┌──────────────────────────▼──────────────────────────────────────┐
│                     NESTJS API                                  │
│  https://productsearch-api.onrender.com/api/v1                  │
│  ┌──────┐ ┌────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │
│  │ Auth │ │Product │ │  Search  │ │Hierarchy │ │ Dashboard │  │
│  │Module│ │ Module │ │  Module  │ │  Module  │ │  Module   │  │
│  └──┬───┘ └───┬────┘ └────┬─────┘ └────┬─────┘ └─────┬─────┘  │
│     └─────────┴───────────┴────────────┴─────────────┘         │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  TypeORM · PostgreSQL (Neon) · Redis (Upstash) · Bull    │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTP
┌──────────────────────────▼──────────────────────────────────────┐
│               EMBEDDING SERVICE (Python FastAPI)                │
│  https://dsayoo-productsearch-embeddings.hf.space               │
│  CLIP (ViT-B/32) · MiniLM · Redis cache · Elasticsearch KNN    │
└─────────────────────────────────────────────────────────────────┘
```

### Data Model

```
Family (id, name, createdAt)
  └── SubFamily (id, name, familyId, createdAt)
        └── CategoryEntity (id, name, subFamilyId, createdAt)
              └── Product (id, name, brand, barcode, codeGold,
                           description, category[string], subcategory[string],
                           family[string], images[JSONB], price, stock,
                           embeddingVector[float[]], embeddingGenerated,
                           metadata[JSONB], createdAt, updatedAt)

User (id, email, name, password, role, isActive, inviteToken, createdAt)
SearchEvent (id, type, query, matchedProductId, latencyMs, createdAt)
```

**Note:** Products currently store denormalized strings for category/subcategory/family. The hierarchy entities (Family, SubFamily, CategoryEntity) exist as a separate relational structure used for management and filtering. The bootstrap process syncs them on startup.

### Navigation Structure (Mobile)

```
AppNavigator
├── AuthStack (unauthenticated)
│   ├── LoginScreen
│   └── ForgotPasswordScreen
└── MainStack (authenticated)
    ├── SearchScreen (default)
    ├── ScannerScreen
    ├── ProductDetailScreen
    ├── CatalogScreen
    ├── ProfileScreen
    └── AdminStack (role: admin | super_admin)
        ├── UsersScreen
        ├── InviteUserScreen
        ├── ImportExportScreen  ← includes Product CRUD tab (Step 7)
        ├── TaxonomyScreen      ← Families / SubFamilies / Categories
        └── DashboardScreen     ← super_admin only (Step 11)
```

### API Surface

| Method | Path | Auth | Step |
|--------|------|------|------|
| POST | /auth/login | — | existing |
| GET | /auth/me | JWT | existing |
| POST | /auth/refresh | — | existing |
| POST | /auth/accept-invite | — | existing |
| PATCH | /auth/profile | JWT | existing |
| POST | /search | JWT | existing |
| POST | /search/image | JWT | Step 8 fix |
| GET | /products | JWT | existing |
| GET | /products/:id | JWT | Step 3 fix |
| POST | /products | Admin | existing |
| PUT | /products/:id | Admin | existing |
| DELETE | /products/:id | Admin | existing |
| POST | /products/:id/trigger-embedding | Admin | existing |
| POST | /products/:id/image | Admin | Step 10 |
| GET | /families | JWT | Step 4 |
| POST | /families | Admin | Step 4 |
| PUT | /families/:id | Admin | Step 4 |
| DELETE | /families/:id | Admin | Step 4 |
| GET | /sub-families | JWT | Step 5 |
| POST | /sub-families | Admin | Step 5 |
| PUT | /sub-families/:id | Admin | Step 5 |
| DELETE | /sub-families/:id | Admin | Step 5 |
| GET | /categories | JWT | Step 6 |
| POST | /categories | Admin | Step 6 |
| PUT | /categories/:id | Admin | Step 6 |
| DELETE | /categories/:id | Admin | Step 6 |
| GET | /admin/users | Super Admin | existing |
| POST | /admin/users/invite | Super Admin | existing |
| POST | /admin/products/import/csv | Super Admin | Step 9 fix |
| GET | /admin/products/export/csv | Super Admin | existing |
| POST | /admin/products/upload-images | Super Admin | Step 10 |
| GET | /admin/dashboard/stats | Super Admin | Step 11 |
| POST | /admin/reindex/full | Super Admin | existing |
| POST | /admin/reindex/partial | Super Admin | existing |
| GET | /admin/reindex/status | Super Admin | existing |
| GET | /health | — | existing |
| GET | /metrics/prometheus | — | existing |

### Redis Key Patterns

| Key | TTL | Purpose |
|-----|-----|---------|
| `search:{sha256(query)}` | 300s | Text search cache |
| `search:barcode:{barcode}` | 60s | Barcode lookup cache |
| `search:image:{sha256(base64)}` | 300s | Image search cache |
| `embed:{sha256(input)}` | 3600s | Embedding cache |
| `hier:families` | 300s | Family list cache |
| `hier:sf:{familyId\|all}` | 300s | SubFamily list cache |
| `hier:cats:{subFamilyId\|all}` | 300s | Category list cache |
| `catalogue:page:{n}` | 300s | Product list page cache |
| `top_products` | sorted set | Search hit counts |

### Elasticsearch Index

```json
{
  "mappings": {
    "properties": {
      "id": { "type": "keyword" },
      "name": { "type": "text", "analyzer": "standard" },
      "brand": { "type": "text" },
      "barcode": { "type": "keyword" },
      "category": { "type": "keyword" },
      "family": { "type": "keyword" },
      "embedding": {
        "type": "dense_vector",
        "dims": 512,
        "index": true,
        "similarity": "cosine",
        "index_options": { "type": "hnsw", "m": 16, "ef_construction": 100 }
      }
    }
  }
}
```

---

## Low-Level Design

### Step 2 — Fix Product Images in Catalogue

**Root cause:** Image URLs stored as relative paths (e.g., `/products/1.jpg`) instead of absolute URLs. The mobile client cannot resolve relative paths without the base URL.

**Fix — Backend (`product.service.ts`):**
```typescript
// Ensure images are returned as absolute URLs
private resolveImageUrl(path: string): string {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  const base = this.configService.get('API_BASE_URL', 'https://productsearch-api.onrender.com');
  return `${base}/${path.replace(/^\//, '')}`;
}
```

**Fix — Mobile (`ProductCard.tsx`):**
```typescript
<Image
  source={{ uri: item.images?.[0] ?? null }}
  defaultSource={require('../assets/placeholder.png')}
  onError={() => setImageError(true)}
/>
```

**Fix — NestJS `ServeStaticModule`:**
```typescript
ServeStaticModule.forRoot({
  rootPath: join(__dirname, '..', 'public'),
  serveRoot: '/public',
})
```

---

### Step 3 — Fix Blank ProductDetailScreen

**Root cause:** Navigation param `productId` not passed correctly; missing null guards on product fields.

**Fix — Navigation call:**
```typescript
navigation.navigate('ProductDetail', { productId: item.id });
```

**Fix — Screen component:**
```typescript
const { productId } = route.params;
const { data: product, isLoading, error, refetch } = useQuery({
  queryKey: ['product', productId],
  queryFn: () => api.products.getById(productId),
  enabled: !!productId,
});

if (isLoading) return <ProductDetailSkeleton />;
if (error) return <ErrorState onRetry={refetch} />;
if (!product) return <EmptyState message="Produit introuvable" />;
```

---

### Step 4–6 — Hierarchy CRUD

The `HierarchyController` and `HierarchyService` already implement all CRUD endpoints. The main gaps are:

1. **Mobile screens** — `TaxonomyScreen.tsx` needs separate tabs/sections for Families, SubFamilies, and Categories with cascading selectors.
2. **409 enforcement** — Already implemented in `HierarchyService` (`removeFamily`, `removeSubFamily`, `removeCategory`).

**Mobile TaxonomyScreen structure:**
```typescript
// Tab navigator: Families | Sub-Families | Categories
// Each tab: FlatList + FAB (create) + swipe-to-delete + tap-to-edit modal
// SubFamilies tab: Family selector dropdown (fetches /families)
// Categories tab: Family → SubFamily cascading selectors
```

**API calls:**
```typescript
// mobile/src/api/hierarchy.ts
export const hierarchyApi = {
  getFamilies: () => client.get<Family[]>('/families'),
  createFamily: (name: string) => client.post('/families', { name }),
  updateFamily: (id: string, name: string) => client.put(`/families/${id}`, { name }),
  deleteFamily: (id: string) => client.delete(`/families/${id}`),
  getSubFamilies: (familyId?: string) => client.get('/sub-families', { params: { familyId } }),
  // ... etc
};
```

---

### Step 7 — Product CRUD in ImportExport Screen

**Screen layout:**
```
ImportExportScreen
├── Tab: Import (CSV/Excel upload)
├── Tab: Export (download CSV)
└── Tab: Products (CRUD)
    ├── SearchBar (debounced 300ms)
    ├── FlatList (paginated, GET /products)
    │   └── ProductRow: name, barcode, category, actions (edit/delete)
    └── FAB → ProductFormModal
```

**ProductFormModal fields:**
- name (required), brand, barcode, codeGold, description
- price (number), stock (number)
- Image picker (expo-image-picker, multiple)
- Hierarchy selector: Family → SubFamily → Category (cascading)

**After create/update:** call `POST /products/:id/trigger-embedding`

---

### Step 8 — Fix Image Search

**Backend fix (`search.controller.ts`):**
```typescript
@Post('image')
@UseInterceptors(FileInterceptor('image'))
async imageSearch(
  @UploadedFile() file: Express.Multer.File,
  @Body() dto: ImageSearchDto,
  @Request() req,
): Promise<SearchResponse> {
  const base64 = file.buffer.toString('base64');
  return this.searchService.search({ imageBase64: base64, limit: dto.limit ?? 20 }, req.user);
}
```

**Mobile fix (`SearchScreen.tsx`):**
```typescript
const handleImageSearch = async (source: 'camera' | 'gallery') => {
  const result = source === 'camera'
    ? await ImagePicker.launchCameraAsync({ quality: 0.7 })
    : await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });

  if (!result.canceled) {
    const compressed = await ImageManipulator.manipulateAsync(
      result.assets[0].uri,
      [{ resize: { width: 640 } }],
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
    );
    const formData = new FormData();
    formData.append('image', { uri: compressed.uri, type: 'image/jpeg', name: 'search.jpg' } as any);
    const results = await searchApi.imageSearch(formData);
    navigation.navigate('SearchResults', { results });
  }
};
```

**Permissions (AndroidManifest.xml):**
```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
```

---

### Step 9 — Fix CSV/Excel Import

**Backend (`admin.service.ts`) — extend to handle .xlsx:**
```typescript
async importProducts(file: Express.Multer.File): Promise<ImportReport> {
  const ext = path.extname(file.originalname).toLowerCase();
  let rows: RawRow[];

  if (ext === '.csv') {
    rows = await parseCsv(file.buffer);
  } else if (ext === '.xlsx' || ext === '.xls') {
    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json(sheet);
  } else {
    throw new BadRequestException('Format non supporté. Utilisez .csv, .xlsx ou .xls');
  }

  return this.processRows(rows);
}
```

**Mobile (`ImportExportScreen.tsx`) — fix MIME types:**
```typescript
const result = await DocumentPicker.getDocumentAsync({
  type: [
    'text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
  ],
  copyToCacheDirectory: true,
});
```

**Import report response:**
```typescript
interface ImportReport {
  total: number;
  success: number;
  skipped: number;  // duplicate barcode
  failed: number;
  errors: Array<{ row: number; reason: string }>;
}
```

---

### Step 10 — Multi-Image Import

**Backend endpoint (`product.controller.ts`):**
```typescript
@Post(':id/image')
@UseInterceptors(FileInterceptor('image'))
async uploadImage(
  @Param('id') id: string,
  @UploadedFile() file: Express.Multer.File,
): Promise<{ imageUrl: string }> {
  const filename = `${id}-${Date.now()}.jpg`;
  const dest = path.join('public', 'products', filename);
  await fs.writeFile(dest, file.buffer);
  const url = `${this.config.get('API_BASE_URL')}/public/products/${filename}`;
  await this.productService.addImage(id, url);
  return { imageUrl: url };
}
```

**Mobile — batch upload with progress:**
```typescript
const uploadImages = async (images: ImageAsset[], productId: string) => {
  const BATCH_SIZE = 5;
  let uploaded = 0;

  for (let i = 0; i < images.length; i += BATCH_SIZE) {
    const batch = images.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(async (img) => {
      const formData = new FormData();
      formData.append('image', { uri: img.uri, type: 'image/jpeg', name: img.fileName } as any);
      await productsApi.uploadImage(productId, formData);
      uploaded++;
      setProgress(uploaded / images.length);
    }));
  }
};
```

---

### Step 11 — Super Admin Dashboard

**New `search_events` table:**
```sql
CREATE TABLE IF NOT EXISTS search_events (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type         VARCHAR(20) NOT NULL CHECK (type IN ('barcode', 'text', 'image')),
  query        TEXT,
  matched_product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  latency_ms   INTEGER NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_search_events_created ON search_events(created_at DESC);
CREATE INDEX idx_search_events_type ON search_events(type);
```

**`GET /admin/dashboard/stats` response schema:**
```typescript
interface DashboardStats {
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
    searchesLast7Days: number[];  // [day-6, day-5, ..., today]
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
```

**Redis top products:**
```typescript
// On each search hit:
await redis.zincrby('top_products', 1, productId);

// For dashboard:
const topIds = await redis.zrevrange('top_products', 0, 9, 'WITHSCORES');
```

**Mobile DashboardScreen layout:**
```
DashboardScreen
├── Header: "Tableau de bord" + last updated timestamp
├── Pull-to-refresh (auto-refresh every 30s)
├── KPI Grid (2 columns):
│   ├── Total Products    ├── Families/SubFamilies/Categories
│   ├── Total Users       ├── Total Admins
│   ├── Searches Today    ├── Searches This Week
│   ├── Avg Latency (ms)  ├── Cache Hit Rate (%)
│   ├── Pending Embeddings └── Last Reindex
│   └── Last Import info
├── Bar Chart: Searches by type (react-native-chart-kit)
├── Line Chart: Last 7 days search volume
└── Top 10 Products FlatList (image + name + count)
```

---

### Step 12 — Image Search Ranking Improvements

**Elasticsearch KNN tuning:**
```typescript
const knnQuery = {
  knn: {
    field: 'embedding',
    query_vector: embeddingVector,
    k: limit * 2,
    num_candidates: Math.max(limit * 10, 200),
    filter: categoryFilter ? { term: { category: categoryFilter } } : undefined,
  },
  min_score: 0.22,  // configurable via env IMAGE_SEARCH_MIN_SCORE
};
```

**Hybrid re-ranking (vector + BM25):**
```typescript
const hybridScore = (vectorScore: number, bm25Score: number, weights = { vector: 0.6, text: 0.4 }) =>
  vectorScore * weights.vector + bm25Score * weights.text;
```

**Result diversity (max N per family):**
```typescript
const MAX_PER_FAMILY = 3;
const diversify = (results: SearchResult[]): SearchResult[] => {
  const familyCounts = new Map<string, number>();
  return results.filter(r => {
    const count = familyCounts.get(r.family) ?? 0;
    if (count >= MAX_PER_FAMILY) return false;
    familyCounts.set(r.family, count + 1);
    return true;
  });
};
```

---

### Step 13 — Global Optimization

**Backend caching additions:**
```typescript
// In ProductService.findAll():
const cacheKey = `catalogue:page:${page}:${limit}:${JSON.stringify(filters)}`;
const cached = await redis.get(cacheKey);
if (cached) return JSON.parse(cached);
// ... query ...
await redis.setex(cacheKey, 300, JSON.stringify(result));
```

**DB indexes to add:**
```sql
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_family ON products(family);
CREATE INDEX IF NOT EXISTS idx_products_subcategory ON products(subcategory);
```

**Mobile FlatList optimization:**
```typescript
<FlatList
  windowSize={5}
  maxToRenderPerBatch={10}
  initialNumToRender={10}
  removeClippedSubviews={true}
  getItemLayout={(_, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index })}
/>
```

**Import chunking:**
```typescript
const CHUNK_SIZE = 100;
for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
  const chunk = rows.slice(i, i + CHUNK_SIZE);
  await this.processChunk(chunk, report);
}
```

---

### Step 15 — APK Build

**Production API URL (`mobile/src/api/client.ts`):**
```typescript
export const BASE_URL = process.env.EXPO_PUBLIC_API_URL
  ?? 'https://productsearch-api.onrender.com/api/v1';
```

**Build command:**
```bash
cd mobile/android
./gradlew assembleRelease
# Output: app/build/outputs/apk/release/app-release.apk
```

**Signing config (`android/app/build.gradle`):**
```groovy
signingConfigs {
  release {
    storeFile file(MYAPP_RELEASE_STORE_FILE)
    storePassword MYAPP_RELEASE_STORE_PASSWORD
    keyAlias MYAPP_RELEASE_KEY_ALIAS
    keyPassword MYAPP_RELEASE_KEY_PASSWORD
  }
}
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Search Ordering

*For any* non-empty search query, the returned results list must satisfy `results[i].score >= results[i+1].score` for all consecutive pairs i.

**Validates: Requirements 1.2**

### Property 2: Barcode Exactness

*For any* product with barcode B that exists in the database, submitting `POST /search { barcode: B }` must return that product as `results[0]`.

**Validates: Requirements 2.1**

### Property 3: Hierarchy Delete Integrity

*For any* Family that has at least one SubFamily, `DELETE /families/:id` must return HTTP 409 and leave the Family unchanged. The same constraint applies for SubFamily → Category and Category → Product.

**Validates: Requirements 9.4, 9.5, 9.6**

### Property 4: Import Idempotency

*For any* import batch, every row marked `success` in the Import_Report must be retrievable via `GET /products?barcode={barcode}` immediately after the import completes.

**Validates: Requirements 7.7**

### Property 5: Cache Invalidation After Update

*For any* product that is updated via `PUT /products/:id`, any cached search result containing that product must reflect the updated data within one TTL cycle.

**Validates: Requirements 6.8, 17.4**

### Property 6: JWT Expiry Enforcement

*For any* request made to a JWT-protected endpoint using an expired access token, the API must return HTTP 401.

**Validates: Requirements 11.1**

### Property 7: Role Enforcement

*For any* request made to any `/admin/*` endpoint using a JWT with role `user`, the API must return HTTP 403.

**Validates: Requirements 11.3**

### Property 8: Pagination Non-Overlap

*For any* two consecutive pages N and N-1 of the same catalog query, the sets of product IDs returned must be disjoint.

**Validates: Requirements 5.2**

### Property 9: Image Search Attribution

*For any* image submitted to `POST /search/image`, every result in the response must include a `matchedBy` field containing `"image"`.

**Validates: Requirements 3.2**

### Property 10: Embedding Completeness After Reindex

*For any* state of the product database, after `POST /admin/reindex/full` completes, the count of products where `embedding_generated = false` must be 0.

**Validates: Requirements 12.2**

---

## Technology Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Image picker | `expo-image-picker` | Already installed, supports camera + gallery + multi-select |
| Document picker | `expo-document-picker` | Already installed, supports CSV/XLSX MIME types |
| Image compression | `expo-image-manipulator` | Already installed, resize before upload |
| Charts | `react-native-chart-kit` | Lightweight, works with React Native bare |
| Excel parsing | `xlsx` (SheetJS) | Already in backend `package.json` |
| State management | Zustand (existing) | Already used for auth/network stores |
| HTTP client | Axios (existing) | Already configured with interceptors |
| Test framework | Jest + `@testing-library/react-native` | Already configured in `jest.config.js` |
