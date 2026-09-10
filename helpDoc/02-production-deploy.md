# Production Deployment

## What happens on push to `main`

Pushing to `main` (or a manual "Run workflow" dispatch) triggers a
**self-hosted runner** on the production server (`.github/workflows/deploy.yml`).
GitHub's cloud runners can't reach this server — only ports 3000/9001/80 are
forwarded, and 22 is not — so a self-hosted runner polling GitHub outbound
is used instead. Pushes to `dev` or any other branch do nothing.

In order, the workflow:

1. Checks out the new commit.
2. Builds the Docker image, passing `VITE_*` values as `--build-arg`s —
   `VITE_API_PROD`, `VITE_GPS_VEHICLE_API`, `VITE_WEIGHBRIDGE_WASTE_API`,
   `VITE_WEIGHBRIDGE_WASTE_COLLECTION_KEY`,
   `VITE_WEIGHBRIDGE_WASTE_COLLECTION_CORS_PROXY`. Each falls back to a
   hardcoded default if no GitHub Actions repo variable overrides it. These
   are not treated as secrets: everything in a frontend bundle is
   downloadable by any user, so none of this is actually secret.
3. Verifies the API host string actually landed inside `dist/assets` —
   refuses to ship an image whose API base never got baked in (a bundle
   missing it would silently call `undefined/api/v1`).
4. Restarts the service: `sudo systemctl restart iwms-government-frontend`.
5. Polls `http://127.0.0.1:3000/` until it returns `200`.
6. Prunes dangling images.

## Why build args instead of a runtime `.env`

`VITE_*` values are inlined into the JS bundle by Vite at **build** time.
`.dockerignore` excludes `.env` from the build context, so the only way
values reach the build is as `docker build --build-arg` (locally, sourced
from `.env` by `docker-compose.yml`; in CI, sourced from the workflow's
`env:` block). Editing `.env` and restarting the container — without
rebuilding — changes nothing.

## systemd

`deploy/systemd/iwms-government-frontend.service` runs `docker compose up
--remove-orphans` in the foreground so `Restart=always` works. `deploy/` is
gitignored — the installed unit under `/etc/systemd/system/` is a manual
copy, not something CI touches.

**Gotcha:** editing the unit file in the repo does nothing by itself:

```bash
sudo cp deploy/systemd/iwms-government-frontend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl restart iwms-government-frontend
```

Note this unit replaced an older `npm run dev`-based unit of the same name —
if a stale one is still bound to port 3000, stop and disable it first.

## Manual command equivalents

```bash
cd /home/admin/localserver/iwmsGovernment/iwms-government-frontend
docker compose build          # bakes in VITE_* build args from .env
sudo systemctl restart iwms-government-frontend
curl -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/     # expect 200
docker compose logs -f
```

## Apache

A vhost config exists at `deploy/apache/iwms-government.conf` describing a
reverse-proxy (`/` → `127.0.0.1:3000`, `/api/`+`/admin/` → `127.0.0.1:9001`)
— but **verified not installed** on the production server (only Apache's
stock `000-default.conf` is enabled there). Today, clients reach both
services directly on their public ports (`:3000`, `:9001`), not through
Apache. See [04-cicd-flow.md](04-cicd-flow.md) for the full detail and how
to actually install the vhost if that migration happens.
