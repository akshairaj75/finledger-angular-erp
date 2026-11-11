# ==========================================
# Stage 1: Build Angular Production App
# ==========================================
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies first for Docker caching
COPY package.json package-lock.json* ./
RUN npm ci

# Copy source code and perform production AOT build
COPY . ./
RUN npm run build

# ==========================================
# Stage 2: Serve via Nginx Reverse-Proxy
# ==========================================
FROM nginx:1.27-alpine

LABEL maintainer="FinLedger Engineering <dev@finledger.com>"
LABEL description="FinLedger Web Client & Nginx Edge Reverse-Proxy"

# Remove default nginx configuration and static pages
RUN rm -rf /etc/nginx/conf.d/default.conf /usr/share/nginx/html/*

# Create SSL cert directory
RUN mkdir -p /etc/nginx/certs

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy production Angular build output
COPY --from=builder /app/dist/finledger-web/browser /usr/share/nginx/html

# Expose HTTP (80) and HTTPS (443)
EXPOSE 80 443

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]

