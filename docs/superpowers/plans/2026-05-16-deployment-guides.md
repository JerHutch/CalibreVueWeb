# Deployment Guides Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move setup and deployment instructions out of `README.md` into dedicated Docker, Synology NAS, and Google OAuth guides under `docs/`, while keeping `README.md` as the stable project overview and link hub.

**Architecture:** Rewrite `README.md` to retain only durable overview content and add links to focused operational guides. Create three standalone Markdown guides that derive environment variables, ports, mounts, and callback URLs from current repo configuration instead of the stale existing README instructions.

**Tech Stack:** Markdown, Docker Compose, Synology Container Manager, Google OAuth 2.0

---

### Task 1: Restructure `README.md` into an overview and guide index

**Files:**
- Modify: `README.md`
- Test: `README.md`

- [ ] **Step 1: Replace operational setup sections with a guide index**

Update `README.md` so it keeps:

```md
- Project summary
- Features
- Architecture
- Testing
- Project structure
- Authentication and authorization overview
- Roadmap
```

Add a short guide index near the top:

```md
## Guides

- [Docker Deployment](docs/docker.md)
- [Synology NAS Deployment](docs/synology-nas.md)
- [Google OAuth Setup](docs/google-oauth.md)
```

Remove or collapse:

```md
- Prerequisites
- Installation
- Docker deployment steps
- Synology deployment steps
- Detailed Google OAuth setup
- Configuration sections that duplicate guide content
```

- [ ] **Step 2: Review the updated README for stable-only content**

Run:

```bash
sed -n '1,260p' README.md
```

Expected: `README.md` describes the project and points readers to guides, but does not contain step-by-step deployment instructions.

### Task 2: Create the Docker deployment guide

**Files:**
- Create: `docs/docker.md`
- Test: `docs/docker.md`

- [ ] **Step 1: Write the Docker guide from current compose/runtime behavior**

Include these concrete details:

```md
- Frontend container publishes `${FRONTEND_PORT:-8888}:80`
- Backend container publishes `${BACKEND_PORT:-3000}:3000`
- Backend mounts `${CALIBRE_DB_PATH}:/usr/src/app/data/calibre:ro`
- Backend app DB defaults to `/usr/src/app/data/app/app.db`
- Calibre DB filename defaults to `metadata.db`
- Frontend public origin is controlled by `FRONTEND_URL`
```

Include example env values:

```env
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

Include start/stop commands:

```bash
docker compose up --build -d
docker compose logs -f
docker compose down
```

- [ ] **Step 2: Link the Docker guide to the OAuth guide**

Add a section that points readers to:

```md
[Google OAuth Setup](google-oauth.md)
```

Expected: the Docker guide does not duplicate the full Google Cloud walkthrough.

### Task 3: Create the Synology NAS guide

**Files:**
- Create: `docs/synology-nas.md`
- Test: `docs/synology-nas.md`

- [ ] **Step 1: Write the Synology-specific deployment flow**

Cover these exact deployment concerns:

```md
- Container Manager prerequisites
- Host folders for the Calibre library and app data
- Read-only mapping of the Calibre library to `/usr/src/app/data/calibre`
- Persistent writeable app DB path at `/usr/src/app/data/app/app.db`
- Setting the same environment variables in Synology's UI
- Matching `FRONTEND_URL` to the real public URL
```

Include practical folder examples such as:

```text
/volume1/books/calibre
/volume1/docker/calibre-vue-web/app-data
```

- [ ] **Step 2: Include Synology-specific troubleshooting**

Document expected issues:

```md
- Permission denied on mounted folders
- Wrong library path or missing `metadata.db`
- OAuth redirect mismatches after reverse proxy changes
- Browser reaching the frontend but not the proxied `/api/` path
```

### Task 4: Create the Google OAuth guide

**Files:**
- Create: `docs/google-oauth.md`
- Test: `docs/google-oauth.md`

- [ ] **Step 1: Write the Google Cloud setup guide**

Include:

```md
- Create/select a Google Cloud project
- Configure the OAuth consent screen
- Create a Web application OAuth client
- Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
- Explain that the backend callback path is always `/api/auth/google/callback`
- Explain that the frontend landing path is `${FRONTEND_URL}/auth/google/callback`
```

Include deployment examples:

```text
Origin: http://localhost:8888
Redirect URI: http://localhost:8888/api/auth/google/callback

Origin: https://books.example.com
Redirect URI: https://books.example.com/api/auth/google/callback
```

- [ ] **Step 2: Add mismatch troubleshooting**

Document issues like:

```md
- `redirect_uri_mismatch`
- using the backend port instead of the frontend public origin
- `FRONTEND_URL` not matching the browser-visible URL
```

### Task 5: Verify links and consistency across docs

**Files:**
- Test: `README.md`
- Test: `docs/docker.md`
- Test: `docs/synology-nas.md`
- Test: `docs/google-oauth.md`

- [ ] **Step 1: Check Markdown links and filenames**

Run:

```bash
rg -n "docs/docker.md|docs/synology-nas.md|docs/google-oauth.md|google-oauth.md" README.md docs
```

Expected: the README links to all three guides and the deployment guides reference the OAuth guide by the correct relative path.

- [ ] **Step 2: Re-read the final docs for contradiction against repo config**

Run:

```bash
sed -n '1,260p' docs/docker.md
sed -n '1,260p' docs/synology-nas.md
sed -n '1,260p' docs/google-oauth.md
```

Expected: ports, mount paths, env var names, callback paths, and persistence details match current `docker-compose.yml`, `backend/src/index.ts`, and `backend/src/controllers/googleAuthController.ts`.
