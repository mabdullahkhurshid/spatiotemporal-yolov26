# Backend Dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY backend/package*.json ./backend/

# Install dependencies
RUN npm install

# Copy backend code
COPY backend/ ./backend/

# Expose port
EXPOSE 5000

# Start server
CMD ["node", "backend/server.js"]
