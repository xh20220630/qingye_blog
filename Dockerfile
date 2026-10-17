FROM node:24-bookworm-slim AS build
WORKDIR /app
ENV ASTRO_TELEMETRY_DISABLED=1
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches
RUN npm install --global pnpm@10.33.0 \
    && pnpm install --frozen-lockfile --store-dir /pnpm/store
COPY . .
ARG SITE_URL=http://localhost:8080
ENV SITE_URL=${SITE_URL}
RUN pnpm build

FROM nginx:alpine AS runtime
COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY --from=build /app/dist /usr/share/nginx/html
USER nginx
EXPOSE 4324
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:4324/ || exit 1
ENTRYPOINT ["nginx"]
CMD ["-g", "daemon off;"]
