# Backend Dockerfile
# Node 22 LTS: the version development and the test suite run on.
FROM node:22-alpine

RUN apk add --no-cache ffmpeg

WORKDIR /app

# Install production dependencies exactly as locked (package-lock.json)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy backend code
COPY backend/ ./backend/

ENV NODE_ENV=production

# Expose port
EXPOSE 5000

# Start server (node directly, so SIGTERM from `docker stop` reaches the graceful shutdown handler)
CMD ["node", "backend/server.js"]
