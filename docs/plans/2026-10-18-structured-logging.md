# Structured Logging and Browser Log Forwarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One JSON-lines log per container start and per day, with browser errors and sign-in steps forwarded to the backend and grouped by a browser session id, and no secrets or emails in any line.

**Architecture:** The backend `Logger` builds redacted JSON entries and hands the line to destinations (stdout plus a rolling file). An `AsyncLocalStorage` request context attaches `sessionId`/`userId` to every line written while handling a request. A public, size-capped, rate-limited `POST /api/client-logs` writes browser entries through the same logger with `source: 'browser'`. The frontend has a small never-throwing batching module, a `sessionStorage` session id, and hooks in axios, the router, Vue and `window`.

**Tech Stack:** TypeScript, Express 4, express-session, Passport, Vitest (+ Supertest backend, jsdom/Vue Test Utils frontend), Vue 3, axios, Docker (`node:22-alpine`). No new npm dependencies.

**Spec:** `docs/specs/2026-10-18-structured-logging-design.md`

## Global Constraints

- Log line: one JSON object per line with `ts` (ISO UTC), `level` (`info|warn|error`), `source` (`backend|browser`), `sessionId?`, `userId?`, `event`, `message`, `details?`.
- File name `app-YYYY-MM-DDTHH-mm-ss.log` in local time; new file at start and at day change; retention `LOG_RETENTION_DAYS` default `30`; only matching names are deleted; legacy `app.log` untouched.
- `TZ=${TZ:-UTC}` in both compose files; `tzdata` installed in the backend image.
- Session id: `^[A-Za-z0-9-]{8,64}$`, header `X-Session-Id`, kept in `sessionStorage`.
- Sign-in cookie: `client_session_id`, 10 minutes, `SameSite=Lax`, `Path=/api/auth/google`, not `HttpOnly`, holds only the id.
- `POST /api/client-logs`: public, `204`, max 20 entries, 16 KB body, `message` ≤ 1000 chars, `event` ≤ 64 chars matching `^[a-z0-9._-]+$`, 60 requests/min per IP, `429` over limit, `400` malformed, `413` too large, browser levels `info|warn|error`.
- Never logged: tokens, secrets, cookies, `Authorization`, OAuth `code`/`state`, email addresses (user ids instead), request/response bodies, headers.
- Logging must never throw into app code or delay a response.
- Repo style: two-space indent, semicolons, single quotes, `@/` alias in the frontend, tests mirror source paths, no `.env` reads. Verify with `bun run build` and `bun run test -- --run` at the repo root.

## Review Focus

- A secret inside free text or `details` (`?code=…&state=…`, `Bearer eyJ…`, an email in an error string) is masked in both backend and browser-sourced lines (Tasks 1, 7).
- Oversized, malformed, non-array or wrongly typed client log bodies return `413`/`400` and write no lines (Task 7).
- A message or session id containing newlines or control characters yields exactly one line per entry and an ignored id (Tasks 2, 3).
- Missing/unwritable log directory, two starts in the same second, and a midnight crossing never throw and never overwrite earlier lines (Task 4).
- Backend down, `fetch` rejecting, or `sessionStorage` throwing leaves the app working with a bounded buffer, and the Google redirect still happens when the final flush hangs (Tasks 9, 10, 11).

---

## File Structure

Backend (`backend/src/`): `utils/redact.ts` (new), `utils/requestContext.ts` (new), `middleware/sessionContext.ts` (new), `utils/logger.ts` (rewrite), `utils/logRetention.ts` and `utils/rollingFileDestination.ts` (new), `middleware/loggingMiddleware.ts` (rewrite), `controllers/googleAuthController.ts` / `authController.ts` (events, no emails), `middleware/rateLimiter.ts`, `controllers/clientLogController.ts`, `routes/clientLogRoutes.ts` (new), `app.ts`, `routes/index.ts` (wiring).
Frontend (`frontend/src/`): `logging/sessionId.ts`, `logging/clientLogger.ts` (new), `api/axios.ts`, `main.ts`, `router/index.ts`, `views/OAuthLoginView.vue`, `views/GoogleCallbackView.vue` (hooks).
Other: `backend/Dockerfile`, both compose files, `.env.example`, `docs/docker.md`, `docs/synology-nas.md`, `docs/logging.md` (new).

---

### Task 1: Redaction module

**Files:**
- Create: `backend/src/utils/redact.ts`
- Test: `backend/tests/utils/redact.test.ts`

**Interfaces:**
- Produces:
  - `export const REDACTED_VALUE = '********';`
  - `export function isSensitiveKey(key: string): boolean;`
  - `export function sanitizeUrl(url: string): string;`
  - `export function redactText(text: string): string;`
  - `export function redactValue<T>(value: T): T;`

- [ ] **Step 1: Write failing tests** covering:
  - `isSensitiveKey`: true for `Authorization`, `cookie`, `set-cookie`, `access_token`, `client_secret`, `apiKey`, `password`, `code`, `state`, `sessionToken`, `session`; false for `sessionId`, `statusCode`, `errorCode`, `status`, `path`.
  - `sanitizeUrl('/api/callback?code=abc&redirect=%2Fbooks&token=t')` → `code` and `token` values become `********`, `redirect` kept; no query → unchanged.
  - `redactText`: `Bearer abc.def` → `Bearer ********`; a JWT-shaped string (`eyJ…`) masked; `a@b.com` → `[email]`; `see /x?code=1&state=2&ok=yes` masks `code`/`state`, keeps `ok`.
  - `redactValue`: deep-copies, masks sensitive keys at any depth, applies `redactText` to string values, does not mutate input, survives circular references and stops at depth 6.
- [ ] **Step 2: Run** `cd backend && bun run test -- --run tests/utils/redact.test.ts`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement** the interface. `code` and `state` match exactly (not as substrings); `session` matches as a substring except the exact key `sessionId`; other rules are the existing ones from `loggingMiddleware.ts` (`authorization`, `cookie`, `set-cookie`, contains `token`/`secret`/`key`, `password`). Free-text query masking uses one regex over `[?&]name=value` and `isSensitiveKey(name)`.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat: add log redaction helpers`.

### Task 2: Request context and session-id middleware

**Files:**
- Create: `backend/src/utils/requestContext.ts`, `backend/src/middleware/sessionContext.ts`
- Modify: `backend/src/app.ts` (mount `sessionContext` first after `cors`/`express.json`, before `requestLogger`; mount `attachUserToContext` right after `passport.session()`)
- Test: `backend/tests/utils/requestContext.test.ts`, `backend/tests/middleware/sessionContext.test.ts`

**Interfaces:**
- Produces:
  - `export interface RequestContext { sessionId?: string; userId?: string }`
  - `export function runWithContext<T>(ctx: RequestContext, fn: () => T): T;`
  - `export function getContext(): RequestContext | undefined;`
  - `export function isValidSessionId(value: unknown): value is string;`
  - `export const SESSION_HEADER = 'x-session-id'; export const SESSION_COOKIE_NAME = 'client_session_id';`
  - `export const sessionContext: RequestHandler;` `export const attachUserToContext: RequestHandler;`

- [ ] **Step 1: Write failing tests:**
  - `isValidSessionId`: accepts a UUID and `abcd1234`; rejects `short`, 65 chars, `a b c d e f g h`, `../../etc/passwd`, `abc\n12345678`, non-strings.
  - Context survives `await`, `setImmediate` and `new Promise` hops inside `runWithContext`.
  - `sessionContext`: valid `X-Session-Id` header sets `ctx.sessionId`; invalid header is ignored; for URLs under `/api/auth/google` with no header, a valid `client_session_id` cookie in the `Cookie` header is used; the cookie is ignored on other paths; header wins over cookie.
  - `attachUserToContext` sets `ctx.userId` to `String(req.user.id)` when authenticated, otherwise leaves it unset.
  - Supertest through `createApp`: a request with the header makes `getContext()?.sessionId` visible inside a Passport-style async callback in a test route.
- [ ] **Step 2: Run** `bun run test -- --run tests/utils/requestContext.test.ts tests/middleware/sessionContext.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** with `AsyncLocalStorage`; `sessionContext` calls `runWithContext(ctx, () => next())`. Parse the `Cookie` header by hand (no new dependency).
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat: add per-request session context`.

### Task 3: Logger core (JSON entries)

**Files:**
- Modify: `backend/src/utils/logger.ts`, `backend/tests/utils/logger.test.ts`, `backend/tests/middleware/loggingMiddleware.test.ts` (only if it breaks)
- Test: `backend/tests/utils/logger.test.ts`

**Interfaces:**
- Consumes: `redactText`, `redactValue` (Task 1); `getContext` (Task 2).
- Produces:
  - `export type LogLevel = 'info' | 'warn' | 'error';`
  - `export interface LogFields { event?: string; userId?: string; sessionId?: string; details?: Record<string, unknown> }`
  - `export interface LogEntry { ts: string; level: LogLevel; source: 'backend' | 'browser'; sessionId?: string; userId?: string; event: string; message: string; details?: Record<string, unknown> }`
  - `Logger.info|warn|error(message: string, fields?: LogFields): void`
  - `Logger.write(entry: Omit<LogEntry, 'ts'> & { ts?: string }): void`
  - `LogDestination.log(line: string)` unchanged (the line is the JSON text without newline); `Logger.flush()` unchanged.

- [ ] **Step 1: Write failing tests** using a capturing destination:
  - `info('hi')` → one line that parses to `level:'info'`, `source:'backend'`, `event:'log'`, `message:'hi'`, ISO `ts`.
  - `warn` exists; `error('x', { event: 'auth.google.outcome', details: { status: 'error' } })` carries event and details.
  - Inside `runWithContext({ sessionId, userId })` lines include both; explicit fields override context; no context → keys absent.
  - `write({ source: 'browser', ... })` keeps `source` and a supplied `ts`.
  - A message `'a\nb'` produces a single line (no raw newline) that parses back to `'a\nb'`.
  - Message `token ?code=abc` and details `{ authorization: 'x', n: 1 }` come out redacted.
  - Existing flush test updated to the new JSON output.
- [ ] **Step 2: Run** `bun run test -- --run tests/utils/logger.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** by building the entry, applying `redactText` to `message` and `redactValue` to `details`, `JSON.stringify`, then sending to every destination. Keep the current `FileDestination` (writes `logs/app.log`) until Task 4 replaces it. `ConsoleDestination` prints the line.
- [ ] **Step 4: Run** `bun run test -- --run` in `backend`. Expected: PASS (fix any test that asserted the old text format).
- [ ] **Step 5: Commit** `feat: write structured JSON log entries`.

### Task 4: Rolling file destination with retention

**Files:**
- Create: `backend/src/utils/logRetention.ts`, `backend/src/utils/rollingFileDestination.ts`
- Modify: `backend/src/utils/logger.ts` (default instance uses `RollingFileDestination`, remove `FileDestination`), `backend/tests/controllers/bookController.test.ts` (it mocks `fs`; mock `../../src/utils/logger` instead)
- Test: `backend/tests/utils/logRetention.test.ts`, `backend/tests/utils/rollingFileDestination.test.ts`

**Interfaces:**
- Produces:
  - `export const LOG_FILE_PATTERN: RegExp;`
  - `export function logFileName(date: Date): string;` (local time)
  - `export function deleteExpiredLogs(dir: string, retentionDays: number, now?: Date): string[];`
  - `export class RollingFileDestination implements LogDestination { constructor(options: { dir: string; retentionDays: number; now?: () => Date }); log(line: string): void; flush(): Promise<void>; }`

- [ ] **Step 1: Write failing tests** with real temp directories and an injected clock:
  - `logFileName(new Date(2026, 9, 18, 14, 30, 5))` → `app-2026-10-18T14-30-05.log`.
  - `deleteExpiredLogs`: a 31-day-old matching file is deleted and returned; a 29-day-old one is kept; `app.log`, `notes.txt` and a directory are never touched.
  - Constructing the destination creates the directory and the first file and runs cleanup.
  - A line is appended with `\n`; two instances started in the same second append to the same file without losing the first lines.
  - Advancing the clock past local midnight and logging again creates a second file dated the new day; lines are in the right files.
  - `dir` that cannot be created or written (`/proc/nope`): construction and `log` do not throw; one `console.error` is emitted.
  - `flush()` resolves after pending writes are on disk.
- [ ] **Step 2: Run** the two test files. Expected: FAIL.
- [ ] **Step 3: Implement.** Rollover is checked lazily on each `log` call by comparing local `YYYY-MM-DD` keys (no timers), so the new file is named with the time of the first write after midnight. Stream flags `'a'`. The default logger reads `LOG_DIR` (default `path.join(process.cwd(), 'logs')`) and `LOG_RETENTION_DAYS` (default 30, ignore non-positive/NaN).
- [ ] **Step 4: Run** `bun run test -- --run` in `backend`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: roll log files per start and per day with retention`.

### Task 5: Request logger rewrite

**Files:**
- Modify: `backend/src/middleware/loggingMiddleware.ts`, `backend/tests/middleware/loggingMiddleware.test.ts`

**Interfaces:**
- Consumes: `sanitizeUrl` (Task 1); `logger.info(message, fields)` (Task 3).
- Produces: `requestLogger` (same export name) now logs one `http.request` line per response.

- [ ] **Step 1: Rewrite the tests:**
  - One `logger.info` call per finished response with `event: 'http.request'` and `details` `{ method, path, status, durationMs }`; nothing is logged before the response finishes.
  - A request with `authorization`, `cookie` headers and a body logs none of them (assert no call argument contains their values).
  - Sensitive query values in `path` are masked (reuse the existing `?code=…&token=…` case).
  - A request to `/api/client-logs` logs nothing.
- [ ] **Step 2: Run** `bun run test -- --run tests/middleware/loggingMiddleware.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement**; delete the local `isSensitiveKey`, `maskSensitiveData`, `sanitizeUrl` copies in favour of `redact.ts`.
- [ ] **Step 4: Run** `bun run test -- --run` in `backend`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: log one line per request without headers or bodies`.

### Task 6: Sign-in events and no emails in logs

**Files:**
- Modify: `backend/src/controllers/googleAuthController.ts`, `backend/src/controllers/authController.ts`, `backend/src/services/authService.ts`, `backend/tests/controllers/googleAuthController.test.ts`, `backend/tests/controllers/authController.test.ts`

**Interfaces:**
- Consumes: `logger` (Task 3), `getContext` (Task 2).
- Produces events (all `source: 'backend'`):
  - `auth.google.start` (info) at the start of each `GET /api/auth/google` request. `authenticateGoogle()` must log per request, not when the route is built.
  - `auth.google.callback` (info) per callback request, `details: { googleError?: string }` taken from the `error` query parameter if present.
  - `auth.google.outcome` with `details: { status: 'approved' | 'pending' | 'denied' | 'error' | 'no_user', reason?: string }` (`error` level for `error`, `warn` for `pending`/`denied`/`no_user`).
  - `auth.session.check` from `getCurrentUser`, `details: { authenticated: boolean, status?: string }`.
  - `auth.logout` from `logout`.

- [ ] **Step 1: Write failing tests:**
  - For each event, spy on `logger.info|warn|error` and assert event name and details for the approved, pending, denied, passport-error and `req.logIn` failure paths.
  - No call argument anywhere contains an email address (use users with `@example.com` emails and assert on `JSON.stringify` of all logger calls); user ids appear as `userId`.
  - The per-request "Serializing/Deserializing user" lines are gone.
- [ ] **Step 2: Run** `bun run test -- --run tests/controllers`. Expected: FAIL.
- [ ] **Step 3: Implement.** Replace every email in log text with `user.id`; set `getContext().userId` once a user is known in the strategy callback and after `req.logIn` succeeds; never log anything from the Google profile. Remove the per-request serialize/deserialize info lines.
- [ ] **Step 4: Run** `bun run test -- --run` in `backend`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: log sign-in steps and use user ids instead of emails`.

### Task 7: Client log endpoint

**Files:**
- Create: `backend/src/middleware/rateLimiter.ts`, `backend/src/controllers/clientLogController.ts`, `backend/src/routes/clientLogRoutes.ts`
- Modify: `backend/src/routes/index.ts` (mount `/client-logs` before `authenticateToken`), `backend/src/app.ts` (mount the limiter and a 16 KB `express.json` for `/api/client-logs` before the global `express.json()`)
- Test: `backend/tests/middleware/rateLimiter.test.ts`, `backend/tests/app/app.clientLogs.test.ts`

**Interfaces:**
- Consumes: `logger.write` (Task 3), `isValidSessionId` (Task 2).
- Produces:
  - `export function createRateLimiter(options: { windowMs: number; max: number; now?: () => number }): RequestHandler;` in-memory fixed window keyed on `req.ip`, responds `429` with `{ error: 'Too many requests' }`, drops expired buckets.
  - `export const receiveClientLogs: RequestHandler;`

- [ ] **Step 1: Write failing tests** (Supertest against `createApp`, capturing `logger.write`):
  - Unauthenticated valid batch → `204`; each entry written with `source: 'browser'`, the body's `sessionId`, `level`, `event`, `message`, `details`; an authenticated user's id is added as `userId`.
  - `400`: body not JSON, `entries` missing or not an array, 21 entries, bad `level`, `event` with spaces/uppercase or > 64 chars, `message` not a string, invalid `sessionId`. `413`: body over 16 KB. In all of these nothing is written.
  - `message` over 1000 chars is truncated to 1000. `details` keeps strings (truncated to 200 chars), numbers, booleans and drops objects/arrays/functions and keys beyond 20.
  - A missing or implausible `ts` (unparseable or more than 24 h from now) is replaced by the server time.
  - Entry with `message: 'x?code=abc&state=s Bearer eyJhbGciOiJIUzI1NiJ9.e30.sig a@b.com'` is written redacted. A client-supplied `source: 'backend'` or `userId` is ignored.
  - Rate limiter: 60 requests in a window pass, the 61st gets `429`, the window resets after `windowMs`; limiter runs before body parsing.
  - The `http.request` log skips this path (Task 5), and `X-Session-Id` header is accepted as a fallback for `sessionId`.
- [ ] **Step 2: Run** `bun run test -- --run tests/middleware/rateLimiter.test.ts tests/app/app.clientLogs.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the validation in the controller with plain checks (no new dependency). Limiter defaults: `windowMs: 60000`, `max: 60`.
- [ ] **Step 4: Run** `bun run test -- --run` in `backend`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: add public rate-limited client log endpoint`.

### Task 8: Frontend session id

**Files:**
- Create: `frontend/src/logging/sessionId.ts`
- Test: `frontend/tests/logging/sessionId.test.ts`

**Interfaces:**
- Produces:
  - `export const SESSION_HEADER = 'X-Session-Id'; export const SESSION_COOKIE_NAME = 'client_session_id';`
  - `export function getSessionId(): string;`
  - `export function setSignInCookie(): void;`

- [ ] **Step 1: Write failing tests (jsdom):** `getSessionId()` matches `^[A-Za-z0-9-]{8,64}$`, is stable across calls and after `vi.resetModules()` (read back from `sessionStorage`); when `sessionStorage` getter/setter throws it still returns a stable in-memory id; `setSignInCookie()` writes `client_session_id=<id>` with `Max-Age=600`, `Path=/api/auth/google`, `SameSite=Lax` (spy on the `document.cookie` setter), and adds `Secure` only when `location.protocol` is `https:`.
- [ ] **Step 2: Run** `cd frontend && bun run test -- --run tests/logging/sessionId.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** with `crypto.randomUUID()` and a `getRandomValues` fallback; storage key `calibre.sessionId`.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat: add browser session id`.

### Task 9: Frontend client logger

**Files:**
- Create: `frontend/src/logging/clientLogger.ts`
- Test: `frontend/tests/logging/clientLogger.test.ts`

**Interfaces:**
- Consumes: `getSessionId`, `SESSION_HEADER` (Task 8); `appConfig.apiUrl`.
- Produces:
  - `export type ClientLogLevel = 'info' | 'warn' | 'error'; export type ClientLogDetails = Record<string, string | number | boolean>;`
  - `export function clientLog(level: ClientLogLevel, event: string, message: string, details?: ClientLogDetails): void;`
  - `export function flushClientLogs(options?: { keepalive?: boolean; timeoutMs?: number }): Promise<void>;` (resolves when sent, failed, or timed out; never rejects)
  - `export function describeError(error: unknown): ClientLogDetails;`
  - `export function installGlobalErrorHandlers(app: App): void;`
  - `export function resetClientLogger(): void;` (tests only)

- [ ] **Step 1: Write failing tests** with a mocked global `fetch` and fake timers:
  - `clientLog` queues; entries are flushed after 5 s, immediately at 20 queued, and with `keepalive: true` on `pagehide`; body is `{ sessionId, entries }`, URL `/api/client-logs`, header `X-Session-Id`.
  - `fetch` rejecting or returning `500`: no exception, at most 2 retries, then the batch is dropped; 150 `clientLog` calls with a dead backend keep the buffer at 100.
  - `flushClientLogs({ timeoutMs: 1000 })` resolves after 1 s when `fetch` never settles.
  - `describeError` for an axios-shaped error `{ name, code, config: { method: 'get', url: '/books/5/cover?token=x' }, response: { status: 404, data: 'secret' } }` → `{ name, code, status: 404, method: 'GET', path: '/books/5/cover' }` with no query and no body; for `new Error('boom')` → `{ name: 'Error', message: 'boom' }`; for a string → `{ value: <string, max 200 chars> }`.
  - `installGlobalErrorHandlers`: dispatching `window` `error` and `unhandledrejection` events, and calling `app.config.errorHandler`, each queue an `error`-level entry (`window.error`, `window.unhandledrejection`, `vue.error`).
  - Nothing here throws when `fetch` is undefined.
- [ ] **Step 2: Run** `bun run test -- --run tests/logging/clientLogger.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Use `fetch`, not the axios instance, so the axios interceptor cannot recurse. Truncate `message` to 1000 chars and event names to 64.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat: add batching browser log forwarder`.

### Task 10: Wire capture into axios, Vue and the router

**Files:**
- Modify: `frontend/src/api/axios.ts`, `frontend/src/main.ts`, `frontend/src/router/index.ts`
- Test: `frontend/tests/api/axios.test.ts`, `frontend/tests/router/index.test.ts`

**Interfaces:**
- Consumes: `clientLog`, `describeError`, `installGlobalErrorHandlers` (Task 9); `getSessionId`, `SESSION_HEADER` (Task 8).

- [ ] **Step 1: Write failing tests:**
  - Request interceptor adds `X-Session-Id` to every request.
  - A failed response with status 404/500 or no response (network error) queues an `error` entry `http.failed` with `describeError` details; 401/403 queue `warn`; the error is still rejected to the caller; a successful response queues nothing.
  - `router.onError` queues `router.error`; the existing `console.error` stays.
- [ ] **Step 2: Run** `bun run test -- --run tests/api/axios.test.ts tests/router/index.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** in the existing interceptor (it is currently a pass-through) and call `installGlobalErrorHandlers(app)` in `main.ts` before `app.mount`.
- [ ] **Step 4: Run** `bun run test -- --run` in `frontend`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: forward browser errors to the backend`.

### Task 11: Sign-in step reporting in the browser

**Files:**
- Modify: `frontend/src/views/OAuthLoginView.vue`, `frontend/src/views/GoogleCallbackView.vue`, `frontend/src/router/index.ts` (guard redirect)
- Test: `frontend/tests/views/LoginView.test.ts` (or a new `OAuthLoginView.test.ts`), `frontend/tests/views/GoogleCallbackView.test.ts`, `frontend/tests/router/index.test.ts`

**Interfaces:**
- Consumes: `clientLog`, `flushClientLogs` (Task 9); `setSignInCookie` (Task 8).
- Produces browser events: `auth.login.view`, `auth.google.click`, `auth.callback.view` (`details: { status }`), `auth.callback.result` (`details: { authenticated: boolean }`), `auth.redirect.login` (`details: { from: <path without query> }`), all `info`.

- [ ] **Step 1: Write failing tests:**
  - Mounting the login view queues `auth.login.view`.
  - Clicking Sign in with Google calls, in order: `clientLog('info','auth.google.click', …)`, `setSignInCookie()`, `flushClientLogs({ keepalive: true, timeoutMs: 1000 })`, then sets `window.location.href = '/api/auth/google'`.
  - With a `flushClientLogs` mock that never resolves (fake timers), the redirect still happens within about 1 s.
  - Callback view mounts with `?status=pending|denied|error|approved` → `auth.callback.view` with that status; after `checkAuth` it queues `auth.callback.result`.
  - Router guard sending an unauthenticated user to login queues `auth.redirect.login` with a path that has no query string.
- [ ] **Step 2: Run** `bun run test -- --run tests/views tests/router`. Expected: FAIL.
- [ ] **Step 3: Implement** the hooks; keep every existing behaviour and message.
- [ ] **Step 4: Run** `bun run test -- --run` in `frontend`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: report sign-in steps from the browser`.

### Task 12: Configuration, image and deployment docs

**Files:**
- Modify: `backend/Dockerfile` (add `tzdata` to the runtime-stage `apk add`), `docker-compose.yml`, `docker-compose.deploy.yml`, `.env.example`, `docs/docker.md`, `docs/synology-nas.md`

- [ ] **Step 1:** Add `TZ=${TZ:-UTC}` and `LOG_RETENTION_DAYS=${LOG_RETENTION_DAYS:-30}` to the backend `environment` in both compose files; add `TZ=UTC` and `LOG_RETENTION_DAYS=30` to `.env.example`.
- [ ] **Step 2:** Document `TZ` (IANA name such as `America/New_York`; days roll over at local midnight), `LOG_RETENTION_DAYS`, `LOG_DIR` (default `logs`, mounted at `app_data/logs`), the file naming, and the limitation that behind the reverse proxy and nginx the per-IP rate limit may see one shared address, which is acceptable for a handful of users.
- [ ] **Step 3: Verify** `docker compose -f docker-compose.deploy.yml config` shows the new variables (with dummy values for required ones passed through the shell environment, not a `.env` file read), and `docker build -f backend/Dockerfile .` succeeds if Docker is available; otherwise say it was not run.
- [ ] **Step 4: Commit** `build: configure log time zone and retention`.

### Task 13: Log filtering guide

**Files:**
- Create: `docs/logging.md`

- [ ] **Step 1:** Generate a real sample: run the backend locally with a temporary `LOG_DIR` in the scratchpad, `curl` `POST /api/client-logs` with a few entries (including a sign-in start with no callback for one session), and hit `/api/auth/me`.
- [ ] **Step 2:** Write the guide with a copy-pasteable command for each of: list files for a day (`ls`), all lines for one session id (`jq`), errors only, browser lines only, one sign-in trail from start to outcome ordered by `ts`, and sessions that logged `auth.google.start` without `auth.google.callback` (note this is how a failure at Google itself looks), plus a `grep` equivalent where one exists. Explain the line format and fields briefly.
- [ ] **Step 3: Verify** every command against the sample file and confirm the output matches what the guide says; fix any that do not.
- [ ] **Step 4: Commit** `docs: add guide to filtering log files`.

### Task 14: Final verification

- [ ] **Step 1:** `bun run build` at the repo root. Expected: both packages build.
- [ ] **Step 2:** `bun run test -- --run` at the repo root. Expected: all suites pass.
- [ ] **Step 3:** Start the backend locally with a temporary `LOG_DIR`, POST a client log containing `?code=abc&state=xyz` and an email, and confirm the file has a masked line with no email. Report the result honestly, including anything not run.
- [ ] **Step 4:** Run the repository's code review over the branch before opening a PR.

---

## Plan decisions beyond the spec

- Rollover is lazy (checked on write), so a day's first file is named with the time of its first write rather than 00:00:00.
- `code` and `state` are masked as exact keys, not substrings, so `errorCode` and `statusCode` stay readable in details.
- Invalid values inside client `details` are dropped instead of rejecting the whole batch; structural problems still return `400`.
- The per-request serialize/deserialize info lines and the `/api/client-logs` request line are removed as noise.
- The final flush before leaving for Google waits at most 1 second.
