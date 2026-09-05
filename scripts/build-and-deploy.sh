#!/usr/bin/env bash

set -Eeuo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
project_root="$(cd -- "${script_dir}/.." && pwd)"
env_file="${ENV_FILE:-${project_root}/.env}"
compose_file="${COMPOSE_FILE:-${project_root}/docker-compose.deploy.yml}"
run_build=true
run_deploy=false
reset_builder=false

usage() {
  cat <<'EOF'
Usage: scripts/build-and-deploy.sh [options]

Build and push the frontend and backend images to Docker Hub, then deploy
them on the current Docker host.

Options:
  --build-only       Build and push without deploying
  --deploy-only      Pull and deploy without building
  --reset-builder    Remove and recreate the configured Buildx builder
  -h, --help         Show this help

Set ENV_FILE or COMPOSE_FILE to use files outside the repository root.
EOF
}

fail() {
  printf 'Error: %s\n' "$*" >&2
  exit 1
}

read_env_value() {
  local requested_key="$1"
  local line=''
  local value=''

  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%$'\r'}"
    if [[ "$line" =~ ^[[:space:]]*(export[[:space:]]+)?${requested_key}[[:space:]]*=(.*)$ ]]; then
      value="${BASH_REMATCH[2]}"
    fi
  done < "$env_file"

  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  if [[ "$value" == \"*\" && "$value" == *\" ]]; then
    value="${value:1:${#value}-2}"
  elif [[ "$value" == \'*\' && "$value" == *\' ]]; then
    value="${value:1:${#value}-2}"
  else
    value="${value%%[[:space:]]#*}"
  fi
  printf '%s' "$value"
}

load_env_value() {
  local key="$1"
  local value=''

  if [[ ! -v "$key" ]]; then
    value="$(read_env_value "$key")"
    printf -v "$key" '%s' "$value"
    export "$key"
  fi
}

while (($# > 0)); do
  case "$1" in
    --build-only)
      run_deploy=false
      ;;
    --deploy-only)
      run_build=false
      ;;
    --reset-builder)
      reset_builder=true
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      usage >&2
      fail "Unknown option: $1"
      ;;
  esac
  shift
done

if [[ "$run_build" == false && "$run_deploy" == false ]]; then
  fail '--build-only and --deploy-only cannot be used together.'
fi
if [[ "$run_build" == false && "$reset_builder" == true ]]; then
  fail '--reset-builder cannot be used with --deploy-only.'
fi

[[ -f "$env_file" ]] || fail "Environment file not found: ${env_file}. Copy .env.example to .env and configure it."
if [[ "$run_deploy" == true ]]; then
  [[ -f "$compose_file" ]] || fail "Compose file not found: ${compose_file}"
fi

# Read only the release values needed by this script. Compose reads all
# application settings directly from the same file during deployment.
load_env_value DOCKERHUB_USER
load_env_value DOCKERHUB_REPOSITORY
load_env_value FRONTEND_IMAGE_NAME
load_env_value BACKEND_IMAGE_NAME
load_env_value DOCKERHUB_TOKEN
load_env_value IMAGE_TAG
load_env_value DOCKER_PLATFORMS
load_env_value BUILDX_BUILDER

: "${DOCKERHUB_USER:?Set DOCKERHUB_USER in ${env_file}}"
: "${DOCKERHUB_REPOSITORY:?Set DOCKERHUB_REPOSITORY in ${env_file}}"
: "${FRONTEND_IMAGE_NAME:=calibre-vue-frontend}"
: "${BACKEND_IMAGE_NAME:=calibre-vue-backend}"
: "${DOCKER_PLATFORMS:=linux/amd64}"
: "${BUILDX_BUILDER:=calibre-builder}"

image_repository="${DOCKERHUB_USER}/${DOCKERHUB_REPOSITORY}"

if [[ -z "${IMAGE_TAG:-}" ]]; then
  command -v git >/dev/null 2>&1 || fail 'git is required when IMAGE_TAG is not set.'
  if ! IMAGE_TAG="$(git -C "$project_root" rev-parse --short=12 HEAD)"; then
    fail 'IMAGE_TAG is not set and the current Git commit could not be determined.'
  fi
fi
frontend_tag="${FRONTEND_IMAGE_NAME}-${IMAGE_TAG}"
backend_tag="${BACKEND_IMAGE_NAME}-${IMAGE_TAG}"
export DOCKERHUB_REPOSITORY FRONTEND_IMAGE_NAME BACKEND_IMAGE_NAME IMAGE_TAG

command -v docker >/dev/null 2>&1 || fail 'docker is not installed or is not on PATH.'

if [[ -n "${DOCKERHUB_TOKEN:-}" ]]; then
  printf 'Logging in to Docker Hub as %s...\n' "$DOCKERHUB_USER"
  printf '%s' "$DOCKERHUB_TOKEN" | docker login \
    --username "$DOCKERHUB_USER" \
    --password-stdin
  unset DOCKERHUB_TOKEN
else
  printf 'Using the existing Docker Hub login. Set DOCKERHUB_TOKEN in %s for non-interactive login.\n' "$env_file"
fi

if [[ "$run_build" == true ]]; then
  docker buildx version >/dev/null 2>&1 || fail 'Docker Buildx is not available.'

  if [[ "$reset_builder" == true ]] && docker buildx inspect "$BUILDX_BUILDER" >/dev/null 2>&1; then
    printf 'Removing Buildx builder %s...\n' "$BUILDX_BUILDER"
    docker buildx rm "$BUILDX_BUILDER"
  fi

  if docker buildx inspect "$BUILDX_BUILDER" >/dev/null 2>&1; then
    printf 'Reusing Buildx builder %s...\n' "$BUILDX_BUILDER"
    docker buildx use "$BUILDX_BUILDER"
  else
    printf 'Creating Buildx builder %s...\n' "$BUILDX_BUILDER"
    docker buildx create \
      --name "$BUILDX_BUILDER" \
      --driver docker-container \
      --use
  fi
  docker buildx inspect --bootstrap >/dev/null

  if [[ -n "$(git -C "$project_root" status --short 2>/dev/null || true)" ]]; then
    printf 'Warning: the working tree is dirty; tag %s does not identify every local change.\n' "$IMAGE_TAG" >&2
  fi

  printf 'Building and pushing %s:%s and %s:%s for %s...\n' \
    "$image_repository" "$frontend_tag" \
    "$image_repository" "$backend_tag" \
    "$DOCKER_PLATFORMS"
  docker buildx build \
    --builder "$BUILDX_BUILDER" \
    --platform "$DOCKER_PLATFORMS" \
    --file "$project_root/frontend/Dockerfile" \
    --tag "${image_repository}:${frontend_tag}" \
    --push \
    "$project_root"

  docker buildx build \
    --builder "$BUILDX_BUILDER" \
    --platform "$DOCKER_PLATFORMS" \
    --file "$project_root/backend/Dockerfile" \
    --tag "${image_repository}:${backend_tag}" \
    --push \
    "$project_root"
fi

if [[ "$run_deploy" == true ]]; then
  docker compose version >/dev/null 2>&1 || fail 'Docker Compose is not available.'
  printf 'Pulling and deploying both images with tag %s...\n' "$IMAGE_TAG"
  docker compose --env-file "$env_file" --file "$compose_file" pull
  docker compose --env-file "$env_file" --file "$compose_file" up --detach
  docker compose --env-file "$env_file" --file "$compose_file" ps
fi

printf 'Release complete:\n  %s:%s\n  %s:%s\n' \
  "$image_repository" "$frontend_tag" \
  "$image_repository" "$backend_tag"
