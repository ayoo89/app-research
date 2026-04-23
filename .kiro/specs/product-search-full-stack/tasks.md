# Tasks — Product Search Full Stack

## Implementation Plan

- [ ] 1. Audit & Codebase Analysis
  - [ ] 1.1 Read and map all NestJS modules, controllers, services, entities, and DTOs
  - [ ] 1.2 Read and map all React Native screens, components, navigation structure, and API calls
  - [ ] 1.3 Audit all existing API endpoints against the README table — flag missing or broken ones
  - [ ] 1.4 Verify the embedding service is reachable at the HuggingFace Spaces URL
  - [ ] 1.5 Document every bug, broken feature, and logical inconsistency found

- [x] 2. Fix Product Images Not Displaying in Catalogue
  - [x] 2.1 Fix `ProductService` to resolve relative image paths to absolute URLs using `API_BASE_URL`
  - [x] 2.2 Verify `ServeStaticModule` is configured to serve files from `public/` at `/public`
  - [x] 2.3 Fix base URL construction in `mobile/src/api/client.ts` to use production URL in release builds
  - [x] 2.4 Add `onError` fallback placeholder to `<Image>` components in `ProductCard.tsx`
  - [x] 2.5 Test that product images render correctly in the catalogue `FlatList`

- [x] 3. Fix Blank ProductDetailScreen
  - [x] 3.1 Fix navigation call to pass `productId` (UUID) as a route param to `ProductDetailScreen`
  - [x] 3.2 Fix `ProductDetailScreen` to read `productId` from `route.params` and call `GET /products/:id`
  - [x] 3.3 Add null/undefined guards on all product fields before rendering
  - [x] 3.4 Add skeleton loading state while the product is fetching
  - [x] 3.5 Add error state with a retry button when the fetch fails
  - [x] 3.6 Add empty state with "Produit introuvable" message when the product is not found

- [x] 4. Fix & Implement Complete CRUD for Product Families
  - [x] 4.1 Verify `GET /families`, `POST /families`, `PUT /families/:id`, `DELETE /families/:id` endpoints work end-to-end
  - [x] 4.2 Implement the Families tab in `TaxonomyScreen.tsx` with a `FlatList` showing name and SubFamily count
  - [x] 4.3 Add a create modal with a name input field that calls `POST /families`
  - [x] 4.4 Add an edit modal pre-filled with the family name that calls `PUT /families/:id`
  - [x] 4.5 Add a delete confirmation dialog that calls `DELETE /families/:id` and handles 409 errors gracefully

- [x] 5. Fix & Implement Complete CRUD for Product Sub-Families
  - [x] 5.1 Verify `GET /sub-families`, `POST /sub-families`, `PUT /sub-families/:id`, `DELETE /sub-families/:id` endpoints work end-to-end
  - [x] 5.2 Implement the Sub-Families tab in `TaxonomyScreen.tsx` with a `FlatList` showing name, parent Family, and Category count
  - [x] 5.3 Add a Family selector dropdown that filters the SubFamily list by `familyId`
  - [x] 5.4 Add a create modal with name input and Family selector that calls `POST /sub-families`
  - [x] 5.5 Add an edit modal pre-filled with name and parent Family that calls `PUT /sub-families/:id`
  - [x] 5.6 Add a delete confirmation dialog that calls `DELETE /sub-families/:id` and handles 409 errors gracefully

- [x] 6. Fix & Implement Complete CRUD for Product Categories
  - [x] 6.1 Verify `GET /categories`, `POST /categories`, `PUT /categories/:id`, `DELETE /categories/:id` endpoints work end-to-end
  - [x] 6.2 Implement the Categories tab in `TaxonomyScreen.tsx` with a `FlatList` showing name, parent SubFamily, parent Family, and product count
  - [x] 6.3 Add cascading Family → SubFamily selectors that filter the Category list
  - [x] 6.4 Add a create modal with name input and cascading Family → SubFamily selector that calls `POST /categories`
  - [x] 6.5 Add an edit modal pre-filled with name and parent SubFamily that calls `PUT /categories/:id`
  - [x] 6.6 Add a delete confirmation dialog that calls `DELETE /categories/:id` and handles 409 errors gracefully

- [x] 7. Add Full Product CRUD in the Import/Export Screen
  - [x] 7.1 Add a "Products" tab to `ImportExportScreen.tsx` alongside the existing Import and Export tabs
  - [x] 7.2 Implement a searchable, paginated `FlatList` in the Products tab that calls `GET /products`
  - [x] 7.3 Implement a `ProductFormModal` with fields: name, brand, barcode, codeGold, description, price, stock, images, and cascading Family → SubFamily → Category selector
  - [x] 7.4 Wire the create flow: FAB opens `ProductFormModal`, on submit calls `POST /products` then `POST /products/:id/trigger-embedding`
  - [x] 7.5 Wire the edit flow: tapping a product opens `ProductFormModal` pre-filled, on submit calls `PUT /products/:id` then `POST /products/:id/trigger-embedding`
  - [x] 7.6 Wire the delete flow: long-press or swipe shows a confirmation dialog that calls `DELETE /products/:id`

- [x] 8. Fix Image Search (Camera & Gallery)
  - [x] 8.1 Fix `POST /search/image` NestJS endpoint to accept a multipart image file, convert it to base64, and pass it to the search pipeline
  - [x] 8.2 Fix the camera picker flow in `SearchScreen.tsx` using `expo-image-picker` `launchCameraAsync`
  - [x] 8.3 Fix the gallery picker flow in `SearchScreen.tsx` using `expo-image-picker` `launchImageLibraryAsync`
  - [x] 8.4 Add image compression using `expo-image-manipulator` (resize to max 640px width, 70% quality) before upload
  - [x] 8.5 Send the compressed image as `multipart/form-data` to `POST /search/image`
  - [x] 8.6 Display image search results with a "🔍 Visual" match badge
  - [x] 8.7 Add `android.permission.CAMERA` and `android.permission.READ_MEDIA_IMAGES` to `AndroidManifest.xml`
  - [x] 8.8 Add runtime permission requests with denial handling that links to device app settings

- [x] 9. Fix Import Functionality (Excel & CSV)
  - [x] 9.1 Fix `expo-document-picker` in `ImportExportScreen.tsx` to accept `text/csv`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, and `application/vnd.ms-excel` MIME types
  - [x] 9.2 Extend the NestJS import service to parse `.xlsx` and `.xls` files using the `xlsx` package
  - [x] 9.3 Implement row-by-row validation: required fields, type checks, duplicate barcode detection
  - [x] 9.4 Implement hierarchy resolution on import: find or create Family → SubFamily → Category before inserting the product
  - [x] 9.5 Process import rows in chunks of 100 to avoid memory exhaustion on large files
  - [x] 9.6 Return a structured `ImportReport` with `total`, `success`, `skipped`, `failed`, and `errors` fields
  - [x] 9.7 Display the `ImportReport` in the mobile UI after upload completes

- [x] 10. Implement Multi-Image Selection & Import
  - [x] 10.1 Implement multi-image selection in the mobile app using `expo-image-picker` with `selectionLimit: 0`
  - [x] 10.2 Create `POST /products/:id/image` NestJS endpoint that accepts a single image file and stores it to `public/products/`
  - [x] 10.3 Implement batch upload logic in the mobile app: upload images in batches of max 5 concurrent requests
  - [x] 10.4 Add a real-time progress bar showing percentage and file count during batch upload
  - [x] 10.5 Display a final upload summary: total selected, uploaded successfully, failed (with filename and reason)

- [x] 11. Super Admin Dashboard
  - [x] 11.1 Create the `search_events` PostgreSQL table with columns: `id`, `type`, `query`, `matched_product_id`, `latency_ms`, `created_at`
  - [x] 11.2 Add indexes on `search_events(created_at DESC)` and `search_events(type)`
  - [x] 11.3 Instrument the search pipeline to insert a `SearchEvent` row on every search call
  - [x] 11.4 Instrument the search pipeline to call `ZINCRBY top_products 1 {product_id}` on every search hit
  - [x] 11.5 Implement `GET /admin/dashboard/stats` endpoint (super_admin only) that aggregates database counts, search metrics, top products, reindex status, and import history
  - [x] 11.6 Implement the `DashboardScreen` in the mobile app accessible only to `super_admin` role
  - [x] 11.7 Add KPI cards in a 2-column grid for all required metrics
  - [x] 11.8 Add a bar chart of searches by type (barcode / text / image) using `react-native-chart-kit`
  - [x] 11.9 Add a line chart of search volume for the last 7 days
  - [x] 11.10 Add a Top 10 Most Searched Products `FlatList` with product image, name, and search count
  - [x] 11.11 Implement auto-refresh every 30 seconds and pull-to-refresh
  - [x] 11.12 Add skeleton loading state while dashboard data is fetching
  - [x] 11.13 Display a "Last updated at HH:MM:SS" timestamp

- [x] 12. Improve Image Search Ranking Precision
  - [x] 12.1 Tune Elasticsearch KNN query: set `num_candidates` to `max(limit * 10, 200)` and `k` to `limit * 2`
  - [x] 12.2 Make the minimum similarity score threshold configurable via `IMAGE_SEARCH_MIN_SCORE` env var (default 0.22)
  - [x] 12.3 Implement hybrid re-ranking: combine CLIP vector score (60%) and BM25 text score (40%)
  - [x] 12.4 Implement result diversity: cap results at 3 per Family using a post-retrieval filter
  - [x] 12.5 Add category/family-aware post-filtering when a text context is also provided
  - [x] 12.6 Trigger a full reindex after embedding improvements: `POST /admin/reindex/full`

- [x] 13. Global Optimization
  - [x] 13.1 Add Redis TTL caching (300s) to `GET /products` list endpoint with cache key including page, limit, and filters
  - [x] 13.2 Add Redis TTL caching (300s) to `GET /families`, `GET /sub-families`, and `GET /categories` endpoints
  - [x] 13.3 Add missing DB indexes: `products.name`, `products.family`, `products.subcategory`
  - [x] 13.4 Optimize mobile `FlatList` components: set `windowSize=5`, `maxToRenderPerBatch=10`, `initialNumToRender=10`, `removeClippedSubviews=true`, and `getItemLayout`
  - [x] 13.5 Add lazy image loading with placeholder in all product list screens
  - [x] 13.6 Verify `compression` middleware is enabled in the NestJS app for all API responses
  - [x] 13.7 Set Bull queue concurrency and retry limits to prevent queue backlog exceeding 10k jobs

- [x] 14. Full Project Verification & QA
  - [x] 14.1 Re-test all README test scenarios end-to-end: Login → Search → Product detail → Logout
  - [x] 14.2 Re-test barcode scan → result in < 1s
  - [x] 14.3 Re-test image search from gallery → ranked results with Visual badge
  - [x] 14.4 Re-test offline mode → yellow banner, search disabled
  - [x] 14.5 Re-test admin invite flow via curl
  - [x] 14.6 Re-test full reindex and monitor status
  - [x] 14.7 Test edge cases: empty states, missing images, invalid Excel file, large import (500+ rows), permission denial, Redis down (fallback to DB), Elasticsearch unreachable
  - [x] 14.8 Verify all API endpoints return correct HTTP status codes and structured error messages
  - [x] 14.9 Verify performance targets: barcode < 10ms, text search < 100ms, vector search < 300ms, full pipeline < 1s, cache hit < 20ms
  - [x] 14.10 Verify no blank screens, no broken images, no unhandled loading or error states across all screens

- [ ] 15. Final APK Build
  - [ ] 15.1 Set production API URL in `mobile/src/api/client.ts` to `https://productsearch-api.onrender.com/api/v1`
  - [ ] 15.2 Verify all backend env vars are set in the Render dashboard
  - [ ] 15.3 Run `cd backend && npm run build` and verify zero TypeScript compilation errors
  - [ ] 15.4 Run `docker compose up -d` and verify all services are healthy
  - [ ] 15.5 Run `cd mobile/android && ./gradlew assembleRelease` with Java 21
  - [ ] 15.6 Verify the APK is produced at `mobile/android/app/build/outputs/apk/release/app-release.apk`
  - [ ] 15.7 Install the APK on a real Android device or emulator and run the final smoke test
