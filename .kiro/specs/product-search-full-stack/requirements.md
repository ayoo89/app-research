# Requirements Document

## Introduction

This document defines the business and functional requirements for the Product Search Full Stack application — a React Native mobile app backed by a NestJS API that enables users to discover products via text, barcode, and image search, and enables administrators to manage the product catalog, taxonomy hierarchy, and system health.

The application serves three distinct user roles: regular users who search for products, admins who manage the catalog, and super admins who oversee the entire system. Requirements are derived from the approved technical design and cover all 15 implementation steps.

---

## Glossary

- **System**: The combined React Native mobile application and NestJS backend API.
- **Mobile_App**: The React Native (bare workflow) mobile application.
- **API**: The NestJS backend REST API.
- **Search_Service**: The backend module responsible for executing text, barcode, and image searches.
- **Embedding_Service**: The Python FastAPI service that generates vector embeddings using CLIP and MiniLM models.
- **Product**: A catalog item with fields including name, brand, barcode, codeGold, description, category, family, images, price, stock, and an embedding vector.
- **Family**: The top-level taxonomy node in the product hierarchy.
- **SubFamily**: A second-level taxonomy node that belongs to a Family.
- **Category**: A third-level taxonomy node that belongs to a SubFamily.
- **Hierarchy**: The three-level taxonomy structure: Family → SubFamily → Category.
- **User**: An authenticated person with role `user`, `admin`, or `super_admin`.
- **Admin**: A User with role `admin` or `super_admin` who can manage the product catalog.
- **Super_Admin**: A User with role `super_admin` who has full system access including analytics.
- **JWT**: JSON Web Token used for authentication and authorization.
- **Import_Report**: A structured response summarizing the outcome of a bulk product import operation.
- **SearchEvent**: A recorded instance of a search operation, capturing type, query, matched product, and latency.
- **Embedding**: A 512-dimensional float vector representing the semantic content of a product, used for similarity search.
- **Cache**: Redis-based key-value store used to accelerate repeated queries.
- **Barcode**: A unique product identifier scanned or typed by the user.
- **APK**: The Android application package file produced by the release build process.

---

## Requirements

### Requirement 1: Product Text Search

**User Story:** As a user, I want to search for products by typing a text query, so that I can quickly find products by name, brand, or description.

#### Acceptance Criteria

1. WHEN a user submits a non-empty text query, THE Search_Service SHALL return a list of matching products ordered by descending relevance score.
2. WHEN a user submits a text query, THE Search_Service SHALL return results where `results[i].score >= results[i+1].score` for all consecutive pairs.
3. WHEN a user submits a text query that matches no products, THE Search_Service SHALL return an empty results array with HTTP 200.
4. WHEN a user submits a text query, THE Search_Service SHALL respond within 1 second under normal load conditions.
5. WHEN a user submits the same text query within 300 seconds, THE Search_Service SHALL return the cached result without re-querying Elasticsearch.
6. WHEN a user submits a text query, THE Search_Service SHALL record a SearchEvent of type `text` with the query and latency.

---

### Requirement 2: Product Barcode Search

**User Story:** As a user, I want to scan or type a product barcode to find an exact product match, so that I can identify a specific item instantly.

#### Acceptance Criteria

1. WHEN a user submits a barcode value that matches an existing product, THE Search_Service SHALL return that product as the first result.
2. WHEN a user submits a barcode value that matches no product, THE Search_Service SHALL return an empty results array with HTTP 200.
3. WHEN a user submits a barcode value, THE Search_Service SHALL respond within 10 milliseconds on a cache hit.
4. WHEN a user submits a barcode value, THE Search_Service SHALL cache the result for 60 seconds.
5. WHEN a user submits a barcode value, THE Search_Service SHALL record a SearchEvent of type `barcode`.

---

### Requirement 3: Product Image Search

**User Story:** As a user, I want to search for products by taking a photo or selecting an image from my gallery, so that I can find visually similar products without knowing their name.

#### Acceptance Criteria

1. WHEN a user submits an image for search, THE Search_Service SHALL return a list of visually similar products ordered by descending similarity score.
2. WHEN a user submits an image for search, THE Search_Service SHALL include a `matchedBy` field containing `"image"` in every result.
3. WHEN a user submits an image for search, THE Mobile_App SHALL request camera or media library permission before accessing device hardware.
4. WHEN a user submits an image for search, THE Mobile_App SHALL compress the image to a maximum width of 640 pixels before uploading.
5. WHEN a user submits an image for search, THE Search_Service SHALL cache the result for 300 seconds keyed by the SHA-256 hash of the image data.
6. WHEN a user submits an image for search, THE Search_Service SHALL record a SearchEvent of type `image`.
7. WHEN image search results are returned, THE Search_Service SHALL return no more than 3 results from the same Family to ensure diversity.

---

### Requirement 4: Product Detail View

**User Story:** As a user, I want to view the full details of a product, so that I can see its name, brand, description, price, images, and category information.

#### Acceptance Criteria

1. WHEN a user navigates to a product detail screen, THE Mobile_App SHALL fetch the product by its ID from the API.
2. WHEN a product is loading, THE Mobile_App SHALL display a skeleton loading state.
3. WHEN a product fetch fails, THE Mobile_App SHALL display an error state with a retry action.
4. WHEN a product is not found, THE Mobile_App SHALL display a "Produit introuvable" message.
5. WHEN a product is displayed, THE Mobile_App SHALL show the product name, brand, barcode, description, price, stock, and category.
6. WHEN a product has images, THE API SHALL return all image URLs as absolute HTTP URLs.
7. IF a product image URL is relative, THEN THE API SHALL prepend the configured `API_BASE_URL` to produce an absolute URL.

---

### Requirement 5: Product Catalog Browsing

**User Story:** As a user, I want to browse the full product catalog with pagination, so that I can discover products without searching.

#### Acceptance Criteria

1. WHEN a user browses the catalog, THE API SHALL return products in paginated pages.
2. WHEN a user requests page N of the catalog, THE API SHALL return a set of product IDs that does not overlap with the set returned on page N-1 for the same query parameters.
3. WHEN a user browses the catalog, THE Mobile_App SHALL render the product list using virtualized rendering with a window size of 5 and a maximum batch render of 10 items.
4. WHEN a user browses the catalog, THE API SHALL cache each page result for 300 seconds.

---

### Requirement 6: Admin Product CRUD

**User Story:** As an admin, I want to create, read, update, and delete products in the catalog, so that I can keep the product database accurate and up to date.

#### Acceptance Criteria

1. WHEN an admin creates a product with valid required fields, THE API SHALL persist the product and return it with a generated ID.
2. WHEN an admin creates a product, THE API SHALL trigger embedding generation for that product.
3. WHEN an admin updates a product, THE API SHALL persist the changes and return the updated product.
4. WHEN an admin updates a product, THE API SHALL trigger embedding regeneration for that product.
5. WHEN an admin deletes a product, THE API SHALL remove the product and return HTTP 200 or 204.
6. WHEN an admin creates or updates a product, THE Mobile_App SHALL allow selection of Family, SubFamily, and Category using cascading selectors.
7. WHEN an admin creates or updates a product, THE Mobile_App SHALL allow uploading multiple product images.
8. WHEN a product is created or updated, THE API SHALL invalidate any cached search results containing that product within one TTL cycle.

---

### Requirement 7: Bulk Product Import

**User Story:** As an admin, I want to import products in bulk from a CSV or Excel file, so that I can populate or update the catalog efficiently without manual data entry.

#### Acceptance Criteria

1. WHEN an admin uploads a `.csv` file, THE API SHALL parse it and attempt to create or update each row as a product.
2. WHEN an admin uploads a `.xlsx` or `.xls` file, THE API SHALL parse it using the first sheet and attempt to create or update each row as a product.
3. WHEN an admin uploads a file with an unsupported extension, THE API SHALL return HTTP 400 with a descriptive error message.
4. WHEN an import completes, THE API SHALL return an Import_Report containing `total`, `success`, `skipped`, `failed`, and `errors` fields.
5. WHEN an import row contains a barcode that already exists in the database, THE API SHALL skip that row and increment the `skipped` count.
6. WHEN an import row fails validation, THE API SHALL record the row number and reason in the `errors` array and increment the `failed` count.
7. FOR ALL rows marked `success` in the Import_Report, THE API SHALL make the product retrievable via `GET /products?barcode={barcode}`.
8. WHEN an import contains more than 100 rows, THE API SHALL process rows in chunks of 100 to avoid memory exhaustion.
9. THE Import_Report `total` field SHALL equal the sum of `success`, `skipped`, and `failed`.

---

### Requirement 8: Product Image Upload

**User Story:** As an admin, I want to upload one or more images for a product, so that users can visually identify products in search results and the catalog.

#### Acceptance Criteria

1. WHEN an admin uploads an image for a product, THE API SHALL store the image file and append its absolute URL to the product's images array.
2. WHEN an admin uploads multiple images, THE Mobile_App SHALL upload them in batches of 5 with a visible progress indicator.
3. WHEN an image is uploaded, THE API SHALL return the absolute URL of the stored image.
4. WHEN a super admin performs a bulk image upload, THE API SHALL associate each image with the correct product.

---

### Requirement 9: Taxonomy Hierarchy Management

**User Story:** As an admin, I want to create, update, and delete Families, SubFamilies, and Categories, so that I can maintain an organized product taxonomy.

#### Acceptance Criteria

1. WHEN an admin creates a Family with a unique name, THE API SHALL persist it and return it with a generated ID.
2. WHEN an admin creates a SubFamily linked to an existing Family, THE API SHALL persist it and return it with a generated ID.
3. WHEN an admin creates a Category linked to an existing SubFamily, THE API SHALL persist it and return it with a generated ID.
4. WHEN an admin attempts to delete a Family that has one or more SubFamilies, THE API SHALL return HTTP 409 and not delete the Family.
5. WHEN an admin attempts to delete a SubFamily that has one or more Categories, THE API SHALL return HTTP 409 and not delete the SubFamily.
6. WHEN an admin attempts to delete a Category that has one or more Products assigned to it, THE API SHALL return HTTP 409 and not delete the Category.
7. WHEN an admin deletes a Family that has no SubFamilies, THE API SHALL delete the Family and return HTTP 200 or 204.
8. WHEN an admin deletes a SubFamily that has no Categories, THE API SHALL delete the SubFamily and return HTTP 200 or 204.
9. WHEN an admin deletes a Category that has no Products, THE API SHALL delete the Category and return HTTP 200 or 204.
10. WHEN an admin views SubFamilies, THE Mobile_App SHALL allow filtering by parent Family.
11. WHEN an admin views Categories, THE Mobile_App SHALL allow cascading selection of Family then SubFamily.

---

### Requirement 10: Super Admin Analytics Dashboard

**User Story:** As a super admin, I want to view real-time analytics about product searches, catalog health, and system performance, so that I can monitor usage and identify issues.

#### Acceptance Criteria

1. WHEN a super admin opens the dashboard, THE API SHALL return a DashboardStats object containing database counts, search metrics, top products, reindex status, and import history.
2. WHEN a super admin views the dashboard, THE Mobile_App SHALL display KPI cards for total products, families, subfamilies, categories, users, admins, searches today, searches this week, average latency, cache hit rate, pending embeddings, and last reindex time.
3. WHEN a super admin views the dashboard, THE Mobile_App SHALL display a bar chart of searches grouped by type (barcode, text, image).
4. WHEN a super admin views the dashboard, THE Mobile_App SHALL display a line chart of search volume for the last 7 days.
5. WHEN a super admin views the dashboard, THE Mobile_App SHALL display the top 10 most-searched products with their image, name, and search count.
6. WHEN N searches are performed, THE API SHALL increment the `totalSearchesAllTime` counter by N.
7. WHEN a product is searched, THE API SHALL increment that product's search hit count in the sorted set used for top products ranking.
8. WHEN a super admin views the dashboard, THE Mobile_App SHALL automatically refresh the data every 30 seconds.
9. WHEN a super admin pulls down on the dashboard, THE Mobile_App SHALL immediately refresh the data.

---

### Requirement 11: Authentication and Authorization

**User Story:** As a system operator, I want all API endpoints to enforce authentication and role-based access control, so that only authorized users can access sensitive operations.

#### Acceptance Criteria

1. WHEN a request is made to a JWT-protected endpoint with an expired access token, THE API SHALL return HTTP 401.
2. WHEN a request is made to a JWT-protected endpoint without a token, THE API SHALL return HTTP 401.
3. WHEN a user with role `user` makes a request to any `/admin/*` endpoint, THE API SHALL return HTTP 403.
4. WHEN a user with role `admin` makes a request to a `super_admin`-only endpoint, THE API SHALL return HTTP 403.
5. WHEN a user with role `super_admin` makes a request to any endpoint, THE API SHALL process the request normally.
6. WHEN an access token expires, THE Mobile_App SHALL automatically attempt to refresh it using the refresh token.
7. WHEN a refresh token is invalid or expired, THE Mobile_App SHALL redirect the user to the login screen.

---

### Requirement 12: Embedding Generation and Reindexing

**User Story:** As a super admin, I want to trigger embedding generation and full reindexing of the product catalog, so that search results remain accurate after bulk data changes.

#### Acceptance Criteria

1. WHEN a super admin triggers a full reindex, THE API SHALL generate embeddings for all products that do not have one.
2. WHEN a full reindex completes, THE API SHALL ensure that no product in the database has `embedding_generated = false`.
3. WHEN an admin triggers embedding generation for a single product, THE API SHALL set `embeddingGenerated = true` for that product upon completion.
4. WHEN a super admin queries reindex status, THE API SHALL return the count of products with pending embeddings.
5. WHEN a super admin triggers a partial reindex, THE API SHALL process only products added or modified since the last reindex.

---

### Requirement 13: Mobile App Offline and Error Handling

**User Story:** As a user, I want the mobile app to handle network errors and offline conditions gracefully, so that I understand what went wrong and can retry when connectivity is restored.

#### Acceptance Criteria

1. WHEN a network request fails due to connectivity loss, THE Mobile_App SHALL display a user-visible error message.
2. WHEN a network request fails, THE Mobile_App SHALL provide a retry action to the user.
3. WHEN the API returns an error response, THE Mobile_App SHALL display a localized error message rather than a raw error code.
4. WHEN the mobile app is offline, THE Mobile_App SHALL display a network status indicator.

---

### Requirement 14: Mobile App Permissions

**User Story:** As a user, I want the mobile app to request only the permissions it needs, at the time it needs them, so that I understand why each permission is required.

#### Acceptance Criteria

1. WHEN a user initiates an image search via camera, THE Mobile_App SHALL request camera permission before accessing the camera.
2. WHEN a user initiates an image search via gallery, THE Mobile_App SHALL request media library read permission before accessing the gallery.
3. WHEN a user denies a permission, THE Mobile_App SHALL display an explanation and offer to open device settings.
4. THE Mobile_App SHALL declare `android.permission.CAMERA` and `android.permission.READ_MEDIA_IMAGES` in the Android manifest.

---

### Requirement 15: Release APK Build

**User Story:** As a product owner, I want a signed release APK that connects to the production API, so that the application can be distributed to end users.

#### Acceptance Criteria

1. WHEN the release APK is built, THE Mobile_App SHALL connect to `https://productsearch-api.onrender.com/api/v1` as the default API base URL.
2. WHEN the release APK is built, THE Mobile_App SHALL be signed with the release keystore using the configured key alias and passwords.
3. WHEN the release APK is built, THE Mobile_App SHALL be produced at `app/build/outputs/apk/release/app-release.apk`.
4. WHEN the release APK is installed on an Android device, THE Mobile_App SHALL launch without crashing on the login screen.

---

### Requirement 16: Search Result Quality

**User Story:** As a user, I want search results to be relevant and diverse, so that I can find what I am looking for without seeing repetitive or irrelevant results.

#### Acceptance Criteria

1. WHEN image search results are returned, THE Search_Service SHALL return no more than 3 results from any single Family.
2. WHEN image search results are returned, THE Search_Service SHALL apply a minimum similarity score threshold of 0.22 to exclude low-confidence matches.
3. WHEN text and image signals are both available, THE Search_Service SHALL combine them using a weighted hybrid score (60% vector, 40% BM25).
4. WHEN a search is performed with a category filter, THE Search_Service SHALL return only products belonging to that category.

---

### Requirement 17: System Performance and Caching

**User Story:** As a user, I want the application to respond quickly, so that I can search and browse products without noticeable delays.

#### Acceptance Criteria

1. WHEN a text search result is cached, THE Search_Service SHALL serve it from cache within the 300-second TTL without querying Elasticsearch.
2. WHEN a hierarchy list (families, subfamilies, categories) is requested, THE API SHALL serve it from cache within the 300-second TTL.
3. WHEN a catalog page is requested, THE API SHALL serve it from cache within the 300-second TTL.
4. WHEN a product is updated, THE API SHALL invalidate the relevant catalog page cache entries.
5. THE API SHALL maintain database indexes on `products.name`, `products.family`, and `products.subcategory` to support efficient filtering queries.
