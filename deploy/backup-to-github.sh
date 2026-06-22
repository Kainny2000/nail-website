#!/usr/bin/env bash
# Snapshot the local uploads + manifest into a private GitHub repo.
# Runs every 4 hours via cron. The main repo (bareformbysh.com code) stays the
# source of truth for code; this private repo is purely an offsite backup of
# user-uploaded content, in case the home PC's disk dies.
set -euo pipefail

BACKUP_REPO="${BACKUP_REPO:-git@github.com:Kainny2000/nail-website-backups.git}"
BRANCH="${BRANCH:-main}"
KEY="${BACKUP_KEY:-$HOME/.ssh/nail_backup_key}"
UPLOAD_SRC="${UPLOAD_SRC:-$HOME/nail-uploads}"
DATA_SRC="${DATA_SRC:-$HOME/nail-data}"
STAGING="${STAGING:-$HOME/nail-backup-staging}"
LOG_DIR="${LOG_DIR:-$HOME/log}"
LOG_FILE="$LOG_DIR/backup.log"

mkdir -p "$LOG_DIR" "$STAGING"
chmod 700 "$STAGING"

if [[ ! -d "$UPLOAD_SRC" || ! -d "$DATA_SRC" ]]; then
  echo "$(date -Iseconds) backup skipped: source dirs missing" >> "$LOG_FILE"
  exit 0
fi

export GIT_SSH_COMMAND="ssh -i $KEY -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new"

cd "$STAGING"
if [[ ! -d .git ]]; then
  git init -q -b "$BRANCH"
  git remote add origin "$BACKUP_REPO"
fi

# Pull latest so we don't conflict with ourselves.
git fetch --quiet origin "$BRANCH" 2>/dev/null || true
git reset --hard "origin/$BRANCH" 2>/dev/null || true

mkdir -p uploads data
rsync -a --delete --exclude='totp.json' "$UPLOAD_SRC/" ./uploads/
rsync -a --delete "$DATA_SRC/manifest.json" ./data/ 2>/dev/null || true

git add -A
if git diff --cached --quiet; then
  exit 0
fi

git -c user.email="nail-backup@bareformbysh.com" \
    -c user.name="nail-backup" \
    commit -q -m "backup: $(date -Iseconds)"
git push -q origin "$BRANCH"
echo "$(date -Iseconds) backup pushed to $BACKUP_REPO" >> "$LOG_FILE"
