#!/usr/bin/env bash
# Fix Swytchcode's placeholder Jira host.
# Usage: ./scripts/set-jira-site.sh yourteam.atlassian.net SUP
set -euo pipefail

SITE="${1:-}"
PROJECT_KEY="${2:-}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [[ -z "$SITE" ]]; then
  echo "Usage: $0 <site.atlassian.net> [PROJECT_KEY]"
  echo "Example: $0 acme.atlassian.net SUP"
  exit 1
fi

SITE="${SITE#https://}"
SITE="${SITE%/}"

MANIFEST="$ROOT/.swytchcode/integrations/manifest.json"
WREKEN="$ROOT/.swytchcode/integrations/Jira/jira/v1/wrekenfile.yaml"
ENV_FILE="$ROOT/.env"

if [[ ! -f "$MANIFEST" || ! -f "$WREKEN" ]]; then
  echo "Missing Jira integration files. Run from the project that has .swytchcode/"
  exit 1
fi

# macOS sed
sed -i '' "s|https://your-domain.atlassian.net|https://${SITE}|g" "$MANIFEST" "$WREKEN"

touch "$ENV_FILE"
if grep -q '^JIRA_SITE_DOMAIN=' "$ENV_FILE" 2>/dev/null; then
  sed -i '' "s|^JIRA_SITE_DOMAIN=.*|JIRA_SITE_DOMAIN=${SITE}|" "$ENV_FILE"
else
  echo "JIRA_SITE_DOMAIN=${SITE}" >> "$ENV_FILE"
fi

if [[ -n "$PROJECT_KEY" ]]; then
  if grep -q '^JIRA_PROJECT_KEY=' "$ENV_FILE" 2>/dev/null; then
    sed -i '' "s|^JIRA_PROJECT_KEY=.*|JIRA_PROJECT_KEY=${PROJECT_KEY}|" "$ENV_FILE"
  else
    echo "JIRA_PROJECT_KEY=${PROJECT_KEY}" >> "$ENV_FILE"
  fi
fi

echo "Updated Jira host → https://${SITE}"
[[ -n "$PROJECT_KEY" ]] && echo "Set JIRA_PROJECT_KEY=${PROJECT_KEY}"
echo "Verify: swytchcode exec jira.api.project.list7 --json"
