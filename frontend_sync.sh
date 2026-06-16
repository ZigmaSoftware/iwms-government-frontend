#!/bin/bash
set -e

FRONTEND_DIR="/home/admin/localserver/iwms-frontend"
LOG="/home/admin/frontend_sync.log"
BRANCH="main"
SERVICE="vite-frontend.service"
TOKEN_FILE="$HOME/Downloads/BP.txt"
USERNAME="ZigmaSoftware"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

echo "[$TIMESTAMP] Frontend sync started" >> "$LOG"

cd "$FRONTEND_DIR"

# Load token
TOKEN=$(cat "$TOKEN_FILE" | tr -d ' \n')

# Ensure authenticated remote URL
REMOTE_URL=$(git remote get-url origin)
if [[ "$REMOTE_URL" != https://$USERNAME:* ]]; then
    NEW_URL="https://$USERNAME:$TOKEN@${REMOTE_URL#https://}"
    git remote set-url origin "$NEW_URL"
    echo "[$TIMESTAMP] Updated Git remote with credentials." >> "$LOG"
fi

git stash --include-untracked >> "$LOG" 2>&1 || true
git fetch origin "$BRANCH" >> "$LOG" 2>&1

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/$BRANCH)

if [ "$LOCAL" = "$REMOTE" ]; then
    echo "[$TIMESTAMP] Frontend already up to date." >> "$LOG"
    exit 0
fi

PREV_COMMIT=$(git rev-parse HEAD)

# Pull & rebase
if ! git pull --rebase >> "$LOG" 2>&1; then
    echo "[$TIMESTAMP] Merge error. Aborting rebase." >> "$LOG"
    git rebase --abort >> "$LOG" 2>&1 || true
    git stash pop >> "$LOG" 2>&1 || true
    exit 1
fi

# Detect frontend-relevant changes only
if git diff --name-only $PREV_COMMIT HEAD | grep -qE "src/|package.json|vite.config|tailwind.config"; then
    echo "[$TIMESTAMP] Frontenadmin@Admin:~$ systemctl list-units --type=service | grep -i react
systemctl list-units --type=service | grep -i front
systemctl list-units --type=service | grep -i iwms
systemctl list-unit-files | grep -i react
systemctl list-unit-files | grep -i front
systemctl list-unit-files | grep -i iwms
  vite-frontend.service                                 loaded    active running Vite Frontend Dev Server
  iwms-dashboard.service                                loaded    active running IWMS Dashboard - Vite Server
vite-frontend.service                                                     enabled         enabled
iwms-dashboard.service                                                    enabled         enabled
admin@Admin:~$ 
d code changed. Running npm install..." >> "$LOG"

    if ! npm install >> "$LOG" 2>&1; then
        echo "[$TIMESTAMP] npm install FAILED — rolling back to safe commit." >> "$LOG"
        git reset --hard "$PREV_COMMIT" >> "$LOG"
        exit 1
    fi

    echo "[$TIMESTAMP] Restarting frontend service..." >> "$LOG"
    if ! sudo -S systemctl restart "$SERVICE" < /home/admin/admin_password.txt >> "$LOG" 2>&1; then
        echo "[$TIMESTAMP] Frontend restart FAILED — rolling back to stable version." >> "$LOG"
        git reset --hard "$PREV_COMMIT" >> "$LOG"
        sudo -S systemctl restart "$SERVICE" < /home/admin/admin_password.txt >> "$LOG" 2>&1
        exit 1
    fi
else
    echo "[$TIMESTAMP] No relevant frontend files changed — skipping npm install + restart." >> "$LOG"
fi

git push origin "$BRANCH" >> "$LOG" 2>&1
echo "[$TIMESTAMP] Frontend sync completed." >> "$LOG"
