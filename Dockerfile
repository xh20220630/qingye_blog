# syntax=docker/dockerfile:1
ARG NODE_IMAGE=node:24.14.1-bookworm-slim@sha256:b506e7321f176aae77317f99d67a24b272c1f09f1d10f1761f2773447d8da26c

FROM ${NODE_IMAGE} AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM dependencies AS build
ARG SITE_URL=http://localhost:8080
ENV SITE_URL=${SITE_URL} ASTRO_TELEMETRY_DISABLED=1
COPY astro.config.mjs tsconfig.json ./
COPY src ./src
COPY public ./public
RUN npm run build

FROM dependencies AS production-dependencies
RUN npm prune --omit=dev --ignore-scripts --no-audit --no-fund

FROM ${NODE_IMAGE} AS runtime
WORKDIR /app
ARG SITE_URL=http://localhost:8080
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4324 \
    SITE_URL=${SITE_URL} \
    QY_STATIC_DIR=/app/dist \
    QY_DATA_DIR=/data
COPY --from=production-dependencies /app/node_modules ./node_modules
COPY package.json ./
COPY server ./server
COPY docker/healthcheck.mjs ./docker/healthcheck.mjs
COPY --from=build /app/dist ./dist
# Reader APIs and backups use the same Markdown metadata as the built pages.
COPY --from=build /app/src/content/blog ./src/content/blog
COPY --from=build /app/src/site-settings.json ./src/site-settings.json
RUN mkdir -p /data/media && chown -R node:node /data
USER node
EXPOSE 4324
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD ["node", "docker/healthcheck.mjs"]
CMD ["node", "server/index.mjs"]
