# Docker Hub Image Deployment

This guide explains how to build the frontend and backend images outside the
NAS, publish them to one private Docker Hub repository, and deploy them on
Synology Container Manager with Compose.

## Repository And Tag Layout

One private Docker Hub repository is enough. Store both application images in
it with distinct tags:

```text
YOUR_DOCKERHUB_USER/calibre-vue:frontend-a4c6e99
YOUR_DOCKERHUB_USER/calibre-vue:backend-a4c6e99
```

The text after each image type is a Git commit SHA. Generate it from the
checked-out source with:

```bash
git rev-parse --short=12 HEAD
```

It is not a Docker-generated value and does not need to increase numerically.
Docker tags may be any valid, unique string. A commit SHA is recommended
because it permanently identifies the source revision used for the image and
makes rollback straightforward. Build and deploy from a clean, committed tree
so the tag accurately represents the image contents.

## Prerequisites

- A private Docker Hub repository named `calibre-vue`.
- Docker with Buildx on the build machine.
- Docker Hub credentials on the build machine and the NAS.
- The NAS CPU architecture. Over SSH, run:

  ```bash
  docker info --format '{{.Architecture}}'
  ```

  Use `linux/amd64` for `x86_64` and `linux/arm64` for `aarch64`.

Most Synology models that support Container Manager are `linux/amd64`, but
verify before building. A container image must match the NAS architecture.

## Build And Push

From a clean checkout at the repository root, log in and create a Buildx
builder if you do not already have one:

```bash
docker login
docker buildx create --name calibre-builder --use --bootstrap
```

Set the repository and immutable release tag for this build:

```bash
IMAGE_REPOSITORY=YOUR_DOCKERHUB_USER/calibre-vue
IMAGE_TAG=$(git rev-parse --short=12 HEAD)
```

Build and push the frontend image. Replace `linux/amd64` if your NAS reports
another architecture:

```bash
docker buildx build \
  --platform linux/amd64 \
  --file frontend/Dockerfile \
  --tag "$IMAGE_REPOSITORY:frontend-$IMAGE_TAG" \
  --push .
```

Build and push the backend image:

```bash
docker buildx build \
  --platform linux/amd64 \
  --file backend/Dockerfile \
  --tag "$IMAGE_REPOSITORY:backend-$IMAGE_TAG" \
  --push .
```

The Dockerfiles require the repository root as their build context, which is
why both commands end in `.`.

If you need to support both x86-64 and ARM NAS devices, build a multi-platform
image instead:

```bash
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  --file frontend/Dockerfile \
  --tag "$IMAGE_REPOSITORY:frontend-$IMAGE_TAG" \
  --push .
```

Repeat that command with `backend/Dockerfile` and the `backend-` tag. This can
be slower because the backend includes a native SQLite dependency.

## Configure The Synology Compose Project

Use a deployment-specific Compose file on the NAS. Do not combine it as an
override with the repository's [docker-compose.yml](../docker-compose.yml):
that file contains `build` sections, and the NAS should pull the published
images instead.

Start with a copy of `docker-compose.yml`, remove these `build` blocks, and
add the corresponding `image` entries:

```yaml
services:
  frontend:
    image: ${IMAGE_REPOSITORY}:frontend-${IMAGE_TAG}

  backend:
    image: ${IMAGE_REPOSITORY}:backend-${IMAGE_TAG}
```

Keep all existing ports, backend volumes, environment variables, networks, and
`depends_on` settings. In the NAS project directory, create a local `.env`
file containing the normal deployment settings plus the image values:

```env
IMAGE_REPOSITORY=YOUR_DOCKERHUB_USER/calibre-vue
IMAGE_TAG=replace-with-12-character-commit-sha
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

Keep this `.env` file only on the NAS. It contains secrets and must not be
committed or embedded in an image. See [Synology NAS Deployment](synology-nas.md)
for the required mounts and reverse-proxy/OAuth settings.

## Deploy And Update

Log in to Docker Hub from the NAS once so it can pull the private images:

```bash
docker login
```

From the NAS Compose project directory:

```bash
docker compose pull
docker compose up -d
docker compose ps
```

To deploy a new release, push images tagged with a new commit SHA, update only
`IMAGE_TAG` in the NAS `.env` file, then run `docker compose pull` and
`docker compose up -d` again. To roll back, set `IMAGE_TAG` to a prior known
good SHA and redeploy. The mounted Calibre library and `app_data` persist
through these container replacements.

## Troubleshooting

### The NAS cannot pull the image

- Confirm `docker login` on the NAS used the Docker Hub account that owns or
  has access to the private repository.
- Confirm the image name and tag in `.env` exactly match the pushed tag.
- Confirm the pushed image architecture matches the NAS.

### The NAS tries to build instead of pulling

The deployment Compose file still contains a `build` section. Remove it and
use only the `image` entries shown above.

### OAuth fails after deployment

`FRONTEND_URL` must be the exact HTTPS URL users open, and Google must list
`${FRONTEND_URL}/api/auth/google/callback` as an authorized redirect URI.
