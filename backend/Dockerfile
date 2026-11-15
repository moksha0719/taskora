FROM node:20-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN apt-get update \
    && apt-get install --no-install-recommends -y openssl \
    && rm -rf /var/lib/apt/lists/*
RUN npm ci
RUN npm run db:generate

COPY src ./src

EXPOSE 5000

CMD ["npm", "run", "dev"]
