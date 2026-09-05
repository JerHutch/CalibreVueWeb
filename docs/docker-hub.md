# Docker Hub Image Deployment

This guide explains how to build the frontend and backend images outside the
NAS, publish them to one private Docker Hub repository, and deploy them on
Synology Container Manager with Compose.

## Repository And Tag Layout

Use specific tag prefixes to distinguish both application images inside the
same private Docker Hub repository:

```text
YOUR_DOCKERHUB_USER/YOUR_REPOSITORY:calibre-vue-frontend-a4c6e9912def
YOUR_DOCKERHUB_USER/YOUR_REPOSITORY:calibre-vue-backend-a4c6e9912def
```

The tag after each image name is a Git commit SHA. Generate it from the
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

- One private Docker Hub repository for both images.
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

Create the local environment file from the tracked template:

```bash
cp .env.example .env
```

At minimum, configure the Docker Hub settings and all application settings in
`.env`:

```env
DOCKERHUB_USER=YOUR_DOCKERHUB_USER
DOCKERHUB_REPOSITORY=YOUR_PRIVATE_REPOSITORY
FRONTEND_IMAGE_NAME=calibre-vue-frontend
BACKEND_IMAGE_NAME=calibre-vue-backend
DOCKERHUB_TOKEN=replace-with-a-docker-hub-access-token
IMAGE_TAG=
DOCKER_PLATFORMS=linux/amd64
BUILDX_BUILDER=calibre-builder
```

`DOCKERHUB_TOKEN` is optional when the current machine is already authenticated
with `docker login`. Prefer a Docker Hub personal access token over an account
password. `IMAGE_TAG` defaults to the current 12-character Git commit SHA; set
it explicitly to publish or deploy another tag.

Build both images, push them, and deploy them on the current Docker host:

```bash
./scripts/build-and-deploy.sh
```

The script uses [docker-compose.deploy.yml](../docker-compose.deploy.yml), which
pulls published images and contains no `build` sections. Its modes are:

```bash
./scripts/build-and-deploy.sh --build-only
./scripts/build-and-deploy.sh --deploy-only
./scripts/build-and-deploy.sh --reset-builder
```

Use `--build-only` on a workstation when the NAS is a separate host. Copy the
deployment Compose file, script, and configured `.env` to the NAS, set
`IMAGE_TAG` to the published tag, and run the script there with `--deploy-only`.
Alternatively, select a remote Docker context before running the complete
command; host paths such as `CALIBRE_DB_PATH` must then be valid on that remote
Docker host.

If you need to support both x86-64 and ARM NAS devices, build a multi-platform
image by setting this in `.env`:

```env
DOCKER_PLATFORMS=linux/amd64,linux/arm64
```

This can be slower because the backend includes a native SQLite dependency.

### Reset Or Reuse The Buildx Builder

The error `existing instance for "calibre-builder" but no append mode` means a
builder with that name already exists. Remove it and create it again with:

```bash
docker buildx rm calibre-builder
docker buildx create --name calibre-builder --use --bootstrap
```

If the existing builder is healthy, do not recreate it. Select and bootstrap it:

```bash
docker buildx use calibre-builder
docker buildx inspect --bootstrap
```

The deployment script performs the reuse behavior automatically. Pass
`--reset-builder` only when you want it removed and recreated.

## Configure The Synology Compose Project

Use the tracked [docker-compose.deploy.yml](../docker-compose.deploy.yml) on the
NAS. Do not combine it as an override with the repository's
[docker-compose.yml](../docker-compose.yml): that file contains `build`
sections, and the NAS should pull the published images instead.

The deployment file selects the corresponding image tags:

```yaml
services:
  frontend:
    image: ${DOCKERHUB_USER}/${DOCKERHUB_REPOSITORY}:${FRONTEND_IMAGE_NAME}-${IMAGE_TAG}

  backend:
    image: ${DOCKERHUB_USER}/${DOCKERHUB_REPOSITORY}:${BACKEND_IMAGE_NAME}-${IMAGE_TAG}
```

Keep all existing ports, backend volumes, environment variables, networks, and
`depends_on` settings. In the NAS project directory, create a local `.env`
file containing the normal deployment settings plus the image values:

```env
DOCKERHUB_USER=YOUR_DOCKERHUB_USER
DOCKERHUB_REPOSITORY=YOUR_PRIVATE_REPOSITORY
FRONTEND_IMAGE_NAME=calibre-vue-frontend
BACKEND_IMAGE_NAME=calibre-vue-backend
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

From the NAS project directory, either use the script:

```bash
./scripts/build-and-deploy.sh --deploy-only
```

or run Compose directly:

```bash
docker compose --env-file .env --file docker-compose.deploy.yml pull
docker compose --env-file .env --file docker-compose.deploy.yml up -d
docker compose --env-file .env --file docker-compose.deploy.yml ps
```

To deploy a new release, push images tagged with a new commit SHA, update only
`IMAGE_TAG` in the NAS `.env` file, then rerun the deployment script or the
Compose commands above. To roll back, set `IMAGE_TAG` to a prior known good SHA
and redeploy. The mounted Calibre library and `app_data` persist through these
container replacements.

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
