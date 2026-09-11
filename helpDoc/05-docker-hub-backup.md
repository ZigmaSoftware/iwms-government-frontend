# Manual Docker Hub Backup (personal, not part of CI/CD)

> **This is NOT part of the real deploy pipeline.** Production never pushes to
> or pulls from any registry — see
> [04-cicd-flow.md](04-cicd-flow.md) (the "Why a self-hosted runner" section):
> the self-hosted runner builds this image directly on the server it runs on,
> so GHCR/Docker Hub are never part of that path. The steps below are a
> **manual, personal workflow** for pushing a copy of the frontend image (and,
> if you're doing all three, the backend + db images too — see
> `../../iwms-government-backend/helpDoc/05-docker-hub-backup.md`) to a Docker
> Hub account — useful for backup, sharing an image outside this server, or
> working from a different machine. Running these commands changes nothing
> about how the actual server deploys.

## Prerequisites

```bash
docker login -u <your-dockerhub-username>
# password prompt: paste a Personal Access Token (PAT), not your account
# password — Docker Hub requires a PAT for CLI login.
docker info | grep -i username     # confirms who you're pushing as
```

Create/rotate a PAT at
**https://app.docker.com/accounts/\<your-dockerhub-username\>/settings/personal-access-tokens**
→ *Generate new token*. Give it an expiration and only **Read & Write** scope
if you intend to push. Docker Hub shows the token once — copy it immediately,
it can't be viewed again. Never paste a PAT or the contents of
`~/.docker/config.json` into a chat/doc/ticket — the `auth` field there is
just base64 of `username:token`, trivially reversible, so pasting it is the
same as pasting the raw token.

## Build and push the frontend image

`VITE_*` values are baked into the JS bundle at **build time**, not read at
container runtime (see [01-local-dev.md](01-local-dev.md)), so they must be
passed as `--build-arg`, pulled from your local `.env`:

```bash
cd iwms-government-frontend
docker build \
  --build-arg VITE_ENV=prod \
  --build-arg VITE_API_PROD="$(grep ^VITE_API_PROD= .env | cut -d= -f2-)" \
  --build-arg VITE_GPS_VEHICLE_API="$(grep ^VITE_GPS_VEHICLE_API= .env | cut -d= -f2-)" \
  --build-arg VITE_WEIGHBRIDGE_WASTE_API="$(grep ^VITE_WEIGHBRIDGE_WASTE_API= .env | cut -d= -f2-)" \
  --build-arg VITE_WEIGHBRIDGE_WASTE_COLLECTION_KEY="$(grep ^VITE_WEIGHBRIDGE_WASTE_COLLECTION_KEY= .env | cut -d= -f2-)" \
  --build-arg VITE_WEIGHBRIDGE_WASTE_COLLECTION_CORS_PROXY="$(grep ^VITE_WEIGHBRIDGE_WASTE_COLLECTION_CORS_PROXY= .env | cut -d= -f2-)" \
  -t <username>/iwms-government-frontend:latest .
docker push <username>/iwms-government-frontend:latest
```

### Gotcha: check `VITE_ENV` before building

Per [01-local-dev.md](01-local-dev.md)'s "silently bake in the PUBLIC prod
API" gotcha — if your `.env` has `VITE_ENV=prod` (common, since production
uses the same value), this build bakes in the **public production API URL**,
not your local backend. That's usually what you want for a backup push
(it mirrors what's actually live), but confirm intentionally:

```bash
grep VITE_ENV .env
```

### Nothing here is secret

Everything baked into this bundle is downloadable by any site visitor once
deployed anyway (see [01-local-dev.md](01-local-dev.md) and
[04-cicd-flow.md](04-cicd-flow.md)) — pushing this image publicly reveals
nothing that isn't already exposed by the live site.

## Verify

```bash
docker images | grep <username>
```

Or check `https://hub.docker.com/u/<username>` in a browser. To confirm the
expected API host actually landed in the pushed image's bundle:

```bash
docker run --rm --entrypoint sh <username>/iwms-government-frontend:latest \
  -c "grep -rF '<expected-host>' dist/assets"
```

## Related docs

- [04-cicd-flow.md](04-cicd-flow.md) — the actual, automated deploy path (no
  registry involved at all).
- [01-local-dev.md](01-local-dev.md) — full detail on the `VITE_*` build args
  and the local-vs-prod build gotcha.
- `../../iwms-government-backend/helpDoc/05-docker-hub-backup.md` — the
  backend + re-tagged MariaDB images, if you're backing up all three.
