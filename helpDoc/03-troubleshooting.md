# Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| API calls go to `undefined/api/v1` | Build args never reached Vite (`.env` is dockerignored) | `docker compose config` to check the args, rebuild, verify with the `grep dist/assets` command in [02](02-production-deploy.md) |
| `.env` edited but nothing changed | `VITE_*` is baked in at build time, not read at runtime | `docker compose build`, then restart |
| `ghcr.io/...: not found` | Image was never pushed to GHCR — it's built on the server | `docker compose build` — do not `pull` |
| Port 3000 already in use at cutover | Old `npm run dev`-based systemd unit still running | `sudo systemctl stop iwms-government-frontend`, confirm free with `ss -lntp` |
| `EACCES ... node_modules/.vite` | Dev-server cache not group-writable | `chmod -R g+w node_modules/.vite` (local dev only) |
| CORS error in the browser | Frontend origin missing from backend's allowed regexes | Add it to `CORS_ALLOWED_ORIGIN_REGEXES` in the backend's `config/settings.py` |
| Client-side route 404s on refresh | Container isn't running `serve -s` (the `-s` flag enables SPA fallback) | Confirm the Dockerfile's `CMD` still has `-s` |
| `curl` connection refused on :3000 | Service down or firewalled | `sudo ufw status`, `systemctl status iwms-government-frontend` |
| `curl` to the public IP fails but `:3000` direct works | Apache issue, not the container | `sudo apachectl configtest`, `systemctl status apache2`, check `/var/log/apache2/iwms-government-error.log` |
| `502`/`503` from Apache | The container it proxies to isn't running | Check `docker compose ps` in both repos |
| Deploy succeeds but the site looks unchanged | Browser cache, or the bundle built with stale build args | Hard-reload; check CI's "Verify the API URL landed in the bundle" step |
| Two deploys collide | — | Already handled — the workflow sets `concurrency: deploy-frontend` |
| Run stuck "Queued" forever | No runner online, or missing the `iwms-government` label | Check `svc.sh status`; re-register with `--labels iwms-government` |
| `sudo: a password is required` in a job log | Sudoers rule missing, wrong mode, or command string doesn't match exactly | Reinstall the rule, `chmod 440`, `visudo -c` |
| Runner offline after reboot | Service not enabled | `sudo ./svc.sh install <user>` then `start` |
| Job fails at `docker build` | Runner's user isn't in the `docker` group | `sudo usermod -aG docker <user>`, restart the runner service |

## Logs

```bash
journalctl -u iwms-government-frontend.service -f
docker compose logs -f frontend
```
