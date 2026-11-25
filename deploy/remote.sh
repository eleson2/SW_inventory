#!/usr/bin/env bash
# Runs ON THE SERVER as root, started by scripts/deploy.ts (npm run deploy): either uploaded
# and run with sudo (password), or installed by `setup-sudo` as /usr/local/sbin/sw-inventory-remote,
# which the ssh user may run with sudo without a password. Because of that, arguments are checked
# and files in /tmp are read and written as the calling user, never as root.
#
#   remote.sh setup-sudo            install this script + a sudoers rule for the calling user (once)
#   remote.sh deploy <git-sha>      back up, update code to <sha> (must be on origin/main), build, db:push,
#                                   restart (rolls back on failure)
#   remote.sh backup [label]        back up the data (JSON export + SQLite file copy)
#   remote.sh export-data           back up, then pack the JSON export as /tmp/sw-inventory-data.tgz for download
#   remote.sh import-data <tgz>     back up, then replace all data with /tmp/sw-inventory-push-*.tgz
#   remote.sh backups               list backups
#   remote.sh restore <name>        back up, then replace all data with backup <name>
#   remote.sh status                revision, service state, health
#   remote.sh logs [hours]          the app's log for the last <hours> (default 24, max 720); read-only
#
# Settings (environment, ignored by the password-less sudo): APP_DIR, BACKUP_ROOT, SERVICE, KEEP_BACKUPS
set -euo pipefail

APP_DIR=${APP_DIR:-/opt/sw-inventory/app}
BACKUP_ROOT=${BACKUP_ROOT:-/opt/sw-inventory/backups}
SERVICE=${SERVICE:-sw-inventory}
KEEP_BACKUPS=${KEEP_BACKUPS:-30}
EXPORT_TGZ=/tmp/sw-inventory-data.tgz
INSTALLED=/usr/local/sbin/sw-inventory-remote
SUDOERS=/etc/sudoers.d/sw-inventory-deploy
CALLER=${SUDO_USER:-root}

[[ $EUID -eq 0 ]] || { echo "remote.sh must run as root (sudo)" >&2; exit 1; }
[[ -d $APP_DIR/.git ]] || { echo "No git checkout in $APP_DIR (see DEPLOY.md part 1)" >&2; exit 1; }
APP_USER=$(stat -c %U "$APP_DIR")

log() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }

# Run a shell command as the app user inside the app directory
as_app() { sudo -u "$APP_USER" -H bash -c "cd '$APP_DIR' && $1"; }
# Run a command as the user who called sudo (for files in /tmp)
as_caller() { sudo -u "$CALLER" "$@"; }

env_value() { # value of KEY in .env, without quotes
	grep -E "^$1=" "$APP_DIR/.env" 2>/dev/null | tail -n1 | cut -d= -f2- | tr -d "\"'"
}

sqlite_file() { # path of the SQLite database, empty when DATABASE_URL is not file:
	local url; url=$(env_value DATABASE_URL)
	[[ $url == file:* ]] || return 0
	local path=${url#file:}; path=${path%%\?*}
	[[ $path == /* ]] && echo "$path" || echo "$APP_DIR/prisma/${path#./}"
}

health() {
	local port; port=$(env_value PORT); port=${port:-3000}
	for _ in $(seq 1 30); do
		if [[ $(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$port/login") == 200 ]]; then
			echo "Health check OK (http://127.0.0.1:$port/login -> 200)"
			return 0
		fi
		sleep 1
	done
	echo "Health check FAILED: /login did not answer 200 within 30 s" >&2
	journalctl -u "$SERVICE" -n 30 --no-pager >&2 || true
	return 1
}

# Creates $BACKUP_ROOT/<timestamp>-<label>/{json/,dev.db,REVISION}; sets BACKUP_DIR
backup() {
	local label=${1:-manual}
	[[ $label =~ ^[a-z0-9-]{1,30}$ ]] || die "invalid backup label: $label"
	BACKUP_DIR="$BACKUP_ROOT/$(date +%Y%m%d-%H%M%S)-$label"
	log "Backing up data to $BACKUP_DIR"
	mkdir -p "$BACKUP_DIR/json"
	chown -R "$APP_USER:$APP_USER" "$BACKUP_ROOT"
	chmod 700 "$BACKUP_ROOT"
	as_app "git rev-parse HEAD" > "$BACKUP_DIR/REVISION"
	as_app "npm run --silent db:export -- --dir '$BACKUP_DIR/json'"
	local db; db=$(sqlite_file)
	if [[ -n $db && -f $db ]]; then
		if command -v sqlite3 > /dev/null; then
			sqlite3 "$db" ".backup '$BACKUP_DIR/dev.db'"
		else
			cp "$db" "$BACKUP_DIR/dev.db"
		fi
		chown "$APP_USER:$APP_USER" "$BACKUP_DIR/dev.db"
	fi
	# Keep the newest $KEEP_BACKUPS backups
	ls -1d "$BACKUP_ROOT"/*/ 2>/dev/null | sort | head -n -"$KEEP_BACKUPS" | xargs -r rm -rf
}

# Replace all data with the JSON export in directory $1. Restores $BACKUP_DIR if that fails.
load_json() {
	local dir=$1
	chown -R "$APP_USER:$APP_USER" "$dir"
	systemctl stop "$SERVICE"
	if ! as_app "npm run --silent db:import -- --dir '$dir' --replace"; then
		echo "Import failed; restoring the backup taken just before" >&2
		as_app "npm run --silent db:import -- --dir '$BACKUP_DIR/json' --replace"
		systemctl start "$SERVICE"
		die "import failed, previous data restored"
	fi
	systemctl start "$SERVICE"
	health
}

build_and_restart() {
	as_app "npm ci --include=dev --no-audit --no-fund && npm run db:generate && npm run build" || return 1
	systemctl stop "$SERVICE"
	as_app "npm run db:push" || return 1
	systemctl start "$SERVICE"
	health
}

cmd_deploy() {
	local sha=${1:?usage: deploy <git-sha>}
	[[ $sha =~ ^[0-9a-f]{7,40}$ ]] || die "not a git sha: $sha"
	local old; old=$(as_app "git rev-parse HEAD")
	backup pre-deploy
	log "Updating code ${old:0:9} -> ${sha:0:9}"
	as_app "git fetch --quiet origin"
	as_app "git merge-base --is-ancestor '$sha' origin/main" || die "$sha is not on origin/main"
	as_app "git reset --hard '$sha'"
	if build_and_restart; then
		log "Deployed $(as_app 'git log -1 --format="%h %s"')"
		# Keep the password-less copy in step with the deployed code
		if [[ -f $INSTALLED ]]; then install -o root -g root -m 755 "$APP_DIR/deploy/remote.sh" "$INSTALLED"; fi
		return 0
	fi
	log "Deploy failed; rolling back to ${old:0:9}"
	as_app "git reset --hard '$old'"
	as_app "npm ci --include=dev --no-audit --no-fund && npm run db:generate && npm run build"
	systemctl restart "$SERVICE"
	health || true
	die "deploy of ${sha:0:9} failed; running ${old:0:9} again. Data backup: $BACKUP_DIR"
}

cmd_export_data() {
	backup export
	as_caller rm -f "$EXPORT_TGZ"
	tar -czf - -C "$BACKUP_DIR/json" . | as_caller sh -c "umask 077 && cat > '$EXPORT_TGZ'"
	echo "Packed $EXPORT_TGZ"
}

cmd_import_data() {
	local tgz=${1:?usage: import-data <tgz>}
	[[ $tgz =~ ^/tmp/sw-inventory-push-[0-9-]+\.tgz$ ]] || die "expected /tmp/sw-inventory-push-<time>.tgz, got: $tgz"
	as_caller test -f "$tgz" || die "no such file: $tgz"
	backup pre-import
	local dir; dir=$(mktemp -d /tmp/sw-inventory-import.XXXXXX)
	chown "$APP_USER:$APP_USER" "$dir"
	as_caller cat "$tgz" | sudo -u "$APP_USER" tar -xzf - -C "$dir"
	[[ -f $dir/software.json ]] || die "$tgz does not contain a db:export (software.json missing)"
	log "Replacing all server data"
	load_json "$dir"
	rm -rf "$dir"
	as_caller rm -f "$tgz"
	log "Data imported. Previous data saved in $BACKUP_DIR"
}

cmd_backups() {
	[[ -d $BACKUP_ROOT ]] || { echo "No backups yet"; return; }
	for d in $(ls -1d "$BACKUP_ROOT"/*/ 2>/dev/null | sort -r); do
		printf '%-32s rev %s  %s\n' "$(basename "$d")" "$(cut -c1-9 "$d/REVISION" 2>/dev/null)" "$(du -sh "$d" | cut -f1)"
	done
}

cmd_restore() {
	local name=${1:?usage: restore <backup-name>}
	[[ $name =~ ^[A-Za-z0-9_.-]+$ && -d $BACKUP_ROOT/$name/json ]] || die "no backup named $name (see: backups)"
	# Copy first: the pre-restore backup may prune the oldest backups
	local src; src=$(mktemp -d /tmp/sw-inventory-restore.XXXXXX)
	cp -a "$BACKUP_ROOT/$name/json/." "$src/"
	backup pre-restore
	log "Restoring data from $name"
	load_json "$src"
	rm -rf "$src"
	log "Restored $name. Data before the restore saved in $BACKUP_DIR"
}

cmd_setup_sudo() {
	[[ $CALLER != root ]] || die "run as the deploy user with sudo, not as root"
	install -o root -g root -m 755 "$0" "$INSTALLED"
	local rule; rule=$(mktemp)
	echo "$CALLER ALL=(root) NOPASSWD: $INSTALLED" > "$rule"
	visudo -cqf "$rule" || { rm -f "$rule"; die "sudoers rule did not validate"; }
	install -o root -g root -m 440 "$rule" "$SUDOERS"
	rm -f "$rule"
	log "Installed $INSTALLED; $CALLER may run it with sudo without a password ($SUDOERS)"
	echo "Undo: sudo rm $SUDOERS $INSTALLED"
}

cmd_logs() {
	local hours=${1:-24}
	[[ $hours =~ ^[0-9]+$ ]] && (( hours >= 1 && hours <= 720 )) || { echo "logs: hours must be 1-720" >&2; exit 1; }
	journalctl -u "$SERVICE" --since "-${hours}h" --no-pager -o short-iso
}

cmd_status() {
	echo "Revision: $(as_app 'git log -1 --format="%h %ad %s" --date=short')"
	echo "Service:  $(systemctl is-active "$SERVICE" || true)"
	echo "Database: $(env_value DATABASE_URL | sed 's#//[^@]*@#//***@#')"
	health
}

cmd=${1:-}; shift || true
case $cmd in
	deploy) cmd_deploy "$@" ;;
	setup-sudo) cmd_setup_sudo ;;
	backup) backup "${1:-manual}"; echo "Backup: $BACKUP_DIR" ;;
	export-data) cmd_export_data ;;
	import-data) cmd_import_data "$@" ;;
	backups) cmd_backups ;;
	restore) cmd_restore "$@" ;;
	status) cmd_status ;;
	logs) cmd_logs "$@" ;;
	*) sed -n '2,19p' "$0"; exit 1 ;;
esac
