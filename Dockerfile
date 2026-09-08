# IWMS Government Frontend — Vite build served by "serve" (no nginx needed)
FROM node:20-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-slim

WORKDIR /app

# Lightweight static file server (~2MB), only used to serve the already-built
# dist/ folder — this container does not run Vite's dev server.
RUN npm install -g serve@14

COPY --from=build /app/dist ./dist

EXPOSE 3000

CMD ["serve", "-s", "dist", "-l", "3000"]
