FROM node:22-bookworm-slim AS base

WORKDIR /app

RUN apt-get update \
    && apt-get install --no-install-recommends -y openssl \
    && rm -rf /var/lib/apt/lists/*

FROM base AS development

ENV NODE_ENV=development

COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts tsconfig.prisma.json ./
RUN npm ci
RUN DATABASE_URL="postgresql://localhost:5432/taskora?schema=public" npm run db:generate

COPY src ./src

EXPOSE 5000

CMD ["npm", "run", "dev"]

FROM development AS migration

ENV NODE_ENV=production
USER node

CMD ["npm", "run", "db:deploy"]

FROM base AS production-dependencies

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

FROM base AS production

ENV NODE_ENV=production
WORKDIR /app

COPY --from=production-dependencies --chown=node:node /app/package.json /app/package-lock.json ./
COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=development --chown=node:node /app/build/generated/prisma ./build/generated/prisma
COPY --from=development --chown=node:node /app/prisma ./prisma
COPY --from=development --chown=node:node /app/src ./src

USER node

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:5000/health/ready').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "src/server.js"]
