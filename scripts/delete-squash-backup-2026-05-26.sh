#!/usr/bin/env bash
# One-shot cleanup for the 2026-05-26 develop-squash backup branch.
# Fired by ~/Library/LaunchAgents/health.denali.backup-cleanup.plist on 2026-06-25.
# Self-unloads from launchd + deletes its own plist after a successful run, so
# annual re-fires don't happen.

set -uo pipefail

REPO=/Users/cvr/dev/denali
BRANCH=backup/develop-pre-squash-2026-05-26
EXPECTED_SHA=fcc595139dadfc771735326bbe030511e7ceb903
LOG=/tmp/denali-backup-cleanup.log
PLIST=/Users/cvr/Library/LaunchAgents/health.denali.backup-cleanup.plist
LABEL=health.denali.backup-cleanup
MEMORY_FILE=/Users/cvr/.claude/projects/-Users-cvr-dev-denali/memory/project-backup-branch-cleanup-2026-06-25.md

# DRY_RUN=1 prints what would happen without performing any destructive op.
# Use to verify script logic before the 2026-06-25 scheduled fire.
DRY_RUN="${DRY_RUN:-0}"
do_or_dry() {
  if [ "$DRY_RUN" = "1" ]; then
    echo "DRY-RUN would run: $*"
  else
    "$@"
  fi
}

if [ "$DRY_RUN" = "1" ]; then
  echo "==== DRY-RUN MODE — no destructive ops will execute ===="
else
  exec >> "$LOG" 2>&1
fi
echo
echo "==== $(date) ===="

cd "$REPO" || { echo "FAIL: cannot cd to $REPO"; exit 1; }

# Refresh local view of origin so origin/<branch> reflects actual remote state.
git fetch origin --prune 2>&1 || { echo "FAIL: git fetch"; exit 1; }

LOCAL_SHA=$(git rev-parse "$BRANCH" 2>/dev/null || echo "ABSENT")
REMOTE_SHA=$(git rev-parse "origin/$BRANCH" 2>/dev/null || echo "ABSENT")

echo "Local  : $LOCAL_SHA"
echo "Origin : $REMOTE_SHA"
echo "Expect : $EXPECTED_SHA"

# Defensive: if either ref exists AND differs from expected, do NOT delete.
# That would indicate the branch was re-purposed and the cleanup is stale.
if [ "$LOCAL_SHA" != "ABSENT" ] && [ "$LOCAL_SHA" != "$EXPECTED_SHA" ]; then
  echo "ABORT: local SHA differs from expected; not deleting. Investigate manually."
  exit 1
fi
if [ "$REMOTE_SHA" != "ABSENT" ] && [ "$REMOTE_SHA" != "$EXPECTED_SHA" ]; then
  echo "ABORT: origin SHA differs from expected; not deleting. Investigate manually."
  exit 1
fi

if [ "$LOCAL_SHA" = "ABSENT" ] && [ "$REMOTE_SHA" = "ABSENT" ]; then
  echo "Both refs already absent; nothing to delete. Cleaning up plist + memory anyway."
else
  if [ "$LOCAL_SHA" != "ABSENT" ]; then
    do_or_dry git branch -D "$BRANCH" && echo "Deleted local: $BRANCH"
  fi
  if [ "$REMOTE_SHA" != "ABSENT" ]; then
    do_or_dry git push origin --delete "$BRANCH" && echo "Deleted origin: $BRANCH"
  fi
fi

# Drop the corresponding Claude memory entry so future sessions don't try to act
# on a deleted branch. Failure here is non-fatal.
if [ -f "$MEMORY_FILE" ]; then
  do_or_dry rm -f "$MEMORY_FILE" && echo "Removed memory file: $MEMORY_FILE"
fi

# Self-unload from launchd and remove the plist so the schedule doesn't refire
# next year (StartCalendarInterval has no Year field — annual reentry is the
# default unless the agent is removed).
do_or_dry launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null \
  || do_or_dry launchctl unload "$PLIST" 2>/dev/null \
  || true
do_or_dry rm -f "$PLIST" && echo "Removed plist: $PLIST"

echo "One-shot complete."
