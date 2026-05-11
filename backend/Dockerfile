FROM node:22-alpine AS deps
WORKDIR /usr/src/app
COPY package*.json ./
RUN if [ ! -f package-lock.json ]; then npm install --package-lock-only; fi
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /usr/src/app
COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY . .
RUN find src -type d -name __tests__ -prune -exec rm -rf '{}' +
RUN npm run build
RUN npm prune --omit=dev

FROM node:22-alpine AS runtime
WORKDIR /usr/src/app
ENV NODE_ENV=production
COPY --from=build --chown=node:node /usr/src/app/package*.json ./
COPY --from=build --chown=node:node /usr/src/app/node_modules ./node_modules
COPY --from=build --chown=node:node /usr/src/app/dist ./dist
USER node
EXPOSE 3000
CMD ["npm", "start"]
