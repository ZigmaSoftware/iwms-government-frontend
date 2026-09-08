# 02 — Docker basics (both services)

Everyday Docker for `iwms-government-frontend` **and**
`iwms-government-backend`, using the real container names on this server. The
backend repo carries an identical copy of this section in
`../../iwms-government-backend/helpDoc/09-docker-cutover-2026-09-08.md`.

**Read this first: there are TWO supervisors.** systemd runs `docker compose
up` in the foreground, and the containers also carry `restart: always`. So a
plain `docker stop` or `docker kill` does **not** keep the container down —
compose/systemd bring it straight back.

Measured on this server:

```
docker stop iwms-government-frontend-frontend-1
t+1s  status=exited    http=000
t+2s  status=gone      http=000     <- compose removed it
t+7s  status=running   http=000     <- systemd restarted it
t+8s  status=running   http=200     <- back up, ~8s total
```

That auto-recovery is the point of the setup. But it means:

> **To actually stop a service, use `systemctl`, not `docker`.**
> Use `docker stop`/`kill` only to force a restart-in-place.

## The names you need

| | Backend | Frontend |
|---|---|---|
| systemd unit | `iwms-government-backend` | `iwms-government-frontend` |
| container | `iwms-government-backend-backend-1` | `iwms-government-frontend-frontend-1` |
| compose service | `backend` | `frontend` |
| compose file | `docker-compose.production.yml` (needs `-f`) | `docker-compose.yml` (default) |
| port | 9001 (via `network_mode: host`) | 3000 (via `ports:`) |

Shell shortcuts used below:

```bash
BE=/home/admin/localserver/iwmsGovernment/iwms-government-backend
FE=/home/admin/localserver/iwmsGovernment/iwms-government-frontend
```

## Start / stop / restart — the correct way

```bash
# STOP (stays stopped)
sudo systemctl stop iwms-government-backend
sudo systemctl stop iwms-government-frontend

# START
sudo systemctl start iwms-government-backend
sudo systemctl start iwms-government-frontend

# RESTART — the everyday command, e.g. after an .env change
sudo systemctl restart iwms-government-backend
sudo systemctl restart iwms-government-frontend

# BOTH AT ONCE
sudo systemctl restart iwms-government-backend iwms-government-frontend

# STOP AND KEEP IT OFF ACROSS REBOOTS
sudo systemctl disable --now iwms-government-backend

# TURN IT BACK ON
sudo systemctl enable --now iwms-government-backend

# IS IT RUNNING / WHY DID IT FAIL
systemctl status iwms-government-backend --no-pager -n 30
systemctl is-active iwms-government-backend iwms-government-frontend
journalctl -u iwms-government-backend -n 50 --no-pager
journalctl -u iwms-government-backend -f            # follow live
```

## Kill / force-restart a container

Legitimate when a container is wedged and you want it recreated immediately.
Both come back automatically:

```bash
# graceful stop (SIGTERM, 10s grace) — supervisor recreates it in ~8s
docker stop iwms-government-backend-backend-1

# immediate SIGKILL, no grace — use when the process ignores SIGTERM
docker kill iwms-government-frontend-frontend-1

# restart in place, keeping the same container
docker restart iwms-government-backend-backend-1
```

To stop a container **and have it stay stopped**, stop the unit first:

```bash
sudo systemctl stop iwms-government-backend
docker ps -a --filter name=iwms-government-backend
```

### If repeated `docker stop`s leave the unit `failed`

systemd rate-limits restarts (`StartLimitBurst`, default 5 starts in 10s).
Stop a container several times in quick succession and it gives up, leaving
the unit `failed` and the service genuinely down:

```bash
sudo systemctl reset-failed iwms-government-frontend
sudo systemctl start iwms-government-frontend
```

### The recreated container is a NEW container

The name is reused (`iwms-government-frontend-frontend-1`), but it is a fresh
container from the image — anything written inside it that is not on a mounted
volume is gone. The backend bind-mounts `./media` and `./static`, so uploads
and collected static files survive; the frontend mounts nothing, as it serves
only baked-in files.

## Create / recreate containers

```bash
# recreate from the current image + compose file (compose does down+up itself)
cd $BE && docker compose -f docker-compose.production.yml up -d --force-recreate
cd $FE && docker compose up -d --force-recreate

# rebuild the image, then recreate — after a CODE change
cd $BE && docker compose -f docker-compose.production.yml up -d --build
cd $FE && docker compose up -d --build

# remove containers (images and bind-mounted media/ are untouched)
cd $BE && docker compose -f docker-compose.production.yml down
cd $FE && docker compose down

# the clean way once systemd owns them:
sudo systemctl restart iwms-government-backend
```

> Prefer `systemctl restart` over `compose up -d` for routine restarts. A
> manual `up -d` detaches from systemd's foreground process, so the unit and
> reality can drift. If you do run it by hand, follow with
> `sudo systemctl restart <unit>` to hand control back.

## Inspect what is running

```bash
docker ps --filter name=iwms-government                 # just these two
docker ps -a                                            # include stopped
docker compose ls -a                                    # compose projects
docker stats iwms-government-backend-backend-1 iwms-government-frontend-frontend-1
docker inspect iwms-government-backend-backend-1
docker inspect -f '{{.State.Status}} since {{.State.StartedAt}}' iwms-government-backend-backend-1
docker inspect -f '{{.HostConfig.RestartPolicy.Name}}' iwms-government-backend-backend-1
docker top iwms-government-backend-backend-1            # processes inside
docker port iwms-government-frontend-frontend-1         # backend shows nothing: host networking
```

## Logs

```bash
# by compose (from the repo dir)
cd $BE && docker compose -f docker-compose.production.yml logs -f
cd $BE && docker compose -f docker-compose.production.yml logs --tail 100
cd $FE && docker compose logs -f

# by container name, from anywhere
docker logs -f iwms-government-backend-backend-1
docker logs --tail 100 iwms-government-frontend-frontend-1
docker logs --since 10m iwms-government-backend-backend-1
docker logs --timestamps iwms-government-backend-backend-1

# systemd's view (includes compose's own start/stop lines)
journalctl -u iwms-government-backend -f
```

`Ctrl+C` leaves a `-f` follow; it does not affect the container.

## Get a shell inside

```bash
# backend (Debian-based, has bash)
cd $BE && docker compose -f docker-compose.production.yml exec backend bash
docker exec -it iwms-government-backend-backend-1 bash

# frontend (node:20-slim — use sh)
cd $FE && docker compose exec frontend sh
docker exec -it iwms-government-frontend-frontend-1 sh

# one-off command, no interactive shell
docker exec iwms-government-backend-backend-1 python manage.py showmigrations
docker exec iwms-government-frontend-frontend-1 ls -la dist
```

`-it` is required for anything interactive (a shell, `createsuperuser`).
Scripted/non-TTY calls need `exec -T` under compose.

## Django commands (backend only)

```bash
cd $BE
docker compose -f docker-compose.production.yml exec backend python manage.py migrate
docker compose -f docker-compose.production.yml exec backend python manage.py collectstatic --noinput
docker compose -f docker-compose.production.yml exec backend python manage.py showmigrations
docker compose -f docker-compose.production.yml exec -it backend python manage.py createsuperuser
docker compose -f docker-compose.production.yml exec -it backend python manage.py shell
```

## Images

```bash
docker images | grep iwms-government
cd $BE && docker compose -f docker-compose.production.yml build
cd $FE && docker compose build
cd $BE && docker compose -f docker-compose.production.yml build --no-cache   # ignore cache
docker image rm ghcr.io/zigmasoftware/iwms-government-backend:latest         # stop the unit first
docker history ghcr.io/zigmasoftware/iwms-government-backend:latest
```

Do **not** `docker compose pull` — these images are built locally and were
never pushed to GHCR, so a pull fails with `not found`.

## Health checks

```bash
curl -o /dev/null -w 'frontend :3000 -> %{http_code}\n' http://127.0.0.1:3000/
curl -o /dev/null -w 'backend  :9001 -> %{http_code}\n' http://127.0.0.1:9001/api/v1/masters/districts/
sudo ss -lntp | grep -E ':(3000|9001)'
```

Expected: frontend **200**, backend **401**. `401` is healthy — auth rejecting
an unauthenticated request proves Django ran and reached MySQL. `500` points
at the database; `000` means nothing is listening.

## Disk cleanup

```bash
docker system df                  # what is using space
docker image prune                # dangling images only — safe
docker container prune            # stopped containers
docker builder prune              # build cache, often the biggest win
```

Avoid `docker system prune -a` on this box: it removes images not currently
running, including `portainer` and the old `compreface` containers, and forces
a full rebuild.

## Common mistakes

| Mistake | What happens | Do instead |
|---|---|---|
| `docker stop <container>` to take a service down | comes back in ~8s | `sudo systemctl stop <unit>` |
| Editing frontend `.env` then restarting | no change — `VITE_*` is baked in at build | `docker compose build` then restart |
| `docker compose pull` | `not found` — never pushed to GHCR | `docker compose build` |
| Omitting `-f docker-compose.production.yml` on the backend | compose can't find a config | always pass `-f` for the backend |
| `docker compose` from the wrong directory | no compose file found | `cd $BE` or `cd $FE` first |
| `exec` without `-it` for `createsuperuser` | hangs waiting on a TTY | add `-it` |
| Adding `ports:` to the backend compose | compose errors — illegal with `network_mode: host` | leave it out; the port is in the Dockerfile CMD |
| `docker system prune -a` | wipes unrelated images (portainer, compreface) | `docker image prune` |
