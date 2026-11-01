# ---------- Stage 1: build ----------
# Has everything needed to compile: all packages, the Nest CLI, TypeScript
FROM node:20-slim AS build

# Prisma's database engine needs OpenSSL
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

# Use the pnpm version from "packageManager" in package.json
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable

WORKDIR /app

# Install packages first, so this slow step is reused until package.json or the lockfile change
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Then copy the code and build it.
# prisma.config.ts requires DATABASE_URL even though `generate` never connects, so give it a placeholder
# for this command only; the real one is passed when the container runs
COPY . .
RUN DATABASE_URL="postgresql://placeholder@localhost:5432/placeholder" pnpm exec prisma generate \
 && pnpm build \
 && cp src/generated/prisma/*.node dist/generated/prisma/

# Keep only the packages the app needs to run
RUN pnpm prune --prod


# ---------- Stage 2: run ----------
# Starts again from a clean image and copies in only what's needed to run
FROM node:20-slim

RUN apt-get update -y && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./

# Don't run as root inside the container
USER node

EXPOSE 3001

# Apply pending migrations, then start the API. DATABASE_URL, JWT_SECRET etc. are passed in at run time
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node dist/main"]
