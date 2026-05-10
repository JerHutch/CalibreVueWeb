# CalibreVueWeb Code Audit Report

Date: 2026-05-10

## Executive Summary

This application should not be rewritten from scratch or moved to a different language yet. Vue, Express, TypeScript, SQLite, and Docker are reasonable choices for a self-hosted Calibre browser. The current problem is not the stack; it is that several core seams are incomplete or internally inconsistent: authentication mixes sessions and JWTs without a working boundary, the app database has no schema/bootstrap path, Docker images do not build, and CI does not catch the backend TypeScript failure.

The right next step is a focused stabilization pass, not a rewrite:

1. Fix auth and authorization as the first priority.
2. Add migrations/bootstrap for the app database.
3. Fix backend TypeScript compilation and make CI run builds.
4. Rebuild Docker for a real production and development story.
5. Add integration tests around routes, auth states, downloads, and containers.

## What The App Currently Does

The repository is a two-package TypeScript application:

- `frontend/`: Vue 3, Vite, Pinia, Vue Router, Tailwind.
- `backend/`: Express, Passport Google OAuth, sessions, JWT helpers, `better-sqlite3`.
- `docker-compose.yml`: intended to run frontend and backend as separate services.

The backend reads a Calibre SQLite database from `./data/<CALIBRE_DB_NAME>`, defaulting to `bob.db`, and opens a separate local app SQLite database at `APP_DB_PATH` or `app.db`. The frontend calls `/api` via Vite proxy in development and expects books, covers, downloads, Google login, and an admin approval view.

The requirements and README describe features that are only partially implemented:

- Manual OAuth approval exists in service/controller shape, but the login flow does not make pending/denied states usable.
- Admin approval endpoints exist, but admin access depends on broken middleware.
- Postgres, email approval notifications, admin configuration, database reload/update detection, and book details are not implemented.
- Docker is documented as ready, but both images fail to build as currently written.

## Verification Results

Commands run locally:

| Check | Result |
| --- | --- |
| `cd backend && npm test -- --run` | Passed: 43 tests |
| `cd frontend && npm test -- --run` | Passed: 8 tests |
| `cd backend && npm run build` | Failed: TypeScript errors |
| `cd frontend && npm run build` | Passed |
| `docker build -f frontend/Dockerfile frontend` | Failed: missing `builder` stage |
| `docker build -f backend/Dockerfile backend` | Failed: missing `.development.env` |
| `npm exec -- vitest run --coverage` in backend | Failed: missing `@vitest/coverage-v8` |
| `npm audit --omit=dev` | Failed: 17 production dependency advisories |

Docker Compose CLI availability is also inconsistent on this machine: `docker compose` is not available and `docker-compose` is not installed.

## Critical Findings

### 1. Protected API Authentication Is Broken

`backend/src/middleware/authMiddleware.ts:11` only checks `req.isAuthenticated()` from Passport. It does not validate the JWT token that the frontend stores in `localStorage`, does not load the user from the app DB, does not enforce `status === approved`, and does not send a `401` response when unauthenticated.

Effect:

- Unauthenticated `/api/books` and `/api/admin` requests can hang indefinitely instead of failing.
- `/api/auth/me` is itself protected by this middleware in `backend/src/routes/authRoutes.ts:32`, so the frontend callback flow can dead-end.
- `initializeMiddleware()` exists but is not called from `backend/src/index.ts`, so the middleware cannot use `AuthService` anyway.

Recommendation:

Choose one auth model and implement it cleanly:

- Preferred for this app: server-side sessions after Google OAuth, with a durable SQLite session store.
- Acceptable alternative: Google OAuth callback issues a signed app JWT after approval.

Do not keep both as half-implemented paths. Middleware should always either set `req.user` and call `next()`, or return `401`/`403`.

### 2. OAuth Approval Flow Cannot Work As Described

`backend/src/controllers/googleAuthController.ts:121` rejects pending users with `done(null, false, ...)`, which means no session is created. Then the frontend callback page calls `/auth/me` to learn whether the account is pending, but that endpoint is protected by the broken middleware.

Effect:

- New users can be created as pending, but the UI cannot reliably show pending status after OAuth.
- Denied/pending states are not part of a coherent login protocol.
- The admin approval workflow is present in code but not operational end to end.

Recommendation:

After Google proves identity, create or update the local user and then redirect to a deterministic frontend state:

- Pending: show pending page without granting library access.
- Denied: show denied page.
- Approved: create session/JWT and redirect to books.

### 3. Backend TypeScript Build Fails

`cd backend && npm run build` fails with Express/session/passport type errors in `backend/src/index.ts:46` and `backend/src/index.ts:58`, plus conflicting Express request augmentation in `backend/src/middleware/authMiddleware.ts:28`.

`backend/tsconfig.json:11` sets `ts-node.transpileOnly = true`, so development can run while type errors remain hidden.

Recommendation:

Fix type augmentation once in a dedicated declaration file, align Express/session/passport types, and remove reliance on transpile-only behavior as a way to mask build errors.

### 4. Docker Is Not Deployable

Frontend:

- `frontend/Dockerfile:30` uses `COPY --from=builder`, but no stage is named `builder`.
- The file never runs `npm run build` before trying to copy `/app/dist`.
- Node 18 emits an engine warning for Tailwind native dependencies that now want Node 20.

Backend:

- `backend/Dockerfile:18` copies `.development.env`, which is absent and should not be baked into an image.
- The image uses Node 18 while `backend/tsconfig.json` extends Node 22 settings.

Compose:

- `docker-compose.yml:34` only sets `NODE_ENV=development`, not `SESSION_SECRET`, `JWT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `FRONTEND_URL`, `APP_DB_PATH`, or `CALIBRE_DB_NAME`.
- The frontend production nginx image has no `/api` reverse proxy config.
- The Calibre path mount depends on `${CALIBRE_DB_PATH}` but the backend ignores that as a database file name and instead reads `./data/${CALIBRE_DB_NAME || 'bob.db'}`.

Recommendation:

Create separate dev and prod Docker paths. For production, use Node 22, `npm ci`, non-root users, no copied local env files, a named frontend builder stage, and nginx config that proxies `/api` to the backend service.

## High-Risk Security Findings

### Secret And Token Logging

`backend/src/index.ts:22` logs nearly every environment variable and masks only `SESSION_SECRET` and `GOOGLE_CLIENT_SECRET`. This can leak `JWT_SECRET`, database paths, tokens injected by hosting platforms, and future secrets.

`backend/src/middleware/loggingMiddleware.ts:58` logs all request headers, including `Authorization` and cookies.

Recommendation:

Stop logging full environments and headers. Log a small allowlist of non-sensitive configuration values, and redact `authorization`, `cookie`, `set-cookie`, `token`, `secret`, `key`, and similar fields recursively.

### Insecure Default Secrets

`backend/src/index.ts:47` and `backend/src/services/authService.ts:35` fall back to `your-secret-key`.

Recommendation:

In production, refuse to start unless strong `SESSION_SECRET` and any JWT secret are present. If JWTs are removed, remove JWT secret handling entirely.

### OAuth And Session Hardening Gaps

The Google OAuth route does not explicitly enable or validate anti-forgery `state`. Google’s own OpenID Connect documentation describes state/nonce validation as part of the server flow and strongly encourages using well-debugged libraries for authentication. Passport can be acceptable, but the app must configure state and sessions correctly.

The app also uses the default in-memory Express session store and lacks production-grade cookie settings such as explicit `sameSite`, proxy awareness, and durable session persistence.

Recommendation:

If staying on Passport, configure OAuth state and use a durable session store. If replacing it, consider `openid-client` for a direct standards-based OpenID Connect implementation. `@auth/express` exists, but its own package/docs present it as the Express integration for Auth.js and the ecosystem around it is still less settled for a small standalone Express app than `openid-client` plus explicit app sessions.

Sources checked:

- Passport Google OAuth package: https://www.npmjs.com/package/passport-google-oauth20
- Auth.js Express package: https://www.npmjs.com/package/@auth/express
- OpenID Client package: https://www.npmjs.com/package/openid-client
- Google OpenID Connect docs: https://developers.google.com/identity/openid-connect/openid-connect

## Architecture Assessment

The current architecture is salvageable:

- A Vue SPA plus Express API is a normal fit for this app.
- Direct read-only access to Calibre SQLite can work for a personal/home-server deployment.
- A separate app DB for users, approvals, sessions, and settings is the right boundary.
- Docker Compose is a reasonable deployment target for Synology or home servers.

The weak points are implementation boundaries:

- Controllers depend on module-level mutable service singletons instead of app-level dependency injection.
- Auth state is split between Passport sessions, JWT helper methods, and frontend local storage.
- There is no migration layer for the app DB.
- There are no integration tests proving that the actual Express route stack behaves.
- File path generation assumes Calibre metadata maps directly to safe filesystem paths.

This does not justify a full rewrite. It justifies a short stabilization phase before feature work.

## Test Coverage Report

Current tests:

- Backend service tests cover mocked `CalibreService` query behavior and path construction.
- Backend controller tests call controller functions directly with mocked services/responses.
- Backend auth tests cover a small part of `AuthService.getUserById` and `authController.getCurrentUser`.
- Frontend tests cover the Pinia book store.

Major gaps:

- No route-level Supertest coverage for `/api` middleware behavior.
- No tests for unauthenticated, pending, denied, approved, and admin users through the real route stack.
- No OAuth callback/session tests.
- No migration/schema tests.
- No real or fixture Calibre `metadata.db` compatibility test.
- No Docker build test in CI.
- No build/typecheck step in CI.
- No frontend component/router tests for login callback, admin view, or book cards.
- No coverage provider installed, so coverage reporting cannot run.

The test count looks decent for a small project, but coverage quality is shallow because the tests mock away most failure-prone integration points. The current passing test suite should be treated as a smoke signal, not evidence that the application works end to end.

## Dependency Health

`npm audit --omit=dev` reports 17 production dependency vulnerabilities:

- 1 critical
- 10 high
- 3 moderate
- 3 low

Notable packages include `form-data`, `axios`, `express`, `express-session`, `jsonwebtoken` via `jws`, `vite`, `rollup`, `tar`, and `tar-fs`.

Recommendation:

Run a controlled dependency update after the auth/build stabilization work starts. Avoid `npm audit fix --force` blindly; update direct dependencies deliberately, run backend/frontend tests and builds, then retest Docker.

## Should This Be Rewritten?

No, not now.

A rewrite would spend effort replacing working or nearly working pieces while preserving the same product problems: auth rules, user approval lifecycle, app database schema, deployment shape, and tests. Those need design decisions, not a different language.

A rewrite might become reasonable only if the product direction changes substantially, for example:

- Multi-user hosted SaaS instead of home-server app.
- Heavy library indexing/search at large scale.
- Native mobile-first reading/sync experience.
- Integration with multiple identity providers, remote storage, and background workers.

For the current goal, stabilize this codebase.

## Should It Be Rewritten In Another Language?

No. TypeScript is a good fit because both frontend and backend share language and tooling, and the app is mostly API glue, auth, SQLite reads, and UI.

Python/FastAPI would be reasonable for a Calibre-oriented backend because Python has strong ebook tooling, but switching would not automatically fix auth, Docker, tests, or schema management. Go would produce a compact binary and strong deployment story, but it would slow UI-adjacent iteration and still need the same product decisions.

Recommendation:

Keep Vue + TypeScript. Consider a backend language change only if you plan to heavily use Python ebook libraries or want a single static Go backend as a major deployment goal.

## OAuth Library Recommendation

Do not switch libraries until the intended auth model is clear.

Current `passport-google-oauth20` is old but still widely used and can work for this app if configured correctly. The bigger issue is not Passport itself; it is the app’s mixed session/JWT design and incomplete middleware.

Recommended options:

1. Stay on Passport and fix sessions.
   - Lowest churn.
   - Good enough for a Google-only home app.
   - Requires state, durable sessions, secure cookies, and clean approval handling.

2. Move to `openid-client`.
   - Best long-term Express-native choice if you want explicit OIDC flows.
   - Avoids Passport’s older abstraction.
   - Requires more code, but the auth boundary will be clearer.

3. Consider `@auth/express` only after validating fit.
   - It is current and provider-rich.
   - It may be more framework/opinionated than this app needs.

My recommendation: stabilize with Passport if you want the fastest path. Move to `openid-client` if you are already planning to refactor auth deeply.

## Feature Ideas

Add features only after the stabilization items are done:

1. Tag, series, author, publisher, and language browsing from Calibre metadata.
2. A real book details page with formats, cover, comments/description, identifiers, tags, and related series books.
3. Favorites/bookshelves stored in the app DB.
4. Download history and recent activity for admins.
5. OPDS feed support for e-reader apps.
6. Library health page showing Calibre DB path, last scan time, book count, missing covers/files, and Docker/config status.
7. Admin settings for library path, scan interval, allowed email domains, and first-admin bootstrap.
8. Search improvements using SQLite FTS over title, authors, series, tags, and comments.
9. Optional invite-only mode instead of open OAuth requests.
10. Backup/export of app settings and users.

## Recommended Roadmap

### Phase 1: Stabilize Runtime

- Fix backend TypeScript build.
- Fix auth middleware to always return or continue.
- Decide session-only or JWT-only.
- Remove secret/header logging.
- Add app DB migrations and initial admin bootstrap.
- Add route integration tests for auth and books.

### Phase 2: Fix Deployment

- Rewrite Dockerfiles for Node 22 and production-safe builds.
- Add nginx config for `/api`.
- Wire Compose environment variables correctly.
- Add `.env.example`.
- Add CI steps for backend build, frontend build, and Docker build.

### Phase 3: Improve Product Completeness

- Implement book details.
- Add admin settings and library health.
- Add Calibre metadata browsing beyond search.
- Add update detection or scheduled reload if needed.

### Phase 4: Dependency And Security Cleanup

- Update vulnerable dependencies.
- Add rate limiting for auth routes.
- Add secure session store and cookie settings.
- Add file path containment checks around cover/download serving.

## Bottom Line

This is an incomplete but recoverable application. The architecture is directionally sound for a personal Calibre web app, but the auth boundary, Docker deployment, app DB lifecycle, and integration coverage need attention before adding major features. A rewrite would be premature; a focused stabilization pass is the higher-value move.
