# Product Search — Full Stack

Hybrid product search over millions of products. Barcode scan, image search, and text — all in one pipeline.

---

## Production Deployment

| Service | Platform | URL |
|---------|----------|-----|
| NestJS API | Render (free) | `https://productsearch-api.onrender.com` |
| PostgreSQL | Neon (serverless free) | — |
| Redis | Upstash (free) | — |
| Elasticsearch | Bonsai (free) | — |
| Embedding service | HuggingFace Spaces (free) | `https://dsayoo-productsearch-embeddings.hf.space` |

**Backend env vars required in Render dashboard:**

| Variable | Description |
|----------|-------------|
| `DB_HOST` | Neon PostgreSQL host |
| `DB_PORT` | `5432` |
| `DB_USERNAME` | Neon username |
| `DB_PASSWORD` | Neon password |
| `DB_NAME` | Database name |
| `DB_SSL` | `true` |
| `DB_SYNC` | `true` (first deploy) |
| `REDIS_HOST` | Upstash host |
| `REDIS_PORT` | `6379` |
| `REDIS_PASSWORD` | Upstash password |
| `REDIS_TLS` | `true` |
| `JWT_SECRET` | Random secret string |
| `ELASTICSEARCH_URL` | Bonsai URL with credentials |
| `EMBEDDING_SERVICE_URL` | HuggingFace Space URL |
| `SUPER_ADMIN_EMAIL` | Initial admin email |
| `SUPER_ADMIN_PASSWORD` | Initial admin password |

**Mobile APK (Android):** Build with `./gradlew assembleRelease` from `mobile/android/` — requires Java 21 (Android Studio JBR) and `sqlitejdbc.dll` fix (see `gradle.properties`).

---

## Architecture

```
mobile/              React Native (iOS + Android)
backend/             NestJS API — auth, products, search, admin
embedding-service/   Python FastAPI — CLIP + MiniLM + Elasticsearch KNN
infra/               nginx, Prometheus, Grafana, K8s manifests
docker-compose.yml   Full local stack
```

## Quick Start (Docker — recommended)

```bash
# 1. Configure environment
cp backend/.env.example backend/.env
# Edit backend/.env — set JWT_SECRET, SMTP credentials, etc.

# 2. Start everything
docker compose up -d

# 3. Wait ~60s for models to load, then:
# API:        http://localhost/api/v1
# Swagger:    http://localhost/api/docs
# Grafana:    http://localhost:3001  (admin / admin)
# Prometheus: http://localhost:9090
```

## Backend — Manual Setup

```bash
cd backend
npm install
cp .env.example .env        # fill in values
npm run start:dev           # http://localhost:3000
```

## Embedding Service — Manual Setup

```bash
cd embedding-service
python -m venv venv
source venv/bin/activate    # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

## Mobile App

```bash
cd mobile
npm install

# iOS
npx pod-install ios
npx react-native run-ios

# Android
npx react-native run-android
```

**Configure API URL** in `mobile/src/api/client.ts`:
```ts
// Android emulator
export const BASE_URL = 'http://10.0.2.2:3000/api/v1';
// iOS simulator or physical device on same network
export const BASE_URL = 'http://192.168.x.x:3000/api/v1';
```

---

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /auth/login | — | Login |
| GET  | /auth/me | JWT | Current user |
| POST | /auth/accept-invite | — | Set password from invite |
| POST | /search | JWT | Hybrid search (barcode/text/image) |
| POST | /search/image | JWT | Image file upload search |
| GET  | /products | JWT | List products (paginated) |
| GET  | /products/:id | JWT | Product detail |
| POST | /products | Admin | Create product |
| PUT  | /products/:id | Admin | Update product |
| DELETE | /products/:id | Admin | Delete product |
| POST | /products/:id/trigger-embedding | Admin | Re-generate embedding |
| GET  | /admin/users | Super Admin | List users |
| POST | /admin/users/invite | Super Admin | Invite user via email |
| POST | /admin/products/import/csv | Super Admin | Import CSV |
| POST | /admin/reindex/full | Super Admin | Reindex all products |
| POST | /admin/reindex/partial | Super Admin | Reindex missing embeddings |
| GET  | /admin/reindex/status | Super Admin | Queue status |
| GET  | /health | — | Liveness check |
| GET  | /metrics | — | JSON metrics |
| GET  | /metrics/prometheus | — | Prometheus scrape |

---

## Search Request

```json
POST /api/v1/search
{
  "barcode": "5901234123457",
  "text": "wireless headphones",
  "imageBase64": "<base64 JPEG/PNG>",
  "limit": 20,
  "weights": { "barcode": 1.0, "text": 0.75, "vector": 0.60 }
}
```

Response:
```json
{
  "results": [
    {
      "id": "uuid",
      "name": "Sony WH-1000XM5",
      "brand": "Sony",
      "score": 0.9312,
      "matchedBy": ["barcode"],
      "images": ["https://..."]
    }
  ],
  "meta": { "totalMs": 42, "cacheHit": true, "methods": ["barcode"] }
}
```

---

## CSV Import Format

```csv
name,brand,barcode,description,category,images
"Sony WH-1000XM5","Sony","4548736132450","Noise cancelling headphones","Electronics","https://img.com/1.jpg|https://img.com/2.jpg"
```

Upload via `POST /api/v1/admin/products/import/csv` (multipart, field name: `file`).

---

## Test Scenarios

### 1. Login → Search → Product → Logout
1. Open app → Login screen
2. Enter credentials → tap Sign In
3. Type "headphones" → results appear with match badges
4. Tap a result → product detail with image carousel
5. Tap Sign out → back to login

### 2. Barcode Scan → Instant Result
1. Tap ⬛ scan button
2. Point camera at barcode
3. App auto-navigates to product detail (< 1s)
4. If not found → "Product not found" with manual search option

### 3. Image Search
1. Tap 📷 camera button
2. Pick a product photo from gallery
3. Results ranked by visual similarity with "🔍 Visual" badge

### 4. Offline Handling
1. Disable network
2. Yellow "No internet connection" banner appears
3. Search buttons disabled
4. Re-enable network → banner disappears, search works

### 5. Admin: Invite → Accept → Login
```bash
# 1. Invite user (super_admin JWT required)
curl -X POST http://localhost:3000/api/v1/admin/users/invite \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email":"user@test.com","name":"Test User","role":"admin"}'

# 2. User receives email with invite link
# 3. Accept invite
curl -X POST http://localhost:3000/api/v1/auth/accept-invite \
  -d '{"token":"<invite_token>","password":"SecurePass123"}'

# 4. Login
curl -X POST http://localhost:3000/api/v1/auth/login \
  -d '{"email":"user@test.com","password":"SecurePass123"}'
```

### 6. Full Reindex
```bash
curl -X POST http://localhost:3000/api/v1/admin/reindex/full \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN"
# Monitor: GET /admin/reindex/status
```

---

## Performance Targets

| Operation | Target | Mechanism |
|-----------|--------|-----------|
| Barcode lookup | < 10ms | Indexed DB query |
| Text search | < 100ms | PostgreSQL FTS + trigram |
| Vector search | < 300ms | Elasticsearch HNSW KNN |
| Full pipeline | < 1s | Parallel text+vector, Redis cache |
| Cache hit | < 20ms | Redis |

---

## Scaling

```bash
# Scale API horizontally (Docker)
docker compose up --scale api=4 -d

# Scale embedding service
docker compose up --scale embedding-service=3 -d
```

For Kubernetes:
```bash
kubectl apply -f infra/k8s/
# HPA auto-scales API (2–10 pods) and embedding service (2–6 pods)
```

---

## Monitoring

- Grafana dashboard: `http://localhost:3001` — latency percentiles, cache hit rate, error rate, circuit breaker events
- Alerts fire on: p95 > 1s, error rate > 5%, circuit breaker trip, queue backlog > 10k
- All logs are structured JSON with `correlationId` for request tracing
