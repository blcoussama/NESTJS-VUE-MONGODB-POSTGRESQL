# Backend Dockerfile - backend/Dockerfile

# Use Node.js 18 Alpine for smaller image size and security
FROM node:18-alpine

# Why Alpine? 
# - Smaller image size (~5MB vs ~150MB for standard Node)
# - Better security (minimal attack surface)
# - Faster downloads and deployments

# Set working directory inside container
WORKDIR /app

# Install dumb-init for proper signal handling
# This ensures graceful shutdowns and proper process management
RUN apk add --no-cache dumb-init

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Copy package.json and package-lock.json first
# This leverages Docker layer caching - dependencies change less frequently than source code
COPY package*.json ./

# Install dependencies
# --only=production skips devDependencies in production
# --no-cache prevents npm cache in image layers
RUN npm ci --only=production && npm cache clean --force

# Copy source code
# Done after npm install to maximize cache efficiency
COPY . .

# Change ownership to nodejs user
RUN chown -R nodejs:nodejs /app
USER nodejs

# Expose the port your app runs on
EXPOSE 4000

# Health check to monitor container health
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:4000/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })" \
    || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "src/index.js"]