# Production image for Express API (multi-tenant backend)
FROM node:20-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY . .

RUN mkdir -p /app/logs/events \
  && chown -R node:node /app

ENV NODE_ENV=production
EXPOSE 5001

USER node
CMD ["node", "server.js"]
