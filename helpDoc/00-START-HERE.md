# IWMS Government Frontend — Start Here

A Vite + React/TypeScript SPA for government/civic waste management. It
talks to `iwms-government-backend`'s API and is served in production as a
static build behind `serve`. An Apache reverse-proxy vhost is defined in
this repo (`deploy/apache/`) but is **not currently installed** on the
server — today, both the frontend and backend are reached directly on their
public ports (`:3000`, `:9001`). See [04-cicd-flow.md](04-cicd-flow.md) for
the verified current state.

> **If you remember one thing:** `VITE_*` env values are baked into the JS
> bundle at **build** time, not read at runtime. Editing `.env` and
> restarting the container changes nothing — you must rebuild
> (`docker compose build`). Since `.dockerignore` excludes `.env`, values
> only reach the build as `args:` in `docker-compose.yml` / CI.

## The project, in one paragraph

```text
iwms-government-frontend/
├── Dockerfile              <- 2 stages: node build (bakes in VITE_*) -> `serve -s dist`
├── docker-compose.yml      <- ports 3000:3000; passes .env values as build args
├── .dockerignore           <- excludes .env (hence the build args)
├── .env                    <- VITE_ENV + API URLs; host-side only, never in the image
├── deploy/
│   ├── apache/             <- host Apache vhost (defined, NOT installed —
│   │                          see 04-cicd-flow.md)
│   └── systemd/            <- unit that runs `docker compose up` (gitignored)
└── src/config/configApi.ts <- picks the API base from VITE_ENV (local/prod)
```

## Where to go next

- **[01-local-dev.md](01-local-dev.md)** — run this repo on your own machine.
- **[02-production-deploy.md](02-production-deploy.md)** — what happens on
  push to `main`, and the manual command equivalents.
- **[03-troubleshooting.md](03-troubleshooting.md)** — symptom → cause → fix.
- **[04-cicd-flow.md](04-cicd-flow.md)** — the branch flow (developer → `dev`
  → `main`) and the self-hosted runner that turns a push into a deploy.
- **[05-docker-hub-backup.md](05-docker-hub-backup.md)** — manual, personal
  workflow for pushing a copy of this image to Docker Hub. Not part of the
  real deploy pipeline (that never touches any registry).

See also the backend's `helpDoc/00-START-HERE.md` for the API side of this
system.
