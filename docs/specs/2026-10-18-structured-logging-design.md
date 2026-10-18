# Structured Logging and Browser Log Forwarding

Status: draft for approval. Branch: `feature/structured-logging`.

## Intent

The app is being deployed to a Synology NAS under Container Manager. Its first
real problems (database path, permissions) were hard to see because logs were
partial, unstructured, and the process exited before the log file was written.
The next class of problems will happen in the browser, mainly Google sign-in
redirects, but also failed book downloads and covers that do not load. Today
those only appear in the browser console, so nobody but the person at the
keyboard can see them.

Goal: one place (the log files on the NAS) where backend events and browser
errors can be read together, grouped by browser session, without ever recording
secrets.

Only the owner uses the app today. Friends will be added after the owner is
satisfied with how it runs, so the design should be fine for a handful of
people on one NAS and does not need to scale further.

## Goals

1. A new log file at every container start and another at every day change.
2. Log files older than 30 days are deleted automatically.
3. Every log line is one JSON object so the owner can filter with `grep` and
   `jq`, by session id and by day.
4. The browser forwards errors to a backend endpoint. Browser lines and backend
   lines are distinguishable and can be grouped by a session id.
5. Every step of Google sign-in is recorded (browser and backend), including
   the failures, even for people who never finish signing in.
6. No tokens, secrets, cookies, OAuth codes, or email addresses in the logs.
7. A guide for filtering the logs with `jq` and `grep` (a task below).

## Non-goals

- A log viewer page in the app. The owner reads files with `grep` and `jq`.
- Signed or server-issued session ids (considered and rejected; see Decisions).
- Recording routine browser activity (page views, successful requests,
  downloads that worked). Browser forwarding is for errors and sign-in steps.
- Shipping logs to an external service, metrics, or alerting.
- Rotating by file size.
- Changing the Calibre or app databases.

## Anti-goals (a failure even if it technically works)

- Any secret reaching a log file, even by accident or via an error object.
- Logging failures breaking the app. Writing a log line, sending a batch, or
  failing to reach the endpoint must never throw into app code or delay a
  response.
- Unbounded disk growth, including from someone abusing the public log
  endpoint.
- Per-request noise (the current header and body dump per request goes away).

## Decisions made with the owner

- Sign-in is logged at every step, not only on failure.
- New file per container start and per day; 30 days retention.
- Format must be filterable by session id and day with `grep`/`jq`.
- Emails are replaced by internal user ids in all log lines.
- The log endpoint is public, protected only by size caps and a per-IP rate
  limit. The browser creates its own session id.
- Browser forwarding is errors only, plus the sign-in steps above.
- Spec lives in `docs/specs/`; the filtering guide is a task.

## Design

### Log files

- Directory: the existing logs directory (`<cwd>/logs`, mounted from
  `app_data/logs` on the NAS). Optionally overridable with `LOG_DIR`.
- Name: `app-YYYY-MM-DDTHH-mm-ss.log`, using the local time (see `TZ`) at which
  the file is created. A container start creates one file. At local midnight
  the logger switches to a new file named with that moment, so a day's files
  all share its date prefix.
- Retention: at start-up and at each rollover, delete files in the logs
  directory whose names match the pattern above and whose date is older than
  `LOG_RETENTION_DAYS` (default 30). Never delete files that do not match the
  pattern. The legacy `app.log` is left alone.
- `TZ`: add `TZ=${TZ:-UTC}` to the backend service in both compose files and
  document it. `node:22-alpine` has no timezone database, so the backend image
  needs `tzdata` installed for a non-UTC value to work.
- Console: the logger keeps writing to stdout so Container Manager's log view
  keeps working, using the same JSON lines.
- The existing guarantee stays: on a fatal start-up error the logs are flushed
  before the process exits.

### Log entry format

One JSON object per line:

| Field | Notes |
|---|---|
| `ts` | ISO 8601 UTC timestamp |
| `level` | `info`, `warn`, or `error` |
| `source` | `backend` or `browser` |
| `sessionId` | the browser session id; omitted when there is no browser behind the line (start-up, background work) |
| `userId` | internal user id, only when known |
| `event` | short dotted name, for example `auth.google.start`, `http.request`, `download.failed`; plain legacy messages use `log` |
| `message` | human-readable text |
| `details` | optional object of extra fields (status, path, duration, error name) |

The logger keeps its current `info(message)` and `error(message)` calls working
and gains `warn`, plus an optional second argument carrying `event`, `userId`,
and `details`. Existing call sites do not all have to be rewritten; the ones
touched by this work (auth, request logging, start-up) should use events.

### Session id

- The browser generates a random id (UUID) when the app first loads and keeps
  it in `sessionStorage`. It survives the redirect to Google and back in the
  same tab. A new tab or a new visit gets a new id. It identifies a browser
  session, not a user, so it exists before, during and after sign-in.
- The frontend sends it as an `X-Session-Id` header on every API call.
- The backend validates it (letters, digits, dashes, 8 to 64 characters) and
  ignores anything else. It makes the id available to every log call made
  while handling that request, including calls inside Passport callbacks that
  have no `req` in scope (an `AsyncLocalStorage` context is the likely way).
- The Google callback is a top-level navigation back from Google, so it cannot
  carry a custom header. Just before navigating to `/api/auth/google`, the
  frontend sets a short-lived cookie (`client_session_id`, 10 minutes,
  `SameSite=Lax`, `Path=/api/auth/google`, not `HttpOnly`) containing the id.
  The backend uses that cookie as the id source for the sign-in routes. It is
  deliberately independent of the express session cookie: a lost or rejected
  session cookie is one of the failures we want to be able to see, and the
  callback log line must still carry the id when it happens.
  This is a design call by the author, not something the owner specified.
- The cookie holds only the random id, never a credential.

### Backend request logging

Replace the per-request header and body dump with one line when the response
finishes: `http.request`, with method, sanitized path, status, duration,
`sessionId`, and `userId` when authenticated. No headers and no bodies are
logged at all. Query strings go through the redaction below.

### Backend sign-in events

At minimum: `auth.google.start` (request to begin sign-in),
`auth.google.callback` (callback received, including whether Google returned
an error or the user cancelled), the outcome (`approved`, `pending`, `denied`,
or `error` with a reason such as state verification failure or session
creation failure), `auth.session.check` (the `/auth/me` result), and
`auth.logout`. Replace every email in existing auth log lines with the user
id (`googleAuthController`, `authService`, `authMiddleware`, deserialize). When
a login fails before a user record exists, log the failure without any
identifier from the Google profile.

A sign-in that fails at Google itself (for example a redirect URI mismatch)
never reaches the backend. It shows up as an `auth.google.start` from the
browser with no `auth.google.callback` afterwards for the same session, and
that gap should be called out in the filtering guide.

### Client log endpoint

- `POST /api/client-logs`, mounted before `authenticateToken` so it works for
  people who are not signed in. Responds `204` on success, with no body.
- Body: `{ sessionId, entries: [{ ts, level, event, message, details }] }`.
  The session id is also accepted in the body because `sendBeacon` cannot set
  headers.
- Validation and limits (starting values, the builder may tune them):
  at most 20 entries per request; request body at most 16 KB; `message` at
  most 1000 characters; `event` at most 64 characters matching
  `^[a-z0-9._-]+$`; `details` limited to a shallow object of short strings,
  numbers and booleans. Reject the whole request with `400` if malformed and
  `413` if too large.
- Rate limit per client IP (starting value: 60 requests per minute), `429` when
  exceeded. Behind the Synology reverse proxy and the frontend nginx container,
  the backend sees the proxy's address unless `trust proxy` is configured;
  today it is only enabled when `FRONTEND_URL` is https. The builder must make
  sure the limit keys on the real client address, or document the limitation.
- The server sets `source` to `browser`, takes the time received as a fallback
  for a missing or implausible `ts`, and applies the same redaction as every
  other log line. It never trusts the client to have redacted anything.
- Level cap: browser entries are written as `info`, `warn` or `error` only.

### Frontend capture

Errors only, plus the sign-in steps. A small logging module (`frontend/src`)
that never throws:

- Batches entries in memory and flushes every few seconds, when the batch is
  full, and when the page is hidden or unloading. It must also flush
  immediately before the redirect to Google, using `fetch` with `keepalive`
  (or `sendBeacon`), or the `auth.google.start` line is lost.
- If sending fails, drop the batch after a small number of retries and keep a
  bounded buffer so a down backend cannot grow memory.
- Captures: uncaught errors (`window.onerror`), unhandled promise rejections,
  Vue's `app.config.errorHandler`, router errors, and failed API calls via the
  existing axios response interceptor (method, path without query string,
  status, error code or name). This covers covers and downloads, which go
  through axios.
- Sign-in steps from the browser: login page shown, Google sign-in clicked
  (before redirect), callback page shown with its status, auth check result
  and any redirect back to login.
- The existing `console.error` calls stay for the developer console and also
  report through the module.
- Never sent: request or response bodies, headers, axios `config`, cookies,
  query strings, the OAuth `code` and `state`, or any user-entered text. Send
  an explicit allowlist of fields from errors, not whole error objects.

### Redaction (backend, central)

One sanitizer applied to every entry before it is written, whatever its source:

- Drop or mask values under keys containing `token`, `secret`, `key`,
  `password`, `cookie`, `authorization`, `code`, `state`, or `session` (the
  `client_session_id` cookie value is the one allowed exception, as
  `sessionId`).
- Mask sensitive query parameters in any URL, as `requestLogger` does today.
- Scrub strings that look like bearer tokens or JWTs inside messages.
- No email addresses: mask anything shaped like one as a last line of defence.
- Keep the existing redaction tests passing and extend them.

### Configuration and docs

- New env vars, all optional with defaults: `LOG_DIR`, `LOG_RETENTION_DAYS`
  (30), `TZ` (UTC). Add them to `.env.example`, both compose files, and the
  deployment docs.
- Update `docs/synology-nas.md` and `docs/docker.md` where logs are
  mentioned.

## Testing

Tests beside the code, per the repository guidelines: the sanitizer (including
nested objects, URLs and token-shaped strings), the rolling file destination
with a fake clock (start-up file, midnight rollover, no lost lines),
retention (deletes only matching, old files), the client log endpoint
(validation, size and entry caps, rate limit, redaction, public access), the
request logger (one line, no headers or bodies), session-id propagation into
Passport callbacks, the frontend module (batching, flush before redirect, never
throws, bounded buffer), the session id persistence, and the axios
interceptor. Run `bun run build` and `bun run test -- --run` before finishing.

## Tasks

1. Logging core: JSON entries, `warn`, optional fields, request context,
   central redaction.
2. Rolling file destination with per-start and per-day files, retention, and
   `TZ` support (compose files, `tzdata` in the backend image).
3. Replace the request logger and remove emails from existing log lines.
4. Sign-in events and the `client_session_id` cookie on the backend.
5. `POST /api/client-logs` with limits and rate limiting.
6. Frontend logging module, session id, global error hooks, axios interceptor,
   and sign-in step reporting.
7. Config, `.env.example`, compose files, deployment docs.
8. Write `docs/logging.md`: a guide to filtering the log files with `jq` and
   `grep`. Cover: choosing files by day (`ls`, `grep`), all lines for one
   session id, only errors, only browser lines, following one sign-in from
   start to outcome, and finding sessions that started Google sign-in but
   never reached the callback. Write it against the final field names, using
   a real sample file from the finished feature to check each command.

## Calls made by the author (owner to review)

- The `client_session_id` cookie and `Path=/api/auth/google` scoping for the
  callback (above).
- Console output uses the same JSON lines as the files.
- One `http.request` line per request, at completion, with no headers or
  bodies.
- Starting values for the caps and the rate limit.
- `LOG_DIR` and `LOG_RETENTION_DAYS` as env vars with the stated defaults.
- Rejecting the whole log request when malformed, rather than partially
  accepting it.
