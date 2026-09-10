# CI/CD Flow (Frontend)

The full path from a developer's laptop to the live production site, and the
self-hosted runner that makes it work. Read
[02-production-deploy.md](02-production-deploy.md) first for what the
workflow's steps actually do — this file is about the **branch flow** and the
**machine that executes it**.

## Branch flow

```
<developer> (sathya, sameer, vinoth, lux, pavithra, ...)
        │  PR
        ▼
      dev
        │  PR
        ▼
      main  ──push──▶  GitHub Actions ──▶ self-hosted runner ──▶ Docker build
                                                                       │
                                                                       ▼
                                                         systemd restart on the
                                                         production server
```

- Each developer works on their own branch (named after themselves) and opens
  a PR into `dev`.
- `dev` accumulates changes from multiple developers before they go live.
- A PR from `dev` into `main` is what actually ships — **only `main` triggers
  a deploy.** Pushing directly to `dev`, to an individual developer branch, or
  to any branch other than `main` does nothing; the workflow does not even
  start.
- A manual re-deploy of the current `main` is possible from the Actions tab
  (`workflow_dispatch`) without a new push.

## Why a self-hosted runner, not GitHub's cloud runners

GitHub's cloud runners cannot reach this server: of the ports forwarded from
the public IP (`115.245.93.26` → `192.168.1.128`), only `80`, `3000` and
`9001` are open — **port 22 (SSH) is not forwarded**, and other common SSH
ports were confirmed refused too. A self-hosted runner sidesteps this
entirely by **polling GitHub outbound over HTTPS** — nothing needs to be
forwarded inbound, and no SSH key is involved.

This also removes GHCR from the deploy path: the image is built directly on
the machine that runs it, so there is no push, pull, or registry
authentication step.

## What is installed on the server (frontend runner)

| | Value |
|---|---|
| Runner directory | `/home/admin/localserver/iwmsGovernment/actions-runner-frontend` |
| Runner name | `iwms-gov-frontend` |
| Label | `iwms-government` (matches `runs-on: [self-hosted, iwms-government]` in `deploy.yml`) |
| systemd unit | `actions.runner.ZigmaSoftware-iwms-government-frontend.iwms-gov-frontend` |
| Runs as | `admin` |

**This frontend has its own runner, entirely separate from the backend's.**
Runners are registered per-repository, so the backend repo has its own runner
process (`iwms-gov-backend`) with its own directory and systemd unit — see
the backend's `helpDoc/04-cicd-flow.md`. Both happen to run on the same
physical machine and share the same `iwms-government` label, but they are two
independent processes: a frontend push never wakes the backend runner, and
vice versa.

## What the frontend runner actually does, end to end

1. **GitHub queues the job** against any registered runner for this repo
   whose labels match `[self-hosted, iwms-government]` — here, that's always
   `iwms-gov-frontend`.
2. **The runner polls it up outbound**, checks out the new commit into its
   own workspace (`actions-runner-frontend/_work/...`), and starts the job.
3. **`docker build`** runs right there on the server, passing `VITE_*`
   values in as `--build-arg`s (see [02-production-deploy.md](02-production-deploy.md)
   for why they must be build args, not runtime env).
4. **A verification step** greps the built bundle to confirm the API host
   string actually landed inside it — refuses to ship a bundle that would
   silently call `undefined/api/v1`.
5. **systemd restarts the service**, which brings the new image up via
   `docker compose`.
6. **A health check** polls `http://127.0.0.1:3000/` until it answers `200`.
7. The runner goes back to idle, polling for the next push to `main`.

Only one deploy can be in flight at a time (`concurrency: group:
deploy-frontend`), so two rapid pushes never race each other.

## Operating the runner

```bash
cd /home/admin/localserver/iwmsGovernment/actions-runner-frontend
sudo ./svc.sh status
sudo ./svc.sh stop
sudo ./svc.sh start
```

Logs: GitHub → repo → **Actions** tab shows every run; the runner's own
process logs live under `_diag/` in its directory.

If a run is stuck **"Queued"** forever, the runner is offline or its label
doesn't match — check `svc.sh status`, and confirm the runner is still
registered under **Settings → Actions → Runners** in GitHub.

## Related docs

- [02-production-deploy.md](02-production-deploy.md) — what the workflow's steps do to the running service.
- [03-troubleshooting.md](03-troubleshooting.md) — runner/sudoers failures specific to CI.
- `../../iwms-government-backend/helpDoc/04-cicd-flow.md` — the backend's own runner, same pattern, separate process.
