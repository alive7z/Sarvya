FROM node:22-bookworm-slim AS assets
WORKDIR /build
RUN apt-get update && apt-get install -y --no-install-recommends zip && rm -rf /var/lib/apt/lists/*
COPY extension/package*.json ./extension/
COPY cli/package*.json ./cli/
COPY frontend/package*.json ./frontend/
RUN npm ci --prefix extension && npm ci --prefix cli && npm ci --prefix frontend
COPY extension ./extension
COPY cli ./cli
COPY scripts ./scripts
RUN node scripts/package-release.mjs
COPY frontend ./frontend
RUN npm --prefix frontend run build

FROM node:22-bookworm-slim
WORKDIR /app/backend
ENV NODE_ENV=production PLAYWRIGHT_BROWSERS_PATH=/ms-playwright DATA_DIR=/app/data STATIC_DIR=/app/frontend
COPY backend/package*.json ./
RUN npm ci --omit=dev && npx playwright install --with-deps chromium \
    && mkdir -p /app/data && chown node:node /app/data \
    && chmod -R a+rX /ms-playwright && rm -rf /var/lib/apt/lists/*
COPY --chown=node:node backend/src ./src
COPY --chown=node:node scripts/start-render.mjs /app/scripts/start-render.mjs
COPY --from=assets --chown=node:node /build/frontend/dist /app/frontend
COPY --from=assets --chown=node:node /build/release /app/frontend/downloads
USER node
EXPOSE 3000
CMD ["node", "/app/scripts/start-render.mjs"]
