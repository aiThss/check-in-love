# Stage 1: Builder
FROM node:20-alpine AS builder

WORKDIR /app

# Copy monorepo root package files
COPY package.json package-lock.json ./

# Copy packages and apps package.json files
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/

# Install dependencies (workspaces will be linked automatically)
RUN npm install

# Copy source code of shared package and build it
COPY packages/shared ./packages/shared
RUN npm run build --workspace=@checkinlove/shared

# Copy source code of api and build it
COPY apps/api ./apps/api
RUN npm run build --workspace=@checkinlove/api

# Stage 2: Runner
FROM node:20-alpine AS runner

WORKDIR /app

# Copy built outputs and node_modules
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/package.json ./package.json
COPY --from=builder /app/packages ./packages

RUN mkdir -p /app/uploads

EXPOSE 3001

CMD ["node", "dist/index.js"]
