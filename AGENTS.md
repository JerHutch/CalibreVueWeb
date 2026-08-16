# Repository Guidelines

## Project Structure & Module Organization

This workspace contains a Vue 3 frontend and an Express backend. Frontend application code is in `frontend/src/`: views live in `views/`, shared UI in `components/`, state in `stores/`, HTTP setup in `api/`, and reusable behavior in `composables/`. Static branding assets belong in `frontend/public/`. Backend code is organized by responsibility under `backend/src/` (`routes/`, `controllers/`, `services/`, `middleware/`, `db/`, and `utils/`). Keep tests beside their application area under `frontend/tests/` and `backend/tests/`. Deployment and OAuth guidance is in `docs/`; Docker assets are package-local plus `docker-compose.yml` at the root.

## Build, Test, and Development Commands

- `bun run setup` installs both workspace packages.
- `bun run start` runs the frontend and backend concurrently for local development.
- `bun run build` type-checks/builds both packages; use it before submitting changes.
- `bun run test -- --run` runs both Vitest suites once (preferred for CI-style verification).
- `cd frontend && bun run dev` starts Vite; `cd backend && bun run dev` starts the TypeScript Express server with Nodemon.
- `docker compose up --build` builds and starts the deployed container configuration. Consult `docs/docker.md` for required environment and library mounts.

## Coding Style & Naming Conventions

Use TypeScript throughout and match nearby code: two-space indentation, semicolons, and single-quoted strings. Use PascalCase for Vue component files and exported classes (`BookCard.vue`, `CalibreService`); use camelCase for functions, stores, variables, and composables (`useFileDownload`). Keep Vue components in `<script setup lang="ts">` form when practical. Import frontend application modules through the `@/` alias. No lint or formatter script is configured, so avoid unrelated formatting churn and rely on TypeScript builds.

## Testing Guidelines

Both packages use Vitest; the frontend runs in jsdom and uses Vue Test Utils, while backend tests use Vitest/Supertest and mocks. Name test files `*.test.ts` and mirror the source area, e.g. `backend/tests/controllers/bookController.test.ts` or `frontend/tests/components/BookCard.test.ts`. Add focused tests for changed behavior, especially authentication, file access, and API error responses. Run the affected package suite during development and the root test command before a PR.

## Commit & Pull Request Guidelines

Recent history uses short imperative subjects, with conventional prefixes when useful: `fix: align express middleware types`, `build: make backend image reproducible`, and `docs: clarify stabilization plan contracts`. Keep commits focused. PRs should explain the behavior change, list verification commands, link related issues, and include screenshots for visible frontend changes. Never commit OAuth secrets, session secrets, library data, or local database files.
