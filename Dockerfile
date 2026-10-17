# Image de production de la plateforme FECOFOOT (§8.1 : Docker).
#   docker compose build && docker compose up -d       (voir DEPLOIEMENT.md)
# Étapes : dépendances → construction → « migrator » (migrations + données de référence) → « runner » (serveur).

FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Valeurs factices pour la construction uniquement : aucune connexion à la base n'a lieu pendant le build.
ENV NEXT_TELEMETRY_DISABLED=1 \
    DATABASE_URL=postgres://build:build@localhost:5432/build \
    AUTH_SECRET=build-only-secret-build-only-secret-0000
RUN npm run build

# Migrations et données de référence (12 ligues, 6 sélections, premier super administrateur), avant le démarrage du serveur.
FROM build AS migrator
CMD ["sh", "-c", "npm run db:migrate && npm run db:seed"]

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    UPLOAD_DIR=/app/uploads
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
RUN mkdir -p /app/uploads && chown node:node /app/uploads
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/sante').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
