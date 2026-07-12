# TransitOps — CI/CD & EC2 setup

Building-block deploy: GitHub Actions rsyncs whatever is on `main` to an
Ubuntu EC2 box and restarts a user-level systemd unit. App packages can land
later; until then deploys still succeed (service may be idle).

**Target host (example):** `ubuntu@ec2-3-109-155-36.ap-south-1.compute.amazonaws.com`  
**Suggested public URL:** `https://transitops.nrg.it.com`  
(keep `nrg.it.com` for the portfolio; use a **subdomain** for this app)  
**DNS/TLS:** `nrg.it.com` is on Cloudflare, so `transitops.nrg.it.com` is
**proxied** through Cloudflare (orange cloud) with a Cloudflare Origin CA
cert on the instance — not Certbot/Let's Encrypt. See §4.

---

## 0. What stays local vs what goes to GitHub

| Push to `main` now | Keep local until ready |
| --- | --- |
| `.github/workflows/deploy.yml` | Full `frontend/`, `ml-service/` (until you choose) |
| `deploy/*` (this folder) | Secrets, `.env`, `*.pem` (**never** commit) |
| Contracts / README / docker-compose as needed | Production DB passwords |

Do **not** commit `wnmr.pem`, `origin.pem`/`origin.key` (Cloudflare Origin
CA cert), or any other private key.

---

## 1. AWS — security group & instance

On the EC2 instance security group, allow inbound:

| Port | Source | Why |
| --- | --- | --- |
| 22 | Your IP (and optionally GitHub Actions — see note) | SSH |
| 80 | `0.0.0.0/0` (or Cloudflare IPs only, see below) | HTTP → redirects to HTTPS |
| 443 | `0.0.0.0/0` (or Cloudflare IPs only, see below) | HTTPS |

Do **not** open Postgres `5432` or app `8080` to the world; Nginx proxies
internally.

**Traffic is proxied through Cloudflare** (orange cloud), so 80/443 only
ever need to accept connections from Cloudflare's edge, not the whole
internet. Optional hardening: restrict the security group's 80/443 rules
to [Cloudflare's published IP ranges](https://www.cloudflare.com/ips/)
instead of `0.0.0.0/0` — this makes it impossible to bypass Cloudflare by
hitting the EC2 IP directly. Skip this if you'd rather not maintain the
range list; `0.0.0.0/0` is fine since the origin cert still enforces TLS.

**SSH note:** GitHub Actions runners use changing IPs. Either:

- temporarily allow `0.0.0.0/0` on port 22 (simplest for a lab), or
- restrict SSH to your IP for admin and use a deploy key + broader 22 only
  while iterating, or
- later move to SSM / a fixed bastion.

Confirm you can log in:

```bash
ssh -i wnmr.pem ubuntu@ec2-3-109-155-36.ap-south-1.compute.amazonaws.com
```

---

## 2. GitHub Actions secrets (use your existing `wnmr.pem`)

You already have the instance keypair (`wnmr.pem`). Use that for Actions —
no second key needed. Confirm SSH works first:

```bash
ssh -i wnmr.pem ubuntu@ec2-3-109-155-36.ap-south-1.compute.amazonaws.com
```

Repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Value |
| --- | --- |
| `EC2_HOST` | `ec2-3-109-155-36.ap-south-1.compute.amazonaws.com` (or the Elastic IP if you attach one) |
| `EC2_SSH_KEY` | Full contents of `wnmr.pem`, including the `-----BEGIN … KEY-----` / `-----END … KEY-----` lines |

On Windows you can copy the whole file in Notepad, or:

```powershell
Get-Content .\wnmr.pem -Raw | Set-Clipboard
```

Paste into the `EC2_SSH_KEY` secret value field.

**Do not** commit `wnmr.pem` to the repo — secrets only.

Optional later (when backend goes live):

| Secret | Value |
| --- | --- |
| `DATABASE_URL` | Prefer writing `.env` on the box once by hand instead of CI |

---

## 3. One-time software on the EC2 box

From your laptop (paths relative to this repo):

```bash
scp -i wnmr.pem deploy/setup-ec2.sh deploy/transitops.service \
  ubuntu@ec2-3-109-155-36.ap-south-1.compute.amazonaws.com:~

ssh -i wnmr.pem ubuntu@ec2-3-109-155-36.ap-south-1.compute.amazonaws.com \
  'chmod +x setup-ec2.sh && ./setup-ec2.sh'
```

Then **log out and SSH back in** once so the `docker` group applies.

What the script installs:

- Node.js 20  
- rsync  
- nginx  
- Docker + Compose plugin  
- `~/transitops`  
- `/etc/nginx/conf.d/cloudflare-realip.conf` (current Cloudflare IP ranges,
  so Nginx sees real visitor IPs instead of Cloudflare's)  
- `/etc/nginx/ssl/` (empty — you copy the Cloudflare Origin CA cert here, see §4)  
- user systemd unit `transitops` + lingering  

Elastic IP (recommended): allocate one in AWS and associate it with the
instance so DNS does not break on stop/start.

---

## 4. Subdomain for `nrg.it.com` (Cloudflare-proxied)

Keep the portfolio on the apex (`nrg.it.com` / `www`). Point a **subdomain**
at this EC2 instance, e.g. `transitops.nrg.it.com`, proxied through
Cloudflare (orange cloud). Since Cloudflare terminates public TLS at its
edge, the origin doesn't use Certbot/Let's Encrypt — it uses a free
**Cloudflare Origin CA** certificate for the Cloudflare↔origin leg.

### 4a. DNS record (Cloudflare dashboard)

Cloudflare → your zone → **DNS** → Add record:

| Type | Name | Content | Proxy status |
| --- | --- | --- | --- |
| A | `transitops` | `<EC2 Elastic IP or public IPv4>` | **Proxied** (orange cloud) |

Do **not** change the existing apex/`www` records — leave the portfolio
alone.

### 4b. SSL/TLS mode (Cloudflare dashboard)

Cloudflare → your zone → **SSL/TLS → Overview** → set encryption mode to
**Full (strict)**. This requires the origin to present a valid cert (the
Origin CA cert from the next step) — "Flexible" would talk plain HTTP to
the origin and is not what we want here.

Optional but recommended: **SSL/TLS → Edge Certificates** → turn on
**Always Use HTTPS**.

### 4c. Origin CA certificate (Cloudflare dashboard)

Cloudflare → your zone → **SSL/TLS → Origin Server** → **Create Certificate**:
- Hostnames: `transitops.nrg.it.com`
- Key format: PEM
- Validity: 15 years (default) is fine

Save the two outputs locally as `origin.pem` (certificate) and `origin.key`
(private key) — **never commit these to git**. Copy them to the instance:

```bash
scp -i wnmr.pem origin.pem origin.key \
  ubuntu@ec2-3-109-155-36.ap-south-1.compute.amazonaws.com:~

ssh -i wnmr.pem ubuntu@ec2-3-109-155-36.ap-south-1.compute.amazonaws.com
  sudo mv ~/origin.pem /etc/nginx/ssl/cloudflare-origin.pem
  sudo mv ~/origin.key /etc/nginx/ssl/cloudflare-origin.key
  sudo chmod 600 /etc/nginx/ssl/cloudflare-origin.key
```

(`/etc/nginx/ssl/` was already created by `setup-ec2.sh`.)

### 4d. Nginx site on the instance

```bash
# from laptop
scp -i wnmr.pem deploy/nginx-transitops.conf.example \
  ubuntu@ec2-3-109-155-36.ap-south-1.compute.amazonaws.com:~

# on the instance
sudo cp ~/nginx-transitops.conf.example /etc/nginx/sites-available/transitops
sudo ln -sf /etc/nginx/sites-available/transitops /etc/nginx/sites-enabled/
# optional: remove default site if it conflicts
# sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

The example config terminates TLS with the Cloudflare Origin CA cert,
redirects plain HTTP → HTTPS, and proxies to `http://127.0.0.1:8080`
(backend). `setup-ec2.sh` also drops
`/etc/nginx/conf.d/cloudflare-realip.conf`, populated with Cloudflare's
current IP ranges, so `$remote_addr` in Nginx (and `X-Real-IP` passed
upstream) reflects the actual visitor, not Cloudflare's edge IP.

Change `proxy_pass` in the example config when the frontend is served
separately or you add a root process.

**Portfolio coexistence:** as long as DNS for `nrg.it.com` still points at
whatever hosts the portfolio, and only `transitops.nrg.it.com` is proxied
to this EC2 instance, the two sites do not interfere.

**Cert rotation note:** Cloudflare Origin CA certs are long-lived (default
15 years) and not renewed by Certbot/cron — no renewal automation needed
unless you regenerate it manually in the dashboard.

---

## 5. App layout & how CI deploys it

Monorepo, three pieces:

| Piece | Runs as | Port |
| --- | --- | --- |
| `backend/` (Express + TS + Prisma) | user systemd unit `transitops` (`npm start` → `node dist/index.js`) | 8080 |
| `frontend/` (Vite + React) | static files, served directly by Nginx from `frontend/dist` | — |
| `ml-service/` (Python/FastAPI) | Docker container, via root `docker-compose.yml` | 8000 |
| Postgres | Docker container, via root `docker-compose.yml` | 5432 |

On every push to `main` (or manual **Actions → Deploy to EC2 → Run workflow**),
[.github/workflows/deploy.yml](../.github/workflows/deploy.yml):

1. `rsync --delete` → `/home/ubuntu/transitops` (excludes `.git`, `.env`,
   `node_modules`, `dist`, `*.pem` — `dist`/`node_modules` are excluded from
   deletion too, so the previous build keeps serving until the new one
   finishes rather than 404ing mid-deploy)
2. `sudo docker compose up -d --build` — (re)builds `ml-service` if it
   changed, ensures Postgres is running
3. `backend/`: `npm ci && npx prisma generate && npx prisma migrate deploy
   && npm run build`, then `systemctl --user restart transitops`
4. `frontend/`: `npm ci && VITE_API_BASE_URL=https://transitops.nrg.it.com
   npm run build` (bakes the production API origin into the static bundle)

**`backend/.env` is never touched by CI** (rsync excludes it) — it must
exist on the box already, or the service will crash-loop with
`ENOENT ... package.json`-style or `.env` errors. One-time creation:

```bash
ssh -i wnmr.pem ubuntu@ec2-3-109-155-36.ap-south-1.compute.amazonaws.com bash -s <<'EOF'
JWT=$(openssl rand -hex 32)
cat > ~/transitops/backend/.env <<ENV
DATABASE_URL=postgresql://transitops:transitops@localhost:5432/transitops
JWT_SECRET=$JWT
PORT=8080
ML_SERVICE_URL=http://localhost:8000
GOOGLE_CLIENT_ID=
ENV
EOF
```

Fill in `GOOGLE_CLIENT_ID` (and the frontend's matching
`VITE_GOOGLE_CLIENT_ID` at build time) once "Sign in with Google" needs to
work — until then that feature is just inactive, everything else runs fine.

Nginx routes by path: known backend route prefixes (`/health`, `/auth`,
`/vehicles`, `/drivers`, `/trips`, `/maintenance`, `/dashboard`,
`/reports`, `/ml`, `/fuel-logs`, `/expenses` — see
`backend/src/index.ts`) proxy to `127.0.0.1:8080`; everything else serves
`frontend/dist` with SPA fallback to `index.html`. **Update the regex in
[deploy/nginx-transitops.conf.example](nginx-transitops.conf.example) (and
re-deploy it) whenever a new top-level router is mounted in the backend.**

**Known gotcha:** Nginx runs as `www-data`, which can't traverse
`/home/ubuntu` by default (`drwxr-x---`). `setup-ec2.sh` now runs
`chmod o+x "$HOME"` (traverse-only — doesn't expose directory listings or
files with their own restrictive permissions, e.g. `.ssh`) so this is
handled automatically on fresh instances. If you bootstrapped before this
was added and the frontend 500s with `Permission denied` on `stat()` in
`/var/log/nginx/error.log`, run it by hand once: `sudo chmod o+x /home/ubuntu`.

---

## 6. Checklist (do in order)

- [x] Security group: 22 / 80 / 443
- [ ] Elastic IP attached (optional but strongly recommended — DNS breaks
      on stop/start otherwise)
- [x] Confirm `ssh -i wnmr.pem ubuntu@…` works
- [x] GitHub secrets `EC2_HOST` + `EC2_SSH_KEY` (= full `wnmr.pem`)
- [x] Run `setup-ec2.sh` on the instance; re-login for Docker group
- [x] Cloudflare DNS `A` record `transitops` → instance IP, **Proxied** (orange cloud)
- [x] Cloudflare SSL/TLS mode set to **Full (strict)**
- [x] Cloudflare Origin CA cert generated + copied to `/etc/nginx/ssl/` on the instance
- [x] Nginx site installed (`nginx -t` passes, reloaded), serving frontend + proxying backend
- [x] `sudo chmod o+x /home/ubuntu` applied (see gotcha above)
- [x] `backend/.env` created by hand on the instance
- [x] `docker compose up -d --build` (Postgres + ml-service running)
- [x] Backend built + migrated + running under systemd
- [x] Frontend built with production `VITE_API_BASE_URL`
- [ ] Confirm `git push` to `main` triggers Actions and redeploys cleanly end-to-end

---

## Manual redeploy / rollback

- Redeploy current `main`: Actions → **Run workflow**  
- Rollback: revert the bad commit on `main` and push  

## Local systemd helpers (on EC2)

```bash
systemctl --user status transitops
systemctl --user restart transitops
journalctl --user -u transitops -f
```
