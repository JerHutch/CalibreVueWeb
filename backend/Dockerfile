FROM node:22-alpine AS base
WORKDIR /usr/src/app
COPY --from=oven/bun:1.3.14-alpine /usr/local/bin/bun /usr/local/bin/bun
COPY package.json bun.lock bunfig.toml ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json

FROM base AS deps
RUN bun install --frozen-lockfile

FROM base AS build
COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY backend ./backend
COPY --from=deps /usr/src/app/backend/node_modules ./backend/node_modules
RUN cd backend && bun run build
RUN rm -rf node_modules backend/node_modules frontend/node_modules && bun install --frozen-lockfile --production

FROM node:22-alpine AS runtime
WORKDIR /usr/src/app
ENV NODE_ENV=production
COPY --from=build --chown=node:node /usr/src/app/backend/package.json ./backend/package.json
COPY --from=build --chown=node:node /usr/src/app/node_modules ./node_modules
COPY --from=build --chown=node:node /usr/src/app/backend/node_modules ./backend/node_modules
COPY --from=build --chown=node:node /usr/src/app/backend/dist ./backend/dist
USER node
EXPOSE 3000
CMD ["node", "backend/dist/index.js"]
