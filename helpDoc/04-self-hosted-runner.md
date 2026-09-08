# 04 — Self-hosted GitHub Actions runner

How CI/CD actually reaches this server, why it has to work this way, and how
to install, operate and rebuild the runner. Set up and verified working on
**2026-09-08**.

Read [03-github-actions.md](03-github-actions.md) first for what the workflow
does; this file is about the machine that executes it.

## Why a self-hosted runner (not GitHub's cloud runners)

The original workflow SSHed into the server from a GitHub-hosted runner. That
can never work here:

| Port | Forwarded from `115.245.93.26` → `192.168.1.128`? |
|---|---|
| 80 | yes |
| 3000 | yes |
| 9001 | yes |
| **22 (SSH)** | **no** |

Verified by probing the public IP: 80/3000/9001 accept connections, while 22,
222, 2022, 2222, 22222, 8022, 2200, 10022 and 50022 are all refused. GitHub's
runners live on the public internet, so they have no route in.

A self-hosted runner inverts the direction: it **polls GitHub outbound over
HTTPS**. Nothing listens, nothing is forwarded, no inbound firewall rule and
no SSH key are involved. That is why this works where SSH could not.

It also removes GHCR from the deploy path. The image is built on the machine
that runs it, so there is no push, no pull, and no registry authentication.

> The repo secrets `SERVER_HOST`, `SERVER_USER` and `SERVER_SSH_KEY` are
> **unused** — the workflow references no secrets at all. They are harmless
> and can be deleted, or kept in case SSH is ever forwarded.

## What is installed on this server

| | Frontend | Backend |
|---|---|---|
| Runner directory | `~/actions-runner-frontend` | `~/actions-runner-backend` |
| Runner name | `iwms-gov-frontend` | `iwms-gov-backend` |
| Label | `iwms-government` | `iwms-government` |
| systemd unit | `actions.runner.ZigmaSoftware-iwms-government-frontend.iwms-gov-frontend` | `actions.runner.ZigmaSoftware-iwms-government-backend.iwms-gov-backend` |
| Runs as | `admin` | `admin` |

**Runners are per-repository** — two repos need two runners, each registered
with its own token. Both carry the same `iwms-government` label, which is what
`runs-on: [self-hosted, iwms-government]` in the workflow matches.

## Installing a runner (frontend shown)

### 1. Get a registration token

GitHub → repo → **Settings → Actions → Runners → New self-hosted runner**
(Linux / x64). Copy the token from the `--token` line.

This token is **not** an SSH key and not one of the repo secrets. GitHub mints
it on its own side; `config.sh` sends it back to prove the machine may
register. It expires in about an hour and is **used once** — after
registration the runner stores its own long-lived credential and reconnects
forever, so expiry never matters again.

### 2. Download and extract

```bash
mkdir -p ~/actions-runner-frontend && cd ~/actions-runner-frontend
curl -fsSL -o actions-runner.tar.gz \
  https://github.com/actions/runner/releases/download/v2.328.0/actions-runner-linux-x64-2.328.0.tar.gz
tar xzf actions-runner.tar.gz
```

The archive is about **227 MB**. If `tar` reports `unexpected end of file`, the
download was truncated — delete it and re-run `curl` with `--retry 3`. Check
the size before extracting.

`svc.sh` does **not** exist yet at this point; `config.sh` generates it. That
is normal, not a broken download.

### 3. Register

```bash
./config.sh --url https://github.com/ZigmaSoftware/iwms-government-frontend \
  --token PASTE_TOKEN_HERE \
  --name iwms-gov-frontend \
  --labels iwms-government \
  --unattended
```

`--labels iwms-government` is **required** — without it the workflow's
`runs-on` never matches and every run queues forever.

### 4. Install as a service

```bash
sudo ./svc.sh install admin
sudo ./svc.sh start
sudo ./svc.sh status
```

The `admin` argument is the user the runner runs as. It must be a user covered
by the sudoers rule below, and one that is in the `docker` group.

Expect, within a few seconds:

```
√ Connected to GitHub
Listening for Jobs
```

On its very first job the runner self-updates (2.328.0 → 2.337.0 here), which
adds a minute and leaves a `bin.<version>` directory behind. Normal.

## The sudoers rule — why the runner needs it

The workflow's final step is `sudo systemctl restart iwms-government-frontend`.
A CI job has no TTY, so it cannot answer a password prompt; without a NOPASSWD
rule the deploy hangs and then fails.

`../../iwms-government-backend/deploy/sudoers/iwms-runner` (installed to
`/etc/sudoers.d/iwms-runner`, mode `0440`) grants exactly that and nothing
more:

```
User_Alias IWMS_DEPLOYERS = admin, iwmsuser
Cmnd_Alias IWMS_SERVICE_CTL = restart/status/is-active on the two iwms-government units
IWMS_DEPLOYERS ALL=(root) NOPASSWD: IWMS_SERVICE_CTL
```

Deliberately narrow: two named users, six exact commands, absolute binary
path, no wildcards. It cannot **stop** a service, touch any other unit, or run
anything else as root. Both `admin` and `iwmsuser` are covered so the runner
can be installed as either — note `iwmsuser` is *not* in the `sudo` group, so
this file is its only elevated access.

Install and verify:

```bash
sudo cp ../../iwms-government-backend/deploy/sudoers/iwms-runner /etc/sudoers.d/iwms-runner
sudo chmod 440 /etc/sudoers.d/iwms-runner
sudo visudo -c

sudo -n /usr/bin/systemctl is-active iwms-government-frontend            # admin
sudo -u iwmsuser sudo -n /usr/bin/systemctl is-active iwms-government-frontend
```

Both must print `active` with no password prompt.

## Operating the runner

`svc.sh` commands prompt for your password — the sudoers rule deliberately
covers only the two app services, not the runner itself. The `systemctl` and
`journalctl` reads below need no password at all.

```bash
# status (svc.sh asks for a password; systemctl does not)
sudo ~/actions-runner-frontend/svc.sh status
systemctl status actions.runner.ZigmaSoftware-iwms-government-frontend.iwms-gov-frontend

# live logs — shows "Running job" / "Job deploy completed with result: ..."
journalctl -u actions.runner.ZigmaSoftware-iwms-government-frontend.iwms-gov-frontend -f

# just the job outcomes
journalctl -u actions.runner.ZigmaSoftware-iwms-government-frontend.iwms-gov-frontend \
  | grep -E "Connected|Listening|Running job|completed"

# stop / start / restart
sudo ~/actions-runner-frontend/svc.sh stop
sudo ~/actions-runner-frontend/svc.sh start

# remove entirely (needs a fresh removal token from the same GitHub page)
sudo ~/actions-runner-frontend/svc.sh stop
sudo ~/actions-runner-frontend/svc.sh uninstall
cd ~/actions-runner-frontend && ./config.sh remove --token REMOVAL_TOKEN
```

Job workspaces live in `~/actions-runner-frontend/_work/`. Safe to delete when
no job is running; the next run re-clones.

## Verified first run (2026-09-08)

Both pipelines ran green on the first push after setup:

```
17:39:58  Listening for Jobs
17:40:02  Running job: deploy
17:41:25  iwms-government-frontend restarted (by CI)
17:41:36  Job deploy completed with result: Succeeded
17:41:48  Listening for Jobs
```

Confirmed afterwards on the server: container up from
`ghcr.io/zigmasoftware/iwms-government-frontend:latest`, `http://127.0.0.1:3000/`
returning **200**. The backend ran the same sequence at 17:31–17:32, ending
with the API returning **401** — the healthy answer on an unauthenticated
request, proving Django ran and reached MySQL.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Run stuck "Queued" / pending forever | no runner online, or the `iwms-government` label is missing | check `svc.sh status`; re-register with `--labels iwms-government` |
| `sudo: a password is required` in the job log | sudoers rule missing or wrong mode | reinstall it, `chmod 440`, `visudo -c` |
| `tar: unexpected end of file` | truncated download (227 MB expected) | `rm` and re-`curl` with `--retry 3` |
| `svc.sh: No such file` | looking before registering | run `config.sh` first — it generates `svc.sh` |
| Runner offline after reboot | service not enabled | `sudo ./svc.sh install admin` then `start` (it enables the unit) |
| Job fails at `docker build` | runner user not in the `docker` group | `sudo usermod -aG docker <user>`, then restart the runner service |
| Deploy succeeds but the site is unchanged | browser cache, or the bundle built with stale args | hard-reload; check the "Verify the API URL landed in the bundle" step |
| Two deploys collide | — | already handled: the workflow sets `concurrency: deploy-frontend` |

## Rebuilding this from scratch

If the server is replaced, the runner is the only piece that needs manual
setup — everything else is in the repo:

1. Install Docker; add the deploy user to the `docker` group.
2. Clone both repos; create each `.env` (never in git).
3. Install the systemd units (`deploy/systemd/`, gitignored — recreate from
   [01-docker-deployment.md](01-docker-deployment.md)).
4. Install the sudoers rule.
5. Register a runner per repo, as above.
6. Push to `main` — CI does the rest.
