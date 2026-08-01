# Deployment Guides Design

## Goal

Split operational setup content out of `README.md` and into focused documentation under `docs/`, with separate guides for generic Docker deployment, Synology NAS deployment, and Google OAuth setup. Keep `README.md` as the stable project overview and link hub.

## Current Context

- `README.md` currently mixes stable overview material with setup instructions that have drifted.
- `docker-compose.yml` is the active deployment contract for containerized use:
  - `frontend` publishes `${FRONTEND_PORT:-8888}:80`
  - `backend` publishes `${BACKEND_PORT:-3000}:3000`
  - `backend` mounts `${CALIBRE_DB_PATH}:/usr/src/app/data/calibre:ro`
  - `backend` persists app state in the named volume `app_data`
  - `backend` expects `SESSION_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `FRONTEND_URL`, `APP_DB_PATH`, `CALIBRE_DB_NAME`
- `backend/src/index.ts` constructs the Calibre database path from:
  - `CALIBRE_DB_DIR` default `/usr/src/app/data/calibre`
  - `CALIBRE_DB_NAME` default `metadata.db`
- `backend/src/controllers/googleAuthController.ts` uses:
  - Google callback path `/api/auth/google/callback`
  - frontend callback landing path `${FRONTEND_URL}/auth/google/callback`
- There are no existing user-facing deployment guides in `docs/`.

## Documentation Structure

### `README.md`

Purpose: stable overview for developers and evaluators.

Keep:
- Project summary
- Features
- Architecture
- High-level project structure
- Testing commands
- Roadmap

Remove:
- Local installation walkthroughs
- Docker deployment steps
- Synology-specific instructions
- Detailed Google OAuth setup steps

Add:
- `Guides` section near the top
- Links to:
  - `docs/docker.md`
  - `docs/synology-nas.md`
  - `docs/google-oauth.md`

### `docs/docker.md`

Purpose: canonical guide for running the current app with Docker Compose.

Content:
- What the compose stack contains now
- Required environment variables and defaults
- Host folder requirements for the Calibre library
- Meaning of the app data volume and what persists there
- Build/start/stop commands
- Expected URLs and callback relationships
- Verification checklist
- Troubleshooting section for current failure modes

### `docs/synology-nas.md`

Purpose: Synology-specific deployment guide that translates the Docker deployment model into Synology Container Manager concepts.

Content:
- Synology prerequisites
- Recommended host folder layout
- How to map the Calibre library read-only
- How to persist the app database on Synology storage
- Port and hostname guidance
- Reverse proxy notes and `FRONTEND_URL` implications
- Permission and path troubleshooting specific to Synology

### `docs/google-oauth.md`

Purpose: single source of truth for Google Cloud OAuth configuration.

Content:
- Create/select Google Cloud project
- Configure OAuth consent screen
- Create Web application OAuth client
- Authorized JavaScript origins
- Authorized redirect URIs
- How values map back to app configuration:
  - `GOOGLE_CLIENT_ID`
  - `GOOGLE_CLIENT_SECRET`
  - `FRONTEND_URL`
- Deployment-specific examples:
  - local Docker origin/callback
  - Synology/reverse-proxied origin/callback
- Common OAuth mismatch and redirect troubleshooting

## Design Decisions

### Single-source setup docs

Operational instructions should live only in `docs/`, not partly in `README.md`, because deployment details are the most likely to change as Docker, env vars, and auth flow evolve.

### Cross-link instead of duplicate

`docs/docker.md` and `docs/synology-nas.md` should link to `docs/google-oauth.md` rather than embedding full Google Cloud setup again. That avoids drift in callback/origin instructions.

### Prefer repo-truth over historical README text

The new docs should describe the behavior encoded in current source and compose files, even where it differs from the existing README wording. If a workflow is unclear from the code, the guide should say so explicitly rather than inventing steps.

## Content Boundaries

To keep the docs maintainable:

- `README.md` should not explain env files in depth
- `docs/docker.md` should not become a Synology UI tutorial
- `docs/synology-nas.md` should not duplicate generic Docker concepts beyond what Synology changes
- `docs/google-oauth.md` should not repeat full deployment steps

## Risks And Mitigations

### Risk: documenting stale behavior again

Mitigation:
- derive env var names, mount paths, ports, and callback URLs directly from `docker-compose.yml`, `backend/src/index.ts`, and `backend/src/controllers/googleAuthController.ts`

### Risk: ambiguous Synology instructions

Mitigation:
- frame Synology guidance around the exact values this app needs:
  - Calibre library directory mounted to `/usr/src/app/data/calibre`
  - persistent app DB path at `/usr/src/app/data/app/app.db`
  - frontend public origin used as `FRONTEND_URL`

### Risk: README loses too much useful entry-point content

Mitigation:
- keep concise testing and project-structure sections
- add a visible `Guides` section early so operational users land in the right document quickly

## Validation

The implementation should be reviewed against these checks:

- `README.md` still explains what the project is
- deployment instructions exist only in `docs/docker.md`, `docs/synology-nas.md`, and `docs/google-oauth.md`
- all env vars named in the guides match current code/config
- the new docs cross-link cleanly and do not contradict each other
