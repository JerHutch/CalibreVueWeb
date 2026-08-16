# Docker Deployment

This guide covers the current Docker deployment flow defined by [docker-compose.yml](../docker-compose.yml).

## What The Stack Runs

The Compose stack starts two containers:

- `calibre-frontend`: builds `frontend/Dockerfile`, serves the built Vue app with nginx, and proxies `/api/` to the backend container.
- `calibre-backend`: builds `backend/Dockerfile`, opens the Calibre database, and stores app-specific data such as users in a separate app database.

The frontend publishes port `${FRONTEND_PORT:-8888}` on container port `80`.
The backend publishes port `${BACKEND_PORT:-3000}` on container port `3000`.

The image build uses Bun 1.3.14 and the committed root `bun.lock` for reproducible
dependency installation. The backend runtime deliberately remains Node.js 22 because
it uses the native `better-sqlite3` addon to access the Calibre and app databases.

## Prerequisites

- Docker with Compose support
- A Calibre library directory on the host that contains `metadata.db`
- Google OAuth credentials

If you have not configured Google OAuth yet, use [Google OAuth Setup](google-oauth.md) first.

## Required Environment Variables

The Compose file expects these values:

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

Notes:

- `CALIBRE_DB_PATH` is the host directory that gets mounted read-only into the backend container at `/usr/src/app/data/calibre`.
- `CALIBRE_DB_NAME` defaults to `metadata.db`. Change it only if your Calibre database file has a different name.
- `APP_DB_PATH` is the backend's writable app database path inside the container. The default works with the Compose volume setup and usually should not be changed.
- `FRONTEND_URL` must match the URL users actually open in the browser. The OAuth redirect flow depends on it.

## Create Your Environment File

Create a root `.env` file next to `docker-compose.yml`:

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

## Volumes And Persistence

The backend uses two storage locations:

- Read-only Calibre mount:
  - host: `${CALIBRE_DB_PATH}`
  - container: `/usr/src/app/data/calibre`
- Persistent app data volume:
  - Compose volume: `app_data`
  - container path: `/usr/src/app/data/app`

The backend constructs the Calibre database file path from:

- `CALIBRE_DB_DIR=/usr/src/app/data/calibre`
- `CALIBRE_DB_NAME=metadata.db`

That means the backend will try to open:

```text
/usr/src/app/data/calibre/metadata.db
```

unless you override `CALIBRE_DB_NAME`.

## Start The Stack

From the repository root:

```bash
docker compose up --build -d
```

Useful follow-up commands:

```bash
docker compose logs -f
docker compose ps
docker compose down
```

If your installation still uses the legacy command, replace `docker compose` with `docker-compose`.

## Expected URLs

- Frontend: `http://localhost:8888` by default
- Backend API: `http://localhost:3000` by default
- Google OAuth backend callback path: `/api/auth/google/callback`
- Frontend callback landing path: `/auth/google/callback`

With the default local setup, the Google redirect URI should be:

```text
http://localhost:8888/api/auth/google/callback
```

The backend then redirects the browser back to:

```text
http://localhost:8888/auth/google/callback
```

after authentication is processed.

## Verification Checklist

After the stack is up:

1. Open `http://localhost:8888`.
2. Confirm the frontend loads.
3. Confirm Google sign-in redirects to Google instead of failing immediately.
4. Check backend logs if sign-in fails before the Google screen appears.
5. Verify the backend can see the Calibre database and does not exit with a missing-file error.

## Troubleshooting

### Frontend loads but the book list or auth routes fail

Check that:

- the backend container is running
- the frontend container can proxy `/api/` to `backend:3000`
- the browser is opening the same origin you set in `FRONTEND_URL`

### Backend exits on startup

The usual causes are:

- `CALIBRE_DB_PATH` points to the wrong host directory
- `metadata.db` is missing or named differently
- the mounted Calibre directory is not readable by the container

### Google OAuth fails with a redirect mismatch

Check:

- `FRONTEND_URL` matches the browser-visible URL exactly
- Google OAuth includes the correct redirect URI
- you are using the frontend origin, not the backend port, in Google OAuth settings

The full setup steps are in [Google OAuth Setup](google-oauth.md).

### App data is lost after recreating containers

Do not replace the `app_data` volume with a temporary bind mount unless you intend to manage persistence yourself. The default Compose volume is what keeps the app database across container restarts.
