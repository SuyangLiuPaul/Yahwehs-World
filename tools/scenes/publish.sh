#!/bin/bash
# Rebuild the event-picture gallery and publish it to https://yahwehs-scenes.netlify.app (public, no password, noindex).
set -e
cd "$(dirname "$0")/../.."
python3 tools/scenes/progress.py --site
cd /Users/pliu0036/Documents/CodingProject/assets-scenes/site-project
SITE_REAL="$(python3 -c 'import os; print(os.path.realpath("site"))')"
PROJECT_REAL="$(dirname "$SITE_REAL")"
cp -R .netlify netlify.toml "$PROJECT_REAL/" 2>/dev/null || true
dot_clean -m "$SITE_REAL" 2>/dev/null || true
cd "$PROJECT_REAL"
/Users/pliu0036/Documents/CodingProject/SmartHome/node_modules/.bin/netlify deploy --dir "$SITE_REAL" --site b7f35f48-6a60-4217-a520-21071685afd1 --prod --message "scenes gallery (1443 merged)" | tail -10

