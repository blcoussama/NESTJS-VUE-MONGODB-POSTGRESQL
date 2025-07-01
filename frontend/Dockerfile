# Frontend Dockerfile - frontend/Dockerfile

# Stage 1: Build the React application
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Build the application for production
# Vite will create optimized, minified bundles in /dist
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine AS production

# Install curl for health checks
RUN apk add --no-cache curl

# Copy custom nginx configuration
COPY nginx/nginx.conf /etc/nginx/nginx.conf

# Copy built application from builder stage
# This copies only the production build, not source code or node_modules
COPY --from=builder /app/dist /usr/share/nginx/html

# Create non-root user for security
RUN addgroup -g 1001 -S nginx-user
RUN adduser -S nginx-user -u 1001

# Change ownership of nginx directories
RUN chown -R nginx-user:nginx-user /var/cache/nginx /var/run /var/log/nginx /usr/share/nginx/html

# Switch to non-root user
USER nginx-user

# Expose port 80
EXPOSE 80

# Health check for the frontend
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]