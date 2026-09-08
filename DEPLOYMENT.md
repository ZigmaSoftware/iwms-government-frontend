# IWMS Government Frontend — Deployment & Testing Guide

Full flow: local setup → Docker build → server install → GitHub Actions →
how to test each stage. Frontend runs on **port 3000**.

Branch policy: `sathya`/`lux`/`sameer`/`vinoth`/`pavithra` (personal) →
`dev` (integration, tests only) → `main` (production, tests + build +
deploy).

Public URL once deployed: `http://115.245.93.26:3000`

> **No nginx is used.** This server runs Apache (confirmed — nginx isn't
> installed anywhere on this machine). The container serves the built
> `dist/` folder with `serve`, a ~2MB Node static file server — it has
> nothing to do with, and doesn't conflict with, the Apache already
> running on the host.

---

## 0. From scratch: get the code onto the server + the deploy key

Do this once, on the **server** (`115.245.93.26`), before anything else in
this doc.

### 0.1 Clone the repo
```bash
sudo mkdir -p /home/admin/localserver/iwmsGovernment
sudo chown -R admin:admin /home/admin/localserver/iwmsGovernment
cd /home/admin/localserver/iwmsGovernment

git clone https://github.com/ZigmaSoftware/iwms-government-frontend.git
cd iwms-government-frontend
git checkout main
```

### 0.2 The GitHub Actions deploy key — shared with the backend repo
Both this repo and `iwms-government-backend` deploy to the same server, so
they use the **same** SSH keypair. If you've already generated it while
setting up the backend (its `DEPLOYMENT.md` §0.2), you don't need to
generate it again — just reuse that same private key value in this repo's
secret (Section 4, Step 1) too.

If this is the very first repo you're setting up, generate it here instead:
```bash
ssh-keygen -t ed25519 -f ~/.ssh/gov_deploy_key -C "github-actions-deploy" -N ""

cat ~/.ssh/gov_deploy_key.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
chmod 700 ~/.ssh

cat ~/.ssh/gov_deploy_key       # copy this ENTIRE output, BEGIN/END lines included
```

---

## 1. What's in this repo for deployment

| File | Purpose |
|---|---|
| `Dockerfile` | Multi-stage: `npm run build` → serve `dist/` with `serve` on port 3000 |
| `.dockerignore` | Keeps `node_modules`/`dist` out of the build context |
| `docker-compose.yml` | Runs the built image on the server |
| `.github/workflows/deploy.yml` | CI/CD: test → build & push image → deploy |
| `deploy/systemd/iwms-government-frontend.service` | Server-only unit file (gitignored, not pushed to GitHub) |

---

## 2. Install prerequisites (server, one-time)

```bash
# Docker + Compose plugin (skip if already installed for the backend)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker          # or log out/in

docker --version
docker compose version
```

Create the deploy directory:
```bash
sudo mkdir -p /home/admin/localserver/iwmsGovernment/iwms-government-frontend
sudo chown -R admin:admin /home/admin/localserver/iwmsGovernment
```

Copy this repo's `docker-compose.yml` into that folder.

> Vite bakes `VITE_*` env values into the JS bundle **at build time**, not
> at container run time. So the correct `.env` must exist in this repo
> when GitHub Actions builds the image — setting env vars on the server
> afterwards has no effect on already-built `dist/` files.

Allow Docker to pull from GHCR (skip if already logged in for the backend
image — same registry):
```bash
echo <YOUR_GITHUB_PAT> | docker login ghcr.io -u <github-username> --password-stdin
```

Open the firewall port:
```bash
sudo ufw allow 3000/tcp
sudo ufw reload
```

Install the systemd unit (kept locally in `deploy/systemd/`, gitignored —
copy it yourself, it's never pushed):
```bash
sudo cp deploy/systemd/iwms-government-frontend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable iwms-government-frontend.service
```

`frontend_sync.sh` has been removed from this repo — GitHub Actions now
owns deploys entirely. If the **server** still has an old cron job calling
the old script path, remove it so it doesn't fight with the new pipeline:
```bash
crontab -l           # remove any leftover line calling frontend_sync.sh, if present
crontab -e
```

---

## 3. Test locally BEFORE touching the server

### Step 1 — Build the image locally
```bash
cd /home/admin/iwms/government/webapp/iwms-government-frontend
docker build -t iwms-gov-frontend-test .
```
✅ Expect: build finishes, no TypeScript errors during the `npm run build`
step. **If this step fails with TS errors, fix them first** — the same
build runs inside GitHub Actions and will block every deploy until it's
green.

### Step 2 — Run it locally
```bash
docker run --rm -p 3000:3000 iwms-gov-frontend-test
```
✅ Expect: log line like `Accepting connections at http://localhost:3000`.

### Step 3 — Open it in a browser or curl it
```bash
curl -i http://127.0.0.1:3000/
```
Or just open `http://localhost:3000` in your browser.
✅ Expect: the app loads, and navigating to a client-side route (not just
`/`) and refreshing the page still works (no blank 404 page) — `serve -s`
handles the SPA fallback for you automatically.

### Step 4 — Run lint the same way CI will
```bash
docker run --rm --entrypoint npm iwms-gov-frontend-test run lint
```
(This works against the build stage's `node_modules`; alternatively just
run `npm run lint` directly on your machine before pushing.)

### Step 5 — Stop the local container
`Ctrl+C` in the terminal running `docker run` (step 2).

---

## 4. The git branch workflow that drives deployment

This repo's branches form a chain, and `.github/workflows/deploy.yml` only
reacts to two of them:

```
sathya / lux / sameer / vinoth / pavithra   (personal — push here freely)
              │  open a PR
              ▼
             dev          (integration branch)
              │            → push/merge here triggers the "test" job ONLY
              │              (lint + build). No image is built, nothing
              │              touches the server.
              │  open a PR, once dev is stable
              ▼
             main         (production)
                            → push/merge here triggers ALL three jobs:
                              test → build-and-push → deploy.
                              This is the ONLY branch that ever reaches
                              the server.
```

Pushing to a personal branch never runs anything — the workflow's `on:
push: branches: [dev, main]` doesn't match it.

### Step 1 — Add repo secrets (once, before the first deploy)
GitHub repo → Settings → Secrets and variables → Actions → New repository
secret — using the key from **Section 0.2** (shared with the backend repo):
- `SERVER_HOST` = `115.245.93.26`
- `SERVER_USER` = `admin`
- `SERVER_SSH_KEY` = the private key text from `cat ~/.ssh/gov_deploy_key`

### Step 2 — Push to `dev` first (safe — no deploy happens)
```bash
git checkout dev
git merge sathya          # or open a PR on GitHub instead of merging locally
git push origin dev
```
Go to the GitHub repo's **Actions** tab → confirm the `test` job (lint +
build) runs and passes. No `build-and-push` or `deploy` job should appear
for `dev`.

### Step 3 — Push to `main` (this actually deploys)
```bash
git checkout main
git merge dev              # or open a PR: dev -> main, then merge on GitHub
git push origin main
```
In the **Actions** tab, confirm all three jobs run in order and go green:
`test` → `build-and-push` → `deploy`.

### Step 4 — Verify on the server
```bash
sudo systemctl status iwms-government-frontend.service
docker compose -f /home/admin/localserver/iwmsGovernment/iwms-government-frontend/docker-compose.yml logs -f frontend
curl -i http://127.0.0.1:3000/
curl -i http://115.245.93.26:3000/     # from your own machine, over the network
```
✅ Expect: the container is `Up`, and both curl commands return the app's
HTML.

---

## 5. Manual deploy (bypassing Actions, if ever needed)

```bash
cd /home/admin/localserver/iwmsGovernment/iwms-government-frontend
docker compose pull
docker compose up -d
docker compose logs -f frontend
docker image prune -f
```

## 6. Rollback

```bash
cd /home/admin/localserver/iwmsGovernment/iwms-government-frontend
docker compose down
docker pull ghcr.io/zigmasoftware/iwms-government-frontend:<previous-commit-sha>
# edit docker-compose.yml image tag to that sha, then:
docker compose up -d
```

## 7. Quick troubleshooting

| Symptom | Check |
|---|---|
| `docker compose pull` fails | `docker login ghcr.io` again, or package visibility |
| Build fails with TS errors | Run `npm run build` locally first — CI runs the identical command |
| Page loads but env values look wrong (API URL etc.) | `.env` wasn't correct when the image was **built** — rebuild, don't just restart |
| Client-side route 404s on refresh | Confirm the container is running `serve -s` (the `-s` flag enables SPA fallback) |
| `curl` connection refused | `sudo ufw status`, `systemctl status iwms-government-frontend.service` |
| Actions `deploy` job fails at SSH step | Confirm `SERVER_SSH_KEY` public half is in server's `~/.ssh/authorized_keys` |
