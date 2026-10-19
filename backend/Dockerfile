# syntax=docker/dockerfile:1
# =============================================================================
# PROFYLE backend (NestJS 11, Prisma 7)
#
# Etapes : base -> deps -> build -> migrate (cible optionnelle) / prod-deps -> runtime
# Cible par defaut (derniere etape) : `runtime`, l'image applicative minimale.
# Cible `migrate` : image jetable qui execute `prisma migrate deploy`
#   (la CLI Prisma est une devDependency : elle n'est volontairement PAS
#   embarquee dans l'image runtime).
#
#   docker build -t profyle-backend ./backend                      # runtime
#   docker build --target migrate -t profyle-migrate ./backend     # migrations
# =============================================================================

ARG NODE_VERSION=22

# --- base : Node 22 slim + openssl (requis par les moteurs Prisma) + tini ----
FROM node:${NODE_VERSION}-bookworm-slim AS base
WORKDIR /app
ENV NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FUND=false
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates tini \
    && rm -rf /var/lib/apt/lists/*

# --- deps : toutes les dependances (build + CLI Prisma) ----------------------
FROM base AS deps
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

# --- build : prisma generate + nest build -----------------------------------
FROM deps AS build
COPY prisma ./prisma
COPY prisma.config.ts nest-cli.json tsconfig.json tsconfig.build.json ./
COPY src ./src
# `prisma generate` ne se connecte pas a la base (DATABASE_URL non requise ici).
RUN npx prisma generate && npm run build

# --- migrate : `prisma migrate deploy` (a lancer comme job ponctuel) ---------
FROM build AS migrate
ENV NODE_ENV=production
USER node
# DATABASE_URL doit etre fournie a l'execution (lue par prisma.config.ts).
CMD ["node_modules/.bin/prisma", "migrate", "deploy"]

# --- prod-deps : dependances de production uniquement ------------------------
FROM base AS prod-deps
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev

# --- runtime : image finale ---------------------------------------------------
FROM base AS runtime
ENV NODE_ENV=production \
    PORT=3000

COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
# Client Prisma genere (node_modules/.prisma/client) depuis l'etape build.
COPY --from=build --chown=node:node /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json ./

# Point d'entree : tolere les deux dispositions possibles de `nest build`
# (dist/main.js ou dist/src/main.js si prisma.config.ts est compile aussi).
# Il ne lance PAS les migrations (voir la cible `migrate`) : un demarrage
# d'application ne doit pas modifier le schema de la base de maniere implicite.
COPY --chmod=755 <<'ENTRYPOINT_EOF' /usr/local/bin/docker-entrypoint.sh
#!/bin/sh
set -eu
if [ -f dist/main.js ]; then
  entry=dist/main.js
elif [ -f dist/src/main.js ]; then
  entry=dist/src/main.js
else
  echo "docker-entrypoint: ni dist/main.js ni dist/src/main.js trouves" >&2
  exit 1
fi
exec node "$entry" "$@"
ENTRYPOINT_EOF

USER node
EXPOSE 3000

# GET /api/health : endpoint de sante du backend (sans authentification, non limite en debit).
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/docker-entrypoint.sh"]
