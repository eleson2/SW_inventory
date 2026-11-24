# Deploying SW Inventory on an Ubuntu cloud server

Target: Ubuntu 22.04 / 24.04, SQLite database, one demo login, HTTPS via Caddy.

All commands are run on the **server** unless marked **(PC)**.
Paths assume the app lives in `/opt/sw-inventory/app` and runs as user `swinv`.

---

## Part 1 – One-time setup

### 1. Install Node 26 (LTS), git and firewall

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl ufw

curl -fsSL https://deb.nodesource.com/setup_26.x | sudo -E bash -
sudo apt install -y nodejs
node -v                      # must print v26.x

sudo ufw allow OpenSSH
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

If your cloud provider has its own firewall (security group etc.), open ports 80 and 443 there too.

### 2. Create the app user and get the code

```bash
sudo adduser --system --group --home /opt/sw-inventory swinv
sudo -u swinv git clone <your-repo-url> /opt/sw-inventory/app
cd /opt/sw-inventory/app
```

### 3. Create the settings file `.env`

```bash
openssl rand -hex 32                                  # copy the output, used as AUTH_SECRET
sudo -u swinv nano /opt/sw-inventory/app/.env
```

Paste and edit:

```
DATABASE_URL="file:./dev.db"
AUTH_USERNAME=demo
AUTH_PASSWORD=pick-a-strong-password
AUTH_SECRET=paste-the-openssl-output-here
ORIGIN=https://demo.yourdomain.com
PORT=3000
HOST=127.0.0.1
```

- `AUTH_PASSWORD` – at least 8 characters. **This is the login password.**
- `AUTH_SECRET` – the 64 characters from `openssl rand -hex 32`.
- `ORIGIN` – exactly the address people type in the browser (no trailing slash).
  Without a domain: `http://<server-ip>`.
- `DATABASE_URL="file:./dev.db"` – SQLite; the database file becomes `prisma/dev.db`.

Save in nano: **Ctrl+O**, **Enter**, **Ctrl+X**. Then:

```bash
sudo chown swinv:swinv /opt/sw-inventory/app/.env
sudo chmod 600 /opt/sw-inventory/app/.env
```

Check the database type is picked up – must print `sqlite: ...`:

```bash
cd /opt/sw-inventory/app
sudo -u swinv npm run db:schema
```

> Create `.env` **before** step 4. If the `db:*` commands run without it, everything
> silently defaults to PostgreSQL.

### 4. Install, create the database, build

```bash
cd /opt/sw-inventory/app
sudo -u swinv npm ci --include=dev
sudo -u swinv npm run db:generate          # must print [db] provider=sqlite
sudo -u swinv npm run db:push
sudo -u swinv npm run build
```

`--include=dev` is required: the build tools and `db:*` scripts are dev dependencies.

### 5. Load data (choose one)

**A. Demo test data**

```bash
sudo -u swinv npm run db:seed
```

**B. Your own data from your PC**

(PC) in the project folder:

```bash
npm run db:export                           # writes backup/*.json
scp -r backup/ user@server:/tmp/
```

Server:

```bash
sudo cp -r /tmp/backup /opt/sw-inventory/app/
sudo chown -R swinv:swinv /opt/sw-inventory/app/backup
cd /opt/sw-inventory/app
sudo -u swinv npm run db:import -- --replace
```

The export is plain JSON, so exporting from PostgreSQL on the PC and importing into SQLite
on the server is fine. `--replace` empties the tables first.

### 6. Run the app as a service

```bash
sudo tee /etc/systemd/system/sw-inventory.service > /dev/null <<'EOF'
[Unit]
Description=SW Inventory
After=network.target

[Service]
User=swinv
WorkingDirectory=/opt/sw-inventory/app
ExecStart=/usr/bin/node --env-file=.env build
Restart=on-failure
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now sw-inventory
sudo systemctl status sw-inventory          # should say: active (running)
curl -I http://127.0.0.1:3000/              # should return 303 -> /login
```

### 7. HTTPS with Caddy

Point a DNS **A record** (e.g. `demo.yourdomain.com`) at the server IP, then:

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy

sudo tee /etc/caddy/Caddyfile > /dev/null <<'EOF'
demo.yourdomain.com {
    reverse_proxy 127.0.0.1:3000
}
EOF
sudo systemctl reload caddy
```

Open `https://demo.yourdomain.com` → login page. Certificates are obtained and renewed automatically.

*No domain yet?* Use `:80 {` instead of the domain line and set `ORIGIN=http://<server-ip>` in
`.env` (then `sudo systemctl restart sw-inventory`). The password then travels unencrypted —
only for quick tests.

---

## Part 2 – Updating and moving data (automated, from the PC)

Once Part 1 is done, everything below runs **(PC)** in the project folder. It needs ssh access
with a user that has `sudo` (key login recommended; a sudo password is asked once per command).
Add to the PC's `.env`:

```
DEPLOY_HOST=ubuntu@demo.yourdomain.com
```

| Task | Command |
|---|---|
| Deploy the current commit | `git push`, then `npm run deploy` |
| Server status + health check | `npm run deploy -- status` |
| Copy server data to the PC | `npm run deploy -- data:pull` (saved in `backup/server-<time>/`) |
| ...and load it into the local DB | `npm run deploy -- data:pull --load` |
| Replace server data with local data | `npm run deploy -- data:push` (asks for confirmation) |
| Push an earlier export | `npm run deploy -- data:push --dir backup/server-20261124-101500` |
| Back up server data now | `npm run deploy -- backup` |
| List / restore server backups | `npm run deploy -- backups`, `npm run deploy -- restore <name>` |

**Server data is never lost silently.** Before every deploy, push and restore the server's
data is saved in `/opt/sw-inventory/backups/<time>-<reason>/` (JSON export, a copy of the
SQLite file, and the git revision). The newest 30 are kept.

What `npm run deploy` does (`deploy/remote.sh` on the server):
1. Refuses if the commit isn't on GitHub yet (the server pulls from there); uncommitted
   local changes are not deployed.
2. Backs up the data, checks out exactly that commit, `npm ci`, `db:generate`, `build`.
3. Stops the service, `db:push` (schema changes), starts it, checks `/login` answers 200.
4. If any step fails it goes back to the previous commit, rebuilds and restarts.
   `db:push` refuses changes that would lose data, so the deploy fails instead.

Data moves as `db:export` JSON, so the PC may use PostgreSQL and the server SQLite.
Deploy the code before pushing data from a newer schema.

### Manual update (if the script can't be used)

```bash
cd /opt/sw-inventory/app
sudo -u swinv npm run db:export -- --dir /opt/sw-inventory/backups/manual-$(date +%F)
sudo -u swinv git pull
sudo -u swinv npm ci --include=dev
sudo -u swinv npm run db:generate
sudo -u swinv npm run db:push               # only needed if the schema changed
sudo -u swinv npm run build
sudo systemctl restart sw-inventory
```

## Part 3 – Everyday tasks

| Task | Command |
|---|---|
| Change password | edit `AUTH_PASSWORD` in `.env`, then `sudo systemctl restart sw-inventory` |
| Log everyone out | change `AUTH_SECRET` in `.env`, then restart |
| View logs | `journalctl -u sw-inventory -f` |
| Status | `sudo systemctl status sw-inventory` |
| Back up data | `sudo -u swinv npm run db:export` (writes `backup/*.json`) or copy `prisma/dev.db` while the service is stopped |
| Reload data from backup | `sudo -u swinv npm run db:import -- --replace`, then restart |

Always use the `npm run db:*` scripts, never bare `npx prisma ...` (that always uses PostgreSQL).

---

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `tsx: not found` / `vite: not found` | `npm ci` failed or skipped dev deps. Run `sudo -u swinv npm ci --include=dev` and read its output for errors. |
| `npm ci` fails: lock file out of sync | Run `sudo -u swinv npm install` once. Then get the changed `package-lock.json` into git (commit it, or copy it to the PC and commit there) so the next `git pull` is clean. |
| `git pull` complains about `package-lock.json` | `sudo -u swinv git checkout package-lock.json`, then pull again. |
| Anything mentions PostgreSQL / `postgresql://` | `.env` was missing or unreadable when `db:generate` ran. Check `npm run db:schema` prints `sqlite`, then rerun `db:generate`, `db:push`, `build`, restart. Also make sure `printenv DATABASE_URL` is empty (a global value overrides `.env`). |
| `Unit sw-inventory.service not found` | Step 6 has not been done yet. |
| Service won't start | `journalctl -u sw-inventory -n 50 --no-pager`. Common: `AUTH_SECRET must be set` (missing/short value in `.env`); wrong node path (`which node`, fix `ExecStart`); permissions (`sudo chown -R swinv:swinv /opt/sw-inventory/app`). |
| Login form gives **403** | `ORIGIN` in `.env` doesn't exactly match the browser address (http vs https, www, port). Fix and restart. |
| `Target database is not empty` on import | Add `--replace`: `npm run db:import -- --replace`. |
| `EACCES` / permission denied | `sudo chown -R swinv:swinv /opt/sw-inventory/app` |
| Site not reachable from outside | Check Caddy: `sudo systemctl status caddy`, DNS points to the server, ports 80/443 open in ufw **and** the cloud provider firewall. |
