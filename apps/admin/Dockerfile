# ─── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

ARG VITE_API_URL=http://localhost:3001/api

# Copy monorepo root package files
COPY package.json package-lock.json ./

# Copy packages and apps package.json files
COPY packages/shared/package.json ./packages/shared/
COPY apps/admin/package.json ./apps/admin/

# Install dependencies (workspaces will be linked automatically)
RUN npm install

# Build shared package
COPY packages/shared ./packages/shared
RUN npm run build --workspace=@checkinlove/shared

# Build admin
COPY apps/admin ./apps/admin
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build --workspace=@checkinlove/admin

# ─── Stage 2: Serve ───────────────────────────────────────────────────────────
FROM nginx:1.25-alpine

COPY --from=builder /app/apps/admin/dist /usr/share/nginx/html
COPY apps/admin/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
