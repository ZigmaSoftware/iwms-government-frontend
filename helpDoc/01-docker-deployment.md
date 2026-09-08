# 01 — Docker deployment (frontend)

How `iwms-government-frontend` is deployed on the server as of **2026-09-08**,
when it moved off Vite's dev server onto a container. The backend has the
matching document at
`../../iwms-government-backend/helpDoc/09-docker-cutover-2026-09-08.md`.

## What changed

| | Before | After |
|---|---|---|
| Process | `npm run dev` — Vite **dev** server | `serve -s dist` in a container |
| Bundle | unminified, HMR websocket, ~700MB RSS | production build, static files |
| Restarts | systemd ran npm as `iwmsuser` | systemd runs `docker compose up` |
| Port 3000 | Vite | `serve`, via `ports: 3000:3000` |

The dev server had been running in production for 4+ weeks. It is not built
for that: no minification, a live file watcher, and a hot-reload path that can
take the whole service down (see the outage below).

## The build-time trap: `VITE_*` is baked in, not read at runtime

Vite **inlines** `import.meta.env.VITE_*` into the JS bundle at build time.
There is no runtime environment for a static bundle — so:

> Changing `.env` does nothing until you **rebuild**. `restart` is not enough.

```bash
docker compose build && docker compose up -d
```

### Why the Dockerfile takes build args

`.dockerignore` excludes `.env` from the build context (it holds secrets and
dev-only values). Without intervention, `npm run build` inside the image sees
**no** `VITE_*` at all and produces a bundle whose API base is the string
`undefined` — it builds cleanly and fails only in the browser.

So `docker-compose.yml` reads `.env` **on the host** and passes the values in
as `args:`, which the Dockerfile declares as `ARG`/`ENV` before `npm run
build`. One source of truth, no secrets in the image.

`VITE_API_PROD` is marked required — the build fails fast rather than shipping
a broken bundle:

```yaml
VITE_API_PROD: ${VITE_API_PROD:?VITE_API_PROD must be set in .env}
```

### Always verify the URL actually landed

```bash
docker run --rm --entrypoint sh \
  ghcr.io/zigmasoftware/iwms-government-frontend:latest \
  -c 'grep -ro "115\.245\.93\.26:9001" dist/assets | head -1'
```

Expected: `dist/assets/index-<hash>.js:115.245.93.26:9001`.
**Empty output means the build args never reached Vite — do not deploy.**

## Which API URL the bundle uses

`src/config/configApi.ts` picks by `VITE_ENV`:

```ts
const ENV = import.meta.env.VITE_ENV;
const API_MAP = { local: ..., uat: ..., prod: import.meta.env.VITE_API_PROD };
```

Production values in `.env`:

```
VITE_ENV=prod
VITE_API_PROD=http://115.245.93.26:9001/api/v1
```

Two things to know:

1. **`VITE_ENV=prod` also changes local `npm run dev`** — it will talk to the
   production API. Switch it back to `local` while developing, or use a
   separate `.env.production` (Vite prefers that file during `build`).
2. The old value was `VITE_API_LOCAL=http://127.0.0.1:8000/api/v1` — wrong
   twice over: the backend is on **9001**, and `127.0.0.1` in a browser means
   the **user's own machine**, not the server.

### The browser calls the backend directly

`http://115.245.93.26:9001/api/v1` bypasses the Apache proxy, so it depends on:

- port **9001** staying open on the public IP — do **not** run
  `sudo ufw delete allow 9001/tcp`, it breaks the app;
- backend CORS accepting `http://115.245.93.26:3000` — already covered by
  `CORS_ALLOWED_ORIGIN_REGEXES` and `ALLOWED_HOSTS`.

A relative `/api/v1` would route through Apache instead and survive an IP or
domain change without a rebuild — worth revisiting when TLS goes on.

## The outage this caused (2026-09-08, ~25 min)

Editing `.env` while the **old Vite dev server** was live triggered its file
watcher:

```
[vite] .env changed, restarting server...
[vite] (client) Re-optimizing dependencies because vite config has changed
Error: EACCES: permission denied, unlink
  '.../node_modules/.vite/deps/@hookform_resolvers_zod.js'
```

Vite tried to clear its dep cache, could not, and died mid-restart — port 3000
was never rebound, and systemd still reported `active` because the parent npm
process survived.

**Root cause:** the unit ran as `User=iwmsuser`, but `node_modules/.vite/deps`
was owned by `admin` with mode `drwxr-sr-x` — **no group write**.

```bash
chmod -R g+w node_modules/.vite
```

This was latent: *any* `.env` or dependency change would have done it. The
container removes the class of problem — no watcher, no writable cache, static
files only.

## Commands

`FE=/home/admin/localserver/iwmsGovernment/iwms-government-frontend`

### Build and deploy

```bash
cd $FE
docker compose build
docker compose config                  # check resolved build args
docker images | grep iwms-government-frontend
```

### Install the systemd unit

```bash
cd $FE
sudo cp deploy/systemd/iwms-government-frontend.service /etc/systemd/system/
sudo systemctl daemon-reload
```

### Cutover (replaces the old npm-dev unit of the same name)

```bash
sudo systemctl stop iwms-government-frontend
sudo ss -lntp | grep :3000 || echo "port 3000 free"
sudo systemctl enable --now iwms-government-frontend
systemctl status iwms-government-frontend --no-pager -n 15
```

### View the container

```bash
docker ps --filter name=iwms-government-frontend
cd $FE && docker compose logs -f
cd $FE && docker compose logs --tail 50
docker logs -f iwms-government-frontend-frontend-1
cd $FE && docker compose exec frontend sh
docker stats iwms-government-frontend-frontend-1
```

Portainer UI: `https://192.168.1.128:9443`.

### After an `.env` or code change (rebuild required)

```bash
cd $FE
docker compose build
sudo systemctl restart iwms-government-frontend
docker run --rm --entrypoint sh \
  ghcr.io/zigmasoftware/iwms-government-frontend:latest \
  -c 'grep -ro "115\.245\.93\.26:9001" dist/assets | head -1'
```

### Verify

```bash
curl -o /dev/null -w 'frontend :3000 -> %{http_code}\n' http://127.0.0.1:3000/
curl -o /dev/null -w 'apache /      -> %{http_code}\n' http://127.0.0.1/
```

Then open `http://115.245.93.26:3000/` and **log in** — that is the only real
end-to-end check.

### Apache reverse proxy

The vhost lives in this repo at `deploy/apache/iwms-government.conf` and
proxies `/` → `:3000`, `/api/` and `/admin/` → `:9001`.

```bash
sudo a2enmod proxy proxy_http headers
cd $FE
sudo cp deploy/apache/iwms-government.conf /etc/apache2/sites-available/
sudo a2ensite iwms-government.conf
sudo apachectl configtest
sudo systemctl reload apache2
```

The vhost has **no `ServerName`**, so it is the catch-all default on :80 —
which also serves phpMyAdmin. Check it before and after disabling the stock
default site:

```bash
curl -o /dev/null -w 'phpmyadmin: %{http_code}\n' http://192.168.1.128/phpmyadmin/
sudo a2dissite 000-default.conf
sudo apachectl configtest && sudo systemctl reload apache2
curl -o /dev/null -w 'phpmyadmin after: %{http_code}\n' http://192.168.1.128/phpmyadmin/
```

Undo if it breaks:

```bash
sudo a2ensite 000-default.conf && sudo systemctl reload apache2
```

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| API calls go to `undefined/api/v1` | build args never reached Vite (`.env` is dockerignored) | check `docker compose config`, rebuild, verify with the `grep dist/assets` command |
| `.env` edited but nothing changed | `VITE_*` is baked in at build time | `docker compose build`, then restart |
| `ghcr.io/...: not found` | image never pushed to GHCR | `docker compose build` — do not `pull` |
| Port 3000 in use at cutover | old npm-dev unit still running | `sudo systemctl stop iwms-government-frontend`, confirm with `ss -lntp` |
| `EACCES ... node_modules/.vite` | dev-server cache not group-writable | `chmod -R g+w node_modules/.vite` (dev only) |
| CORS error in the browser | origin missing from backend regexes | add it to `CORS_ALLOWED_ORIGIN_REGEXES` in the backend `config/settings.py` |

## Outstanding

1. **HTTP only on a public IP** — no TLS on `:3000`, `:9001`, or Apache.
   Consider Let's Encrypt on the vhost, then move the frontend to a relative
   `/api/v1` to avoid mixed-content blocking.
2. **`VITE_WEIGHBRIDGE_WASTE_COLLECTION_KEY` is baked into the bundle** and
   therefore readable by anyone who views the JS. Anything in a frontend
   bundle is public — if that key grants real access, proxy the call through
   the backend instead.
3. **`corsproxy.io` third-party dependency** — `VITE_WEIGHBRIDGE_WASTE_COLLECTION_CORS_PROXY`
   routes weighbridge data through an external service. That service sees the
   requests, and an outage there breaks the feature.
4. **`VITE_ENV=prod` in the shared `.env`** affects local `npm run dev` too.
   A separate `.env.production` would decouple them.
