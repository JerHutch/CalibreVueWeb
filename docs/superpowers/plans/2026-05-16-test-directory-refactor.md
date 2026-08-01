# Test Directory Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move backend and frontend tests into dedicated `tests` roots while preserving feature-based grouping and keeping test execution working.

**Architecture:** Mirror the current test ownership under `backend/tests` and `frontend/tests`, dropping the `src` path segment while preserving the feature folders that exist today. Update Vitest discovery to read from the new roots, then fix relative imports in moved tests so they still target source files under `src`.

**Tech Stack:** TypeScript, Vitest, Vue, Express

---

### Task 1: Create the new backend/frontend test layout

**Files:**
- Create: `backend/tests/app/app.books.test.ts`
- Create: `backend/tests/app/app.auth.test.ts`
- Create: `backend/tests/controllers/authController.test.ts`
- Create: `backend/tests/controllers/bookController.test.ts`
- Create: `backend/tests/controllers/googleAuthController.test.ts`
- Create: `backend/tests/db/appSchema.test.ts`
- Create: `backend/tests/middleware/loggingMiddleware.test.ts`
- Create: `backend/tests/services/authService.test.ts`
- Create: `backend/tests/services/calibreService.test.ts`
- Create: `frontend/tests/stores/authStore.test.ts`
- Create: `frontend/tests/stores/book.test.ts`
- Delete: `backend/src/**/__tests__/*.test.ts`
- Delete: `frontend/src/**/__tests__/*.test.ts`

- [ ] **Step 1: Move each test into the matching new folder**

Keep the filenames unchanged and map them by feature:

```text
backend/src/__tests__/app.books.test.ts -> backend/tests/app/app.books.test.ts
backend/src/__tests__/app.auth.test.ts -> backend/tests/app/app.auth.test.ts
backend/src/controllers/__tests__/authController.test.ts -> backend/tests/controllers/authController.test.ts
backend/src/controllers/__tests__/bookController.test.ts -> backend/tests/controllers/bookController.test.ts
backend/src/controllers/__tests__/googleAuthController.test.ts -> backend/tests/controllers/googleAuthController.test.ts
backend/src/db/__tests__/appSchema.test.ts -> backend/tests/db/appSchema.test.ts
backend/src/middleware/__tests__/loggingMiddleware.test.ts -> backend/tests/middleware/loggingMiddleware.test.ts
backend/src/services/__tests__/authService.test.ts -> backend/tests/services/authService.test.ts
backend/src/services/__tests__/calibreService.test.ts -> backend/tests/services/calibreService.test.ts
frontend/src/stores/__tests__/authStore.test.ts -> frontend/tests/stores/authStore.test.ts
frontend/src/stores/__tests__/book.test.ts -> frontend/tests/stores/book.test.ts
```

- [ ] **Step 2: Remove the old `__tests__` directories once empty**

Run:

```bash
find backend/src frontend/src -type d -name __tests__
```

Expected: the command returns no paths after cleanup.

### Task 2: Update test discovery and import paths

**Files:**
- Modify: `backend/vitest.config.ts`
- Modify: `frontend/vitest.config.ts`
- Modify: `backend/tests/**/*.test.ts`
- Modify: `frontend/tests/**/*.test.ts`

- [ ] **Step 1: Point backend Vitest at the new root**

Set backend test discovery and coverage exclusions to the new path:

```ts
include: ['tests/**/*.test.ts'],
coverage: {
  reporter: ['text', 'json', 'html'],
  include: ['src/**/*.ts'],
  exclude: ['tests/**/*.test.ts']
}
```

- [ ] **Step 2: Make frontend Vitest discovery explicit**

Set frontend test discovery to:

```ts
include: ['tests/**/*.test.ts']
```

- [ ] **Step 3: Rewrite moved test imports to point back into `src`**

Examples of the expected pattern:

```ts
import { createApp } from '../../src/app';
import { getBooks } from '../../src/controllers/bookController';
import { useAuthStore } from '../../src/stores/authStore';
import api from '../../src/api/axios';
```

### Task 3: Verify both suites still run from their package roots

**Files:**
- Test: `backend/tests/**/*.test.ts`
- Test: `frontend/tests/**/*.test.ts`

- [ ] **Step 1: Run backend tests**

Run:

```bash
npm test -- --run
```

Working directory:

```bash
backend
```

Expected: Vitest discovers tests under `backend/tests` and exits with passing status.

- [ ] **Step 2: Run frontend tests**

Run:

```bash
npm test -- --run
```

Working directory:

```bash
frontend
```

Expected: Vitest discovers tests under `frontend/tests` and exits with passing status.
