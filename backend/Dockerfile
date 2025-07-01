# Backend Dockerfile - backend/Dockerfile

# Development stage
FROM node:18-alpine AS development

# Install development tools
RUN apk add --no-cache dumb-init curl

# Set working directory
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev)
RUN npm ci && npm cache clean --force

# Install nodemon globally for hot reloading
RUN npm install -g nodemon

# Copy source code
COPY . .

# Change ownership
RUN chown -R nodejs:nodejs /app
USER nodejs

# Expose port and debugger port
EXPOSE 4000 9229

# Development command with nodemon and debugger
CMD ["nodemon", "--inspect=0.0.0.0:9229", "src/index.js"]

# Production stage
FROM node:18-alpine AS production

# Install production dependencies only
RUN apk add --no-cache dumb-init curl

# Set working directory
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY . .

# Change ownership
RUN chown -R nodejs:nodejs /app
USER nodejs

# Expose port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:4000/api/health || exit 1

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Start application
CMD ["node", "src/index.js"]