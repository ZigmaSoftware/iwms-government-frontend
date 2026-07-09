#!/bin/bash
set -euo pipefail
export PATH="/usr/local/bin:/usr/bin:/bin:$PATH"

FRONTEND_DIR="/home/admin/localserver/iwmsGovernment/iwms-government-frontend"
LOG_DIR="/home/admin/localserver/iwmsGovernment/logs"
LOG="$LOG_DIR/frontend_sync.log"
BRANCH="main"
SERVICE="vite-frontend.service"
TOKEN_FILE="$HOME/Downloads/BP.txt"
PASSWORD_FILE="/home/admin/admin_password.txt"
USERNAME="ZigmaSoftware"
REPO_URL="https://github.com/ZigmaSoftware/iwms-government-frontend.git"
NPM_BIN="/usr/local/bin/npm"

STASH_CREATED=0
PREV_COMMIT=""
AUTH_REPO_URL=""
BOOTSTRAPPED_DEPS=0

log() {
    local timestamp
    timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] $1" >> "$LOG"
}

ensure_origin_remote() {
    local current_remote=""

    if git remote get-url origin >/dev/null 2>&1; then
        current_remote=$(git remote get-url origin)
        if [[ "$current_remote" != "$REPO_URL" ]]; then
            git remote set-url origin "$REPO_URL"
            log "Updated origin to $REPO_URL."
        fi
    else
        git remote add origin "$REPO_URL"
        log "Added missing origin remote: $REPO_URL."
    fi
}

restore_stash() {
    if [[ "$STASH_CREATED" -eq 1 ]]; then
        if git stash pop >> "$LOG" 2>&1; then
            log "Restored stashed local changes."
        else
            log "Stash restore needs manual attention."
        fi
    fi
}

restart_service() {
    if [[ -f "$PASSWORD_FILE" ]]; then
        sudo -S systemctl restart "$SERVICE" < "$PASSWORD_FILE" >> "$LOG" 2>&1
    else
        sudo systemctl restart "$SERVICE" >> "$LOG" 2>&1
    fi
}

rollback() {
    if [[ -n "$PREV_COMMIT" ]]; then
        log "Rolling back to $PREV_COMMIT."
        git reset --hard "$PREV_COMMIT" >> "$LOG" 2>&1
        restart_service || true
    fi
}

trap restore_stash EXIT

mkdir -p "$LOG_DIR"
log "Frontend sync started."

if [[ ! -d "$FRONTEND_DIR/.git" ]]; then
    log "Frontend repo not found at $FRONTEND_DIR."
    exit 1
fi

if [[ ! -r "$TOKEN_FILE" ]]; then
    log "Token file not found at $TOKEN_FILE."
    exit 1
fi

TOKEN=$(tr -d ' \n' < "$TOKEN_FILE")
if [[ -z "$TOKEN" ]]; then
    log "Token file is empty."
    exit 1
fi

AUTH_REPO_URL="https://${USERNAME}:${TOKEN}@github.com/ZigmaSoftware/iwms-government-frontend.git"

cd "$FRONTEND_DIR"

ensure_origin_remote

if [[ ! -x "$NPM_BIN" ]]; then
    log "npm not found at $NPM_BIN."
    exit 1
fi

HAS_UNTRACKED=0
if [[ -n "$(git ls-files --others --exclude-standard)" ]]; then
    HAS_UNTRACKED=1
fi

if ! git diff --quiet || ! git diff --cached --quiet || [[ "$HAS_UNTRACKED" -eq 1 ]]; then
    git stash push --include-untracked -m "frontend-sync-$(date +%s)" >> "$LOG" 2>&1
    STASH_CREATED=1
    log "Stashed local changes before sync."
fi

git fetch "$AUTH_REPO_URL" "$BRANCH:refs/remotes/origin/$BRANCH" >> "$LOG" 2>&1

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse "origin/$BRANCH")

if [[ "$LOCAL" == "$REMOTE" ]]; then
    if [[ ! -d node_modules ]]; then
        log "node_modules missing. Installing dependencies before exit."
        if ! "$NPM_BIN" install >> "$LOG" 2>&1; then
            log "npm install failed while bootstrapping dependencies."
            exit 1
        fi

        BOOTSTRAPPED_DEPS=1
    fi

    if [[ "$BOOTSTRAPPED_DEPS" -eq 1 ]]; then
        log "Restarting frontend service after dependency bootstrap."
        if ! restart_service; then
            log "Frontend restart failed after dependency bootstrap."
            exit 1
        fi
    fi

    log "Frontend already up to date."
    exit 0
fi

PREV_COMMIT="$LOCAL"

if ! git pull --rebase "$AUTH_REPO_URL" "$BRANCH" >> "$LOG" 2>&1; then
    log "Merge error. Aborting rebase."
    git rebase --abort >> "$LOG" 2>&1 || true
    exit 1
fi

CHANGED_FILES=$(git diff --name-only "$PREV_COMMIT" HEAD)
if [[ -n "$CHANGED_FILES" ]]; then
    log "Frontend repo updated."

    if [[ ! -d node_modules ]] || echo "$CHANGED_FILES" | grep -qE '(^package\.json$|^package-lock\.json$)'; then
        log "Installing npm dependencies."
        if ! "$NPM_BIN" install >> "$LOG" 2>&1; then
            log "npm install failed."
            rollback
            exit 1
        fi
    fi

    log "Restarting frontend service."
    if ! restart_service; then
        log "Frontend restart failed."
        rollback
        exit 1
    fi
fi

AHEAD_COUNT=$(git rev-list --count "origin/$BRANCH..HEAD")
if [[ "$AHEAD_COUNT" -gt 0 ]]; then
    log "Local branch is ahead by $AHEAD_COUNT commit(s). Pushing to origin."
    if ! git push "$AUTH_REPO_URL" "$BRANCH" >> "$LOG" 2>&1; then
        log "Push failed after successful sync."
        exit 1
    fi
fi

log "Frontend sync completed."
