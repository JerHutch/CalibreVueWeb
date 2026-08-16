FROM oven/bun:1.3.14-alpine AS builder
WORKDIR /app
COPY package.json bun.lock bunfig.toml ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json
RUN bun install --frozen-lockfile --filter calibre-web-app-frontend
COPY frontend ./frontend
RUN cd frontend && bun run build

FROM nginx:stable-alpine
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/frontend/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
