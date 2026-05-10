# Phase 1 And 2 Stabilization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stabilize the current Vue/Express Calibre app so runtime auth, app database bootstrap, builds, Docker images, and CI are reliable enough for future product work.

**Architecture:** Keep Vue + Express + TypeScript + SQLite. Phase 1 standardizes backend runtime behavior around server-side Passport sessions, explicit authorization checks, app DB migrations, and route-level tests. Phase 2 makes deployment reproducible with Node 22 Docker images, nginx API proxying, Compose environment wiring, and CI build checks.

**Tech Stack:** Vue 3, Vite, Pinia, Express 4, Passport Google OAuth, express-session, better-sqlite3, Vitest, Supertest, Docker, nginx, GitHub Actions.

---

## Phase 1: Stabilize Runtime

### Task 1: Prove The Current Runtime Failures

**Files:**
- Read: `docs/CODE_AUDIT_REPORT.md`
- Read: `backend/src/index.ts`
- Read: `backend/src/middleware/authMiddleware.ts`
- Read: `backend/src/routes/index.ts`
- Read: `backend/src/routes/authRoutes.ts`
- Read: `backend/src/controllers/googleAuthController.ts`

- [ ] **Step 1: Run backend tests as a baseline**

Run:

```bash
cd backend && npm test -- --run
```

Expected: existing tests pass before behavior changes.

- [ ] **Step 2: Run frontend tests as a baseline**

Run:

```bash
cd frontend && npm test -- --run
```

Expected: existing tests pass before behavior changes.

- [ ] **Step 3: Run backend build to capture the TypeScript failure**

Run:

```bash
cd backend && npm run build
```

Expected: FAIL with current Express/session/passport type errors. Keep the error text in the task notes before fixing it.

- [ ] **Step 4: Run frontend build as a baseline**

Run:

```bash
cd frontend && npm run build
```

Expected: PASS.

- [ ] **Step 5: Commit the baseline notes if tracked**

Only commit if implementation notes are recorded in a tracked file:

```bash
git add docs/superpowers/plans/2026-05-10-phase-1-2-stabilization.md
git commit -m "docs: plan phase 1 and 2 stabilization"
```

**Baseline notes captured on 2026-05-10:**

```text
cd backend && npm test -- --run: PASS, 43 tests passed.
cd frontend && npm test -- --run: PASS, 8 tests passed.
cd backend && npm run build: FAIL with expected TypeScript errors:
  src/index.ts(46,9): error TS2769: No overload matches this call.
  src/index.ts(58,9): error TS2769: No overload matches this call.
  src/middleware/authMiddleware.ts(28,7): error TS2717: Subsequent property declarations must have the same type. Property 'user' must be of type 'User | undefined', but here has type 'any'.
  src/middleware/authMiddleware.ts(29,7): error TS2386: Overload signatures must all be optional or required.
cd frontend && npm run build: PASS.
```

### Task 2: Fix Express Type Boundaries And App Creation

**Files:**
- Create: `backend/src/types/express.d.ts`
- Create: `backend/src/app.ts`
- Modify: `backend/src/index.ts`
- Modify: `backend/src/middleware/authMiddleware.ts`
- Modify: `backend/tsconfig.json`

- [ ] **Step 1: Move global Express augmentation into a declaration file**

Create `backend/src/types/express.d.ts` with the shared request/session user shape:

```ts
import { UserStatus } from '../services/authService';

declare global {
  namespace Express {
    interface User {
      id: number;
      username: string;
      email: string;
      isAdmin: boolean;
      googleId?: string;
      displayName?: string;
      picture?: string;
      status: UserStatus;
    }
  }
}

export {};
```

- [ ] **Step 2: Remove inline global augmentation from auth middleware**

In `backend/src/middleware/authMiddleware.ts`, delete the `declare global` block. Express request/session user typing now comes from `backend/src/types/express.d.ts`.

- [ ] **Step 3: Extract Express app creation from server startup**

Create `backend/src/app.ts` with a `createApp()` function that accepts initialized services and returns an Express app. Move middleware setup and `setupRoutes(app)` into this file so Supertest can exercise the real route stack without listening on a port.

Minimum shape:

```ts
import express from 'express';
import session from 'express-session';
import cors from 'cors';
import passport from 'passport';
import { setupRoutes } from './routes';
import { CalibreService } from './services/calibreService';
import { AuthService } from './services/authService';
import { initializeController as initializeBookController } from './controllers/bookController';
import { initializeController as initializeAuthController } from './controllers/authController';
import { initializeController as initializeGoogleAuthController } from './controllers/googleAuthController';
import { initializeController as initializeAdminController } from './controllers/adminController';
import { initializeMiddleware as initializeAuthMiddleware } from './middleware/authMiddleware';
import { requestLogger } from './middleware/loggingMiddleware';

export interface AppServices {
  calibreService: CalibreService;
  authService: AuthService;
}

export function createApp({ calibreService, authService }: AppServices) {
  const app = express();

  app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true
  }));
  app.use(express.json());
  app.use(requestLogger);
  app.use(session({
    secret: process.env.SESSION_SECRET || 'development-session-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000
    }
  }));
  app.use(passport.initialize());
  app.use(passport.session());

  initializeBookController(calibreService);
  initializeAuthController(authService);
  initializeGoogleAuthController(authService);
  initializeAdminController(authService);
  initializeAuthMiddleware(authService);

  setupRoutes(app);

  return app;
}
```

- [ ] **Step 4: Reduce `backend/src/index.ts` to startup only**

Keep env loading, database opening, service creation, `createApp()`, and `app.listen()` in `backend/src/index.ts`. Do not configure routes or middleware there.

- [ ] **Step 5: Run backend build**

Run:

```bash
cd backend && npm run build
```

Expected: TypeScript still may fail until auth middleware and tests are updated, but `index.ts` session/passport setup errors should be gone.

### Task 3: Implement App Database Bootstrap

**Files:**
- Create: `backend/src/db/appSchema.ts`
- Modify: `backend/src/index.ts`
- Modify: `backend/src/services/authService.ts`
- Test: `backend/src/db/__tests__/appSchema.test.ts`

- [ ] **Step 1: Write migration tests**

Create `backend/src/db/__tests__/appSchema.test.ts`:

```ts
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { initializeAppSchema } from '../appSchema';

describe('initializeAppSchema', () => {
  it('creates users table with approval fields', () => {
    const db = new Database(':memory:');

    initializeAppSchema(db);

    const columns = db.prepare('PRAGMA table_info(users)').all() as Array<{ name: string }>;
    expect(columns.map(column => column.name)).toEqual(expect.arrayContaining([
      'id',
      'username',
      'email',
      'google_id',
      'display_name',
      'picture',
      'is_admin',
      'status',
      'created_at',
      'updated_at'
    ]));
  });

  it('is safe to run more than once', () => {
    const db = new Database(':memory:');

    initializeAppSchema(db);
    initializeAppSchema(db);

    const result = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'users'").get();
    expect(result).toEqual({ name: 'users' });
  });
});
```

- [ ] **Step 2: Run the migration test and verify it fails**

Run:

```bash
cd backend && npm test -- --run src/db/__tests__/appSchema.test.ts
```

Expected: FAIL because `appSchema.ts` does not exist yet.

- [ ] **Step 3: Implement schema bootstrap**

Create `backend/src/db/appSchema.ts`:

```ts
import Database from 'better-sqlite3';

export function initializeAppSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      google_id TEXT UNIQUE,
      display_name TEXT,
      picture TEXT,
      is_admin INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
    CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
  `);
}
```

- [ ] **Step 4: Call schema bootstrap on startup**

In `backend/src/index.ts`, after opening `appDb`, call:

```ts
initializeAppSchema(appDb);
```

- [ ] **Step 5: Update auth service selectors**

In `backend/src/services/authService.ts`, make every `SELECT` include `google_id`, `display_name`, `picture`, and `status` so returned `User` objects are complete and consistent.

- [ ] **Step 6: Run migration and auth service tests**

Run:

```bash
cd backend && npm test -- --run src/db/__tests__/appSchema.test.ts src/services/__tests__/authService.test.ts
```

Expected: PASS.

### Task 4: Choose And Enforce Session-Only Auth

**Files:**
- Modify: `backend/src/middleware/authMiddleware.ts`
- Modify: `backend/src/controllers/authController.ts`
- Modify: `backend/src/services/authService.ts`
- Modify: `backend/src/routes/authRoutes.ts`
- Modify: `frontend/src/api/axios.ts`
- Modify: `frontend/src/stores/authStore.ts`

- [ ] **Step 1: Remove frontend bearer token injection**

In `frontend/src/api/axios.ts`, remove `localStorage.getItem('auth_token')` and `Authorization` header injection. Set axios credentials:

```ts
const api = axios.create({
  baseURL: appConfig.apiUrl,
  withCredentials: true
});
```

- [ ] **Step 2: Make auth middleware deterministic**

Update `backend/src/middleware/authMiddleware.ts` so every request either continues or returns:

```ts
import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/authService';
import logger from '../utils/logger';

let authService: AuthService | undefined;

export const initializeMiddleware = (service: AuthService) => {
  authService = service;
};

export const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (typeof req.isAuthenticated === 'function' && req.isAuthenticated() && req.user) {
      if (req.user.status !== 'approved') {
        return res.status(403).json({ error: 'Account is not approved', status: req.user.status });
      }

      return next();
    }

    return res.status(401).json({ error: 'Authentication required' });
  } catch (error) {
    logger.error(`Authentication error: ${error}`);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
```

- [ ] **Step 3: Make `/api/auth/me` responsible for reporting session state**

Change `backend/src/routes/authRoutes.ts` so `GET /me` is not behind `authenticateToken`. It should report `authenticated: false` for anonymous sessions and current user/status for authenticated sessions.

- [ ] **Step 4: Simplify `getCurrentUser()`**

In `backend/src/controllers/authController.ts`, remove JWT parsing. Return:

```ts
if (typeof req.isAuthenticated !== 'function' || !req.isAuthenticated() || !req.user) {
  return res.status(401).json({ authenticated: false });
}

return res.json({
  authenticated: req.user.status === 'approved',
  user: req.user,
  status: req.user.status
});
```

- [ ] **Step 5: Update logout to destroy the session**

In `backend/src/controllers/authController.ts`, use `req.logout()` and `req.session.destroy()` when available, then return `{ message: 'Logged out successfully' }`.

- [ ] **Step 6: Remove JWT generation and verification**

In `backend/src/services/authService.ts`, remove `jsonwebtoken`, `JWT_SECRET`, `generateToken()`, and `verifyToken()` unless another direct caller remains after the frontend and auth controller changes.

- [ ] **Step 7: Run auth-related tests**

Run:

```bash
cd backend && npm test -- --run src/controllers/__tests__/authController.test.ts src/services/__tests__/authService.test.ts
cd frontend && npm test -- --run
```

Expected: PASS after updating tests for session-only auth.

### Task 5: Make OAuth Approval Flow Deterministic

**Files:**
- Modify: `backend/src/controllers/googleAuthController.ts`
- Modify: `frontend/src/views/GoogleCallbackView.vue`
- Modify: `frontend/src/stores/authStore.ts`
- Test: `backend/src/controllers/__tests__/googleAuthController.test.ts`

- [ ] **Step 1: Write callback behavior tests**

Add tests proving:

- Pending users are redirected to `/auth/google/callback?status=pending`.
- Denied users are redirected to `/auth/google/callback?status=denied`.
- Approved users get a session and are redirected to `/auth/google/callback?status=approved`.

- [ ] **Step 2: Enable OAuth state**

In `authenticateGoogle()`, use:

```ts
return passport.authenticate('google', { scope: ['profile', 'email'], state: true });
```

- [ ] **Step 3: Do not create app sessions for pending or denied users**

Keep pending and denied users out of protected routes. Use deterministic redirect query parameters instead of relying on `/auth/me` to discover a session that was not created.

- [ ] **Step 4: Update the callback view**

In `frontend/src/views/GoogleCallbackView.vue`, first read `route.query.status`. Show pending/denied states directly when present. Only call `authStore.checkAuth()` for approved/no-status callbacks.

- [ ] **Step 5: Run OAuth and frontend tests**

Run:

```bash
cd backend && npm test -- --run src/controllers/__tests__/googleAuthController.test.ts
cd frontend && npm test -- --run
```

Expected: PASS.

### Task 6: Add Route-Level Integration Coverage

**Files:**
- Create: `backend/src/__tests__/app.auth.test.ts`
- Create: `backend/src/__tests__/app.books.test.ts`
- Modify: `backend/src/app.ts`

- [ ] **Step 1: Write Supertest auth route tests**

Create `backend/src/__tests__/app.auth.test.ts` to verify:

- `GET /api/books` returns `401` when anonymous.
- `GET /api/admin/pending-users` returns `401` when anonymous.
- `GET /api/admin/pending-users` returns `403` for approved non-admin users.
- `GET /api/admin/pending-users` returns `200` for approved admin users.
- `GET /api/books` returns `403` for pending/denied sessions.

- [ ] **Step 2: Write Supertest books route tests**

Create `backend/src/__tests__/app.books.test.ts` to verify:

- Approved sessions can list books.
- Invalid book IDs return `400`.
- Missing book IDs return `404`.

- [ ] **Step 3: Add test-only session injection**

In `backend/src/app.ts`, add a test-only helper middleware option or exported session helper so tests can install `req.user` and `req.isAuthenticated()` without Google OAuth.

- [ ] **Step 4: Run integration tests**

Run:

```bash
cd backend && npm test -- --run src/__tests__/app.auth.test.ts src/__tests__/app.books.test.ts
```

Expected: PASS.

### Task 7: Remove Secret And Header Logging

**Files:**
- Modify: `backend/src/index.ts`
- Modify: `backend/src/middleware/loggingMiddleware.ts`
- Test: `backend/src/middleware/__tests__/loggingMiddleware.test.ts`

- [ ] **Step 1: Replace environment dump with config allowlist**

In `backend/src/index.ts`, log only non-sensitive values:

```ts
logger.info(`NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
logger.info(`PORT: ${process.env.PORT || 3000}`);
logger.info(`FRONTEND_URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
logger.info(`CALIBRE_DB_NAME: ${process.env.CALIBRE_DB_NAME || 'bob.db'}`);
logger.info(`APP_DB_PATH: ${process.env.APP_DB_PATH || 'app.db'}`);
```

- [ ] **Step 2: Redact sensitive request headers**

In `backend/src/middleware/loggingMiddleware.ts`, redact `authorization`, `cookie`, `set-cookie`, and any key containing `token`, `secret`, or `key` before logging.

- [ ] **Step 3: Run logging tests and backend build**

Run:

```bash
cd backend && npm test -- --run src/middleware/__tests__/loggingMiddleware.test.ts
cd backend && npm run build
```

Expected: PASS.

### Task 8: Phase 1 Verification Gate

**Files:**
- Modify only files already touched in Phase 1 if verification reveals failures.

- [ ] **Step 1: Run backend tests**

Run:

```bash
cd backend && npm test -- --run
```

Expected: PASS.

- [ ] **Step 2: Run backend build**

Run:

```bash
cd backend && npm run build
```

Expected: PASS.

- [ ] **Step 3: Run frontend tests**

Run:

```bash
cd frontend && npm test -- --run
```

Expected: PASS.

- [ ] **Step 4: Run frontend build**

Run:

```bash
cd frontend && npm run build
```

Expected: PASS.

- [ ] **Step 5: Commit Phase 1**

Run:

```bash
git add backend frontend
git commit -m "fix: stabilize backend runtime auth"
```

## Phase 2: Fix Deployment

### Task 9: Make Docker Build Contexts Clean

**Files:**
- Create: `backend/.dockerignore`
- Create: `frontend/.dockerignore`

- [ ] **Step 1: Add backend dockerignore**

Create `backend/.dockerignore`:

```dockerignore
node_modules
dist
logs
*.db
*.sqlite
.development.env
.prod.env
.env
npm-debug.log*
```

- [ ] **Step 2: Add frontend dockerignore**

Create `frontend/.dockerignore`:

```dockerignore
node_modules
dist
.env
.env.*
npm-debug.log*
```

- [ ] **Step 3: Verify no local env files are copied**

Run:

```bash
docker build -f backend/Dockerfile backend
```

Expected after later Dockerfile fixes: image build does not require `.development.env`.

### Task 10: Rewrite Backend Dockerfile For Production

**Files:**
- Modify: `backend/Dockerfile`
- Modify: `backend/package.json`

- [ ] **Step 1: Change production start script**

In `backend/package.json`, change:

```json
"start": "node dist/index.js"
```

Keep `dev` as the ts-node/nodemon script.

- [ ] **Step 2: Replace backend Dockerfile**

Use Node 22, `npm ci`, build TypeScript, prune dev dependencies, and run as non-root:

```dockerfile
FROM node:22-alpine AS deps
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /usr/src/app
COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY . .
RUN npm run build
RUN npm prune --omit=dev

FROM node:22-alpine AS runtime
WORKDIR /usr/src/app
ENV NODE_ENV=production
COPY --from=build --chown=node:node /usr/src/app/package*.json ./
COPY --from=build --chown=node:node /usr/src/app/node_modules ./node_modules
COPY --from=build --chown=node:node /usr/src/app/dist ./dist
USER node
EXPOSE 3000
CMD ["npm", "start"]
```

- [ ] **Step 3: Build backend image**

Run:

```bash
docker build -f backend/Dockerfile backend
```

Expected: PASS.

### Task 11: Rewrite Frontend Dockerfile And nginx Proxy

**Files:**
- Modify: `frontend/Dockerfile`
- Create: `frontend/nginx.conf`

- [ ] **Step 1: Add nginx config with `/api` proxy**

Create `frontend/nginx.conf`:

```nginx
server {
  listen 80;
  server_name _;

  root /usr/share/nginx/html;
  index index.html;

  location /api/ {
    proxy_pass http://backend:3000/api/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

- [ ] **Step 2: Replace frontend Dockerfile**

Use a named `builder` stage and copy the nginx config:

```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:stable-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

- [ ] **Step 3: Build frontend image**

Run:

```bash
docker build -f frontend/Dockerfile frontend
```

Expected: PASS.

### Task 12: Wire Compose And Environment Examples

**Files:**
- Modify: `docker-compose.yml`
- Create: `.env.example`
- Modify: `README.md`

- [ ] **Step 1: Create `.env.example`**

Create `.env.example`:

```dotenv
FRONTEND_PORT=8888
BACKEND_PORT=3000
FRONTEND_URL=http://localhost:8888
SESSION_SECRET=replace-with-a-long-random-value
GOOGLE_CLIENT_ID=replace-with-google-client-id
GOOGLE_CLIENT_SECRET=replace-with-google-client-secret
CALIBRE_DB_PATH=/absolute/path/to/calibre/library
CALIBRE_DB_NAME=metadata.db
APP_DB_PATH=/usr/src/app/data/app/app.db
```

- [ ] **Step 2: Update Compose for production defaults**

Modify `docker-compose.yml` so:

- Frontend maps `${FRONTEND_PORT:-8888}:80`.
- Backend maps `${BACKEND_PORT:-3000}:3000`.
- Backend receives `SESSION_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `FRONTEND_URL`, `APP_DB_PATH`, and `CALIBRE_DB_NAME`.
- Backend mounts `${CALIBRE_DB_PATH}:/usr/src/app/data/calibre:ro`.
- Backend stores app data in a named volume mounted at `/usr/src/app/data/app`.

- [ ] **Step 3: Align backend Calibre path handling**

In `backend/src/index.ts`, compute the Calibre DB path from mounted directory plus file name:

```ts
const calibreDbDir = process.env.CALIBRE_DB_DIR || '/usr/src/app/data/calibre';
const calibreDbName = process.env.CALIBRE_DB_NAME || 'metadata.db';
const calibreDbPath = path.join(calibreDbDir, calibreDbName);
```

Set `APP_DB_PATH` default to `/usr/src/app/data/app/app.db` in production.

- [ ] **Step 4: Update README deployment section**

Document:

- Copy `.env.example` to `.env`.
- Set Google OAuth callback URL to `http://localhost:8888/api/auth/google/callback` for local Compose, or the deployed frontend origin plus `/api/auth/google/callback`.
- Run `docker compose up --build`.
- Use `docker-compose up --build` only if the older CLI is installed.

### Task 13: Add CI Build And Docker Checks

**Files:**
- Modify: `.github/workflows/test.yml`

- [ ] **Step 1: Move CI to Node 22**

Set the matrix to:

```yaml
node-version: [22.x]
```

- [ ] **Step 2: Make tests non-watch**

Use:

```yaml
- name: Run backend tests
  run: cd backend && npm test -- --run

- name: Run frontend tests
  run: cd frontend && npm test -- --run
```

- [ ] **Step 3: Add build steps**

Add:

```yaml
- name: Build backend
  run: cd backend && npm run build

- name: Build frontend
  run: cd frontend && npm run build
```

- [ ] **Step 4: Add Docker build steps**

Add:

```yaml
- name: Build backend Docker image
  run: docker build -f backend/Dockerfile backend

- name: Build frontend Docker image
  run: docker build -f frontend/Dockerfile frontend
```

- [ ] **Step 5: Run CI commands locally**

Run:

```bash
cd backend && npm test -- --run
cd frontend && npm test -- --run
cd backend && npm run build
cd frontend && npm run build
docker build -f backend/Dockerfile backend
docker build -f frontend/Dockerfile frontend
```

Expected: all PASS.

### Task 14: Phase 2 Verification Gate

**Files:**
- Modify only files already touched in Phase 2 if verification reveals failures.

- [ ] **Step 1: Run all package tests and builds**

Run:

```bash
cd backend && npm test -- --run
cd frontend && npm test -- --run
cd backend && npm run build
cd frontend && npm run build
```

Expected: PASS.

- [ ] **Step 2: Run Docker image builds**

Run:

```bash
docker build -f backend/Dockerfile backend
docker build -f frontend/Dockerfile frontend
```

Expected: PASS.

- [ ] **Step 3: Run Compose config validation if Compose is available**

Run one of:

```bash
docker compose config
```

or:

```bash
docker-compose config
```

Expected: PASS if the CLI is installed. If neither command exists, record that local Compose validation was not available.

- [ ] **Step 4: Commit Phase 2**

Run:

```bash
git add .github docker-compose.yml .env.example README.md backend frontend
git commit -m "fix: make docker deployment reproducible"
```

## Execution Order And Checkpoints

- Phase 1 must finish before Phase 2 starts. Docker should not be fixed around code that does not compile or authenticate predictably.
- After Task 4, stop and manually review the session-only auth decision before continuing OAuth callback changes.
- After Task 8, the backend and frontend must both test and build cleanly.
- After Task 14, both Docker images must build cleanly and CI must enforce tests plus builds.

## Out Of Scope For These Phases

- Dependency vulnerability upgrades except where required by Node 22 or build failures.
- Durable SQLite session store. This should be handled after session-only auth is proven; current Phase 1 keeps the existing session store but makes behavior deterministic.
- Postgres, email notifications, OPDS, book detail expansion, admin settings, and Calibre metadata browsing.
- Full hosted/SaaS auth hardening beyond Google OAuth state, secret logging removal, and deterministic approval checks.
