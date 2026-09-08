# IWMS Government Frontend — Deployment Guide

Full flow: local setup → Docker build → server install → GitHub Actions →
nginx reverse proxy. Frontend runs on **port 3000** internally.

Branch policy: `sathya`/`lux`/`sameer`/`vinoth`/`pavithra` (personal) →
`dev` (integration, tests only) → `main` (production, tests + build +
deploy).

Public URL once nginx is set up (§5): `http://115.245.93.26/` — no port
needed. Until then, directly: `http://115.245.93.26:3000`.

The container serves the built `dist/` folder with `serve`, a ~2MB Node
static file server — nothing to do with, and doesn't conflict with, nginx
sitting in front of it on the host (see §5).

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
secret (Section 3, Step 1) too.

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
| `deploy/nginx/iwms-government.conf` | Host-level nginx reverse proxy config — routes `/` here, `/api/` and `/admin/` to the backend. Committed. See §5. |

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

Open the firewall port (temporary, direct access — once nginx is set up in
§5, only 80/443 need to stay open publicly):
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

## 3. The git branch workflow that drives deployment

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
```
✅ Expect: the container is `Up`, and the curl command returns the app's
HTML.

---

## 4. Manual deploy (bypassing Actions, if ever needed)

```bash
cd /home/admin/localserver/iwmsGovernment/iwms-government-frontend
docker compose pull
docker compose up -d
docker compose logs -f frontend
docker image prune -f
```

## 5. nginx — reverse proxy in front of both containers

This server originally ran Apache (confirmed — nothing custom, just the
stock default install page at `/var/www/html/index.html`). Apache is
disabled in favor of nginx, which now owns ports 80/443 and routes to both
this frontend container and the backend container, so the site is reached
at a plain URL — no `:3000`/`:9001` — and TLS can be added here later.

### 5.1 Disable Apache (confirmed nothing depends on it)
```bash
sudo systemctl disable --now apache2
```

### 5.2 Install nginx
```bash
sudo apt update
sudo apt install -y nginx
```

### 5.3 Install the reverse proxy config
The config lives in this repo at `deploy/nginx/iwms-government.conf` —
committed, so it's the same for everyone:
```bash
sudo cp deploy/nginx/iwms-government.conf /etc/nginx/sites-available/iwms-government.conf
sudo ln -s /etc/nginx/sites-available/iwms-government.conf /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default   # remove nginx's own stock placeholder site

sudo nginx -t                 # validate the config before reloading
sudo systemctl reload nginx
sudo systemctl enable nginx
```

### 5.4 Open the standard web ports, close the direct-access ones
```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp        # once TLS is configured
sudo ufw delete allow 3000/tcp
sudo ufw delete allow 9001/tcp   # (run from the backend repo's context, or just here — same firewall)
sudo ufw reload
```
Port 3000/9001 stay reachable at `127.0.0.1` for nginx's own `proxy_pass`
(nginx runs on the same host) — closing them externally just stops anyone
from bypassing nginx and hitting the containers directly from outside.

### 5.5 Verify
```bash
curl -i http://127.0.0.1/            # frontend, via nginx
curl -i http://127.0.0.1/api/v1/     # backend, via nginx
curl -i http://115.245.93.26/        # from your own machine
```
✅ Expect: both routes respond correctly through nginx, with no port
number in the URL.

### Adding a real domain + TLS later
Once you have a domain pointed at `115.245.93.26`:
1. Edit `deploy/nginx/iwms-government.conf`'s `server_name _;` to your
   real domain.
2. `sudo apt install -y certbot python3-certbot-nginx`
3. `sudo certbot --nginx -d yourdomain.com` — certbot edits the nginx
   config in place to add the TLS block and a port-443 `server{}`.

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
| `curl` connection refused (direct, port 3000) | `sudo ufw status`, `systemctl status iwms-government-frontend.service` |
| `curl http://115.245.93.26/` fails but `:3000` direct works | nginx issue, not the container — `sudo nginx -t`, `sudo systemctl status nginx`, check `/var/log/nginx/error.log` |
| `502 Bad Gateway` from nginx | The container it's proxying to (frontend or backend) isn't running — check `docker compose ps` on both repos |
| Actions `deploy` job fails at SSH step | Confirm `SERVER_SSH_KEY` public half is in server's `~/.ssh/authorized_keys` |
