# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Local Development Startup
```bash
# Start only infra services (preferred for dev)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d postgres-primary redis

# Backend (NestJS)
cd backend && npm run start:dev   # http://localhost:3000, Swagger at /api/docs

# Mobile
cd mobile && npx expo start
```

### Backend
```bash
cd backend
npm run build
npm run start          # production (requires dist/)
npm run migration:run
npm run migration:generate
```

### Mobile
```bash
cd mobile
npm run lint           # eslint src --ext .ts,.tsx
npm test               # jest --forceExit (uses --runInBand + 8GB heap, see below)
npm run test:watch
npm run test:coverage
npm run build:android  # eas build --platform android
```

**OOM warning:** Never run bare `npx jest` or `jest --maxWorkers=N` — both spawn worker processes that crash. `npm test` is wired to `node --max-old-space-size=8192 node_modules/jest/bin/jest.js --forceExit --runInBand`.

### Embedding Service
```bash
cd embedding-service
uvicorn main:app --reload --port 8000
```

### Database Seeding
```bash
# Schema (must run before first `nest start` — typeorm_metadata must exist)
docker exec -i appproduit-postgres-primary-1 psql -U postgres -d product_search < backend/db/schema.sql

# Required manual table (TypeORM bug with GENERATED columns):
docker exec -i appproduit-postgres-primary-1 psql -U postgres -d product_search -c \
  "CREATE TABLE IF NOT EXISTS typeorm_metadata (type varchar NOT NULL, database varchar, schema varchar, \"table\" varchar, name varchar, value text);"

# Seed (40 French retail products: ART FLORAL, DÉCO INTÉRIEURE, TEXTILES MAISON, etc.)
docker exec -i appproduit-postgres-primary-1 psql -U postgres -d product_search < backend/db/seed.sql
```

### Windows Port Conflicts (Git Bash)
```bash
/c/Windows/System32/netstat.exe -ano | grep :3000
/c/Windows/System32/taskkill.exe //PID <pid> //F
# `kill <pid>` does NOT work for Windows processes
```

## Architecture

Three services + infra:

```
Mobile (React Native/Expo)
  └─→ Nginx (rate limiting, least-conn LB)
        └─→ API x2 (NestJS :3000)
              ├─→ PostgreSQL primary (writes) / replica (reads)
              ├─→ Redis :6379 (search cache 5min, embedding cache 1h)
              ├─→ Embedding Service x2 (FastAPI :8000)
              │     └─→ Elasticsearch :9200 (KNN HNSW vector search)
              └─→ Bull queue → embedding.processor.ts
```

**Port map:** PostgreSQL 5432, Redis 6379, NestJS 3000, Embedding 8000, ES 9200, Grafana 3001.

### Search Pipeline (`backend/src/search/search.service.ts`)
Three parallel paths merged with weighted scoring:
1. **Barcode** (weight 1.0) — direct SQL ILIKE
2. **Text** (weight 0.75) — PostgreSQL FTS + trigram fallback. Raw SQL params: `[$1=query, $2=limit, $3=fc, $4=fs, $5=ff, $6=fcg, $7=fde, $8=fe]`
3. **Vector** (weight 0.60) — calls embedding service → Elasticsearch KNN

Redis key format: `search:text:<hash_of_query_and_filters>`. Filter key allowlist: `['category', 'subcategory', 'family', 'codeGold', 'designation', 'ean']`.

### Bootstrap
`super-admin-bootstrap.service.ts` runs on every app start (`OnApplicationBootstrap`), upserting the super admin from `SUPER_ADMIN_EMAIL` + `SUPER_ADMIN_PASSWORD` env vars.

## Backend Conventions

**Module layout:** `feature.module.ts` + `feature.controller.ts` + `feature.service.ts`. DTOs inline in controllers. Entities: `user.entity.ts`, `product.entity.ts`.

**Auth guards:**
- `JwtAuthGuard` — required on all authenticated routes; injects `req.user` (password stripped at controller)
- `RolesGuard` + `@Roles(UserRole.SUPER_ADMIN)` — applied after JWT guard

**Input validation:** `SearchInputPipe` on POST /search — text (500 char), barcode (2048 char), image (5MB + magic bytes). Always use it for search endpoints.

**Email:** nodemailer, `SMTP_*` env vars. Wrap calls in try/catch and throw `BadRequestException` on failure.

**Bull queue:** `embedding` queue. Circuit breaker: 5 consecutive failures → 30s cooldown.

## Mobile Conventions

**Theme** (all from `src/theme/index.ts` — never hardcode values):
- Colors: `colors.primary` (#4f46e5), `colors.surface`, `colors.bg`, `colors.error`, `colors.errorLight`, `colors.textMuted`, `colors.placeholder`
- Spacing: `spacing.xs`(4) `sm`(8) `md`(12) `lg`(16) `xl`(20) `xxl`(24) `xxxl`(32)
- Radius: `radius.sm/md/lg/xl/full`, Typography: `typography.h1/h2/h3/body/small/caption/label`
- Touch: `hitSlop` (12px all sides)

**i18n:** Always add keys to both `en` and `fr` in `translations.ts`. French strings with apostrophes **must** use double-quotes: `"Envoyer l'invitation"` not `'Envoyer l'invitation'`.

**Navigation routes:** Login, ForgotPassword, Search, Scanner, ProductDetail, Profile, Catalog, Users, InviteUser. Auth check in `AppNavigator.tsx`.

**State pattern:** Zustand store actions call API functions, update state on success, throw on error. API client: `src/api/client.ts` — base URL `http://192.168.1.89:3000/api/v1`, 401 triggers logout.

**Reusable components:**
- `EmptyState`: props `icon, title, subtitle?, actionLabel?, onAction?`
- `ErrorBanner`: props `message, onRetry?` — place above result lists

**Role-based UI:** Check `user?.role === 'super_admin'` to show admin features.

## Testing Conventions (Mobile)

**Zustand store mock** — must handle both selector and non-selector call forms:
```typescript
jest.mock('../../store/authStore', () => ({ useAuthStore: jest.fn() }));
(useAuthStore as jest.Mock).mockImplementation((selector?: any) =>
  typeof selector === 'function' ? selector(mockState) : mockState,
);
```

**jest.mock hoisting:** `jest.mock()` is hoisted above variable declarations — never reference module-level variables inside a factory. Use `jest.fn()` in the factory, import and cast: `const mockFn = importedFn as jest.Mock`.

**RNTL v12 query API:**
- `getByLabelText('label')` — queries `accessibilityLabel` (`getByAccessibilityLabel` does not exist)
- `getByText(/regex/)` — use regex when text has emoji prefixes

## Deployment

- **Backend:** Render (free tier) with Neon (PostgreSQL), Upstash (Redis), Bonsai (Elasticsearch). Health check: `GET /api/v1/health`.
- **Mobile:** EAS Build (project `6b906e5b-da20-4f45-a164-423a3c816917`), GitHub Actions for APK signing.
- **Full stack:** `docker compose up` (9 services). Scale: `docker compose up --scale api=4 embedding-service=3`.

**Performance targets:** barcode <10ms, text <100ms, vector <300ms, full <1s.
