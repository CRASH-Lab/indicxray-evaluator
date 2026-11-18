# IndicXray evaluator — React app served by nginx, for Google Cloud Run.
# The backend URL is NOT baked in: set the API_URL env var on the Cloud Run
# service; docker/env-config.sh writes it into env-config.js at startup.
#
# Build:  docker build -t indicxray-evaluator .
# Run:    docker run --rm -p 8080:8080 -e API_URL=http://localhost:8000 indicxray-evaluator

FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
# The nginx entrypoint runs every script in /docker-entrypoint.d before starting
COPY docker/env-config.sh /docker-entrypoint.d/40-env-config.sh
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
