# 03 — GitHub Actions (CI/CD)

Both repos have `.github/workflows/deploy.yml`. They are **live**: a push to
`main` deploys to this server automatically.

| Push to | What happens |
|---|---|
| `main` | build image → push to GHCR → SSH to this server → `compose pull` + `up -d` |
| `dev` | nothing — the workflow does not start (triggers are `main` only) |
| any other branch | nothing |

The deploy job SSHes in using `secrets.SERVER_HOST`, `SERVER_USER`,
`SERVER_SSH_KEY` and runs, in the repo directory:

```bash
docker compose [-f docker-compose.production.yml] pull <service>
docker compose [-f docker-compose.production.yml] up -d <service>
docker image prune -f
```

## Two supervisors, now three ways in

CI's `docker compose up -d` **detaches from systemd**. The unit's foreground
`docker compose up` process is not the one CI creates, so after a CI deploy
`systemctl status` can look healthy while the running container came from CI.
It works, but the two views drift.

After any CI deploy, hand control back to systemd:

```bash
sudo systemctl restart iwms-government-backend    # or -frontend
```

## The frontend's build-arg problem (fixed 2026-09-08)

CI ran a plain `docker build .`. Once the Dockerfile started taking `VITE_*`
build args — and with `.dockerignore` excluding `.env` from the build context —
that produced a bundle whose API base was the literal `undefined`. **A green
build, a pushed image, an app broken in the browser.**

The workflow now passes them explicitly and refuses to push a bad image:

1. **Verify build args are configured** — fails if `vars.VITE_API_PROD` is empty.
2. **Build image** — passes every `VITE_*` as `--build-arg`.
3. **Verify the API URL landed in the bundle** — greps `dist/assets` for the
   host from `VITE_API_PROD` and fails the job if absent.

### No GitHub configuration required

The values are hardcoded in the workflow. That is deliberate: **nothing in a
frontend bundle is secret.** Every `VITE_*` value is inlined into JS that any
user can download and read, the URLs are public endpoints, and the weighbridge
key is already hardcoded in `src/utils/wasteApi.ts` — a GitHub secret would add
indirection without adding protection.

A repo variable still wins if one is set:

```yaml
VITE_API_PROD: ${{ vars.VITE_API_PROD || 'http://115.245.93.26:9001/api/v1' }}
```

So a value can be overridden from the GitHub UI (Settings → Secrets and
variables → Actions → Variables) without editing the workflow — useful when the
server IP changes. Nothing breaks if no variable exists.

> If a genuinely secret value is ever needed by the frontend, it cannot go in
> the bundle at all. Proxy the call through the backend, which reads its own
> `.env` at runtime on the server.

### Why grepping for "undefined" does not work

The obvious guard — fail if the bundle contains `undefined/api` — was tried
and **verified not to work**: Vite emits a bare `undefined` literal, and
minified JS is full of unrelated `undefined`s. The working guard asserts the
real host **is** present. Confirmed against both a good and a deliberately
broken image.

## `pull` vs `build` on this server

The compose files carry **both** `image:` and `build:`:

- **CI** pushes to GHCR, then the server **pulls** — the normal path.
- **Manually** on the server, `docker compose build` builds locally, which is
  how the cutover was done because nothing had been pushed to GHCR yet.

`docker compose pull` fails with `not found` until CI has pushed at least once.
The server is already `docker login`-ed to `ghcr.io`, so pulls work once an
image exists.

## Before the next push to `main`

The cutover changed files that CI depends on. Nothing is committed yet, so CI
has not seen any of it:

| File | Why it must be committed |
|---|---|
| `docker-compose.production.yml` | `network_mode: host` — without it the container cannot reach MySQL |
| `Dockerfile` (frontend) | the `ARG`/`ENV` block CI now feeds |
| `docker-compose.yml` (frontend) | `build:` + args block |
| `.github/workflows/deploy.yml` (frontend) | the build args and guards |
| `deploy/systemd/*.service` | referenced by the runbook |

`.env` files are gitignored and stay that way — production values live on the
server and, for CI, in repo variables.

> Untested from the server: the **GHCR push** and the **SSH deploy** steps
> have never run successfully (the lowercase bug killed every run before
> them), so their permissions and secrets — `SERVER_HOST`, `SERVER_USER`,
> `SERVER_SSH_KEY`, and the org's "allow Actions to publish packages" setting
> — are unverified. If the first green build fails, it will be at one of
> those two steps.
