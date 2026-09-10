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

## The full mechanism, one diagram

```
push to main
     │
     ▼
GitHub Actions queues the "deploy" job
     │
     ▼
actions-runner-frontend (installed ON the server, running as a
systemd service) polls GitHub outbound over HTTPS and picks up the job
     │
     ├─ authenticates using its own SAVED CREDENTIAL from registration
     │  (.runner / .credentials files — see "How the runner registers"
     │  below). This is NOT a Personal Access Token — no PAT exists
     │  anywhere in this pipeline.
     │
     ▼
actions/checkout@v4 checks out the new commit into the RUNNER'S OWN
workspace (actions-runner-frontend/_work/...) — authenticated with
GitHub's auto-generated, run-scoped GITHUB_TOKEN, not a PAT either
     │
     ▼
docker build .   (runs INSIDE the runner's workspace, with VITE_*
                  values baked in as --build-arg; tags the image
                  ghcr.io/.../iwms-government-frontend:<sha> AND :latest
                  in the server's ONE shared Docker daemon)
     │
     ▼
sudo systemctl restart iwms-government-frontend
     │
     ▼
systemd's WorkingDirectory is a SEPARATE, persistent directory
(/home/admin/localserver/iwmsGovernment/iwms-government-frontend —
holding the real docker-compose.yml + .env); it runs the .service
file's ExecStart from THERE:
  docker compose up --remove-orphans
     │
     ▼
docker compose there references image: ...:latest — since the Docker
daemon is shared machine-wide (not scoped to a directory), it sees
the image step 3 JUST retagged, recreates the `frontend` container
from it. No explicit "sync a deployment clone" step exists for the
frontend (unlike the backend) because nothing here needs to be
git-synced — only the already-shared Docker image matters.
     │
     ▼
health-check polls http://127.0.0.1:3000/ until it answers 200
```

Two credentials are involved and **neither is a PAT**:
1. The runner's own long-lived credential (from one-time registration) —
   authenticates the runner itself to GitHub.
2. `GITHUB_TOKEN` — GitHub auto-generates a new one for every workflow run,
   scoped only to that run, used by `actions/checkout@v4` to clone the repo.
   You never create, store, or see this token; the runner receives it
   automatically as part of the job.

No secret named anything like `PAT`, `GH_TOKEN`, or similar is stored in
either repo's Actions secrets — see "Repo secrets and variables" below for
what actually *is* stored there (and confirmed unused).

## Apache: documented in this repo, but NOT currently active in production

**Correction, verified directly on the server (2026-09-10):** a vhost file
exists at `deploy/apache/iwms-government.conf` describing a reverse-proxy
setup — but it is **not installed**. `ls /etc/apache2/sites-enabled/` on the
production server shows only Apache's stock `000-default.conf`; the
`iwms-government.conf` site has never been enabled there. Consequently none
of the `iwms-government-error.log`/`iwms-government-access.log` files this
doc previously pointed at exist either — they're only created once that
specific vhost is enabled and has served a request.

**What actually happens today:** the frontend and backend containers
publish their ports directly to the public interface (not loopback-only),
and clients reach them straight on those ports — `http://<public-ip>:3000`
(frontend) and `http://<public-ip>:9001` (backend/API). This matches
`deploy.yml`'s own fallback default, `VITE_API_PROD =
http://115.245.93.26:9001/api/v1` — port `9001` directly, not port `80`
through a proxy. Apache **is** running on this host (confirmed via
`systemctl status apache2`, up for several days) and already serves other
things through it (phpMyAdmin shows up in its logs), but not this app.

So the diagram below describes the **intended/available** setup that ships
in this repo, not the currently-live one:

```
INTENDED (vhost installed):              CURRENT (as verified on the server):

public :80                                public :3000 ──▶ frontend container
     │                                    public :9001 ──▶ backend container
     ▼                                    (Apache running, but not involved
Apache (VirtualHost *:80)                  in either of these paths)
     ├─ /api/, /admin/ ─▶ 127.0.0.1:9001
     └─ everything else ─▶ 127.0.0.1:3000
```

To actually enable the intended setup: `sudo a2enmod proxy proxy_http`,
copy the conf to `/etc/apache2/sites-available/`, `a2ensite
iwms-government.conf`, `a2dissite 000-default.conf`, `apachectl configtest
&& systemctl reload apache2` — and switch the containers back to
loopback-only bindings so port 80/the vhost becomes the only way in. None of
that is part of any deploy workflow either way; it's a one-time host change
independent of CI/CD.

**Until that migration happens**, don't rely on `/var/log/apache2/
iwms-government-*.log` — those log files won't exist. Diagnose via each
container directly instead:

```bash
docker compose logs -f backend      # in iwms-government-backend
docker compose logs -f frontend     # in iwms-government-frontend
curl -o /dev/null -w '%{http_code}\n' http://127.0.0.1:9001/api/v1/masters/districts/
curl -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/
```

If/when the vhost setup above is actually installed, Apache's logs become
relevant again — see the vhost file's own `ErrorLog`/`CustomLog` directives
for the exact paths, and use the same direct-vs-proxied `curl` comparison to
tell Apache-layer problems apart from container-layer ones.

- Direct works, public fails → it's Apache (bad vhost, module not enabled,
  Apache down) — check `iwms-government-error.log`,
  `sudo apachectl configtest`, `systemctl status apache2`.
- Both fail identically → it's the container itself — check `docker compose
  logs`, not Apache's logs; Apache is just faithfully forwarding a request
  to something that isn't answering.
- `502`/`503` specifically from Apache → Apache is fine, but the container
  it's supposed to proxy to isn't running or isn't listening yet — check
  `docker compose ps`.

## Why a self-hosted runner, not GitHub's cloud runners

GitHub's cloud runners cannot reach this server: of the ports forwarded from
the public IP (`115.245.93.26` → `192.168.1.128`), only `80`, `3000` and
`9001` are open — **port 22 (SSH) is not forwarded**, and other common SSH
ports were confirmed refused too. The "normal" GitHub Actions deploy pattern
— a GitHub-hosted runner reaches *into* your server (SSH, copy files, run
remote commands) — simply cannot work here, because nothing can connect
inbound.

A self-hosted runner flips the direction entirely, and that's the key thing
to understand about how this whole pipeline works:

1. A small runner program (`actions-runner-frontend`) is installed **on
   this server itself**, running as a background service under systemd.
2. It continuously **polls GitHub outbound over HTTPS** — "any jobs queued
   for me?" — the same direction a browser making a request works. No
   inbound port, no firewall rule, no SSH key needed for this step.
3. When you push to `main`, GitHub marks a job ready. The runner picks it up
   on its next poll.
4. From there, **everything runs locally, in that runner's own process,
   because the runner already IS a process on this server.** `docker
   build`, `docker compose`, `systemctl restart` are ordinary shell commands
   executing on this exact machine — not remote commands sent over a
   connection. There is no "reaching the server" step to speak of, because
   the work was never anywhere else.
5. The runner reports the result back to GitHub (again, outbound) — that's
   what populates the Actions tab's log.

This is also why `SERVER_HOST`/`SERVER_SSH_KEY`/`SERVER_USER` (see below)
are unused: those secrets exist to let something *external* log into the
server. Nothing external ever needs to, since the worker doing the deploy
is already inside.

A side effect: this also removes GHCR from the deploy path — the image is
built directly on the machine that runs it, so there is no push, pull, or
registry authentication step.

## Repo secrets and variables

GitHub → repo → **Settings → Secrets and variables → Actions** has two
separate tabs:

**Secrets** (encrypted, never shown again once saved) — this repo has
`SERVER_HOST`, `SERVER_SSH_KEY`, `SERVER_USER` (same three as the backend
repo). **None of them are referenced anywhere in `deploy.yml`.** They're
leftovers from an earlier design where a GitHub-hosted runner would SSH into
the server to deploy — abandoned in favor of the self-hosted runner
precisely *because* port 22 isn't forwarded (see above). Nothing reads them;
safe to ignore, delete, or leave as-is.

**Variables** (plain text, visible in the UI) — this repo actually **uses**
these, read in `deploy.yml`'s "Build image" step as `vars.<NAME>`, each with
a hardcoded fallback so the build still works if unset:

| Variable | Falls back to |
|---|---|
| `VITE_API_PROD` | `http://115.245.93.26:9001/api/v1` |
| `VITE_GPS_VEHICLE_API` | `https://api.vamosys.com/getVehicleHistory` |
| `VITE_WEIGHBRIDGE_WASTE_API` | `https://zigma.in/d2d/folders/waste_collected_summary_report/household_collection_event_api.php` |
| `VITE_WEIGHBRIDGE_WASTE_COLLECTION_KEY` | `ZIGMA-DELHI-WEIGHMENT-2025-SECURE` |
| `VITE_WEIGHBRIDGE_WASTE_COLLECTION_CORS_PROXY` | `https://corsproxy.io/?` |

These are deliberately **variables, not secrets** — everything in a
frontend bundle is downloadable by any user, so none of it is actually
secret; there's nothing to protect by encrypting them.

To change one without touching code: **Settings → Secrets and variables →
Actions → Variables tab** → New repository variable (or edit an existing
one). Takes effect on the *next* push or manual re-run — setting a variable
does not itself trigger a deploy.

## Where SSH actually fits (it doesn't, in the running pipeline)

Because the whole point of the self-hosted runner is to avoid needing SSH
into the server, **no step in either workflow opens an SSH connection**.
The runner process is *already running on the server*, so its `run:` steps
(`docker build`, `systemctl restart`, etc.) execute as local shell commands,
not remote ones — there's no connection to make, and `SERVER_SSH_KEY` is
never read.

SSH is still how a *human* gets onto this machine to install/manage the
runner itself, install a systemd unit, or debug something CI can't reach —
that's ordinary server access, unrelated to the deploy pipeline.

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

### How the runner registers and stays connected

"Connecting to the server" is the wrong mental model here — the runner
doesn't reach the server from outside, it's a program **physically
installed on** the server that reaches out to GitHub. Two separate steps:

**One-time registration** (already done — this is how it was originally set
up, not something that happens on every deploy):
1. GitHub → repo → **Settings → Actions → Runners → New self-hosted
   runner** mints a short-lived **registration token** (expires in about an
   hour, used exactly once).
2. On the server, `./config.sh --url <repo-url> --token <token> --name
   iwms-gov-frontend --labels iwms-government` sends that token to GitHub to
   prove this machine may register.
3. GitHub responds by issuing a **long-lived credential**, which `config.sh`
   saves locally as `.runner` and `.credentials` files inside the runner's
   own directory. The one-hour registration token is now spent and
   irrelevant — this saved credential is what the runner actually uses from
   here on.
4. `sudo ./svc.sh install admin && sudo ./svc.sh start` wraps the runner as
   a systemd service so it starts on boot and stays supervised.

**Ongoing connection** (this is the part that runs 24/7): using that saved
credential, the runner process holds an outbound HTTPS long-poll to GitHub
— continuously asking "any jobs for me?" This is the same pattern a chat
app uses to receive messages without opening a port: purely outbound, no
listener on this server, nothing for a firewall to block. When a push to
`main` queues a job, the next poll picks it up.

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
