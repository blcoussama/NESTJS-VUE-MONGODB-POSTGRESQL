# syntax=docker/dockerfile:1
# =============================================================================
# PROFYLE frontend (Vue 3 + Vite) : build statique servi par nginx non-root.
#
#   docker build -t profyle-frontend ./frontend
#   docker build --build-arg VITE_API_URL=https://api.exemple.tld/api ./frontend
#
# VITE_API_URL est incorpore dans le bundle au build (ce n'est PAS un secret :
# ne jamais y mettre de cle). Par defaut "/api" : nginx relaie vers le backend.
# =============================================================================

ARG NODE_VERSION=22
ARG NGINX_VERSION=1.28

# --- build : npm ci + vite build --------------------------------------------
FROM node:${NODE_VERSION}-bookworm-slim AS build
WORKDIR /app
ENV NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FUND=false
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY . .
ARG VITE_API_URL=/api
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build

# --- runtime : nginx "unprivileged" (utilisateur nginx, port 8080) ----------
FROM nginxinc/nginx-unprivileged:${NGINX_VERSION}-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
