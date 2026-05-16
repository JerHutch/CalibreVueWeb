# Google OAuth Setup

This guide covers the Google Cloud configuration required by the current backend OAuth flow.

## How This App Uses OAuth

The backend uses Google as an OAuth provider and expects the callback path:

```text
/api/auth/google/callback
```

The frontend origin is controlled by `FRONTEND_URL`, and the backend redirects the browser back to:

```text
${FRONTEND_URL}/auth/google/callback
```

after it finishes processing the Google callback.

That means your Google redirect URI must always be based on the frontend public origin, not the backend port.

## Prerequisites

- A Google account with access to Google Cloud Console
- The final frontend URL you plan to use

Examples:

- Local Docker: `http://localhost:8888`
- Reverse-proxied deployment: `https://books.example.com`

## 1. Create Or Select A Google Cloud Project

1. Open Google Cloud Console.
2. Create a project for this app, or select an existing one.

## 2. Configure The OAuth Consent Screen

1. Open `APIs & Services` -> `OAuth consent screen`.
2. Choose the appropriate user type for your deployment.
3. Fill in the basic app information.
4. Add test users if your app is still in testing mode.

For personal or home-lab use, this is often enough without a broader public publishing process.

## 3. Create A Web Application OAuth Client

1. Open `APIs & Services` -> `Credentials`.
2. Create a new `OAuth client ID`.
3. Choose `Web application`.

Google will ask for:

- Authorized JavaScript origins
- Authorized redirect URIs

## 4. Configure Authorized Origins And Redirect URIs

Use the frontend URL users actually visit.

### Local Docker Example

```text
Authorized origin: http://localhost:8888
Redirect URI: http://localhost:8888/api/auth/google/callback
```

### Synology Or Reverse Proxy Example

```text
Authorized origin: https://books.example.com
Redirect URI: https://books.example.com/api/auth/google/callback
```

Do not use the backend port as the public redirect URI unless users truly browse the app from that exact backend origin, which is not how this repository is wired by default.

## 5. Copy Credentials Into App Configuration

After creating the OAuth client, Google gives you:

- Client ID
- Client secret

Map them to:

```env
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
FRONTEND_URL=https://books.example.com
```

`FRONTEND_URL` must match the same origin you used in Google Cloud.

You also need a session secret for the backend:

```env
SESSION_SECRET=replace-with-a-long-random-value
```

## 6. Deployment-Specific Values

### Local Docker

```env
FRONTEND_URL=http://localhost:8888
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
SESSION_SECRET=replace-with-a-long-random-value
```

### Synology Or Reverse Proxy

```env
FRONTEND_URL=https://books.example.com
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
SESSION_SECRET=replace-with-a-long-random-value
```

## Troubleshooting

### `redirect_uri_mismatch`

This means Google received a redirect URI that is not registered on the OAuth client.

Check:

- the redirect URI in Google Cloud exactly matches the browser-visible frontend origin plus `/api/auth/google/callback`
- `FRONTEND_URL` matches that same frontend origin
- you did not accidentally use the backend port in Google settings

### Google login returns to the wrong host or protocol

This usually means `FRONTEND_URL` does not match the URL users actually use.

Examples of bad mismatches:

- `FRONTEND_URL=http://localhost:8888` but users browse `https://books.example.com`
- `FRONTEND_URL=https://books.example.com` but users actually open `http://nas.local:8888`

### The Google screen appears, but the app returns to an error state

Check backend logs for:

- missing `GOOGLE_CLIENT_ID`
- missing `GOOGLE_CLIENT_SECRET`
- bad session configuration

Then verify the callback and origin values again.

## Related Guides

- [Docker Deployment](docker.md)
- [Synology NAS Deployment](synology-nas.md)
