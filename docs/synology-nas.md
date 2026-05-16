# Synology NAS Deployment

This guide explains how to run the app on Synology NAS using Container Manager. It assumes you want the same container layout as [docker-compose.yml](../docker-compose.yml), but configured through Synology's interface or an imported compose project.

## Prerequisites

- Synology NAS with Container Manager available
- A reachable Calibre library folder on the NAS
- A public or LAN URL users will open in the browser
- Google OAuth credentials configured for that URL

If Google OAuth is not configured yet, use [Google OAuth Setup](google-oauth.md) first.

## Recommended Folder Layout

Keep the read-only Calibre library separate from the app's writable data.

Example host paths:

```text
/volume1/books/calibre
/volume1/docker/calibre-vue-web/app-data
```

Recommended meaning:

- `/volume1/books/calibre`
  - your existing Calibre library directory
  - must contain `metadata.db`
- `/volume1/docker/calibre-vue-web/app-data`
  - persistent app data owned by this project
  - stores the backend's app database

## What Needs To Be Mapped

The backend needs two filesystem mounts:

- Calibre library, read-only:
  - host: `/volume1/books/calibre`
  - container: `/usr/src/app/data/calibre`
- App data, writable:
  - host: `/volume1/docker/calibre-vue-web/app-data`
  - container: `/usr/src/app/data/app`

The app expects the Calibre DB file inside the container at:

```text
/usr/src/app/data/calibre/metadata.db
```

unless you deliberately change `CALIBRE_DB_NAME`.

The app database should remain at:

```text
/usr/src/app/data/app/app.db
```

## Environment Variables

Set these values in Container Manager or your imported compose project:

```env
FRONTEND_PORT=8888
BACKEND_PORT=3000
FRONTEND_URL=https://books.example.com
SESSION_SECRET=replace-with-a-long-random-value
GOOGLE_CLIENT_ID=replace-with-google-client-id
GOOGLE_CLIENT_SECRET=replace-with-google-client-secret
CALIBRE_DB_PATH=/volume1/books/calibre
CALIBRE_DB_NAME=metadata.db
APP_DB_PATH=/usr/src/app/data/app/app.db
```

Key points:

- `FRONTEND_URL` must be the real URL users type into the browser.
- If you put the app behind Synology Reverse Proxy, use the public HTTPS URL there.
- `CALIBRE_DB_PATH` is only used by Compose-style host mapping. If you configure volumes manually in the Synology UI, what matters most is that the container still sees the library at `/usr/src/app/data/calibre`.

## Deployment Options

You can deploy either of these ways:

1. Import the repository's compose file into Container Manager and supply the environment values.
2. Create the frontend and backend containers manually, then reproduce the same ports, environment variables, and mounts.

Importing the compose project is less error-prone because the frontend-to-backend proxy relationship is already encoded.

## Port And URL Guidance

By default, the stack expects:

- frontend exposed on `8888`
- backend exposed on `3000`

If you place Synology Reverse Proxy in front of the frontend, users should still browse only the frontend URL. OAuth and browser traffic should be based on that frontend origin, not on the backend port.

Example:

- Public URL: `https://books.example.com`
- `FRONTEND_URL=https://books.example.com`
- Google redirect URI: `https://books.example.com/api/auth/google/callback`

## Verification Checklist

After deployment:

1. Open the frontend URL from a browser.
2. Confirm the frontend loads without nginx errors.
3. Trigger Google sign-in and confirm the redirect reaches Google.
4. Confirm the backend logs do not show a missing Calibre database.
5. Confirm approved users can browse books after signing in.

## Synology-Specific Troubleshooting

### Permission denied on mounted folders

If the backend cannot open `metadata.db` or cannot create `app.db`, check:

- NAS folder permissions on the two host paths
- whether the app data folder is writable
- whether the Calibre folder is readable

The Calibre library mount should stay read-only. The app data mount must be writable.

### The backend cannot find `metadata.db`

Check:

- the library folder mapping points to the directory that contains `metadata.db`
- the filename really is `metadata.db`
- `CALIBRE_DB_NAME` was not changed incorrectly

### Google sign-in fails after adding or changing reverse proxy

This usually means the public URL changed but one of these values did not:

- `FRONTEND_URL`
- Google authorized origin
- Google redirect URI

Update all three together. The full Google-side process is in [Google OAuth Setup](google-oauth.md).

### Frontend loads but API calls fail

The frontend nginx container proxies `/api/` to the backend container. If page loads work but auth or book requests fail:

- confirm both containers are running
- confirm the frontend still routes `/api/` to the backend
- confirm your reverse proxy forwards the same host users open in the browser
