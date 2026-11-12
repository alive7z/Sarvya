FROM node:22-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
COPY package*.json ./
RUN npm ci --omit=dev \
    && npx playwright install --with-deps chromium \
    && mkdir -p /app/data \
    && chown node:node /app/data \
    && chmod -R a+rX /ms-playwright \
    && rm -rf /var/lib/apt/lists/*
COPY --chown=node:node src ./src
USER node
EXPOSE 3000
CMD ["node", "src/app.js"]
