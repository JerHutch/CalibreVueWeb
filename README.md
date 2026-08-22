# Calibre Web App

A web interface for browsing and downloading books from a local Calibre library. The stack is split between a Vue 3 frontend and a Node.js/Express backend, with Google OAuth login and an approval-based access model.

## Guides

- [Docker Deployment](docs/docker.md)
- [Docker Hub Image Deployment](docs/docker-hub.md)
- [Synology NAS Deployment](docs/synology-nas.md)
- [Google OAuth Setup](docs/google-oauth.md)

## Features

- Browse a Calibre library with covers, titles, authors, and metadata.
- Search books by title or author.
- Download supported book files through authenticated routes.
- Sign in with Google OAuth and gate access through admin approval.
- Manage pending users from the admin interface.
- Run the app as separate frontend/backend containers with a mounted Calibre library.

## Architecture

- Frontend: Vue 3, Vite, TypeScript, Pinia
- Tooling: Bun 1.3.14 for dependency management, scripts, and builds
- Backend: Node.js 22 runtime, Express, TypeScript
- Authentication: Google OAuth with server-side sessions
- Data: direct read access to Calibre's `metadata.db` plus a separate app database for user state
- Testing: Vitest in both frontend and backend
- Deployment: Docker Compose with an nginx frontend container proxying `/api/` to the backend

## Testing

Install Bun 1.3.14, then install the workspace dependencies:

```bash
bun install
```

```bash
# Run all tests
bun run test -- --run

# Run backend tests only
cd backend && bun run test -- --run

# Run frontend tests only
cd frontend && bun run test -- --run
```

## Project Structure

```text
CalibreVueWeb/
├── backend/
│   ├── src/
│   └── tests/
├── frontend/
│   ├── src/
│   └── tests/
├── docs/
├── docker-compose.yml
└── README.md
```

## Authentication Model

- Users authenticate with Google.
- New users remain blocked until an admin approves them.
- Approved users can browse and download books.
- Admins can review pending users and grant or deny access.

## Roadmap

- User bookshelves and favorites
- Tag-based browsing
- Download history and activity logs
- Enhanced admin interface
- Mobile app support
- Multi-language support
