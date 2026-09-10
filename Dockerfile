# IWMS Government Frontend — Vite build served by "serve" (no nginx needed)
FROM node:20-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# VITE_* are inlined into the bundle at build time. .env is excluded by
# .dockerignore (it holds secrets and dev-only values), so the production
# values are passed in as build args by docker-compose.yml instead.
ARG VITE_ENV=prod
ARG VITE_API_LOCAL
ARG VITE_API_PROD
ARG VITE_GPS_VEHICLE_API
ARG VITE_WEIGHBRIDGE_WASTE_API
ARG VITE_WEIGHBRIDGE_WASTE_COLLECTION_KEY
ARG VITE_WEIGHBRIDGE_WASTE_COLLECTION_CORS_PROXY
ENV VITE_ENV=$VITE_ENV \
    VITE_API_LOCAL=$VITE_API_LOCAL \
    VITE_API_PROD=$VITE_API_PROD \
    VITE_GPS_VEHICLE_API=$VITE_GPS_VEHICLE_API \
    VITE_WEIGHBRIDGE_WASTE_API=$VITE_WEIGHBRIDGE_WASTE_API \
    VITE_WEIGHBRIDGE_WASTE_COLLECTION_KEY=$VITE_WEIGHBRIDGE_WASTE_COLLECTION_KEY \
    VITE_WEIGHBRIDGE_WASTE_COLLECTION_CORS_PROXY=$VITE_WEIGHBRIDGE_WASTE_COLLECTION_CORS_PROXY

# Fail the BUILD (not pull/up) if the API base for the SELECTED VITE_ENV
# never arrived. Checking VITE_API_PROD unconditionally would let a `local`
# build pass this guard on an empty VITE_API_LOCAL (as long as VITE_API_PROD
# happened to be set) and still produce a bundle calling "undefined/api/v1"
# — a green build that breaks only in the browser.
RUN case "$VITE_ENV" in \
      local) API_BASE="$VITE_API_LOCAL" ;; \
      *)     API_BASE="$VITE_API_PROD" ;; \
    esac; \
    test -n "$API_BASE" || { \
      echo "ERROR: the VITE_API_* value for VITE_ENV=$VITE_ENV is empty."; \
      echo "  local:  set it in .env (docker compose reads it as a build arg)"; \
      echo "  CI:     .github/workflows/deploy.yml passes it with --build-arg"; \
      exit 1; }

RUN npm run build

FROM node:20-slim

WORKDIR /app

# Lightweight static file server (~2MB), only used to serve the already-built
# dist/ folder — this container does not run Vite's dev server.
RUN npm install -g serve@14

COPY --from=build /app/dist ./dist

EXPOSE 3000

CMD ["serve", "-s", "dist", "-l", "3000"]
