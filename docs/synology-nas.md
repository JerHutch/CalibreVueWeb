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
PUID=1000
PGID=1000
TZ=UTC
LOG_RETENTION_DAYS=30
```

Key points:

- `FRONTEND_URL` must be the real URL users type into the browser.
- If you put the app behind Synology Reverse Proxy, use the public HTTPS URL there.
- `PUID` and `PGID` must match a NAS user and group that can read the Calibre library, for example the owner shown by `ls -ldn /volume1/books/calibre`. Synology ACLs can block the default `1000:1000` even when the folder looks world-accessible; the backend log reports `EACCES` when that happens.
- `TZ` (optional, default `UTC`) is an IANA time zone name such as `America/New_York`. A new log file is created on the first log line after local midnight in this zone.
- `LOG_RETENTION_DAYS` (optional, default `30`) is how many days of log files to keep; a missing, invalid or non-positive value falls back to `30`. `LOG_DIR` (optional) overrides the log directory; the default is `/usr/src/app/logs` in the container, mounted from `app_data/logs`.
- `TRUST_PROXY_HOPS` (optional) is the number of proxies in front of the backend. Behind Synology Reverse Proxy and the frontend nginx container, two hops are typically needed for the real client IP, so set `TRUST_PROXY_HOPS=2`; unset keeps the default of one hop for an `https://` `FRONTEND_URL`. A value larger than the real number of proxies lets clients spoof their IP with an `X-Forwarded-For` header, so only raise it to the number of proxies actually in front, and do not expose the backend port `3000` publicly. See [Docker Deployment](docker.md) for details.
- `CLIENT_LOG_DAILY_LIMIT` (optional, default `20000`) caps the browser log entries accepted per local day; see [Docker Deployment](docker.md).
- `CALIBRE_DB_PATH` is only used by Compose-style host mapping. If you configure volumes manually in the Synology UI, what matters most is that the container still sees the library at `/usr/src/app/data/calibre`.

## Logs

The backend writes JSON-line log files to `app_data/logs`, one file per container start and per local day, named `app-YYYY-MM-DDTHH-mm-ss.log`. Files older than `LOG_RETENTION_DAYS` are deleted at startup and at rollover; an older `app.log` is left alone. The same lines appear in Container Manager's log view.

Browser errors and sign-in steps are posted to the public `POST /api/client-logs`, limited to 60 requests per minute per client IP and to `CLIENT_LOG_DAILY_LIMIT` entries per day. Behind Synology Reverse Proxy and the frontend nginx container, requests all appear to come from one address and share that limit unless `TRUST_PROXY_HOPS=2` is set.

See [Reading The Logs](logging.md) for filtering the logs with `jq` and `grep`.

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
