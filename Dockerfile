# Build Stage
FROM node:18-alpine AS build

WORKDIR /app

# Install dependencies (using package-lock.json for consistency)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source code
COPY . .

# Build the app
RUN npm run build

# Production Stage
FROM nginx:alpine

# Copy built assets from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 8080 (Cloud Run default)
EXPOSE 8080

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
