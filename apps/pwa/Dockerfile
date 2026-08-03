# ─── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS build

WORKDIR /app

ARG VITE_API_URL=http://localhost:3001/api

# Copy monorepo root package files
COPY package.json package-lock.json ./

# Copy packages and apps package.json files
COPY packages/shared/package.json ./packages/shared/
COPY apps/pwa/package.json ./apps/pwa/

# Install dependencies (workspaces will be linked automatically)
RUN npm install

# Build shared package
COPY packages/shared ./packages/shared
RUN npm run build --workspace=@checkinlove/shared

# Build PWA
COPY apps/pwa ./apps/pwa
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build --workspace=@checkinlove/pwa

# ─── Stage 2: Serve ───────────────────────────────────────────────────────────
FROM nginx:alpine

COPY --from=build /app/apps/pwa/dist /usr/share/nginx/html
COPY apps/pwa/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
