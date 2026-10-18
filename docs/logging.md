# Reading The Logs

The backend writes one JSON object per line, for both its own events and the errors and sign-in steps that browsers report. This guide shows how to filter those lines with `grep` and `jq`. Setting up the log volume, `TZ`, `LOG_DIR` and `LOG_RETENTION_DAYS` is covered in [Docker Deployment](docker.md) and [Synology NAS Deployment](synology-nas.md).

## Where The Files Are

Log files live in `app_data/logs` on the host and are named `app-YYYY-MM-DDTHH-mm-ss.log`. The name is the local time (in the container's `TZ`) when the file was created: a new file starts when the backend starts and on the first log line after local midnight. Files older than `LOG_RETENTION_DAYS` (default 30) are deleted automatically.

The `ts` field inside each line is always UTC, so near midnight a file named for one local day can contain lines stamped with the next UTC day. All commands below assume you are in the log directory:

```bash
cd app_data/logs
```

`jq` is needed for the structured filters. The `grep` equivalents work with plain `grep` (they match the compact JSON the backend writes).

## Line Format

| Field | Meaning |
| --- | --- |
| `ts` | UTC time, ISO 8601. For browser lines this is the time the browser recorded the event. |
| `level` | `info`, `warn` or `error`. |
| `source` | `backend` or `browser`. |
| `sessionId` | Optional. Groups the lines of one browser tab's visit (see below). |
| `userId` | Optional. The numeric user id, as a string, once the user is signed in. |
| `event` | Short machine-readable name, for example `auth.google.start`. |
| `message` | Human-readable text. |
| `details` | Optional object with event-specific fields. Browser `http.failed` paths have no `/api` prefix (`/auth/me`), while backend `http.request` paths do (`/api/auth/me`). |

```json
{"ts":"2026-10-18T19:27:58.333Z","level":"info","source":"backend","sessionId":"7f3c2a10-aaaa-bbbb-cccc-111122223333","event":"auth.google.start","message":"Starting Google sign-in"}
{"ts":"2026-10-18T19:27:58.412Z","level":"warn","source":"browser","sessionId":"7f3c2a10-aaaa-bbbb-cccc-111122223333","userId":"42","event":"http.failed","message":"GET /auth/me failed (401)","details":{"name":"AxiosError","status":401,"method":"GET","path":"/auth/me"}}
```

Events you will meet:

| Source | Events |
| --- | --- |
| backend | `auth.google.start`, `auth.google.callback`, `auth.google.outcome` (`details.status` is `approved`, `pending`, `denied`, `no_user` or `error`), `auth.session.check`, `auth.logout`, `http.request`, `clientlog.budget_exhausted` (the day's browser log budget ran out) |
| browser | `auth.login.view`, `auth.google.click`, `auth.redirect.login`, `auth.callback.view`, `auth.callback.result`, `http.failed`, `router.error`, `window.error`, `window.unhandledrejection`, `vue.error`, `client.log.dropped` (`details.dropped` entries were dropped by the browser's 60-per-minute cap) |

A browser can send any event name, including a backend one, so filters that rely on a backend event also check `.source == "backend"`. Lines written at startup have no `sessionId`. The filters below skip lines that lack a field instead of failing.

## Commands

The examples use the dummy session `7f3c2a10-aaaa-bbbb-cccc-111122223333` and user `42`; substitute your own. Each `app-2026-10-18*.log` glob selects the files created on that local day; use `app-*.log` for everything. If nothing matches a day's glob, the shell, `ls` or `jq` reports "No such file" (zsh: "no matches found"); that only means there is no log for that day.

List the files for one day:

```bash
ls app-2026-10-18*.log
```

Search one day's files for text, without file names in the output:

```bash
grep -h -F 'access_denied' app-2026-10-18*.log
```

All lines for one session, in file order:

```bash
jq -c 'select(.sessionId == "7f3c2a10-aaaa-bbbb-cccc-111122223333")' app-2026-10-18*.log
grep -h -F '"sessionId":"7f3c2a10-aaaa-bbbb-cccc-111122223333"' app-2026-10-18*.log
```

Errors only (use `"level":"warn"` to see warnings):

```bash
jq -c 'select(.level == "error")' app-2026-10-18*.log
grep -h -F '"level":"error"' app-2026-10-18*.log
```

Browser lines only (use `backend` for the other side):

```bash
jq -c 'select(.source == "browser")' app-2026-10-18*.log
grep -h -F '"source":"browser"' app-2026-10-18*.log
```

One sign-in trail from start to outcome, merging backend and browser lines and sorted by `ts` across all selected files. `-s` reads every file into one array first, so this works even when a visit spans midnight and two files:

```bash
jq -s -r --arg id 7f3c2a10-aaaa-bbbb-cccc-111122223333 '
  map(select(.sessionId == $id and (.event | startswith("auth."))))
  | sort_by(.ts)[]
  | [.ts, .source, .level, .event, .message] | @tsv' app-*.log
```

Drop the `startswith("auth.")` condition to see everything the session did, including `http.request` and `http.failed`.

Sessions that logged `auth.google.start` but never `auth.google.callback`:

```bash
jq -s -r '
  map(select(.sessionId != null)) | group_by(.sessionId)[]
  | select(any(.[]; .source == "backend" and .event == "auth.google.start")
           and (any(.[]; .source == "backend" and .event == "auth.google.callback") | not))
  | .[0].sessionId' app-*.log
```

This is how a failure at Google itself looks. When Google rejects the request, for example with a redirect URI mismatch, the browser never returns to `/api/auth/google/callback`, so the backend has nothing to log after the start. Check each listed session's browser lines (the session command above): `auth.login.view` and `auth.google.click` with nothing after them confirm it. A tab that failed at Google and later signed in successfully has a callback under the same session id, so its earlier failed attempt is not listed. Sessions that are still mid-sign-in, or where the user simply closed the tab at Google, appear in this list too. Compare the `ts` with when you tried to sign in.

Failed HTTP calls reported by browsers, counted by status, method and path (browser paths have no `/api` prefix). The label `network ? ?` is printed when a line has no status, that is a network error or a non-HTTP error:

```bash
jq -r 'select(.event == "http.failed")
  | "\(.details.status // "network") \(.details.method // "?") \(.details.path // "?")"' app-*.log \
  | sort | uniq -c | sort -rn
```

Everything that happened to one user, in time order. On a browser line, `userId` is the user signed in when the batch was sent, so a batch flushed after sign-in can carry the id on earlier events, and lines sent before sign-in carry none. List the user's session ids to see the whole visit:

```bash
jq -s -c 'map(select(.userId == "42")) | sort_by(.ts)[]' app-*.log
grep -h -F '"userId":"42"' app-*.log
jq -r 'select(.userId == "42") | .sessionId // empty' app-*.log | sort -u
```

## What Is Never Logged

Tokens, secrets, cookies, `Authorization` headers, the OAuth `code` and `state`, request and response bodies, and email addresses never reach the log; user ids stand in for people. Browser entries drop URL query strings entirely, and backend `http.request` lines mask the values of sensitive query parameters such as `code` or `state`.

The `sessionId` is a random id that a browser tab keeps in `sessionStorage` while it stays open. It groups one tab's visit and is not tied to a user: the same person gets a new id in a new tab, and a shared computer is not distinguishable from a single user. Use `userId` to follow a person.

## Troubleshooting Hints

| Symptom | What to look for |
| --- | --- |
| Google shows an error page and the user never returns | `auth.google.start` with no `auth.google.callback` for that session (the command above). Check the redirect URI settings in [Google OAuth Setup](google-oauth.md). |
| User comes back from Google but is not signed in | `auth.google.outcome` for the session. `no_user` means Google gave no usable account (check `auth.google.callback` for `details.googleError`, for example `access_denied` when the user cancelled). `error` means the backend failed; the `message` and `details.reason` say where. |
| "Waiting for approval" or "access denied" screen | `auth.google.outcome` with `details.status` `pending` or `denied`, and `auth.callback.view` with the same status in the browser. |
| Callback page shows an error | `auth.callback.view` with `details.status` `error` (backend redirected with `?status=error`, so look for an `error` outcome just before it), or `auth.callback.result` with `authenticated` false. |
| Signed in, then bounced back to the login page | `http.failed` with `details.status` 401 on `/auth/me` or another API path (browser paths have no `/api` prefix), then `auth.redirect.login`. Compare with `auth.session.check` for that session: `authenticated: false` means the server did not recognise the session cookie (often a `FRONTEND_URL` or reverse-proxy mismatch). |
| Blank page or broken screen | `window.error`, `window.unhandledrejection`, `vue.error` or `router.error` lines for the session. |
| Requests failing with no response | `http.failed` with no `details.status` is a network error or timeout; check the backend `http.request` lines at the same time for what the server saw. |
