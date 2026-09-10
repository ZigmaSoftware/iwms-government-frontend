# Local Development

You have two ways to run the frontend locally — pick whichever matches what
you're testing.

## Option A — plain `npm run dev` (fastest, for UI/logic changes)

```bash
npm install     # only needed once, or after package.json changes
npm run dev
```

Vite prints the local URL (typically `http://localhost:5173`). Which
backend it talks to depends on `VITE_ENV` in `.env` (`local` / `prod` select
`VITE_API_LOCAL` / `VITE_API_PROD` in `src/config/configApi.ts`) — check
that if requests aren't hitting the server you expect. By default this
should point at your local backend (`http://localhost:9001`).

## Option B — Docker (parity with how it's actually deployed)

```bash
docker compose build --no-cache     # required after ANY VITE_*/.env change — values are baked in at build time
docker compose up -d
curl -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/     # expect 200
```

Use `--no-cache` when you've just changed `.env`, the `Dockerfile`, or
`docker-compose.yml`'s `args:` — Docker's layer cache keys on the exact
values passed in, and a plain `docker compose build` can silently reuse an
old cached `npm run build` layer instead of re-baking your new
`VITE_*` values. If the `curl` above returns `000`/connection-reset right
after `up -d`, that's usually just a race (the container was created but
`serve` hadn't started listening yet) — retry the curl, or check:

```bash
docker compose logs frontend       # see what the container actually did on startup
docker compose ps                  # confirm it shows "Up", not "Restarting" or exited
```

Use Option A day-to-day; use Option B when you specifically need to verify
the built bundle — e.g. confirming a `VITE_*` value actually landed:

```bash
docker run --rm --entrypoint sh ghcr.io/zigmasoftware/iwms-government-frontend:latest \
  -c "grep -rF '<expected-host>' dist/assets"
```

### Gotcha: `docker compose build` can silently bake in the PUBLIC prod API

`docker-compose.yml` reads `VITE_ENV`/`VITE_API_*` straight from `.env` on
your machine and passes them as build args — there is no separate
"local mode" it switches to automatically. `configApi.ts` picks the URL like
this:

```ts
const API_MAP = { local: VITE_API_LOCAL, prod: VITE_API_PROD };
export const API_ROOT = API_MAP[VITE_ENV] || API_MAP.local;
```

So if `.env` has `VITE_ENV=prod` (which it often does, since that's also
what production itself uses), **every local `docker compose build` bakes in
the public production API** (`VITE_API_PROD`, e.g.
`http://115.245.93.26:9001/api/v1`) — not your local backend. The build
succeeds and the site loads fine, it's just silently talking to production
instead of `localhost:9001`.

Before building locally against your own backend, check `.env`:

```bash
grep VITE_ENV .env
```

If it says `prod`, either temporarily set `VITE_ENV=local` before building,
or just use **Option A** (`npm run dev`) instead — Vite's dev server reads
`.env` live and is far less likely to leave you building against the wrong
environment by accident.

Also double-check `VITE_API_LOCAL` actually points at your backend's real
port — it should match whatever `docker compose up -d` in the backend repo
serves on (`9001` per that repo's `docker-compose.yml`), not a leftover value
from a different local setup.

## What actually differs between local and production

**For a normal deploy (push to `main`), you change nothing on the server.**
CI hardcodes `VITE_ENV=prod` and the API URLs itself (see
`.github/workflows/deploy.yml`) — there is no server-side `.env` edit, no
config toggle, no manual step. You write code, push to `main`, and the
self-hosted runner does the rest (see
[04-cicd-flow.md](04-cicd-flow.md)). The table below explains *why* that's
true — it's a comparison for understanding the setup, not a checklist of
things to go do on the server.

There is no separate "local compose file" for the frontend (unlike the
backend, which has `docker-compose.yml` vs `docker-compose.prod.yml`) — the
frontend uses the **same** `docker-compose.yml`/`Dockerfile` in both places.
What changes is purely the **values fed into the build**:

| | Local | Production |
|---|---|---|
| `VITE_ENV` | `local` | `prod` |
| API URL baked in | `VITE_API_LOCAL` (`http://127.0.0.1:9001/api/v1` — your local backend) | `VITE_API_PROD` (`http://115.245.93.26:9001/api/v1` — the public server) |
| Where those values come from | `.env` on your machine, read by `docker-compose.yml` | GitHub Actions repo variables (`vars.VITE_API_PROD`, etc.), passed as `--build-arg` in `.github/workflows/deploy.yml` — falls back to a hardcoded default if no repo variable is set |
| Who builds the image | You, by hand | The self-hosted runner, automatically on push to `main` |
| How it starts | `docker compose up -d` (by hand) | systemd (`iwms-government-frontend.service`) running `docker compose up --remove-orphans` |

CI already builds with `VITE_ENV=prod` baked into the workflow itself
(`--build-arg VITE_ENV=prod`), regardless of what your own machine's `.env`
says. Your local `.env` only affects builds you run yourself; it has no
effect on what CI builds and ships.

The other `VITE_*` values (`VITE_GPS_VEHICLE_API`,
`VITE_WEIGHBRIDGE_WASTE_*`) are the same in both environments today — they
aren't secret (anything in a frontend bundle is downloadable by any user),
so there's normally nothing else to change per environment beyond the API
URL.

## Full local flow with the backend

1. In `iwms-government-backend`: `docker compose up -d` then
   `docker compose exec -T backend python manage.py migrate`.
2. In this repo: `npm run dev`.
3. Log in through the Vite dev URL and exercise the feature.

## Tear down

```bash
docker compose down
```
