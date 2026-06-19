# Stage 1: Builder
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json ./
RUN npm install

COPY src ./src
COPY tsconfig.json ./

RUN npm run build

# Stage 2: Runner
FROM node:20-alpine AS runner

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

RUN mkdir -p /app/uploads

EXPOSE 3001

CMD ["node", "dist/index.js"]
