# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY packages packages/

RUN npm install
RUN npm run build

# Runtime stage
FROM node:18-alpine

WORKDIR /app

RUN apk add --no-cache postgresql-client

COPY --from=builder /app/node_modules node_modules/
COPY --from=builder /app/packages/api/dist packages/api/dist/
COPY --from=builder /app/packages/core/dist packages/core/dist/

COPY .env.example .env

EXPOSE 3000

CMD ["node", "packages/api/dist/server.js"]
