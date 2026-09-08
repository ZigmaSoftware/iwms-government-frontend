# IWMS Government Frontend — Help Docs (Start Here)

This `helpDoc/` folder mirrors the one in `iwms-government-backend`. It
currently covers **deployment**, which is where this project's real surprises
live.

If you only remember one thing from this folder, remember this:

> **`VITE_*` values are baked into the JS bundle at BUILD time, not read at
> runtime.** Editing `.env` and restarting the container changes nothing — you
> must `docker compose build`. And because `.dockerignore` excludes `.env`,
> the values reach the build only as `args:` in `docker-compose.yml`.

## Contents

1. **[01-docker-deployment.md](01-docker-deployment.md)** — How the frontend
   is deployed: the Vite build-arg pipeline, which API URL the bundle points
   at and why, the systemd unit, every command (build, cutover, logs, Apache,
   verification), a troubleshooting table, and open issues.
2. **[02-docker-basics.md](02-docker-basics.md)** — Everyday Docker for both
   services: start/stop/restart the right way (and why `docker stop` alone
   does **not** hold — two supervisors), kill and force-recreate, logs, shells
   inside a container, images, health checks, disk cleanup, and a
   common-mistakes table.
3. **[03-github-actions.md](03-github-actions.md)** — The CI/CD pipeline: what
   a push to `main` actually does, the GitHub variables/secrets the build now
   requires, why the workflow refuses to push a bundle with no API URL, and
   what must be committed before the next push.

The backend's matching deployment write-up — `network_mode: host`, the
`SECRET_KEY` `$$` escaping, the database decision — is at
`../../iwms-government-backend/helpDoc/09-docker-cutover-2026-09-08.md`.

## The shape of this project on the server

```text
iwms-government-frontend/
├── Dockerfile              <- 2 stages: node build -> `serve -s dist`
│                              ARG/ENV block feeds VITE_* into `npm run build`
├── docker-compose.yml      <- ports 3000:3000; passes .env values as build args
├── .dockerignore           <- excludes .env (hence the build args)
├── .env                    <- VITE_ENV + API URLs; host-side only, never in the image
├── deploy/
│   ├── apache/             <- the host Apache vhost (proxies :3000 and :9001)
│   └── systemd/            <- the unit that runs `docker compose up`
└── src/config/configApi.ts <- picks the API base from VITE_ENV
```

## The 30-second version

```bash
cd /home/admin/localserver/iwmsGovernment/iwms-government-frontend
docker compose build                                  # after ANY .env change
sudo systemctl restart iwms-government-frontend
curl -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/     # expect 200
docker compose logs -f                                # watch it
```
