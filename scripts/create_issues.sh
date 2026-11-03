#!/usr/bin/env bash
# Creates labels and issues from issues/*.md in the current GitHub repo.
# Usage (inside the cloned repo): bash scripts/create_issues.sh [owner/repo]
set -euo pipefail
REPO_ARG=()
if [ "${1:-}" != "" ]; then REPO_ARG=(--repo "$1"); fi

for l in spike mobile backend web design research epic sync security spec priority:high; do
  gh label create "$l" "${REPO_ARG[@]}" --force >/dev/null
done

for f in issues/*.md; do
  title=$(sed -n '1s/^TITLE: //p' "$f")
  labels=$(sed -n '2s/^LABELS: //p' "$f")
  body=$(mktemp)
  tail -n +4 "$f" > "$body"
  gh issue create "${REPO_ARG[@]}" --title "$title" --label "$labels" --body-file "$body"
  rm -f "$body"
done
